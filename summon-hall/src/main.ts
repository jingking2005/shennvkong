/**
 * 主程序 — 召唤神殿（真实插画背景 + 完整动画编排）
 */

import { Background } from './background';
import { drawCard, preloadImage, getImage, RARITY_COLOR } from './card';
import { BANNERS, Gacha, rateTable, bannerShowcase, type Banner, type Pull } from './gacha';
import { cardsByRarity, getCard, SUMMON_CARDS, type Card, type Rarity } from './data';
import { Ease, Tweener } from './ease';
import { glassButton, metalDialog, engravedText, roundRectPath } from './ui';
import { seedDB, saveDB, loadDB, makeOwnedCard, type DB, type Stage, type WitchRaidBoss, type OwnedCard } from './db';
import {
  ExploreStage, EnhanceCard, UseEnhancePotion, runBattleTurn, raidAttack,
  claimRaidReward, claimAllRaidRewards, tickBattlePt, tickEnergy, openChest,
  ownedToCombatant, leaderAtkBonus, canClaimLogin, claimDailyLogin, LOGIN_REWARDS,
  autoFodder, findDuplicate, evolveRate, evolveBoostRate, evolveFailureStar, prepareEvolve, applyEvolve, MAX_STAR, STAR_STAT_MULT,
  equipDefFor, equipCard, unequipCard, addEquipToInventory, type EquipDef,
  type Combatant, type ExploreResult, type SkillFx, type EvolvePrep,
  type ChestReward, type ChestQuality, mulberry32,
} from './logic';
import { eventMapBg, loadAssetImage, drawCover, ENHANCE_POTION, CHEST, EVENT_MAP_BGS, NAVI_SPRITES, naviSprite, naviName, RotationLoader } from './assets';
import { runtimeByLegacyId, quotesFor } from './data/runtime-catalog';
import { formOf, resolveImage } from './data/asset-resolver';
import { stageVisual } from './data/stages-runtime';
import { audio } from './audio';
import {
  drawBattleCard, drawHpBar, drawSkillStar, drawCircleButton, drawSkillConfirm,
  drawExploreChrome, drawTeamStripBottom,
  type SkillInfo, type ExploreChromeData,
} from './battle-ui/widgets';
import { BAT, ENCOUNTER, EXPLORE, COLORS } from './battle-ui/layout';

const W = 1280;
const H = 760;

/** 看板娘台词（随立绘轮播切换） */
const NAVI_LINES = [
  '欢迎来到圣域，主人！今天也要一起努力哦♪',
  '召唤之门已经开启，要去迎接新的神女吗？',
  '每日签到有奖励，别忘了领取俸禄！',
  '体力会随时间恢复，月卡还能加速哦。',
  '进军深处有强大的魔女等着你……做好准备！',
  '队伍搭配很重要，元素相克能打出更高伤害！',
  '首充每档都有双倍宝石，只有一次机会哦。',
  '卡牌可以通过合成强化，变强后再来挑战吧！',
  '讨伐魔女奖励丰厚，但她会反击，小心应对！',
  '传说卡池里沉睡着 LR 级的稀有神女……',
  '今天的运势不错，说不定能抽到 UR 呢！',
  '主人，累了就休息一下，我会一直在这里等你。',
  '圣域的和平，就靠主人和神女们了！',
  '商店新到了回复药水，远征前记得补给。',
];

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

/** 技能特效实例（从施法卡位置飞向目标） */
interface BattleFx {
  kind: SkillFx;         // 特效类型
  sx: number; sy: number; // 施法者位置（卡片中心）
  tx: number; ty: number; // 目标位置
  t: number;              // 0..1 播放进度
  dur: number;            // 持续秒数
  delay: number;          // 延迟开始（多卡齐发错开）
  color: string;
  hitT: number;           // 命中时刻（t 值）
  boom: BurstParticle[];  // 命中爆炸粒子（命中瞬间生成）
  player: boolean;        // 玩家方（飞向 boss）还是敌方（飞向玩家）
}

const RANK: Record<string, number> = { N: 1, R: 2, SR: 3, UR: 4, LR: 5, X: 6, VR: 7 };

/** 是否"本日新增"（2 小时内获得的卡显示 NEW） */
function isFresh(o: { gainedAt?: number }): boolean {
  return !!o.gainedAt && Date.now() - o.gainedAt < 2 * 3600000;
}

/** 10 种技能特效的主题色 */
const FX_COLOR: Record<SkillFx, string> = {
  fire: '#ff7a3c', ice: '#6fd8ff', thunder: '#ffe14d', holy: '#fff3b0',
  shadow: '#c05ce8', meteor: '#ff5c3c', wind: '#7cf0c0', star: '#ff9ce8',
  heal: '#7cf08c', arcane: '#9cb8ff',
};

/** 顶层页面 */
type Page = 'summon' | 'event' | 'map' | 'sortie' | 'battle' | 'team' | 'records' | 'inventory' | 'shop' | 'evolve';

/** 队伍槽位 */
interface TeamSlot { card: Card; hp: number; maxHp: number; lv: number; exp: number; }

/** 宝箱阶段（战斗胜利奖励） */
interface ChestState {
  quality: ChestQuality;
  phase: 'closed' | 'opening' | 'revealed';
  reward: ChestReward | null;
  t: number;          // 阶段计时
  revealIdx: number;  // 已揭示卡片数
}

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
  dmgFloat: { x: number; y: number; v: string; t: number; color: string; em?: number; crit?: boolean }[];
  victory: boolean; victoryT: number;
  defeated: boolean;
  banner: string;                  // '魔女出现！' / 'VICTORY' 横幅
  bannerT: number;
  lastActions: { actor: string; dmg: number; skill: boolean; crit: boolean; em: number }[];
  fx: BattleFx[];                  // 技能特效队列
  chest: ChestState | null;        // 胜利宝箱
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
  private skillCineT = 0;           // 技能演出压暗剩余秒数
  private skillCineName = '';       // 演出中的技能名
  private flashV = 0;
  private flashColor = '#ffe14d';
  private pillarV = 0;               // 光柱强度
  private pillarColor = '#ffe14d';
  private showRates = false;         // 提供比率浮层
  private showLogin = false;         // 每日签到浮层
  private naviLoader = new RotationLoader(6); // 看板娘轮播（懒加载）
  private cardDetail: Card | null = null; // 卡牌详情浮层
  private detailForm: 'main' | 'h' | 'x' = 'main'; // 详情形态切换（runtime catalog 卡）
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
  private invMaxScroll = 0;           // 库存滚动上限（渲染时更新，滚轮用）
  private scrollDrag: { y0: number; s0: number; trackH: number; max: number } | null = null;
  private thumbRect: { x: number; y: number; w: number; h: number; trackH: number } | null = null;
  private invFilter: string = 'ALL';  // 稀有度筛选
  private teamSelSlot = -1;           // 选中出击槽（-1 无）
  private drag: { instId: string; fromSlot: number; sx: number; sy: number; x: number; y: number; started: boolean } | null = null;
  private battlePhase: 'encounter' | 'fighting' | 'skillConfirm' | 'victory' = 'encounter'; // 战斗界面子状态（静态 UI 状态机）
  private skillStarIdx = -1;          // 点击技能星的卡位
  private detailInst: string | null = null; // 详情弹层的库存实例
  private detailInstKeep: string | null = null; // 强化/进化的主卡（详情关闭后保留）
  private enhanceMode = false;        // 强化选狗粮模式
  private enhancePicks = new Set<string>(); // 选中的狗粮
  /** 升星合成页状态 */
  private evolveTarget: string | null = null;   // 主卡
  private evolveMatSel: string | null = null;   // 同名模式：选中的素材
  private evolveMatPair: string[] = [];         // 同稀有度模式：选中的两张素材
  private evolveTab: 'same' | 'rarity' = 'same';
  private evolveFrom: Page = 'inventory';       // 返回页
  private evolveBoosters: string[] = [];        // 选中的加成卡（最多 3 张，按稀有度差提升成功率）
  private evolveBoostOpen = false;              // 加成卡选择弹层是否展开
  /** 升星融合动画（非 null 时全屏覆盖并拦截输入） */
  private evolveAnim: { targetInst: string; mats: { instId: string; card: Card; star: number }[]; boosterIds: string[]; t: number; prep: EvolvePrep; applied: boolean; tgtCard: Card; tgtStar: number } | null = null;
  private teamMsg = '';               // 操作反馈
  private teamMsgT = 0;
  /** 详情弹层装备选择面板（true 时覆盖详情下层区域） */
  private detailEquipOpen = false;
  /** 充值（调试）弹窗 */
  private showRecharge = false;
  /** 充值按钮上次点击时间（双击才打开调试面板） */
  private lastRechargeTap = 0;
  private rechargeToastT = 0;
  /** 活动地图背景轮换下标 */
  private eventMapIndex = 0;
  /** 战绩列表滚动 */
  private recordsScroll = 0;
  private recordsToast = '';
  private recordsToastT = 0;
  /** 仓库页状态 */
  private invSort: string = 'rarity';
  private invSelling = false;         // 批量出售模式
  private invSel = new Set<string>(); // 批量所选 instId
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
    this.canvas.addEventListener('pointerup', e => this.onUp(e));
    this.canvas.addEventListener('wheel', e => {
      if (this.page === 'records') {
        e.preventDefault();
        this.recordsScroll = Math.max(0, this.recordsScroll + e.deltaY * 0.6);
        return;
      }
      // 仓库 / 队伍编成：滚轮上下滚动库存网格
      if (this.page === 'inventory' || this.page === 'team') {
        e.preventDefault();
        this.invScroll = Math.max(0, Math.min(this.invMaxScroll,
          this.invScroll + Math.sign(e.deltaY)));
      }
    }, { passive: false });

    this.bg.resize(W, H);
    this.bg.setHallCarousel(EVENT_MAP_BGS); // 大厅背景：活动地图轮播
    const saved = loadDB();
    if (saved) this.db = saved;
    this.gacha.restoreCounters(this.db.user.gachaPity as never);
    this.buildMeta();
    this.activeStage = this.db.stages[0];
    this.displayProg = this.activeStage.progress;
    this.jewels = this.db.user.gems;
    this.fp = this.db.user.friendPt;
    this.buildTeam();
    this.syncBgm();
    // 每日首次进入自动弹出签到
    if (canClaimLogin(this.db)) this.showLogin = true;

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
      audio.play('divine'); // 大厅：Awakening of the Divine Realm
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
    saveDB(this.db);
  }

  /** 队伍编成：无存档时取库存前 5 张高稀有卡作为出击队；有存档时恢复队伍 */
  private buildTeam(): void {
    const inv = this.db.inventory.cards;
    const savedTeam = this.loadTeam();
    if (savedTeam && savedTeam.every(id => inv.some(c => c.instId === id))) {
      this.teamInstIds = savedTeam;
    } else {
      const rank = (id: string) => RANK[getCard(id)?.rarity ?? 'N'] ?? 0;
      const sorted = [...inv].sort((a, b) => rank(b.cardId) - rank(a.cardId) || b.lv - a.lv);
      this.teamInstIds = sorted.slice(0, 5).map(c => c.instId);
    }
    for (const id of this.teamInstIds) {
      const o = inv.find(c => c.instId === id);
      const card = o && getCard(o.cardId);
      if (card) preloadImage(card).catch(() => {});
    }
  }

  private saveTeam(): void {
    try { localStorage.setItem('summonHall_team', JSON.stringify(this.teamInstIds)); } catch {}
  }

  private loadTeam(): string[] | null {
    try {
      const raw = localStorage.getItem('summonHall_team');
      if (!raw) return null;
      const arr = JSON.parse(raw);
      return Array.isArray(arr) ? arr.filter((x): x is string => typeof x === 'string') : null;
    } catch { return null; }
  }

  /** 队伍 → Combatant[]（接 BattleEngine） */
  private teamCombatants(): Combatant[] {
    const out: Combatant[] = [];
    this.teamInstIds.forEach((instId, i) => {
      const o = this.db.inventory.cards.find(c => c.instId === instId);
      if (!o) return;
      const c = ownedToCombatant(o, i === 0, this.db);
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
        tickets: this.db.user.tickets[b.id] ?? 0,
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
    if (this.scrollDrag) {
      const d = this.scrollDrag;
      this.invScroll = Math.max(0, Math.min(d.max,
        Math.round(d.s0 + ((p.y - d.y0) / d.trackH) * d.max)));
      return;
    }
    if (this.drag) {
      this.drag.x = p.x; this.drag.y = p.y;
      if (!this.drag.started && Math.hypot(p.x - this.drag.sx, p.y - this.drag.sy) > 10) this.drag.started = true;
    }
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
    // 升星融合动画：点击跳到结果
    if (this.evolveAnim) {
      this.evolveAnim.t = Math.max(this.evolveAnim.t, this.evolveAnim.prep.success ? 2.95 : 2.5);
      return;
    }
    // 滚动条滑块拖拽
    if (this.thumbRect && (this.page === 'inventory' || this.page === 'team')) {
      const t = this.thumbRect;
      if (p.x >= t.x - 6 && p.x <= t.x + t.w + 6 && p.y >= t.y - 6 && p.y <= t.y + t.h + 6) {
        this.scrollDrag = { y0: p.y, s0: this.invScroll, trackH: t.trackH, max: this.invMaxScroll };
        return;
      }
    }
    // 编队页：库存卡/队伍槽按下 → 进入拖动候选，点击判定延迟到 pointerup
    if (this.page === 'team' && !this.enhanceMode) {
      for (let i = this.buttons.length - 1; i >= 0; i--) {
        const b = this.buttons[i];
        if (p.x >= b.x && p.x <= b.x + b.w && p.y >= b.y && p.y <= b.y + b.h) {
          if (b.id.startsWith('inv:')) {
            this.drag = { instId: b.id.slice(4), fromSlot: -1, sx: p.x, sy: p.y, x: p.x, y: p.y, started: false };
            return;
          }
          if (b.id.startsWith('slot:')) {
            const si = parseInt(b.id.slice(5), 10);
            const inst = this.teamInstIds[si];
            if (inst) {
              this.drag = { instId: inst, fromSlot: si, sx: p.x, sy: p.y, x: p.x, y: p.y, started: false };
              return;
            }
          }
          this.activate(b.id); return;
        }
      }
      return;
    }
    for (let i = this.buttons.length - 1; i >= 0; i--) {
      const b = this.buttons[i];
      if (p.x >= b.x && p.x <= b.x + b.w && p.y >= b.y && p.y <= b.y + b.h) { this.activate(b.id); return; }
    }
    if (this.phase.kind === 'summon') {
      // 点击加速爆破（参考 ducdat breakSkip）
      this.phase.t = Math.max(this.phase.t, this.summonDuration() - 0.12);
    } else if (this.phase.kind === 'reveal') {
      // 点击跳到下一张；最后一张则进结算（VR 卡不可跳过）
      const pulls = this.phase.pulls;
      if (this.isVrCard(pulls[this.phase.idx])) return;
      const next = this.phase.idx + 1;
      if (next >= pulls.length) this.phase = { kind: 'settle', pulls, t: 0 };
      else {
        this.phase.t = this.revealStartAt(pulls, next);
        this.phase.idx = next;
        this.onRevealCard(pulls[next]);
      }
    }
  }

  private onUp(e: PointerEvent): void {
    if (this.scrollDrag) { this.scrollDrag = null; return; }
    const d = this.drag;
    if (!d) return;
    this.drag = null;
    const p = this.toGame(e);
    if (!d.started) {
      // 普通点击：走原有点击逻辑
      this.activate(d.fromSlot >= 0 ? `slot:${d.fromSlot}` : `inv:${d.instId}`);
      return;
    }
    // 拖动落下：判定落点队伍槽
    const slotIdx = this.teamSlotAt(p.x, p.y);
    if (slotIdx < 0) return;
    this.dropOnSlot(d.instId, d.fromSlot, slotIdx);
  }

  /** 可视滚动条：轨道 + 可拖拽滑块（仓库/队伍共用 invScroll） */
  private drawScrollbar(trackX: number, trackY: number, trackH: number, rowsVisible: number): void {
    const max = this.invMaxScroll;
    if (max <= 0) { this.thumbRect = null; return; }
    const ctx = this.ctx, w = 14;
    this.rr(trackX, trackY, w, trackH, 7);
    ctx.fillStyle = 'rgba(20,16,32,0.85)'; ctx.fill();
    ctx.strokeStyle = '#c8b28555'; ctx.lineWidth = 1;
    this.rr(trackX, trackY, w, trackH, 7); ctx.stroke();
    const thumbH = Math.max(36, trackH * (rowsVisible / (rowsVisible + max)));
    const thumbY = trackY + (trackH - thumbH) * (this.invScroll / max);
    const g = ctx.createLinearGradient(trackX, thumbY, trackX + w, thumbY);
    g.addColorStop(0, '#8b7ff0'); g.addColorStop(0.5, '#d8ccff'); g.addColorStop(1, '#8b7ff0');
    this.rr(trackX + 2, thumbY, w - 4, thumbH, 5);
    ctx.fillStyle = g; ctx.fill();
    ctx.strokeStyle = '#ffffff88'; ctx.lineWidth = 1;
    this.rr(trackX + 2, thumbY, w - 4, thumbH, 5); ctx.stroke();
    this.thumbRect = { x: trackX + 2, y: thumbY, w: w - 4, h: thumbH, trackH: trackH - thumbH };
  }

  /** 队伍槽命中检测（与 renderTeam 布局一致） */
  private teamSlotAt(x: number, y: number): number {
    const cw = 118, ch = 168, gap = 14, sy = 132;
    let sx = 50;
    for (let i = 0; i < 5; i++) {
      if (x >= sx && x <= sx + cw && y >= sy && y <= sy + ch) return i;
      sx += cw + gap;
    }
    return -1;
  }

  /** 拖卡落到队伍槽：上阵 / 移动 / 交换（teamInstIds 保持密集数组） */
  private dropOnSlot(instId: string, fromSlot: number, slotIdx: number): void {
    if (fromSlot === slotIdx) return;
    const team = this.teamInstIds;
    if (fromSlot >= 0) {
      if (slotIdx < team.length) {
        [team[fromSlot], team[slotIdx]] = [team[slotIdx], team[fromSlot]];
        this.flashTeamMsg(`位置 ${fromSlot + 1} ⇄ 位置 ${slotIdx + 1} 已交换`);
      } else {
        team.splice(fromSlot, 1);
        team.push(instId);
        this.flashTeamMsg(`已移动到位置 ${team.length}`);
      }
    } else {
      // 库存 → 队伍：先去重（该卡若已在其他槽则移除）
      const existIdx = team.indexOf(instId);
      if (existIdx >= 0) team.splice(existIdx, 1);
      if (slotIdx < team.length) {
        team[slotIdx] = instId;
        this.flashTeamMsg(`已上阵到位置 ${slotIdx + 1}`);
      } else {
        team.push(instId);
        this.flashTeamMsg(`已上阵到位置 ${team.length}`);
      }
      const c = this.db.inventory.cards.find(x => x.instId === instId);
      if (c) { const card = getCard(c.cardId); if (card) preloadImage(card).catch(() => {}); }
    }
    this.teamSelSlot = -1;
    this.saveTeam();
  }

  private activate(id: string): void {
    audio.playSe('uiClick');
    // 全局 HUD（任意页优先）
    if (id === 'toggleMusic') { audio.toggleMute(); return; }
    // 抽卡快速跳过：不再逐张揭示，直接展示全部结果（VR 卡不可跳过，必须完整演完动画）
    if (id === 'skipAll' && (this.phase.kind === 'reveal' || this.phase.kind === 'summon')) {
      if (this.phase.kind === 'reveal' && this.isVrCard(this.phase.pulls[this.phase.idx])) {
        this.flashTeamMsg('VR 出现！圣光礼花不可跳过');
        return;
      }
      if (this.phase.pulls.some(p => this.isVrCard(p))) return; // 十连含 VR：全部不可跳过
      this.phase = { kind: 'settle', pulls: this.phase.pulls, t: 0 };
      return;
    }
    if (id === 'openRecharge') { this.page = 'shop'; this.syncBgm(); return; }
    if (id === 'closeRecharge') { this.showRecharge = false; return; }
    if (id.startsWith('recharge:')) {
      if (id === 'recharge:noop') return;
      this.doRecharge(id.slice(9));
      return;
    }
    if (this.showRecharge) return; // 弹窗打开时屏蔽下层

    // 每日签到浮层
    if (id === 'openLogin') { this.showLogin = true; return; }
    if (id === 'closeLogin' || id === 'closeLoginBg') { this.showLogin = false; return; }
    if (id === 'loginClaim') {
      const r = claimDailyLogin(this.db);
      if (r.ok && r.reward) {
        this.jewels = this.db.user.gems;
        this.fp = this.db.user.friendPt;
        saveDB(this.db);
        this.flashTeamMsg(`第 ${r.day} 天签到：${r.reward.label}`);
        this.showLogin = false;
      } else {
        this.flashTeamMsg(r.reason ?? '领取失败');
      }
      return;
    }
    if (this.showLogin) return; // 签到浮层打开时屏蔽下层

    // 商店购买
    if (id.startsWith('shopBuy:') && this.page === 'shop') {
      this.shopBuy(id.slice(8));
      return;
    }
    // 底部导航
    if (id.startsWith('nav:')) {
      const p = id.slice(4) as Page;
      this.page = p === 'map' ? 'map' : p;
      this.showRates = false; this.cardDetail = null;
      if (this.page === 'summon') this.phase = { kind: 'hall' };
      if (p === 'team') { this.detailInst = null; this.enhanceMode = false; this.teamSelSlot = -1; }
      this.syncBgm();
      return;
    }
    // 队伍页交互
    if (this.page === 'team') { this.activateTeam(id); return; }
    // 仓库页交互
    if (this.page === 'inventory') { this.activateInv(id); return; }
    // 升星合成页交互
    if (this.page === 'evolve') { this.activateEvolve(id); return; }
    // 战绩领取
    if (this.page === 'records') {
      if (id === 'recordsBack') { this.page = 'event'; this.syncBgm(); return; }
      if (id === 'claimAll') {
        const r = claimAllRaidRewards(this.db);
        this.jewels = this.db.user.gems;
        saveDB(this.db);
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
        saveDB(this.db);
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
      const idx = parseInt(id.slice(5), 10);
      const s = this.db.stages[idx];
      if (!s) return; // 未开放装饰点
      const unlocked = idx === 0 || this.db.stages[idx - 1]?.firstClear === true;
      if (!unlocked) return;
      this.activeStage = s;
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
      if (c) { this.cardDetail = c.card; this.detailForm = 'main'; }
      return;
    }
    // 探索框架按钮（出击/遭遇共用）：菜单 / 全恢复 / 部队
    if (id === 'menu') { this.page = 'summon'; this.battle = null; this.syncBgm(); return; }
    if (id === 'sideHeal') { this.db.user.energy = this.db.user.energyMax; saveDB(this.db); return; }
    if (id === 'sideTeam' || id === 'sideEdit') { this.page = 'team'; this.syncBgm(); return; }
    // 战斗
    if (this.page === 'battle' && this.battle) {
      const b = this.battle;
      // ── 战斗 UI 状态机（遭遇→主界面→技能确认→胜利）──
      if (id === 'batStart') { this.battlePhase = 'fighting'; return; }
      if (id === 'batAutoEnc') { this.battlePhase = 'fighting'; b.auto = true; b.autoTimer = 0; return; }
      if (id.startsWith('star:')) {
        this.skillStarIdx = parseInt(id.slice(5), 10);
        this.battlePhase = 'skillConfirm';
        return;
      }
      if (id === 'skillCancel') { this.battlePhase = 'fighting'; this.skillStarIdx = -1; return; }
      if (id === 'skillGo') {
        // 发动技能 = 手动打一轮（技能按概率触发，FX 由 runTurn 施放）
        this.battlePhase = 'fighting';
        this.skillStarIdx = -1;
        this.runTurn();
        return;
      }
      if (id === 'victoryOk2') {
        // 讨伐胜利：当场发放击杀奖励并标记已领
        if (b.raid?.defeated && !b.raid.claimed) {
          const gold = b.raid.archWitch ? 50000 : 12000;
          const gems = b.raid.archWitch ? 500 : 300;
          const tix = b.raid.archWitch ? 3 : 1;
          this.db.user.gold += gold;
          this.db.user.gems += gems;
          this.db.user.tickets.fate = (this.db.user.tickets.fate || 0) + tix;
          b.raid.claimed = true;
          this.jewels = this.db.user.gems;
          this.flashTeamMsg(`讨伐奖励：金币+${gold.toLocaleString()} 宝石+${gems} 券+${tix}`);
        }
        saveDB(this.db);
        this.page = this.activeStage.progress >= 1 ? 'map' : 'sortie';
        this.battle = null; this.syncBgm();
        return;
      }
      if (id === 'batAttack') {
        // 手动普攻一回合（攒怒；满怒卡在此回合放技能）
        if (this.battlePhase === 'fighting' && !b.auto) this.runTurn();
        return;
      }
      if (id === 'batRetreat') { this.page = 'sortie'; this.battle = null; this.syncBgm(); return; }
      if (id === 'batAuto') { b.auto = !b.auto; b.autoTimer = 0; return; }
      if (id === 'batStatus') { return; }
      if (id === 'retreat') { this.page = 'sortie'; this.battle = null; this.syncBgm(); return; }
      if (id === 'bAuto') { b.auto = !b.auto; b.autoTimer = 0; return; }
      if (id === 'chestOpen') {
        // 点击宝箱：开箱（卡片入库），播放 opening 动画
        if (b.chest && b.chest.phase === 'closed') {
          const pickCard = (r: string) => {
            const pool = SUMMON_CARDS.filter(c => c.rarity === r);
            const fb = cardsByRarity(r as Rarity);
            const use = pool.length ? pool : fb;
            return use[(Math.random() * use.length) | 0];
          };
          b.chest.reward = openChest(this.db, b.chest.quality, pickCard, b.seed++);
          b.chest.phase = 'opening'; b.chest.t = 0;
          this.cardCount = this.db.inventory.cards.length;
          saveDB(this.db);
          this.flashV = 0.6; this.flashColor = '#fff3b0';
          this.shake = 0.5;
        }
        return;
      }
      if (id === 'victoryOk') {
        // 有宝箱必须先开完（揭示完成）才能离开
        if (b.chest && b.chest.phase !== 'revealed') return;
        if (b.chest && b.chest.revealIdx < (b.chest.reward?.cards.length ?? 0)) {
          // 未揭示完：点击直接快进
          b.chest.t = 99; return;
        }
        const wasRaid = !!b.raid?.defeated;
        if (wasRaid && b.raid) {
          // 讨伐成功奖励（击杀当场发放，战绩页还能再领一次？不——改为只在此发放并标记已领）
          if (!b.raid.claimed) {
            const gold = b.raid.archWitch ? 50000 : 12000;
            const gems = b.raid.archWitch ? 500 : 300;
            const tix = b.raid.archWitch ? 3 : 1;
            this.db.user.gold += gold;
            this.db.user.gems += gems;
            this.db.user.tickets.fate = (this.db.user.tickets.fate || 0) + tix;
            b.raid.claimed = true;
            this.flashTeamMsg(`讨伐奖励：金币+${gold.toLocaleString()} 宝石+${gems} 券+${tix}`);
          }
        } else if (!b.raid && b.victory) {
          // 普通遭遇战胜利：金币奖励
          const gold = Math.floor(500 + Math.random() * 1500);
          this.db.user.gold += gold;
          this.flashTeamMsg(`战斗胜利！金币+${gold.toLocaleString()}`);
        }
        saveDB(this.db);
        // 闯关流程：战斗胜利→回出击继续探索；本关 100% 通关→回地图选下一关
        if (!wasRaid) this.activeStage.progress = Math.min(1, this.activeStage.progress + 0.05);
        const cleared = this.activeStage.progress >= 1;
        this.page = cleared ? 'map' : 'sortie';
        this.battle = null;
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
      if (c) { this.cardDetail = c; this.detailForm = 'main'; }
      return;
    }
    if (id.startsWith('form:')) { this.detailForm = id.slice(5) as 'main' | 'h' | 'x'; return; }
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
    if (id === 'pull1' && this.phase.kind === 'hall') {
      this.phase = { kind: 'confirm', ten: false, ticket: false, t: 0 };
      return;
    }
    if (id === 'pull1ticket' && this.phase.kind === 'hall') {
      this.phase = { kind: 'confirm', ten: false, ticket: true, t: 0 };
      return;
    }
    if (id === 'exchange') { this.page = 'shop'; this.syncBgm(); return; } // 进入商店（原为 +3000 占位）
  }

  // ============ 抽卡流程 ============

  private execPull(ten: boolean, useTicket: boolean): void {
    const cost = ten ? this.banner.costTen : this.banner.costSingle;
    const isFriend = this.banner.id === 'friend';
    const ticketKey = this.banner.id;

    // ── 资源校验：不足则拒绝，不再"自动借钱" ──
    if (useTicket) {
      const need = ten ? 10 : 1;
      const have = this.db.user.tickets[this.banner.id] || 0;
      if (have < need) { this.flashTeamMsg(`召唤券不足（需要 ${need} 张）`); this.phase = { kind: 'hall' }; return; }
      this.db.user.tickets[this.banner.id] = have - need;
    } else {
      if (isFriend) {
        if (this.db.user.friendPt < cost) { this.flashTeamMsg('友情点不足'); this.phase = { kind: 'hall' }; return; }
        this.db.user.friendPt -= cost;
      } else {
        if (this.db.user.gems < cost) { this.flashTeamMsg('宝石不足'); this.phase = { kind: 'hall' }; return; }
        this.db.user.gems -= cost;
      }
    }
    this.jewels = this.db.user.gems;
    this.fp = this.db.user.friendPt;
    const m = this.meta.get(this.banner.id);
    if (m) m.tickets = this.db.user.tickets[this.banner.id] || 0;

    let pulls = ten ? this.gacha.pullTen(this.banner) : [this.gacha.pullOne(this.banner)];
    pulls.forEach(p => preloadImage(p.card).catch(() => {}));
    // ★ 抽到的卡入库（此前只加计数器，卡从未进库存——编队里看不到的根源）
    for (const p of pulls) {
      // 元素精选池抽到的 X 卡 → 装备库（装备卡，不占卡位）
      if (this.banner.id === 'element') {
        addEquipToInventory(this.db, p.card.id);
        continue;
      }
      const tier = RANK[p.card.rarity] || 1;
      this.db.inventory.cards.push(makeOwnedCard(p.card.id, 1 + tier * 2));
    }
    this.cardCount = this.db.inventory.cards.length;
    this.gacha.markOwned(pulls.map(p => p.card.id));
    this.db.user.gachaPity = this.gacha.serializeCounters();
    saveDB(this.db);

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

  /** VR 卡（rank ≥ 7）：抽中时圣光礼花动画不可跳过 */
  private isVrCard(p: Pull | undefined): boolean {
    return !!p && RANK[p.card.rarity] >= 7;
  }

  private summonDuration(): number {
    if (this.phase.kind !== 'summon') return 0;
    const top = this.topRarity(this.phase.pulls);
    // 参考 ducdat：高稀有卡包震颤更久，再爆破
    return ['LR', 'X', 'VR'].includes(top) ? 2.6 : top === 'UR' ? 2.0 : top === 'SR' ? 1.4 : 1.0;
  }

  /** 单卡揭示时长：极品卡明显更长（VR 6s 不可跳过、LR 5s、UR 3s，可跳过） */
  private revealDur(rarity: string): number {
    const r = RANK[rarity] ?? 1;
    if (r >= 7) return 6.0;  // VR 圣光礼花（不可跳过）
    if (r >= 6) return 5.0;  // X 同 LR 档
    if (r >= 5) return 5.0;  // LR 太阳花瓣
    if (r >= 4) return 3.0;  // UR 桃心光束
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
    // 稀有揭示音：UR→se_040；LR/X/VR→se_017
    if (rank >= 5) audio.playSe('summonLR');
    else if (rank === 4) audio.playSe('summonUR');
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
    tickEnergy(this.db); // 行动力随时间恢复（全页面生效）
    this.shake = Math.max(0, this.shake - dt * 2.2);
    this.flashV = Math.max(0, this.flashV - dt * 1.8);
    this.pillarV = Math.max(0, this.pillarV - dt * 2.4);

    // 升星融合动画推进（1.3s 融合 → 白光一闪 → 成功放射/失败爆碎）
    if (this.evolveAnim) {
      const ea = this.evolveAnim;
      ea.t += dt;
      if (!ea.applied && ea.t >= 1.3) {
        ea.applied = true;
        const matIds = ea.mats.map(m => m.instId);
        applyEvolve(this.db, ea.targetInst, matIds, ea.prep, ea.boosterIds);
        const dropSet = new Set([...matIds, ...ea.boosterIds]);
        if (this.teamInstIds.some(x => dropSet.has(x))) {
          this.teamInstIds = this.teamInstIds.filter(x => !dropSet.has(x));
          this.saveTeam();
        }
        saveDB(this.db);
        if (ea.prep.success) {
          const s = ea.prep.newEvoStage;
          audio.playSe('evolveOk');
          this.burst(s >= 10 ? '#ff9ce8' : s >= 7 ? '#ffd24d' : s >= 5 ? '#eef2fa' : '#e0a060', s >= 10 ? 120 : s >= 7 ? 80 : s >= 5 ? 60 : 40);
          if (s >= 10) { this.burst('#6fd8ff', 60); this.burst('#ffd24d', 60); }
        } else {
          audio.playSe('evolveFail');
        }
      }
      const endT = ea.prep.success ? 3.0 : 2.6;
      if (ea.t >= endT) {
        this.flashTeamMsg(ea.prep.success
          ? `升星成功！${'★'.repeat(ea.prep.newEvoStage)} 继承 ATK+${ea.prep.inheritedAtk} HP+${ea.prep.inheritedHp}`
          : `合成失败……素材损毁，主卡降至 ${evolveFailureStar(ea.tgtStar)} 星（下次成功率 +30%）`);
        this.evolveAnim = null;
        this.evolveMatSel = null;
        this.evolveMatPair = [];
        this.evolveBoosters = [];
      }
    }

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
      this.skillCineT = Math.max(0, this.skillCineT - dt);
      for (const d of b.dmgFloat) d.t += dt;
      b.dmgFloat = b.dmgFloat.filter(d => d.t < 1);
      this.updateFx(dt);   // 技能特效推进
      // 宝箱阶段推进：opening 0.8s → revealed（逐张揭示）
      if (b.chest) {
        const c = b.chest;
        if (c.phase === 'opening') {
          c.t += dt;
          if (c.t >= 0.8) { c.phase = 'revealed'; c.t = 0; c.revealIdx = 0; }
        } else if (c.phase === 'revealed') {
          c.t += dt;
          const total = c.reward?.cards.length ?? 0;
          c.revealIdx = Math.min(total, Math.floor(c.t / 0.3) + 1);
        }
      }
      if (b.victory) {
        b.victoryT += dt;
        // 胜利后 1.2s 进入结算界面（留出最后一击的特效/飘字时间）
        if (b.victoryT >= 1.2 && this.battlePhase !== 'victory') this.battlePhase = 'victory';
      }
      // AP 随时间恢复（讨伐体力）
      tickBattlePt(this.db);
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
    if (this.rechargeToastT > 0) this.rechargeToastT -= dt;

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
        procChance: 0.5, skillMult: 3, skillFx: 'shadow', isLeader: false, rage: 0,
      }];
    } else {
      const boss = cardsByRarity('LR')[1] ?? cardsByRarity('UR')[0];
      preloadImage(boss).catch(() => {});
      // 动态平衡：按当前队伍战力生成（约 6 回合、每击 ~16% 单卡 HP）
      const teamDpt = team.reduce((s, c) => s + c.atk * (1 + c.procChance * (c.skillMult - 1)), 0);
      const avgHp = team.reduce((s, c) => s + c.hpMax, 0) / Math.max(1, team.length);
      const bossHp = Math.floor(teamDpt * 6 * (0.9 + Math.random() * 0.2));
      enemies = [{
        instId: 'boss', card: boss, lv: 50,
        atk: Math.floor(avgHp * 0.16 * (0.9 + Math.random() * 0.2)),
        hp: bossHp, hpMax: bossHp,
        def: 800, speed: 100, element: 'dark', skillName: '暗之冲击',
        procChance: 0.4, skillMult: 2.5, skillFx: 'arcane', isLeader: false, rage: 0,
      }];
    }
    this.battle = {
      team, enemies, raid, t: 0, auto: false, autoTimer: 0,
      seed: (Math.random() * 1e9) | 0, skillPrompt: null,
      dmgFloat: [], victory: false, victoryT: 0, defeated: false,
      banner: raid ? (raid.archWitch ? '超·幻想魔女降临！' : '魔女出现！') : '战斗开始',
      bannerT: 0, lastActions: [], fx: [], chest: null,
    };
    this.battlePhase = 'encounter';
    this.skillStarIdx = -1;
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
      saveDB(this.db);
      if (r.outOfAp) {
        // 战斗体力耗尽：停止自动，提示等待恢复
        b.auto = false;
        b.banner = '战斗体力耗尽！等待恢复或使用补给';
        b.bannerT = 0;
        return;
      }
      if (r.dmg > 0) {
        b.dmgFloat.push({ x: W / 2, y: 200, v: String(r.dmg), t: 0, color: '#ffe14d' });
        this.burst('#c05ce8', 25); this.shake = 0.35;
        audio.playSe(r.skills.length ? 'skill' : 'attack');
      }
      // 技能特效：每张触发技能的卡向 BOSS 施放
      for (let i = 0; i < r.skills.length; i++) {
        const s = r.skills[i];
        const ci = b.team.findIndex(c => c.instId === s.actorInstId);
        const sx = ci >= 0 ? this.teamSlotX(ci) : W / 2;
        this.spawnFx({
          kind: s.skillFx, sx, sy: H - 160, tx: W / 2, ty: 130,
          t: 0, dur: 0.7 + Math.random() * 0.25, delay: i * 0.09,
          color: FX_COLOR[s.skillFx], hitT: 0.72, boom: [], player: true,
        });
      }
      // 魔女反击：向我方被击中的卡施放暗影弹 + 伤害飘字
      if (r.counter) {
        const ci = b.team.findIndex(c => c.instId === r.counter!.targetInstId);
        if (ci >= 0) {
          const tx = this.teamSlotX(ci);
          this.spawnFx({
            kind: 'shadow', sx: W / 2, sy: 130, tx, ty: H - 220,
            t: 0, dur: 0.6, delay: 0.35,
            color: '#c05ce8', hitT: 0.72, boom: [], player: false,
          });
          b.dmgFloat.push({ x: tx, y: H - 320, v: String(r.counter.dmg), t: 0.3, color: '#ff8c8c' });
          this.shake = Math.max(this.shake, 0.3);
          audio.playSe('attack');
        }
        // 团灭判定
        if (b.team.every(c => c.hp <= 0)) {
          b.defeated = true;
          b.auto = false;
          b.banner = '队伍全灭……撤退重整旗鼓';
          b.bannerT = 0;
        }
      }
      if (r.defeated) {
        audio.playSe('victory2');
        b.victory = true; b.victoryT = 0;
        b.banner = `讨伐成功！积分 +${r.ptGain}`;
        b.bannerT = 0;
        // 宝箱：大魔女→钻石（30% 升级稀有极品），普通魔女→黄金
        const arch = b.raid.archWitch;
        const upLegend = arch && mulberry32(b.seed++)() < 0.3;
        b.chest = {
          quality: arch ? (upLegend ? 'legend' : 'diamond') : 'gold',
          phase: 'closed', reward: null, t: 0, revealIdx: 0,
        };
        this.giveVictoryExp();
      }
      return;
    }

    // 普通遭遇战：BattleEngine 回合制
    const res = runBattleTurn(b.team, b.enemies, b.seed++, leaderBonus);
    b.lastActions = res.actions.map(a => ({
      actor: a.actorName, dmg: a.damage, skill: a.skillUsed, crit: a.crit, em: a.elementMult,
    }));
    // SE：本回合有普攻→attack，有技能→skill
    if (res.actions.some(a => a.skillUsed)) audio.playSe('skill');
    else if (res.actions.length) audio.playSe('attack');
    // 伤害飘字：玩家对敌 → 顶部；敌对我 → 底部
    let fxDelay = 0;
    for (const a of res.actions) {
      const isPlayerAtk = b.team.some(c => c.instId === a.actorInstId);
      if (isPlayerAtk) {
        b.dmgFloat.push({ x: W / 2 + (Math.random() - 0.5) * 60, y: 200, v: String(a.damage), t: 0, color: a.crit ? '#ff5c5c' : '#ffe14d', em: a.elementMult, crit: a.crit });
        const ci = b.team.findIndex(c => c.instId === a.actorInstId);
        const sx = ci >= 0 ? this.teamSlotX(ci) : W / 2;
        if (a.skillFx) {
          // 玩家技能特效：从施法卡 → BOSS（附全屏演出）
          this.spawnFx({
            kind: a.skillFx, sx, sy: H - 160, tx: W / 2, ty: 130,
            t: 0, dur: 0.75, delay: fxDelay, color: FX_COLOR[a.skillFx], hitT: 0.7, boom: [], player: true,
          });
          this.skillCineT = 0.8;
          this.skillCineName = (ci >= 0 ? b.team[ci].skillName : '') || '技能发动';
        } else {
          // 普攻也有动作：小型星光弹
          this.spawnFx({
            kind: 'star', sx, sy: H - 160, tx: W / 2, ty: 130,
            t: 0, dur: 0.42, delay: fxDelay, color: '#ffe9a8', hitT: 0.72, boom: [], player: true,
          });
        }
      } else {
        const slotIdx = a.targetIndex;
        const x = this.teamSlotX(slotIdx);
        b.dmgFloat.push({ x, y: H - 320, v: String(a.damage), t: 0, color: '#ff8c8c', em: a.elementMult, crit: a.crit });
        if (a.skillFx) {
          // 敌方技能特效：从 BOSS → 玩家卡
          this.spawnFx({
            kind: a.skillFx, sx: W / 2, sy: 130, tx: x, ty: H - 160,
            t: 0, dur: 0.75, delay: fxDelay, color: FX_COLOR[a.skillFx], hitT: 0.7, boom: [], player: false,
          });
          this.skillCineT = 0.8;
          this.skillCineName = '敌方技能';
        } else {
          // 敌方普攻：暗影弹
          this.spawnFx({
            kind: 'shadow', sx: W / 2, sy: 130, tx: x, ty: H - 160,
            t: 0, dur: 0.42, delay: fxDelay, color: '#c05ce8', hitT: 0.72, boom: [], player: false,
          });
        }
      }
      fxDelay += 0.12;
    }
    // 打击感：按本回合最高伤害占目标最大 HP 比例震屏
    const maxRatio = Math.max(0, ...res.actions.map(a => {
      const isPlayerAtk = b.team.some(c => c.instId === a.actorInstId);
      const hpMax = isPlayerAtk ? (b.enemies[0]?.hpMax ?? 1) : (b.team[a.targetIndex]?.hpMax ?? 1);
      return a.damage / Math.max(1, hpMax);
    }));
    this.shake = 0.28 + Math.min(0.4, maxRatio * 1.6) + (res.actions.some(a => a.crit) ? 0.1 : 0);
    if (res.finished) {
      audio.playSe('victory2');
      if (res.playerWon) {
        b.victory = true; b.victoryT = 0;
        b.banner = 'VICTORY'; b.bannerT = 0;
        // 普通遭遇战：白银宝箱
        b.chest = { quality: 'silver', phase: 'closed', reward: null, t: 0, revealIdx: 0 };
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

  /** 生成一个技能特效 */
  private spawnFx(fx: BattleFx): void {
    if (!this.battle) return;
    this.battle.fx.push(fx);
  }

  /** 推进技能特效：播放进度 + 命中瞬间生成爆炸粒子 */
  private updateFx(dt: number): void {
    const b = this.battle;
    if (!b) return;
    for (const fx of b.fx) {
      fx.t += dt / fx.dur;
      // 命中时刻：生成爆炸粒子
      if (fx.t >= fx.hitT && fx.boom.length === 0) {
        const hx = fx.tx, hy = fx.ty;
        const n = fx.kind === 'meteor' || fx.kind === 'star' ? 26 : 16;
        for (let i = 0; i < n; i++) {
          const a = Math.random() * Math.PI * 2;
          const sp = 90 + Math.random() * 240;
          fx.boom.push({
            x: hx, y: hy,
            vx: Math.cos(a) * sp, vy: Math.sin(a) * sp - 60,
            life: 0.45 + Math.random() * 0.35, max: 0.8,
            color: Math.random() < 0.3 ? '#ffffff' : fx.color,
            r: 2.5 + Math.random() * 4,
          });
        }
        this.shake = Math.max(this.shake, fx.kind === 'meteor' ? 0.6 : 0.35);
      }
      // 粒子推进
      for (const p of fx.boom) {
        p.life -= dt;
        p.x += p.vx * dt;
        p.y += p.vy * dt;
        p.vy += 300 * dt;
      }
      fx.boom = fx.boom.filter(p => p.life > 0);
    }
    b.fx = b.fx.filter(fx => fx.t < 1 + fx.delay);
  }

  private giveVictoryExp(): void {
    for (const instId of this.teamInstIds) {
      const o = this.db.inventory.cards.find(c => c.instId === instId);
      if (o) o.exp += 30;
    }
    saveDB(this.db);
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

  /** 发一张卡进库存（探索奖励等用） */
  private addCardToInventory(rarity: Rarity): void {
    const c = cardsByRarity(rarity)[0];
    if (!c) return;
    this.db.inventory.cards.push(makeOwnedCard(c.id, 1));
    this.cardCount = this.db.inventory.cards.length;
  }

  private doExploreOnce(): ExploreResult {
    const r = ExploreStage(this.db, this.activeStage, (Math.random() * 1e9) | 0);
    // 通关奖励（首通 / 满 100%）
    if (r.completed) {
      const s = this.activeStage;
      if (!s.firstClear) {
        s.firstClear = true;
        r.firstClear = true;
        this.db.user.gems += 100;
        this.db.user.tickets['fate'] = (this.db.user.tickets['fate'] || 0) + 3;
        r.firstClearReward = '首通奖励：宝石×100 + 召唤券×3';
      } else if (!s.rewardClaimed100) {
        s.rewardClaimed100 = true;
        r.firstClearReward = '100% 探索奖励：限定 R 卡';
        this.addCardToInventory('R' as Rarity);
      }
    }
    this.exploreMsg = r;
    this.exploreMsgT = 0;
    this.jewels = this.db.user.gems;
    this.cardCount = this.db.inventory.cards.length;
    saveDB(this.db);
    if (r.event === 'witch' && r.witchRaidId) {
      audio.playSe('witch'); // 遇魔女警示音（BGM 持续）
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
    if (this.page === 'event' || this.page === 'records') {
      drawCover(ctx, loadAssetImage(eventMapBg(this.eventMapIndex)), W, H, 1);
      ctx.fillStyle = 'rgba(6,4,16,0.28)';
      ctx.fillRect(0, 0, W, H);
    } else if (this.page === 'map') {
      // 地图页：当前关卡的确定 AreaMap（manifest 绑定，非隐式轮换）
      drawCover(ctx, loadAssetImage(stageVisual(this.activeStage.stageId).mapAsset), W, H, 1);
      ctx.fillStyle = 'rgba(6,4,16,0.28)';
      ctx.fillRect(0, 0, W, H);
    } else if (this.page === 'sortie' || this.page === 'battle') {
      // 出击/战斗：当前关卡（或讨伐战）的确定 BattleBG
      const raidKey = this.battle?.raid ? (this.battle.raid.archWitch ? '_raid-archwitch' : '_raid-normal') : null;
      const vis = stageVisual(raidKey ?? this.activeStage.stageId);
      const m = this.page === 'sortie' ? this.marchAnim : null;
      if (m) {
        // 进军推进感：背景放大 + 动态模糊（进时推近，回时复原）
        const p = Math.min(1, m.t / m.dur);
        const push = Math.sin(p * Math.PI);
        ctx.save();
        ctx.filter = `blur(${(push * 3).toFixed(1)}px)`;
        ctx.translate(W / 2, H / 2);
        ctx.scale(1 + push * 0.07, 1 + push * 0.07);
        ctx.translate(-W / 2, -H / 2);
        drawCover(ctx, loadAssetImage(vis.battleBgAsset), W, H, 1);
        ctx.restore();
        ctx.filter = 'none';
      } else {
        drawCover(ctx, loadAssetImage(vis.battleBgAsset), W, H, 1);
      }
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
    else if (this.page === 'inventory') this.renderInventory();
    else if (this.page === 'shop') this.renderShop();
    else if (this.page === 'records') this.renderRecords();
    else if (this.page === 'evolve') this.renderEvolvePage();

    // 底部导航（战斗 / 出击 / 升星合成 / 结算时隐藏，复刻截图全屏画面）
    if (this.page !== 'battle' && this.page !== 'sortie' && this.page !== 'evolve' && this.phase.kind !== 'settle' && !this.showRecharge) this.renderNav();

    // 全局：音乐 + 充值（战斗/出击/升星合成页隐藏，避免与复刻 UI 冲突）
    if (this.page !== 'battle' && this.page !== 'sortie' && this.page !== 'evolve') this.renderGlobalHud();
    if (this.showRecharge) this.renderRecharge();

    // 升星融合动画（全屏覆盖层，压在页面/导航之上、粒子之下）
    if (this.evolveAnim) this.renderEvolveAnim();

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
    // 每日签到浮层（最顶层）
    if (this.showLogin) this.renderLoginOverlay();
  }

  /** 每日签到浮层：7 日表 + 领取按钮 */
  private renderLoginOverlay(): void {
    const ctx = this.ctx;
    ctx.fillStyle = 'rgba(2,3,8,0.72)';
    ctx.fillRect(0, 0, W, H);
    this.buttons.push({ x: 0, y: 0, w: W, h: H, id: 'closeLoginBg' });

    const dw = 620, dh = 420, dx = W / 2 - dw / 2, dy = H / 2 - dh / 2;
    metalDialog(ctx, dx, dy, dw, dh);
    this.text('每日签到', W / 2, dy + 40, 26, '#f5e0a0', 'center', 'bold', true);
    const u = this.db.user;
    const canClaim = canClaimLogin(this.db);
    // 当前表位置：可领时为下一个位置；已领时为今日位置
    const idx = ((u.loginStreak - (canClaim ? 0 : 1)) % 7 + 7) % 7;

    // 7 日格子（4+3 两行）
    const cw = 132, ch = 120, gap = 12;
    LOGIN_REWARDS.forEach((r, i) => {
      const row = i < 4 ? 0 : 1;
      const col = i < 4 ? i : i - 4;
      const gx = dx + (dw - (4 * cw + 3 * gap)) / 2 + col * (cw + gap) + (row === 1 ? (cw + gap) / 2 : 0);
      const gy = dy + 70 + row * (ch + gap);
      const isCur = i === idx;
      const claimed = canClaim ? i < idx : i <= idx;
      this.rr(gx, gy, cw, ch, 10);
      ctx.fillStyle = claimed ? '#1a2416' : (isCur ? '#2a2038' : '#141020');
      ctx.fill();
      ctx.strokeStyle = isCur ? '#ffd24d' : (claimed ? '#4a6a3a' : '#3a3450');
      ctx.lineWidth = isCur ? 2.5 : 1.2;
      this.rr(gx, gy, cw, ch, 10); ctx.stroke();
      this.text(`第 ${i + 1} 天`, gx + cw / 2, gy + 20, 12, isCur ? '#ffd24d' : '#8892a8', 'center', 'bold');
      this.wrapText(r.label, gx + 8, gy + 44, cw - 16, 14, 12, claimed ? '#6a8a5a' : '#e8d5a8', 'bold');
      if (claimed) this.text('✓', gx + cw / 2, gy + ch - 14, 20, '#6fce9a', 'center', 'bold');
      if (isCur && canClaim) {
        ctx.save();
        ctx.globalAlpha = 0.5 + 0.4 * Math.sin(this.last / 300);
        ctx.strokeStyle = '#ffe9a8'; ctx.lineWidth = 2;
        this.rr(gx - 3, gy - 3, cw + 6, ch + 6, 12); ctx.stroke();
        ctx.restore();
      }
    });

    // 连续天数
    this.text(`已连续签到 ${u.loginStreak} 天`, W / 2, dy + dh - 92, 13, '#cfc4a8', 'center');

    // 领取 / 关闭
    if (canClaim) {
      glassButton(ctx, W / 2 - 110, dy + dh - 70, 220, 50, '领 取 奖 励', {
        kind: 'green', hover: this.hover === 'loginClaim', fontSize: 18,
      });
      this.buttons.push({ x: W / 2 - 110, y: dy + dh - 70, w: 220, h: 50, id: 'loginClaim' });
    } else {
      glassButton(ctx, W / 2 - 90, dy + dh - 70, 180, 50, '关 闭', {
        kind: 'gray', hover: this.hover === 'closeLogin', fontSize: 17,
      });
      this.buttons.push({ x: W / 2 - 90, y: dy + dh - 70, w: 180, h: 50, id: 'closeLogin' });
    }
  }

  private renderCardDetail(card: Card): void {
    const ctx = this.ctx;
    const t = this.last / 1000;
    // 遮罩
    ctx.fillStyle = 'rgba(2,3,8,0.7)';
    ctx.fillRect(0, 0, W, H);
    this.buttons.push({ x: 0, y: 0, w: W, h: H, id: 'closeDetail' });

    // 左侧大卡（runtime catalog 卡按所选形态绘制归档原图，否则回退 wiki 卡面）
    const cw = 300, ch = 424;
    const cardX = W / 2 - 320, cardY = H / 2 - 20;
    const rdef = runtimeByLegacyId(card.id);
    const formRef = rdef ? (formOf(rdef, this.detailForm) ?? formOf(rdef, 'main')) : null;
    if (rdef && formRef) {
      const img = resolveImage(formRef);
      this.rr(cardX - 4, cardY - 4, cw + 8, ch + 8, 10);
      ctx.fillStyle = 'rgba(10,8,20,0.85)'; ctx.fill();
      ctx.strokeStyle = '#c8b285'; ctx.lineWidth = 2; ctx.stroke();
      if (img.complete && img.naturalWidth) {
        const s = Math.min(cw / img.naturalWidth, ch / img.naturalHeight);
        const dw = img.naturalWidth * s, dh = img.naturalHeight * s;
        ctx.save();
        this.rr(cardX, cardY, cw, ch, 8); ctx.clip();
        ctx.drawImage(img, cardX + (cw - dw) / 2, cardY + (ch - dh) / 2, dw, dh);
        ctx.restore();
      }
      // 形态切换按钮（只显示实际存在的形态）
      const forms: Array<'main' | 'h' | 'x'> = (['main', 'h', 'x'] as const).filter(f => formOf(rdef, f));
      const labels = { main: '主图', h: 'H', x: 'X' } as const;
      let fx = cardX;
      for (const f of forms) {
        const active = this.detailForm === f;
        this.pill(fx, cardY + ch + 12, 56, 26, active ? '#c8a040' : '#0d0a16', '#c8b285');
        this.text(labels[f], fx + 28, cardY + ch + 26, 13, active ? '#0a0a12' : '#e8d5a8', 'center', 'bold');
        this.buttons.push({ x: fx, y: cardY + ch + 12, w: 56, h: 26, id: `form:${f}` });
        fx += 64;
      }
    } else {
      drawCard(ctx, card, cardX, cardY, cw, ch, { isNew: false, rainbowT: (t * 0.3) % 1, showMeta: true });
    }

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
      ry += Math.ceil((card.skillDesc || '').length / 24) * 20 + 8;
    }

    // 引文（runtime catalog 卡；英文原版，direct）
    if (rdef?.quotesRef) {
      const q = quotesFor(rdef.quotesRef);
      if (q?.description) {
        ry = Math.min(ry, py + ph - 96);
        this.text('◆ 引文', px + 30, ry, 13, '#c8b285', 'left', 'bold');
        ry += 22;
        this.wrapText(q.description, px + 30, ry, pw - 60, 18, 12, '#a8b8c8');
      }
    }

    // 关闭按钮
    glassButton(ctx, px + pw / 2 - 80, py + ph + 16, 160, 46, '关 闭', { kind: 'blue', hover: this.hover === 'closeDetail', fontSize: 17 });
    this.buttons.push({ x: px + pw / 2 - 80, y: py + ph + 16, w: 160, h: 46, id: 'closeDetail' });
  }

  // ============ 全局 HUD：音乐 / 充值 ============
  private renderGlobalHud(): void {
    const ctx = this.ctx;
    const muted = audio.isMuted();
    const u = this.db.user;

    // ── 统一顶部资源条（所有页面共享，避免各页重复绘制造成叠加）──
    ctx.fillStyle = 'rgba(8,6,18,0.55)';
    ctx.fillRect(0, 0, W, 56);
    ctx.fillStyle = 'rgba(220,190,120,0.3)';
    ctx.fillRect(0, 55, W, 1);
    // 体力（行动力）
    this.pill(16, 12, 158, 32, '#0d0a16', '#6fce9a');
    this.text(`⚔ ${u.energy}/${u.energyMax}`, 95, 29, 13, '#8fe8a8', 'center', 'bold');
    // 金币 / 宝石 / 召唤券
    this.pill(186, 12, 168, 32, '#0d0a16', '#c8a040');
    this.text(`🪙 ${u.gold.toLocaleString()}`, 270, 29, 13, '#ffd24d', 'center', 'bold');
    this.pill(366, 12, 138, 32, '#0d0a16', '#b45cff');
    this.text(`💎 ${u.gems.toLocaleString()}`, 435, 29, 13, '#e0b0ff', 'center', 'bold');
    this.pill(516, 12, 108, 32, '#0d0a16', '#ff8c8c');
    this.text(`🎟 ${u.tickets.fate || 0}`, 570, 29, 13, '#ffb0b0', 'center', 'bold');

    // 右上角：音乐 | 充值
    const bw = 56, bh = 40, gap = 10;
    const x1 = W - 20 - bw * 2 - gap;
    const y = 12;
    glassButton(ctx, x1, y, bw, bh, muted ? '🔇' : '🔊', {
      kind: muted ? 'gray' : 'blue', hover: this.hover === 'toggleMusic', fontSize: 18,
    });
    glassButton(ctx, x1 + bw + gap, y, bw, bh, '❋', {
      kind: 'green', hover: this.hover === 'openRecharge', fontSize: 20,
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
      { id: 'inventory', label: '仓库', icon: '▦' },
      { id: 'shop', label: '商店', icon: '❋' },
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
    // 顶部标题（行动力由全局 HUD 统一显示）
    const regionLabel = this.activeStage.regionId === 'r2' ? '神界地图 3' : '神界地图 2';
    this.pill(W / 2 - 200, 64, 400, 44, '#0d0a16', '#c8b285');
    this.text(`${regionLabel} · ${this.activeStage.name}`, W / 2, 87, 18, '#ffe9a8', 'center', 'bold');
    this.pill(20, 64, 130, 36, '#0d0a16', '#c8b285');
    this.text('挑战次数 21/21', 85, 83, 12, '#e8d5a8', 'center', 'bold');

    // 节点（浮岛关卡）
    const nodes = this.mapNodes();
    for (const n of nodes) {
      const hov = !n.locked && this.hover === `node:${n.idx}`;
      // 翅膀/龙图标
      ctx.save();
      if (hov) { ctx.shadowColor = '#ffe14d'; ctx.shadowBlur = 16; }
      ctx.translate(n.x, n.y);
      const scale = n.done ? 0.9 : 1;
      ctx.scale(scale, scale);
      // 翅膀形
      ctx.fillStyle = n.locked ? '#3a3f4a' : n.done ? '#8a94a8' : '#c05ce8';
      ctx.strokeStyle = n.locked ? '#2a2e38' : n.done ? '#5a6478' : '#ffb3f0';
      ctx.lineWidth = 2;
      for (const dir of [-1, 1]) {
        ctx.beginPath();
        ctx.moveTo(0, 8);
        ctx.quadraticCurveTo(dir * 22, -14, dir * 30, 6);
        ctx.quadraticCurveTo(dir * 16, 2, dir * 6, 14);
        ctx.closePath(); ctx.fill(); ctx.stroke();
      }
      ctx.fillStyle = n.locked ? '#4a4f5a' : n.done ? '#aab' : '#fff';
      ctx.beginPath(); ctx.arc(0, 4, 7, 0, Math.PI * 2); ctx.fill(); ctx.stroke();
      ctx.restore();
      const ns = this.db.stages[n.idx];
      if (ns) this.text(ns.name, n.x, n.y + 32, 10, n.locked ? '#4a5060' : '#e8d5a8', 'center', 'bold');
      if (n.locked) this.text('🔒', n.x, n.y + 4, 14, '#8892a8', 'center');
      else if (n.newTag) {
        this.pill(n.x - 18, n.y - 34, 36, 16, '#d33', '#ffb3b3');
        this.text('NEW', n.x, n.y - 25, 10, '#fff', 'center', 'bold');
      }
      this.buttons.push({ x: n.x - 24, y: n.y - 24, w: 48, h: 48, id: `node:${n.idx}` });
    }
    // 世界地图切换
    glassButton(ctx, 30, H - 140, 150, 44, '« 换地图', { kind: 'gray', hover: this.hover === 'worldmap', fontSize: 15 });
    this.buttons.push({ x: 30, y: H - 140, w: 150, h: 44, id: 'worldmap' });
  }

  private mapNodes(): { x: number; y: number; done: boolean; newTag: boolean; locked: boolean; idx: number }[] {
    const coords: [number, number][] = [
      [180, 200], [320, 300], [480, 220], [660, 320], [840, 200], [1000, 300], [300, 480], [620, 520], [940, 480],
    ];
    return coords.map(([x, y], i) => {
      const s = this.db.stages[i];
      const unlocked = !!s && (i === 0 || this.db.stages[i - 1]?.firstClear === true);
      return {
        x, y, idx: i,
        done: s?.firstClear ?? false,
        newTag: !!s && unlocked && !s.firstClear,
        locked: !unlocked,
      };
    });
  }

  // ============ 出击界面（参考截图复刻：进度条+资源栏+进军/Auto+底部队伍）============
  private renderSortie(): void {
    const ctx = this.ctx;
    this.buttons = [];

    // 共用框架：进度条 / 行动力 / 资源栏 / 左侧竖排 / 菜单
    this.buttons.push(...drawExploreChrome(ctx, this.exploreChromeData(), this.hover));

    // 探索事件提示
    if (this.exploreMsg && this.exploreMsgT < 3) this.renderExploreToast();

    // 通关引导：回地图解锁下一关
    if (this.activeStage.progress >= 1) {
      this.pill(W / 2 - 210, 360, 420, 32, 'rgba(16,50,28,0.92)', '#a8f0c0');
      this.text('✅ 本关已通关！回地图挑战下一关', W / 2, 381, 14, '#a8f0c0', 'center', 'bold');
    }

    // 进军 / Auto（截图布局：左大绿按钮 + 右 Auto）
    const cost = 10;
    const busy = !!this.marchAnim;
    glassButton(ctx, EXPLORE.march.x, EXPLORE.march.y, EXPLORE.march.w, EXPLORE.march.h,
      busy ? '前进中…' : `进军（🔥-${cost}）`, {
        kind: busy ? 'gray' : 'green', hover: !busy && this.hover === 'march', fontSize: 26,
      });
    this.buttons.push({ ...EXPLORE.march, id: 'march' });
    glassButton(ctx, EXPLORE.auto.x, EXPLORE.auto.y, EXPLORE.auto.w, EXPLORE.auto.h, busy ? '…' : 'Auto', {
      kind: busy ? 'gray' : 'green', hover: !busy && this.hover === 'auto', fontSize: 24,
    });
    this.buttons.push({ ...EXPLORE.auto, id: 'auto' });

    // 底部 5 卡横排
    this.buttons.push(...drawTeamStripBottom(ctx, this.teamStripData(), this.hover, this.last / 1000));
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
    else if (r.event === 'loot') { msg = `拾取：金币+${r.lootGold}${r.lootGems ? ` 宝石+${r.lootGems}` : ''}${r.lootCardRarity ? ` ${r.lootCardRarity}卡` : ''}${r.lootPotion ? ` 强化药水×${r.lootPotion}` : ''}`; color = '#8fe8a8'; }
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

  private renderTeamStrip(baseY: number, clickable: boolean): void {
    const ctx = this.ctx;
    const team = this.teamCombatants();
    const cw = 150, ch = 212, gx = 16;
    const total = 5 * cw + 4 * gx;
    let x = (W - total) / 2;
    const m = this.marchAnim;
    const mp = m ? Math.min(1, m.t / m.dur) : 0;
    // 走路律动：两拍上下颠（|sin(2πp)|），整体随进军前移
    const bob = m ? Math.abs(Math.sin(mp * Math.PI * 2)) : 0;
    const xHop = m ? mp * 34 : 0;
    const yHop = -bob * 16;
    for (let i = 0; i < team.length; i++) {
      const slot = team[i];
      // 左右脚交替：相邻卡相位差半拍
      const alt = m ? Math.sin(mp * Math.PI * 2 + i * Math.PI) * 3 : 0;
      ctx.save();
      if (m) {
        ctx.translate(x + cw / 2 + xHop, baseY + ch / 2 + yHop);
        ctx.rotate(alt * 0.02);
        ctx.translate(-(x + cw / 2 + xHop), -(baseY + ch / 2 + yHop));
      }
      drawCard(ctx, slot.card, x + cw / 2 + xHop, baseY + ch / 2 + yHop, cw, ch,
        { showName: false, showBadge: true, rainbowT: (this.last / 1000 * 0.3) % 1 });
      ctx.restore();
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
  /** 商店购买（本地模拟充值：直接加宝石/月卡，无真实支付） */
  private shopBuy(id: string): void {
    const u = this.db.user;
    if (id === 'monthCard') {
      const now = Date.now();
      const base = u.monthCardUntil > now ? u.monthCardUntil : now;
      u.monthCardUntil = base + 30 * 86400000;
      u.gems += 300; // 立即到账
      this.monthCardClaim(true); // 若当日未领，立即补发今日
      this.flashTeamMsg('月卡已续期 30 天，宝石 +300');
      saveDB(this.db);
      return;
    }
    if (id === 'claimDaily') {
      this.monthCardClaim(false);
      return;
    }
    const tiers: Record<string, number> = {
      gem60: 60, gem300: 300, gem980: 980, gem1980: 1980, gem3280: 3280, gem6480: 6480,
    };
    if (tiers[id] !== undefined) {
      // 首充双倍：按档位判定，每档各享一次
      const bonus = (u.paidTiers[id] ?? 0) === 0 ? tiers[id] : 0;
      u.gems += tiers[id] + bonus;
      u.paidGems += tiers[id];
      u.paidTiers[id] = (u.paidTiers[id] ?? 0) + 1;
      this.jewels = u.gems;
      this.flashTeamMsg(bonus ? `首充双倍！宝石 +${tiers[id] * 2}` : `宝石 +${tiers[id]}`);
      saveDB(this.db);
      return;
    }
    if (id === 'restore') {
      u.energy = u.energyMax;
      u.battlePt = u.battlePtMax;
      this.flashTeamMsg('回复药水已使用：体力与战斗体力已回满');
      saveDB(this.db);
      return;
    }
    this.flashTeamMsg('购买失败，请重试');
  }

  /** 月卡每日领取：当日未领则发宝石并标记。silent=true 时（如购买月卡）只补发不弹说明 */
  private monthCardClaim(showMsg: boolean): void {
    const u = this.db.user;
    const today = new Date().toISOString().slice(0, 10);
    if (u.monthCardUntil <= Date.now()) { this.flashTeamMsg('月卡已过期，请先续费'); return; }
    if (u.monthCardLastClaim === today) { this.flashTeamMsg('今日月卡宝石已领取'); return; }
    u.gems += 20;
    this.jewels = u.gems;
    u.monthCardLastClaim = today;
    saveDB(this.db);
    if (showMsg !== false) this.flashTeamMsg('月卡每日俸禄：宝石 +20');
  }

  private activateInv(id: string): void {
    const inv = this.db.inventory;
    // 筛选 / 排序（复用 team 的 invFilter / invScroll，避免两套状态）
    if (id.startsWith('invf:')) { this.invFilter = id.slice(5); this.invScroll = 0; return; }
    if (id.startsWith('invs:')) { this.invSort = id.slice(5); this.invScroll = 0; return; }
    // 合卡入口（无主卡进入合成页）
    if (id === 'openEvolve') { this.openEvolvePage(null); return; }
    if (id === 'invpUp' || id === 'invpDown') return; // ▲▼ 按钮已移除，保留空分支防呆
    // 批量出售模式开关
    if (id === 'invSellMode') { this.invSelling = !this.invSelling; this.invSel.clear(); return; }
    // 卡点选
    if (id.startsWith('invpc:')) {
      const instId = id.slice(6);
      if (this.invSelling) {
        if (this.invSel.has(instId)) this.invSel.delete(instId); else this.invSel.add(instId);
        return;
      }
      this.detailInst = instId;
      this.detailForm = 'main';
      return;
    }
    // 批量出售确认
    if (id === 'invSell') {
      if (this.invSel.size === 0) { this.flashTeamMsg('请先勾选要出售的卡'); return; }
      let gain = 0, n = 0;
      this.db.inventory.cards = this.db.inventory.cards.filter(o => {
        if (!this.invSel.has(o.instId) || o.locked) return true;
        const c = getCard(o.cardId);
        gain += c ? RANK[c.rarity] * 500 : 100;
        n++;
        return false;
      });
      this.teamInstIds = this.teamInstIds.filter(t => this.db.inventory.cards.some(c => c.instId === t));
      this.db.user.gold += gain;
      this.flashTeamMsg(`批量出售 ${n} 张，金币 +${gain.toLocaleString()}`);
      this.invSel.clear(); this.invSelling = false;
      this.saveTeam(); saveDB(this.db);
      return;
    }
    // 详情内按钮
    if (id.startsWith('form:')) { this.detailForm = id.slice(5) as 'main' | 'h' | 'x'; return; }
    if (id === 'closeInvDetail') { this.detailInst = null; this.detailEquipOpen = false; return; }
    if (id === 'closeDetail') { this.detailInst = null; this.detailEquipOpen = false; return; }
    if (id === 'equipOpen') { this.detailEquipOpen = !this.detailEquipOpen; return; }
    if (id === 'equipClose') { this.detailEquipOpen = false; return; }
    if (id === 'equipRemove') {
      if (this.detailInst) { unequipCard(this.db, this.detailInst); this.flashTeamMsg('已卸下装备'); saveDB(this.db); }
      return;
    }
    if (id.startsWith('equipPick:')) {
      const eid = id.slice(10);
      if (this.detailInst) {
        const def = equipCard(this.db, this.detailInst, eid);
        if (def) this.flashTeamMsg(`已装备：${def.name}（${def.desc}）`);
      }
      this.detailEquipOpen = false;
      saveDB(this.db);
      return;
    }
    if (id === 'quickEnhance') { this.doQuickEnhance(); return; }
    if (id === 'quickEvolve') { this.doQuickEvolve(); return; }
    if (id === 'lockCard') {
      const o = this.db.inventory.cards.find(c => c.instId === this.detailInst);
      if (o) { o.locked = !o.locked; this.flashTeamMsg(o.locked ? '已锁定' : '已解锁'); saveDB(this.db); }
      return;
    }
    if (id === 'sellCard' && this.detailInst) {
      const o = inv.cards.find(c => c.instId === this.detailInst);
      if (!o) return;
      const c = getCard(o.cardId);
      const gain = c ? RANK[c.rarity] * 500 : 100;
      this.db.user.gold += gain;
      inv.cards = inv.cards.filter(x => x.instId !== this.detailInst);
      this.teamInstIds = this.teamInstIds.map(t => t === this.detailInst ? (inv.cards[0]?.instId ?? t) : t);
      this.flashTeamMsg(`已出售，金币 +${gain}`);
      this.detailInst = null; this.saveTeam(); saveDB(this.db);
      return;
    }
    if (id === 'invToTeam') {
      if (!this.detailInst) return;
      if (this.teamInstIds.includes(this.detailInst)) { this.flashTeamMsg('这张卡已在队伍中'); return; }
      this.teamInstIds.push(this.detailInst);
      this.flashTeamMsg('已上阵');
      this.saveTeam();
      return;
    }
  }

  private activateTeam(id: string): void {
    const inv = this.db.inventory;
    // 关闭详情
    if (id.startsWith('form:')) { this.detailForm = id.slice(5) as 'main' | 'h' | 'x'; return; }
    if (id === 'closeTeamDetail') { this.detailInst = null; this.detailEquipOpen = false; this.enhanceMode = false; this.enhancePicks.clear(); return; }
    // 筛选
    if (id.startsWith('filter:')) { this.invFilter = id.slice(7); this.invScroll = 0; return; }
    // 滚动（▲▼ 按钮已移除，滚轮/滚动条接管）
    if (id === 'invUp' || id === 'invDown') return;
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
      // 编队：若选中了出击槽，把这张卡换上
      if (this.teamSelSlot >= 0) {
        this.teamInstIds[this.teamSelSlot] = instId;
        const c = inv.cards.find(x => x.instId === instId);
        if (c) { const card = getCard(c.cardId); if (card) preloadImage(card).catch(() => {}); }
        this.flashTeamMsg(`已上阵到位置 ${this.teamSelSlot + 1}`);
        this.teamSelSlot = -1;
        this.saveTeam();
        return;
      }
      // 默认：打开详情
      this.detailInst = instId;
      this.enhanceMode = false; this.enhancePicks.clear();
      return;
    }
    // 详情弹层按钮：强化 → 关闭详情进入选择模式（主卡记在 detailInstKeep）
    if (id === 'equipOpen') { this.detailEquipOpen = !this.detailEquipOpen; return; }
    if (id === 'equipClose') { this.detailEquipOpen = false; return; }
    if (id === 'equipRemove') {
      if (this.detailInst) { unequipCard(this.db, this.detailInst); this.flashTeamMsg('已卸下装备'); saveDB(this.db); }
      return;
    }
    if (id.startsWith('equipPick:')) {
      const eid = id.slice(10);
      if (this.detailInst) {
        const def = equipCard(this.db, this.detailInst, eid);
        if (def) this.flashTeamMsg(`已装备：${def.name}（${def.desc}）`);
      }
      this.detailEquipOpen = false;
      saveDB(this.db);
      return;
    }
    if (id === 'enhanceStart') { this.enhanceMode = true; this.enhancePicks.clear(); this.detailInstKeep = this.detailInst; this.detailInst = null; this.page = 'team'; return; }
    if (id === 'enhanceGo') {
      const target = this.detailInstKeep;
      if (!target || this.enhancePicks.size === 0) { this.flashTeamMsg('请先点选狗粮卡'); return; }
      const r = EnhanceCard(this.db, target, [...this.enhancePicks]);
      if (r.ok) { this.flashTeamMsg(`强化成功！Lv.${r.lvBefore} → Lv.${r.lvAfter}（金币-${r.goldSpent}）`); }
      else this.flashTeamMsg(r.reason || '强化失败');
      saveDB(this.db);
      this.enhancePicks.clear(); this.enhanceMode = false;
      this.detailInst = target; this.detailInstKeep = null; // 回到主卡详情
      return;
    }
    if (id === 'enhancePotion') {
      const target = this.detailInstKeep;
      if (!target) { this.flashTeamMsg('请先选择目标卡'); return; }
      const r = UseEnhancePotion(this.db, target);
      if (r.ok) { this.flashTeamMsg(`药水强化成功！Lv.${r.lvBefore} → Lv.${r.lvAfter}（金币-${r.goldSpent}）`); }
      else this.flashTeamMsg(r.reason || '使用失败');
      saveDB(this.db);
      return;
    }
    if (id === 'evolveStart') { if (this.detailInst) this.openEvolvePage(this.detailInst); return; }
    // 一键强化/升星（仓库/队伍共用，详情内直接完成）
    if (id === 'quickEnhance') { this.doQuickEnhance(); return; }
    if (id === 'quickEvolve') { this.doQuickEvolve(); return; }
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
      this.saveTeam();
      saveDB(this.db);
      return;
    }
    if (id === 'lockCard') {
      const o = this.db.inventory.cards.find(c => c.instId === this.detailInst);
      if (o) { o.locked = !o.locked; this.flashTeamMsg(o.locked ? '已锁定' : '已解锁'); saveDB(this.db); }
      return;
    }
  }

  private flashTeamMsg(msg: string): void { this.teamMsg = msg; this.teamMsgT = 0; }

  /** 一键强化：自动喂狗粮（未锁定 N→R，最多 6 张），仓库/队伍详情内直接完成 */
  private doQuickEnhance(): void {
    const target = this.detailInst;
    if (!target) return;
    const fodder = autoFodder(this.db, target, new Set(this.teamInstIds));
    if (!fodder.length) { this.flashTeamMsg('没有可用狗粮（需未锁定的 N/R 卡）'); return; }
    const r = EnhanceCard(this.db, target, fodder);
    if (r.ok) this.flashTeamMsg(`强化成功！喂 ${fodder.length} 张狗粮，Lv.${r.lvBefore} → Lv.${r.lvAfter}（金币-${r.goldSpent}）`);
    else this.flashTeamMsg(r.reason || '强化失败');
    saveDB(this.db);
  }

  /** 一键升星 → 进入升星合成页（预选最优素材） */
  private doQuickEvolve(): void {
    const target = this.detailInst;
    if (!target) return;
    this.openEvolvePage(target);
  }

  /** 进入升星合成页：target 为 null 时先选主卡；有同名素材优先（同星>高等级），否则切同稀有度×2 */
  private openEvolvePage(target: string | null): void {
    this.evolveFrom = this.page === 'team' ? 'team' : 'inventory';
    this.detailInst = null; this.detailInstKeep = null;
    this.evolveMatSel = null; this.evolveMatPair = [];
    this.evolveBoosters = []; this.evolveBoostOpen = false;
    this.evolveTarget = null;
    if (target) {
      this.evolveTarget = target;
      this.preselectEvolveMats();
    }
    this.page = 'evolve';
    this.syncBgm();
  }

  /** 预选素材：同名（同星优先）→ 同稀有度×2 */
  private preselectEvolveMats(): void {
    const t = this.db.inventory.cards.find(o => o.instId === this.evolveTarget);
    const same = t ? this.sameCardCandidates(t) : [];
    if (same.length) {
      this.evolveTab = 'same';
      this.evolveMatSel = same[0].instId;
    } else {
      this.evolveTab = 'rarity';
      this.evolveMatPair = (t ? this.rarityCandidates(t) : []).slice(0, 2).map(o => o.instId);
    }
  }

  /** 同名素材候选：未锁定、星级差≤1；同星优先、等级高优先 */
  private sameCardCandidates(t: OwnedCard): OwnedCard[] {
    return this.db.inventory.cards
      .filter(o => o.instId !== t.instId && o.cardId === t.cardId && !o.locked && evolveRate(t.evoStage, o.evoStage) !== null)
      .sort((x, y) => (x.evoStage === t.evoStage ? 0 : 1) - (y.evoStage === t.evoStage ? 0 : 1) || y.lv - x.lv);
  }

  /** 同稀有度素材候选：未锁定、非自身；等级高优先 */
  private rarityCandidates(t: OwnedCard): OwnedCard[] {
    const rar = getCard(t.cardId)?.rarity;
    if (!rar) return [];
    return this.db.inventory.cards
      .filter(o => o.instId !== t.instId && !o.locked && getCard(o.cardId)?.rarity === rar)
      .sort((x, y) => y.lv - x.lv);
  }

  private activateEvolve(id: string): void {
    if (id === 'evoBack') {
      this.page = this.evolveFrom;
      this.evolveTarget = null; this.evolveMatSel = null; this.evolveMatPair = [];
      this.evolveBoosters = []; this.evolveBoostOpen = false;
      this.syncBgm();
      return;
    }
    if (id === 'evoTgtClear') { this.evolveTarget = null; this.evolveMatSel = null; this.evolveMatPair = []; this.evolveBoosters = []; this.evolveBoostOpen = false; return; }
    if (id === 'evoBoostToggle') { this.evolveBoostOpen = !this.evolveBoostOpen; return; }
    if (id === 'evoBoostClose') { this.evolveBoostOpen = false; return; }
    if (id.startsWith('evoBoost:')) {
      const instId = id.slice(9);
      if (this.evolveBoosters.includes(instId)) {
        this.evolveBoosters = this.evolveBoosters.filter(x => x !== instId);
      } else if (this.evolveBoosters.length < 3) {
        this.evolveBoosters.push(instId);
      } else {
        this.flashTeamMsg('最多选择 3 张加成卡');
      }
      return;
    }
    if (id.startsWith('evoTgt:')) {
      this.evolveTarget = id.slice(7);
      this.evolveMatSel = null; this.evolveMatPair = [];
      this.evolveBoosters = []; this.evolveBoostOpen = false;
      this.preselectEvolveMats();
      return;
    }
    if (id === 'evoTab:same' || id === 'evoTab:rarity') {
      this.evolveTab = id === 'evoTab:same' ? 'same' : 'rarity';
      return;
    }
    if (id.startsWith('evoMat:')) {
      const instId = id.slice(7);
      if (this.evolveTab === 'same') {
        this.evolveMatSel = this.evolveMatSel === instId ? null : instId;
      } else if (this.evolveMatPair.includes(instId)) {
        this.evolveMatPair = this.evolveMatPair.filter(x => x !== instId);
      } else {
        this.evolveMatPair.push(instId);
        if (this.evolveMatPair.length > 2) this.evolveMatPair.shift();
      }
      return;
    }
    if (id === 'evoGo') {
      const target = this.evolveTarget;
      const mats = this.evolveTab === 'same' ? (this.evolveMatSel ? [this.evolveMatSel] : []) : this.evolveMatPair;
      if (!target || !mats.length) {
        this.flashTeamMsg(this.evolveTab === 'same' ? '请先选择一张同名素材卡' : '请先选择两张同稀有度素材卡');
        return;
      }
      const boosters = this.evolveBoosters;
      const prep = prepareEvolve(this.db, target, mats, undefined, undefined, boosters);
      if (!prep.ok) { this.flashTeamMsg(prep.reason || '无法合成'); return; }
      const t = this.db.inventory.cards.find(o => o.instId === target);
      const tgtCard = t ? getCard(t.cardId) : null;
      if (!t || !tgtCard) return;
      const matObjs = mats
        .map(mid => this.db.inventory.cards.find(o => o.instId === mid))
        .filter((o): o is OwnedCard => !!o)
        .map(o => ({ instId: o.instId, card: getCard(o.cardId)!, star: o.evoStage }));
      this.evolveAnim = { targetInst: target, mats: matObjs, boosterIds: boosters, t: 0, prep, applied: false, tgtCard, tgtStar: t.evoStage };
      audio.playSe('skill');
      return;
    }
  }

  /** 可升星提示：同名素材×1（星级差≤1）或同稀有度素材×2 可合成的 instId 集合（网格 badge/排序用） */
  private evolvableInsts(): Set<string> {
    const stagesByCard = new Map<string, number[]>();
    const countByRarity = new Map<string, number>();
    for (const o of this.db.inventory.cards) {
      if (o.locked) continue;
      const arr = stagesByCard.get(o.cardId); if (arr) arr.push(o.evoStage); else stagesByCard.set(o.cardId, [o.evoStage]);
      const r = getCard(o.cardId)?.rarity;
      if (r) countByRarity.set(r, (countByRarity.get(r) ?? 0) + 1);
    }
    const res = new Set<string>();
    for (const o of this.db.inventory.cards) {
      if (o.evoStage >= MAX_STAR) continue;
      const card = getCard(o.cardId); if (!card) continue;
      // 同名：排除自身（未锁定时自身占一个同星名额）后存在星级差≤1 的素材
      let skippedSelf = o.locked;
      const same = (stagesByCard.get(o.cardId) ?? []).some(s => {
        if (!skippedSelf && s === o.evoStage) { skippedSelf = true; return false; }
        return evolveRate(o.evoStage, s) !== null;
      });
      // 同稀有度：排除自身（未锁定时）后还有 ≥2 张
      const pair = (countByRarity.get(card.rarity) ?? 0) - (!o.locked ? 1 : 0) >= 2;
      if (same || pair) res.add(o.instId);
    }
    return res;
  }

  // ============ 升星合成页 ============
  private renderEvolvePage(): void {
    const ctx = this.ctx;
    this.buttons = [];
    ctx.fillStyle = 'rgba(8,6,18,0.72)';
    ctx.fillRect(0, 0, W, H);
    this.text('升 星 合 成', 60, 84, 28, '#f5e0a0', 'left', 'bold', true);
    glassButton(ctx, W - 180, 58, 124, 42, '返回', { kind: 'gray', hover: this.hover === 'evoBack', fontSize: 16 });
    this.buttons.push({ x: W - 180, y: 58, w: 124, h: 42, id: 'evoBack' });

    const t = this.evolveTarget ? this.db.inventory.cards.find(o => o.instId === this.evolveTarget) : null;
    const tc = t ? getCard(t.cardId) : null;
    if (!t || !tc) {
      // 主卡选择模式：列出所有可升星的卡
      this.text('选择要升星的主卡', W / 2, 120, 20, '#f5e0a0', 'center', 'bold', true);
      this.text('同名卡×1 或 同稀有度卡×2 可作为素材', W / 2, 148, 13, '#8892a8', 'center');
      const evoSet = this.evolvableInsts();
      const cands = this.db.inventory.cards
        .filter(o => evoSet.has(o.instId))
        .sort((a, b) => (RANK[getCard(b.cardId)?.rarity ?? 'N'] - RANK[getCard(a.cardId)?.rarity ?? 'N']) || b.evoStage - a.evoStage || b.lv - a.lv);
      if (!cands.length) {
        this.text('当前没有可升星的卡（需要同名卡×1 或同稀有度卡×2）', W / 2, 320, 15, '#8892a8', 'center', 'bold');
        return;
      }
      const cols = 10, cw0 = 106, ch0 = 146, gx = 10, gy = 12;
      cands.slice(0, cols * 3).forEach((o, i) => {
        const oc = getCard(o.cardId); if (!oc) return;
        const cx = 64 + (i % cols) * (cw0 + gx) + cw0 / 2;
        const cy0 = 250 + Math.floor(i / cols) * (ch0 + gy) + ch0 / 2;
        drawCard(ctx, oc, cx, cy0, cw0, ch0, { showName: false, rainbowT: (this.last / 1000 * 0.3) % 1 });
        this.drawCardAura(cx, cy0, cw0, ch0, o.evoStage);
        this.drawLvStars(cx, cy0 + ch0 / 2 - 8, o.lv, o.evoStage);
        this.buttons.push({ x: cx - cw0 / 2, y: cy0 - ch0 / 2, w: cw0, h: ch0, id: `evoTgt:${o.instId}` });
      });
      return;
    }

    // 模式页签：同名×1 / 同稀有度×2
    const tabs: [string, string][] = [['same', '同名卡 ×1'], ['rarity', `同稀有度 ×2（${tc.rarity}）`]];
    let tx = W / 2 - 240;
    for (const [k, label] of tabs) {
      const act = this.evolveTab === k;
      glassButton(ctx, tx, 110, 230, 38, label, { kind: act ? 'blue' : 'gray', hover: this.hover === `evoTab:${k}`, fontSize: 15 });
      this.buttons.push({ x: tx, y: 110, w: 230, h: 38, id: `evoTab:${k}` });
      tx += 250;
    }

    // 素材选择
    const matIds = this.evolveTab === 'same' ? (this.evolveMatSel ? [this.evolveMatSel] : []) : this.evolveMatPair;
    const mats = matIds.map(mid => this.db.inventory.cards.find(o => o.instId === mid)).filter((o): o is OwnedCard => !!o);
    const rate = this.evolveTab === 'same'
      ? (mats[0] ? evolveRate(t.evoStage, mats[0].evoStage) : null)
      : (mats.length === 2 ? evolveRate(t.evoStage, t.evoStage) : null);
    const needMats = this.evolveTab === 'same' ? 1 : 2;

    // 舞台：主卡 + 素材槽
    const cy = 310, cw = 180, ch = 254;
    const slotX = this.evolveTab === 'same' ? [W / 2 - 190, W / 2 + 190] : [W / 2 - 320, W / 2, W / 2 + 320];
    drawCard(ctx, tc, slotX[0], cy, cw, ch, { showName: true, rainbowT: (this.last / 1000 * 0.3) % 1 });
    this.drawCardAura(slotX[0], cy, cw, ch, t.evoStage);
    this.buttons.push({ x: slotX[0] - cw / 2, y: cy - ch / 2, w: cw, h: ch, id: 'evoTgtClear' });
    this.text(`主卡 Lv.${t.lv} ${'★'.repeat(t.evoStage) || '无星'}（点击可更换）`, slotX[0], cy + ch / 2 + 22, 13, '#ffe9a8', 'center', 'bold');
    for (let i = 0; i < needMats; i++) {
      const sx = slotX[i + 1];
      const m = mats[i];
      const mc = m ? getCard(m.cardId) : null;
      if (m && mc) {
        drawCard(ctx, mc, sx, cy, cw, ch, { showName: true });
        this.drawCardAura(sx, cy, cw, ch, m.evoStage);
        const inTeam = this.teamInstIds.includes(m.instId);
        this.text(`素材 Lv.${m.lv} ${'★'.repeat(m.evoStage) || '无星'}${inTeam ? '（出撃中，合成后下阵）' : ''}`, sx, cy + ch / 2 + 22, 13, '#cfc4a8', 'center', 'bold');
      } else {
        this.rr(sx - cw / 2, cy - ch / 2, cw, ch, 10);
        ctx.fillStyle = 'rgba(20,16,32,0.8)'; ctx.fill();
        ctx.setLineDash([7, 6]); ctx.strokeStyle = '#5a5470'; ctx.lineWidth = 2;
        this.rr(sx - cw / 2, cy - ch / 2, cw, ch, 10); ctx.stroke();
        ctx.setLineDash([]);
        this.text('从下方选择素材卡', sx, cy, 14, '#8892a8', 'center', 'bold');
      }
    }

    // 加成卡（右侧成功率提升）& 失败补偿
    const boostCands = t ? this.db.inventory.cards.filter(o =>
      o.instId !== t.instId && !o.locked && !matIds.includes(o.instId)
      && !this.evolveBoosters.includes(o.instId)
      && evolveBoostRate(tc.rarity, getCard(o.cardId)?.rarity ?? 'N') > 0
    ).sort((x, y) => evolveBoostRate(tc.rarity, getCard(y.cardId)?.rarity ?? 'N') - evolveBoostRate(tc.rarity, getCard(x.cardId)?.rarity ?? 'N')) : [];
    const selBoosts = this.evolveBoosters.map(id => this.db.inventory.cards.find(o => o.instId === id)).filter((o): o is OwnedCard => !!o);
    const boostTotal = selBoosts.reduce((s, o) => s + evolveBoostRate(tc.rarity, getCard(o.cardId)?.rarity ?? 'N'), 0);
    const failStack = t?.evoFailStacks ?? 0;
    const bonusTotal = Math.min(3, failStack) * 30;

    // 成功率 / 结果预览 / 合成按钮
    if (rate !== null) {
      const finalRate = Math.min(100, rate + boostTotal + bonusTotal);
      const col = finalRate >= 80 ? '#6fce9a' : finalRate >= 50 ? '#ffd24d' : '#ff8c6a';
      this.text(`成功率 ${rate}%${boostTotal ? ` +${boostTotal}%加成卡` : ''}${bonusTotal ? ` +${bonusTotal}%补偿` : ''} = ${finalRate}%`, W / 2, 486, 22, col, 'center', 'bold', true);
      this.text(`→ ${'★'.repeat(Math.max(t.evoStage, ...(this.evolveTab === 'same' && mats[0] ? [mats[0].evoStage] : [])) + 1)}`, W / 2, 514, 18, '#ffe14d', 'center', 'bold');
      this.text(failStack > 0 ? `连续失败 ${failStack} 次（下次再失败 +30% 补偿，上限 +90%）` : '失败：素材损毁，主卡按保底降星（5★/7★ 不降）', W / 2, 538, 12, '#ff9c9c', 'center');
    } else {
      this.text(this.evolveTab === 'same'
        ? (mats[0] ? '星级差超过 1 不能合成' : '选择 1 张同名卡作为素材')
        : (mats.length ? `再选 ${2 - mats.length} 张 ${tc.rarity} 卡作为素材` : `选择 2 张 ${tc.rarity} 卡作为素材`),
        W / 2, 496, 15, '#8892a8', 'center', 'bold');
    }
    const can = rate !== null && !this.evolveAnim;
    glassButton(ctx, W / 2 - 140, 556, 280, 52, can ? `合成升星（${Math.min(100, rate + boostTotal + bonusTotal)}%）` : '合成升星', { kind: can ? 'green' : 'gray', hover: can && this.hover === 'evoGo', fontSize: 20 });
    if (can) this.buttons.push({ x: W / 2 - 140, y: 556, w: 280, h: 52, id: 'evoGo' });
    const boostBtnLabel = this.evolveBoosters.length ? `＋加成卡（${this.evolveBoosters.length}/3 · +${boostTotal}%）` : '＋加成卡';
    glassButton(ctx, W / 2 + 158, 556, 150, 52, boostBtnLabel, { kind: this.evolveBoosters.length ? 'green' : 'blue', hover: this.hover === 'evoBoostToggle', fontSize: 15 });
    this.buttons.push({ x: W / 2 + 158, y: 556, w: 150, h: 52, id: 'evoBoostToggle' });

    // 加成卡弹层（覆盖素材条上方区域）
    if (this.evolveBoostOpen) {
      this.rr(60, 560, W - 120, 175, 14);
      ctx.fillStyle = 'rgba(14,10,26,0.94)'; ctx.fill();
      ctx.strokeStyle = '#8b7ff0'; ctx.lineWidth = 2;
      this.rr(60, 560, W - 120, 175, 14); ctx.stroke();
      this.text(`加成卡（提升成功率：同级 +10 / 高1级 +15 / 高2级 +30 / 高3级 +60 / 高4级以上 +100）`, 80, 584, 13, '#b9a8ff', 'left', 'bold');
      this.text(`已选 ${this.evolveBoosters.length}/3　合计 +${boostTotal}%`, W - 80, 584, 13, '#ffe14d', 'right', 'bold');
      glassButton(ctx, W - 180, 594, 120, 30, '关闭', { kind: 'gray', hover: this.hover === 'evoBoostClose', fontSize: 14 });
      this.buttons.push({ x: W - 180, y: 594, w: 120, h: 30, id: 'evoBoostClose' });
      const bw = 66, bh = 92, by = 638;
      boostCands.slice(0, 14).forEach((o, i) => {
        const oc = getCard(o.cardId); if (!oc) return;
        const cx = 80 + i * (bw + 8) + bw / 2;
        const sel = this.evolveBoosters.includes(o.instId);
        ctx.save();
        if (sel) { ctx.shadowColor = '#ffe14d'; ctx.shadowBlur = 14; }
        drawCard(ctx, oc, cx, by, bw, bh, { showName: false });
        ctx.restore();
        if (sel) { ctx.strokeStyle = '#ffe14d'; ctx.lineWidth = 3; this.rr(cx - bw / 2, by - bh / 2, bw, bh, 7); ctx.stroke(); }
        const bt = evolveBoostRate(tc.rarity, oc.rarity);
        this.text(`+${bt}%`, cx, by + bh / 2 - 10, 10, '#8bffb0', 'center', 'bold');
        this.text(`${'★'.repeat(o.evoStage) || '0星'}`, cx, by + bh / 2 + 2, 9, '#ffe9a8', 'center', 'bold');
        this.buttons.push({ x: cx - bw / 2, y: by - bh / 2, w: bw, h: bh, id: `evoBoost:${o.instId}` });
      });
      if (!boostCands.length) {
        this.text('没有可用的加成卡（需要稀有度不低于主卡的未锁定卡）', 80, 660, 13, '#8892a8', 'left');
      }
    }

    // 候选素材条
    const cands = this.evolveTab === 'same' ? this.sameCardCandidates(t) : this.rarityCandidates(t);
    this.text(`可用素材（${cands.length}）`, 60, 630, 14, '#cfc4a8', 'left', 'bold');
    if (!cands.length) {
      this.text(this.evolveTab === 'same' ? '没有同名卡。可切换到「同稀有度 ×2」模式。' : `没有足够的 ${tc.rarity} 卡（需 2 张未锁定）。`, 60, 656, 13, '#8892a8', 'left');
    }
    const ccw = 84, cch = 118, ccy = 700;
    cands.slice(0, 13).forEach((o, i) => {
      const oc = getCard(o.cardId); if (!oc) return;
      const cx = 60 + i * (ccw + 10) + ccw / 2;
      const sel = matIds.includes(o.instId);
      ctx.save();
      if (sel) { ctx.shadowColor = '#ffe14d'; ctx.shadowBlur = 16; }
      drawCard(ctx, oc, cx, ccy, ccw, cch, { showName: false });
      ctx.restore();
      if (sel) { ctx.strokeStyle = '#ffe14d'; ctx.lineWidth = 3; this.rr(cx - ccw / 2, ccy - cch / 2, ccw, cch, 8); ctx.stroke(); }
      ctx.save();
      ctx.shadowColor = '#000'; ctx.shadowBlur = 4;
      this.text(`${'★'.repeat(o.evoStage) || '0星'} Lv.${o.lv}`, cx, ccy + cch / 2 - 8, 10, '#ffe9a8', 'center', 'bold');
      ctx.restore();
      this.buttons.push({ x: cx - ccw / 2, y: ccy - cch / 2, w: ccw, h: cch, id: `evoMat:${o.instId}` });
    });

    if (this.teamMsg && this.teamMsgT < 2.5) this.renderToast();
  }

  /** 星级视觉档：<3 默认 / 3-4 铜色发光 / 5-6 银色+白晕 / 7-9 金色+金晕 / 10 钻石+七彩晕 */
  private starStyle(star: number): { color: string; halo: string | null; rainbow: boolean; glyph: string } {
    if (star >= 10) return { color: '#bff3ff', halo: null, rainbow: true, glyph: '◆' };
    if (star >= 7) return { color: '#ffd24d', halo: '#ffdf80', rainbow: false, glyph: '★' };
    if (star >= 5) return { color: '#eef2fa', halo: '#ffffff', rainbow: false, glyph: '★' };
    if (star >= 3) return { color: '#e0a060', halo: '#c8803c', rainbow: false, glyph: '★' };
    return { color: '#ffe9a8', halo: null, rainbow: false, glyph: '★' };
  }

  /** 卡牌星级光晕（5 星起，drawCard 之后调用）；10 星七彩流动描边 */
  private drawCardAura(cx: number, cy: number, w: number, h: number, star: number): void {
    if (star < 5) return;
    const s = this.starStyle(star);
    const ctx = this.ctx;
    ctx.save();
    if (s.rainbow) {
      const hue0 = (this.last / 6) % 360;
      const g = ctx.createLinearGradient(cx - w / 2, cy - h / 2, cx + w / 2, cy + h / 2);
      for (let i = 0; i <= 6; i++) g.addColorStop(i / 6, `hsla(${(hue0 + i * 60) % 360},100%,68%,0.9)`);
      ctx.strokeStyle = g; ctx.lineWidth = 5;
      ctx.shadowColor = `hsla(${hue0},100%,70%,0.9)`; ctx.shadowBlur = 24;
      this.rr(cx - w / 2 - 4, cy - h / 2 - 4, w + 8, h + 8, 12); ctx.stroke();
    } else if (s.halo) {
      ctx.strokeStyle = s.color; ctx.lineWidth = star >= 7 ? 4 : 2.5;
      ctx.shadowColor = s.halo; ctx.shadowBlur = star >= 7 ? 22 : 14;
      ctx.globalAlpha = 0.9;
      this.rr(cx - w / 2 - 3, cy - h / 2 - 3, w + 6, h + 6, 11); ctx.stroke();
    }
    ctx.restore();
  }

  /** 详情弹窗边框：3 星起按星级呼吸发光（铜/银/金/七彩）；普通卡无边框光 */
  private drawDialogAura(x: number, y: number, w: number, h: number, star: number): void {
    if (star < 3) return;
    const s = this.starStyle(star);
    const ctx = this.ctx;
    const breathe = 0.55 + 0.45 * Math.sin(this.last / 350);
    ctx.save();
    if (s.rainbow) {
      const hue0 = (this.last / 5) % 360;
      const g = ctx.createLinearGradient(x, y, x + w, y + h);
      for (let i = 0; i <= 6; i++) g.addColorStop(i / 6, `hsla(${(hue0 + i * 60) % 360},100%,70%,${(0.5 + breathe * 0.5).toFixed(3)})`);
      ctx.strokeStyle = g; ctx.lineWidth = 4;
      ctx.shadowColor = `hsla(${hue0},100%,72%,0.95)`; ctx.shadowBlur = 18 + breathe * 22;
      this.rr(x - 3, y - 3, w + 6, h + 6, 14); ctx.stroke();
    } else if (s.halo) {
      ctx.strokeStyle = s.color; ctx.lineWidth = 3;
      ctx.globalAlpha = 0.5 + breathe * 0.5;
      ctx.shadowColor = s.halo; ctx.shadowBlur = 10 + breathe * 18;
      this.rr(x - 3, y - 3, w + 6, h + 6, 14); ctx.stroke();
    }
    ctx.restore();
  }

  /** Lv + 星级文字（按星级着色发光；10 星显示 ◆ 钻） */
  private drawLvStars(cx: number, y: number, lv: number, star: number, fontSize = 10): void {
    const s = this.starStyle(star);
    const label = `Lv.${lv}${star > 0 ? ' ' + s.glyph.repeat(star) : ''}`;
    const ctx = this.ctx;
    ctx.save();
    if (star >= 3) {
      ctx.shadowColor = s.rainbow ? `hsla(${(this.last / 6) % 360},100%,70%,0.95)` : s.halo!;
      ctx.shadowBlur = 10;
    }
    this.text(label, cx, y, fontSize, star > 0 ? s.color : '#ffe9a8', 'center', 'bold');
    ctx.restore();
  }

  /** 升星成功演出分档：1-2 基础 / 3-4 铜 / 5-6 银+扩散环 / 7-9 金+双环 / 10 钻+七彩放射+全场彩带 */
  private renderEvolveSuccess(star: number, card: Card, t: number, cy: number, cw: number, ch: number): void {
    const ctx = this.ctx;
    const tier = star >= 10 ? 4 : star >= 7 ? 3 : star >= 5 ? 2 : star >= 3 ? 1 : 0;
    const mainCol = ['#ffe9a8', '#e0a060', '#eef2fa', '#ffd24d', '#bff3ff'][tier];
    const rayN = [12, 16, 22, 28, 40][tier];
    const pt = t - 1.3;

    // 放射光（10 星七彩旋转变色，其余单色）
    ctx.save();
    ctx.globalCompositeOperation = 'lighter';
    for (let i = 0; i < rayN; i++) {
      const a = (i / rayN) * Math.PI * 2 + t * (tier >= 3 ? 0.9 : 0.5);
      const len = 380 + tier * 40;
      const gg = ctx.createLinearGradient(W / 2, cy, W / 2 + Math.cos(a) * len, cy + Math.sin(a) * len);
      if (tier >= 4) {
        const hue = (i * 360 / rayN + t * 120) % 360;
        gg.addColorStop(0, `hsla(${hue},100%,72%,0.6)`);
        gg.addColorStop(1, `hsla(${hue},100%,72%,0)`);
      } else {
        gg.addColorStop(0, mainCol + '73');
        gg.addColorStop(1, mainCol + '00');
      }
      ctx.strokeStyle = gg; ctx.lineWidth = tier >= 3 ? 7 : 5;
      ctx.beginPath(); ctx.moveTo(W / 2, cy); ctx.lineTo(W / 2 + Math.cos(a) * len, cy + Math.sin(a) * len); ctx.stroke();
    }
    ctx.restore();

    // 5 星+：扩散光环；7 星+：双环
    if (tier >= 2) {
      const ringP = (pt % 0.9) / 0.9;
      ctx.save();
      ctx.globalAlpha = (1 - ringP) * 0.8;
      ctx.strokeStyle = mainCol; ctx.lineWidth = 4;
      ctx.beginPath(); ctx.arc(W / 2, cy, 60 + ringP * 300, 0, Math.PI * 2); ctx.stroke();
      if (tier >= 3) {
        ctx.globalAlpha = (1 - ringP) * 0.5;
        ctx.beginPath(); ctx.arc(W / 2, cy, 40 + ringP * 200, 0, Math.PI * 2); ctx.stroke();
      }
      ctx.restore();
    }

    // 成品卡 pop（高星更夸张）
    const pop = Ease.outBack(Math.min(1, pt / (tier >= 3 ? 0.55 : 0.4)));
    ctx.save();
    ctx.translate(W / 2, cy);
    ctx.scale(Math.max(0.02, pop), Math.max(0.02, pop));
    ctx.shadowColor = mainCol; ctx.shadowBlur = 30 + tier * 14;
    drawCard(ctx, card, 0, 0, cw, ch, { showName: false, rainbowT: (this.last / 1000 * 0.35) % 1 });
    ctx.restore();

    // 10 星：全场彩带撒花
    if (tier >= 4) {
      const confCols = ['#ff5c8a', '#ffd24d', '#6fce9a', '#6fd8ff', '#c05ce8', '#ffffff'];
      for (let i = 0; i < 70; i++) {
        const speed = 160 + (i % 7) * 40;
        const x = (i * 173) % W + Math.sin(t * 3 + i) * 24;
        const y = ((pt * speed + i * 89) % (H + 120)) - 60;
        ctx.save();
        ctx.translate(x, y);
        ctx.rotate(t * 4 + i);
        ctx.globalAlpha = 0.9;
        ctx.fillStyle = confCols[i % confCols.length];
        ctx.fillRect(-5, -3, 10, 6);
        ctx.restore();
      }
    }

    // 星标文字（10 星 ◆ 钻）
    const s = this.starStyle(star);
    ctx.save();
    ctx.shadowColor = mainCol; ctx.shadowBlur = tier >= 2 ? 18 : 0;
    this.text(`升星成功 ${s.glyph.repeat(star)}`, W / 2, cy + ch / 2 + 52, 28, s.color, 'center', 'bold');
    ctx.restore();
  }

  /** 升星融合动画：两卡靠拢 → 光晕增强 → 白光一闪 → 成功（放射光+成品 pop）/ 失败（灰白+素材爆碎） */
  private renderEvolveAnim(): void {
    const ea = this.evolveAnim!;
    const ctx = this.ctx;
    const t = ea.t;
    ctx.fillStyle = 'rgba(2,2,8,0.92)';
    ctx.fillRect(0, 0, W, H);
    const cy = H / 2 - 40, cw = 190, ch = 268;
    const merge = Math.min(1, t / 1.3);
    const e = 1 - Math.pow(1 - merge, 3); // outCubic
    const flash = ea.applied && t < 1.55 ? 1 - (t - 1.3) / 0.25 : 0;

    if (!ea.applied) {
      // 融合中：卡向中心收拢 + 光晕增强 + 素材淡出
      ctx.save();
      ctx.globalCompositeOperation = 'lighter';
      const g = ctx.createRadialGradient(W / 2, cy, 0, W / 2, cy, 320);
      g.addColorStop(0, `rgba(255,230,150,${(0.12 + e * 0.5).toFixed(3)})`);
      g.addColorStop(1, 'rgba(255,230,150,0)');
      ctx.fillStyle = g; ctx.beginPath(); ctx.arc(W / 2, cy, 320, 0, Math.PI * 2); ctx.fill();
      ctx.restore();
      const fade = merge > 0.72 ? 1 - (merge - 0.72) / 0.28 : 1;
      ctx.save();
      ctx.globalAlpha = Math.max(0, fade);
      ea.mats.forEach((m, i) => {
        const startX = W / 2 + (ea.mats.length === 1 ? 260 : 150 + i * 220);
        drawCard(ctx, m.card, W / 2 + (startX - W / 2) * (1 - e), cy, cw, ch, { showName: false });
      });
      ctx.restore();
      drawCard(ctx, ea.tgtCard, W / 2 - 260 * (1 - e), cy, cw, ch, { showName: false, rainbowT: (this.last / 1000 * 0.3) % 1 });
      this.text(`成功率 ${ea.prep.rate}%`, W / 2, cy + ch / 2 + 46, 22, '#ffd24d', 'center', 'bold', true);
      this.text('融合中……', W / 2, cy + ch / 2 + 76, 14, '#cfc4a8', 'center', 'bold');
    } else if (ea.prep.success) {
      this.renderEvolveSuccess(ea.prep.newEvoStage, ea.tgtCard, t, cy, cw, ch);
    } else {
      // 失败：主卡灰白抖动降星保留，素材爆碎消散
      const fp = Math.min(1, (t - 1.3) / 0.9);
      const shakeX = Math.sin(t * 40) * 8 * (1 - fp);
      ctx.save();
      ctx.filter = 'grayscale(1) brightness(0.65)';
      drawCard(ctx, ea.tgtCard, W / 2 - 120 + shakeX, cy, cw, ch, { showName: false });
      ctx.globalAlpha = Math.max(0, 1 - fp * 1.5);
      ea.mats.forEach((m, i) => {
        drawCard(ctx, m.card, W / 2 + 120 + i * 30, cy + i * 20, cw, ch, { showName: false });
      });
      ctx.restore();
      ctx.save();
      for (let i = 0; i < 26; i++) {
        const a = i * 1.713, sp = 70 + (i % 5) * 46;
        const px = W / 2 + 120 + Math.cos(a) * sp * fp;
        const py = cy + Math.sin(a) * sp * fp - fp * 34;
        ctx.globalAlpha = Math.max(0, 0.85 - fp);
        ctx.fillStyle = '#9a94a8';
        ctx.fillRect(px, py, 6, 6);
      }
      ctx.restore();
      this.text(`合成失败……素材损毁，主卡降至 ${Math.max(0, ea.tgtStar - 1)} 星`, W / 2, cy + ch / 2 + 52, 22, '#8a8498', 'center', 'bold');
    }

    if (flash > 0) {
      ctx.fillStyle = `rgba(255,255,255,${(flash * 0.95).toFixed(3)})`;
      ctx.fillRect(0, 0, W, H);
    }
    this.text('点击跳过', W - 30, H - 22, 12, 'rgba(255,255,255,0.4)', 'right');
  }

  private renderInventory(): void {
    const ctx = this.ctx;
    this.buttons = [];
    ctx.fillStyle = 'rgba(8,6,18,0.55)';
    ctx.fillRect(0, 0, W, H);
    this.text('卡 牌 仓 库', 60, 84, 28, '#f5e0a0', 'left', 'bold', true);

    const inv = this.db.inventory.cards;
    // ── 顶部信息 + 批量出售 ──
    this.pill(56, 112, 200, 30, '#0d0a16', '#c8b285');
    this.text(`持有 ${inv.length}/${this.db.inventory.capacity}`, 156, 129, 14, '#e8d5a8', 'center', 'bold');
    const freshCount = inv.filter(o => isFresh(o)).length;
    this.pill(268, 112, 140, 30, '#0d0a16', '#ff8c8c');
    this.text(`本日新增 ${freshCount}`, 338, 129, 12, '#ffb0b0', 'center', 'bold');
    glassButton(ctx, W - 220, 108, 150, 38, this.invSelling ? '取消批量' : '批量出售', {
      kind: this.invSelling ? 'red' : 'blue', hover: this.hover === 'invSellMode', fontSize: 15,
    });
    this.buttons.push({ x: W - 220, y: 108, w: 150, h: 38, id: 'invSellMode' });

    // ── 筛选 ──
    const filters = ['ALL', 'VR', 'X', 'LR', 'UR', 'SR', 'R', 'N'];
    let fx = 56; const fy = 168;
    for (const f of filters) {
      const act = this.invFilter === f;
      glassButton(ctx, fx, fy, f === 'ALL' ? 60 : 44, 30, f, { kind: act ? 'blue' : 'gray', hover: this.hover === `invf:${f}`, fontSize: 12 });
      this.buttons.push({ x: fx, y: fy, w: f === 'ALL' ? 60 : 44, h: 30, id: `invf:${f}` });
      fx += (f === 'ALL' ? 60 : 44) + 8;
    }

    // ── 排序（稀有度/攻击力/体力/等级/最近获得/星级）+ 合卡入口 ──
    const sorts: [string, string][] = [['rarity', '稀有度'], ['attack', '攻击力'], ['hp', '体力'], ['lv', '等级'], ['new', '最近获得'], ['star', '星级']];
    let sx = 56;
    this.text('排序', 56, 238, 12, '#8892a8', 'left', 'bold');
    sx = 96;
    for (const [k, label] of sorts) {
      const act = this.invSort === k;
      glassButton(ctx, sx, 224, 88, 28, label, { kind: act ? 'green' : 'gray', hover: this.hover === `invs:${k}`, fontSize: 13 });
      this.buttons.push({ x: sx, y: 224, w: 88, h: 28, id: `invs:${k}` });
      sx += 96;
    }
    glassButton(ctx, sx + 8, 224, 108, 28, '⇄ 合卡', { kind: 'blue', hover: this.hover === 'openEvolve', fontSize: 13 });
    this.buttons.push({ x: sx + 8, y: 224, w: 108, h: 28, id: 'openEvolve' });

    // ── 网格 ──
    // 攻击力/体力排序预算一次战力表，避免 sort 内重复构造
    const powMap = new Map<string, { atk: number; hp: number }>();
    if (this.invSort === 'attack' || this.invSort === 'hp') {
      for (const o of inv) {
        const cb = ownedToCombatant(o, false, this.db);
        if (cb) powMap.set(o.instId, { atk: cb.atk, hp: cb.hpMax });
      }
    }
    const evolvable = this.evolvableInsts();
    const filtered = inv
      .filter(o => {
        const c = getCard(o.cardId); if (!c) return false;
        return this.invFilter === 'ALL' || c.rarity === this.invFilter;
      })
      .sort((a, b) => {
        const ra = RANK[getCard(a.cardId)?.rarity ?? 'N'], rb = RANK[getCard(b.cardId)?.rarity ?? 'N'];
        const na = a.gainedAt ?? 0, nb = b.gainedAt ?? 0;
        if (this.invSort === 'new') return nb - na;
        if (this.invSort === 'lv') return b.lv - a.lv;
        if (this.invSort === 'evo') return Number(evolvable.has(b.instId)) - Number(evolvable.has(a.instId)) || rb - ra || b.lv - a.lv;
        if (this.invSort === 'star') return b.evoStage - a.evoStage || rb - ra || b.lv - a.lv;
        if (this.invSort === 'attack') return (powMap.get(b.instId)?.atk ?? 0) - (powMap.get(a.instId)?.atk ?? 0);
        if (this.invSort === 'hp') return (powMap.get(b.instId)?.hp ?? 0) - (powMap.get(a.instId)?.hp ?? 0);
        return rb - ra || b.lv - a.lv || nb - na;
      });

    const cols = 10, icw = 106, ich = 146, igx = 10, igy = 12;
    const gridX = 52, gridY = 300;
    const rowsVisible = 3;
    const maxScroll = Math.max(0, Math.ceil(filtered.length / cols) - rowsVisible);
    this.invMaxScroll = maxScroll;
    this.invScroll = Math.min(this.invScroll, maxScroll);
    const start = this.invScroll * cols;
    const visible = filtered.slice(start, start + cols * rowsVisible);

    visible.forEach((o, vi) => {
      const c = getCard(o.cardId); if (!c) return;
      const col = vi % cols, row = Math.floor(vi / cols);
      const x = gridX + col * (icw + igx) + icw / 2;
      const y = gridY + row * (ich + igy) + ich / 2;
      const inTeam = this.teamInstIds.includes(o.instId);
      const picked = this.invSel.has(o.instId);
      const fresh = isFresh(o);
      const isDetail = this.detailInst === o.instId;
      ctx.save();
      if (picked) { ctx.shadowColor = '#ff5c5c'; ctx.shadowBlur = 16; }
      drawCard(ctx, c, x, y, icw, ich, { showName: false, isNew: fresh, rainbowT: (this.last / 1000 * 0.3) % 1 });
      ctx.restore();
      this.drawCardAura(x, y, icw, ich, o.evoStage);
      if (inTeam) { this.pill(x - 26, y - ich / 2 + 2, 52, 16, '#3a2a08', '#ffd24d'); this.text('出撃', x, y - ich / 2 + 10, 10, '#ffd24d', 'center', 'bold'); }
      if (picked) { ctx.strokeStyle = '#ff8c6a'; ctx.lineWidth = 3; this.rr(x - icw / 2, y - ich / 2, icw, ich, 8); ctx.stroke(); }
      if (isDetail) { ctx.strokeStyle = '#ffe14d'; ctx.lineWidth = 3; this.rr(x - icw / 2, y - ich / 2, icw, ich, 8); ctx.stroke(); }
      if (o.locked) this.text('🔒', x + icw / 2 - 14, y - ich / 2 + 16, 14, '#fff', 'center');
      if (evolvable.has(o.instId)) {
        this.pill(x + icw / 2 - 50, y + ich / 2 - 26, 48, 15, '#3a2a08', '#ffd24d');
        this.text('可升星', x + icw / 2 - 26, y + ich / 2 - 14, 9, '#ffd24d', 'center', 'bold');
      }
      this.drawLvStars(x, y + ich / 2 - 8, o.lv, o.evoStage);
      this.buttons.push({ x: x - icw / 2, y: y - ich / 2, w: icw, h: ich, id: `invpc:${o.instId}` });
    });

    // 滚动（滚轮 + 可拖拽滚动条）
    if (maxScroll > 0) {
      this.drawScrollbar(gridX + cols * (icw + igx) + 6, gridY, rowsVisible * (ich + igy) - igy, rowsVisible);
    } else {
      this.thumbRect = null;
    }
    if (this.invSelling) {
      glassButton(ctx, W / 2 - 260, gridY + 3 * (ich + igy) + 8, 520, 46, `批量出售所选 ${this.invSel.size} 张`, {
        kind: this.invSel.size ? 'green' : 'gray', hover: this.hover === 'invSell', fontSize: 16,
      });
      this.buttons.push({ x: W / 2 - 260, y: gridY + 3 * (ich + igy) + 8, w: 520, h: 46, id: 'invSell' });
    }

    if (this.teamMsg && this.teamMsgT < 2.5) this.renderToast();

    if (this.detailInst) this.renderInvDetail();
    this.renderDragLayer();
  }

  /** 装备选择面板（详情弹层之上）：列出装备库，点击装备/卸下 */
  private renderEquipOverlay(): void {
    const ctx = this.ctx;
    const o = this.db.inventory.cards.find(c => c.instId === this.detailInst);
    if (!o) { this.detailEquipOpen = false; return; }
    const equips = this.db.inventory.equips || [];
    const ow = 560, oh = 320, ox = W / 2 - ow / 2, oy = H / 2 - oh / 2;
    this.rr(ox, oy, ow, oh, 14);
    ctx.fillStyle = 'rgba(10,7,20,0.96)'; ctx.fill();
    ctx.strokeStyle = '#8b7ff0'; ctx.lineWidth = 2;
    this.rr(ox, oy, ow, oh, 14); ctx.stroke();
    this.text('装 备（X 级装备卡，点击装备）', ox + 20, oy + 30, 16, '#f5e0a0', 'left', 'bold', true);
    this.text(`装备库 ${equips.length} 件`, ox + ow - 20, oy + 30, 13, '#ffe14d', 'right', 'bold');
    glassButton(ctx, ox + ow - 110, oy + 12, 90, 32, '关闭', { kind: 'gray', hover: this.hover === 'equipClose', fontSize: 14 });
    this.buttons.push({ x: ox + ow - 110, y: oy + 12, w: 90, h: 32, id: 'equipClose' });
    if (!equips.length) {
      this.text('暂无装备——去「元素精选召唤」抽取 X 级装备卡', ox + 20, oy + 160, 14, '#8892a8', 'left', 'bold');
      return;
    }
    let ey = oy + 62;
    for (const e of equips.slice(0, 7)) {
      const def = equipDefFor(e.cardId);
      const ownedBy = this.db.inventory.cards.find(c => c.equipInstId === e.instId);
      const onThis = o.equipInstId === e.instId;
      this.pill(ox + 16, ey, ow - 32, 32, onThis ? 'rgba(24,64,40,0.95)' : 'rgba(20,16,34,0.9)', onThis ? '#8bffb0' : '#5a5470');
      this.text(def ? `${def.name}：${def.desc}` : e.cardId, ox + 26, ey + 20, 13, onThis ? '#b8ffd0' : '#f0e6cc', 'left', 'bold');
      this.text(onThis ? '已装备（点击卸下）' : (ownedBy ? `被 ${ownedBy.cardId} 使用` : '点击装备'), ox + ow - 26, ey + 20, 12, onThis ? '#8bffb0' : '#8892a8', 'right', 'bold');
      this.buttons.push({ x: ox + 16, y: ey, w: ow - 32, h: 32, id: `equipPick:${e.instId}` });
      ey += 36;
    }
  }

  private renderInvDetail(): void {
    const ctx = this.ctx;
    const o = this.db.inventory.cards.find(c => c.instId === this.detailInst);
    if (!o) { this.detailInst = null; return; }
    const card = getCard(o.cardId); if (!card) { this.detailInst = null; return; }
    const cb = ownedToCombatant(o, false, this.db);
    ctx.fillStyle = 'rgba(2,3,8,0.7)';
    ctx.fillRect(0, 0, W, H);
    const dw = 700, dh = 460, dx = W / 2 - dw / 2, dy = H / 2 - dh / 2;
    metalDialog(ctx, dx, dy, dw, dh);
    this.drawDialogAura(dx, dy, dw, dh, o.evoStage);
    const rdef = runtimeByLegacyId(card.id);
    const formRef = rdef ? (formOf(rdef, this.detailForm) ?? formOf(rdef, 'main')) : null;
    if (rdef && formRef) {
      const img = resolveImage(formRef);
      if (img.complete && img.naturalWidth) {
        const s = Math.min(176 / img.naturalWidth, 256 / img.naturalHeight);
        const dw2 = img.naturalWidth * s, dh2 = img.naturalHeight * s;
        ctx.drawImage(img, dx + 130 - dw2 / 2, dy + 172 - dh2 / 2, dw2, dh2);
      }
      // 形态切换（只显示实际存在的形态）：叠在卡图右上角，避免与底部操作行冲突
      const forms = (['main', 'h', 'x'] as const).filter(f => formOf(rdef, f));
      const labels = { main: '主', h: 'H', x: 'X' } as const;
      let fx = dx + 222 - forms.length * 30;
      for (const f of forms) {
        const active = this.detailForm === f;
        this.pill(fx, dy + 70, 26, 20, active ? '#c8a040' : 'rgba(13,10,22,0.85)', '#c8b285');
        this.text(labels[f], fx + 13, dy + 81, 10, active ? '#0a0a12' : '#e8d5a8', 'center', 'bold');
        this.buttons.push({ x: fx, y: dy + 70, w: 26, h: 20, id: `form:${f}` });
        fx += 30;
      }
    } else {
      drawCard(ctx, card, dx + 130, dy + 172, 176, 256, { showName: true, rainbowT: (this.last / 1000 * 0.3) % 1 });
    }
    this.drawCardAura(dx + 130, dy + 172, 176, 256, o.evoStage);
    engravedText(ctx, card.name, dx + 130, dy + 322, 16);
    const ix = dx + 290;
    this.drawLvStars(ix + 160, dy + 44, o.lv, o.evoStage, 20);
    if (o.evoStage > 0) {
      this.text(`星级加成 ×${Math.round(Math.pow(STAR_STAT_MULT, o.evoStage) * 100)}%（已计入下列数值）`, ix, dy + 68, 12, this.starStyle(o.evoStage).color, 'left', 'bold');
    }
    let ry = dy + 84;
    const rowsS: [string, string][] = [
      ['稀有度', card.rarity], ['元素', card.element], ['攻击力', String(cb?.atk ?? card.stats.attack)],
      ['生命力', String(cb?.hpMax ?? 0)], ['防御力', String(card.stats.defense)], ['速度', String(card.stats.speed)],
      ['技能', card.skillName || '—'], ['获得', isFresh(o) ? '今天' : '较早'],
    ];
    for (const [l, v] of rowsS) { this.text(l, ix, ry, 15, '#e8a0c0', 'left', 'bold'); this.text(v, ix + 120, ry, 15, '#f0e6cc', 'left', 'bold'); ry += 28; }
    // 装备行：显示当前装备（含效果），点击打开装备面板
    const curEquip = o.equipInstId ? (this.db.inventory.equips || []).find(e => e.instId === o.equipInstId) : null;
    const curDef = curEquip ? equipDefFor(curEquip.cardId) : null;
    this.text('装备', ix, ry, 15, '#e8a0c0', 'left', 'bold');
    this.text(curDef ? `⚔ ${curDef.name}（${curDef.desc}）` : '—（点击装备）', ix + 120, ry, 13, curDef ? '#8bffb0' : '#8892a8', 'left', 'bold');
    this.buttons.push({ x: ix, y: ry - 18, w: 400, h: 30, id: 'equipOpen' });
    ry += 28;
    // 文本下界：不得侵入按钮区（by2 = dy+dh-122）
    const textBound = dy + dh - 136;
    if ((o.atkBonus > 0 || o.hpBonus > 0) && ry <= textBound) { this.text(`升星继承：ATK+${o.atkBonus}  HP+${o.hpBonus}`, ix, ry, 13, '#6fce9a', 'left', 'bold'); ry += 28; }
    if (card.skillDesc && ry < textBound) {
      const maxLines = Math.max(1, Math.floor((textBound - ry) / 20));
      const desc = card.skillDesc.length > maxLines * 31 ? card.skillDesc.slice(0, maxLines * 31 - 1) + '…' : card.skillDesc;
      this.wrapText(desc, ix, ry, 380, 20, 12, '#b8c8d8');
      ry += Math.ceil(desc.length / 31) * 20 + 8;
    }
    // 引文（runtime catalog 卡；空间不足时跳过，不与技能文本/按钮叠字）
    if (rdef?.quotesRef) {
      const q = quotesFor(rdef.quotesRef);
      if (q?.description && ry + 56 <= textBound) {
        this.text('◆ 引文', ix, ry, 12, '#c8b285', 'left', 'bold');
        this.wrapText(q.description, ix, ry + 20, 380, 16, 11, '#a8b8c8');
      }
    }

    // 操作按钮两排：上排 一键强化/升星/划至队伍（详情内直接完成），下排 锁定/出售
    const bw = 150, bh = 46, by = dy + dh - 66, by2 = by - 56;
    const dup = findDuplicate(this.db, o.instId, new Set(this.teamInstIds));
    const canEvo = !!dup || this.evolvableInsts().has(o.instId);
    const evoLabel = dup ? `升星 ★ ${evolveRate(o.evoStage, dup.evoStage)}%` : canEvo ? '升星 ★（同级×2）' : '升星（缺素材）';
    glassButton(ctx, dx + 40, by2, bw, bh, '一键强化', { kind: 'green', hover: this.hover === 'quickEnhance', fontSize: 16 });
    glassButton(ctx, dx + 40 + (bw + 12), by2, bw, bh, evoLabel, { kind: canEvo ? 'blue' : 'gray', hover: this.hover === 'quickEvolve' && canEvo, fontSize: 14 });
    glassButton(ctx, dx + 40 + (bw + 12) * 2, by2, bw, bh, '划至队伍', { kind: 'gray', hover: this.hover === 'invToTeam', fontSize: 16 });
    glassButton(ctx, dx + 40, by, bw, bh, o.locked ? '解锁' : '锁定', { kind: 'gray', hover: this.hover === 'lockCard', fontSize: 16 });
    glassButton(ctx, dx + 40 + (bw + 12), by, bw, bh, '出售', { kind: 'red', hover: this.hover === 'sellCard', fontSize: 16 });
    this.buttons.push({ x: dx + 40, y: by2, w: bw, h: bh, id: 'quickEnhance' });
    this.buttons.push({ x: dx + 40 + (bw + 12), y: by2, w: bw, h: bh, id: 'quickEvolve' });
    this.buttons.push({ x: dx + 40 + (bw + 12) * 2, y: by2, w: bw, h: bh, id: 'invToTeam' });
    this.buttons.push({ x: dx + 40, y: by, w: bw, h: bh, id: 'lockCard' });
    this.buttons.push({ x: dx + 40 + (bw + 12), y: by, w: bw, h: bh, id: 'sellCard' });
    glassButton(ctx, dx + 20, dy + 14, 90, 42, '✕', { kind: 'gray', hover: this.hover === 'closeInvDetail', fontSize: 16 });
    this.buttons.push({ x: dx + 20, y: dy + 14, w: 90, h: 42, id: 'closeInvDetail' });
    if (this.detailEquipOpen) this.renderEquipOverlay();
  }

  private renderShop(): void {
    const ctx = this.ctx;
    this.buttons = [];
    ctx.fillStyle = 'rgba(8,6,18,0.55)';
    ctx.fillRect(0, 0, W, H);
    this.text('商 店', 60, 84, 28, '#f5e0a0', 'left', 'bold', true);
    const u = this.db.user;

    // 顶部：远程宝石余额
    this.pill(56, 108, 340, 34, '#1a1030', '#b45cff');
    this.text(`💎 ${u.gems.toLocaleString()}  · 累计充值 ${u.paidGems.toLocaleString()}`, 230, 128, 15, '#e0b0ff', 'center', 'bold');
    const mcActive = u.monthCardUntil > Date.now();
    const mcDays = Math.ceil((u.monthCardUntil - Date.now()) / 86400000);
    this.pill(410, 108, 250, 34, mcActive ? '#123020' : '#302018', mcActive ? '#6fce9a' : '#c8a040');
    this.text(mcActive ? `月卡生效中（剩 ${mcDays} 天）` : '月卡未购买', 535, 137, 13, mcActive ? '#a8f0c0' : '#cfc4a8', 'center', 'bold');

    // ── 宝石档位 ──
    this.text('── 宝石礼包 ──', 56, 176, 14, '#cfc4a8', 'left', 'bold');
    const tiers: [string, number, number][] = [
      ['gem60', 60, 6], ['gem300', 300, 30], ['gem980', 980, 98],
      ['gem1980', 1980, 198], ['gem3280', 3280, 328], ['gem6480', 6480, 648],
    ];
    const cw = 188, ch = 150, gap = 14;
    let cx = 56, cy = 188;
    tiers.forEach(([id, gems, cost], i) => {
      const hov = this.hover === `shopBuy:${id}`;
      const isFirst = (u.paidTiers[id] ?? 0) === 0;
      this.rr(cx, cy, cw, ch, 12);
      ctx.fillStyle = '#171226'; ctx.fill();
      ctx.strokeStyle = '#b45cff'; ctx.lineWidth = 1.5;
      this.rr(cx, cy, cw, ch, 12); ctx.stroke();
      // 宝石图标（自制紫钻）
      ctx.save();
      ctx.translate(cx + cw / 2, cy + 46);
      ctx.beginPath();
      ctx.moveTo(0, -22); ctx.lineTo(16, -6); ctx.lineTo(10, 18); ctx.lineTo(-10, 18); ctx.lineTo(-16, -6);
      ctx.closePath();
      const dg = ctx.createLinearGradient(0, -22, 0, 18);
      dg.addColorStop(0, '#fff'); dg.addColorStop(0.3, '#b45cff'); dg.addColorStop(1, '#5c2a8f');
      ctx.fillStyle = dg; ctx.fill();
      ctx.strokeStyle = 'rgba(255,255,255,0.6)'; ctx.lineWidth = 1.2; ctx.stroke();
      ctx.restore();
      this.text(gems.toLocaleString(), cx + cw / 2, cy + 62, 20, '#e8d0ff', 'center', 'bold');
      if (isFirst) {
        this.pill(cx + cw / 2 - 50, cy + 72, 100, 18, '#ff5c5c', '#fff');
        this.text('首充×2', cx + cw / 2, cy + 84, 10, '#fff', 'center', 'bold');
      }
      this.text(`¥${cost}`, cx + cw / 2, cy + 108, 15, '#ffd24d', 'center', 'bold');
      glassButton(ctx, cx + 8, cy + ch - 34, cw - 16, 26, '购 买', { kind: 'blue', hover: hov, fontSize: 13 });
      this.buttons.push({ x: cx, y: cy, w: cw, h: ch, id: `shopBuy:${id}` });
      cx += cw + gap;
      if ((i + 1) % 3 === 0) { cx = 56; cy += ch + 16; }
    });

    // ── 月卡 ──
    const my = cy + 16;
    this.rr(56, my, W - 112, 96, 12);
    ctx.fillStyle = '#251a10'; ctx.fill();
    ctx.strokeStyle = '#e8b23b'; ctx.lineWidth = 1.5;
    this.rr(56, my, W - 112, 96, 12); ctx.stroke();
    this.text('月卡 · 每日宝石', 78, my + 28, 17, '#ffd24d', 'left', 'bold');
    this.text('立即获得宝石 300 · 每日可领取宝石 20 · 体力恢复 +50%', 78, my + 54, 12, '#cfc4a8', 'left');
    this.text('¥30', 78, my + 80, 16, '#ffd24d', 'left', 'bold');
    const mcClaimedToday = u.monthCardLastClaim === new Date().toISOString().slice(0, 10);
    glassButton(ctx, W - 395, my + 28, 165, 44, mcClaimedToday
      ? '今日已领取 ✓' : (mcActive ? '领取今日俸禄' : '月卡未生效'), {
      kind: mcClaimedToday || !mcActive ? 'gray' : 'green',
      hover: this.hover === 'shopBuy:claimDaily', fontSize: 14,
    });
    this.buttons.push({ x: W - 395, y: my + 28, w: 165, h: 44, id: 'shopBuy:claimDaily' });
    glassButton(ctx, W - 200, my + 28, 150, 44, mcActive ? '再续 30 天' : '开通月卡', {
      kind: 'green', hover: this.hover === 'shopBuy:monthCard', fontSize: 15,
    });
    this.buttons.push({ x: W - 200, y: my + 28, w: 150, h: 44, id: 'shopBuy:monthCard' });

    // ── 每日补给 ──
    const dy2 = my + 116;
    glassButton(ctx, 56, dy2, 360, 46, '回复药水：体力 + 战斗体力回满', { kind: 'green', hover: this.hover === 'shopBuy:restore', fontSize: 15 });
    this.buttons.push({ x: 56, y: dy2, w: 360, h: 46, id: 'shopBuy:restore' });
    this.text('（此为本地模拟商店，无真实支付）', W - 56, dy2 + 30, 12, '#8892a8', 'right');

    if (this.teamMsg && this.teamMsgT < 2.5) this.renderToast();
  }

  private renderToast(): void {
    const ctx = this.ctx;
    if (!this.teamMsg || this.teamMsgT >= 2.5) return;
    const a = Math.min(1, Math.min(this.teamMsgT / 0.2, (2.5 - this.teamMsgT) / 0.4));
    ctx.save(); ctx.globalAlpha = Math.max(0, a);
    this.pill(W / 2 - 280, 64, 560, 40, 'rgba(13,10,22,0.94)', '#6fce9a');
    this.text(this.teamMsg, W / 2, 86, 15, '#a8f0c0', 'center', 'bold');
    ctx.restore();
  }

  private renderDragLayer(): void {
    // 仓库页无拖动（拖动仅编队页），此方法仅占位空实现
  }

  private renderTeam(): void {
    const ctx = this.ctx;
    this.buttons = [];
    ctx.fillStyle = 'rgba(8,6,18,0.55)';
    ctx.fillRect(0, 0, W, H);
    this.text('队 伍 编 成', 60, 84, 28, '#f5e0a0', 'left', 'bold', true);

    // ── 左：出击队伍 5 槽 ──
    this.text('出击队伍', 60, 116, 16, '#cfc4a8', 'left', 'bold');
    this.text('拖动下方卡片到槽位即可上阵 / 换位', 170, 116, 12, '#8892a8', 'left');
    const team = this.teamCombatants();
    const cw = 118, ch = 168, gap = 14;
    let sx = 50;
    const sy = 132;
    for (let i = 0; i < 5; i++) {
      const slot = team[i];
      const sel = this.teamSelSlot === i;
      ctx.save();
      if (sel) { ctx.shadowColor = '#ffe14d'; ctx.shadowBlur = 20; }
      if (slot) {
        if (this.drag?.started && this.drag.fromSlot === i) ctx.globalAlpha = 0.3;
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

    // 排序（与仓库共用 invSort：稀有度/攻击力/体力/等级/最近获得/星级/可升星）
    const tSorts: [string, string][] = [['rarity', '稀有度'], ['attack', '攻击力'], ['hp', '体力'], ['lv', '等级'], ['new', '最近'], ['star', '星级'], ['evo', '可升星']];
    let tsx = 60;
    for (const [k, label] of tSorts) {
      const act = this.invSort === k;
      glassButton(ctx, tsx, 356, 76, 24, label, { kind: act ? 'green' : 'gray', hover: this.hover === `invs:${k}`, fontSize: 12 });
      this.buttons.push({ x: tsx, y: 356, w: 76, h: 24, id: `invs:${k}` });
      tsx += 82;
    }

    const powMap = new Map<string, { atk: number; hp: number }>();
    if (this.invSort === 'attack' || this.invSort === 'hp') {
      for (const o of inv) {
        const cb = ownedToCombatant(o, false, this.db);
        if (cb) powMap.set(o.instId, { atk: cb.atk, hp: cb.hpMax });
      }
    }
    const evolvable = this.evolvableInsts();
    const filtered = inv.filter(o => {
      const c = getCard(o.cardId); if (!c) return false;
      return this.invFilter === 'ALL' || c.rarity === this.invFilter;
    }).sort((a, b) => {
      const ra = RANK[getCard(a.cardId)?.rarity ?? 'N'], rb = RANK[getCard(b.cardId)?.rarity ?? 'N'];
      if (this.invSort === 'attack') return (powMap.get(b.instId)?.atk ?? 0) - (powMap.get(a.instId)?.atk ?? 0);
      if (this.invSort === 'hp') return (powMap.get(b.instId)?.hp ?? 0) - (powMap.get(a.instId)?.hp ?? 0);
      if (this.invSort === 'lv') return b.lv - a.lv;
      if (this.invSort === 'new') return (b.gainedAt ?? 0) - (a.gainedAt ?? 0);
      if (this.invSort === 'star') return b.evoStage - a.evoStage || rb - ra || b.lv - a.lv;
      if (this.invSort === 'evo') return Number(evolvable.has(b.instId)) - Number(evolvable.has(a.instId)) || rb - ra || b.lv - a.lv;
      return rb - ra || b.lv - a.lv;
    });

    const cols = 7, icw = 108, ich = 148, igx = 10, igy = 10;
    const gridX = 50, gridY = 384;
    const rowsVisible = 2;
    const maxScroll = Math.max(0, Math.ceil(filtered.length / cols) - rowsVisible);
    this.invMaxScroll = maxScroll;
    this.invScroll = Math.min(this.invScroll, maxScroll);
    const start = this.invScroll * cols;
    const visible = filtered.slice(start, start + cols * rowsVisible);

    visible.forEach((o, vi) => {
      const c = getCard(o.cardId); if (!c) return;
      const col = vi % cols, row = Math.floor(vi / cols);
      const x = gridX + col * (icw + igx) + icw / 2;
      const y = gridY + row * (ich + igy) + ich / 2;
      const inTeam = this.teamInstIds.includes(o.instId);
      const picked = this.enhancePicks.has(o.instId);
      const isDetail = this.detailInst === o.instId;
      ctx.save();
      if (picked) { ctx.shadowColor = '#6fce9a'; ctx.shadowBlur = 16; }
      if (this.drag?.started && this.drag.instId === o.instId) ctx.globalAlpha = 0.3;
      drawCard(ctx, c, x, y, icw, ich, { showName: false, rainbowT: (this.last / 1000 * 0.3) % 1 });
      ctx.restore();
      this.drawCardAura(x, y, icw, ich, o.evoStage);
      if (inTeam) {
        this.pill(x - 24, y - ich / 2 + 3, 48, 16, '#3a2a08', '#ffd24d');
        this.text('出撃', x, y - ich / 2 + 11, 10, '#ffd24d', 'center', 'bold');
      }
      if (picked) { ctx.strokeStyle = '#6fce9a'; ctx.lineWidth = 3; this.rr(x - icw / 2, y - ich / 2, icw, ich, 8); ctx.stroke(); }
      if (isDetail) { ctx.strokeStyle = '#ffe14d'; ctx.lineWidth = 3; this.rr(x - icw / 2, y - ich / 2, icw, ich, 8); ctx.stroke(); }
      if (o.locked) this.text('🔒', x + icw / 2 - 12, y - ich / 2 + 16, 14, '#fff', 'center');
      if (evolvable.has(o.instId)) {
        this.pill(x + icw / 2 - 52, y + ich / 2 - 26, 48, 15, '#3a2a08', '#ffd24d');
        this.text('可升星', x + icw / 2 - 28, y + ich / 2 - 14, 9, '#ffd24d', 'center', 'bold');
      }
      this.drawLvStars(x, y + ich / 2 - 8, o.lv, o.evoStage);
      this.buttons.push({ x: x - icw / 2, y: y - ich / 2, w: icw, h: ich, id: `inv:${o.instId}` });
    });

    // 滚动（滚轮 + 可拖拽滚动条）
    if (maxScroll > 0) {
      this.drawScrollbar(gridX + cols * (icw + igx) + 6, gridY, rowsVisible * (ich + igy) - igy, rowsVisible);
    } else {
      this.thumbRect = null;
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
      const potions = this.db.inventory.materials.upgradePotion || 0;
      this.text(`强化模式：点选狗粮卡（绿框）· 已选 ${this.enhancePicks.size} 张`, 250, 348, 13, '#6fce9a', 'left', 'bold');
      glassButton(ctx, W / 2 - 90, 340, 180, 36, `确认强化(${this.enhancePicks.size})`, { kind: 'green', hover: this.hover === 'enhanceGo', fontSize: 14 });
      this.buttons.push({ x: W / 2 - 90, y: 340, w: 180, h: 36, id: 'enhanceGo' });
      // 药水快捷强化（强化药水图标 + 数量）
      const picon = loadAssetImage(ENHANCE_POTION.icon);
      if (picon.complete && picon.naturalWidth) ctx.drawImage(picon, W / 2 - 250, 346, 24, 24);
      else this.text('🧪', W / 2 - 242, 358, 14, '#b8f0d0', 'center');
      this.text(`×${potions}`, W / 2 - 222, 358, 13, '#6fce9a', 'left', 'bold');
      glassButton(ctx, W / 2 + 250, 340, 120, 36, potions > 0 ? '用药水+1' : '药水不足', { kind: potions > 0 ? 'green' : 'gray', hover: this.hover === 'enhancePotion' && potions > 0, fontSize: 14 });
      this.buttons.push({ x: W / 2 + 250, y: 340, w: 120, h: 36, id: 'enhancePotion' });
    }

    // 详情弹层
    if (this.detailInst) this.renderTeamDetail();

    // 拖动跟随层（最上层）：落点槽高亮 + 卡片跟随鼠标
    if (this.drag?.started) {
      const d = this.drag;
      const si = this.teamSlotAt(d.x, d.y);
      if (si >= 0) {
        const cw = 118, ch = 168, gap = 14, sy2 = 132;
        const sx2 = 50 + si * (cw + gap);
        ctx.save();
        ctx.strokeStyle = '#6fce9a'; ctx.lineWidth = 4; ctx.shadowColor = '#6fce9a'; ctx.shadowBlur = 18;
        this.rr(sx2, sy2, cw, ch, 8); ctx.stroke();
        ctx.restore();
      }
      const o = this.db.inventory.cards.find(c => c.instId === d.instId);
      const card = o && getCard(o.cardId);
      if (card) {
        ctx.save();
        ctx.globalAlpha = 0.92;
        ctx.shadowColor = 'rgba(0,0,0,0.6)'; ctx.shadowBlur = 20;
        drawCard(ctx, card, d.x, d.y, 108, 148, { showName: false, rainbowT: (this.last / 1000 * 0.3) % 1 });
        ctx.restore();
      }
    }
  }

  private renderTeamDetail(): void {
    const ctx = this.ctx;
    const o = this.db.inventory.cards.find(c => c.instId === this.detailInst);
    if (!o) { this.detailInst = null; return; }
    const card = getCard(o.cardId); if (!card) { this.detailInst = null; return; }
    const cb = ownedToCombatant(o, false, this.db);
    ctx.fillStyle = 'rgba(2,3,8,0.7)';
    ctx.fillRect(0, 0, W, H);
    const dw = 700, dh = 460, dx = W / 2 - dw / 2, dy = H / 2 - dh / 2;
    metalDialog(ctx, dx, dy, dw, dh);
    this.drawDialogAura(dx, dy, dw, dh, o.evoStage);
    // 左：大卡
    drawCard(ctx, card, dx + 130, dy + 205, 200, 290, { showName: true, rainbowT: (this.last / 1000 * 0.3) % 1 });
    this.drawCardAura(dx + 130, dy + 205, 200, 290, o.evoStage);
    engravedText(ctx, card.name, dx + 130, dy + 366, 16);
    this.text(`${card.rarity} · ${card.element} · COST ${card.cardCost}`, dx + 130, dy + 386, 12, '#cfc4a8', 'center', 'bold');
    // 右：信息
    const ix = dx + 280;
    this.drawLvStars(ix + 180, dy + 40, o.lv, o.evoStage, 20);
    if (o.evoStage > 0) {
      this.text(`星级加成 ×${Math.round(Math.pow(STAR_STAT_MULT, o.evoStage) * 100)}%（已计入下列数值）`, ix, dy + 64, 12, this.starStyle(o.evoStage).color, 'left', 'bold');
    }
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
    // 装备行：显示当前装备（含效果），点击打开装备面板
    const curEquip = o.equipInstId ? (this.db.inventory.equips || []).find(e => e.instId === o.equipInstId) : null;
    const curDef = curEquip ? equipDefFor(curEquip.cardId) : null;
    this.text('装备', ix, ry, 15, '#e8a0c0', 'left', 'bold');
    this.text(curDef ? `⚔ ${curDef.name}（${curDef.desc}）` : '—（点击装备）', ix + 110, ry, 13, curDef ? '#8bffb0' : '#8892a8', 'left', 'bold');
    this.buttons.push({ x: ix, y: ry - 18, w: 380, h: 30, id: 'equipOpen' });
    ry += 34;
    // 装备效果已计入上方数值（提示）
    if (curDef && curDef.kind !== 'revive') {
      this.text(`（装备加成已计入）`, ix + 110, ry - 14, 10, '#6fce9a', 'left');
    }
    if (o.atkBonus > 0 || o.hpBonus > 0) {
      this.text(`升星继承：ATK+${o.atkBonus}  HP+${o.hpBonus}`, ix, ry, 13, '#6fce9a', 'left', 'bold'); ry += 30;
    }
    // 强化药水持有量
    const potions = this.db.inventory.materials.upgradePotion || 0;
    const picon = loadAssetImage(ENHANCE_POTION.icon);
    if (picon.complete && picon.naturalWidth) ctx.drawImage(picon, ix, ry + 2, 20, 20);
    else this.text('🧪', ix + 10, ry + 12, 12, '#b8f0d0', 'center');
    this.text(`强化药水 ×${potions}（探索掉落，可一键强化）`, ix + 26, ry + 15, 12, '#9fdcb8', 'left', 'bold'); ry += 26;
    if (card.skillDesc) this.wrapText(card.skillDesc, ix, ry, 360, 20, 12, '#b8c8d8');

    // 操作按钮
    const bw = 150, bh = 46, by = dy + dh - 66;
    const bx0 = dx + 40;
    glassButton(ctx, bx0, by, bw, bh, '强化', { kind: 'green', hover: this.hover === 'enhanceStart', fontSize: 17 });
    glassButton(ctx, bx0 + bw + 12, by, bw, bh, '升星', { kind: 'blue', hover: this.hover === 'evolveStart', fontSize: 17 });
    glassButton(ctx, bx0 + (bw + 12) * 2, by, bw, bh, o.locked ? '解锁' : '锁定', { kind: 'gray', hover: this.hover === 'lockCard', fontSize: 17 });
    glassButton(ctx, bx0 + (bw + 12) * 3, by, bw, bh, '出售', { kind: 'red', hover: this.hover === 'sellCard', fontSize: 17 });
    this.buttons.push({ x: bx0, y: by, w: bw, h: bh, id: 'enhanceStart' });
    this.buttons.push({ x: bx0 + bw + 12, y: by, w: bw, h: bh, id: 'evolveStart' });
    this.buttons.push({ x: bx0 + (bw + 12) * 2, y: by, w: bw, h: bh, id: 'lockCard' });
    this.buttons.push({ x: bx0 + (bw + 12) * 3, y: by, w: bw, h: bh, id: 'sellCard' });
    // 关闭
    glassButton(ctx, dx + 20, dy + 14, 90, 42, '✕', { kind: 'gray', hover: this.hover === 'closeTeamDetail', fontSize: 16 });
    this.buttons.push({ x: dx + 20, y: dy + 14, w: 90, h: 42, id: 'closeTeamDetail' });
    if (this.detailEquipOpen) this.renderEquipOverlay();
  }

  // ============ 战斗界面 ============
  // ============ 战斗（参考截图复刻：遭遇 → 主界面 → 技能确认 → 胜利）============
  private renderBattle(): void {
    this.buttons = [];
    if (!this.battle) { this.startBattle(); return; }
    const b = this.battle;

    if (this.battlePhase === 'encounter') this.renderEncounter();
    else this.renderBattleMain();

    // 技能确认弹窗（压在战斗主界面上）
    if (this.battlePhase === 'skillConfirm' && this.skillStarIdx >= 0) {
      const slot = b.team[this.skillStarIdx];
      if (slot) {
        const info: SkillInfo = {
          name: slot.skillName || '技能', lv: slot.lv, cost: 60,
          desc: `给予敌方全体攻击力${Math.round((slot.skillMult || 1) * 100)}%的伤害`,
          element: slot.card.element,
        };
        this.buttons.push(...drawSkillConfirm(this.ctx, info, this.hover));
      } else this.battlePhase = 'fighting';
    }
    // 胜利结算（含宝箱开启流程）
    if (this.battlePhase === 'victory') this.renderVictory();
  }

  /** 遭遇界面（截图：敌卡居中 + 战斗开始/Auto + 底部队伍 + 探索框架） */
  private renderEncounter(): void {
    const ctx = this.ctx;
    const b = this.battle!;
    const boss = b.enemies[0];
    const E = ENCOUNTER;
    this.buttons.push(...drawExploreChrome(ctx, this.exploreChromeData(), this.hover));

    // 敌卡（居中上部）
    drawBattleCard(ctx, boss.card, E.enemy.cx, E.enemy.cy, E.enemy.cw, E.enemy.ch,
      { elemBadge: true, rarityTag: boss.card.rarity, lv: b.raid?.level ?? boss.lv });
    const ehp = Math.max(0, boss.hp / boss.hpMax);
    drawHpBar(ctx, E.enemy.cx - 78, E.enemy.cy + E.enemyHpDy, 170, 14, ehp,
      { value: String(Math.floor(Math.max(0, boss.hp))), valueColor: COLORS.hpNumEnemy });

    // raid 信息框（右侧：名称/等级/血条/逃亡倒计时）
    if (b.raid) {
      const ix = E.enemy.cx + 160, iy = E.enemy.cy - 92, iw = 300, ih = 178;
      metalDialog(ctx, ix, iy, iw, ih);
      this.text(b.raid.name, ix + iw / 2, iy + 32, 20, '#fff', 'center', 'bold');
      this.text(`等级${b.raid.level}`, ix + iw / 2, iy + 66, 17, '#e8d5a8', 'center', 'bold');
      drawHpBar(ctx, ix + 30, iy + 92, iw - 60, 18, ehp,
        { value: String(Math.floor(Math.max(0, b.raid.hp))), valueColor: COLORS.hpNumEnemy });
      this.text('离逃亡还剩余 --:--:--', ix + iw / 2, iy + 144, 14, '#ffe14d', 'center', 'bold');
    }

    // 战斗开始（红）/ Auto（绿）
    glassButton(ctx, E.start.x, E.start.y, E.start.w, E.start.h, '战斗开始',
      { kind: 'red', hover: this.hover === 'batStart', fontSize: 26 });
    this.buttons.push({ ...E.start, id: 'batStart' });
    glassButton(ctx, E.auto.x, E.auto.y, E.auto.w, E.auto.h, 'Auto',
      { kind: 'green', hover: this.hover === 'batAutoEnc', fontSize: 24 });
    this.buttons.push({ ...E.auto, id: 'batAutoEnc' });

    // 底部队伍
    this.buttons.push(...drawTeamStripBottom(ctx, this.teamStripData(), this.hover, this.last / 1000));
  }

  /** 战斗主界面（截图：敌顶我底 5 卡 + 星星 + 撤退/自动圆钮 + 确认状态） */
  private renderBattleMain(): void {
    const ctx = this.ctx;
    const b = this.battle!;
    const t = this.last / 1000;
    const boss = b.enemies[0];

    // 敌卡（顶部居中）+ 敌血条
    drawBattleCard(ctx, boss.card, BAT.enemy.cx, BAT.enemy.cy, BAT.enemy.cw, BAT.enemy.ch,
      { elemBadge: true, lv: b.raid?.level ?? boss.lv });
    const ehp = Math.max(0, boss.hp / boss.hpMax);
    drawHpBar(ctx, BAT.enemy.cx - BAT.enemyHp.w / 2 + 8, BAT.enemy.cy + BAT.enemyHp.dy,
      BAT.enemyHp.w, BAT.enemyHp.h, ehp,
      { element: boss.card.element, value: String(Math.floor(Math.max(0, boss.hp))), valueColor: COLORS.hpNumEnemy });

    // 确认状态（右上）
    glassButton(ctx, BAT.statusBtn.x, BAT.statusBtn.y, BAT.statusBtn.w, BAT.statusBtn.h, '确认状态',
      { kind: 'gray', hover: this.hover === 'batStatus', fontSize: 15 });
    this.buttons.push({ ...BAT.statusBtn, id: 'batStatus' });

    // 我方 5 卡 + 血条 + 技能星
    const n = b.team.length;
    const totalW = n * BAT.ally.cw + (n - 1) * BAT.ally.gap;
    let x = (W - totalW) / 2;
    for (let i = 0; i < n; i++) {
      const s = b.team[i];
      const cx = x + BAT.ally.cw / 2;
      drawBattleCard(ctx, s.card, cx, BAT.ally.cy, BAT.ally.cw, BAT.ally.ch,
        { elemBadge: true, selected: this.skillStarIdx === i, dim: s.hp <= 0, rainbowT: (t * 0.3) % 1 });
      const hpr = Math.max(0, s.hp / s.hpMax);
      drawHpBar(ctx, cx - BAT.allyHp.w / 2 + 8, BAT.ally.cy + BAT.allyHp.dy,
        BAT.allyHp.w, BAT.allyHp.h, hpr,
        { element: s.card.element, value: String(Math.floor(Math.max(0, s.hp))), valueColor: COLORS.hpNumAlly });
      // 怒气条（HP 条下方）：普攻/受击积攒，满 100 弹出技能星
      const rgy = BAT.ally.cy + BAT.allyHp.dy + BAT.allyHp.h + 5;
      this.rr(cx - BAT.allyHp.w / 2 + 8, rgy, BAT.allyHp.w, 7, 3.5);
      ctx.fillStyle = 'rgba(16,10,26,0.9)'; ctx.fill();
      const rgr = Math.min(1, s.rage / 100);
      if (rgr > 0) {
        const rg = ctx.createLinearGradient(cx - BAT.allyHp.w / 2, rgy, cx + BAT.allyHp.w / 2, rgy);
        rg.addColorStop(0, '#7a4fe8'); rg.addColorStop(1, rgr >= 1 ? '#ff5ce8' : '#b48cff');
        ctx.save();
        if (rgr >= 1) { ctx.shadowColor = '#ff5ce8'; ctx.shadowBlur = 10; }
        this.rr(cx - BAT.allyHp.w / 2 + 8, rgy, BAT.allyHp.w * rgr, 7, 3.5);
        ctx.fillStyle = rg; ctx.fill();
        ctx.restore();
      }
      // 技能星：仅满怒时弹出（水晶质感，点击放大招）
      if (this.battlePhase === 'fighting' && s.hp > 0 && s.rage >= 100) {
        const stx = cx, sty = BAT.ally.cy + BAT.star.dy;
        drawSkillStar(ctx, stx, sty, BAT.star.r, t + i * 0.7, this.hover === `star:${i}`);
        this.buttons.push({ x: stx - BAT.star.r, y: sty - BAT.star.r, w: BAT.star.r * 2, h: BAT.star.r * 2, id: `star:${i}` });
      }
      x += BAT.ally.cw + BAT.ally.gap;
    }

    // 普攻按钮（手动模式唯一出手方式：攒怒；满怒卡自动放技能）
    if (this.battlePhase === 'fighting' && !b.auto && !b.victory && !b.defeated) {
      glassButton(ctx, W / 2 - 100, 664, 200, 58, '⚔ 攻击', {
        kind: 'red', hover: this.hover === 'batAttack', fontSize: 24,
      });
      this.buttons.push({ x: W / 2 - 100, y: 664, w: 200, h: 58, id: 'batAttack' });
    }

    // 撤退 / 自动（橙金圆钮；自动开启时变绿显示「自动中」）
    drawCircleButton(ctx, BAT.retreat.cx, BAT.retreat.cy, BAT.retreat.r, '撤退', this.hover === 'batRetreat');
    this.buttons.push({ x: BAT.retreat.cx - BAT.retreat.r, y: BAT.retreat.cy - BAT.retreat.r, w: BAT.retreat.r * 2, h: BAT.retreat.r * 2, id: 'batRetreat' });
    drawCircleButton(ctx, BAT.auto.cx, BAT.auto.cy, BAT.auto.r, b.auto ? '自动中' : '自动', this.hover === 'batAuto', b.auto);
    this.buttons.push({ x: BAT.auto.cx - BAT.auto.r, y: BAT.auto.cy - BAT.auto.r, w: BAT.auto.r * 2, h: BAT.auto.r * 2, id: 'batAuto' });

    // ── 技能演出：全屏压暗脉冲 + 技能名横幅 ──
    if (this.skillCineT > 0) {
      const a = Math.min(0.42, this.skillCineT * 1.2);
      ctx.fillStyle = `rgba(2,2,10,${a.toFixed(3)})`;
      ctx.fillRect(0, 0, W, H);
      const bp = Math.min(1, (0.8 - this.skillCineT) / 0.15);
      ctx.save();
      ctx.globalAlpha = Math.min(1, this.skillCineT / 0.25);
      engravedText(ctx, `★ ${this.skillCineName} ★`, W / 2, 96, 26 + Ease.outBack(bp) * 4);
      ctx.restore();
    }

    // ── 技能特效 + 伤害飘字（此前只更新未绘制，战斗看不到光影）──
    this.renderFx();
    for (const d of b.dmgFloat) {
      const a = Math.max(0, 1 - d.t);
      const dy = d.t * 70;
      // 弹出：前 0.18t 从 1.6 倍缩放到 1 倍（打击感）
      const pop = d.t < 0.18 ? 1.6 - Ease.outBack(d.t / 0.18) * 0.6 : 1;
      const fs = (d.crit ? 44 : 34) * pop;
      ctx.save();
      ctx.globalAlpha = a;
      ctx.font = `bold ${fs.toFixed(1)}px "Cinzel", "PingFang SC", system-ui, sans-serif`;
      ctx.textAlign = 'center';
      ctx.lineWidth = 6; ctx.strokeStyle = 'rgba(0,0,0,0.8)';
      ctx.strokeText(d.v, d.x, d.y - dy);
      ctx.fillStyle = d.color;
      ctx.fillText(d.v, d.x, d.y - dy);
      // 克制/抵抗标签（原版 WEAK 横幅风格）
      if ((d.em ?? 1) > 1.05 || (d.em ?? 1) < 0.95) {
        const weak = (d.em ?? 1) > 1.05;
        const label = weak ? 'WEAK' : 'RESIST';
        ctx.font = 'bold 15px "Cinzel", "PingFang SC", system-ui, sans-serif';
        ctx.lineWidth = 4; ctx.strokeStyle = weak ? '#6a4a08' : 'rgba(0,0,0,0.8)';
        ctx.strokeText(label, d.x, d.y - dy - fs * 0.8);
        ctx.fillStyle = weak ? '#ffd24d' : '#b8c0d0';
        ctx.fillText(label, d.x, d.y - dy - fs * 0.8);
      }
      ctx.restore();
    }
  }

  /** 探索框架数据（进度条/行动力/资源栏） */
  private exploreChromeData(): ExploreChromeData {
    const s = this.activeStage;
    return {
      stageLabel: s.stageId.replace('r', '').replace('-s', '-'),
      progRatio: this.displayProg,
      progText: `${Math.floor(this.displayProg * 100)}%`,
      energy: this.db.user.energy, energyMax: this.db.user.energyMax,
      resources: [
        { icon: '🪙', value: String(this.db.user.gold) },
        { icon: '🧪', value: String(this.db.inventory.materials.upgradePotion || 0) },
        { icon: '⚙️', value: String(this.db.user.friendPt) },
        { icon: '💎', value: String(this.db.user.gems) },
      ],
    };
  }

  /** 底部队伍条数据 */
  private teamStripData(): { card: Card; lv: number; rarityTag: string; hpRatio: number; element: string }[] {
    return this.teamCombatants().map(c => ({
      card: c.card, lv: c.lv, rarityTag: c.card.rarity,
      hpRatio: c.hpMax > 0 ? Math.max(0, c.hp / c.hpMax) : 1, element: c.card.element,
    }));
  }

  /**
   * 绘制技能特效：10 种魔法弹道 + 命中爆炸
   * - 弹道阶段：魔法弹/光束/陨石从施法卡飞向目标
   * - 命中阶段：爆炸粒子 + 冲击波光环
   */
  private renderFx(): void {
    const ctx = this.ctx;
    const b = this.battle;
    if (!b) return;
    ctx.save();
    ctx.globalCompositeOperation = 'lighter'; // 叠加发光

    for (const fx of b.fx) {
      const p = Math.max(0, Math.min(1, fx.t - fx.delay)); // 已播放进度（扣除延迟）
      if (p <= 0) continue;
      const k = fx.kind;
      const x = fx.sx + (fx.tx - fx.sx) * Math.min(1, p / fx.hitT);
      const y = fx.sy + (fx.ty - fx.sy) * Math.min(1, p / fx.hitT);

      // ── 弹道表现 ──
      if (k === 'fire') {
        // 火球：橙红核心 + 黄色拖尾
        const trail = Math.max(0, p / fx.hitT);
        for (let i = 1; i <= 5; i++) {
          const tt = trail - i * 0.045;
          if (tt <= 0) break;
          const tx = fx.sx + (fx.tx - fx.sx) * tt;
          const ty = fx.sy + (fx.ty - fx.sy) * tt;
          ctx.globalAlpha = 0.5 * (1 - i / 6);
          ctx.fillStyle = i % 2 ? '#ffb84d' : '#ff5c3c';
          ctx.beginPath(); ctx.arc(tx, ty, 14 - i * 2, 0, Math.PI * 2); ctx.fill();
        }
        ctx.globalAlpha = 1;
        ctx.fillStyle = '#fff3b0';
        ctx.beginPath(); ctx.arc(x, y, 10, 0, Math.PI * 2); ctx.fill();
      } else if (k === 'ice') {
        // 冰晶：旋转菱形冰棱 + 蓝白拖尾
        for (let i = 1; i <= 4; i++) {
          const tt = Math.max(0, p / fx.hitT) - i * 0.05;
          if (tt <= 0) break;
          const tx = fx.sx + (fx.tx - fx.sx) * tt;
          const ty = fx.sy + (fx.ty - fx.sy) * tt;
          ctx.globalAlpha = 0.6 * (1 - i / 5);
          ctx.fillStyle = '#bff0ff';
          ctx.beginPath(); ctx.arc(tx, ty, 8 - i, 0, Math.PI * 2); ctx.fill();
        }
        ctx.globalAlpha = 1;
        ctx.save();
        ctx.translate(x, y); ctx.rotate(b.t * 8);
        ctx.fillStyle = '#e8fbff'; ctx.strokeStyle = '#6fd8ff'; ctx.lineWidth = 2;
        ctx.beginPath();
        ctx.moveTo(0, -11); ctx.lineTo(8, 0); ctx.lineTo(0, 11); ctx.lineTo(-8, 0);
        ctx.closePath(); ctx.fill(); ctx.stroke();
        ctx.restore();
      } else if (k === 'thunder') {
        // 雷霆：瞬间闪电劈落（弹道阶段直接画折线到目标）
        ctx.strokeStyle = '#fff7c0'; ctx.lineWidth = 3; ctx.shadowColor = '#ffe14d'; ctx.shadowBlur = 14;
        ctx.globalAlpha = Math.max(0, 1 - (p / fx.hitT) * 1.6);
        ctx.beginPath();
        ctx.moveTo(x, y);
        let cx = fx.sx, cy = fx.sy;
        const segs = 7;
        for (let s = 1; s <= segs; s++) {
          const tt = s / segs;
          const bx = fx.sx + (fx.tx - fx.sx) * tt + (Math.random() - 0.5) * 34;
          const by = fx.sy + (fx.ty - fx.sy) * tt + (Math.random() - 0.5) * 26;
          ctx.lineTo(cx + (bx - cx) * 0.7, cy + (by - cy) * 0.7);
          cx = bx; cy = by;
        }
        ctx.lineTo(fx.tx, fx.ty);
        ctx.stroke();
        ctx.shadowBlur = 0;
        ctx.globalAlpha = 1;
      } else if (k === 'holy') {
        // 圣光：金色光柱（无弹道，目标处垂直光柱）
        const s = Math.min(1, p / fx.hitT);
        const grad = ctx.createLinearGradient(fx.tx, fx.ty - 160, fx.tx, fx.ty + 10);
        grad.addColorStop(0, 'rgba(255,243,176,0)');
        grad.addColorStop(0.5, 'rgba(255,243,176,0.55)');
        grad.addColorStop(1, 'rgba(255,255,255,0.95)');
        ctx.globalAlpha = s;
        ctx.fillStyle = grad;
        ctx.fillRect(fx.tx - 26, fx.ty - 160, 52, 175);
        ctx.fillStyle = '#fff8d0';
        ctx.beginPath(); ctx.arc(fx.tx, fx.ty - 4, 30 * s, 0, Math.PI * 2); ctx.fill();
        ctx.globalAlpha = 1;
      } else if (k === 'shadow') {
        // 暗影：紫黑球体 + 深色尾迹
        const trail = Math.max(0, p / fx.hitT);
        for (let i = 1; i <= 5; i++) {
          const tt = trail - i * 0.045;
          if (tt <= 0) break;
          const tx = fx.sx + (fx.tx - fx.sx) * tt;
          const ty = fx.sy + (fx.ty - fx.sy) * tt;
          ctx.globalAlpha = 0.5 * (1 - i / 6);
          ctx.fillStyle = '#6a2a8a';
          ctx.beginPath(); ctx.arc(tx, ty, 13 - i * 2, 0, Math.PI * 2); ctx.fill();
        }
        ctx.globalAlpha = 1;
        ctx.fillStyle = '#c05ce8'; ctx.shadowColor = '#8a2ab0'; ctx.shadowBlur = 18;
        ctx.beginPath(); ctx.arc(x, y, 12, 0, Math.PI * 2); ctx.fill();
        ctx.shadowBlur = 0;
      } else if (k === 'meteor') {
        // 陨石：弧线下坠大陨石 + 火焰拖尾
        const tt = Math.min(1, p / fx.hitT);
        const mx = fx.sx + (fx.tx - fx.sx) * tt;
        const my = fx.sy + (fx.ty - fx.sy) * tt + Math.sin(tt * Math.PI) * -120;
        ctx.save();
        ctx.translate(mx, my); ctx.rotate(tt * 5);
        const g = ctx.createRadialGradient(0, 0, 2, 0, 0, 18);
        g.addColorStop(0, '#fff3b0'); g.addColorStop(0.5, '#ff7a3c'); g.addColorStop(1, '#7a2a14');
        ctx.fillStyle = g; ctx.shadowColor = '#ff5c3c'; ctx.shadowBlur = 24;
        ctx.beginPath(); ctx.arc(0, 0, 15, 0, Math.PI * 2); ctx.fill();
        ctx.restore();
        // 拖尾
        for (let i = 1; i <= 6; i++) {
          const dt = tt - i * 0.05;
          if (dt <= 0) break;
          const dx = fx.sx + (fx.tx - fx.sx) * dt;
          const dy = fx.sy + (fx.ty - fx.sy) * dt + Math.sin(dt * Math.PI) * -120;
          ctx.globalAlpha = 0.5 * (1 - i / 7);
          ctx.fillStyle = i % 2 ? '#ff9c3c' : '#ff5c3c';
          ctx.beginPath(); ctx.arc(dx, dy, 12 - i * 1.5, 0, Math.PI * 2); ctx.fill();
        }
        ctx.globalAlpha = 1;
      } else if (k === 'wind') {
        // 疾风：旋转青色旋风
        ctx.save();
        ctx.translate(x, y); ctx.rotate(b.t * 12);
        ctx.strokeStyle = '#7cf0c0'; ctx.lineWidth = 3; ctx.shadowColor = '#3cf0a0'; ctx.shadowBlur = 12;
        for (let i = 0; i < 3; i++) {
          ctx.globalAlpha = 0.85 - i * 0.25;
          ctx.beginPath();
          ctx.arc(0, 0, 9 + i * 8, i * 2, i * 2 + Math.PI * 1.6);
          ctx.stroke();
        }
        ctx.restore();
        ctx.globalAlpha = 1; ctx.shadowBlur = 0;
      } else if (k === 'star') {
        // 星辰：闪烁星形 + 彩色光晕
        ctx.save();
        ctx.translate(x, y);
        const s = 10 + Math.sin(b.t * 14) * 3;
        ctx.fillStyle = '#ff9ce8'; ctx.shadowColor = '#ff9ce8'; ctx.shadowBlur = 16;
        ctx.beginPath();
        for (let i = 0; i < 10; i++) {
          const r = i % 2 ? s * 0.45 : s;
          const a = (i / 10) * Math.PI * 2 - Math.PI / 2;
          ctx.lineTo(Math.cos(a) * r, Math.sin(a) * r);
        }
        ctx.closePath(); ctx.fill();
        ctx.shadowBlur = 0;
        ctx.restore();
      } else if (k === 'heal') {
        // 生命：绿色上升光点（向目标汇聚）
        const s = Math.min(1, p / fx.hitT);
        ctx.globalAlpha = s;
        ctx.fillStyle = '#a5f8c0'; ctx.shadowColor = '#7cf08c'; ctx.shadowBlur = 12;
        for (let i = 0; i < 5; i++) {
          const a = (i / 5) * Math.PI * 2 + b.t * 2;
          const rr = 20 + Math.sin(b.t * 5 + i) * 6;
          ctx.beginPath();
          ctx.arc(fx.tx + Math.cos(a) * rr, fx.ty + Math.sin(a) * rr * 0.5, 4, 0, Math.PI * 2);
          ctx.fill();
        }
        ctx.shadowBlur = 0;
        ctx.globalAlpha = 1;
      } else {
        // arcane 奥术：蓝紫魔法弹 + 螺旋环
        ctx.fillStyle = '#9cb8ff'; ctx.shadowColor = '#6a8aff'; ctx.shadowBlur = 14;
        ctx.beginPath(); ctx.arc(x, y, 9, 0, Math.PI * 2); ctx.fill();
        ctx.strokeStyle = '#c8dcff'; ctx.lineWidth = 2;
        ctx.beginPath(); ctx.arc(x, y, 15 + Math.sin(b.t * 10) * 3, 0, Math.PI * 2); ctx.stroke();
        ctx.shadowBlur = 0;
      }

      // ── 命中爆炸：粒子 + 冲击波 ──
      if (p >= fx.hitT) {
        const hp = (p - fx.hitT) / (1 - fx.hitT); // 命中后进度 0..1
        // 冲击波光环
        ctx.globalAlpha = Math.max(0, 1 - hp) * 0.9;
        ctx.strokeStyle = '#ffffff';
        ctx.lineWidth = 4;
        ctx.beginPath();
        ctx.arc(fx.tx, fx.ty, 18 + hp * 90, 0, Math.PI * 2);
        ctx.stroke();
        ctx.globalAlpha = 1;
        // 爆炸粒子
        for (const pt of fx.boom) {
          const lp = Math.max(0, pt.life / pt.max);
          ctx.globalAlpha = lp;
          ctx.fillStyle = pt.color;
          ctx.beginPath();
          ctx.arc(pt.x, pt.y, pt.r * lp, 0, Math.PI * 2);
          ctx.fill();
        }
        ctx.globalAlpha = 1;
      }
    }
    ctx.restore();
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
    ctx.font = 'bold 90px "Cinzel", "PingFang SC", "Cinzel", "PingFang SC", system-ui, sans-serif';
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

    // ── 宝箱奖励 ──
    if (b.chest) { this.renderChest(b.chest); return; }

    glassButton(ctx, W / 2 - 110, H - 120, 220, 56, 'OK', { kind: 'green', hover: this.hover === 'victoryOk', fontSize: 22 });
    this.buttons.push({ x: W / 2 - 110, y: H - 120, w: 220, h: 56, id: 'victoryOk' });
  }

  /** 宝箱开箱：closed 卡包图 → opening 抖动爆发 → revealed 卡片逐张揭示 */
  private renderChest(c: ChestState): void {
    const ctx = this.ctx;
    const t = this.last / 1000;
    const qName = { silver: '白银宝箱', gold: '黄金宝箱', diamond: '钻石宝箱', legend: '稀有极品宝箱' }[c.quality];
    const qColor = { silver: '#c8d4e8', gold: '#ffd24d', diamond: '#6fd8ff', legend: '#ff5cf0' }[c.quality];

    if (c.phase === 'closed') {
      // 卡包图：呼吸光效 + 点击提示
      const breathe = 1 + Math.sin(t * 3) * 0.04;
      const size = 180 * breathe;
      const img = loadAssetImage(CHEST[c.quality]);
      ctx.save();
      ctx.shadowColor = qColor; ctx.shadowBlur = 40 + Math.sin(t * 3) * 15;
      if (img.complete && img.naturalWidth) {
        ctx.drawImage(img, W / 2 - size / 2, 300 - size / 2, size, size);
      } else {
        this.rr(W / 2 - size / 2, 300 - size / 2, size, size, 16);
        ctx.fillStyle = '#2a1a30'; ctx.fill();
        this.text('🎁', W / 2, 300, 64, qColor, 'center');
      }
      ctx.restore();
      // 标题 + 点击按钮
      engravedText(ctx, qName, W / 2, 430, 26);
      glassButton(ctx, W / 2 - 130, 470, 260, 60, '点击开启！', { kind: 'green', hover: this.hover === 'chestOpen', fontSize: 22 });
      this.buttons.push({ x: W / 2 - 130, y: 470, w: 260, h: 60, id: 'chestOpen' });
      return;
    }

    if (c.phase === 'opening') {
      // 抖动 + 光芒爆发
      const p = Math.min(1, c.t / 0.8);
      const shakeX = (Math.random() - 0.5) * 14 * (1 - p);
      const size = 180 * (1 + p * 0.3);
      const img = loadAssetImage(CHEST[c.quality]);
      ctx.save();
      ctx.translate(W / 2 + shakeX, 300);
      ctx.shadowColor = '#ffffff'; ctx.shadowBlur = 60 * p + 20;
      if (img.complete && img.naturalWidth) ctx.drawImage(img, -size / 2, -size / 2, size, size);
      ctx.restore();
      // 光柱
      ctx.save();
      ctx.globalCompositeOperation = 'lighter';
      const g = ctx.createLinearGradient(W / 2, 80, W / 2, 520);
      g.addColorStop(0, 'rgba(255,243,176,0)');
      g.addColorStop(0.5, `rgba(255,243,176,${0.5 * p})`);
      g.addColorStop(1, 'rgba(255,255,255,0)');
      ctx.fillStyle = g;
      ctx.fillRect(W / 2 - 60 * p, 80, 120 * p, 440);
      ctx.restore();
      return;
    }

    // revealed：卡片逐张弹出揭示
    const reward = c.reward;
    engravedText(ctx, `${qName} 开启！`, W / 2, 300, 24);
    if (reward) {
      const cards = reward.cards;
      const cw = 150, ch = 212, gap = 30;
      const totalW = cards.length * cw + (cards.length - 1) * gap;
      let x = W / 2 - totalW / 2;
      for (let i = 0; i < cards.length; i++) {
        const revealed = i < c.revealIdx;
        const card = getCard(cards[i].cardId);
        if (!card) { x += cw + gap; continue; }
        const popT = Math.max(0, Math.min(1, (c.t - i * 0.3) / 0.35));
        const pop = Ease.outBack(popT);
        ctx.save();
        ctx.translate(x + cw / 2, 430);
        ctx.scale(Math.max(0.02, pop), Math.max(0.02, pop));
        if (revealed) {
          ctx.shadowColor = RARITY_COLOR[card.rarity] || '#ffd24d';
          ctx.shadowBlur = 24;
          drawCard(ctx, card, 0, 0, cw, ch, { showName: true, rainbowT: (t * 0.3) % 1 });
        }
        ctx.restore();
        if (!revealed) {
          // 未揭示：卡背
          this.rr(x, 430 - ch / 2, cw, ch, 10);
          ctx.fillStyle = 'rgba(20,14,34,0.9)'; ctx.fill();
          ctx.strokeStyle = qColor; ctx.lineWidth = 2; ctx.stroke();
        }
        x += cw + gap;
      }
      // 附加奖励
      const extras: string[] = [`金币+${reward.gold.toLocaleString()}`];
      if (reward.gems > 0) extras.push(`宝石+${reward.gems}`);
      if (reward.potions > 0) extras.push(`强化药水×${reward.potions}`);
      this.text(extras.join('   '), W / 2, 590, 16, '#ffe9a8', 'center', 'bold');
    }
    // 全部揭示后显示 OK
    const allRevealed = c.revealIdx >= (reward?.cards.length ?? 0);
    glassButton(ctx, W / 2 - 110, H - 110, 220, 56, allRevealed ? '收下奖励' : '快进', {
      kind: 'green', hover: this.hover === 'victoryOk', fontSize: 20,
    });
    this.buttons.push({ x: W / 2 - 110, y: H - 110, w: 220, h: 56, id: 'victoryOk' });
  }

  private renderHall(): void {
    const ctx = this.ctx;
    this.buttons = [];
    const meta = this.meta.get(this.banner.id);
    const t = this.last / 1000;

    // ── 顶栏下方：所持卡片数 / 签到 / 商店 ──
    this.cardCount = this.db.inventory.cards.length;
    this.pill(20, 64, 250, 32, '#0d0a16', '#c8b285');
    this.text(`所持卡片数：${this.cardCount}/${this.db.inventory.capacity}`, 145, 81, 14, '#e8d5a8', 'center', 'bold');
    this.buttons.push({ x: 20, y: 64, w: 250, h: 32, id: 'nav:inventory' });
    this.pill(W - 190, 64, 170, 34, '#e8b23b', '#ffe9a8');
    this.text('❋ 商 店', W - 105, 82, 15, '#1a1206', 'center', 'bold');
    this.buttons.push({ x: W - 190, y: 64, w: 170, h: 34, id: 'exchange' });
    // 签到入口（未签到时金色呼吸提示）
    const canLogin = canClaimLogin(this.db);
    this.pill(W - 340, 64, 136, 34, canLogin ? '#3a2a08' : '#1a1626', canLogin ? '#ffd24d' : '#4a4460');
    this.text(canLogin ? '✦ 签到有礼' : '每日签到', W - 272, 82, 13, canLogin ? '#ffd24d' : '#8892a8', 'center', 'bold');
    this.buttons.push({ x: W - 340, y: 64, w: 136, h: 34, id: 'openLogin' });

    // ── 左侧：看板娘版面 ──
    this.renderNaviPanel(16, 108, 296, 560);

    // ── 中间：当前卡池 ──
    const bx = 326, by = 108, bw = 584, bh = 520;
    ctx.save();
    this.rr(bx, by, bw, bh, 12); ctx.clip();
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
    // 顶部渐变压暗（标题/概率文字在立绘上可读）
    const gTop = ctx.createLinearGradient(0, by, 0, by + 150);
    gTop.addColorStop(0, 'rgba(6,4,14,0.88)');
    gTop.addColorStop(1, 'rgba(6,4,14,0)');
    ctx.fillStyle = gTop;
    ctx.fillRect(bx, by, bw, 150);
    ctx.restore();
    ctx.strokeStyle = this.banner.accent;
    ctx.lineWidth = 2;
    this.rr(bx, by, bw, bh, 12); ctx.stroke();

    // 卡池标题 + 倒计时（顶部压暗带上，行距固定不叠字）
    this.text(this.banner.name, bx + 20, by + 32, 22, this.banner.accent, 'left', 'bold', true);
    const remain = Math.max(0, (meta?.endAt ?? Date.now()) - Date.now());
    const dd = Math.floor(remain / 86400000);
    const hh = Math.floor((remain % 86400000) / 3600000);
    this.pill(bx + 20, by + 46, 196, 22, '#0d0a16', '#c8b285');
    this.text(`【距离结束还有】${dd}天${hh}小时`, bx + 118, by + 61, 11, '#ffe9a8', 'center', 'bold');

    // 真实稀有度概率文案（右上，压暗带上）+ 离线演示标注
    const table = rateTable(this.banner);
    const lrE = table.find(r => r.rarity === 'LR');
    this.text(`LR 出现率 ${lrE ? lrE.pct.toFixed(1) + '%' : '—'}`,
      bx + bw - 20, by + 32, 13, '#ffe14d', 'right', 'bold');
    this.text('离线演示配置 · 非原版概率', bx + bw - 20, by + 50, 10, '#b8aec8', 'right');

    // 精选缩略卡（点详情；右对齐最多 4 张，不越出 banner）
    const show = bannerShowcase(this.banner, 1).slice(0, 4);
    show.forEach((c, i) => {
      const cx = bx + bw - 46 - i * 58, cy = by + 182;
      drawCard(ctx, c, cx, cy, 52, 74, { showName: false, showBadge: true });
      this.buttons.push({ x: cx - 26, y: cy - 37, w: 52, h: 74, id: 'rates' });
    });

    // 保底进度条（多档：UR/LR 各一行胶囊，固定行距）
    const tiers = this.gacha.pityProgressAll(this.banner);
    tiers.forEach((t, i) => {
      const px0 = bx + 20, py0 = by + 80 + i * 32, pw2 = 100;
      this.pill(px0 - 10, py0 - 4, 348, 26, '#0d0a16', '#c8b285');
      const ratio = Math.min(1, t.current / t.threshold);
      ctx.save();
      this.rr(px0, py0 + 5, pw2, 12, 6);
      ctx.fillStyle = '#241a30'; ctx.fill();
      if (ratio > 0) {
        ctx.fillStyle = t.rarity === 'LR' ? '#ff5c8a' : '#ffd24d';
        this.rr(px0, py0 + 5, Math.max(12, pw2 * ratio), 12, 6); ctx.fill();
      }
      ctx.restore();
      this.text(`距 ${t.rarity} 保底还差 ${Math.max(0, t.threshold - t.current)} 抽`,
        px0 + pw2 + 12, py0 + 12, 12, '#e8d5a8', 'left', 'bold');
    });

    // 说明文案
    const tagline = meta?.tagline ?? '';
    this.wrapText(tagline, bx + 20, by + bh - 178, bw - 40, 16, 14, '#f0e6cc', 'bold');

    // 四按钮（2×2）：上排 单抽(钻) / 十连(钻)，下排 单抽(券) / 十连(券)
    const tickets = meta?.tickets ?? 0;
    const btnY = by + bh - 74;
    const b1 = btnY - 68, b2 = btnY;
    const bw2 = 272;
    this.summonButton(bx + 16, b1, bw2, 58, `用 💎 ${this.banner.costSingle}`, `召唤 1 次`, this.jewels >= this.banner.costSingle, 'pull1');
    this.summonButton(bx + 296, b1, bw2, 58, `用 💎 ${this.banner.costTen}`, `进行 10 连召唤`, this.jewels >= this.banner.costTen, 'pull10');
    this.summonButton(bx + 16, b2, bw2, 58, `用 1 张召唤券`, `召唤 1 次`, tickets > 0, 'pull1ticket');
    this.summonButton(bx + 296, b2, bw2, 58, `用 10 张召唤券`, `进行 10 连召唤`, tickets >= 10, 'pull10ticket');
    // 持有数（banner 下方独立行，左对齐）
    this.text(`目前持有数  🎟 ${tickets}  /  💎 ${this.jewels.toLocaleString()}`,
      bx + 20, by + bh + 27, 13, '#ffe9a8', 'left', 'bold');

    // 提供比率一览（banner 下方右侧，与持有数同行不叠字）
    this.pill(bx + bw - 220, by + bh + 8, 220, 34, '#0d0a16', '#c8b285');
    this.text('提供比率一览', bx + bw - 110, by + bh + 30, 14, '#e8d5a8', 'center', 'bold');
    this.buttons.push({ x: bx + bw - 220, y: by + bh + 8, w: 220, h: 34, id: 'rates' });

    // ── 右侧：卡池列表（完整放下 7 个池） ──
    const rx = bx + bw + 14, rw = W - rx - 16;
    const availH = H - 108 - 92; // 顶栏与底部导航之间
    const itemH = Math.min(92, Math.floor((availH - (BANNERS.length - 1) * 8) / BANNERS.length));
    let ry = 108;
    for (const b of BANNERS) {
      this.renderBannerListItem(b, rx, ry, rw, itemH);
      ry += itemH + 8;
    }

    // 提供比率浮层
    if (this.showRates) this.renderRatesOverlay();
  }

  /** 看板娘版面：立绘轮播（呼吸 + 交叉淡入）+ 名牌 */
  private renderNaviPanel(x: number, y: number, w: number, h: number): void {
    const ctx = this.ctx;
    const t = this.last / 1000;
    const ROT = 12, FADE = 1.4;
    const idx = Math.floor(t / ROT) % NAVI_SPRITES.length;
    const nidx = (idx + 1) % NAVI_SPRITES.length;
    const fade = Math.min(1, Math.max(0, (t % ROT - (ROT - FADE)) / FADE));
    const cur = this.naviLoader.get(naviSprite(idx));
    const nxt = this.naviLoader.get(naviSprite(nidx));

    // 面板底
    this.rr(x, y, w, h, 14);
    ctx.fillStyle = 'rgba(10,8,20,0.5)';
    ctx.fill();

    ctx.save();
    this.rr(x, y, w, h, 14); ctx.clip();
    const breathe = 1 + Math.sin(t * 0.8) * 0.012;
    const drawSprite = (img: HTMLImageElement, alpha: number) => {
      if (!img.complete || !img.naturalWidth) return;
      const sc = ((h - 60) / img.naturalHeight) * breathe;
      const dw = img.naturalWidth * sc, dh = img.naturalHeight * sc;
      ctx.globalAlpha = alpha;
      ctx.drawImage(img, x + (w - dw) / 2, y + h - 56 - dh, dw, dh);
      ctx.globalAlpha = 1;
    };
    drawSprite(cur, 1);
    if (fade > 0) drawSprite(nxt, fade);
    // 底部名牌渐变压暗
    const g = ctx.createLinearGradient(0, y + h - 100, 0, y + h);
    g.addColorStop(0, 'rgba(6,4,14,0)');
    g.addColorStop(1, 'rgba(6,4,14,0.95)');
    ctx.fillStyle = g;
    ctx.fillRect(x, y + h - 100, w, 100);
    ctx.restore();

    // 边框 + 角饰
    ctx.strokeStyle = '#c8b285';
    ctx.lineWidth = 2;
    this.rr(x, y, w, h, 14); ctx.stroke();

    // 台词气泡（随立绘轮换，淡入淡出同步）
    const line = NAVI_LINES[(fade > 0.5 ? nidx : idx) % NAVI_LINES.length];
    this.speechBubble(x + 14, y + 12, w - 28, line);

    // 名牌
    const name = naviName(naviSprite(fade > 0.5 ? nidx : idx));
    this.text('─ 今日向导 ─', x + w / 2, y + h - 46, 11, '#cfc4a8', 'center');
    this.text(name, x + w / 2, y + h - 22, 18, '#ffe9a8', 'center', 'bold', true);
  }

  private imgOf(card: Card): HTMLImageElement | null {
    return getImage(card);
  }

  /** 看板娘台词气泡：圆角白底 + 小尾巴，自动换行 */
  private speechBubble(x: number, y: number, w: number, line: string): void {
    const ctx = this.ctx;
    ctx.save();
    ctx.font = '12px "Cinzel", "PingFang SC", "Cinzel", "PingFang SC", system-ui, sans-serif';
    const lines: string[] = [];
    let cur = '';
    for (const ch of line) {
      if (cur && ctx.measureText(cur + ch).width > w - 22) { lines.push(cur); cur = ch; }
      else cur += ch;
    }
    if (cur) lines.push(cur);
    const lh = 17, bh = lines.length * lh + 14;
    ctx.fillStyle = 'rgba(255,250,236,0.92)';
    this.rr(x, y, w, bh, 9); ctx.fill();
    ctx.beginPath();
    ctx.moveTo(x + w / 2 - 7, y + bh - 1);
    ctx.lineTo(x + w / 2 + 7, y + bh - 1);
    ctx.lineTo(x + w / 2, y + bh + 9);
    ctx.closePath(); ctx.fill();
    ctx.strokeStyle = 'rgba(140,105,55,0.55)'; ctx.lineWidth = 1;
    this.rr(x, y, w, bh, 9); ctx.stroke();
    ctx.fillStyle = '#4a3a20';
    ctx.textAlign = 'center'; ctx.textBaseline = 'top';
    lines.forEach((l, i) => ctx.fillText(l, x + w / 2, y + 7 + i * lh));
    ctx.restore();
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

  /** 原版风格圆形大按钮：外圈深色描边 + 内圈竖向渐变 + 顶部高光 */
  private roundButton(cx: number, cy: number, r: number, label: string, base: string, hi: string, hover: boolean): void {
    const ctx = this.ctx;
    ctx.save();
    // 外圈
    ctx.beginPath(); ctx.arc(cx, cy, r, 0, Math.PI * 2);
    ctx.fillStyle = 'rgba(10,8,18,0.85)'; ctx.fill();
    // 内圈渐变
    const g = ctx.createLinearGradient(cx, cy - r, cx, cy + r);
    g.addColorStop(0, hi); g.addColorStop(0.55, base); g.addColorStop(1, '#1a0f08');
    ctx.beginPath(); ctx.arc(cx, cy, r - 6, 0, Math.PI * 2);
    ctx.fillStyle = g; ctx.fill();
    // 顶部高光
    ctx.beginPath(); ctx.ellipse(cx, cy - r * 0.42, r * 0.62, r * 0.3, 0, 0, Math.PI * 2);
    ctx.fillStyle = 'rgba(255,255,255,0.28)'; ctx.fill();
    // 描边 + hover 发光
    ctx.beginPath(); ctx.arc(cx, cy, r - 3, 0, Math.PI * 2);
    ctx.strokeStyle = hover ? '#fff3b0' : 'rgba(255,255,255,0.5)';
    ctx.lineWidth = hover ? 3 : 1.5;
    if (hover) { ctx.shadowColor = '#ffe14d'; ctx.shadowBlur = 18; }
    ctx.stroke();
    ctx.shadowBlur = 0;
    // 文字
    ctx.font = `bold ${r * 0.34}px "Cinzel", "PingFang SC", "Cinzel", "PingFang SC", system-ui, sans-serif`;
    ctx.textAlign = 'center'; ctx.textBaseline = 'middle';
    ctx.lineWidth = 4; ctx.strokeStyle = 'rgba(0,0,0,0.7)';
    ctx.strokeText(label, cx, cy + 2);
    ctx.fillStyle = '#ffffff';
    ctx.fillText(label, cx, cy + 2);
    ctx.textBaseline = 'alphabetic';
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
    ctx.font = `bold 14px "Cinzel", "PingFang SC", "Cinzel", "PingFang SC", system-ui, sans-serif`;
    ctx.textAlign = 'center'; ctx.textBaseline = 'middle';
    ctx.fillStyle = '#d8ffd8';
    ctx.shadowColor = 'rgba(0,0,0,0.6)'; ctx.shadowBlur = 2; ctx.shadowOffsetY = 1;
    ctx.fillText(l1, x + w / 2, y + h / 2 - 11);
    ctx.font = `bold 17px "Cinzel", "PingFang SC", "Cinzel", "PingFang SC", system-ui, sans-serif`;
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
      drawCard(ctx, pm, x + w - 56, y + h / 2, 62, h - 18, { showName: false, showBadge: false });
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
    ctx.font = `${weight} ${size}px "Cinzel", "PingFang SC", "Cinzel", "PingFang SC", system-ui, sans-serif`;
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
      const msg = ticket
        ? `使用 ${ten ? 10 : 1} 张${this.banner.id === 'friend' ? '友情券' : '召唤券'}进行召唤！`
        : `使用 💎 ${ten ? this.banner.costTen : this.banner.costSingle} 进行召唤！`;
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
    // 快速跳过：不看爆破与逐张揭示，直接展示全部结果
    glassButton(ctx, W - 176, H / 2 - 26, 156, 52, '快速跳过 ≫', {
      kind: 'blue', hover: this.hover === 'skipAll', fontSize: 17,
    });
    this.buttons.push({ x: W - 176, y: H / 2 - 26, w: 156, h: 52, id: 'skipAll' });
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

    // ── VR 专属：夜晚圣光（月亮 + 从天而降的圣光柱照亮全场 + 玻璃质感）──
    if (rank >= 7) this.drawVrHeaven(ctx, local, revealLocal);
    // ── LR 专属：天上太阳金光 + 光线收缩 + 气球 ──
    else if (rank >= 5) this.drawLrSun(ctx, local, revealLocal);
    // ── UR 专属：桃心背景 + 光束 ──
    else if (rank === 4) this.drawUrHearts(ctx, local, revealLocal);

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

    // UR 专属：紫色召唤阵（六芒星 + 旋转外环，卡片下层）
    if (rank === 4 && revealLocal > 0.02) {
      const ringP = Math.min(1, revealLocal / 0.3);
      ctx.save();
      ctx.globalCompositeOperation = 'lighter';
      ctx.translate(W / 2, H / 2);
      ctx.globalAlpha = ringP * 0.75;
      ctx.rotate(this.last / 1200);
      ctx.strokeStyle = '#b06ce8'; ctx.lineWidth = 3;
      ctx.beginPath(); ctx.arc(0, 0, 235 * ringP, 0, Math.PI * 2); ctx.stroke();
      ctx.strokeStyle = '#d8a8ff'; ctx.lineWidth = 2;
      for (const off of [0, Math.PI / 3]) {
        ctx.beginPath();
        for (let k = 0; k <= 3; k++) {
          const a = off + (k * Math.PI * 2) / 3;
          const px2 = Math.cos(a) * 205 * ringP, py2 = Math.sin(a) * 205 * ringP;
          if (k === 0) ctx.moveTo(px2, py2); else ctx.lineTo(px2, py2);
        }
        ctx.stroke();
      }
      // 逆向内环
      ctx.rotate(-this.last / 600);
      ctx.strokeStyle = '#8a4cd8'; ctx.lineWidth = 2;
      ctx.beginPath(); ctx.arc(0, 0, 150 * ringP, 0, Math.PI * 2); ctx.stroke();
      ctx.restore();
    }

    // 前兆文字
    if (highCard && local < omenEnd + 0.05) {
      const op = Math.sin((local / Math.max(0.01, omenEnd)) * Math.PI);
      ctx.save();
      ctx.globalAlpha = Math.max(0, op);
      const omenTxt = rank >= 7 ? '✦ 圣 光 降 临 ✦' : isLR ? '✦ 仙 神 下 凡 ✦' : '★ 稀有反应 ★';
      this.text(omenTxt, W / 2, H / 2 - 40, rank >= 7 ? 44 : isLR ? 40 : 28, col, 'center', 'bold', true);
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

      // LR 仙神下凡：金白羽毛飘落（前景）+ 地面光环波纹
      if (isLR) {
        if (revealLocal > 0.15) {
          const featherA = Math.min(1, (revealLocal - 0.15) / 0.15);
          const fallT = revealLocal * dur;
          ctx.save();
          for (let i = 0; i < 26; i++) {
            const seed = i * 137.51;
            const fx = (Math.sin(seed) * 0.5 + 0.5) * W;
            const fallSpeed = 110 + (i % 5) * 42;
            const fy = ((fallT * fallSpeed + i * 97) % (H + 80)) - 40;
            const sway = Math.sin(this.last / 300 + i) * 24;
            ctx.save();
            ctx.globalAlpha = (0.45 + 0.4 * Math.sin(seed * 3.7) ** 2) * featherA;
            ctx.translate(fx + sway, fy);
            ctx.rotate(Math.sin(this.last / 400 + i * 2) * 0.6);
            ctx.fillStyle = '#fff8e8';
            ctx.beginPath(); ctx.ellipse(0, 0, 4, 10, 0, 0, Math.PI * 2); ctx.fill();
            ctx.strokeStyle = 'rgba(200,170,90,0.7)'; ctx.lineWidth = 1;
            ctx.beginPath(); ctx.moveTo(0, -10); ctx.lineTo(0, 10); ctx.stroke();
            ctx.restore();
          }
          ctx.restore();
        }
        // 地面光环波纹（卡片落定后扩散）
        if (revealLocal > 0.55) {
          const gp = (revealLocal - 0.55) / 0.45;
          ctx.save();
          ctx.globalCompositeOperation = 'lighter';
          for (let k = 0; k < 3; k++) {
            const rp = (gp * 1.6 + k * 0.33) % 1;
            ctx.globalAlpha = (1 - rp) * 0.5;
            ctx.strokeStyle = '#ffe9a8'; ctx.lineWidth = 3;
            ctx.beginPath();
            ctx.ellipse(W / 2, H / 2 + 190, 60 + rp * 260, 18 + rp * 60, 0, 0, Math.PI * 2);
            ctx.stroke();
          }
          ctx.restore();
        }
      }

      // VR 专属：七彩礼花爆炸（卡片落定瞬间爆发）+ 持久礼花（七彩祥云般，久久不散）
      if (rank >= 7) {
        const burstP = revealLocal > 0.62 ? Math.min(1, (revealLocal - 0.62) / 0.18) : 0;
        if (burstP > 0) {
          ctx.save();
          ctx.globalCompositeOperation = 'lighter';
          // 第一轮爆发：从卡片中心向四周放射
          for (let ring = 0; ring < 3; ring++) {
            const rp = Math.max(0, burstP - ring * 0.12);
            if (rp <= 0) continue;
            const rr = 40 + rp * 300;
            const hue0 = (this.last / 4 + ring * 60) % 360;
            ctx.globalAlpha = (1 - rp) * 0.9;
            ctx.lineWidth = 4 - ring;
            ctx.strokeStyle = `hsl(${hue0},100%,70%)`;
            ctx.beginPath(); ctx.arc(W / 2, H / 2, rr, 0, Math.PI * 2); ctx.stroke();
            // 粒子点
            for (let k = 0; k < 24; k++) {
              const a = (k / 24) * Math.PI * 2 + ring;
              const px = W / 2 + Math.cos(a) * rr, py = H / 2 + Math.sin(a) * rr;
              ctx.fillStyle = `hsl(${(hue0 + k * 15) % 360},100%,75%)`;
              ctx.beginPath(); ctx.arc(px, py, 3 - ring * 0.5, 0, Math.PI * 2); ctx.fill();
            }
          }
          ctx.restore();
        }
        // 持久礼花：上升后爆散（七彩，持续飘落）
        const fwA = Math.min(1, Math.max(0, (revealLocal - 0.3) / 0.4));
        if (fwA > 0) {
          const fallT = revealLocal * dur;
          ctx.save();
          for (let i = 0; i < 42; i++) {
            const seed = i * 47.13;
            const fx = (Math.sin(seed) * 0.5 + 0.5) * W;
            const upSpeed = 90 + (i % 6) * 30;
            const fy = H + 40 - ((fallT * upSpeed + i * 113) % (H + 120));
            const sway = Math.sin(this.last / 260 + i * 1.3) * 30;
            ctx.globalAlpha = (0.5 + 0.4 * Math.sin(seed * 2.3) ** 2) * fwA;
            ctx.fillStyle = `hsl(${(seed * 57) % 360},100%,72%)`;
            ctx.beginPath(); ctx.arc(fx + sway, fy, 2.5 + (i % 3), 0, Math.PI * 2); ctx.fill();
            // 拖尾
            ctx.globalAlpha *= 0.4;
            ctx.beginPath(); ctx.arc(fx + sway, fy + 8, 2, 0, Math.PI * 2); ctx.fill();
          }
          ctx.restore();
        }
      }

      // UR 紫电弧（前景，冷色调与 LR 区分）
      if (rank === 4 && revealLocal > 0.1 && revealLocal < 0.75) {
        ctx.save();
        ctx.globalCompositeOperation = 'lighter';
        if (Math.sin(this.last / 60) > -0.2) {
          ctx.strokeStyle = '#e8c8ff'; ctx.lineWidth = 2.5;
          for (let b = 0; b < 3; b++) {
            ctx.beginPath();
            let ex = W / 2 + Math.sin(b * 91.7) * 0.5 * W * 0.4, ey = 0;
            ctx.moveTo(ex, ey);
            for (let s = 1; s <= 6; s++) {
              ex += Math.sin(this.last / 50 + b * 7 + s * 13.3) * 46;
              ey = (H * 0.55 * s) / 6;
              ctx.lineTo(ex, ey);
            }
            ctx.stroke();
          }
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
      ctx.font = `bold ${isLR ? 52 : 42}px "Cinzel", "PingFang SC", "Cinzel", "PingFang SC", system-ui, sans-serif`;
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
    // 快速跳过：直接展示全部结果（右侧常驻）
    glassButton(ctx, W - 176, H / 2 - 26, 156, 52, '快速跳过 ≫', {
      kind: 'blue', hover: this.hover === 'skipAll', fontSize: 17,
    });
    this.buttons.push({ x: W - 176, y: H / 2 - 26, w: 156, h: 52, id: 'skipAll' });
  }

  /** VR 圣光场景：夜晚月亮 + 圣光柱照亮全场 + 七彩玻璃辉光（卡片从月亮下方缓缓升起，礼花持久） */
  private drawVrHeaven(ctx: CanvasRenderingContext2D, local: number, rl: number): void {
    const t = this.last / 1000;
    // 夜晚天空（深蓝紫渐变）
    const sky = ctx.createLinearGradient(0, 0, 0, H * 0.7);
    sky.addColorStop(0, '#05030f');
    sky.addColorStop(0.5, '#0a0620');
    sky.addColorStop(1, '#1a0f3a');
    ctx.fillStyle = sky;
    ctx.fillRect(0, 0, W, H * 0.7);
    // 星星
    ctx.save();
    for (let i = 0; i < 60; i++) {
      const sx = (Math.sin(i * 127.1) * 0.5 + 0.5) * W;
      const sy = (Math.sin(i * 311.7) * 0.5 + 0.5) * H * 0.55;
      const tw = 0.3 + 0.7 * Math.abs(Math.sin(t * 1.5 + i));
      ctx.globalAlpha = tw * 0.8;
      ctx.fillStyle = '#dfe8ff';
      ctx.fillRect(sx, sy, 2, 2);
    }
    // 月亮（右上）：圣光源头
    const mx = W * 0.78, my = H * 0.16;
    const moonG = ctx.createRadialGradient(mx, my, 0, mx, my, 90);
    moonG.addColorStop(0, '#fffde8');
    moonG.addColorStop(0.4, '#f8ecc8');
    moonG.addColorStop(1, 'rgba(248,236,200,0)');
    ctx.fillStyle = moonG;
    ctx.beginPath(); ctx.arc(mx, my, 90, 0, Math.PI * 2); ctx.fill();
    ctx.globalAlpha = 1;
    ctx.fillStyle = '#fff8dc';
    ctx.beginPath(); ctx.arc(mx, my, 34, 0, Math.PI * 2); ctx.fill();
    // 月面暗斑
    ctx.fillStyle = 'rgba(200,180,120,0.5)';
    ctx.beginPath(); ctx.arc(mx - 9, my - 4, 7, 0, Math.PI * 2); ctx.fill();
    ctx.beginPath(); ctx.arc(mx + 7, my + 8, 5, 0, Math.PI * 2); ctx.fill();
    ctx.restore();

    // 圣光柱：从月亮照向卡片位置（随 rl 渐亮渐宽）
    const coneA = Math.min(1, rl * 1.8);
    ctx.save();
    ctx.globalCompositeOperation = 'lighter';
    const grad = ctx.createLinearGradient(mx, my, W / 2, H * 0.62);
    grad.addColorStop(0, 'rgba(255,250,230,0.95)');
    grad.addColorStop(1, 'rgba(255,255,255,0)');
    ctx.fillStyle = grad;
    ctx.globalAlpha = coneA;
    ctx.beginPath();
    ctx.moveTo(mx, my);
    const spread = 60 + coneA * 260;
    ctx.lineTo(W / 2 - spread, H * 0.62);
    ctx.lineTo(W / 2 + spread, H * 0.62);
    ctx.closePath();
    ctx.fill();
    // 全场圣光白雾（从下往上渐亮）
    const fog = ctx.createLinearGradient(0, H * 0.45, 0, H);
    fog.addColorStop(0, 'rgba(255,250,235,0)');
    fog.addColorStop(1, `rgba(255,250,235,${(0.28 * coneA).toFixed(3)})`);
    ctx.fillStyle = fog;
    ctx.fillRect(0, 0, W, H);
    ctx.restore();

    // 七彩玻璃辉光（卡片背后，呼吸闪烁）
    const hue = (t * 30) % 360;
    ctx.save();
    ctx.globalCompositeOperation = 'lighter';
    ctx.globalAlpha = 0.25 + 0.2 * Math.sin(t * 3);
    const glass = ctx.createRadialGradient(W / 2, H * 0.52, 0, W / 2, H * 0.52, 320);
    for (let k = 0; k <= 6; k++) {
      glass.addColorStop(k / 6, `hsla(${(hue + k * 60) % 360},95%,70%,${(1 - k / 6) * 0.5})`);
    }
    ctx.fillStyle = glass;
    ctx.beginPath(); ctx.arc(W / 2, H * 0.52, 320, 0, Math.PI * 2); ctx.fill();
    ctx.restore();
  }

  /** LR 太阳场景：天上太阳金光 + 光线收缩 + 两侧气球 + 花瓣 */
  private drawLrSun(ctx: CanvasRenderingContext2D, local: number, rl: number): void {
    const t = this.last / 1000;
    const sx = W / 2, sy = H * 0.13;
    // 金色天空
    const sky = ctx.createLinearGradient(0, 0, 0, H * 0.7);
    sky.addColorStop(0, '#2a1a02');
    sky.addColorStop(0.45, '#6b3a06');
    sky.addColorStop(1, '#120a02');
    ctx.fillStyle = sky;
    ctx.fillRect(0, 0, W, H * 0.7);
    // 太阳：金光闪闪（放射光线）
    ctx.save();
    ctx.globalCompositeOperation = 'lighter';
    const sunR = 70 + Math.sin(t * 2) * 6;
    const halo = ctx.createRadialGradient(sx, sy, 0, sx, sy, sunR * 3.4);
    halo.addColorStop(0, 'rgba(255,245,210,0.95)');
    halo.addColorStop(0.35, 'rgba(255,214,120,0.5)');
    halo.addColorStop(1, 'rgba(255,200,80,0)');
    ctx.fillStyle = halo;
    ctx.beginPath(); ctx.arc(sx, sy, sunR * 3.4, 0, Math.PI * 2); ctx.fill();
    // 放射光束（rl 早期展开，后期收缩）
    const rayP = rl < 0.3 ? rl / 0.3 : Math.max(0, 1 - (rl - 0.3) / 0.7);
    for (let i = 0; i < 24; i++) {
      const a = (i / 24) * Math.PI * 2 + t * 0.1;
      const len = sunR * (2 + rayP * 6);
      const g2 = ctx.createLinearGradient(sx, sy, sx + Math.cos(a) * len, sy + Math.sin(a) * len);
      g2.addColorStop(0, 'rgba(255,240,180,0.9)');
      g2.addColorStop(1, 'rgba(255,220,120,0)');
      ctx.strokeStyle = g2;
      ctx.lineWidth = 6;
      ctx.beginPath();
      ctx.moveTo(sx + Math.cos(a) * sunR, sy + Math.sin(a) * sunR);
      ctx.lineTo(sx + Math.cos(a) * len, sy + Math.sin(a) * len);
      ctx.stroke();
    }
    ctx.fillStyle = '#fff8d8';
    ctx.beginPath(); ctx.arc(sx, sy, sunR, 0, Math.PI * 2); ctx.fill();
    ctx.restore();
    // 两侧气球（上升漂浮）
    ctx.save();
    const bA = Math.min(1, rl / 0.2);
    for (let i = 0; i < 10; i++) {
      const side = i % 2 === 0 ? -1 : 1;
      const bx = W / 2 + side * (120 + (i % 5) * 90);
      const floatT = (t * 46 + i * 71) % (H + 160);
      const by = H + 60 - floatT;
      const hues = [0, 210, 280, 30, 120];
      const hc = hues[i % hues.length];
      ctx.globalAlpha = bA * (0.5 + 0.3 * Math.sin(t * 2 + i));
      ctx.fillStyle = `hsl(${hc},80%,62%)`;
      ctx.beginPath(); ctx.ellipse(bx, by, 14, 17, 0, 0, Math.PI * 2); ctx.fill();
      ctx.strokeStyle = `hsl(${hc},80%,45%)`;
      ctx.lineWidth = 1.5;
      ctx.beginPath(); ctx.moveTo(bx, by + 17); ctx.lineTo(bx, by + 26); ctx.stroke();
      ctx.beginPath(); ctx.moveTo(bx, by + 26); ctx.lineTo(bx - 5, by + 31); ctx.moveTo(bx, by + 26); ctx.lineTo(bx + 5, by + 31); ctx.stroke();
    }
    ctx.restore();
  }

  /** UR 桃心场景：背景全是桃心 + 光束 */
  private drawUrHearts(ctx: CanvasRenderingContext2D, local: number, rl: number): void {
    const t = this.last / 1000;
    const a = Math.min(1, rl / 0.15);
    ctx.save();
    // 桃心背景（粉紫渐变 + 浮动桃心）
    const bg = ctx.createLinearGradient(0, 0, 0, H);
    bg.addColorStop(0, '#2a0a24');
    bg.addColorStop(0.6, '#3d0f3a');
    bg.addColorStop(1, '#14061a');
    ctx.fillStyle = bg;
    ctx.fillRect(0, 0, W, H);
    ctx.globalAlpha = a * 0.85;
    for (let i = 0; i < 26; i++) {
      const hx = (Math.sin(i * 137.5) * 0.5 + 0.5) * W;
      const hy = ((t * 30 + i * 83) % (H + 60)) - 30;
      const hs = 10 + (i % 4) * 8;
      const hue = (330 + (i % 3) * 20 + Math.sin(t + i) * 15) % 360;
      ctx.fillStyle = `hsla(${hue},85%,72%,${0.5 + 0.3 * Math.sin(t * 2 + i)})`;
      ctx.save();
      ctx.translate(hx, hy);
      ctx.rotate(Math.sin(t + i) * 0.15);
      this.heartPath(ctx, 0, 0, hs);
      ctx.fill();
      ctx.restore();
    }
    // 光束（斜向两侧，rl 渐亮）
    ctx.globalCompositeOperation = 'lighter';
    for (const dir of [-1, 1]) {
      const g = ctx.createLinearGradient(W / 2, H * 0.3, W / 2 + dir * W, H);
      g.addColorStop(0, `rgba(255,190,240,${(0.5 * a).toFixed(3)})`);
      g.addColorStop(1, 'rgba(255,190,240,0)');
      ctx.fillStyle = g;
      ctx.beginPath();
      ctx.moveTo(W / 2 - dir * 60, H * 0.25);
      ctx.lineTo(W / 2 + dir * (W * 0.45), H * 0.75);
      ctx.lineTo(W / 2 + dir * (W * 0.6), H * 0.8);
      ctx.lineTo(W / 2 + dir * 120, H * 0.6);
      ctx.closePath();
      ctx.fill();
    }
    ctx.restore();
  }

  /** 桃心路径 */
  private heartPath(ctx: CanvasRenderingContext2D, x: number, y: number, s: number): void {
    ctx.beginPath();
    ctx.moveTo(x, y + s * 0.8);
    ctx.bezierCurveTo(x - s, y - s * 0.2, x - s * 0.5, y - s, x, y - s * 0.3);
    ctx.bezierCurveTo(x + s * 0.5, y - s, x + s, y - s * 0.2, x, y + s * 0.8);
    ctx.closePath();
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
    ctx.font = `${weight} ${size}px "Cinzel", "PingFang SC", "Cinzel", "PingFang SC", system-ui, sans-serif`;
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
