// Every tuning number, colour and key binding for Solmar Bay lives here, so a
// balance pass touches one file and nothing else.

export const WORLD = {
  blockSize: 46,
  roadWidth: 14,
  blocks: 7, // 7 x 7 blocks; the city is a square grid with a beach on the south edge
  beachDepth: 46,
  seaDepth: 120,
};

export const PLAYER = {
  walkSpeed: 6.5,
  runSpeed: 11,
  radius: 0.55,
  height: 1.8,
  health: 100,
  punchDamage: 18,
  punchRange: 2.4,
  punchRate: 0.45,
  shootDamage: 34,
  shootRange: 60,
  shootRate: 0.28,
  startCash: 250,
};

export const CAR = {
  accel: 16,
  brake: 30,
  reverseAccel: 9,
  maxSpeed: 34,
  maxReverse: 10,
  steerAngle: 0.55,
  grip: 6.5,
  handbrakeGrip: 2.2,
};

export const TRAFFIC = { count: 14, speedMin: 7, speedMax: 11 };
export const PEDESTRIANS = { count: 26, speedMin: 1.1, speedMax: 2.1 };

export const WANTED = {
  decaySeconds: 26, // seconds clean before one star fades
  stealStars: 1,
  hitPedStars: 1,
  shootStars: 2,
  killCopStars: 2,
  maxStars: 5,
  bustDistance: 3.2,
  bustStillSeconds: 2.2,
};

export const POLICE = {
  baseCars: 1,
  carsPerStar: 1,
  maxCars: 6,
  speed: 30,
  ramDamage: 6,
};

export const MISSIONS = { total: 6, debtTarget: 40000 };

export const SAVE_KEY = 'solmar-bay.save.v1';

export const PALETTE = {
  sky: 0x8ec9ee,
  sun: 0xfff2cf,
  sea: 0x2a7f9e,
  sand: 0xe8cf9a,
  asphalt: 0x33363d,
  sidewalk: 0x9aa0a8,
  grass: 0x5d9b52,
  building: [0xe8b4a0, 0xf2d492, 0xa8c8d8, 0xd8a8c0, 0xb8d8a8, 0xe0e0e0, 0xc8b8e8, 0xf0a868],
  glass: 0x9fd4e8,
  playerJacket: 0xff5d73,
  playerPants: 0x2a3550,
  taxi: 0xffc93c,
  police: 0x1c2f6e,
  marker: 0xffd23f,
};

export const KEYS = {
  forward: ['KeyW', 'ArrowUp'],
  back: ['KeyS', 'ArrowDown'],
  left: ['KeyA', 'ArrowLeft'],
  right: ['KeyD', 'ArrowRight'],
  run: ['ShiftLeft', 'ShiftRight'],
  interact: ['KeyE'],
  attack: ['KeyF'],
  handbrake: ['Space'],
  pause: ['KeyP', 'Escape'],
  mute: ['KeyM'],
};

export const DAY_LENGTH = 480; // seconds of play per in-game day; the clock starts at 09:00
