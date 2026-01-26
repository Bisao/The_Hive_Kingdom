export class UIManager {
    constructor() {
        // Elementos de Barra e Texto (HUD)
        this.bars = {
            hp: document.getElementById('bar-hp-fill'),
            xp: document.getElementById('bar-xp-fill'),
            pollen: document.getElementById('bar-pollen-fill'),
            hpText: document.getElementById('bar-hp-text'),
            xpText: document.getElementById('bar-xp-text'),
            pollenText: document.getElementById('bar-pollen-text')
        };

        // Elementos de Texto do Jogador
        this.stats = {
            name: document.getElementById('hud-name'),
            lvl: document.getElementById('hud-lvl'),
            coords: document.getElementById('hud-coords')
        };

        // Overlays e Telas Principais
        this.lobby = document.getElementById('lobby-overlay');
        this.hud = document.getElementById('rpg-hud');
        this.faintScreen = document.getElementById('faint-screen');
        this.suffocation = document.getElementById('suffocation-overlay');
        this.statusMsg = document.getElementById('status-msg');

        // Modais e Listas
        this.playerModal = document.getElementById('player-modal');
        this.partyInvite = document.getElementById('party-invite-popup');
        this.rankingList = document.getElementById('ranking-list');
    }

    /**
     * Alterna do menu para o jogo real
     */
    showGameInterface() {
        if (this.lobby) this.lobby.style.display = 'none';
        if (this.hud) this.hud.style.display = 'block';
        
        // Garante que o canvas apareça
        const canvas = document.getElementById('gameCanvas');
        if (canvas) canvas.style.display = 'block';

        // Ativa o botão do chat (que no seu HTML tem ID 'chat-toggle-btn')
        const chatBtn = document.getElementById('chat-toggle-btn');
        if (chatBtn) chatBtn.style.display = 'block';

        if (window.logDebug) window.logDebug("Interface de jogo ativada.", "#2ecc71");
    }

    /**
     * Atualiza todas as barras e textos do HUD
     */
    updateStats(player) {
        if (!player) return;

        // Atualiza textos básicos
        if (this.stats.name) this.stats.name.innerText = player.nickname;
        if (this.stats.lvl) this.stats.lvl.innerText = player.level;
        if (this.stats.coords) {
            this.stats.coords.innerText = `${Math.round(player.pos.x)}, ${Math.round(player.pos.y)}`;
        }

        // Atualiza preenchimento das barras (%)
        if (this.bars.hp) this.bars.hp.style.width = `${(player.hp / player.maxHp) * 100}%`;
        if (this.bars.xp) this.bars.xp.style.width = `${(player.xp / player.maxXp) * 100}%`;
        if (this.bars.pollen) this.bars.pollen.style.width = `${(player.pollen / player.maxPollen) * 100}%`;

        // Atualiza textos numéricos (Ex: 100/100)
        if (this.bars.hpText) this.bars.hpText.innerText = `${Math.ceil(player.hp)}/${player.maxHp}`;
        if (this.bars.xpText) this.bars.xpText.innerText = `${Math.floor(player.xp)}/${player.maxXp}`;
        if (this.bars.pollenText) this.bars.pollenText.innerText = `${player.pollen}/${player.maxPollen}`;
    }

    /**
     * Controla o filtro de 'sufocamento' (vinheta preta)
     */
    updateSuffocation(hpPercent) {
        if (!this.suffocation) return;
        // Começa a escurecer abaixo de 60% de vida
        const intensity = Math.max(0, (0.6 - hpPercent) * 1.6);
        this.suffocation.style.opacity = intensity;
    }

    /**
     * Reconstrói a lista de classificação no HUD
     */
    updateRanking(players) {
        if (!this.rankingList) return;
        
        // Ordena por tiles curados antes de renderizar
        const sorted = [...players].sort((a, b) => b.tilesCured - a.tilesCured);

        this.rankingList.innerHTML = sorted.map((p, i) => `
            <div style="display:flex; justify-content:space-between; margin-bottom:4px; font-size:11px; opacity:${p.isOnline ? 1 : 0.4}">
                <span>${i + 1}. ${p.nickname}</span>
                <span style="color:var(--primary)">${p.tilesCured}🌻</span>
            </div>
        `).join('');
    }

    /**
     * Exibe mensagens de status no Lobby (erros de senha, conexão, etc)
     */
    displayStatus(msg, isError = true) {
        if (this.statusMsg) {
            this.statusMsg.style.color = isError ? "var(--danger)" : "var(--accent-green)";
            this.statusMsg.innerText = msg;
        }
    }

    showFaintScreen() {
        if (this.faintScreen) this.faintScreen.style.display = 'flex';
    }

    hideFaintScreen() {
        if (this.faintScreen) this.faintScreen.style.display = 'none';
    }

    // --- MODAIS DE INTERAÇÃO ---

    openPlayerModal(nickname, level, isPartner) {
        if (!this.playerModal) return;
        
        const nameEl = document.getElementById('modal-player-name');
        const infoEl = document.getElementById('modal-player-info');
        const partyBtn = document.getElementById('btn-party-action');

        if (nameEl) nameEl.innerText = nickname;
        if (infoEl) infoEl.innerText = `Nível: ${level}`;
        if (partyBtn) {
            partyBtn.innerText = isPartner ? "SAIR DO GRUPO" : "CONVIDAR PARA GRUPO";
            partyBtn.style.background = isPartner ? "var(--danger)" : "var(--primary)";
        }

        this.playerModal.style.display = 'block';
    }

    showPartyInvite(fromNick) {
        if (!this.partyInvite) return;
        const msgEl = document.getElementById('invite-msg');
        if (msgEl) msgEl.innerText = `CONVITE DE ${fromNick.toUpperCase()}`;
        this.partyInvite.style.display = 'block';
    }

    closePartyInvite() {
        if (this.partyInvite) this.partyInvite.style.display = 'none';
    }
}
