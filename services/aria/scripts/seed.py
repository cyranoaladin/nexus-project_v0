from __future__ import annotations

import json
from pathlib import Path


def main() -> None:
    sample = {"status": "seed placeholder", "students": 0}
    Path("data/seed_result.json").write_text(json.dumps(sample, indent=2), encoding="utf-8")
    print("Seed placeholder executed.")


if __name__ == "__main__":  # pragma: no cover
    main()
