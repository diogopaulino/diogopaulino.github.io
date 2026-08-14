/** Object pool genérico — evita `new` no loop de jogo. */

export class Pool {
    constructor(factory, initial = 0) {
        this.factory = factory;
        this.free = [];
        this.live = [];
        for (let i = 0; i < initial; i++) this.free.push(factory());
    }

    obtain() {
        const item = this.free.pop() || this.factory();
        this.live.push(item);
        return item;
    }

    release(item) {
        const i = this.live.indexOf(item);
        if (i >= 0) this.live.splice(i, 1);
        this.free.push(item);
    }

    releaseAll() {
        while (this.live.length) this.free.push(this.live.pop());
    }
}
