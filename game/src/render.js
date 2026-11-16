// Drawing only: the world's state and the current screen in, pixels out. The
// 1280x720 playfield is scaled to fit the window and centred, the margin filled
// with the backdrop colour. Every creature is drawn from its own shape and
// colour, so the field reads at a glance even when the screenshots shrink.

import { FIELD, FONT, PALETTE } from './config.js';

export const SCREEN_TITLE = 'title';
export const SCREEN_PLAY = 'play';
export const SCREEN_PAUSED = 'paused';
export const SCREEN_LEVELUP = 'levelup';
export const SCREEN_OVER = 'over';
export const SCREEN_WIN = 'win';

const CARD = { width: 300, height: 210, gap: 28 };

export function createRenderer(canvas) {
  const context = canvas.getContext('2d');
  const view = { scale: 1, x: 0, y: 0 };

  function resize() {
    const ratio = window.devicePixelRatio || 1;
    const width = Math.round(window.innerWidth * ratio);
    const height = Math.round(window.innerHeight * ratio);
    canvas.width = width;
    canvas.height = height;
    view.scale = Math.min(width / FIELD.width, height / FIELD.height);
    view.x = (width - FIELD.width * view.scale) / 2;
    view.y = (height - FIELD.height * view.scale) / 2;
  }

  const fonts = new Map();
  function text(value, x, y, size, color, align, baseline) {
    if (!fonts.has(size)) fonts.set(size, `600 ${size}px ${FONT}`);
    context.font = fonts.get(size);
    context.fillStyle = color;
    context.textAlign = align || 'left';
    context.textBaseline = baseline || 'alphabetic';
    context.fillText(value, x, y);
  }

  function circle(x, y, radius, color) {
    context.fillStyle = color;
    context.beginPath();
    context.arc(x, y, radius, 0, Math.PI * 2);
    context.fill();
  }

  function glow(x, y, radius, color, alpha) {
    const gradient = context.createRadialGradient(x, y, 0, x, y, radius);
    gradient.addColorStop(0, color);
    gradient.addColorStop(1, 'rgba(0,0,0,0)');
    context.globalAlpha = alpha;
    context.fillStyle = gradient;
    context.beginPath();
    context.arc(x, y, radius, 0, Math.PI * 2);
    context.fill();
    context.globalAlpha = 1;
  }

  function drawBackground(state) {
    const gradient = context.createLinearGradient(0, 0, 0, FIELD.height);
    gradient.addColorStop(0, PALETTE.glade);
    gradient.addColorStop(1, PALETTE.gladeEdge);
    context.fillStyle = gradient;
    context.fillRect(0, 0, FIELD.width, FIELD.height);
    // Fireflies drift through the glade, dimmer than the fight.
    for (const fly of state.fireflies) {
      const twinkle = 0.25 + 0.35 * (0.5 + 0.5 * Math.sin(fly.phase * 2));
      glow(fly.x, fly.y, 14, '#ffd166', twinkle * 0.5);
      circle(fly.x, fly.y, 2, '#ffe9a8');
    }
    // The lantern's light follows the warden.
    glow(state.player.x, state.player.y, 260, '#ffb347', 0.14);
  }

  function drawGems(state) {
    for (const gem of state.gems) {
      if (!gem.active) continue;
      const pulse = 1 + 0.15 * Math.sin(state.time * 6 + gem.x);
      glow(gem.x, gem.y, 16 * pulse, PALETTE.gem, 0.5);
      context.save();
      context.translate(gem.x, gem.y);
      context.rotate(Math.PI / 4);
      context.fillStyle = PALETTE.gem;
      const s = 6 * pulse;
      context.fillRect(-s, -s, s * 2, s * 2);
      context.restore();
    }
  }

  function drawBolts(state) {
    for (const bolt of state.bolts) {
      if (!bolt.active) continue;
      if (bolt.friendly) {
        glow(bolt.x, bolt.y, 18, PALETTE.ember, 0.7);
        circle(bolt.x, bolt.y, bolt.radius, PALETTE.emberCore);
      } else {
        glow(bolt.x, bolt.y, 16, PALETTE.herald, 0.6);
        circle(bolt.x, bolt.y, bolt.radius, '#ff8fa3');
      }
    }
  }

  function drawEnemy(enemy, time) {
    const flash = enemy.flash > 0;
    const body = flash ? '#ffffff' : { wisp: PALETTE.wisp, skitter: PALETTE.skitter, brute: PALETTE.brute, spitter: PALETTE.spitter, herald: PALETTE.herald }[enemy.kind];
    if (enemy.kind === 'wisp') {
      const wobble = Math.sin(time * 3 + enemy.x) * 3;
      glow(enemy.x, enemy.y + wobble, enemy.radius + 12, PALETTE.wisp, 0.5);
      circle(enemy.x, enemy.y + wobble, enemy.radius, body);
      circle(enemy.x - 4, enemy.y + wobble - 3, 3, '#0b0e1a');
      circle(enemy.x + 4, enemy.y + wobble - 3, 3, '#0b0e1a');
    } else if (enemy.kind === 'skitter') {
      const angle = Math.atan2(enemy.y - 360, enemy.x - 640);
      context.save();
      context.translate(enemy.x, enemy.y);
      context.rotate(angle);
      context.fillStyle = body;
      context.beginPath();
      context.moveTo(14, 0);
      context.lineTo(-10, -9);
      context.lineTo(-5, 0);
      context.lineTo(-10, 9);
      context.closePath();
      context.fill();
      context.restore();
    } else if (enemy.kind === 'brute') {
      context.fillStyle = body;
      context.beginPath();
      for (let i = 0; i < 6; i += 1) {
        const angle = (i / 6) * Math.PI * 2 + 0.5;
        const px = enemy.x + Math.cos(angle) * enemy.radius;
        const py = enemy.y + Math.sin(angle) * enemy.radius;
        if (i === 0) context.moveTo(px, py);
        else context.lineTo(px, py);
      }
      context.closePath();
      context.fill();
      circle(enemy.x - 7, enemy.y - 5, 3.5, '#ff5d5d');
      circle(enemy.x + 7, enemy.y - 5, 3.5, '#ff5d5d');
    } else if (enemy.kind === 'spitter') {
      context.save();
      context.translate(enemy.x, enemy.y);
      context.rotate(Math.PI / 4);
      context.fillStyle = body;
      context.fillRect(-11, -11, 22, 22);
      context.restore();
      circle(enemy.x, enemy.y, 5, '#0b0e1a');
    } else {
      // The Night Herald: a crowned shadow orb with a pulsing ring.
      const pulse = 1 + 0.06 * Math.sin(time * 2.4);
      glow(enemy.x, enemy.y, enemy.radius * 2.4, PALETTE.herald, 0.55);
      circle(enemy.x, enemy.y, enemy.radius * pulse, body);
      context.strokeStyle = '#ffd166';
      context.lineWidth = 3;
      context.beginPath();
      context.arc(enemy.x, enemy.y, enemy.radius * pulse + 10, 0, Math.PI * 2);
      context.stroke();
      for (let i = 0; i < 3; i += 1) {
        const angle = -Math.PI / 2 + (i - 1) * 0.5;
        context.fillStyle = '#ffd166';
        context.beginPath();
        context.moveTo(enemy.x + Math.cos(angle) * (enemy.radius + 22), enemy.y + Math.sin(angle) * (enemy.radius + 22));
        context.lineTo(enemy.x + Math.cos(angle - 0.18) * (enemy.radius + 6), enemy.y + Math.sin(angle - 0.18) * (enemy.radius + 6));
        context.lineTo(enemy.x + Math.cos(angle + 0.18) * (enemy.radius + 6), enemy.y + Math.sin(angle + 0.18) * (enemy.radius + 6));
        context.closePath();
        context.fill();
      }
      circle(enemy.x - 14, enemy.y - 8, 5, '#0b0e1a');
      circle(enemy.x + 14, enemy.y - 8, 5, '#0b0e1a');
    }
    // A health bar over anything hurt that is not a wisp.
    if (enemy.kind !== 'wisp' && enemy.hp < enemy.maxHp) {
      const width = enemy.radius * 2;
      context.fillStyle = 'rgba(0,0,0,0.55)';
      context.fillRect(enemy.x - width / 2, enemy.y - enemy.radius - 14, width, 5);
      context.fillStyle = PALETTE.hp;
      context.fillRect(enemy.x - width / 2, enemy.y - enemy.radius - 14, width * (enemy.hp / enemy.maxHp), 5);
    }
  }

  function drawPlayer(state) {
    const player = state.player;
    if (player.invulnerable > 0 && player.dashLeft <= 0 && Math.floor(player.invulnerable * 12) % 2 === 0) return;
    // Orbit blades circle the warden first, under the body.
    if (state.build.orbit > 0) {
      for (let i = 0; i < state.build.orbit; i += 1) {
        const angle = player.orbitAngle + (i / state.build.orbit) * Math.PI * 2;
        const bx = player.x + Math.cos(angle) * 62;
        const by = player.y + Math.sin(angle) * 62;
        glow(bx, by, 14, PALETTE.ember, 0.6);
        context.fillStyle = PALETTE.emberCore;
        context.beginPath();
        context.arc(bx, by, 6, 0, Math.PI * 2);
        context.fill();
      }
    }
    glow(player.x, player.y, 90, PALETTE.lantern, 0.35);
    // Robe: a hooded triangle, lantern swinging at its side.
    context.fillStyle = '#2e4a7a';
    context.beginPath();
    context.moveTo(player.x, player.y - 20);
    context.lineTo(player.x - 15, player.y + 14);
    context.lineTo(player.x + 15, player.y + 14);
    context.closePath();
    context.fill();
    circle(player.x, player.y - 8, 9, '#f2ead8');
    context.fillStyle = '#2e4a7a';
    context.beginPath();
    context.arc(player.x, player.y - 9, 10, Math.PI, 0);
    context.fill();
    const swing = Math.sin(state.time * 2.2) * 5;
    const lanternX = player.x + 20;
    const lanternY = player.y + 2 + swing;
    context.strokeStyle = '#8a6d3b';
    context.lineWidth = 2;
    context.beginPath();
    context.moveTo(player.x + 12, player.y - 2);
    context.lineTo(lanternX, lanternY - 6);
    context.stroke();
    glow(lanternX, lanternY, 22, PALETTE.lantern, 0.8);
    context.fillStyle = '#3a2a12';
    context.fillRect(lanternX - 5, lanternY - 8, 10, 16);
    context.fillStyle = PALETTE.lantern;
    context.fillRect(lanternX - 3, lanternY - 5, 6, 10);
  }

  function drawParticles(state) {
    for (const particle of state.particles) {
      if (!particle.active) continue;
      context.globalAlpha = Math.max(0, particle.life / particle.maxLife);
      circle(particle.x, particle.y, particle.size, particle.color);
    }
    context.globalAlpha = 1;
    for (const number of state.numbers) {
      if (!number.active) continue;
      context.globalAlpha = Math.max(0, number.life / 0.8);
      text(number.text, number.x, number.y, number.big ? 22 : 16, number.color, 'center');
    }
    context.globalAlpha = 1;
  }

  function drawHud(state) {
    // Experience bar along the very top.
    const xpNeed = 8 + (state.level - 1) * 6;
    context.fillStyle = PALETTE.xpBack;
    context.fillRect(0, 0, FIELD.width, 10);
    context.fillStyle = PALETTE.xp;
    context.fillRect(0, 0, FIELD.width * Math.min(1, state.xp / xpNeed), 10);
    // Health bar, top left, with numbers.
    context.fillStyle = PALETTE.hpBack;
    context.fillRect(24, 24, 260, 22);
    context.fillStyle = PALETTE.hp;
    context.fillRect(24, 24, 260 * Math.max(0, state.player.hp / state.player.maxHp), 22);
    text(`HP ${Math.ceil(state.player.hp)} / ${state.player.maxHp}`, 30, 40, 15, PALETTE.text, 'left', 'middle');
    text(`Level ${state.level}`, 24, 66, 18, PALETTE.xp, 'left', 'middle');
    // Wave and time, top centre.
    text(state.wave > 0 ? `Wave ${state.wave} / 5` : 'The glade stirs…', FIELD.width / 2, 40, 20, PALETTE.text, 'center', 'middle');
    const minutes = Math.floor(state.time / 60);
    const seconds = Math.floor(state.time % 60);
    text(`${minutes}:${String(seconds).padStart(2, '0')}`, FIELD.width / 2, 66, 16, PALETTE.muted, 'center', 'middle');
    // Score and kills, top right.
    text(`Score ${state.score}`, FIELD.width - 24, 40, 20, PALETTE.text, 'right', 'middle');
    text(`${state.kills} banished`, FIELD.width - 24, 66, 16, PALETTE.muted, 'right', 'middle');
    // Dash readiness, bottom left.
    const dashReady = state.player.dashCooldown <= 0;
    text(dashReady ? 'Dash ready — Space' : 'Dash…', 24, FIELD.height - 24, 15, dashReady ? PALETTE.emberCore : PALETTE.muted, 'left', 'middle');
    // The Herald's health, bottom centre, while it lives.
    if (state.boss !== null && state.boss.active) {
      const width = 520;
      const x = (FIELD.width - width) / 2;
      const y = FIELD.height - 44;
      text('THE NIGHT HERALD', FIELD.width / 2, y - 8, 16, PALETTE.herald, 'center', 'middle');
      context.fillStyle = 'rgba(0,0,0,0.6)';
      context.fillRect(x, y, width, 14);
      context.fillStyle = PALETTE.herald;
      context.fillRect(x, y, width * Math.max(0, state.boss.hp / state.boss.maxHp), 14);
    }
    // Wave banner, fading in the middle of the field.
    if (state.bannerTimer > 0 && state.banner !== '') {
      context.globalAlpha = Math.min(1, state.bannerTimer);
      text(state.banner, FIELD.width / 2, 150, 40, PALETTE.text, 'center', 'middle');
      context.globalAlpha = 1;
    }
  }

  function drawPanel(title, lines, prompt) {
    const width = 640;
    const height = 150 + lines.length * 34;
    const x = (FIELD.width - width) / 2;
    const y = (FIELD.height - height) / 2;
    context.fillStyle = PALETTE.panel;
    context.fillRect(x, y, width, height);
    context.strokeStyle = PALETTE.panelEdge;
    context.lineWidth = 2;
    context.strokeRect(x, y, width, height);
    text(title, FIELD.width / 2, y + 72, 46, PALETTE.text, 'center', 'middle');
    for (let i = 0; i < lines.length; i += 1) {
      text(lines[i], FIELD.width / 2, y + 122 + i * 34, 20, PALETTE.muted, 'center', 'middle');
    }
    text(prompt, FIELD.width / 2, y + height - 36, 22, PALETTE.emberCore, 'center', 'middle');
  }

  function drawLevelUp(state, pointer) {
    context.fillStyle = 'rgba(5,7,16,0.72)';
    context.fillRect(0, 0, FIELD.width, FIELD.height);
    text('Level up!', FIELD.width / 2, 120, 52, PALETTE.emberCore, 'center', 'middle');
    text('Choose one blessing — press 1, 2 or 3, or click a card.', FIELD.width / 2, 168, 20, PALETTE.muted, 'center', 'middle');
    const totalWidth = CARD.width * 3 + CARD.gap * 2;
    const startX = (FIELD.width - totalWidth) / 2;
    const y = 230;
    for (let i = 0; i < state.offer.length; i += 1) {
      const upgrade = state.offer[i];
      const x = startX + i * (CARD.width + CARD.gap);
      const hover = pointer && pointer.x >= x && pointer.x <= x + CARD.width && pointer.y >= y && pointer.y <= y + CARD.height;
      context.fillStyle = hover ? '#2c3a5e' : PALETTE.card;
      context.fillRect(x, y, CARD.width, CARD.height);
      context.strokeStyle = hover ? PALETTE.cardEdge : PALETTE.panelEdge;
      context.lineWidth = hover ? 3 : 2;
      context.strokeRect(x, y, CARD.width, CARD.height);
      text(`${i + 1}`, x + CARD.width / 2, y + 52, 30, PALETTE.emberCore, 'center', 'middle');
      text(upgrade.name, x + CARD.width / 2, y + 100, 24, PALETTE.text, 'center', 'middle');
      const words = upgrade.desc.split(' ');
      let line = '';
      let lineY = y + 140;
      for (const word of words) {
        if ((line + word).length > 22) { text(line, x + CARD.width / 2, lineY, 17, PALETTE.muted, 'center', 'middle'); line = ''; lineY += 24; }
        line += (line === '' ? '' : ' ') + word;
      }
      if (line !== '') text(line, x + CARD.width / 2, lineY, 17, PALETTE.muted, 'center', 'middle');
    }
  }

  function drawStats(state, best) {
    return [
      `Score ${state.score}   •   Best ${best}`,
      `Reached wave ${state.wave} of 5   •   ${state.kills} shadows banished`,
      `Level ${state.level}   •   Survived ${Math.floor(state.time / 60)}:${String(Math.floor(state.time % 60)).padStart(2, '0')}`,
    ];
  }

  /** Paint one frame: the field, then the HUD or a panel for the screen the game is on. */
  function draw(state, screen, best, pointer) {
    context.setTransform(1, 0, 0, 1, 0, 0);
    context.fillStyle = PALETTE.backdrop;
    context.fillRect(0, 0, canvas.width, canvas.height);
    const shakeX = state.shake > 0 ? (Math.random() - 0.5) * state.shake * 14 : 0;
    const shakeY = state.shake > 0 ? (Math.random() - 0.5) * state.shake * 14 : 0;
    context.setTransform(view.scale, 0, 0, view.scale, view.x + shakeX * view.scale, view.y + shakeY * view.scale);
    drawBackground(state);
    drawGems(state);
    for (const enemy of state.enemies) if (enemy.active) drawEnemy(enemy, state.time);
    drawBolts(state);
    drawPlayer(state);
    drawParticles(state);
    if (screen === SCREEN_TITLE) {
      drawPanel('Ember Warden', [
        'Hold the last lantern against the shadow tide.',
        'Move with WASD or arrows. Your lantern fires on its own.',
        'Dash with Space. Gather embers, level up, slay the Night Herald.',
        '',
        `Best score ${best}`,
      ], 'Press Space or click to begin');
      return;
    }
    drawHud(state);
    if (screen === SCREEN_PAUSED) {
      drawPanel('Paused', ['The shadows wait for no one — except now.'], 'Press P to return to the glade');
    } else if (screen === SCREEN_LEVELUP) {
      drawLevelUp(state, pointer);
    } else if (screen === SCREEN_OVER) {
      drawPanel('The light goes out', drawStats(state, best), 'Press Space or click to try again');
    } else if (screen === SCREEN_WIN) {
      drawPanel('Dawn breaks', drawStats(state, best).concat(['The Night Herald is banished. The glade is yours.']), 'Press Space or click to play again');
    }
  }

  resize();
  window.addEventListener('resize', resize);
  return { draw, cardGeometry: () => ({ width: CARD.width, height: CARD.height, gap: CARD.gap, y: 230, totalWidth: CARD.width * 3 + CARD.gap * 2 }) };
}
