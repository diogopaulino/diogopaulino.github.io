/**
 * Sprites pintados em canvas — silhueta 16-bit com sombreado HD (espírito SoR4).
 * Sempre desenhados olhando para +X; o chamador espelha com scale(facing, 1).
 * Origem nos pés, Y para cima (o render aplica scale y negativo).
 */

function capsule(ctx, x1, y1, x2, y2, r, fill, stroke, lw = 2.2) {
    const dx = x2 - x1;
    const dy = y2 - y1;
    const len = Math.hypot(dx, dy) || 1;
    const nx = dx / len;
    const ny = dy / len;
    ctx.beginPath();
    ctx.moveTo(x1 - ny * r, y1 + nx * r);
    ctx.lineTo(x2 - ny * r, y2 + nx * r);
    ctx.arc(x2, y2, r, Math.atan2(-ny, -nx) + Math.PI / 2, Math.atan2(-ny, -nx) - Math.PI / 2, true);
    ctx.lineTo(x1 + ny * r, y1 - nx * r);
    ctx.arc(x1, y1, r, Math.atan2(-ny, -nx) - Math.PI / 2, Math.atan2(-ny, -nx) + Math.PI / 2, true);
    ctx.closePath();
    ctx.fillStyle = fill;
    ctx.fill();
    if (stroke) {
        ctx.strokeStyle = stroke;
        ctx.lineWidth = lw;
        ctx.lineJoin = 'round';
        ctx.lineCap = 'round';
        ctx.stroke();
    }
}

function disc(ctx, x, y, rx, ry, fill, stroke, lw = 2) {
    ctx.beginPath();
    ctx.ellipse(x, y, rx, ry, 0, 0, Math.PI * 2);
    ctx.fillStyle = fill;
    ctx.fill();
    if (stroke) {
        ctx.strokeStyle = stroke;
        ctx.lineWidth = lw;
        ctx.stroke();
    }
}

function shade(ctx, x, y, rx, ry, inner, outer) {
    const g = ctx.createRadialGradient(x - rx * 0.3, y + ry * 0.35, rx * 0.1, x, y, rx);
    g.addColorStop(0, inner);
    g.addColorStop(1, outer);
    disc(ctx, x, y, rx, ry, g);
}

const INK = '#12080e';

const PAL = {
    frank: {
        skin: '#7ea36c', skinD: '#4e6d42', skinL: '#b4d39a',
        cloth: '#3b2a1c', clothD: '#21160f', clothL: '#6a4e34',
        pants: '#2a2d32', pantsL: '#4a5058',
        boot: '#1a1512', metal: '#c5c8ce',
        hair: '#1c1814', eye: '#c9e07a'
    },
    vlad: {
        skin: '#f0d7c6', skinD: '#c9a894', skinL: '#fff1e6',
        cloth: '#1a1014', clothD: '#0b0709', clothL: '#3a242c',
        pants: '#140c10', pantsL: '#2c1a22',
        boot: '#1a0c10', metal: '#e2c36b',
        hair: '#0c0a0b', eye: '#e23b3b', cape: '#6e121c', capeI: '#2a070c'
    },
    nekro: {
        skin: '#cbb7a4', skinD: '#8e7a6a', skinL: '#eadac8',
        cloth: '#2a221c', clothD: '#100c0a', clothL: '#4a3c32',
        pants: '#1c1814', pantsL: '#3a3228',
        boot: '#141210', metal: '#d4843a',
        hair: '#1a1612', eye: '#ff7a2e', cape: '#1a1410', capeI: '#8a3a14',
        mask: '#efe6d6'
    },
    lupa: {
        skin: '#c9a06a', skinD: '#8a6a3e', skinL: '#e8c98a',
        cloth: '#6b2430', clothD: '#3a1218', clothL: '#a04858',
        pants: '#3a2a22', pantsL: '#5c4436',
        boot: '#2a1c14', metal: '#e8dcc4',
        hair: '#5a3a1c', eye: '#f0d060'
    },
    ghoul: {
        skin: '#9aaa78', skinD: '#6a7a52', skinL: '#c4d4a0',
        cloth: '#3a4450', clothD: '#1c242c', clothL: '#5a6a78',
        pants: '#2c3038', pantsL: '#4a5058',
        boot: '#1a1c20', metal: '#8890a0',
        hair: '#2a2018', eye: '#c04040'
    },
    cultist: {
        skin: '#d2b49a', skinD: '#9a7a62', skinL: '#f0d8c0',
        cloth: '#2a1c28', clothD: '#120c14', clothL: '#4a3048',
        pants: '#241820', pantsL: '#3c2a36',
        boot: '#1a1014', metal: '#c0a050',
        hair: '#1a1014', eye: '#e0b040'
    },
    brute: {
        skin: '#c08a6a', skinD: '#8a5a42', skinL: '#e0b090',
        cloth: '#6a2020', clothD: '#3a1010', clothL: '#9a4040',
        pants: '#2a2420', pantsL: '#4a4038',
        boot: '#1c1612', metal: '#c8c0b0',
        hair: '#3a2a20', eye: '#e8c070'
    },
    gargoyle: {
        skin: '#6a7a72', skinD: '#3a4a44', skinL: '#9aada4',
        cloth: '#3a4440', clothD: '#1c2420', clothL: '#5a6860',
        pants: '#2a3230', pantsL: '#4a5450',
        boot: '#1a201c', metal: '#c0c8c4',
        hair: '#2a302c', eye: '#80e0a0'
    },
    wight: {
        skin: '#d8d0c0', skinD: '#9a9284', skinL: '#f4eee2',
        cloth: '#3a3834', clothD: '#1c1a18', clothL: '#5a5650',
        pants: '#2c2a28', pantsL: '#4a4642',
        boot: '#1a1816', metal: '#b0a890',
        hair: '#e8e0d4', eye: '#60d0e0'
    },
    mummy: {
        skin: '#e0c888', skinD: '#a08850', skinL: '#f4e4b0',
        cloth: '#c8b070', clothD: '#8a7848', clothL: '#e8d498',
        pants: '#b49a60', pantsL: '#d4bc80',
        boot: '#6a5428', metal: '#e8d080',
        hair: '#d8c070', eye: '#40c0c8'
    },
    witch: {
        skin: '#e8c8d8', skinD: '#b088a0', skinL: '#f8e0ec',
        cloth: '#3a1848', clothD: '#1a0c24', clothL: '#6a38a0',
        pants: '#2a1038', pantsL: '#4a2460',
        boot: '#1a0c18', metal: '#d0a0e0',
        hair: '#1a0c18', eye: '#e060ff'
    },
    baron: {
        skin: '#e8d0c0', skinD: '#b09080', skinL: '#fff0e4',
        cloth: '#1a0c14', clothD: '#0a0608', clothL: '#3a1c28',
        pants: '#140a10', pantsL: '#2c1820',
        boot: '#1a0c10', metal: '#e8c860',
        hair: '#0c080a', eye: '#ff3030', cape: '#5a1020', capeI: '#2a0810'
    }
};

function poseFor(actor, t) {
    const st = actor.state;
    const k = actor.stateT || 0;
    const base = {
        bob: 0, body: 0, head: 0,
        lS: 1.15, lE: 0.45, rS: -0.35, rE: 0.55,
        lH: 0.12, lK: 0.18, rH: -0.1, rK: 0.16,
        punch: 0, kick: 0, hurt: 0, down: 0, crouch: 0
    };

    if (st === 'walk' || st === 'run') {
        const spd = st === 'run' ? 0.22 : 0.14;
        const p = t * spd;
        base.lH = Math.sin(p) * 0.72;
        base.rH = Math.sin(p + Math.PI) * 0.72;
        base.lK = Math.max(0.05, Math.sin(p) * 0.7);
        base.rK = Math.max(0.05, Math.sin(p + Math.PI) * 0.7);
        base.lS = 1.05 + Math.sin(p + Math.PI) * 0.45;
        base.rS = -0.35 + Math.sin(p) * 0.55;
        base.bob = Math.abs(Math.sin(p)) * (st === 'run' ? 5 : 3);
        base.body = Math.sin(p) * 0.06;
    } else if (st === 'idle' || st === 'intro' || st === 'win') {
        const p = t * 0.05;
        base.bob = Math.sin(p) * 2.2;
        base.lS = 1.1 + Math.sin(p) * 0.08;
        base.rS = -0.32 + Math.sin(p + 1) * 0.08;
        if (st === 'win') {
            base.rS = -2.5;
            base.rE = 0.2;
            base.head = -0.15;
        }
    } else if (st === 'jump' || st === 'jattack') {
        const up = actor.vy > 2 ? 1 : actor.vy < -1 ? -1 : 0;
        base.lH = up > 0 ? 0.9 : -0.35;
        base.rH = up > 0 ? 0.55 : -0.15;
        base.lK = 0.9;
        base.rK = 0.55;
        base.lS = up > 0 ? 2.2 : 0.6;
        base.rS = up > 0 ? -1.8 : -0.8;
        if (st === 'jattack') {
            base.rS = -2.7;
            base.rE = 0.05;
            base.kick = 1;
            base.body = 0.35;
        }
    } else if (st === 'attack') {
        const step = actor.comboStep || 0;
        const u = Math.min(1, k / 8);
        if (step <= 1) {
            base.rS = -0.2 + u * -2.3;
            base.rE = 0.7 - u * 0.55;
            base.body = u * 0.18;
            base.punch = u;
        } else if (step === 2) {
            base.lS = 1.2 - u * 2.4;
            base.lE = 0.2;
            base.body = -u * 0.16;
            base.punch = u;
        } else {
            base.rS = -2.8;
            base.rE = 0.05;
            base.lH = -0.2;
            base.rH = 0.9;
            base.rK = 0.2;
            base.body = 0.4;
            base.kick = 1;
            base.head = -0.2;
        }
    } else if (st === 'blitz') {
        base.rS = -2.6;
        base.lS = 0.2;
        base.body = 0.45;
        base.rH = 0.8;
        base.punch = 1;
    } else if (st === 'special') {
        const u = Math.min(1, k / 10);
        base.rS = -2.9;
        base.lS = 2.4;
        base.body = -0.15 + u * 0.3;
        base.head = -0.25;
        base.bob = 6;
    } else if (st === 'grab') {
        base.rS = -1.6;
        base.lS = 0.4;
        base.body = 0.12;
        if (actor.grabHits > 0 && k < 8) {
            base.rH = 0.9;
            base.rK = 0.2;
            base.kick = 1;
        }
    } else if (st === 'grabbed') {
        base.lS = 2.1;
        base.rS = -2.1;
        base.head = 0.2;
        base.crouch = 8;
    } else if (st === 'hurt') {
        base.hurt = 1;
        base.body = -0.25;
        base.head = 0.3;
        base.lS = 2.0;
        base.rS = -1.6;
    } else if (st === 'knockdown' || st === 'dead') {
        base.down = 1;
        base.body = 1.35;
        base.lS = 2.4;
        base.rS = -2.2;
        base.lH = 0.9;
        base.rH = 0.4;
    } else if (st === 'getup') {
        base.crouch = 22;
        base.body = 0.4;
    }
    return base;
}

function limbEnd(x, y, len, ang) {
    return { x: x + Math.cos(ang) * len, y: y + Math.sin(ang) * len };
}

function drawCape(ctx, hipX, shY, pose, pal, t, kind) {
    const color = pal.cape || pal.clothD;
    const inner = pal.capeI || pal.cloth;
    const flap = Math.sin(t * 0.09 + pose.bob) * 10;
    ctx.beginPath();
    ctx.moveTo(hipX - 6, shY + 8);
    ctx.quadraticCurveTo(-48 + flap * 0.3, shY - 10, -56 + flap, 28 + pose.bob);
    ctx.quadraticCurveTo(-30, 8, 6, 18);
    ctx.lineTo(10, shY - 4);
    ctx.closePath();
    ctx.fillStyle = color;
    ctx.fill();
    ctx.strokeStyle = INK;
    ctx.lineWidth = 2.2;
    ctx.stroke();
    if (kind === 'vlad' || kind === 'baron') {
        ctx.beginPath();
        ctx.moveTo(hipX - 4, shY + 6);
        ctx.quadraticCurveTo(-30, shY - 20, -20, 40);
        ctx.lineTo(8, shY);
        ctx.fillStyle = inner;
        ctx.fill();
    }
}

function drawHead(ctx, x, y, pal, kind, pose) {
    const rot = pose.head || 0;
    ctx.save();
    ctx.translate(x, y);
    ctx.rotate(rot);

    if (kind === 'lupa') {
        ctx.beginPath();
        ctx.moveTo(-10, 18);
        ctx.lineTo(-18, 42);
        ctx.lineTo(-2, 22);
        ctx.fillStyle = pal.hair;
        ctx.fill();
        ctx.strokeStyle = INK;
        ctx.lineWidth = 1.8;
        ctx.stroke();
        ctx.beginPath();
        ctx.moveTo(10, 18);
        ctx.lineTo(16, 40);
        ctx.lineTo(4, 20);
        ctx.fill();
        ctx.stroke();
    }

    if (kind === 'frank') {
        shade(ctx, 2, 4, 20, 22, pal.skinL, pal.skin);
        disc(ctx, 2, 4, 20, 22, pal.skin, INK, 2.2);
        ctx.fillStyle = pal.skinD;
        ctx.fillRect(-16, 18, 36, 5);
        ctx.strokeStyle = pal.skinD;
        ctx.lineWidth = 1.5;
        ctx.beginPath();
        ctx.moveTo(-8, 8);
        ctx.lineTo(12, 6);
        ctx.stroke();
        disc(ctx, -18, -2, 4, 4, pal.metal, INK, 1.4);
        disc(ctx, 22, -2, 4, 4, pal.metal, INK, 1.4);
        disc(ctx, 8, 6, 3.2, 3.6, pal.eye, INK, 1);
        disc(ctx, 8, 6, 1.3, 1.5, '#102008');
        ctx.fillStyle = pal.hair;
        ctx.fillRect(-18, 16, 38, 10);
    } else if (kind === 'nekro') {
        shade(ctx, 1, 2, 17, 20, pal.mask, pal.skinD);
        disc(ctx, 1, 2, 17, 20, pal.mask, INK, 2.2);
        ctx.strokeStyle = pal.skinD;
        ctx.lineWidth = 1.4;
        ctx.beginPath();
        ctx.moveTo(-8, 10);
        ctx.lineTo(4, -4);
        ctx.lineTo(12, 8);
        ctx.stroke();
        disc(ctx, 7, 4, 4, 3.4, pal.eye, INK, 1);
        ctx.fillStyle = pal.eye;
        ctx.globalAlpha = 0.55;
        disc(ctx, 7, 4, 8, 6, pal.eye);
        ctx.globalAlpha = 1;
        disc(ctx, 7, 4, 1.6, 1.6, '#1a0800');
        ctx.fillStyle = pal.clothD;
        ctx.beginPath();
        ctx.moveTo(-16, -6);
        ctx.lineTo(16, -8);
        ctx.lineTo(10, -18);
        ctx.lineTo(-12, -16);
        ctx.fill();
        ctx.strokeStyle = INK;
        ctx.stroke();
    } else if (kind === 'vlad' || kind === 'baron') {
        shade(ctx, 1, 2, 15, 20, pal.skinL, pal.skin);
        disc(ctx, 1, 2, 15, 20, pal.skin, INK, 2.2);
        ctx.fillStyle = pal.hair;
        ctx.beginPath();
        ctx.moveTo(-14, 8);
        ctx.lineTo(-4, 28);
        ctx.lineTo(0, 10);
        ctx.lineTo(16, 22);
        ctx.lineTo(14, -8);
        ctx.lineTo(-16, -4);
        ctx.closePath();
        ctx.fill();
        ctx.strokeStyle = INK;
        ctx.stroke();
        disc(ctx, 7, 4, 3.4, 3.8, pal.eye, INK, 1);
        disc(ctx, 7, 4, 1.4, 1.6, '#200008');
        ctx.fillStyle = pal.skinL;
        ctx.beginPath();
        ctx.moveTo(4, -6);
        ctx.lineTo(6, -12);
        ctx.lineTo(8, -6);
        ctx.fill();
    } else if (kind === 'lupa') {
        shade(ctx, 4, 0, 18, 16, pal.skinL, pal.skin);
        disc(ctx, 4, 0, 18, 16, pal.skin, INK, 2.2);
        ctx.beginPath();
        ctx.ellipse(22, -2, 14, 8, 0.15, 0, Math.PI * 2);
        ctx.fillStyle = pal.skinL;
        ctx.fill();
        ctx.strokeStyle = INK;
        ctx.stroke();
        disc(ctx, 8, 4, 3.5, 3.8, pal.eye, INK, 1);
        disc(ctx, 8, 4, 1.5, 1.6, '#201000');
        ctx.fillStyle = '#4a2010';
        ctx.beginPath();
        ctx.moveTo(28, -2);
        ctx.lineTo(36, 2);
        ctx.lineTo(28, 4);
        ctx.fill();
        ctx.fillStyle = pal.hair;
        disc(ctx, -4, 10, 14, 8, pal.hair, INK, 1.4);
    } else if (kind === 'witch') {
        shade(ctx, 1, 2, 15, 18, pal.skinL, pal.skin);
        disc(ctx, 1, 2, 15, 18, pal.skin, INK, 2.2);
        ctx.fillStyle = pal.hair;
        ctx.beginPath();
        ctx.moveTo(-18, 4);
        ctx.quadraticCurveTo(0, -20, 18, 2);
        ctx.lineTo(16, -24);
        ctx.lineTo(-20, -8);
        ctx.fill();
        ctx.strokeStyle = INK;
        ctx.stroke();
        ctx.beginPath();
        ctx.moveTo(-22, 8);
        ctx.lineTo(0, 48);
        ctx.lineTo(22, 8);
        ctx.closePath();
        ctx.fillStyle = pal.cloth;
        ctx.fill();
        ctx.stroke();
        disc(ctx, 7, 4, 3.2, 3.6, pal.eye, INK, 1);
    } else if (kind === 'mummy' || kind === 'wight') {
        shade(ctx, 1, 2, 16, 19, pal.skinL, pal.skin);
        disc(ctx, 1, 2, 16, 19, pal.skin, INK, 2.2);
        ctx.strokeStyle = pal.skinD;
        ctx.lineWidth = 1.6;
        for (let i = 0; i < 4; i++) {
            ctx.beginPath();
            ctx.moveTo(-14, 12 - i * 7);
            ctx.lineTo(14, 10 - i * 7);
            ctx.stroke();
        }
        disc(ctx, 7, 4, 3.4, 3.2, pal.eye, INK, 1);
        if (kind === 'wight') {
            ctx.fillStyle = pal.skinL;
            ctx.fillRect(-8, -10, 16, 4);
        }
    } else {
        shade(ctx, 1, 2, 16, 19, pal.skinL, pal.skin);
        disc(ctx, 1, 2, 16, 19, pal.skin, INK, 2.2);
        ctx.fillStyle = pal.hair;
        ctx.beginPath();
        ctx.ellipse(0, 12, 17, 10, 0, 0, Math.PI);
        ctx.fill();
        disc(ctx, 7, 4, 3.2, 3.6, pal.eye, INK, 1);
        disc(ctx, 7, 4, 1.3, 1.4, '#100808');
        if (kind === 'cultist') {
            ctx.beginPath();
            ctx.moveTo(-18, 6);
            ctx.lineTo(0, 36);
            ctx.lineTo(18, 6);
            ctx.closePath();
            ctx.fillStyle = pal.cloth;
            ctx.fill();
            ctx.strokeStyle = INK;
            ctx.stroke();
        }
        if (kind === 'brute') {
            disc(ctx, 2, -6, 10, 6, pal.skinD, INK, 1.4);
        }
    }

    ctx.restore();
}

function drawChains(ctx, x, y, t) {
    ctx.save();
    ctx.strokeStyle = '#d4843a';
    ctx.lineWidth = 3.2;
    ctx.beginPath();
    for (let i = 0; i < 8; i++) {
        const px = x + i * 7 + Math.sin(t * 0.12 + i) * 2;
        const py = y - i * 3 + Math.cos(t * 0.1 + i) * 3;
        if (i === 0) ctx.moveTo(px, py);
        else ctx.lineTo(px, py);
    }
    ctx.stroke();
    ctx.strokeStyle = INK;
    ctx.lineWidth = 1;
    ctx.stroke();
    ctx.restore();
}

/**
 * Desenha um ator no espaço da tela (pés em sx,sy, Y canvas para baixo).
 */
export function drawActor(ctx, actor, time = 0) {
    const kind = actor.kind || actor.charId || 'ghoul';
    const pal = PAL[kind] || PAL.ghoul;
    const pose = poseFor(actor, time + (actor.animOff || 0));
    const scale = (actor.scale || 1) * (actor.flash > 0 ? 1.02 : 1);
    const hp = actor.y || 0;

    ctx.save();
    ctx.translate(actor.sx, actor.sy);
    const air = hp;
    ctx.globalAlpha = 0.35 * Math.max(0.15, 1 - air / 140);
    ctx.fillStyle = '#000';
    ctx.beginPath();
    ctx.ellipse(0, 4, 34 * (actor.scale || 1) * (pose.down ? 1.25 : 1), 9, 0, 0, Math.PI * 2);
    ctx.fill();
    ctx.globalAlpha = 1;

    if (actor.invuln > 0 && Math.floor(actor.invuln / 3) % 2 === 0 && actor.team === 'hero') {
        ctx.globalAlpha = 0.45;
    }
    if (actor.flash > 0) ctx.filter = 'brightness(1.7) saturate(0.5)';

    ctx.scale((actor.facing || 1) * scale, -scale);
    ctx.translate(0, pose.bob + pose.crouch);

    if (pose.down) {
        ctx.rotate(-1.15);
        ctx.translate(0, 20);
    } else if (pose.hurt) {
        ctx.rotate(-0.18);
    }

    const hipY = 58;
    const shY = 108;
    const hipW = kind === 'frank' || kind === 'brute' || kind === 'baron' ? 16 : kind === 'lupa' ? 11 : 13;

    const lHip = limbEnd(-hipW, hipY, 34, -Math.PI / 2 + pose.lH);
    const lFoot = limbEnd(lHip.x, lHip.y, 30, -Math.PI / 2 + pose.lH + pose.lK);
    const rHip = limbEnd(hipW, hipY, 34, -Math.PI / 2 + pose.rH);
    const rFoot = limbEnd(rHip.x, rHip.y, 30, -Math.PI / 2 + pose.rH + pose.rK);

    const lSh = limbEnd(-14, shY, 26, pose.lS);
    const lHand = limbEnd(lSh.x, lSh.y, 24, pose.lS + pose.lE);
    const rSh = limbEnd(14, shY, 28, pose.rS);
    const rHand = limbEnd(rSh.x, rSh.y, 26, pose.rS + pose.rE);

    if (pal.cape || kind === 'vlad' || kind === 'nekro' || kind === 'baron' || kind === 'witch') {
        drawCape(ctx, 0, shY, pose, pal, time, kind);
    }

    if (kind === 'gargoyle') {
        const flap = Math.sin(time * 0.18) * 18;
        ctx.beginPath();
        ctx.moveTo(-8, shY);
        ctx.quadraticCurveTo(-70, shY + 20 + flap, -40, shY - 30 + flap);
        ctx.lineTo(-6, shY + 8);
        ctx.fillStyle = pal.skinD;
        ctx.fill();
        ctx.strokeStyle = INK;
        ctx.lineWidth = 2;
        ctx.stroke();
    }

    if (kind === 'lupa') {
        ctx.beginPath();
        ctx.moveTo(-8, hipY);
        ctx.quadraticCurveTo(-36, hipY + 10 + Math.sin(time * 0.12) * 8, -28, hipY - 24);
        ctx.strokeStyle = pal.skinD;
        ctx.lineWidth = 7;
        ctx.lineCap = 'round';
        ctx.stroke();
        ctx.strokeStyle = INK;
        ctx.lineWidth = 2;
        ctx.stroke();
    }

    const thighR = kind === 'frank' || kind === 'brute' ? 11 : 8;
    capsule(ctx, -hipW, hipY, lHip.x, lHip.y, thighR, pal.pants, INK);
    capsule(ctx, lHip.x, lHip.y, lFoot.x, lFoot.y, 7, pal.pantsL, INK);
    disc(ctx, lFoot.x + 6, lFoot.y - 2, 11, 6, pal.boot, INK, 1.8);

    capsule(ctx, hipW, hipY, rHip.x, rHip.y, thighR, pal.pants, INK);
    capsule(ctx, rHip.x, rHip.y, rFoot.x, rFoot.y, 7, pal.pantsL, INK);
    disc(ctx, rFoot.x + 6, rFoot.y - 2, 11, 6, pal.boot, INK, 1.8);

    const torsoW = kind === 'frank' || kind === 'brute' ? 28 : kind === 'lupa' ? 18 : 22;
    shade(ctx, 2, (hipY + shY) / 2, torsoW, 32, pal.clothL, pal.cloth);
    disc(ctx, 2, (hipY + shY) / 2, torsoW, 34, pal.cloth, INK, 2.3);

    if (kind === 'frank') {
        ctx.strokeStyle = pal.skinD;
        ctx.lineWidth = 1.6;
        ctx.beginPath();
        ctx.moveTo(-10, shY - 8);
        ctx.lineTo(12, hipY + 10);
        ctx.stroke();
    }
    if (kind === 'nekro') {
        ctx.strokeStyle = pal.metal;
        ctx.lineWidth = 2;
        ctx.beginPath();
        ctx.moveTo(-12, shY - 4);
        ctx.lineTo(14, hipY + 8);
        ctx.lineTo(-6, hipY);
        ctx.stroke();
    }
    if (kind === 'vlad' || kind === 'baron') {
        disc(ctx, 4, shY - 16, 5, 6, pal.metal, INK, 1.4);
    }

    const armR = kind === 'frank' || kind === 'brute' ? 9 : 7;
    capsule(ctx, -14, shY, lSh.x, lSh.y, armR, pal.clothL, INK);
    capsule(ctx, lSh.x, lSh.y, lHand.x, lHand.y, 6.5, pal.skin, INK);
    disc(ctx, lHand.x, lHand.y, 8, 8, pal.skin, INK, 1.8);

    capsule(ctx, 14, shY, rSh.x, rSh.y, armR, pal.clothL, INK);
    capsule(ctx, rSh.x, rSh.y, rHand.x, rHand.y, 6.5, pal.skin, INK);
    disc(ctx, rHand.x, rHand.y, 8, 8, pal.skin, INK, 1.8);

    if (kind === 'lupa' && (pose.punch || pose.kick || actor.state === 'attack' || actor.state === 'special')) {
        ctx.strokeStyle = pal.skinL;
        ctx.lineWidth = 2;
        ctx.beginPath();
        ctx.moveTo(rHand.x + 4, rHand.y + 4);
        ctx.lineTo(rHand.x + 18, rHand.y + 8);
        ctx.moveTo(rHand.x + 4, rHand.y);
        ctx.lineTo(rHand.x + 20, rHand.y + 2);
        ctx.stroke();
    }

    if (actor.weapon === 'pipe') {
        ctx.strokeStyle = '#8a9098';
        ctx.lineWidth = 6;
        ctx.lineCap = 'round';
        ctx.beginPath();
        ctx.moveTo(rHand.x, rHand.y);
        ctx.lineTo(rHand.x + 42, rHand.y + 8);
        ctx.stroke();
        ctx.strokeStyle = INK;
        ctx.lineWidth = 1.6;
        ctx.stroke();
    } else if (actor.weapon === 'knife') {
        ctx.fillStyle = '#d8dee6';
        ctx.beginPath();
        ctx.moveTo(rHand.x + 4, rHand.y);
        ctx.lineTo(rHand.x + 28, rHand.y + 4);
        ctx.lineTo(rHand.x + 6, rHand.y + 6);
        ctx.fill();
        ctx.strokeStyle = INK;
        ctx.stroke();
    }

    if (kind === 'nekro') drawChains(ctx, rHand.x, rHand.y, time);

    drawHead(ctx, 2, shY + 28, pal, kind, pose);

    if (kind === 'cultist') {
        ctx.fillStyle = pal.metal;
        ctx.beginPath();
        ctx.moveTo(rHand.x, rHand.y);
        ctx.lineTo(rHand.x + 22, rHand.y - 6);
        ctx.lineTo(rHand.x + 4, rHand.y + 4);
        ctx.fill();
        ctx.strokeStyle = INK;
        ctx.stroke();
    }

    ctx.restore();
    ctx.filter = 'none';
    ctx.globalAlpha = 1;
}

export function drawPortrait(ctx, charId, w, h) {
    const dummy = {
        sx: w * 0.52,
        sy: h * 0.92,
        facing: 1,
        state: 'idle',
        stateT: 0,
        kind: charId,
        charId,
        scale: h / 210,
        y: 0,
        team: 'hero',
        invuln: 0,
        flash: 0
    };
    ctx.clearRect(0, 0, w, h);
    const pal = PAL[charId] || PAL.frank;
    const g = ctx.createRadialGradient(w * 0.5, h * 0.7, 10, w * 0.5, h * 0.6, w * 0.6);
    g.addColorStop(0, pal.clothL + '55');
    g.addColorStop(1, '#0000');
    ctx.fillStyle = g;
    ctx.fillRect(0, 0, w, h);
    drawActor(ctx, dummy, 8);
}

export function drawCrate(ctx, x, y, broken) {
    ctx.save();
    ctx.translate(x, y);
    ctx.fillStyle = 'rgba(0,0,0,.35)';
    ctx.beginPath();
    ctx.ellipse(0, 6, 28, 8, 0, 0, Math.PI * 2);
    ctx.fill();
    if (broken) {
        ctx.fillStyle = '#6a4a28';
        ctx.fillRect(-22, -8, 18, 10);
        ctx.fillRect(2, -6, 20, 8);
        ctx.restore();
        return;
    }
    ctx.fillStyle = '#8a5a30';
    ctx.strokeStyle = INK;
    ctx.lineWidth = 2;
    ctx.beginPath();
    if (ctx.roundRect) ctx.roundRect(-24, -40, 48, 44, 4);
    else ctx.rect(-24, -40, 48, 44);
    ctx.fill();
    ctx.stroke();
    ctx.fillStyle = '#c48a48';
    ctx.fillRect(-24, -28, 48, 8);
    ctx.fillStyle = '#c8c0b0';
    ctx.fillRect(-26, -42, 52, 6);
    ctx.fillRect(-26, -4, 52, 6);
    ctx.restore();
}

export function drawItem(ctx, item, time) {
    const bob = Math.sin(time * 0.12 + item.x) * 4;
    ctx.save();
    ctx.translate(item.sx, item.sy - 18 + bob);
    ctx.fillStyle = 'rgba(0,0,0,.3)';
    ctx.beginPath();
    ctx.ellipse(0, 20, 12, 5, 0, 0, Math.PI * 2);
    ctx.fill();
    if (item.kind === 'apple') {
        disc(ctx, 0, 0, 11, 12, '#d04040', INK, 2);
        ctx.strokeStyle = '#3a8020';
        ctx.lineWidth = 3;
        ctx.beginPath();
        ctx.moveTo(0, 10);
        ctx.lineTo(4, 18);
        ctx.stroke();
    } else if (item.kind === 'roast') {
        disc(ctx, 0, 0, 16, 11, '#c06030', INK, 2);
        disc(ctx, 12, 4, 7, 6, '#e8c090', INK, 1.5);
    } else if (item.kind === 'gold') {
        disc(ctx, 0, 0, 12, 12, '#e8c44a', INK, 2);
        ctx.fillStyle = '#fff6c0';
        ctx.fillRect(-4, -4, 8, 8);
    } else if (item.kind === 'pipe') {
        ctx.strokeStyle = '#8a9098';
        ctx.lineWidth = 7;
        ctx.beginPath();
        ctx.moveTo(-16, 6);
        ctx.lineTo(16, -6);
        ctx.stroke();
    } else if (item.kind === 'knife') {
        ctx.fillStyle = '#d8dee6';
        ctx.beginPath();
        ctx.moveTo(-10, 6);
        ctx.lineTo(16, -8);
        ctx.lineTo(-6, 10);
        ctx.fill();
        ctx.strokeStyle = INK;
        ctx.stroke();
    }
    ctx.restore();
}

export function drawFx(ctx, fx) {
    ctx.save();
    ctx.globalAlpha = Math.max(0, fx.life / fx.max);
    ctx.translate(fx.x, fx.y);
    if (fx.kind === 'spark') {
        ctx.rotate(fx.rot || 0);
        ctx.fillStyle = fx.color || '#ffe680';
        ctx.fillRect(-fx.size, -1.4, fx.size * 2, 2.8);
        ctx.fillRect(-1.4, -fx.size, 2.8, fx.size * 2);
    } else if (fx.kind === 'ring') {
        ctx.strokeStyle = fx.color || '#fff';
        ctx.lineWidth = 3;
        ctx.beginPath();
        ctx.arc(0, 0, fx.size, 0, Math.PI * 2);
        ctx.stroke();
    } else if (fx.kind === 'slash') {
        ctx.strokeStyle = fx.color || '#fff';
        ctx.lineWidth = 4;
        ctx.beginPath();
        ctx.arc(0, 0, fx.size, fx.a0 || 0, fx.a1 || 1.2);
        ctx.stroke();
    } else {
        disc(ctx, 0, 0, fx.size, fx.size, fx.color || '#fff');
    }
    ctx.restore();
}

export const PALETTES = PAL;
