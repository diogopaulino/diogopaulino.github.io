/**
 * Luzes de fogo em pool fixo.
 *
 * No three.js o NÚMERO de luzes da cena entra na chave do shader: ligar/desligar
 * uma PointLight (ou torná-la visível junto com uma torre que sai do pool)
 * recompila todos os materiais e trava o quadro. Por isso nenhuma tocha, braseiro
 * ou lanterna do jogo cria a própria luz. Em vez disso:
 *
 *   1. `createFireLights(scene, n)` cria `n` PointLights permanentes (sem sombra);
 *   2. a cada quadro, cada emissor ATIVO chama `fireLights.request(x, y, z, …)`;
 *   3. `fireLights.commit(camera)` entrega as `n` luzes aos pedidos de maior
 *      peso e zera a intensidade das que sobraram.
 *
 * Peso de um pedido (maior = mais importante):
 *   peso = intensidade · alcance² / (alcance² + d²)        d = distância à câmera
 * — uma tocha forte e próxima vence um braseiro distante.
 *
 * As intensidades usam a escala física do three (candela): com a exposição do
 * entardecer, 40–120 ilumina bem um raio de 8–20 m.
 */

import * as THREE from 'three';

const MAX_REQUESTS = 48;

class FireLights {
    constructor() {
        this.lights = [];
        this.requests = [];
        for (let i = 0; i < MAX_REQUESTS; i++) {
            this.requests.push({ x: 0, y: 0, z: 0, color: 0xff9a3c, intensity: 0, range: 10, weight: 0 });
        }
        this.count = 0;
        this._order = this.requests.slice();
    }

    /** Cria as luzes permanentes. Chame uma vez (antes de compilar os shaders). */
    init(scene, n = 4) {
        if (this.lights.length) return this;
        for (let i = 0; i < n; i++) {
            const light = new THREE.PointLight(0xff9a3c, 0, 18, 2);
            light.castShadow = false;
            light.name = `fireLight${i}`;
            scene.add(light);
            this.lights.push(light);
        }
        return this;
    }

    /**
     * Pede luz para um ponto de fogo neste quadro (posição em coordenadas de mundo).
     * @param {number} color      cor (hex)
     * @param {number} intensity  candela (40–120 para tochas; multiplique pelo tremor)
     * @param {number} range      alcance em metros
     */
    request(x, y, z, color = 0xff9a3c, intensity = 60, range = 14) {
        if (this.count >= MAX_REQUESTS) return;
        const r = this.requests[this.count++];
        r.x = x;
        r.y = y;
        r.z = z;
        r.color = color;
        r.intensity = intensity;
        r.range = range;
    }

    /** Distribui as luzes entre os pedidos do quadro e limpa a fila. */
    commit(camera) {
        const cam = camera.position;
        const n = this.count;
        for (let i = 0; i < n; i++) {
            const r = this.requests[i];
            const dx = r.x - cam.x;
            const dy = r.y - cam.y;
            const dz = r.z - cam.z;
            const rr = r.range * r.range;
            r.weight = (r.intensity * rr) / (rr + dx * dx + dy * dy + dz * dz);
        }
        // seleção parcial: para cada luz, o pedido de maior peso ainda livre
        for (let l = 0; l < this.lights.length; l++) {
            const light = this.lights[l];
            let best = -1;
            let bestW = 0;
            for (let i = 0; i < n; i++) {
                if (this.requests[i].weight > bestW) {
                    bestW = this.requests[i].weight;
                    best = i;
                }
            }
            if (best < 0) {
                light.intensity = 0;
                continue;
            }
            const r = this.requests[best];
            r.weight = 0;
            light.position.set(r.x, r.y, r.z);
            light.color.setHex(r.color);
            light.intensity = r.intensity;
            light.distance = r.range;
        }
        this.count = 0;
    }
}

/** Instância única do jogo. */
export const fireLights = new FireLights();

/** Atalho: cria as luzes na cena e devolve o pool. */
export function createFireLights(scene, n = 4) {
    return fireLights.init(scene, n);
}
