/** A Jornada do Anel — despacho dos cinco capítulos. */

import { buildShire } from './ch-shire.js?v=32';
import { buildForest } from './ch-forest.js?v=32';
import { buildVale } from './ch-vale.js?v=32';
import { buildMines } from './ch-mines.js?v=32';
import { buildSummit } from './ch-summit.js?v=32';

const BUILDERS = { shire: buildShire, forest: buildForest, vale: buildVale, mines: buildMines, summit: buildSummit };

export function buildChapter(id, ctx) {
    return (BUILDERS[id] || buildShire)(ctx);
}
