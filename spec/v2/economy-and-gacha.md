# 神女控 V2 — 经济与抽卡系统

## 资源类型

| 资源 | 用途 | 主要来源 | 主要消耗 |
|:---|:---|:---|:---|
| Gold | 升级/技能升级/强化 | 战斗/关卡/王国Farm | 养成消耗 |
| Ether | 魔法建筑/技能研究/觉醒 | 王国EtherFurnace/关卡 | 建筑/觉醒 |
| Iron | 王国建筑/防御 | 王国IronWorks/关卡 | 建筑升级 |
| Jewels | 高级抽卡/扩容/便利 | 成就/活动/首次通关 | 高级召唤 |
| FriendshipPoints | 普通召唤 | 伙伴协助/日常/任务 | 普通召唤 |
| RareMedals | 技能升级/高级兑换 | 分解重复卡/活动 | 技能升级 |
| Stamina | 剧情/资源关卡 | 自然恢复/道具 | 进入关卡 |
| BattlePoints | 竞技/Boss/活动 | 日常/活动 | 特殊模式 |

附加材料：AwakeningMaterials, RebirthMaterials, EnhancementProtection

## 经济原则

- 禁止只产出不消耗的死资源
- 禁止所有养成全部依赖 Jewels
- 单机版不以真实付费为前提
- 每种资源必须有来源表和消耗表

## 抽卡系统

### 卡池类型

1. **普通召唤** — FP，产出 N/R/少量SR/经验材料
2. **高级召唤** — Jewels/券，R 及以上
3. **十连召唤** — 至少一张保底稀有度 + 完整动画 + 跳过
4. **Box Summon** — 固定总量，抽走不重复，可查看剩余
5. **活动召唤** — 限定卡 + 活动加成
6. **Select Summon** — 出现两张选一张

### 卡池数据驱动

bannerId, currency, cost, pool, weights, guarantees, pity, startAt, endAt, featuredCards, duplicateConversion

### 保底机制

- SR 保底（N 次必出）
- UR 保底（N 次必出）
- 高稀有度累计保底
- 抽到最高稀有度后重置
- 概率公示

### 重复卡用途

Evolution / Enhancement / Skill升级材料 / 分解为RareMedal / 收藏突破
