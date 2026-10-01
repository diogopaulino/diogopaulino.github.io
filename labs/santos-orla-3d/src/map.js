const NS = 'http://www.w3.org/2000/svg';
function el(tag, attrs, text) {
  const e = document.createElementNS(NS, tag);
  for (const [k, v] of Object.entries(attrs)) e.setAttribute(k, v);
  if (text) e.textContent = text;
  return e;
}
export function create({ geography, onPlace }) {
  const svg = document.querySelector('#route-map');
  // WGS84 -> local equirectangular projection, with latitude cosine correction.
  // Aspect ratio is preserved; the map is explicitly schematic, not satellite.
  const project = ([lon, lat]) => [170 + (lon + 46.353) * 13500, 240 + (-lat - 23.966) * 14800];
  const path = coords => coords.map((p, i) => `${i ? 'L' : 'M'}${project(p).join(' ')}`).join(' ');
  const route = geography.route;
  const points = route.points.map(project);
  const land = `M0 0 L1000 0 L1000 620 L${points.at(-1).join(' ')} ${points.slice().reverse().map(p => `L${p.join(' ')}`).join(' ')} L0 240 Z`;
  svg.append(el('path', { d: land, fill: '#18383e' }));
  for (let i = 0; i < 9; i++) svg.append(el('path', { d: `M40 ${330 + i * 24} Q420 ${220 + i * 26} 670 ${530 + i * 16}`, fill: 'none', stroke: '#75a8b514', 'stroke-width': 1 }));
  svg.append(el('text', { x: 250, y: 425, class: 'map-sea' }, 'BAÍA DE SANTOS'));
  svg.append(el('text', { x: 440, y: 182, class: 'map-label' }, 'SANTOS'));
  svg.append(el('text', { x: 820, y: 555, class: 'map-sea', transform: 'rotate(-53 820 555)' }, 'ESTUÁRIO'));
  for (const canal of geography.data.channels) {
    for (const segment of canal.geometry) svg.append(el('path', { d: path(segment.coordinates), fill: 'none', stroke: '#69afcc', 'stroke-width': 2, 'stroke-dasharray': segment.culvert ? '3 4' : 'none', opacity: .6 }));
  }
  svg.append(el('path', { d: path(route.points), class: 'map-path' }));
  geography.places.forEach((place, i) => {
    const [x, y] = project(place.coordinates);
    const group = el('g', { class: 'map-place', role: 'button', tabindex: 0, 'aria-label': place.name });
    // Large transparent hit target scales with SVG. Side list is the >=44px
    // touch-accessible equivalent for every landmark on narrow screens.
    group.append(el('circle', { cx: x, cy: y, r: 18, fill: 'transparent' }));
    group.append(el('circle', { cx: x, cy: y, r: place.type === 'CANAL' ? 4 : 6, class: 'map-pin' }));
    if (place.type === 'CANAL') group.append(el('text', { x: x - 16, y: y - 15, class: 'map-label' }, place.name));
    else if (['emissario', 'aquario', 'gonzaga'].includes(place.id)) group.append(el('text', { x: x + 12, y: y + (i % 2 ? 20 : 0), class: 'map-label' }, place.name.split(' / ')[0]));
    group.addEventListener('click', () => onPlace(place));
    group.addEventListener('keydown', e => { if (e.key === 'Enter' || e.key === ' ') { e.preventDefault(); onPlace(place); } });
    svg.append(group);
  });
  const marker = el('g', {});
  marker.append(el('circle', { r: 19, class: 'map-halo' }), el('circle', { r: 7, fill: '#d9f59c', stroke: '#0d2733', 'stroke-width': 3 }));
  svg.append(marker);
  svg.append(el('text', { x: 30, y: 596, fill: '#9cb7c1', 'font-size': 10, 'font-family': 'sans-serif' }, 'MAPA ESQUEMÁTICO · © OpenStreetMap contributors · percurso aproximado'));
  function update(meters) { marker.setAttribute('transform', `translate(${project(route.at(meters)).join(' ')})`); }
  update(0);
  return { update };
}
