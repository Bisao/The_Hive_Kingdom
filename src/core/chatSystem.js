export class ChatSystem {
    constructor() {
        this.isVisible = false;
        this.unreadCount = 0;
        this.activeTab = 'GLOBAL'; 
        this.channels = ['GLOBAL', 'SYSTEM']; 
        this.notifications = {}; 
        this.isDropdownOpen = false;
        
        this.currentPartyName = "";
        this.currentPartyIcon = "";

        this.container = document.getElementById('chat-container');
        this.toggleBtn = document.getElementById('chat-toggle-btn');
        
        if (this.container) {
            this.rebuildDOM();
            
            this.headerTitle = document.getElementById('chat-header-title');
            this.dropdown = document.getElementById('chat-channel-dropdown');
            this.messagesBox = document.getElementById('chat-messages');
            this.input = document.getElementById('chat-input');
            this.sendBtn = document.getElementById('chat-send-btn');
            this.closeBtn = document.getElementById('chat-close-btn');

            this.injectProfessionalStyles();
            this.setupListeners();
            this.renderHeader();
        }
    }

    rebuildDOM() {
        this.container.innerHTML = `
            <div id="chat-header-area">
                <button id="chat-header-title">GLOBAL ▾</button>
                <button id="chat-close-btn">✖</button>
            </div>
            <div id="chat-channel-dropdown" class="hidden"></div>
            <div id="chat-messages"></div>
            <div id="chat-input-area">
                <input type="text" id="chat-input" placeholder="Zumbir..." maxlength="100" autocomplete="off">
                <button id="chat-send-btn">➤</button>
            </div>
        `;
    }

    injectProfessionalStyles() {
        const styleId = 'wings-chat-style';
        if (document.getElementById(styleId)) return;

        const style = document.createElement('style');
        style.id = styleId;
        style.innerHTML = `
            #chat-container {
                position: fixed;
                bottom: 180px; /* [CORREÇÃO] Subido para não bater no Joystick */
                left: 20px;
                width: 280px;
                height: 35vh;
                background: rgba(255, 248, 225, 0.98);
                border: 2px solid #FFD700;
                border-radius: 20px;
                display: flex;
                flex-direction: column;
                z-index: 9999; 
                box-shadow: 0 8px 32px rgba(0,0,0,0.3);
                transition: transform 0.2s, opacity 0.2s;
                transform: scale(0);
                opacity: 0;
                pointer-events: none;
                transform-origin: bottom left;
            }
            #chat-container.open { transform: scale(1); opacity: 1; pointer-events: auto; }
            #chat-header-area { background: #FFD700; padding: 10px; display: flex; justify-content: space-between; align-items: center; border-radius: 18px 18px 0 0; }
            #chat-header-title { background: rgba(255,255,255,0.3); border: none; border-radius: 10px; padding: 5px 12px; font-weight: 900; color: #5D4037; cursor: pointer; }
            #chat-close-btn { background:none; border:none; font-weight:bold; cursor:pointer; color:#5D4037; }
            #chat-channel-dropdown { position: absolute; top: 45px; left: 0; width: 100%; background: #FFF8E1; border-bottom: 2px solid #FFD700; z-index: 100; display: none; flex-direction: column; max-height: 150px; overflow-y: auto; }
            #chat-channel-dropdown.show { display: flex; }
            .channel-item { padding: 12px; border: none; background: none; text-align: left; font-weight: bold; color: #5D4037; cursor: pointer; border-bottom: 1px solid rgba(0,0,0,0.05); }
            .channel-item.active { background: rgba(139, 195, 74, 0.2); color: #33691E; }
            #chat-messages { flex: 1; overflow-y: auto; padding: 10px; display: flex; flex-direction: column; gap: 8px; }
            #chat-input-area { padding: 10px; background: #fff; display: flex; gap: 5px; border-radius: 0 0 18px 18px; }
            #chat-input { flex: 1; border: 2px solid #eee; border-radius: 20px; padding: 8px 15px; outline: none; }
            #chat-send-btn { background: #8BC34A; color: white; border: none; width: 40px; height: 40px; border-radius: 50%; cursor: pointer; font-weight:bold; }
        `;
        document.head.appendChild(style);
    }

    setupListeners() {
        this.toggleBtn.onclick = (e) => { e.stopPropagation(); this.toggleChat(); };
        this.closeBtn.onclick = () => this.toggleChat();
        this.headerTitle.onclick = (e) => { e.stopPropagation(); this.toggleDropdown(); };
        
        // [INTERAÇÃO] Fecha chat ao clicar fora
        document.addEventListener('pointerdown', (e) => {
            if (this.isVisible && !this.container.contains(e.target) && e.target !== this.toggleBtn) {
                this.toggleChat(false);
            }
        });

        // [INTERAÇÃO] Fecha chat se o joystick for movido (Ouvindo evento do input.js)
        window.addEventListener('joystickInteract', () => {
            if (this.isVisible) this.toggleChat(false);
        });

        this.input.onkeypress = (e) => { if (e.key === 'Enter') this.triggerSend(); };
        this.input.onkeydown = (e) => e.stopPropagation();
        this.sendBtn.onclick = () => this.triggerSend();
    }

    toggleChat(force = null) {
        this.isVisible = force !== null ? force : !this.isVisible;
        if (this.isVisible) {
            this.container.classList.add('open');
            this.toggleBtn.style.opacity = '0';
            this.toggleBtn.style.pointerEvents = 'none'; // Evita cliques fantasmas
            this.unreadCount = 0;
            this.updateNotification();
            if (!this.isMobile()) this.input.focus();
        } else {
            this.container.classList.remove('open');
            this.toggleBtn.style.opacity = '1';
            this.toggleBtn.style.pointerEvents = 'auto';
            this.toggleDropdown(false);
        }
    }

    toggleDropdown(force = null) {
        this.isDropdownOpen = force !== null ? force : !this.isDropdownOpen;
        this.dropdown.classList.toggle('show', this.isDropdownOpen);
    }

    switchTab(tab) {
        this.activeTab = tab;
        this.notifications[tab] = false;
        this.renderHeader();
        this.filterMessages();
    }

    renderHeader() {
        let label = this.activeTab === 'PARTY' ? `${this.currentPartyIcon || '👥'} ${this.currentPartyName || 'GRUPO'}` : this.activeTab;
        if (this.activeTab !== 'GLOBAL' && this.activeTab !== 'PARTY' && this.activeTab !== 'SYSTEM') {
             label = `👤 ${this.activeTab.substring(0,8)}...`;
        }
        this.headerTitle.innerText = label + " ▾";
    }

    addMessage(type, sender, text) {
        // [CORREÇÃO DUPLICAÇÃO]
        // Se a mensagem vem da rede (não é SYSTEM) e o remetente sou EU, ignoro o eco da rede
        // pois a mensagem já foi adicionada localmente pelo triggerSend.
        const myNick = localStorage.getItem('wings_nick');
        const isMe = sender === 'Você' || sender === myNick;

        // Se o tipo for PARTY ou GLOBAL e o sender for meu nick real (vindo da rede), aborta para não duplicar
        if ((type === 'PARTY' || type === 'GLOBAL') && sender === myNick) {
            return; 
        }

        let targetChannel = 'GLOBAL';
        if (type === 'SYSTEM') targetChannel = 'SYSTEM';
        else if (type === 'PARTY') targetChannel = 'PARTY';
        else if (type === 'WHISPER' || type === 'WHISPER_SELF') {
            // Se for sussurro meu, vai na aba de quem recebe. Se for de outro, vai na aba dele.
            targetChannel = (sender === 'Você' || sender === myNick) ? this.activeTab : sender;
             // Garante que o canal privado exista na lista
            if (!this.channels.includes(targetChannel) && targetChannel !== 'GLOBAL') {
                this.channels.push(targetChannel);
            }
        }

        const msgDiv = document.createElement('div');
        msgDiv.dataset.channel = targetChannel;
        msgDiv.style.padding = "8px";
        msgDiv.style.background = "rgba(255,255,255,0.6)";
        msgDiv.style.borderRadius = "8px";
        msgDiv.style.fontSize = "12px";
        msgDiv.style.lineHeight = "1.4";

        let nickColor = "#F39C12";
        if (type === 'PARTY') nickColor = "#2ecc71";
        if (isMe) nickColor = "#5D4037";

        msgDiv.innerHTML = `<b style="color:${nickColor}">${sender}:</b> <span style="color:#333">${this.escapeHTML(text)}</span>`;
        
        // [INTERAÇÃO] Clicar no nome abre o perfil e fecha o chat
        const nickElem = msgDiv.querySelector('b');
        if (!isMe && type !== 'SYSTEM') {
            nickElem.style.cursor = "pointer";
            nickElem.onclick = (e) => {
                e.stopPropagation();
                this.toggleChat(false); // Fecha chat
                window.dispatchEvent(new CustomEvent('playerClicked', { detail: sender }));
            };
        }

        this.messagesBox.appendChild(msgDiv);
        this.filterMessages();
        
        // Notificação visual se estiver fechado
        if (!this.isVisible) {
             this.unreadCount++;
             this.updateNotification();
        }
    }

    filterMessages() {
        Array.from(this.messagesBox.children).forEach(m => {
            m.style.display = m.dataset.channel === this.activeTab ? 'block' : 'none';
        });
        this.messagesBox.scrollTop = this.messagesBox.scrollHeight;
    }

    triggerSend() {
        const text = this.input.value.trim();
        if (!text) return;
        this.input.value = '';
        
        // Mantém foco apenas no PC
        if (!this.isMobile()) this.input.focus();

        if (text === '/sair' && this.channels.includes('PARTY')) {
            window.dispatchEvent(new CustomEvent('chatSend', { detail: { type: 'LEAVE_PARTY_CMD' } }));
            return;
        }

        const detail = { text, type: this.activeTab };
        if (this.activeTab !== 'GLOBAL' && this.activeTab !== 'PARTY') {
            detail.type = 'WHISPER';
            detail.target = this.activeTab;
        }
        
        // Adiciona mensagem localmente como 'Você' (Isso aparece instantaneamente)
        // O handler de rede será ignorado pelo filtro anti-duplicação
        this.addMessage(this.activeTab === 'PARTY' ? 'PARTY' : 'SELF', 'Você', text);
        
        window.dispatchEvent(new CustomEvent('chatSend', { detail }));
    }

    escapeHTML(str) {
        const p = document.createElement('p');
        p.textContent = str;
        return p.innerHTML;
    }

    isMobile() {
        return /Android|webOS|iPhone|iPad|iPod|BlackBerry|IEMobile|Opera Mini/i.test(navigator.userAgent);
    }
    
    updateNotification() {
        if (!this.toggleBtn) return;
        if (this.unreadCount > 0) {
            this.toggleBtn.style.background = "#e74c3c"; // Vermelho
            this.toggleBtn.innerHTML = `💬 <sup style="font-size:10px">${this.unreadCount}</sup>`;
        } else {
            this.toggleBtn.style.background = "#FFD700";
            this.toggleBtn.innerHTML = '💬';
        }
    }
}
