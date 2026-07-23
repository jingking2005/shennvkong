"""Quality check and report generation for the Valkyrie Crusade archive."""

import json
import logging
from collections import Counter
from pathlib import Path
from datetime import datetime

from valkyrie.config import OUTPUT_DIR, IMAGES_DIR

logger = logging.getLogger(__name__)


def load_json(path: Path) -> list | dict:
    if path.exists():
        return json.loads(path.read_text(encoding="utf-8"))
    return []


def check_cards(cards: list) -> dict:
    """Analyze card data quality."""
    total = len(cards)
    if total == 0:
        return {"total": 0, "note": "No cards found"}

    rarity_dist = Counter(c.get("rarity", "unknown") for c in cards)
    element_dist = Counter(c.get("element", "unknown") for c in cards)
    has_skill = sum(1 for c in cards if c.get("skill_name"))
    has_images = sum(1 for c in cards if c.get("images"))
    total_images = sum(len(c.get("images", [])) for c in cards)
    empty_wikitext = sum(1 for c in cards if not c.get("wikitext", "").strip())

    return {
        "total": total,
        "rarity_distribution": dict(rarity_dist.most_common()),
        "element_distribution": dict(element_dist.most_common()),
        "with_skill": has_skill,
        "with_images": has_images,
        "total_image_refs": total_images,
        "empty_wikitext": empty_wikitext,
    }


def check_images() -> dict:
    """Check downloaded image files."""
    if not IMAGES_DIR.exists():
        return {"total_files": 0, "note": "Images directory not found"}

    files = list(IMAGES_DIR.rglob("*"))
    image_files = [f for f in files if f.is_file() and f.suffix.lower() in (".png", ".jpg", ".webp")]
    dirs = [d for d in files if d.is_dir()]

    total_size = sum(f.stat().st_size for f in image_files)
    zero_size = [f for f in image_files if f.stat().st_size == 0]

    return {
        "total_files": len(image_files),
        "total_dirs": len(dirs),
        "total_size_mb": round(total_size / (1024 * 1024), 1),
        "zero_size_files": len(zero_size),
        "zero_size_list": [str(f.relative_to(IMAGES_DIR)) for f in zero_size[:10]],
    }


def check_extra(name: str) -> dict:
    """Check extra data (skills, events, etc.)."""
    path = OUTPUT_DIR / f"{name}.json"
    data = load_json(path)
    if isinstance(data, list):
        return {"total": len(data), "sample_titles": [d.get("title", "?") for d in data[:5]]}
    return {"total": 0}


def generate_report(output_dir: Path = OUTPUT_DIR):
    """Generate a full quality report as REPORT.md."""
    now = datetime.now().strftime("%Y-%m-%d %H:%M:%S")

    cards = load_json(output_dir / "cards.json")
    errors = load_json(output_dir / "errors.json") if (output_dir / "errors.json").exists() else []

    card_check = check_cards(cards)
    img_check = check_images()
    skill_check = check_extra("skills")
    event_check = check_extra("events")
    category_check = check_extra("categories")
    release_check = check_extra("release_log")

    report = f"""# 📋 神女控 数字考古 — 质量报告

> 生成时间: {now}

## 🃏 卡牌数据

| 指标 | 数值 |
|------|------|
| 总卡牌数 | {card_check.get('total', 0)} |
| 含技能信息 | {card_check.get('with_skill', 0)} |
| 含图片引用 | {card_check.get('with_images', 0)} |
| 图片引用总数 | {card_check.get('total_image_refs', 0)} |
| 空wikitext | {card_check.get('empty_wikitext', 0)} |
| 抓取错误数 | {len(errors)} |

### 稀有度分布

| 稀有度 | 数量 |
|--------|------|
"""
    for rarity, count in sorted(card_check.get("rarity_distribution", {}).items()):
        report += f"| {rarity} | {count} |\n"

    report += f"""
### 属性分布

| 属性 | 数量 |
|------|------|
"""
    for element, count in sorted(card_check.get("element_distribution", {}).items()):
        report += f"| {element} | {count} |\n"

    report += f"""
## 🖼️ 图片资源

| 指标 | 数值 |
|------|------|
| 图片文件数 | {img_check.get('total_files', 0)} |
| 文件夹数 | {img_check.get('total_dirs', 0)} |
| 总大小 | {img_check.get('total_size_mb', 0)} MB |
| 零字节文件 | {img_check.get('zero_size_files', 0)} |

## ⚔️ 技能数据

- 总数: {skill_check.get('total', 0)}
- 示例: {', '.join(skill_check.get('sample_titles', []))}

## 🎪 活动数据

- 总数: {event_check.get('total', 0)}
- 示例: {', '.join(event_check.get('sample_titles', []))}

## 📂 分类索引

- 总数: {category_check.get('total', 0)}

## 📅 发布日志

- 总数: {release_check.get('total', 0)}
- 示例: {', '.join(release_check.get('sample_titles', []))}

## ❌ 错误记录

- 总错误数: {len(errors)}
"""
    if errors:
        report += "\n| 卡牌 | 错误 |\n|------|------|\n"
        for err in errors[:20]:
            if isinstance(err, dict):
                report += f"| {err.get('title', '?')} | {err.get('error', '?')} |\n"
            else:
                report += f"| - | {err} |\n"

    # Write report
    report_path = output_dir / "REPORT.md"
    report_path.write_text(report, encoding="utf-8")
    logger.info("Report written to %s", report_path)
    return report_path


if __name__ == "__main__":
    logging.basicConfig(level=logging.INFO)
    path = generate_report()
    print(f"Report: {path}")
