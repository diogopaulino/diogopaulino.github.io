/**
 * Quimera — monta o personagem a partir dos três eixos e cuida de pose, olhar e troca.
 *
 * Um "boneco" (figure) é um humanoide do hero.js (createHero, detail 2) cujas opções são a
 * soma de CABEÇA (rosto, pele, cabelo, barba, chapéu do kit) + CORPO (roupa, armadura,
 * biotipo, altura), mais as peças modeladas presas aos ossos/sockets e o ACESSÓRIO.
 *
 * Troca de peça — varredura (ver SWEEP em sculpt.js): o boneco novo nasce no outro banco
 * de materiais e os dois ficam em cena por DUR segundos; um plano sobe de y0 a y1 e, abaixo
 * dele, o antigo some e o novo aparece:
 *   cabeça              y0 = base do pescoço − 25 cm, y1 = topo + 45 cm    (0,55 s)
 *   corpo / acessório   y0 = chão, y1 = topo + 45 cm                      (0,8 s)
 *   corte(t) = y0 + (y1 − y0) · easeInOut(t / DUR)
 * A plataforma ganha um impulso de giro e o plano solta faíscas no anel do corte.
 *
 * Pose de apresentação: base `idle` (ou `hold` com a lanterna) + braço direito sobreposto
 * conforme o acessório (ver ARM abaixo). Gestos: troca de cabeça → acena; de corpo → fala;
 * conjunto completo → comemora; e a cada 7–12 s um gesto sorteado pela combinação.
 * Piscar é do hero.js; o olhar segue o cursor via hero.lookAt.
 */
import * as THREE from 'three';
import { createHero } from '../../shared/gfx/hero.js';
import { KIT_BY_ID } from './config.js';
import { createBank, heroMaterial } from './sculpt.js';
import { measure, mount } from './anatomy.js';
import { headOptions, buildHeadGear } from './heads.js';
import { bodyOptions, buildBodyExtras } from './bodies.js';
import { buildAccessory } from './accessories.js';

/** Braço direito por pose: [sx frente(−), sz abertura, el cotovelo, tw torção] (convenção `arm()` do hero.js). */
const ARM = {
    present: [-0.42, 0.1, 1.45, 0.25],
    staff: [-0.72, 0.28, 0.72, 0.1]
};
const ease = (t) => t * t * (3 - 2 * t);
const _v = new THREE.Vector3();
const _q1 = new THREE.Quaternion();
const _q2 = new THREE.Quaternion();

export class Character {
    constructor({ parent, detail = 2, onBurst = null }) {
        this.root = new THREE.Group();
        this.root.name = 'quimera';
        parent.add(this.root);
        this.detail = detail;
        this.banks = [createBank(0), createBank(1)];
        this.bankIx = 0;
        this.fig = null;
        this.old = null;
        this.sweep = null;
        this.onBurst = onBurst;
        this.spin = 0;                 // impulso de giro pedido à plataforma (rad/s)
        this.state = { mode: 'idle', amount: 0, smile: 0.15 };
        this.gesture = null;           // { mode, until }
        this.nextGesture = 6;
        this.clock = 0;
        this.armW = 0;
        this.look = new THREE.Vector3(0, 1.6, 4);
        this.hasLook = false;
    }

    get height() {
        return this.fig ? this.fig.hero.height : 1.8;
    }

    get eyeHeight() {
        return this.fig ? this.fig.hero.eyeHeight : 1.65;
    }

    _build(ids, bank) {
        const hk = KIT_BY_ID[ids.head];
        const bk = KIT_BY_ID[ids.body];
        const ak = KIT_BY_ID[ids.accessory];
        const hero = createHero({ ...bodyOptions(bk), ...headOptions(hk), detail: this.detail });
        hero.mesh.material = hero.mesh.material.map((m) => heroMaterial(m, bank));
        hero.mesh.userData.slot = 'hero';
        const A = measure(hero);
        const add = (bone, obj, at = null) => mount(hero, A, bone, obj, at);
        const updates = [];
        const bodyAdd = (bone, obj, at) => {
            obj.traverse((c) => {
                c.userData.slot = 'body';
            });
            return add(bone, obj, at);
        };
        const u1 = buildBodyExtras(bk, { B: bank, K: bk.colors, A, hero, add: bodyAdd });
        if (u1) updates.push(u1);
        hero.attach('head', buildHeadGear(hk, bank), { worldScale: false });
        const acc = buildAccessory(ak, { B: bank, K: ak.colors, A, hero, add });
        if (acc.update) updates.push(acc.update);
        // itens de prumo (frasco, cajado…): guarda o suporte criado por hero.attach para realinhar a cada quadro
        const uprights = [];
        hero.sockets.handR.traverse((o) => {
            if (o.userData.upright) uprights.push(o.parent);
        });
        return { hero, ids: { ...ids }, bank, updates, pose: acc.pose, view: acc.view || 'front', staff: acc.staff || null, A, uprights };
    }

    /** Troca a combinação. `instant` pula a varredura (primeira montagem). */
    setMix(ids, { instant = false } = {}) {
        const prev = this.fig;
        if (prev && prev.ids.head === ids.head && prev.ids.body === ids.body && prev.ids.accessory === ids.accessory) return;
        this._finishSweep();
        this.bankIx ^= 1;
        const bank = this.banks[this.bankIx];
        const fig = this._build(ids, bank);
        this.root.add(fig.hero.object);
        this.fig = fig;
        bank.uniforms.uSweep.value.set(0, 0, 0, 0);
        if (prev && !instant) {
            fig.hero.time = prev.hero.time;
            const headOnly = prev.ids.body === ids.body && prev.ids.accessory === ids.accessory;
            const top = Math.max(fig.hero.height, prev.hero.height) + 0.45;
            const neck = fig.A.J.neck.y * fig.hero.scale;
            this.sweep = { t: 0, dur: headOnly ? 0.55 : 0.8, y0: headOnly ? neck - 0.25 : -0.05, y1: top, emit: 0 };
            this.old = prev;
            this.spin = headOnly ? 2.2 : 3.6;
            this._applySweep(0);
            // reação
            const full = ids.head === ids.body && ids.body === ids.accessory;
            const busy = fig.pose !== 'free' && fig.pose !== 'low';
            const react = full && fig.pose !== 'staff' && fig.pose !== 'hold' ? 'cheer' : headOnly && !busy ? 'wave' : prev.ids.body !== ids.body || busy ? 'talk' : 'idle';
            this.gesture = { mode: react, until: this.clock + (react === 'cheer' ? 2.2 : 1.6), delay: 0.5 };
            this.nextGesture = this.clock + 7 + Math.random() * 5;
        } else if (prev) this._drop(prev);
        fig.hero.update(0, this.state);
    }

    _applySweep(k) {
        const s = this.sweep;
        const base = this.root.getWorldPosition(_v).y;
        const cut = base + s.y0 + (s.y1 - s.y0) * ease(k);
        this.fig.bank.uniforms.uSweep.value.set(base + s.y0, cut, 1, 0);
        this.old.bank.uniforms.uSweep.value.set(base + s.y0, cut, 2, 0);
        return cut;
    }

    _finishSweep() {
        if (!this.sweep) return;
        this.fig.bank.uniforms.uSweep.value.set(0, 0, 0, 0);
        this._drop(this.old);
        this.old = null;
        this.sweep = null;
    }

    _drop(fig) {
        this.root.remove(fig.hero.object);
        fig.hero.dispose();
        fig.bank.uniforms.uSweep.value.set(0, 0, 0, 0);
    }

    /** Ponto do mundo para onde o personagem olha (null = olhar solto). */
    lookAt(point) {
        this.hasLook = !!point;
        if (point) this.look.copy(point);
    }

    update(dt, t) {
        const fig = this.fig;
        if (!fig) return;
        this.clock += dt;
        // ---- gesto corrente ----
        let mode = fig.pose === 'hold' ? 'hold' : 'idle';
        let armTarget = ARM[fig.pose] ? 1 : 0;
        if (!this.gesture && this.clock > this.nextGesture && !this.sweep) {
            // gesto periódico, sorteado pela combinação (mesma combinação → mesma sequência)
            const seed = (fig.ids.head.length * 7 + fig.ids.body.length * 3 + fig.ids.accessory.length + Math.floor(this.clock / 9)) % 3;
            // mão direita ocupada (item erguido, cajado, lanterna): só o gesto de fala, que mantém o item no lugar
            const busy = fig.pose !== 'free' && fig.pose !== 'low';
            const pick = busy ? 'talk' : ['wave', 'talk', 'cheer'][seed];
            this.gesture = { mode: pick, until: this.clock + (pick === 'cheer' ? 1.5 : 2.2), delay: 0 };
            this.nextGesture = this.clock + 8 + Math.random() * 5;
        }
        if (this.gesture) {
            if (this.gesture.delay > 0) this.gesture.delay -= dt;
            else if (this.gesture.mode !== 'idle') {
                mode = this.gesture.mode;
                if (mode !== 'talk') armTarget = 0;
            }
            if (this.clock > this.gesture.until) this.gesture = null;
        }
        this.state.mode = mode;
        this.armW += (armTarget - this.armW) * Math.min(1, dt * 6);

        fig.hero.lookAt(this.hasLook ? this.look : null);
        fig.hero.update(dt, this.state);
        this._arm(fig);
        for (const fn of fig.updates) fn(t);
        this._staff(fig);

        if (this.old) {
            this.old.hero.lookAt(this.hasLook ? this.look : null);
            this.old.hero.update(dt, this.state);
            this._arm(this.old);
            for (const fn of this.old.updates) fn(t);
            this._staff(this.old);
        }
        if (this.sweep) {
            const s = this.sweep;
            s.t += dt;
            const k = Math.min(1, s.t / s.dur);
            const cut = this._applySweep(k);
            s.emit += dt;
            if (this.onBurst && s.emit > 0.035) {
                s.emit = 0;
                this.root.getWorldPosition(_v);
                this.onBurst(_v.x, cut, _v.z, 0.3, 5);
            }
            if (k >= 1) this._finishSweep();
        }
        this.spin *= Math.exp(-3.2 * dt);
    }

    /** Sobrepõe o braço direito da pose de apresentação (mistura por armW). */
    _arm(fig) {
        const p = ARM[fig.pose];
        const w = this.armW;
        if (!p || w < 0.003) return;
        const b = fig.hero.bones;
        const out = fig.hero._M.armOut;
        const a = b.armR.rotation;
        const f = b.foreR.rotation;
        const br = Math.sin(this.clock * 1.5) * 0.03;
        a.set(a.x + (p[0] + br - a.x) * w, a.y * (1 - w), a.z + (-(p[1] + out) - a.z) * w);
        f.set(f.x + (-p[2] - f.x) * w, f.y + (-p[3] - f.y) * w, f.z * (1 - w));
        // o hero.js alinhou o prumo antes desta sobreposição: refaz com o braço final
        if (fig.uprights.length) {
            fig.hero.object.updateWorldMatrix(true, true);
            fig.hero.object.getWorldQuaternion(_q2);
            for (const h of fig.uprights) {
                h.parent.getWorldQuaternion(_q1).invert();
                h.quaternion.copy(_q1).multiply(_q2);
            }
        }
    }

    /** Cajado: desce/sobe para a ponta tocar o chão da plataforma, qualquer que seja a altura da mão. */
    _staff(fig) {
        if (!fig.staff) return;
        const hand = fig.hero.sockets.handR.getWorldPosition(_v).y;
        const floor = this.root.getWorldPosition(_v).y;
        // a ponta do cajado fica em y = −1,02 (unidades do herói) no referencial da peça
        fig.staff.position.y = 1.02 - (hand - floor) / fig.hero.scale;
    }

    /** Classifica um clique: 'head' | 'body' | 'accessory' | null. */
    slotOf(hit) {
        let o = hit.object;
        while (o && !o.userData.slot) o = o.parent;
        const slot = o?.userData.slot;
        if (slot === 'hero') {
            const fig = this.fig;
            const neck = this.root.getWorldPosition(_v).y + fig.A.J.neck.y * fig.hero.scale;
            return hit.point.y > neck ? 'head' : 'body';
        }
        return slot || null;
    }
}
