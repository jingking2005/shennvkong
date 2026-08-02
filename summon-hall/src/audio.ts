/**
 * 全局 BGM：开关状态持久化，各场景可切换曲目。
 */

import { BGM, type BgmKey } from './assets';

const LS_MUTE = 'summonHall_bgmMuted';
const LS_VOL = 'summonHall_bgmVolume';

export class AudioManager {
  private el: HTMLAudioElement;
  private muted: boolean;
  private volume: number;
  private current: BgmKey | null = null;
  private unlocked = false;

  constructor() {
    this.muted = localStorage.getItem(LS_MUTE) === '1';
    const v = parseFloat(localStorage.getItem(LS_VOL) || '0.35');
    this.volume = Number.isFinite(v) ? Math.min(1, Math.max(0, v)) : 0.35;
    this.el = new Audio();
    this.el.loop = true;
    this.el.preload = 'auto';
    this.applyVolume();
  }

  isMuted(): boolean { return this.muted; }

  /** 首次用户手势后解锁自动播放策略 */
  unlock(): void {
    if (this.unlocked) return;
    this.unlocked = true;
    if (!this.muted && this.current) void this.el.play().catch(() => {});
  }

  toggleMute(): boolean {
    this.muted = !this.muted;
    localStorage.setItem(LS_MUTE, this.muted ? '1' : '0');
    this.applyVolume();
    if (!this.muted && this.current) void this.el.play().catch(() => {});
    else this.el.pause();
    return this.muted;
  }

  play(key: BgmKey): void {
    const src = BGM[key];
    if (this.current !== key) {
      this.el.src = src;
      this.current = key;
    }
    this.applyVolume();
    if (!this.muted && this.unlocked) void this.el.play().catch(() => {});
  }

  private applyVolume(): void {
    this.el.volume = this.muted ? 0 : this.volume;
    if (this.muted) this.el.pause();
  }
}

export const audio = new AudioManager();
