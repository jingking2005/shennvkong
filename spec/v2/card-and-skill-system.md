# 神女控 V2 — 卡牌与技能系统

## 卡牌属性模型

### 基础属性（CardDefinition）

| 字段 | 类型 | 说明 |
|:---|:---|:---|
| id | string | 唯一标识（slug） |
| name | {en, cn, jp} | 多语言名称 |
| rarity | N/R/SR/UR/LR | 稀有度 |
| element | PASSION/COOL/LIGHT/DARK/SPECIAL | 属性 |
| symbol | SUN/SEA/EARTH/null | 高阶克制（MVP后） |
| cardCost | number | 编队Cost |
| primaryRole | Role | 主定位 |
| secondaryRole | Role/null | 副定位 |
| combatTags | string[] | 战斗标签 |
| baseAttack | number | 基础攻击 |
| baseDefense | number | 基础防御 |
| baseSoldiers | number | 基础士兵值(HP) |
| baseSpeed | number | 速度（不成长） |
| baseCritRate | number | 基础暴击率 |
| baseCritDamage | number | 基础暴击伤害 |
| skillIds | string[] | 技能ID列表 |
| forms | CardForm[] | 形态（进化阶段） |
| familyId | string | 同卡族ID（用于强化） |

### 实例属性（CardInstance）

| 字段 | 类型 | 说明 |
|:---|:---|:---|
| instanceId | string | 唯一实例 |
| cardId | string | 对应定义 |
| level | number | 当前等级 |
| exp | number | 当前经验 |
| enhancement | number | 强化等级 +0~+10 |
| evolutionStage | number | 进化阶段 0~4 |
| skillLevels | number[] | 各技能等级 |
| friendship | number | 亲密度 0~100 |
| locked | boolean | 锁定状态 |
| derivedStats | Stats | 计算后的最终属性 |

### 角色定位

MAIN_DPS, SUB_DPS, TANK, HEALER, BUFF_SUPPORT, DEBUFF_SUPPORT, CONTROLLER, HYBRID

## 技能系统

### 技能定义（SkillDefinition）

每张卡至少：1 普攻 + 1 主动/概率技能 + 1 被动

高稀有度：普攻 + 主技能 + 第二技能 + 终极技能 + 被动

### 技能字段

id, name, description, skillCategory, activationType, trigger, targetType, effectList, baseChance, levelScaling, cooldown, turnCountdown, procLimit, duration, resourceCost, conditions, priority, animationKey, soundKey, tags

### activationType

MANUAL, AUTO, PASSIVE, COUNTDOWN, BATTLE_START, NEAR_DEFEAT, REACTION

### trigger

BATTLE_START, ALLY_TURN_START, ENEMY_TURN_START, BEFORE_ATTACK, AFTER_ATTACK, ON_HIT, ON_CRIT, HP_BELOW_THRESHOLD, ALLY_DEATH, ENEMY_DEATH, SKILL_BLOCKED, COUNTDOWN_ZERO

### targetType

SELF, SINGLE_ALLY, LOWEST_HP_ALLY, ALL_ALLIES, SAME_ELEMENT_ALLIES, SINGLE_ENEMY, HIGHEST_ATK_ENEMY, LOWEST_HP_ENEMY, FRONT_ROW, BACK_ROW, ALL_ENEMIES, RANDOM_ENEMIES

### 效果类型

DAMAGE, MULTI_HIT_DAMAGE, AOE_DAMAGE, TRUE_DAMAGE, HEAL, HEAL_OVER_TIME, SHIELD, REVIVE, ATTACK_UP, ATTACK_DOWN, DEFENSE_UP, DEFENSE_DOWN, CRIT_UP, DAMAGE_REDUCTION, VULNERABILITY, ABSORB, CLEANSE, DISPEL, TURN_SKIP, STUN, SILENCE, TAUNT, PROTECT, SKILL_NULLIFY, SKILL_UNLEASH, COOLDOWN_REDUCTION, COUNTDOWN_REDUCTION, RESURRECT, EXECUTE, COUNTER, FOLLOW_UP

### 技能解析架构

```
SkillResolver（判断是否触发）
  → EffectResolver（执行效果列表）
    → DamageCalculator / HealCalculator / StatusApplier
```

效果不写死在卡牌组件中，全部数据驱动。
