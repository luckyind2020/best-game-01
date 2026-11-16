// Boot and the one loop: input is read every frame, the world advances in fixed
// 1/60 s steps (several in a slow frame, none in a fast one), and the renderer
// paints what is there. The game moves between six screens: title, play,
// paused, level-up, game over and victory.
//
// ?seed=N fixes the spawn pattern. ?shot=start|play|levelup|victory (with
// &seed=N) stages that scene instead of running the loop, paints it twice and
// sets window.__shotReady for a screenshot. window.__emberWarden exposes the
// live state and screen for automated play-testing.
import { BEST_KEY, STEP } from './config.js';
import { createRandom } from './random.js';
import { createAudio } from './audio.js';
import { createWorld, EVENT_DASH, EVENT_HIT, EVENT_LEVELUP, EVENT_OVER, EVENT_WIN } from './world.js';
import {
  ACTION_CONFIRM, ACTION_DASH, ACTION_PAUSE, ACTION_PICK_1, ACTION_PICK_2, ACTION_PICK_3,
  createInput,
} from './input.js';
import {
  createRenderer, SCREEN_LEVELUP, SCREEN_OVER, SCREEN_PAUSED, SCREEN_PLAY, SCREEN_TITLE, SCREEN_WIN,
} from './render.js';
import { stageShot } from './shots.js';

/** The longest frame the loop catches up on; a longer stall (a hidden tab) is dropped, not replayed. */
const MAX_FRAME = 0.25;

const params = new URLSearchParams(window.location.search);
const shot = params.get('shot');
const seedParam = Number.parseInt(params.get('seed') ?? '', 10);
const seed = Number.isInteger(seedParam) ? seedParam : Math.floor(Math.random() * 4294967296);

const canvas = document.getElementById('game');
const status = document.getElementById('status');
const world = createWorld(createRandom(seed));
const renderer = createRenderer(canvas);
const audio = createAudio();

function readBest() {
  try {
    return Number.parseInt(window.localStorage.getItem(BEST_KEY) ?? '0', 10) || 0;
  } catch {
    return 0;
  }
}

function saveBest(value) {
  try {
    window.localStorage.setItem(BEST_KEY, String(value));
  } catch {
    // Storage can be off (private windows): the best score then lasts this visit only.
  }
}

function runShot(name) {
  const scene = stageShot(name, world);
  let painted = 0;
  function paint() {
    renderer.draw(world.state, scene.screen, scene.best, null);
    painted += 1;
    if (painted < 2) requestAnimationFrame(paint);
    else window.__shotReady = true;
  }
  requestAnimationFrame(paint);
}

function runGame() {
  const input = createInput(canvas);
  let screen = SCREEN_TITLE;
  let best = readBest();
  let accumulator = 0;
  let last = performance.now();

  // The testing hook: live state and screen, read by automated play-tests.
  window.__emberWarden = { state: world.state, screen: () => screen };

  // Sound starts on the first gesture, and M toggles mute.
  const unlock = () => audio.unlock();
  window.addEventListener('pointerdown', unlock);
  window.addEventListener('keydown', unlock);
  window.addEventListener('keydown', (event) => {
    if (event.code === 'KeyM') audio.toggleMute();
  });

  // Screen readers (and anyone watching the page's text) hear the screen changes and each hit.
  function announce(message) {
    status.textContent = message;
  }

  function startGame() {
    world.reset();
    accumulator = 0;
    screen = SCREEN_PLAY;
    announce('Playing. Hold the lantern. Wave 1 is coming.');
  }

  function endGame(won) {
    screen = won ? SCREEN_WIN : SCREEN_OVER;
    if (world.state.score > best) {
      best = world.state.score;
      saveBest(best);
    }
    if (won) {
      audio.victory();
      announce(`Victory. Score ${world.state.score}. Best ${best}.`);
    } else {
      audio.gameOver();
      announce(`Game over. Score ${world.state.score}. Best ${best}.`);
    }
  }

  /** Take one offered blessing; another waits behind it, or the fight resumes. */
  function pickUpgrade(index) {
    const offer = world.state.offer;
    if (index < 0 || index >= offer.length) return;
    world.grantUpgrade(offer[index].id);
    audio.pickup();
    world.state.pendingLevels -= 1;
    if (world.state.pendingLevels > 0) {
      world.offerUpgrades();
      announce(`Level ${world.state.level}. Choose another blessing.`);
    } else {
      world.state.offer = [];
      screen = SCREEN_PLAY;
      announce('Playing.');
    }
  }

  function cardAt(pointer) {
    const geometry = renderer.cardGeometry();
    const startX = (1280 - geometry.totalWidth) / 2;
    for (let i = 0; i < world.state.offer.length; i += 1) {
      const x = startX + i * (geometry.width + geometry.gap);
      if (pointer.x >= x && pointer.x <= x + geometry.width && pointer.y >= geometry.y && pointer.y <= geometry.y + geometry.height) return i;
    }
    return -1;
  }

  function handleActions(actions) {
    const pointer = input.takePointer();
    if (screen === SCREEN_LEVELUP) {
      if (actions & ACTION_PICK_1) pickUpgrade(0);
      else if (actions & ACTION_PICK_2) pickUpgrade(1);
      else if (actions & ACTION_PICK_3) pickUpgrade(2);
      else if (pointer.clicked) {
        const card = cardAt(pointer);
        if (card >= 0) pickUpgrade(card);
      }
      return;
    }
    if (actions & ACTION_CONFIRM && (screen === SCREEN_TITLE || screen === SCREEN_OVER || screen === SCREEN_WIN)) {
      startGame();
    } else if (actions & ACTION_PAUSE && screen === SCREEN_PLAY) {
      screen = SCREEN_PAUSED;
      announce('Paused.');
    } else if (actions & (ACTION_PAUSE | ACTION_CONFIRM) && screen === SCREEN_PAUSED) {
      screen = SCREEN_PLAY;
      announce('Playing.');
    }
  }

  function step(actions) {
    if (screen === SCREEN_TITLE) {
      world.step(STEP, { x: 0, y: 0 }, false, true);
      return;
    }
    if (screen !== SCREEN_PLAY) return;
    const events = world.step(STEP, input.steer(), Boolean(actions & ACTION_DASH), false);
    if (events & EVENT_DASH) audio.dash();
    if (events & EVENT_WIN) endGame(true);
    else if (events & EVENT_OVER) endGame(false);
    else if (events & EVENT_LEVELUP) {
      screen = SCREEN_LEVELUP;
      audio.levelUp();
      announce(`Level ${world.state.level}. Choose a blessing.`);
    } else if (events & EVENT_HIT) {
      audio.hurt();
      announce(world.state.player.hp <= 25 ? 'Hurt. Health is low.' : 'Hurt.');
    }
  }

  function frame(now) {
    requestAnimationFrame(frame);
    accumulator += Math.min((now - last) / 1000, MAX_FRAME);
    last = now;
    // One read of the one-shot presses per frame, shared by the screens and the step.
    const actions = input.takeActions();
    handleActions(actions);
    if (screen === SCREEN_TITLE || screen === SCREEN_PLAY) {
      // A one-shot press counts once per frame, not once per fixed sub-step.
      let firstStep = true;
      while (accumulator >= STEP && (screen === SCREEN_TITLE || screen === SCREEN_PLAY)) {
        step(firstStep ? actions : 0);
        firstStep = false;
        accumulator -= STEP;
      }
    } else {
      accumulator = 0;
    }
    const pointer = screen === SCREEN_LEVELUP ? input.takePointer() : null;
    renderer.draw(world.state, screen, best, pointer);
  }

  // Leaving the tab pauses a running game rather than letting shadows close in unseen.
  document.addEventListener('visibilitychange', () => {
    if (document.hidden && screen === SCREEN_PLAY) {
      screen = SCREEN_PAUSED;
      announce('Paused.');
    }
  });

  announce('Ember Warden. Press Space or click to begin.');
  requestAnimationFrame(frame);
}

if (shot) runShot(shot);
else runGame();
