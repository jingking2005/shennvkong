"""Main crawler: fetch cards from wiki, download images, export data."""

import argparse
import json
import logging
import sys
from pathlib import Path

from .client import WikiClient
from .config import OUTPUT_DIR, OUTPUT_TEST_DIR, IMAGES_DIR
from .exporter import export_json, export_csv
from .images import ImageDownloader, is_card_image
from .parser import parse_card_template, extract_categories, extract_images

logging.basicConfig(
    level=logging.INFO,
    format="%(asctime)s [%(levelname)s] %(name)s: %(message)s",
)
logger = logging.getLogger("valkyrie.crawler")


def crawl_cards(
    output_dir: Path,
    images_dir: Path,
    limit: int = 0,
    resume: bool = True,
):
    """Main crawl loop: fetch card pages, parse, download images, export.

    Args:
        output_dir: Where to write cards.json / cards.csv
        images_dir: Where to download card images
        limit: Max cards to process (0 = all)
        resume: Whether to resume from checkpoint
    """
    output_dir.mkdir(parents=True, exist_ok=True)
    client = WikiClient(output_dir=output_dir)
    downloader = ImageDownloader(images_dir)

    # --- Step 1: Get card pages from Category:Cards ---
    logger.info("Fetching card page list from Category:Cards...")
    members = client.get_category_members("Cards")
    card_titles = [m["title"] for m in members if m.get("ns") == 0]
    logger.info("Found %d card pages", len(card_titles))

    # Resume support
    done_titles = set()
    cards = []
    if resume:
        existing_json = output_dir / "cards.json"
        if existing_json.exists():
            cards = json.loads(existing_json.read_text(encoding="utf-8"))
            done_titles = {c["title"] for c in cards}
            logger.info("Resumed: %d cards already processed", len(done_titles))

    # Apply limit
    titles_to_process = [t for t in card_titles if t not in done_titles]
    if limit > 0:
        titles_to_process = titles_to_process[:limit]

    logger.info("Processing %d cards...", len(titles_to_process))

    # --- Step 2: Process each card ---
    errors = []
    for i, title in enumerate(titles_to_process, 1):
        logger.info("[%d/%d] Processing: %s", i, len(titles_to_process), title)

        parse_data = client.parse_page(title)
        if not parse_data:
            logger.error("Failed to parse: %s", title)
            errors.append({"title": title, "error": "parse_failed"})
            continue

        wikitext = parse_data.get("wikitext", {}).get("*", "")
        card = parse_card_template(wikitext)
        if not card:
            logger.warning("Not a card page (no Card template): %s", title)
            continue

        # Add metadata
        card["title"] = title
        card["url"] = f"https://valkyriecrusade.fandom.com/wiki/{title.replace(' ', '_')}"
        card["categories"] = extract_categories(parse_data)
        all_images = extract_images(parse_data)
        card["images"] = [img for img in all_images if is_card_image(img, card_name=title)]

        # Download card images
        if card["images"]:
            dl_result = downloader.download_card_images(
                card_name=title,
                image_filenames=card["images"],
                url_resolver=client.get_image_url,
            )
            card["image_stats"] = dl_result
            logger.info(
                "  Images: %d downloaded, %d skipped, %d failed",
                dl_result["downloaded"], dl_result["skipped"], dl_result["failed"],
            )

        cards.append(card)

        # Incremental save every 50 cards
        if i % 50 == 0 or i == len(titles_to_process):
            export_json(cards, output_dir / "cards.json")
            export_csv(cards, output_dir / "cards.csv")
            client.save_checkpoint("last_title", title)
            logger.info("Checkpoint saved at card %d/%d", i, len(titles_to_process))

    # --- Step 3: Final export ---
    export_json(cards, output_dir / "cards.json")
    export_csv(cards, output_dir / "cards.csv")

    # --- Step 4: Stats ---
    img_stats = downloader.get_stats()
    stats = {
        "total_card_pages": len(card_titles),
        "cards_processed": len(cards),
        "errors": len(errors),
        "images": img_stats,
    }
    (output_dir / "stats.json").write_text(
        json.dumps(stats, ensure_ascii=False, indent=2)
    )
    logger.info("=== CRAWL COMPLETE ===")
    logger.info("Cards: %d | Errors: %d | Images: %s", len(cards), len(errors), img_stats)

    return cards, errors


def main():
    parser = argparse.ArgumentParser(description="Valkyrie Crusade Archive Crawler")
    parser.add_argument(
        "--test", action="store_true",
        help="Run in test mode (5 cards, output-test/)",
    )
    parser.add_argument(
        "--limit", type=int, default=0,
        help="Max cards to process (0=all)",
    )
    parser.add_argument(
        "--no-resume", action="store_true",
        help="Disable resume from checkpoint",
    )
    args = parser.parse_args()

    if args.test:
        output = OUTPUT_TEST_DIR
        imgs = OUTPUT_TEST_DIR / "images"
        limit = args.limit or 5
    else:
        output = OUTPUT_DIR
        imgs = IMAGES_DIR
        limit = args.limit

    crawl_cards(
        output_dir=output,
        images_dir=imgs,
        limit=limit,
        resume=not args.no_resume,
    )


if __name__ == "__main__":
    main()
