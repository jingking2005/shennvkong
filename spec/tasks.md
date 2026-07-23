# 神女控 — 任务分解

> 状态：待确认
> 创建：2026-07-23
> 依赖：spec/requirements.md、spec/design.md

---

## Phase 1 收尾（当前优先）

### T1: 全量抓取完成 + 质量检查

- **说明**：等待后台爬虫完成 3500 张卡抓取，运行 quality_check.py 生成 REPORT.md
- **验收标准**：
  - output/cards.json 记录数 >= 3000
  - REPORT.md 存在且成功率 > 90%
  - pytest -q 全部通过
- **涉及文件**：`output/`, `src/valkyrie/quality_check.py`, `REPORT.md`
- **预估**：等待 ~6h（爬虫自动运行），检查 30min

### T2: 失败项补抓

- **说明**：根据 REPORT.md 中的失败记录，分析原因并补抓
- **验收标准**：
  - 失败页面 < 5%
  - 缺失图片 < 10%
  - 无重复数据
- **涉及文件**：`output/`, `src/valkyrie/crawler.py`, `src/valkyrie/images.py`
- **预估**：1-2h

### T3: 数据清洗与标准化

- **说明**：统一字段格式、验证枚举值、生成游戏可用的精简数据
- **验收标准**：
  - rarity 字段仅含 N/R/SR/UR/LR（含 H/G/X 前缀变体）
  - element 字段仅含 Passion/Cool/Light/Dark/Special
  - atk/def 为有效正整数
  - 生成 `output/cards_clean.json`（去重、标准化后）
- **涉及文件**：新增 `src/valkyrie/cleaner.py`, `output/cards_clean.json`
- **预估**：1-2h

---

## Phase 2 游戏 MVP（Phase 1 完成后启动）

### T4: 初始化 Web 项目

- **说明**：在 `game/` 子目录创建 Vite + Phaser 3 + TypeScript 项目骨架
- **验收标准**：
  - `cd game && npm install && npm run dev` 启动成功
  - 浏览器打开显示 Phaser 默认场景（黑色画布 + console 无报错）
  - TypeScript 编译无错误
- **涉及文件**：`game/package.json`, `game/vite.config.ts`, `game/tsconfig.json`, `game/index.html`, `game/src/main.ts`
- **预估**：30min

### T5: 卡牌数据适配层

- **说明**：将 Phase 1 的 cards_clean.json 转换为游戏 CardData 类型，编写数据加载器
- **验收标准**：
  - CardData 类型定义完整（含 hp/speed 推算逻辑）
  - 数据加载器能正确解析 3000+ 张卡
  - 单元测试：hp 推算、speed 推算、稀有度/属性枚举验证
- **涉及文件**：`game/src/models/Card.ts`, `game/src/data/`, `game/tests/`
- **预估**：1h

### T6: 编队界面

- **说明**：实现卡牌浏览 + 编队选择界面（分页/搜索 + 拖拽或点击选卡）
- **验收标准**：
  - 显示卡牌列表（图片 + 名称 + 稀有度 + 属性）
  - 支持按属性/稀有度筛选
  - 可选择最多 5 张卡加入队伍
  - 队伍满 5 张后"开始战斗"按钮可点击
- **涉及文件**：`game/src/scenes/TeamScene.ts`, `game/src/ui/CardSprite.ts`
- **预估**：2h

### T7: 战斗引擎核心逻辑

- **说明**：实现纯逻辑的回合制战斗引擎（无渲染），TDD 方式
- **验收标准**：
  - 速度排序正确
  - 伤害公式正确（含属性克制 1.3/0.7 倍率）
  - 技能概率触发正确
  - 死亡判定正确
  - 胜负判定正确（一方全灭）
  - 单元测试覆盖：克制关系、技能触发、全灭判定、边界情况
- **涉及文件**：`game/src/systems/BattleEngine.ts`, `game/src/systems/DamageCalc.ts`, `game/src/systems/SkillSystem.ts`, `game/tests/`
- **预估**：2h

### T8: 战斗场景 UI + 动画

- **说明**：将 BattleEngine 的输出（actionLog）渲染为可视化战斗画面
- **验收标准**：
  - 双方卡牌左右对阵排列
  - 行动时卡牌有攻击动画（Tween 位移）
  - 受击时 HP 条减少 + 伤害数字飘出
  - 技能触发时有文字提示
  - 死亡卡牌灰化/消失
  - 60fps 流畅无卡顿
- **涉及文件**：`game/src/scenes/BattleScene.ts`, `game/src/ui/HealthBar.ts`, `game/src/ui/DamageText.ts`
- **预估**：3h

### T9: 敌人 AI + 关卡配置

- **说明**：配置 3-5 个难度递增的敌人队伍，敌人使用相同的 BattleEngine 逻辑
- **验收标准**：
  - enemies.json 含 5 个关卡配置
  - 敌人队伍从卡池中按稀有度/属性合理搭配
  - 难度递增（ATK/DEF 逐步提升）
  - 关卡选择界面可点击
- **涉及文件**：`game/src/data/enemies.json`, `game/src/scenes/MenuScene.ts`
- **预估**：1h

### T10: 胜负结算 + 基础循环

- **说明**：战斗结束后显示结算画面，可返回编队或进入下一关
- **验收标准**：
  - 胜利：显示"胜利"+ 用时回合数
  - 失败：显示"败北"
  - 可返回编队界面重新选卡
  - 胜利后可挑战下一关
- **涉及文件**：`game/src/scenes/ResultScene.ts`
- **预估**：1h

---

## 任务依赖图

```
T1 → T2 → T3 → T4 → T5 → T6 → T7 → T8 → T9 → T10
                              ↗
                    T7 可与 T6 并行
```

## 文件所有权（多 Agent 场景）

| 目录/文件 | 所有者 |
|:---|:---|
| `src/valkyrie/` | 数字考古 Agent |
| `output/`, `images/` | 数字考古 Agent |
| `game/` | 游戏开发 Agent |
| `spec/` | 共享（只增不改他人文件） |
| `AGENTS.md` | 用户（小金先生）|
