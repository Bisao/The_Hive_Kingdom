import { Ant } from '../entities/ant.js';
import { WaveEffect } from '../entities/WaveEffect.js';

export class HostSimulation {
    constructor(world, worldState, net) {
        this.world = world;
        this.worldState = worldState;
        this.net = net;

        this.hiveWaveTick = 0;
        this.hordeSpawnTick = 0;
        this.hordeWarningSent = false;
        this.simulationInterval = null;

        // Tempo de início fixo do jogo para calcular os Dias corretamente
        this.START_TIME = new Date('2074-02-09T06:00:00').getTime();

        // Constantes de Simulação
        this.GROWTH_TIMES = { BROTO: 5000, MUDA: 10000, FLOR: 15000 };
        this.FLOWER_COOLDOWN_TIME = 10000;
        this.XP_PASSIVE_CURE = 5;
    }

    /**
     * Inicia o loop de simulação do Host
     */
    start(refs) {
        if (this.simulationInterval) clearInterval(this.simulationInterval);

        this.simulationInterval = setInterval(() => {
            this.update(refs);
        }, 1000); // Roda a cada 1 segundo real (1 minuto no jogo)
    }

    stop() {
        if (this.simulationInterval) {
            clearInterval(this.simulationInterval);
            this.simulationInterval = null;
        }
    }

    /**
     * Função auxiliar para spawnar uma formiga da horda
     */
    _spawnHordeAnt(target, enemies) {
        // Tenta achar um espaço de terra queimada próximo ao jogador, mas não tão perto (15 a 25 blocos)
        for (let i = 0; i < 10; i++) {
            const angle = Math.random() * Math.PI * 2;
            const dist = 15 + Math.random() * 10; 
            const spawnX = target.pos.x + Math.cos(angle) * dist;
            const spawnY = target.pos.y + Math.sin(angle) * dist;
            
            const tileX = Math.floor(spawnX);
            const tileY = Math.floor(spawnY);
            const tile = this.worldState.getModifiedTile(tileX, tileY) || this.world.getTileAt(tileX, tileY);
            
            if (tile === 'TERRA_QUEIMADA') {
                // 50% de chance de ser Caçadora (hunter) ou Invasora (invader)
                const antClass = Math.random() < 0.5 ? 'hunter' : 'invader';
                const enemyId = `ant_${Date.now()}_${Math.floor(Math.random() * 1000)}`;
                
                enemies.push(new Ant(enemyId, spawnX, spawnY, antClass));
                this.net.sendPayload({ type: 'SPAWN_ENEMY', id: enemyId, x: spawnX, y: spawnY, type: antClass });
                break; // Spawna apenas 1 por chamada com sucesso
            }
        }
    }

    update(refs) {
        const { 
            localPlayer, remotePlayers, enemies, activeWaves, 
            hiveRegistry, guestDataDB, 
            fnChangeTile, fnSaveProgress, fnGainXp 
        } = refs;

        // 1. Passagem de Tempo
        this.worldState.worldTime += 60000; // +1 minuto por tick
        this.net.sendPayload({ type: 'TIME_SYNC', time: this.worldState.worldTime });

        let changed = false;
        const now = Date.now();

        // --- SISTEMA DE HORDA (A CADA 7 DIAS) ---
        const elapsedMs = this.worldState.worldTime - this.START_TIME;
        const currentDay = Math.floor(elapsedMs / 86400000) + 1; // 1 dia = 86.400.000 ms
        
        const date = new Date(this.worldState.worldTime);
        const hours = date.getHours();

        // É noite de horda se for Dia 7, 14, 21... após as 22h OU madrugada do dia seguinte (Dia 8, 15...) antes das 4h.
        const isHordeNight = (currentDay % 7 === 0 && hours >= 22) || (currentDay > 1 && (currentDay - 1) % 7 === 0 && hours < 4);

        // Aviso Assustador às 18:00 do dia da horda
        if (currentDay % 7 === 0 && hours === 18 && !this.hordeWarningSent) {
            this.hordeWarningSent = true;
            this.net.sendPayload({ type: 'CHAT_MSG', nick: 'SISTEMA', text: '⚠️ As sombras se agitam na Terra Queimada... Preparem-se para defender a Colmeia!' });
        }
        // Reseta o aviso na manhã seguinte
        if (hours >= 6) this.hordeWarningSent = false;

        const players = [localPlayer, ...Object.values(remotePlayers)];
        
        // [OTIMIZAÇÃO] Evita processar a horda se não houver jogadores vivos
        const alivePlayers = [];
        for (let i = 0; i < players.length; i++) {
            if (players[i].hp > 0) alivePlayers.push(players[i]);
        }

        // Lógica de Spawn Inimigo
        if (isHordeNight) {
            const maxEnemies = players.length * 6; // Limite: 6 por jogador conectado
            
            if (enemies.length < maxEnemies) {
                this.hordeSpawnTick++;
                
                // Nasce rápido no início (a cada 2s), depois diminui para repor as mortas (a cada 10s)
                const spawnDelay = (enemies.length < players.length * 2) ? 2 : 10;
                
                if (this.hordeSpawnTick >= spawnDelay) {
                    this.hordeSpawnTick = 0;
                    if (alivePlayers.length > 0) {
                        const target = alivePlayers[Math.floor(Math.random() * alivePlayers.length)];
                        this._spawnHordeAnt(target, enemies);
                    }
                }
            }
        } else {
            // Se amanheceu (04:00 em diante) e ainda há formigas vivas, a luz do sol as queima!
            if (enemies.length > 0 && hours >= 4 && hours < 22) {
                enemies.forEach(ant => ant.hp = 0); // O loop do Game.js cuidará de explodi-las em pólen
                this.hordeSpawnTick = 0;
            }
        }

        // 2. Ondas da Colmeia Naturais (Ondas passivas do mapa)
        this.hiveWaveTick++;
        if (this.hiveWaveTick >= 3) {
            this.hiveWaveTick = 0;
            const hives = this.world.getHiveLocations();
            for (let i = 0; i < hives.length; i++) {
                const h = hives[i];
                this.net.sendPayload({ type: 'WAVE_SPAWN', x: h.x, y: h.y, radius: 4.0, color: "rgba(241, 196, 15, ALPHA)", amount: 5 });
                activeWaves.push(new WaveEffect(h.x, h.y, 4.0, "rgba(241, 196, 15, ALPHA)", 5));
            }
        }

        // 3. Registro de Spawn Points para novos jogadores
        const remoteIds = Object.keys(remotePlayers);
        for (let i = 0; i < remoteIds.length; i++) {
            const p = remotePlayers[remoteIds[i]];
            if (p.nickname && hiveRegistry[p.nickname] === undefined) {
                const usedIndices = Object.values(hiveRegistry);
                for(let j = 1; j < 8; j++) {
                    if (!usedIndices.includes(j)) {
                        hiveRegistry[p.nickname] = j;
                        break;
                    }
                }
            }
        }

        // 4. Crescimento de Plantas e Cura
        // [OTIMIZAÇÃO] for...in usado para evitar criação de array com Object.entries() a cada frame
        const growingPlants = this.worldState.growingPlants;
        for (const key in growingPlants) {
            let plantData = growingPlants[key];
            
            if (typeof plantData === 'number') {
                plantData = { time: plantData, lastHealTime: plantData, owner: null };
                growingPlants[key] = plantData; 
            }

            // [OTIMIZAÇÃO] Armazena x/y em cache para não fazer split(',') de strings múltiplas vezes
            if (plantData.x === undefined) {
                const parts = key.split(',');
                plantData.x = Number(parts[0]);
                plantData.y = Number(parts[1]);
            }

            const startTime = plantData.time;
            const lastHeal = plantData.lastHealTime || startTime;
            const ownerId = plantData.owner || null;
            const x = plantData.x;
            const y = plantData.y;
            
            const elapsedSinceStart = now - startTime;
            const elapsedSinceHeal = now - lastHeal;
            const currentType = this.worldState.getModifiedTile(x, y);

            if (currentType === 'GRAMA' && elapsedSinceStart > this.GROWTH_TIMES.BROTO) { fnChangeTile(x, y, 'BROTO', ownerId); changed = true; }
            else if (currentType === 'BROTO' && elapsedSinceStart > this.GROWTH_TIMES.MUDA) { fnChangeTile(x, y, 'MUDA', ownerId); changed = true; }
            else if (currentType === 'MUDA' && elapsedSinceStart > this.GROWTH_TIMES.FLOR) { fnChangeTile(x, y, 'FLOR', ownerId); changed = true; }
            else if (currentType === 'FLOR_COOLDOWN' && elapsedSinceStart > this.FLOWER_COOLDOWN_TIME) { fnChangeTile(x, y, 'FLOR', ownerId); changed = true; }

            // Lógica de Cura da Flor
            if (currentType === 'FLOR' && elapsedSinceHeal >= 3000) {
                plantData.lastHealTime = now;
                
                this.net.sendPayload({ type: 'WAVE_SPAWN', x: x, y: y, radius: 2.0, color: "rgba(46, 204, 113, ALPHA)", amount: 10 });
                activeWaves.push(new WaveEffect(x, y, 2.0, "rgba(46, 204, 113, ALPHA)", 10));

                for (let i = 0; i < players.length; i++) {
                    const p = players[i];
                    if (p.hp > 0 && p.hp < p.maxHp) {
                        const dx = p.pos.x - x;
                        const dy = p.pos.y - y;
                        // [OTIMIZAÇÃO] Distância ao quadrado em vez de Math.sqrt (2.5^2 = 6.25)
                        if ((dx * dx + dy * dy) <= 6.25) { 
                            if (p.id === localPlayer.id) {
                                localPlayer.applyHeal(10);
                                fnGainXp(this.XP_PASSIVE_CURE); 
                            } else {
                                this.net.sendPayload({ type: 'PLAYER_HEAL', amount: 10 }, p.id);
                            }
                        }
                    }
                }

                // Espalhamento orgânico e gradual
                const spreadShape = this.worldState.getOrganicSpreadShape(x, y, 5, 11);
                
                // [OTIMIZAÇÃO EXTREMA] Filtra os tiles ANTES de agendar os timeouts.
                // Evita colocar milhares de callbacks no Event Loop do JavaScript atoa.
                const tilesToProcess = [];
                for (let i = 0; i < spreadShape.length; i++) {
                    const pos = spreadShape[i];
                    const targetCheck = this.worldState.getModifiedTile(pos.x, pos.y) || this.world.getTileAt(pos.x, pos.y);
                    if (targetCheck === 'TERRA_QUEIMADA') {
                        tilesToProcess.push(pos);
                    }
                }
                
                // Agora, apenas tiles que REALMENTE precisam de cura geram timer e processamento
                tilesToProcess.forEach((pos, index) => {
                    setTimeout(() => {
                        const tx = pos.x;
                        const ty = pos.y;
                        
                        // Checagem dupla no momento exato para garantir que outro jogador ou planta não curou enquanto esperava
                        const target = this.worldState.getModifiedTile(tx, ty) || this.world.getTileAt(tx, ty);
                        if (target === 'TERRA_QUEIMADA') {
                            fnChangeTile(tx, ty, 'GRAMA_SAFE', ownerId);
                            
                            if (ownerId) {
                                this.net.sendPayload({ type: 'FLOWER_CURE', ownerId: ownerId, x: tx, y: ty });
                                
                                if (localPlayer && ownerId === localPlayer.id) {
                                    localPlayer.tilesCured++;
                                    fnGainXp(this.XP_PASSIVE_CURE);
                                } else if (remotePlayers[ownerId]) {
                                    remotePlayers[ownerId].tilesCured++;
                                    const pName = remotePlayers[ownerId].nickname;
                                    if (pName) {
                                        if (!guestDataDB[pName]) guestDataDB[pName] = {};
                                        guestDataDB[pName].tilesCured = remotePlayers[ownerId].tilesCured;
                                    }
                                }
                            }
                            // Permite salvar de forma leve o progresso
                            fnSaveProgress(false); 
                        }
                    }, index * 200); // 200ms de diferença entre cada célula de grama nascendo
                });
            }
        }

        if (changed) fnSaveProgress(false);
    }
}
