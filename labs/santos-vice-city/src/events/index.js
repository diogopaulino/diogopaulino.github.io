// events/index.js — registro das seis provas, na ordem do campeonato.

import { SurfEvent } from './surf.js';
import { SkateEvent } from './skate.js';
import { AltinhaEvent } from './altinha.js';
import { BmxEvent } from './bmx.js';
import { FrescobolEvent } from './frescobol.js';
import { CanoaEvent } from './canoa.js';

const REGISTRY = {
    surf: SurfEvent,
    skate: SkateEvent,
    altinha: AltinhaEvent,
    bmx: BmxEvent,
    frescobol: FrescobolEvent,
    canoa: CanoaEvent
};

/** Instancia a prova pelo id e já roda o setup. */
export function createEvent(id, app) {
    const Klass = REGISTRY[id];
    if (!Klass) throw new Error(`events: prova desconhecida "${id}"`);
    const ev = new Klass(app, id);
    ev.setup();
    return ev;
}

export function hasEvent(id) {
    return Object.prototype.hasOwnProperty.call(REGISTRY, id);
}
