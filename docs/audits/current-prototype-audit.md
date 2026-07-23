# 当前原型审计报告

> 审计时间：2026-07-23
> 审计范围：game/src/ 全部 26 个 TypeScript 文件，共 2553 行
> 审计目的：定位技术占位、硬编码、架构缺陷，为 V2 重构提供依据

---

## 一、当前实现了什么

| 模块 | 文件 | 行数 | 实现程度 |
|:---|:---|:---|:---|
| 战斗引擎 | systems/BattleEngine.ts | 185 | 技术占位 |
| 伤害公式 | systems/DamageCalc.ts | 35 | 硬编码 |
| 技能系统 | systems/SkillSystem.ts | 10 | 几乎为空 |
| 卡牌养成 | systems/CardGrowth.ts | 191 | 基础骨架 |
| 关卡管理 | systems/StageManager.ts | 86 | 线性选关 |
| 战斗场景 | scenes/BattleScene.ts | 230 | 自动播放日志 |
| 编队场景 | scenes/TeamScene.ts | 171 | 网格选卡 |
| 菜单场景 | scenes/MenuScene.ts | 120 | 标题+按钮 |
| 结算场景 | scenes/ResultScene.ts | 85 | 胜负文字 |
| 选关场景 | scenes/StageSelectScene.ts | 88 | 列表选关 |
| 启动场景 | scenes/BootScene.ts | 59 | 加载数据 |
| 数据Schema | data/schema/types.ts | 198 | 基础类型 |
| 技能定义 | data/skills.ts | 18 | 10个硬编码技能 |
| 关卡数据 | data/stages.ts | 61 | 5关硬编码 |
| 卡图映射 | data/card-image-map.ts | 31 | 12条映射 |
| 数据管道 | data/pipeline/*.ts | 300+ | 清洗工具 |
| UI组件 | ui/*.ts (7文件) | 700+ | 渲染组件 |

---

## 二、哪些只是技术占位

### 2.1 战斗系统（致命缺陷）

**文件**：`game/src/systems/BattleEngine.ts`

问题：
- 战斗是全自动的，玩家零交互
- 没有"选择攻击目标"的机制
- 没有技能释放时机选择
- 没有手动/自动切换
- 没有回合内行动顺序选择
- 没有位置系统（前排/后排）
- 没有 Buff/Debuff 状态机
- 没有控制效果（眩晕/沉默/跳过回合）
- 没有治疗逻辑
- 没有护盾逻辑
- 没有多段攻击
- 没有条件触发技能
- 没有被动技能
- 没有 seed 随机数（不可测试/回放）

**结论**：当前 BattleEngine 是一个"自动碰撞模拟器"，不是回合制战斗引擎。需要完全重写。

### 2.2 技能系统（致命缺陷）

**文件**：`game/src/systems/SkillSystem.ts`（仅 10 行）

```typescript
export function rollSkillTrigger(skill: Skill, rng: () => number): boolean {
  return rng() < skill.rate;
}
```

问题：
- 只有一个概率判定函数
- 没有技能效果执行
- 没有目标选择逻辑
- 没有技能类型区分
- 没有冷却/倒计时
- 没有触发条件系统
- 没有被动/主动/自动分类

**结论**：技能系统不存在。需要从零构建 SkillResolver + EffectResolver。

### 2.3 伤害公式（硬编码）

**文件**：`game/src/systems/DamageCalc.ts`

```typescript
const baseDamage = atk * multiplier - def * 0.5;
```

问题：
- 防御减伤是固定 0.5 系数，不是百分比减伤
- 没有暴击系统
- 没有 Buff/Debuff 乘区
- 没有易伤/减伤乘区
- 没有护盾吸收
- 没有随机方差
- 属性克制硬编码 1.3/0.7（应为 1.5/1.5 互相克制）
- 克制关系错误（原版是 Passion↔Cool 互克，Light↔Dark 互克，不是环形）

**结论**：公式需要按 V2 规范重写。

### 2.4 数据模型（不完整）

**文件**：`game/src/data/schema/types.ts`

缺失：
- 没有角色定位（primaryRole/secondaryRole）
- 没有战斗标签（combatTags）
- 没有暴击率/暴击伤害
- 没有命中率/抗性
- 没有治疗力/减伤率
- 没有状态命中/状态抗性
- 没有 CardDefinition vs CardInstance 分离
- 没有 SkillDefinition 完整字段
- 没有 StatusEffectDefinition
- 没有 UnitBonusDefinition
- 没有 SummonBannerDefinition
- 没有 EnhancementConfig
- 没有 BuildingDefinition
- 没有 EconomyConfig

**结论**：Schema 需要按 V2 规范完全重新设计。

---

## 三、哪些代码可以保留

| 模块 | 保留理由 | 需要改动 |
|:---|:---|:---|
| data/pipeline/ | 数据清洗管道与游戏逻辑无关，可继续服务 Hermes 数据导入 | 适配新 Schema |
| ui/BackgroundFX.ts | 氛围背景系统质量合格 | 保留 |
| ui/HealthBar.ts | HP 条组件可复用 | 适配新字段 |
| ui/DamageText.ts | 伤害飘字可复用 | 扩展多类型 |
| scenes/BootScene.ts | 加载流程框架可复用 | 扩展 preload |
| vite.config.ts | 构建配置 + images 中间件 | 保留 |
| card-image-map.ts | 卡图映射可扩展 | 保留+扩展 |

---

## 四、哪些系统需要重构

| 系统 | 当前状态 | V2 要求 | 重构程度 |
|:---|:---|:---|:---|
| BattleEngine | 自动碰撞 | 回合制+手动/自动+位置+状态机 | 完全重写 |
| SkillSystem | 10行概率 | 完整技能引擎+效果解析器 | 完全重写 |
| DamageCalc | 硬编码公式 | 多乘区+配置化+seed | 完全重写 |
| CardGrowth | 基础骨架 | FIFA式+1~+10+进化+觉醒+重生 | 大幅扩展 |
| TeamScene | 网格选卡 | 5位置+Cost+羁绊+定位显示 | 重写 |
| BattleScene | 自动日志播放 | 手动选目标+技能释放+状态显示 | 重写 |
| types.ts | 基础类型 | 完整 V2 数据模型 | 重写 |
| skills.ts | 10个硬编码 | 24+技能数据驱动 | 重写 |
| stages.ts | 5关硬编码 | 三波关卡+Boss+资源关 | 重写 |

---

## 五、当前战斗为什么缺乏策略

1. **零玩家决策**：战斗开始后玩家无法做任何选择
2. **无位置系统**：所有卡牌等价，没有前后排保护
3. **无技能选择**：技能只是概率触发，不是玩家决策
4. **无目标选择**：攻击目标随机，不是玩家选择
5. **无资源管理**：没有能量/倒计时/冷却概念
6. **无队伍构筑反馈**：编队只是选5张卡，没有羁绊/定位/Cost限制
7. **无状态交互**：没有 Buff/Debuff/控制 的策略博弈

---

## 六、当前 UI 为什么显得廉价

1. **卡牌是色块**：虽然接入了真实卡图，但 CardSprite 只有 80x100 像素
2. **无卡框系统**：稀有度没有视觉区分（只有边框颜色）
3. **无立绘展示**：卡牌详情页不存在
4. **战斗无层次感**：上下两排小图，没有前景/背景/特效层
5. **无 Buff 图标**：状态效果不可见
6. **无技能动画区分**：所有攻击共用同一 Tween
7. **编队无信息密度**：看不到定位/羁绊/Cost/属性分布

---

## 七、当前版本与目标版本的差距

| 维度 | 当前 | V2 目标 | 差距 |
|:---|:---|:---|:---|
| 战斗交互 | 0% 玩家控制 | 手动选目标+释放技能 | 100% |
| 技能种类 | 1种(概率伤害) | 30+种效果类型 | 97% |
| 角色定位 | 无 | 8种职业 | 100% |
| 队伍策略 | 无 | 位置+羁绊+Cost | 100% |
| 养成深度 | 强化+进化(基础) | +10强化+觉醒+重生+亲密度 | 70% |
| 经济系统 | 无 | 8种资源+产出消耗表 | 100% |
| 抽卡系统 | 无 | 6种卡池+保底+公示 | 100% |
| 王国系统 | 无 | 12种建筑+资源产出 | 100% |
| 美术表现 | 色块+粒子背景 | 卡框+立绘+特效+层次 | 80% |
| 数据驱动 | 部分硬编码 | 全部 JSON 配置 | 60% |

**总体评估**：当前原型完成了约 15% 的目标功能，且核心战斗系统方向错误，不能作为 V2 的基础继续堆砌。

---

## 八、硬编码清单

| 文件 | 硬编码内容 | 应改为 |
|:---|:---|:---|
| DamageCalc.ts | 克制倍率 1.3/0.7 | 配置化 JSON |
| DamageCalc.ts | 克制关系环形 | 互克关系配置 |
| DamageCalc.ts | def * 0.5 固定系数 | 百分比减伤公式 |
| BattleEngine.ts | MAX_TURNS = 100 | 配置化 |
| CardGrowth.ts | 经验曲线公式 | 配置化 |
| CardGrowth.ts | 满级上限表 | 配置化 |
| CardGrowth.ts | 进化升阶映射 | 配置化 |
| skills.ts | 10个技能写死 | JSON 数据文件 |
| stages.ts | 5关写死 | JSON 数据文件 |
| card-image-map.ts | 12条映射写死 | 自动生成 |
| BattleScene.ts | 布局坐标写死 | 响应式配置 |

---

## 九、与数据层的耦合问题

1. `BattleScene.ts` 直接 import `mock-cards.json`（通过 registry）
2. `BootScene.ts` 硬编码 mock 数据源，无 runtime 数据切换机制
3. `TeamScene.ts` 直接读取 registry 中的 cards 数组，无 CardInstance 概念
4. 战斗引擎直接使用 Card.baseStats，不经过 CardInstance 的等级/强化计算
5. 没有数据版本迁移机制

---

## 十、结论

当前原型是一个**技术验证 Demo**，证明了：
- Phaser 3 + Vite + TypeScript 工程可行
- 真实卡图加载可行
- 基础 UI 组件可复用
- 数据管道可复用

但**不是**一个合格的游戏垂直切片。核心战斗、技能、策略、经济、抽卡、王国系统均不存在或方向错误。

**建议**：保留工程骨架和 UI 组件层，完全重写 systems/ 和 data/schema/，按 V2 策划从零构建。
