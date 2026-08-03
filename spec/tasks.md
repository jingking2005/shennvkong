# 神女控 — 任务分解

> 状态：已确认（2026-08-03，随变更单冻结）
> 创建：2026-07-23；重写：2026-08-03（OC-00）
> 依赖：spec/requirements.md、spec/design.md
> 旧 T1–T10（Phaser 方向）与 v2/tasks.md 全部作废；`game/`、`src/valkyrie/` 已删除。

---

## 任务依赖图

```
OC-00（本文件）→ OC-01 稳定性 → OC-02 数据基础设施 → OC-03 资源 manifest
                                                    ↘ OC-04 卡牌 catalog
                              OC-03+OC-04 → OC-05 关卡接线 → OC-06 战斗引擎
                                            OC-07 抽卡引擎（可与 OC-05/06 并行）
                                            OC-08 BGM/SE/剧情（依赖 OC-03）
                                            OC-09 王国/武器（全部稳定后）
```

---

## OC-00：规格冻结与证据登记 ✅ 已完成（2026-08-03）

- **所有者**：OpenCode
- **产出**：本三件套；变更单只读引用
- **验收**：三件套写明 Canvas2D 路线、资源策略、来源等级、非目标和用户批准状态 ✅

## OC-01：运行稳定性与启动烟雾测试 ✅ 已完成（2026-08-03，commit 310db37）

- **所有者**：OpenCode
- **可修改文件**：`summon-hall/src/main.ts`、`src/background.ts`、`src/assets.ts`、`src/audio.ts`、测试文件
- **禁止**：无关 UI 重设计、切换引擎
- **任务**：
  1. 响应式画布：16:9/宽屏/窄屏稳定布局，黑色留边改为设计底色填充
  2. 图片/音频/字体失败统一日志 + fallback
  3. Playwright 最小烟雾脚本：覆盖首页与主要页面切换，收集 Console Error/Warning
- **验收**：60 秒 Console 0 Error/Warning；页面切换不白屏；失败资源可定位
- **预估**：2-3h

## OC-02：数据类型、来源与 manifest 基础设施 ✅ 已完成（2026-08-03）

- **所有者**：OpenCode
- **可修改文件**：新增 `src/data/types.ts`、`provenance.ts`、`asset-resolver.ts`、`catalog.ts` 及测试；`src/data.ts` 仅留兼容层
- **禁止**：改变现有 localStorage key 语义
- **任务**：Provenance 类型；AssetRef→URL 解析；缓存与 missingAssets 诊断；`npm run data:validate` 骨架
- **验收**：data:validate 能报告缺失/重复/非法引用；旧页面经兼容层正常读卡
- **预估**：2-3h

## OC-03：归档资源 manifest 构建管道 ✅ 已完成（2026-08-03）

- **所有者**：OpenCode
- **可修改文件**：新增 `scripts/build-archive-manifests.mjs`、`src/data/maps.json`、`battle-backgrounds.json`、`audio.json`、`battle-effects.json`、`items.json`；只向 `public/archive/` 写白名单文件
- **禁止**：复制归档根目录；修改 `神女控2` 归档
- **任务**：显式选择生成 manifest；地图与战斗背景分离；记录 sourceFile/URL/尺寸；`npm run data:build`
- **验收**：地图页用 AreaMap；战斗页用 BattleBG；manifest 可复现生成
- **预估**：2h

## OC-04：卡牌 catalog、形态、icon 与引文 ✅ 已完成（2026-08-03）

- **所有者**：OpenCode
- **可修改文件**：新增 `scripts/build-card-catalog.mjs`、`src/data/cards.runtime.json`、`card-quotes.json`、测试；`src/data.ts`、`src/card.ts` 必要接口
- **禁止**：删除 Wiki 数据；给缺失 H/X/icon 补假路径
- **任务**：读 RESOURCE_INDEX.csv；先接 6 张垂直切片（Fenrir / Aisha / Mage Emilie / Seir / Madeline / Sjofn）；主图/icon/H/X 用途明确；collisions/missing/quotes 报告；legacyId 迁移
- **验收**：图鉴网格只请求 icon；详情可切换实际存在的形态；6 张样卡引文可展示；缺图不白屏
- **预估**：3-4h

## OC-05：地图、探索、出击和战斗场景接线 ✅ 已完成（2026-08-03）

- **所有者**：OpenCode
- **可修改文件**：`src/logic.ts`、`src/assets.ts`、`src/main.ts` 状态接线部分、新增 `src/data/stages.json`
- **禁止**：把文件编号当敌人/卡牌 ID；宣称原创关卡为原版恢复
- **任务**：3 张地图关卡切片；每切片绑定确定的 battleBg/BGM/wave/奖励（全标 original-fill）；统一 stage→map→battleBg→audio 引用链
- **验收**：地图选关进战斗；背景不混用；结束返回记录页且存档一致
- **预估**：2-3h

## OC-06：纯战斗引擎与可回放日志 ✅ 已完成（2026-08-03）

- **所有者**：OpenCode
- **可修改文件**：新增 `src/systems/battle/*` 及测试；`src/logic.ts` 适配层
- **禁止**：重新设计 UI；把推断公式命名为 original
- **任务**：抽出伤害/速度顺序/技能判定/状态/死亡/wave/奖励事件；RNG 注入 seed；常量集中 battle-config.ts 并标来源
- **验收**：相同 seed 事件日志完全一致；normal/boss/round/king 四类 fixture；覆盖 1/5/0 单位边界
- **预估**：3-4h

## OC-07：抽卡引擎、动画与经济边界 ✅ 已完成（2026-08-03，commit 6daff8d）

- **所有者**：OpenCode
- **可修改文件**：`src/gacha.ts`、新增 `src/systems/gacha/gacha-engine.ts`、`gacha-config.json`、`gacha-visuals.json` 及测试
- **禁止**：Nubee API/支付/广告/在线抽卡；声称概率是原版
- **验收**：seedable；概率配置独立；动画与结算解耦；刷新后 localStorage 一致；UI 显示「离线演示配置」
- **预估**：2h

## OC-08：BGM、SE 与故事切片

- **所有者**：OpenCode
- **可修改文件**：`src/audio.ts`、新增 `scripts/parse-event-stories.mjs`、`src/data/stories.json`、story viewer 逻辑
- **禁止**：把未知 speaker 臆造为角色名
- **任务**：5 首 BGM（bgm_001/002/004/007/005）+ 4 类 SE（UI 点击/普攻/技能/胜负）按 manifest 播放；解析并展示 2 篇 DRV + 1 篇 Archwitch；阅读位置存档；异常 HTML 进报告
- **验收**：音频按 manifest 播放；3 篇剧情可加载翻页存进度
- **预估**：3h

## OC-09：王国、武器、公会内容分层（后续）

- **所有者**：OpenCode
- **前置**：OC-02~OC-08 全部稳定
- **任务**：王国建筑/武器素材目录预览 + 原创数值；不混入核心战斗切片
- **禁止**：公会在线功能、PvP、排行榜、原版服务器接入

---

## 文件所有权

| 目录/文件 | 所有者 |
|:---|:---|
| `summon-hall/src/**` | OpenCode |
| `summon-hall/scripts/**` | OpenCode |
| `spec/` | OpenCode（本变更） |
| `AGENTS.md` | 用户（小金先生） |
| 逆向变更单 | 只读 |
| `/Users/VazeniF/Desktop/神女控2/` | 只读研究源 |

## 每个任务的完成定义（DoD）

1. `npx tsc --noEmit` 通过
2. 相关 `npm run data:*` / `npm run test` 通过
3. `npm run build` 通过
4. 浏览器烟雾测试通过（涉及页面时）
5. 证据路径写入本文件对应任务，原子 commit
