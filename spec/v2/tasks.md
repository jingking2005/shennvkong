# 神女控 V2 — 任务分解

## Phase 0：当前原型审计 ✅

- [x] 审计报告：docs/audits/current-prototype-audit.md
- [x] 定位可保留/需重构模块

## Phase 1：玩法 V2 策划冻结 ✅

- [x] spec/v2/ 全部 15 个策划文件
- [x] 等待项目负责人审阅

## Phase 2：数据模型和技能引擎

> 架构参考：OpenDuelyst EventBus + SabberStone Onion层 + Fireplace 事件队列

| # | 任务 | 依赖 | 修改文件 | 验收 | 预估 |
|:---|:---|:---|:---|:---|:---|
| 2.1 | Seeded RNG | - | game/src/v2/systems/rng.ts | 确定性测试 | 0.5h |
| 2.2 | EventBus | - | game/src/v2/systems/event-bus.ts | 订阅/发布/优先级测试 | 1h |
| 2.3 | ActionQueue | 2.2 | game/src/v2/systems/action-queue.ts | validate→execute→cleanup 流水线测试 | 1.5h |
| 2.4 | V2 TypeScript 类型定义 | P1 | game/src/v2/data/types.ts | typecheck 通过 | 2h |
| 2.5 | 配置化 JSON 加载器 | 2.4 | game/src/v2/data/config-loader.ts | 单元测试 | 1h |
| 2.6 | SkillResolver | 2.4,2.1 | game/src/v2/systems/skill-resolver.ts | 24技能全覆盖测试 | 3h |
| 2.7 | EffectResolver | 2.6 | game/src/v2/systems/effect-resolver.ts | 30+效果类型测试 | 3h |
| 2.8 | StatusEngine | 2.7 | game/src/v2/systems/status-engine.ts | 状态叠加/过期/洋葱层测试 | 2h |

## Phase 3：战斗系统重构

| # | 任务 | 依赖 | 修改文件 | 验收 | 预估 |
|:---|:---|:---|:---|:---|:---|
| 3.1 | V2 BattleEngine（回合制+位置+状态机） | P2 | src/systems/battle-engine-v2.ts | 手动/自动双模式测试 | 4h |
| 3.2 | DamageCalculator V2 | 3.1 | src/systems/damage-calc-v2.ts | 公式验证测试 | 2h |
| 3.3 | HealCalculator | 3.1 | src/systems/heal-calc.ts | 治疗/禁疗测试 | 1h |
| 3.4 | TargetSelector | 3.1 | src/systems/target-selector.ts | 12种目标类型测试 | 2h |
| 3.5 | 战斗 UI（手动选目标+技能释放） | 3.1 | src/scenes/battle-scene-v2.ts | 可玩 | 4h |
| 3.6 | 自动战斗 AI | 3.1 | src/systems/battle-ai.ts | 自动通关测试 | 2h |

## Phase 4：16 张 Mock 卡及技能

| # | 任务 | 依赖 | 修改文件 | 验收 | 预估 |
|:---|:---|:---|:---|:---|:---|
| 4.1 | 16 张卡 JSON 数据 | P2 | data/fixtures/v2-mock-cards.json | Schema 校验通过 | 2h |
| 4.2 | 24+ 技能 JSON 数据 | P2 | data/fixtures/v2-mock-skills.json | 效果解析通过 | 3h |
| 4.3 | Unit Bonus 配置 | 4.1 | data/fixtures/v2-unit-bonuses.json | 4+羁绊触发 | 1h |

## Phase 5：队伍和 Unit Bonus

| # | 任务 | 依赖 | 修改文件 | 验收 | 预估 |
|:---|:---|:---|:---|:---|:---|
| 5.1 | 队伍编辑器（5位置+Cost+羁绊） | P4 | src/scenes/team-editor-v2.ts | 可编队+实时预览 | 3h |
| 5.2 | UnitBonus 计算器 | 4.3 | src/systems/unit-bonus.ts | 羁绊激活测试 | 1h |

## Phase 6：卡牌升级、技能升级和进化

| # | 任务 | 依赖 | 修改文件 | 验收 | 预估 |
|:---|:---|:---|:---|:---|:---|
| 6.1 | 等级升级系统 | P2 | src/systems/level-up.ts | 升级+属性成长测试 | 2h |
| 6.2 | 技能升级系统 | P2 | src/systems/skill-level-up.ts | 倍率提升测试 | 1h |
| 6.3 | 进化系统 | P2 | src/systems/evolution.ts | 形态变化+属性提升测试 | 2h |
| 6.4 | 养成 UI 场景 | 6.1-6.3 | src/scenes/card-detail-v2.ts | 可操作 | 3h |

## Phase 7：FIFA 式合卡强化

| # | 任务 | 依赖 | 修改文件 | 验收 | 预估 |
|:---|:---|:---|:---|:---|:---|
| 7.1 | Enhancement 引擎 | P2,2.3 | src/systems/enhancement.ts | 10万模拟测试 | 3h |
| 7.2 | 强化 UI | 7.1 | src/scenes/enhancement-scene.ts | 可操作+概率显示 | 2h |

## Phase 8：经济与抽卡

| # | 任务 | 依赖 | 修改文件 | 验收 | 预估 |
|:---|:---|:---|:---|:---|:---|
| 8.1 | 经济管理器 | P2 | src/systems/economy.ts | 资源增减测试 | 2h |
| 8.2 | 抽卡引擎 | 8.1,2.3 | src/systems/gacha.ts | 保底+概率测试 | 3h |
| 8.3 | 抽卡 UI + 动画 | 8.2 | src/scenes/gacha-scene.ts | 十连可操作 | 3h |

## Phase 9：王国系统

| # | 任务 | 依赖 | 修改文件 | 验收 | 预估 |
|:---|:---|:---|:---|:---|:---|
| 9.1 | 建筑数据+产出逻辑 | P2 | src/systems/kingdom.ts | 产出计算测试 | 2h |
| 9.2 | 王国 UI | 9.1 | src/scenes/kingdom-scene.ts | 可建造+收取 | 3h |

## Phase 10：美术和 UI 重构

| # | 任务 | 依赖 | 修改文件 | 验收 | 预估 |
|:---|:---|:---|:---|:---|:---|
| 10.1 | 卡框系统（7种稀有度） | - | src/ui/card-frame.ts | 视觉区分 | 2h |
| 10.2 | 战斗特效分层 | P3 | src/ui/battle-vfx.ts | 技能动画区分 | 3h |
| 10.3 | 全局 UI 主题 | - | src/ui/theme.ts | 无空白页 | 2h |

## Phase 11：完整垂直切片

| # | 任务 | 依赖 | 验收 | 预估 |
|:---|:---|:---|:---|:---|
| 11.1 | 三波剧情关卡 | P3-P8 | 可通关 | 2h |
| 11.2 | Archwitch Boss | P3 | 可挑战 | 2h |
| 11.3 | 主流程串联 | ALL | 20分钟闭环 | 3h |
| 11.4 | 存档+读档 | ALL | 重启恢复 | 1h |

## Phase 12：真实卡牌数据导入

| # | 任务 | 依赖 | 验收 | 预估 |
|:---|:---|:---|:---|:---|
| 12.1 | Hermes 数据适配 V2 Schema | P2 | 3000+卡导入 | 3h |
| 12.2 | 卡图关联 | 12.1 | 图片正确显示 | 2h |
