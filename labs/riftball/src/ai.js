/**
 * CPU arcade: ataca se está mais perto da bola; senão cobre o próprio gol.
 * Mira um ponto atrás da bola, na direção do portal rival.
 */

import { ARENA } from './config.js';
import { clamp, wrapPi } from './utils.js';

export function aiInput(me, opp, ball, team) {
    const attackX = team === 0 ? ARENA.halfX : -ARENA.halfX;
    const defendX = -attackX;
    const myDist = Math.hypot(me.x - ball.x, me.z - ball.z);
    const oppDist = Math.hypot(opp.x - ball.x, opp.z - ball.z);
    const ownHalf = Math.sign(ball.x || 1) === Math.sign(defendX);

    let tx;
    let tz;
    if (myDist < oppDist + 1.8 || !ownHalf) {
        const gx = attackX - ball.x;
        const gz = -ball.z;
        const glen = Math.hypot(gx, gz) || 1;
        tx = ball.x - (gx / glen) * 3.1;
        tz = ball.z - (gz / glen) * 3.1;
    } else {
        tx = ball.x * 0.45 + defendX * 0.4;
        tz = ball.z * 0.65;
    }

    const dx = tx - me.x;
    const dz = tz - me.z;
    const desired = Math.atan2(dx, dz);
    const err = wrapPi(desired - me.yaw);
    const steer = clamp(err / 0.55, -1, 1);
    const ahead = Math.hypot(dx, dz);
    const facing = Math.cos(err);
    const throttle = ahead > 1.2 ? (facing > 0.15 ? 1 : 0.35) : 0.15;
    const boost = ahead > 9 && facing > 0.55 && me.boost > 0.2;
    const jump = ball.y > 2.3 && myDist < 3.6 && facing > 0.2;
    return { throttle, steer, boost, jump };
}
