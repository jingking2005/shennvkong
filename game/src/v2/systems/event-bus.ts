/**
 * EventBus — 事件总线，解耦战斗逻辑与渲染层
 * 参考 OpenDuelyst 的 EventBus 模式
 */

export type EventHandler<T = any> = (data: T) => void;

interface Subscription {
  handler: EventHandler;
  priority: number;
  once: boolean;
}

export class EventBus {
  private listeners = new Map<string, Subscription[]>();

  /** 订阅事件 */
  on<T = any>(event: string, handler: EventHandler<T>, priority = 0): void {
    if (!this.listeners.has(event)) {
      this.listeners.set(event, []);
    }
    this.listeners.get(event)!.push({ handler, priority, once: false });
    // 按优先级排序（高优先级先执行）
    this.listeners.get(event)!.sort((a, b) => b.priority - a.priority);
  }

  /** 订阅一次 */
  once<T = any>(event: string, handler: EventHandler<T>, priority = 0): void {
    if (!this.listeners.has(event)) {
      this.listeners.set(event, []);
    }
    this.listeners.get(event)!.push({ handler, priority, once: true });
    this.listeners.get(event)!.sort((a, b) => b.priority - a.priority);
  }

  /** 取消订阅 */
  off(event: string, handler: EventHandler): void {
    const subs = this.listeners.get(event);
    if (!subs) return;
    const idx = subs.findIndex(s => s.handler === handler);
    if (idx >= 0) subs.splice(idx, 1);
  }

  /** 发布事件 */
  emit<T = any>(event: string, data?: T): void {
    const subs = this.listeners.get(event);
    if (!subs || subs.length === 0) return;

    const toRemove: number[] = [];
    for (let i = 0; i < subs.length; i++) {
      subs[i].handler(data);
      if (subs[i].once) toRemove.push(i);
    }
    // 移除 once 订阅（倒序删除）
    for (let i = toRemove.length - 1; i >= 0; i--) {
      subs.splice(toRemove[i], 1);
    }
  }

  /** 清除所有订阅 */
  clear(): void {
    this.listeners.clear();
  }

  /** 清除指定事件的所有订阅 */
  clearEvent(event: string): void {
    this.listeners.delete(event);
  }

  /** 获取事件订阅数（调试用） */
  listenerCount(event: string): number {
    return this.listeners.get(event)?.length ?? 0;
  }
}

// === 战斗事件类型常量 ===

export const BattleEvents = {
  // 战斗生命周期
  BATTLE_START: 'battle:start',
  BATTLE_END: 'battle:end',
  TURN_START: 'battle:turn_start',
  TURN_END: 'battle:turn_end',

  // 行动流水线
  BEFORE_ACTION: 'action:before',
  ACTION_VALIDATE: 'action:validate',
  ACTION_INVALID: 'action:invalid',
  ACTION_EXECUTE: 'action:execute',
  AFTER_ACTION: 'action:after',
  ACTION_CLEANUP: 'action:cleanup',

  // 伤害
  BEFORE_DAMAGE: 'damage:before',
  DAMAGE_DEALT: 'damage:dealt',
  AFTER_DAMAGE: 'damage:after',

  // 治疗
  BEFORE_HEAL: 'heal:before',
  HEAL_APPLIED: 'heal:applied',
  AFTER_HEAL: 'heal:after',

  // 单位生命周期
  UNIT_DIED: 'unit:died',
  UNIT_REVIVED: 'unit:revived',

  // 状态效果
  STATUS_APPLIED: 'status:applied',
  STATUS_EXPIRED: 'status:expired',
  STATUS_REMOVED: 'status:removed',

  // 技能
  SKILL_TRIGGERED: 'skill:triggered',
  SKILL_BLOCKED: 'skill:blocked',

  // Buff/Aura
  BUFF_ADDED: 'buff:added',
  BUFF_REMOVED: 'buff:removed',
  AURA_UPDATED: 'aura:updated',
} as const;

export type BattleEventType = typeof BattleEvents[keyof typeof BattleEvents];
