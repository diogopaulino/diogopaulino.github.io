/** Tráfego / Drivatars: seguem a linha central com variação de ritmo. */

import { Vehicle } from './vehicle.js';
import { buildCar } from './carModel.js';
import { CARS } from './config.js';
import { clamp } from './utils.js';

export class Traffic {
    constructor(scene, road, count) {
        this.cars = [];
        this.meshes = [];
        const n = Math.max(0, count);
        for (let i = 0; i < n; i++) {
            const spec = CARS[(i + 1) % CARS.length];
            const vehicle = new Vehicle({ road, spec, isPlayer: false });
            const dist = (road.length * ((i + 1) / (n + 1))) % road.length;
            const side = i % 2 === 0 ? -2.2 : 2.2;
            vehicle.spawn(dist, side);
            vehicle.speed = 28 + (i % 5) * 4;
            const mesh = buildCar(spec);
            vehicle.applyMesh(mesh, 0.016);
            scene.add(mesh);
            this.cars.push(vehicle);
            this.meshes.push(mesh);
        }
    }

    update(dt, player) {
        for (let i = 0; i < this.cars.length; i++) {
            const car = this.cars[i];
            const look = car.road.sample((car.lapDistance + 18) % car.road.length);
            const headingErr = Math.atan2(
                Math.sin(look.heading - car.yaw),
                Math.cos(look.heading - car.yaw)
            );
            const targetSpeed = 26 + (i % 4) * 5;
            const throttle = car.speed < targetSpeed ? 0.7 : 0.2;
            const brake = car.speed > targetSpeed + 8 ? 0.4 : 0;
            car.update(dt, {
                throttle,
                brake,
                steer: clamp(headingErr * 1.6 - car.lateral * 0.08, -1, 1),
                handbrake: 0
            });

            if (player) {
                const dx = car.position.x - player.position.x;
                const dz = car.position.z - player.position.z;
                const d2 = dx * dx + dz * dz;
                if (d2 < 12) {
                    const d = Math.sqrt(d2) || 1;
                    const push = (3.5 - d) * 4;
                    car.vx += (dx / d) * push;
                    car.vz += (dz / d) * push;
                    player.vx -= (dx / d) * push * 0.45;
                    player.vz -= (dz / d) * push * 0.45;
                    player.speed *= 0.92;
                }
            }
            car.applyMesh(this.meshes[i], dt);
        }
    }

    setLights(on) {
        for (const mesh of this.meshes) mesh.userData.lightsOn = on;
    }
}
