export class WorldState {
    constructor() {
        this.modifiedTiles = {}; // Mapa de alterações: "x,y" => "TIPO_DO_TILE"
        this.growingPlants = {}; // Mapa de crescimento: "x,y" => { time: timestamp, owner: id }
    }

    /**
     * Define um tile modificado. Retorna true se houve mudança real.
     */
    setTile(x, y, type) {
        const key = `${x},${y}`;
        // Otimização: Se já é do tipo solicitado, ignora
        if (this.modifiedTiles[key] === type) return false;
        
        this.modifiedTiles[key] = type;
        return true;
    }

    /**
     * Retorna o tipo do tile se ele foi modificado, ou null se for original.
     */
    getModifiedTile(x, y) {
        return this.modifiedTiles[`${x},${y}`] || null;
    }

    /**
     * Registra uma planta que precisa crescer com o tempo.
     */
    addGrowingPlant(x, y, ownerId = null) {
        const key = `${x},${y}`;
        if (!this.growingPlants[key]) {
            this.growingPlants[key] = {
                time: Date.now(),
                owner: ownerId // Importante para o Ranking/XP
            };
        }
    }

    removeGrowingPlant(x, y) {
        delete this.growingPlants[`${x},${y}`];
    }

    /**
     * Prepara os dados para salvar ou enviar pela rede.
     */
    getFullState() {
        return { 
            tiles: this.modifiedTiles, 
            plants: this.growingPlants 
        };
    }

    /**
     * Carrega dados vindos do save ou da rede.
     */
    applyFullState(stateData) {
        if (stateData) {
            this.modifiedTiles = stateData.tiles || {};
            
            // Tratamento de compatibilidade (caso tenha saves antigos)
            const rawPlants = stateData.plants || {};
            this.growingPlants = {};

            for (const [key, val] of Object.entries(rawPlants)) {
                if (typeof val === 'number') {
                    // Save antigo (só tinha tempo): converte para objeto
                    this.growingPlants[key] = { time: val, owner: null };
                } else {
                    // Save novo: mantém
                    this.growingPlants[key] = val;
                }
            }
            console.log(`[WorldState] Estado sincronizado. ${Object.keys(this.modifiedTiles).length} tiles alterados.`);
        }
    }

    reset() {
        this.modifiedTiles = {};
        this.growingPlants = {};
    }
}
