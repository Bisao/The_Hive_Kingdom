// src/core/input.js (ATUALIZADO E REVISADO)

export class InputHandler {
    constructor() {
        this.keys = {};
        
        // Adicionamos verificações de existência para evitar o erro de 'undefined'
        window.addEventListener('keydown', e => {
            if (e && e.key) {
                this.keys[e.key.toLowerCase()] = true;
            }
        });

        window.addEventListener('keyup', e => {
            if (e && e.key) {
                this.keys[e.key.toLowerCase()] = false;
            }
        });
    }

    getMovement() {
        let x = 0, y = 0;
        
        // Verificamos se a tecla existe no objeto antes de ler
        if (this.keys['w'] || this.keys['arrowup']) y -= 1;
        if (this.keys['s'] || this.keys['arrowdown']) y += 1;
        if (this.keys['a'] || this.keys['arrowleft']) x -= 1;
        if (this.keys['d'] || this.keys['arrowright']) x += 1;
        
        if (x !== 0 && y !== 0) { 
            x *= 0.707; 
            y *= 0.707; 
        } 
        return { x, y };
    }
}
