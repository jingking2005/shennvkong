# 神女控 数字考古 — 第一阶段交接文档

**交接时间：** 2026-07-24 00:15 CST  
**执行 Agent：** Hermes (DeepSeek-V4-Pro)  
**状态：** ✅ 第一阶段完成

---

## 一句话摘要

完成了《神女控（Valkyrie Crusade）》英文 Fandom Wiki 的全量数据抓取，建立了包含卡牌、技能、活动、分类的完整 JSON/CSV 数据库和 1.72 GB 高清卡图集。

---

## 项目结构

```
/Users/VazeniF/Desktop/神女控/
├── AGENTS.md                         # 项目协议（通用+项目专属指令）
├── CHANGELOG.md                      # 版本记录
├── PROJECT_LOG.md                    # 详细开发日志
├── REPORT.md                         # 第一阶段质量报告
├── pyproject.toml                    # Python 项目配置
├── .venv/                            # 虚拟环境（Python 3.12）
├── src/valkyrie/
│   ├── client.py                     # MediaWiki API 客户端（限速/重试/断点）
│   ├── parser.py                     # Wikitext Infobox 解析器
│   ├── crawler.py                    # 主抓取器（卡牌+图片）
│   ├── crawler_extra.py              # Extra 抓取器（Skills/Events/Categories/Release Log）
│   ├── exporter.py                   # JSON/CSV 导出
│   ├── images.py                     # 图片下载器（白名单过滤）
│   ├── config.py                     # 全局配置
│   └── quality_check.py              # 质量检查
├── tests/
│   ├── test_client.py
│   ├── test_parser.py
│   ├── test_crawler.py
│   └── test_images.py
├── output/                           # 数据输出目录
│   ├── cards.json          (5.1 MB, 3,397 条)
│   ├── cards.csv           (1.2 MB, 3,397 条)
│   ├── skills.json         (34.9 MB, 10,397 条)
│   ├── events.json         (4.0 MB, 338 条)
│   ├── categories.json     (37 KB, 556 条)
│   ├── release_log.json    (149 KB, 24 条)
│   └── checkpoint.json
└── images/                           # 卡图目录 (1.72 GB)
    └── {CardName}/
        ├── {CardName}.png            # 基础卡面
        ├── {CardName}_H.png          # 进化版
        └── {CardName}_X.png          # 觉醒版
```

---

## 数据概览

| 数据 | 数量 | 成功率 |
|------|------|--------|
| 卡牌 | 3,397 | 97.1% |
| 图片 | 8,118 | 99.0% |
| Skills | 10,397 | 100% |
| Events | 338 | 100% |
| Categories | 556 | 100% |
| Release Log | 24 | 100% |

---

## 关键技术决策

1. **图片过滤：白名单模式** — 只下载文件名包含卡牌名的图片，排除 logo/banner/进化材料
2. **Skills 抓取：递归遍历** — Wiki 的 Skills 是 115 个子分类的层级结构，采用流式遍历+early-stop
3. **限速：1.5s/请求** — 避免触发 Fandom 429 限制
4. **断点续传：** checkpoint.json 记录进度，中断可恢复
5. **双格式导出：** JSON（程序消费）+ CSV（Excel/Pandas 分析）

---

## 已知问题

- 103 个页面解析失败（重定向页/消歧义页）
- 82 张图片下载失败（可二次重试）
- 部分文件名含特殊字符（如单引号 `★`），已用下划线替代
- Git 提交均在 main 分支，未按协议切 feature 分支（已记录，下一阶段修正）
- 项目复用了一个已有 Git 仓库，历史中存在其他项目（V2 游戏）的 commit

---

## 下一阶段（第二阶段）

按 AGENTS.md 规划：
- **APK 解析** — 提取原始资源和数据表
- **音频提取** — BGM/SE
- **UI 提取** — 界面素材
- **战斗配置** — 数值公式和参数
- **活动数据** — 限时活动脚本

---

**给接手 Agent 的话：**

- 先读 `AGENTS.md`（含通用协议+项目专属指令），了解完整规约
- 数据都在 `output/` 目录，卡图在 `images/`
- Python 环境：`source .venv/bin/activate`
- 测试：`pytest -q`（47/47 通过）
- 数据源 Wiki：`https://valkyrie-crusade.fandom.com/wiki/`
- 遇问题先看 `PROJECT_LOG.md` 了解决策背景
