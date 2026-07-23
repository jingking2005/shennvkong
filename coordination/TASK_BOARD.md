# 任务看板

> 更新时间：2026-07-23 18:00（最终状态）

## Hermes 负责（数据考古）

| # | 任务 | 状态 | 依赖 | 涉及文件 |
|:---|:---|:---|:---|:---|
| T1 | 全量抓取 + 质检 | IN_PROGRESS | - | output/, images/, src/valkyrie/ |
| T2 | 失败项补抓 | TODO | T1 | output/, src/valkyrie/crawler.py |
| T3-full | 完整数据清洗 | BLOCKED | T2 | game/data/normalized/ |

## 游戏开发（千问3.8 已完成 → 待下一 Agent 继续）

| # | 任务 | 状态 | 依赖 | 涉及文件 |
|:---|:---|:---|:---|:---|
| T3-schema | 标准数据 Schema | **DONE** | - | game/src/data/schema/types.ts |
| T3-mock | Mock 数据（12张卡） | **DONE** | T3-schema | game/src/data/fixtures/mock-cards.json |
| T3-cleaner | 数据清洗器 | **DONE** | T3-schema | game/src/data/pipeline/ |
| T4 | Phaser 3 初始化 | **DONE** | - | game/ |
| T5 | 数据适配层 | **DONE** | T3-schema, T4 | game/src/data/skills.ts |
| T6 | 编队界面（文字版） | **DONE** | T5 | game/src/scenes/TeamScene.ts |
| T7 | 战斗引擎核心 | **DONE** | T5 | game/src/systems/ |
| T8 | 战斗 UI（文字日志版） | **DONE** | T7 | game/src/scenes/BattleScene.ts |
| T9 | 敌人/关卡配置 | TODO | T7 | game/src/data/ |
| T10 | 结算+存档循环 | **DONE**（基础版） | T8 | game/src/scenes/ResultScene.ts |

## 下一步待做（新 Agent 接手）

| # | 任务 | 优先级 | 说明 |
|:---|:---|:---|:---|
| N1 | 战斗动画 polish | 高 | Tween 攻击动画、HP 条、伤害飘字 |
| N2 | 卡图渲染 | 高 | 用真实卡图替换文字列表 |
| N3 | 关卡系统 | 中 | 5 个难度递增关卡 + 选关界面 |
| N4 | 真实数据接入 | 中 | Hermes 完成后 normalize → runtime |
| N5 | 卡牌图鉴 | 中 | 全卡浏览、筛选、详情 |
| N6 | 强化/进化系统 | 低 | 卡牌养成 |
| N7 | 抽卡/Gacha | 低 | 召唤系统 |
| N8 | 音效/BGM | 低 | 战斗音效、背景音乐 |

## 状态说明

- TODO: 未开始
- IN_PROGRESS: 进行中
- BLOCKED: 被阻塞
- **DONE**: 已完成
- NEEDS_REVIEW: 待审查
