# 神女控（Valkyrie Crusade）数字考古与资源归档工程

对已停服手游《神女控 / Valkyrie Crusade》的公开 Wiki 资源进行系统性归档，
包括全部卡牌数据、高清卡图、技能、分类和活动信息。

## 快速开始

```bash
cd /Users/VazeniF/Desktop/神女控
source .venv/bin/activate
pip install -e ".[dev]"

# 测试模式（5 张卡）
python -m valkyrie.crawler --test

# 全量抓取
python -m valkyrie.crawler
```

## 目录结构

```
├── src/valkyrie/       # 核心代码
│   ├── client.py       # Wiki API 客户端（限速/重试/断点）
│   ├── parser.py       # Card 模板解析器
│   ├── images.py       # 卡图下载器（过滤/去重）
│   ├── exporter.py     # JSON/CSV 导出
│   ├── crawler.py      # 主爬虫入口
│   └── config.py       # 配置常量
├── tests/              # pytest 测试
├── output/             # 全量输出
├── output-test/        # 测试输出
├── images/             # 高清卡图
├── cards.json          # 卡牌数据库 (JSON)
├── cards.csv           # 卡牌数据库 (CSV)
└── pyproject.toml
```

## 数据来源

- [Valkyrie Crusade Wiki (Fandom)](https://valkyriecrusade.fandom.com)
- 仅抓取公开可访问的 Wiki 页面与图片

## 功能特性

- ✅ 自动识别 Card 模板页面
- ✅ 解析属性/技能/数值/觉醒/语音等全部字段
- ✅ 高清原图下载（自动过滤图标/徽章/UI）
- ✅ 断点续传 + 失败重试
- ✅ 1.5s 请求限速
- ✅ JSON + CSV 双格式输出
- ✅ 增量保存（每 50 张卡自动 checkpoint）
