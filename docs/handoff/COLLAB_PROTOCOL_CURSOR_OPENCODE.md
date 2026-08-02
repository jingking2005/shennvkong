# Cursor ↔ OpenCode 协作协议（神女控）

**生效日期：** 2026-08-02
**下达人：** 小金先生
**适用仓库：** https://github.com/jingking2005/shennvkong
**本地根目录：** `/Users/VazeniF/Desktop/神女控`

本协议为「补充协议」：在 `AGENTS.md` 之上，专门约定 **OpenCode（主开发）** 与 **Cursor（UI）** 的分工与交接格式。冲突时以小金先生最新口头/书面指令为准。

---

## 1. 角色与权限

| 事项 | OpenCode（主开发） | Cursor（UI） |
|:---|:---|:---|
| 玩法逻辑 / 数值 / 存档 / RNG / 战斗公式 | ✅ 主责 | ❌ 默认不改；若 UI 硬依赖可提需求给 OpenCode |
| Canvas 绘制、布局、动效、按钮皮肤、背景观感 | 可改，但大改前先对齐 | ✅ 主责 |
| `logic.ts` / `gacha.ts` / `db.ts` Schema | ✅ | ❌ 除非小金先生点名 |
| `card.ts` / `ui.ts` / `background.ts` 视觉 | 可微调 | ✅ |
| `main.ts` | ✅ 页面状态与流程 | ✅ 仅限渲染/动画段落；避免重写状态机 |
| **Git Commit** | ✅ **默认负责** | ⚠️ 仅在小金先生明确要求时；否则只改文件 + 写 UI 笔记 |
| **Git Push** | ✅ **默认负责** | ❌ **默认禁止**；除非小金先生当次明确说 Push |
| 开 PR / Merge | ✅（若启用） | ❌ |
| 远程仓库创建/删除、改 Public/Private | 仅小金先生授权后 | 同左 |

---

## 2. 分支约定

1. **`main`**：始终可运行（`npm run dev` 能开）。
2. OpenCode 功能：`feature/<名>` 或 `fix/<名>`。
3. Cursor UI：`ui/<名>`（例如 `ui/glass-badge`）。
4. **禁止**两人长期共用同一未合并分支盲改。
5. 若必须同改 `main.ts`：OpenCode 先拆文件（推荐），或约定「OpenCode 改上半逻辑、Cursor 改 `renderXxx`」并短分支快合。

### 2.1 推荐文件所有权（减少冲突）

| 文件 | 所有者 |
|:---|:---|
| `src/logic.ts` | OpenCode |
| `src/gacha.ts` | OpenCode |
| `src/db.ts` | OpenCode |
| `src/data.ts` / `cards.json` | OpenCode |
| `src/card.ts` | Cursor（UI） |
| `src/ui.ts` | Cursor（UI） |
| `src/background.ts` | Cursor（UI） |
| `src/assets.ts` | 共有（加路径 OpenCode；展示用法 Cursor） |
| `src/audio.ts` | 共有 |
| `src/main.ts` | **共有高冲突** → 优先拆分给 OpenCode |

---

## 3. Commit / Push 流程（默认）

### OpenCode

```text
改代码 → 本地验证（tsc / 手动点一遍）→ git add <精确文件>
→ commit（Conventional Commits）→ git push
```

### Cursor

```text
改 UI → 本地验证 → 写 UI 交接笔记（见 §4）
→ 默认到此结束（不 commit / 不 push）
→ 由 OpenCode 审查后统一 commit & push
或：小金先生当次明确说「帮我提交/推送」时才操作
```

### 共同红线

- 不用 `git add .` 扫进无关删除（当前工作区有大量旧 `game/` 删除）。
- 不 `push --force` 到 `main`。
- 不把 `node_modules/`、整包 `神女控2` 归档、密钥、`.venv` 推进仓库。
- Push 前看一眼：仓库目前是 **Public**。

---

## 4. UI 改完必须写交接笔记（强制）

每次 Cursor 完成一轮 UI 改动，**必须**新增一份笔记：

```
docs/handoff/ui-notes/YYYY-MM-DD_短标题.md
```

并在 `docs/handoff/UI_CHANGELOG.md` 顶部追加一行索引。

### 4.1 笔记必须包含

1. **改了哪些文件**（路径列表）
2. **视觉/交互变更摘要**（玩家能感知到什么）
3. **有没有动逻辑**（若动了，必须标红并 @ OpenCode）
4. **如何验证**（点哪几个按钮）
5. **未完成 / 风险**
6. **建议 OpenCode 的 follow-up**（是否需要拆状态、补测试、改存档）

模板见 `UI_CHANGELOG.md`。

### 4.2 OpenCode 收到 UI 笔记后

1. `git status` / diff 审查
2. 合并冲突优先保留逻辑正确性，再调 UI
3. Commit message 可写：`ui: <摘要> (from Cursor note YYYY-MM-DD)`
4. Push

---

## 5. 沟通与单人现场

两人可能在同一台机器、同一目录工作：

1. 开工前：`git status -sb` + `git pull --ff-only`（有远程更新时）。
2. 发现对方未提交脏文件：先别覆盖，写进 STATUS 或问小金先生。
3. 一次只做一个垂直切片；UI 大改与逻辑大改错开时间。
4. 重大架构（拆 main、换框架、引入 React）→ **必须小金先生批准**，OpenCode 出方案。

---

## 6. 与旧 Agent / 旧文档关系

- Hermes / Codex 旧交接：`HANDOFF.md`、`coordination/HANDOFF_*.md` → 考古与早期 V2，**游戏主线以此协议 + OPENCODE_PRIMARY_HANDOFF 为准**。
- Phaser `game/`：废弃。
- HTML `星渊魔女录`：战斗 UI 参考，不双线维护逻辑。

---

## 7. 冲突升级

出现以下情况必须暂停并问小金先生：

- 要不要把仓库改 Private
- 是否删除并提交整个 legacy `game/`
- 是否把 `神女控2` 大归档塞进 GitHub
- 是否允许 Cursor 直接 Push
- 产品范围砍功能 / 改核心循环

---

## 8. 协议确认

| 角色 | 确认 |
|:---|:---|
| 小金先生 | 已口头确认：OpenCode 主开发；Cursor 主 UI；Commit/Push 归 OpenCode |
| OpenCode | 阅读后在 `OPENCODE_PRIMARY_HANDOFF.md` §8 勾选回执 |
| Cursor | 遵守本协议；UI 改动写 `ui-notes` |

**修订记录**

| 日期 | 修订 |
|:---|:---|
| 2026-08-02 | 初版生效 |
