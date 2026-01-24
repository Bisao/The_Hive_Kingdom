// src/world/worldState.js

export class WorldState {
    constructor() {
        this.modifiedTiles = {}; // Formato: "x,y": "TIPO_NOVO"
    }

    // Altera um tile e retorna true se a mudança foi nova
    setTile(x, y, type) {
        const key = `${x},${y}`;
        if (this.modifiedTiles[key] === type) return false;
        this.modifiedTiles[key] = type;
        return true;
    }

    // Verifica se um tile foi modificado, senão retorna null
    getModifiedTile(x, y) {
        return this.modifiedTiles[`${x},${y}`] || null;
    }

    // Para sincronizar o estado completo quando um novo jogador entra
    getFullState() {
        return this.modifiedTiles;
    }

    applyFullState(state) {
        this.modifiedTiles = state;
    }
}
