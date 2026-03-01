/**
 * Gerencia os efeitos visuais de ondas (Cura da Flor ou Ondas da Colmeia)
 */
export class WaveEffect {
    constructor(x, y, maxRadius, color, healAmount) {
        this.x = x;
        this.y = y;
        this.currentRadius = 0;
        this.maxRadius = maxRadius;
        this.healAmount = healAmount;
        
        // AJUSTE: Reduzi de 0.1 para 0.05 para o pulso durar mais tempo e ser mais visível.
        this.speed = 0.05; 
        
        this.life = 1.0;
        this.curedLocal = false; 

        // [OTIMIZAÇÃO] Processa a cor uma única vez no construtor.
        // Transforma a máscara "rgba(R, G, B, ALPHA)" recebida em uma cor "rgb(R, G, B)" sólida.
        // O alpha será manipulado diretamente na GPU durante o render.
        if (color && color.includes('ALPHA')) {
            this.baseColor = color.replace('rgba(', 'rgb(').replace(', ALPHA', '');
        } else {
            this.baseColor = color || "rgb(241, 196, 15)";
        }
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

        // [OTIMIZAÇÃO EXTREMA - CULLING] 
        // Não desenha a onda se os limites do círculo estiverem totalmente fora da tela.
        // Isso evita que ondas gigantes geradas por colmeias muito distantes matem a placa de vídeo.
        if (sX + r < 0 || sX - r > canvas.width || sY + r < 0 || sY - r > canvas.height) {
            return;
        }

        ctx.save();
        ctx.beginPath();
        ctx.arc(sX, sY, r, 0, Math.PI * 2);
        
        // A linha fica mais fina conforme a onda expande
        ctx.lineWidth = 4 * (tileSize / 32);
        
        // [OTIMIZAÇÃO] Uso do globalAlpha nativo (hardware acceleration) 
        // ao invés de concatenar strings de "rgba" infinitamente.
        ctx.strokeStyle = this.baseColor;
        ctx.globalAlpha = this.life;
        ctx.stroke();
        
        // Preenchimento suave e transparente
        ctx.fillStyle = this.baseColor;
        ctx.globalAlpha = this.life * 0.2; // 20% da vida atual
        ctx.fill();
        
        ctx.restore();
    }
}
