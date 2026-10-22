"""Publish immutable assets and expire inactive releases under a shared lock."""

import argparse
from contextlib import contextmanager
import fcntl
import hashlib
import json
import os
from pathlib import Path
import shutil
import tempfile
import time


RETENTION_SECONDS = 7 * 24 * 60 * 60
HEARTBEAT_SECONDS = 60
HEARTBEAT_GRACE = 5 * 60
PRUNE_SECONDS = 60 * 60
HEARTBEAT_FILE = Path("/tmp/aac-asset-retention.json")
READY_FILE = Path("/tmp/aac-assets-ready")


def asset_files(directory):
    return sorted(
        path.relative_to(directory).as_posix()
        for path in directory.rglob("*")
        if path.is_file() and not any(part.startswith(".") for part in path.relative_to(directory).parts)
    )


def asset_path(store, relative):
    path = Path(relative)
    if path.is_absolute() or not path.parts or any(part.startswith(".") for part in path.parts):
        raise ValueError(f"Invalid asset path: {relative}")
    return store / path


def write_json(path, value):
    descriptor, temporary = tempfile.mkstemp(prefix=".write-", dir=path.parent)
    temporary = Path(temporary)
    try:
        with os.fdopen(descriptor, "w") as output:
            json.dump(value, output, separators=(",", ":"))
            output.flush()
            os.fsync(output.fileno())
        temporary.replace(path)
    finally:
        temporary.unlink(missing_ok=True)


@contextmanager
def locked_state(store, now):
    metadata = store / ".retention"
    metadata.mkdir(parents=True, exist_ok=True)
    with (metadata / "lock").open("a") as lock:
        fcntl.flock(lock, fcntl.LOCK_EX)
        state_path = metadata / "releases.json"
        if state_path.exists():
            state = json.loads(state_path.read_text())
            if state.get("version") != 1:
                raise ValueError("Unsupported asset retention metadata")
        else:
            # Give assets retained before manifests existed a full migration
            # grace period, instead of deleting them when the policy is enabled.
            state = {"version": 1, "last_pruned_at": 0, "releases": {}}
            existing = asset_files(store)
            if existing:
                state["releases"]["legacy-assets"] = {"assets": existing, "last_active_at": now}
        yield state
        write_json(state_path, state)


def identical(first, second):
    def digest(path):
        with path.open("rb") as source:
            return hashlib.file_digest(source, "sha256").digest()

    return digest(first) == digest(second)


def publish(source, store, release, now=None):
    now = time.time() if now is None else now
    if not source.is_dir():
        raise ValueError(f"Missing build assets: {source}")
    assets = asset_files(source)
    if not assets:
        raise ValueError("Build contains no assets")
    with locked_state(store, now) as state:
        previous = state["releases"].get(release)
        if previous and previous["assets"] != assets:
            raise ValueError(f"Asset set changed for release: {release}")
        for relative in assets:
            original = asset_path(source, relative)
            destination = asset_path(store, relative)
            destination.parent.mkdir(parents=True, exist_ok=True)
            if destination.exists():
                if not identical(original, destination):
                    raise ValueError(f"Asset URL already exists with different contents: {relative}")
                continue
            descriptor, temporary = tempfile.mkstemp(prefix=".publish-", dir=store / ".retention")
            os.close(descriptor)
            temporary = Path(temporary)
            try:
                shutil.copyfile(original, temporary)
                temporary.chmod(0o644)
                os.link(temporary, destination)
            finally:
                temporary.unlink(missing_ok=True)
        state["releases"][release] = {"assets": assets, "last_active_at": now}
    return {"published_release": release, "assets": len(assets)}


def maintain(store, active_release=None, now=None, force=False):
    now = time.time() if now is None else now
    with locked_state(store, now) as state:
        if active_release is not None:
            # Each running instance renews its release, including an old
            # instance during overlap. Rollbacks republish their assets first.
            state["releases"][active_release]["last_active_at"] = now
        if not force and now - state["last_pruned_at"] < PRUNE_SECONDS:
            return {"expired_releases": [], "deleted_assets": 0}
        cutoff = now - RETENTION_SECONDS - HEARTBEAT_GRACE
        expired = {
            release: record
            for release, record in state["releases"].items()
            if record["last_active_at"] <= cutoff
        }
        for release in expired:
            del state["releases"][release]
        retained = {asset for record in state["releases"].values() for asset in record["assets"]}
        candidates = {asset for record in expired.values() for asset in record["assets"]}
        # Abandoned files from an interrupted publication get the same grace.
        candidates.update(
            relative
            for relative in asset_files(store)
            if asset_path(store, relative).stat().st_mtime <= cutoff
        )
        removed = 0
        for relative in candidates - retained:
            path = asset_path(store, relative)
            if path.exists():
                path.unlink()
                removed += 1
        state["last_pruned_at"] = now
        return {"expired_releases": sorted(expired), "deleted_assets": removed}


def watch(store, release):
    try:
        while True:
            result = maintain(store, active_release=release)
            write_json(HEARTBEAT_FILE, {"pid": os.getpid(), "updated_at": time.time()})
            READY_FILE.write_text("ok")
            if result["expired_releases"] or result["deleted_assets"]:
                print(json.dumps(result), flush=True)
            time.sleep(HEARTBEAT_SECONDS)
    finally:
        READY_FILE.unlink(missing_ok=True)


def health():
    if not READY_FILE.is_file():
        raise ValueError("Asset retention worker is not ready")
    heartbeat = json.loads(HEARTBEAT_FILE.read_text())
    os.kill(heartbeat["pid"], 0)
    if time.time() - heartbeat["updated_at"] > HEARTBEAT_GRACE:
        raise ValueError("Asset retention heartbeat is stale")


def main():
    parser = argparse.ArgumentParser()
    parser.add_argument("operation", choices=["publish", "maintain", "watch", "health"])
    args = parser.parse_args()
    if args.operation == "health":
        health()
        return
    source = Path(os.environ.get("AAC_ASSET_SOURCE", "/usr/share/nginx/html/assets"))
    store = Path(os.environ.get("AAC_ASSET_STORE", "/var/lib/aac/assets"))
    release = os.environ.get("AAC_ASSET_RELEASE")
    if release is None:
        release = json.loads((source.parent / "version.json").read_text())["release_sha"]
    if args.operation == "publish":
        print(json.dumps(publish(source, store, release)), flush=True)
    elif args.operation == "maintain":
        print(json.dumps(maintain(store, active_release=release, force=True)), flush=True)
    else:
        watch(store, release)


if __name__ == "__main__":
    main()
