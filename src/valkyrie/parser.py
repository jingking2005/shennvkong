"""Parser for Valkyrie Crusade card wikitext ({{Card ...}} template)."""

import re
import logging
from typing import Optional

logger = logging.getLogger(__name__)


def parse_card_template(wikitext: str) -> Optional[dict]:
    """Parse a {{Card ...}} template from wikitext into a structured dict."""
    # Check if this is a card page
    if "{{Card" not in wikitext:
        return None

    card = {}

    # Extract all key=value pairs from the template
    # Template format: {{Card\n|key = value\n|key2 = value2\n}}
    template_match = re.search(r"\{\{Card\s*\n(.*?)\}\}", wikitext, re.DOTALL)
    if not template_match:
        # Try without newline
        template_match = re.search(r"\{\{Card(.*?)\}\}", wikitext, re.DOTALL)
        if not template_match:
            return None

    body = template_match.group(1)

    # Parse each |key = value line
    for match in re.finditer(r"\|(\w[\w\s]*?)\s*=\s*(.*?)(?=\n\||\Z)", body, re.DOTALL):
        key = match.group(1).strip()
        value = match.group(2).strip()
        # Clean up HTML tags
        value = re.sub(r"<br\s*/?>", " ", value)
        value = re.sub(r"<[^>]+>", "", value)
        # Handle wiki links: [[Target|Display]] -> Display, [[Target]] -> Target
        # Display text may contain single brackets like [Limited SR]
        value = re.sub(r"\[\[([^|\]]*)(?:\|(.*?))?\]\]", lambda m: (m.group(2) or m.group(1)), value)
        card[key] = value

    if not card:
        return None

    # Normalize into structured format
    return normalize_card(card)


def normalize_card(raw: dict) -> dict:
    """Normalize raw template fields into a clean card dict."""
    card = {
        "element": raw.get("element", ""),
        "rarity": raw.get("rarity", ""),
        "skill_name": raw.get("skill", ""),
        "skill_lv1": raw.get("skill lv1", ""),
        "skill_lv1_cost": raw.get("skill lv1 cost", ""),
        "skill_lv10_cost": raw.get("skill lv10 cost", ""),
        "procs": raw.get("procs", ""),
        "skill_g_name": raw.get("skill g", ""),
        "skill_g_lv1": raw.get("skill g lv1", ""),
        "skill_g_lv1_cost": raw.get("skill g lv1 cost", ""),
        "skill_g_lv10_cost": raw.get("skill g lv10 cost", ""),
        "procs_g": raw.get("procs g", ""),
        "description": raw.get("description", ""),
        "friendship": raw.get("friendship", ""),
        "login": raw.get("login", ""),
        "meet": raw.get("meet", ""),
        "battle_start": raw.get("battle start", ""),
        "battle_end": raw.get("battle end", ""),
        "friendship_max": raw.get("friendship max", ""),
        "friendship_event": raw.get("friendship event", ""),
        "awaken_chance": raw.get("awaken chance", ""),
        "awaken_orb": raw.get("awaken orb", ""),
        "awaken_l": raw.get("awaken l", ""),
        "awaken_m": raw.get("awaken m", ""),
        "awaken_s": raw.get("awaken s", ""),
        "availability": raw.get("availability", ""),
        "friendship_points": raw.get("friendship points", ""),
    }

    # Parse stats for base (0), evolved (1), and god (g) forms
    for suffix, label in [("0", "base"), ("1", "evolved"), ("g", "god")]:
        stats = {}
        for stat_key in ["cost", "atk", "def", "soldiers", "medals", "gold"]:
            raw_key = f"{stat_key} {suffix}"
            if raw_key in raw:
                stats[stat_key] = raw[raw_key]
        if stats:
            card[f"stats_{label}"] = stats

    return card


def is_card_page(wikitext: str) -> bool:
    """Check if a wikitext contains a Card template."""
    return "{{Card" in wikitext


def extract_categories(parse_data: dict) -> list[str]:
    """Extract category names from parse API response."""
    return [
        cat["*"].replace("_", " ")
        for cat in parse_data.get("categories", [])
        if "hidden" not in cat
    ]


def extract_images(parse_data: dict) -> list[str]:
    """Extract image filenames from parse API response."""
    return parse_data.get("images", [])
