"""Tests for the Valkyrie Crusade card parser."""

import pytest
from valkyrie.parser import parse_card_template, is_card_page, normalize_card


SAMPLE_WIKITEXT = """{{Card
|element = Passion
|rarity = SR
|skill = Sun Scepter
|skill lv1 = A single ally's ATK 300% up
|skill lv1 cost = 90
|skill lv10 cost = 85
|procs = Infinite
|skill g = ☆Sun Scepter
|skill g lv1 = A single ally's ATK 300% up
|skill g lv1 cost = 85
|skill g lv10 cost = 80
|procs g = Infinite
|cost 0 = 47
|atk 0 = 4000 / 6400
|def 0 = 3900 / 6240
|soldiers 0 = 3750 / 7500
|medals 0 = 2000
|gold 0 = 20000
|cost 1 = 56
|atk 1 = 4400 / 8960
|def 1 = 4290 / 8736
|cost g = 62
|atk g = 5280 / 10468
|def g = 5148 / 10209
|friendship points = 30
|description = Imbued with the sun's power.
|awaken chance = 70
|awaken orb = 1
|awaken l = 5
|awaken m = 10
|awaken s = 15
|availability = [[Valkyrie New Year|[Limited SR] Reward]]
}}

[[Category:ATK Up (Single)]]
[[Category:Limited SR]]
"""

NON_CARD_WIKITEXT = """==Event Details==
This event runs from January 1 to January 15.
"""


class TestIsCardPage:
    def test_card_page_detected(self):
        assert is_card_page(SAMPLE_WIKITEXT) is True

    def test_non_card_page(self):
        assert is_card_page(NON_CARD_WIKITEXT) is False

    def test_empty_string(self):
        assert is_card_page("") is False


class TestParseCardTemplate:
    def test_parse_returns_dict(self):
        result = parse_card_template(SAMPLE_WIKITEXT)
        assert result is not None
        assert isinstance(result, dict)

    def test_element_parsed(self):
        result = parse_card_template(SAMPLE_WIKITEXT)
        assert result["element"] == "Passion"

    def test_rarity_parsed(self):
        result = parse_card_template(SAMPLE_WIKITEXT)
        assert result["rarity"] == "SR"

    def test_skill_name(self):
        result = parse_card_template(SAMPLE_WIKITEXT)
        assert result["skill_name"] == "Sun Scepter"

    def test_skill_description(self):
        result = parse_card_template(SAMPLE_WIKITEXT)
        assert "ATK 300%" in result["skill_lv1"]

    def test_base_stats(self):
        result = parse_card_template(SAMPLE_WIKITEXT)
        assert result["stats_base"]["cost"] == "47"
        assert "4000" in result["stats_base"]["atk"]

    def test_evolved_stats(self):
        result = parse_card_template(SAMPLE_WIKITEXT)
        assert result["stats_evolved"]["cost"] == "56"

    def test_god_stats(self):
        result = parse_card_template(SAMPLE_WIKITEXT)
        assert result["stats_god"]["cost"] == "62"

    def test_description(self):
        result = parse_card_template(SAMPLE_WIKITEXT)
        assert "sun's power" in result["description"]

    def test_awaken_chance(self):
        result = parse_card_template(SAMPLE_WIKITEXT)
        assert result["awaken_chance"] == "70"

    def test_wiki_links_cleaned(self):
        result = parse_card_template(SAMPLE_WIKITEXT)
        # [[Valkyrie New Year|[Limited SR] Reward]] -> [Limited SR] Reward
        assert "[[" not in result["availability"]
        assert "Limited SR" in result["availability"]

    def test_non_card_returns_none(self):
        result = parse_card_template(NON_CARD_WIKITEXT)
        assert result is None

    def test_empty_returns_none(self):
        result = parse_card_template("")
        assert result is None


class TestNormalizeCard:
    def test_missing_fields_default_empty(self):
        raw = {"element": "Cool", "rarity": "R"}
        result = normalize_card(raw)
        assert result["element"] == "Cool"
        assert result["skill_name"] == ""
        assert result["description"] == ""

    def test_stats_grouped(self):
        raw = {"cost 0": "10", "atk 0": "100", "def 0": "80"}
        result = normalize_card(raw)
        assert result["stats_base"]["cost"] == "10"
        assert result["stats_base"]["atk"] == "100"
