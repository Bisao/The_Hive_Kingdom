export class Player {
    constructor(id, nickname, isLocal = false) {
        this.id = id;
        this.nickname = nickname;
        this.isLocal = isLocal;
        
        // Física
        this.pos = { x: 0, y: 0 };
        this.targetPos = { x: 0, y: 0 }; // Para interpolação remota
        this.homeBase = null; // Onde renasce
        this.speed = 0.08; 
        this.currentDir = 'Down';
        
        // Stats de RPG
        this.hp = 100;
        this.maxHp = 100;
        
        this.pollen = 0;
        this.maxPollen = 100;

        this.level = 1;
        this.xp = 0;
        this.maxXp = 100; 

        this.tilesCured = 0; // Placar

        // Visual
        this.sprites = {};
        this.loadSprites();
    }

    loadSprites() {
        const directions = ['Up', 'Down', 'Left', 'Right', 'Idle', 'Fainted'];
        directions.forEach(d => {
            this.sprites[d] = new Image();
            // Tenta carregar. Se falhar, o draw() usa fallback geométrico.
            this.sprites[d].src = `assets/Bee${d}.png`;
        });
    }

    /**
     * Atualiza lógica a cada frame.
     * @param {Object} moveVector - Vetor {x, y} vindo do Input
     */
    update(moveVector) {
        if (this.isLocal) {
            // Lógica Local: Define a direção visual baseada no input
            const isMoving = moveVector.x !== 0 || moveVector.y !== 0;
            if (isMoving) {
                if (Math.abs(moveVector.x) > Math.abs(moveVector.y)) {
                    this.currentDir = moveVector.x > 0 ? 'Right' : 'Left';
                } else {
                    this.currentDir = moveVector.y > 0 ? 'Down' : 'Up';
                }
            }
            // Nota: A posição x/y real é atualizada no GameManager para verificar colisão antes.
        } else {
            // Lógica Remota: Interpolação (Suavização do Lag)
            // Move 20% da distância entre a posição atual e a alvo a cada frame
            const dist = Math.sqrt(Math.pow(this.targetPos.x - this.pos.x, 2) + Math.pow(this.targetPos.y - this.pos.y, 2));
            
            if (dist > 5) {
                // Se a distância for muito grande (lag spike), teletransporta
                this.pos.x = this.targetPos.x;
                this.pos.y = this.targetPos.y;
            } else {
                // Movimento suave (Lerp)
                this.pos.x += (this.targetPos.x - this.pos.x) * 0.2;
                this.pos.y += (this.targetPos.y - this.pos.y) * 0.2;
            }
        }
    }

    respawn() {
        this.hp = this.maxHp;
        this.pollen = 0;
        this.xp = Math.max(0, this.xp - 10); // Pequena penalidade
        this.currentDir = 'Down';
        if (this.homeBase) {
            this.pos = { ...this.homeBase };
            this.targetPos = { ...this.pos };
        }
    }

    // --- REDE ---

    /**
     * Prepara dados para enviar pela rede (Compacto)
     */
    serialize() {
        return {
            id: this.id,
            nickname: this.nickname,
            x: this.pos.x,
            y: this.pos.y,
            stats: {
                level: this.level,
                xp: this.xp,
                maxXp: this.maxXp,
                hp: this.hp,
                maxHp: this.maxHp,
                pollen: this.pollen,
                maxPollen: this.maxPollen,
                tilesCured: this.tilesCured 
            }
        };
    }

    /**
     * Recebe dados da rede e atualiza este objeto
     */
    deserialize(data) {
        if (!data) return;
        
        // Atualiza posição alvo (o update() vai mover suavemente até lá)
        if (data.x !== undefined) this.pos.x = data.x; // Ajuste imediato (Guest confia no Host)
        if (data.y !== undefined) this.pos.y = data.y;
        
        // Se for local, garante sincronia exata para não "tremer"
        if (this.isLocal) this.targetPos = { ...this.pos }; 
        else this.targetPos = { x: data.x, y: data.y };

        if (data.stats) {
            this.level = data.stats.level || 1;
            this.xp = data.stats.xp || 0;
            this.maxXp = data.stats.maxXp || 100;
            this.hp = data.stats.hp || 100;
            this.maxHp = data.stats.maxHp || 100;
            this.pollen = data.stats.pollen || 0;
            this.maxPollen = data.stats.maxPollen || 100;
            this.tilesCured = data.stats.tilesCured || 0;
        }
    }

    // --- RENDERIZAÇÃO ---
    
    draw(ctx, cam, canvas, tileSize, partyPartnerId = null) {
        // Converte posição do mundo (Grid) para Pixels na tela
        const sX = (this.pos.x - cam.x) * tileSize + canvas.width / 2;
        const sY = (this.pos.y - cam.y) * tileSize + canvas.height / 2;
        
        const isDead = this.hp <= 0;
        // Escolhe o sprite ou fallback
        let spriteKey = isDead ? 'Fainted' : (this.sprites[this.currentDir] ? this.currentDir : 'Idle');
        // Se estiver parado, usa Idle se existir
        if (!isDead && this.currentDir === 'Down') spriteKey = 'Idle'; 

        const sprite = this.sprites[spriteKey] || this.sprites['Down'];
        const zoomScale = tileSize / 32; // Ajusta tamanho baseado no zoom
        const isPartner = this.id === partyPartnerId;

        // 1. Efeito de Flutuar (Bobbing)
        const floatY = isDead ? 0 : Math.sin(Date.now() / 200) * (3 * zoomScale); 
        const drawY = sY - (12 * zoomScale) + floatY;

        // 2. Sombra no chão
        ctx.fillStyle = "rgba(0, 0, 0, 0.3)";
        ctx.beginPath();
        const shadowW = isDead ? 12 * zoomScale : 10 * zoomScale;
        ctx.ellipse(sX, sY + (8 * zoomScale), shadowW, 4 * zoomScale, 0, 0, Math.PI * 2);
        ctx.fill();

        // 3. Desenha a Abelha
        ctx.save();
        ctx.translate(sX, drawY);
        
        // Verifica se a imagem carregou
        if (sprite && sprite.complete && sprite.naturalWidth !== 0) {
            ctx.drawImage(sprite, -tileSize/2, -tileSize/2, tileSize, tileSize);
        } else {
            // FALLBACK: Desenha bolinha se não tiver imagem
            ctx.fillStyle = isDead ? "#7f8c8d" : (this.isLocal ? "#f1c40f" : "#e67e22");
            ctx.beginPath(); 
            ctx.arc(0, 0, 12 * zoomScale, 0, Math.PI*2); 
            ctx.fill();
            // Olhinhos
            ctx.fillStyle = "black";
            ctx.beginPath(); ctx.arc(-4, -2, 2, 0, Math.PI*2); ctx.fill();
            ctx.beginPath(); ctx.arc(4, -2, 2, 0, Math.PI*2); ctx.fill();
        }
        ctx.restore();

        // 4. Nickname e Level
        const nameText = isPartner ? `[PARCEIRO] ${this.nickname}` : this.nickname;
        ctx.fillStyle = isPartner ? "#2ecc71" : (isDead ? "#95a5a6" : "white"); 
        
        ctx.font = `bold ${12 * zoomScale}px sans-serif`; 
        ctx.textAlign = "center";
        
        // Borda preta no texto para ler em qualquer fundo
        ctx.strokeStyle = "black"; 
        ctx.lineWidth = 3; 
        
        const nickY = drawY - (22 * zoomScale);
        ctx.strokeText(nameText, sX, nickY); 
        ctx.fillText(nameText, sX, nickY);

        // 5. Ícone de SOS (Se for parceiro e estiver morto)
        if (isPartner && isDead) {
            const pulse = Math.abs(Math.sin(Date.now() / 300));
            ctx.font = `bold ${16 * zoomScale}px sans-serif`;
            ctx.fillStyle = `rgba(231, 76, 60, ${0.5 + pulse * 0.5})`;
            ctx.strokeStyle = "white";
            ctx.lineWidth = 1;
            
            const helpY = nickY - (20 * zoomScale);
            ctx.strokeText("🆘 SOS", sX, helpY);
            ctx.fillText("🆘 SOS", sX, helpY);
        }

        // 6. Barra de HP (Apenas para outros players - Local vê no HUD)
        if (!this.isLocal) {
            const barW = 30 * zoomScale;
            const barH = 4 * zoomScale;
            const barY = nickY - (12 * zoomScale);
            
            // Fundo
            ctx.fillStyle = "black";
            ctx.fillRect(sX - barW/2, barY, barW, barH);
            
            // Vida
            ctx.fillStyle = isPartner ? "#2ecc71" : "#e74c3c";
            const hpWidth = Math.max(0, barW * (this.hp / this.maxHp));
            ctx.fillRect(sX - barW/2, barY, hpWidth, barH);
        }
    }
}
