export class WorldState {
    constructor() {
        this.modifiedTiles = {}; 
        this.growingPlants = {}; 
        
        // Dicionário para rastrear tentativas de polinização (Persistência)
        this.pollinationAttempts = {};
        
        // CONFIGURAÇÕES DE DIFICULDADE E IMERSÃO
        this.CHANCE_OF_CURE = 0.05; // 5% de chance de curar o tile a cada frame de polinização
        this.SPREAD_DELAY = 3000;  // 3 segundos entre a cura de cada tile vizinho (mais imersivo)

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

    setTile(x, y, type) {
        const wx = this._wrap(x);
        const wy = this._wrap(y);
        const key = `${wx},${wy}`;

        if (this.modifiedTiles[key] === type) return false;
        
        this.modifiedTiles[key] = type;
        
        if (type === 'FLOR') {
            if (!this.growingPlants[key]) {
                this.addGrowingPlant(x, y);
            }
        }
        
        return true;
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
        delete this.growingPlants[`${wx},${wy}`];
    }

    /**
     * Calcula um padrão orgânico de espalhamento com DELAYS escalonados.
     * Agora retorna objetos com delay para que o Game.js processe lentamente.
     */
    getOrganicSpreadShape(startX, startY, minCells = 3, maxCells = 6) {
        // Reduzi o número de células vizinhas para não dominar o mapa rápido demais
        const count = Math.floor(Math.random() * (maxCells - minCells + 1)) + minCells;
        const result = [];
        const visited = new Set();
        
        const frontier = [{ x: Math.round(startX), y: Math.round(startY), step: 0 }];
        visited.add(`${this._wrap(frontier[0].x)},${this._wrap(frontier[0].y)}`);

        while (frontier.length > 0 && result.length < count) {
            const randomIndex = Math.floor(Math.random() * frontier.length);
            const current = frontier.splice(randomIndex, 1)[0];
            
            // Adicionamos um delay progressivo baseado no "step" (distância do centro)
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
            worldTime: this.worldTime 
        };
    }

    applyFullState(stateData) {
        if (stateData) {
            this.modifiedTiles = stateData.tiles || {};
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
        this.worldTime = this.START_TIME;
    }
}
