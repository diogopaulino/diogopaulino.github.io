// WGS84 route from the OSM pedestrian graph. Two explicitly disclosed joins
// bridge incomplete OSM topology; this is a visual route, not routing guidance.
export const rad = degrees => degrees * Math.PI / 180;
export const deg = radians => radians * 180 / Math.PI;
export const clamp = (v, a, b) => Math.max(a, Math.min(b, v));
export function distance(a, b) {
  const dLat = rad(b[1] - a[1]), dLon = rad(b[0] - a[0]);
  const h = Math.sin(dLat / 2) ** 2 + Math.cos(rad(a[1])) * Math.cos(rad(b[1])) * Math.sin(dLon / 2) ** 2;
  return 6371008.8 * 2 * Math.atan2(Math.sqrt(h), Math.sqrt(Math.max(0, 1 - h)));
}
export function bearing(a, b) {
  const dl = rad(b[0] - a[0]);
  return Math.atan2(Math.sin(dl) * Math.cos(rad(b[1])), Math.cos(rad(a[1])) * Math.sin(rad(b[1])) - Math.sin(rad(a[1])) * Math.cos(rad(b[1])) * Math.cos(dl));
}
export function buildRoute(points) {
  const cumulative = [0];
  for (let i = 1; i < points.length; i++) cumulative.push(cumulative[i - 1] + distance(points[i - 1], points[i]));
  const length = cumulative.at(-1);
  function at(meters) {
    const m = clamp(meters, 0, length);
    let i = 1;
    while (i < cumulative.length - 1 && cumulative[i] < m) i++;
    const f = (m - cumulative[i - 1]) / (cumulative[i] - cumulative[i - 1] || 1);
    return points[i - 1].map((v, j) => v + (points[i][j] - v) * f);
  }
  function nearest(p) {
    // Project onto each local segment in meters, not just vertices. This avoids
    // landmark jumps when an OSM segment spans a long part of the promenade.
    const xScale = Math.cos(rad(p[1]));
    let best = { meters: 0, distance: Infinity };
    for (let i = 1; i < points.length; i++) {
      const a = points[i - 1], b = points[i];
      const dx = (b[0] - a[0]) * xScale, dy = b[1] - a[1];
      const f = clamp(((p[0] - a[0]) * xScale * dx + (p[1] - a[1]) * dy) / (dx * dx + dy * dy || 1), 0, 1);
      const q = [a[0] + (b[0] - a[0]) * f, a[1] + (b[1] - a[1]) * f];
      const d = distance(p, q);
      if (d < best.distance) best = { meters: cumulative[i - 1] + f * (cumulative[i] - cumulative[i - 1]), distance: d };
    }
    return best.meters;
  }
  function heading(m) { return bearing(at(clamp(m - 5, 0, length - 10)), at(clamp(m + 10, 10, length))); }
  return { points, cumulative, length, at, nearest, heading };
}
export async function loadGeography() {
  const response = await fetch(new URL('./geography.json', import.meta.url));
  if (!response.ok) throw new Error('geography');
  const data = await response.json();
  const route = buildRoute(data.route.coordinates);
  const descriptions = {
    emissario: ['PAISAGEM', 'O Novo Quebra-Mar encontra o mar no José Menino. Um dos pontos mais marcantes da extremidade oeste da orla.'],
    urubuquecaba: ['PAISAGEM', 'A ilha em frente ao José Menino ajuda a reconhecer Santos pelo contorno da baía. A caminhada fica no continente.'],
    gonzaga: ['BAIRRO', 'Praça das Bandeiras, jardins e a praia do Gonzaga. Um ponto de encontro entre a vida urbana e o mar.'],
    'fonte-sapo': ['ENCONTRO', 'Uma referência dos jardins da Aparecida, próxima ao Canal 6. Um ponto para localizar seu trecho da orla.'],
    aquario: ['PATRIMÔNIO', 'Aquário Municipal, na Ponta da Praia. A Prefeitura informou obras de reforma em setembro de 2026. Confira o status antes de visitar.'],
    'deck-pescador': ['ESTUÁRIO', 'Aqui o horizonte muda: a entrada do porto, os navios e o encontro da orla com o estuário.'],
  };
  const places = data.landmarks.map(p => ({ ...p, type: descriptions[p.id][0], description: descriptions[p.id][1], resident: ['gonzaga', 'fonte-sapo', 'deck-pescador'].includes(p.id), meters: route.nearest(p.coordinates) }));
  for (const canal of data.channels) places.push({ ...canal, type: 'CANAL', description: `${canal.name}, uma das referências para se orientar pela orla. O marcador fica no percurso próximo ao canal; a linha azul mostra seu traçado cadastrado no OpenStreetMap.`, resident: true, meters: route.nearest(canal.coordinates) });
  places.sort((a, b) => a.meters - b.meters);
  return { data, route, places };
}
