# 神女控 — 需求文档

> 状态：已批准（2026-08-03，小金先生口头批准变更单方向，三项决策项取文档推荐默认值）
> 创建：2026-07-23；重写：2026-08-03（OC-00，依逆向工程变更单冻结）
> 项目路径：/Users/VazeniF/Desktop/神女控
> 主工程：/Users/VazeniF/Desktop/神女控/summon-hall
> 依据文档：`/Users/VazeniF/Documents/Codex/2026-08-03/users-vazenif-desktop-2-archive-final/outputs/神女控_OpenCode_逆向工程开发需求变更文档.md`（只读）

---

## 项目总目标

对已停服手游《神女控（Valkyrie Crusade）》进行数字考古，基于 APK 8.1.1 与 Final Archive（2022-09-16）的证据，把现有离线 Canvas2D/Vite 原型（summon-hall）改造为数据可追溯、资源可清单化、战斗可回放的商业级工程质量离线应用。

---

## 已批准的决策项（变更单 §11）

1. **技术栈**：继续 Canvas2D + TypeScript + Vite 增量重构；不回 Phaser，不迁 React/Tauri/Unity，不复活已删除的 `game/`。
2. **素材使用**：私人离线原型阶段允许使用本机 APK/Final Archive 素材；未来若公开或商业发行，先替换为自有/授权素材。
3. **切片策略**：先做「6 张卡牌 + 3 张地图 + 4 类战斗模式 + 3 篇剧情」垂直切片，再用同一 pipeline 扩展全量，不一次性导入全部文件。

---

## 当前阶段范围（本变更）

### 做什么

1. **数据与资源清单化**（manifest 化）
   - 地图：`Battle/Map/AreaMap_*.png` → `public/archive/map/` + `src/data/maps.json`
   - 战斗背景：`Battle/Background/BattleBG_*.png` → `public/archive/battle-bg/` + `src/data/battle-backgrounds.json`
   - 卡牌：`RESOURCE_INDEX.csv` 驱动，主图/H/X/icon/Quotes 按实际文件存在性接入 → `src/data/cards.runtime.json` + `card-quotes.json`
   - 音频：5 首 BGM + 4 类 SE → `public/archive/bgm|se/` + `src/data/audio.json`
   - 战斗效果/卡牌符号/道具 → 对应 manifest
2. **来源可追溯**：所有数据对象携带 `Provenance`（`direct` / `wiki-data` / `native-schema` / `inferred` / `original-fill`），字段级记录，禁止混写。
3. **战斗引擎纯逻辑化**：从 `src/logic.ts` 抽出 `src/systems/battle/*`（engine/damage-calc/status-engine/battle-config），seedable RNG，输出可回放 `BattleEvent[]` 日志；覆盖 normal/boss/round/king 四种本地模式。
4. **抽卡引擎配置化**：概率/保底/权重迁入 `gacha-config.json`，标 `original-fill`；动画与结算解耦；seed 可注入。
5. **内容垂直切片**：6 张样卡（Fenrir/Aisha/Mage Emilie/Seir/Madeline/Sjofn）、3 张地图关卡、3 篇剧情（2 篇 DRV/主线 + 1 篇 Archwitch）。
6. **工程质量**：启动烟雾测试（Playwright）、`npm run data:build` / `data:validate` / `test`、响应式画布（无未设计黑边）、资源加载失败 fallback 可定位。
7. **规格冻结**：本三件套取代旧 Phaser 方向文档；`spec/v2/` 保留为历史参考，其中数值/公式一律视为 `inferred`。

### 不做什么（非目标）

- 不接入 Nubee/cloudfront/Firebase/Tapjoy/支付/广告/在线登录/原游戏 API/私服
- 不做公会在线功能、PvP、排行榜、付费货币交易
- 不解密/绕过 APK 保护，不重打包 APK
- 不让 Web 运行时解析 `.valb/.htb/.gui/.txa`
- 不把 2.5G 归档复制进仓库或首屏加载全量卡图
- 不宣称任何公式、概率、保底、敌人配置为「原版恢复」（全部 `inferred` 或 `original-fill`）
- 不做大规模 UI 重设计（OC-01 只允许稳定性修复）

---

## 验收标准（汇总，明细见变更单 §8）

### 工程

- `npx tsc --noEmit` / `npm run data:build` / `npm run data:validate` / `npm run test` / `npm run build` 全部通过
- Vite chunk 警告有处理方案或经批准的阈值记录
- 不修改归档源目录；精确暂存，不用 `git add .`

### 运行

- 首屏/召唤/地图/出击/战斗/编队/图鉴/库存/商店均可进入返回
- 60 秒 Console 0 Error/Warning（自动烟雾测试证明，不靠人工刷新）
- 16:9/宽屏/窄屏无未经设计的黑色留边
- 资源请求全部来自项目 `public/`；刷新后 localStorage 存档不损坏

### 资源

- 地图页请求 `AreaMap_*`，战斗页请求 `BattleBG_*`，二者不混用
- 图鉴网格只请求 `*_icon.png`，详情 lazy-load 主图，H/X 仅在存在时显示
- BGM/SE/战斗符号/APK texture 均经 manifest 接入

### 逻辑

- 相同 seed → 相同抽卡结果与战斗事件日志
- 伤害公式常量全部可追溯至 `battle-config.ts` 并标来源等级
- stage 的 map/battleBg/BGM/reward 引用无悬空
- 胜利/失败/跳过动画/刷新恢复均不重复发奖

---

## 约束

- 运行时代码只读 `public/`，禁止引用 `/Users/VazeniF/Desktop/神女控2/`
- 构建脚本可读本机归档，产出物必须可复现生成
- 归档素材使用全部在 manifest 可追溯，禁止无来源散落复制
- Git 规则遵守 AGENTS.md：Conventional Commits、Push 前确认、短分支
