"""Fail-closed checks for generated pedagogy output trees."""

from __future__ import annotations

import errno
import os
import stat
from pathlib import Path, PurePosixPath


def _relative_path(raw: str) -> PurePosixPath:
    path = PurePosixPath(raw)
    if (
        path.is_absolute()
        or not path.parts
        or "." in path.parts
        or ".." in path.parts
        or "\\" in raw
    ):
        raise ValueError(f"chemin de sortie attendu invalide : {raw}")
    return path


def _open_directory_at(
    parent_fd: int,
    name: str,
    display: Path,
    *,
    create: bool,
) -> int:
    flags = os.O_RDONLY | os.O_DIRECTORY | os.O_NOFOLLOW
    try:
        descriptor = os.open(name, flags, dir_fd=parent_fd)
    except FileNotFoundError:
        if not create:
            raise ValueError(f"répertoire de sortie manquant : {display}") from None
        try:
            os.mkdir(name, mode=0o755, dir_fd=parent_fd)
        except FileExistsError:
            pass
        try:
            descriptor = os.open(name, flags, dir_fd=parent_fd)
        except OSError as error:
            raise ValueError(
                f"composant de sortie symbolique ou non-régulier : {display}"
            ) from error
    except OSError as error:
        if error.errno in {errno.ELOOP, errno.ENOTDIR}:
            raise ValueError(
                f"composant de sortie symbolique ou non-régulier : {display}"
            ) from error
        raise
    if not stat.S_ISDIR(os.fstat(descriptor).st_mode):
        os.close(descriptor)
        raise ValueError(f"composant de sortie non-répertoire : {display}")
    return descriptor


def _open_directory_path(path: Path, *, create: bool) -> int:
    absolute = path.absolute()
    descriptor = os.open(
        absolute.anchor,
        os.O_RDONLY | os.O_DIRECTORY | os.O_NOFOLLOW,
    )
    traversed = Path(absolute.anchor)
    try:
        for part in absolute.parts[1:]:
            traversed /= part
            child = _open_directory_at(
                descriptor,
                part,
                traversed,
                create=create,
            )
            os.close(descriptor)
            descriptor = child
        return descriptor
    except BaseException:
        os.close(descriptor)
        raise


def write_output_text(root: Path, relative: str, content: str) -> None:
    """Atomically write below root without following any directory symlink."""

    path = _relative_path(relative)
    parent = path.parent
    descriptor = _open_directory_path(root, create=True)
    traversed = root.absolute()
    try:
        if parent != PurePosixPath("."):
            for part in parent.parts:
                traversed /= part
                child = _open_directory_at(
                    descriptor,
                    part,
                    traversed,
                    create=True,
                )
                os.close(descriptor)
                descriptor = child
        filename = path.name
        try:
            existing = os.stat(filename, dir_fd=descriptor, follow_symlinks=False)
        except FileNotFoundError:
            existing = None
        if existing is not None and not stat.S_ISREG(existing.st_mode):
            raise ValueError(
                f"sortie symbolique ou non-régulière interdite : {root / path.as_posix()}"
            )
        temporary = f".{filename}.nexus-tmp-{os.getpid()}"
        attempt = 0
        while True:
            candidate = temporary if attempt == 0 else f"{temporary}-{attempt}"
            try:
                file_descriptor = os.open(
                    candidate,
                    os.O_WRONLY | os.O_CREAT | os.O_EXCL | os.O_NOFOLLOW,
                    0o644,
                    dir_fd=descriptor,
                )
                break
            except FileExistsError:
                attempt += 1
        try:
            with os.fdopen(file_descriptor, "w", encoding="utf-8", newline="\n") as stream:
                stream.write(content)
                stream.flush()
                os.fsync(stream.fileno())
            try:
                current = os.stat(
                    filename,
                    dir_fd=descriptor,
                    follow_symlinks=False,
                )
            except FileNotFoundError:
                current = None
            if current is not None and not stat.S_ISREG(current.st_mode):
                raise ValueError(
                    f"sortie symbolique ou non-régulière interdite : {root / path.as_posix()}"
                )
            os.replace(
                candidate,
                filename,
                src_dir_fd=descriptor,
                dst_dir_fd=descriptor,
            )
            written = os.stat(filename, dir_fd=descriptor, follow_symlinks=False)
            if not stat.S_ISREG(written.st_mode):
                raise ValueError(f"sortie écrite non régulière : {root / path.as_posix()}")
        finally:
            try:
                os.unlink(candidate, dir_fd=descriptor)
            except FileNotFoundError:
                pass
    finally:
        os.close(descriptor)


def _expected_entries(expected_files: set[str]) -> dict[str, str]:
    expected: dict[str, str] = {}
    for raw in expected_files:
        path = _relative_path(raw)
        expected[path.as_posix()] = "file"
        for parent in path.parents:
            if parent == PurePosixPath("."):
                break
            expected[parent.as_posix()] = "directory"
    return expected


def _actual_entries(root: Path) -> dict[str, str]:
    actual: dict[str, str] = {}

    def visit(descriptor: int, relative_directory: PurePosixPath) -> None:
        with os.scandir(descriptor) as scanned:
            entries = sorted(scanned, key=lambda entry: entry.name)
        for entry in entries:
            relative = (
                PurePosixPath(entry.name)
                if relative_directory == PurePosixPath(".")
                else relative_directory / entry.name
            )
            key = relative.as_posix()
            if entry.is_symlink():
                actual[key] = "symlink"
            elif entry.is_dir(follow_symlinks=False):
                actual[key] = "directory"
                child = _open_directory_at(
                    descriptor,
                    entry.name,
                    root / key,
                    create=False,
                )
                try:
                    visit(child, relative)
                finally:
                    os.close(child)
            elif entry.is_file(follow_symlinks=False):
                actual[key] = "file"
            else:
                actual[key] = "other"

    root_descriptor = _open_directory_path(root, create=False)
    try:
        visit(root_descriptor, PurePosixPath("."))
    finally:
        os.close(root_descriptor)
    return actual


def assert_exact_output_tree(root: Path, expected_files: set[str]) -> None:
    """Reject missing, stale, symbolic or special entries without removing them."""

    expected = _expected_entries(expected_files)
    actual = _actual_entries(root)
    missing = sorted(set(expected) - set(actual))
    unexpected = sorted(set(actual) - set(expected))
    wrong_types = sorted(
        path
        for path in set(expected) & set(actual)
        if expected[path] != actual[path]
    )
    errors: list[str] = []
    if missing:
        errors.append("entrée attendue manquante : " + ", ".join(missing[:20]))
    if unexpected:
        errors.append("entrée inattendue : " + ", ".join(unexpected[:20]))
    if wrong_types:
        errors.append(
            "type d'entrée inattendu : "
            + ", ".join(
                f"{path} ({actual[path]} au lieu de {expected[path]})"
                for path in wrong_types[:20]
            )
        )
    if errors:
        raise ValueError("contrat de sortie divergent :\n- " + "\n- ".join(errors))
