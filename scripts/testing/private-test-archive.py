#!/usr/bin/env python3
"""Bounded private transport. GitHub/OIDC authenticity is verified separately."""
import hashlib
import json
import os
import re
import shutil
import signal
import stat
import struct
import sys
import zipfile
from contextlib import ExitStack, contextmanager

MAGIC = b"NEXUS-PRIVATE-ARCHIVE\0\1"
SCHEMA = "nexus-private-test-archive/v1"
MAX_FILES, MAX_ENTRIES = 20_000, 50_000
MAX_BYTES, MAX_FILE = 2 * 1024**3, 512 * 1024**2
MAX_INDEX, MAX_HEADER, CHUNK = 16 * 1024**2, 8192, 1024**2
DIR = os.O_RDONLY | os.O_DIRECTORY | os.O_NOFOLLOW
READ = os.O_RDONLY | os.O_NOFOLLOW | os.O_NONBLOCK
WRITE = os.O_WRONLY | os.O_CREAT | os.O_EXCL | os.O_NOFOLLOW
OWNER_FDS = {}


class Refused(Exception):
    pass


def require(condition):
    if not condition:
        raise Refused()


def identity(value):
    return value.st_dev, value.st_ino, stat.S_IFMT(value.st_mode)


def snapshot(value):
    return (identity(value), stat.S_IMODE(value.st_mode), value.st_nlink,
            value.st_size, value.st_mtime_ns, value.st_ctime_ns, value.st_uid)


def regular(value):
    require(stat.S_ISREG(value.st_mode) and value.st_nlink == 1)


def absolute(value):
    require(isinstance(value, str) and os.path.isabs(value)
            and not value.startswith("//") and "\\" not in value
            and "\0" not in value and os.path.normpath(value) == value)
    return value


def safe_name(value):
    require(isinstance(value, str) and value and not value.startswith("/")
            and "\\" not in value and len(value.encode("utf-8")) <= 512
            and all(ord(c) >= 32 and ord(c) != 127 for c in value))
    parts = value.split("/")
    require(len(parts) <= 20)
    for part in parts:
        name = part.lower()
        require(part not in ("", ".", "..") and name not in {
            ".git", ".auth", ".npmrc", ".netrc", "auth.json", "cookies.json",
            "session.json", "storage-state.json", "storage_state.json",
            "id_rsa", "id_dsa", "id_ecdsa", "id_ed25519",
        } and not name.startswith(".env")
            and not name.endswith((".key", ".pem", ".p12", ".pfx", ".asc", ".env"))
            and not re.search(r"(?:^|[._-])(?:env(?:ironment)?|credentials?|"
                              r"secrets?|private[_-]?key)(?:$|[._-])", name))
    return parts


def payload_name(value):
    parts = safe_name(value)
    require(len(parts) >= 3 and parts[0] in ("reports", "attachments")
            and re.fullmatch(r"[a-z0-9][a-z0-9_-]{0,63}", parts[1]))


def open_directory(path):
    absolute(path)
    with ExitStack() as stack:
        roots = [root for root in OWNER_FDS if path == root or path.startswith(root + "/")]
        require(len(roots) <= 1)
        if roots:
            root = roots[0]
            descriptor = os.dup(OWNER_FDS[root])
            owned = os.fstat(descriptor)
            require(stat.S_ISDIR(owned.st_mode) and owned.st_uid == os.geteuid()
                    and stat.S_IMODE(owned.st_mode) == 0o700)
            parts = path[len(root):].split("/")
        else:
            descriptor = os.open("/", DIR)
            parts = path.split("/")[1:]
        stack.callback(os.close, descriptor)
        bindings = []
        for part in parts:
            if not part:
                continue
            before = os.stat(part, dir_fd=descriptor, follow_symlinks=False)
            require(stat.S_ISDIR(before.st_mode))
            child = os.open(part, DIR, dir_fd=descriptor)
            stack.callback(os.close, child)
            require(identity(os.fstat(child)) == identity(before))
            bindings.append((descriptor, part, identity(before)))
            descriptor = child
        for parent, name, expected in bindings:
            require(identity(os.stat(name, dir_fd=parent, follow_symlinks=False)) == expected)
        return os.dup(descriptor)


class Anchor:
    def __init__(self, path):
        self.path = absolute(path)
        self.fd = open_directory(path)
        self.expected = identity(os.fstat(self.fd))

    def verify(self):
        descriptor = open_directory(self.path)
        try:
            require(identity(os.fstat(descriptor)) == self.expected)
        finally:
            os.close(descriptor)

    def close(self):
        os.close(self.fd)


def scan(root_fd, budget, include_index=False, max_file=MAX_FILE, max_bytes=None):
    result = {}

    def visit(fd, relative):
        before = snapshot(os.fstat(fd))
        result[relative] = before
        names = []
        with os.scandir(fd) as iterator:
            for entry in iterator:
                budget[2] += 1
                require(budget[2] <= MAX_ENTRIES)
                names.append(entry.name)
        for name in sorted(names):
            path = f"{relative}/{name}" if relative else name
            safe_name(path)
            metadata = os.stat(name, dir_fd=fd, follow_symlinks=False)
            if stat.S_ISDIR(metadata.st_mode):
                child = os.open(name, DIR, dir_fd=fd)
                try:
                    require(snapshot(os.fstat(child)) == snapshot(metadata))
                    visit(child, path)
                    require(snapshot(os.stat(name, dir_fd=fd, follow_symlinks=False)) == snapshot(metadata))
                finally:
                    os.close(child)
            else:
                regular(metadata)
                budget[0] += 1
                budget[1] += metadata.st_size
                require(metadata.st_size <= max_file and budget[0] <= MAX_FILES + int(include_index)
                        and budget[1] <= (max_bytes if max_bytes is not None else MAX_BYTES + (MAX_INDEX if include_index else 0)))
                result[path] = snapshot(metadata)
        require(snapshot(os.fstat(fd)) == before)

    visit(root_fd, "")
    return result


@contextmanager
def file_at(root_fd, relative, inventory=None):
    parts = safe_name(relative)
    with ExitStack() as stack:
        parent = os.dup(root_fd)
        stack.callback(os.close, parent)
        bindings, prefix = [], ""
        if inventory is not None:
            require(snapshot(os.fstat(parent)) == inventory[""])
        for part in parts[:-1]:
            before = os.stat(part, dir_fd=parent, follow_symlinks=False)
            child = os.open(part, DIR, dir_fd=parent)
            stack.callback(os.close, child)
            require(identity(os.fstat(child)) == identity(before))
            bindings.append((parent, part, identity(before)))
            prefix = f"{prefix}/{part}" if prefix else part
            if inventory is not None:
                require(snapshot(os.fstat(child)) == inventory[prefix])
            parent = child
        name = parts[-1]
        before = os.stat(name, dir_fd=parent, follow_symlinks=False)
        regular(before)
        expected = snapshot(before)
        if inventory is not None:
            require(expected == inventory[relative])
        fd = os.open(name, READ, dir_fd=parent)
        stack.callback(os.close, fd)
        require(snapshot(os.fstat(fd)) == expected)
        yield fd, expected
        require(snapshot(os.fstat(fd)) == expected
                and snapshot(os.stat(name, dir_fd=parent, follow_symlinks=False)) == expected)
        for bound_parent, component, expected_identity in bindings:
            require(identity(os.stat(component, dir_fd=bound_parent, follow_symlinks=False)) == expected_identity)


def write_all(fd, value):
    pending = memoryview(value)
    while pending:
        count = os.write(fd, pending)
        require(count > 0)
        pending = pending[count:]


def encode(value):
    return json.dumps(value, ensure_ascii=False, separators=(",", ":")).encode("utf-8")


def write_header(fd, kind, value):
    data = encode(value)
    require(len(data) <= (MAX_HEADER if kind == 1 else MAX_INDEX))
    write_all(fd, struct.pack(">BI", kind, len(data)) + data)


def remove_file(parent, name, owned):
    try:
        current = os.stat(name, dir_fd=parent, follow_symlinks=False)
    except FileNotFoundError:
        return
    require(identity(current) == owned)
    os.unlink(name, dir_fd=parent)


def create_archive(roots, output):
    absolute(output)
    require(0 < len(roots) <= 64 and len({(c, label) for c, label, _ in roots}) == len(roots))
    for category, label, root in roots:
        require(category in ("reports", "attachments") and re.fullmatch(r"[a-z0-9][a-z0-9_-]{0,63}", label))
        absolute(root)
        require(os.path.commonpath((root, output)) != root)
    for i, (_, _, root) in enumerate(roots):
        for _, _, other in roots[i + 1:]:
            require(os.path.commonpath((root, other)) not in (root, other))
    output_parent, output_name = os.path.split(output)
    owned = None
    with ExitStack() as stack:
        parent = Anchor(output_parent)
        stack.callback(parent.close)
        try:
            sources, budget = [], [0, 0, 0]
            for category, label, root in sorted(roots):
                anchor = Anchor(root)
                stack.callback(anchor.close)
                sources.append((category, label, anchor, scan(anchor.fd, budget)))
            require(budget[0] > 0)
            seen, prefixes = set(), set()
            for category, label, _, inventory in sources:
                for relative, metadata in inventory.items():
                    if metadata[0][2] == stat.S_IFREG:
                        remember_payload(f"{category}/{label}/{relative}", seen, prefixes)
            fd = os.open(output_name, WRITE, 0o600, dir_fd=parent.fd)
            stack.callback(os.close, fd)
            os.fchmod(fd, 0o600)
            owned = identity(os.fstat(fd))
            write_all(fd, MAGIC)
            records = []
            for category, label, anchor, inventory in sources:
                for relative, metadata in sorted(inventory.items()):
                    if metadata[0][2] != stat.S_IFREG:
                        continue
                    name = f"{category}/{label}/{relative}"
                    payload_name(name)
                    with file_at(anchor.fd, relative, inventory) as opened:
                        source_fd, expected = opened
                        size, digest, count = expected[3], hashlib.sha256(), 0
                        write_header(fd, 1, {"path": name, "size": size})
                        while count < size:
                            chunk = os.read(source_fd, min(CHUNK, size - count))
                            require(chunk)
                            digest.update(chunk)
                            write_all(fd, chunk)
                            count += len(chunk)
                        require(not os.read(source_fd, 1))
                        records.append({"path": name, "size": size, "sha256": digest.hexdigest()})
            write_header(fd, 2, {"schemaVersion": SCHEMA, "files": records, "totalBytes": budget[1]})
            os.fsync(fd)
            after_budget = [0, 0, 0]
            for _, _, anchor, inventory in sources:
                require(scan(anchor.fd, after_budget) == inventory)
                anchor.verify()
            require(after_budget == budget)
            current = os.fstat(fd)
            regular(current)
            require(stat.S_IMODE(current.st_mode) == 0o600
                    and snapshot(os.stat(output_name, dir_fd=parent.fd, follow_symlinks=False)) == snapshot(current))
            parent.verify()
            os.fsync(parent.fd)
            return {"files": budget[0], "bytes": budget[1]}
        except BaseException:
            if owned is not None:
                remove_file(parent.fd, output_name, owned)
            raise


def exact(fd, size, offset):
    require(0 <= size <= MAX_INDEX)
    result = bytearray()
    while len(result) < size:
        chunk = os.pread(fd, min(CHUNK, size - len(result)), offset + len(result))
        require(chunk)
        result.extend(chunk)
    return bytes(result)


def no_duplicate_keys(pairs):
    result = {}
    for key, value in pairs:
        require(key not in result)
        result[key] = value
    return result


def invalid_constant(_):
    raise Refused()


def remember_payload(name, seen, prefixes):
    payload_name(name)
    require(name not in seen and name not in prefixes)
    parts = name.split("/")
    for count in range(1, len(parts)):
        prefix = "/".join(parts[:count])
        require(prefix not in seen)
        prefixes.add(prefix)
    seen.add(name)
    require(len(seen) + len(prefixes) + 1 <= MAX_ENTRIES)


def preflight(fd, length):
    require(length <= MAX_BYTES + MAX_FILES * (MAX_HEADER + 5) + MAX_INDEX + 5 + len(MAGIC))
    require(exact(fd, len(MAGIC), 0) == MAGIC)
    offset, records, entries, seen, prefixes, total = len(MAGIC), [], [], set(), set(), 0
    while offset < length:
        kind, size = struct.unpack(">BI", exact(fd, 5, offset))
        offset += 5
        require(kind in (1, 2) and 0 < size <= (MAX_HEADER if kind == 1 else MAX_INDEX))
        encoded = exact(fd, size, offset)
        value = json.loads(encoded.decode("utf-8"), object_pairs_hook=no_duplicate_keys,
                           parse_constant=invalid_constant)
        offset += size
        require(isinstance(value, dict))
        if kind == 2:
            require(records and offset == length and set(value) == {"schemaVersion", "files", "totalBytes"}
                    and value["schemaVersion"] == SCHEMA and isinstance(value["files"], list)
                    and len(value["files"]) == len(records)
                    and type(value["totalBytes"]) is int and value["totalBytes"] == total)
            for found, expected in zip(value["files"], records):
                require(isinstance(found, dict) and set(found) == {"path", "size", "sha256"}
                        and type(found["size"]) is int and isinstance(found["path"], str)
                        and isinstance(found["sha256"], str) and found == expected)
            return entries, encoded
        require(set(value) == {"path", "size"} and type(value["size"]) is int
                and 0 <= value["size"] <= MAX_FILE and offset + value["size"] <= length)
        name, file_size = value["path"], value["size"]
        require(len(records) < MAX_FILES)
        remember_payload(name, seen, prefixes)
        total += file_size
        require(total <= MAX_BYTES)
        digest, remaining, cursor = hashlib.sha256(), file_size, offset
        while remaining:
            chunk = exact(fd, min(CHUNK, remaining), cursor)
            digest.update(chunk)
            cursor += len(chunk)
            remaining -= len(chunk)
        records.append({"path": name, "size": file_size, "sha256": digest.hexdigest()})
        entries.append((name, file_size, offset, digest.hexdigest()))
        offset += file_size
    raise Refused()


def private_parent(root_fd, parts, directories):
    fd = os.dup(root_fd)
    prefix = ""
    try:
        for part in parts:
            try:
                os.mkdir(part, 0o700, dir_fd=fd)
            except FileExistsError:
                pass
            before = os.stat(part, dir_fd=fd, follow_symlinks=False)
            require(stat.S_ISDIR(before.st_mode) and stat.S_IMODE(before.st_mode) == 0o700
                    and before.st_uid == os.geteuid())
            child = os.open(part, DIR, dir_fd=fd)
            try:
                require(identity(os.fstat(child)) == identity(before))
                prefix = f"{prefix}/{part}" if prefix else part
                expected = directories.setdefault(prefix, identity(before))
                require(identity(before) == expected)
            except BaseException:
                os.close(child)
                raise
            os.close(fd)
            fd = child
        return fd
    except BaseException:
        os.close(fd)
        raise


def extract_archive(input_path, output):
    absolute(input_path)
    absolute(output)
    input_parent, input_name = os.path.split(input_path)
    output_parent, output_name = os.path.split(output)
    owned = None
    with ExitStack() as stack:
        source, target = Anchor(input_parent), None
        stack.callback(source.close)
        target = Anchor(output_parent)
        stack.callback(target.close)
        try:
            with file_at(source.fd, input_name) as opened:
                fd, before = opened
                entries, index_bytes = preflight(fd, before[3])
                require(snapshot(os.fstat(fd)) == before)
                source.verify()
                os.mkdir(output_name, 0o700, dir_fd=target.fd)
                owned = identity(os.stat(output_name, dir_fd=target.fd, follow_symlinks=False))
                output_fd = os.open(output_name, DIR, dir_fd=target.fd)
                stack.callback(os.close, output_fd)
                require(identity(os.fstat(output_fd)) == owned)
                os.fchmod(output_fd, 0o700)
                os.mkdir(".staging", 0o700, dir_fd=output_fd)
                stage_fd = os.open(".staging", DIR, dir_fd=output_fd)
                stack.callback(os.close, stage_fd)
                written, directories = {}, {"": identity(os.fstat(stage_fd))}
                for name, size, offset, expected_hash in entries + [("INDEX.json", len(index_bytes), None, hashlib.sha256(index_bytes).hexdigest())]:
                    parts = safe_name(name)
                    parent = private_parent(stage_fd, parts[:-1], directories)
                    try:
                        destination = os.open(parts[-1], WRITE, 0o600, dir_fd=parent)
                        try:
                            os.fchmod(destination, 0o600)
                            digest, count = hashlib.sha256(), 0
                            while count < size:
                                chunk = index_bytes[count:count + CHUNK] if offset is None else exact(fd, min(CHUNK, size - count), offset + count)
                                write_all(destination, chunk)
                                digest.update(chunk)
                                count += len(chunk)
                            os.fsync(destination)
                            current = os.fstat(destination)
                            regular(current)
                            require(digest.hexdigest() == expected_hash and current.st_size == size
                                    and stat.S_IMODE(current.st_mode) == 0o600
                                    and snapshot(os.stat(parts[-1], dir_fd=parent, follow_symlinks=False)) == snapshot(current))
                            written[name] = snapshot(current)
                        finally:
                            os.close(destination)
                    finally:
                        os.close(parent)
                require(snapshot(os.fstat(fd)) == before)
                source.verify()
                target.verify()
                require(identity(os.stat(output_name, dir_fd=target.fd, follow_symlinks=False)) == owned)
                os.fsync(stage_fd)
                staged = scan(stage_fd, [0, 0, 0], include_index=True)
                require({name: metadata for name, metadata in staged.items()
                         if metadata[0][2] == stat.S_IFREG} == written)
                actual_directories = {name: metadata[0] for name, metadata in staged.items()
                                      if metadata[0][2] == stat.S_IFDIR}
                require(actual_directories == directories
                        and all(metadata[1] == (0o700 if metadata[0][2] == stat.S_IFDIR else 0o600)
                                and metadata[6] == os.geteuid() for metadata in staged.values()))
                require(identity(os.stat(".staging", dir_fd=output_fd, follow_symlinks=False)) == identity(os.fstat(stage_fd))
                        and sorted(os.listdir(output_fd)) == [".staging"])
                os.rename(".staging", "payload", src_dir_fd=output_fd, dst_dir_fd=output_fd)
                os.fsync(output_fd)
            source.verify()
            target.verify()
            return {"files": len(entries), "bytes": sum(entry[1] for entry in entries)}
        except BaseException:
            if owned is not None:
                try:
                    current = os.stat(output_name, dir_fd=target.fd, follow_symlinks=False)
                except FileNotFoundError:
                    current = None
                if current is not None:
                    require(identity(current) == owned)
                    shutil.rmtree(output_name, dir_fd=target.fd)
            raise


def extract_artifact_zip(input_path, output, kind):
    """GitHub's outer ZIP contains only ciphertext/metadata or the public plan."""
    absolute(input_path)
    absolute(output)
    expected = {"manifest.json", "payload.gpg"} if kind == "evidence" else {"launch.json"}
    require(kind in ("plan", "evidence"))
    input_parent, input_name = os.path.split(input_path)
    output_parent, output_name = os.path.split(output)
    owned = None
    with ExitStack() as stack:
        source = Anchor(input_parent)
        stack.callback(source.close)
        target = Anchor(output_parent)
        stack.callback(target.close)
        try:
            with file_at(source.fd, input_name) as opened:
                fd, before = opened
                length = before[3]
                require(22 <= length <= 3 * 1024**3)
                # Check the tiny central-directory budget before ZipFile can
                # allocate it. Our uploads have no comments, disk splits or
                # ZIP64 extensions (two entries, each below the 32-bit limit).
                end = exact(fd, 22, length - 22)
                signature, disk, cd_disk, disk_count, count, cd_size, cd_offset, comment = struct.unpack("<4s4H2IH", end)
                require(signature == b"PK\x05\x06" and disk == cd_disk == comment == 0
                        and disk_count == count == len(expected) and cd_size <= 16_384
                        and cd_offset + cd_size == length - 22)
                require(length < 42 or exact(fd, 4, length - 42) != b"PK\x06\x07")
                stream = os.fdopen(os.dup(fd), "rb")
                stack.callback(stream.close)
                archive = zipfile.ZipFile(stream)
                stack.callback(archive.close)
                require(archive.start_dir == cd_offset)
                entries = archive.infolist()
                require(len(entries) == len(expected) and {e.filename for e in entries} == expected)
                for entry in entries:
                    mode = entry.external_attr >> 16
                    limit = 3 * 1024**3 if entry.filename == "payload.gpg" else MAX_INDEX
                    require(entry.orig_filename == entry.filename and not entry.is_dir() and not entry.flag_bits & 1
                            and stat.S_IFMT(mode) in (0, stat.S_IFREG)
                            and entry.compress_type in (zipfile.ZIP_STORED, zipfile.ZIP_DEFLATED)
                            and 0 < entry.file_size <= limit and entry.compress_size <= length)
                # Parse every local header, overlap check and complete CRC before
                # reserving a destination. The second pass binds copied bytes to
                # this preflight, including a final read of the written files.
                hashes = {}
                for entry in entries:
                    digest, count = hashlib.sha256(), 0
                    with archive.open(entry) as content:
                        while chunk := content.read(CHUNK):
                            count += len(chunk)
                            require(count <= entry.file_size)
                            digest.update(chunk)
                    require(count == entry.file_size)
                    hashes[entry.filename] = digest.hexdigest()
                require(snapshot(os.fstat(fd)) == before)
                source.verify()
                target.verify()
                os.mkdir(output_name, 0o700, dir_fd=target.fd)
                owned = identity(os.stat(output_name, dir_fd=target.fd, follow_symlinks=False))
                output_fd = os.open(output_name, DIR, dir_fd=target.fd)
                stack.callback(os.close, output_fd)
                require(identity(os.fstat(output_fd)) == owned)
                os.fchmod(output_fd, 0o700)
                os.mkdir(".staging", 0o700, dir_fd=output_fd)
                stage_fd = os.open(".staging", DIR, dir_fd=output_fd)
                stack.callback(os.close, stage_fd)
                written = {}
                for entry in entries:
                    destination = os.open(entry.filename, WRITE, 0o600, dir_fd=stage_fd)
                    try:
                        os.fchmod(destination, 0o600)
                        digest, count = hashlib.sha256(), 0
                        with archive.open(entry) as content:
                            while chunk := content.read(CHUNK):
                                count += len(chunk)
                                require(count <= entry.file_size)
                                write_all(destination, chunk)
                                digest.update(chunk)
                        require(count == entry.file_size and digest.hexdigest() == hashes[entry.filename])
                        os.fsync(destination)
                        metadata = os.fstat(destination)
                        regular(metadata)
                        require(metadata.st_size == entry.file_size and metadata.st_uid == os.geteuid()
                                and stat.S_IMODE(metadata.st_mode) == 0o600
                                and snapshot(os.stat(entry.filename, dir_fd=stage_fd, follow_symlinks=False)) == snapshot(metadata))
                        written[entry.filename] = snapshot(metadata)
                    finally:
                        os.close(destination)
                os.fsync(stage_fd)
                staged = scan(stage_fd, [0, 0, 0], max_file=3 * 1024**3, max_bytes=3 * 1024**3)
                # Ciphertext is permitted to exceed the native-file cap; the
                # ZIP budget above is authoritative for this closed two-file view.
                require({name: metadata for name, metadata in staged.items() if name} == written)
                require(all(metadata[1] == (0o700 if metadata[0][2] == stat.S_IFDIR else 0o600)
                            and metadata[6] == os.geteuid() for metadata in staged.values()))
                for entry in entries:
                    with file_at(stage_fd, entry.filename, staged) as opened_destination:
                        destination, _ = opened_destination
                        digest = hashlib.sha256()
                        while chunk := os.read(destination, CHUNK):
                            digest.update(chunk)
                        require(digest.hexdigest() == hashes[entry.filename])
                require(snapshot(os.fstat(fd)) == before)
                source.verify()
                target.verify()
                require(identity(os.stat(output_name, dir_fd=target.fd, follow_symlinks=False)) == owned
                        and identity(os.stat(".staging", dir_fd=output_fd, follow_symlinks=False)) == identity(os.fstat(stage_fd))
                        and sorted(os.listdir(output_fd)) == [".staging"])
                os.rename(".staging", "payload", src_dir_fd=output_fd, dst_dir_fd=output_fd)
                os.fsync(output_fd)
                source.verify()
                target.verify()
                require(identity(os.stat(output_name, dir_fd=target.fd, follow_symlinks=False)) == owned
                        and identity(os.stat("payload", dir_fd=output_fd, follow_symlinks=False)) == identity(os.fstat(stage_fd)))
            return {"files": len(entries), "bytes": sum(entry.file_size for entry in entries)}
        except BaseException:
            if owned is not None:
                try:
                    current = os.stat(output_name, dir_fd=target.fd, follow_symlinks=False)
                except FileNotFoundError:
                    current = None
                if current is not None:
                    require(identity(current) == owned)
                    shutil.rmtree(output_name, dir_fd=target.fd)
            raise


def main():
    require(shutil.rmtree.avoids_symlink_attacks)
    os.umask(0o077)
    def interrupted(*_):
        raise Refused()
    signal.signal(signal.SIGINT, interrupted)
    signal.signal(signal.SIGTERM, interrupted)
    args = sys.argv[1:]
    require(args and args[0] in ("create", "extract", "artifact-zip") and len(args) % 2 == 1)
    command, roots, options = args[0], [], {}
    for flag, value in zip(args[1::2], args[2::2]):
        if flag == "--owner-fd":
            root, separator, fd = value.partition("=")
            require(separator == "=" and re.fullmatch(r"/proc/[1-9][0-9]*/fd/[0-9]+", root)
                    and re.fullmatch(r"[3-9]|[1-9][0-9]+", fd) and root not in OWNER_FDS
                    and len(OWNER_FDS) < 2)
            descriptor = int(fd)
            held = os.fstat(descriptor)
            require(stat.S_ISDIR(held.st_mode) and held.st_uid == os.geteuid()
                    and stat.S_IMODE(held.st_mode) == 0o700
                    and identity(os.stat(root)) == identity(held))
            OWNER_FDS[root] = descriptor
        elif command == "create" and flag in ("--reports", "--attachments"):
            label, separator, root = value.partition("=")
            require(separator == "=")
            roots.append((flag[2:], label, root))
        else:
            require(flag in ("--input", "--output", "--kind") and flag not in options)
            options[flag] = value
    if command == "create":
        require(set(options) == {"--output"})
        result = create_archive(roots, options["--output"])
    elif command == "extract":
        require(not roots and set(options) == {"--input", "--output"})
        result = extract_archive(options["--input"], options["--output"])
    else:
        require(not roots and set(options) == {"--input", "--output", "--kind"})
        result = extract_artifact_zip(options["--input"], options["--output"], options["--kind"])
    print(json.dumps({"code": f"PRIVATE_ARCHIVE_{'CREATED' if command == 'create' else 'EXTRACTED'}", **result}, separators=(",", ":")))


if __name__ == "__main__":
    try:
        main()
    except BaseException:
        print("PRIVATE_ARCHIVE_REFUSED", file=sys.stderr)
        sys.exit(1)
