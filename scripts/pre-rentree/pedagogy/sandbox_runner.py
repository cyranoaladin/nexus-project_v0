"""Fail-closed bubblewrap runner for untrusted historical Python tools."""

from __future__ import annotations

import os
import resource
import signal
import stat
import subprocess
import tempfile
import time
from pathlib import Path
from typing import Any, BinaryIO


BWRAP_PATH = Path("/usr/bin/bwrap")
MAX_TIMEOUT_SECONDS = 60
STDIO_READ_LIMIT = 64 * 1024
RESOURCE_LIMITS = {
    "cpu_seconds": 20,
    "address_space_bytes": 512 * 1024 * 1024,
    "file_size_bytes": 1024 * 1024,
    # RLIMIT_NPROC is per real UID. This host can already have thousands of
    # threads, so the finite ceiling must remain above the ambient count.
    "process_count": 4096,
}
AGGREGATE_LIMITS = {
    "workspace_bytes": 64 * 1024 * 1024,
    "workspace_entries": 5000,
    "process_count": 32,
    "rss_bytes": 1024 * 1024 * 1024,
    "cpu_seconds": 30,
}
MONITOR_INTERVAL_SECONDS = 0.05


def _sandbox_preexec() -> None:
    os.setsid()
    resource.setrlimit(
        resource.RLIMIT_CPU,
        (RESOURCE_LIMITS["cpu_seconds"], RESOURCE_LIMITS["cpu_seconds"]),
    )
    resource.setrlimit(
        resource.RLIMIT_AS,
        (
            RESOURCE_LIMITS["address_space_bytes"],
            RESOURCE_LIMITS["address_space_bytes"],
        ),
    )
    resource.setrlimit(
        resource.RLIMIT_FSIZE,
        (
            RESOURCE_LIMITS["file_size_bytes"],
            RESOURCE_LIMITS["file_size_bytes"],
        ),
    )
    resource.setrlimit(
        resource.RLIMIT_NPROC,
        (RESOURCE_LIMITS["process_count"], RESOURCE_LIMITS["process_count"]),
    )


def _read_bounded(handle: BinaryIO) -> tuple[str, int, bool]:
    handle.flush()
    size = handle.seek(0, os.SEEK_END)
    handle.seek(0)
    content = handle.read(STDIO_READ_LIMIT)
    return (
        content.decode("utf-8", errors="replace"),
        size,
        size > STDIO_READ_LIMIT,
    )


def _workspace_usage(root: Path) -> dict[str, int]:
    total_bytes = 0
    total_entries = 1
    pending = [root]
    while pending:
        directory = pending.pop()
        try:
            with os.scandir(directory) as entries:
                children = list(entries)
        except FileNotFoundError:
            continue
        for entry in children:
            try:
                metadata = entry.stat(follow_symlinks=False)
            except FileNotFoundError:
                continue
            if stat.S_ISDIR(metadata.st_mode):
                total_entries += 1
                pending.append(Path(entry.path))
            elif stat.S_ISREG(metadata.st_mode):
                total_entries += 1
                total_bytes += metadata.st_size
            elif stat.S_ISLNK(metadata.st_mode):
                total_entries += 1
    return {
        "workspace_bytes": total_bytes,
        "workspace_entries": total_entries,
    }


def _parse_proc_stat(raw: str) -> tuple[int, int, int, int] | None:
    fields = raw[raw.rfind(")") + 2 :].split()
    if len(fields) < 22:
        return None
    return (
        int(fields[1]),
        int(fields[2]),
        sum(int(fields[index]) for index in (11, 12, 13, 14)),
        int(fields[21]),
    )


def _proc_record(pid: int) -> tuple[int, int, int, int] | None:
    try:
        raw = Path(f"/proc/{pid}/stat").read_text(encoding="ascii")
        return _parse_proc_stat(raw)
    except (OSError, ValueError):
        return None


def _aggregate_process_usage(root_pid: int) -> dict[str, int | float]:
    records: dict[int, tuple[int, int, int, int]] = {}
    try:
        proc_entries = list(Path("/proc").iterdir())
    except OSError:
        proc_entries = []
    for entry in proc_entries:
        if not entry.name.isdigit():
            continue
        record = _proc_record(int(entry.name))
        if record is not None:
            records[int(entry.name)] = record

    try:
        root_pgrp = os.getpgid(root_pid)
    except ProcessLookupError:
        root_pgrp = root_pid
    included = {
        pid
        for pid, (_, process_group, _, _) in records.items()
        if pid == root_pid or process_group == root_pgrp
    }
    changed = True
    while changed:
        changed = False
        for pid, (parent_pid, _, _, _) in records.items():
            if parent_pid in included and pid not in included:
                included.add(pid)
                changed = True

    clock_ticks = os.sysconf("SC_CLK_TCK")
    page_size = os.sysconf("SC_PAGE_SIZE")
    return {
        "process_count": len(included),
        "rss_bytes": sum(max(0, records[pid][3]) * page_size for pid in included),
        "cpu_seconds": sum(records[pid][2] for pid in included) / clock_ticks,
    }


def _aggregate_usage(root_pid: int, workspace: Path) -> dict[str, int | float]:
    return {
        **_workspace_usage(workspace),
        **_aggregate_process_usage(root_pid),
    }


def _resource_violation(
    usage: dict[str, int | float],
    limits: dict[str, int | float],
) -> str | None:
    for metric in (
        "workspace_bytes",
        "workspace_entries",
        "process_count",
        "rss_bytes",
        "cpu_seconds",
    ):
        if usage[metric] > limits[metric]:
            return metric
    return None


def _kill_process_group(process: subprocess.Popen[bytes]) -> None:
    try:
        os.killpg(process.pid, signal.SIGKILL)
    except ProcessLookupError:
        pass


def run_copied_python_tool(
    script: Path,
    *,
    workspace: Path,
    forbidden_root: Path,
    timeout_seconds: int = MAX_TIMEOUT_SECONDS,
) -> dict[str, Any]:
    """Run a copied tool with no network, cleared env and one writable mount."""

    workspace_root = workspace.resolve(strict=True)
    resolved_script = script.resolve(strict=True)
    forbidden = forbidden_root.resolve(strict=True)
    if (
        resolved_script.is_relative_to(forbidden)
        or workspace_root.is_relative_to(forbidden)
    ):
        raise ValueError(
            "refusing to execute an imported generator or validator in place"
        )
    if not resolved_script.is_relative_to(workspace_root):
        raise ValueError(
            "sandboxed script must be contained by its temporary workspace"
        )
    timeout = min(max(1, int(timeout_seconds)), MAX_TIMEOUT_SECONDS)
    base_result = {
        "sandbox_backend": "bubblewrap",
        "resource_limits": dict(RESOURCE_LIMITS),
        "aggregate_limits": dict(AGGREGATE_LIMITS),
        "timeout_seconds": timeout,
    }
    if not BWRAP_PATH.is_file():
        return {
            **base_result,
            "status": "FAIL_CLOSED_SANDBOX_UNAVAILABLE",
            "sandbox_status": "FAIL_CLOSED",
            "returncode": None,
            "exception_type": "BubblewrapUnavailable",
            "stdout_bytes": 0,
            "stderr_bytes": 0,
            "stdout_truncated": False,
            "stderr_truncated": False,
            "peak_workspace_entries": 0,
        }

    script_in_sandbox = (
        Path("/workspace") / resolved_script.relative_to(workspace_root)
    )
    command = [
        str(BWRAP_PATH),
        "--unshare-all",
        "--die-with-parent",
        "--new-session",
        "--cap-drop",
        "ALL",
        "--clearenv",
        "--setenv",
        "PATH",
        "/usr/bin",
        "--setenv",
        "PYTHONDONTWRITEBYTECODE",
        "1",
        "--ro-bind",
        "/usr",
        "/usr",
        "--ro-bind",
        "/lib",
        "/lib",
        "--ro-bind",
        "/lib64",
        "/lib64",
        "--proc",
        "/proc",
        "--dev",
        "/dev",
        "--bind",
        str(workspace_root),
        "/workspace",
        "--remount-ro",
        "/",
        "--chdir",
        "/workspace",
        "/usr/bin/python3",
        script_in_sandbox.as_posix(),
    ]
    process: subprocess.Popen[bytes] | None = None
    timed_out = False
    resource_violation: str | None = None
    peak_usage: dict[str, int | float] = {
        metric: 0 for metric in AGGREGATE_LIMITS
    }
    with tempfile.TemporaryFile(mode="w+b") as stdout_handle, tempfile.TemporaryFile(
        mode="w+b"
    ) as stderr_handle:
        try:
            process = subprocess.Popen(
                command,
                cwd=workspace_root,
                stdin=subprocess.DEVNULL,
                stdout=stdout_handle,
                stderr=stderr_handle,
                env={"PATH": "/usr/bin"},
                preexec_fn=_sandbox_preexec,
            )
            deadline = time.monotonic() + timeout
            while process.poll() is None:
                usage = _aggregate_usage(process.pid, workspace_root)
                peak_usage = {
                    metric: max(peak_usage[metric], usage[metric])
                    for metric in peak_usage
                }
                resource_violation = _resource_violation(
                    usage,
                    AGGREGATE_LIMITS,
                )
                if resource_violation is not None:
                    _kill_process_group(process)
                    process.wait()
                    break
                if time.monotonic() >= deadline:
                    timed_out = True
                    _kill_process_group(process)
                    process.wait()
                    break
                time.sleep(MONITOR_INTERVAL_SECONDS)
        finally:
            if process is not None:
                _kill_process_group(process)
                if process.poll() is None:
                    process.wait()

        _, stdout_size, stdout_truncated = _read_bounded(stdout_handle)
        stderr_text, stderr_size, stderr_truncated = _read_bounded(stderr_handle)
        sandbox_error = (
            process is not None
            and process.returncode != 0
            and stderr_text.lstrip().startswith("bwrap:")
        )
        exception_type = None
        if timed_out:
            exception_type = "TimeoutExpired"
        elif resource_violation is not None:
            exception_type = "AggregateResourceLimitExceeded"
        elif "FileNotFoundError" in stderr_text:
            exception_type = "FileNotFoundError"
        elif sandbox_error:
            exception_type = "BubblewrapError"
        if sandbox_error:
            status = "FAIL_CLOSED_SANDBOX_ERROR"
            sandbox_status = "FAIL_CLOSED"
        elif resource_violation is not None:
            status = "FAIL_RESOURCE_LIMIT"
            sandbox_status = "PASS"
        elif timed_out:
            status = "FAIL_TIMEOUT"
            sandbox_status = "PASS"
        else:
            status = "PASS" if process.returncode == 0 else "FAIL"
            sandbox_status = "PASS"
        return {
            **base_result,
            "status": status,
            "sandbox_status": sandbox_status,
            "returncode": process.returncode,
            "exception_type": exception_type,
            "resource_violation": resource_violation,
            "peak_aggregate_usage": peak_usage,
            "peak_workspace_entries": peak_usage["workspace_entries"],
            "stdout_bytes": stdout_size,
            "stderr_bytes": stderr_size,
            "stdout_truncated": stdout_truncated,
            "stderr_truncated": stderr_truncated,
        }
