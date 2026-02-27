/**
 * UIManager.js
 * Gerencia a Interface do Usuário, Notificações e Feedback Visual.
 * Atualizado para suportar a renderização do Gerenciador de Colmeias (Saves) e feedback profissional.
 */
export class UIManager {
    constructor() {
        // Nomes dos meses para o relógio do jogo
        this.months = ["JAN", "FEV", "MAR", "ABR", "MAI", "JUN", "JUL", "AGO", "SET", "OUT", "NOV", "DEZ"];
        this.toastTimeout = null;
    }

    /**
     * Exibe notificações temporárias no topo da tela.
     * @param {string} msg - Texto da mensagem.
     * @param {string} type - Tipo da mensagem: 'error', 'success', 'info'.
     */
    showToast(msg, type = 'info') {
        const toast = document.getElementById('toast-msg');
        if (!toast) return;

        toast.innerText = msg;
        
        // Define cores baseadas no tipo de mensagem (Gradientes Profissionais)
        if (type === 'error') {
            toast.style.background = "linear-gradient(135deg, #e74c3c, #c0392b)"; // Vermelho
            toast.style.color = "white";
        } else if (type === 'success') {
            toast.style.background = "linear-gradient(135deg, #2ecc71, #27ae60)"; // Verde
            toast.style.color = "white";
        } else {
            toast.style.background = "linear-gradient(135deg, #FFD700, #F39C12)"; // Amarelo (Padrão)
            toast.style.color = "#222";
        }

        toast.style.opacity = "1";
        toast.style.transform = "translateX(-50%) translateY(0)"; // Efeito de descida

        // Limpa timeout anterior para evitar conflitos de sobreposição
        if (this.toastTimeout) clearTimeout(this.toastTimeout);
        
        this.toastTimeout = setTimeout(() => {
            toast.style.opacity = "0";
            toast.style.transform = "translateX(-50%) translateY(-20px)"; // Efeito de subida
        }, 3000);
    }

    /**
     * Mantém compatibilidade com chamadas de erro do sistema.
     */
    showError(msg) {
        this.showToast(msg, 'error');
    }

    /**
     * Atualiza todas as informações do HUD (Barra de Status, Nível, Nome).
     * @param {Object} localPlayer - O objeto do jogador local.
     */
    updateHUD(localPlayer) {
        if (!localPlayer) return;

        // Atualiza Texto de Nome e Nível
        const nameEl = document.getElementById('hud-name');
        const lvlEl = document.getElementById('hud-lvl');
        
        if (nameEl) nameEl.innerText = localPlayer.nickname;
        if (lvlEl) lvlEl.innerText = localPlayer.level;

        // Atualiza Barras de Status
        this._updateBar('bar-hp-fill', 'bar-hp-text', localPlayer.hp, localPlayer.maxHp);
        this._updateBar('bar-xp-fill', 'bar-xp-text', localPlayer.xp, localPlayer.maxXp);
        this._updateBar('bar-pollen-fill', 'bar-pollen-text', localPlayer.pollen, localPlayer.maxPollen);

        // Feedback visual de Dano Crítico (Vignette Vermelha)
        const hpRatio = localPlayer.hp / localPlayer.maxHp;
        const lowHpOverlay = document.getElementById('suffocation-overlay');
        if (lowHpOverlay) {
            // Começa a aparecer abaixo de 40% de vida
            if (hpRatio < 0.4) {
                lowHpOverlay.style.opacity = (0.4 - hpRatio) * 1.5; 
            } else {
                lowHpOverlay.style.opacity = 0;
            }
        }
    }

    /**
     * Função auxiliar interna para atualizar e animar as barras de HUD.
     */
    _updateBar(fillId, textId, current, max) {
        const fill = document.getElementById(fillId);
        const text = document.getElementById(textId);
        
        if (fill) {
            // Garante porcentagem válida entre 0% e 100%
            const pct = Math.max(0, Math.min(100, (current / max) * 100));
            fill.style.width = `${pct}%`;
            
            // Adiciona um brilho extra se a barra estiver cheia (Pólen)
            if (fillId === 'bar-pollen-fill' && pct >= 100) {
                fill.style.boxShadow = "0 0 10px #f1c40f";
            } else {
                fill.style.boxShadow = "none";
            }
        }
        
        if (text) {
            text.innerText = `${Math.floor(Math.max(0, current))}/${Math.floor(max)}`;
        }
    }

    /**
     * Atualiza o Relógio do Mundo e o efeito de Iluminação Global (Dia/Noite).
     * @param {number} worldTime - Timestamp do servidor de tempo do mundo.
     */
    updateEnvironment(worldTime) {
        if (!worldTime) return;
        
        const date = new Date(worldTime);
        const hours = date.getHours();
        const minutes = date.getMinutes();
        
        const displayTime = `${String(hours).padStart(2, '0')}:${String(minutes).padStart(2, '0')}`;
        const displayDate = `${String(date.getDate()).padStart(2, '0')} ${this.months[date.getMonth()]}`;

        // Atualiza Elemento do HUD
        const timeEl = document.getElementById('hud-time');
        if (timeEl) {
            timeEl.innerText = `${displayDate} - ${displayTime}`;
        }

        // LÓGICA DE ILUMINAÇÃO GLOBAL (Dia/Noite)
        // O h representa a hora decimal (ex: 14.5 para 14:30)
        const h = hours + minutes / 60;
        
        // Calculamos a intensidade da escuridão usando uma função de cosseno
        // O ponto mais claro é às 12:00 e o mais escuro às 00:00.
        let darkness = (Math.cos((h / 24) * Math.PI * 2) + 1) / 2;
        
        // Ajuste de curva exponencial para tornar o pôr do sol mais dramático
        darkness = Math.pow(darkness, 0.6);

        const overlay = document.getElementById('day-night-overlay');
        if (overlay) {
            // Escuridão máxima limitada a 80% para manter jogabilidade
            overlay.style.opacity = darkness * 0.8;
            
            // Ajuste de contraste do relógio dependendo da luz
            if (timeEl) {
                if (darkness > 0.6) {
                    timeEl.style.color = "#f1c40f"; // Dourado na noite
                    timeEl.style.background = "rgba(0,0,0,0.6)";
                } else {
                    timeEl.style.color = "#2c3e50"; // Escuro no dia
                    timeEl.style.background = "rgba(255,255,255,0.4)";
                }
            }
        }
    }

    /**
     * Atualiza o Ranking de Jogadores baseado em Tiles Curados.
     * @param {Object} guestDataDB - Banco de dados de jogadores offline.
     * @param {Object} localPlayer - Instância do jogador local.
     * @param {Object} remotePlayers - Dicionário de jogadores online.
     */
    updateRanking(guestDataDB, localPlayer, remotePlayers) {
        // 1. Consolida todos os jogadores conhecidos em um array único
        let ranking = [];

        // Adiciona dados salvos (Histórico)
        Object.entries(guestDataDB || {}).forEach(([nick, stats]) => {
            ranking.push({ nick, score: stats.tilesCured || 0, online: false });
        });

        // Adiciona/Atualiza o Player Local
        if (localPlayer) {
            const me = ranking.find(r => r.nick === localPlayer.nickname);
            if (me) {
                me.score = Math.max(me.score, localPlayer.tilesCured);
                me.online = true;
            } else {
                ranking.push({ nick: localPlayer.nickname, score: localPlayer.tilesCured, online: true });
            }
        }

        // Adiciona/Atualiza Players Remotos ativos
        Object.values(remotePlayers).forEach(p => {
            if (!p.nickname) return;
            const entry = ranking.find(r => r.nick === p.nickname);
            if (entry) {
                entry.score = Math.max(entry.score, p.tilesCured);
                entry.online = true;
            } else {
                ranking.push({ nick: p.nickname, score: p.tilesCured, online: true });
            }
        });

        // 2. Ordena por maior score
        ranking.sort((a, b) => b.score - a.score);
        
        // Remove nicks duplicados (mantendo o maior score)
        const uniqueRanking = [];
        const seenNicks = new Set();
        for (const item of ranking) {
            if (!seenNicks.has(item.nick)) {
                seenNicks.add(item.nick);
                uniqueRanking.push(item);
            }
        }

        // 3. Renderiza no HUD
        const listEl = document.getElementById('ranking-list');
        const container = document.getElementById('ranking-container');

        if (listEl && container) {
            if (uniqueRanking.length > 0) {
                container.style.display = 'block';
                listEl.innerHTML = uniqueRanking.slice(0, 5).map((p, i) => {
                    const medals = ['🥇', '🥈', '🥉'];
                    const prefix = i < 3 ? medals[i] : `<span class="rank-num">#${i+1}</span>`;
                    const isMe = localPlayer && p.nick === localPlayer.nickname;
                    
                    return `
                        <div class="rank-item ${isMe ? 'is-me' : ''}" style="${isMe ? 'color:#f1c40f; font-weight:900; background:rgba(255,255,255,0.1); border-radius:4px; padding:2px;' : ''}">
                            <div class="rank-info" style="display:flex; gap:5px; align-items:center;">
                                ${prefix} 
                                <span class="rank-nick">${p.nick}</span>
                                ${p.online ? '<span class="online-dot" style="width:8px; height:8px; background:#2ecc71; border-radius:50%; display:inline-block;"></span>' : ''}
                            </div>
                            <span class="rank-score" style="color:${isMe ? '#f1c40f' : '#2ecc71'}; font-weight:bold;">${p.score}</span>
                        </div>
                    `;
                }).join('');
            } else {
                container.style.display = 'none';
            }
        }
    }

    /**
     * Exibe coordenadas e debug de performance.
     */
    updateCoords(x, y) {
        const el = document.getElementById('hud-coords');
        if(el) {
            el.style.display = 'block';
            el.innerHTML = `COORD: <b>${Math.round(x)}</b>, <b>${Math.round(y)}</b>`;
        }
    }

    /**
     * Renderiza o Menu de Seleção de Colmeias (Saves).
     * @param {Object} saveSystem - Instância do sistema de arquivos.
     * @param {Function} onEnterWorld - Callback para iniciar o jogo.
     */
    renderSaveList(saveSystem, onEnterWorld) {
        const container = document.getElementById('save-list-container');
        if (!container) return;

        const saves = saveSystem.listAllSaves();

        if (saves.length === 0) {
            container.innerHTML = `
                <div class="empty-saves" style="text-align: center; color: #aaa; font-size: 14px; margin-top: 20px;">
                    <p>Nenhuma colmeia encontrada neste jardim...</p>
                    <small>Crie um novo mundo para começar!</small>
                </div>
            `;
            return;
        }

        container.innerHTML = ''; 

        saves.forEach(save => {
            const date = new Date(save.timestamp);
            const dateStr = date.toLocaleDateString();
            const timeStr = date.toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' });

            const card = document.createElement('div');
            card.className = 'save-card';
            
            card.innerHTML = `
                <div class="save-card-header">
                    <div>
                        <div class="save-card-title">${save.id}</div>
                        <div class="save-card-subtitle">Último voo: ${dateStr} às ${timeStr}</div>
                    </div>
                    <button class="btn-delete-save" title="Destruir Colmeia">🗑️</button>
                </div>
                <div class="save-card-details">
                    <div class="save-detail-row">
                        <span>Abelha Mestra:</span> 
                        <span class="save-detail-val" style="color:var(--primary); font-weight:bold;">${save.meta.nick} (Lv ${save.meta.level || 1})</span>
                    </div>
                    <div class="save-detail-row">
                        <span>Semente do Mundo:</span> 
                        <span class="save-detail-val">${save.meta.seed}</span>
                    </div>
                    <div class="save-detail-row">
                        <span>Senha:</span>
                        <div>
                            <span class="save-detail-val pass-text" data-hidden="true" data-pass="${save.meta.pass || ''}">${save.meta.pass ? '****' : 'Aberta (Sem Senha)'}</span>
                            ${save.meta.pass ? '<span class="pass-toggle" onclick="toggleSavePassword(this)" title="Mostrar/Esconder">👁️</span>' : ''}
                        </div>
                    </div>
                    <div style="display:flex; gap:10px; margin-top:15px;">
                        <button class="btn-action btn-load-save" style="margin:0; width:100%;">ENTRAR NA COLMEIA</button>
                    </div>
                </div>
            `;

            // EVENTO 1: Expandir / Retrair o card
            card.addEventListener('click', (e) => {
                if (e.target.closest('.btn-delete-save') || e.target.closest('.btn-load-save') || e.target.closest('.pass-toggle')) {
                    return;
                }
                document.querySelectorAll('.save-card').forEach(c => {
                    if (c !== card) c.classList.remove('expanded');
                });
                card.classList.toggle('expanded');
            });

            // EVENTO 2: Botão VOAR (Carregar Mundo)
            const btnLoad = card.querySelector('.btn-load-save');
            btnLoad.addEventListener('click', () => {
                if (onEnterWorld && typeof onEnterWorld === 'function') {
                    onEnterWorld(save.id, save.meta.pass, save.meta.seed, save.meta.nick);
                }
            });

            // EVENTO 3: Lixeira (Excluir Mundo)
            const btnDelete = card.querySelector('.btn-delete-save');
            btnDelete.addEventListener('click', (e) => {
                e.stopPropagation();
                const popup = document.getElementById('delete-confirm-popup');
                const btnConfirm = document.getElementById('btn-confirm-delete');
                
                // Se existir um popup customizado no HTML, usa ele. Se não, usa o confirm nativo.
                if (popup && btnConfirm) {
                    popup.style.display = 'flex';
                    btnConfirm.onclick = () => {
                        saveSystem.deleteSave(save.id);
                        this.showToast(`Colmeia ${save.id} destruída.`, 'success');
                        popup.style.display = 'none';
                        this.renderSaveList(saveSystem, onEnterWorld);
                    };
                } else {
                    if (confirm(`Deseja realmente apagar a colmeia ${save.id}? Esta ação é permanente.`)) {
                        saveSystem.deleteSave(save.id);
                        this.showToast(`Colmeia ${save.id} destruída.`, 'success');
                        this.renderSaveList(saveSystem, onEnterWorld);
                    }
                }
            });

            container.appendChild(card);
        });
    }
}
