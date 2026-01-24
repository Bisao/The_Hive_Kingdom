// src/world/worldGen.js

export class WorldGenerator {
    constructor(seed) {
        this.seed = this.hashSeed(seed);
        this.chunkSize = 16; // 16x16 tiles por chunk
        this.tileSize = 32;
    }

    // Transforma a string da Seed em um número processável
    hashSeed(seed) {
        let hash = 0;
        for (let i = 0; i < seed.length; i++) {
            hash = (hash << 5) - hash + seed.charCodeAt(i);
            hash |= 0; 
        }
        return hash;
    }

    // Função pseudo-aleatória baseada na seed e posição
    // Retorna um valor entre 0 e 1
    noise(x, y) {
        const n = Math.sin(x * 12.9898 + y * 78.233 + this.seed) * 43758.5453;
        return n - Math.floor(n);
    }

    getTileAt(x, y) {
        // Lógica de "Ilha Inicial" (Grama e 3 flores ao redor da colmeia 0,0)
        const dist = Math.sqrt(x*x + y*y);
        
        if (x === 0 && y === 0) return 'COLMEIA';
        if (dist < 3) return 'GRAMA'; // Área protegida inicial
        
        // Gerar terreno queimado ou flores baseado no ruído
        const val = this.noise(x, y);
        
        if (val > 0.98) return 'FLOR_POLEM'; // 2% de chance de flor
        if (val > 0.80) return 'GRAMA_SECA'; 
        return 'TERRA_QUEIMADA';
    }

    // Retorna os dados de um chunk específico para renderização
    getChunk(chunkX, chunkY) {
        const tiles = [];
        for (let y = 0; y < this.chunkSize; y++) {
            for (let x = 0; x < this.chunkSize; x++) {
                const worldX = chunkX * this.chunkSize + x;
                const worldY = chunkY * this.chunkSize + y;
                tiles.push({
                    x: worldX,
                    y: worldY,
                    type: this.getTileAt(worldX, worldY)
                });
            }
        }
        return tiles;
    }
}
