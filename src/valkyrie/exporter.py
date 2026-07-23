"""Export card data to JSON and CSV."""

import csv
import json
import logging
from pathlib import Path

logger = logging.getLogger(__name__)

# Fields for CSV export (flatten nested stats)
CSV_FIELDS = [
    "title", "url", "element", "rarity",
    "skill_name", "skill_lv1", "skill_lv1_cost", "skill_lv10_cost", "procs",
    "skill_g_name", "skill_g_lv1", "skill_g_lv1_cost", "skill_g_lv10_cost", "procs_g",
    "cost_base", "atk_base", "def_base",
    "cost_evolved", "atk_evolved", "def_evolved",
    "cost_god", "atk_god", "def_god",
    "description", "availability",
    "awaken_chance", "awaken_orb",
    "categories",
]


def export_json(cards: list[dict], output_path: Path) -> Path:
    """Export cards to JSON file."""
    output_path.parent.mkdir(parents=True, exist_ok=True)
    output_path.write_text(
        json.dumps(cards, ensure_ascii=False, indent=2),
        encoding="utf-8",
    )
    logger.info("Exported %d cards to %s", len(cards), output_path)
    return output_path


def export_csv(cards: list[dict], output_path: Path) -> Path:
    """Export cards to CSV file."""
    output_path.parent.mkdir(parents=True, exist_ok=True)

    with open(output_path, "w", newline="", encoding="utf-8") as f:
        writer = csv.DictWriter(f, fieldnames=CSV_FIELDS, extrasaction="ignore")
        writer.writeheader()

        for card in cards:
            row = dict(card)
            # Flatten stats
            for suffix, label in [("base", "base"), ("evolved", "evolved"), ("god", "god")]:
                stats = card.get(f"stats_{suffix}", {})
                for stat_key in ["cost", "atk", "def"]:
                    row[f"{stat_key}_{label}"] = stats.get(stat_key, "")
            # Join categories list
            if isinstance(row.get("categories"), list):
                row["categories"] = "; ".join(row["categories"])
            writer.writerow(row)

    logger.info("Exported %d cards to %s", len(cards), output_path)
    return output_path
