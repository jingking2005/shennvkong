# 任务看板

> 更新时间：2026-07-23 17:30

## Hermes 负责

| # | 任务 | 状态 | 依赖 | 涉及文件 |
|:---|:---|:---|:---|:---|
| T1 | 全量抓取 + 质检 | IN_PROGRESS | - | output/, images/, src/valkyrie/ |
| T2 | 失败项补抓 | TODO | T1 | output/, src/valkyrie/crawler.py |
| T3-full | 完整数据清洗 | BLOCKED | T2 | output/cards_clean.json |

## 千问3.8 负责

| # | 任务 | 状态 | 依赖 | 涉及文件 |
|:---|:---|:---|:---|:---|
| T3-schema | 标准数据 Schema | IN_PROGRESS | - | game/src/data/schema/ |
| T3-mock | Mock 数据 | IN_PROGRESS | T3-schema | game/src/data/fixtures/ |
| T3-cleaner | 数据清洗器骨架 | TODO | T3-schema | game/src/data/pipeline/ |
| T4 | Phaser 3 初始化 | IN_PROGRESS | - | game/ |
| T5 | 数据适配层 | TODO | T3-schema, T4 | game/src/models/ |
| T6 | 编队界面 | TODO | T5 | game/src/scenes/ |
| T7 | 战斗引擎 | TODO | T5 | game/src/systems/ |
| T8 | 战斗 UI | TODO | T7 | game/src/scenes/ |
| T9 | 敌人/关卡 | TODO | T7 | game/src/data/ |
| T10 | 结算循环 | TODO | T8 | game/src/scenes/ |

## 状态说明

- TODO: 未开始
- IN_PROGRESS: 进行中
- BLOCKED: 被阻塞
- DONE: 已完成
- NEEDS_REVIEW: 待审查
