# 神女控 V2 — 数据模型

## 数据分层

```
data/raw/          — Hermes 抓取原始数据（只读）
data/normalized/   — 清洗后标准卡牌数据
data/runtime/      — 游戏直接读取
data/fixtures/     — 测试和 Mock 数据
data/config/       — 平衡配置（倍率/曲线/概率）
```

## 核心类型定义

### CardDefinition（卡牌模板）
id, name, rarity, element, symbol, cardCost, primaryRole, secondaryRole, combatTags, baseAttack, baseDefense, baseSoldiers, baseSpeed, baseCritRate, baseCritDamage, skillIds, forms, familyId, description, artist, tags

### CardInstance（玩家持有）
instanceId, cardId, level, exp, enhancement, evolutionStage, skillLevels, friendship, locked, derivedStats

### SkillDefinition
id, name, description, skillCategory, activationType, trigger, targetType, effectList, baseChance, levelScaling, cooldown, turnCountdown, procLimit, duration, resourceCost, conditions, priority, animationKey, soundKey, tags

### SkillEffectDefinition
type, value, scalingPerLevel, duration, stacks, targetOverride, conditions

### StatusEffectDefinition
id, name, duration, maxStacks, isDebuff, icon, onApply, onTick, onExpire, onRemove, dispellable

### DeckDefinition
name, slots: {position, cardInstanceId}[], totalCost

### UnitBonusDefinition
id, name, condition, bonuses: {stat, value, type}[]

### SummonBannerDefinition
bannerId, name, currency, cost, pool, weights, guarantees, pity, startAt, endAt, featuredCards, duplicateConversion

### EnhancementConfig
level, baseSuccessRate, failPenalty, attributeBonus, goldCost

### EvolutionRecipe
cardId, fromStage, toStage, requiredLevel, materialCount, materialCardId, inheritRate

### AmalgamationRecipe
id, materials: {cardId, count}[], extraMaterials, goldCost, resultCardId

### BuildingDefinition
id, name, maxLevel, upgradeCosts, upgradeTimes, prerequisites, passiveYield, unlockContent

### StageDefinition
id, name, waves: EnemyWave[], rewards, staminaCost, unlockCondition

### EnemyDefinition
cardId, level, enhancement, aiBehavior, position

### EconomyConfig
resources: {id, cap, dailyIncome, sources, sinks}[]

### PlayerSave
version, inventory, decks, kingdom, currencies, clearedStages, gachaHistory, settings, timestamps

## 原则

- CardDefinition 不含等级/强化/锁定（这些属于 CardInstance）
- 游戏不直接读取 Hermes 正在写入的目录
- 所有配置 JSON 化，不硬编码
