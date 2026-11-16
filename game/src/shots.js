// The screenshot scenes behind ?shot=start|play|levelup|victory. Each one plays
// the real rules forward from a fresh world for a fixed number of steps, steered
// by a simple autopilot (keep clear of the nearest shadow, chase the nearest
// ember when that is safe, dash when surrounded), so the frame is what a short
// game really looks like and the same seed always gives the same frame. The
// victory scene stages the final wave with a strong build earned the honest
// way in the code's own terms — the same upgrades a player can take — and
// plays it out until the Herald falls.
import { FIELD, STEP } from './config.js';
import { EVENT_LEVELUP, EVENT_OVER, EVENT_WIN } from './world.js';
import { SCREEN_LEVELUP, SCREEN_OVER, SCREEN_PLAY, SCREEN_TITLE, SCREEN_WIN } from './render.js';

const START_SECONDS = 5;
const PLAY_LIMIT_SECONDS = 150;
const LEVELUP_LIMIT_SECONDS = 120;
const VICTORY_LIMIT_SECONDS = 150;

/** How far the pilot keeps from the nearest shadow before it turns away. */
const SAFE_RANGE = 120;
/** How far it will walk to chase an ember. */
const CHASE_RANGE = 320;

function nearest(state, pool, maxRange) {
  let best = null;
  let bestDistance = maxRange * maxRange;
  for (const item of pool) {
    if (!item.active) continue;
    const dx = item.x - state.player.x;
    const dy = item.y - state.player.y;
    const d = dx * dx + dy * dy;
    if (d < bestDistance) { bestDistance = d; best = item; }
  }
  return best;
}

/** Steer away from the nearest shadow, toward the nearest ember, or hold the middle. */
function autopilot(state) {
  const player = state.player;
  const threat = nearest(state, state.enemies, SAFE_RANGE);
  let x = 0;
  let y = 0;
  if (threat !== null) {
    const dx = player.x - threat.x;
    const dy = player.y - threat.y;
    const distance = Math.sqrt(dx * dx + dy * dy) || 1;
    x = dx / distance;
    y = dy / distance;
  } else {
    const gem = nearest(state, state.gems, CHASE_RANGE);
    if (gem !== null) {
      const dx = gem.x - player.x;
      const dy = gem.y - player.y;
      const distance = Math.sqrt(dx * dx + dy * dy) || 1;
      x = dx / distance;
      y = dy / distance;
    } else {
      const dx = FIELD.width / 2 - player.x;
      const dy = FIELD.height / 2 - player.y;
      const distance = Math.sqrt(dx * dx + dy * dy) || 1;
      if (distance > 140) { x = dx / distance; y = dy / distance; }
    }
  }
  // Keep off the walls: the field's edge is no place to be cornered.
  if (player.x < 90) x = Math.max(x, 0.6);
  if (player.x > FIELD.width - 90) x = Math.min(x, -0.6);
  if (player.y < 90) y = Math.max(y, 0.6);
  if (player.y > FIELD.height - 90) y = Math.min(y, -0.6);
  const length = Math.sqrt(x * x + y * y) || 1;
  return { x: x / length, y: y / length };
}

/** Dash when three or more shadows crowd the warden. */
function shouldDash(state) {
  if (state.player.dashCooldown > 0) return false;
  let close = 0;
  for (const enemy of state.enemies) {
    if (!enemy.active) continue;
    const dx = enemy.x - state.player.x;
    const dy = enemy.y - state.player.y;
    if (dx * dx + dy * dy < 90 * 90) close += 1;
  }
  return close >= 3;
}

/** The strong build the victory scene plays with: upgrades a player can earn. */
const VICTORY_BUILD = [
  'damage', 'damage', 'damage', 'rapid', 'rapid', 'multishot', 'multishot',
  'pierce', 'orbit', 'orbit', 'speed', 'vitality', 'vitality', 'regen', 'dash',
];

/**
 * Set `world` to the named scene (start, play, levelup or victory; any other
 * name is start) and return the screen to draw over it and the best score.
 */
export function stageShot(name, world) {
  world.reset();
  const state = world.state;
  if (name !== 'play' && name !== 'levelup' && name !== 'victory') {
    for (let i = 0; i < START_SECONDS / STEP; i += 1) world.step(STEP, { x: 0, y: 0 }, false, true);
    return { screen: SCREEN_TITLE, best: 0 };
  }
  if (name === 'levelup') {
    for (let i = 0; i < LEVELUP_LIMIT_SECONDS / STEP; i += 1) {
      const events = world.step(STEP, autopilot(state), shouldDash(state), false);
      if (events & EVENT_LEVELUP) return { screen: SCREEN_LEVELUP, best: state.score };
      if (events & EVENT_OVER) break;
    }
    return { screen: state.over ? SCREEN_OVER : SCREEN_PLAY, best: state.score };
  }
  if (name === 'victory') {
    for (const id of VICTORY_BUILD) world.grantUpgrade(id);
    state.level = 12;
    world.startWave(5);
    for (let i = 0; i < VICTORY_LIMIT_SECONDS / STEP; i += 1) {
      const events = world.step(STEP, autopilot(state), shouldDash(state), false);
      if (events & EVENT_WIN) return { screen: SCREEN_WIN, best: state.score };
      if (events & EVENT_OVER) break;
      // A level-up mid-fight pauses the real game; the pilot takes the first card.
      if (state.pendingLevels > 0 && state.offer.length > 0) {
        world.grantUpgrade(state.offer[0].id);
        state.pendingLevels -= 1;
        if (state.pendingLevels === 0) state.offer = [];
        else world.offerUpgrades();
      }
    }
    return { screen: state.over ? SCREEN_OVER : SCREEN_PLAY, best: state.score };
  }
  // Play until wave 4 is underway and the shadows have walked in close to
  // the warden: several kinds on the field at once, near the middle.
  for (let i = 0; i < PLAY_LIMIT_SECONDS / STEP; i += 1) {
    const events = world.step(STEP, autopilot(state), shouldDash(state), false);
    if (events & EVENT_OVER) break;
    if (state.pendingLevels > 0 && state.offer.length > 0) {
      world.grantUpgrade(state.offer[0].id);
      state.pendingLevels -= 1;
      if (state.pendingLevels === 0) state.offer = [];
      else world.offerUpgrades();
    }
    if (state.wave >= 4 && state.time >= 132 && world.aliveEnemies() >= 4) break;
  }
  return { screen: state.over ? SCREEN_OVER : SCREEN_PLAY, best: state.score };
}
