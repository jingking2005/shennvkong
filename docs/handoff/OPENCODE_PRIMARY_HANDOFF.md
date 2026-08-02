# 神女控 → OpenCode 主开发交接文档

**交接日期：** 2026-08-02
**下达人：** 小金先生
**交出方：** Cursor（Composer / Auto）
**接收方：** OpenCode（此后为**主开发**）
**GitHub：** https://github.com/jingking2005/shennvkong （当前为 Public）

---

## 0. 一句话结论

| 角色 | 职责 |
|:---|:---|
| **OpenCode** | **主开发**：玩法逻辑、数值、存档、战斗、探索、抽卡规则、Git Commit & Push、分支整合 |
| **Cursor** | **UI 升级**：视觉、动效、布局、按钮样式、背景/HUD 观感；改完必须写 UI 交接笔记；**默认不 Push** |

协作细则见同目录：[`COLLAB_PROTOCOL_CURSOR_OPENCODE.md`](./COLLAB_PROTOCOL_CURSOR_OPENCODE.md)
UI 变更流水见：[`UI_CHANGELOG.md`](./UI_CHANGELOG.md)

---

## 1. 到底在哪个文件夹开发？

### 1.1 主开发工程（唯一）

```
/Users/VazeniF/Desktop/神女控/summon-hall/
```

- 技术栈：纯 TypeScript + Canvas2D + Vite（**不是** React / Phaser）
- 启动：

```bash
cd /Users/VazeniF/Desktop/神女控/summon-hall
npm install   # 首次
npm run dev   # http://localhost:3100/
```

- 入口：`summon-hall/index.html` → `src/main.ts`
- 构建：`npm run build` → `summon-hall/dist/`（勿提交 node_modules）

### 1.2 仓库根目录（Git 根）

```
/Users/VazeniF/Desktop/神女控/
```

- Remote：`origin` → `https://github.com/jingking2005/shennvkong.git`
- 分支现状（交接当日）：
  - `origin/main` @ `84a8ef2`（已含 summon-hall 初版）
  - 本地 `feat/ux-fixes` **超前 main 3 个 commit，可能尚未 Push**：
    1. `8461b98` feat: summon-hall 存档持久化与调试入口收敛
    2. `3ebbcdb` fix: 探索/讨伐循环与强化道具闭环
    3. `3344d65` feat: 战斗体力扩至2000 + 10种技能特效系统
  - **OpenCode 接手后请先：`git fetch` → 确认是否要把 `feat/ux-fixes` merge/push 到 `main`**

### 1.3 其它目录（不是主工程，但要认识）

| 路径 | 是什么 | OpenCode 怎么用 |
|:---|:---|:---|
| `/Users/VazeniF/Desktop/神女控2/` | 数字考古 + 粉丝归档资源库（本地 Git，**无 GitHub remote**） | **只读素材源**；不要当游戏工程改 |
| `神女控2/archive/final-archive/extracted/Valkyrie Crusade Fan Archive - Final - 2022-09-16/` | Map / BattleBG / BGM / Items 等 | Vite 已挂载，见 §4 |
| `/Users/VazeniF/Desktop/神女控/images/` | Wiki 抓取的卡面图（约 3000+ 角色目录） | Vite `/images` 映射 |
| `/Users/VazeniF/Desktop/神女控/星渊魔女录/` | ChatGPT HTML 原型（参考战斗 UI/流程） | **只参考，勿当主工程**；可玩副本在 `_app/` |
| `/Users/VazeniF/Desktop/神女控/素材/` | zip / 临时素材 | 勿当运行时依赖 |
| `/Users/VazeniF/Desktop/神女控/spec/v2/` | V2 策划文档（战斗/经济/成长等） | 规则权威参考 |
| `/Users/VazeniF/Desktop/神女控/game/` | 旧 Phaser 原型 | **已废弃/工作区大量删除未提交**；不要复活 |
| `/Users/VazeniF/Desktop/神女控/src/valkyrie/` | 旧 Python Wiki 爬虫 | 归档数据用，非前端主线 |
| 根目录 `HANDOFF.md` | 2026-07-24 考古阶段交接 | 历史文档，本文件取代「游戏主线」交接 |

---

## 2. summon-hall 源码地图（OpenCode 主责逻辑）

```
summon-hall/
├── index.html
├── package.json          # vite / typescript
├── vite.config.ts        # 代理 images + 神女控2 归档
├── tsconfig.json
├── public/bg/            # 召唤神殿/揭示背景图
├── dist/                 # 构建产物（勿手改）
└── src/
    ├── main.ts           # ★ 页面状态机 + 全部渲染/交互（最大文件 ~3000 行）
    ├── logic.ts          # ★ 探索/战斗/强化/进化/讨伐/领取
    ├── db.ts             # ★ Schema + seed + localStorage 持久化
    ├── gacha.ts          # ★ 卡池与抽卡
    ├── data.ts           # 卡牌目录加载（cards.json）
    ├── cards.json        # ~3397 张卡数据（大）
    ├── card.ts           # 卡面绘制（含玻璃稀有度角标）← UI 敏感
    ├── ui.ts             # 玻璃按钮 / 金属弹窗 ← UI 敏感
    ├── background.ts     # 召唤大厅背景 ← UI 敏感
    ├── assets.ts         # 地图/战斗BG/BGM/道具路径表
    ├── audio.ts          # BGM 开关（localStorage）
    └── ease.ts           # 缓动
```

### 2.1 页面（`Page`）

`summon` | `event` | `map` | `sortie` | `battle` | `team` | `records`

底栏：召唤 / 活动 / 出击 / 队伍 / 战绩
全局右上角：🔊 音乐、＋ 充值（调试）

### 2.2 已实现玩法（截至 feat/ux-fixes）

- 多卡池召唤：确认弹窗、神殿动画、翻卡揭示、十连结算
- 活动入口 → 地图节点 → 出击（进军走路弹跳）
- 行动力 **3000**，每步扣 **10**；遇敌节奏按步数（魔女 / 大魔女）
- 五卡编队、强化/进化/锁定/出售
- 自动战斗、技能弹窗、伤害字、Victory
- 魔女讨伐、战绩领取（单领 / 一键领）
- **localStorage 存档**（见 §3）
- 战斗体力 **2000** + 随时间回复；技能特效系统（近期 commit）

### 2.3 已知坑 / 工作区脏状态

1. 根仓库仍有大量 **未提交** 的旧 `game/`、`src/valkyrie/` **删除** 与 `AGENTS.md` / `.gitignore` 修改——**不要盲 `git add .`**。
2. `星渊魔女录/`、`素材/`、`graphify-out/`、`leaked-llm-prompts/` 多为未跟踪；是否入库由 OpenCode 决定（建议参考原型可不入库，或单独归档）。
3. 卡图依赖本机 `神女控/images` + `神女控2` 归档；换机器必须保留相对路径或改 `vite.config.ts`。
4. `Battle/Audio` 目录为空；BGM 实际用 `Audio/stream`。

---

## 3. 存档与调试键

| Key | 用途 |
|:---|:---|
| `summonHall_db_v1` | 主存档（user / inventory / stages / raids …） |
| `summonHall_instCounter` | 实例 ID 计数 |
| `summonHall_team` | 编队实例 id 列表 |
| `summonHall_bgmMuted` | BGM 静音 |
| `summonHall_bgmVolume` | 音量 |

代码：`db.ts` 的 `saveDB` / `loadDB` / `clearDB`；`main.ts` 编队读写。

---

## 4. 素材路径（非常重要）

### 4.1 卡图

- 磁盘：`/Users/VazeniF/Desktop/神女控/images/{CardName}/...`
- URL：`/images/...`（Vite 中间件）
- 解析：`data.ts` → `imageUrl(card)`

### 4.2 活动地图背景

- 磁盘：`神女控2/.../Battle/Map/`（约 133 张 AreaMap_*.png）
- URL：`/archive/map/...`
- 列表：`src/assets.ts` → `EVENT_MAP_BGS`

### 4.3 闯关 / 战斗背景

- 磁盘：`.../Battle/Background/`（BattleBG_*.png）
- URL：`/archive/battle-bg/...`
- 列表：`BATTLE_BGS`

### 4.4 BGM

- 磁盘：`.../Audio/stream/*.ogg`
- URL：`/archive/bgm/...`
- 列表：`BGM`（main / campaign / battle / eventMap / archwitch …）

### 4.5 强化道具图（近期）

- 磁盘：`.../Items/Enhancement/`
- URL：`/archive/items/...`

### 4.6 参考（勿当正式 UI 背景）

- `星渊魔女录/` 内截图与 HTML 原型
- `summon-hall/ref-lr-reveal.png`
- Cursor 资产目录里的用户截图（仅参考）

**版权注意：** 粉丝归档与原作截图仅私人原型；公开发布前必须替换为原创/授权素材。仓库已是 Public，推送前注意不要塞入整包归档或水印截图。

---

## 5. 策划与规范文档位置

| 文档 | 路径 |
|:---|:---|
| Agent 总规范 | `AGENTS.md` |
| V2 策划全集 | `spec/v2/*.md`（combat / economy / gacha / progression …） |
| 旧 SPEC 三件套 | `spec/requirements.md` / `design.md` / `tasks.md` |
| 考古阶段旧交接 | `HANDOFF.md`、`REPORT.md`、`CHANGELOG.md` |
| 协作看板（旧） | `coordination/*` |
| **本交接包** | `docs/handoff/*` |

---

## 6. OpenCode 接手后建议的第一周任务

1. **同步分支**：审查 `feat/ux-fixes` 三 commit → merge 到 `main` → **Push**（Cursor 默认不 Push）。
2. **清理工作区**：决定是否正式删除 `game/` 并单独 commit；勿与功能改动混提。
3. **补测试**：`logic.ts` / `gacha.ts` / 存档迁移目前几乎无自动化测试；建议 Vitest。
4. **拆 `main.ts`**：按 page 拆渲染模块，降低与 UI Agent 的冲突面。
5. **存档版本迁移**：`summonHall_db_v1` 增加 `version` 字段与迁移函数。
6. **对齐星渊战斗 UX**：魔女出现转场 / Victory / 奖励领取视觉可参考 `星渊魔女录/_app`，逻辑留在 summon-hall。

---

## 7. 给 OpenCode 的运行检查清单

```bash
# 1) 游戏
cd /Users/VazeniF/Desktop/神女控/summon-hall && npm run dev
# 打开 http://localhost:3100/

# 2) 类型
npx tsc --noEmit

# 3) 归档素材是否可达（需本机神女控2 存在）
curl -s -o /dev/null -w "%{http_code}\n" "http://localhost:3100/archive/battle-bg/BattleBG_001.png"
curl -s -o /dev/null -w "%{http_code}\n" "http://localhost:3100/archive/bgm/bgm_001%20Main%20Theme.ogg"

# 4) Git
cd /Users/VazeniF/Desktop/神女控
git status -sb
git remote -v   # 应为 jingking2005/shennvkong
```

---

## 8. 交接回执（请 OpenCode 填写）

- [x] 已阅读本文档与 `COLLAB_PROTOCOL_CURSOR_OPENCODE.md`
- [x] 已能在 3100 端口启动 summon-hall
- [x] 已确认素材路径（images + 神女控2 归档）可用
- [x] 已处理 `feat/ux-fixes` 相对 `origin/main` 的 3 个 commit
- [x] 已确认今后 **Commit / Push 由 OpenCode 负责**
- [x] 已确认 Cursor 仅 UI，且每次 UI 改动会写 `docs/handoff/ui-notes/`

**接收确认签名（OpenCode）：** OpenCode (Kimi K3)  日期：2026-08-02
