"""Configuration constants for the Valkyrie Crusade archiver."""

import os
from pathlib import Path

# --- Paths ---
PROJECT_ROOT = Path(__file__).resolve().parent.parent.parent
OUTPUT_DIR = PROJECT_ROOT / "output"
OUTPUT_TEST_DIR = PROJECT_ROOT / "output-test"
IMAGES_DIR = PROJECT_ROOT / "images"

# --- Wiki API ---
WIKI_BASE = "https://valkyriecrusade.fandom.com"
API_ENDPOINT = f"{WIKI_BASE}/api.php"

# --- Rate limiting ---
REQUEST_DELAY = 1.5  # seconds between requests
MAX_RETRIES = 3
RETRY_BACKOFF = 5  # seconds base for exponential backoff

# --- HTTP ---
USER_AGENT = (
    "Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) "
    "ValkyrieCrusadeArchiver/1.0 (Digital preservation project)"
)

# --- Image filtering ---
# Patterns to EXCLUDE from card image downloads
IMAGE_EXCLUDE_PATTERNS = [
    "_icon",
    "Icon_",
    "Passion.png",
    "Cool.png",
    "Light.png",
    "Dark.png",
    "SR.png",
    "R.png",
    "N.png",
    "HN.png",
    "HR.png",
    "SSR.png",
    "UR.png",
    "LR.png",
    "GSR.png",
    "HSR.png",
    "GR.png",
    "Passion_G.png",
    "Cool_G.png",
    "Light_G.png",
    "Dark_G.png",
    "_Orb.png",
    "_Stone_",
    "Logo",
    "Button",
    "Banner",
    "Navigation",
    "Skill_Icon",
    "Wiki",
    "Fandom",
]

# Card image name patterns to INCLUDE (whitelist approach for card art)
# Card images typically: CardName.png, CardName_H.png (awakened), CardName_G.png (evolved)
CARD_IMAGE_SUFFIXES = [
    ".png",
    ".jpg",
    ".webp",
]

# --- Checkpoint ---
CHECKPOINT_FILE = "checkpoint.json"
