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
    addGrowingPlant(x, y) {
        const key = `${x},${y}`;
        if (!this.growingPlants[key]) this.growingPlants[key] = Date.now();
    }
    removeGrowingPlant(x, y) {
        delete this.growingPlants[`${x},${y}`];
    }
    getFullState() {
        return { tiles: this.modifiedTiles, plants: this.growingPlants };
    }
    applyFullState(stateData) {
        if (stateData) {
            this.modifiedTiles = stateData.tiles || {};
            this.growingPlants = stateData.plants || {};
        }
    }
}
