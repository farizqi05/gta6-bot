// Cahaya Bay — shared constants. One job: every number the game agrees on
// (city layout, speeds, wanted levels, colours) lives here and nowhere else.

export const CFG = {
  // City: streets run at these x and z coordinates; blocks sit between them.
  roads: [-100, -60, -20, 20, 60, 100],
  blockSize: 40,
  streetWidth: 12,
  worldBound: 118,          // playable area half-size (x and z)
  beachZ: 118,              // sand starts here (south edge)
  seaZ: 138,                // sea plane starts here

  playerWalk: 6,
  playerRun: 10.5,
  playerRadius: 0.7,
  playerHealth: 100,

  carMaxSpeed: 30,
  carAccel: 16,
  carBrake: 34,
  carReverse: 10,
  carSteer: 2.1,
  carRadius: 1.6,

  trafficCount: 12,
  pedestrianCount: 30,
  policeMax: 5,

  wantedMax: 5,
  wantedDecaySeconds: 25,   // no crime for this long drops one star

  // Sun-soaked golden-hour palette.
  palette: {
    sky: 0xffd9a0,
    sun: 0xffe0b3,
    sea: 0x2e7f9e,
    sand: 0xe8c98a,
    asphalt: 0x3a3f46,
    sidewalk: 0xcfc4ae,
    building: [0xe8a87c, 0xf2d5a0, 0x7fb5a8, 0xe07856, 0xf7ead1, 0x9fc2d6, 0xd98c6a, 0xefe3c0],
    palmTrunk: 0x8a6b48,
    palmLeaf: 0x3f8f4f,
    car: [0xd94f3d, 0x2e6fb0, 0xe8b93a, 0x3aa17a, 0x8a5fb0, 0xe8e4da, 0x22262b, 0xe07a2e],
    police: 0x1f3a5f,
    taxi: 0xf2c230,
  },

  controls: {
    up: 'KeyW', down: 'KeyS', left: 'KeyA', right: 'KeyD',
    run: 'ShiftLeft', enterCar: 'KeyE', shoot: 'KeyF',
    brake: 'Space', pause: 'Escape', radio: 'KeyM',
  },
};

export const MISSION_NAMES = [
  'Selamat Datang di Cahaya',
  'Pinjam Tanpa Izin',
  'Antar Paket Cepat',
  'Panas di Jalan',
  'Tagihan di Pelabuhan',
  'Mobil Pesanan',
  'Kabur dari Blokade',
  'Raja Cahaya',
];
