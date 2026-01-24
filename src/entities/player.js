export class Player {
    constructor(id, nickname, isLocal = false) {
        this.id = id;
        this.nickname = nickname;
        this.isLocal = isLocal;
        
        // Posição
        this.pos = { x: 0, y: 0 };
        this.targetPos = { x: 0, y: 0 };
        this.speed = 0.15;
        this.currentDir = 'Down';
        
        // Status
        this.pollen = 0;
        this.maxPollen = 100;
        
        // NOVO: Sistema de Vida
        this.hp = 100;
        this.maxHp = 100;

        // Sprites
        this.sprites = {};
        const dirs = ['Up', 'Down', 'Left', 'Right', 'Idle', 'LeftIdle', 'RightIdle'];
        dirs.forEach(d => {
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
            // Interpolação Linear para movimento suave dos outros jogadores
            // Se a distância for muito grande (respawn), teleporta direto
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

    // Método para renascer na colmeia
    respawn() {
        this.pos.x = 0;
        this.pos.y = 0;
        this.hp = this.maxHp;
        this.pollen = 0; // Perde a carga
        this.currentDir = 'Down';
    }

    draw(ctx, cam, canvas, tileSize) {
        const sX = (this.pos.x - cam.x) * tileSize + canvas.width / 2;
        const sY = (this.pos.y - cam.y) * tileSize + canvas.height / 2;

        const sprite = this.sprites[this.currentDir] || this.sprites['Idle'];

        // Desenha Sprite
        if (sprite.complete && sprite.naturalWidth !== 0) {
            ctx.drawImage(sprite, sX - tileSize/2, sY - tileSize/2, tileSize, tileSize);
        } else {
            ctx.fillStyle = "yellow";
            ctx.beginPath(); ctx.arc(sX, sY, 10, 0, Math.PI*2); ctx.fill();
        }

        // --- BARRA DE VIDA (Vermelha) ---
        // Desenha sempre acima da barra de pólen
        const barWidth = 32;
        const barHeight = 4;
        const hpY = sY - 45; // Posição Y da vida
        
        // Fundo Vermelho Escuro
        ctx.fillStyle = "#550000"; 
        ctx.fillRect(sX - barWidth/2, hpY, barWidth, barHeight);
        
        // Vida Atual (Vermelho Vivo)
        ctx.fillStyle = "#e74c3c"; 
        const hpPct = Math.max(0, this.hp / this.maxHp);
        ctx.fillRect(sX - barWidth/2, hpY, barWidth * hpPct, barHeight);


        // --- BARRA DE PÓLEN (Amarela) ---
        if (this.pollen > 0) {
            const pollenY = sY - 38; // Posição Y do pólen (abaixo da vida)
            ctx.fillStyle = "#222"; 
            ctx.fillRect(sX - barWidth/2, pollenY, barWidth, barHeight);
            
            ctx.fillStyle = "#f1c40f"; 
            const polPct = this.pollen / this.maxPollen;
            ctx.fillRect(sX - barWidth/2, pollenY, barWidth * polPct, barHeight);
        }

        // Nickname
        ctx.fillStyle = "white"; 
        ctx.font = "bold 12px sans-serif"; 
        ctx.textAlign = "center";
        ctx.strokeStyle = "black"; ctx.lineWidth = 2; 
        ctx.strokeText(this.nickname, sX, sY - 20); 
        ctx.fillText(this.nickname, sX, sY - 20);
    }
}
