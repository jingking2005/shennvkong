# 技术决策记录

## D1: 游戏目录隔离

- 决策：游戏工程放在 `game/` 子目录，与 Phase 1 Python 项目完全隔离
- 原因：避免 node_modules 与 .venv 冲突，避免 package.json 与 pyproject.toml 混淆
- 日期：2026-07-23

## D2: 数据三层架构

- 决策：raw → normalized → runtime 三层数据流
- raw: Hermes 抓取的原始 output/cards.json（只读）
- normalized: 清洗后的标准格式（game/data/normalized/）
- runtime: 游戏直接加载的精简数据（game/data/runtime/）
- 原因：游戏不直接依赖 Hermes 的写入目录，避免文件锁/不完整读取

## D3: Mock 数据策略

- 决策：使用 12 张手写 Mock 卡牌（覆盖 4 属性 × 3 稀有度）
- 原因：不依赖任何正在下载的文件，开发可立即开始
- Mock 数据位于：game/src/data/fixtures/mock-cards.json

## D4: 卡牌 ID 策略

- 决策：使用 slug（名称小写+连字符）作为稳定 ID，如 `goddess-athena`
- 原因：Wiki 页面标题唯一，slug 化后可作文件名和 key

## D5: 图片路径策略

- 决策：runtime 数据中图片路径为相对路径 `assets/cards/{slug}.png`
- 原因：Vite 打包时统一处理，不依赖绝对路径

## D6: 测试框架

- 决策：Vitest（与 Vite 原生集成）
- 原因：无需额外配置，支持 TypeScript，HMR 测试

## D7: 本地存档

- 决策：localStorage，key 为 `valkyrie-crusade-save`
- 原因：MVP 无需后端，刷新后可恢复进度
