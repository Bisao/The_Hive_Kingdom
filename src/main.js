import { NetworkManager } from './core/network.js';

const net = new NetworkManager();

const btnCreate = document.getElementById('btn-create');
const btnJoin = document.getElementById('btn-join');

btnCreate.addEventListener('click', () => {
    const nick = document.getElementById('nickname').value;
    const roomID = document.getElementById('create-id').value;
    const pass = document.getElementById('create-pass').value;
    const seed = document.getElementById('world-seed').value || Math.random().toString();

    if(!nick || !roomID) return alert("Nickname e ID da sala são obrigatórios!");

    net.init(roomID, (success, msg) => {
        if(success) {
            net.hostRoom(roomID, pass, seed);
            document.getElementById('status-msg').innerText = `Hospedando sala: ${roomID}. Aguardando jogadores...`;
            // Iniciar engine de renderização (Fase 2)
        } else {
            alert("Erro ao criar sala: " + msg);
        }
    });
});

btnJoin.addEventListener('click', () => {
    const nick = document.getElementById('nickname').value;
    const roomID = document.getElementById('join-id').value;
    const pass = document.getElementById('join-pass').value;

    if(!nick || !roomID) return alert("Preencha seu nick e o ID da sala!");

    // No Guest, o ID do peer pode ser aleatório, ele se conecta ao ID do Host
    net.init(null, (success) => {
        if(success) {
            net.joinRoom(roomID, pass, nick);
            document.getElementById('status-msg').innerText = "Tentando conectar...";
        }
    });
});

// Listener para quando o Guest entra com sucesso
window.addEventListener('joined', (e) => {
    document.getElementById('status-msg').innerText = "Conectado! Gerando mundo...";
    console.log("Dados do mundo:", e.detail);
    // Próximo passo: Esconder lobby e mostrar Canvas
});
