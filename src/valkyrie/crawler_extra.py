"""Crawl Skills, Events, Categories, and Release Log from Valkyrie Crusade Wiki."""

import json
import logging
import time
from pathlib import Path

from valkyrie.client import WikiClient
from valkyrie.config import WIKI_BASE, OUTPUT_DIR, REQUEST_DELAY

logger = logging.getLogger(__name__)


def crawl_pages(client: WikiClient, titles: list[str], label: str = "") -> list[dict]:
    """Fetch page data for a list of titles."""
    results = []
    total = len(titles)
    for i, title in enumerate(titles, 1):
        logger.info("[%d/%d] %s: %s", i, total, label or "Fetching", title)
        try:
            data = client.parse_page(title)
            if not data:
                logger.warning("No data for: %s", title)
                continue
            entry = {
                "title": data.get("title", title),
                "url": f"{WIKI_BASE}/wiki/{title.replace(' ', '_')}",
                "wikitext": data.get("wikitext", {}).get("*", "") if isinstance(data.get("wikitext"), dict) else "",
                "categories": [c.get("*", c) if isinstance(c, dict) else c for c in data.get("categories", [])],
                "images": [img.get("title", "").replace("File:", "") if isinstance(img, dict) else img for img in data.get("images", [])],
            }
            results.append(entry)
        except Exception as e:
            logger.error("Failed to fetch %s: %s", title, e)
        time.sleep(REQUEST_DELAY)

    return results


def get_subcategory_pages(client: WikiClient, category: str) -> list[str]:
    """Recursively get all page titles from a category and its subcategories."""
    all_pages = []

    # Get direct pages
    page_members = client.get_category_members(category, cmtype="page")
    all_pages.extend(m["title"] for m in page_members)

    # Get subcategories and recurse
    subcat_members = client.get_category_members(category, cmtype="subcat")
    for subcat in subcat_members:
        subcat_name = subcat["title"]
        if subcat_name.startswith("Category:"):
            subcat_name = subcat_name[len("Category:"):]
        logger.info("  Entering subcategory: %s", subcat_name)
        sub_pages = get_subcategory_pages(client, subcat_name)
        all_pages.extend(sub_pages)

    return all_pages


def crawl_skills(client: WikiClient, limit: int = 0) -> list[dict]:
    """Crawl skill pages by iterating subcategories (streaming, with early stop)."""
    logger.info("=== Crawling Skills (streaming) ===")
    results = []
    count = 0

    # Get subcategories of Skills
    subcat_members = client.get_category_members("Skills", cmtype="subcat")
    logger.info("Found %d skill subcategories", len(subcat_members))

    for subcat in subcat_members:
        if limit > 0 and count >= limit:
            break
        subcat_name = subcat["title"]
        if subcat_name.startswith("Category:"):
            subcat_name = subcat_name[len("Category:"):]

        # Get pages in this subcategory
        page_members = client.get_category_members(subcat_name, cmtype="page")
        if not page_members:
            continue

        titles = [m["title"] for m in page_members]
        if limit > 0:
            remaining = limit - count
            titles = titles[:remaining]

        logger.info("  %s: %d pages", subcat_name, len(titles))
        batch = crawl_pages(client, titles, "Skill")
        results.extend(batch)
        count += len(batch)

    logger.info("Total skills crawled: %d", len(results))
    return results


def crawl_events(client: WikiClient, limit: int = 0) -> list[dict]:
    """Crawl all event pages."""
    logger.info("=== Crawling Events ===")
    members = client.get_category_members("Event", cmtype="page")
    titles = [m["title"] for m in members]
    if limit > 0:
        titles = titles[:limit]
    logger.info("Found %d event pages", len(titles))
    return crawl_pages(client, titles, "Event")


def crawl_categories(client: WikiClient, limit: int = 0) -> list[dict]:
    """List all wiki categories with their member counts."""
    logger.info("=== Crawling Category Index ===")
    all_cats = client.get_all_categories()
    if limit > 0:
        all_cats = all_cats[:limit]
    # Just store category names as an index
    results = [{"title": cat, "type": "category"} for cat in all_cats]
    logger.info("Found %d categories", len(results))
    return results


def crawl_release_log(client: WikiClient, limit: int = 0) -> list[dict]:
    """Crawl Release Log pages."""
    logger.info("=== Crawling Release Log ===")
    members = client.get_category_members("Card Releases", cmtype="page")
    titles = [m["title"] for m in members]
    if limit > 0:
        titles = titles[:limit]
    logger.info("Found %d release log pages", len(titles))
    return crawl_pages(client, titles, "ReleaseLog")


def export_extra(results: dict, output_dir: Path):
    """Export extra data to JSON files."""
    output_dir.mkdir(parents=True, exist_ok=True)
    for name, data in results.items():
        path = output_dir / f"{name}.json"
        with open(path, "w", encoding="utf-8") as f:
            json.dump(data, f, ensure_ascii=False, indent=2)
        logger.info("Exported %d %s to %s", len(data), name, path)


def main():
    import argparse
    parser = argparse.ArgumentParser(description="Crawl Skills/Events/Categories/Release Log")
    parser.add_argument("--limit", type=int, default=0, help="Max pages per category (0=all)")
    parser.add_argument("--test", action="store_true", help="Test mode (3 pages each)")
    args = parser.parse_args()

    logging.basicConfig(level=logging.INFO, format="%(asctime)s [%(levelname)s] %(name)s: %(message)s")

    limit = 3 if args.test else args.limit
    output = OUTPUT_DIR / "output-test" if args.test else OUTPUT_DIR

    client = WikiClient(output_dir=output)

    results = {}
    results["skills"] = crawl_skills(client, limit)
    results["events"] = crawl_events(client, limit)
    results["categories"] = crawl_categories(client, limit)
    results["release_log"] = crawl_release_log(client, limit)

    export_extra(results, output)

    total = sum(len(v) for v in results.values())
    logger.info("=== EXTRA CRAWL COMPLETE: %d total pages ===", total)


if __name__ == "__main__":
    main()
