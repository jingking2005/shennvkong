# 神女控 — 需求文档

> 状态：待批准
> 创建：2026-07-23
> 项目路径：/Users/VazeniF/Desktop/神女控

---

## 项目总目标

对已停服手游《神女控（Valkyrie Crusade）》进行数字考古，建立完整的公开资源数据库，并基于该数据在 Web 端重构核心战斗体验。

---

## Phase 1 — 数字考古（进行中）

### 目标

从 Valkyrie Crusade Fandom Wiki 抓取全部公开卡牌数据与高清卡图，建立结构化 JSON/CSV 数据库。

### 做什么

- 全量 Cards 抓取（Category:Cards，约 3500 页）
- 每页提取：名称、稀有度、属性、ATK、DEF、Cost、技能、图片 URL
- 高清卡图下载（仅卡面/立绘/觉醒/进化，排除图标/UI/Banner）
- Skills 递归遍历（115 个子分类）
- Events 抓取（Category:Event，348 页）
- Categories 索引（556 个分类）
- Release Log 抓取（Category:Card Releases，24 页）
- 输出 JSON + CSV 双格式
- 质量检查 + REPORT.md

### 不做什么

- APK 解析（属后续阶段）
- 音频/BGM 提取（属后续阶段）
- UI 素材提取（属后续阶段）
- 任何需要登录或付费的内容

### 验收标准

1. `output/cards.json` 含 3000+ 有效卡牌记录
2. `images/` 目录含对应卡牌高清图片（按卡牌名分目录）
3. `output/skills.json` 含技能数据
4. `output/events.json` 含活动数据
5. REPORT.md 显示成功率 > 90%
6. 47+ 项单元测试全部通过

### 约束

- 请求限速 1.5 秒/次，避免触发 Fandom 429
- 支持断点续传（checkpoint.json）
- 支持失败重试（3 次指数退避）
- Python >= 3.10
- 虚拟环境隔离

---

## Phase 2 — Web 游戏重构（待启动）

### 目标

基于 Phase 1 产出的卡牌数据库，在浏览器中重现神女控的核心战斗体验。

### 做什么（MVP 范围）

- 卡牌数据加载（直接使用 cards.json）
- 编队系统：从卡池中选择最多 5 张卡牌组成战队
- 回合制自动战斗引擎：
  - 速度决定行动顺序
  - 普通攻击 + 技能概率触发
  - 四属性环形克制（Passion > Cool > Light > Dark > Passion）
  - 伤害公式基于 ATK/DEF 计算
- 基础敌人配置（从卡牌数据中生成 NPC 队伍）
- 战斗 UI：卡牌展示、攻击动画、HP 条、技能特效提示
- 胜负结算：战斗结果展示

### 不做什么（MVP 外）

- 王都建设 / 经营系统
- 抽卡 / Gacha 系统
- PvP / 决斗
- 魔女讨伐 / 合作 Boss
- 同盟 / 公会
- 联网多人
- 卡牌强化 / 进化 / 合体（MVP 使用原始数据）
- 用户账号 / 存档

### 验收标准

1. 浏览器打开即可游玩，无需安装
2. 玩家从卡池选择 5 张卡牌编队
3. 点击"开始战斗"后进入自动回合制战斗
4. 战斗中可见：行动顺序、攻击动画、伤害数字、HP 变化、技能触发
5. 属性克制生效（克制方伤害加成可观测）
6. 战斗结束后显示胜/负结果
7. 全流程无报错，60fps 流畅

### 约束

- 纯前端单机，无后端服务
- 技术栈：Phaser 3 + TypeScript + Vite
- 数据来源：Phase 1 产出的 cards.json（只读引用）
- 浏览器兼容：Chrome/Edge/Safari 最新版
- 项目位于 `/Users/VazeniF/Desktop/神女控/game/` 子目录（与 Phase 1 Python 项目隔离）

---

## 后续阶段（仅记录，不在本次范围）

- Phase 3：APK 解析、音频提取、UI 提取、战斗配置还原
- Phase 4：完整游戏循环（抽卡、强化、进化、战役地图、王都建设）
