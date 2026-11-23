/** A Jornada do Anel — despacho dos cinco capítulos. */

import { buildShire } from './ch-shire.js?v=31';
import { buildForest } from './ch-forest.js?v=31';
import { buildVale } from './ch-vale.js?v=31';
import { buildMines } from './ch-mines.js?v=31';
import { buildSummit } from './ch-summit.js?v=31';

const BUILDERS = { shire: buildShire, forest: buildForest, vale: buildVale, mines: buildMines, summit: buildSummit };

export function buildChapter(id, ctx) {
    return (BUILDERS[id] || buildShire)(ctx);
}
