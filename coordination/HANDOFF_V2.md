# 交接文档 — V2 策划冻结 + 开源研究完成

> 更新时间：2026-07-23 22:00
> 来自：千问3.8（游戏架构 + 策划负责人）
> 接收方：下一个游戏开发 Agent / Hermes（数据考古 Agent）
> 项目目录：/Users/VazeniF/Desktop/神女控

---

## 一、当前项目状态

### 已完成

| 阶段 | 内容 | 文件位置 |
|:---|:---|:---|
| Phase 0 | 原型审计 | `docs/audits/current-prototype-audit.md` |
| Phase 0 | 开源卡牌项目研究 | `docs/audits/open-source-research.md` |
| Phase 1 | V2 策划冻结（15 个文件） | `spec/v2/*.md` |
| Phase 1 | AGENTS.md 更新 | `AGENTS.md` 末尾 V2 章节 |

### legacy prototype 状态

`game/` 目录下的代码**冻结**，不再扩展。保留作为参考，但 V2 实现时核心系统需完全重写。

可保留复用的模块：
- `game/src/ui/BackgroundFX.ts` — 氛围背景
- `game/src/ui/HealthBar.ts` — HP 条
- `game/src/ui/DamageText.ts` — 伤害飘字
- `game/src/data/pipeline/` — 数据清洗管道
- `game/vite.config.ts` — 构建配置 + images 中间件
- `game/src/data/card-image-map.ts` — 卡图映射

---

## 二、Hermes 任务清单

Hermes 继续当前工作，**不要中断抓取进程**。额外需要完成：

### 2.1 下载 Final Archive

地址：https://drive.google.com/file/d/17ZbXpQXflcth1A-CqyOnfGXAhOFikdJ_/view

下载后检查：
- 文件完整性（大小/MD5）
- 目录结构（列出顶层目录）
- 是否包含：高清卡牌/武器道具/建筑图片/BGM/音效/公会图案
- 卡牌图片命名规则（数字 ID？slug？与 Fandom 页面名对应关系？）

**存放位置**：`/Users/VazeniF/Desktop/神女控/archive/`（新建，不混入 game/）

### 2.2 寻找 master_data.dat

参考：https://valkyriecrusade.fandom.com/wiki/Wiki_Maintenance/Reading_VC_Data_Files

在以下位置寻找：
- Final Archive 解压后
- APK 提取的 assets/ 目录
- 现有抓取结果中

找到后：
- 保留原文件，只做副本分析
- 记录文件格式（二进制？加密？JSON？）
- 尝试解析出卡牌属性/技能/进化数据

**存放位置**：`/Users/VazeniF/Desktop/神女控/archive/raw-data/`

### 2.3 收集 APK

优先版本：8.1.1, 8.1.0, 7.0.5, 6.0.1, 3.4.1

下载页面：https://valkyrie-crusade.en.uptodown.com/android/versions

APK 只做静态分析（JADX/Apktool），不安装。

**存放位置**：`/Users/VazeniF/Desktop/神女控/archive/apk/`

### 2.4 分析神女控 GitHub 工具

已研究结论（千问完成）：
- `PoH98/Valkyrie-Crusade-HD-Card-Farming`：卡图 URL 格式为 `{cardId}.{uploadTime}`，cardId 为数字
- `PoH98/Valkyrie-Crusade-Bot`：含 Decrypt/ImageProcessor/ImgXml 模块，证实资源有加密层
- `Drackzgull/Valkyrie-Crusade-Special-Summon-Simulator`：C++ 抽卡模拟器

Hermes 需要：
- 检查 PoH98 Bot 的 ImgXml 目录是否有 cardId → 图片/技能映射
- 检查是否有资源解码逻辑可复用

### 2.5 整理对应关系

最终产出文件：`/Users/VazeniF/Desktop/神女控/archive/card-mapping.md`

内容：
- Fandom 页面名 ↔ 数字 cardId ↔ 图片文件名 ↔ 目录名
- 技能 ID 与卡牌的对应关系（如能从 master_data.dat 提取）

---

## 三、千问/下一个游戏 Agent 任务清单

### 3.1 已完成的开源研究结论

四个开源卡牌项目的借鉴方案已写入 `docs/audits/open-source-research.md`。

核心架构决策：
1. **EventBus 解耦**：BattleEngine 纯逻辑，通过事件通知渲染层
2. **Action Queue 验证流水线**：validate → execute → cleanup → emit
3. **Modifier 洋葱层**：Buff/Debuff 多层叠加，支持优先级
4. **独立死亡结算**：先结算所有伤害，再统一处理死亡/复活
5. **Snapshot/Rollback**：支持战斗回放和 AI 模拟
6. **Seeded RNG**：所有随机可测试
7. **无 UI 模拟**：BattleEngine 可在 Node.js 独立运行

### 3.2 下一步实现优先级（Phase 2 开始条件：V2 策划审阅通过）

**最先实现的三个系统**：

1. **Seeded RNG + EventBus + Action Queue**（基础设施）
   - 文件：`game/src/systems/rng.ts`, `game/src/systems/event-bus.ts`, `game/src/systems/action-queue.ts`
   - 这是所有后续系统的地基

2. **V2 数据模型 + SkillResolver + EffectResolver**（技能引擎）
   - 文件：`game/src/data/schema/v2-types.ts`, `game/src/systems/skill-resolver.ts`, `game/src/systems/effect-resolver.ts`
   - 数据驱动，30+ 效果类型

3. **V2 BattleEngine**（战斗核心）
   - 文件：`game/src/systems/battle-engine-v2.ts`
   - 回合制 + 位置 + 状态机 + 手动/自动
   - 依赖 1 和 2

### 3.3 V2 策划文件索引

```
spec/v2/game-vision.md          — 产品定位
spec/v2/core-loop.md            — 核心循环
spec/v2/combat-system.md        — 战斗系统（含公式）
spec/v2/card-and-skill-system.md — 卡牌+技能（含8职业+30效果）
spec/v2/progression-system.md   — 6层成长
spec/v2/enhancement-system.md   — FIFA式+0~+10
spec/v2/economy-and-gacha.md    — 8资源+6卡池
spec/v2/kingdom-system.md       — 14建筑
spec/v2/content-and-modes.md    — 关卡/Boss/试炼
spec/v2/ui-art-direction.md     — 美术标准
spec/v2/data-model.md           — 15个核心接口
spec/v2/balance-framework.md    — 平衡+模拟测试
spec/v2/vertical-slice.md       — 合格切片标准
spec/v2/tasks.md                — 12 Phase 任务
spec/v2/acceptance-matrix.md    — 18项验收
```

---

## 四、并行安全约束

| 目录 | 所有者 | 规则 |
|:---|:---|:---|
| `game/` | 游戏 Agent | 自由修改（V2 重写时） |
| `archive/` | Hermes | 新建，存放 Archive/APK/raw-data |
| `output/`, `images/` | Hermes | 只读，不停进程 |
| `src/valkyrie/` | Hermes | 不动 |
| `spec/v2/` | 共享 | 只增不删 |
| `docs/audits/` | 共享 | 研究报告 |
| `coordination/` | 共享 | 更新状态 |

**绝对禁止**：
- 停止 Hermes 进程
- git reset --hard / git clean -fd
- 覆盖对方正在修改的文件
- 把大量卡图/APK 提交到 Git

---

## 五、需要项目负责人决定的问题

1. **属性克制**：V2 改为互克（Passion↔Cool, Light↔Dark），确认？
2. **强化保底**：连续失败 N 次后必成，N 取多少？（建议 5）
3. **王国计时**：单机版建筑升级用秒级还是分钟级？
4. **手动战斗 UI**：点击选目标 vs 拖拽选目标？
5. **Final Archive 下载**：Google Drive 大文件，Hermes 是否有能力下载？
6. **APK 静态分析工具**：是否已在环境中安装 JADX/Apktool？

---

## 六、Git 状态

```
最新 commit: dd9a51a docs: V2 策划冻结
分支: main
工作区: 干净（除 Hermes 正在写入的 output/images）
```

---

## 七、快速启动命令

```bash
cd /Users/VazeniF/Desktop/神女控/game
npm install
npm run dev        # 启动 legacy prototype（仅参考）
npm run test       # 103 项测试通过
npm run typecheck  # 零错误
```

---

**本文档是 V2 阶段的唯一交接入口。新 Agent 阅读本文件 + spec/v2/ 即可开始工作。**
