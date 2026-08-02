# UI 变更日志（Cursor → OpenCode）

OpenCode 主开发后，Cursor 每次 UI 改动都在此登记，并在 `ui-notes/` 写详情。

**协议：** [`COLLAB_PROTOCOL_CURSOR_OPENCODE.md`](./COLLAB_PROTOCOL_CURSOR_OPENCODE.md)

---

## 索引（新在上）

| 日期 | 笔记 | 摘要 | 逻辑是否改动 |
|:---|:---|:---|:---|
| 2026-08-02 | [`ui-notes/2026-08-02_baseline.md`](./ui-notes/2026-08-02_baseline.md) | 交接基线：当前 UI/素材/已知视觉债 | 否（基线说明） |

---

## 笔记模板（复制到 ui-notes/）

```markdown
# UI 交接 YYYY-MM-DD — 短标题

**作者：** Cursor
**分支：** （若有）
**关联协议：** docs/handoff/COLLAB_PROTOCOL_CURSOR_OPENCODE.md

## 1. 修改文件
- `summon-hall/src/...`

## 2. 玩家可感知变化
- …

## 3. 逻辑改动？
- [ ] 无
- [ ] 有（详述，请 OpenCode 审查）

## 4. 验证步骤
1. npm run dev → localhost:3100
2. …

## 5. 风险 / 未完成
- …

## 6. 请 OpenCode follow-up
- [ ] commit & push
- [ ] …
```
