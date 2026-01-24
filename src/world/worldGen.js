export class WorldGenerator {
    constructor(seed) {
        this.seed = this.hashSeed(seed);
        this.chunkSize = 16;
        this.tileSize = 32;
    }

    hashSeed(s) {
        let h = 0;
        for(let i=0; i<s.length; i++) h = Math.imul(31, h) + s.charCodeAt(i) | 0;
        return h;
    }

    noise(x, y) {
        // Simplex Noise simplificado para JS puro
        const n = Math.sin(x * 12.9898 + y * 78.233 + this.seed) * 43758.5453;
        return n - Math.floor(n);
    }

    getTileAt(x, y) {
        if (x === 0 && y === 0) return 'COLMEIA';

        // REGRA: Única flor inicial na área verde
        if (x === 2 && y === 2) return 'FLOR'; 

        // Área segura inicial (Raio 4)
        if (Math.sqrt(x*x + y*y) < 4) return 'GRAMA';

        // O resto do mundo é queimado
        return 'TERRA_QUEIMADA';
    }

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
}
