"""Check asset publication and, optionally, two actual rolling Nginx instances."""

import importlib.util
import json
import multiprocessing
import os
from pathlib import Path
import subprocess
import tempfile
import time
import unittest
from urllib.error import HTTPError, URLError
from urllib.request import urlopen
import uuid


ROOT = Path(__file__).resolve().parents[2]
PUBLISH = ROOT / "deploy/publish-assets.sh"
MANAGER = ROOT / "deploy/asset-store.py"
spec = importlib.util.spec_from_file_location("asset_store", MANAGER)
asset_store = importlib.util.module_from_spec(spec)
spec.loader.exec_module(asset_store)


class AssetFixtures(unittest.TestCase):
    def setUp(self):
        self.temporary = tempfile.TemporaryDirectory()
        self.addCleanup(self.temporary.cleanup)
        self.directory = Path(self.temporary.name)
        self.store = self.directory / "shared"

    def release(self, name, assets):
        source = self.directory / name
        for filename, contents in assets.items():
            path = source / filename
            path.parent.mkdir(parents=True, exist_ok=True)
            path.write_text(contents)
        return source

    def publish(self, source):
        return subprocess.run(
            ["sh", str(PUBLISH)],
            env=self.environment(source),
            capture_output=True,
            text=True,
        )

    def environment(self, source):
        return {
            **os.environ,
            "AAC_ASSET_SOURCE": str(source),
            "AAC_ASSET_STORE": str(self.store),
            "AAC_ASSET_MANAGER": str(MANAGER),
            "AAC_ASSET_RELEASE": source.name,
        }


class PublicationTests(AssetFixtures):
    def test_new_release_and_rollback_preserve_both_asset_sets(self):
        old = self.release("old", {"entry-old.js": "old", "lazy/route-old.js": "old route"})
        new = self.release("new", {"entry-new.js": "new", "lazy/route-new.js": "new route"})
        for source in [old, new, old]:
            result = self.publish(source)
            self.assertEqual(result.returncode, 0, result.stderr)
        for filename, contents in {
            "entry-old.js": "old",
            "lazy/route-old.js": "old route",
            "entry-new.js": "new",
            "lazy/route-new.js": "new route",
        }.items():
            self.assertEqual((self.store / filename).read_text(), contents)
        self.assertFalse(list(self.store.glob(".publish-*")))

    def test_immutable_url_cannot_change_contents(self):
        original = self.release("original", {"same-hash.js": "original"})
        collision = self.release("collision", {"same-hash.js": "different"})
        self.assertEqual(self.publish(original).returncode, 0)
        result = self.publish(collision)
        self.assertNotEqual(result.returncode, 0)
        self.assertIn("different contents", result.stderr)
        self.assertEqual((self.store / "same-hash.js").read_text(), "original")

    def test_parallel_publication_keeps_complete_files(self):
        contents = "x" * 2_000_000
        sources = [
            self.release(str(i), {"common-hash.js": contents, f"entry-{i}.js": str(i)}) for i in range(8)
        ]
        processes = [
            subprocess.Popen(
                ["sh", str(PUBLISH)],
                env=self.environment(source),
                stdout=subprocess.PIPE,
                stderr=subprocess.PIPE,
            )
            for source in sources
        ]
        for process in processes:
            _, stderr = process.communicate(timeout=20)
            self.assertEqual(process.returncode, 0, stderr)
        self.assertEqual((self.store / "common-hash.js").read_text(), contents)
        for i in range(8):
            self.assertEqual((self.store / f"entry-{i}.js").read_text(), str(i))
        self.assertFalse(list(self.store.glob(".publish-*")))

    def test_missing_build_fails_publication(self):
        self.assertNotEqual(self.publish(self.directory / "missing").returncode, 0)


class RetentionTests(AssetFixtures):
    def test_expiry_boundary_and_shared_chunks(self):
        old = self.release("old", {"old.js": "old", "shared.js": "shared"})
        new = self.release("new", {"new.js": "new", "shared.js": "shared"})
        asset_store.publish(old, self.store, "old", now=0)
        asset_store.publish(new, self.store, "new", now=1000)
        expiry = asset_store.RETENTION_SECONDS + asset_store.HEARTBEAT_GRACE
        result = asset_store.maintain(self.store, now=expiry - 1, force=True)
        self.assertEqual(result["expired_releases"], [])
        self.assertTrue((self.store / "old.js").exists())
        result = asset_store.maintain(self.store, now=expiry, force=True)
        self.assertEqual(result, {"expired_releases": ["old"], "deleted_assets": 1})
        self.assertFalse((self.store / "old.js").exists())
        self.assertEqual((self.store / "new.js").read_text(), "new")
        self.assertEqual((self.store / "shared.js").read_text(), "shared")

    def test_current_release_survives_sixty_days(self):
        current = self.release("current", {"current.js": "current"})
        asset_store.publish(current, self.store, "current", now=0)
        result = asset_store.maintain(self.store, active_release="current", now=60 * 86400, force=True)
        self.assertEqual(result["expired_releases"], [])
        self.assertEqual((self.store / "current.js").read_text(), "current")

    def test_old_running_release_and_candidate_are_both_protected(self):
        old = self.release("old", {"old.js": "old"})
        new = self.release("new", {"new.js": "new"})
        asset_store.publish(old, self.store, "old", now=0)
        now = 60 * 86400
        asset_store.maintain(self.store, active_release="old", now=now, force=True)
        asset_store.publish(new, self.store, "new", now=now)
        asset_store.maintain(self.store, active_release="new", now=now + 60, force=True)
        self.assertTrue((self.store / "old.js").exists())
        self.assertTrue((self.store / "new.js").exists())

    def test_rollback_republishes_expired_release(self):
        old = self.release("old", {"old.js": "old"})
        new = self.release("new", {"new.js": "new"})
        asset_store.publish(old, self.store, "old", now=0)
        asset_store.publish(new, self.store, "new", now=1000)
        now = asset_store.RETENTION_SECONDS + asset_store.HEARTBEAT_GRACE
        asset_store.maintain(self.store, active_release="new", now=now, force=True)
        self.assertFalse((self.store / "old.js").exists())
        asset_store.publish(old, self.store, "old", now=now + 1)
        self.assertEqual((self.store / "old.js").read_text(), "old")
        self.assertEqual((self.store / "new.js").read_text(), "new")

    def test_legacy_assets_get_migration_grace_then_expire(self):
        self.store.mkdir()
        (self.store / "legacy.js").write_text("legacy")
        os.utime(self.store / "legacy.js", (0, 0))
        current = self.release("current", {"current.js": "current"})
        asset_store.publish(current, self.store, "current", now=60 * 86400)
        self.assertTrue((self.store / "legacy.js").exists())
        result = asset_store.maintain(self.store, active_release="current", now=61 * 86400, force=True)
        self.assertEqual(result["expired_releases"], [])
        now = 67 * 86400 + asset_store.HEARTBEAT_GRACE
        result = asset_store.maintain(self.store, active_release="current", now=now, force=True)
        self.assertEqual(result["expired_releases"], ["legacy-assets"])
        self.assertFalse((self.store / "legacy.js").exists())
        self.assertTrue((self.store / "current.js").exists())

    def test_cleanup_runs_without_another_deployment(self):
        old = self.release("old", {"old.js": "old"})
        new = self.release("new", {"new.js": "new"})
        asset_store.publish(old, self.store, "old", now=0)
        asset_store.publish(new, self.store, "new", now=0)
        now = asset_store.RETENTION_SECONDS + asset_store.HEARTBEAT_GRACE - 60
        asset_store.maintain(self.store, active_release="new", now=now, force=True)
        result = asset_store.maintain(self.store, active_release="new", now=now + 60)
        self.assertEqual(result["expired_releases"], [])
        result = asset_store.maintain(self.store, active_release="new", now=now + 3600)
        self.assertEqual(result["expired_releases"], ["old"])
        self.assertTrue((self.store / "new.js").exists())

    def test_concurrent_cleanup_and_publication_preserve_reused_chunk(self):
        old = self.release("old", {"shared.js": "shared", "old.js": "old"})
        new = self.release("new", {"shared.js": "shared", "new.js": "new"})
        asset_store.publish(old, self.store, "old", now=0)
        now = 8 * 86400
        context = multiprocessing.get_context("fork")
        processes = [
            context.Process(target=asset_store.publish, args=(new, self.store, "new"), kwargs={"now": now}),
            context.Process(
                target=asset_store.maintain, args=(self.store,), kwargs={"now": now, "force": True}
            ),
        ]
        for process in processes:
            process.start()
        for process in processes:
            process.join(10)
            self.assertEqual(process.exitcode, 0)
        self.assertEqual((self.store / "shared.js").read_text(), "shared")
        self.assertEqual((self.store / "new.js").read_text(), "new")


@unittest.skipUnless(
    os.environ.get("AAC_ASSET_TEST_IMAGE"), "set AAC_ASSET_TEST_IMAGE to test real containers"
)
class RollingContainerTests(unittest.TestCase):
    def test_old_and_new_instances_serve_both_releases(self):
        engine = os.environ.get("AAC_CONTAINER_ENGINE", "docker")
        image = os.environ["AAC_ASSET_TEST_IMAGE"]

        def run(*args):
            return subprocess.check_output([engine, *args], text=True, stderr=subprocess.STDOUT).strip()

        volume = "aac-assets-test-" + uuid.uuid4().hex
        run("volume", "create", volume)
        self.addCleanup(run, "volume", "rm", volume)
        temporary = tempfile.TemporaryDirectory()
        self.addCleanup(temporary.cleanup)
        bases = {}
        containers = {}
        for release in ["old", "new"]:
            html = Path(temporary.name) / release
            (html / "assets").mkdir(parents=True)
            (html / "index.html").write_text(
                f'<script type="module" src="/assets/entry-{release}.js"></script>'
            )
            (html / "version.json").write_text(f'{{"release_sha":"{release}"}}')
            (html / "assets" / f"entry-{release}.js").write_text(f'import("./route-{release}.js")')
            (html / "assets" / f"route-{release}.js").write_text(f'export default "{release}"')
            # TemporaryDirectory is private by default; the image uses UID 101.
            Path(temporary.name).chmod(0o755)
            container = run(
                "run",
                "-d",
                "-p",
                "127.0.0.1::8080",
                "-v",
                f"{html}:/usr/share/nginx/html:ro,Z",
                "-v",
                f"{volume}:/var/lib/aac/assets",
                image,
            )
            self.addCleanup(run, "rm", "-f", container)
            containers[release] = container
            base = "http://" + run("port", container, "8080/tcp")
            bases[release] = base
            for _ in range(100):
                try:
                    with urlopen(base + "/health", timeout=1) as response:
                        self.assertEqual(response.status, 200)
                    break
                except (URLError, TimeoutError, ConnectionError):
                    time.sleep(0.1)
            else:
                self.fail("Nginx did not start:\n" + run("logs", container))
            if release == "old":
                with self.assertRaises(HTTPError) as error:
                    urlopen(base + "/assets/entry-new.js")
                self.assertEqual(error.exception.code, 404)
                error.exception.close()

        for release, base in bases.items():
            with urlopen(base + "/") as response:
                self.assertIn(f"entry-{release}.js", response.read().decode())
                self.assertEqual(response.headers["Cache-Control"], "no-cache")
            with urlopen(base + "/version.json") as response:
                self.assertIn(release, response.read().decode())
                self.assertEqual(response.headers["Cache-Control"], "no-store")
            for asset_release in ["old", "new"]:
                for filename, contents in {
                    f"entry-{asset_release}.js": f'import("./route-{asset_release}.js")',
                    f"route-{asset_release}.js": f'export default "{asset_release}"',
                }.items():
                    with urlopen(base + "/assets/" + filename) as response:
                        self.assertEqual(response.read().decode(), contents)
                        self.assertEqual(
                            response.headers["Cache-Control"], "public, max-age=31536000, immutable"
                        )
                        self.assertIn("javascript", response.headers["Content-Type"])
            with self.assertRaises(HTTPError) as error:
                urlopen(base + "/assets/missing.js")
            self.assertEqual(error.exception.code, 404)
            self.assertNotIn("immutable", error.exception.headers.get("Cache-Control", ""))
            error.exception.close()

        run("stop", containers["old"])
        with urlopen(bases["new"] + "/assets/route-old.js") as response:
            self.assertEqual(response.read().decode(), 'export default "old"')

        # Age only the stopped fixture release, then run the production cleanup.
        run(
            "exec",
            containers["new"],
            "python3",
            "-c",
            "import runpy,time; from pathlib import Path; "
            "manager=runpy.run_path('/opt/aac/asset-store.py'); "
            "store=Path('/var/lib/aac/assets'); "
            "\nwith manager['locked_state'](store,time.time()) as state:\n"
            " state['releases']['old']['last_active_at']=time.time()-8*86400\n",
        )
        run("exec", containers["new"], "python3", "/opt/aac/asset-store.py", "maintain")
        with self.assertRaises(HTTPError) as error:
            urlopen(bases["new"] + "/assets/route-old.js")
        self.assertEqual(error.exception.code, 404)
        error.exception.close()
        with urlopen(bases["new"] + "/assets/route-new.js") as response:
            self.assertEqual(response.read().decode(), 'export default "new"')
        with self.assertRaises(HTTPError) as error:
            urlopen(bases["new"] + "/assets/.retention/releases.json")
        self.assertEqual(error.exception.code, 404)
        error.exception.close()

        # Coolify's HTTP health check must notice a failed retention worker.
        heartbeat = json.loads(run("exec", containers["new"], "cat", "/tmp/aac-asset-retention.json"))
        run("exec", containers["new"], "kill", "-KILL", str(heartbeat["pid"]))
        for _ in range(50):
            try:
                with urlopen(bases["new"] + "/health", timeout=1):
                    pass
            except HTTPError as error:
                self.assertEqual(error.code, 503)
                error.close()
                break
            time.sleep(0.1)
        else:
            self.fail("HTTP health stayed ready after the retention worker died")


if __name__ == "__main__":
    unittest.main()
