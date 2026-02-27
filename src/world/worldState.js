export class WorldState {
    constructor() {
        this.modifiedTiles = {}; 
        this.growingPlants = {}; 
        
        // Gerenciamento persistente de pólen por flor
        this.flowerData = {}; 
        
        // Dicionário para rastrear tentativas de polinização (Persistência)
        this.pollinationAttempts = {};
        
        // CONFIGURAÇÕES DE DIFICULDADE E IMERSÃO
        this.CHANCE_OF_CURE = 0.05; // 5% de chance de curar o tile a cada frame de polinização
        this.SPREAD_DELAY = 3000;   // 3 segundos entre a cura de cada tile vizinho (mais imersivo)

        // CONFIGURAÇÕES DE PÓLEN (Mecânica de Coleta e Regeneração)
        this.POLLEN_REGEN_COOLDOWN = 10000; // 10 segundos sem coleta para iniciar regen
        this.POLLEN_REGEN_INTERVAL = 3000;  // +1 de pólen a cada 3 segundos
        this.DEFAULT_MAX_POLLEN = 10;       // Capacidade padrão inicial de uma flor

        this.worldSize = 4000;
        this.START_TIME = new Date('2074-02-09T06:00:00').getTime();
        this.worldTime = this.START_TIME;
    }

    _wrap(c) {
        return ((c % this.worldSize) + this.worldSize) % this.worldSize;
    }

    /**
     * Tenta polinizar um tile. 
     * Retorna 'CURED' se o solo foi restaurado, 'FAIL' se não deu certo desta vez.
     */
    attemptPollination(x, y) {
        const wx = this._wrap(x);
        const wy = this._wrap(y);
        const key = `${wx},${wy}`;

        // Se já estiver curado, não faz nada
        const current = this.getModifiedTile(wx, wy);
        if (current && current !== 'TERRA_QUEIMADA') return 'FAIL';

        // Lógica de Sorte: Só cura se o número aleatório for menor que a chance
        if (Math.random() < this.CHANCE_OF_CURE) {
            delete this.pollinationAttempts[key]; // Limpa histórico de tentativas
            return 'CURED';
        }

        // Incrementa persistência (opcional: pode ser usado para aumentar a sorte com o tempo)
        this.pollinationAttempts[key] = (this.pollinationAttempts[key] || 0) + 1;
        return 'FAIL';
    }

    /**
     * Define o tipo de um tile e gerencia o registro de dados de flores.
     */
    setTile(x, y, type) {
        const wx = this._wrap(x);
        const wy = this._wrap(y);
        const key = `${wx},${wy}`;

        // LÓGICA DE REGISTRO DE FLORES (Correção das flores que crescem)
        // Isso foi movido para ANTES da trava de "return false" para garantir 
        // que flores virgens geradas pelo mapa sempre ganhem dados de pólen
        if (type === 'FLOR') {
            if (!this.flowerData[key]) {
                this.flowerData[key] = {
                    currentPollen: this.DEFAULT_MAX_POLLEN,
                    maxPollen: this.DEFAULT_MAX_POLLEN,
                    lastCollectTime: Date.now(),
                    lastRegenTime: Date.now()
                };
            }
            if (!this.growingPlants[key]) {
                this.addGrowingPlant(x, y);
            }
        } else if (type === 'FLOR_COOLDOWN') {
            if (this.flowerData[key]) {
                this.flowerData[key].currentPollen = 0;
            }
        } else {
            delete this.flowerData[key];
        }

        // Trava original: se o tile já for desse tipo, cancela a pintura no mapa
        if (this.modifiedTiles[key] === type) return false;
        
        this.modifiedTiles[key] = type;
        return true;
    }

    /**
     * MECÂNICA DE COLETA: Tenta remover 1 de pólen da flor.
     */
    collectPollenFromFlower(x, y) {
        const wx = this._wrap(x);
        const wy = this._wrap(y);
        const key = `${wx},${wy}`;
        const data = this.flowerData[key];

        // Se a flor não existir ou estiver vazia, retorna 0
        if (!data || data.currentPollen <= 0) return 0;

        // Reduz o pólen da flor
        data.currentPollen -= 1;
        
        // Reseta o timer de regeneração e coleta
        data.lastCollectTime = Date.now();
        data.lastRegenTime = Date.now();

        return 1; 
    }

    /**
     * MECÂNICA DE REGENERAÇÃO: Atualiza o pólen das flores ao longo do tempo.
     */
    updateFlowers() {
        const now = Date.now();

        for (const key in this.flowerData) {
            const data = this.flowerData[key];

            // 1. Verifica se passou o cooldown de 10 segundos sem interações
            if (now - data.lastCollectTime >= this.POLLEN_REGEN_COOLDOWN) {
                
                // 2. Verifica se a flor ainda tem espaço para regenerar pólen
                if (data.currentPollen < data.maxPollen) {
                    
                    // 3. Adiciona 1 de pólen a cada 3 segundos passados
                    if (now - data.lastRegenTime >= this.POLLEN_REGEN_INTERVAL) {
                        data.currentPollen = Math.min(data.maxPollen, data.currentPollen + 1);
                        data.lastRegenTime = now;
                    }
                }
            }
        }
    }

    getModifiedTile(x, y) {
        const wx = this._wrap(x);
        const wy = this._wrap(y);
        return this.modifiedTiles[`${wx},${wy}`] || null;
    }

    addGrowingPlant(x, y, ownerId = null) {
        const wx = this._wrap(x);
        const wy = this._wrap(y);
        const key = `${wx},${wy}`;

        if (!this.growingPlants[key]) {
            this.growingPlants[key] = {
                time: Date.now(),
                lastHealTime: Date.now(),
                owner: ownerId 
            };
        }
    }

    resetPlantTimer(x, y) {
        const wx = this._wrap(x);
        const wy = this._wrap(y);
        const key = `${wx},${wy}`;

        if (this.growingPlants[key]) {
            this.growingPlants[key].time = Date.now();
            this.growingPlants[key].lastHealTime = Date.now();
        } else {
            this.addGrowingPlant(x, y);
        }
    }

    getPlayersInHealRange(flowerX, flowerY, players, range = 1.5) {
        const nearbyPlayers = [];
        const fx = this._wrap(flowerX);
        const fy = this._wrap(flowerY);
        const halfWorld = this.worldSize / 2;

        for (const id in players) {
            const p = players[id];
            if (p.hp !== undefined && p.hp <= 0) continue;

            const rawPx = p.pos ? p.pos.x : p.x;
            const rawPy = p.pos ? p.pos.y : p.y;
            
            const px = this._wrap(rawPx);
            const py = this._wrap(rawPy);
            
            let dx = Math.abs(px - fx);
            if (dx > halfWorld) dx = this.worldSize - dx;

            let dy = Math.abs(py - fy);
            if (dy > halfWorld) dy = this.worldSize - dy;
            
            if (Math.sqrt(dx * dx + dy * dy) <= range) {
                nearbyPlayers.push(id);
            }
        }
        return nearbyPlayers;
    }

    removeGrowingPlant(x, y) {
        const wx = this._wrap(x);
        const wy = this._wrap(y);
        const key = `${wx},${wy}`;
        
        delete this.growingPlants[key];
        delete this.flowerData[key];
    }

    getOrganicSpreadShape(startX, startY, minCells = 3, maxCells = 6) {
        const count = Math.floor(Math.random() * (maxCells - minCells + 1)) + minCells;
        const result = [];
        const visited = new Set();
        
        const frontier = [{ x: Math.round(startX), y: Math.round(startY), step: 0 }];
        visited.add(`${this._wrap(frontier[0].x)},${this._wrap(frontier[0].y)}`);

        while (frontier.length > 0 && result.length < count) {
            const randomIndex = Math.floor(Math.random() * frontier.length);
            const current = frontier.splice(randomIndex, 1)[0];
            
            result.push({
                x: current.x,
                y: current.y,
                delay: current.step * this.SPREAD_DELAY 
            });

            const neighbors = [
                { x: current.x, y: current.y - 1 },
                { x: current.x, y: current.y + 1 },
                { x: current.x - 1, y: current.y },
                { x: current.x + 1, y: current.y }
            ];

            for (const n of neighbors) {
                const wx = this._wrap(n.x);
                const wy = this._wrap(n.y);
                const key = `${wx},${wy}`;
                
                if (!visited.has(key)) {
                    visited.add(key);
                    frontier.push({ ...n, step: current.step + 1 });
                }
            }
        }
        
        return result;
    }

    getFullState() {
        return { 
            tiles: this.modifiedTiles, 
            plants: this.growingPlants,
            flowers: this.flowerData,
            worldTime: this.worldTime 
        };
    }

    applyFullState(stateData) {
        if (stateData) {
            this.modifiedTiles = stateData.tiles || {};
            this.flowerData = stateData.flowers || {}; 
            
            const rawPlants = stateData.plants || {};
            this.growingPlants = {};

            for (const [key, val] of Object.entries(rawPlants)) {
                this.growingPlants[key] = {
                    time: val.time || Date.now(),
                    lastHealTime: val.lastHealTime || Date.now(),
                    owner: val.owner || null
                };
            }

            this.worldTime = stateData.worldTime || this.START_TIME;
        }
    }

    reset() {
        this.modifiedTiles = {};
        this.growingPlants = {};
        this.flowerData = {};
        this.worldTime = this.START_TIME;
    }
}
