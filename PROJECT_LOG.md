# 项目日志 — 神女控 数字考古

## 2026-07-23

### 15:00 — 项目启动
- 创建项目目录 `/Users/VazeniF/Desktop/神女控/`
- 建立 Python 虚拟环境（Python 3.12），安装 requests/pytest 依赖
- 初始化 Git 仓库

### 15:30 — 核心模块开发
- `client.py`: MediaWiki API 客户端，支持限速（1.5s）、重试（3次指数退避）、断点续传
- `parser.py`: Wikitext Infobox 解析，提取卡牌名/稀有度/属性/技能/图片
- `images.py`: 卡图下载器，白名单过滤（按卡牌名匹配），排除进化材料/图标/UI
- `crawler.py`: 全量卡牌抓取，从 Category:Cards 获取 3500 张卡列表
- `exporter.py`: JSON + CSV 双格式导出
- `crawler_extra.py`: Skills/Events/Categories/Release Log 抓取
- `quality_check.py`: 质量检查 + REPORT.md 自动生成

### 16:00 — 测试验证
- 47 项单元测试全部通过
- 小批量测试（5张卡）：数据解析正确，图片过滤有效
- 修复 wiki 链接嵌套方括号解析问题
- 修复图片过滤器（进化材料图混入问题）

### 16:05 — 全量抓取启动
- 主抓取（Cards + Images）: 3500 张卡，预计 ~6 小时
- Extra 抓取（Skills/Events/Release Log）: 后台运行中
- 两个进程均支持断点续传

### 当前状态
- ✅ 主抓取完成: 3,397 张卡，8,118 张图片（1.72 GB）
- ✅ Extra 抓取完成: 10,397 Skills + 338 Events + 556 Categories + 24 Release Log
- ✅ REPORT.md 已生成
- 总耗时: ~9 小时（16:00 - 00:15 CST）

### 2026-07-24 00:15 — 第一阶段完成 🎉
- 主抓取全量完成，3,397/3,500 有效卡牌（97.1%成功率）
- 图片 8,118 张（99.0%成功率），总大小 1.72 GB
- Skills 10,397 条，Events 338 场，Categories 556 个，Release Log 24 期
- 全部导出文件就位: cards.json/csv, skills.json, events.json, categories.json, release_log.json

### 技术决策
1. **图片过滤策略**: 从黑名单改为白名单（文件名必须包含卡牌名），有效排除进化材料
2. **Skills 抓取**: Wiki 的 Skills 分类是层级结构（115个子分类），采用流式遍历+early-stop
3. **限速策略**: 1.5秒/请求，避免触发 Fandom 429 限制
4. **断点续传**: checkpoint.json 记录已处理卡牌索引，中断后可恢复

### 已知问题
- 部分卡牌名含特殊字符（如 `Abori's Headdress`），目录名用下划线替代
- `Goddess_Crystal_Shard_(Allero).png` 类文件通过白名单但非标准卡图，暂保留
