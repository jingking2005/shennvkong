# 交接给下一个游戏开发 Agent

> 更新时间：2026-07-23 18:00
> 来自：千问3.8（本轮游戏工程负责人）
> 目的：新窗口 Agent 阅读本文件后，可立即接手继续开发

---

## 一、项目概况

- **项目名**：神女控（Valkyrie Crusade）Web 复刻
- **路径**：`/Users/VazeniF/Desktop/神女控`
- **定位**：复刻已停服手游的 Web 浏览器卡牌战斗游戏
- **技术栈**：Phaser 3 + TypeScript + Vite + Vitest
- **游戏目录**：`game/`（所有游戏代码在此）
- **规范文件**：`AGENTS.md`（必读，含开发 Protocol）

---

## 二、必读文件清单（按顺序）

```
1. AGENTS.md                    — 开发规范（Protocol + 项目指令）
2. coordination/HANDOFF_NEXT.md — 本文件
3. coordination/TASK_BOARD.md   — 任务看板（最新状态）
4. coordination/DECISIONS.md    — 技术决策记录
5. spec/requirements.md         — 需求文档
6. spec/design.md               — 设计文档
7. spec/tasks.md                — 任务分解（T1-T10 + 并行化调整）
8. game/README.md               — 游戏工程使用说明
```

---

## 三、已完成的工作

### 基础设施
- [x] spec 三件套（requirements/design/tasks）
- [x] coordination/ 多 Agent 协作机制
- [x] .gitignore 完善（忽略 output/、images/、node_modules）

### 数据层
- [x] **标准 Schema**：`game/src/data/schema/types.ts`（175 行，Card/Skill/BattleUnit/SaveData 等 17 个类型）
- [x] **Mock 数据**：`game/src/data/fixtures/mock-cards.json`（12 张卡，4 属性 × 3 稀有度）
- [x] **技能定义**：`game/src/data/skills.ts`（10 个技能）
- [x] **数据清洗管道**：`game/src/data/pipeline/`
  - `validate.ts` — Schema 校验器
  - `normalize.ts` — 原始数据标准化（已适配 Hermes 实际格式）
  - `report.ts` — 统计报告生成
- [x] **标准化数据**：`game/data/normalized/cards.json`（323 张，从 800 条原始记录提取）

### 游戏核心
- [x] **战斗引擎**：`game/src/systems/`
  - `BattleEngine.ts` — 回合制自动战斗（速度排序、行动循环、胜负判定）
  - `DamageCalc.ts` — 伤害公式 + 四属性环形克制（Passion>Cool>Light>Dark>Passion，1.3/0.7 倍率）
  - `SkillSystem.ts` — 技能概率触发
- [x] **Phaser 场景**：`game/src/scenes/`
  - `BootScene.ts` — 初始化 + 加载存档
  - `MenuScene.ts` — 主菜单
  - `TeamScene.ts` — 编队（文字列表版）
  - `BattleScene.ts` — 战斗（文字日志版）
  - `ResultScene.ts` — 结算 + localStorage 存档

### 测试
- [x] 24 项测试全部通过（`game/tests/battle.test.ts`）
- [x] TypeScript 编译零错误

### Git Commits（本轮）
```
fe82058 docs: 更新 README + 协作文档最终状态
1b26cbd feat: 数据清洗管道 — 适配 Hermes 格式，323 张卡标准化
743309c feat: 初始化 Phaser 3 游戏工程 + 战斗引擎 + 24 项测试通过
bfe695b docs: 建立多 Agent 协作机制 + 更新并行任务计划
f036850 docs: 添加 AGENTS.md 项目规范 + spec 三件套
```

---

## 四、快速启动命令

```bash
cd /Users/VazeniF/Desktop/神女控/game

npm install          # 安装依赖
npm run dev          # 启动开发服务器 → http://localhost:3000
npm run test         # 运行 24 项测试
npm run typecheck    # TypeScript 类型检查
npm run build        # 生产构建

# 数据管道
npm run data:validate    # 校验数据
npm run data:normalize   # 标准化 Hermes 原始数据
npm run data:report      # 生成统计报告
```

---

## 五、当前游戏状态

### 可游玩流程
启动 → 主菜单 → 编队（从 12 张 Mock 卡中选 5 张）→ 战斗（自动回合制）→ 结算 → 存档

### 当前限制（需要改进）
1. **纯文字 UI** — 编队和战斗都是文字列表/日志，没有卡图渲染
2. **无攻击动画** — 战斗是逐行打印日志，没有 Tween 动画
3. **无关卡选择** — 敌人是随机取 3 张非玩家卡
4. **无卡牌图鉴** — 没有全卡浏览功能
5. **无强化/进化** — 没有养成系统
6. **Mock 数据** — 只有 12 张卡，非真实数据

---

## 六、下一步开发任务（优先级排序）

### 高优先级
| # | 任务 | 说明 | 涉及文件 |
|:---|:---|:---|:---|
| N1 | 战斗动画 | Tween 攻击位移、HP 条组件、伤害飘字、技能特效文字 | game/src/scenes/BattleScene.ts, 新建 game/src/ui/ |
| N2 | 卡图渲染 | 用 Sprite 显示卡图（先用占位色块，后接真实图）| game/src/scenes/TeamScene.ts, game/src/ui/CardSprite.ts |

### 中优先级
| # | 任务 | 说明 | 涉及文件 |
|:---|:---|:---|:---|
| N3 | 关卡系统 | 5 个难度递增关卡 + 选关界面 | 新建 game/src/data/stages.json, game/src/scenes/StageSelectScene.ts |
| N4 | 真实数据接入 | Hermes 完成后运行 normalize，替换 Mock | game/src/data/pipeline/, game/data/runtime/ |
| N5 | 卡牌图鉴 | 全卡浏览、按属性/稀有度筛选、详情弹窗 | 新建 game/src/scenes/GalleryScene.ts |

### 低优先级
| # | 任务 | 说明 |
|:---|:---|:---|
| N6 | 强化/进化 | 卡牌消耗材料提升等级/进化 |
| N7 | 抽卡/Gacha | 召唤系统、概率、保底 |
| N8 | 音效/BGM | 战斗音效、背景音乐 |

---

## 七、关键架构约定

### 数据三层流
```
Hermes 原始数据 (output/cards.json, 只读)
    → normalize.ts (清洗)
    → game/data/normalized/cards.json (标准格式)
    → game/data/runtime/ (游戏直接加载)
```

### 卡牌 ID 策略
- 使用 slug（名称小写+连字符）：`goddess-athena`, `demon-lucifer`
- 不用数字 ID（Wiki 页面 ID 不稳定）

### 属性克制环
```
Passion(红) → Cool(蓝) → Light(绿) → Dark(紫) → Passion(红)
克制: 1.3x | 被克: 0.7x | Special: 始终 1.0x
```

### 伤害公式
```
baseDamage = ATK × multiplier - DEF × 0.5
elementBonus = getElementBonus(attacker, defender)
variance = 0.9 + random × 0.2
finalDamage = max(1, floor(baseDamage × elementBonus × variance))
```

### 文件所有权
| 目录 | 所有者 | 可否修改 |
|:---|:---|:---|
| `game/` | 游戏开发 Agent | ✅ 自由修改 |
| `coordination/` | 共享 | ✅ 更新状态 |
| `spec/` | 共享 | ⚠️ 只增不删 |
| `output/`, `images/` | Hermes | ❌ 只读 |
| `src/valkyrie/` | Hermes | ❌ 不动 |

---

## 八、Hermes 并行状态

- Hermes 正在后台运行爬虫（PID 3606 + 9122）
- output/cards.json 持续增长（当前 800+，目标 3500）
- images/ 持续下载卡图
- **绝对不要**：停止进程、修改 output/、修改 src/valkyrie/、git clean

Hermes 完成后接入真实数据：
```bash
cd game
npm run data:normalize   # 重新标准化完整数据
npm run data:validate data/normalized/cards.json
npm run data:report
# 然后将 normalized 数据复制/链接到 runtime 供游戏加载
```

---

## 九、已知问题与风险

1. **Hermes 数据质量**：约 60% 原始记录缺少有效 stats（被 normalize 跳过），最终可用卡可能只有 ~1500 张
2. **图片路径**：当前游戏不使用真实卡图，接入时需要建立 images/ → runtime 的映射
3. **Schema 可能需要扩展**：真实数据中可能有 Mock 未覆盖的字段/情况
4. **Phaser 版本**：使用 ^3.80.1，如需升级注意 API 变更

---

## 十、给新 Agent 的建议

1. 先 `npm run dev` 跑起来看看当前效果
2. 先 `npm run test` 确认 24 项测试通过
3. 从 N1（战斗动画）开始，这是体验提升最大的改动
4. 每次修改后跑 `npm run test` + `npm run typecheck`
5. 遵循 AGENTS.md 的 Git 规范：短分支、原子 commit、精确暂存
6. 不要动 output/ 和 images/（Hermes 还在写入）
