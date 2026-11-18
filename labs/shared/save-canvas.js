// A codificação assíncrona evita uma segunda cópia da imagem em Base64.
export async function saveCanvas(canvas, filename, type = 'image/png', quality) {
    const blob = await new Promise(resolve => canvas.toBlob(resolve, type, quality));
    if (!blob) throw new Error('Não foi possível exportar a imagem.');
    const url = URL.createObjectURL(blob);
    const link = document.createElement('a');
    link.href = url;
    link.download = filename;
    link.click();
    // O navegador pode iniciar a leitura depois do clique (especialmente no Safari).
    setTimeout(() => URL.revokeObjectURL(url), 60_000);
}
