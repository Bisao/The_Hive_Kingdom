export class WorldState {
    constructor() {
        this.modifiedTiles = {}; 
        this.growingPlants = {}; 
    }

    setTile(x, y, type) {
        const key = `${x},${y}`;
        // Otimização: Só altera se for diferente
        if (this.modifiedTiles[key] === type) return false;
        
        this.modifiedTiles[key] = type;
        return true;
    }

    getModifiedTile(x, y) {
        return this.modifiedTiles[`${x},${y}`] || null;
    }

    addGrowingPlant(x, y) {
        const key = `${x},${y}`;
        // Só adiciona se não existir, para não resetar o tempo de crescimento
        if (!this.growingPlants[key]) {
            this.growingPlants[key] = Date.now();
        }
    }

    removeGrowingPlant(x, y) {
        delete this.growingPlants[`${x},${y}`];
    }

    /**
     * Exporta o estado do mundo para o SaveSystem
     */
    getFullState() {
        return { 
            tiles: this.modifiedTiles, 
            plants: this.growingPlants 
        };
    }

    /**
     * Importa o estado do mundo vindo do Save
     */
    applyFullState(stateData) {
        if (stateData) {
            this.modifiedTiles = stateData.tiles || {};
            this.growingPlants = stateData.plants || {};
            console.log("[WorldState] Estado do mundo carregado.");
        }
    }

    /**
     * Limpa o estado (Útil para 'Sair para o Menu')
     */
    reset() {
        this.modifiedTiles = {};
        this.growingPlants = {};
    }
}
