// The game's rules and state, with no drawing and no browser in it: the warden,
// the shadow tide, ember bolts, experience gems, waves and the Night Herald,
// upgrades, particles and floating numbers. step() advances one fixed step and
// returns what happened as bit flags, so the caller can react (sound, screens)
// without the world knowing about them. Nothing here allocates after
// createWorld returns: every enemy, bolt, gem, particle and number is pooled.

import { ENEMY, FIELD, FINAL_WAVE, PLAYER, POOL, UPGRADES, WAVES, enemyHp, xpForLevel } from './config.js';

export const KIND_WISP = 'wisp';
export const KIND_SKITTER = 'skitter';
export const KIND_BRUTE = 'brute';
export const KIND_SPITTER = 'spitter';
export const KIND_HERALD = 'herald';

export const EVENT_HIT = 1;
export const EVENT_PICKUP = 2;
export const EVENT_LEVELUP = 4;
export const EVENT_OVER = 8;
export const EVENT_WIN = 16;
export const EVENT_WAVE = 32;
export const EVENT_BOSS = 64;
export const EVENT_DASH = 128;

const TAU = Math.PI * 2;

function distanceSquared(ax, ay, bx, by) {
  const dx = ax - bx;
  const dy = ay - by;
  return dx * dx + dy * dy;
}

export function createWorld(random) {
  const player = {
    x: FIELD.width / 2, y: FIELD.height / 2, radius: PLAYER.radius,
    hp: PLAYER.maxHp, maxHp: PLAYER.maxHp, fireTimer: 0,
    dashCooldown: 0, dashLeft: 0, invulnerable: 0, aim: -Math.PI / 2,
    orbitAngle: 0, dashX: 0, dashY: 0,
  };
  // Multipliers and stacks the upgrades change; the base numbers live in config.js.
  const build = {
    damageMul: 1, fireMul: 1, multishot: 0, pierce: 0, speedMul: 1,
    orbit: 0, pickupMul: 1, crit: 0, dashDamage: 0, dashMul: 1, regen: 0,
  };
  const taken = {};
  for (const upgrade of UPGRADES) taken[upgrade.id] = 0;

  const enemies = [];
  for (let i = 0; i < POOL.enemies; i += 1) {
    enemies.push({ active: false, kind: KIND_WISP, x: 0, y: 0, hp: 1, maxHp: 1, speed: 0, radius: 10, damage: 0, xp: 1, score: 0, hitTimer: 0, shootTimer: 0, summonTimer: 0, burstTimer: 0, flash: 0, boss: false });
  }
  const bolts = [];
  for (let i = 0; i < POOL.bolts; i += 1) {
    bolts.push({ active: false, friendly: true, x: 0, y: 0, vx: 0, vy: 0, damage: 0, pierce: 0, radius: 5, life: 0 });
  }
  const gems = [];
  for (let i = 0; i < POOL.gems; i += 1) {
    gems.push({ active: false, x: 0, y: 0, vx: 0, vy: 0, value: 1 });
  }
  const particles = [];
  for (let i = 0; i < POOL.particles; i += 1) {
    particles.push({ active: false, x: 0, y: 0, vx: 0, vy: 0, life: 0, maxLife: 1, size: 3, color: '#ffb347' });
  }
  const numbers = [];
  for (let i = 0; i < POOL.numbers; i += 1) {
    numbers.push({ active: false, x: 0, y: 0, text: '', life: 0, color: '#f2ead8', big: false });
  }
  const fireflies = [];
  for (let i = 0; i < 42; i += 1) {
    fireflies.push({ x: random() * FIELD.width, y: random() * FIELD.height, phase: random() * TAU, speed: 0.2 + random() * 0.5 });
  }

  const state = {
    player, build, enemies, bolts, gems, particles, numbers, fireflies,
    score: 0, kills: 0, level: 1, xp: 0, wave: 0, time: 0,
    waveState: 'idle', waveTimer: 0, spawnQueue: [], spawnTimer: 0,
    pendingLevels: 0, offer: [], shake: 0, banner: '', bannerTimer: 0,
    boss: null, won: false, over: false,
  };

  function reset() {
    player.x = FIELD.width / 2;
    player.y = FIELD.height / 2;
    player.hp = PLAYER.maxHp;
    player.maxHp = PLAYER.maxHp;
    player.fireTimer = 0;
    player.dashCooldown = 0;
    player.dashLeft = 0;
    player.invulnerable = 0;
    player.aim = -Math.PI / 2;
    player.orbitAngle = 0;
    build.damageMul = 1; build.fireMul = 1; build.multishot = 0; build.pierce = 0;
    build.speedMul = 1; build.orbit = 0; build.pickupMul = 1; build.crit = 0;
    build.dashDamage = 0; build.dashMul = 1; build.regen = 0;
    for (const upgrade of UPGRADES) taken[upgrade.id] = 0;
    for (const enemy of enemies) enemy.active = false;
    for (const bolt of bolts) bolt.active = false;
    for (const gem of gems) gem.active = false;
    for (const particle of particles) particle.active = false;
    for (const number of numbers) number.active = false;
    state.score = 0; state.kills = 0; state.level = 1; state.xp = 0;
    state.wave = 0; state.time = 0; state.waveState = 'idle'; state.waveTimer = 0;
    state.spawnQueue = []; state.spawnTimer = 0; state.pendingLevels = 0;
    state.offer = []; state.shake = 0; state.banner = ''; state.bannerTimer = 0;
    state.boss = null; state.won = false; state.over = false;
  }

  function free(pool) {
    for (let i = 0; i < pool.length; i += 1) if (!pool[i].active) return pool[i];
    return null;
  }

  function aliveEnemies() {
    let count = 0;
    for (const enemy of enemies) if (enemy.active) count += 1;
    return count;
  }

  function burst(x, y, color, count, speed) {
    for (let i = 0; i < count; i += 1) {
      const particle = free(particles);
      if (particle === null) return;
      const angle = random() * TAU;
      const power = speed * (0.3 + random() * 0.7);
      particle.active = true;
      particle.x = x; particle.y = y;
      particle.vx = Math.cos(angle) * power;
      particle.vy = Math.sin(angle) * power;
      particle.maxLife = 0.35 + random() * 0.4;
      particle.life = particle.maxLife;
      particle.size = 2 + random() * 3;
      particle.color = color;
    }
  }

  function floatNumber(x, y, text, color, big) {
    const number = free(numbers);
    if (number === null) return;
    number.active = true;
    number.x = x; number.y = y;
    number.text = text; number.color = color; number.big = big;
    number.life = 0.8;
  }

  function dropGem(x, y, value) {
    const gem = free(gems);
    if (gem === null) return;
    gem.active = true;
    gem.x = x; gem.y = y;
    const angle = random() * TAU;
    gem.vx = Math.cos(angle) * 60;
    gem.vy = Math.sin(angle) * 60;
    gem.value = value;
  }

  /** A spawn point on a field edge, far enough from the warden to feel fair. */
  function spawnPoint() {
    for (let tries = 0; tries < 12; tries += 1) {
      const edge = Math.floor(random() * 4);
      let x = 0;
      let y = 0;
      if (edge === 0) { x = random() * FIELD.width; y = -30; }
      else if (edge === 1) { x = FIELD.width + 30; y = random() * FIELD.height; }
      else if (edge === 2) { x = random() * FIELD.width; y = FIELD.height + 30; }
      else { x = -30; y = random() * FIELD.height; }
      if (distanceSquared(x, y, player.x, player.y) > 280 * 280) return { x, y };
    }
    return { x: -30, y: -30 };
  }

  function spawnEnemy(kind) {
    const enemy = free(enemies);
    if (enemy === null) return null;
    const point = spawnPoint();
    const def = ENEMY[kind];
    enemy.active = true;
    enemy.kind = kind;
    enemy.x = point.x; enemy.y = point.y;
    enemy.maxHp = enemyHp(kind, state.wave);
    enemy.hp = enemy.maxHp;
    enemy.speed = def.speed;
    enemy.radius = def.radius;
    enemy.damage = def.damage;
    enemy.xp = def.xp;
    enemy.score = def.score;
    enemy.hitTimer = 0;
    enemy.shootTimer = 1.5 + random() * 1.5;
    enemy.summonTimer = 6;
    enemy.burstTimer = 4;
    enemy.flash = 0;
    enemy.boss = kind === KIND_HERALD;
    if (enemy.boss) state.boss = enemy;
    return enemy;
  }

  /** Begin a wave: build its spawn queue from the wave table and announce it. */
  function startWave(wave) {
    state.wave = wave;
    const table = WAVES[wave];
    state.spawnQueue = [];
    for (const kind of Object.keys(table.spawn)) {
      for (let i = 0; i < table.spawn[kind]; i += 1) state.spawnQueue.push(kind);
    }
    // Shuffle the queue so the wave never arrives in kind order.
    for (let i = state.spawnQueue.length - 1; i > 0; i -= 1) {
      const j = Math.floor(random() * (i + 1));
      const swap = state.spawnQueue[i];
      state.spawnQueue[i] = state.spawnQueue[j];
      state.spawnQueue[j] = swap;
    }
    state.waveState = 'spawning';
    state.waveTimer = table.seconds;
    state.spawnTimer = 0.4;
    state.banner = wave === FINAL_WAVE ? 'Final Wave — The Night Herald' : `Wave ${wave}`;
    state.bannerTimer = 2.4;
    return wave === FINAL_WAVE ? EVENT_BOSS : EVENT_WAVE;
  }

  function nearestEnemy(maxRange) {
    let best = null;
    let bestDistance = maxRange * maxRange;
    for (const enemy of enemies) {
      if (!enemy.active) continue;
      const d = distanceSquared(enemy.x, enemy.y, player.x, player.y);
      if (d < bestDistance) { bestDistance = d; best = enemy; }
    }
    return best;
  }

  function fireBolt(angle, damage) {
    const bolt = free(bolts);
    if (bolt === null) return;
    bolt.active = true;
    bolt.friendly = true;
    bolt.x = player.x + Math.cos(angle) * (player.radius + 6);
    bolt.y = player.y + Math.sin(angle) * (player.radius + 6);
    bolt.vx = Math.cos(angle) * PLAYER.boltSpeed;
    bolt.vy = Math.sin(angle) * PLAYER.boltSpeed;
    bolt.damage = damage;
    bolt.pierce = build.pierce;
    bolt.radius = 5;
    bolt.life = PLAYER.boltRange / PLAYER.boltSpeed;
  }

  function fireEmbers() {
    const target = nearestEnemy(PLAYER.boltRange);
    if (target === null) return false;
    const base = Math.atan2(target.y - player.y, target.x - player.x);
    player.aim = base;
    const damage = Math.round(PLAYER.boltDamage * build.damageMul);
    const shots = 1 + build.multishot;
    for (let i = 0; i < shots; i += 1) {
      const spread = (i - (shots - 1) / 2) * 0.14;
      fireBolt(base + spread, damage);
    }
    return true;
  }

  function damageEnemy(enemy, damage, critical) {
    enemy.hp -= damage;
    enemy.flash = 0.09;
    floatNumber(enemy.x, enemy.y - enemy.radius - 6, String(damage), critical ? '#ffd166' : '#f2ead8', critical);
    if (enemy.hp > 0) return false;
    enemy.active = false;
    state.kills += 1;
    state.score += enemy.score;
    burst(enemy.x, enemy.y, enemy.boss ? '#ff4d6d' : '#8f7bff', enemy.boss ? 42 : 12, enemy.boss ? 320 : 180);
    dropGem(enemy.x, enemy.y, enemy.xp);
    if (enemy.boss) {
      state.boss = null;
      state.won = true;
      state.shake = 0.7;
    }
    return true;
  }

  function hurtPlayer(damage) {
    if (player.invulnerable > 0 || player.dashLeft > 0 || state.over) return false;
    player.hp -= damage;
    player.invulnerable = PLAYER.invulnerable;
    state.shake = Math.max(state.shake, 0.35);
    burst(player.x, player.y, '#e5534b', 10, 160);
    if (player.hp <= 0) {
      player.hp = 0;
      state.over = true;
    }
    return true;
  }

  /** Three upgrades the warden has not maxed yet, drawn at random. */
  function offerUpgrades() {
    const open = UPGRADES.filter((u) => taken[u.id] < u.max);
    const offer = [];
    while (offer.length < 3 && open.length > 0) {
      const index = Math.floor(random() * open.length);
      offer.push(open.splice(index, 1)[0]);
    }
    state.offer = offer;
    return offer;
  }

  function grantUpgrade(id) {
    const upgrade = UPGRADES.find((u) => u.id === id);
    if (!upgrade || taken[id] >= upgrade.max) return false;
    taken[id] += 1;
    upgrade.apply(build);
    if (id === 'vitality') player.hp = Math.min(player.maxHp, player.hp + 25);
    return true;
  }

  function gainXp(amount) {
    state.xp += amount;
    while (state.xp >= xpForLevel(state.level)) {
      state.xp -= xpForLevel(state.level);
      state.level += 1;
      state.pendingLevels += 1;
    }
    if (state.pendingLevels > 0) {
      offerUpgrades();
      return true;
    }
    return false;
  }

  function updateBolts(dt) {
    for (const bolt of bolts) {
      if (!bolt.active) continue;
      bolt.x += bolt.vx * dt;
      bolt.y += bolt.vy * dt;
      bolt.life -= dt;
      if (bolt.life <= 0 || bolt.x < -20 || bolt.x > FIELD.width + 20 || bolt.y < -20 || bolt.y > FIELD.height + 20) {
        bolt.active = false;
        continue;
      }
      if (bolt.friendly) {
        for (const enemy of enemies) {
          if (!enemy.active) continue;
          const reach = bolt.radius + enemy.radius;
          if (distanceSquared(bolt.x, bolt.y, enemy.x, enemy.y) > reach * reach) continue;
          const critical = random() < build.crit;
          damageEnemy(enemy, critical ? bolt.damage * 2 : bolt.damage, critical);
          if (bolt.pierce > 0) { bolt.pierce -= 1; }
          else { bolt.active = false; }
          break;
        }
      } else if (distanceSquared(bolt.x, bolt.y, player.x, player.y) < (bolt.radius + player.radius) ** 2) {
        bolt.active = false;
        hurtPlayer(bolt.damage);
      }
    }
  }

  function updateEnemies(dt, events) {
    for (const enemy of enemies) {
      if (!enemy.active) continue;
      if (enemy.flash > 0) enemy.flash -= dt;
      if (enemy.hitTimer > 0) enemy.hitTimer -= dt;
      const dx = player.x - enemy.x;
      const dy = player.y - enemy.y;
      const distance = Math.sqrt(dx * dx + dy * dy) || 1;
      const nx = dx / distance;
      const ny = dy / distance;
      if (enemy.kind === KIND_SPITTER) {
        // Keep a firing distance: close in when far, back off when crowded.
        const move = distance > 300 ? 1 : distance < 200 ? -1 : 0;
        enemy.x += nx * enemy.speed * move * dt;
        enemy.y += ny * enemy.speed * move * dt;
        enemy.shootTimer -= dt;
        if (enemy.shootTimer <= 0 && distance < 520) {
          enemy.shootTimer = 2.4;
          const bolt = free(bolts);
          if (bolt !== null) {
            bolt.active = true; bolt.friendly = false;
            bolt.x = enemy.x; bolt.y = enemy.y;
            bolt.vx = nx * 210; bolt.vy = ny * 210;
            bolt.damage = enemy.damage; bolt.pierce = 0; bolt.radius = 6;
            bolt.life = 3;
          }
        }
      } else if (enemy.boss) {
        enemy.x += nx * enemy.speed * dt;
        enemy.y += ny * enemy.speed * dt;
        enemy.summonTimer -= dt;
        if (enemy.summonTimer <= 0) {
          enemy.summonTimer = 8;
          let summoned = 0;
          for (let i = 0; i < 3; i += 1) {
            const wisp = spawnEnemy(KIND_WISP);
            if (wisp !== null) {
              wisp.x = enemy.x + (random() - 0.5) * 120;
              wisp.y = enemy.y + (random() - 0.5) * 120;
              summoned += 1;
            }
          }
          if (summoned > 0) burst(enemy.x, enemy.y, '#ff4d6d', 16, 220);
        }
        enemy.burstTimer -= dt;
        if (enemy.burstTimer <= 0) {
          enemy.burstTimer = 5;
          for (let i = 0; i < 10; i += 1) {
            const angle = (i / 10) * TAU + random() * 0.2;
            const bolt = free(bolts);
            if (bolt === null) break;
            bolt.active = true; bolt.friendly = false;
            bolt.x = enemy.x; bolt.y = enemy.y;
            bolt.vx = Math.cos(angle) * 175; bolt.vy = Math.sin(angle) * 175;
            bolt.damage = 10; bolt.pierce = 0; bolt.radius = 6;
            bolt.life = 3.2;
          }
        }
      } else {
        enemy.x += nx * enemy.speed * dt;
        enemy.y += ny * enemy.speed * dt;
      }
      enemy.x = Math.max(-60, Math.min(FIELD.width + 60, enemy.x));
      enemy.y = Math.max(-60, Math.min(FIELD.height + 60, enemy.y));
      // Touching the warden hurts, but not more than once per short window.
      const reach = enemy.radius + player.radius - 2;
      if (enemy.hitTimer <= 0 && distanceSquared(enemy.x, enemy.y, player.x, player.y) < reach * reach) {
        enemy.hitTimer = 0.7;
        if (hurtPlayer(enemy.damage)) events |= EVENT_HIT;
      }
    }
    return events;
  }

  function updateOrbit(dt) {
    if (build.orbit === 0) return;
    player.orbitAngle += dt * 3.4;
    const radius = 62;
    for (let i = 0; i < build.orbit; i += 1) {
      const angle = player.orbitAngle + (i / build.orbit) * TAU;
      const bx = player.x + Math.cos(angle) * radius;
      const by = player.y + Math.sin(angle) * radius;
      for (const enemy of enemies) {
        if (!enemy.active) continue;
        const reach = 16 + enemy.radius;
        if (distanceSquared(bx, by, enemy.x, enemy.y) < reach * reach) {
          damageEnemy(enemy, Math.round(10 * build.damageMul), false);
        }
      }
    }
  }

  function updateGems(dt) {
    const pickup = PLAYER.pickupRadius * build.pickupMul;
    for (const gem of gems) {
      if (!gem.active) continue;
      const d2 = distanceSquared(gem.x, gem.y, player.x, player.y);
      const distance = Math.sqrt(d2) || 1;
      // Embers lean toward the lantern from a little way off, so a warden who
      // fights near them gathers them without sweeping the whole field.
      if (distance < 240) {
        const pull = 200 * (1 - distance / 260);
        gem.vx += ((player.x - gem.x) / distance) * pull * dt * 4;
        gem.vy += ((player.y - gem.y) / distance) * pull * dt * 4;
      }
      if (d2 < pickup * pickup) {
        const pull = 640 * (1 - distance / (pickup * 1.6));
        gem.vx += ((player.x - gem.x) / distance) * pull * dt * 4;
        gem.vy += ((player.y - gem.y) / distance) * pull * dt * 4;
      }
      gem.x += gem.vx * dt;
      gem.y += gem.vy * dt;
      gem.vx *= 0.9;
      gem.vy *= 0.9;
      if (d2 < (player.radius + 12) ** 2) {
        gem.active = false;
        if (gainXp(gem.value)) return true;
      }
    }
    return false;
  }

  function updateParticles(dt) {
    for (const particle of particles) {
      if (!particle.active) continue;
      particle.life -= dt;
      if (particle.life <= 0) { particle.active = false; continue; }
      particle.x += particle.vx * dt;
      particle.y += particle.vy * dt;
      particle.vx *= 0.96;
      particle.vy *= 0.96;
    }
    for (const number of numbers) {
      if (!number.active) continue;
      number.life -= dt;
      number.y -= 34 * dt;
      if (number.life <= 0) number.active = false;
    }
    for (const fly of fireflies) {
      fly.phase += dt * fly.speed;
      fly.x += Math.cos(fly.phase) * 6 * dt;
      fly.y += Math.sin(fly.phase * 1.3) * 6 * dt;
    }
  }

  /**
   * One fixed step. `steer` is the normalised movement vector, `dash` a dash
   * press this step. With `harmless` set (the title screen's backdrop) wisps
   * drift but nothing touches the warden and nothing scores.
   */
  function step(dt, steer, dash, harmless) {
    let events = 0;
    state.time += dt;
    if (state.bannerTimer > 0) state.bannerTimer -= dt;
    if (state.shake > 0) state.shake = Math.max(0, state.shake - dt * 1.6);
    updateParticles(dt);

    if (harmless) {
      if (aliveEnemies() < 10 && random() < dt * 2) spawnEnemy(KIND_WISP);
      for (const enemy of enemies) {
        if (!enemy.active) continue;
        enemy.x += Math.cos(state.time * 0.4 + enemy.y) * 12 * dt;
        enemy.y += 26 * dt;
        if (enemy.y > FIELD.height + 40) enemy.active = false;
      }
      return events;
    }

    if (state.over || state.won) return events;
    if (build.regen > 0 && player.hp > 0) player.hp = Math.min(player.maxHp, player.hp + build.regen * dt);
    if (player.invulnerable > 0) player.invulnerable -= dt;

    // Dash: a burst of speed and a blink of invulnerability, then a cooldown.
    if (player.dashCooldown > 0) player.dashCooldown -= dt;
    if (dash && player.dashCooldown <= 0 && (steer.x !== 0 || steer.y !== 0)) {
      player.dashLeft = PLAYER.dashTime;
      player.dashCooldown = PLAYER.dashCooldown * build.dashMul;
      player.dashX = steer.x;
      player.dashY = steer.y;
      player.invulnerable = Math.max(player.invulnerable, PLAYER.dashTime + 0.08);
      burst(player.x, player.y, '#ffb347', 8, 140);
      events |= EVENT_DASH;
    }
    const speed = player.dashLeft > 0 ? PLAYER.dashSpeed : PLAYER.speed * build.speedMul;
    const mx = player.dashLeft > 0 ? player.dashX : steer.x;
    const my = player.dashLeft > 0 ? player.dashY : steer.y;
    if (player.dashLeft > 0) player.dashLeft -= dt;
    player.x = Math.max(player.radius, Math.min(FIELD.width - player.radius, player.x + mx * speed * dt));
    player.y = Math.max(player.radius, Math.min(FIELD.height - player.radius, player.y + my * speed * dt));
    if (player.dashLeft > 0 && build.dashDamage > 0) {
      for (const enemy of enemies) {
        if (!enemy.active) continue;
        const reach = player.radius + enemy.radius + 6;
        if (distanceSquared(player.x, player.y, enemy.x, enemy.y) < reach * reach) {
          damageEnemy(enemy, build.dashDamage, false);
        }
      }
    }

    // Waves: spawn the queue, then wait for the field to clear.
    if (state.waveState === 'idle') {
      events |= startWave(1);
    } else if (state.waveState === 'spawning') {
      state.waveTimer -= dt;
      state.spawnTimer -= dt;
      if (state.spawnQueue.length > 0 && state.spawnTimer <= 0) {
        const left = Math.max(1, state.spawnQueue.length);
        state.spawnTimer = Math.max(0.25, state.waveTimer / left);
        spawnEnemy(state.spawnQueue.shift());
      }
      if (state.spawnQueue.length === 0) state.waveState = 'fighting';
    } else if (state.waveState === 'fighting') {
      if (aliveEnemies() === 0) {
        if (state.wave >= FINAL_WAVE) { state.waveState = 'done'; }
        else {
          state.waveState = 'intermission';
          state.waveTimer = 3;
          state.banner = `Wave ${state.wave} cleared`;
          state.bannerTimer = 2.2;
          player.hp = Math.min(player.maxHp, player.hp + 12);
        }
      }
    } else if (state.waveState === 'intermission') {
      state.waveTimer -= dt;
      if (state.waveTimer <= 0) events |= startWave(state.wave + 1);
    }

    // The warden's lantern fires on its own at the nearest shadow.
    player.fireTimer -= dt;
    if (player.fireTimer <= 0) {
      if (fireEmbers()) player.fireTimer = PLAYER.fireInterval / build.fireMul;
      else player.fireTimer = 0.08;
    }
    updateOrbit(dt);
    updateBolts(dt);
    events = updateEnemies(dt, events);
    if (updateGems(dt)) events |= EVENT_LEVELUP;
    if (state.won) events |= EVENT_WIN;
    if (state.over) events |= EVENT_OVER;
    return events;
  }

  reset();
  return { state, reset, step, startWave, grantUpgrade, offerUpgrades, aliveEnemies };
}
