# 研究资料索引

> 更新时间：2026-07-23
> 用途：记录所有外部研究来源、下载状态和关键发现

---

## 一、《神女控》原版资料

### 1.1 Final Archive（Google Drive）

- 地址：https://drive.google.com/file/d/17ZbXpQXflcth1A-CqyOnfGXAhOFikdJ_/view
- 说明页面：https://valkyriecrusade.fandom.com/wiki/User_blog:Kushieda_minori/End_of_Game_announcement
- 下载状态：**待 Hermes 下载**（Google Drive 大文件，需手动或 gdown）
- 预期内容：全部高清卡牌（含未发布）、武器道具、建筑图片、BGM、音效、官方原声、公会图案
- 存放位置：`archive/final-archive/`（待创建）

### 1.2 master_data.dat

- 参考：https://valkyriecrusade.fandom.com/wiki/Wiki_Maintenance/Reading_VC_Data_Files
- 路径：`files/response/master_data.dat`
- 下载状态：**未找到**（Fandom 页面 403，需从 APK 或 Archive 中提取）
- 预期内容：卡牌属性、技能概率、进化数据、建筑、Unit Bonus、觉醒、合成、Archwitch、经验曲线
- 存放位置：`archive/raw-data/`（待创建）

### 1.3 APK 文件

- 最新版下载：https://valkyrie-crusade.en.uptodown.com/android/download
- 历史版本：https://valkyrie-crusade.en.uptodown.com/android/versions
- 优先版本：8.1.1, 8.1.0, 7.0.5, 6.0.1, 3.4.1
- 下载状态：**待 Hermes 下载**
- 分析工具：JADX / Apktool / Android Studio APK Analyzer
- 存放位置：`archive/apk/`（待创建）
- 重点比较 8.1.0 vs 8.1.1：停服前后功能差异

---

## 二、《神女控》GitHub 工具

### 2.1 PoH98/Valkyrie-Crusade-HD-Card-Farming

- 地址：https://github.com/PoH98/Valkyrie-Crusade-HD-Card-Farming
- 研究状态：**已完成**
- 关键发现：
  - 卡图 CDN URL 格式：`https://d2n1d3zrlbtx8o.cloudfront.net/download/CardHD.zip/{cardId}.{uploadTime}`
  - cardId 为**数字**（非 slug）
  - 原版 thumb 目录：`/sdcard/Android/data/com.nubee.valkyriecrusade/card/thumb/`
  - v2 版直接爬 Fandom Wiki（与我们 Hermes 相同策略）
- 借鉴：cardId 数字映射关系
- 不运行：暴力猜测 CDN 时间戳的代码（DDoS 风险）

### 2.2 PoH98/Valkyrie-Crusade-Bot

- 地址：https://github.com/PoH98/Valkyrie-Crusade-Bot
- 研究状态：**已完成**
- 关键发现：
  - C# 挂机工具，含 Decrypt / ImageProcessor / ImgXml / DefaultScript 模块
  - 证实游戏资源有**加密/编码层**
  - XML 映射文件可能包含 cardId → 图片/技能对应关系
  - 不是游戏源码，不能直接改造
- 借鉴：资源解码思路、XML 映射结构
- Hermes 待做：检查 ImgXml 目录具体内容

### 2.3 Drackzgull/Valkyrie-Crusade-Special-Summon-Simulator

- 地址：https://github.com/Drackzgull/Valkyrie-Crusade-Special-Summon-Simulator
- 研究状态：**已完成**
- 关键发现：C++ 抽卡模拟器，证实原版特殊召唤有明确概率公式
- 借鉴：抽卡概率验证方法

### 2.4 kushieda-minori/vc-arcana-calc

- 地址：https://github.com/kushieda-minori/vc-arcana-calc
- 研究状态：**待进一步检查**
- 预期：可能含原版数值公式、Arcana 计算逻辑

---

## 三、成熟卡牌战斗开源项目

### 3.1 OpenDuelyst（3.9k stars，CC0）

- 地址：https://github.com/open-duelyst/duelyst
- 研究状态：**已完成**
- 语言：CoffeeScript + Node.js
- 关键架构：
  - `app/common/` = 纯逻辑引擎（与渲染完全分离）
  - `app/view/` = 渲染层
  - EventBus：270+ 事件类型
  - Action Queue：validate → execute → cleanup → emit
  - Modifier/Aura：洋葱层管理 Buff/Debuff
  - Snapshot/Rollback：战斗回放
  - Step 模型：start_step → step → after_step
- **借鉴**：EventBus 解耦、Action Queue 流水线、Snapshot 回滚、Modifier 生命周期
- **不复制**：CoffeeScript、Firebase 网络层、棋盘格子玩法

### 3.2 Godot Card Game Framework（AGPL3）

- 地址：https://github.com/db0/godot-card-game-framework
- 研究状态：**已完成**
- 语言：GDScript (Godot)
- 关键架构：
  - Scripting Engine：卡牌能力用纯文本字典定义
  - 触发+过滤+条件 三层判定
  - 运行时根据棋盘状态计算效果强度
  - Tag 标记 + 跨脚本过滤
  - 脚本间结果传递
  - 内置 Deck Builder
- **借鉴**：字典式技能定义、触发过滤条件、Tag 系统、效果链
- **不复制**：Godot/GDScript 代码、拖拽交互

### 3.3 SabberStone（炉石模拟器，C#，AGPL3）

- 地址：https://github.com/HearthSim/SabberStone
- 研究状态：**已完成**
- 语言：C# .NET Core
- 关键架构：
  - Onion System：多层 Enchantment 叠加
  - 98% 卡牌实现率（1400+ 测试用例）
  - Entities / Enchants / Tasks / Triggers / Controllers
  - Aura 自动生命周期管理
  - 每张卡一个单元测试
- **借鉴**：Onion 层叠、Task Chain 效果链、Trigger 模式、每卡一测试
- **不复制**：C# 代码、炉石特有机制

### 3.4 Fireplace（炉石模拟器，Python，AGPL3）

- 地址：https://github.com/jleclanche/fireplace
- 研究状态：**已完成**
- 语言：Python
- 关键架构：
  - 100% 卡牌实现（2000+ 张）
  - 事件队列串行处理
  - 独立死亡结算阶段
  - 声明式目标筛选器
  - 无 UI 战斗模拟
  - 自动化测试（每卡对应测试）
- **借鉴**：事件队列、独立死亡结算、声明式目标、无 UI 模拟
- **不复制**：Python 代码、炉石规则

---

## 四、综合架构决策

基于以上研究，V2 战斗引擎采用以下架构（已写入 spec/v2/combat-system.md）：

```
BattleEngine（纯逻辑，无 Phaser 依赖）
  ├── EventBus        — 事件总线
  ├── ActionQueue     — validate→execute→cleanup→emit
  ├── SnapshotManager — 快照/回滚
  ├── StepExecutor    — 原子步骤
  ├── SkillResolver   — 触发判定
  ├── EffectResolver  — 效果链
  ├── StatusEngine    — 状态生命周期（洋葱层）
  ├── DamageCalc      — 多乘区伤害
  ├── HealCalc        — 治疗
  └── TargetSelector  — 声明式目标
```

---

## 五、待 Hermes 完成的事项

| # | 任务 | 优先级 | 存放位置 |
|:---|:---|:---|:---|
| H1 | 下载 Final Archive | 高 | `archive/final-archive/` |
| H2 | 从 Archive/APK 中找 master_data.dat | 高 | `archive/raw-data/` |
| H3 | 下载 APK 8.1.1 + 8.1.0 | 中 | `archive/apk/` |
| H4 | JADX 静态分析 APK | 中 | `archive/apk-analysis/` |
| H5 | 检查 PoH98 Bot 的 ImgXml 目录 | 中 | 记录到 `archive/card-mapping.md` |
| H6 | 整理 cardId ↔ 图片 ↔ Fandom 名 映射 | 高 | `archive/card-mapping.md` |
| H7 | 继续当前图片抓取 | 持续 | `output/`, `images/` |

---

## 六、文件所有权

| 目录 | 所有者 | 说明 |
|:---|:---|:---|
| `game/` | 游戏 Agent | V2 重写 |
| `archive/` | Hermes | 新建，存放外部资料 |
| `output/`, `images/` | Hermes | 只读，不停进程 |
| `src/valkyrie/` | Hermes | 不动 |
| `spec/v2/` | 共享 | 策划文件 |
| `docs/audits/` | 共享 | 研究报告 |
| `coordination/` | 共享 | 交接/状态 |
