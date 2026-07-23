# 开源卡牌项目研究报告

> 研究时间：2026-07-23
> 目的：为神女控 V2 战斗引擎和技能系统提供架构参考

---

## 一、OpenDuelyst（3.9k stars，CC0 协议）

### 架构核心

- **语言**：CoffeeScript + Node.js（服务端）+ 浏览器客户端
- **战斗与画面完全分离**：`app/common/` 是纯逻辑引擎，`app/view/` 是渲染层
- **EventBus 驱动**：270+ 种事件类型，覆盖战斗全生命周期
- **Action Queue 模式**：
  ```
  modify_action_for_validation → validate_action → [invalid_action]
  → before_added_action_to_queue → added_action_to_queue
  → modify_action_for_execution → overwatch → before_action
  → action → after_action → cleanup_action → after_cleanup_action
  ```
- **Modifier/Aura 系统**：
  - `modifier_active_change` — 修改器激活/失活
  - `modifier_add_aura` / `modifier_remove_aura` — 光环添加/移除
  - `modifier_end_turn_duration_change` — 回合末持续时间更新
- **Snapshot/Rollback**：支持战斗回滚和回放
- **Step 执行模型**：`start_step → step → after_step`（每步=一个原子状态变更）
- **卡牌定义与实例分离**：`data/` 目录存模板，运行时创建实例

### 借鉴点

| 借鉴 | 用于 V2 |
|:---|:---|
| Action Queue 验证→执行→清理 流水线 | BattleEngine 核心循环 |
| Modifier/Aura 生命周期管理 | StatusEffect 系统 |
| Snapshot/Rollback | 战斗回放 + AI 模拟 |
| EventBus 解耦逻辑和渲染 | Phaser 场景只订阅事件 |
| Step 原子执行模型 | 每个技能/攻击=一个 Step |

### 不能复制

- CoffeeScript 语法（我们用 TypeScript）
- Firebase/网络层（我们是单机）
- 棋盘格子玩法（我们是 5 位置队伍）

---

## 二、Godot Card Game Framework（AGPL3）

### 架构核心

- **Scripting Engine**：卡牌能力用纯文本字典定义，支持：
  - 任意棋盘操作触发
  - 基于卡牌属性的过滤条件
  - 可选能力/多选能力
  - 运行时根据棋盘状态计算效果强度
  - 执行中请求玩家输入
  - Tag 标记 + 跨脚本过滤
  - 脚本间结果传递
- **数据驱动**：卡牌定义为标准字典，可分 set 管理
- **目标系统**：拖拽箭头选目标
- **Deck Builder**：内置卡组编辑器

### 借鉴点

| 借鉴 | 用于 V2 |
|:---|:---|
| 字典式技能定义（纯数据） | SkillDefinition JSON 格式 |
| 触发+过滤+条件 三层判定 | TriggerResolver 设计 |
| 运行时状态计算效果强度 | EffectResolver 动态数值 |
| Tag 标记系统 | combatTags 过滤 |
| 脚本间结果传递 | 技能链/连携 |

### 不能复制

- Godot/GDScript 代码（我们用 Phaser/TypeScript）
- 拖拽交互模型（我们是点击选目标）

---

## 三、SabberStone（炉石模拟器，C#，AGPL3）

### 架构核心

- **Onion System（洋葱层）**：处理实体上的多层 Enchantment 叠加
- **98% 卡牌实现率**：证明其架构能覆盖几乎所有卡牌效果
- **核心模块**：
  - `Entities/` — 游戏实体（英雄/随从/法术）
  - `Enchants/` — Buff/Debuff/Aura 层叠系统
  - `Tasks/` — 效果执行任务链
  - `Triggers/` — 事件触发器
  - `Controllers/` — 玩家控制器（含 AI）
- **Aura 系统**：持续效果自动管理生命周期
- **每张卡一个单元测试**：1400+ 测试用例

### 借鉴点

| 借鉴 | 用于 V2 |
|:---|:---|
| Onion Layer 多层 Enchantment | 多 Buff 叠加计算顺序 |
| Task Chain 效果执行链 | EffectResolver 链式执行 |
| Trigger 事件触发器模式 | 被动/反击/濒死触发 |
| 每卡一个测试的模式 | V2 技能测试策略 |
| Aura 自动生命周期 | 持续效果到期自动移除 |

### 不能复制

- C# 代码
- 炉石特有机制（法力水晶/武器/英雄技能）

---

## 四、Fireplace（炉石模拟器，Python，AGPL3）

### 架构核心

- **100% 卡牌实现**（2000+ 张卡全覆盖）
- **事件队列**：所有游戏行为通过事件队列串行处理
- **伤害/死亡结算**：独立的结算阶段，防止连锁中断
- **目标筛选器**：声明式目标选择（RandomEnemyDamagedMinions 等）
- **战斗模拟**：可无 UI 运行完整对局
- **自动化测试**：每张卡有对应测试

### 借鉴点

| 借鉴 | 用于 V2 |
|:---|:---|
| 事件队列串行处理 | 防止效果连锁中的状态不一致 |
| 独立死亡结算阶段 | 多杀时正确处理复活/亡语 |
| 声明式目标筛选 | TargetSelector 配置化 |
| 无 UI 战斗模拟 | 平衡测试 + AI 训练 |
| Python 简洁性 | 参考其 API 设计风格 |

### 不能复制

- Python 代码
- 炉石特有规则

---

## 五、神女控专用工具

### PoH98/Valkyrie-Crusade-HD-Card-Farming

- **卡图 URL 格式**：`https://d2n1d3zrlbtx8o.cloudfront.net/download/CardHD.zip/{cardId}.{uploadTime}`
- **cardId 为数字**：与 Fandom Wiki 页面名不同
- **thumb 目录**：`/sdcard/Android/data/com.nubee.valkyriecrusade/card/thumb/`
- **v2 版直接爬 Fandom Wiki**（我们 Hermes 已在做）

### PoH98/Valkyrie-Crusade-Bot

- C# 挂机工具，含 Decrypt/ImageProcessor/ImgXml 模块
- 证实游戏资源有加密/编码层
- XML 映射文件可能包含 cardId → 图片/技能 对应关系
- **不是游戏源码**，不能直接改造

### Drackzgull/Valkyrie-Crusade-Special-Summon-Simulator

- C++ 抽卡模拟器
- 证实原版特殊召唤有明确的概率公式
- 可用于验证我们的抽卡系统设计

### kushieda-minori/vc-arcana-calc

- 需要进一步检查是否含原版数值公式

---

## 六、综合结论：V2 战斗引擎架构方案

基于四个开源项目的研究，V2 战斗引擎应采用以下架构：

```
┌─────────────────────────────────────────────┐
│  BattleEngine（纯逻辑，无渲染依赖）          │
│                                             │
│  ┌─────────┐  ┌──────────┐  ┌───────────┐  │
│  │ EventBus │  │ ActionQ  │  │ Snapshot  │  │
│  │ (事件总线)│  │ (行动队列)│  │ (快照回滚) │  │
│  └────┬────┘  └────┬─────  └─────┬─────┘  │
│       │            │              │         │
│  ┌────▼────────────▼──────────────▼──────┐  │
│  │         Step Executor                 │  │
│  │  validate → execute → cleanup → emit  │  │
│  └────┬──────────────────────────────────┘  │
│       │                                     │
│  ┌────▼────┐ ┌──────────┐ ┌─────────────┐  │
│  │ Skill   │ │ Effect   │ │ Status      │  │
│  │Resolver │ │Resolver  │ │Engine       │  │
│  │(触发判定)│ │(效果执行) │ │(状态管理)    │  │
│  └─────────┘ └────────── └─────────────┘  │
│       │            │              │         │
│  ┌────▼────────────▼──────────────▼──────┐  │
│  │    DamageCalc / HealCalc / Target     │  │
│  └───────────────────────────────────────┘  │
└─────────────────────────────────────────────┘
         │ 事件订阅
         ▼
┌─────────────────────────────────────────────┐
│  BattleScene（Phaser 渲染层）                │
│  订阅 EventBus → 播放动画/音效/UI更新       │
└─────────────────────────────────────────────┘
```

### 关键设计决策

1. **EventBus 解耦**：BattleEngine 不知道 Phaser 存在，只发事件
2. **Action Queue 验证流水线**：每个行动经过 validate → execute → cleanup
3. **Modifier 层叠**：Buff/Debuff 用洋葱层管理，支持优先级和互斥
4. **独立死亡结算**：所有伤害先结算，再统一处理死亡/复活/亡语
5. **Snapshot 支持**：每回合开始存快照，支持回滚和回放
6. **Seeded RNG**：所有随机通过注入的 RNG 实例，测试时固定种子
7. **无 UI 模拟**：BattleEngine 可在 Node.js 中独立运行，用于平衡测试
