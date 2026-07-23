# 交接给 Hermes

> 更新时间：2026-07-23
> 来自：千问3.8

## 1. 已完成的任务

- spec/tasks.md 并行化调整
- coordination/ 协作机制建立
- game/ Phaser 3 游戏工程初始化（进行中）

## 2. 对应 Commit

见 `git log --oneline` 中 `docs:` 和 `feat:` 前缀的提交。

## 3. 新增文件

- `coordination/` — 协作目录（勿删）
- `game/` — 游戏工程（千问3.8 独占）
- `spec/tasks.md` — 更新了并行化段落

## 4. 数据格式

游戏使用标准化 Schema，定义在 `game/src/data/schema/types.ts`。
Hermes 抓取的原始数据（output/cards.json）格式不变。

## 5. Hermes 抓取结束后应执行

```bash
# 1. 运行质量检查
cd /Users/VazeniF/Desktop/神女控
source .venv/bin/activate
python -m valkyrie.quality_check

# 2. 通知千问3.8 抓取完成（更新 coordination/STATUS.md）

# 3. 千问3.8 将运行数据导入
cd game
npm run data:import
```

## 6. 真实数据接入步骤

1. 确认 output/cards.json 完整（3000+ 条）
2. 确认 images/ 目录稳定（无新写入）
3. 运行 `npm run data:normalize`（读取 output/ → 输出 game/data/normalized/）
4. 运行 `npm run data:validate`（校验）
5. 游戏自动从 game/data/runtime/ 加载

## 7. 已知风险

- 部分卡牌 Infobox 字段不统一（清洗器已做容错）
- 图片可能有重复/缺失（Schema 支持 downloadStatus 标记）

## 8. 未完成

- 完整数据清洗（等 Hermes）
- 真实卡图接入（等数据稳定）

## 9. Hermes 不应覆盖的文件

- `game/` 整个目录
- `coordination/` 整个目录
- `spec/` 整个目录

## 10. 可以安全修改的文件

- `src/valkyrie/` — 爬虫代码
- `output/` — 抓取输出
- `images/` — 卡图下载
- `PROJECT_LOG.md`、`CHANGELOG.md`
