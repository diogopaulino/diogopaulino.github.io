/**
 * Simulação pura — sem three.js. O host (ou o modo local) avança o estado.
 *
 * Hover: a = heading * (thrust + boostThrust * boosting)
 *        v_lat *= exp(-grip * dt)   // deriva morre
 *        |v| limitado; yaw' = steer * STEER * (0.28 + 0.72 * speedNorm)
 *
 * Bola: gravidade, quique com restituição, arrasto leve.
 * Gol: |x| > halfX - 0.15, |z| < goalHalfZ, y < goalHeight.
 */

import {
    ARENA, BALL, CRAFT, HIT, PADS, PAD_RADIUS, TEAMS,
    SCORE_LIMIT, MATCH_TIME, KICKOFF_T, GOAL_FREEZE
} from './config.js';
import { clamp, wrapPi } from './utils.js';

function emptyInput() {
    return { throttle: 0, steer: 0, boost: false, jump: false };
}

export function blankInput() {
    return emptyInput();
}

function makeCraft(team) {
    const def = TEAMS[team];
    return {
        team,
        x: def.spawnX,
        y: CRAFT.hover,
        z: 0,
        yaw: def.yaw,
        vx: 0,
        vy: 0,
        vz: 0,
        boost: 1,
        air: false,
        boosting: false
    };
}

function makeBall() {
    return { x: 0, y: BALL.radius + 0.15, z: 0, vx: 0, vy: 0, vz: 0 };
}

export function createMatch() {
    return {
        crafts: [makeCraft(0), makeCraft(1)],
        ball: makeBall(),
        score: [0, 0],
        phase: 'kickoff',
        phaseT: KICKOFF_T,
        clock: MATCH_TIME,
        overtime: false,
        events: []
    };
}

export function resetKickoff(state, scorer = -1) {
    state.crafts[0] = makeCraft(0);
    state.crafts[1] = makeCraft(1);
    state.ball = makeBall();
    if (scorer === 0) state.ball.vx = 2.2;
    else if (scorer === 1) state.ball.vx = -2.2;
    state.phase = 'kickoff';
    state.phaseT = KICKOFF_T;
}

function speedLimit(vx, vz, max) {
    const s = Math.hypot(vx, vz);
    if (s <= max || s < 1e-6) return [vx, vz];
    const k = max / s;
    return [vx * k, vz * k];
}

function bounceWalls(body, r, rest) {
    const maxX = ARENA.halfX - r;
    const maxZ = ARENA.halfZ - r;
    let hit = false;
    if (body.x > maxX) {
        body.x = maxX;
        if (body.vx > 0) body.vx *= -rest;
        hit = true;
    } else if (body.x < -maxX) {
        body.x = -maxX;
        if (body.vx < 0) body.vx *= -rest;
        hit = true;
    }
    if (body.z > maxZ) {
        body.z = maxZ;
        if (body.vz > 0) body.vz *= -rest;
        hit = true;
    } else if (body.z < -maxZ) {
        body.z = -maxZ;
        if (body.vz < 0) body.vz *= -rest;
        hit = true;
    }
    return hit;
}

function collideSpheres(a, ra, ma, b, rb, mb, e) {
    const dx = b.x - a.x;
    const dy = b.y - a.y;
    const dz = b.z - a.z;
    const dist = Math.hypot(dx, dy, dz);
    const min = ra + rb;
    if (dist < 1e-6 || dist >= min) return false;
    const nx = dx / dist;
    const ny = dy / dist;
    const nz = dz / dist;
    const overlap = min - dist + HIT.minSep;
    const inv = 1 / ma + 1 / mb;
    a.x -= nx * overlap * (1 / ma) / inv;
    a.y -= ny * overlap * (1 / ma) / inv;
    a.z -= nz * overlap * (1 / ma) / inv;
    b.x += nx * overlap * (1 / mb) / inv;
    b.y += ny * overlap * (1 / mb) / inv;
    b.z += nz * overlap * (1 / mb) / inv;
    const rel = (b.vx - a.vx) * nx + (b.vy - a.vy) * ny + (b.vz - a.vz) * nz;
    if (rel < 0) {
        const j = -(1 + e) * rel / inv;
        a.vx -= (j / ma) * nx;
        a.vy -= (j / ma) * ny;
        a.vz -= (j / ma) * nz;
        b.vx += (j / mb) * nx;
        b.vy += (j / mb) * ny;
        b.vz += (j / mb) * nz;
    }
    return true;
}

function inGoal(ball) {
    if (ball.y > ARENA.goalHeight) return -1;
    if (Math.abs(ball.z) > ARENA.goalHalfZ) return -1;
    if (ball.x > ARENA.halfX - 0.2) return 0;
    if (ball.x < -ARENA.halfX + 0.2) return 1;
    return -1;
}

function stepCraft(c, input, dt) {
    const throttle = clamp(input.throttle, -1, 1);
    const steer = clamp(input.steer, -1, 1);
    const headingX = Math.sin(c.yaw);
    const headingZ = Math.cos(c.yaw);
    const boosting = Boolean(input.boost) && c.boost > 0.04 && throttle >= 0;
    c.boosting = boosting;

    const thrust = CRAFT.thrust * throttle + (boosting ? CRAFT.boostThrust : 0);
    c.vx += headingX * thrust * dt;
    c.vz += headingZ * thrust * dt;

    const fwd = c.vx * headingX + c.vz * headingZ;
    let latX = c.vx - headingX * fwd;
    let latZ = c.vz - headingZ * fwd;
    const grip = Math.exp(-CRAFT.grip * dt);
    latX *= grip;
    latZ *= grip;
    c.vx = headingX * fwd + latX;
    c.vz = headingZ * fwd + latZ;

    const max = boosting ? CRAFT.boostMax : CRAFT.maxSpeed;
    [c.vx, c.vz] = speedLimit(c.vx, c.vz, max);
    const drag = Math.exp(-CRAFT.drag * dt);
    c.vx *= drag;
    c.vz *= drag;

    const spd = Math.hypot(c.vx, c.vz);
    const speedNorm = clamp(spd / CRAFT.maxSpeed, 0, 1);
    c.yaw += steer * CRAFT.steer * (0.28 + 0.72 * speedNorm) * dt;
    c.yaw = wrapPi(c.yaw);

    if (input.jump && !c.air && c.y <= CRAFT.hover + 0.08) {
        c.vy = CRAFT.jump;
        c.air = true;
    }
    c.vy -= CRAFT.gravity * dt;
    c.y += c.vy * dt;
    if (c.y <= CRAFT.hover) {
        c.y = CRAFT.hover;
        if (c.vy < 0) c.vy = 0;
        c.air = false;
    }

    c.x += c.vx * dt;
    c.z += c.vz * dt;
    if (bounceWalls(c, CRAFT.radius, CRAFT.wallRest)) {
        /* wall tap */
    }

    if (boosting) c.boost = Math.max(0, c.boost - CRAFT.boostDrain * dt);
    else c.boost = Math.min(CRAFT.boostMaxMeter, c.boost + CRAFT.boostRegen * dt);

    for (const pad of PADS) {
        if (Math.hypot(c.x - pad.x, c.z - pad.z) < PAD_RADIUS) {
            c.boost = Math.min(CRAFT.boostMaxMeter, c.boost + CRAFT.padRegen * dt);
        }
    }
}

function stepBall(b, dt) {
    b.vy -= BALL.gravity * dt;
    const ad = Math.exp(-BALL.airDrag * dt);
    b.vx *= ad;
    b.vz *= ad;
    b.x += b.vx * dt;
    b.y += b.vy * dt;
    b.z += b.vz * dt;

    const floor = ARENA.floorY + BALL.radius;
    if (b.y < floor) {
        b.y = floor;
        if (b.vy < 0) b.vy = -b.vy * BALL.restitution;
        b.vx *= BALL.floorFriction;
        b.vz *= BALL.floorFriction;
        if (Math.abs(b.vy) < 0.8) b.vy = 0;
    }
    if (b.y > ARENA.ceiling - BALL.radius) {
        b.y = ARENA.ceiling - BALL.radius;
        if (b.vy > 0) b.vy *= -0.4;
    }
    const inMouth = Math.abs(b.z) < ARENA.goalHalfZ && b.y < ARENA.goalHeight;
    if (inMouth) {
        const maxZ = ARENA.halfZ - BALL.radius;
        if (b.z > maxZ) {
            b.z = maxZ;
            if (b.vz > 0) b.vz *= -BALL.wallRest;
        } else if (b.z < -maxZ) {
            b.z = -maxZ;
            if (b.vz < 0) b.vz *= -BALL.wallRest;
        }
    } else {
        bounceWalls(b, BALL.radius, BALL.wallRest);
    }
    [b.vx, b.vz] = speedLimit(b.vx, b.vz, BALL.maxSpeed);
}

export function step(state, inputs, dt) {
    state.events.length = 0;
    if (state.phase === 'over') return state;

    if (state.phase === 'kickoff' || state.phase === 'goal') {
        state.phaseT -= dt;
        if (state.phase === 'kickoff' && state.phaseT <= 0) {
            state.phase = 'play';
            state.events.push({ type: 'play' });
        }
        if (state.phase === 'goal' && state.phaseT <= 0) {
            const last = state.events;
            resetKickoff(state, state._lastScorer ?? -1);
            state.events = last;
        }
        return state;
    }

    if (!state.overtime) {
        state.clock = Math.max(0, state.clock - dt);
    }

    const ins = [inputs[0] || emptyInput(), inputs[1] || emptyInput()];
    stepCraft(state.crafts[0], ins[0], dt);
    stepCraft(state.crafts[1], ins[1], dt);
    stepBall(state.ball, dt);

    const a = state.crafts[0];
    const b = state.crafts[1];
    const ball = state.ball;

    if (collideSpheres(a, CRAFT.radius, CRAFT.mass, b, CRAFT.radius, CRAFT.mass, HIT.craftCraftE)) {
        state.events.push({ type: 'bump', x: (a.x + b.x) * 0.5, y: (a.y + b.y) * 0.5, z: (a.z + b.z) * 0.5 });
    }

    for (const c of state.crafts) {
        const before = { vx: ball.vx, vy: ball.vy, vz: ball.vz };
        if (collideSpheres(c, CRAFT.radius, CRAFT.mass, ball, BALL.radius, BALL.mass, HIT.craftBallE)) {
            const hx = Math.sin(c.yaw);
            const hz = Math.cos(c.yaw);
            const extra = HIT.kick + (c.boosting ? HIT.boostKick : 0);
            ball.vx += hx * extra * 0.35;
            ball.vz += hz * extra * 0.35;
            const impact = Math.hypot(ball.vx - before.vx, ball.vy - before.vy, ball.vz - before.vz);
            state.events.push({
                type: 'kick',
                x: ball.x,
                y: ball.y,
                z: ball.z,
                team: c.team,
                impact
            });
        }
    }

    const scorer = inGoal(ball);
    if (scorer >= 0) {
        state.score[scorer] += 1;
        state._lastScorer = scorer;
        state.events.push({ type: 'goal', team: scorer, x: ball.x, y: ball.y, z: ball.z });
        const lead = state.score[0] !== state.score[1];
        const hitLimit = state.score[scorer] >= SCORE_LIMIT;
        const timeUp = state.clock <= 0;
        if (hitLimit || (timeUp && lead) || (state.overtime && lead)) {
            state.phase = 'over';
            state.events.push({
                type: 'over',
                winner: state.score[0] > state.score[1] ? 0 : 1,
                score: [state.score[0], state.score[1]],
                overtime: state.overtime
            });
        } else {
            state.phase = 'goal';
            state.phaseT = GOAL_FREEZE;
        }
        return state;
    }

    if (state.clock <= 0 && !state.overtime && state.phase === 'play') {
        if (state.score[0] !== state.score[1]) {
            state.phase = 'over';
            state.events.push({
                type: 'over',
                winner: state.score[0] > state.score[1] ? 0 : 1,
                score: [state.score[0], state.score[1]],
                overtime: false
            });
        } else {
            state.overtime = true;
            state.events.push({ type: 'overtime' });
        }
    }

    return state;
}

export function snapshot(state) {
    const c = (p) => ({
        x: p.x, y: p.y, z: p.z, yaw: p.yaw,
        vx: p.vx, vy: p.vy, vz: p.vz,
        boost: p.boost, air: p.air, boosting: p.boosting
    });
    return {
        crafts: [c(state.crafts[0]), c(state.crafts[1])],
        ball: { ...state.ball },
        score: [state.score[0], state.score[1]],
        phase: state.phase,
        phaseT: state.phaseT,
        clock: state.clock,
        overtime: state.overtime
    };
}

export function applySnapshot(state, snap) {
    Object.assign(state.crafts[0], snap.crafts[0]);
    Object.assign(state.crafts[1], snap.crafts[1]);
    Object.assign(state.ball, snap.ball);
    state.score[0] = snap.score[0];
    state.score[1] = snap.score[1];
    state.phase = snap.phase;
    state.phaseT = snap.phaseT;
    state.clock = snap.clock;
    state.overtime = snap.overtime;
}
