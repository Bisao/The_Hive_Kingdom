export class NetworkManager {
    constructor() {
        this.peer = null;
        this.conn = null;      // Conexão (Guest -> Host)
        this.peers = {};       // Lista de conexões (Host -> Guests)
        this.isHost = false;
        this.authenticatedPeers = new Set(); // Segurança para impedir cheats simples
        
        // Callbacks de dados (Lógica do jogo injetada aqui)
        this.onWorldRequest = null; 
        this.onGuestDataRequest = null;
        this.onSyncDBRequest = null;
    }

    init(id, callback) {
        // Se ID for null, PeerJS gera um aleatório (Guest)
        // Se ID for passado, tenta usar esse ID (Host)
        this.peer = new Peer(id, {
            debug: 1, // 0=None, 1=Errors, 2=Warnings, 3=All
            config: {
                'iceServers': [
                    { urls: 'stun:stun.l.google.com:19302' },
                    { urls: 'stun:global.stun.twilio.com:3478' }
                ]
            }
        });

        this.peer.on('open', (myId) => {
            console.log(`[Net] Peer aberto. Meu ID: ${myId}`);
            if (callback) callback(true, null);
        });

        this.peer.on('error', (err) => {
            console.error(`[Net] Erro: ${err.type}`);
            if (callback) callback(false, err.type);
        });

        // Evento quando alguém conecta em mim (Host recebe Guest)
        this.peer.on('connection', (c) => this.handleIncomingConnection(c));
    }

    // --- LÓGICA DO HOST ---

    hostRoom(roomId, password, seed, worldRequestFn, guestDataRequestFn, syncDBFn) {
        this.isHost = true;
        this.password = password;
        this.seed = seed;
        
        // Hooks para pegar dados do jogo
        this.onWorldRequest = worldRequestFn;
        this.onGuestDataRequest = guestDataRequestFn;
        this.onSyncDBRequest = syncDBFn;

        console.log(`[Net] Sala ${roomId} hospedada. Aguardando conexões...`);
    }

    handleIncomingConnection(conn) {
        if (!this.isHost) return; // Guests não aceitam conexões diretas de outros guests (Topologia Estrela)

        conn.on('open', () => {
            console.log(`[Net] Conexão recebida de ${conn.peer}`);
            
            // Timeout de segurança: Se não autenticar em 5s, fecha.
            setTimeout(() => {
                if (!this.authenticatedPeers.has(conn.peer)) {
                    conn.close();
                }
            }, 5000);
        });

        conn.on('data', (data) => {
            this.handleData(data, conn);
        });

        conn.on('close', () => {
            if (this.authenticatedPeers.has(conn.peer)) {
                this.authenticatedPeers.delete(conn.peer);
                delete this.peers[conn.peer];
                window.dispatchEvent(new CustomEvent('peerDisconnected', { detail: { peerId: conn.peer } }));
                this.broadcast({ type: 'PEER_DISCONNECT', peerId: conn.peer });
            }
        });
    }

    // --- LÓGICA DO GUEST ---

    joinRoom(hostId, password, nickname) {
        this.isHost = false;
        this.conn = this.peer.connect(hostId, { reliable: true });

        this.conn.on('open', () => {
            console.log("[Net] Conectado ao Host. Enviando autenticação...");
            // Passo 1: Handshake
            this.conn.send({ 
                type: 'AUTH', 
                pass: password, 
                nick: nickname 
            });
        });

        this.conn.on('data', (data) => this.handleData(data, this.conn));
        
        this.conn.on('close', () => {
            alert("Desconectado do servidor.");
            location.reload();
        });
        
        this.conn.on('error', (err) => console.error("Erro na conexão:", err));
    }

    // --- ROTEAMENTO DE DADOS ---

    handleData(data, conn) {
        // 1. Autenticação (Apenas Host processa)
        if (this.isHost && data.type === 'AUTH') {
            if (data.pass === this.password) {
                this.authenticatedPeers.add(conn.peer);
                this.peers[conn.peer] = conn;
                
                // Envia estado inicial do mundo para o novo jogador
                const worldState = this.onWorldRequest ? this.onWorldRequest() : {};
                const playerData = this.onGuestDataRequest ? this.onGuestDataRequest(data.nick) : null;
                const guestsDB = this.onSyncDBRequest ? this.onSyncDBRequest() : {};

                conn.send({
                    type: 'WELCOME',
                    seed: this.seed,
                    worldState: worldState,
                    playerData: playerData,
                    guests: guestsDB
                });

                window.dispatchEvent(new CustomEvent('chatSend', { detail: { type: 'SYSTEM', text: `${data.nick} entrou na colmeia.` } }));
            } else {
                conn.send({ type: 'ERROR', msg: 'Senha incorreta' });
                setTimeout(() => conn.close(), 500);
            }
            return;
        }

        // 2. Cliente recebe Boas-Vindas
        if (!this.isHost && data.type === 'WELCOME') {
            window.dispatchEvent(new CustomEvent('joined', { detail: data }));
            return;
        }

        // 3. Roteamento Geral (Gameplay)
        
        // Se sou HOST, recebo dados de um Guest e repasso para todos
        if (this.isHost) {
            if (!this.authenticatedPeers.has(conn.peer)) return; // Ignora não autenticados
            
            // Processa localmente (para o Host ver)
            window.dispatchEvent(new CustomEvent('netData', { detail: data }));
            
            // Broadcast para os outros
            this.broadcast(data, conn.peer);
        } 
        // Se sou GUEST, recebo dados do Host e processo
        else {
            window.dispatchEvent(new CustomEvent('netData', { detail: data }));
        }
    }

    sendPayload(data, targetPeerId = null) {
        // Adiciona ID de origem se não tiver
        if (!data.fromId) data.fromId = this.peer.id;

        if (this.isHost) {
            if (targetPeerId) {
                // Host envia para específico (Whisper/Party)
                if (targetPeerId === this.peer.id) {
                    window.dispatchEvent(new CustomEvent('netData', { detail: data }));
                } else if (this.peers[targetPeerId]) {
                    this.peers[targetPeerId].send(data);
                }
            } else {
                // Host envia para todos e processa localmente
                this.broadcast(data);
                window.dispatchEvent(new CustomEvent('netData', { detail: data }));
            }
        } else {
            // Guest sempre envia para o Host, o Host decide o que fazer
            if (this.conn && this.conn.open) {
                // Se for Whisper, adiciona o alvo no pacote para o Host rotear
                if (targetPeerId) data.targetId = targetPeerId;
                this.conn.send(data);
            }
        }
    }

    broadcast(data, excludePeerId = null) {
        for (let peerId in this.peers) {
            if (peerId !== excludePeerId) {
                this.peers[peerId].send(data);
            }
        }
    }
}
