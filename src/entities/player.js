export class Player {
    constructor(id, nickname, isLocal = false) {
        this.id = id;
        this.nickname = nickname;
        this.isLocal = isLocal;
        
        this.pos = { x: 0, y: 0 };
        this.targetPos = { x: 0, y: 0 };
        this.homeBase = { x: 0, y: 0 }; 
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

        // Controle de latência e limpeza
        this.lastUpdate = Date.now();

        // COR ÚNICA: Gera uma cor baseada no nome do jogador
        this.color = this.generateColor(nickname);

        this.sprites = {};
        ['Up', 'Down', 'Left', 'Right', 'Idle', 'LeftIdle', 'RightIdle', 'Fainted'].forEach(d => {
            this.sprites[d] = new Image();
            this.sprites[d].src = `assets/Bee${d}.png`;
        });
    }

    generateColor(str) {
        let hash = 0;
        for (let i = 0; i < str.length; i++) {
            hash = str.charCodeAt(i) + ((hash << 5) - hash);
        }
        return `hsl(${Math.abs(hash) % 360}, 85%, 65%)`;
    }

    update(moveVector) {
        if (this.isLocal) {
            // Lógica Local: Define a direção baseada no vetor de entrada
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
            // LÓGICA REMOTA: Move this.pos em direção a this.targetPos continuamente
            const dx = this.targetPos.x - this.pos.x;
            const dy = this.targetPos.y - this.pos.y;
            const dist = Math.sqrt(dx * dx + dy * dy);

            // Se a distância for muito grande (teleporte/lag pesado), pula direto
            if (dist > 5) {
                this.pos.x = this.targetPos.x;
                this.pos.y = this.targetPos.y;
            } else if (dist > 0.001) {
                // Interpolação Linear (Lerp) para movimento suave
                // O valor 0.15 garante que a abelha "deslize" suavemente
                this.pos.x += dx * 0.15;
                this.pos.y += dy * 0.15;
            }

            // Define a direção visual do player remoto baseado no movimento
            if (dist > 0.01) {
                if (Math.abs(dx) > Math.abs(dy)) {
                    this.currentDir = dx > 0 ? 'Right' : 'Left';
                } else {
                    this.currentDir = dy > 0 ? 'Down' : 'Up';
                }
            } else {
                // Estado de espera para remotos
                if(this.currentDir === 'Left') this.currentDir = 'LeftIdle';
                else if(this.currentDir === 'Right') this.currentDir = 'RightIdle';
                else if(['Up', 'Down', 'Left', 'Right'].includes(this.currentDir)) this.currentDir = 'Idle';
            }
        }
    }

    respawn() {
        this.hp = this.maxHp;
        this.pollen = 0;
        this.xp = Math.floor(this.xp / 2); 
        this.currentDir = 'Down';
        if (this.homeBase) {
            this.pos = { ...this.homeBase };
            this.targetPos = { ...this.pos };
        }
    }

    serialize() {
        return {
            id: this.id,
            nickname: this.nickname,
            x: this.pos.x,
            y: this.pos.y,
            dir: this.currentDir,
            stats: {
                level: this.level,
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
        this.lastUpdate = Date.now(); // Marca que recebemos dados novos

        if (data.x !== undefined) this.targetPos.x = data.x;
        if (data.y !== undefined) this.targetPos.y = data.y;
        
        // Se for o player local, a posição é absoluta (teclado/joystick manda)
        if (this.isLocal) {
            this.pos.x = data.x;
            this.pos.y = data.y;
            this.targetPos = { ...this.pos }; 
        }

        if (data.dir) this.currentDir = data.dir;

        if (data.stats) {
            this.level = data.stats.level || this.level;
            this.hp = data.stats.hp !== undefined ? data.stats.hp : this.hp;
            this.maxHp = data.stats.maxHp || this.maxHp;
            this.pollen = data.stats.pollen !== undefined ? data.stats.pollen : this.pollen;
            this.maxPollen = data.stats.maxPollen || this.maxPollen;
            this.tilesCured = data.stats.tilesCured || this.tilesCured;
        }
    }

    draw(ctx, cam, canvas, tileSize, remotePlayers = {}, partyMemberIds = [], partyIcon = "") {
        const sX = (this.pos.x - cam.x) * tileSize + canvas.width / 2;
        const sY = (this.pos.y - cam.y) * tileSize + canvas.height / 2;
        
        const isDead = this.hp <= 0;
        const sprite = isDead ? (this.sprites['Fainted'] || this.sprites['Idle']) : (this.sprites[this.currentDir] || this.sprites['Idle']);
        const zoomScale = tileSize / 32;
        
        const isPartner = Array.isArray(partyMemberIds) ? partyMemberIds.includes(this.id) : this.id === partyMemberIds;

        // BÚSSOLA DE MULTI-PARTY
        if (this.isLocal && Array.isArray(partyMemberIds) && partyMemberIds.length > 0) {
            partyMemberIds.forEach(memberId => {
                const partner = remotePlayers[memberId];
                if (partner && partner.id !== this.id) {
                    const dx = partner.pos.x - this.pos.x;
                    const dy = partner.pos.y - this.pos.y;
                    const dist = Math.sqrt(dx*dx + dy*dy);

                    if (dist > 5) {
                        const angle = Math.atan2(dy, dx);
                        const orbitRadius = 45 * zoomScale; 
                        const arrowX = sX + Math.cos(angle) * orbitRadius;
                        const arrowY = sY + Math.sin(angle) * orbitRadius;

                        ctx.save();
                        ctx.translate(arrowX, arrowY);
                        ctx.rotate(angle);
                        ctx.fillStyle = partner.color; 
                        ctx.shadowBlur = 10;
                        ctx.shadowColor = partner.color;
                        
                        ctx.beginPath();
                        ctx.moveTo(8 * zoomScale, 0);
                        ctx.lineTo(-6 * zoomScale, -6 * zoomScale);
                        ctx.lineTo(-3 * zoomScale, 0);
                        ctx.lineTo(-6 * zoomScale, 6 * zoomScale);
                        ctx.closePath();
                        ctx.fill();
                        ctx.restore();
                    }
                }
            });
        }

        const floatY = isDead ? 0 : Math.sin(Date.now() / 200) * (3 * zoomScale); 
        const drawY = sY - (12 * zoomScale) + floatY;

        ctx.fillStyle = "rgba(0, 0, 0, 0.3)";
        ctx.beginPath();
        ctx.ellipse(sX, sY + (8 * zoomScale), (isDead ? 12 : 10) * zoomScale, 4 * zoomScale, 0, 0, Math.PI * 2);
        ctx.fill();

        ctx.save();
        ctx.translate(sX, drawY);
        if (isDead) ctx.rotate(Math.PI / 2);
        
        if (sprite.complete && sprite.naturalWidth !== 0) {
            ctx.drawImage(sprite, -tileSize/2, -tileSize/2, tileSize, tileSize);
        } else {
            ctx.fillStyle = isDead ? "gray" : (this.color || "yellow");
            ctx.beginPath(); ctx.arc(0, 0, 10 * zoomScale, 0, Math.PI*2); ctx.fill();
        }
        ctx.restore();

        const iconDisplay = (isPartner && partyIcon) ? partyIcon : (isPartner ? "🛡️" : "");
        const nameText = isPartner ? `${iconDisplay} ${this.nickname}` : this.nickname;

        ctx.fillStyle = isDead ? "#666" : this.color; 
        ctx.font = `bold ${12 * zoomScale}px sans-serif`; 
        ctx.textAlign = "center";
        ctx.strokeStyle = "black"; 
        ctx.lineWidth = 3; 
        
        const nickY = drawY - (20 * zoomScale);
        ctx.strokeText(nameText, sX, nickY); 
        ctx.fillText(nameText, sX, nickY);

        if (!this.isLocal) {
            const barW = 30 * zoomScale;
            const barH = 4 * zoomScale;
            const barY = nickY - (12 * zoomScale);
            ctx.fillStyle = "black";
            ctx.fillRect(sX - barW/2, barY, barW, barH);
            ctx.fillStyle = isPartner ? "#2ecc71" : "#e74c3c";
            ctx.fillRect(sX - barW/2, barY, Math.max(0, barW * (this.hp / this.maxHp)), barH);
        }

        if (isPartner && isDead) {
            const pulse = Math.abs(Math.sin(Date.now() / 300));
            ctx.font = `bold ${11 * zoomScale}px sans-serif`;
            ctx.fillStyle = `rgba(46, 204, 113, ${0.5 + pulse * 0.5})`;
            ctx.strokeText("🆘 RESGATE!", sX, nickY - (25 * zoomScale));
            ctx.fillText("🆘 RESGATE!", sX, nickY - (25 * zoomScale));
        }
    }
}
