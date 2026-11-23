// Solmar Bay — tuning constants.
//
// Every number the game balances on lives here, so a rebalance is a
// one-file edit. The city builders and the systems below only ever read
// these values; none of them invent their own.

// The city is a regular grid. Roads run north-south and east-west every
// `blockSize` metres, with `blocks` blocks per side, so the built-up half
// extent is blocks * blockSize / 2 = 210. Past that line is beach, then sea.
export const WORLD = {
  blockSize: 60,
  roadWidth: 12,
  blocks: 7,
  beachDepth: 46,
  seaDepth: 50,
};

// Colours, as hex numbers. Sky is the pale morning blue the menu opens on.
export const PALETTE = {
  sky: 0x8ec9ee,
  sun: 0xfff2cc,
  sea: 0x2e7f9e,
  sand: 0xd9c08a,
  asphalt: 0x3a3f46,
  sidewalk: 0x9aa0a6,
  grass: 0x5d8a4a,
  building: [0x8a93a6, 0x7a8296, 0x9aa0b6, 0x6b7280, 0xa8a0b8],
  glass: 0x9fc4d8,
  playerJacket: 0x7a2e8f,
  playerPants: 0x2e3440,
  taxi: 0xf5c518,
  police: 0x2b4acb,
  marker: 0xffd23f,
};

// Lena on foot.
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

// Generic car physics. A kind's tune overrides accel / topSpeed / grip.
export const CAR = {
  accel: 14,
  brake: 30,
  reverseAccel: 8,
  maxSpeed: 43,
  maxReverse: 12,
  steerAngle: 0.55,
  grip: 1.0,
  handbrakeGrip: 0.35,
};

// Five kinds of traffic. Each one drives differently: the sports car is
// the fastest thing on the road, the van is a brick with a steering wheel,
// and the taxi sits in the middle because it has fares to catch.
export const CAR_KINDS = {
  sedan: { accel: 12, topSpeed: 34, grip: 1.0, label: 'Sedan' },
  sports: { accel: 18, topSpeed: 43, grip: 1.15, label: 'Sports' },
  coupe: { accel: 15, topSpeed: 38, grip: 1.1, label: 'Coupe' },
  van: { accel: 9, topSpeed: 26, grip: 0.85, label: 'Van' },
  taxi: { accel: 13, topSpeed: 31, grip: 1.0, label: 'Taxi' },
};

// What a crash costs. Damage is added per unit of impact speed; past
// `smokeAt` the car starts smoking, and at 100 damage the top speed has
// fallen by `maxSpeedLoss` (half).
export const CAR_DAMAGE = {
  crashPerSpeed: 1.21,
  smokeAt: 50,
  maxSpeedLoss: 0.5,
};

// Ambient traffic.
export const TRAFFIC = {
  count: 14,
  speedMin: 8,
  speedMax: 16,
};

// People on the sidewalks.
export const PEDESTRIANS = {
  count: 26,
  speedMin: 1.2,
  speedMax: 2.2,
};

// The Solmar Bay Police Department.
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

// Heat. Stars fade one at a time once the timer runs out; getting caught
// on foot while standing still near a cruiser means a bust.
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

// The story: ten jobs to clear a $40,000 debt.
export const MISSIONS = {
  total: 10,
  debtTarget: 40000,
};

// Keyboard. These are `code` values, so they work on any layout.
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

// A full in-game day lasts 48 real minutes.
export const DAY_LENGTH = 2880;

// Local save slot.
export const SAVE_KEY = 'solmar-bay.save.v1';
