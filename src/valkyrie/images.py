"""Image downloader with filtering, dedup, and resume support."""

import hashlib
import logging
import re
import time
from pathlib import Path
from typing import Optional

import requests

from .config import (
    IMAGE_EXCLUDE_PATTERNS,
    USER_AGENT,
    REQUEST_DELAY,
    MAX_RETRIES,
    RETRY_BACKOFF,
)

logger = logging.getLogger(__name__)


def is_card_image(filename: str) -> bool:
    """Determine if a filename is a card image (not icon/UI/element badge)."""
    # Exclude patterns
    for pattern in IMAGE_EXCLUDE_PATTERNS:
        if pattern in filename:
            return False

    # Must be an image file
    if not any(filename.lower().endswith(ext) for ext in [".png", ".jpg", ".webp"]):
        return False

    return True


def sanitize_dirname(name: str) -> str:
    """Sanitize a card name for use as directory name."""
    # Replace problematic chars
    name = re.sub(r'[<>:"/\\|?*]', "_", name)
    name = name.strip(". ")
    return name or "unknown"


class ImageDownloader:
    """Download card images with filtering and resume."""

    def __init__(self, images_dir: Path, session: Optional[requests.Session] = None):
        self.images_dir = images_dir
        self.images_dir.mkdir(parents=True, exist_ok=True)
        self.session = session or requests.Session()
        self.session.headers.update({"User-Agent": USER_AGENT})
        self._last_request_time = 0.0
        self.downloaded = set()
        self.failed = []
        self.skipped = []

    def _rate_limit(self):
        elapsed = time.time() - self._last_request_time
        if elapsed < REQUEST_DELAY:
            time.sleep(REQUEST_DELAY - elapsed)

    def download_image(
        self,
        url: str,
        card_name: str,
        filename: str,
    ) -> Optional[Path]:
        """Download a single image to images/<card_name>/<filename>."""
        card_dir = self.images_dir / sanitize_dirname(card_name)
        card_dir.mkdir(parents=True, exist_ok=True)
        dest = card_dir / filename

        # Skip if already downloaded
        if dest.exists() and dest.stat().st_size > 0:
            self.downloaded.add(str(dest))
            return dest

        for attempt in range(1, MAX_RETRIES + 1):
            try:
                self._rate_limit()
                resp = self.session.get(url, timeout=60, stream=True)
                self._last_request_time = time.time()

                if resp.status_code == 200:
                    dest.write_bytes(resp.content)
                    self.downloaded.add(str(dest))
                    logger.info("Downloaded: %s (%d bytes)", dest, len(resp.content))
                    return dest
                elif resp.status_code in (403, 429):
                    wait = RETRY_BACKOFF * (2 ** (attempt - 1))
                    logger.warning(
                        "HTTP %d for %s, waiting %ds (attempt %d/%d)",
                        resp.status_code, filename, wait, attempt, MAX_RETRIES,
                    )
                    time.sleep(wait)
                else:
                    logger.warning(
                        "HTTP %d for %s (attempt %d/%d)",
                        resp.status_code, filename, attempt, MAX_RETRIES,
                    )
            except requests.exceptions.RequestException as exc:
                logger.warning("Download error for %s: %s", filename, exc)
                if attempt < MAX_RETRIES:
                    time.sleep(RETRY_BACKOFF)

        self.failed.append({"filename": filename, "url": url})
        return None

    def download_card_images(
        self,
        card_name: str,
        image_filenames: list[str],
        url_resolver,
    ) -> dict:
        """Download all valid images for a card.

        Args:
            card_name: Card name for directory
            image_filenames: List of filenames from wiki
            url_resolver: Callable(filename) -> url

        Returns:
            dict with downloaded/skipped/failed counts
        """
        result = {"downloaded": 0, "skipped": 0, "failed": 0}

        for fname in image_filenames:
            if not is_card_image(fname):
                self.skipped.append(fname)
                result["skipped"] += 1
                continue

            url = url_resolver(fname)
            if not url:
                self.failed.append({"filename": fname, "url": None})
                result["failed"] += 1
                continue

            dest = self.download_image(url, card_name, fname)
            if dest:
                result["downloaded"] += 1
            else:
                result["failed"] += 1

        return result

    def get_stats(self) -> dict:
        """Get download statistics."""
        total_size = sum(
            f.stat().st_size for f in self.images_dir.rglob("*") if f.is_file()
        )
        return {
            "downloaded": len(self.downloaded),
            "failed": len(self.failed),
            "skipped": len(self.skipped),
            "total_size_mb": round(total_size / (1024 * 1024), 2),
        }
