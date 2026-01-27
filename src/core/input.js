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

        // Binda os eventos garantindo que o multitouch funcione sem conflitos
        this.zone.addEventListener('touchstart', e => this.onTouchStart(e), {passive: false});
        this.zone.addEventListener('touchmove', e => this.onTouchMove(e), {passive: false});
        this.zone.addEventListener('touchend', e => this.onTouchEnd(e), {passive: false});
        this.zone.addEventListener('touchcancel', e => this.onTouchEnd(e), {passive: false});
    }

    onTouchStart(e) {
        // Se este joystick já tiver um toque vinculado, ignora novos toques
        if (this.touchId !== null) return;

        for (let i = 0; i < e.changedTouches.length; i++) {
            const touch = e.changedTouches[i];
            const rect = this.zone.getBoundingClientRect();
            
            const centerX = rect.left + rect.width / 2;
            const centerY = rect.top + rect.height / 2;
            const dist = Math.sqrt(Math.pow(touch.clientX - centerX, 2) + Math.pow(touch.clientY - centerY, 2));

            // Verifica se o toque começou dentro da zona do analógico
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
        this.rightStick = null;

        // Estado do Zoom sincronizado com o PC (Wheel) e Mobile (Slider)
        this.currentZoom = 2.0; 
        this.minZoom = 0.5;
        this.maxZoom = 3.0;

        // Ouvintes de Teclado
        window.addEventListener('keydown', e => { if(e.key) this.keys[e.key.toLowerCase()] = true; });
        window.addEventListener('keyup', e => { if(e.key) this.keys[e.key.toLowerCase()] = false; });

        // Ouvinte de Scroll do Mouse (PC)
        window.addEventListener('wheel', (e) => {
            const delta = e.deltaY > 0 ? -0.1 : 0.1;
            this.currentZoom = Math.max(this.minZoom, Math.min(this.maxZoom, this.currentZoom + delta));
            
            // Atualiza o slider visual se o container estiver aberto no PC
            const slider = document.getElementById('zoom-range');
            if (slider) slider.value = this.currentZoom * 100;
        }, { passive: true });

        // Inicialização específica para Mobile
        if (this.isMobile) {
            this.leftStick = new VirtualJoystick('stick-left-zone', 'stick-left-knob');
            this.rightStick = new VirtualJoystick('stick-right-zone', 'stick-right-knob');
        }

        // A lupa agora funciona em ambos (PC e Mobile)
        this.initZoomToggleButton();
    }

    detectMobile() {
        return /Android|webOS|iPhone|iPad|iPod|BlackBerry|IEMobile|Opera Mini/i.test(navigator.userAgent);
    }

    initZoomToggleButton() {
        const btn = document.getElementById('zoom-toggle-btn');
        const sliderContainer = document.getElementById('zoom-slider-container');
        
        if (btn && sliderContainer) {
            // Usando pointerdown para funcionar em Mouse e Touch
            btn.addEventListener('pointerdown', (e) => {
                e.preventDefault();
                const isHidden = sliderContainer.style.display === 'none' || sliderContainer.style.display === '';
                sliderContainer.style.display = isHidden ? 'flex' : 'none';
                
                // Feedback visual no botão
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

    showJoystick() {
        const container = document.getElementById('mobile-ui-container');
        if (container) {
            container.style.display = 'block';
            container.style.pointerEvents = 'none';
        }
    }

    getZoom() {
        return this.currentZoom;
    }

    getMovement() {
        // Prioridade para o Joystick no Mobile
        if (this.isMobile && this.leftStick && this.leftStick.touchId !== null) {
            return { x: this.leftStick.vector.x, y: this.leftStick.vector.y };
        }

        // Teclado no PC
        let x = 0, y = 0;
        if (this.keys['w'] || this.keys['arrowup']) y -= 1;
        if (this.keys['s'] || this.keys['arrowdown']) y += 1;
        if (this.keys['a'] || this.keys['arrowleft']) x -= 1;
        if (this.keys['d'] || this.keys['arrowright']) x += 1;
        
        if (x !== 0 && y !== 0) { x *= 0.707; y *= 0.707; }
        return { x, y };
    }

    getLookVector() {
        if (this.isMobile && this.rightStick && this.rightStick.touchId !== null) {
            return { x: this.rightStick.vector.x, y: this.rightStick.vector.y };
        }
        return null;
    }
}
