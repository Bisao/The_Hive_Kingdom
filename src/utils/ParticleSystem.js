export class ParticleSystem {
    constructor() {
        this.pollenParticles = [];
        this.smokeParticles = [];
        this.sakuraParticles = []; // Partículas da Árvore Mestra
        this.healParticles = [];   // Feedback de cura

        // [OTIMIZAÇÃO] Limites máximos globais para evitar vazamento de memória e FPS drop
        this.MAX_POLLEN = 150;
        this.MAX_SMOKE = 200;
        this.MAX_SAKURA = 100;
        this.MAX_HEAL = 50;

        // [OTIMIZAÇÃO] Cache de cálculo matemático constante
        this.TWO_PI = Math.PI * 2;
    }

    /**
     * Cria uma partícula de pólen (amarela)
     * @param {number} x - Posição X no mundo
     * @param {number} y - Posição Y no mundo
     */
    spawnPollen(x, y) {
        if (this.pollenParticles.length >= this.MAX_POLLEN) return;

        this.pollenParticles.push({
            wx: x + (Math.random() * 0.4 - 0.2),
            wy: y + (Math.random() * 0.4 - 0.2),
            size: Math.random() * 3 + 2,
            speedY: Math.random() * 0.02 + 0.01,
            life: 1.0
        });
    }

    /**
     * Cria uma partícula de fumaça ou brasa
     * @param {number} tx - Posição X no mundo
     * @param {number} ty - Posição Y no mundo
     */
    spawnSmoke(tx, ty) {
        if (this.smokeParticles.length >= this.MAX_SMOKE) return;

        const isEmber = Math.random() < 0.15;
        this.smokeParticles.push({
            wx: tx + Math.random(),
            wy: ty + Math.random(),
            isEmber: isEmber,
            size: isEmber ? (Math.random() * 3 + 1) : (Math.random() * 5 + 2),
            speedY: -(Math.random() * 0.03 + 0.01), // Sobe
            wobbleTick: Math.random() * 100,
            wobbleSpeed: Math.random() * 0.05 + 0.02,
            wobbleAmp: 0.01,
            life: Math.random() * 0.6 + 0.4,
            decay: 0.006,
            grayVal: Math.floor(Math.random() * 60)
        });
    }

    /**
     * Cria uma pétala de Sakura caindo suavemente
     * @param {number} x - Posição X no mundo
     * @param {number} y - Posição Y no mundo
     */
    spawnSakuraPetal(x, y) {
        if (this.sakuraParticles.length >= this.MAX_SAKURA) return;

        this.sakuraParticles.push({
            wx: x,
            wy: y,
            size: Math.random() * 4 + 3, // Tamanho da pétala
            speedY: Math.random() * 0.01 + 0.005, // Cai bem devagar
            wobbleTick: Math.random() * this.TWO_PI,
            wobbleSpeed: Math.random() * 0.03 + 0.01, // Balanço no vento
            wobbleAmp: 0.02,
            rotation: Math.random() * this.TWO_PI, // Rotação inicial
            rotSpeed: (Math.random() - 0.5) * 0.05, // Girando enquanto cai
            life: 1.0,
            decay: Math.random() * 0.005 + 0.002 // Desaparece lentamente
        });
    }

    /**
     * Cria uma partícula visual de cura (Cruz verde flutuante)
     * @param {number} x - Posição X no mundo
     * @param {number} y - Posição Y no mundo
     */
    spawnHeal(x, y) {
        if (this.healParticles.length >= this.MAX_HEAL) return;

        this.healParticles.push({
            wx: x + (Math.random() * 0.6 - 0.3),
            wy: y + (Math.random() * 0.6 - 0.3),
            size: Math.random() * 6 + 6,
            speedY: -(Math.random() * 0.03 + 0.02), // Sobe rapidamente
            life: 1.0,
            decay: 0.02 // SOME rápido
        });
    }

    /**
     * [OTIMIZAÇÃO] Atualiza a física usando "Swap and Pop" em vez de .filter()
     * Isso zera o Garbage Collection de arrays, aliviando o processador imensamente.
     */
    update() {
        // Atualiza Pólen
        for (let i = this.pollenParticles.length - 1; i >= 0; i--) {
            const p = this.pollenParticles[i];
            p.wy += p.speedY; // Cai
            p.life -= 0.02;
            
            if (p.life <= 0) {
                const last = this.pollenParticles.pop();
                if (i < this.pollenParticles.length) this.pollenParticles[i] = last;
            }
        }

        // Atualiza Fumaça
        for (let i = this.smokeParticles.length - 1; i >= 0; i--) {
            const p = this.smokeParticles[i];
            p.wy += p.speedY;
            p.life -= p.decay;
            p.wobbleTick += p.wobbleSpeed;
            p.wx += Math.sin(p.wobbleTick) * p.wobbleAmp;
            if (!p.isEmber) p.size += 0.03; // Fumaça expande
            
            if (p.life <= 0) {
                const last = this.smokeParticles.pop();
                if (i < this.smokeParticles.length) this.smokeParticles[i] = last;
            }
        }

        // Atualiza Sakura
        for (let i = this.sakuraParticles.length - 1; i >= 0; i--) {
            const p = this.sakuraParticles[i];
            p.wobbleTick += p.wobbleSpeed;
            p.wx += Math.sin(p.wobbleTick) * p.wobbleAmp; // Movimento de folha caindo
            p.wy += p.speedY; // Gravidade
            p.rotation += p.rotSpeed; // Giro
            p.life -= p.decay;
            
            if (p.life <= 0) {
                const last = this.sakuraParticles.pop();
                if (i < this.sakuraParticles.length) this.sakuraParticles[i] = last;
            }
        }

        // Atualiza Cura
        for (let i = this.healParticles.length - 1; i >= 0; i--) {
            const p = this.healParticles[i];
            p.wy += p.speedY; // Flutua pra cima
            p.life -= p.decay;
            
            if (p.life <= 0) {
                const last = this.healParticles.pop();
                if (i < this.healParticles.length) this.healParticles[i] = last;
            }
        }
    }

    /**
     * Renderiza as partículas no canvas
     * @param {CanvasRenderingContext2D} ctx 
     * @param {Object} cam - Câmera {x, y}
     * @param {HTMLCanvasElement} canvas 
     * @param {number} rTileSize - Tamanho real do tile renderizado (world.tileSize * zoomLevel)
     * @param {number} zoomLevel - Nível de zoom atual
     */
    draw(ctx, cam, canvas, rTileSize, zoomLevel) {
        // Limites da tela (Culling Margem de Segurança)
        const screenMargin = 20 * zoomLevel;
        const screenW = canvas.width + screenMargin;
        const screenH = canvas.height + screenMargin;

        // Desenha Fumaça (Mudado de forEach para for-loop para permitir 'continue' de Culling)
        for (let i = 0; i < this.smokeParticles.length; i++) {
            const p = this.smokeParticles[i];
            const psX = (p.wx - cam.x) * rTileSize + canvas.width / 2;
            const psY = (p.wy - cam.y) * rTileSize + canvas.height / 2;
            
            // Culling: Só desenha se estiver dentro da tela
            if (psX < -screenMargin || psX > screenW || psY < -screenMargin || psY > screenH) continue;
            
            if (p.isEmber) {
                ctx.fillStyle = `rgba(231, 76, 60, ${p.life})`; // Laranja/Vermelho
            } else {
                ctx.fillStyle = `rgba(${p.grayVal},${p.grayVal},${p.grayVal},${p.life * 0.4})`;
            }
            ctx.fillRect(psX, psY, p.size * zoomLevel, p.size * zoomLevel);
        }

        // Desenha Pólen
        for (let i = 0; i < this.pollenParticles.length; i++) {
            const p = this.pollenParticles[i];
            const psX = (p.wx - cam.x) * rTileSize + canvas.width / 2;
            const psY = (p.wy - cam.y) * rTileSize + canvas.height / 2;
            
            if (psX < -screenMargin || psX > screenW || psY < -screenMargin || psY > screenH) continue;

            ctx.fillStyle = `rgba(241,196,15,${p.life})`; // Amarelo
            ctx.fillRect(psX, psY, p.size * zoomLevel, p.size * zoomLevel);
        }

        // Desenha Sakura (Pétalas)
        for (let i = 0; i < this.sakuraParticles.length; i++) {
            const p = this.sakuraParticles[i];
            const psX = (p.wx - cam.x) * rTileSize + canvas.width / 2;
            const psY = (p.wy - cam.y) * rTileSize + canvas.height / 2;
            
            if (psX < -screenMargin || psX > screenW || psY < -screenMargin || psY > screenH) continue;
            
            ctx.save();
            ctx.translate(psX, psY);
            ctx.rotate(p.rotation);
            ctx.fillStyle = `rgba(255, 183, 197, ${p.life})`; // Rosa Sakura clássico
            
            ctx.beginPath();
            ctx.ellipse(0, 0, (p.size * zoomLevel) / 2, p.size * zoomLevel, 0, 0, this.TWO_PI);
            ctx.fill();
            ctx.restore();
        }

        // Desenha Cura (Cruzinhas verdes)
        for (let i = 0; i < this.healParticles.length; i++) {
            const p = this.healParticles[i];
            const psX = (p.wx - cam.x) * rTileSize + canvas.width / 2;
            const psY = (p.wy - cam.y) * rTileSize + canvas.height / 2;
            
            if (psX < -screenMargin || psX > screenW || psY < -screenMargin || psY > screenH) continue;
            
            ctx.fillStyle = `rgba(46, 204, 113, ${p.life})`; // Verde cura
            ctx.font = `bold ${p.size * zoomLevel}px Arial`;
            ctx.textAlign = "center";
            ctx.textBaseline = "middle";
            
            // [OTIMIZAÇÃO] shadowBlur removido pois causa uma imensa queda de FPS.
            // O estilo em "bold" com boa cor já resolve a estética 100%.
            ctx.fillText("+", psX, psY);
        }
    }
}
