// Ember Warden: every tuning number, colour, wave and upgrade in one place.
// The playfield is a fixed 1280x720 logical area; the renderer scales it to the
// window, so no rule below depends on the screen size.

export const FIELD = { width: 1280, height: 720 };

/** The simulation's fixed step, in seconds: 60 updates a second whatever the display's rate. */
export const STEP = 1 / 60;

/** How many waves until the Night Herald, and the wave that ends the game in victory. */
export const FINAL_WAVE = 5;

export const PLAYER = {
  radius: 16,
  speed: 265,
  maxHp: 120,
  pickupRadius: 100,
  boltDamage: 14,
  boltSpeed: 540,
  boltRange: 420,
  fireInterval: 0.45,
  invulnerable: 0.6,
  dashCooldown: 2.5,
  dashTime: 0.18,
  dashSpeed: 820,
};

/** Experience needed to rise from `level` to the next one. */
export function xpForLevel(level) {
  return 8 + (level - 1) * 6;
}

/** Enemy kinds, by the name the HUD and the dossier show. */
export const ENEMY = {
  wisp: { hp: 12, speed: 72, radius: 13, damage: 8, xp: 1, score: 10 },
  skitter: { hp: 7, speed: 138, radius: 10, damage: 5, xp: 1, score: 15 },
  brute: { hp: 46, speed: 46, radius: 24, damage: 15, xp: 3, score: 30 },
  spitter: { hp: 16, speed: 58, radius: 14, damage: 6, xp: 2, score: 25 },
  herald: { hp: 680, speed: 56, radius: 44, damage: 20, xp: 20, score: 500 },
};

/** Health grows a little with each wave, so later waves stay threatening. */
export function enemyHp(kind, wave) {
  return Math.round(ENEMY[kind].hp * (1 + 0.12 * (wave - 1)));
}

/**
 * What each wave throws at the warden: how many of each kind, over how many seconds,
 * and how often a new one walks in. Wave 5 adds the Night Herald: slay it and dawn breaks.
 */
export const WAVES = {
  1: { seconds: 30, spawn: { wisp: 14 } },
  2: { seconds: 34, spawn: { wisp: 14, skitter: 8 } },
  3: { seconds: 38, spawn: { wisp: 14, skitter: 10, brute: 5 } },
  4: { seconds: 42, spawn: { wisp: 12, skitter: 10, brute: 6, spitter: 5 } },
  5: { seconds: 46, spawn: { wisp: 10, skitter: 8, brute: 6, spitter: 5, herald: 1 } },
};

/** The banner the player reads when a wave begins. */
export const WAVE_NAMES = {
  1: 'Wave 1 — The First Shadows',
  2: 'Wave 2 — The Skittering Dark',
  3: 'Wave 3 — Stones That Walk',
  4: 'Wave 4 — Spitters in the Mist',
  5: 'Final Wave — The Night Herald',
};

/** Every upgrade the level-up screen can offer. `max` is how many times it can stack. */
export const UPGRADES = [
  { id: 'damage', name: 'Kindled Edge', desc: '+25% ember damage', max: 5, apply: (s) => { s.damageMul *= 1.25; } },
  { id: 'rapid', name: 'Quick Hands', desc: '+20% fire rate', max: 5, apply: (s) => { s.fireMul *= 1.2; } },
  { id: 'multishot', name: 'Twin Flames', desc: '+1 ember bolt per shot', max: 3, apply: (s) => { s.multishot += 1; } },
  { id: 'pierce', name: 'Piercing Light', desc: 'Bolts pass through +1 enemy', max: 3, apply: (s) => { s.pierce += 1; } },
  { id: 'speed', name: 'Swift Boots', desc: '+12% move speed', max: 4, apply: (s) => { s.speedMul *= 1.12; } },
  { id: 'vitality', name: 'Heartwood', desc: '+25 max health, heal 25', max: 4, apply: (s) => { s.maxHp += 25; s.hp = Math.min(s.maxHp, s.hp + 25); } },
  { id: 'orbit', name: 'Orbit Blades', desc: '+1 flame blade circling you', max: 3, apply: (s) => { s.orbit += 1; } },
  { id: 'magnet', name: 'Lodestone', desc: '+50% ember pickup range', max: 3, apply: (s) => { s.pickupMul *= 1.5; } },
  { id: 'crit', name: 'True Aim', desc: '+10% critical chance (double damage)', max: 4, apply: (s) => { s.crit += 0.1; } },
  { id: 'dash', name: 'Ember Dash', desc: 'Dash hurts enemies it passes through', max: 1, apply: (s) => { s.dashDamage = 22; } },
  { id: 'regen', name: 'Moss Mend', desc: 'Regenerate +0.8 health each second', max: 3, apply: (s) => { s.regen += 0.8; } },
  { id: 'haste', name: 'Cool Blood', desc: 'Dash recharges 30% faster', max: 2, apply: (s) => { s.dashMul *= 0.7; } },
];

/** Pool sizes: everything is allocated once at boot, nothing allocates mid-game. */
export const POOL = { enemies: 96, bolts: 128, gems: 160, particles: 256, numbers: 28 };

export const PALETTE = {
  backdrop: '#0b0e1a',
  glade: '#12172a',
  gladeEdge: '#0d1122',
  ground: '#1a2036',
  lantern: '#ffb347',
  ember: '#ff7a3c',
  emberCore: '#ffd166',
  text: '#f2ead8',
  muted: '#9aa3b8',
  panel: '#1c2338',
  panelEdge: '#3a4666',
  hp: '#e5534b',
  hpBack: '#3a2027',
  xp: '#7ee2a8',
  xpBack: '#22303a',
  wisp: '#8f7bff',
  skitter: '#c86bff',
  brute: '#5a6b8c',
  spitter: '#4fd1c5',
  herald: '#ff4d6d',
  gem: '#7ee2a8',
  card: '#232c47',
  cardEdge: '#ffb347',
  danger: '#ff5d5d',
};

export const FONT = 'system-ui, -apple-system, "Segoe UI", sans-serif';

/** Where the best score is kept between visits (this browser only). */
export const BEST_KEY = 'ember-warden.best';
