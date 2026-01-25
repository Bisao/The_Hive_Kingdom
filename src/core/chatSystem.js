export class ChatSystem {
    constructor() {
        this.isVisible = false;
        this.unreadCount = 0;
        this.activeTab = 'GLOBAL'; 
        
        this.container = document.getElementById('chat-container');
        this.toggleBtn = document.getElementById('chat-toggle-btn');
        this.messagesBox = document.getElementById('chat-messages');
        this.input = document.getElementById('chat-input');
        this.sendBtn = document.getElementById('chat-send-btn');

        this.tabGlobal = document.getElementById('tab-global');
        this.tabSystem = document.getElementById('tab-system');

        this.setupListeners();
    }

    setupListeners() {
        this.toggleBtn.onclick = () => this.toggleChat();
        this.tabGlobal.onclick = () => this.switchTab('GLOBAL');
        this.tabSystem.onclick = () => this.switchTab('SYSTEM');

        this.input.addEventListener('keypress', (e) => {
            if (e.key === 'Enter') this.triggerSend();
        });

        this.sendBtn.onclick = () => this.triggerSend();
        this.input.addEventListener('keydown', (e) => e.stopPropagation());
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
        if (tab === 'GLOBAL') {
            this.tabGlobal.classList.add('active');
            this.tabSystem.classList.remove('active');
            this.input.disabled = false;
            this.input.placeholder = "Digite sua mensagem...";
        } else {
            this.tabSystem.classList.add('active');
            this.tabGlobal.classList.remove('active');
            this.input.disabled = true; 
            this.input.placeholder = "Log do Sistema (Apenas Leitura)";
        }
        this.filterMessages();
    }

    addMessage(type, sender, text) {
        // Tipos: 'GLOBAL', 'SYSTEM', 'SELF', 'WHISPER'
        const msgDiv = document.createElement('div');
        msgDiv.className = `chat-msg msg-${type.toLowerCase()}`;
        msgDiv.dataset.type = type === 'SYSTEM' ? 'SYSTEM' : 'GLOBAL';
        
        const time = new Date().toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' });

        if (type === 'SYSTEM') {
            msgDiv.innerHTML = `<span class="msg-time">[${time}]</span> <span class="msg-text">${text}</span>`;
        } else {
            const isSelf = type === 'SELF';
            const senderName = isSelf ? 'Você' : sender;
            const colorClass = isSelf ? 'name-self' : 'name-other';
            const whisperPrefix = type === 'WHISPER' ? '<span style="color:#9b59b6">[Cochicho] </span>' : '';

            msgDiv.innerHTML = `
                <span class="msg-time">[${time}]</span> 
                ${whisperPrefix}
                <span class="${colorClass}" data-nick="${sender}">${senderName}:</span> 
                <span class="msg-text">${text}</span>
            `;

            // Adiciona evento de clique se não for o próprio jogador
            if (!isSelf) {
                const nameSpan = msgDiv.querySelector(`.${colorClass}`);
                nameSpan.onclick = () => {
                    this.toggleChat(); // Oculta o chat
                    window.dispatchEvent(new CustomEvent('playerClicked', { detail: sender }));
                };
            }
        }

        this.messagesBox.appendChild(msgDiv);
        this.scrollToBottom();

        if (!this.isVisible) {
            this.unreadCount++;
            this.updateNotification();
        }
        this.filterMessages();
    }

    filterMessages() {
        const msgs = this.messagesBox.children;
        for (let msg of msgs) {
            if (this.activeTab === 'GLOBAL') {
                if (msg.dataset.type === 'GLOBAL') msg.style.display = 'block';
                else msg.style.display = 'none';
            } else {
                if (msg.dataset.type === 'SYSTEM') msg.style.display = 'block';
                else msg.style.display = 'none';
            }
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
        window.dispatchEvent(new CustomEvent('chatSend', { detail: text }));
    }

    isMobile() {
        return /Android|webOS|iPhone|iPad|iPod|BlackBerry|IEMobile|Opera Mini/i.test(navigator.userAgent);
    }
}
