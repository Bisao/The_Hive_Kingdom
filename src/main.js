export class WorldState {
    constructor() {
        this.modifiedTiles = {}; 
        this.growingPlants = {}; 
    }

    setTile(x, y, type) {
        const key = `${x},${y}`;
        if (this.modifiedTiles[key] === type) return false;
        
        this.modifiedTiles[key] = type;
        return true;
    }

    getModifiedTile(x, y) {
        return this.modifiedTiles[`${x},${y}`] || null;
    }

    /**
     * Registra uma planta crescendo.
     * @param {number} x 
     * @param {number} y 
     * @param {string} ownerId - ID do jogador que plantou (para dar XP/Score depois)
     */
    addGrowingPlant(x, y, ownerId) {
        const key = `${x},${y}`;
        if (!this.growingPlants[key]) {
            this.growingPlants[key] = {
                start: Date.now(),
                owner: ownerId || 'unknown'
            };
        }
    }

    /**
     * Retorna os dados da planta de forma segura
     */
    getPlantData(key) {
        const data = this.growingPlants[key];
        if (!data) return null;

        // Compatibilidade com saves antigos (se era apenas um número)
        if (typeof data === 'number') {
            return { start: data, owner: 'unknown' };
        }
        return data;
    }

    removeGrowingPlant(x, y) {
        delete this.growingPlants[`${x},${y}`];
    }

    getFullState() {
        return { 
            tiles: this.modifiedTiles, 
            plants: this.growingPlants 
        };
    }

    applyFullState(stateData) {
        if (stateData) {
            this.modifiedTiles = stateData.tiles || {};
            this.growingPlants = stateData.plants || {};
        }
    }

    reset() {
        this.modifiedTiles = {};
        this.growingPlants = {};
    }
}
