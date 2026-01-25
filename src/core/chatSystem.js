export class ChatSystem {
    constructor() {
        this.isVisible = false;
        this.unreadCount = 0;
        this.activeTab = 'GLOBAL'; // Canal atual
        this.channels = ['GLOBAL', 'SYSTEM']; // Canais base
        
        this.container = document.getElementById('chat-container');
        this.toggleBtn = document.getElementById('chat-toggle-btn');
        this.tabsContainer = document.getElementById('chat-tabs-container');
        this.messagesBox = document.getElementById('chat-messages');
        this.input = document.getElementById('chat-input');
        this.sendBtn = document.getElementById('chat-send-btn');

        this.setupListeners();
        this.renderTabs(); // Inicializa Global e Sistema
    }

    setupListeners() {
        this.toggleBtn.onclick = () => this.toggleChat();
        
        this.input.addEventListener('keypress', (e) => {
            if (e.key === 'Enter') this.triggerSend();
        });

        this.sendBtn.onclick = () => this.triggerSend();
        this.input.addEventListener('keydown', (e) => e.stopPropagation());
    }

    // Cria as abas visualmente no container
    renderTabs() {
        this.tabsContainer.innerHTML = '';
        this.channels.forEach(channel => {
            const btn = document.createElement('button');
            btn.className = `chat-tab ${this.activeTab === channel ? 'active' : ''}`;
            
            // Texto legível para a aba
            let label = channel;
            if (channel !== 'GLOBAL' && channel !== 'SYSTEM') {
                label = `🔒 ${channel}`; // Indica que é privado
            }

            btn.innerText = label;
            btn.onclick = () => this.switchTab(channel);
            this.tabsContainer.appendChild(btn);
        });
    }

    toggleChat() {
        this.isVisible = !this.isVisible;
        if (this.isVisible) {
            this.container.style.display = 'flex';
            this.toggleBtn.classList.add('open');
            this.toggleBtn.innerHTML = '◀'; 
            this.unreadCount = 0;
            this.updateNotification();
            if (!this.isMobile()) this.input.focus();
        } else {
            this.container.style.display = 'none';
            this.toggleBtn.classList.remove('open');
            this.toggleBtn.innerHTML = '💬'; 
        }
    }

    switchTab(tab) {
        this.activeTab = tab;
        
        // Regras de Input
        if (tab === 'SYSTEM') {
            this.input.disabled = true;
            this.input.placeholder = "Apenas leitura...";
        } else {
            this.input.disabled = false;
            this.input.placeholder = tab === 'GLOBAL' ? "Mensagem Global..." : `Cochichar para ${tab}...`;
        }

        this.renderTabs();
        this.filterMessages();
    }

    // Garante que uma aba de cochicho exista e foca nela
    openPrivateTab(targetNick) {
        if (!this.channels.includes(targetNick)) {
            this.channels.push(targetNick);
        }
        this.switchTab(targetNick);
        if (!this.isVisible) this.toggleChat();
    }

    addMessage(type, sender, text) {
        // Define em qual canal essa mensagem deve morar
        let targetChannel = 'GLOBAL';
        if (type === 'SYSTEM') targetChannel = 'SYSTEM';
        if (type === 'WHISPER' || type === 'WHISPER_SELF') {
            // Se for cochicho, o canal é o nome da outra pessoa
            targetChannel = (type === 'WHISPER_SELF') ? sender : sender; 
            
            // Auto-cria aba se não existir
            if (!this.channels.includes(targetChannel)) {
                this.channels.push(targetChannel);
                this.renderTabs();
            }
        }

        const msgDiv = document.createElement('div');
        msgDiv.className = `chat-msg msg-${type.toLowerCase().replace('_self', '')}`;
        msgDiv.dataset.channel = targetChannel;
        
        const time = new Date().toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' });

        if (type === 'SYSTEM') {
            msgDiv.innerHTML = `<span class="msg-time">[${time}]</span> <span class="msg-text">${text}</span>`;
        } else {
            const isSelf = type === 'SELF' || type === 'WHISPER_SELF';
            const senderDisplayName = isSelf ? 'Você' : sender;
            const colorClass = isSelf ? 'name-self' : 'name-other';
            const prefix = (type === 'WHISPER' || type === 'WHISPER_SELF') ? '🔒 ' : '';

            msgDiv.innerHTML = `
                <span class="msg-time">[${time}]</span> 
                <span class="${colorClass}" data-nick="${sender}">${prefix}${senderDisplayName}:</span> 
                <span class="msg-text">${text}</span>
            `;

            // Clique no nome para abrir interações (apenas no Global)
            if (!isSelf && type === 'GLOBAL') {
                const nameSpan = msgDiv.querySelector(`.${colorClass}`);
                nameSpan.onclick = (e) => {
                    e.stopPropagation();
                    window.dispatchEvent(new CustomEvent('playerClicked', { detail: sender }));
                };
            }
        }

        this.messagesBox.appendChild(msgDiv);
        this.scrollToBottom();

        // Lógica de Notificação (Ignora SYSTEM)
        if (!this.isVisible && type !== 'SYSTEM') {
            this.unreadCount++;
            this.updateNotification();
        }

        this.filterMessages();
    }

    filterMessages() {
        const msgs = this.messagesBox.children;
        for (let msg of msgs) {
            // Só mostra mensagens que pertencem ao canal (aba) ativa
            msg.style.display = (msg.dataset.channel === this.activeTab) ? 'block' : 'none';
        }
        this.scrollToBottom();
    }

    scrollToBottom() {
        this.messagesBox.scrollTop = this.messagesBox.scrollHeight;
    }

    updateNotification() {
        if (this.unreadCount > 0) this.toggleBtn.classList.add('notify');
        else this.toggleBtn.classList.remove('notify');
    }

    triggerSend() {
        const text = this.input.value.trim();
        if (!text) return;

        this.input.value = '';

        if (this.activeTab === 'GLOBAL') {
            window.dispatchEvent(new CustomEvent('chatSend', { detail: { type: 'GLOBAL', text } }));
        } else {
            // Envia como cochicho para o nome da aba ativa
            window.dispatchEvent(new CustomEvent('chatSend', { 
                detail: { type: 'WHISPER', target: this.activeTab, text } 
            }));
            // Adiciona visualmente para nós mesmos
            this.addMessage('WHISPER_SELF', this.activeTab, text);
        }
    }

    isMobile() {
        return /Android|webOS|iPhone|iPad|iPod|BlackBerry|IEMobile|Opera Mini/i.test(navigator.userAgent);
    }
}
