"""Computed, allow-listed comparisons between positioning CPS generations."""

from __future__ import annotations

from collections import Counter
from pathlib import Path
from typing import Any

import yaml


def _objects_by_id(
    objects: list[dict[str, Any]],
    path: str,
    unexpected_paths: list[str],
) -> dict[str, dict[str, Any]]:
    result: dict[str, dict[str, Any]] = {}
    for item in objects:
        identifier = item.get("id")
        if not isinstance(identifier, str) or identifier in result:
            unexpected_paths.append(f"{path}.duplicate-or-missing-id")
            continue
        result[identifier] = item
    return result


def compute_v3_diffs(
    source_root: Path,
    *,
    v2_package: str,
    v3_package: str,
) -> dict[str, Any]:
    """Compare all v2 CPS with v3 and reject every undocumented category."""

    v2_root = source_root / v2_package
    v3_root = source_root / v3_package
    modules: list[dict[str, Any]] = []
    total_counts: Counter[str] = Counter()
    all_unexpected: list[str] = []
    v2_names = sorted(path.name for path in v2_root.glob("*.yaml"))

    for name in v2_names:
        old = yaml.safe_load((v2_root / name).read_text(encoding="utf-8"))
        candidate_path = v3_root / name
        unexpected: list[str] = []
        counts: Counter[str] = Counter()
        if not candidate_path.is_file():
            unexpected.append(f"{name}:candidate-missing")
            new: dict[str, Any] = {}
        else:
            new = yaml.safe_load(candidate_path.read_text(encoding="utf-8"))

        for key in sorted(set(old) | set(new)):
            path = f"{name}:root.{key}"
            if key == "statutValidation":
                if (
                    key not in old
                    and new.get(key) == "HUMAN_VALIDATION_REQUIRED"
                ):
                    counts["status_added"] += 1
                elif old.get(key) != new.get(key):
                    unexpected.append(path)
            elif key != "noeuds" and old.get(key) != new.get(key):
                unexpected.append(path)

        old_nodes_list = old.get("noeuds") or []
        new_nodes_list = new.get("noeuds") or []
        if [node.get("id") for node in old_nodes_list] != [
            node.get("id") for node in new_nodes_list
        ]:
            unexpected.append(f"{name}:noeuds.order")
        old_nodes = _objects_by_id(old_nodes_list, f"{name}:noeuds", unexpected)
        new_nodes = _objects_by_id(new_nodes_list, f"{name}:noeuds", unexpected)
        if set(old_nodes) != set(new_nodes):
            unexpected.append(f"{name}:noeuds.ids")

        for node_id in sorted(set(old_nodes) & set(new_nodes)):
            old_node = old_nodes[node_id]
            new_node = new_nodes[node_id]
            for key in sorted(set(old_node) | set(new_node)):
                if key != "items" and old_node.get(key) != new_node.get(key):
                    unexpected.append(f"{name}:{node_id}.{key}")
            old_items_list = old_node.get("items") or []
            new_items_list = new_node.get("items") or []
            if [item.get("id") for item in old_items_list] != [
                item.get("id") for item in new_items_list
            ]:
                unexpected.append(f"{name}:{node_id}.items.order")
            old_items = _objects_by_id(
                old_items_list, f"{name}:{node_id}.items", unexpected
            )
            new_items = _objects_by_id(
                new_items_list, f"{name}:{node_id}.items", unexpected
            )
            if set(old_items) != set(new_items):
                unexpected.append(f"{name}:{node_id}.items.ids")

            for item_id in sorted(set(old_items) & set(new_items)):
                old_item = old_items[item_id]
                new_item = new_items[item_id]
                for key in sorted(set(old_item) | set(new_item)):
                    if key not in {"palier", "propositions"} and (
                        old_item.get(key) != new_item.get(key)
                    ):
                        unexpected.append(f"{name}:{item_id}.{key}")
                if old_item.get("palier") != new_item.get("palier"):
                    if (
                        name == "maths-entree-troisieme.yaml"
                        and item_id == "n10-i1"
                        and old_item.get("palier") == "B"
                        and new_item.get("palier") == "A"
                    ):
                        counts["palier_n10_i1_corrected"] += 1
                    else:
                        unexpected.append(f"{name}:{item_id}.palier")

                old_propositions = old_item.get("propositions")
                new_propositions = new_item.get("propositions")
                if old_propositions is None or new_propositions is None:
                    if old_propositions != new_propositions:
                        unexpected.append(f"{name}:{item_id}.propositions")
                    continue
                old_texts = [
                    proposition.get("texte") for proposition in old_propositions
                ]
                new_texts = [
                    proposition.get("texte") for proposition in new_propositions
                ]
                if old_texts != new_texts:
                    counts["proposition_order_changed"] += 1
                old_by_text = {
                    proposition.get("texte"): proposition
                    for proposition in old_propositions
                }
                new_by_text = {
                    proposition.get("texte"): proposition
                    for proposition in new_propositions
                }
                if (
                    len(old_by_text) != len(old_propositions)
                    or len(new_by_text) != len(new_propositions)
                    or set(old_by_text) != set(new_by_text)
                ):
                    unexpected.append(f"{name}:{item_id}.proposition-texts")
                    continue
                for text in sorted(old_by_text):
                    old_proposition = old_by_text[text]
                    new_proposition = new_by_text[text]
                    for key in sorted(set(old_proposition) | set(new_proposition)):
                        path = f"{name}:{item_id}.proposition[{text}].{key}"
                        if key == "obstacleVise":
                            if old_proposition.get(key) != new_proposition.get(key):
                                if (
                                    key not in old_proposition
                                    and isinstance(new_proposition.get(key), int)
                                ):
                                    counts["obstacle_vise_added"] += 1
                                else:
                                    unexpected.append(path)
                        elif old_proposition.get(key) != new_proposition.get(key):
                            unexpected.append(path)

        unexpected = sorted(set(unexpected))
        total_counts.update(counts)
        all_unexpected.extend(unexpected)
        modules.append(
            {
                "module": name.removesuffix(".yaml"),
                "source": f"{v2_package}/{name}",
                "candidate": f"{v3_package}/{name}",
                "computed": True,
                "allowed_change_counts": dict(sorted(counts.items())),
                "unexpected_change_count": len(unexpected),
                "unexpected_paths": unexpected,
            }
        )

    return {
        "computed": True,
        "module_count": len(modules),
        "allowed_change_counts": dict(sorted(total_counts.items())),
        "unexpected_change_count": len(set(all_unexpected)),
        "unexpected_paths": sorted(set(all_unexpected)),
        "modules": modules,
    }
