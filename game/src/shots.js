// Cahaya Bay — screenshot scenes. One job: set the game up into a fixed,
// repeatable state for each ?shot= scene, then let the real game run from
// there. Every shot is a real render of the real rules, never a still.
import { RNG } from './random.js';
import { makeCar } from './vehicles.js';
import { startMission } from './missions.js';

// Step the simulation forward N fixed steps so traffic/peds have spread out.
function step(G, n) {
  for (let i = 0; i < n; i++) G.tick(1 / 60, true);
}

export function applyShot(G, name, seed = 7) {
  G.rng = new RNG(seed);
  G.state = 'play';
  G.hideOverlays();
  const P = G.player;

  if (name === 'start') {
    // Title screen over a living city: player on foot, traffic rolling.
    G.state = 'title';
    P.pos.set(0, 0, 40);
    P.heading = Math.PI;
    P.mesh.rotation.y = P.heading;
    G.camYaw = Math.PI * 0.15;
    step(G, 240);
    return;
  }

  if (name === 'humans') {
    // Close-up of the detailed humans: protagonist on foot in the
    // foreground, a crowd of pedestrians (all archetypes) facing the
    // camera and walking, so faces, hair, outfits and walk cycles read.
    // Player stands on the x=20 avenue (open road, no building in frame);
    // the crowd stands between the camera and the player, 3-11 units away.
    P.pos.set(20, 0, 40);
    P.heading = Math.PI;
    P.mesh.rotation.y = P.heading;
    G.camYaw = P.heading + Math.PI;
    step(G, 60);
    const spots = [[14, 44], [17, 46], [20, 48], [23, 46], [26, 44], [12, 50], [28, 50], [18.5, 52]];
    G.peds.forEach((p, i) => {
      if (i < spots.length) {
        p.mesh.position.set(spots[i][0], 0, spots[i][1]);
        p.heading = Math.PI; // face the camera (south)
        p.mesh.rotation.y = Math.PI;
        p.speed = 1.6;
      }
    });
    step(G, 30);
    return;
  }

  if (name === 'drive') {
    // Driving down the main avenue, HUD + minimap on.
    const car = makeCar(-60, 20, Math.PI / 2, 0xd94f3d, 'player');
    G.scene.add(car.mesh);
    P.enterCar(G, car);
    car.speed = 14;
    G.camYaw = car.heading + Math.PI;
    G.cash = 1250;
    step(G, 180);
    return;
  }

  if (name === 'chase') {
    // Police chase: wanted 3, three police cars closing in, roadblock ahead.
    const car = makeCar(0, 60, 0, 0xd94f3d, 'player');
    G.scene.add(car.mesh);
    P.enterCar(G, car);
    car.speed = 18;
    G.addWanted(3, 'Kejar-kejaran dengan polisi!');
    G.camYaw = car.heading + Math.PI;
    G.cash = 3400;
    step(G, 120);
    car.speed = 20; // keep it moving for the frame
    return;
  }

  if (name === 'mission') {
    // Mission 5 in progress: on foot, enemies visible at the docks, marker up.
    startMission(G, 4);
    P.pos.set(-88, 0, 60);
    P.heading = Math.atan2(-100 - -88, 56 - 60);
    P.mesh.rotation.y = P.heading;
    G.camYaw = P.heading + Math.PI;
    G.cash = 2750;
    step(G, 90);
    return;
  }

  // Default: free play.
  step(G, 120);
}
