export class WorldGenerator {
    constructor(seed) {
        this.seedVal = this.hashSeed(seed);
        this.chunkSize = 16;
        this.tileSize = 32;
        this.hives = []; // Lista de coordenadas {x, y} das colmeias
        this.generateHives();
    }

    hashSeed(s) {
        let h = 0;
        for(let i=0; i<s.length; i++) h = Math.imul(31, h) + s.charCodeAt(i) | 0;
        return h;
    }

    random(salt) {
        const x = Math.sin(this.seedVal + salt) * 10000;
        return x - Math.floor(x);
    }

    generateHives() {
        // --- COLMEIA ÚNICA (MOTHER HIVE) ---
        // Agora todos os jogadores compartilham a mesma base central
        this.hives = [{ x: 0, y: 0 }];
        
        console.log(`[WorldGen] Colmeia Mãe estabelecida na origem. Seed: ${this.seedVal}`);
    }

    /**
     * Determina o tipo de tile em uma coordenada específica do mundo.
     * @param {number} x Coordenada X global
     * @param {number} y Coordenada Y global
     */
    getTileAt(x, y) {
        for (let h of this.hives) {
            // 1. A Colmeia em si
            if (h.x === x && h.y === y) return 'COLMEIA';
            
            // 2. FLORES INICIAIS (Recursos ao redor da Colmeia Mãe)
            // Posicionamos 4 flores estratégicas para o início do jogo
            const isInitialFlower = (
                (x === h.x + 3 && y === h.y + 3) || 
                (x === h.x - 3 && y === h.y - 3) ||
                (x === h.x + 3 && y === h.y - 3) ||
                (x === h.x - 3 && y === h.y + 3)
            );

            if (isInitialFlower) return 'FLOR';

            // 3. ÁREA SEGURA EXPANDIDA (Grama ao redor da colmeia)
            // Aumentamos para 6.5 para dar espaço para múltiplos players nascerem juntos
            const dist = Math.sqrt(Math.pow(x - h.x, 2) + Math.pow(y - h.y, 2));
            if (dist <= 6.5) { 
                return 'GRAMA_SAFE'; 
            }
        }

        // 4. TERRA QUEIMADA (Resto do mundo infectado)
        return 'TERRA_QUEIMADA';
    }

    /**
     * Gera os tiles de um chunk específico para renderização eficiente.
     * @param {number} cX Índice do Chunk X
     * @param {number} cY Índice do Chunk Y
     */
    getChunk(cX, cY) {
        let tiles = [];
        for(let y=0; y<this.chunkSize; y++) {
            for(let x=0; x<this.chunkSize; x++) {
                let wX = cX * this.chunkSize + x;
                let wY = cY * this.chunkSize + y;
                tiles.push({ x: wX, y: wY, type: this.getTileAt(wX, wY) });
            }
        }
        return tiles;
    }

    getHiveLocations() {
        return this.hives;
    }
}
