/**
 * UIManager.js
 * Responsável por atualizar a Interface do Usuário (HUD, Notificações, Ranking).
 * O CSS é gerenciado pelo index.html.
 */
export class UIManager {
    constructor() {
        // Nomes dos meses para o relógio do jogo
        this.months = ["JAN", "FEV", "MAR", "ABR", "MAI", "JUN", "JUL", "AGO", "SET", "OUT", "NOV", "DEZ"];
    }

    /**
     * Exibe notificações temporárias no topo da tela (Toast)
     * @param {string} msg - Mensagem a ser exibida
     */
    showError(msg) {
        const toast = document.getElementById('toast-msg');
        if (!toast) return;

        toast.innerText = msg;
        toast.style.opacity = "1";
        
        // Limpa timeout anterior se houver (para não piscar)
        if (window.toastTimeout) clearTimeout(window.toastTimeout);
        
        window.toastTimeout = setTimeout(() => {
            toast.style.opacity = "0";
        }, 3000);
    }

    /**
     * Atualiza todas as barras do HUD (Vida, XP, Pólen)
     * @param {Object} localPlayer - Objeto do jogador local
     */
    updateHUD(localPlayer) {
        if (!localPlayer) return;

        // Atualiza Nome e Nível
        const nameEl = document.getElementById('hud-name');
        const lvlEl = document.getElementById('hud-lvl');
        if (nameEl) nameEl.innerText = localPlayer.nickname;
        if (lvlEl) lvlEl.innerText = localPlayer.level;

        // Atualiza as Barras usando função auxiliar
        this._updateBar('bar-hp-fill', 'bar-hp-text', localPlayer.hp, localPlayer.maxHp);
        this._updateBar('bar-xp-fill', 'bar-xp-text', localPlayer.xp, localPlayer.maxXp);
        this._updateBar('bar-pollen-fill', 'bar-pollen-text', localPlayer.pollen, localPlayer.maxPollen);
    }

    /**
     * Auxiliar para atualizar largura e texto de uma barra
     */
    _updateBar(fillId, textId, current, max) {
        const fill = document.getElementById(fillId);
        const text = document.getElementById(textId);
        
        if (fill) {
            // Garante que não passe de 100% ou seja negativo
            const pct = Math.max(0, Math.min(100, (current / max) * 100));
            fill.style.width = `${pct}%`;
        }
        
        if (text) {
            text.innerText = `${Math.ceil(current)}/${max}`;
        }
    }

    /**
     * Atualiza o Relógio e o Overlay de Dia/Noite
     * @param {number} worldTime - Timestamp do mundo
     */
    updateEnvironment(worldTime) {
        if (!worldTime) return;
        
        const date = new Date(worldTime);
        const hours = String(date.getHours()).padStart(2, '0');
        const minutes = String(date.getMinutes()).padStart(2, '0');
        const day = String(date.getDate()).padStart(2, '0');
        const month = this.months[date.getMonth()];

        const timeEl = document.getElementById('hud-time');
        if (timeEl) {
            // Se o estilo inicial for none, mostramos agora
            if (timeEl.style.display === 'none') timeEl.style.display = 'block';
            timeEl.innerText = `${day} ${month} - ${hours}:${minutes}`;
        }

        // Lógica Dia/Noite: Senoide baseada na hora do dia
        const h = date.getHours() + date.getMinutes() / 60;
        // 0.0 = Meio dia (claro), 1.0 = Meia noite (escuro)
        const darknessIntensity = (Math.cos(h / 24 * Math.PI * 2) + 1) / 2;
        
        const overlay = document.getElementById('day-night-overlay');
        if (overlay) {
            // Limita a escuridão máxima a 80% para não ficar injogável
            overlay.style.opacity = darknessIntensity * 0.8;
        }
    }

    /**
     * Atualiza o Widget de Ranking
     */
    updateRanking(guestDataDB, localPlayer, remotePlayers) {
        // 1. Unifica dados (Jogadores offline do DB + Jogadores online)
        let rankingData = Object.entries(guestDataDB).map(([nick, stats]) => ({
            nick: nick,
            score: stats.tilesCured || 0
        }));

        // Adiciona/Atualiza Local Player na lista
        if (localPlayer) {
            const localIdx = rankingData.findIndex(r => r.nick === localPlayer.nickname);
            if (localIdx !== -1) {
                rankingData[localIdx].score = Math.max(rankingData[localIdx].score, localPlayer.tilesCured);
            } else {
                rankingData.push({ nick: localPlayer.nickname, score: localPlayer.tilesCured });
            }
        }

        // Adiciona/Atualiza Remote Players na lista
        Object.values(remotePlayers).forEach(p => {
            const idx = rankingData.findIndex(r => r.nick === p.nickname);
            if (idx !== -1) {
                rankingData[idx].score = Math.max(rankingData[idx].score, p.tilesCured);
            } else {
                rankingData.push({ nick: p.nickname, score: p.tilesCured });
            }
        });

        // 2. Ordena por pontuação (Decrescente)
        rankingData.sort((a, b) => b.score - a.score);
        
        // 3. Renderiza Top 3
        const miniList = document.getElementById('ranking-list');
        const container = document.getElementById('ranking-container');

        if (miniList && container) {
            if (rankingData.length > 0) {
                container.style.display = 'block';
                const top3 = rankingData.slice(0, 3);
                
                miniList.innerHTML = top3.map((p, index) => {
                    const medals = ['🥇', '🥈', '🥉'];
                    const prefix = index < 3 ? medals[index] : `#${index+1}`;
                    const isMe = localPlayer && p.nick === localPlayer.nickname;
                    
                    return `
                        <div class="rank-item" style="${isMe ? 'color:var(--primary); font-weight:bold' : ''}">
                            <span>${prefix} ${p.nick}</span>
                            <b>${p.score}</b>
                        </div>
                    `;
                }).join('');
            } else {
                container.style.display = 'none';
            }
        }
    }

    /**
     * Atualiza coordenadas (Debug/Info)
     */
    updateCoords(x, y) {
        const el = document.getElementById('hud-coords');
        if(el) {
            el.style.display = 'block';
            el.innerText = `X: ${Math.round(x)} Y: ${Math.round(y)}`;
        }
    }
}
