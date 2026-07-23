# 神女控 — 设计文档

> 状态：待批准
> 创建：2026-07-23
> 依赖：spec/requirements.md

---

## Phase 1 设计（已实现，补文档）

### 架构

```
MediaWiki API (Fandom)
       │
       ▼
  client.py ─── 限速 1.5s / 重试 3 次 / 断点续传
       │
       ▼
  parser.py ─── Wikitext Infobox 解析
       │
       ▼
  crawler.py ── 全量调度（Category:Cards → 3500 页）
  crawler_extra.py ── Skills/Events/Categories/ReleaseLog
       │
       ▼
  images.py ─── 卡图下载（白名单过滤）
       │
       ▼
  exporter.py ── JSON + CSV 双格式输出
       │
       ▼
  quality_check.py ── 统计 + REPORT.md
```

### 数据模型

```python
Card = {
    "name": str,          # 卡牌名（英文）
    "name_cn": str,       # 中文名（如有）
    "rarity": str,        # N / R / SR / UR / LR
    "element": str,       # Passion / Cool / Light / Dark / Special
    "atk": int,           # 攻击力
    "def": int,           # 防御力
    "cost": int,          # 费用
    "skill_name": str,    # 技能名
    "skill_desc": str,    # 技能描述
    "image_url": str,     # 卡图 URL
    "image_local": str,   # 本地路径
    "url": str,           # Wiki 页面 URL
}
```

### 关键技术决策

| 决策 | 选择 | 理由 |
|:---|:---|:---|
| 图片过滤 | 白名单（文件名含卡牌名） | 黑名单无法穷举进化材料/碎片图 |
| Skills 遍历 | 流式递归 + early-stop | 115 个子分类层级深，全量加载内存大 |
| 断点续传 | checkpoint.json 记录索引 | 3500 页抓取耗时长，必须支持中断恢复 |
| 限速 | 1.5s/请求 | Fandom 对高频访问返回 429 |

---

## Phase 2 设计（新增）

### 方案对比

| 维度 | A) Phaser 3 + TS + Vite | B) 纯 DOM/Canvas 手写 |
|:---|:---|:---|
| 开发效率 | 高（场景管理、Tween、Sprite 内置） | 低（全部手写） |
| 动画表现 | 丰富（粒子、Tween、帧动画） | 需自行实现 |
| 社区/文档 | 成熟，示例丰富 | 无 |
| 包体积 | ~1MB gzip | 极小 |
| 学习成本 | 中（需学 Phaser API） | 低但开发量大 |
| 后续扩展 | 容易（Tilemap、物理、音频内置） | 困难 |

**推荐：方案 A**。卡牌游戏需要大量 UI 动画（攻击、技能、HP 变化），Phaser 3 的 Tween + Scene 管理可以大幅减少工作量。

### 架构设计

```
game/
├── public/
│   └── assets/           # 卡图（从 Phase 1 images/ 软链或复制）
├── src/
│   ├── main.ts           # Phaser 游戏入口 + 配置
│   ├── data/
│   │   ├── cards.json    # 从 Phase 1 output/ 复制（只读）
│   │   └── enemies.json  # 敌人队伍配置
│   ├── models/
│   │   ├── Card.ts       # 卡牌数据类型
│   │   ├── Team.ts       # 队伍类型
│   │   └── Battle.ts     # 战斗状态类型
│   ├── systems/
│   │   ├── BattleEngine.ts   # 回合制战斗核心逻辑（纯逻辑，无渲染）
│   │   ├── DamageCalc.ts     # 伤害公式 + 属性克制
│   │   └── SkillSystem.ts    # 技能触发判定
│   ├── scenes/
│   │   ├── BootScene.ts      # 资源加载
│   │   ├── MenuScene.ts      # 主菜单
│   │   ├── TeamScene.ts      # 编队界面
│   │   ├── BattleScene.ts    # 战斗场景
│   │   └── ResultScene.ts    # 结算画面
│   └── ui/
│       ├── CardSprite.ts     # 卡牌精灵组件
│       ├── HealthBar.ts      # HP 条
│       └── DamageText.ts     # 伤害数字
├── index.html
├── package.json
├── tsconfig.json
└── vite.config.ts
```

### 核心分层

- **数据层**（models/）：纯 TypeScript 类型定义，无副作用
- **逻辑层**（systems/）：战斗引擎，纯函数，可独立测试
- **渲染层**（scenes/ + ui/）：Phaser 场景，只负责展示

### 战斗系统设计

**回合流程：**
```
战斗开始
  → 按速度排序所有存活单位
  → 依次行动：
      → 判定技能触发（概率 = skill_rate）
      → 若触发：执行技能效果
      → 否则：普通攻击
      → 计算伤害 → 扣血 → 判定死亡
  → 一轮结束 → 检查胜负
  → 未分胜负 → 下一轮
```

**伤害公式：**
```
base_damage = ATK * skill_multiplier - DEF * 0.5
element_bonus = 1.3（克制）/ 0.7（被克）/ 1.0（无）
final_damage = max(1, floor(base_damage * element_bonus))
```

**属性克制环：**
```
Passion → Cool → Light → Dark → Passion（环形）
Special：对所有属性 1.0，被所有属性 1.0
```

### 关键接口

```typescript
interface CardData {
  id: string;
  name: string;
  name_cn?: string;
  rarity: 'N' | 'R' | 'SR' | 'UR' | 'LR';
  element: 'Passion' | 'Cool' | 'Light' | 'Dark' | 'Special';
  atk: number;
  def: number;
  hp: number;        // 由 def * 系数 推算
  speed: number;     // 由 rarity + atk 推算
  skill: {
    name: string;
    desc: string;
    rate: number;        // 触发概率 0-1
    multiplier: number;  // 伤害倍率
    target: 'single' | 'all';
  };
  image: string;     // 图片路径
}

interface BattleUnit {
  card: CardData;
  currentHp: number;
  maxHp: number;
  isAlive: boolean;
  side: 'player' | 'enemy';
}

interface BattleState {
  turn: number;
  units: BattleUnit[];
  actionLog: BattleAction[];
  phase: 'ongoing' | 'player_win' | 'enemy_win';
}

interface BattleResult {
  winner: 'player' | 'enemy';
  turns: number;
  log: BattleAction[];
}
```

### 安全与性能

- 无网络请求，无用户数据，无安全风险
- 卡池 ~3500 张，编队界面需分页/搜索（不一次渲染全部）
- 战斗动画使用 Phaser Tween，避免 DOM 操作

### 回滚方案

- 每个任务在 `feature/<name>` 分支开发
- main 保持可构建可运行
- 任何任务失败可 `git switch main` 回到稳定状态
