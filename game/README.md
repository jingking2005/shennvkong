# 神女控 — Valkyrie Crusade Web Game

基于 Phase 1 数字考古数据，使用 Phaser 3 重构的 Web 端卡牌战斗游戏。

## 快速开始

```bash
cd game
npm install
npm run dev        # 启动开发服务器 (http://localhost:3000)
```

## 命令

| 命令 | 用途 |
|:---|:---|
| `npm run dev` | 启动开发服务器 |
| `npm run build` | 生产构建 |
| `npm run test` | 运行测试 (vitest) |
| `npm run typecheck` | TypeScript 类型检查 |
| `npm run data:validate` | 校验 Mock/normalized 数据 |
| `npm run data:normalize` | 将 Hermes 原始数据标准化 |
| `npm run data:report` | 生成数据统计报告 |

## 目录结构

```
game/
├── src/
│   ├── main.ts                 # Phaser 入口
│   ├── scenes/                 # 游戏场景
│   │   ├── BootScene.ts        # 初始化 + 加载存档
│   │   ├── MenuScene.ts        # 主菜单
│   │   ├── TeamScene.ts        # 编队界面
│   │   ├── BattleScene.ts      # 战斗场景
│   │   └── ResultScene.ts      # 结算画面
│   ├── systems/                # 战斗逻辑（纯函数，可独立测试）
│   │   ├── BattleEngine.ts     # 回合制引擎
│   │   ├── DamageCalc.ts       # 伤害公式 + 属性克制
│   │   └── SkillSystem.ts      # 技能触发
│   ├── data/
│   │   ├── schema/types.ts     # 标准数据 Schema
│   │   ├── fixtures/           # Mock 数据（12 张卡）
│   │   ├── skills.ts           # 技能定义
│   │   └── pipeline/           # 数据清洗工具
│   └── ui/                     # UI 组件（待扩展）
├── data/
│   ├── normalized/             # 标准化后的数据
│   └── runtime/                # 游戏运行时数据（待接入）
├── tests/                      # 测试文件
└── public/assets/              # 静态资源
```

## 数据架构

```
Hermes 抓取 (output/cards.json, 只读)
    → npm run data:normalize
    → game/data/normalized/cards.json
    → 游戏加载
```

- **raw**: `../output/cards.json` — Hermes 原始抓取，只读，不修改
- **normalized**: `data/normalized/cards.json` — 标准化后，Schema 合规
- **fixtures**: `src/data/fixtures/mock-cards.json` — 开发用 Mock 数据

## 真实数据导入（Hermes 抓取完成后）

```bash
# 1. 确认抓取完成（output/cards.json 不再变化）
# 2. 标准化
npm run data:normalize
# 3. 校验
npm run data:validate data/normalized/cards.json
# 4. 查看报告
npm run data:report
```

## 当前状态

- Mock 数据：12 张卡牌，10 个技能，可完整游玩
- 标准化数据：323 张（从 Hermes 已抓取的 800 条中提取）
- 测试：24 项全部通过
- 垂直切片：主菜单 → 编队 → 战斗 → 结算 → 存档

## 技术栈

- Phaser 3.80+
- TypeScript 5.5+
- Vite 5.4+
- Vitest 2.0+
