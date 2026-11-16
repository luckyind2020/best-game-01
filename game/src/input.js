// Keyboard and pointer input. Held keys give an 8-way steering vector; one-shot
// presses (start, restart, pause, dash, upgrade picks) are queued as bit flags
// and taken once by the loop, so a press between two frames is never lost and
// never counted twice. The pointer's position is kept in logical field
// coordinates for the level-up cards, which are clicked or picked with 1, 2, 3.

import { FIELD } from './config.js';

export const ACTION_CONFIRM = 1;
export const ACTION_PAUSE = 2;
export const ACTION_DASH = 4;
export const ACTION_PICK_1 = 8;
export const ACTION_PICK_2 = 16;
export const ACTION_PICK_3 = 32;

const UP = new Set(['ArrowUp', 'KeyW']);
const DOWN = new Set(['ArrowDown', 'KeyS']);
const LEFT = new Set(['ArrowLeft', 'KeyA']);
const RIGHT = new Set(['ArrowRight', 'KeyD']);
const CONFIRM = new Set(['Enter']);
const DASH = new Set(['Space', 'ShiftLeft', 'ShiftRight']);
const PAUSE = new Set(['KeyP', 'Escape']);

export function createInput(canvas) {
  const keys = { up: false, down: false, left: false, right: false };
  let actions = 0;
  const pointer = { x: FIELD.width / 2, y: FIELD.height / 2, clicked: false };

  function trackPointer(event) {
    const rect = canvas.getBoundingClientRect();
    const scale = Math.min(rect.width / FIELD.width, rect.height / FIELD.height);
    const offsetX = (rect.width - FIELD.width * scale) / 2;
    const offsetY = (rect.height - FIELD.height * scale) / 2;
    pointer.x = (event.clientX - rect.left - offsetX) / scale;
    pointer.y = (event.clientY - rect.top - offsetY) / scale;
  }

  window.addEventListener('keydown', (event) => {
    if (UP.has(event.code)) keys.up = true;
    else if (DOWN.has(event.code)) keys.down = true;
    else if (LEFT.has(event.code)) keys.left = true;
    else if (RIGHT.has(event.code)) keys.right = true;
    else if (CONFIRM.has(event.code)) { if (!event.repeat) actions |= ACTION_CONFIRM; }
    else if (DASH.has(event.code)) { if (!event.repeat) actions |= ACTION_DASH | ACTION_CONFIRM; }
    else if (PAUSE.has(event.code)) { if (!event.repeat) actions |= ACTION_PAUSE; }
    else if (event.code === 'Digit1' || event.code === 'Numpad1') { if (!event.repeat) actions |= ACTION_PICK_1; }
    else if (event.code === 'Digit2' || event.code === 'Numpad2') { if (!event.repeat) actions |= ACTION_PICK_2; }
    else if (event.code === 'Digit3' || event.code === 'Numpad3') { if (!event.repeat) actions |= ACTION_PICK_3; }
    else return;
    event.preventDefault();
  });
  window.addEventListener('keyup', (event) => {
    if (UP.has(event.code)) keys.up = false;
    else if (DOWN.has(event.code)) keys.down = false;
    else if (LEFT.has(event.code)) keys.left = false;
    else if (RIGHT.has(event.code)) keys.right = false;
  });
  // A key released while the tab is hidden never sends keyup: let go of everything on blur.
  window.addEventListener('blur', () => {
    keys.up = keys.down = keys.left = keys.right = false;
  });
  canvas.addEventListener('pointermove', trackPointer);
  canvas.addEventListener('pointerdown', (event) => {
    trackPointer(event);
    pointer.clicked = true;
    actions |= ACTION_CONFIRM;
  });

  return {
    /** Normalised steering vector {x, y}, each component -1, 0 or 1, diagonal-safe. */
    steer() {
      const x = (keys.right ? 1 : 0) - (keys.left ? 1 : 0);
      const y = (keys.down ? 1 : 0) - (keys.up ? 1 : 0);
      if (x !== 0 && y !== 0) {
        const inv = 1 / Math.SQRT2;
        return { x: x * inv, y: y * inv };
      }
      return { x, y };
    },
    /** The one-shot presses since the last call, as ACTION_* flags. */
    takeActions() {
      const taken = actions;
      actions = 0;
      return taken;
    },
    /** The pointer in field coordinates, and whether it was clicked since the last read. */
    takePointer() {
      const clicked = pointer.clicked;
      pointer.clicked = false;
      return { x: pointer.x, y: pointer.y, clicked };
    },
  };
}
