import { config } from './config.js';
import { rad, clamp } from './geo.js';

const CESIUM_BASE = `https://cesium.com/downloads/cesiumjs/releases/${config.cesiumVersion}/Build/Cesium/`;
function loadEngine() {
  if (window.Cesium) return Promise.resolve(window.Cesium);
  window.CESIUM_BASE_URL = CESIUM_BASE;
  const css = document.createElement('link'); css.rel = 'stylesheet'; css.href = `${CESIUM_BASE}Widgets/widgets.css`; document.head.append(css);
  return new Promise((resolve, reject) => {
    const script = document.createElement('script');
    const timeout = setTimeout(() => { script.remove(); reject(new Error('engine-timeout')); }, 20000);
    script.src = `${CESIUM_BASE}Cesium.js`; script.async = true;
    script.onload = () => { clearTimeout(timeout); window.Cesium ? resolve(window.Cesium) : reject(new Error('engine')); };
    script.onerror = () => { clearTimeout(timeout); reject(new Error('engine')); };
    document.head.append(script);
  });
}
export async function create({ geography, onPlace, onStatus, onError }) {
  const C = await loadEngine();
  C.Ion.defaultAccessToken = ''; // No shared/demo token or implicit ion services.
  const viewer = new C.Viewer('globe', {
    baseLayer: false, terrainProvider: new C.EllipsoidTerrainProvider(),
    animation: false, timeline: false, baseLayerPicker: false, geocoder: false,
    homeButton: false, sceneModePicker: false, navigationHelpButton: false,
    fullscreenButton: false, selectionIndicator: false, infoBox: false,
    requestRenderMode: true, maximumRenderTimeChange: Infinity,
    contextOptions: { webgl: { alpha: false, powerPreference: 'high-performance' } },
  });
  const scene = viewer.scene, camera = viewer.camera;
  viewer.resolutionScale = matchMedia('(pointer: coarse)').matches ? .75 : 1;
  viewer.targetFrameRate = 30;
  scene.globe.baseColor = C.Color.fromCssColorString('#133340');
  scene.globe.enableLighting = false;
  scene.globe.maximumScreenSpaceError = 2;
  scene.fog.enabled = false;
  scene.skyAtmosphere.show = true;
  scene.screenSpaceCameraController.minimumZoomDistance = 4;
  scene.screenSpaceCameraController.maximumZoomDistance = 30000;
  let imagery, tileset, isGoogle = false, connectVersion = 0, cameraVersion = 0, flyActive = false;
  const route = geography.route;
  const credit = new C.Credit('<a href="https://www.openstreetmap.org/copyright" target="_blank" rel="noopener noreferrer">© OpenStreetMap contributors</a>', true);
  viewer.cesiumWidget.creditDisplay.addStaticCredit(credit);
  scene.renderError.addEventListener(() => onError('O navegador não conseguiu renderizar o globo. Use a vista Mapa.'));
  const source = new C.CustomDataSource('orla'); viewer.dataSources.add(source);
  source.entities.add({ id: 'route', polyline: { positions: C.Cartesian3.fromDegreesArray(route.points.flat()), width: 3, clampToGround: true, material: C.Color.fromCssColorString('#d9f59c').withAlpha(.8) } });
  for (const canal of geography.data.channels) for (const segment of canal.geometry) source.entities.add({ polyline: { positions: C.Cartesian3.fromDegreesArray(segment.coordinates.flat()), width: 2, clampToGround: true, material: C.Color.fromCssColorString('#70b8d4').withAlpha(.7) } });
  for (const p of geography.places) source.entities.add({
    id: p.id, position: C.Cartesian3.fromDegrees(...p.coordinates),
    point: { pixelSize: p.type === 'CANAL' ? 6 : 9, color: C.Color.fromCssColorString('#d9f59c'), outlineColor: C.Color.fromCssColorString('#102d36'), outlineWidth: 2, heightReference: C.HeightReference.CLAMP_TO_GROUND, disableDepthTestDistance: 5000 },
    label: { text: p.name.split(' / ')[0], font: '12px sans-serif', fillColor: C.Color.WHITE, style: C.LabelStyle.FILL_AND_OUTLINE, outlineColor: C.Color.fromCssColorString('#0b202a'), outlineWidth: 4, pixelOffset: new C.Cartesian2(0, -19), heightReference: C.HeightReference.CLAMP_TO_GROUND, distanceDisplayCondition: new C.DistanceDisplayCondition(50, p.type === 'CANAL' ? 1700 : 9000), disableDepthTestDistance: 5000 },
  });
  const you = source.entities.add({ position: C.Cartesian3.fromDegrees(...route.at(0)), point: { pixelSize: 12, color: C.Color.WHITE, outlineColor: C.Color.fromCssColorString('#87be5b'), outlineWidth: 4, heightReference: C.HeightReference.CLAMP_TO_GROUND, disableDepthTestDistance: Number.POSITIVE_INFINITY } });
  viewer.screenSpaceEventHandler.setInputAction(click => {
    const pick = scene.pick(click.position);
    const p = geography.places.find(p => p.id === pick?.id?.id);
    if (p) onPlace(p);
  }, C.ScreenSpaceEventType.LEFT_CLICK);
  camera.setView({ destination: C.Cartesian3.fromDegrees(-46.332, -24.007, 4200), orientation: { heading: 0, pitch: rad(-53), roll: 0 } });

  async function satellite() {
    connectVersion++;
    if (tileset) { scene.primitives.remove(tileset); tileset = undefined; }
    isGoogle = false; scene.globe.show = true;
    if (!imagery) {
      const provider = await C.ArcGisMapServerImageryProvider.fromUrl('https://services.arcgisonline.com/ArcGIS/rest/services/World_Imagery/MapServer', { enablePickFeatures: false });
      imagery = viewer.imageryLayers.addImageryProvider(provider);
      let errorCount = 0;
      provider.errorEvent.addEventListener(() => { if (++errorCount === 4) onError('As imagens de satélite não carregaram. A vista Mapa continua disponível.'); });
    }
    imagery.show = true;
    onStatus('satellite'); scene.requestRender();
  }
  async function connect(key) {
    const version = ++connectVersion;
    // Native Cesium 3D Tiles loader preserves streaming, LOD and glTF credits.
    // No caching, extraction, custom proxy or non-Google geocoder is used.
    const result = await C.Cesium3DTileset.fromUrl(`https://tile.googleapis.com/v1/3dtiles/root.json?key=${encodeURIComponent(key)}`, {
      showCreditsOnScreen: true,
      maximumScreenSpaceError: matchMedia('(pointer: coarse)').matches ? 24 : 12,
      cacheBytes: matchMedia('(pointer: coarse)').matches ? 128 * 1024 ** 2 : 256 * 1024 ** 2,
      maximumCacheOverflowBytes: 64 * 1024 ** 2,
    });
    if (version !== connectVersion) { result.destroy(); return false; }
    if (tileset) scene.primitives.remove(tileset);
    tileset = result; scene.primitives.add(result);
    result.tileFailed.addEventListener(() => onError('Alguns detalhes 3D não carregaram. Confira a chave, a cota e a cobertura.'));
    isGoogle = true;
    if (imagery) imagery.show = false;
    scene.globe.show = false;
    onStatus('google'); scene.requestRender();
    return true;
  }
  function cancelFlight() { cameraVersion++; camera.cancelFlight(); flyActive = false; }
  function goTo(p, { height = 950, duration = 2.4, heading = 0, pitch = -50 } = {}) {
    cancelFlight(); const version = cameraVersion; flyActive = true;
    // Offset camera south so the real coordinate is ahead of the camera,
    // rather than directly underneath an oblique view.
    const latOffset = height / Math.tan(Math.abs(rad(pitch))) / 111195;
    camera.flyTo({ destination: C.Cartesian3.fromDegrees(p[0], p[1] - latOffset, height), orientation: { heading, pitch: rad(pitch), roll: 0 }, duration: matchMedia('(prefers-reduced-motion: reduce)').matches ? 0 : duration, complete: () => { if (version === cameraVersion) flyActive = false; }, cancel: () => { if (version === cameraVersion) flyActive = false; } });
  }
  function update(meters, mode, look = 0) {
    const p = route.at(meters);
    you.position = C.Cartesian3.fromDegrees(...p);
    you.show = mode !== 'walk';
    if (!flyActive && mode === 'drone') {
      const heading = route.heading(meters);
      const target = C.Cartesian3.fromDegrees(...p, 10);
      camera.lookAt(target, new C.HeadingPitchRange(heading + rad(-30), rad(-28), 480));
      camera.lookAtTransform(C.Matrix4.IDENTITY);
    }
    if (!flyActive && mode === 'walk' && isGoogle) {
      const ground = getGround(p);
      if (ground === undefined) return false;
      camera.setView({ destination: C.Cartesian3.fromDegrees(...p, ground + 1.72), orientation: { heading: route.heading(meters) + look, pitch: rad(-3), roll: 0 } });
    }
    scene.requestRender(); return true;
  }
  function getGround(p) {
    if (!isGoogle || !scene.sampleHeightSupported) return undefined;
    // Sample visible geometry only. Exclude our pins/route so they are never
    // treated as pavement. Never guess sea-level when coverage is absent.
    let height;
    try { height = scene.sampleHeight(C.Cartographic.fromDegrees(...p), source.entities.values); }
    catch { return undefined; }
    // Waterfront paths are low and flat. Tall canopy/roof hits are rejected;
    // an unrecognized surface must not teleport the observer onto a building.
    return Number.isFinite(height) && height > -10 && height < 15 ? height : undefined;
  }
  async function prepareWalk(meters) {
    if (!isGoogle) return false;
    const p = route.at(meters);
    goTo(p, { height: 180, duration: 1.2, pitch: -65 });
    const version = cameraVersion, start = performance.now();
    while (performance.now() - start < 12000) {
      if (version !== cameraVersion || !isGoogle) return false;
      scene.requestRender();
      if (!flyActive && getGround(p) !== undefined) return true;
      await new Promise(resolve => setTimeout(resolve, 300));
    }
    return false;
  }
  function interaction(enabled) { scene.screenSpaceCameraController.enableInputs = enabled; }
  try { await satellite(); } catch { onError('O satélite está indisponível. Você pode explorar a vista Mapa ou conectar o Google 3D.'); }
  return { viewer, goTo, update, connect, satellite, prepareWalk, cancelFlight, interaction, get google() { return isGoogle; }, dispose: () => viewer.destroy() };
}
