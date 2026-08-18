export function clamp(v, a = 0, b = 1) {
    return Math.max(a, Math.min(b, v));
}

export function lerp(a, b, t) {
    return a + (b - a) * t;
}

export function damp(current, target, lambda, dt) {
    return lerp(current, target, 1 - Math.exp(-lambda * dt));
}

export function saturate(v) {
    return clamp(v, 0, 1);
}

export function detectMobile() {
    return /Mobi|Android|iPhone|iPad/i.test(navigator.userAgent)
        || window.matchMedia('(pointer: coarse)').matches
        || window.innerWidth < 720;
}

export function detectSoftwareGL() {
    try {
        const gl = document.createElement('canvas').getContext('webgl2')
            || document.createElement('canvas').getContext('webgl');
        const info = gl?.getExtension('WEBGL_debug_renderer_info');
        const name = info ? String(gl.getParameter(info.UNMASKED_RENDERER_WEBGL) || '') : '';
        return /swiftshader|llvmpipe|softpipe|microsoft basic render|\bcpu\b/i.test(name);
    } catch {
        return false;
    }
}

export function rendererIsSoftware(renderer) {
    try {
        const gl = renderer.getContext();
        const info = gl?.getExtension('WEBGL_debug_renderer_info');
        const name = info ? String(gl.getParameter(info.UNMASKED_RENDERER_WEBGL) || '') : '';
        return /swiftshader|llvmpipe|softpipe|microsoft basic render|\bcpu\b/i.test(name);
    } catch {
        return false;
    }
}

export function moodScore(needs) {
    return (
        needs.hunger * 0.28
        + needs.joy * 0.26
        + needs.hygiene * 0.16
        + needs.energy * 0.16
        + needs.love * 0.14
    );
}

export function moodLabel(needs) {
    if (needs.hunger < 22) return { id: 'hungry', text: 'com fome', emoji: '🍽️' };
    if (needs.energy < 22) return { id: 'sleepy', text: 'com sono', emoji: '😴' };
    if (needs.hygiene < 28) return { id: 'dirty', text: 'precisando de banho', emoji: '🛁' };
    if (needs.joy < 22) return { id: 'sad', text: 'triste', emoji: '🥺' };
    if (needs.love < 28) return { id: 'lonely', text: 'querendo colo', emoji: '🤍' };
    const score = moodScore(needs);
    if (score > 84) return { id: 'joy', text: 'radiante', emoji: '✨' };
    if (score > 62) return { id: 'happy', text: 'contente', emoji: '🐾' };
    return { id: 'ok', text: 'de boa', emoji: '·' };
}

export function formatAge(ms) {
    const m = Math.floor(ms / 60000);
    if (m < 1) return 'recém-chegado';
    if (m < 60) return `${m} min juntos`;
    const h = Math.floor(m / 60);
    if (h < 24) return `${h} h juntos`;
    const d = Math.floor(h / 24);
    return d === 1 ? '1 dia juntos' : `${d} dias juntos`;
}
