# Changelog

## [0.4.0] - 2026-07-24 — 第一阶段完成

### Crawl Results
- 🃏 卡牌：3,397/3,500 有效（97.1%），103 页跳过
- 🖼️ 图片：8,118 张（1.72 GB），82 张失败（99.0%）
- ⚔️ Skills：10,397 条
- 📅 Events：338 场
- 📂 Categories：556 个
- 📋 Release Log：24 期
- 总耗时：~9 小时（16:00 - 00:15）

### Added
- `REPORT.md`: 第一阶段质量报告

## [0.3.0] - 2026-07-23
### Added
- `crawler_extra.py`: Skills/Events/Categories/Release Log 抓取器
- Skills 递归遍历 115 个子分类（流式处理，支持 early-stop）
- Events 从 `Category:Event` 获取（348 页）
- Release Log 从 `Category:Card Releases` 获取（24 页）
- Categories 索引（556 个分类）
- `quality_check.py`: 质量检查 + REPORT.md 生成

### Fixed
- 图片过滤器改为白名单模式（按卡牌名匹配），过滤进化材料图
- Wiki 链接清洗正则支持嵌套方括号 `[Limited SR]`

## [0.2.0] - 2026-07-23
### Added
- `crawler.py`: 全量卡牌抓取器（断点续传 + 限速）
- `images.py`: 卡图下载器（按卡牌名分目录）
- `exporter.py`: JSON/CSV 导出
- `parser.py`: Wikitext 解析器（Infobox 提取）
- 小批量测试验证通过（5 张卡，42 项测试全过）

## [0.1.0] - 2026-07-23
### Added
- 项目初始化：目录结构、虚拟环境、依赖
- `client.py`: MediaWiki API 客户端（限速、重试、断点）
- `config.py`: 全局配置
- 47 项单元测试全通过
