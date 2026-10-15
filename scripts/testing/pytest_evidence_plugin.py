"""Native phase evidence; never include assertion payloads or exception text."""
import json
import os
import hashlib
import stat
import uuid
from pathlib import Path

_phases = []
_launch = None
_launch_bytes = None


def _json_bytes(value):
    return (json.dumps(value, sort_keys=True) + "\n").encode("utf-8")


def _write_bytes(destination, value):
    path = Path(destination)
    path.parent.mkdir(parents=True, exist_ok=True, mode=0o700)
    descriptor = os.open(path, os.O_WRONLY | os.O_CREAT | os.O_EXCL | os.O_NOFOLLOW, 0o600)
    with os.fdopen(descriptor, "wb") as stream:
        stream.write(value)
        stream.flush()
        os.fsync(stream.fileno())


def _write(destination, value):
    _write_bytes(destination, _json_bytes(value))


def _read_bytes(path):
    descriptor = os.open(path, os.O_RDONLY | os.O_NOFOLLOW | os.O_NONBLOCK)
    try:
        before = os.fstat(descriptor)
        if not stat.S_ISREG(before.st_mode) or before.st_nlink != 1 or before.st_size > 128 * 1024 * 1024:
            raise RuntimeError("INVALID_NATIVE_PROVENANCE")
        with os.fdopen(descriptor, "rb", closefd=False) as stream:
            value = stream.read()
        after = os.fstat(descriptor)
        fields = ("st_ino", "st_dev", "st_size", "st_nlink", "st_mtime_ns", "st_ctime_ns")
        if any(getattr(before, field) != getattr(after, field) for field in fields) or len(value) != after.st_size:
            raise RuntimeError("INVALID_NATIVE_PROVENANCE")
        return value
    finally:
        os.close(descriptor)


def _sha(value):
    return hashlib.sha256(value).hexdigest()


def pytest_sessionstart(session):
    global _launch, _launch_bytes
    _phases.clear()
    destination = os.environ.get("NEXUS_TEST_EXECUTION_OUTPUT")
    if not destination:
        return  # Collection does not constitute execution evidence.
    contexts = json.loads(os.environ.get("NEXUS_TEST_LAUNCH_CONTEXTS", "null"))
    if not isinstance(contexts, list):
        raise RuntimeError("INVALID_NATIVE_PROVENANCE")
    matches = [context for context in contexts if context.get("laneId") == os.environ.get("NEXUS_TEST_LANE_ID")]
    if len(matches) != 1 or matches[0].get("runner") != "python":
        raise RuntimeError("INVALID_NATIVE_PROVENANCE")
    context = matches[0]
    runtime_options = {"nodeOptions": os.environ.get("NODE_OPTIONS", ""),
                       "pytestAddopts": os.environ.get("PYTEST_ADDOPTS", ""),
                       "pytestPlugins": os.environ.get("PYTEST_PLUGINS", ""),
                       "pytestDisablePluginAutoload": os.environ.get("PYTEST_DISABLE_PLUGIN_AUTOLOAD", "")}
    if runtime_options != context.get("runtimeOptions"):
        raise RuntimeError("INVALID_NATIVE_PROVENANCE")
    root = Path(__file__).resolve().parents[2]
    if str(root) != context.get("producerRepositoryRoot"):
        raise RuntimeError("INVALID_NATIVE_PROVENANCE")
    own = root / "scripts/testing/pytest_evidence_plugin.py"
    if Path(__file__).absolute() != own or own.is_symlink():
        raise RuntimeError("INVALID_NATIVE_PROVENANCE")
    sources = [{"path": "scripts/testing/pytest_evidence_plugin.py", "sha256": _sha(_read_bytes(own))}]
    if sources != context.get("producerSources"):
        raise RuntimeError("INVALID_NATIVE_PROVENANCE")
    command = [part for part in Path("/proc/self/cmdline").read_bytes().decode("utf-8").split("\0") if part]
    args = command[1:]
    plugin = ["-p", "scripts.testing.pytest_evidence_plugin"]
    positions = [index for index in range(len(args) - 1) if args[index:index + 2] == plugin]
    if len(positions) != 1:
        raise RuntimeError("INVALID_NATIVE_PROVENANCE")
    index = positions[0]
    if args[:index] + args[index + 2:] != context.get("argv"):
        raise RuntimeError("INVALID_NATIVE_PROVENANCE")
    output = Path(destination)
    if not output.is_absolute() or destination != os.environ.get("NEXUS_TEST_NATIVE_OUTPUT"):
        raise RuntimeError("INVALID_NATIVE_PROVENANCE")
    for file in [output, Path(destination + ".launch.json"), Path(destination + ".provenance.json")]:
        if file.exists() or file.is_symlink():
            raise RuntimeError("INVALID_NATIVE_PROVENANCE")
    _launch = {"schemaVersion": "nexus-test-producer-launch/v1", "context": context,
               "producerNonce": str(uuid.uuid4()), "producerSources": sources,
               "invocation": {"commandLine": command, "repositoryRoot": str(root),
                              "runtimeOptions": runtime_options, "canonicalEntrypoint": None}}
    _launch_bytes = _json_bytes(_launch)
    _write_bytes(destination + ".launch.json", _launch_bytes)


def _item(item):
    file, _, title = item.nodeid.partition("::")
    return {"path": file, "title": title, "project": None, "nodeid": item.nodeid,
            "forbiddenMarks": sorted({mark.name for mark in item.iter_markers()
                                      if mark.name in {"skip", "skipif", "xfail"}})}


def pytest_collection_finish(session):
    destination = os.environ.get("NEXUS_TEST_COLLECTION_OUTPUT")
    if destination:
        _write(destination, {"collected": [_item(item) for item in session.items]})


def pytest_runtest_logreport(report):
    _phases.append({"nodeid": report.nodeid, "when": report.when,
                    "status": "passed" if report.passed else "failed" if report.failed else "skipped"})


def pytest_sessionfinish(session, exitstatus):
    destination = os.environ.get("NEXUS_TEST_EXECUTION_OUTPUT")
    if destination:
        tests = []
        for item in session.items:
            phases = [phase for phase in _phases if phase["nodeid"] == item.nodeid]
            status = "failed" if any(phase["status"] == "failed" for phase in phases) else \
                     "skipped" if any(phase["status"] == "skipped" for phase in phases) else \
                     "passed" if len(phases) == 3 else "pending"
            tests.append({**_item(item), "status": status,
                          "attempts": sum(phase["when"] == "call" for phase in phases)})
        native_bytes = _json_bytes({"schemaVersion": "pytest-native/v2", "exitCode": int(exitstatus),
                                    "tests": tests, "phases": _phases})
        if _launch is None or _read_bytes(destination + ".launch.json") != _launch_bytes \
                or _sha(_read_bytes(Path(__file__))) != _launch["producerSources"][0]["sha256"]:
            raise RuntimeError("INVALID_NATIVE_PROVENANCE")
        _write_bytes(destination, native_bytes)
        _write(destination + ".provenance.json", {"schemaVersion": "nexus-test-native-provenance/v1",
                "producerNonce": _launch["producerNonce"], "launchSha256": _sha(_launch_bytes),
                "nativeSha256": _sha(native_bytes), "nativeByteLength": len(native_bytes)})
