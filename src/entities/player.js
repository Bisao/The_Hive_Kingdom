export class Player {
    constructor(id, nickname, isLocal = false) {
        this.id = id;
        this.nickname = nickname;
        this.isLocal = isLocal;
        
        this.pos = { x: 0, y: 0 };
        this.targetPos = { x: 0, y: 0 };
        this.homeBase = null; 
        this.speed = 0.06; 
        this.currentDir = 'Down';
        
        // --- SISTEMA DE RPG ---
        this.hp = 100;
        this.maxHp = 100;
        
        this.pollen = 0;
        this.maxPollen = 100;

        this.level = 1;
        this.xp = 0;
        this.maxXp = 100; 

        this.tilesCured = 0;

        // Assets
        this.sprites = {};
        ['Up', 'Down', 'Left', 'Right', 'Idle', 'LeftIdle', 'RightIdle', 'Fainted'].forEach(d => {
            this.sprites[d] = new Image();
            this.sprites[d].src = `assets/Bee${d}.png`;
        });
    }

    /**
     * Atualiza a posição e estado da animação.
     * @param {Object} moveVector - {x, y} normalizado vindo do InputHandler
     */
    update(moveVector) {
        if (this.isLocal) {
            // Lógica Local: Define a direção baseada no input
            const isMoving = moveVector.x !== 0 || moveVector.y !== 0;
            if (isMoving) {
                if (Math.abs(moveVector.x) > Math.abs(moveVector.y)) {
                    this.currentDir = moveVector.x > 0 ? 'Right' : 'Left';
                } else {
                    this.currentDir = moveVector.y > 0 ? 'Down' : 'Up';
                }
            } else {
                // Estado Idle baseado na última direção
                if(this.currentDir === 'Left') this.currentDir = 'LeftIdle';
                else if(this.currentDir === 'Right') this.currentDir = 'RightIdle';
                else if(this.currentDir === 'Up' || this.currentDir === 'Down') this.currentDir = 'Idle';
            }
            // Nota: A atualização real de posição (x += speed) acontece no GameManager
            // para permitir controle de colisão e rede antes de aplicar.
        } else {
            // Lógica Remota: Interpolação suave
            const dist = Math.sqrt(Math.pow(this.targetPos.x - this.pos.x, 2) + Math.pow(this.targetPos.y - this.pos.y, 2));
            if (dist > 5) {
                // Teleporte se o lag for muito grande
                this.pos.x = this.targetPos.x;
                this.pos.y = this.targetPos.y;
            } else {
                // Suavização (Lerp)
                this.pos.x += (this.targetPos.x - this.pos.x) * 0.2;
                this.pos.y += (this.targetPos.y - this.pos.y) * 0.2;
            }
        }
    }

    respawn() {
        this.hp = this.maxHp;
        this.pollen = 0;
        this.xp = Math.floor(this.xp / 2); // Penalidade
        this.currentDir = 'Down';
        if (this.homeBase) {
            this.pos = { ...this.homeBase };
            this.targetPos = { ...this.pos };
        }
    }

    // --- SERIALIZAÇÃO (REDE/SAVE) ---

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

    deserialize(data) {
        if (!data) return;
        if (data.x !== undefined) this.pos.x = data.x;
        if (data.y !== undefined) this.pos.y = data.y;
        
        // Se for local, atualiza o target também para evitar 'pulos' na interpolação
        if (this.isLocal) this.targetPos = { ...this.pos }; 

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
        const sX = (this.pos.x - cam.x) * tileSize + canvas.width / 2;
        const sY = (this.pos.y - cam.y) * tileSize + canvas.height / 2;
        
        const isDead = this.hp <= 0;
        const sprite = isDead ? (this.sprites['Fainted'] || this.sprites['Idle']) : (this.sprites[this.currentDir] || this.sprites['Idle']);
        const zoomScale = tileSize / 32;
        const isPartner = this.id === partyPartnerId;

        // 1. Balanço (Bobbing)
        const floatY = isDead ? 0 : Math.sin(Date.now() / 200) * (3 * zoomScale); 
        const drawY = sY - (12 * zoomScale) + floatY;

        // 2. Sombra
        ctx.fillStyle = "rgba(0, 0, 0, 0.3)";
        ctx.beginPath();
        const shadowW = isDead ? 12 * zoomScale : 10 * zoomScale;
        ctx.ellipse(sX, sY + (8 * zoomScale), shadowW, 4 * zoomScale, 0, 0, Math.PI * 2);
        ctx.fill();

        // 3. Sprite
        ctx.save();
        ctx.translate(sX, drawY);
        if (isDead) ctx.rotate(Math.PI / 2);
        
        if (sprite.complete && sprite.naturalWidth !== 0) {
            ctx.drawImage(sprite, -tileSize/2, -tileSize/2, tileSize, tileSize);
        } else {
            // Fallback (Bolinha Amarela) se a imagem falhar
            ctx.fillStyle = isDead ? "gray" : "yellow";
            ctx.beginPath(); ctx.arc(0, 0, 10 * zoomScale, 0, Math.PI*2); ctx.fill();
        }
        ctx.restore();

        // 4. Nickname e Level
        const nameText = isPartner ? `[GROUP] ${this.nickname}` : this.nickname;
        ctx.fillStyle = isPartner ? "#f1c40f" : (isDead ? "#666" : "white"); 
        
        ctx.font = `bold ${12 * zoomScale}px sans-serif`; 
        ctx.textAlign = "center";
        ctx.strokeStyle = "black"; 
        ctx.lineWidth = 3; 
        
        const nickY = drawY - (20 * zoomScale);
        ctx.strokeText(nameText, sX, nickY); 
        ctx.fillText(nameText, sX, nickY);

        // 5. Alerta de Resgate (Para parceiros)
        if (isPartner && isDead) {
            const pulse = Math.abs(Math.sin(Date.now() / 300));
            ctx.font = `bold ${14 * zoomScale}px sans-serif`;
            ctx.fillStyle = `rgba(46, 204, 113, ${0.5 + pulse * 0.5})`;
            ctx.strokeStyle = "black";
            
            const helpY = nickY - (25 * zoomScale);
            ctx.strokeText("🆘 RESGATE!", sX, helpY);
            ctx.fillText("🆘 RESGATE!", sX, helpY);
        }

        // 6. Barra de HP (Apenas para outros players)
        if (!this.isLocal) {
            const barW = 30 * zoomScale;
            const barH = 4 * zoomScale;
            const barY = nickY - (12 * zoomScale);
            
            ctx.fillStyle = "black";
            ctx.fillRect(sX - barW/2, barY, barW, barH);
            
            ctx.fillStyle = isPartner ? "#2ecc71" : "#e74c3c";
            const hpWidth = Math.max(0, barW * (this.hp / this.maxHp));
            ctx.fillRect(sX - barW/2, barY, hpWidth, barH);
        }
    }
}
