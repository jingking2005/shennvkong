/**
 * SeededRNG — 确定性伪随机数生成器
 * 基于 mulberry32 算法，支持种子注入，用于战斗回放和测试
 */

export class SeededRNG {
  private state: number;

  constructor(seed: number = Date.now()) {
    this.state = seed | 0;
  }

  /** 返回 [0, 1) 的浮点数 */
  next(): number {
    this.state |= 0;
    this.state = (this.state + 0x6d2b79f5) | 0;
    let t = Math.imul(this.state ^ (this.state >>> 15), 1 | this.state);
    t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t;
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  }

  /** 返回 [min, max] 的整数 */
  nextInt(min: number, max: number): number {
    return Math.floor(this.next() * (max - min + 1)) + min;
  }

  /** 返回 [0, max) 的整数 */
  nextIndex(max: number): number {
    return Math.floor(this.next() * max);
  }

  /** 概率判定：返回 true 的概率为 chance (0-1) */
  chance(chance: number): boolean {
    return this.next() < chance;
  }

  /** 从数组中随机选一个 */
  pick<T>(arr: T[]): T {
    return arr[this.nextIndex(arr.length)];
  }

  /** 洗牌（Fisher-Yates） */
  shuffle<T>(arr: T[]): T[] {
    const result = [...arr];
    for (let i = result.length - 1; i > 0; i--) {
      const j = this.nextIndex(i + 1);
      [result[i], result[j]] = [result[j], result[i]];
    }
    return result;
  }

  /** 获取当前种子状态（用于快照） */
  getState(): number {
    return this.state;
  }

  /** 从状态恢复（用于回滚） */
  setState(state: number): void {
    this.state = state;
  }

  /** 创建相同种子的副本 */
  clone(): SeededRNG {
    const copy = new SeededRNG(0);
    copy.state = this.state;
    return copy;
  }
}
