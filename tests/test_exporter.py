"""Tests for JSON/CSV export."""

import csv
import json
from pathlib import Path

import pytest
from valkyrie.exporter import export_json, export_csv


SAMPLE_CARDS = [
    {
        "title": "Amaterasu",
        "url": "https://valkyriecrusade.fandom.com/wiki/Amaterasu",
        "element": "Passion",
        "rarity": "SR",
        "skill_name": "Sun Scepter",
        "skill_lv1": "A single ally's ATK 300% up",
        "skill_lv1_cost": "90",
        "skill_lv10_cost": "85",
        "procs": "Infinite",
        "description": "Sun goddess.",
        "stats_base": {"cost": "47", "atk": "4000 / 6400", "def": "3900 / 6240"},
        "stats_evolved": {"cost": "56", "atk": "4400 / 8960", "def": "4290 / 8736"},
        "stats_god": {"cost": "62", "atk": "5280 / 10468", "def": "5148 / 10209"},
        "categories": ["ATK Up (Single)", "Limited SR"],
    },
    {
        "title": "Tsukuyomi",
        "url": "https://valkyriecrusade.fandom.com/wiki/Tsukuyomi",
        "element": "Cool",
        "rarity": "R",
        "skill_name": "Moon Blade",
        "skill_lv1": "Enemy ATK 10% down",
        "skill_lv1_cost": "50",
        "skill_lv10_cost": "45",
        "procs": "3",
        "description": "Moon goddess.",
        "stats_base": {"cost": "12", "atk": "1200", "def": "1100"},
        "categories": ["ATK Down (All)"],
    },
]


@pytest.fixture
def tmp_output(tmp_path):
    return tmp_path


class TestExportJson:
    def test_creates_file(self, tmp_output):
        path = export_json(SAMPLE_CARDS, tmp_output / "cards.json")
        assert path.exists()

    def test_valid_json(self, tmp_output):
        path = export_json(SAMPLE_CARDS, tmp_output / "cards.json")
        data = json.loads(path.read_text(encoding="utf-8"))
        assert len(data) == 2

    def test_unicode_preserved(self, tmp_output):
        path = export_json(SAMPLE_CARDS, tmp_output / "cards.json")
        text = path.read_text(encoding="utf-8")
        assert "\\u" not in text  # Should be readable unicode

    def test_empty_list(self, tmp_output):
        path = export_json([], tmp_output / "empty.json")
        data = json.loads(path.read_text())
        assert data == []


class TestExportCsv:
    def test_creates_file(self, tmp_output):
        path = export_csv(SAMPLE_CARDS, tmp_output / "cards.csv")
        assert path.exists()

    def test_correct_row_count(self, tmp_output):
        path = export_csv(SAMPLE_CARDS, tmp_output / "cards.csv")
        with open(path, encoding="utf-8") as f:
            reader = csv.DictReader(f)
            rows = list(reader)
        assert len(rows) == 2

    def test_flattened_stats(self, tmp_output):
        path = export_csv(SAMPLE_CARDS, tmp_output / "cards.csv")
        with open(path, encoding="utf-8") as f:
            reader = csv.DictReader(f)
            row = next(reader)
        assert row["cost_base"] == "47"
        assert row["atk_god"] == "5280 / 10468"

    def test_categories_joined(self, tmp_output):
        path = export_csv(SAMPLE_CARDS, tmp_output / "cards.csv")
        with open(path, encoding="utf-8") as f:
            reader = csv.DictReader(f)
            row = next(reader)
        assert "ATK Up (Single)" in row["categories"]
        assert ";" in row["categories"]
