
/**
 * Gerencia os efeitos visuais de ondas (Cura da Flor ou Ondas da Colmeia)
 */
export class WaveEffect {
    constructor(x, y, maxRadius, color, healAmount) {
        this.x = x;
        this.y = y;
        this.currentRadius = 0;
        this.maxRadius = maxRadius;
        this.color = color;
        this.healAmount = healAmount;
        this.speed = 0.1; 
        this.life = 1.0;
        this.curedLocal = false; 
    }

    /**
     * Atualiza a expansão da onda e sua opacidade
     * @returns {boolean} true se a onda ainda estiver ativa
     */
    update() {
        this.currentRadius += this.speed;
        this.life = 1.0 - (this.currentRadius / this.maxRadius);
        return this.life > 0;
    }

    /**
     * Renderiza a onda no canvas
     */
    draw(ctx, cam, canvas, tileSize) {
        if (this.life <= 0) return;

        const sX = (this.x - cam.x) * tileSize + canvas.width / 2;
        const sY = (this.y - cam.y) * tileSize + canvas.height / 2;
        const r = this.currentRadius * tileSize;

        ctx.save();
        ctx.beginPath();
        ctx.arc(sX, sY, r, 0, Math.PI * 2);
        ctx.lineWidth = 4 * (tileSize / 32);
        
        // Substitui a string ALPHA pela opacidade calculada
        const finalColor = this.color.replace('ALPHA', this.life.toFixed(2));
        ctx.strokeStyle = finalColor;
        ctx.stroke();
        
        ctx.globalAlpha = this.life * 0.2;
        ctx.fillStyle = finalColor;
        ctx.fill();
        ctx.restore();
    }
}
