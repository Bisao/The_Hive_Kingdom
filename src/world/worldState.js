export class WorldState {
    constructor() {
        this.modifiedTiles = {}; // Armazena "x,y": "TIPO"
    }

    setTile(x, y, type) {
        const key = `${x},${y}`;
        // Só retorna true se houve mudança real (evita spam de rede)
        if (this.modifiedTiles[key] === type) return false;
        
        this.modifiedTiles[key] = type;
        return true;
    }

    getModifiedTile(x, y) {
        return this.modifiedTiles[`${x},${y}`] || null;
    }

    // --- NOVOS MÉTODOS DE SINCRONIZAÇÃO ---
    
    // Retorna todo o histórico de mudanças para enviar a novos jogadores
    getFullState() {
        return this.modifiedTiles;
    }

    // Aplica um histórico recebido do host
    applyFullState(stateData) {
        if (stateData) {
            this.modifiedTiles = stateData;
        }
    }
}
