export class NoiseGenerator {
    constructor(seed) {
        this.perm = new Uint8Array(512);
        this.p = new Uint8Array(256);
        this.seedVal = this.hashString(seed.toString());
        this.init();
    }

    // Transforma a seed (texto ou número) em um inteiro utilizável
    hashString(str) {
        let h = 0;
        for (let i = 0; i < str.length; i++) {
            h = Math.imul(31, h) + str.charCodeAt(i) | 0;
        }
        return h;
    }

    init() {
        // Preenche o array inicial com 0-255
        for (let i = 0; i < 256; i++) {
            this.p[i] = i;
        }

        // Embaralha o array usando a Seed (Algoritmo LCG simples)
        // Isso garante que a mesma seed sempre gere o mesmo mapa
        let state = this.seedVal;
        for (let i = 255; i > 0; i--) {
            // Constantes mágicas para pseudo-aleatoriedade
            state = Math.imul(1664525, state) + 1013904223 | 0;
            const j = Math.abs(state) % (i + 1);
            [this.p[i], this.p[j]] = [this.p[j], this.p[i]];
        }

        // Duplica o array para evitar overflow nas operações de bit
        for (let i = 0; i < 512; i++) {
            this.perm[i] = this.p[i & 255];
        }
    }

    // Função de suavização (Fade function: 6t^5 - 15t^4 + 10t^3)
    fade(t) { 
        return t * t * t * (t * (t * 6 - 15) + 10); 
    }

    // Interpolação Linear
    lerp(t, a, b) { 
        return a + t * (b - a); 
    }

    // Calcula o gradiente vetorial
    grad(hash, x, y) {
        const h = hash & 15;
        const u = h < 8 ? x : y;
        const v = h < 4 ? y : (h === 12 || h === 14 ? x : 0);
        return ((h & 1) === 0 ? u : -u) + ((h & 2) === 0 ? v : -v);
    }

    /**
     * Gera um valor de ruído suave entre -1.0 e 1.0
     * @param {number} x Coordenada X
     * @param {number} y Coordenada Y
     */
    noise2D(x, y) {
        // Encontra o quadrado unitário
        let X = Math.floor(x) & 255;
        let Y = Math.floor(y) & 255;

        // Posição relativa dentro do quadrado (0.0 a 1.0)
        x -= Math.floor(x);
        y -= Math.floor(y);

        // Calcula as curvas de fade
        const u = this.fade(x);
        const v = this.fade(y);

        // Hash dos 4 cantos do quadrado
        const A = this.perm[X] + Y;
        const AA = this.perm[A];
        const AB = this.perm[A + 1];
        const B = this.perm[X + 1] + Y;
        const BA = this.perm[B];
        const BB = this.perm[B + 1];

        // Mistura os resultados
        return this.lerp(v, 
            this.lerp(u, this.grad(this.perm[AA], x, y), this.grad(this.perm[BA], x - 1, y)),
            this.lerp(u, this.grad(this.perm[AB], x, y - 1), this.grad(this.perm[BB], x - 1, y - 1))
        );
    }

    /**
     * Gera ruído fractal (várias camadas) para terrenos mais naturais.
     * @param {number} x Coordenada X
     * @param {number} y Coordenada Y
     * @param {number} octaves Número de camadas de detalhe (padrão: 4)
     * @param {number} persistence Quanto cada camada influencia (padrão: 0.5)
     * @returns {number} Valor entre ~ -1 e 1
     */
    fractal(x, y, octaves = 4, persistence = 0.5) {
        let total = 0;
        let frequency = 1;
        let amplitude = 1;
        let maxValue = 0;  // Usado para normalizar o resultado

        for(let i = 0; i < octaves; i++) {
            total += this.noise2D(x * frequency, y * frequency) * amplitude;
            
            maxValue += amplitude;
            
            amplitude *= persistence;
            frequency *= 2;
        }

        return total / maxValue;
    }
}
