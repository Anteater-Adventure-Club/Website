"""Check asset publication and, optionally, two actual rolling Nginx instances."""

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


class PublicationTests(unittest.TestCase):
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
            env={**os.environ, "AAC_ASSET_SOURCE": str(source), "AAC_ASSET_STORE": str(self.store)},
            capture_output=True,
            text=True,
        )

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
                env={**os.environ, "AAC_ASSET_SOURCE": str(source), "AAC_ASSET_STORE": str(self.store)},
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
                except (URLError, TimeoutError):
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


if __name__ == "__main__":
    unittest.main()
