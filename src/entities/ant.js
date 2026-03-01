import { WaveEffect } from '../entities/WaveEffect.js';

export class Ant {
    constructor(id, x, y, type = 'hunter') {
        this.id = id;
        this.x = x;
        this.y = y;
        this.type = type; // 'hunter' (Caçadora) ou 'invader' (Invasora)
        this.isInvader = (type === 'invader'); // Cache booleano para checagens rápidas
        
        // Atributos baseados na Classe da Formiga (AJUSTADOS PARA VELOCIDADE DA ABELHA)
        if (this.isInvader) {
            this.hp = 100;          // Tanque (Muita vida)
            this.damage = 15;       // Bate muito forte na colmeia/player
            this.speed = 0.12;      // Aumentado: Antes 0.02, agora acompanha abelhas base
        } else {
            // 'hunter' (Padrão)
            this.hp = 40;           // Frágil
            this.damage = 5;        // Dano rápido e leve
            this.speed = 0.15;      // Aumentado: Antes 0.05, agora tão rápida quanto abelhas rápidas
        }
        
        this.maxHp = this.hp;
        
        // Atributos de IA e Estado
        this.state = 'CHASE_PLAYER'; // Estados: CHASE_PLAYER, CHASE_HIVE, DESTROY_TILE
        this.targetId = null;
        this.destroyTimer = 0; // Tempo gasto destruindo um bloco protegido
        
        // Física e Animação
        this.radius = 0.4;
        this.angle = Math.random() * Math.PI * 2;
        this.wobble = Math.random() * 100;
        this.wobbleInc = this.isInvader ? 0.2 : 0.4; // Cache de incremento de animação
        
        // [OTIMIZAÇÃO] Cache de propriedades visuais procedurais (Evita recalcular 60x por segundo)
        this.visuals = {
            baseColor: this.isInvader ? "#2c3e50" : "#e74c3c",
            legColor: this.isInvader ? "#1a252f" : "#c0392b",
            legWidth: this.isInvader ? 3 : 2,
            bodyWidth: this.isInvader ? 10 : 6,
            bodyHeight: this.isInvader ? 14 : 10,
            headSize: this.isInvader ? 8 : 5,
            hpColor: this.isInvader ? "#8e44ad" : "#e74c3c",
            spriteSize: this.isInvader ? 42 : 30,
            hpBarOffset: this.isInvader ? 30 : 25
        };
        
        // Sprites
        this.sprite = new Image();
        this.sprite.src = this.isInvader ? 'assets/AntTank.png' : 'assets/AntHunter.png';
    }

    /**
     * Atualiza a IA da formiga focada na Horda.
     * @param {Array} players - Lista de jogadores
     * @param {Object} world - Referência ao gerador de mundo (para achar a colmeia)
     * @param {Object} worldState - Referência ao estado dinâmico (para checar tiles modificados)
     */
    update(players, world, worldState) {
        if (this.hp <= 0) return;

        // Posição no Grid (usando Math.floor que é marginalmente mais rápido e seguro para grids do que round)
        const tx = Math.floor(this.x);
        const ty = Math.floor(this.y);
        const currentTile = (worldState && worldState.getModifiedTile(tx, ty)) || (world && world.getTileAt(tx, ty));
        
        const isSafeTile = currentTile === 'GRAMA' || currentTile === 'GRAMA_SAFE' || 
                           currentTile === 'FLOR' || currentTile === 'BROTO' || currentTile === 'MUDA';

        // 1. Dano Ambiental vs Destruição de Terreno
        if (isSafeTile) {
            if (!this.isInvader) {
                // Caçadoras odeiam a vida e tomam dano ao pisar na grama sagrada
                this.hp -= 0.15;
            } else {
                // Invasoras são imunes e DESTRÓIEM a grama
                this.state = 'DESTROY_TILE';
                this.destroyTimer++;
                
                // Leva cerca de 1.5 segundos (90 frames) para destruir um bloco
                if (this.destroyTimer >= 90) {
                    this.destroyTimer = 0;
                    if (worldState) {
                        // Transforma o chão de volta em Terra Queimada
                        worldState.setTile(tx, ty, 'TERRA_QUEIMADA');
                    }
                }
                // Se está destruindo, não anda!
                this.wobble += 0.5; // Balança rápido como se estivesse cavando/mordendo
                return; 
            }
        } else {
            this.destroyTimer = 0; // Reseta se saiu do bloco seguro
        }

        // 2. Tomada de Decisão (Encontrar Alvo)
        let targetPos = null;

        if (!this.isInvader) {
            // Caçadora: Foca na abelha viva mais próxima
            const nearestP = this.getNearestAlivePlayer(players);
            if (nearestP) {
                targetPos = nearestP.pos;
                this.state = 'CHASE_PLAYER';
                this.targetId = nearestP.id;
            } else {
                // Se não tem abelhas vivas (todas desmaiaram), vira o foco para a Colmeia
                const nearestH = this.getNearestHive(world);
                if (nearestH) {
                    targetPos = nearestH;
                    this.state = 'CHASE_HIVE';
                }
            }
        } else {
            // Invasora: Ignora as abelhas, foca 100% na destruição da Colmeia
            const nearestH = this.getNearestHive(world);
            if (nearestH) {
                targetPos = nearestH;
                this.state = 'CHASE_HIVE';
            }
        }

        // 3. Movimento Implacável
        if (targetPos) {
            this.moveTo(targetPos.x, targetPos.y, this.speed);
        }

        // Atualiza animação das pernas usando o cache de velocidade
        this.wobble += this.wobbleInc;
    }

    // --- MÉTODOS DE BUSCA (Otimizados) ---

    getNearestAlivePlayer(players) {
        let nearest = null;
        let minDistSq = Infinity; // Trabalhamos com distância ao quadrado

        for (let i = 0; i < players.length; i++) {
            const p = players[i];
            if (p.hp > 0) { // Só persegue quem está vivo/voando
                const dx = p.pos.x - this.x;
                const dy = p.pos.y - this.y;
                const distSq = (dx * dx) + (dy * dy); // Sem Math.sqrt (Muito mais rápido)
                
                if (distSq < minDistSq) {
                    minDistSq = distSq;
                    nearest = p;
                }
            }
        }
        return nearest;
    }

    getNearestHive(world) {
        if (!world || typeof world.getHiveLocations !== 'function') return null;
        
        const hives = world.getHiveLocations();
        let nearest = null;
        let minDistSq = Infinity;

        for (let i = 0; i < hives.length; i++) {
            const h = hives[i];
            const dx = h.x - this.x;
            const dy = h.y - this.y;
            const distSq = (dx * dx) + (dy * dy); // Sem Math.sqrt
            
            if (distSq < minDistSq) {
                minDistSq = distSq;
                nearest = h;
            }
        }
        return nearest;
    }

    // --- MÉTODOS DE MOVIMENTO E RENDERIZAÇÃO ---

    moveTo(tx, ty, speed) {
        const dx = tx - this.x;
        const dy = ty - this.y;
        const distSq = (dx * dx) + (dy * dy);

        // Só normaliza e move se a distância for maior que 0.1 blocos (0.01 quadrado)
        if (distSq > 0.01) {
            const dist = Math.sqrt(distSq); // A única raiz quadrada que sobrou (necessária pra mover perfeitamente)
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

        // Culling (Otimização): Não desenha se estiver muito fora da tela
        if (sX < -50 || sX > canvas.width + 50 || sY < -50 || sY > canvas.height + 50) return;

        ctx.save();
        ctx.translate(sX, sY);
        
        // Rotação baseada no ângulo de movimento (+90 graus porque o corpo aponta pra cima)
        ctx.rotate(this.angle + Math.PI / 2);

        // Desenha Sprite ou Fallback Procedural
        if (this.sprite.complete && this.sprite.naturalWidth !== 0) {
            const size = this.visuals.spriteSize * zoomScale;
            
            // Efeito de oscilação ao andar (simula passos) ou cavar
            const walkWobble = Math.sin(this.wobble) * (2 * zoomScale);
            
            ctx.drawImage(this.sprite, -size/2 + walkWobble, -size/2, size, size);
        } else {
            // --- DESENHO PROCEDURAL PARA AS DUAS CLASSES (Otimizado) ---
            ctx.fillStyle = this.visuals.baseColor;
            
            // Corpo
            ctx.beginPath();
            ctx.ellipse(0, 0, this.visuals.bodyWidth * zoomScale, this.visuals.bodyHeight * zoomScale, 0, 0, Math.PI * 2);
            ctx.fill();
            
            // Cabeça
            ctx.beginPath();
            ctx.arc(0, -12 * zoomScale, this.visuals.headSize * zoomScale, 0, Math.PI * 2);
            ctx.fill();

            // Pernas (Animadas)
            ctx.strokeStyle = this.visuals.legColor;
            ctx.lineWidth = this.visuals.legWidth;
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

            // Mandíbulas grandes para a Invasora (Destruidora de terreno)
            if (this.isInvader) {
                ctx.strokeStyle = "#95a5a6";
                ctx.beginPath();
                ctx.moveTo(-3 * zoomScale, -18 * zoomScale); ctx.lineTo(-6 * zoomScale, -24 * zoomScale);
                ctx.moveTo(3 * zoomScale, -18 * zoomScale); ctx.lineTo(6 * zoomScale, -24 * zoomScale);
                ctx.stroke();
            }
        }

        ctx.restore();

        // Feedback Visual: Se a invasora estiver destruindo o chão
        if (this.state === 'DESTROY_TILE') {
            ctx.fillStyle = "#f39c12"; // Laranja poeira
            ctx.font = `bold ${16 * zoomScale}px Arial`;
            ctx.textAlign = "center";
            // Pontinhos piscando para indicar que está "cavando"
            const dots = ".".repeat(Math.floor(this.destroyTimer / 30) % 4);
            ctx.fillText(`Mnh${dots}`, sX, sY - (30 * zoomScale));
        }

        // --- BARRA DE VIDA (HP) ---
        if (this.hp < this.maxHp) {
            const barW = 24 * zoomScale;
            const barH = 4 * zoomScale;
            const barY = sY - (this.visuals.hpBarOffset * zoomScale);

            ctx.fillStyle = "black";
            ctx.fillRect(sX - barW/2, barY, barW, barH);
            
            ctx.fillStyle = this.visuals.hpColor;
            ctx.fillRect(sX - barW/2, barY, Math.max(0, barW * (this.hp / this.maxHp)), barH);
        }
    }
}
