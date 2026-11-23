function isAppleTouch() {
    // iPadOS 13+ manda UA de desktop; maxTouchPoints distingue do Mac de verdade.
    return /iP(hone|ad|od)/.test(navigator.userAgent)
        || (navigator.platform === 'MacIntel' && navigator.maxTouchPoints > 1);
}

// A codificação assíncrona evita uma segunda cópia da imagem em Base64.
// No iPhone/iPad o atributo download é ignorado com frequência — a folha de
// compartilhamento é o caminho confiável; o <a download> fica de reserva.
export async function saveCanvas(canvas, filename, type = 'image/png', quality) {
    const blob = await new Promise((resolve, reject) => {
        canvas.toBlob((result) => {
            if (result) resolve(result);
            else reject(new Error('Não foi possível exportar a imagem.'));
        }, type, quality);
    });

    const file = typeof File !== 'undefined'
        ? new File([blob], filename, { type: blob.type || type })
        : null;

    if (file && isAppleTouch() && typeof navigator.share === 'function') {
        const payload = { files: [file], title: filename };
        const canShare = typeof navigator.canShare !== 'function' || navigator.canShare(payload);
        if (canShare) {
            try {
                await navigator.share(payload);
                return;
            } catch (err) {
                // AbortError = usuário cancelou; qualquer outro erro cai no download.
                if (err && err.name === 'AbortError') return;
            }
        }
    }

    const url = URL.createObjectURL(blob);
    const link = document.createElement('a');
    link.href = url;
    link.download = filename;
    link.rel = 'noopener';
    // Safari iOS às vezes ignora click() em âncora fora do DOM.
    document.body.appendChild(link);
    link.click();
    link.remove();
    // O navegador pode iniciar a leitura depois do clique (especialmente no Safari).
    setTimeout(() => URL.revokeObjectURL(url), 60_000);
}
