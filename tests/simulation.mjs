import assert from 'node:assert/strict';
import { RideSimulation, roadX, roadY, terrainY, roadSurfaceAt, biomeAt } from '../dist/simulation.js';
import { terrainSurfaceY, QUALITY } from '../dist/world.js';

const step = (sim, seconds, input = {}) => {
  for (let i = 0; i < seconds * 60; i++) sim.update(1 / 60, input);
};

// Verify Ultra quality preset exists alongside low, medium, high
assert(QUALITY.low && QUALITY.medium && QUALITY.high && QUALITY.ultra, 'All 4 quality presets exist');
assert(QUALITY.ultra.ahead > QUALITY.high.ahead && QUALITY.ultra.grass > QUALITY.high.grass, 'Ultra quality scales up draw distance and grass density');

const sim = new RideSimulation();
step(sim, 5, { throttle: 1 });
assert(sim.v > 5 && sim.v < 25, 'Acceleration must be gradual');
const before = sim.v;
step(sim, 1);
assert(sim.v < before && sim.v > 0, 'Coasting retains momentum');

sim.cruise = 60;
step(sim, 45);
assert(Math.abs(sim.v * 3.6 - 60) < 3, 'Cruise settles near 60 km/h');
assert(Math.abs(sim.offset + 1.75) < 0.5, 'Lane assist tracks curved road');

step(sim, 1, { brake: 1 });
assert.equal(sim.cruise, 0, 'Brake releases cruise');
step(sim, 10, { brake: 1 });
assert.equal(sim.v, 0, 'Brake can stop the motorcycle');

const tour = new RideSimulation();
step(tour, 180, { throttle: 1 });
assert(tour.v * 3.6 <= 100.01, 'Tour speed cap');

const speed = new RideSimulation();
speed.mode = 'speed';
step(speed, 180, { throttle: 1 });
assert(speed.v * 3.6 > 100 && speed.v * 3.6 <= 180.01, 'Speed mode cap');

const long = new RideSimulation();
long.cruise = 80;
step(long, 3600);
assert(long.distance > 70000, 'One-hour ride advances');
assert(Math.abs(long.offset) < 4, 'Long ride stays on road');
for (const v of Object.values(long)) if (typeof v === 'number') assert(Number.isFinite(v), 'Long ride stays numerically stable');

const recovery = new RideSimulation();
recovery.offset = 40;
recovery.v = 20;
step(recovery, 2);
assert.equal(recovery.recoveries, 1);
assert(Math.abs(recovery.offset) < 4, 'Recovery returns to lane');

const steer = new RideSimulation();
steer.v = 15;
step(steer, 0.5, { steer: 1 });
assert(steer.offset > -1.75, 'Left steering moves left in world coordinates');
assert(steer.lean < 0, 'Steering produces lean');

const car = new RideSimulation();
car.setVehicle('car');
assert.equal(car.rpm, 850);
step(car, 5, { throttle: 1 });
assert(car.v > 5 && car.v < before, 'Car accelerates more gently than the motorcycle');
car.cruise = 80;
step(car, 75);
assert(Math.abs(car.v * 3.6 - 80) < 3, 'Car cruise settles at target');
assert(Math.abs(car.offset + 1.75) < 0.5, 'Car keeps right lane');
step(car, 0.5, { steer: 1 });
assert(car.lean > 0 && car.lean < 0.11, 'Car has small outward body roll');
step(car, 1, { brake: 1 });
assert.equal(car.cruise, 0);
step(car, 10, { brake: 1 });
assert.equal(car.v, 0, 'Car brakes to a stop');

car.v = 25;
car.cruise = 80;
const trip = car.distance;
car.setVehicle('bike');
assert.equal(car.v, 0);
assert.equal(car.cruise, 0);
assert.equal(car.lean, 0);
assert.equal(car.distance, trip, 'Vehicle swap preserves trip and clears motion');

car.setVehicle('car');
car.mode = 'speed';
step(car, 180, { throttle: 1 });
assert(car.v * 3.6 > 100 && car.v * 3.6 <= 180.01, 'Car supports speed mode');

// Verify varied road surfaces and biomes appear along a 20km journey
const surfacesFound = new Set(), biomesFound = new Set();
for (let s = 0; s <= 25000; s += 120) {
  surfacesFound.add(roadSurfaceAt(s));
  biomesFound.add(biomeAt(s));
}
assert(surfacesFound.has('asphalt') && surfacesFound.has('cracked') && surfacesFound.has('gravel') && surfacesFound.has('dirt'), 'Road transitions across paved, cracked, gravel, and dirt surfaces');
assert(biomesFound.has('steppe') && biomesFound.has('gobi') && biomesFound.has('lake'), 'Biomes transition naturally across steppe, lakeside, and Gobi desert');

for (const s of [0, 239.999, 240, 1999.999, 2000, 1000000]) {
  assert(Number.isFinite(terrainY(roadX(s), s)));
  assert(Math.abs(terrainY(roadX(s), s) - (roadY(s) - 0.16)) < 1e-8, 'Road terrain matches across chunks');
}
for (const s of [-240, 0, 112.5, 240, 1995, 2002.5, 1000050]) {
  for (const d of [-18, -10, 6, 10, 18]) {
    assert(Math.abs(terrainSurfaceY(roadX(s) + d, s) - terrainY(roadX(s) + d, s)) < 1e-7, 'Prop placement matches terrain vertices');
  }
}
for (const s of [240, 480, 720]) {
  assert(Math.abs(terrainSurfaceY(roadX(s - 0.001) + 12, s - 0.001) - terrainSurfaceY(roadX(s + 0.001) + 12, s + 0.001)) < 0.05, 'Prop surface is continuous across chunks');
}

console.log('PASS: ultra quality, acceleration, inertia, cruise, braking, modes, 1-hour ride, recovery, steering/lean, car handling/cruise/braking/vehicle swap, road surfaces/biomes, road continuity, prop-ground contact.');
