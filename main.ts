// Solmar Bay — a 3D open-world crime game — hands itself in to make.fun.
//
// The game is plain static files under game/ (game/index.html opens in desktop
// Chrome and plays with zero network requests: three.js is vendored as
// game/vendor/three.min.js, and every sound is synthesised in the browser).
// This program copies game/ and screenshots/ from beside this file into the
// output directory and writes output/dossier.json, the summary the judge
// reads, using the vendored make.fun library.
//
// Run it locally (Node 22, standard library only):
//   mkdir -p out && MAKEFUN_OUTPUT_DIR=out node main.ts
// Play it locally: `node serve.ts`, then open http://localhost:8080.

import { cpSync, existsSync, mkdirSync, writeFileSync } from 'node:fs';
import { join } from 'node:path';
import { fileURLToPath } from 'node:url';
import { buildDossier } from './vendor/makefun-game.ts';

const repoRoot = fileURLToPath(new URL('.', import.meta.url));
const outputDir = process.env.MAKEFUN_OUTPUT_DIR ?? '/output';

mkdirSync(outputDir, { recursive: true });
cpSync(join(repoRoot, 'game'), join(outputDir, 'game'), { recursive: true });
mkdirSync(join(outputDir, 'screenshots'), { recursive: true });
if (existsSync(join(repoRoot, 'screenshots'))) {
  cpSync(join(repoRoot, 'screenshots'), join(outputDir, 'screenshots'), { recursive: true });
}

// The scorer's own caps: only text_max_bytes shapes the dossier's bytes; the
// rest refuse an entry the scorer would refuse — more than 4 screenshots or
// one over 256 KiB; more than 993 files in game/ or 48 MiB of game files in
// all; a path under game/ over 1000 bytes. game/ shares the platform's
// 1000-entry / 64 MiB output cap with screenshots/ and dossier.json, so the
// caps below leave room for both.
writeFileSync(
  join(outputDir, 'dossier.json'),
  buildDossier(outputDir, {
    text_max_bytes: 163840,
    screenshots: { max: 4, max_bytes: 262144 },
    game_max_files: 993,
    game_max_bytes: 50331648,
    game_path_max_bytes: 1000,
  }),
);
