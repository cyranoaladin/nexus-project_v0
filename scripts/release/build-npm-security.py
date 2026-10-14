#!/usr/bin/env python3
"""Compose a traceable Nexus derivative from three verified upstream archives.
No downloads or installation hooks. Only explicitly listed bundled packages change.
"""
import gzip
import hashlib
import io
import json
import os
from pathlib import Path, PurePosixPath
import platform
import re
import subprocess
import sys
import tarfile
import zlib


def require(condition, message):
    if not condition:
        raise RuntimeError(message)


def sha256(data):
    return hashlib.sha256(data).hexdigest()


def load_archive(archive):
    files = {}
    size = 0
    with tarfile.open(fileobj=io.BytesIO(archive), mode="r:gz") as tar:
        for member in tar:
            name = member.name
            require(name.startswith("package/") and "\\" not in name and "\0" not in name
                    and not PurePosixPath(name).is_absolute()
                    and all(part not in ("", ".", "..") for part in name.split("/")), "UNSAFE_ARCHIVE_PATH")
            require(member.isfile() and name not in files, "INVALID_ARCHIVE_ENTRY")
            size += member.size
            require(0 <= member.size <= 20 * 1024 * 1024 and size <= 64 * 1024 * 1024
                    and len(files) < 5000, "ARCHIVE_LIMIT_EXCEEDED")
            stream = tar.extractfile(member)
            require(stream is not None, "UNREADABLE_ARCHIVE_ENTRY")
            content = stream.read()
            require(len(content) == member.size, "TRUNCATED_ARCHIVE_ENTRY")
            files[name] = (content, 0o755 if member.mode & 0o111 else 0o644)
    return files


def package(files, location):
    return json.loads(files[location][0])


def verify_source_binding(builder, source_sha, preliminary=False):
    require(re.fullmatch(r"[a-f0-9]{40}", source_sha) is not None, "INVALID_SOURCE_SHA")
    def git(*args):
        return subprocess.check_output(["git", *args], cwd=builder.parent)
    root = Path(git("rev-parse", "--show-toplevel").decode().strip())
    require(git("rev-parse", "HEAD").decode().strip() == source_sha, "SOURCE_SHA_MISMATCH")
    clean = not git("status", "--porcelain=v1", "--untracked-files=all").strip()
    recipes = {}
    for file in [builder, builder.with_name("verify-npm-inputs.mjs")]:
        relative = file.relative_to(root).as_posix()
        content = file.read_bytes()
        if not preliminary:
            require(clean, "FINAL_SOURCE_TREE_DIRTY")
            require(git("show", f"{source_sha}:{relative}") == content, "RECIPE_SOURCE_MISMATCH")
        recipes[relative] = sha256(content)
    return {"sourceSha": source_sha, "tree": git("rev-parse", "HEAD^{tree}").decode().strip(),
            "clean": clean, "qualified": not preliminary, "recipes": recipes}


def python_provenance():
    paths = {str(Path(sys.executable).resolve())}
    for module in tuple(sys.modules.values()):
        file = getattr(module, "__file__", None)
        if file and Path(file).is_file() and not file.endswith("build-npm-security.py"):
            paths.add(str(Path(file).resolve()))
    # Include the dynamic libraries of the interpreter and loaded extensions.
    for file in tuple(paths):
        if file.endswith(".so") or file == str(Path(sys.executable).resolve()):
            result = subprocess.run(["ldd", file], capture_output=True, text=True, check=False)
            for match in re.finditer(r"(?:=>\s*)?(/[^\s]+)\s*\(", result.stdout):
                dependency = Path(match.group(1))
                if dependency.is_file():
                    paths.add(str(dependency.resolve()))
    return {"python": platform.python_version(), "zlib": zlib.ZLIB_RUNTIME_VERSION,
            "files": [{"path": file, "sha256": sha256(Path(file).read_bytes())} for file in sorted(paths)]}


def main():
    require(len(sys.argv) in (5, 6) and (len(sys.argv) == 5 or sys.argv[5] == "--preliminary"),
            "Usage: build-npm-security.py INPUT_DIR OUTPUT_DIR ABSOLUTE_NODE SOURCE_SHA [--preliminary]")
    preliminary = len(sys.argv) == 6
    inputs, output, node = map(Path, sys.argv[1:4])
    source_sha = sys.argv[4]
    require(node.is_absolute() and node.is_file(), "PINNED_NODE_REQUIRED")
    builder = Path(__file__).resolve()
    verifier = builder.with_name("verify-npm-inputs.mjs")
    source_binding = verify_source_binding(builder, source_sha, preliminary)
    runtime_hash = sha256(node.read_bytes())
    toolchain = python_provenance()
    verification = subprocess.run([str(node), str(verifier), str(inputs)], check=True, capture_output=True,
                                  text=True, env={"PATH": "/usr/bin:/bin", "LANG": "C.UTF-8", "TZ": "UTC"})
    receipt = json.loads(verification.stdout)
    runtime = receipt["verificationRuntime"]
    require(runtime["node"] == "22.23.3" and runtime["platform"] == "linux" and runtime["arch"] == "x64"
            and runtime["executableSha256"] == runtime_hash, "VERIFICATION_RUNTIME_MISMATCH")
    require(preliminary or runtime["openssl"] == "3.5.9", "UNQUALIFIED_OPENSSL_RUNTIME")
    archives = {}
    for item in receipt["inputs"]:
        archive = (inputs / item["file"]).read_bytes()
        require(sha256(archive) == item["sha256"], "INPUT_CHANGED_AFTER_VERIFICATION")
        archives[item["name"]] = load_archive(archive)
    require(set(archives) == {"npm", "brace-expansion", "http-cache-semantics", "undici", "ip-address", "postcss-selector-parser"}, "UNEXPECTED_INPUT_SET")
    base = archives["npm"]
    require(len(base) == 1961 and package(base, "package/package.json")["version"] == "11.21.0", "UNEXPECTED_NPM_GRAPH")
    replacements = {"brace-expansion": ("5.0.9", "5.0.12"), "http-cache-semantics": ("4.2.0", "4.3.0"),
                    "undici": ("6.28.0", "6.29.0"), "ip-address": ("10.5.0", "10.7.1"),
                    "postcss-selector-parser": ("7.1.4", "7.1.6")}
    for name, (old, new) in replacements.items():
        require(package(base, f"package/node_modules/{name}/package.json")["version"] == old, "UNEXPECTED_ORIGINAL_DEPENDENCY")
        require(package(archives[name], "package/package.json")["version"] == new, "UNEXPECTED_REPLACEMENT")
    require(package(base, "package/node_modules/minimatch/package.json")["dependencies"]["brace-expansion"] == "^5.0.5", "INCOMPATIBLE_BRACE_CONSUMER")
    require(package(base, "package/node_modules/make-fetch-happen/package.json")["dependencies"]["http-cache-semantics"] == "^4.1.1", "INCOMPATIBLE_CACHE_CONSUMER")
    require(package(base, "package/node_modules/balanced-match/package.json")["version"] == "4.0.4", "INCOMPATIBLE_BALANCED_MATCH")
    require(package(archives["brace-expansion"], "package/package.json").get("dependencies") == {"balanced-match": "^4.0.2"}, "UNEXPECTED_BRACE_DEPENDENCIES")
    require(not package(archives["http-cache-semantics"], "package/package.json").get("dependencies"), "UNEXPECTED_CACHE_DEPENDENCIES")
    for consumer, dependency, expected in [("node-gyp", "undici", "^6.25.0"), ("socks", "ip-address", "^10.1.1"),
                                           ("@npmcli/query", "postcss-selector-parser", "^7.0.0")]:
        require(package(base, f"package/node_modules/{consumer}/package.json")["dependencies"][dependency] == expected,
                "INCOMPATIBLE_REPLACEMENT_CONSUMER")
    for name in ("undici", "ip-address"):
        require(not package(archives[name], "package/package.json").get("dependencies"), "UNEXPECTED_REPLACEMENT_DEPENDENCIES")
    require(package(archives["postcss-selector-parser"], "package/package.json").get("dependencies")
            == {"cssesc": "^3.0.0", "util-deprecate": "^1.0.2"}, "UNEXPECTED_SELECTOR_DEPENDENCIES")
    for name, version in (("cssesc", "3.0.0"), ("util-deprecate", "1.0.2")):
        require(package(base, f"package/node_modules/{name}/package.json")["version"] == version, "INCOMPATIBLE_SELECTOR_CONSUMER")
    prefixes = tuple(f"package/node_modules/{name}/" for name in replacements)
    files = {name: value for name, value in base.items() if not name.startswith(prefixes)}
    for name in replacements:
        for source, value in archives[name].items():
            relative = source.removeprefix("package/")
            require("node_modules" not in PurePosixPath(relative).parts, "NESTED_REPLACEMENT_DEPENDENCY")
            target = f"package/node_modules/{name}/{relative}"
            require(target not in files, "REPLACEMENT_COLLISION")
            files[target] = value
    for name, value in base.items():
        if not name.startswith(prefixes):
            require(files.get(name) == value, "UNAPPROVED_FILE_CHANGE")
    for module, (_, new) in replacements.items():
        copies = [name for name in files if name.endswith(f"/node_modules/{module}/package.json")]
        require(copies == [f"package/node_modules/{module}/package.json"]
                and package(files, copies[0])["version"] == new, "DUPLICATE_REPLACEMENT")
    raw = io.BytesIO()
    with tarfile.open(fileobj=raw, mode="w", format=tarfile.PAX_FORMAT) as tar:
        for name, (content, mode) in sorted(files.items()):
            info = tarfile.TarInfo(name)
            info.size, info.mode = len(content), mode
            info.mtime = info.uid = info.gid = 0
            info.uname = info.gname = ""
            info.pax_headers = {}
            tar.addfile(info, io.BytesIO(content))
    compressed = io.BytesIO()
    with gzip.GzipFile(fileobj=compressed, filename="", mode="wb", compresslevel=9, mtime=0) as stream:
        stream.write(raw.getvalue())
    artifact = compressed.getvalue()
    require(sha256(node.read_bytes()) == runtime_hash, "RUNTIME_CHANGED_DURING_BUILD")
    require(verify_source_binding(builder, source_sha, preliminary) == source_binding, "SOURCE_CHANGED_DURING_BUILD")
    require(python_provenance() == toolchain, "PYTHON_TOOLCHAIN_CHANGED_DURING_BUILD")
    manifest = {"schemaVersion": 2, "proofKind": "PRELIMINARY_UNQUALIFIED" if preliminary else "QUALIFIED_SOURCE_BOUND_BUILD",
                "distribution": "nexus-npm", "distributionVersion": "11.21.0-security.2",
                "upstreamNpmVersion": "11.21.0", "sourceSha": source_sha, "verifiedInputs": receipt,
                "sourceBinding": source_binding, "builder": toolchain,
                "changes": [{"package": name, "from": old, "to": new} for name, (old, new) in replacements.items()],
                "upstreamFileCount": len(base), "outputFileCount": len(files),
                "output": {"file": "nexus-npm-11.21.0-security.2.tgz", "sha256": sha256(artifact),
                           "uncompressedTarSha256": sha256(raw.getvalue()), "bytes": len(artifact)},
                "files": [{"path": name, "sha256": sha256(content), "mode": oct(mode)}
                          for name, (content, mode) in sorted(files.items())]}
    manifest_bytes = (json.dumps(manifest, sort_keys=True, separators=(",", ":")) + "\n").encode()
    os.mkdir(output, 0o700)
    for name, content in [(manifest["output"]["file"], artifact), ("manifest.json", manifest_bytes)]:
        descriptor = os.open(output / name, os.O_WRONLY | os.O_CREAT | os.O_EXCL | os.O_NOFOLLOW, 0o600)
        with os.fdopen(descriptor, "wb") as stream:
            stream.write(content)
            stream.flush()
            os.fsync(stream.fileno())
    print(json.dumps({"artifactSha256": sha256(artifact), "manifestSha256": sha256(manifest_bytes), "fileCount": len(files)}))


if __name__ == "__main__":
    main()
