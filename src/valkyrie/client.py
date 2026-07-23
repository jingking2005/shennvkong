"""Wiki API client with rate limiting, retries, and checkpoint support."""

import json
import time
import logging
from pathlib import Path
from typing import Optional

import requests

from .config import (
    API_ENDPOINT,
    USER_AGENT,
    REQUEST_DELAY,
    MAX_RETRIES,
    RETRY_BACKOFF,
    CHECKPOINT_FILE,
)

logger = logging.getLogger(__name__)


class WikiClient:
    """MediaWiki API client for Valkyrie Crusade Wiki."""

    def __init__(self, output_dir: Optional[Path] = None):
        self.session = requests.Session()
        self.session.headers.update({"User-Agent": USER_AGENT})
        self.output_dir = output_dir
        self._last_request_time = 0.0
        self._checkpoint_path = (
            output_dir / CHECKPOINT_FILE if output_dir else None
        )

    def _rate_limit(self):
        """Enforce minimum delay between requests."""
        elapsed = time.time() - self._last_request_time
        if elapsed < REQUEST_DELAY:
            time.sleep(REQUEST_DELAY - elapsed)

    def api_request(self, params: dict) -> Optional[dict]:
        """Make a rate-limited API request with retries."""
        params.setdefault("format", "json")
        self._rate_limit()

        for attempt in range(1, MAX_RETRIES + 1):
            try:
                resp = self.session.get(API_ENDPOINT, params=params, timeout=30)
                self._last_request_time = time.time()

                if resp.status_code == 200:
                    return resp.json()
                elif resp.status_code in (429, 503):
                    wait = RETRY_BACKOFF * (2 ** (attempt - 1))
                    logger.warning(
                        "Rate limited (%d), waiting %ds (attempt %d/%d)",
                        resp.status_code, wait, attempt, MAX_RETRIES,
                    )
                    time.sleep(wait)
                else:
                    logger.warning(
                        "HTTP %d for %s (attempt %d/%d)",
                        resp.status_code, params.get("page", "?"),
                        attempt, MAX_RETRIES,
                    )
                    if attempt < MAX_RETRIES:
                        time.sleep(RETRY_BACKOFF)
            except requests.exceptions.RequestException as exc:
                logger.warning(
                    "Request error: %s (attempt %d/%d)",
                    exc, attempt, MAX_RETRIES,
                )
                if attempt < MAX_RETRIES:
                    time.sleep(RETRY_BACKOFF)

        return None

    def get_all_pages(self, namespace: int = 0, prefix: str = "") -> list[dict]:
        """Fetch all pages in a namespace via continuation."""
        pages = []
        params = {
            "action": "query",
            "list": "allpages",
            "apnamespace": namespace,
            "aplimit": 500,
        }
        if prefix:
            params["apprefix"] = prefix

        while True:
            data = self.api_request(params)
            if not data:
                break
            batch = data.get("query", {}).get("allpages", [])
            pages.extend(batch)
            logger.info("Fetched %d pages (total: %d)", len(batch), len(pages))

            cont = data.get("continue")
            if cont and "apcontinue" in cont:
                params["apcontinue"] = cont["apcontinue"]
            else:
                break

        return pages

    def get_all_categories(self) -> list[str]:
        """Fetch all category names."""
        categories = []
        params = {
            "action": "query",
            "list": "allcategories",
            "aclimit": 500,
        }

        while True:
            data = self.api_request(params)
            if not data:
                break
            batch = data.get("query", {}).get("allcategories", [])
            categories.extend(cat["*"] for cat in batch)

            cont = data.get("continue")
            if cont and "accontinue" in cont:
                params["accontinue"] = cont["accontinue"]
            else:
                break

        return categories

    def parse_page(self, title: str) -> Optional[dict]:
        """Parse a wiki page, returning wikitext, images, and categories."""
        data = self.api_request({
            "action": "parse",
            "page": title,
            "prop": "wikitext|images|categories",
        })
        if not data or "parse" not in data:
            return None
        return data["parse"]

    def get_image_url(self, filename: str) -> Optional[str]:
        """Get the original resolution URL for a file."""
        data = self.api_request({
            "action": "query",
            "titles": f"File:{filename}",
            "prop": "imageinfo",
            "iiprop": "url|size",
            "format": "json",
        })
        if not data:
            return None
        pages = data.get("query", {}).get("pages", {})
        for page in pages.values():
            info = page.get("imageinfo", [{}])
            if info:
                return info[0].get("url")
        return None

    def get_category_members(self, category: str, cmtype: str = "page") -> list[dict]:
        """Get all members of a category."""
        members = []
        params = {
            "action": "query",
            "list": "categorymembers",
            "cmtitle": f"Category:{category}",
            "cmtype": cmtype,
            "cmlimit": 500,
        }

        while True:
            data = self.api_request(params)
            if not data:
                break
            batch = data.get("query", {}).get("categorymembers", [])
            members.extend(batch)

            cont = data.get("continue")
            if cont and "cmcontinue" in cont:
                params["cmcontinue"] = cont["cmcontinue"]
            else:
                break

        return members

    def save_checkpoint(self, key: str, value):
        """Save checkpoint data for resume support."""
        if not self._checkpoint_path:
            return
        cp = {}
        if self._checkpoint_path.exists():
            cp = json.loads(self._checkpoint_path.read_text())
        cp[key] = value
        self._checkpoint_path.write_text(json.dumps(cp, ensure_ascii=False))

    def load_checkpoint(self, key: str):
        """Load checkpoint data."""
        if not self._checkpoint_path or not self._checkpoint_path.exists():
            return None
        cp = json.loads(self._checkpoint_path.read_text())
        return cp.get(key)
