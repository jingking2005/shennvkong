# 神女控 V2 — 战斗系统

## 战斗模式

- 五卡队伍 vs 敌方队伍（1-5 单位）
- 回合制，速度排序决定行动顺序
- 支持手动战斗和自动战斗
- 自动战斗可在重要技能就绪时暂停（可配置）
- 所有随机行为支持 seed

## 回合结构

```
回合开始
  → 触发"回合开始"类被动/自动技能
  → 按速度排序，逐个单位行动：
      → 检查控制状态（眩晕/沉默/跳过）
      → 触发"行动前"类被动
      → 玩家选择/自动释放就绪技能（可多个）
      → 执行普通攻击（每回合一次）
      → 触发"行动后"类被动
      → 结算持续效果（DoT/HoT/倒计时）
  → 检查胜负
回合结束
```

## 玩家交互（手动模式）

1. 当前行动单位高亮
2. 玩家可点击就绪技能按钮释放（不消耗普攻次数）
3. 玩家选择普攻目标（点击敌方单位）
4. 技能目标根据 targetType 自动或手动选择
5. 确认后执行动画

## 位置系统

五个队伍位置：前排左、前排右、中排左、中排右、后排中心

规则：
- 普通攻击默认打前排
- 前排全灭后打中排，中排全灭后打后排
- 群体技能不受位置保护
- 部分技能可指定打后排
- 坦克嘲讽可强制目标
- 阵亡后位置空出，不递补

## 伤害公式

```
rawDamage = attacker.attack × skillMultiplier × randomVariance
mitigation = defender.defense / (defender.defense + DEF_CONSTANT)
finalDamage = max(1, floor(
  rawDamage × (1 - mitigation)
  × elementMultiplier
  × buffMultiplier
  × vulnerabilityMultiplier
  × criticalMultiplier
  - shieldAbsorb
))
```

参数：
- randomVariance: [0.95, 1.05]
- DEF_CONSTANT: 配置化（建议初始 500）
- elementMultiplier: 克制 1.5 / 被克 1.5 / 无关 1.0
- criticalMultiplier: 1.0 + criticalDamage（默认暴击伤害 50%）
- 多段技能逐段结算
- 护盾优先吸收
- 斩杀在普通伤害后判断

## 治疗公式

```
healAmount = floor(
  (caster.healingPower || caster.attack) × skillMultiplier
  × healingBuff × receivedHealingModifier
)
```

- 不超过最大士兵值
- 禁疗时 healAmount = 0
- 复活后生命比例配置化（建议 30%）

## 属性克制

- PASSION ↔ COOL 互相克制
- LIGHT ↔ DARK 互相克制
- SPECIAL 不参与克制

倍率配置化，初始建议克制方 1.5x。

## 状态效果

每个状态效果定义：id, name, duration, stacks, isDebuff, icon, onApply, onTick, onExpire, onRemove

控制类：TURN_SKIP, STUN, SILENCE, TAUNT, SKILL_NULLIFY
减益类：ATK_DOWN, DEF_DOWN, VULNERABILITY, HEAL_BLOCK, DOT
增益类：ATK_UP, DEF_UP, SHIELD, HOT, DAMAGE_REDUCTION, CRIT_UP

## 战斗结束

- 一方全部单位阵亡 → 另一方胜利
- 超过配置回合上限 → 比较剩余 HP 百分比
- Boss 战可能有阶段转换

## 战斗日志

每个 action 记录：turn, actorUid, actionType, skillId, targets, damage/heal, isCrit, elementBonus, statusApplied, statusRemoved

用于：战斗回放、调试、UI 日志面板
