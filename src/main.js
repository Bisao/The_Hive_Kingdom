import { NetworkManager } from './core/network.js';
import { WorldState } from './world/worldState.js';
import { InputHandler } from './core/input.js';
import { SaveSystem } from './core/saveSystem.js';
import { ChatSystem } from './core/chatSystem.js';
import { GameManager } from './managers/GameManager.js';

// 1. Instanciação dos Sistemas
const net = new NetworkManager();
const input = new InputHandler(); 
const worldState = new WorldState();
const saveSystem = new SaveSystem();
const chat = new ChatSystem();

// 2. Injeção de Dependências no GameManager
// O GameManager agora assume o controle do Loop, Render e Lógica
const gameManager = new GameManager(net, input, worldState, saveSystem, chat);

// 3. Configuração de Input (Chat vs Movimento)
// Quando o chat abre, o input de movimento trava para não andar enquanto digita
chat.onChatOpen = () => input.setChatMode(true);
chat.onChatClose = () => input.setChatMode(false);

// 4. Vínculo com a UI (Botões do HTML)
// A lógica pesada saiu daqui e foi para o GameManager ou NetworkManager

// --- BOTÃO HOSPEDAR ---
document.getElementById('btn-create').onclick = () => {
    // Solicita Fullscreen (Mobile)
    if (window.requestGameFullscreen) window.requestGameFullscreen();

    const nick = document.getElementById('host-nickname').value.trim() || "Host";
    const id = document.getElementById('create-id').value.trim();
    const pass = document.getElementById('create-pass').value.trim();
    const seed = document.getElementById('world-seed').value.trim() || Date.now().toString();
    
    if(!id) {
        logDebug("Erro: ID da sala obrigatório.", "#ff4d4d");
        return alert("ID obrigatório");
    }

    localStorage.setItem('wings_nick', nick);
    logDebug(`Iniciando sistema... ID: ${id}`);
    
    // Inicializa Rede
    net.init(id, (ok, errorType) => {
        if(ok) {
            logDebug("Rede pronta. Criando sala...");
            
            // Configura o Host
            net.hostRoom(id, pass, seed, 
                () => worldState.getFullState(), 
                (guestNick) => gameManager.guestDataDB[guestNick],
                () => gameManager.guestDataDB 
            );

            // Inicia o Jogo (Como Host)
            gameManager.startGame(seed, id, nick, true);
            
            logDebug("Mundo iniciado com sucesso!");
        } else { 
            handleNetworkError(errorType);
        }
    });
};

// --- BOTÃO ENTRAR ---
document.getElementById('btn-join').onclick = () => {
    // Solicita Fullscreen (Mobile)
    if (window.requestGameFullscreen) window.requestGameFullscreen();

    const nick = document.getElementById('join-nickname').value.trim() || "Guest";
    const id = document.getElementById('join-id').value.trim();
    const pass = document.getElementById('join-pass').value.trim();
    
    if(!id) {
        logDebug("Erro: ID do Host necessário.", "#ff4d4d");
        return alert("ID do Host é obrigatório");
    }

    localStorage.setItem('wings_nick', nick);
    logDebug(`Procurando colmeia: ${id}...`);

    // Inicializa Rede (Sem ID próprio, pois é Guest)
    net.init(null, (ok, err) => { 
        if(ok) {
            logDebug("Rede pronta. Conectando...");
            net.joinRoom(id, pass, nick); 
            // Nota: O jogo iniciará automaticamente quando o evento 'joined' 
            // for disparado (tratado dentro do GameManager)
        } else {
            handleNetworkError(err);
        }
    });
};

// --- INTERAÇÃO COM JOGADORES (UI) ---
// Repassa o evento de clique no jogador para a lógica do Modal (ainda no index.html por enquanto)
window.addEventListener('playerClicked', e => {
    // A lógica de UI do modal pode ser movida para UIManager no futuro
    // Por enquanto, o código antigo no index.html ou GameManager lida com isso
    // mas precisamos garantir que o GameManager saiba quem foi clicado.
    const targetNick = e.detail;
    // O GameManager já escuta 'playerClicked' internamente? 
    // Sim, no código anterior adicionamos listeners globais no GameManager.
});

// Helper de Erro
function handleNetworkError(errorType) {
    let msg = "Erro desconhecido na rede.";
    if (errorType === 'unavailable-id') msg = "Este ID já está em uso!";
    if (errorType === 'network' || errorType === 'peer-unavailable') msg = "Erro de conexão ou Host não encontrado.";
    
    logDebug(`Erro Crítico: ${errorType}`, "#ff4d4d");
    const statusEl = document.getElementById('status-msg');
    if (statusEl) statusEl.innerText = msg;
}

// Log Global (para o index.html acessar se necessário)
function logDebug(msg, color) {
    if (window.logDebug) window.logDebug(msg, color);
    else console.log(msg);
}
