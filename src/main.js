import { NetworkManager } from './core/network.js';
import { WorldState } from './world/worldState.js';
import { InputHandler } from './core/input.js';
import { SaveSystem } from './core/saveSystem.js';
import { ChatSystem } from './core/chatSystem.js';
import { UIManager } from './managers/UIManager.js';
import { GameManager } from './managers/GameManager.js';

// --- 1. INICIALIZAÇÃO DOS MÓDULOS ---
const log = (msg, color) => { if (window.logDebug) window.logDebug(msg, color); };

log("Carregando módulos centrais...", "#f1c40f");

const net = new NetworkManager();
const input = new InputHandler(); 
const worldState = new WorldState();
const saveSystem = new SaveSystem();
const chat = new ChatSystem();
const ui = new UIManager();

// --- 2. INSTANCIAÇÃO DO MOTOR DO JOGO ---
const gameManager = new GameManager(net, input, worldState, saveSystem, chat, ui);

// --- 3. CONFIGURAÇÃO DE EVENTOS DE INTERFACE ---

// Sincroniza o foco do chat com o InputHandler para evitar movimento ao digitar
chat.onChatOpen = () => input.setChatMode(true);
chat.onChatClose = () => input.setChatMode(false);

// --- 4. LÓGICA DO LOBBY (HOSPEDAR / ENTRAR) ---

// BOTÃO: INICIAR COLMEIA (HOST)
const btnCreate = document.getElementById('btn-create');
if (btnCreate) {
    btnCreate.onclick = () => {
        // Ativa Fullscreen via função definida no index.html
        if (window.requestGameFullscreen) window.requestGameFullscreen();

        const nick = document.getElementById('host-nickname').value.trim() || "Rainha";
        const id = document.getElementById('create-id').value.trim();
        const pass = document.getElementById('create-pass').value.trim();
        const seed = document.getElementById('world-seed').value.trim() || "FLORESTA_ETERNAL";
        
        if (!id) {
            ui.displayStatus("ERRO: O Código da Colmeia (ID) é obrigatório.", true);
            return;
        }

        ui.displayStatus(`Iniciando colmeia ${id}...`, false);
        log(`Hospedando sala: ${id}`);
        
        net.init(id, (ok, errorType) => {
            if (ok) {
                // Configura o servidor P2P
                net.hostRoom(id, pass, seed, 
                    () => worldState.getFullState(), 
                    (guestNick) => gameManager.guestDataDB[guestNick],
                    () => gameManager.guestDataDB 
                );
                
                // Inicia o loop do jogo como Host
                gameManager.startGame(seed, id, nick, true);
                log("Mundo pronto. Aguardando polinizadores.", "#2ecc71");
            } else { 
                ui.displayStatus(`Erro PeerJS: ${errorType}`, true);
                log(`Falha no Host: ${errorType}`, "#e74c3c");
            }
        });
    };
}

// BOTÃO: VOAR PARA O MUNDO (JOIN)
const btnJoin = document.getElementById('btn-join');
if (btnJoin) {
    btnJoin.onclick = () => {
        if (window.requestGameFullscreen) window.requestGameFullscreen();

        const nick = document.getElementById('join-nickname').value.trim() || "Zangão";
        const id = document.getElementById('join-id').value.trim();
        const pass = document.getElementById('join-pass').value.trim();
        
        if (!id) {
            ui.displayStatus("ERRO: Digite o Código da Colmeia alvo.", true);
            return;
        }

        ui.displayStatus(`Buscando colmeia ${id}...`, false);
        log(`Conectando ao Host: ${id}`);

        net.init(null, (ok, err) => { 
            if (ok) {
                net.joinRoom(id, pass, nick); 
            } else {
                ui.displayStatus(`Erro de Rede: ${err}`, true);
                log(`Falha na conexão: ${err}`, "#e74c3c");
            }
        });
    };
}

// --- 5. INTERAÇÕES SOCIAIS (PARTY) ---

// Aceitar convite de grupo
const btnAccept = document.getElementById('btn-accept-invite');
if (btnAccept) {
    btnAccept.onclick = () => {
        if (gameManager.pendingInviteFrom) {
            gameManager.currentPartyPartner = gameManager.pendingInviteFrom;
            
            net.sendPayload({ 
                type: 'PARTY_ACCEPT', 
                fromId: gameManager.localPlayer.id, 
                fromNick: gameManager.localPlayer.nickname 
            }, gameManager.pendingInviteFrom);
            
            chat.addMessage('SYSTEM', null, `Você agora faz parte do grupo.`);
            chat.openPartyTab();
            ui.closePartyInvite();
            gameManager.pendingInviteFrom = null;
        }
    };
}

// Ação de Party no Modal de Jogador
const btnParty = document.getElementById('btn-party-action');
if (btnParty) {
    btnParty.onclick = () => {
        const targetId = gameManager.selectedPlayerId;
        if (!targetId) return;

        if (gameManager.currentPartyPartner === targetId) {
            // Sair do grupo
            net.sendPayload({ type: 'PARTY_LEAVE', fromId: gameManager.localPlayer.id }, targetId);
            chat.addMessage('SYSTEM', null, `Você saiu do grupo.`);
            gameManager.currentPartyPartner = null;
            chat.closePartyTab();
        } else {
            // Convidar
            net.sendPayload({ 
                type: 'PARTY_INVITE', 
                fromId: gameManager.localPlayer.id, 
                fromNick: gameManager.localPlayer.nickname 
            }, targetId);
            chat.addMessage('SYSTEM', null, `Convite de grupo enviado.`);
        }
        ui.closePlayerModal();
    };
}

log("Sistemas integrados e operacionais.", "#2ecc71");
