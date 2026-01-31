export class Ant {
    constructor(id, x, y, type = 'worker') {
        this.id = id;
        this.spawnPos = { x: x, y: y }; // Ponto de origem para patrulha
        this.x = x;
        this.y = y;
        this.type = type; // 'worker' ou 'soldier'
        
        // Atributos de IA (Comportamento)
        this.state = 'PATROL'; // Estados: PATROL, CHASE, RETURN
        this.patrolTarget = { x: x, y: y };
        this.patrolTimer = 0;
        this.detectionRange = 7; // Raio para começar a perseguir
        this.giveUpRange = 13;   // Raio para desistir e voltar pra casa
        this.returnThreshold = 0.5; // Distância para considerar que chegou em casa

        // Atributos de Combate
        this.hp = type === 'soldier' ? 60 : 30;
        this.maxHp = this.hp;
        this.damage = type === 'soldier' ? 10 : 5;
        this.speed = type === 'soldier' ? 0.03 : 0.045; // Ajustado para ser levemente mais lento na patrulha
        
        // Física
        this.radius = 0.4; // Tamanho da Hitbox
        this.angle = Math.random() * Math.PI * 2; // Começa olhando para lado aleatório
        
        // Visual
        this.wobble = Math.random() * 100; // Variação inicial para animação
        this.sprite = new Image();
        this.sprite.src = type === 'soldier' ? 'assets/AntSoldier.png' : 'assets/Ant.png';
        
        // Estado de alvo
        this.targetId = null;
    }

    /**
     * Atualiza a IA da formiga com Máquina de Estados.
     * @param {Array} players - Lista de jogadores
     * @param {Object} world - Referência ao gerador de mundo (para checar bioma original)
     * @param {Object} worldState - Referência ao estado dinâmico (para checar tiles modificados)
     */
    update(players, world, worldState) {
        if (this.hp <= 0) return;

        // 1. Dano Ambiental (Bioma Seguro queima a formiga)
        // Precisamos arredondar para pegar o tile exato
        const tx = Math.round(this.x);
        const ty = Math.round(this.y);
        // Verifica primeiro se o tile foi modificado pelo jogador, senão pega do mundo base
        const currentTile = (worldState && worldState.getModifiedTile(tx, ty)) || (world && world.getTileAt(tx, ty));
        
        if (['GRAMA', 'GRAMA_SAFE', 'FLOR', 'BROTO', 'MUDA'].includes(currentTile)) {
            this.hp -= 0.15; // Dano por tick ao estar em área purificada
        }

        // 2. Percepção (Encontrar jogador mais próximo)
        const perception = this.getNearestPlayer(players);
        const nearestPlayer = perception.player;
        const distToPlayer = perception.dist;

        // 3. Transição de Estados (State Machine)
        switch (this.state) {
            case 'PATROL':
                // Se viu um player perto, começa a caçar
                if (nearestPlayer && distToPlayer < this.detectionRange) {
                    this.state = 'CHASE';
                }
                this.doPatrol();
                break;

            case 'CHASE':
                // Se o player morreu ou fugiu muito longe, volta pra casa
                if (!nearestPlayer || distToPlayer > this.giveUpRange) {
                    this.state = 'RETURN';
                    this.targetId = null;
                } else {
                    this.doChase(nearestPlayer);
                }
                break;

            case 'RETURN':
                // Se enquanto volta, o player chega MUITO perto de novo, volta a atacar
                if (nearestPlayer && distToPlayer < (this.detectionRange / 2)) {
                    this.state = 'CHASE';
                } else {
                    this.doReturn();
                }
                break;
        }

        // Atualiza animação das pernas
        this.wobble += (this.state === 'CHASE' ? 0.4 : 0.2); // Anima mais rápido se estiver correndo
    }

    // --- COMPORTAMENTOS ---

    getNearestPlayer(players) {
        let nearest = null;
        let minDist = Infinity;

        players.forEach(p => {
            if (p.hp > 0) { // Só liga para players vivos
                const dx = p.pos.x - this.x;
                const dy = p.pos.y - this.y;
                const dist = Math.sqrt(dx*dx + dy*dy);
                
                if (dist < minDist) {
                    minDist = dist;
                    nearest = p;
                }
            }
        });
        return { player: nearest, dist: minDist };
    }

    doPatrol() {
        // Se o timer zerou, escolhe um novo ponto aleatório perto do spawn
        if (this.patrolTimer <= 0) {
            const angle = Math.random() * Math.PI * 2;
            const dist = Math.random() * 5; // Raio de patrulha de 5 tiles
            this.patrolTarget = {
                x: this.spawnPos.x + Math.cos(angle) * dist,
                y: this.spawnPos.y + Math.sin(angle) * dist
            };
            // Espera entre 2 a 5 segundos (60fps * segundos) antes de mudar de novo
            this.patrolTimer = 120 + Math.random() * 180;
        }

        this.moveTo(this.patrolTarget.x, this.patrolTarget.y, this.speed * 0.5); // Anda devagar na patrulha
        this.patrolTimer--;
    }

    doChase(target) {
        this.targetId = target.id;
        // Persegue na velocidade máxima
        this.moveTo(target.pos.x, target.pos.y, this.speed);
    }

    doReturn() {
        const distToSpawn = Math.sqrt(Math.pow(this.x - this.spawnPos.x, 2) + Math.pow(this.y - this.spawnPos.y, 2));
        
        if (distToSpawn < this.returnThreshold) {
            this.state = 'PATROL'; // Chegou em casa, volta a patrulhar
        } else {
            this.moveTo(this.spawnPos.x, this.spawnPos.y, this.speed); // Volta correndo
        }
    }

    moveTo(tx, ty, speed) {
        const dx = tx - this.x;
        const dy = ty - this.y;
        const dist = Math.sqrt(dx*dx + dy*dy);

        if (dist > 0.1) {
            this.angle = Math.atan2(dy, dx);
            this.x += (dx / dist) * speed;
            this.y += (dy / dist) * speed;
        }
    }

    draw(ctx, cam, canvas, tileSize) {
        if (this.hp <= 0) return;

        const sX = (this.x - cam.x) * tileSize + canvas.width / 2;
        const sY = (this.y - cam.y) * tileSize + canvas.height / 2;
        const zoomScale = tileSize / 32;

        // Se estiver fora da tela, não desenha (Otimização)
        if (sX < -50 || sX > canvas.width + 50 || sY < -50 || sY > canvas.height + 50) return;

        ctx.save();
        ctx.translate(sX, sY);
        
        // Rotação baseada no ângulo de movimento (+90 graus porque o sprite geralmente aponta pra cima)
        ctx.rotate(this.angle + Math.PI / 2);

        // Desenha Sprite ou Fallback Procedural
        if (this.sprite.complete && this.sprite.naturalWidth !== 0) {
            const size = (this.type === 'soldier' ? 40 : 32) * zoomScale;
            
            // Efeito de oscilação ao andar (simula passos)
            const walkWobble = Math.sin(this.wobble) * (2 * zoomScale);
            
            ctx.drawImage(this.sprite, -size/2 + walkWobble, -size/2, size, size);
        } else {
            // --- DESENHO PROCEDURAL (Caso a imagem não carregue) ---
            // Corpo
            // Muda a cor se estiver em CHASE (Agressivo)
            const baseColor = this.type === 'soldier' ? "#8B0000" : "#2c3e50";
            const alertColor = "#e74c3c"; // Vermelho vivo se estiver perseguindo
            
            ctx.fillStyle = (this.state === 'CHASE') ? alertColor : baseColor;
            
            ctx.beginPath();
            ctx.ellipse(0, 0, 8 * zoomScale, 12 * zoomScale, 0, 0, Math.PI * 2);
            ctx.fill();
            
            // Cabeça
            ctx.beginPath();
            ctx.arc(0, -10 * zoomScale, 6 * zoomScale, 0, Math.PI * 2);
            ctx.fill();

            // Pernas (Animadas)
            ctx.strokeStyle = "black";
            ctx.lineWidth = 2;
            const legOffset = Math.sin(this.wobble) * 3;
            
            ctx.beginPath();
            // Esq
            ctx.moveTo(-5 * zoomScale, -5 * zoomScale); ctx.lineTo((-12 + legOffset) * zoomScale, -8 * zoomScale);
            ctx.moveTo(-5 * zoomScale, 0); ctx.lineTo((-12 - legOffset) * zoomScale, 0);
            ctx.moveTo(-5 * zoomScale, 5 * zoomScale); ctx.lineTo((-12 + legOffset) * zoomScale, 8 * zoomScale);
            // Dir
            ctx.moveTo(5 * zoomScale, -5 * zoomScale); ctx.lineTo((12 - legOffset) * zoomScale, -8 * zoomScale);
            ctx.moveTo(5 * zoomScale, 0); ctx.lineTo((12 + legOffset) * zoomScale, 0);
            ctx.moveTo(5 * zoomScale, 5 * zoomScale); ctx.lineTo((12 - legOffset) * zoomScale, 8 * zoomScale);
            ctx.stroke();
        }

        ctx.restore();

        // [NOVO] Indicador de Estado (Exclamação quando detecta player)
        if (this.state === 'CHASE') {
            ctx.fillStyle = "#e74c3c";
            ctx.font = `bold ${20 * zoomScale}px Arial`;
            ctx.textAlign = "center";
            ctx.fillText("!", sX, sY - (30 * zoomScale));
        }

        // --- BARRA DE VIDA (HP) ---
        // Desenhado após o restore() para não girar junto com a formiga
        if (this.hp < this.maxHp) {
            const barW = 24 * zoomScale;
            const barH = 4 * zoomScale;
            const barY = sY - (25 * zoomScale);

            ctx.fillStyle = "black";
            ctx.fillRect(sX - barW/2, barY, barW, barH);
            
            ctx.fillStyle = "#e74c3c"; // Vermelho
            ctx.fillRect(sX - barW/2, barY, Math.max(0, barW * (this.hp / this.maxHp)), barH);
        }
    }
}
