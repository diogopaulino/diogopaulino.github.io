import { graphicsCapabilities } from './capabilities.js';

if (!graphicsCapabilities().webgl2) {
    document.getElementById('loadingOverlay').hidden = true;
    document.getElementById('errorOverlay').hidden = false;
}
