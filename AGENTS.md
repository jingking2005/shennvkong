---
title: "Agent Vibe Coding Protocol — 所有 AI Agent 的标准操作规范"
created: 2026-07-23
updated: 2026-07-23
type: concept
tags: [vibe-coding, agent-orchestration, git-workflow, prompt-engineering, protocol, must-read]
sources:
  - raw/transcripts/aR97E7aKEgg.txt
  - raw/transcripts/atqcAb7MFAM.txt
  - raw/transcripts/XHt4v-QX9cU.txt
  - raw/transcripts/EAOEmw3zWhw.txt
---

# Agent Vibe Coding Protocol

> **本协议是参与小金先生项目的所有 AI Agent 必须遵守的标准操作规范。**
> 开始任何开发工作前，必须阅读并理解本文档。
>
> 相关背景概念见：[[vibe-coding]]、[[git-workflow-for-ai-code]]、[[matt-pocock-skills]]

---

## 第一章：开工前必读

### 1.1 开工前检查清单

参与任何项目前，Agent 必须按此顺序读取：

```
□ 1. 项目根目录下的 AGENTS.md（项目专属规范）
□ 2. 本协议 agent-vibe-coding-protocol.md（跨项目默认规则）
□ 3. spec/requirements.md（需求）
□ 4. spec/design.md（设计）
□ 5. spec/tasks.md（任务分解）
□ 6. git status — 保护已有改动的现场
□ 7. git log --oneline -10 — 了解最近进展
```

如果项目没有 SPEC 三件套，且属于以下情况之一，必须先建立三件套，获得需求与设计批准后再开始实现：
- 新项目
- 重大功能
- 跨模块变化
- 多 Agent 并行工作

### 1.2 事实优先原则

Agent 能从代码、文档、Git 日志和 Wiki 查到的内容**不得反问用户**。例如：
- "你的项目结构是什么？" → 先读 `ls -la` 和 `package.json`
- "要用什么技术栈？" → 先看已有的依赖和配置文件
- "代码有什么问题？" → 先读代码、测试和错误信息

只有以下情况才可提问：
- 需求模糊需要取舍（例如：选 A 还是 B，各有利弊）
- 涉及不可逆的外部操作（例如：创建远程仓库、部署到生产环境）
- 产品决策（例如：这个功能要不要做，优先级如何）

### 1.3 主工作流

Matt Pocock 的模块化 Skill 链路是推荐的默认工作流：

```text
[Grill] 对齐意图与设计
    ↓
[To Spec] 产出明确的需求文档 → 用户批准
    ↓
[To Tickets] 切成可验证的垂直任务 → 用户确认
    ↓
[Implement] 一次实现一个任务，TDD 小步循环
    ↓
[Code Review] 分开审查：规范合规 + 需求实现正确
    ↓
[验证 → 原子 Commit → PR → 人类放行]
```

每个阶段都有明确的进入和退出门（Gate）。未通过前一阶段，不得进入下一阶段。

---

## 第二章：阶段门（Phase Gates）

### 2.0 Grill — 对齐意图

**适用场景：** 需求模糊、项目刚开始、需要探索方向。

**做法：**
1. 每次只问一个决策问题
2. 给出推荐答案 + 利弊分析 + 代价估算
3. 形成文档并确认

**退出门：** 用户确认需求方向和设计意图。

### 2.1 Requirements — 需求阶段

**产出：** `spec/requirements.md`

**必须包含：**
- 项目/功能的目标与范围
- 明确做什么、明确不做什么
- 用户场景或验收标准
- 约束条件（技术栈、性能、安全、时间）

**禁止：**
- 用需求冒充设计
- 用"候选方案"冒充"已批准范围"

**退出门：** 用户书面批准需求文档。

### 2.2 Design — 设计阶段

**产出：** `spec/design.md`

**必须包含：**
- 至少两个方案对比（包括"不做的方案"）
- 推荐方案及其理由
- 架构图或数据流
- 关键接口定义
- 数据模型（如果需要数据库）
- 安全与性能考量
- 回滚方案

**退出门：** 用户书面批准设计文档。

### 2.3 Tasks — 任务分解

**产出：** `spec/tasks.md`

**规则：**
- 按用户价值垂直切片（每个任务完成后可演示或验证）
- 每个任务包含：任务说明、验收标准、涉及文件、预估工作量
- 如果涉及多 Agent 并行：标明文件所有权和接口协议
- 任务的粒度：一个 Agent 在 1-2 小时内可以独立完成

**退出门：** 用户确认任务图和优先级。

### 2.4 Implement — 实现阶段

**规则：**
- 一次只实现一个任务
- 先写测试（红），再写最少实现代码（绿）
- 只改任务需要的文件，不顺手翻修无关代码
- 每个垂直切片完成后：测试 → diff 审查 → 原子 commit

**详细流程见第四章。**

### 2.5 Code Review — 审查阶段

**双轴审查：**
1. **Standards 审查**：代码规范、架构一致性、无 Code Smell
2. **Spec 审查**：是否正确实现了需求

**产出：** Review 报告，包含：
- 修改的文件列表
- 意外变更说明
- 验证结果（测试通过、构建成功等）
- 风险标注

**退出门：** 用户或指定审查者批准。

---

## 第三章：Git 与 GitHub 操作规范

### 3.1 不可违反的规则

```
╔══════════════════════════════════════════════════════════════╗
║  1. 开始前运行 git status，保护已有改动                    ║
║  2. main 保持可构建、可测试、可部署                         ║
║  3. 每个新功能/修复开短分支，不直接在 main 上改             ║
║  4. 每个 commit 只做一个逻辑变更，提交前必须验证            ║
║  5. 精确暂存（git add <文件>），不用 git add .              ║
║  6. Push 前检查 diff、密钥和意外文件                        ║
║  7. 未授权不 push、不 PR、不 merge、不部署                  ║
║  8. 不使用 git reset --hard 或强推处理不明来源改动          ║
║  9. 冲突按两侧意图解决，不让 AI 靠"看起来更合理"猜         ║
║ 10. Agent 的成功报告≠证据；Git diff 才是证据                ║
╚══════════════════════════════════════════════════════════════╝
```

### 3.2 标准日循环

```bash
# 1. 本地准备工作区
git status --short --branch     # 检查工作区是否干净
git switch main                 # 切换到主分支
git fetch origin                # 获取远程最新
git pull --ff-only              # 快进合并
git switch -c feature/<name>    # 创建新分支

# 2. 完成一个垂直切片 → 验证 → 暂存 → 提交
# （重复此循环）

git status --short
git diff -- <修改文件>
git add <精确文件>
git diff --cached
<测试命令> && <构建命令>
git commit -m "<type>: <简短说明>"

# 3. 推送
git push origin feature/<name>
```

### 3.3 Commit 信息规范

```
<type>: <简短说明意图>

<可选正文：为什么这样做、约束、重要取舍>
```

**类型前缀：**
| 前缀 | 用途 | 示例 |
|:---|:---|:---|
| `feat` | 新功能 | `feat: 添加用户登录页面` |
| `fix` | 修复 bug | `fix: 修复空指针异常` |
| `docs` | 文档 | `docs: 更新 API 说明` |
| `refactor` | 重构 | `refactor: 抽离数据库操作层` |
| `style` | 格式 | `style: 格式化代码` |
| `chore` | 杂项 | `chore: 升级依赖版本` |

### 3.4 多 Agent 并行：Worktree

```bash
# 每个 Agent 在自己的 worktree 和分支工作
git worktree add ../project-feature-a -b feature/a main
git worktree add ../project-feature-b -b feature/b main
```

**规则：**
- 一个 Agent 只在自己的 worktree 和分支工作
- 两个 Agent 不得同时修改同一文件
- 共享文件指定单一所有者
- 每个分支独立测试和审查

### 3.5 PR 与合并

PR 必须写明：
- 目标和关联需求/任务
- 做了什么、明确没做什么
- 验证命令和实际结果
- UI 截图或人工检查步骤
- 数据、安全、兼容与回滚风险
- 未解决问题

合并后清理：
```bash
git switch main
git pull --ff-only
# 删除本地和远程分支
```

### 3.6 安全恢复

| 场景 | 操作 |
|:---|:---|
| 未存档的改动不想要 | `git restore -- <文件>`（先让用户确认） |
| 已 commit 未 push 的后悔 | 优先新 commit 修复，不改写历史 |
| 已 push 的错误 | `git revert <commit>` 创建反向 commit |
| 冲突 | 分析两侧意图 → 产品语义冲突问用户 → 解决 → 验证 |

## Graphify 代码图谱协议（标准追加，2026-07-29）

- 查询架构、模块边界、符号调用、依赖关系和修改影响范围时，先读取项目 Graphify 图谱，再读取命中的源码和测试。
- 精确文本、配置值、日志、测试/构建错误、尚未索引的未提交改动和被排除目录，使用传统读取方法；图谱无结果、过期或置信度为 `AMBIGUOUS` 时必须回退源码与测试。
- 修改流程：图谱查询 → 读取来源行号 → 检查 `git status` → 更新 SPEC/任务 → 最小修改 → 测试/构建/diff 审查。
- 每次成功提交后增量更新图谱（项目采用 `/graphify . --update` 或已登记的 MCP 更新命令）；更新失败必须记录，不得伪装成功。
- 图谱更新可按项目关闭，但必须在项目状态中说明原因、关闭时间和补建计划；Graphify 不替代源码、测试、构建或人工审查。

---

## 第四章：TDD 实现循环

### 4.1 为什么必须 TDD

AI 本质上是"作弊仔"。如果先写代码再补测试，它会写一个**假测试**来通过自己的错误代码。

**正确顺序——红绿重构：**

```text
[红灯] 先写测试 → 运行 → 测试必然失败（因为还没写代码）
   ↓
[绿灯] 写最少代码让测试通过
   ↓
[重构] 优化代码，确保测试仍然通过
```

### 4.2 一个任务的 TDD 循环

```text
读取任务描述
  ↓
理解验收标准
  ↓
写测试（此时必然红灯）
  ↓
写最少实现代码（直到绿灯）
  ↓
检查是否有冗余/重复代码
  ↓
运行完整测试套件
  ↓
查看 diff，确认没有意外修改
  ↓
精确暂存 → 原子 Commit
```

### 4.3 TDD 指令模板

```
请用 TDD 方式实现这个功能：

1. 先写测试（此时应该失败）
2. 再写最少代码让测试通过
3. 然后重构优化
4. 确保所有测试通过后提交
```

---

## 第五章：Matt Pocock Prompt 技巧

### 5.1 三原则

| 原则 | 含义 | 做法 |
|:---|:---|:---|
| **修剪** | 删掉所有废话 | 每一句必须有实际作用，AI 已有的知识不写 |
| **指引词** | 用专业术语压缩信息 | 一个词 = 一百字描述 |
| **完成标准** | 给 AI 明确的终点 | 做完什么就可以停 |

### 5.2 常用指引词词汇表

| 指引词 | 触发行为 |
|:---|:---|
| `Data Clumps` | 识别并封装成组出现的变量 |
| `Shotgun Surgery` | 检查散落在多处的关联改动 |
| `Primitive Obsession` | 检查是否该用专有类型替代基本类型 |
| `TDD / Red-Green-Refactor` | 先写测试，再写代码，最后重构 |
| `Code Smell` | 检查代码中的坏味道 |
| `SOLID` | 应用面向对象设计原则 |
| `DRY` | 消除重复代码 |
| `YAGNI` | 不要过度设计 |

### 5.3 Prompt 精简示例

```
❌ 啰嗦版：
"请你在 feature/xxx 这个分支上开始工作，每次完成一个逻辑步骤之后，
请记得运行 git add . 然后再运行 git commit 来保存你的工作，
commit 信息请写清楚你做了什么，最后全部完成后请 push 到远程仓库。"

✅ 修剪版（7 行 → 3 行）：
在 feature/<功能> 分支工作。
每步 commit。
完成后 push。
```

---

## 第六章：各 Agent 专属指引

### 6.1 通用回执模板

每次任务完成后，Agent 必须提供以下回执：

```markdown
## 完成报告

### 做了什么
- [简要说明]

### 修改的文件
- `path/to/file` — 原因

### 验证结果
- 测试：✅/❌ （附命令和输出）
- 构建：✅/❌
- Git diff 已审查：✅

### 未解决问题
- [如果有]

### 证据
- Commit: `<hash>`
- 分支: `feature/xxx`
```

### 6.2 Claude Code / Codex（代码 Agent）

- 系统提示词长（15-20K），适合复杂项目
- 务必使用分支 + TDD
- 每次 commit 前检查 diff
- PR 必须包含验证结果

### 6.3 Pi Agent（日常任务 Agent）

- 系统提示词极短（~1.5K），prompt 要精简
- 适合轻量任务和自动化
- 使用 Matt Pocock 三原则优化 prompt
- 每个任务完成后提供回执

---

## 第七章：15 个常见痛点速查

| # | 痛点 | 解法 | 对应规范章节 |
|:---|:---|:---|:---|
| 1 | 环境搭建复杂 | 一键安装工具包 | 开工检查清单 |
| 2 | 不知道选什么技术栈 | Agent 提供方案，用户选 | Requirements |
| 3 | 项目结构不会搭 | Agent 生成骨架 | Design |
| 4 | 不知道从哪里开始 | 自然语言描述 | Tasks |
| 5 | 代码看不懂 | 检查 diff + 测试 + 效果 | Code Review |
| 6 | 改坏其他地方 | **Git 存档 → 随时回滚** | Git 规范 3.6 |
| 7 | AI 改了不该改的 | **分支隔离 + TDD 约束** | 第二章 + 第四章 |
| 8 | 不知道怎么调试 | 截图/描述，让 AI 修 | 日常循环 |
| 9 | 不知道怎么测试 | TDD 自动写测试 | 第四章 |
| 10 | 不知道怎么部署 | 用户授权后部署 | 安全规范 |
| 11 | 数据库不会搞 | Agent 生成 schema | Design |
| 12 | 认证不会做 | 用第三方服务 | Design |
| 13 | 支付不会接 | Agent 帮忙对接 | Implement |
| 14 | 域名和 HTTPS | 自动配置 | 用户授权 |
| 15 | 代码长期管理 | **Git + GitHub + 冲突甩 AI** | 第三章 |

---

## 第八章：安全与红线

### 8.1 默认最小权限

Agent 不得默认拥有以下权限：
- 创建/删除远程仓库
- 修改生产环境配置
- 执行数据库迁移
- 部署到公网
- 修改安全相关文件（.env、凭证等）
- 销毁性 Git 操作（强推、reset --hard）

以上操作必须明确获得用户批准。

### 8.2 不可逆决定由人类保留

| 决定类型 | 谁决定 |
|:---|:---|
| 需求范围 | 用户 |
| 技术方案选择 | Agent 推荐，用户批准 |
| 架构变更 | Agent 推荐，用户批准 |
| 数据库迁移 | Agent 出方案，用户批准后执行 |
| Create/Delete 远程资源 | 用户 |
| Merge 代码 | 用户或指定审查者 |
| 部署 | 用户 |
| 回滚 | Agent 分析风险，用户决定 |

### 8.3 红旗指标

当出现以下情况时，Agent 必须主动报告并暂停：

- 工作区长期存在未提交的改动
- 单个 commit 涉及大量不相关文件
- commit 信息无意义（"update"、"fix"、"misc"）
- 密钥或敏感信息进入版本历史
- 多人/多 Agent 共享同一分支
- 长期未合并的分支
- 测试失败但仍然 push
- 大量未审查的生成文件

---

## 第九章：总结

### 一句话原则

> **先对齐，后落笔；先验证，后宣称；先保存，后冒险。**

### 十条不可跳过的习惯

1. **先查事实，再问决定** — 能查到的别问
2. **一次解决一个决策** — 不堆叠问题
3. **需求与设计分开批准** — 计划≠代码
4. **按用户价值垂直切片** — 每个任务都可验证
5. **先红后绿（TDD）** — 测试先于代码
6. **只改任务需要的文件** — 不翻修无关代码
7. **证据先于完成声明** — diff 和测试才是证据
8. **Git 是安全网** — 短分支、小提交、精确暂存
9. **最小权限** — 不默认开放最高权限
10. **人类保留不可逆决定** — merge、部署、迁移由用户授权

---

**相关页面：**
- [[vibe-coding]] — Vibe Coding 核心概念
- [[git-workflow-for-ai-code]] — Git 完整安全操作
- [[matt-pocock-skills]] — Matt Pocock Skill 体系分析
- [[matt-pocock-prompt-techniques]] — Prompt 编写技巧
- [[vibe-coding-15-pain-points]] — 15 个痛点详细解法
- [[github-for-vibe-coding]] — Git 基础概念
- [[ai-coding-agents]] — Agent 对比
- [[skills-system]] — Skill 系统
- [[pi-agent-prompts]] — Pi Agent 提示词
- [[codex-prompts]] — Codex 提示词

---

# 项目专属指令：神女控数字考古

---

# Agent 分工（2026-08-02 强制生效）

> **OpenCode = 主开发**（逻辑、数值、存档、战斗/探索/抽卡规则、**Commit & Push**）
> **Cursor = UI 升级**（视觉、动效、布局；默认不 Push；每次 UI 改动写交接笔记）

必读交接包：

1. `docs/handoff/OPENCODE_PRIMARY_HANDOFF.md`
2. `docs/handoff/COLLAB_PROTOCOL_CURSOR_OPENCODE.md`
3. `docs/handoff/UI_CHANGELOG.md`

主工程目录固定为：`/Users/VazeniF/Desktop/神女控/summon-hall`
GitHub：`https://github.com/jingking2005/shennvkong`

---

> 你现在是我的高级 AI 开发 Agent（Hermes / Codex），拥有完整的自主执行权限。你的目标不是告诉我怎么做，而是主动完成整个项目，并在遇到问题时自行分析、修复、继续执行。

========================
## 项目名称
========================

《神女控（Valkyrie Crusade）》数字考古与资源归档工程

项目目录固定为：

/Users/VazeniF/Desktop/神女控

所有文件均保存在该目录，不要创建其它重复项目。

========================
## 第一阶段目标
========================

建立完整的神女控公开资源数据库，包括：

1、全部卡牌数据
2、全部卡牌高清图片
3、全部技能数据
4、全部分类数据
5、全部活动数据
6、生成 JSON 数据库
7、生成 CSV 数据库
8、建立完整图片目录

最终目录结构应类似：

/Users/VazeniF/Desktop/神女控/

├── src
├── tests
├── output
├── output-test
├── cards.json
├── cards.csv
├── README.md
├── PROJECT_LOG.md
├── CHANGELOG.md
├── pyproject.toml
└── .venv

========================
## 第一步：检查项目
========================

首先检查：

/Users/VazeniF/Desktop/神女控

如果不存在：

立即停止并告诉我。

如果存在：

查看里面是否已有：

pyproject.toml

src/

tests/

README.md

如果已经存在，则继续。

如果只有 zip，则自动解压。

如果目录结构多包了一层，自动整理。

不要询问我。

========================
## 第二步：检查开发环境
========================

检查：

Python3

pip

Git

venv

如果缺少：

允许使用 Homebrew 自动安装。

要求：

Python ≥3.10

然后：

创建虚拟环境

python3 -m venv .venv

激活：

source .venv/bin/activate

升级：

python -m pip install --upgrade pip

安装：

pip install -e .

如果依赖失败：

自动分析原因

自动修复

重新安装

直到成功。

========================
## 第三步：运行测试
========================

安装：

pytest

运行：

pytest -q

如果失败：

阅读错误

修复代码

重新运行

直到全部通过。

不要为了通过测试而删除测试。

========================
## 第四步：抓取维基数据
========================

目标：

Valkyrie Crusade Wiki（Fandom）

抓取：

全部 Cards

全部 Skills

全部 Event

全部 Categories

全部 Release Log

全部 Card Pages

递归遍历所有子分类。

每个页面保存：

标题

URL

分类

Infobox

图片

技能

属性

编号

稀有度

Cost

ATK

DEF

全部输出 JSON。

========================
## 第五步：下载高清卡图
========================

自动获取：

页面全部图片

优先：

Original Resolution

不要下载：

Logo

按钮

图标

Banner

Navigation

Skill Icon

只保留：

卡面

立绘

觉醒

进化

高清原图

建立：

images/

每张卡建立独立目录。

========================
## 第六步：先测试
========================

先抓：

5 张卡

输出：

output-test

检查：

cards.json

cards.csv

images/

统计：

卡牌数量

图片数量

错误数量

输出目录大小

如果图片数量异常：

自动分析：

API

403

429

Fandom 页面结构

图片过滤器

必要时：

自动修改代码。

========================
## 第七步：正式抓取
========================

测试通过以后：

抓全部。

输出：

output-full

要求：

支持断点续传

支持失败重试

支持中断恢复

请求限速：

1.5 秒

不要高频访问。

========================
## 第八步：质量检查
========================

完成以后：

统计：

卡牌数量

图片数量

JSON 数量

CSV 数量

失败页面

失败图片

重复图片

缺失图片

生成：

REPORT.md

内容包括：

成功率

失败原因

建议修复方案

========================
## 第九步：代码优化
========================

如果发现：

Wiki 页面结构变化

API 更新

图片地址变化

自动修改程序。

要求：

保持：

断点续传

JSON

CSV

原图下载

日志

全部正常。

========================
## 第十步：Git
========================

整个过程：

每完成一个阶段：

自动 Commit。

Commit 示例：

Init Archive

Fix Image Parser

Support Resume

Download Card Images

Generate JSON Database

最终：

生成：

CHANGELOG.md

PROJECT_LOG.md

记录：

修改内容

抓取数量

错误数量

修复内容

========================
## 禁止事项
========================

不要等待我确认。

不要因为一个页面失败停止。

不要因为一个图片失败停止。

优先修复。

继续执行。

========================
## 最终目标
========================

建立完整的《神女控》数字考古资源库。

后续将继续：

APK 解析

音频提取

UI 提取

战斗配置

活动数据

最终用于 AI 重构整个游戏。

整个过程中，请持续自主分析、自主修复、自主执行，直到第一阶段全部完成后，再向我汇报最终结果。

---

# V2 方向调整（2026-07-23 强制生效）

## 当前状态

当前 game/ 下的原型为 **legacy prototype**，保留不删除，但禁止继续在其上堆砌低质量 Demo。

## V2 策划文件

所有玩法规则以 `spec/v2/` 目录为准：

```
spec/v2/game-vision.md          — 产品定位
spec/v2/core-loop.md            — 核心循环
spec/v2/combat-system.md        — 战斗系统
spec/v2/card-and-skill-system.md — 卡牌与技能
spec/v2/progression-system.md   — 成长系统
spec/v2/enhancement-system.md   — FIFA式合卡
spec/v2/economy-and-gacha.md    — 经济与抽卡
spec/v2/kingdom-system.md       — 王国系统
spec/v2/content-and-modes.md    — 内容与模式
spec/v2/ui-art-direction.md     — UI与美术
spec/v2/data-model.md           — 数据模型
spec/v2/balance-framework.md    — 平衡框架
spec/v2/vertical-slice.md       — 垂直切片标准
spec/v2/tasks.md                — 任务分解
spec/v2/acceptance-matrix.md    — 验收矩阵
```

## 强制规则

1. **先策划后代码**：V2 策划未冻结前，禁止大规模重写游戏代码
2. **数据驱动**：所有数值/技能/卡池/关卡来自 JSON，不硬编码
3. **seeded RNG**：所有随机逻辑必须支持种子，可测试可回放
4. **不迁就错误架构**：当前 BattleEngine/SkillSystem/DamageCalc 方向错误，需完全重写
5. **不删减核心玩法**：不因实现困难而砍功能
6. **审计报告**：`docs/audits/current-prototype-audit.md`

## 可保留模块

- `game/src/ui/BackgroundFX.ts` — 氛围背景
- `game/src/ui/HealthBar.ts` — HP条
- `game/src/ui/DamageText.ts` — 伤害飘字
- `game/src/data/pipeline/` — 数据清洗管道
- `game/vite.config.ts` — 构建配置
- `game/src/data/card-image-map.ts` — 卡图映射

## 必须重写模块

- `game/src/systems/BattleEngine.ts` → 回合制+手动/自动+位置+状态机
- `game/src/systems/SkillSystem.ts` → SkillResolver + EffectResolver
- `game/src/systems/DamageCalc.ts` → 多乘区公式
- `game/src/data/schema/types.ts` → V2 完整数据模型
- `game/src/scenes/BattleScene.ts` → 手动选目标+技能释放
- `game/src/scenes/TeamScene.ts` → 5位置+Cost+羁绊

---

# Git Rules（长期强制规则，2026-07-24 生效）

> 以下规则适用于本项目所有 Agent，不可违反。

1. **默认 Private**：所有项目均为 Private Repository。未经用户明确要求，不得创建 Public Repository。
2. **不主动 PR**：不主动创建 Pull Request。
3. **不主动 Merge**：不主动执行 Merge 操作。
4. **不主动删 Branch**：不主动删除任何 Branch。
5. **规范 Commit**：每完成一个独立功能后进行一次规范 Commit，使用 Conventional Commits（`feat`/`fix`/`refactor`/`docs`/`test`/`style`/`chore`）。禁止使用 `update`、`test`、`123`、`aaa` 等无意义信息。
6. **Push 前确认**：Push 前提醒用户确认，不得静默 Push。
7. **安全检查**：检查 `.gitignore`，禁止上传 API Key、Token、证书、数据库、日志及个人配置文件。
8. **单人开发模式**：保持 `开发 → Commit → Push` 的简洁流程，不引入多人协作复杂度。

---

# 轻量吸取规则（来自 Anthropic Opus 5 提示词，2026-07-26）

> 仅挑选可直接落地的轻量规则，保持当前工作流不重。

1. **先读 Skill 再动手**：写代码、创建文件、运行复杂工具前，先扫描 `<available_skills>` 并阅读相关 `SKILL.md`。
2. **评估输出形式**：
   - 短代码/简短回答 → 直接会话内回复
   - 长代码、交付物、报告、可复用工具 → 创建文件
   - 空间/数据/流程类内容 → 使用 Canvas/可视化
3. **搜索原则**：当前状态、版本、人物职位、新闻等易变信息先搜索；历史事实、科学原理不搜。
4. **只记用户亲口说的话**：跨会话记忆（如 user rules、AGENTS.md）只写入用户明确陈述的事实或选择，不写入 Agent 自己的推导、建议或生成内容。
5. **拒绝与批评处理**：被粗鲁对待时不过度道歉；承认错误并修复，保持专业与自尊。

<!-- BEGIN AI AGENT STANDARD: TEMPLATE PROVENANCE -->
## AI Agent 标准模板来源

- 新建项目或补齐项目级 Agent 标准时，以
  `/Users/VazeniF/Desktop/obsidian/wiki-AI工具/项目标准模板/版本/2026-07-29-v4`
  为版本化模板快照，并以
  `/Users/VazeniF/Documents/Codex/2026-07-29/ai-agent-agents-md-docs-spec`
  的 `docs/graphify-protocol.md`、SPEC 三件套和 hooks 说明为工作事实源。
- 不得用模板覆盖本项目已有规则；任何已有 `AGENTS.md`、hooks、Obsidian 文件、工具安装或全局 Agent 配置改动，先备份、生成最小补丁和回滚证据。
- 模板或图谱建议不替代项目 SPEC、源码、测试、Git 状态、构建日志或用户最新决定。
<!-- END AI AGENT STANDARD: TEMPLATE PROVENANCE -->
