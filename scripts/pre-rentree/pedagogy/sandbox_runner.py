"""Fail-closed bubblewrap runner for untrusted historical Python tools."""

from __future__ import annotations

import os
import resource
import signal
import subprocess
import tempfile
from pathlib import Path
from typing import Any


BWRAP_PATH = Path("/usr/bin/bwrap")
MAX_TIMEOUT_SECONDS = 60
STDIO_READ_LIMIT = 64 * 1024
RESOURCE_LIMITS = {
    "cpu_seconds": 30,
    "address_space_bytes": 1024 * 1024 * 1024,
    "file_size_bytes": 1024 * 1024,
    # RLIMIT_NPROC is per real UID. This host can already have thousands of
    # threads, so the finite ceiling must remain above the ambient count.
    "process_count": 4096,
}


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


def _read_bounded(path: Path) -> tuple[str, int, bool]:
    size = path.stat().st_size
    with path.open("rb") as handle:
        content = handle.read(STDIO_READ_LIMIT)
    return (
        content.decode("utf-8", errors="replace"),
        size,
        size > STDIO_READ_LIMIT,
    )


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
    stdout_descriptor, stdout_name = tempfile.mkstemp(
        dir=workspace_root,
        prefix=".sandbox-stdout-",
        suffix=".log",
    )
    stderr_descriptor, stderr_name = tempfile.mkstemp(
        dir=workspace_root,
        prefix=".sandbox-stderr-",
        suffix=".log",
    )
    stdout_path = Path(stdout_name)
    stderr_path = Path(stderr_name)
    process: subprocess.Popen[bytes] | None = None
    timed_out = False
    try:
        with os.fdopen(stdout_descriptor, "wb") as stdout_handle, os.fdopen(
            stderr_descriptor, "wb"
        ) as stderr_handle:
            stdout_descriptor = -1
            stderr_descriptor = -1
            process = subprocess.Popen(
                command,
                cwd=workspace_root,
                stdin=subprocess.DEVNULL,
                stdout=stdout_handle,
                stderr=stderr_handle,
                env={"PATH": "/usr/bin"},
                preexec_fn=_sandbox_preexec,
            )
            try:
                process.wait(timeout=timeout)
            except subprocess.TimeoutExpired:
                timed_out = True
                try:
                    os.killpg(process.pid, signal.SIGKILL)
                except ProcessLookupError:
                    pass
                process.wait()
            finally:
                try:
                    os.killpg(process.pid, signal.SIGKILL)
                except ProcessLookupError:
                    pass
        _, stdout_size, stdout_truncated = _read_bounded(stdout_path)
        stderr_text, stderr_size, stderr_truncated = _read_bounded(stderr_path)
        sandbox_error = (
            process.returncode != 0
            and stderr_text.lstrip().startswith("bwrap:")
        )
        exception_type = None
        if timed_out:
            exception_type = "TimeoutExpired"
        elif "FileNotFoundError" in stderr_text:
            exception_type = "FileNotFoundError"
        elif sandbox_error:
            exception_type = "BubblewrapError"
        if sandbox_error:
            status = "FAIL_CLOSED_SANDBOX_ERROR"
            sandbox_status = "FAIL_CLOSED"
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
            "stdout_bytes": stdout_size,
            "stderr_bytes": stderr_size,
            "stdout_truncated": stdout_truncated,
            "stderr_truncated": stderr_truncated,
        }
    finally:
        if stdout_descriptor >= 0:
            os.close(stdout_descriptor)
        if stderr_descriptor >= 0:
            os.close(stderr_descriptor)
        stdout_path.unlink(missing_ok=True)
        stderr_path.unlink(missing_ok=True)
