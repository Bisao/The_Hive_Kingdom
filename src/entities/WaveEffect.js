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
        
        // AJUSTE: Reduzi de 0.1 para 0.05 para o pulso durar mais tempo e ser mais visível.
        this.speed = 0.05; 
        
        this.life = 1.0;
        this.curedLocal = false; 
    }

    /**
     * Atualiza a expansão da onda e sua opacidade
     * @returns {boolean} true se a onda ainda estiver ativa
     */
    update() {
        this.currentRadius += this.speed;
        
        // Calcula a vida baseada no quanto a onda já expandiu em relação ao máximo
        this.life = 1.0 - (this.currentRadius / this.maxRadius);
        
        // Retorna true enquanto a onda ainda tiver "vida" (não atingiu o raio máximo)
        return this.life > 0;
    }

    /**
     * Renderiza a onda no canvas
     */
    draw(ctx, cam, canvas, tileSize) {
        if (this.life <= 0) return;

        // Converte coordenadas do mundo para coordenadas da tela
        const sX = (this.x - cam.x) * tileSize + canvas.width / 2;
        const sY = (this.y - cam.y) * tileSize + canvas.height / 2;
        const r = this.currentRadius * tileSize;

        ctx.save();
        ctx.beginPath();
        ctx.arc(sX, sY, r, 0, Math.PI * 2);
        
        // A linha fica mais fina conforme a onda expande
        ctx.lineWidth = 4 * (tileSize / 32);
        
        // Substitui a string ALPHA pela opacidade calculada para o efeito de "desvanecer"
        const finalColor = this.color.replace('ALPHA', this.life.toFixed(2));
        ctx.strokeStyle = finalColor;
        ctx.stroke();
        
        // Preenchimento suave e transparente
        ctx.globalAlpha = this.life * 0.2;
        ctx.fillStyle = finalColor;
        ctx.fill();
        ctx.restore();
    }
}
