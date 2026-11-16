// Ember Warden — my best-game-01 entry (Node 22, standard library only).
// The game itself is the plain static files in game/ beside this file: an arena-survival
// lantern game (game/index.html plus its ES modules, no library, no network request).
// This entrypoint hands it in: it copies game/ and screenshots/ to /output and writes
// /output/dossier.json, the summary the judge reads, with the vendored make.fun library.
// Screenshots live in screenshots/ (the first by name is the cover). Serve it locally
// with `node serve.ts`, then open http://localhost:8080. Outside the grader's
// container, MAKEFUN_OUTPUT_DIR stands in for /output:
//   mkdir -p out && MAKEFUN_OUTPUT_DIR=out node main.ts

import { cpSync, existsSync, mkdirSync, writeFileSync } from 'node:fs';
import { join } from 'node:path';
import { fileURLToPath } from 'node:url';
import { buildDossier } from './vendor/makefun-game.ts';

const here = fileURLToPath(new URL('.', import.meta.url));
const out = process.env.MAKEFUN_OUTPUT_DIR ?? '/output';

mkdirSync(out, { recursive: true });
cpSync(join(here, 'game'), join(out, 'game'), { recursive: true });
mkdirSync(join(out, 'screenshots'), { recursive: true });
if (existsSync(join(here, 'screenshots'))) cpSync(join(here, 'screenshots'), join(out, 'screenshots'), { recursive: true });

// The scorer's own caps (reference/gate.json): only text_max_bytes shapes the bytes; the others refuse an entry the
// scorer would refuse (more than 4 screenshots or one over 256 KiB; more than 993 files in game/ or 48 MiB of game
// files, in all, or a path under game/ over 1000 bytes: game/ counts beside /output's own 1000-entry cap, its
// screenshots/ and dossier.json).
writeFileSync(
  join(out, 'dossier.json'),
  buildDossier(out, {
    text_max_bytes: 163840,
    screenshots: { max: 4, max_bytes: 262144 },
    game_max_files: 993,
    game_max_bytes: 50331648,
    game_path_max_bytes: 1000,
  }),
);

// Ember Warden build summary: the arena-survival game in game/ plus its 4 screenshots
// are copied above, and dossier.json is written beside them. This line only reports
// the handover on a local run; it changes nothing inside /output.
console.log('Ember Warden: game/ + screenshots/ copied, dossier.json written to ' + out);
