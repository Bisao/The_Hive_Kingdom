// Classe interna para gerenciar um único joystick
class VirtualJoystick {
    constructor(zoneId, knobId) {
        this.zone = document.getElementById(zoneId);
        this.knob = document.getElementById(knobId);
        
        if (!this.zone || !this.knob) return;

        this.vector = { x: 0, y: 0 };
        this.touchId = null;
        this.origin = { x: 0, y: 0 };
        this.radius = 50; 

        this.zone.addEventListener('touchstart', e => this.onTouchStart(e), {passive: false});
        this.zone.addEventListener('touchmove', e => this.onTouchMove(e), {passive: false});
        this.zone.addEventListener('touchend', e => this.onTouchEnd(e), {passive: false});
        this.zone.addEventListener('touchcancel', e => this.onTouchEnd(e), {passive: false});
    }

    onTouchStart(e) {
        if (this.touchId !== null) return;
        for (let i = 0; i < e.changedTouches.length; i++) {
            const touch = e.changedTouches[i];
            const rect = this.zone.getBoundingClientRect();
            const centerX = rect.left + rect.width / 2;
            const centerY = rect.top + rect.height / 2;
            const dist = Math.sqrt(Math.pow(touch.clientX - centerX, 2) + Math.pow(touch.clientY - centerY, 2));

            if (dist <= rect.width / 2) {
                e.preventDefault();
                this.touchId = touch.identifier;
                this.origin.x = centerX;
                this.origin.y = centerY;
                this.updateKnob(touch.clientX, touch.clientY);
                break;
            }
        }
    }

    onTouchMove(e) {
        if (this.touchId === null) return;
        for (let i = 0; i < e.changedTouches.length; i++) {
            if (e.changedTouches[i].identifier === this.touchId) {
                e.preventDefault();
                this.updateKnob(e.changedTouches[i].clientX, e.changedTouches[i].clientY);
                break;
            }
        }
    }

    onTouchEnd(e) {
        for (let i = 0; i < e.changedTouches.length; i++) {
            if (e.changedTouches[i].identifier === this.touchId) {
                e.preventDefault();
                this.reset();
                break;
            }
        }
    }

    updateKnob(clientX, clientY) {
        const dx = clientX - this.origin.x;
        const dy = clientY - this.origin.y;
        const distance = Math.sqrt(dx*dx + dy*dy);
        const angle = Math.atan2(dy, dx);
        const limit = Math.min(distance, this.radius);
        const force = Math.min(distance / this.radius, 1.0);

        this.vector.x = Math.cos(angle) * force;
        this.vector.y = Math.sin(angle) * force;
        const knobX = Math.cos(angle) * limit;
        const knobY = Math.sin(angle) * limit;
        this.knob.style.transform = `translate(calc(-50% + ${knobX}px), calc(-50% + ${knobY}px))`;
    }

    reset() {
        this.touchId = null;
        this.vector = { x: 0, y: 0 };
        this.knob.style.transform = `translate(-50%, -50%)`;
    }
}

export class InputHandler {
    constructor() {
        this.keys = {};
        this.isMobile = this.detectMobile();
        this.leftStick = null;
        this.rightStick = null; // Novo joystick de olhar

        this.currentZoom = 2.0; 
        this.minZoom = 0.5;
        this.maxZoom = 3.0;
        this.lastTouchDist = 0;

        window.addEventListener('keydown', e => { if(e.key) this.keys[e.key.toLowerCase()] = true; });
        window.addEventListener('keyup', e => { if(e.key) this.keys[e.key.toLowerCase()] = false; });

        if (this.isMobile) {
            // Inicializa os joysticks usando os IDs do seu index.html
            this.leftStick = new VirtualJoystick('stick-left-zone', 'stick-left-knob');
            this.rightStick = new VirtualJoystick('stick-right-zone', 'stick-right-knob');
            
            this.initMobileZoomEvents();
            this.initZoomToggleButton();
        }
    }

    detectMobile() {
        return /Android|webOS|iPhone|iPad|iPod|BlackBerry|IEMobile|Opera Mini/i.test(navigator.userAgent);
    }

    // Configura o botão da lupa para mostrar/esconder o slider
    initZoomToggleButton() {
        const btn = document.getElementById('zoom-toggle-btn');
        const sliderContainer = document.getElementById('zoom-slider-container');
        
        if (btn && sliderContainer) {
            btn.addEventListener('touchstart', (e) => {
                e.preventDefault();
                const isHidden = sliderContainer.style.display === 'none' || sliderContainer.style.display === '';
                sliderContainer.style.display = isHidden ? 'flex' : 'none';
                btn.style.background = isHidden ? 'var(--primary)' : 'rgba(0,0,0,0.8)';
                btn.style.color = isHidden ? 'black' : 'var(--primary)';
            });
        }

        const slider = document.getElementById('zoom-range');
        if (slider) {
            slider.addEventListener('input', (e) => {
                this.currentZoom = e.target.value / 100;
            });
        }
    }

    initMobileZoomEvents() {
        window.addEventListener('touchstart', e => {
            if (e.touches.length === 2) {
                this.lastTouchDist = this.getTouchDist(e.touches);
            }
        }, {passive: false});

        window.addEventListener('touchmove', e => {
            if (e.touches.length === 2) {
                e.preventDefault();
                const dist = this.getTouchDist(e.touches);
                const delta = (dist - this.lastTouchDist) * 0.01;
                this.currentZoom = Math.max(this.minZoom, Math.min(this.maxZoom, this.currentZoom + delta));
                this.lastTouchDist = dist;

                const slider = document.getElementById('zoom-range');
                if (slider) slider.value = this.currentZoom * 100;
            }
        }, {passive: false});
    }

    getTouchDist(touches) {
        return Math.sqrt(
            Math.pow(touches[0].clientX - touches[1].clientX, 2) +
            Math.pow(touches[0].clientY - touches[1].clientY, 2)
        );
    }

    showJoystick() {
        const container = document.getElementById('mobile-ui-container');
        if (container) {
            container.style.display = 'block';
            container.style.pointerEvents = 'none'; // Container não bloqueia, mas filhos sim
        }
    }

    getZoom() {
        return this.currentZoom;
    }

    getMovement() {
        if (this.isMobile && this.leftStick && this.leftStick.touchId !== null) {
            return { x: this.leftStick.vector.x, y: this.leftStick.vector.y };
        }
        let x = 0, y = 0;
        if (this.keys['w'] || this.keys['arrowup']) y -= 1;
        if (this.keys['s'] || this.keys['arrowdown']) y += 1;
        if (this.keys['a'] || this.keys['arrowleft']) x -= 1;
        if (this.keys['d'] || this.keys['arrowright']) x += 1;
        if (x !== 0 && y !== 0) { x *= 0.707; y *= 0.707; }
        return { x, y };
    }

    // Novo método para capturar a direção do joystick da direita
    getLookVector() {
        if (this.isMobile && this.rightStick && this.rightStick.touchId !== null) {
            return { x: this.rightStick.vector.x, y: this.rightStick.vector.y };
        }
        return null; // Retorna null se não estiver sendo usado
    }
}
