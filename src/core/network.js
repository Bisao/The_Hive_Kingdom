// src/core/network.js

export class NetworkManager {
    constructor() {
        this.peer = null;
        this.conn = null; // Para o convidado
        this.connections = []; // Para o host (lista de convidados)
        this.isHost = false;
        this.roomData = { id: '', pass: '', seed: '' };
        this.role = null; // 'host' ou 'guest'
    }

    // Inicializa o PeerJS
    init(customID, callback) {
        // No PeerJS, se o ID já existir, ele gera erro. Ideal para IDs de sala únicos.
        this.peer = new Peer(customID, {
            debug: 2
        });

        this.peer.on('open', (id) => {
            console.log("Conectado ao servidor de sinalização. ID:", id);
            callback(true, id);
        });

        this.peer.on('error', (err) => {
            console.error("Erro no Peer:", err.type);
            callback(false, err.type);
        });
    }

    // Lógica do HOST
    hostRoom(id, pass, seed) {
        this.isHost = true;
        this.role = 'host';
        this.roomData = { id, pass, seed };

        this.peer.on('connection', (conn) => {
            this.setupHostEvents(conn);
        });
    }

    setupHostEvents(conn) {
        conn.on('data', (data) => {
            // Protocolo de Segurança: Primeiro pacote deve ser a senha
            if (data.type === 'AUTH_REQUEST') {
                if (!this.roomData.pass || data.password === this.roomData.pass) {
                    // Senha correta: Enviar confirmação e SEED do mapa
                    conn.send({
                        type: 'AUTH_SUCCESS',
                        seed: this.roomData.seed,
                        peers: this.connections.map(c => c.peer) // Envia lista de outros players
                    });
                    this.connections.push(conn);
                    console.log(`Player ${data.nickname} entrou.`);
                } else {
                    conn.send({ type: 'AUTH_FAIL', reason: 'Senha incorreta' });
                    setTimeout(() => conn.close(), 500);
                }
            }
        });
    }

    // Lógica do GUEST
    joinRoom(targetID, password, nickname) {
        this.role = 'guest';
        this.conn = this.peer.connect(targetID);

        this.conn.on('open', () => {
            // Assim que conecta, solicita validação
            this.conn.send({
                type: 'AUTH_REQUEST',
                password: password,
                nickname: nickname
            });
        });

        this.conn.on('data', (data) => {
            if (data.type === 'AUTH_SUCCESS') {
                console.log("Autenticado! Seed recebida:", data.seed);
                // Aqui dispararemos a geração do mapa local
                window.dispatchEvent(new CustomEvent('joined', { detail: data }));
            } else if (data.type === 'AUTH_FAIL') {
                alert("Erro: " + data.reason);
            }
        });
    }
}
