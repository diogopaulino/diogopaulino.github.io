// Uma única sondagem por página. Liberar o contexto temporário preserva o
// limite de contextos WebGL para o renderer e as miniaturas do próprio lab.
let capabilities;

export function graphicsCapabilities() {
    if (capabilities) return capabilities;
    let gl;
    try {
        const canvas = document.createElement('canvas');
        gl = canvas.getContext('webgl2');
        const webgl2 = Boolean(gl);
        gl ||= canvas.getContext('webgl');
        const info = gl?.getExtension('WEBGL_debug_renderer_info');
        const name = gl?.getParameter(info?.UNMASKED_RENDERER_WEBGL ?? gl.RENDERER);
        capabilities = { webgl2, software: !gl || /swiftshader|llvmpipe|softpipe|softgl|software|microsoft basic render|\bcpu\b/i.test(name) };
    } catch {
        capabilities = { webgl2: false, software: true };
    } finally {
        gl?.getExtension('WEBGL_lose_context')?.loseContext();
    }
    return capabilities;
}

export function detectSoftwareGL() {
    return graphicsCapabilities().software;
}
