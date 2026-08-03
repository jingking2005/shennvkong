# 神女控 — 设计文档

> 状态：已批准（2026-08-03，随变更单冻结）
> 创建：2026-07-23；重写：2026-08-03（OC-00）
> 依赖：spec/requirements.md
> 旧 Phase 1 爬虫/Phaser 设计已废弃（代码已删除），仅留本节说明。

---

## 1. 总体架构

```
/Users/VazeniF/Desktop/神女控2/          ← 只读研究源（archive/apk/resources_index）
        │  scripts/*.mjs 构建期读取
        ▼
summon-hall/public/archive/             ← 运行时资源（构建选定的白名单子集）
summon-hall/src/data/*.json             ← manifest（含 Provenance 来源元数据）
        │
        ▼
summon-hall/src/
├── data.ts                    # 兼容导出层，逐步变薄
├── data/
│   ├── types.ts               # CardDefinition / StageDefinition / Provenance 等
│   ├── provenance.ts          # 来源等级类型与工具
│   ├── asset-resolver.ts      # AssetRef→URL、fallback、缓存、missingAssets 诊断
│   ├── catalog.ts             # 卡牌目录查询
│   └── *.json                 # cards.runtime / maps / battle-backgrounds / audio / ...
├── systems/
│   ├── battle/                # battle-engine / damage-calc / status-engine / battle-config
│   ├── gacha/                 # gacha-engine（配置驱动）
│   └── progression/
├── logic.ts                   # 现有逻辑，逐步抽到 systems/
└── main.ts                    # 渲染与交互入口（只消费事件，不算伤害）
```

## 2. 关键技术决策

| 决策 | 选择 | 理由 |
|:---|:---|:---|
| 技术栈 | Canvas2D + TS + Vite（现状延续） | 工程已收敛；重平台化掩盖不了数据问题 |
| 资源接入 | 构建期白名单 manifest，运行时不扫目录 | 2.5G 归档不可全量复制；每项来源可审计 |
| 卡牌索引 | `RESOURCE_INDEX.csv` 的 `path`/`files` 为唯一事实源 | 不按文件名猜 H/X/icon 存在性 |
| 卡牌键 | 稳定 `cardKey`（规范化英文名/路径 slug）；旧 id 存 `legacyId` | `card_id_mapping.json` 仅 89 条，不可当全量 ID 表 |
| 数值来源 | 字段级 `Provenance`；无法证明文件的一律 `inferred`/`original-fill` | 禁止冒充逆向恢复 |
| 战斗随机性 | seedable RNG 注入，事件日志可回放 | 相同输入+seed ⇒ 相同日志，可测试 |
| 图片策略 | 网格/编队用 128 icon；详情 lazy-load 640×896 主图 | 首屏性能 |
| localStorage | 现有 key 语义不变，`legacyId` 保证迁移 | 用户存档不损坏 |

## 3. 数据模型（核心类型）

```ts
type DataProvenance = 'direct' | 'wiki-data' | 'native-schema' | 'inferred' | 'original-fill';
interface Provenance { level: DataProvenance; sourceFile?: string; sourceNote?: string; verifiedAt?: string; }

type CardForm = 'main' | 'h' | 'x' | 'evolved';
interface CardAssetRef { role: 'main'|'icon'|'h'|'hIcon'|'x'|'xIcon'|'guildIcon'; asset: string; sourceFile: string; width?: number; height?: number; source: Provenance; }

interface CardDefinition {
  cardKey: string; legacyId?: string; originalCardId?: number; // 仅 89 条已知映射
  name: { en: string; cn?: string };
  rarity: 'N'|'R'|'SR'|'UR'|'LR'|'X'|'VR';
  element: 'Cool'|'Dark'|'Light'|'Passion'|'Special';
  stats: CardStats; skill?: SkillDefinition;
  forms: CardAssetRef[]; quotesRef?: string; availability?: string;
  source: Provenance;
}

interface StageDefinition {
  stageId: string; mapId: string; battleBackgroundId: string; musicId?: string;
  waves: WaveDefinition[];             // original-fill
  encounterType: 'normal'|'boss'|'round'|'king';
  rewards: RewardDefinition[];         // original-fill
  source: Provenance;
}

interface BattleEvent {
  turn: number;
  phase: 'wave-start'|'skill-check'|'attack'|'status'|'death-check'|'wave-clear'|'battle-end';
  actorId?: string; targetId?: string; amount?: number; effectId?: string;
  source: Provenance;
}
```

## 4. 合并管线

```
cards.json (wiki-data)
  + RESOURCE_INDEX.csv (direct asset index)
  + card_id_mapping.json (89 条数字 ID)
  → scripts/build-card-catalog.mjs
  → src/data/cards.runtime.json
  + reports/card-collisions.json / missing-assets.json / quotes-parse.json
```

规则：Wiki 数值不覆盖归档路径；归档路径不覆盖 Wiki 技能/数值；名称冲突进 collisions 报告，禁止静默合并；`has_main_art=false` 进校验报告，不显示破图；`Inactive or Unreleased` 默认不进卡池（manifest 控制）。

## 5. 战斗系统边界

- `battle-config.ts` 集中全部数值常量（属性循环、克制倍率、派生公式），每条标 `original-fill` 或 `inferred`；在用户批准前不宣称原版复原。
- `spec/v2/combat-system.md` 与 `docs/architecture-guidance/03-battle-system.md` 的属性关系描述不一致，统一以 `battle-config.ts` 为可替换配置。
- UI 只消费 `BattleEvent[]`；`renderBattle` 内不重新计算伤害；随机判定不散落在渲染代码。
- APK native 符号（`subParse*`、`BattleTexture::load*`、`GachaTexture::load*`）只证明架构类别，不作为公式/概率证据。

## 6. 抽卡设计边界

- `gacha-config.json`（概率/保底/权重，`original-fill`）与 `gacha-visuals.json`（视觉参考，`direct`/参考）分离。
- UI 显示「离线演示配置」；动画失败仍完成结算；seed 可注入。

## 7. 性能设计

- 图鉴/编队/战斗单位只加载 icon；详情 lazy-load 主图/H/X。
- BGM 单曲加载释放，不预载全部音频。
- RotationLoader LRU 限量缓存（已存在）；大图/sheet 缓存上限。
- Vite 分包处理 500kB chunk 警告。
- 图片加载失败统一 fallback + `missingAssets`/`failedAssets` 诊断。

## 8. 响应式画布

- 设计基准 1280×760；非 16:9 窗口用设计底色/延展背景填充，不出现未经设计的黑色上下条。

## 9. 安全与版权

- 归档/APK 素材仅限私人离线原型；公开或商业发行前替换为自有/授权素材。
- 生产运行时无任何外部 API 请求。

## 10. 回滚方案

- 短分支 + 原子 commit；main 保持可构建可运行；数据 pipeline 全部可由脚本重生成，失败即回到上一 commit。
