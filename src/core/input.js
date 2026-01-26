export class InputHandler {
    constructor() {
        this.keys = {};
        this.isMobile = this.detectMobile();
        
        // Input Desktop (Teclado)
        window.addEventListener('keydown', e => { if(e.key) this.keys[e.key.toLowerCase()] = true; });
        window.addEventListener('keyup', e => { if(e.key) this.keys[e.key.toLowerCase()] = false; });

        // Input Mobile (Touch)
        this.leftStick = null;
        this.rightStick = null;

        if (this.isMobile) {
            const controls = document.getElementById('mobile-controls');
            if (controls) {
                controls.style.display = 'block';
                // Joystick Esquerdo (Movimento)
                this.leftStick = new VirtualJoystick('stick-left-zone', 'stick-left-knob');
                // Joystick Direito (Ação/Interação - Opcional por enquanto)
                this.rightStick = new VirtualJoystick('stick-right-zone', 'stick-right-knob');
            }
        }
    }

    detectMobile() {
        return /Android|webOS|iPhone|iPad|iPod|BlackBerry|IEMobile|Opera Mini/i.test(navigator.userAgent);
    }

    getMovement() {
        // 1. Mobile Joystick
        if (this.isMobile && this.leftStick) {
            if (this.leftStick.vector.x !== 0 || this.leftStick.vector.y !== 0) {
                // Retorna vetor normalizado do joystick
                return { x: this.leftStick.vector.x, y: this.leftStick.vector.y };
            }
        }

        // 2. Teclado (Fallback ou Desktop)
        let x = 0, y = 0;
        if (this.keys['w'] || this.keys['arrowup']) y -= 1;
        if (this.keys['s'] || this.keys['arrowdown']) y += 1;
        if (this.keys['a'] || this.keys['arrowleft']) x -= 1;
        if (this.keys['d'] || this.keys['arrowright']) x += 1;

        // Normalização do teclado (para não andar mais rápido na diagonal)
        if (x !== 0 || y !== 0) {
            const length = Math.sqrt(x*x + y*y);
            x /= length;
            y /= length;
        }

        return { x, y };
    }
    
    setChatMode(isActive) {
        // Zera inputs se o chat abrir
        if(isActive) this.keys = {};
    }
}

// Classe interna para gerenciar um único joystick touch
class VirtualJoystick {
    constructor(zoneId, knobId) {
        this.zone = document.getElementById(zoneId);
        this.knob = document.getElementById(knobId);
        this.vector = { x: 0, y: 0 };
        this.touchId = null;
        this.origin = { x: 0, y: 0 };
        this.radius = 50; // Raio máximo de movimento do knob

        if (!this.zone || !this.knob) return;

        // Binda os eventos com {passive: false} para permitir e.preventDefault()
        this.zone.addEventListener('touchstart', e => this.onTouchStart(e), {passive: false});
        this.zone.addEventListener('touchmove', e => this.onTouchMove(e), {passive: false});
        this.zone.addEventListener('touchend', e => this.onTouchEnd(e), {passive: false});
        this.zone.addEventListener('touchcancel', e => this.onTouchEnd(e), {passive: false});
    }

    onTouchStart(e) {
        // Previne comportamento padrão (scroll/zoom) APENAS dentro da zona
        e.preventDefault();
        
        for (let i = 0; i < e.changedTouches.length; i++) {
            const touch = e.changedTouches[i];
            if (this.touchId === null) {
                this.touchId = touch.identifier;
                
                // Define o centro dinamicamente onde o dedo tocou
                const rect = this.zone.getBoundingClientRect();
                this.origin.x = rect.left + rect.width / 2;
                this.origin.y = rect.top + rect.height / 2;
                
                this.updateKnob(touch.clientX, touch.clientY);
            }
        }
    }

    onTouchMove(e) {
        e.preventDefault();
        for (let i = 0; i < e.changedTouches.length; i++) {
            if (this.touchId === e.changedTouches[i].identifier) {
                const touch = e.changedTouches[i];
                this.updateKnob(touch.clientX, touch.clientY);
                break;
            }
        }
    }

    onTouchEnd(e) {
        e.preventDefault();
        for (let i = 0; i < e.changedTouches.length; i++) {
            if (this.touchId === e.changedTouches[i].identifier) {
                this.touchId = null;
                this.vector = { x: 0, y: 0 };
                this.knob.style.transform = `translate(-50%, -50%)`;
                break;
            }
        }
    }

    updateKnob(clientX, clientY) {
        const dx = clientX - this.origin.x;
        const dy = clientY - this.origin.y;
        
        const distance = Math.sqrt(dx*dx + dy*dy);
        const angle = Math.atan2(dy, dx);
        
        // Limita o movimento ao raio
        const limit = Math.min(distance, this.radius);
        
        const newX = Math.cos(angle) * limit;
        const newY = Math.sin(angle) * limit;

        // Atualiza visual
        this.knob.style.transform = `translate(calc(-50% + ${newX}px), calc(-50% + ${newY}px))`;

        // Atualiza vetor normalizado (-1 a 1)
        this.vector = {
            x: newX / this.radius,
            y: newY / this.radius
        };
    }
}
