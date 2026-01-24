export class Player {
    constructor(id, nickname, isLocal = false) {
        this.id = id;
        this.nickname = nickname;
        this.isLocal = isLocal;
        
        this.pos = { x: 0, y: 0 };
        this.targetPos = { x: 0, y: 0 };
        this.speed = 0.15;
        this.currentDir = 'Down';
        
        // Status
        this.pollen = 0;
        this.maxPollen = 100;
        this.hp = 100;
        this.maxHp = 100;

        this.sprites = {};
        ['Up', 'Down', 'Left', 'Right', 'Idle', 'LeftIdle', 'RightIdle'].forEach(d => {
            this.sprites[d] = new Image();
            this.sprites[d].src = `assets/Bee${d}.png`;
        });
    }

    update(moveVector) {
        if (this.isLocal) {
            const isMoving = moveVector.x !== 0 || moveVector.y !== 0;
            if (isMoving) {
                if (Math.abs(moveVector.x) > Math.abs(moveVector.y)) {
                    this.currentDir = moveVector.x > 0 ? 'Right' : 'Left';
                } else {
                    this.currentDir = moveVector.y > 0 ? 'Down' : 'Up';
                }
            } else {
                if(this.currentDir === 'Left') this.currentDir = 'LeftIdle';
                else if(this.currentDir === 'Right') this.currentDir = 'RightIdle';
                else if(this.currentDir === 'Up' || this.currentDir === 'Down') this.currentDir = 'Idle';
            }
        } else {
            const dist = Math.sqrt(Math.pow(this.targetPos.x - this.pos.x, 2) + Math.pow(this.targetPos.y - this.pos.y, 2));
            if (dist > 5) {
                this.pos.x = this.targetPos.x;
                this.pos.y = this.targetPos.y;
            } else {
                this.pos.x += (this.targetPos.x - this.pos.x) * 0.2;
                this.pos.y += (this.targetPos.y - this.pos.y) * 0.2;
            }
        }
    }

    respawn() {
        this.pos.x = 0;
        this.pos.y = 0;
        this.hp = this.maxHp;
        this.pollen = 0; 
        this.currentDir = 'Down';
    }

    draw(ctx, cam, canvas, tileSize) {
        // Posição base do Tile (Centro do tile na tela)
        const sX = (this.pos.x - cam.x) * tileSize + canvas.width / 2;
        const sY = (this.pos.y - cam.y) * tileSize + canvas.height / 2;

        const sprite = this.sprites[this.currentDir] || this.sprites['Idle'];
        const zoomScale = tileSize / 32; // Baseado no tamanho padrão de 32px

        // --- CÁLCULO DE ANIMAÇÃO (Balanço da Abelha) ---
        // Math.sin cria uma onda suave que vai de -1 a 1
        // Dividir Date.now() controla a velocidade (menor = mais rápido)
        // Multiplicar no final controla a amplitude (pixels de movimento)
        const floatY = Math.sin(Date.now() / 200) * (3 * zoomScale); 
        
        // Elevação fixa para parecer que está voando acima do chão
        const elevation = 12 * zoomScale; 

        // Posição final de desenho do sprite (Base - Elevação + Flutuação)
        const drawY = sY - elevation + floatY;

        // 1. DESENHAR SOMBRA (No chão, fixa)
        ctx.fillStyle = "rgba(0, 0, 0, 0.3)";
        ctx.beginPath();
        // Elipse achatada na base do tile
        // x, y, raioX, raioY, rotação, anguloInicio, anguloFim
        ctx.ellipse(sX, sY + (8 * zoomScale), 10 * zoomScale, 4 * zoomScale, 0, 0, Math.PI * 2);
        ctx.fill();

        // 2. DESENHAR SPRITE (Flutuando)
        if (sprite.complete && sprite.naturalWidth !== 0) {
            // Desenha centrado no X, e aplicado o Y calculado
            ctx.drawImage(sprite, sX - tileSize/2, drawY - tileSize/2, tileSize, tileSize);
        } else {
            ctx.fillStyle = "yellow";
            ctx.beginPath(); ctx.arc(sX, drawY, 10 * zoomScale, 0, Math.PI*2); ctx.fill();
        }

        // --- NICKNAME (Acompanha a cabeça da abelha) ---
        ctx.fillStyle = "white"; 
        ctx.font = `bold ${12 * zoomScale}px sans-serif`; 
        ctx.textAlign = "center";
        ctx.strokeStyle = "black"; ctx.lineWidth = 2; 
        
        const nickY = drawY - (20 * zoomScale);
        ctx.strokeText(this.nickname, sX, nickY); 
        ctx.fillText(this.nickname, sX, nickY);
    }
}
