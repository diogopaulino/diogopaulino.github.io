/**
 * Base de toda entidade do rio: um Group reciclado em pool (ativo/inativo).
 */

export class Entity {
    constructor(group) {
        this.group = group;
        this.group.visible = false;
        this.active = false;
        this.radius = 2;
        this.hp = 1;
        this.maxHp = 1;
        this.kind = 'entity';
    }

    get position() {
        return this.group.position;
    }

    activate() {
        this.active = true;
        this.group.visible = true;
    }

    deactivate() {
        this.active = false;
        this.group.visible = false;
    }
}
