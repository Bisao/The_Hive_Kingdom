export class Player {
    constructor(id, nickname, isLocal = false) {
        this.id = id;
        this.nickname = nickname;
        this.isLocal = isLocal;
        this.pos = { x: 0, y: 0 };
        this.targetPos = { x: 0, y: 0 };
        this.speed = 0.15;
    }

    update() {
        if (!this.isLocal) {
            this.pos.x += (this.targetPos.x - this.pos.x) * 0.2;
            this.pos.y += (this.targetPos.y - this.pos.y) * 0.2;
        }
    }

    draw(ctx, cam, canvas, tileSize) {
        const sX = (this.pos.x - cam.x) * tileSize + canvas.width / 2;
        const sY = (this.pos.y - cam.y) * tileSize + canvas.height / 2;
        ctx.fillStyle = this.isLocal ? "#f1c40f" : "#e67e22";
        ctx.beginPath();
        ctx.arc(sX, sY, 12, 0, Math.PI * 2);
        ctx.fill();
        ctx.fillStyle = "white";
        ctx.textAlign = "center";
        ctx.fillText(this.nickname, sX, sY - 20);
    }
}
