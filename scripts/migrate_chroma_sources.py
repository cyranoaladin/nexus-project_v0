#!/usr/bin/env python3
"""Migrate ChromaDB source metadata paths from flat to subfolder structure.

Old: /data/uploads/nexus-pedagogique/programme_eds_maths_terminale.pdf
New: /data/uploads/nexus-pedagogique/maths/programme_eds_maths_terminale.pdf
"""
import chromadb

CHROMA_HOST = "chroma"
CHROMA_PORT = 8000
COLLECTION = "ressources_pedagogiques_terminale"

# Mapping: old source path -> new source path
MIGRATIONS = {
    "/data/uploads/nexus-pedagogique/programme_eds_maths_terminale.pdf": "/data/uploads/nexus-pedagogique/maths/programme_eds_maths_terminale.pdf",
    "/data/uploads/nexus-pedagogique/programme_eds_maths_premiere.pdf": "/data/uploads/nexus-pedagogique/maths/programme_eds_maths_premiere.pdf",
    "/data/uploads/nexus-pedagogique/competences_maths_terminale.md": "/data/uploads/nexus-pedagogique/maths/competences_maths_terminale.md",
    "/data/uploads/nexus-pedagogique/competences_maths_premiere.md": "/data/uploads/nexus-pedagogique/maths/competences_maths_premiere.md",
    "/data/uploads/nexus-pedagogique/programme_eds_nsi_terminale.pdf": "/data/uploads/nexus-pedagogique/nsi/programme_eds_nsi_terminale.pdf",
    "/data/uploads/nexus-pedagogique/programme_eds_nsi_premiere.pdf": "/data/uploads/nexus-pedagogique/nsi/programme_eds_nsi_premiere.pdf",
    "/data/uploads/nexus-pedagogique/competences_nsi_terminale.md": "/data/uploads/nexus-pedagogique/nsi/competences_nsi_terminale.md",
    "/data/uploads/nexus-pedagogique/competences_nsi_premiere.md": "/data/uploads/nexus-pedagogique/nsi/competences_nsi_premiere.md",
}


def main():
    client = chromadb.HttpClient(host=CHROMA_HOST, port=CHROMA_PORT)
    coll = client.get_collection(COLLECTION)
    print(f"Collection: {COLLECTION} ({coll.count()} chunks)")

    all_data = coll.get(include=["metadatas"])
    ids = all_data["ids"]
    metas = all_data["metadatas"]

    updates_by_source = {}
    for i, (doc_id, meta) in enumerate(zip(ids, metas)):
        source = meta.get("source", "")
        if source in MIGRATIONS:
            new_source = MIGRATIONS[source]
            if new_source not in updates_by_source:
                updates_by_source[new_source] = {"ids": [], "old": source}
            updates_by_source[new_source]["ids"].append((doc_id, meta))

    total_updated = 0
    for new_source, info in updates_by_source.items():
        chunk_ids = []
        new_metas = []
        for doc_id, meta in info["ids"]:
            updated_meta = dict(meta)
            updated_meta["source"] = new_source
            chunk_ids.append(doc_id)
            new_metas.append(updated_meta)

        coll.update(ids=chunk_ids, metadatas=new_metas)
        count = len(chunk_ids)
        total_updated += count
        print(f"  MIGRATED {count:3d} chunks: {info['old']}")
        print(f"        -> {new_source}")

    print(f"\nDONE: {total_updated}/{len(ids)} chunks updated")

    # Verify
    print("\n=== VERIFICATION ===")
    stats = coll.get(include=["metadatas"])
    sources = {}
    for meta in stats["metadatas"]:
        s = meta.get("source", "unknown")
        sources[s] = sources.get(s, 0) + 1
    for src, count in sorted(sources.items()):
        print(f"  {src}: {count} chunks")


if __name__ == "__main__":
    main()
