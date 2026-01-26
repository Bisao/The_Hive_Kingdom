export class ChatSystem {
    constructor() {
        this.isVisible = false;
        this.unreadCount = 0;
        this.activeTab = 'GLOBAL'; 
        this.channels = ['GLOBAL', 'SYSTEM']; 
        this.notifications = {}; 
        
        this.container = document.getElementById('chat-container');
        this.toggleBtn = document.getElementById('chat-toggle-btn');
        this.tabsContainer = document.getElementById('chat-tabs-container');
        this.messagesBox = document.getElementById('chat-messages');
        this.input = document.getElementById('chat-input');
        this.sendBtn = document.getElementById('chat-send-btn');

        this.onChatOpen = null;
        this.onChatClose = null;

        if (this.container) {
            this.setupListeners();
            this.renderTabs();
        }
    }

    setupListeners() {
        this.toggleBtn.onclick = () => this.toggleChat();
        
        this.input.addEventListener('keypress', (e) => {
            if (e.key === 'Enter') this.triggerSend();
        });

        this.sendBtn.onclick = () => this.triggerSend();
        this.input.addEventListener('keydown', (e) => e.stopPropagation());
    }

    renderTabs() {
        this.tabsContainer.innerHTML = '';
        this.channels.forEach(channel => {
            const btn = document.createElement('button');
            const hasNotify = this.notifications[channel] && this.activeTab !== channel;
            
            btn.className = `chat-tab ${this.activeTab === channel ? 'active' : ''} ${hasNotify ? 'notify' : ''}`;
            
            let label = channel;
            if (channel === 'PARTY') label = `👥 GROUP`;
            else if (channel !== 'GLOBAL' && channel !== 'SYSTEM') {
                label = `👤 ${channel.substring(0, 8)}`; 
            }

            btn.innerText = label;
            btn.onclick = () => this.switchTab(channel);
            this.tabsContainer.appendChild(btn);
        });
    }

    toggleChat() {
        this.isVisible = !this.isVisible;
        if (this.isVisible) {
            this.container.classList.add('visible');
            this.toggleBtn.classList.add('open');
            this.toggleBtn.innerHTML = '✖'; 
            this.unreadCount = 0;
            this.updateNotification();
            if(this.onChatOpen) this.onChatOpen();
            if (!this.isMobile()) this.input.focus();
        } else {
            this.container.classList.remove('visible');
            this.toggleBtn.classList.remove('open');
            this.toggleBtn.innerHTML = '💬'; 
            if(this.onChatClose) this.onChatClose();
        }
    }

    switchTab(tab) {
        this.activeTab = tab;
        this.notifications[tab] = false; 
        
        if (tab === 'SYSTEM') {
            this.input.disabled = true;
            this.input.placeholder = "Apenas leitura...";
        } else {
            this.input.disabled = false;
            this.input.placeholder = tab === 'GLOBAL' ? "Mensagem Global..." : (tab === 'PARTY' ? "Mensagem para o Grupo..." : `Cochichar para ${tab}...`);
        }

        this.renderTabs();
        this.filterMessages();
    }

    openPartyTab() {
        if (!this.channels.includes('PARTY')) {
            this.channels.push('PARTY');
            this.addMessage('SYSTEM', null, 'Chat de grupo liberado.');
        }
        this.renderTabs();
    }

    closePartyTab() {
        this.channels = this.channels.filter(c => c !== 'PARTY');
        if (this.activeTab === 'PARTY') this.switchTab('GLOBAL');
        this.renderTabs();
        this.addMessage('SYSTEM', null, 'Grupo encerrado.');
    }

    openPrivateTab(targetNick) {
        if (!this.channels.includes(targetNick)) {
            this.channels.push(targetNick);
        }
        this.switchTab(targetNick);
        if (!this.isVisible) this.toggleChat();
    }

    addMessage(type, sender, text) {
        let targetChannel = 'GLOBAL';
        if (type === 'SYSTEM') targetChannel = 'SYSTEM';
        else if (type === 'PARTY') targetChannel = 'PARTY';
        else if (type === 'WHISPER' || type === 'WHISPER_SELF') {
            targetChannel = sender;
            if (!this.channels.includes(targetChannel)) {
                this.channels.push(targetChannel);
                this.renderTabs();
            }
        }
        if (type === 'SELF') targetChannel = 'GLOBAL';

        const msgDiv = document.createElement('div');
        msgDiv.className = `chat-msg msg-${type.toLowerCase().replace('_self', '')}`;
        msgDiv.dataset.channel = targetChannel;
        
        const time = new Date().toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' });

        if (type === 'SYSTEM') {
            msgDiv.innerHTML = `<span class="msg-time">${time}</span> <span class="msg-content system">💡 ${text}</span>`;
        } else {
            const isSelf = type === 'SELF' || type === 'WHISPER_SELF' || (type === 'PARTY' && sender === 'Você');
            const senderDisplayName = isSelf ? 'Você' : sender;
            let badge = '';
            if (type === 'WHISPER' || type === 'WHISPER_SELF') badge = '<span class="badge lock">🔒</span>';
            if (type === 'PARTY') badge = '<span class="badge party">🛡️</span>';

            msgDiv.innerHTML = `
                <div class="msg-header">
                    <span class="msg-time">${time}</span>
                    <span class="msg-author ${isSelf ? 'self' : ''}" data-nick="${sender}">${badge}${senderDisplayName}</span>
                </div>
                <div class="msg-content">${this.escapeHTML(text)}</div>
            `;
            
            if (!isSelf && type === 'GLOBAL') {
                msgDiv.querySelector('.msg-author').onclick = (e) => {
                    e.stopPropagation();
                    window.dispatchEvent(new CustomEvent('playerClicked', { detail: sender }));
                };
            }
        }

        this.messagesBox.appendChild(msgDiv);
        this.limitMessages(200);

        if (this.activeTab !== targetChannel) {
            this.notifications[targetChannel] = true;
            this.renderTabs();
        }

        if (!this.isVisible && type !== 'SYSTEM') {
            this.unreadCount++;
            this.updateNotification();
        }
        this.filterMessages();
        this.scrollToBottom();
    }

    limitMessages(limit) {
        while (this.messagesBox.children.length > limit) this.messagesBox.removeChild(this.messagesBox.firstChild);
    }

    filterMessages() {
        Array.from(this.messagesBox.children).forEach(msg => {
            msg.style.display = (msg.dataset.channel === this.activeTab) ? 'block' : 'none';
        });
        this.scrollToBottom();
    }

    scrollToBottom() {
        this.messagesBox.scrollTop = this.messagesBox.scrollHeight;
    }

    updateNotification() {
        if (this.unreadCount > 0) {
            this.toggleBtn.classList.add('notify');
            this.toggleBtn.setAttribute('data-count', this.unreadCount);
        } else {
            this.toggleBtn.classList.remove('notify');
            this.toggleBtn.removeAttribute('data-count');
        }
    }

    triggerSend() {
        const text = this.input.value.trim();
        if (!text) return;
        this.input.value = '';

        if (this.activeTab === 'GLOBAL') {
            window.dispatchEvent(new CustomEvent('chatSend', { detail: { type: 'GLOBAL', text } }));
            this.addMessage('SELF', 'Você', text);
        } else if (this.activeTab === 'PARTY') {
            window.dispatchEvent(new CustomEvent('chatSend', { detail: { type: 'PARTY', text } }));
            this.addMessage('PARTY', 'Você', text);
        } else {
            window.dispatchEvent(new CustomEvent('chatSend', { detail: { type: 'WHISPER', target: this.activeTab, text } }));
            this.addMessage('WHISPER_SELF', this.activeTab, text);
        }
    }

    escapeHTML(str) {
        const p = document.createElement('p');
        p.textContent = str;
        return p.innerHTML;
    }

    isMobile() {
        return /Android|webOS|iPhone|iPad|iPod|BlackBerry|IEMobile|Opera Mini/i.test(navigator.userAgent);
    }
}
