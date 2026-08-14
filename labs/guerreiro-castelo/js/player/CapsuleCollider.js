/** Cápsula do jogador — raio + altura, usada pela física e pelo stealth. */

export class CapsuleCollider {
    constructor({ radius = 0.32, height = 1.78 } = {}) {
        this.radius = radius;
        this.height = height;
        this.crouchHeight = 1.15;
        this.standingHeight = height;
        this.crouching = false;
    }

    setCrouch(v) {
        this.crouching = v;
        this.height = v ? this.crouchHeight : this.standingHeight;
    }

    get eyeHeight() {
        return this.height * 0.92;
    }
}
