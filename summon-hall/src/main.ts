/**
 * 主程序 — 召唤神殿（真实插画背景 + 完整动画编排）
 */

import { Background } from './background';
import { drawCard, preloadImage, getImage, RARITY_COLOR } from './card';
import { BANNERS, Gacha, rateTable, bannerShowcase, type Banner, type Pull } from './gacha';
import { cardsByRarity, getCard, type Card } from './data';
import { Ease, Tweener } from './ease';
import { glassButton, metalDialog, engravedText, roundRectPath } from './ui';
import { seedDB, type DB, type Stage, type WitchRaidBoss } from './db';
import {
  ExploreStage, EvolveCard, EnhanceCard, runBattleTurn, raidAttack,
  claimRaidReward, claimAllRaidRewards,
  ownedToCombatant, leaderAtkBonus, type Combatant, type ExploreResult,
} from './logic';
import { eventMapBg, battleBg, loadAssetImage, drawCover } from './assets';
import { audio } from './audio';

const W = 1280;
const H = 760;

type Phase =
  | { kind: 'hall' }
  | { kind: 'confirm'; ten: boolean; ticket: boolean; t: number } // 确认弹窗
  | { kind: 'summon'; pulls: Pull[]; t: number }        // 前兆：神殿压暗+汇聚
  | { kind: 'reveal'; pulls: Pull[]; idx: number; t: number } // 逐张翻转揭示
  | { kind: 'settle'; pulls: Pull[]; t: number };        // 落定阵列

/** 卡池展示配置（VC 风格） */
interface BannerMeta {
  portrait: Card | null;   // 大立绘
  tagline: string;         // 说明文案
  endAt: number;           // 结束时间戳
  tickets: number;         // 召唤券数量
}

interface Button { x: number; y: number; w: number; h: number; id: string; primary?: boolean; }

interface BurstParticle { x: number; y: number; vx: number; vy: number; life: number; max: number; color: string; r: number; }

const RANK: Record<string, number> = { N: 1, R: 2, SR: 3, UR: 4, LR: 5, X: 6, VR: 7 };

/** 顶层页面 */
type Page = 'summon' | 'event' | 'map' | 'sortie' | 'battle' | 'team' | 'records';

/** 队伍槽位 */
interface TeamSlot { card: Card; hp: number; maxHp: number; lv: number; exp: number; }

/** 战斗状态（基于 BattleEngine） */
interface BattleState {
  team: Combatant[];
  enemies: Combatant[];
  raid: WitchRaidBoss | null;      // 若为讨伐战
  t: number;
  auto: boolean;
  autoTimer: number;
  seed: number;
  skillPrompt: number | null;
  dmgFloat: { x: number; y: number; v: string; t: number; color: string }[];
  victory: boolean; victoryT: number;
  defeated: boolean;
  banner: string;                  // '魔女出现！' / 'VICTORY' 横幅
  bannerT: number;
  lastActions: { actor: string; dmg: number; skill: boolean; crit: boolean; em: number }[];
}

class SummonHall {
  private canvas: HTMLCanvasElement;
  private ctx: CanvasRenderingContext2D;
  private bg = new Background();
  private gacha = new Gacha();
  private tweener = new Tweener();
  private phase: Phase = { kind: 'hall' };
  private banner: Banner = BANNERS[1];
  private buttons: Button[] = [];
  private hover: string | null = null;
  private last = 0;
  private jewels = 999999;
  private fp = 99999;
  private scale = 1;
  private particles: BurstParticle[] = [];
  private shake = 0;
  private flashV = 0;
  private flashColor = '#ffe14d';
  private pillarV = 0;               // 光柱强度
  private pillarColor = '#ffe14d';
  private showRates = false;         // 提供比率浮层
  private cardDetail: Card | null = null; // 卡牌详情浮层
  private rateCards: Card[] = [];    // 提供比率浮层展示的卡
  private meta = new Map<string, BannerMeta>();
  private cardCount = 250;           // 所持卡片数
  private cardCap = 300;
  private page: Page = 'summon';     // 当前页面
  private db: DB = seedDB((r, n) => cardsByRarity(r).slice(0, n));
  private teamInstIds: string[] = []; // 队伍（库存实例 id）
  private battle: BattleState | null = null;
  private chapter = '15-1';
  private exploreMsg: ExploreResult | null = null; // 探索事件提示
  private exploreMsgT = 0;
  private activeStage: Stage;         // 当前探索关卡
  private ownedCards: Card[] = [];    // 抽到的卡（组队用）
  // ── 队伍页状态 ──
  private invScroll = 0;              // 库存滚动
  private invFilter: string = 'ALL';  // 稀有度筛选
  private teamSelSlot = -1;           // 选中出击槽（-1 无）
  private detailInst: string | null = null; // 详情弹层的库存实例
  private detailInstKeep: string | null = null; // 强化/进化的主卡（详情关闭后保留）
  private enhanceMode = false;        // 强化选狗粮模式
  private enhancePicks = new Set<string>(); // 选中的狗粮
  private evolveMode = false;         // 进化选素材模式
  private evolvePick: string | null = null;
  private teamMsg = '';               // 操作反馈
  private teamMsgT = 0;
  /** 充值（调试）弹窗 */
  private showRecharge = false;
  /** 活动地图背景轮换下标 */
  private eventMapIndex = 0;
  /** 战斗背景下标（按关卡推进） */
  private battleBgIndex = 0;
  /** 战绩列表滚动 */
  private recordsScroll = 0;
  private recordsToast = '';
  private recordsToastT = 0;
  /** 进军走路弹跳：0=无；进行中驱动队伍前跳 */
  private marchAnim: null | {
    t: number; dur: number; applied: boolean; fromProg: number; auto: boolean;
  } = null;
  /** 进度条显示值（平滑跟真实进度） */
  private displayProg = 0;

  constructor(root: HTMLElement) {
    this.canvas = document.createElement('canvas');
    this.canvas.width = W; this.canvas.height = H;
    this.ctx = this.canvas.getContext('2d')!;
    root.appendChild(this.canvas);
    this.fit();
    window.addEventListener('resize', () => this.fit());
    this.canvas.addEventListener('pointermove', e => this.onMove(e));
    this.canvas.addEventListener('pointerdown', e => this.onDown(e));
    this.canvas.addEventListener('wheel', e => {
      if (this.page !== 'records') return;
      e.preventDefault();
      this.recordsScroll = Math.max(0, this.recordsScroll + e.deltaY * 0.6);
    }, { passive: false });

    this.activeStage = this.db.stages[0];
    this.displayProg = this.activeStage.progress;
    this.bg.resize(W, H);
    this.buildMeta();
    this.buildTeam();
    this.syncBgm();

    requestAnimationFrame(t => this.loop(t));
  }

  /** 按页面切换 BGM */
  private syncBgm(): void {
    if (this.page === 'battle') {
      audio.play(this.battle?.raid ? 'archwitch' : 'battle');
    } else if (this.page === 'map' || this.page === 'event' || this.page === 'records') {
      audio.play('eventMap');
    } else if (this.page === 'sortie') {
      audio.play('campaign');
    } else if (this.page === 'team') {
      audio.play('kingdom');
    } else {
      audio.play('main');
    }
  }

  /** 调试充值 */
  private doRecharge(kind: string): void {
    const u = this.db.user;
    switch (kind) {
      case 'energy': u.energy = u.energyMax; break;
      case 'energy+50': u.energy = Math.min(u.energyMax, u.energy + 500); break;
      case 'battlePt': u.battlePt = u.battlePtMax; break;
      case 'gold': u.gold += 100000; break;
      case 'gems': u.gems += 10000; this.jewels = u.gems; break;
      case 'fp': u.friendPt += 10000; this.fp = u.friendPt; break;
      case 'tickets':
        for (const k of Object.keys(u.tickets)) u.tickets[k] = (u.tickets[k] || 0) + 10;
        for (const m of this.meta.values()) m.tickets += 10;
        break;
      case 'all':
        u.energy = u.energyMax;
        u.battlePt = u.battlePtMax;
        u.gold += 500000;
        u.gems += 50000;
        u.friendPt += 50000;
        this.jewels = u.gems;
        this.fp = u.friendPt;
        for (const k of Object.keys(u.tickets)) u.tickets[k] = (u.tickets[k] || 0) + 50;
        for (const m of this.meta.values()) m.tickets += 50;
        break;
      default: break;
    }
  }

  /** 队伍编成：取库存前 5 张高稀有卡作为出击队 */
  private buildTeam(): void {
    const inv = this.db.inventory.cards;
    const rank = (id: string) => RANK[getCard(id)?.rarity ?? 'N'] ?? 0;
    const sorted = [...inv].sort((a, b) => rank(b.cardId) - rank(a.cardId) || b.lv - a.lv);
    this.teamInstIds = sorted.slice(0, 5).map(c => c.instId);
    for (const id of this.teamInstIds) {
      const o = inv.find(c => c.instId === id);
      const card = o && getCard(o.cardId);
      if (card) preloadImage(card).catch(() => {});
    }
  }

  /** 队伍 → Combatant[]（接 BattleEngine） */
  private teamCombatants(): Combatant[] {
    const out: Combatant[] = [];
    this.teamInstIds.forEach((instId, i) => {
      const o = this.db.inventory.cards.find(c => c.instId === instId);
      if (!o) return;
      const c = ownedToCombatant(o, i === 0);
      if (c) out.push(c);
    });
    return out;
  }

  /** 每个卡池的展示立绘 + 文案 + 结束时间 */
  private buildMeta(): void {
    const taglines: Record<string, string> = {
      fate: '常驻召唤 · 每召唤后 LR 出现率提升！',
      legend: '回归玩家期间限定！每召唤后 LR 出现率提升 4%！可挑选喜爱的 LR 设为精选卡片！',
      oracle: '限时 · X / VR 出现率 UP！',
      friend: '使用友情点召唤 · 日常补给',
    };
    const RANKV: Record<string, number> = { N: 1, R: 2, SR: 3, UR: 4, LR: 5, X: 6, VR: 7 };
    BANNERS.forEach((b, i) => {
      const rarities = [...new Set(b.pool.map(p => p.rarity))]
        .sort((a, z) => RANKV[z] - RANKV[a]);
      let portrait: Card | null = null;
      for (const r of rarities) {
        const c = cardsByRarity(r)[0];
        if (c) { portrait = c; break; }
      }
      if (portrait) preloadImage(portrait).catch(() => {});
      this.meta.set(b.id, {
        portrait,
        tagline: taglines[b.id] ?? b.sub,
        endAt: Date.now() + (13 - i * 2) * 86400000 + 12 * 3600000,
        tickets: i === 0 ? 1 : 0,
      });
    });
  }

  private fit(): void {
    const s = Math.min(window.innerWidth / W, window.innerHeight / H);
    this.scale = s;
    this.canvas.style.width = `${W * s}px`;
    this.canvas.style.height = `${H * s}px`;
  }

  // ============ 输入 ============

  private toGame(e: PointerEvent): { x: number; y: number } {
    const r = this.canvas.getBoundingClientRect();
    return { x: (e.clientX - r.left) / this.scale, y: (e.clientY - r.top) / this.scale };
  }

  private onMove(e: PointerEvent): void {
    const p = this.toGame(e);
    this.hover = null;
    for (let i = this.buttons.length - 1; i >= 0; i--) {
      const b = this.buttons[i];
      if (p.x >= b.x && p.x <= b.x + b.w && p.y >= b.y && p.y <= b.y + b.h) { this.hover = b.id; break; }
    }
    this.canvas.style.cursor = this.hover ? 'pointer' : 'default';
  }

  private onDown(e: PointerEvent): void {
    audio.unlock();
    const p = this.toGame(e);
    for (let i = this.buttons.length - 1; i >= 0; i--) {
      const b = this.buttons[i];
      if (p.x >= b.x && p.x <= b.x + b.w && p.y >= b.y && p.y <= b.y + b.h) { this.activate(b.id); return; }
    }
    if (this.phase.kind === 'summon') {
      // 点击加速爆破（参考 ducdat breakSkip）
      this.phase.t = Math.max(this.phase.t, this.summonDuration() - 0.12);
    } else if (this.phase.kind === 'reveal') {
      // 点击跳到下一张；最后一张则进结算
      const pulls = this.phase.pulls;
      const next = this.phase.idx + 1;
      if (next >= pulls.length) this.phase = { kind: 'settle', pulls, t: 0 };
      else {
        this.phase.t = this.revealStartAt(pulls, next);
        this.phase.idx = next;
        this.onRevealCard(pulls[next]);
      }
    }
  }

  private activate(id: string): void {
    // 全局 HUD（任意页优先）
    if (id === 'toggleMusic') { audio.toggleMute(); return; }
    if (id === 'openRecharge') { this.showRecharge = true; return; }
    if (id === 'closeRecharge') { this.showRecharge = false; return; }
    if (id.startsWith('recharge:')) {
      if (id === 'recharge:noop') return;
      this.doRecharge(id.slice(9));
      return;
    }
    if (this.showRecharge) return; // 弹窗打开时屏蔽下层

    // 底部导航
    if (id.startsWith('nav:')) {
      const p = id.slice(4) as Page;
      this.page = p === 'map' ? 'map' : p;
      this.showRates = false; this.cardDetail = null;
      if (this.page === 'summon') this.phase = { kind: 'hall' };
      if (p === 'team') { this.detailInst = null; this.enhanceMode = false; this.evolveMode = false; this.teamSelSlot = -1; }
      this.syncBgm();
      return;
    }
    // 队伍页交互
    if (this.page === 'team') { this.activateTeam(id); return; }
    // 战绩领取
    if (this.page === 'records') {
      if (id === 'recordsBack') { this.page = 'event'; this.syncBgm(); return; }
      if (id === 'claimAll') {
        const r = claimAllRaidRewards(this.db);
        this.jewels = this.db.user.gems;
        if (r.count > 0) {
          this.recordsToast = `一次性领取：金币+${r.gold} 宝石+${r.gems} 券+${r.tickets}`;
          // 同步 fate 券到大厅 meta
          const m = this.meta.get('fate');
          if (m) m.tickets = this.db.user.tickets.fate || 0;
        } else {
          this.recordsToast = '没有可领取的奖励';
        }
        this.recordsToastT = 0;
        return;
      }
      if (id.startsWith('claim:')) {
        const raidId = id.slice(6);
        const r = claimRaidReward(this.db, raidId);
        this.jewels = this.db.user.gems;
        if (r.ok) {
          this.recordsToast = `获得金币${r.gold}、宝石${r.gems}、召唤券${r.tickets}`;
          const m = this.meta.get('fate');
          if (m) m.tickets = this.db.user.tickets.fate || 0;
        } else {
          this.recordsToast = r.reason || '领取失败';
        }
        this.recordsToastT = 0;
        return;
      }
      return;
    }
    // 活动卡片 → 跑图（轮换活动地图背景）
    if (id.startsWith('event:')) {
      const title = id.slice(6);
      this.eventMapIndex = Math.abs([...title].reduce((a, c) => a + c.charCodeAt(0), 0)) % 64;
      this.page = 'map';
      this.syncBgm();
      return;
    }
    // 跑图节点 → 出击（战斗背景随节点变化）
    if (id.startsWith('node:')) {
      this.battleBgIndex = (this.battleBgIndex + 1) % 64;
      this.page = 'sortie';
      this.syncBgm();
      return;
    }
    if (id === 'worldmap') { this.eventMapIndex = (this.eventMapIndex + 1) % 64; return; }
    // 出击：前进 = 走路弹跳后再结算
    if (id === 'march') { this.startMarch(false); return; }
    if (id === 'auto') { this.startMarch(true); return; }
    // 队伍卡详情
    if (id.startsWith('teamcard:')) {
      const i = parseInt(id.slice(9), 10);
      const c = this.teamCombatants()[i];
      if (c) this.cardDetail = c.card;
      return;
    }
    // 战斗
    if (this.page === 'battle' && this.battle) {
      const b = this.battle;
      if (id === 'retreat') { this.page = 'sortie'; this.battle = null; this.syncBgm(); return; }
      if (id === 'bAuto') { b.auto = !b.auto; b.autoTimer = 0; return; }
      if (id === 'victoryOk') {
        const wasRaid = !!b.raid?.defeated;
        this.page = wasRaid ? 'records' : 'sortie';
        this.battle = null;
        this.activeStage.progress = Math.min(1, this.activeStage.progress + 0.05);
        this.syncBgm();
        return;
      }
      if (b.skillPrompt !== null) {
        if (id === 'skillYes') { b.skillPrompt = null; this.runTurn(); }
        else if (id === 'skillNo') b.skillPrompt = null;
        return;
      }
      if (id.startsWith('skill:')) {
        const i = parseInt(id.slice(6), 10);
        if (b.team[i]?.hp > 0 && !b.victory && !b.defeated) b.skillPrompt = i;
        return;
      }
      return;
    }
    // 卡牌详情
    if (id.startsWith('card:')) {
      const i = parseInt(id.slice(5), 10);
      const src = this.phase.kind === 'settle' ? this.phase.pulls : null;
      const c = src?.[i]?.card ?? this.rateCards[i];
      if (c) this.cardDetail = c;
      return;
    }
    if (id === 'closeDetail') { this.cardDetail = null; return; }
    // settle 阶段按钮
    if (this.phase.kind === 'settle') {
      if (this.cardDetail) return; // 详情打开时屏蔽
      if (id === 'settleOk') this.toHall();
      else if (id === 'settleAgain') { this.toHall(); this.phase = { kind: 'confirm', ten: true, ticket: false, t: 0 }; }
      return;
    }
    if (id.startsWith('banner:')) {
      const b = BANNERS.find(x => x.id === id.slice(7));
      if (b && this.phase.kind === 'hall' && !this.showRates) this.banner = b;
      return;
    }
    if (id === 'rates') { this.showRates = true; return; }
    if (id === 'closeRates' || id === 'closeRatesBg') { this.showRates = false; return; }
    if (this.showRates) return; // 浮层打开时屏蔽其它操作
    // 确认弹窗按钮
    if (id === 'confirmYes' && this.phase.kind === 'confirm') {
      const { ten, ticket } = this.phase;
      this.execPull(ten, ticket);
      return;
    }
    if (id === 'confirmNo' && this.phase.kind === 'confirm') {
      this.phase = { kind: 'hall' };
      return;
    }
    // 触发确认弹窗
    if (id === 'pull10' && this.phase.kind === 'hall') {
      this.phase = { kind: 'confirm', ten: true, ticket: false, t: 0 };
      return;
    }
    if (id === 'pull10ticket' && this.phase.kind === 'hall') {
      this.phase = { kind: 'confirm', ten: true, ticket: true, t: 0 };
      return;
    }
    if (id === 'exchange') { this.jewels += 3000; } // 占位：券交换
    if (id === 'add') {
      this.jewels += 50000; this.fp += 5000;
      const m = this.meta.get(this.banner.id);
      if (m) m.tickets = 99; // 补充按钮同时把券拉满
    }
  }

  // ============ 抽卡流程 ============

  private execPull(ten: boolean, useTicket: boolean): void {
    if (useTicket) {
      const m = this.meta.get(this.banner.id);
      if (!m) { this.phase = { kind: 'hall' }; return; }
      if (m.tickets <= 0) m.tickets = 99; // 券无限供应
      m.tickets--;
    } else {
      const cost = ten ? this.banner.costTen : this.banner.costSingle;
      const isFriend = this.banner.id === 'friend';
      if (isFriend) { if (this.fp < cost) this.fp += cost * 2; this.fp -= cost; }
      else { if (this.jewels < cost) this.jewels += cost * 2; this.jewels -= cost; }
    }

    let pulls = ten ? this.gacha.pullTen(this.banner) : [this.gacha.pullOne(this.banner)];
    pulls.forEach(p => preloadImage(p.card).catch(() => {}));
    if (useTicket) {
      pulls = pulls.map(p => ({ ...p, card: this.gacha.upgradeTo(p.card, 'UR') }));
      pulls.forEach(p => preloadImage(p.card).catch(() => {}));
    }
    this.cardCount = Math.min(this.cardCap, this.cardCount + pulls.length);

    this.phase = { kind: 'summon', pulls, t: 0 };
    this.bg.setMode('rare');
    // 稀有揭示背景淡入（高稀有度才明显）
    const top = this.topRarity(pulls);
    const target = ['LR', 'X', 'VR'].includes(top) ? 1 : top === 'UR' ? 0.85 : top === 'SR' ? 0.5 : 0.25;
    this.tweener.add({
      from: 0, to: target, dur: 1.2, delay: 0, ease: Ease.inOutSine,
      onUpdate: v => this.bg.setRareBlend(v),
    });
  }

  private topRarity(pulls: Pull[]): string {
    return pulls.reduce((a, b) => RANK[b.card.rarity] > RANK[a.card.rarity] ? b : a).card.rarity;
  }

  private summonDuration(): number {
    if (this.phase.kind !== 'summon') return 0;
    const top = this.topRarity(this.phase.pulls);
    // 参考 ducdat：高稀有卡包震颤更久，再爆破
    return ['LR', 'X', 'VR'].includes(top) ? 2.6 : top === 'UR' ? 2.0 : top === 'SR' ? 1.4 : 1.0;
  }

  /** 单卡揭示时长（极品卡明显更长，模仿 ducdat 的 revealTime 分层） */
  private revealDur(rarity: string): number {
    const r = RANK[rarity] ?? 1;
    if (r >= 6) return 1.45; // X / VR
    if (r >= 5) return 1.2;  // LR
    if (r >= 4) return 0.9;  // UR
    if (r >= 3) return 0.55; // SR
    return 0.32;             // N / R
  }

  /** 第 idx 张卡开始揭示的累计时刻 */
  private revealStartAt(pulls: Pull[], idx: number): number {
    let t = 0;
    for (let i = 0; i < idx; i++) t += this.revealDur(pulls[i].card.rarity);
    return t;
  }

  private revealTotal(pulls: Pull[]): number {
    return pulls.reduce((s, p) => s + this.revealDur(p.card.rarity), 0);
  }

  private beginReveal(): void {
    if (this.phase.kind !== 'summon') return;
    // 卡包爆破瞬间
    const top = this.topRarity(this.phase.pulls);
    const col = RARITY_COLOR[top];
    this.burst(col, RANK[top] >= 5 ? 90 : RANK[top] >= 4 ? 50 : 28);
    this.flashColor = '#ffffff';
    this.flashV = RANK[top] >= 5 ? 0.85 : 0.55;
    this.shake = RANK[top] >= 5 ? 0.7 : 0.35;
    this.phase = { kind: 'reveal', pulls: this.phase.pulls, idx: 0, t: 0 };
    // 触发第一张的入场特效
    this.onRevealCard(this.phase.pulls[0]);
  }

  private onRevealCard(pull: Pull | undefined): void {
    if (!pull) return;
    const col = RARITY_COLOR[pull.card.rarity];
    const rank = RANK[pull.card.rarity];
    this.pillarV = 1;
    this.pillarColor = col;
    if (rank >= 4) {
      this.burst(col, rank >= 5 ? 80 : 40);
      this.shake = rank >= 5 ? 0.55 : 0.3;
      this.flashColor = col;
      this.flashV = rank >= 5 ? 0.6 : 0.32;
    } else if (rank >= 3) {
      this.burst(col, 18);
      this.shake = 0.15;
    }
  }

  private toHall(): void {
    this.phase = { kind: 'hall' };
    this.tweener.add({
      from: this.bgBlend(), to: 0, dur: 0.6, delay: 0, ease: Ease.inOutSine,
      onUpdate: v => this.bg.setRareBlend(v),
    });
    this.bg.setMode('hall');
    this.syncBgm();
  }

  private bgBlend(): number {
    return (this.bg as any).fadeToRare ?? 0;
  }

  // ============ 主循环 ============

  private loop(t: number): void {
    const dt = Math.min(0.05, (t - this.last) / 1000 || 0);
    this.last = t;
    try {
      this.update(dt);
      this.render();
    } catch (e) {
      console.error('render frame error', e);
    }
    requestAnimationFrame(tt => this.loop(tt));
  }

  private update(dt: number): void {
    this.bg.update(dt);
    this.tweener.update(dt);
    this.shake = Math.max(0, this.shake - dt * 2.2);
    this.flashV = Math.max(0, this.flashV - dt * 1.8);
    this.pillarV = Math.max(0, this.pillarV - dt * 2.4);

    for (const p of this.particles) {
      p.life -= dt;
      p.x += p.vx * dt;
      p.y += p.vy * dt;
      p.vy += 200 * dt;
    }
    this.particles = this.particles.filter(p => p.life > 0);

    // 战斗推进
    if (this.page === 'battle' && this.battle) {
      const b = this.battle;
      b.t += dt;
      b.bannerT += dt;
      for (const d of b.dmgFloat) d.t += dt;
      b.dmgFloat = b.dmgFloat.filter(d => d.t < 1);
      if (b.victory) b.victoryT += dt;
      // Auto 自动回合
      if (b.auto && !b.victory && !b.defeated && b.skillPrompt === null) {
        b.autoTimer += dt;
        if (b.autoTimer >= 0.7) { b.autoTimer = 0; this.runTurn(); }
      }
    }
    // 探索消息计时
    if (this.exploreMsg) this.exploreMsgT += dt;
    if (this.teamMsg) this.teamMsgT += dt;
    if (this.recordsToast) this.recordsToastT += dt;

    // 进军走路弹跳
    if (this.marchAnim) {
      const m = this.marchAnim;
      m.t += dt;
      // 起跳顶点结算一步
      if (!m.applied && m.t >= m.dur * 0.42) {
        m.applied = true;
        const r = this.doExploreOnce();
        if (r.event === 'witch') {
          // 遇魔女：动画收尾后由 doExploreOnce 切战斗
        } else if (m.auto && r.ok && this.page === 'sortie') {
          // Auto：落地后继续下一步
        }
      }
      // 进度条平滑跟上
      if (m.applied) {
        const p = Math.min(1, (m.t - m.dur * 0.42) / (m.dur * 0.58));
        this.displayProg = m.fromProg + (this.activeStage.progress - m.fromProg) * Ease.outCubic(p);
      }
      if (m.t >= m.dur) {
        const contAuto = m.auto && m.applied
          && this.exploreMsg?.ok
          && this.exploreMsg.event !== 'witch'
          && this.page === 'sortie'
          && this.db.user.energy >= 10
          && this.activeStage.progress < 1;
        this.displayProg = this.activeStage.progress;
        this.marchAnim = null;
        if (contAuto) this.startMarch(true);
      }
    } else {
      // 非动画时对齐显示进度
      const d = this.activeStage.progress - this.displayProg;
      if (Math.abs(d) > 0.0005) this.displayProg += d * Math.min(1, dt * 8);
      else this.displayProg = this.activeStage.progress;
    }

    if (this.phase.kind === 'confirm') {
      this.phase.t += dt;
    } else if (this.phase.kind === 'summon') {
      this.phase.t += dt;
      // 卡包震颤中期持续撒粒子（越到爆破越密）
      const dur = this.summonDuration();
      const p = Math.min(1, this.phase.t / dur);
      if (Math.random() < p * p * 0.35) {
        const top = this.topRarity(this.phase.pulls);
        this.burst(RARITY_COLOR[top], 1);
      }
      if (this.phase.t >= dur) this.beginReveal();
    } else if (this.phase.kind === 'reveal') {
      this.phase.t += dt;
      const pulls = this.phase.pulls;
      // 按稀有度变速推进索引
      let idx = 0;
      for (let i = 0; i < pulls.length; i++) {
        if (this.phase.t >= this.revealStartAt(pulls, i)) idx = i;
      }
      if (idx !== this.phase.idx) {
        this.phase.idx = idx;
        this.onRevealCard(pulls[idx]);
      }
      if (this.phase.t >= this.revealTotal(pulls) + 0.35) {
        this.phase = { kind: 'settle', pulls, t: 0 };
      }
    } else if (this.phase.kind === 'settle') {
      this.phase.t += dt;
    }
  }

  /** 普通遭遇战：单 BOSS */
  private startBattle(raid: WitchRaidBoss | null = null): void {
    const team = this.teamCombatants();
    if (team.length === 0) return;
    let enemies: Combatant[];
    if (raid) {
      const bossCard = (raid.bossCardId && getCard(raid.bossCardId))
        || cardsByRarity(raid.archWitch ? 'VR' : 'LR')[1]
        || cardsByRarity('UR')[0];
      preloadImage(bossCard).catch(() => {});
      raid.bossCardId = bossCard.id;
      raid.name = bossCard.name;
      enemies = [{
        instId: raid.raidId, card: bossCard, lv: raid.level,
        atk: raid.attack, hp: raid.hp, hpMax: raid.hpMax, def: 500,
        speed: 120, element: 'dark', skillName: '魔女之咆哮',
        procChance: 0.5, skillMult: 3, isLeader: false,
      }];
    } else {
      const boss = cardsByRarity('LR')[1] ?? cardsByRarity('UR')[0];
      preloadImage(boss).catch(() => {});
      enemies = [{
        instId: 'boss', card: boss, lv: 50, atk: 4000, hp: 500000, hpMax: 500000,
        def: 800, speed: 100, element: 'dark', skillName: '暗之冲击',
        procChance: 0.4, skillMult: 2.5, isLeader: false,
      }];
    }
    this.battle = {
      team, enemies, raid, t: 0, auto: false, autoTimer: 0,
      seed: (Math.random() * 1e9) | 0, skillPrompt: null,
      dmgFloat: [], victory: false, victoryT: 0, defeated: false,
      banner: raid ? (raid.archWitch ? '超·幻想魔女降临！' : '魔女出现！') : '战斗开始',
      bannerT: 0, lastActions: [],
    };
    this.syncBgm();
  }

  /** 跑一回合（手动点卡 / Auto 都会调） */
  private runTurn(): void {
    const b = this.battle;
    if (!b || b.victory || b.defeated) return;
    const leaderBonus = leaderAtkBonus(b.team);

    if (b.raid) {
      // 讨伐战：用 raidAttack（消耗战斗体力）
      const r = raidAttack(this.db, b.raid, b.team, b.seed++);
      b.enemies[0].hp = b.raid.hp;
      if (r.dmg > 0) {
        b.dmgFloat.push({ x: W / 2, y: 200, v: String(r.dmg), t: 0, color: '#ffe14d' });
        this.burst('#c05ce8', 25); this.shake = 0.35;
      }
      if (r.defeated) {
        b.victory = true; b.victoryT = 0;
        b.banner = `讨伐成功！积分 +${r.ptGain}`;
        b.bannerT = 0;
        this.giveVictoryExp();
      }
      return;
    }

    // 普通遭遇战：BattleEngine 回合制
    const res = runBattleTurn(b.team, b.enemies, b.seed++, leaderBonus);
    b.lastActions = res.actions.map(a => ({
      actor: a.actorName, dmg: a.damage, skill: a.skillUsed, crit: a.crit, em: a.elementMult,
    }));
    // 伤害飘字：玩家对敌 → 顶部；敌对我 → 底部
    for (const a of res.actions) {
      const isPlayerAtk = b.team.some(c => c.instId === a.actorInstId);
      if (isPlayerAtk) {
        b.dmgFloat.push({ x: W / 2 + (Math.random() - 0.5) * 60, y: 200, v: String(a.damage), t: 0, color: a.crit ? '#ff5c5c' : '#ffe14d' });
      } else {
        const slotIdx = a.targetIndex;
        const x = this.teamSlotX(slotIdx);
        b.dmgFloat.push({ x, y: H - 320, v: String(a.damage), t: 0, color: '#ff8c8c' });
      }
    }
    this.shake = 0.3;
    if (res.finished) {
      if (res.playerWon) {
        b.victory = true; b.victoryT = 0;
        b.banner = 'VICTORY'; b.bannerT = 0;
        this.giveVictoryExp();
      } else {
        b.defeated = true;
        b.banner = '败北……'; b.bannerT = 0;
      }
    }
  }

  private teamSlotX(i: number): number {
    const cw = 150, gx = 16;
    const total = 5 * cw + 4 * gx;
    return (W - total) / 2 + i * (cw + gx) + cw / 2;
  }

  private giveVictoryExp(): void {
    for (const instId of this.teamInstIds) {
      const o = this.db.inventory.cards.find(c => c.instId === instId);
      if (o) o.exp += 30;
    }
  }

  /** 探索前进 */
  private doExplore(): void { this.doExploreOnce(); }

  /** 开始进军走路动画；auto=true 时落地后若无魔女则继续走 */
  private startMarch(auto: boolean): void {
    if (this.page !== 'sortie') return;
    if (this.marchAnim) return;
    if (this.db.user.energy < 10) {
      this.exploreMsg = {
        ok: false, reason: '体力不足', energySpent: 0, progressGain: 0,
        newProgress: this.activeStage.progress, event: 'none',
        lootGold: 0, lootGems: 0, completed: false, firstClear: false,
      };
      this.exploreMsgT = 0;
      return;
    }
    this.marchAnim = {
      t: 0, dur: 0.48, applied: false,
      fromProg: this.activeStage.progress,
      auto,
    };
  }

  private doExploreOnce(): ExploreResult {
    const r = ExploreStage(this.db, this.activeStage, (Math.random() * 1e9) | 0);
    this.exploreMsg = r;
    this.exploreMsgT = 0;
    this.jewels = this.db.user.gems;
    if (r.event === 'witch' && r.witchRaidId) {
      const raid = this.db.raids.find(x => x.raidId === r.witchRaidId)!;
      const delay = this.marchAnim ? 280 : 700;
      setTimeout(() => {
        this.page = 'battle'; this.battle = null; this.startBattle(raid); this.syncBgm();
        this.marchAnim = null;
      }, delay);
    }
    return r;
  }

  private burst(color: string, count: number): void {
    for (let i = 0; i < count; i++) {
      const a = Math.random() * Math.PI * 2;
      const sp = 150 + Math.random() * 350;
      this.particles.push({
        x: W / 2, y: H / 2, vx: Math.cos(a) * sp, vy: Math.sin(a) * sp - 120,
        life: 0.8 + Math.random() * 0.8, max: 1.6, color, r: 2 + Math.random() * 3,
      });
    }
  }

  // ============ 渲染 ============

  private render(): void {
    const ctx = this.ctx;
    ctx.clearRect(0, 0, W, H);

    // 震屏
    ctx.save();
    if (this.shake > 0) {
      const m = this.shake * 12;
      ctx.translate((Math.random() - 0.5) * m, (Math.random() - 0.5) * m);
    }

    this.bg.render(ctx);

    // 活动地图 / 出击 / 战斗 / 战绩：叠加归档场景背景（召唤页仍用神殿）
    if (this.page === 'event' || this.page === 'map' || this.page === 'records') {
      drawCover(ctx, loadAssetImage(eventMapBg(this.eventMapIndex)), W, H, 1);
      ctx.fillStyle = 'rgba(6,4,16,0.28)';
      ctx.fillRect(0, 0, W, H);
    } else if (this.page === 'sortie' || this.page === 'battle') {
      drawCover(ctx, loadAssetImage(battleBg(this.battleBgIndex)), W, H, 1);
      ctx.fillStyle = this.page === 'battle' ? 'rgba(20,6,24,0.35)' : 'rgba(12,6,20,0.32)';
      ctx.fillRect(0, 0, W, H);
    }

    if (this.page === 'summon') {
      if (this.phase.kind === 'hall') this.renderHall();
      else if (this.phase.kind === 'confirm') { this.renderHall(); this.renderConfirm(); }
      else if (this.phase.kind === 'summon') this.renderSummon();
      else if (this.phase.kind === 'reveal') this.renderReveal();
      else if (this.phase.kind === 'settle') this.renderSettle();
    } else if (this.page === 'event') this.renderEvent();
    else if (this.page === 'map') this.renderMap();
    else if (this.page === 'sortie') this.renderSortie();
    else if (this.page === 'battle') this.renderBattle();
    else if (this.page === 'team') this.renderTeam();
    else if (this.page === 'records') this.renderRecords();

    // 底部导航（战斗 / 结算时隐藏，避免与页面按钮重叠）
    if (this.page !== 'battle' && this.phase.kind !== 'settle' && !this.showRecharge) this.renderNav();

    // 全局：音乐 + 充值（每页右上角）
    this.renderGlobalHud();
    if (this.showRecharge) this.renderRecharge();

    // 粒子
    ctx.save();
    ctx.globalCompositeOperation = 'lighter';
    for (const p of this.particles) {
      const a = Math.max(0, p.life / p.max);
      ctx.fillStyle = p.color + Math.floor(a * 255).toString(16).padStart(2, '0');
      ctx.beginPath(); ctx.arc(p.x, p.y, p.r * a, 0, Math.PI * 2); ctx.fill();
    }
    ctx.restore();

    ctx.restore();

    // 全屏闪光
    if (this.flashV > 0) {
      ctx.fillStyle = this.flashColor + Math.floor(this.flashV * 200).toString(16).padStart(2, '0');
      ctx.fillRect(0, 0, W, H);
    }

    // 卡牌详情浮层（最顶层）
    if (this.cardDetail) this.renderCardDetail(this.cardDetail);
  }

  private renderCardDetail(card: Card): void {
    const ctx = this.ctx;
    const t = this.last / 1000;
    // 遮罩
    ctx.fillStyle = 'rgba(2,3,8,0.7)';
    ctx.fillRect(0, 0, W, H);
    this.buttons.push({ x: 0, y: 0, w: W, h: H, id: 'closeDetail' });

    // 左侧大卡
    const cw = 300, ch = 424;
    const cardX = W / 2 - 320, cardY = H / 2 - 20;
    drawCard(ctx, card, cardX, cardY, cw, ch, { isNew: false, rainbowT: (t * 0.3) % 1, showMeta: true });

    // 右侧信息面板（金属边框）
    const px = W / 2 + 10, py = H / 2 - 220, pw = 380, ph = 400;
    metalDialog(ctx, px, py, pw, ph);
    const col = RARITY_COLOR[card.rarity] || '#aaa';

    // 标题：名字 + 稀有度
    engravedText(ctx, card.name, px + pw / 2, py + 36, 24);
    this.pill(px + pw - 90, py + 16, 70, 26, col, col);
    this.text(card.rarity, px + pw - 55, py + 30, 14, '#0a0a12', 'center', 'bold');
    this.text(`Lv1 （ MAX50 ）`, px + 24, py + 36, 15, '#e8d5a8', 'left', 'bold');

    // 属性表
    const rows: [string, string, string, string][] = [
      ['攻击力', String(card.stats.attack), '兵力', String(card.stats.soldiers)],
      ['防御力', String(card.stats.defense), '成本', String(card.cardCost)],
    ];
    let ry = py + 90;
    for (const [l1, v1, l2, v2] of rows) {
      this.text(l1, px + 30, ry, 17, '#e8a0c0', 'left', 'bold');
      this.text(v1, px + 150, ry, 17, '#f0e6cc', 'left', 'bold');
      this.text(l2, px + 210, ry, 17, '#a0c0e8', 'left', 'bold');
      this.text(v2, px + 320, ry, 17, '#f0e6cc', 'left', 'bold');
      ry += 34;
    }
    // 速度 / 暴击
    this.text('速度', px + 30, ry, 15, '#a0e8c0', 'left', 'bold');
    this.text(String(card.stats.speed), px + 150, ry, 15, '#f0e6cc', 'left', 'bold');
    this.text('暴击', px + 210, ry, 15, '#a0e8c0', 'left', 'bold');
    this.text(`${(card.stats.critRate * 100).toFixed(0)}%`, px + 320, ry, 15, '#f0e6cc', 'left', 'bold');
    ry += 44;

    // 技能
    if (card.skillName) {
      this.text(card.skillName, px + 30, ry, 17, '#e8d5a8', 'left', 'bold');
      this.text('Lv.1', px + pw - 30, ry, 14, '#9ab', 'right');
      ry += 28;
      if (card.skillDesc) this.wrapText(card.skillDesc, px + 30, ry, pw - 60, 20, 13, '#b8c8d8');
    }

    // 关闭按钮
    glassButton(ctx, px + pw / 2 - 80, py + ph + 16, 160, 46, '关 闭', { kind: 'blue', hover: this.hover === 'closeDetail', fontSize: 17 });
    this.buttons.push({ x: px + pw / 2 - 80, y: py + ph + 16, w: 160, h: 46, id: 'closeDetail' });
  }

  // ============ 全局 HUD：音乐 / 充值 ============
  private renderGlobalHud(): void {
    const ctx = this.ctx;
    const muted = audio.isMuted();
    // 右上角：音乐 | 充值
    const bw = 56, bh = 40, gap = 10;
    const x1 = W - 20 - bw * 2 - gap;
    const y = 12;
    glassButton(ctx, x1, y, bw, bh, muted ? '🔇' : '🔊', {
      kind: muted ? 'gray' : 'blue', hover: this.hover === 'toggleMusic', fontSize: 18,
    });
    glassButton(ctx, x1 + bw + gap, y, bw, bh, '＋', {
      kind: 'green', hover: this.hover === 'openRecharge', fontSize: 22,
    });
    this.buttons.push({ x: x1, y, w: bw, h: bh, id: 'toggleMusic' });
    this.buttons.push({ x: x1 + bw + gap, y, w: bw, h: bh, id: 'openRecharge' });
  }

  private renderRecharge(): void {
    const ctx = this.ctx;
    const u = this.db.user;
    ctx.fillStyle = 'rgba(2,3,10,0.72)';
    ctx.fillRect(0, 0, W, H);
    this.buttons.push({ x: 0, y: 0, w: W, h: H, id: 'closeRecharge' });

    const pw = 520, ph = 460, px = (W - pw) / 2, py = (H - ph) / 2;
    metalDialog(ctx, px, py, pw, ph);
    // 阻止点穿到遮罩关闭：面板区域单独占位（无 id，仅挡一下用子按钮）
    this.buttons.push({ x: px, y: py, w: pw, h: ph, id: 'recharge:noop' });

    engravedText(ctx, '资源补给', px + pw / 2, py + 36, 22);
    this.text('调试用 · 本地即时生效', px + pw / 2, py + 62, 13, '#9ab', 'center');

    const rows: { id: string; label: string; sub: string }[] = [
      { id: 'energy', label: '行动力回满', sub: `${u.energy}/${u.energyMax}` },
      { id: 'energy+50', label: '行动力 +500', sub: `上限 ${u.energyMax}` },
      { id: 'battlePt', label: '战斗体力回满', sub: `${u.battlePt}/${u.battlePtMax}` },
      { id: 'gold', label: '金币 +10万', sub: String(u.gold.toLocaleString()) },
      { id: 'gems', label: '宝石 +1万', sub: String(u.gems.toLocaleString()) },
      { id: 'fp', label: '友情点 +1万', sub: String(u.friendPt.toLocaleString()) },
      { id: 'tickets', label: '各池召唤券 +10', sub: '全部卡池' },
      { id: 'all', label: '一键全补', sub: '体力/金币/宝石/券' },
    ];

    let ry = py + 90;
    for (const r of rows) {
      const hov = this.hover === `recharge:${r.id}`;
      glassButton(ctx, px + 28, ry, 280, 36, r.label, {
        kind: r.id === 'all' ? 'green' : 'blue', hover: hov, fontSize: 15,
      });
      this.text(r.sub, px + pw - 36, ry + 18, 13, '#cfc4a8', 'right');
      this.buttons.push({ x: px + 28, y: ry, w: 280, h: 36, id: `recharge:${r.id}` });
      ry += 42;
    }

    glassButton(ctx, px + pw / 2 - 70, py + ph - 52, 140, 40, '关 闭', {
      kind: 'gray', hover: this.hover === 'closeRecharge', fontSize: 16,
    });
    this.buttons.push({ x: px + pw / 2 - 70, y: py + ph - 52, w: 140, h: 40, id: 'closeRecharge' });
  }

  // ============ 底部导航 ============
  private renderNav(): void {
    const ctx = this.ctx;
    const items: { id: Page; label: string; icon: string }[] = [
      { id: 'summon', label: '召唤', icon: '✦' },
      { id: 'event', label: '活动', icon: '⚑' },
      { id: 'map', label: '出击', icon: '⚔' },
      { id: 'team', label: '队伍', icon: '❖' },
      { id: 'records', label: '战绩', icon: '♛' },
    ];
    const ny = H - 56, nw = 128, nh = 48, gap = 10;
    const total = items.length * nw + (items.length - 1) * gap;
    let nx = (W - total) / 2;
    for (const it of items) {
      const active = this.page === it.id
        || (it.id === 'map' && (this.page === 'sortie' || this.page === 'battle'));
      const hov = this.hover === `nav:${it.id}`;
      glassButton(ctx, nx, ny, nw, nh, `${it.icon} ${it.label}`, {
        kind: active ? 'blue' : 'gray', hover: hov, fontSize: 15,
      });
      this.buttons.push({ x: nx, y: ny, w: nw, h: nh, id: `nav:${it.id}` });
      nx += nw + gap;
    }
  }

  // ============ 战绩（讨伐奖励领取） ============
  private renderRecords(): void {
    const ctx = this.ctx;
    this.buttons = [];

    // 深青氛围叠层（参考 VC 战绩截图）
    ctx.fillStyle = 'rgba(8, 28, 36, 0.55)';
    ctx.fillRect(0, 0, W, H);

    // 返回
    glassButton(ctx, 24, 70, 110, 40, '‹ 返回', {
      kind: 'gray', hover: this.hover === 'recordsBack', fontSize: 16,
    });
    this.buttons.push({ x: 24, y: 70, w: 110, h: 40, id: 'recordsBack' });

    // 顶部资源条（行动力/金/宝石/券）
    const u = this.db.user;
    this.pill(24, 16, 168, 36, '#0d1a22', '#6fce9a');
    this.text(`⚔ ${u.energy}/${u.energyMax}`, 108, 35, 13, '#8fe8a8', 'center', 'bold');
    this.resBar(W - 620, 14, '🪙', u.gold, '#ffd24d');
    this.resBar(W - 440, 14, '💎', u.gems, '#b45cff');
    this.resBar(W - 260, 14, '🎟', u.tickets.fate || 0, '#ff8c8c');

    // 一次性领取
    const claimable = this.db.raids.filter(r => r.defeated && !r.claimed).length;
    glassButton(ctx, W / 2 - 160, 70, 320, 48, '一次性领取奖励', {
      kind: claimable > 0 ? 'blue' : 'gray',
      hover: this.hover === 'claimAll',
      fontSize: 18,
    });
    this.buttons.push({ x: W / 2 - 160, y: 70, w: 320, h: 48, id: 'claimAll' });

    // 列表面板
    const list = this.db.raids.filter(r => r.defeated);
    const panelX = 80, panelY = 136, panelW = W - 160, panelH = H - 210;
    ctx.fillStyle = 'rgba(12, 28, 42, 0.82)';
    this.rr(panelX, panelY, panelW, panelH, 10); ctx.fill();
    ctx.strokeStyle = 'rgba(160, 200, 220, 0.55)';
    ctx.lineWidth = 2;
    this.rr(panelX, panelY, panelW, panelH, 10); ctx.stroke();

    if (list.length === 0) {
      this.text('暂无讨伐战绩', W / 2, panelY + panelH / 2, 20, '#9ab', 'center');
      this.text('出击探索遭遇魔女并击败后会出现在这里', W / 2, panelY + panelH / 2 + 32, 14, '#789', 'center');
      return;
    }

    const rowH = 118, gap = 10;
    const maxScroll = Math.max(0, list.length * (rowH + gap) - (panelH - 24));
    this.recordsScroll = Math.max(0, Math.min(this.recordsScroll, maxScroll));

    ctx.save();
    ctx.beginPath();
    this.rr(panelX + 4, panelY + 4, panelW - 8, panelH - 8, 8);
    ctx.clip();

    let ry = panelY + 14 - this.recordsScroll;
    for (const raid of list) {
      if (ry + rowH < panelY || ry > panelY + panelH) {
        ry += rowH + gap;
        continue;
      }
      this.renderRecordRow(raid, panelX + 16, ry, panelW - 32, rowH);
      ry += rowH + gap;
    }
    ctx.restore();

    // toast
    if (this.recordsToast && this.recordsToastT < 2.5) {
      const a = Math.min(1, Math.min(this.recordsToastT / 0.15, (2.5 - this.recordsToastT) / 0.4));
      ctx.save();
      ctx.globalAlpha = a;
      this.pill(W / 2 - 220, H - 120, 440, 40, '#0d1a22', '#ffe14d');
      this.text(this.recordsToast, W / 2, H - 99, 14, '#ffe9a8', 'center', 'bold');
      ctx.restore();
    }
  }

  private renderRecordRow(
    raid: WitchRaidBoss, x: number, y: number, w: number, h: number,
  ): void {
    const ctx = this.ctx;
    const g = ctx.createLinearGradient(x, y, x + w, y);
    g.addColorStop(0, '#1a2a3c');
    g.addColorStop(0.55, '#182030');
    g.addColorStop(1, '#3a1820');
    this.rr(x, y, w, h, 8); ctx.fillStyle = g; ctx.fill();
    ctx.strokeStyle = 'rgba(180,210,230,0.35)';
    ctx.lineWidth = 1.5;
    this.rr(x, y, w, h, 8); ctx.stroke();

    // 卡图
    const card = (raid.bossCardId && getCard(raid.bossCardId))
      || cardsByRarity(raid.archWitch ? 'X' : 'LR')[0]
      || cardsByRarity('UR')[0];
    if (card) {
      preloadImage(card).catch(() => {});
      drawCard(ctx, card, x + 58, y + h / 2, 86, 100, {
        showName: false, showBadge: true,
      });
    }

    // 信息
    const name = raid.name || '未知魔女';
    this.text(`Lv.${raid.level} ${name}`, x + 120, y + 32, 20, '#fff', 'left', 'bold');
    this.text(`发现者：${raid.discoveredBy}`, x + 120, y + 58, 14, '#c8d8e8', 'left');
    // HP 条（已击败显示 0 / max）
    const barX = x + 120, barY = y + 74, barW = 420, barH = 22;
    this.rr(barX, barY, barW, barH, 6); ctx.fillStyle = '#0a1218'; ctx.fill();
    ctx.strokeStyle = '#5a7080'; ctx.lineWidth = 1;
    this.rr(barX, barY, barW, barH, 6); ctx.stroke();
    this.text(`0 / ${raid.hpMax.toLocaleString()}`, barX + barW / 2, barY + 12, 13, '#e8f0f8', 'center', 'bold');

    // 领取按钮（橙）
    const bx = x + w - 150, by = y + h / 2 - 22, bw = 130, bh = 44;
    const claimed = raid.claimed;
    const hov = this.hover === `claim:${raid.raidId}`;
    ctx.save();
    if (hov && !claimed) { ctx.shadowColor = '#ffb060'; ctx.shadowBlur = 16; }
    const og = ctx.createLinearGradient(0, by, 0, by + bh);
    if (claimed) {
      og.addColorStop(0, '#9a9088'); og.addColorStop(1, '#5a5048');
    } else {
      og.addColorStop(0, '#ffd080'); og.addColorStop(0.45, '#f08828'); og.addColorStop(1, '#b04810');
    }
    this.rr(bx, by, bw, bh, bh / 2); ctx.fillStyle = og; ctx.fill();
    ctx.shadowBlur = 0;
    ctx.strokeStyle = claimed ? '#b0a898' : '#ffe0a0';
    ctx.lineWidth = 2;
    this.rr(bx, by, bw, bh, bh / 2); ctx.stroke();
    ctx.restore();
    this.text(claimed ? '已领取' : '领取', bx + bw / 2, by + bh / 2 + 1, 18,
      claimed ? '#ddd' : '#2a1208', 'center', 'bold');
    if (!claimed) this.buttons.push({ x: bx, y: by, w: bw, h: bh, id: `claim:${raid.raidId}` });
  }

  // ============ 活动界面 ============
  private renderEvent(): void {
    const ctx = this.ctx;
    this.buttons = [];
    ctx.fillStyle = 'rgba(8,6,18,0.5)';
    ctx.fillRect(0, 0, W, H);

    // 左侧看板娘立绘
    const girl = cardsByRarity('VR')[0] ?? cardsByRarity('X')[0] ?? null;
    // 看板娘：缩小为半立绘，位于左下，不压对话框
    if (girl) {
      const img = this.imgOf(girl);
      if (img) {
        const maxH = 300, maxW = 240;
        const sc = Math.min(maxW / img.width, maxH / img.height);
        const dw = img.width * sc, dh = img.height * sc;
        ctx.save();
        ctx.globalAlpha = 0.96;
        ctx.drawImage(img, 70 + (maxW - dw) / 2, 200 + (maxH - dh) / 2, dw, dh);
        ctx.restore();
      } else {
        drawCard(ctx, girl, 190, 350, 200, 290, {});
      }
    }
    // 对话框（贴看板娘下方）
    const dlgX = 30, dlgY = H - 190, dlgW = 380, dlgH = 100;
    ctx.fillStyle = 'rgba(255,255,255,0.95)';
    this.rr(dlgX, dlgY, dlgW, dlgH, 14); ctx.fill();
    ctx.strokeStyle = '#c8b285'; ctx.lineWidth = 2; this.rr(dlgX, dlgY, dlgW, dlgH, 14); ctx.stroke();
    // 对话小三角
    ctx.beginPath(); ctx.moveTo(dlgX + 90, dlgY); ctx.lineTo(dlgX + 110, dlgY - 16); ctx.lineTo(dlgX + 130, dlgY); ctx.closePath();
    ctx.fillStyle = 'rgba(255,255,255,0.95)'; ctx.fill(); ctx.strokeStyle = '#c8b285'; ctx.stroke();
    this.wrapText('目前似乎有举办期间限定的活动要参加哦！去看看吧！', dlgX + 18, dlgY + 32, dlgW - 36, 24, 15, '#333', 'bold');

    this.text('活 动', 60, 60, 34, '#f5e0a0', 'left', 'bold', true);

    // 右侧活动卡片（精致版）
    const cards: { title: string; sub: string; accent: string; thumbIdx: number }[] = [
      { title: 'DUEL', sub: '圣货召唤 · 限时决斗', accent: '#e0b34d', thumbIdx: 0 },
      { title: 'EVENT CHRONICLE', sub: '活动编年史 · 限时', accent: '#4da3ff', thumbIdx: 1 },
      { title: '魔女讨伐', sub: '幻想魔女出现！', accent: '#ff5c8a', thumbIdx: 2 },
      { title: '战斗少女的修练场', sub: '挑战次数 21/21', accent: '#6fce9a', thumbIdx: 0 },
    ];
    let cy = 96;
    for (let ci = 0; ci < cards.length; ci++) {
      const c = cards[ci];
      const cx = W - 520, cw = 480, ch = 112;
      const hov = this.hover === `event:${c.title}`;
      ctx.save();
      if (hov) { ctx.shadowColor = c.accent; ctx.shadowBlur = 22; }
      // 主背景：斜向分层渐变
      const g = ctx.createLinearGradient(cx, cy, cx + cw, cy + ch);
      g.addColorStop(0, '#221a34');
      g.addColorStop(0.5, '#151020');
      g.addColorStop(1, '#0c0916');
      this.rr(cx, cy, cw, ch, 14); ctx.fillStyle = g; ctx.fill();
      ctx.shadowBlur = 0;
      // 左侧色条
      const sg = ctx.createLinearGradient(cx, cy, cx, cy + ch);
      sg.addColorStop(0, c.accent); sg.addColorStop(1, c.accent + '55');
      ctx.fillStyle = sg;
      this.rr(cx, cy, 8, ch, 4); ctx.fill();
      // 顶部高光
      ctx.fillStyle = 'rgba(255,255,255,0.06)';
      this.rr(cx + 8, cy, cw - 8, ch / 2, 14); ctx.fill();
      // 金属边框
      const bg = ctx.createLinearGradient(cx, cy, cx, cy + ch);
      bg.addColorStop(0, '#e8e8f2'); bg.addColorStop(0.5, '#98a0b8'); bg.addColorStop(1, '#5a6478');
      ctx.strokeStyle = bg; ctx.lineWidth = 2.5;
      this.rr(cx, cy, cw, ch, 14); ctx.stroke();
      // 标题 + 副标题（左对齐）
      this.text(c.title, cx + 32, cy + 40, 26, c.accent, 'left', 'bold', true);
      this.text(c.sub, cx + 32, cy + 76, 14, '#cfc4a8', 'left', 'bold');
      // 立绘缩略（右侧圆形裁剪感）
      const thumbPool = cardsByRarity('LR');
      const thumb = thumbPool[c.thumbIdx % thumbPool.length];
      if (thumb) drawCard(ctx, thumb, cx + cw - 62, cy + ch / 2, 74, 100, { showName: false });
      // 进入箭头
      ctx.fillStyle = c.accent;
      ctx.beginPath();
      ctx.moveTo(cx + cw - 18, cy + ch / 2 - 8);
      ctx.lineTo(cx + cw - 6, cy + ch / 2);
      ctx.lineTo(cx + cw - 18, cy + ch / 2 + 8);
      ctx.closePath(); ctx.fill();
      ctx.restore();
      this.buttons.push({ x: cx, y: cy, w: cw, h: ch, id: `event:${c.title}` });
      cy += 124;
    }
  }

  // ============ 跑图界面 ============
  private renderMap(): void {
    const ctx = this.ctx;
    this.buttons = [];
    // 顶部标题
    this.pill(W / 2 - 200, 16, 400, 44, '#0d0a16', '#c8b285');
    this.text('神界地图 2 · 战斗少女的修练场', W / 2, 39, 18, '#ffe9a8', 'center', 'bold');
    this.pill(20, 16, 168, 40, '#0d0a16', '#6fce9a');
    this.text(`行动力 ${this.db.user.energy}/${this.db.user.energyMax}`, 104, 37, 13, '#8fe8a8', 'center', 'bold');
    this.pill(20, 62, 130, 36, '#0d0a16', '#c8b285');
    this.text('挑战次数 21/21', 85, 81, 12, '#e8d5a8', 'center', 'bold');

    // 节点（浮岛关卡）
    const nodes = this.mapNodes();
    for (const n of nodes) {
      const hov = this.hover === `node:${n.x},${n.y}`;
      // 翅膀/龙图标
      ctx.save();
      if (hov) { ctx.shadowColor = '#ffe14d'; ctx.shadowBlur = 16; }
      ctx.translate(n.x, n.y);
      const scale = n.done ? 0.9 : 1;
      ctx.scale(scale, scale);
      // 翅膀形
      ctx.fillStyle = n.done ? '#8a94a8' : '#c05ce8';
      ctx.strokeStyle = n.done ? '#5a6478' : '#ffb3f0';
      ctx.lineWidth = 2;
      for (const dir of [-1, 1]) {
        ctx.beginPath();
        ctx.moveTo(0, 8);
        ctx.quadraticCurveTo(dir * 22, -14, dir * 30, 6);
        ctx.quadraticCurveTo(dir * 16, 2, dir * 6, 14);
        ctx.closePath(); ctx.fill(); ctx.stroke();
      }
      ctx.fillStyle = n.done ? '#aab' : '#fff';
      ctx.beginPath(); ctx.arc(0, 4, 7, 0, Math.PI * 2); ctx.fill(); ctx.stroke();
      ctx.restore();
      if (n.newTag) {
        this.pill(n.x - 18, n.y - 34, 36, 16, '#d33', '#ffb3b3');
        this.text('NEW', n.x, n.y - 25, 10, '#fff', 'center', 'bold');
      }
      this.buttons.push({ x: n.x - 24, y: n.y - 24, w: 48, h: 48, id: `node:${n.x},${n.y}` });
    }
    // 世界地图切换
    glassButton(ctx, 30, H - 140, 150, 44, '« 换地图', { kind: 'gray', hover: this.hover === 'worldmap', fontSize: 15 });
    this.buttons.push({ x: 30, y: H - 140, w: 150, h: 44, id: 'worldmap' });
  }

  private mapNodes(): { x: number; y: number; done: boolean; newTag: boolean }[] {
    return [
      { x: 180, y: 200, done: true, newTag: false },
      { x: 320, y: 300, done: true, newTag: false },
      { x: 480, y: 220, done: false, newTag: true },
      { x: 660, y: 320, done: false, newTag: false },
      { x: 840, y: 200, done: false, newTag: false },
      { x: 1000, y: 300, done: false, newTag: false },
      { x: 300, y: 480, done: false, newTag: false },
      { x: 620, y: 520, done: false, newTag: false },
      { x: 940, y: 480, done: false, newTag: false },
    ];
  }

  // ============ 出击界面 ============
  private renderSortie(): void {
    const ctx = this.ctx;
    this.buttons = [];
    // 雷电城堡氛围：压暗 + 闪电
    ctx.fillStyle = 'rgba(20,8,30,0.5)';
    ctx.fillRect(0, 0, W, H);
    const t = this.last / 1000;
    if (Math.sin(t * 0.7) > 0.96) {
      ctx.fillStyle = 'rgba(200,180,255,0.2)';
      ctx.fillRect(0, 0, W, H);
    }

    // 顶部：行动力 + 进度条（显示值平滑）
    this.pill(20, 14, 168, 40, '#0d0a16', '#6fce9a');
    this.text(`行动力 ${this.db.user.energy}/${this.db.user.energyMax}`, 104, 35, 13, '#8fe8a8', 'center', 'bold');
    const prog = this.displayProg;
    const px = W / 2 - 220, pw = 440, py = 18, ph = 26;
    this.rr(px, py, pw, ph, 13); ctx.fillStyle = '#0d0a16'; ctx.fill();
    this.rr(px + 2, py + 2, Math.max(0, (pw - 4) * prog), ph - 4, 11);
    ctx.fillStyle = '#5fce5f'; ctx.fill();
    this.rr(px, py, pw, ph, 13); ctx.strokeStyle = '#c8b285'; ctx.lineWidth = 2; ctx.stroke();
    this.text(this.activeStage.name, px + pw / 2, py + 14, 13, '#fff', 'center', 'bold');
    this.text(`${Math.floor(prog * 100)}%`, px + pw - 36, py + 14, 14, '#fff', 'center', 'bold');
    this.text(`第 ${this.activeStage.stepsTaken || 0} 步`, px + pw / 2, py + 42, 12, '#cfc4a8', 'center');

    // 资源
    this.resBar(W - 320, 14, '🪙', this.db.user.gold, '#ffd24d');
    this.resBar(W - 320, 52, '💎', this.db.user.gems, '#b45cff');

    // 探索事件提示
    if (this.exploreMsg && this.exploreMsgT < 3) this.renderExploreToast();

    // 走路弹跳：中央小人/队伍前跳示意
    this.renderMarchHop();

    // 进军 / Auto（动画中禁用重复点）
    const cost = 10;
    const busy = !!this.marchAnim;
    glassButton(ctx, W / 2 - 230, 300, 280, 70, busy ? '前进中…' : `进军（🔥-${cost}）`, {
      kind: busy ? 'gray' : 'green', hover: !busy && this.hover === 'march', fontSize: 24,
    });
    this.buttons.push({ x: W / 2 - 230, y: 300, w: 280, h: 70, id: 'march' });
    glassButton(ctx, W / 2 + 70, 300, 180, 70, busy ? '…' : 'Auto', {
      kind: busy ? 'gray' : 'green', hover: !busy && this.hover === 'auto', fontSize: 22,
    });
    this.buttons.push({ x: W / 2 + 70, y: 300, w: 180, h: 70, id: 'auto' });

    // 底部队伍（带弹跳）
    this.renderTeamStrip(H - 180, true);
  }

  /** 进军时：角色往前蹦一下 */
  private renderMarchHop(): void {
    const ctx = this.ctx;
    const m = this.marchAnim;
    const p = m ? Math.min(1, m.t / m.dur) : 0;
    const hop = m ? Math.sin(p * Math.PI) : 0;
    const x = W / 2 + hop * 56;
    const y = 210 - hop * 42;
    // 影子
    ctx.save();
    ctx.fillStyle = `rgba(0,0,0,${0.35 - hop * 0.2})`;
    ctx.beginPath();
    ctx.ellipse(W / 2 + hop * 40, 248, 28 - hop * 8, 8 - hop * 2, 0, 0, Math.PI * 2);
    ctx.fill();
    // 小人（简化骑士剪影）
    ctx.translate(x, y);
    ctx.fillStyle = '#e8d5a8';
    ctx.beginPath(); ctx.arc(0, -28, 12, 0, Math.PI * 2); ctx.fill();
    ctx.fillStyle = '#6a9ad8';
    this.rr(-14, -16, 28, 36, 8); ctx.fill();
    ctx.fillStyle = '#c8b285';
    this.rr(-18, 18, 14, 10, 3); ctx.fill();
    this.rr(4, 18, 14, 10, 3); ctx.fill();
    if (hop > 0.1) {
      ctx.fillStyle = 'rgba(255,225,100,0.55)';
      ctx.beginPath();
      ctx.moveTo(-20, 8); ctx.lineTo(-36, 2); ctx.lineTo(-18, 16); ctx.fill();
    }
    ctx.restore();
  }

  private renderExploreToast(): void {
    const ctx = this.ctx;
    const r = this.exploreMsg!;
    let msg = '', color = '#cfc4a8';
    if (!r.ok) { msg = r.reason || '无法前进'; color = '#ff8c8c'; }
    else if (r.firstClear && r.firstClearReward) { msg = r.firstClearReward; color = '#ffe14d'; }
    else if (r.event === 'loot') { msg = `拾取：金币+${r.lootGold}${r.lootGems ? ` 宝石+${r.lootGems}` : ''}${r.lootCardRarity ? ` ${r.lootCardRarity}卡` : ''}`; color = '#8fe8a8'; }
    else if (r.event === 'mob') { msg = `遭遇小怪！快速胜利 金币+${r.lootGold} 狗粮+1`; color = '#ffd24d'; }
    else if (r.event === 'witch') {
      const raid = r.witchRaidId ? this.db.raids.find(x => x.raidId === r.witchRaidId) : null;
      msg = raid?.archWitch ? '☠ 超·幻想大魔女降临！' : '⚠ 魔女降临！';
      color = raid?.archWitch ? '#ffd24d' : '#ff5ce8';
    }
    else if (r.ok) {
      msg = `前进！探索 ${Math.floor(r.newProgress * 100)}%（+${Math.floor(r.progressGain * 100)}%）`;
      color = '#cfc4a8';
    }
    else { msg = `探索推进 +${Math.floor(r.progressGain * 100)}%`; color = '#cfc4a8'; }
    const a = Math.min(1, Math.min(this.exploreMsgT / 0.2, (3 - this.exploreMsgT) / 0.4));
    ctx.save();
    ctx.globalAlpha = Math.max(0, a);
    this.pill(W / 2 - 260, 70, 520, 44, 'rgba(13,10,22,0.92)', color);
    this.text(msg, W / 2, 92, 16, color, 'center', 'bold');
    ctx.restore();
  }

  private resBar(x: number, y: number, icon: string, val: number, color: string): void {
    this.pill(x, y, 300, 34, '#0d0a16', color);
    this.text(`${icon} ${val.toLocaleString()}`, x + 150, y + 18, 14, color, 'center', 'bold');
  }

  private renderTeamStrip(baseY: number, clickable: boolean): void {
    const ctx = this.ctx;
    const team = this.teamCombatants();
    const cw = 150, ch = 212, gx = 16;
    const total = 5 * cw + 4 * gx;
    let x = (W - total) / 2;
    const m = this.marchAnim;
    const hop = m ? Math.sin(Math.min(1, m.t / m.dur) * Math.PI) : 0;
    const xHop = hop * 22;
    const yHop = -hop * 26;
    for (let i = 0; i < team.length; i++) {
      const slot = team[i];
      const stagger = hop * (i - 2) * 3;
      drawCard(ctx, slot.card, x + cw / 2 + xHop + stagger, baseY + ch / 2 + yHop, cw, ch,
        { showName: false, showBadge: true, rainbowT: (this.last / 1000 * 0.3) % 1 });
      // 队长标记
      if (slot.isLeader) {
        this.pill(x + 4 + xHop, baseY - 4 + yHop, 40, 18, '#3a2a08', '#ffd24d');
        this.text('队长', x + 24 + xHop, baseY + 6 + yHop, 10, '#ffd24d', 'center', 'bold');
      }
      // Lv
      this.pill(x + cw / 2 - 30 + xHop, baseY - 4 + yHop, 60, 18, '#0d0a16', '#c8b285');
      this.text(`Lv.${slot.lv}`, x + cw / 2 + xHop, baseY + 6 + yHop, 11, '#ffe9a8', 'center', 'bold');
      // HP 条
      const hpr = Math.max(0, slot.hp / slot.hpMax);
      this.rr(x + 6 + xHop, baseY + ch + 4 + yHop, cw - 12, 8, 4); ctx.fillStyle = '#0d0a16'; ctx.fill();
      this.rr(x + 6 + xHop, baseY + ch + 4 + yHop, (cw - 12) * hpr, 8, 4);
      ctx.fillStyle = hpr > 0.3 ? '#5fce5f' : '#e85c5c'; ctx.fill();
      this.text(String(Math.floor(slot.hp)), x + cw / 2 + xHop, baseY + ch + 18 + yHop, 10, '#cfc4a8', 'center');
      if (clickable) this.buttons.push({ x: x + xHop, y: baseY + yHop, w: cw, h: ch, id: `teamcard:${i}` });
      x += cw + gx;
    }
  }

  // ============ 队伍编成页 ============
  private activateTeam(id: string): void {
    const inv = this.db.inventory;
    // 关闭详情
    if (id === 'closeTeamDetail') { this.detailInst = null; this.enhanceMode = false; this.evolveMode = false; this.enhancePicks.clear(); this.evolvePick = null; return; }
    // 筛选
    if (id.startsWith('filter:')) { this.invFilter = id.slice(7); this.invScroll = 0; return; }
    // 滚动
    if (id === 'invUp') { this.invScroll = Math.max(0, this.invScroll - 1); return; }
    if (id === 'invDown') { this.invScroll += 1; return; }
    // 出击槽：选中/卸下
    if (id.startsWith('slot:')) {
      const i = parseInt(id.slice(5), 10);
      if (this.teamSelSlot === i) { this.teamSelSlot = -1; return; }
      this.teamSelSlot = i;
      return;
    }
    // 库存卡
    if (id.startsWith('inv:')) {
      const instId = id.slice(4);
      // 强化选狗粮
      if (this.enhanceMode && this.detailInstKeep) {
        if (instId === this.detailInstKeep) return;
        if (this.enhancePicks.has(instId)) this.enhancePicks.delete(instId); else this.enhancePicks.add(instId);
        return;
      }
      // 进化选素材
      if (this.evolveMode && this.detailInstKeep) {
        const target = inv.cards.find(c => c.instId === this.detailInstKeep);
        const cand = inv.cards.find(c => c.instId === instId);
        if (cand && target && cand.cardId === target.cardId && cand.instId !== target.instId) {
          this.evolvePick = instId;
        } else {
          this.flashTeamMsg('必须选择同名卡作为进化素材');
        }
        return;
      }
      // 编队：若选中了出击槽，把这张卡换上
      if (this.teamSelSlot >= 0) {
        this.teamInstIds[this.teamSelSlot] = instId;
        const c = inv.cards.find(x => x.instId === instId);
        if (c) { const card = getCard(c.cardId); if (card) preloadImage(card).catch(() => {}); }
        this.flashTeamMsg(`已上阵到位置 ${this.teamSelSlot + 1}`);
        this.teamSelSlot = -1;
        return;
      }
      // 默认：打开详情
      this.detailInst = instId;
      this.enhanceMode = false; this.evolveMode = false; this.enhancePicks.clear(); this.evolvePick = null;
      return;
    }
    // 详情弹层按钮：强化/进化 → 关闭详情进入选择模式（主卡记在 detailInstKeep）
    if (id === 'enhanceStart') { this.enhanceMode = true; this.evolveMode = false; this.enhancePicks.clear(); this.detailInstKeep = this.detailInst; this.detailInst = null; return; }
    if (id === 'enhanceGo') {
      const target = this.detailInstKeep;
      if (!target || this.enhancePicks.size === 0) { this.flashTeamMsg('请先点选狗粮卡'); return; }
      const r = EnhanceCard(this.db, target, [...this.enhancePicks]);
      if (r.ok) { this.flashTeamMsg(`强化成功！Lv.${r.lvBefore} → Lv.${r.lvAfter}（金币-${r.goldSpent}）`); }
      else this.flashTeamMsg(r.reason || '强化失败');
      this.enhancePicks.clear(); this.enhanceMode = false;
      this.detailInst = target; this.detailInstKeep = null; // 回到主卡详情
      return;
    }
    if (id === 'evolveStart') { this.evolveMode = true; this.enhanceMode = false; this.evolvePick = null; this.detailInstKeep = this.detailInst; this.detailInst = null; return; }
    if (id === 'evolveGo') {
      const target = this.detailInstKeep;
      if (!target || !this.evolvePick) { this.flashTeamMsg('请先点选同名素材卡'); return; }
      const r = EvolveCard(this.db, target, this.evolvePick);
      if (r.ok) this.flashTeamMsg(`进化成功！继承 ATK+${r.inheritedAtk} HP+${r.inheritedHp}，进阶 ${r.newEvoStage}`);
      else this.flashTeamMsg(r.reason || '进化失败');
      this.evolvePick = null; this.evolveMode = false;
      this.detailInst = target; this.detailInstKeep = null;
      return;
    }
    if (id === 'sellCard') {
      if (!this.detailInst) return;
      const o = inv.cards.find(c => c.instId === this.detailInst);
      if (!o) return;
      const card = getCard(o.cardId);
      const gain = card ? RANK[card.rarity] * 500 : 100;
      this.db.user.gold += gain;
      inv.cards = inv.cards.filter(c => c.instId !== this.detailInst);
      this.teamInstIds = this.teamInstIds.map(t => t === this.detailInst ? (inv.cards[0]?.instId ?? t) : t);
      this.flashTeamMsg(`已出售，金币 +${gain}`);
      this.detailInst = null;
      return;
    }
    if (id === 'lockCard') {
      const o = inv.cards.find(c => c.instId === this.detailInst);
      if (o) { o.locked = !o.locked; this.flashTeamMsg(o.locked ? '已锁定' : '已解锁'); }
      return;
    }
  }

  private flashTeamMsg(msg: string): void { this.teamMsg = msg; this.teamMsgT = 0; }

  private renderTeam(): void {
    const ctx = this.ctx;
    this.buttons = [];
    ctx.fillStyle = 'rgba(8,6,18,0.55)';
    ctx.fillRect(0, 0, W, H);
    this.text('队 伍 编 成', 60, 52, 30, '#f5e0a0', 'left', 'bold', true);

    // ── 左：出击队伍 5 槽 ──
    this.text('出击队伍', 60, 92, 16, '#cfc4a8', 'left', 'bold');
    const team = this.teamCombatants();
    const cw = 118, ch = 168, gap = 14;
    let sx = 50;
    const sy = 108;
    for (let i = 0; i < 5; i++) {
      const slot = team[i];
      const sel = this.teamSelSlot === i;
      ctx.save();
      if (sel) { ctx.shadowColor = '#ffe14d'; ctx.shadowBlur = 20; }
      if (slot) {
        drawCard(ctx, slot.card, sx + cw / 2, sy + ch / 2, cw, ch, { showName: false, rainbowT: (this.last / 1000 * 0.3) % 1 });
      } else {
        this.rr(sx, sy, cw, ch, 8); ctx.fillStyle = 'rgba(20,16,32,0.8)'; ctx.fill();
        ctx.strokeStyle = '#444'; ctx.setLineDash([5, 4]); this.rr(sx, sy, cw, ch, 8); ctx.stroke(); ctx.setLineDash([]);
        this.text('空', sx + cw / 2, sy + ch / 2, 16, '#666', 'center', 'bold');
      }
      ctx.restore();
      const bcol = sel ? '#ffe14d' : (slot?.isLeader ? '#ffd24d' : '#8892a8');
      ctx.strokeStyle = bcol; ctx.lineWidth = sel ? 3 : 1.5;
      this.rr(sx, sy, cw, ch, 8); ctx.stroke();
      this.text(slot ? `Lv.${slot.lv}${slot.isLeader ? ' 队长' : ''}` : '', sx + cw / 2, sy + ch + 16, 11, '#e8d5a8', 'center', 'bold');
      this.buttons.push({ x: sx, y: sy, w: cw, h: ch, id: `slot:${i}` });
      sx += cw + gap;
    }
    if (this.teamSelSlot >= 0) {
      this.text('已选中位置 ' + (this.teamSelSlot + 1) + '，点右侧库存卡上阵', 60, sy + ch + 40, 13, '#ffe14d', 'left', 'bold');
    }

    // ── 右：库存网格 ──
    const inv = this.db.inventory.cards;
    const filters = ['ALL', 'VR', 'X', 'LR', 'UR', 'SR', 'R', 'N'];
    let fx = 60;
    for (const f of filters) {
      const act = this.invFilter === f;
      glassButton(ctx, fx, 320, f === 'ALL' ? 64 : 52, 30, f, { kind: act ? 'blue' : 'gray', hover: this.hover === `filter:${f}`, fontSize: 13 });
      this.buttons.push({ x: fx, y: 320, w: f === 'ALL' ? 64 : 52, h: 30, id: `filter:${f}` });
      fx += (f === 'ALL' ? 64 : 52) + 8;
    }
    this.text(`库存 ${inv.length}/${this.db.inventory.capacity}`, W - 60, 338, 14, '#cfc4a8', 'right', 'bold');

    const filtered = inv.filter(o => {
      const c = getCard(o.cardId); if (!c) return false;
      return this.invFilter === 'ALL' || c.rarity === this.invFilter;
    }).sort((a, b) => {
      const ra = RANK[getCard(a.cardId)?.rarity ?? 'N'], rb = RANK[getCard(b.cardId)?.rarity ?? 'N'];
      return rb - ra || b.lv - a.lv;
    });

    const cols = 7, icw = 108, ich = 148, igx = 10, igy = 10;
    const gridX = 50, gridY = 384;
    const rowsVisible = 2;
    const maxScroll = Math.max(0, Math.ceil(filtered.length / cols) - rowsVisible);
    this.invScroll = Math.min(this.invScroll, maxScroll);
    const start = this.invScroll * cols;
    const visible = filtered.slice(start, start + cols * rowsVisible);

    visible.forEach((o, vi) => {
      const c = getCard(o.cardId); if (!c) return;
      const col = vi % cols, row = Math.floor(vi / cols);
      const x = gridX + col * (icw + igx) + icw / 2;
      const y = gridY + row * (ich + igy) + ich / 2;
      const inTeam = this.teamInstIds.includes(o.instId);
      const picked = this.enhancePicks.has(o.instId) || this.evolvePick === o.instId;
      const isDetail = this.detailInst === o.instId;
      ctx.save();
      if (picked) { ctx.shadowColor = '#6fce9a'; ctx.shadowBlur = 16; }
      drawCard(ctx, c, x, y, icw, ich, { showName: false, rainbowT: (this.last / 1000 * 0.3) % 1 });
      ctx.restore();
      if (inTeam) {
        this.pill(x - 24, y - ich / 2 + 3, 48, 16, '#3a2a08', '#ffd24d');
        this.text('出撃', x, y - ich / 2 + 11, 10, '#ffd24d', 'center', 'bold');
      }
      if (picked) { ctx.strokeStyle = '#6fce9a'; ctx.lineWidth = 3; this.rr(x - icw / 2, y - ich / 2, icw, ich, 8); ctx.stroke(); }
      if (isDetail) { ctx.strokeStyle = '#ffe14d'; ctx.lineWidth = 3; this.rr(x - icw / 2, y - ich / 2, icw, ich, 8); ctx.stroke(); }
      if (o.locked) this.text('🔒', x + icw / 2 - 12, y - ich / 2 + 16, 14, '#fff', 'center');
      this.text(`Lv.${o.lv}${o.evoStage > 0 ? ' +' + o.evoStage : ''}`, x, y + ich / 2 - 8, 10, '#ffe9a8', 'center', 'bold');
      this.buttons.push({ x: x - icw / 2, y: y - ich / 2, w: icw, h: ich, id: `inv:${o.instId}` });
    });

    // 滚动按钮
    if (maxScroll > 0) {
      glassButton(ctx, W - 130, gridY + 20, 90, 40, '▲ 上', { kind: 'gray', hover: this.hover === 'invUp', fontSize: 14 });
      glassButton(ctx, W - 130, gridY + 140, 90, 40, '▼ 下', { kind: 'gray', hover: this.hover === 'invDown', fontSize: 14 });
      this.buttons.push({ x: W - 130, y: gridY + 20, w: 90, h: 40, id: 'invUp' });
      this.buttons.push({ x: W - 130, y: gridY + 140, w: 90, h: 40, id: 'invDown' });
    }

    // 反馈消息
    if (this.teamMsg && this.teamMsgT < 2.5) {
      const a = Math.min(1, Math.min(this.teamMsgT / 0.2, (2.5 - this.teamMsgT) / 0.4));
      ctx.save(); ctx.globalAlpha = Math.max(0, a);
      this.pill(W / 2 - 280, 64, 560, 40, 'rgba(13,10,22,0.94)', '#6fce9a');
      this.text(this.teamMsg, W / 2, 86, 15, '#a8f0c0', 'center', 'bold');
      ctx.restore();
    }

    // 操作模式提示 + 确认按钮
    if (this.enhanceMode) {
      this.text(`强化模式：点选狗粮卡（绿框）· 已选 ${this.enhancePicks.size} 张`, 250, 348, 13, '#6fce9a', 'left', 'bold');
      glassButton(ctx, W / 2 - 90, 340, 180, 36, `确认强化(${this.enhancePicks.size})`, { kind: 'green', hover: this.hover === 'enhanceGo', fontSize: 14 });
      this.buttons.push({ x: W / 2 - 90, y: 340, w: 180, h: 36, id: 'enhanceGo' });
    }
    if (this.evolveMode) {
      this.text(`进化模式：点选一张同名卡作为素材${this.evolvePick ? '（已选）' : ''}`, 250, 348, 13, '#ff5ce8', 'left', 'bold');
      glassButton(ctx, W / 2 - 90, 340, 180, 36, '确认进化', { kind: 'blue', hover: this.hover === 'evolveGo', fontSize: 14 });
      this.buttons.push({ x: W / 2 - 90, y: 340, w: 180, h: 36, id: 'evolveGo' });
    }

    // 详情弹层
    if (this.detailInst) this.renderTeamDetail();
  }

  private renderTeamDetail(): void {
    const ctx = this.ctx;
    const o = this.db.inventory.cards.find(c => c.instId === this.detailInst);
    if (!o) { this.detailInst = null; return; }
    const card = getCard(o.cardId); if (!card) { this.detailInst = null; return; }
    const cb = ownedToCombatant(o);
    ctx.fillStyle = 'rgba(2,3,8,0.7)';
    ctx.fillRect(0, 0, W, H);
    const dw = 700, dh = 460, dx = W / 2 - dw / 2, dy = H / 2 - dh / 2;
    metalDialog(ctx, dx, dy, dw, dh);
    // 左：大卡
    drawCard(ctx, card, dx + 130, dy + 210, 200, 290, { showName: true, rainbowT: (this.last / 1000 * 0.3) % 1 });
    engravedText(ctx, card.name, dx + 130, dy + 380, 16);
    this.text(`${card.rarity} · ${card.element} · COST ${card.cardCost}`, dx + 130, dy + 404, 12, '#cfc4a8', 'center', 'bold');
    // 右：信息
    const ix = dx + 280;
    engravedText(ctx, `Lv.${o.lv}${o.evoStage > 0 ? ` (进化+${o.evoStage})` : ''}`, ix + 180, dy + 40, 20);
    const rows: [string, string][] = [
      ['攻击力', String(cb?.atk ?? card.stats.attack)],
      ['生命力', String(cb?.hpMax ?? 0)],
      ['防御力', String(card.stats.defense)],
      ['速度', String(card.stats.speed)],
      ['技能', card.skillName || '—'],
    ];
    let ry = dy + 84;
    for (const [l, v] of rows) {
      this.text(l, ix, ry, 15, '#e8a0c0', 'left', 'bold');
      this.text(v, ix + 110, ry, 15, '#f0e6cc', 'left', 'bold');
      ry += 34;
    }
    if (o.atkBonus > 0 || o.hpBonus > 0) {
      this.text(`进化继承：ATK+${o.atkBonus}  HP+${o.hpBonus}`, ix, ry, 13, '#6fce9a', 'left', 'bold'); ry += 30;
    }
    if (card.skillDesc) this.wrapText(card.skillDesc, ix, ry, 360, 20, 12, '#b8c8d8');

    // 操作按钮
    const bw = 150, bh = 46, by = dy + dh - 66;
    const bx0 = dx + 40;
    glassButton(ctx, bx0, by, bw, bh, '强化', { kind: 'green', hover: this.hover === 'enhanceStart', fontSize: 17 });
    glassButton(ctx, bx0 + bw + 12, by, bw, bh, '进化', { kind: 'blue', hover: this.hover === 'evolveStart', fontSize: 17 });
    glassButton(ctx, bx0 + (bw + 12) * 2, by, bw, bh, o.locked ? '解锁' : '锁定', { kind: 'gray', hover: this.hover === 'lockCard', fontSize: 17 });
    glassButton(ctx, bx0 + (bw + 12) * 3, by, bw, bh, '出售', { kind: 'red', hover: this.hover === 'sellCard', fontSize: 17 });
    this.buttons.push({ x: bx0, y: by, w: bw, h: bh, id: 'enhanceStart' });
    this.buttons.push({ x: bx0 + bw + 12, y: by, w: bw, h: bh, id: 'evolveStart' });
    this.buttons.push({ x: bx0 + (bw + 12) * 2, y: by, w: bw, h: bh, id: 'lockCard' });
    this.buttons.push({ x: bx0 + (bw + 12) * 3, y: by, w: bw, h: bh, id: 'sellCard' });
    // 关闭
    glassButton(ctx, dx + 20, dy + 14, 90, 42, '✕', { kind: 'gray', hover: this.hover === 'closeTeamDetail', fontSize: 16 });
    this.buttons.push({ x: dx + 20, y: dy + 14, w: 90, h: 42, id: 'closeTeamDetail' });
  }

  // ============ 战斗界面 ============
  private renderBattle(): void {
    const ctx = this.ctx;
    this.buttons = [];
    if (!this.battle) { this.startBattle(); return; }
    const b = this.battle;
    const t = this.last / 1000;

    // 氛围：魔女讨伐偏紫红，普通遭遇偏黄昏
    ctx.fillStyle = b.raid ? 'rgba(40,6,40,0.5)' : 'rgba(30,10,20,0.4)';
    ctx.fillRect(0, 0, W, H);

    // 敌方 BOSS（顶部中央）
    const boss = b.enemies[0];
    const ehp = Math.max(0, boss.hp / boss.hpMax);
    drawCard(ctx, boss.card, W / 2, 150, 150, 210, { showName: true, showBadge: true });
    this.rr(W / 2 - 110, 262, 220, 13, 6); ctx.fillStyle = '#0d0a16'; ctx.fill();
    this.rr(W / 2 - 108, 264, 216 * ehp, 9, 4); ctx.fillStyle = '#e85c5c'; ctx.fill();
    this.text(`${Math.max(0, Math.floor(boss.hp)).toLocaleString()}`, W / 2, 287, 12, '#ffb3b3', 'center', 'bold');
    if (b.raid) {
      this.pill(W / 2 + 130, 120, 130, 30, '#0d0a16', '#ff5ce8');
      this.text(`Lv.${b.raid.level} ${b.raid.archWitch ? '超魔女' : '魔女'}`, W / 2 + 195, 135, 12, '#ffb3f0', 'center', 'bold');
      this.text(`战斗体力 ${this.db.user.battlePt}/${this.db.user.battlePtMax}`, 70, 30, 13, '#8fe8ff', 'center', 'bold');
    }
    this.text('确认状态', W - 60, 30, 13, '#cfc4a8', 'right');

    // 战斗横幅（魔女出现 / 战斗开始）
    if (b.bannerT < 1.6) {
      const ba = Math.min(1, Math.min(b.bannerT / 0.2, (1.6 - b.bannerT) / 0.4));
      ctx.save();
      ctx.globalAlpha = Math.max(0, ba);
      ctx.font = 'bold 54px system-ui, "Arial Black", sans-serif';
      ctx.textAlign = 'center';
      ctx.lineWidth = 10; ctx.strokeStyle = '#4a0808';
      ctx.strokeText(b.banner, W / 2, H / 2 - 60);
      const bg2 = ctx.createLinearGradient(0, H / 2 - 90, 0, H / 2 - 30);
      bg2.addColorStop(0, '#fff'); bg2.addColorStop(1, b.raid ? '#ff5ce8' : '#ffd24d');
      ctx.fillStyle = bg2;
      ctx.fillText(b.banner, W / 2, H / 2 - 60);
      ctx.restore();
    }

    // 伤害飘字
    for (const d of b.dmgFloat) {
      ctx.save();
      ctx.globalAlpha = Math.max(0, 1 - d.t);
      ctx.font = 'bold 34px system-ui, "Arial Black", sans-serif';
      ctx.textAlign = 'center';
      ctx.strokeStyle = '#000'; ctx.lineWidth = 5;
      ctx.strokeText(d.v, d.x, d.y - d.t * 60);
      ctx.fillStyle = d.color;
      ctx.fillText(d.v, d.x, d.y - d.t * 60);
      ctx.restore();
    }

    // 行动记录（最近回合）
    if (b.lastActions.length > 0 && !b.victory) {
      ctx.save();
      ctx.globalAlpha = 0.85;
      let ly = 330;
      for (const a of b.lastActions.slice(-4)) {
        const tag = a.skill ? `【${a.skill ? '技能' : ''}】` : '';
        const em = a.em > 1 ? ` 克制×${a.em}` : '';
        const crit = a.crit ? ' 暴击!' : '';
        this.text(`${a.actor} ${tag} ${a.dmg.toLocaleString()}${em}${crit}`, 24, ly, 13, '#e8d5a8', 'left');
        ly += 20;
      }
      ctx.restore();
    }

    // 我方 5 卡（底部，可点发动技能）
    const baseY = H - 260;
    const cw = 150, ch = 212, gx = 16;
    const total = 5 * cw + 4 * gx;
    let x = (W - total) / 2;
    for (let i = 0; i < b.team.length; i++) {
      const slot = b.team[i];
      const alive = slot.hp > 0;
      ctx.save();
      if (!alive) ctx.globalAlpha = 0.35;
      const hov = this.hover === `skill:${i}`;
      if (hov && alive && !b.victory && !b.defeated) { ctx.shadowColor = '#ffe14d'; ctx.shadowBlur = 18; }
      drawCard(ctx, slot.card, x + cw / 2, baseY + ch / 2, cw, ch,
        { showName: false, showBadge: true, rainbowT: (t * 0.3) % 1 });
      ctx.restore();
      if (slot.isLeader) {
        this.pill(x + 4, baseY - 4, 40, 18, '#3a2a08', '#ffd24d');
        this.text('队长', x + 24, baseY + 6, 10, '#ffd24d', 'center', 'bold');
      }
      // HP
      const hpr = Math.max(0, slot.hp / slot.hpMax);
      this.rr(x + 6, baseY + ch + 4, cw - 12, 8, 4); ctx.fillStyle = '#0d0a16'; ctx.fill();
      this.rr(x + 6, baseY + ch + 4, (cw - 12) * hpr, 8, 4);
      ctx.fillStyle = hpr > 0.3 ? '#5fce5f' : '#e85c5c'; ctx.fill();
      this.text(String(Math.floor(Math.max(0, slot.hp))), x + cw / 2, baseY + ch + 18, 10, '#cfc4a8', 'center');
      if (alive && !b.victory && !b.defeated) this.buttons.push({ x, y: baseY, w: cw, h: ch, id: `skill:${i}` });
      x += cw + gx;
    }

    // 撤退 / 自动（Auto 高亮）
    glassButton(ctx, 20, H - 70, 130, 50, '撤退', { kind: 'red', hover: this.hover === 'retreat', fontSize: 18 });
    this.buttons.push({ x: 20, y: H - 70, w: 130, h: 50, id: 'retreat' });
    glassButton(ctx, W - 150, H - 70, 130, 50, b.auto ? '自动中' : '自动', { kind: b.auto ? 'green' : 'gray', hover: this.hover === 'bAuto', fontSize: 18 });
    this.buttons.push({ x: W - 150, y: H - 70, w: 130, h: 50, id: 'bAuto' });

    // 技能确认弹窗
    if (b.skillPrompt !== null) this.renderSkillPrompt(b.skillPrompt);
    // 胜利结算
    if (b.victory) this.renderVictory();
  }

  private renderSkillPrompt(slot: number): void {
    const ctx = this.ctx;
    const s = this.battle!.team[slot];
    ctx.fillStyle = 'rgba(2,3,8,0.6)';
    ctx.fillRect(0, 0, W, H);
    const dw = 560, dh = 220, dx = W / 2 - dw / 2, dy = H / 2 - dh / 2 - 40;
    metalDialog(ctx, dx, dy, dw, dh);
    engravedText(ctx, `★${s.skillName || '攻击'} Lv.${Math.min(10, s.lv)}`, W / 2, dy + 44, 22);
    this.text(`发动成本：${s.card.cardCost}  触发率 ${Math.floor(s.procChance * 100)}%`, W / 2, dy + 80, 15, '#cfc4a8', 'center', 'bold');
    this.wrapText(s.card.skillDesc || `给予敌方单体攻击力 ${Math.floor(s.skillMult * 100)}% 的伤害`, dx + 40, dy + 116, dw - 80, 22, 15, '#e8eef6');
    const bw = 180, bh = 54, by = dy + dh - 64;
    glassButton(ctx, W / 2 - bw - 20, by, bw, bh, '放弃', { kind: 'red', hover: this.hover === 'skillNo', fontSize: 20 });
    glassButton(ctx, W / 2 + 20, by, bw, bh, '发动', { kind: 'green', hover: this.hover === 'skillYes', fontSize: 20 });
    this.buttons.push({ x: W / 2 - bw - 20, y: by, w: bw, h: bh, id: 'skillNo' });
    this.buttons.push({ x: W / 2 + 20, y: by, w: bw, h: bh, id: 'skillYes' });
  }

  private renderVictory(): void {
    const ctx = this.ctx;
    const b = this.battle!;
    const pop = Ease.outBack(Math.min(1, b.victoryT / 0.5));
    ctx.save();
    ctx.translate(W / 2, 200);
    ctx.scale(Math.max(0.02, pop), Math.max(0.02, pop));
    ctx.font = 'bold 90px system-ui, "Arial Black", sans-serif';
    ctx.textAlign = 'center';
    ctx.lineWidth = 12; ctx.strokeStyle = '#6a4a08';
    ctx.strokeText('VICTORY', 0, 0);
    const g = ctx.createLinearGradient(0, -45, 0, 45);
    g.addColorStop(0, '#fff6d8'); g.addColorStop(0.5, '#ffd24d'); g.addColorStop(1, '#c88a10');
    ctx.fillStyle = g;
    ctx.fillText('VICTORY', 0, 0);
    ctx.restore();

    // 经验条 + OK（读库存实例 exp）
    const baseY = 300;
    let x = (W - 5 * 150 - 4 * 16) / 2;
    for (const slot of b.team) {
      const o = this.db.inventory.cards.find(c => c.instId === slot.instId);
      const expR = o ? Math.min(1, o.exp / (o.lv * 50)) : 0;
      this.text(`等级${slot.lv} »`, x + 75, baseY + 230, 12, '#e8d5a8', 'center', 'bold');
      this.rr(x + 10, baseY + 240, 130, 10, 5); ctx.fillStyle = '#0d0a16'; ctx.fill();
      this.rr(x + 10, baseY + 240, 130 * expR, 10, 5); ctx.fillStyle = '#4da3ff'; ctx.fill();
      x += 166;
    }
    // 讨伐奖励提示
    if (b.raid) {
      this.text(`活动积分：${this.db.eventPoint.points}   击杀数：${this.db.eventPoint.raidKills}`, W / 2, baseY + 285, 15, '#ffb3f0', 'center', 'bold');
    }
    glassButton(ctx, W / 2 - 110, H - 120, 220, 56, 'OK', { kind: 'green', hover: this.hover === 'victoryOk', fontSize: 22 });
    this.buttons.push({ x: W / 2 - 110, y: H - 120, w: 220, h: 56, id: 'victoryOk' });
  }

  private renderHall(): void {
    const ctx = this.ctx;
    this.buttons = [];
    const meta = this.meta.get(this.banner.id);
    const t = this.last / 1000;

    // ── 顶栏：所持卡片数 / 券交换 ──
    ctx.fillStyle = 'rgba(8,6,18,0.6)';
    ctx.fillRect(0, 0, W, 56);
    ctx.fillStyle = 'rgba(220,190,120,0.35)';
    ctx.fillRect(0, 55, W, 1);
    this.pill(20, 12, 240, 32, '#0d0a16', '#c8b285');
    this.text(`所持卡片数：${this.cardCount}/${this.cardCap}`, 140, 29, 14, '#e8d5a8', 'center', 'bold');
    this.pill(W - 180, 10, 160, 36, this.banner.accent, '#ffe9a8');
    this.text('少女券交换', W - 100, 29, 15, '#1a1206', 'center', 'bold');
    this.buttons.push({ x: W - 180, y: 10, w: 160, h: 36, id: 'exchange' });
    this.text(`💎 ${this.jewels.toLocaleString()}`, 300, 29, 14, '#ff9ff0', 'left', 'bold');
    this.text(`◆ ${this.fp.toLocaleString()}`, 470, 29, 13, '#8fe8a8', 'left', 'bold');
    this.button(640, 14, 92, 28, '＋ 补充', 'add');

    // ── 左侧：当前卡池大立绘 banner ──
    const bx = 20, by = 70, bw = 760, bh = 560;
    ctx.save();
    this.rr(bx, by, bw, bh, 12); ctx.clip();
    // 立绘背景
    ctx.fillStyle = '#0d0a16';
    ctx.fillRect(bx, by, bw, bh);
    const portrait = meta?.portrait ?? null;
    const pImg = portrait ? this.imgOf(portrait) : null;
    if (pImg) {
      const breathe = 1 + Math.sin(t * 0.6) * 0.015;
      const sc = Math.max(bw / pImg.width, bh / pImg.height) * breathe;
      const dw = pImg.width * sc, dh = pImg.height * sc;
      ctx.globalAlpha = 0.9;
      ctx.drawImage(pImg, bx + (bw - dw) / 2, by + (bh - dh) / 2 - 20, dw, dh);
      ctx.globalAlpha = 1;
    }
    // 底部渐变压暗
    const g = ctx.createLinearGradient(0, by + bh * 0.4, 0, by + bh);
    g.addColorStop(0, 'rgba(6,4,14,0)');
    g.addColorStop(1, 'rgba(6,4,14,0.92)');
    ctx.fillStyle = g;
    ctx.fillRect(bx, by + bh * 0.4, bw, bh * 0.6);
    ctx.restore();
    // 边框
    ctx.strokeStyle = this.banner.accent;
    ctx.lineWidth = 2;
    this.rr(bx, by, bw, bh, 12); ctx.stroke();

    // 卡池标题 + 倒计时
    this.text(this.banner.name, bx + 22, by + 30, 26, this.banner.accent, 'left', 'bold', true);
    const remain = Math.max(0, (meta?.endAt ?? Date.now()) - Date.now());
    const dd = Math.floor(remain / 86400000);
    const hh = Math.floor((remain % 86400000) / 3600000);
    this.pill(bx + 22, by + 52, 210, 26, '#0d0a16', '#c8b285');
    this.text(`【距离结束还有】${dd}天${hh}小时`, bx + 127, by + 66, 12, '#ffe9a8', 'center', 'bold');

    // 说明文案
    const tagline = meta?.tagline ?? '';
    this.wrapText(tagline, bx + 24, by + bh - 120, bw - 48, 16, 15, '#f0e6cc', 'bold');

    // 精选缩略卡（点详情）
    const show = bannerShowcase(this.banner, 3);
    show.forEach((c, i) => {
      const cx = bx + bw - 200 + i * 62, cy = by + 120;
      drawCard(ctx, c, cx, cy, 54, 76, { showName: false, showBadge: true });
      this.buttons.push({ x: cx - 27, y: cy - 38, w: 54, h: 76, id: 'rates' });
    });
    this.text('LR 出现率 普通', bx + bw - 24, by + 92, 13, '#ffe14d', 'right', 'bold');

    // 双按钮：券十连 / 钻十连
    const tickets = meta?.tickets ?? 0;
    const btnY = by + bh - 78;
    this.summonButton(bx + 40, btnY, 300, 62, `用召唤券`, `进行10连召唤`, true, 'pull10ticket');
    this.summonButton(bx + 360, btnY, 320, 62, `用 💎 ${this.banner.costTen}`, `进行10连召唤`, true, 'pull10');
    this.text(`目前持有数  🎟 ${tickets}  /  💎 ${this.jewels.toLocaleString()}`,
      bx + 40, by + bh - 8, 13, '#ffe9a8', 'left', 'bold');

    // 提供比率一览
    this.pill(bx + bw / 2 - 110, by + bh + 8, 220, 34, '#0d0a16', '#c8b285');
    this.text('提供比率一览', bx + bw / 2, by + bh + 26, 14, '#e8d5a8', 'center', 'bold');
    this.buttons.push({ x: bx + bw / 2 - 110, y: by + bh + 8, w: 220, h: 34, id: 'rates' });

    // ── 右侧：卡池列表（自适应高度） ──
    const rx = bx + bw + 14, rw = W - rx - 16;
    const itemH = Math.min(92, Math.floor((H - 90) / BANNERS.length) - 8);
    let ry = 70;
    for (const b of BANNERS) {
      this.renderBannerListItem(b, rx, ry, rw, itemH);
      ry += itemH + 8;
    }

    // 保底进度
    const prog = this.gacha.pityProgress(this.banner);
    if (prog && this.banner.hardPity) {
      this.text(`距 ${this.banner.hardPity.rarity} 保底还差 ${prog.threshold - prog.current} 抽`,
        bx + bw / 2, by - 8, 12, '#d8c49a', 'center');
    }

    // 提供比率浮层
    if (this.showRates) this.renderRatesOverlay();
  }

  private imgOf(card: Card): HTMLImageElement | null {
    return getImage(card);
  }

  private pill(x: number, y: number, w: number, h: number, fill: string, stroke: string): void {
    const ctx = this.ctx;
    ctx.save();
    ctx.fillStyle = fill;
    this.rr(x, y, w, h, h / 2); ctx.fill();
    ctx.strokeStyle = stroke; ctx.lineWidth = 1.5;
    this.rr(x, y, w, h, h / 2); ctx.stroke();
    ctx.restore();
  }

  private summonButton(x: number, y: number, w: number, h: number, l1: string, l2: string, enabled: boolean, id: string): void {
    const ctx = this.ctx;
    const hov = this.hover === id;
    ctx.save();
    if (!enabled) ctx.globalAlpha = 0.45;
    // 玻璃胶囊主体
    glassButton(ctx, x, y, w, h, '', { kind: 'green', hover: hov && enabled });
    // 两行文字
    ctx.font = `bold 14px system-ui, "PingFang SC", sans-serif`;
    ctx.textAlign = 'center'; ctx.textBaseline = 'middle';
    ctx.fillStyle = '#d8ffd8';
    ctx.shadowColor = 'rgba(0,0,0,0.6)'; ctx.shadowBlur = 2; ctx.shadowOffsetY = 1;
    ctx.fillText(l1, x + w / 2, y + h / 2 - 11);
    ctx.font = `bold 17px system-ui, "PingFang SC", sans-serif`;
    ctx.fillStyle = '#ffffff';
    if (hov && enabled) { ctx.shadowColor = 'rgba(255,255,255,0.7)'; ctx.shadowBlur = 8; }
    ctx.fillText(l2, x + w / 2, y + h / 2 + 12);
    ctx.restore();
    if (enabled) this.buttons.push({ x, y, w, h, id, primary: true });
  }

  private renderBannerListItem(b: Banner, x: number, y: number, w: number, h: number): void {
    const ctx = this.ctx;
    const active = b.id === this.banner.id;
    const hov = this.hover === `banner:${b.id}`;
    const m = this.meta.get(b.id);
    ctx.save();
    this.rr(x, y, w, h, 10); ctx.clip();
    // 立绘缩略背景
    ctx.fillStyle = '#0d0a16'; ctx.fillRect(x, y, w, h);
    const pm = m?.portrait;
    if (pm) {
      drawCard(ctx, pm, x + w - 60, y + h / 2, 70, h - 8, { showName: false, showBadge: false });
    }
    const gg = ctx.createLinearGradient(x, 0, x + w, 0);
    gg.addColorStop(0, 'rgba(6,4,14,0.9)');
    gg.addColorStop(0.6, 'rgba(6,4,14,0.35)');
    gg.addColorStop(1, 'rgba(6,4,14,0.05)');
    ctx.fillStyle = gg; ctx.fillRect(x, y, w, h);
    ctx.restore();
    ctx.save();
    ctx.strokeStyle = active ? b.accent : 'rgba(200,178,133,0.4)';
    ctx.lineWidth = active ? 2.5 : 1.2;
    this.rr(x, y, w, h, 10); ctx.stroke();
    if (active) { ctx.fillStyle = b.accent + '18'; this.rr(x, y, w, h, 10); ctx.fill(); }
    if (b.id === 'legend') {
      this.pill(x + 10, y + 8, 44, 18, '#d33', '#ffb3b3');
      this.text('new', x + 32, y + 18, 11, '#fff', 'center', 'bold');
    }
    this.text(b.name, x + 14, y + h / 2 + 6, 17, active ? b.accent : '#e8d5a8', 'left', 'bold', true);
    ctx.restore();
    this.buttons.push({ x, y, w, h, id: `banner:${b.id}` });
  }

  private renderRatesOverlay(): void {
    const ctx = this.ctx;
    ctx.save();
    ctx.fillStyle = 'rgba(2,2,8,0.78)';
    ctx.fillRect(0, 0, W, H);
    const ox = W / 2 - 360, oy = 90, ow = 720, oh = 560;
    ctx.fillStyle = '#0d0a16';
    this.rr(ox, oy, ow, oh, 14); ctx.fill();
    ctx.strokeStyle = this.banner.accent; ctx.lineWidth = 2;
    this.rr(ox, oy, ow, oh, 14); ctx.stroke();
    this.text(`${this.banner.name} · 提供比率`, ox + ow / 2, oy + 34, 22, this.banner.accent, 'center', 'bold', true);

    // 比率表
    let ry = oy + 66;
    for (const row of rateTable(this.banner)) {
      const col = RARITY_COLOR[row.rarity] || '#aaa';
      this.pill(ox + 30, ry, 70, 26, col, col);
      this.text(row.rarity, ox + 65, ry + 14, 13, '#0a0a12', 'center', 'bold');
      this.text(`${row.pct.toFixed(2)}%`, ox + 120, ry + 14, 15, '#f0e6cc', 'left', 'bold');
      this.text(`${row.count} 种`, ox + 250, ry + 14, 12, '#9a8f75', 'left');
      // 概率条
      ctx.fillStyle = col + '44';
      const bwpx = Math.min(360, row.pct * 8);
      this.rr(ox + 330, ry + 5, bwpx, 16, 8); ctx.fill();
      ry += 34;
    }

    // 代表卡展示（可点查看详情）
    this.text('本期卡牌一览（点击查看详情）', ox + 30, ry + 18, 15, '#e8d5a8', 'left', 'bold');
    this.rateCards = bannerShowcase(this.banner, 6).slice(0, 12);
    const cw = 88, ch = 124, gx = 14, gy = 16;
    const cols = Math.floor((ow - 60) / (cw + gx));
    this.rateCards.forEach((c, i) => {
      const cx = ox + 30 + (i % cols) * (cw + gx) + cw / 2;
      const cy = ry + 44 + Math.floor(i / cols) * (ch + gy) + ch / 2;
      drawCard(ctx, c, cx, cy, cw, ch, {});
      this.buttons.push({ x: cx - cw / 2, y: cy - ch / 2, w: cw, h: ch, id: `card:${i}` });
    });

    // 关闭
    this.pill(ox + ow / 2 - 80, oy + oh - 46, 160, 34, this.banner.accent, '#ffe9a8');
    this.text('关 闭', ox + ow / 2, oy + oh - 28, 15, '#1a1206', 'center', 'bold');
    this.buttons.push({ x: ox + ow / 2 - 80, y: oy + oh - 46, w: 160, h: 34, id: 'closeRates' });
    // 点击遮罩关闭
    this.buttons.push({ x: 0, y: 0, w: W, h: H, id: 'closeRatesBg' });
    ctx.restore();
  }

  private wrapText(str: string, x: number, y: number, maxW: number, lh: number, size: number, color: string, weight = 'normal'): void {
    const ctx = this.ctx;
    ctx.save();
    ctx.font = `${weight} ${size}px system-ui, "PingFang SC", sans-serif`;
    ctx.textAlign = 'left'; ctx.textBaseline = 'middle';
    ctx.fillStyle = color;
    let line = '', yy = y;
    for (const ch of str) {
      if (ctx.measureText(line + ch).width > maxW) {
        ctx.fillText(line, x, yy); line = ch; yy += lh;
      } else line += ch;
    }
    if (line) ctx.fillText(line, x, yy);
    ctx.restore();
  }

  private renderConfirm(): void {
    const ctx = this.ctx;
    if (this.phase.kind !== 'confirm') return;
    const { ten, ticket, t } = this.phase;
    // 弹窗打开时屏蔽大厅按钮
    this.buttons = [];

    // 遮罩
    ctx.fillStyle = 'rgba(2,3,8,0.66)';
    ctx.fillRect(0, 0, W, H);

    // 弹出动画
    const pop = Ease.outBack(Math.min(1, t / 0.28));
    const dw = 560, dh = 260;
    const dwS = Math.max(0.02, dw * pop), dhS = Math.max(0.02, dh * pop);
    const dx = W / 2 - dwS / 2, dy = H / 2 - dhS / 2 - 20;

    metalDialog(ctx, dx, dy, dwS, dhS);

    if (pop > 0.6) {
      // 文案
      const msg = ticket ? '使用 1 张进行召唤！' : `使用 💎 ${ten ? this.banner.costTen : this.banner.costSingle} 进行召唤！`;
      ctx.save();
      ctx.globalAlpha = Math.min(1, (pop - 0.6) / 0.4);
      engravedText(ctx, msg, W / 2, dy + dhS * 0.34, 24);
      ctx.restore();

      // 否 / 是 按钮
      const bw = 200, bh = 58, gap = 40;
      const by = dy + dhS - bh - 26;
      const noX = W / 2 - bw - gap / 2, yesX = W / 2 + gap / 2;
      glassButton(ctx, noX, by, bw, bh, '否', { kind: 'red', hover: this.hover === 'confirmNo', fontSize: 22 });
      glassButton(ctx, yesX, by, bw, bh, '是', { kind: 'green', hover: this.hover === 'confirmYes', fontSize: 22 });
      this.buttons.push({ x: noX, y: by, w: bw, h: bh, id: 'confirmNo' });
      this.buttons.push({ x: yesX, y: by, w: bw, h: bh, id: 'confirmYes' });
    }
  }

  private renderSummon(): void {
    const ctx = this.ctx;
    if (this.phase.kind !== 'summon') return;
    const top = this.topRarity(this.phase.pulls);
    const t = this.phase.t;
    const dur = this.summonDuration();
    const p = Math.min(1, t / dur);
    const col = RARITY_COLOR[top] || '#ffe14d';
    const high = RANK[top] >= 5;
    const mid = RANK[top] >= 4;

    // 神殿压暗（稀有越高越暗）
    ctx.fillStyle = `rgba(3,2,10,${(p * (high ? 0.88 : mid ? 0.72 : 0.55)).toFixed(3)})`;
    ctx.fillRect(0, 0, W, H);

    const floorY = H * 0.78;
    this.drawMagicCircle(ctx, W / 2, floorY, 300 + p * 40, t, col, p);
    this.drawSpiritFlames(ctx, floorY, t, high || mid);

    // 天光柱（越到爆破越亮）
    const pillarA = Math.min(1, p * 1.6);
    ctx.save();
    ctx.globalCompositeOperation = 'lighter';
    const pw = 22 + Math.sin(t * 4) * 6 + p * 18;
    const pg = ctx.createLinearGradient(W / 2 - pw, 0, W / 2 + pw, 0);
    pg.addColorStop(0, col + '00');
    pg.addColorStop(0.5, '#ffffff' + Math.floor(pillarA * (120 + p * 100)).toString(16).padStart(2, '0'));
    pg.addColorStop(1, col + '00');
    ctx.fillStyle = pg;
    ctx.fillRect(W / 2 - pw, 0, pw * 2, floorY);
    ctx.restore();

    // ── 卡包震颤 + 增亮 + 自旋（核心吸收自 ducdat big-card）──
    // brightness ≈ 1 + timer³×3；scale ≈ 1 + timer×0.2；shake 随机偏移
    const bright = p * p * p; // 0→1 加速变白
    const shakeAmp = 3 + bright * 14;
    const sx = (Math.random() - 0.5) * shakeAmp;
    const sy = (Math.random() - 0.5) * shakeAmp;
    // 极品：幂次自旋（p^5 × 720°）；普通：微抖旋转
    const rotate = high
      ? Math.pow(p, 5) * 720 * (Math.PI / 180)
      : mid
        ? Math.pow(p, 4) * 180 * (Math.PI / 180) + (Math.random() - 0.5) * 0.04
        : (Math.random() - 0.5) * 0.06;
    const cardScale = 1 + p * 0.28;
    const cardY = floorY - 190 + Math.sin(t * 2.2) * (8 - p * 6);

    ctx.save();
    ctx.translate(W / 2 + sx, cardY + sy);
    ctx.rotate(rotate);
    ctx.scale(cardScale, cardScale);
    // 增亮层：用 lighter 叠一层白卡背
    this.drawCardBack(ctx, 0, 0, 150, 214, col, t, p);
    if (bright > 0.05) {
      ctx.globalCompositeOperation = 'lighter';
      ctx.globalAlpha = Math.min(1, bright * 1.4);
      ctx.fillStyle = '#ffffff';
      this.rr(-75, -107, 150, 214, 8); ctx.fill();
      // 外发光
      ctx.shadowColor = col;
      ctx.shadowBlur = 30 + bright * 80;
      this.rr(-75, -107, 150, 214, 8); ctx.strokeStyle = '#fff'; ctx.lineWidth = 2; ctx.stroke();
    }
    ctx.restore();

    // 爆破前兆：进度条光环
    if (p > 0.55) {
      const ringP = (p - 0.55) / 0.45;
      ctx.save();
      ctx.globalCompositeOperation = 'lighter';
      ctx.strokeStyle = col + Math.floor(ringP * 200).toString(16).padStart(2, '0');
      ctx.lineWidth = 4;
      ctx.beginPath();
      ctx.arc(W / 2, cardY, 110 + ringP * 80, -Math.PI / 2, -Math.PI / 2 + ringP * Math.PI * 2);
      ctx.stroke();
      ctx.restore();
    }

    // 提示
    if (high) this.text('✦ 极品预兆 ✦', W / 2, 56, 22, col, 'center', 'bold', true);
    else if (mid) this.text('稀有反应…', W / 2, 56, 18, col, 'center', 'bold');
    this.text('点击加速爆破', W - 30, H - 24, 12, 'rgba(255,255,255,0.5)', 'right');
  }

  /** 绿色符文魔法阵 */
  private drawMagicCircle(ctx: CanvasRenderingContext2D, cx: number, cy: number, r: number, t: number, col: string, p: number): void {
    ctx.save();
    ctx.globalCompositeOperation = 'lighter';
    const glow = 0.5 + p * 0.5;
    // 外圈
    for (let k = 0; k < 3; k++) {
      const rr = r - k * 22;
      ctx.strokeStyle = `rgba(110,255,170,${(0.5 * glow).toFixed(3)})`;
      ctx.lineWidth = k === 0 ? 3 : 1.5;
      ctx.beginPath(); ctx.ellipse(cx, cy, rr, rr * 0.32, 0, 0, Math.PI * 2); ctx.stroke();
    }
    // 旋转符文点
    for (let i = 0; i < 16; i++) {
      const a = (i / 16) * Math.PI * 2 + t * 0.8;
      const rr = r - 11;
      const x = cx + Math.cos(a) * rr, y = cy + Math.sin(a) * rr * 0.32;
      ctx.fillStyle = `rgba(150,255,190,${(0.7 * glow).toFixed(3)})`;
      ctx.beginPath(); ctx.arc(x, y, 2.5, 0, Math.PI * 2); ctx.fill();
    }
    // 中央六芒星
    ctx.strokeStyle = `rgba(120,255,180,${(0.4 * glow).toFixed(3)})`;
    ctx.lineWidth = 1.5;
    for (let tri = 0; tri < 2; tri++) {
      ctx.beginPath();
      for (let i = 0; i <= 3; i++) {
        const a = (i / 3) * Math.PI * 2 + tri * Math.PI / 3 + t * 0.3;
        const x = cx + Math.cos(a) * r * 0.6, y = cy + Math.sin(a) * r * 0.6 * 0.32;
        i === 0 ? ctx.moveTo(x, y) : ctx.lineTo(x, y);
      }
      ctx.stroke();
    }
    // 中央光晕
    const g = ctx.createRadialGradient(cx, cy, 0, cx, cy, r * 0.7);
    g.addColorStop(0, '#eaffd0' + Math.floor(p * 120).toString(16).padStart(2, '0'));
    g.addColorStop(0.5, 'rgba(110,255,170,0.12)');
    g.addColorStop(1, 'rgba(110,255,170,0)');
    ctx.fillStyle = g;
    ctx.beginPath(); ctx.ellipse(cx, cy, r * 0.7, r * 0.7 * 0.32, 0, 0, Math.PI * 2); ctx.fill();
    ctx.restore();
  }

  /** 蓝色灵火柱（稀有卡前兆） */
  private drawSpiritFlames(ctx: CanvasRenderingContext2D, floorY: number, t: number, high: boolean): void {
    if (!high) return;
    ctx.save();
    ctx.globalCompositeOperation = 'lighter';
    const spots = [W * 0.18, W * 0.38, W * 0.62, W * 0.82];
    for (let i = 0; i < spots.length; i++) {
      const x = spots[i];
      const flick = 0.6 + 0.4 * Math.sin(t * 6 + i * 1.7);
      const hgt = 120 * flick;
      const g = ctx.createLinearGradient(0, floorY, 0, floorY - hgt);
      g.addColorStop(0, 'rgba(120,200,255,0.5)');
      g.addColorStop(0.5, 'rgba(90,160,255,0.25)');
      g.addColorStop(1, 'rgba(90,160,255,0)');
      ctx.fillStyle = g;
      ctx.beginPath();
      ctx.ellipse(x, floorY - hgt / 2, 12, hgt / 2, 0, 0, Math.PI * 2);
      ctx.fill();
      // 火芯
      ctx.fillStyle = 'rgba(220,240,255,0.7)';
      ctx.beginPath(); ctx.ellipse(x, floorY - hgt * 0.7, 4, hgt * 0.2, 0, 0, Math.PI * 2); ctx.fill();
    }
    ctx.restore();
  }

  /** 卡背（红底徽章） */
  private drawCardBack(ctx: CanvasRenderingContext2D, cx: number, cy: number, w: number, h: number, col: string, t: number, p: number): void {
    ctx.save();
    // 底部投影
    ctx.fillStyle = 'rgba(0,0,0,0.4)';
    ctx.beginPath(); ctx.ellipse(cx, cy + h / 2 + 30, w * 0.5, 12, 0, 0, Math.PI * 2); ctx.fill();
    // 卡背本体（暗红渐变）
    const g = ctx.createLinearGradient(0, cy - h / 2, 0, cy + h / 2);
    g.addColorStop(0, '#8a2a20');
    g.addColorStop(0.5, '#5a140e');
    g.addColorStop(1, '#3a0c08');
    this.rr(cx - w / 2, cy - h / 2, w, h, 8); ctx.fillStyle = g; ctx.fill();
    // 边框
    this.rr(cx - w / 2, cy - h / 2, w, h, 8);
    ctx.strokeStyle = '#c9705a'; ctx.lineWidth = 3; ctx.stroke();
    this.rr(cx - w / 2 + 6, cy - h / 2 + 6, w - 12, h - 12, 5);
    ctx.strokeStyle = 'rgba(230,160,120,0.5)'; ctx.lineWidth = 1.5; ctx.stroke();
    // 中央徽章（翼环）
    const er = w * 0.26;
    ctx.strokeStyle = '#e8b08a'; ctx.lineWidth = 3;
    ctx.beginPath(); ctx.arc(cx, cy, er, 0, Math.PI * 2); ctx.stroke();
    ctx.beginPath(); ctx.arc(cx, cy, er * 0.55, 0, Math.PI * 2); ctx.stroke();
    // 翼
    for (const dir of [-1, 1]) {
      ctx.beginPath();
      ctx.moveTo(cx + dir * er * 0.6, cy);
      ctx.quadraticCurveTo(cx + dir * er * 1.5, cy - er * 0.7, cx + dir * er * 1.6, cy + er * 0.2);
      ctx.quadraticCurveTo(cx + dir * er * 1.1, cy + er * 0.1, cx + dir * er * 0.6, cy + er * 0.35);
      ctx.closePath();
      ctx.fillStyle = '#d8906a'; ctx.fill();
    }
    // 能量脉动光环
    const pulse = 0.5 + 0.5 * Math.sin(t * 4);
    ctx.globalCompositeOperation = 'lighter';
    const halo = ctx.createRadialGradient(cx, cy, 0, cx, cy, w);
    halo.addColorStop(0, col + Math.floor(pulse * p * 60).toString(16).padStart(2, '0'));
    halo.addColorStop(1, col + '00');
    ctx.fillStyle = halo;
    ctx.beginPath(); ctx.arc(cx, cy, w, 0, Math.PI * 2); ctx.fill();
    ctx.restore();
  }

  private renderReveal(): void {
    const ctx = this.ctx;
    if (this.phase.kind !== 'reveal') return;
    const pulls = this.phase.pulls;
    const idx = this.phase.idx;
    const cur = pulls[idx];
    if (!cur) return;

    const start = this.revealStartAt(pulls, idx);
    const dur = this.revealDur(cur.card.rarity);
    const local = Math.min(1, Math.max(0, (this.phase.t - start) / dur));
    const col = RARITY_COLOR[cur.card.rarity] || '#ffe14d';
    const rank = RANK[cur.card.rarity];
    const highCard = rank >= 4;
    const isLR = rank >= 5;

    ctx.fillStyle = `rgba(4,2,10,${highCard ? 0.72 : 0.5})`;
    ctx.fillRect(0, 0, W, H);

    // 极品前兆：前 18% 时间只压暗+光环，卡还没翻出（制造期待）
    const omenEnd = highCard ? 0.18 : 0;
    const revealLocal = omenEnd > 0 ? Math.max(0, (local - omenEnd) / (1 - omenEnd)) : local;

    // 光柱
    const pillar = Math.max(0, this.pillarV);
    if (pillar > 0 || (highCard && local < 0.35)) {
      const pw = 40 + (1 - pillar) * 150;
      ctx.save();
      ctx.globalCompositeOperation = 'lighter';
      const grad = ctx.createLinearGradient(W / 2 - pw, 0, W / 2 + pw, 0);
      grad.addColorStop(0, col + '00');
      grad.addColorStop(0.5, col + Math.floor(Math.max(pillar, 0.4) * 200).toString(16).padStart(2, '0'));
      grad.addColorStop(1, col + '00');
      ctx.fillStyle = grad;
      ctx.fillRect(W / 2 - pw, 0, pw * 2, H);
      ctx.restore();
    }

    // 前兆文字
    if (highCard && local < omenEnd + 0.05) {
      const op = Math.sin((local / Math.max(0.01, omenEnd)) * Math.PI);
      ctx.save();
      ctx.globalAlpha = Math.max(0, op);
      this.text(isLR ? '✦✦✦ 极品降临 ✦✦✦' : '★ 稀有反应 ★', W / 2, H / 2 - 40, isLR ? 36 : 28, col, 'center', 'bold', true);
      ctx.restore();
    }

    // 放射光束 + 白爆（翻出瞬间）
    if (highCard && revealLocal > 0 && revealLocal < 0.55) {
      const burstP = revealLocal / 0.55;
      ctx.save();
      ctx.globalCompositeOperation = 'lighter';
      const rays = isLR ? 28 : 14;
      for (let i = 0; i < rays; i++) {
        const a = (i / rays) * Math.PI * 2 + revealLocal * 0.8;
        const len = (isLR ? 780 : 480) * burstP;
        const wgt = (isLR ? 12 : 6) * (1 - burstP * 0.5);
        const gg = ctx.createLinearGradient(W / 2, H / 2, W / 2 + Math.cos(a) * len, H / 2 + Math.sin(a) * len);
        gg.addColorStop(0, '#ffffff' + Math.floor((1 - burstP) * 220).toString(16).padStart(2, '0'));
        gg.addColorStop(1, col + '00');
        ctx.strokeStyle = gg; ctx.lineWidth = wgt;
        ctx.beginPath();
        ctx.moveTo(W / 2, H / 2);
        ctx.lineTo(W / 2 + Math.cos(a) * len, H / 2 + Math.sin(a) * len);
        ctx.stroke();
      }
      if (burstP < 0.35) {
        ctx.fillStyle = '#ffffff' + Math.floor((0.35 - burstP) / 0.35 * (isLR ? 220 : 140)).toString(16).padStart(2, '0');
        ctx.fillRect(0, 0, W, H);
      }
      ctx.restore();
    }

    // ── 卡片入场：模仿 ducdat anim-draw-in（从下方翻转入场 + 透视）──
    if (revealLocal > 0) {
      // 0~0.35: 从底部翻起（rotateX 模拟）；0.35~1: 弹跳落定
      const flipP = Math.min(1, revealLocal / 0.35);
      const settleP = revealLocal > 0.35 ? Math.min(1, (revealLocal - 0.35) / 0.45) : 0;
      const bounce = Ease.outBack(settleP);

      // 透视：早期卡片扁、从下方升起
      const rotX = (1 - Ease.outCubic(flipP)) * 1.2; // 接近 90° 透视
      const scaleY = Math.max(0.08, Math.cos(rotX));
      const scaleX = 0.85 + 0.15 * flipP;
      const rise = (1 - Ease.outCubic(flipP)) * H * 0.55;
      const baseScale = (pulls.length === 1 ? 1.2 : 1.05) * (0.7 + 0.3 * Math.max(flipP, bounce));
      const yy = H / 2 + rise - bounce * 10;

      // 前半段显示卡背，过半翻转成正面
      const showFront = flipP > 0.45;
      ctx.save();
      ctx.translate(W / 2, yy);
      ctx.scale(baseScale * scaleX, baseScale * scaleY);
      ctx.globalAlpha = Math.min(1, flipP * 2.2);
      if (showFront) {
        drawCard(ctx, cur.card, 0, 0, 240, 340, {
          isNew: cur.isNew, rainbowT: (this.last / 1000 * 0.35) % 1, showMeta: highCard,
        });
      } else {
        this.drawCardBack(ctx, 0, 0, 240, 340, col, this.last / 1000, 1);
      }
      ctx.restore();

      // 极品卡外圈虹彩光环
      if (isLR && revealLocal > 0.4) {
        const ringA = Math.min(1, (revealLocal - 0.4) / 0.3);
        ctx.save();
        ctx.globalCompositeOperation = 'lighter';
        ctx.globalAlpha = ringA * 0.7;
        for (let k = 0; k < 3; k++) {
          const hue = (this.last / 8 + k * 120) % 360;
          ctx.strokeStyle = `hsl(${hue},100%,70%)`;
          ctx.lineWidth = 3;
          ctx.beginPath();
          ctx.arc(W / 2, H / 2, 200 + k * 18 + Math.sin(this.last / 200 + k) * 6, 0, Math.PI * 2);
          ctx.stroke();
        }
        ctx.restore();
      }
    }

    // RARE 字标
    if (highCard && revealLocal > 0.5) {
      const rareP = Math.min(1, (revealLocal - 0.5) / 0.28);
      const pop = Ease.outBack(rareP);
      const label = `${cur.card.rarity} RARE`;
      ctx.save();
      ctx.translate(W / 2, H / 2 + 210);
      ctx.scale(Math.max(0.02, pop), Math.max(0.02, pop));
      ctx.font = `bold ${isLR ? 52 : 42}px system-ui, "Arial Black", sans-serif`;
      ctx.textAlign = 'center'; ctx.textBaseline = 'middle';
      ctx.lineWidth = 10; ctx.strokeStyle = '#4a2a08';
      ctx.strokeText(label, 0, 0);
      const tg = ctx.createLinearGradient(0, -26, 0, 26);
      tg.addColorStop(0, '#fff6d8'); tg.addColorStop(0.5, '#ffd24d'); tg.addColorStop(1, '#c88a10');
      ctx.fillStyle = tg; ctx.fillText(label, 0, 0);
      ctx.restore();
    }

    if (pulls.length > 1) {
      this.text(`${idx + 1} / ${pulls.length}`, W / 2, H - 56, 14, '#e8d5a8', 'center', 'bold');
      // 进度点（极品点更大更亮）
      const dotsY = H - 36;
      const gap = 14;
      const totalW = (pulls.length - 1) * gap;
      for (let i = 0; i < pulls.length; i++) {
        const r = RANK[pulls[i].card.rarity];
        const dx = W / 2 - totalW / 2 + i * gap;
        ctx.beginPath();
        ctx.arc(dx, dotsY, i === idx ? 5 : (r >= 5 ? 3.5 : 2.5), 0, Math.PI * 2);
        ctx.fillStyle = i <= idx ? RARITY_COLOR[pulls[i].card.rarity] : 'rgba(255,255,255,0.25)';
        ctx.fill();
      }
    }
    this.text('点击跳过此张', W - 30, H - 24, 12, 'rgba(255,255,255,0.5)', 'right');
  }

  private renderSettle(): void {
    const ctx = this.ctx;
    if (this.phase.kind !== 'settle') return;
    this.buttons = [];
    const pulls = this.phase.pulls;
    ctx.fillStyle = 'rgba(4,2,10,0.62)';
    ctx.fillRect(0, 0, W, H);

    const t = this.last / 1000;
    if (pulls.length === 1) {
      const s = Math.max(0.02, Ease.outBack(Math.min(1, this.phase.t / 0.5)));
      drawCard(ctx, pulls[0].card, W / 2, H / 2 - 20, 250 * s, 360 * s,
        { isNew: pulls[0].isNew, rainbowT: (t * 0.3) % 1, showMeta: true });
      if (this.phase.t > 0.5) this.buttons.push({ x: W / 2 - 125, y: H / 2 - 20 - 180, w: 250, h: 360, id: 'card:0' });
    } else {
      const cols = 5, cw = 150, ch = 212, gx = 24, gy = 28;
      const startX = (W - (cols * cw + (cols - 1) * gx)) / 2 + cw / 2;
      const startY = (H - (2 * ch + gy)) / 2 + ch / 2 - 20;
      pulls.forEach((p, i) => {
        const col = i % cols, row = Math.floor(i / cols);
        const x = startX + col * (cw + gx);
        const y = startY + row * (ch + gy);
        // 参考 ducdat：每张从下方翻转入场，稀有卡延迟稍长更醒目
        const delay = i * 0.07 + (RANK[p.card.rarity] >= 5 ? 0.08 : 0);
        const lp = Math.min(1, Math.max(0, (this.phase as any).t - delay) / 0.42);
        const s = Math.max(0.02, Ease.outBack(lp));
        const flipY = Math.max(0.15, Math.cos((1 - lp) * 1.1)); // 透视翻起
        ctx.save();
        ctx.globalAlpha = Math.min(1, lp * 2.2);
        ctx.translate(x, y + (1 - lp) * 40);
        ctx.scale(s, s * flipY);
        drawCard(ctx, p.card, 0, 0, cw, ch,
          { isNew: p.isNew, rainbowT: (t * 0.3) % 1, showMeta: true, showName: false });
        // 极品卡落定后短促光环
        if (RANK[p.card.rarity] >= 5 && lp > 0.85) {
          ctx.globalCompositeOperation = 'lighter';
          ctx.strokeStyle = RARITY_COLOR[p.card.rarity] + 'aa';
          ctx.lineWidth = 3;
          this.rr(-cw / 2 - 4, -ch / 2 - 4, cw + 8, ch + 8, 10); ctx.stroke();
        }
        ctx.restore();
        if (lp >= 1) this.buttons.push({ x: x - cw / 2, y: y - ch / 2, w: cw, h: ch, id: `card:${i}` });
      });
    }

    // 底部三按钮：通知大家 / OK / 继续召唤（结算时导航已隐藏，不会重叠）
    const bw = 220, bh = 52, gap = 30;
    const by = H - 78;
    const total = 3 * bw + 2 * gap;
    let bx = (W - total) / 2;
    glassButton(ctx, bx, by, bw, bh, '通知大家', { kind: 'gray', hover: this.hover === 'settleShare', fontSize: 18 });
    this.buttons.push({ x: bx, y: by, w: bw, h: bh, id: 'settleShare' });
    bx += bw + gap;
    glassButton(ctx, bx, by, bw, bh, 'OK', { kind: 'green', hover: this.hover === 'settleOk', fontSize: 20 });
    this.buttons.push({ x: bx, y: by, w: bw, h: bh, id: 'settleOk' });
    bx += bw + gap;
    glassButton(ctx, bx, by, bw, bh, '继续召唤', { kind: 'green', hover: this.hover === 'settleAgain', fontSize: 18 });
    this.buttons.push({ x: bx, y: by, w: bw, h: bh, id: 'settleAgain' });
  }

  // ============ 工具 ============

  private rr(x: number, y: number, w: number, h: number, r: number): void {
    roundRectPath(this.ctx, x, y, w, h, r);
  }

  private text(str: string, x: number, y: number, size: number, color: string,
    align: CanvasTextAlign = 'left', weight = 'normal', glow = false): void {
    const ctx = this.ctx;
    ctx.save();
    ctx.font = `${weight} ${size}px system-ui, "PingFang SC", sans-serif`;
    ctx.textAlign = align;
    ctx.textBaseline = 'middle';
    if (glow) { ctx.shadowColor = color; ctx.shadowBlur = 20; }
    ctx.fillStyle = color;
    ctx.fillText(str, x, y);
    ctx.restore();
  }

  private button(x: number, y: number, w: number, h: number, label: string, id: string, primary = false): void {
    const hov = this.hover === id;
    glassButton(this.ctx, x, y, w, h, label,
      { kind: primary ? 'blue' : 'gray', hover: hov, fontSize: primary ? 16 : 13 });
    this.buttons.push({ x, y, w, h, id, primary });
  }
}

const app = document.getElementById('app')!;
new SummonHall(app);
