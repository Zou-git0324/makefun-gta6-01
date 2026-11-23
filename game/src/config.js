// Solmar Bay — shared tuning constants.
// Every value here is read by the game modules (city, combat, input,
// pedestrians, police, traffic, vehicles, missions). Keep the keys stable:
// the untouched modules (city, combat, input, pedestrians, save) import
// these names directly.

export const WORLD = {
  blockSize: 60,
  roadWidth: 12,
  blocks: 7,
  beachDepth: 46,
  seaDepth: 50,
};

export const PALETTE = {
  sky: 0x8ec9ce,
  sun: 0xfff3c4,
  sea: 0x2e7f9e,
  sand: 0xd9c28a,
  asphalt: 0x3a3f4a,
  sidewalk: 0x9a938a,
  grass: 0x5d8a4a,
  building: [0x8a7f8e, 0x7a6f7e, 0x9a8f96, 0x6b7f8e, 0xa89a8e],
  glass: 0x9fb8c8,
  playerJacket: 0x7a4a8e,
  playerPants: 0x2e3a4a,
  taxi: 0xf5c518,
  police: 0x2b4a6b,
  marker: 0xffd23e,
};

export const PLAYER = {
  walkSpeed: 6,
  runSpeed: 10,
  radius: 0.8,
  height: 1.8,
  health: 100,
  punchDamage: 25,
  punchRange: 2.2,
  punchRate: 0.45,
  shootDamage: 34,
  shootRange: 60,
  shootRate: 0.28,
  startCash: 250,
};

export const CAR = {
  accel: 14,
  brake: 30,
  reverseAccel: 8,
  maxSpeed: 43,
  maxReverse: 12,
  steerAngle: 0.55,
  grip: 1,
  handbrakeGrip: 0.35,
};

// Per-kind handling. The three classes the game tests on the road are
// sports 43, sedan 34 and van 26.
export const CAR_KINDS = {
  sedan: { accel: 12, topSpeed: 34, grip: 1.0, label: 'Sedan' },
  sports: { accel: 18, topSpeed: 43, grip: 1.15, label: 'Sports' },
  coupe: { accel: 15, topSpeed: 38, grip: 1.1, label: 'Coupe' },
  van: { accel: 9, topSpeed: 26, grip: 0.85, label: 'Van' },
  taxi: { accel: 13, topSpeed: 31, grip: 1.0, label: 'Taxi' },
};

export const CAR_DAMAGE = {
  crashPerSpeed: 1.21,
  smokeAt: 50,
  maxSpeedLoss: 0.5,
};

export const TRAFFIC = {
  count: 14,
  speedMin: 8,
  speedMax: 16,
};

export const PEDESTRIANS = {
  count: 26,
  speedMin: 1.2,
  speedMax: 2.2,
};

export const POLICE = {
  baseCars: 0,
  carsPerStar: 1,
  maxCars: 5,
  speed: 36,
  ramDamage: 12,
  heliAtStars: 4,
  heliHeight: 30,
  heliOrbit: 38,
};

export const WANTED = {
  decaySeconds: 20,
  stealStars: 1,
  hitPedStars: 1,
  shootStars: 1,
  killCopStars: 2,
  maxStars: 5,
  bustDistance: 6,
  bustStillSeconds: 4,
};

export const MISSIONS = {
  total: 11,
  debtTarget: 40000,
};

// Mission 11, the Solmar Stash Run: six stash packages, one clock.
// missions.js reads STASH for the def; the HUD counter and the 300-second
// countdown are driven from the same numbers, so they can never drift apart.
export const STASH = {
  count: 6,
  timeLimit: 300,
  reward: 10000,
};

export const DAY_LENGTH = 2880;

export const KEYS = {
  forward: 'KeyW',
  back: 'KeyS',
  left: 'KeyA',
  right: 'KeyD',
  run: 'ShiftLeft',
  interact: 'KeyE',
  attack: 'KeyF',
  handbrake: 'Space',
  pause: 'KeyP',
  mute: 'KeyM',
};

export const SAVE_KEY = 'solmar-bay.save.v1';
