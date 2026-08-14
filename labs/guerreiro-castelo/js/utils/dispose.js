/** Dispose recursivo de geometria, materiais e texturas. */

export function disposeObject(root) {
    if (!root) return;
    root.traverse((node) => {
        if (node.geometry) node.geometry.dispose();
        const mats = node.material;
        if (!mats) return;
        const list = Array.isArray(mats) ? mats : [mats];
        for (const mat of list) {
            for (const key of Object.keys(mat)) {
                const value = mat[key];
                if (value && value.isTexture) value.dispose();
            }
            mat.dispose();
        }
    });
}

export function disposeSceneGroup(group, parent) {
    if (!group) return;
    parent?.remove(group);
    disposeObject(group);
}
