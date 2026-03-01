/**
 * VirtualJoystick
 * Gerencia a lógica individual de cada manche virtual para dispositivos móveis.
 */
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
        window.dispatchEvent(new CustomEvent('joystickInteract'));

        for (let i = 0; i < e.changedTouches.length; i++) {
            const touch = e.changedTouches[i];
            const rect = this.zone.getBoundingClientRect();
            const centerX = rect.left + rect.width / 2;
            const centerY = rect.top + rect.height / 2;
            const dist = Math.sqrt(Math.pow(touch.clientX - centerX, 2) + Math.pow(touch.clientY - centerY, 2));

            if (dist <= rect.width / 1.5) {
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

/**
 * InputHandler
 * Centraliza as entradas de teclado, mouse e joysticks mobile.
 * Atualizado para Botão Único de Ação Inteligente.
 */
export class InputHandler {
    constructor() {
        this.keys = {};
        this.isMobile = this.detectMobile();
        
        this.leftStick = null;  
        this.rightStick = null; 
        
        // NOVO: Apenas o botão principal de ação e o resgate
        this.btnMainAction = null;
        this.btnRescue = null; 
        
        this.isCollectingHeld = false; 
        this.isRescueHeld = false;      
        this.pollinationToggle = false; 

        // Rastreia o estado atual ditado pelo Game/Player (collect, pollinate, default)
        this.currentActionState = 'default';

        this.mousePos = { x: 0, y: 0 };
        this.isMouseDown = false;
        this.aimVectorPC = { x: 0, y: 0 };

        this.init();
    }

    init() {
        window.addEventListener('keydown', e => { 
            if (!e || !e.key) return; 

            const key = e.key.toLowerCase();
            // Lógica de Toggle para PC (Tecla F)
            if (key === 'f') {
                this.pollinationToggle = !this.pollinationToggle;
            }
            // Dispara a abertura do menu de configurações no botão ESC
            if (key === 'escape') {
                window.dispatchEvent(new CustomEvent('toggleSettings'));
            }
            this.keys[key] = true; 
        });
        
        window.addEventListener('keyup', e => { 
            if(e && e.key) this.keys[e.key.toLowerCase()] = false; 
        });

        window.addEventListener('skillTreeToggled', (e) => {
            if (e.detail.isOpen) this.hideJoystick();
            else this.showJoystick();
        });

        if (this.isMobile) {
            this.handleOrientationLock();
            this.injectMobileStyles();
            this.injectMobileHTML();
            this.leftStick = new VirtualJoystick('stick-left-zone', 'stick-left-knob');
            this.rightStick = new VirtualJoystick('stick-right-zone', 'stick-right-knob');
            this.bindMobileActionEvents();
        } else {
            this.setupMouseControls();
        }
    }

    detectMobile() {
        const userAgent = navigator.userAgent || navigator.vendor || window.opera;
        return (/Android|webOS|iPhone|iPad|iPod|BlackBerry|IEMobile|Opera Mini/i.test(userAgent) || 
                (navigator.maxTouchPoints && navigator.maxTouchPoints > 1));
    }

    async handleOrientationLock() {
        if (screen.orientation && screen.orientation.lock) {
            try { await screen.orientation.lock('landscape').catch(() => {}); } catch (e) {}
        }
    }

    setupMouseControls() {
        window.addEventListener('mousemove', e => {
            this.mousePos.x = e.clientX;
            this.mousePos.y = e.clientY;
            const centerX = window.innerWidth / 2;
            const centerY = window.innerHeight / 2;
            const dx = this.mousePos.x - centerX;
            const dy = this.mousePos.y - centerY;
            const dist = Math.sqrt(dx*dx + dy*dy);
            if (dist > 0) {
                this.aimVectorPC.x = dx / dist;
                this.aimVectorPC.y = dy / dist;
            }
        });
        window.addEventListener('mousedown', e => { if (e.button === 0) this.isMouseDown = true; });
        window.addEventListener('mouseup', e => { if (e.button === 0) this.isMouseDown = false; });
    }

    isCollecting() {
        return this.keys['e'] || this.isCollectingHeld;
    }

    isRescuing() {
        return this.keys['r'] || this.isRescueHeld;
    }

    isPollinating() {
        return this.pollinationToggle;
    }

    resetPollinationToggle() {
        this.pollinationToggle = false;
        if (this.btnMainAction && this.currentActionState !== 'collect') {
            this.btnMainAction.classList.remove('is-active');
        }
    }

    injectMobileStyles() {
        if (document.getElementById('joystick-styles')) return;
        const style = document.createElement('style');
        style.id = 'joystick-styles';
        style.innerHTML = `
            #mobile-controls-container {
                position: fixed; top: 0; left: 0; width: 100%; height: 100%;
                pointer-events: none; z-index: 8500; display: none;
            }
            #stick-left-zone {
                position: absolute; bottom: 30px; left: 30px; 
                width: 140px; height: 140px; pointer-events: auto;
            }
            #stick-right-zone {
                position: absolute; bottom: 30px; right: 30px; 
                width: 140px; height: 140px; pointer-events: auto;
            }
            .joystick-zone {
                border-radius: 50%;
                background: rgba(255,255,255,0.08); 
                border: 2px solid rgba(255,255,255,0.15);
                position: relative;
                touch-action: none;
            }
            .joystick-knob {
                position: absolute; top: 50%; left: 50%;
                width: 60px; height: 60px; background: rgba(255, 215, 0, 0.9);
                border-radius: 50%; transform: translate(-50%, -50%);
                pointer-events: none;
            }
            #stick-right-knob { background: rgba(231, 76, 60, 0.9) !important; }
            
            .mobile-action-group {
                position: absolute; bottom: 180px; right: 30px;
                display: flex; flex-direction: column-reverse; gap: 12px;
                pointer-events: none; align-items: flex-end;
            }
            
            /* O Botão Principal agora é dinâmico e será estilizado via UIManager, 
               mas aqui definimos o chassi base */
            #btn-action {
                width: 75px; height: 75px;
                border-radius: 50%; 
                font-size: 32px; /* Aumentamos a fonte pois agora será só um emoji grande */
                display: flex; align-items: center; justify-content: center;
                pointer-events: auto; 
                user-select: none; 
                -webkit-touch-callout: none;
                -webkit-user-select: none;
            }

            #btn-rescue { 
                background: #f1c40f; 
                display: none; 
                border-color: #d35400;
                width: 60px; height: 60px; 
                font-size: 10px;
                border-radius: 50%; border: 3px solid white;
                color: white; font-weight: 900;
                pointer-events: auto; box-shadow: 0 5px 15px rgba(0,0,0,0.3);
            }
            
            #btn-action.is-active {
                transform: scale(1.1) !important;
            }

            @media (max-width: 768px) and (orientation: landscape) {
                #stick-left-zone, #stick-right-zone { width: 110px; height: 110px; }
                .mobile-action-group { bottom: 135px; right: 20px; }
                #btn-action { width: 65px; height: 65px; font-size: 26px; }
                #btn-rescue { width: 50px; height: 50px; }
            }
        `;
        document.head.appendChild(style);
    }

    injectMobileHTML() {
        if (document.getElementById('mobile-controls-container')) return;
        const div = document.createElement('div');
        div.id = 'mobile-controls-container';
        div.innerHTML = `
            <div id="stick-left-zone" class="joystick-zone"><div id="stick-left-knob" class="joystick-knob"></div></div>
            <div class="mobile-action-group">
                <button id="btn-action" data-state="default" style="
                    background: rgba(0,0,0,0.6); 
                    border: 2px solid rgba(255,255,255,0.2); 
                    box-shadow: 0 4px 6px rgba(0,0,0,0.5); 
                    transition: all 0.3s ease;
                ">🐝</button>
                
                <button id="btn-rescue" style="display:none; flex-direction:column; align-items:center; justify-content:center;"><span>❤️</span>RESGATE</button>
            </div>
            <div id="stick-right-zone" class="joystick-zone"><div id="stick-right-knob" class="joystick-knob"></div></div>
        `;
        document.body.appendChild(div);
        
        this.btnMainAction = document.getElementById('btn-action');
        this.btnRescue = document.getElementById('btn-rescue');
    }

    bindMobileActionEvents() {
        if (!this.btnMainAction || !this.btnRescue) return;
        
        // EVENTOS DO BOTÃO ÚNICO DE AÇÃO
        this.btnMainAction.addEventListener('touchstart', (e) => {
            e.preventDefault(); 
            
            // Verifica o estado atual para saber o que fazer
            if (this.currentActionState === 'collect') {
                this.isCollectingHeld = true;
                this.btnMainAction.classList.add('is-active');
            } else {
                // Se for polinizar ou default, vira um "toggle" para curar o chão
                this.pollinationToggle = !this.pollinationToggle;
                if (this.pollinationToggle) {
                    this.btnMainAction.classList.add('is-active');
                } else {
                    this.btnMainAction.classList.remove('is-active');
                }
                window.dispatchEvent(new CustomEvent('joystickInteract'));
            }
        }, { passive: false });

        this.btnMainAction.addEventListener('touchend', (e) => {
            e.preventDefault();
            // Se estava coletando, para ao soltar. Polinização continua pois é toggle.
            if (this.currentActionState === 'collect') {
                this.isCollectingHeld = false;
                this.btnMainAction.classList.remove('is-active');
            }
        }, { passive: false });

        // EVENTOS DE RESGATE
        this.btnRescue.addEventListener('touchstart', (e) => {
            e.preventDefault(); 
            this.isRescueHeld = true;
            this.btnRescue.style.transform = 'scale(0.9)';
        }, { passive: false });

        this.btnRescue.addEventListener('touchend', (e) => {
            e.preventDefault();
            this.isRescueHeld = false;
            this.btnRescue.style.transform = 'scale(1.0)';
        }, { passive: false });

        // Previne menu de contexto
        [this.btnMainAction, this.btnRescue].forEach(btn => {
            btn.oncontextmenu = (e) => { e.preventDefault(); e.stopPropagation(); return false; };
        });
    }

    /**
     * Atualiza o estado lógico dos botões com base no que o Player vê.
     * @param {Object} state - Estado do ambiente enviado pelo Game.js/Player.js
     */
    updateBeeActions(state) {
        if (!this.isMobile) return;
        
        // Determina o novo estado principal da abelha
        let newState = 'default';
        if (state.canCollect) {
            newState = 'collect';
        } else if (state.hasPollen && (state.overBurntGround || this.pollinationToggle)) {
            // Se está sobre terra queimada (ou já ativou a polinização), mostra brilho verde
            newState = 'pollinate';
        }

        // Se o estado mudou, atualiza a lógica e avisa o UIManager para mudar a arte
        if (this.currentActionState !== newState) {
            this.currentActionState = newState;
            
            // Se mudou pra algo que não seja "coletar", desativamos o held do pólen
            if (newState !== 'collect') {
                this.isCollectingHeld = false;
            }

            // Dispara evento para o UIManager pintar o botão adequadamente
            if (typeof window !== 'undefined') {
                // Nós definimos a função updateActionBtnState no UIManager, mas como o InputHandler não tem 
                // acesso direto ao objeto UI, usamos o Game.js ou disparamos um evento nativo,
                // ou simplesmente deixamos o UIManager ouvir se quisermos.
                // Para manter simples e direto com o DOM:
                this._updateVisualButton(newState);
            }
        }

        // Resgate continua sendo uma UI condicional separada
        if (this.btnRescue) {
            this.btnRescue.style.display = state.isRescue ? 'flex' : 'none';
            this.btnRescue.style.opacity = state.canAffordRescue ? "1.0" : "0.4";
        }
        
        // Se ficou sem pólen, corta o toggle
        if (!state.hasPollen && this.pollinationToggle) {
            this.resetPollinationToggle();
        }
    }

    /**
     * Método interno para não depender diretamente do UIManager aqui no Input
     */
    _updateVisualButton(state) {
        if (!this.btnMainAction) return;

        // Se a polinização já está ativa, e saímos da terra queimada, mantemos o botão verde pra mostrar que tá pingando
        if (state === 'default' && this.pollinationToggle) {
            state = 'pollinate';
        }

        this.btnMainAction.setAttribute('data-state', state);

        if (state === 'collect') {
            this.btnMainAction.innerHTML = '🍯'; 
            this.btnMainAction.style.boxShadow = '0 0 15px #f1c40f'; 
            this.btnMainAction.style.border = '2px solid #f1c40f';
            this.btnMainAction.style.background = 'rgba(241, 196, 15, 0.2)';
        } 
        else if (state === 'pollinate') {
            this.btnMainAction.innerHTML = '✨'; 
            this.btnMainAction.style.boxShadow = '0 0 15px #2ecc71'; 
            this.btnMainAction.style.border = '2px solid #2ecc71';
            this.btnMainAction.style.background = 'rgba(46, 204, 113, 0.2)';
        } 
        else {
            this.btnMainAction.innerHTML = '🐝'; 
            this.btnMainAction.style.boxShadow = '0 4px 6px rgba(0,0,0,0.5)';
            this.btnMainAction.style.border = '2px solid rgba(255,255,255,0.2)';
            this.btnMainAction.style.background = 'rgba(0,0,0,0.6)';
        }
    }

    showJoystick() {
        if (this.isMobile) {
            const el = document.getElementById('mobile-controls-container');
            if (el) el.style.display = 'block';
        }
    }
    
    hideJoystick() {
        const el = document.getElementById('mobile-controls-container');
        if (el) el.style.display = 'none';
        this.pollinationToggle = false;
        this.isCollectingHeld = false;
        this.isRescueHeld = false;
        if (this.btnMainAction) this.btnMainAction.classList.remove('is-active');
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
        if (x !== 0 && y !== 0) { 
            const len = Math.sqrt(x*x + y*y);
            x /= len; y /= len; 
        }
        return { x, y };
    }

    getAim() {
        if (this.isMobile && this.rightStick) {
            const vec = this.rightStick.vector;
            const mag = Math.sqrt(vec.x*vec.x + vec.y*vec.y);
            if (mag > 0.2 && this.pollinationToggle) this.resetPollinationToggle();
            return { x: vec.x, y: vec.y, isFiring: mag > 0.2 };
        }
        if (this.isMouseDown && this.pollinationToggle) this.resetPollinationToggle();
        return { x: this.aimVectorPC.x, y: this.aimVectorPC.y, isFiring: this.isMouseDown };
    }
}
