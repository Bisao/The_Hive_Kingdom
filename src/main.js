import { NetworkManager } from './core/network.js';
import { WorldState } from './world/worldState.js';
import { InputHandler } from './core/input.js';
import { SaveSystem } from './core/saveSystem.js';
import { ChatSystem } from './core/chatSystem.js';
import { UIManager } from './managers/UIManager.js';
import { GameManager } from './managers/GameManager.js';

// --- 1. INSTANCIAÇÃO DOS SISTEMAS ---
const net = new NetworkManager();
const input = new InputHandler(); 
const worldState = new WorldState();
const saveSystem = new SaveSystem();
const chat = new ChatSystem();
const ui = new UIManager();

// --- 2. INJEÇÃO DE DEPENDÊNCIAS NO GAMEMANAGER ---
// O GameManager é o cérebro que precisa acessar todos os outros sistemas
const gameManager = new GameManager(net, input, worldState, saveSystem, chat, ui);

// --- 3. CONFIGURAÇÕES GLOBAIS ---

// Trava o movimento do boneco quando o chat abre
chat.onChatOpen = () => input.setChatMode(true);
chat.onChatClose = () => input.setChatMode(false);

// Helper de Log Seguro (usa o console visual do HTML se existir)
function log(msg, color) {
    if (window.logDebug) window.logDebug(msg, color);
    else console.log(msg);
}

// Helper para tratar erros de rede
function handleNetworkError(errorType) {
    let msg = "Erro desconhecido na rede.";
    if (errorType === 'unavailable-id') msg = "Este ID já está em uso!";
    if (errorType === 'network' || errorType === 'peer-unavailable') msg = "Erro de conexão ou Host não encontrado.";
    
    log(`Erro Crítico: ${errorType}`, "#ff4d4d");
    ui.displayStatus(msg);
}

// --- 4. LÓGICA DE INTERFACE (LOBBY) ---

// Configuração das Abas (Hospedar / Entrar)
function setupTabs() {
    const tabs = ['create', 'join'];
    tabs.forEach(t => {
        const btn = document.getElementById(`tab-btn-${t}`);
        if (btn) {
            btn.onclick = () => {
                // Remove classe active de todos
                document.querySelectorAll('.tab-content').forEach(e => e.classList.remove('active'));
                document.querySelectorAll('.tab-btn').forEach(e => e.classList.remove('active'));
                // Adiciona ao atual
                document.getElementById(`tab-${t}`).classList.add('active');
                btn.classList.add('active');
            };
        }
    });
}
setupTabs();

// Botão HOSPEDAR
document.getElementById('btn-create').onclick = () => {
    // Solicita Fullscreen no Mobile (Requisito de navegador)
    if (window.requestGameFullscreen) window.requestGameFullscreen();

    const nick = document.getElementById('host-nickname').value.trim() || "Host";
    const id = document.getElementById('create-id').value.trim();
    const pass = document.getElementById('create-pass').value.trim();
    const seed = document.getElementById('world-seed').value.trim() || Date.now().toString();
    
    if(!id) return alert("É necessário criar um ID para a sala.");

    localStorage.setItem('wings_nick', nick);
    ui.displayStatus(`Iniciando Host...`);
    log(`Tentando criar sala: ${id}`);
    
    net.init(id, (ok, errorType) => {
        if(ok) {
            // Configura callbacks de dados para quando novos players entrarem
            net.hostRoom(id, pass, seed, 
                () => worldState.getFullState(), 
                (guestNick) => gameManager.guestDataDB[guestNick],
                () => gameManager.guestDataDB 
            );
            
            // Inicia o jogo localmente como Host
            gameManager.startGame(seed, id, nick, true);
        } else { 
            handleNetworkError(errorType);
        }
    });
};

// Botão ENTRAR
document.getElementById('btn-join').onclick = () => {
    if (window.requestGameFullscreen) window.requestGameFullscreen();

    const nick = document.getElementById('join-nickname').value.trim() || "Guest";
    const id = document.getElementById('join-id').value.trim();
    const pass = document.getElementById('join-pass').value.trim();
    
    if(!id) return alert("Digite o ID do Host para entrar.");

    localStorage.setItem('wings_nick', nick);
    ui.displayStatus(`Conectando a ${id}...`);
    log(`Procurando Host: ${id}`);

    // Inicializa Peer sem ID (Guest)
    net.init(null, (ok, err) => { 
        if(ok) {
            // Tenta conectar e autenticar
            net.joinRoom(id, pass, nick); 
            // Nota: O jogo iniciará automaticamente quando o evento 'joined' for disparado
        } else {
            handleNetworkError(err);
        }
    });
};

// --- 5. HANDLERS DE AÇÕES DE JOGADOR (MODAL) ---

// Botão "Convidar/Sair da Party"
document.getElementById('btn-party-action').onclick = () => {
    // O GameManager sabe quem foi o último jogador clicado
    const targetId = gameManager.selectedPlayerId;
    if (!targetId) return;

    if (gameManager.currentPartyPartner === targetId) {
        // Sair da Party
        net.sendPayload({ type: 'PARTY_LEAVE', fromId: gameManager.localPlayer.id }, targetId);
        chat.addMessage('SYSTEM', null, `Party desfeita.`);
        gameManager.currentPartyPartner = null;
        chat.closePartyTab();
    } else {
        // Convidar
        net.sendPayload({ type: 'PARTY_INVITE', fromId: gameManager.localPlayer.id, fromNick: gameManager.localPlayer.nickname }, targetId);
        chat.addMessage('SYSTEM', null, `Convite enviado.`);
    }
    ui.closePlayerModal();
};

// Botão "Aceitar Convite" (Popup)
document.getElementById('btn-accept-invite').onclick = () => {
    if (gameManager.pendingInviteFrom) {
        gameManager.currentPartyPartner = gameManager.pendingInviteFrom;
        
        // Avisa quem convidou
        net.sendPayload({ type: 'PARTY_ACCEPT', fromId: gameManager.localPlayer.id, fromNick: gameManager.localPlayer.nickname }, gameManager.pendingInviteFrom);
        
        chat.addMessage('SYSTEM', null, `Você entrou na party.`);
        chat.openPartyTab();
        ui.closePartyInvite();
        gameManager.pendingInviteFrom = null;
    }
};

// Botão "Cochichar"
document.getElementById('btn-whisper-action').onclick = () => {
    if (gameManager.selectedPlayerId) {
        const p = gameManager.remotePlayers[gameManager.selectedPlayerId];
        if(p) chat.openPrivateTab(p.nickname);
    }
    ui.closePlayerModal();
};

log("Sistema carregado. Aguardando interação do usuário.", "#2ecc71");
