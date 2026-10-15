#!/usr/bin/env python3
"""Clear only a retained private directory FD; preserve any path replacement."""
import os
import shutil
import stat
import sys


def cleanup():
    name, device, inode = sys.argv[1:]
    if not name or name in (".", "..") or "/" in name or "\\" in name:
        raise ValueError()
    expected = int(device), int(inode)
    parent, owned = os.fstat(3), os.fstat(4)
    if (not stat.S_ISDIR(parent.st_mode) or not stat.S_ISDIR(owned.st_mode)
            or (owned.st_dev, owned.st_ino) != expected or owned.st_uid != os.geteuid()
            or stat.S_IMODE(owned.st_mode) != 0o700 or not shutil.rmtree.avoids_symlink_attacks):
        raise ValueError()
    # A moved directory is still cleared through its held FD. A replacement at
    # its old pathname is never traversed, altered or removed.
    with os.scandir(4) as entries:
        for entry in entries:
            metadata = os.stat(entry.name, dir_fd=4, follow_symlinks=False)
            if stat.S_ISDIR(metadata.st_mode):
                shutil.rmtree(entry.name, dir_fd=4)
            else:
                os.unlink(entry.name, dir_fd=4)
    os.fsync(4)
    try:
        current = os.stat(name, dir_fd=3, follow_symlinks=False)
    except FileNotFoundError:
        return
    if (current.st_dev, current.st_ino) == expected and stat.S_ISDIR(current.st_mode):
        os.rmdir(name, dir_fd=3)
        os.fsync(3)


if __name__ == "__main__":
    try:
        cleanup()
    except BaseException:
        print("OWNED_EVIDENCE_CLEANUP_REFUSED", file=sys.stderr)
        sys.exit(1)
