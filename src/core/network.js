export class NetworkManager {
    constructor() {
        this.peer = null;
        this.conn = null; 
        this.connections = []; 
        this.isHost = false;
        this.roomData = { id: '', pass: '', seed: '' };
        
        this.getStateCallback = null;
        this.getGuestDataCallback = null; 
        this.getFullGuestDBStatsCallback = null; 

        // Rastreia quem passou pelo handshake de autenticação
        this.authenticatedPeers = new Set();
    }

    init(customID, callback) {
        this.peer = new Peer(customID, { debug: 1 });
        
        this.peer.on('open', (id) => {
            if(callback) callback(true, id);
        });
        
        this.peer.on('error', (err) => {
            console.error("PeerJS Error:", err);
            if(callback) callback(false, err.type);
        });
    }

    /**
     * @param {string} id 
     * @param {string} pass 
     * @param {string} seed 
     * @param {Function} getStateFn - Retorna worldState.getFullState()
     * @param {Function} getGuestDataFn - Retorna dados de UM player específico pelo nick
     * @param {Function} getFullDBFn - Retorna o objeto guestDataDB completo para sincronizar Ranking
     */
    hostRoom(id, pass, seed, getStateFn, getGuestDataFn, getFullDBFn) {
        this.isHost = true;
        this.roomData = { id, pass, seed };
        this.getStateCallback = getStateFn;
        this.getGuestDataCallback = getGuestDataFn;
        this.getFullGuestDBStatsCallback = getFullDBFn;

        this.peer.on('connection', (conn) => {
            conn.on('close', () => {
                this.connections = this.connections.filter(c => c !== conn);
                this.authenticatedPeers.delete(conn.peer);
                window.dispatchEvent(new CustomEvent('peerDisconnected', { detail: { peerId: conn.peer } }));
            });

            conn.on('data', (data) => {
                // FASE 1: Autenticação
                if (data.type === 'AUTH_REQUEST') {
                    if (!this.roomData.pass || data.password === this.roomData.pass) {
                        const currentState = this.getStateCallback ? this.getStateCallback() : {};
                        
                        let savedPlayerData = null;
                        if (this.getGuestDataCallback && data.nickname) {
                            savedPlayerData = this.getGuestDataCallback(data.nickname);
                        }

                        let fullGuestsDB = {};
                        if (this.getFullGuestDBStatsCallback) {
                            fullGuestsDB = this.getFullGuestDBStatsCallback();
                        }

                        // Registra como autenticado antes de confirmar o sucesso
                        this.authenticatedPeers.add(conn.peer);

                        conn.send({ 
                            type: 'AUTH_SUCCESS', 
                            seed: this.roomData.seed, 
                            worldState: currentState,
                            playerData: savedPlayerData,
                            guests: fullGuestsDB 
                        });
                        
                        this.connections.push(conn);
                    } else {
                        conn.send({ type: 'AUTH_FAIL', reason: 'Senha incorreta' });
                        setTimeout(() => conn.close(), 500);
                    }
                } else {
                    // FASE 2: Roteamento de Dados (Apenas para autenticados)
                    if (!this.authenticatedPeers.has(conn.peer)) {
                        console.warn(`Pacote de rede bloqueado (não autenticado): ${conn.peer}`);
                        return;
                    }

                    // --- LÓGICA DE ROTEAMENTO PROFISSIONAL ---
                    
                    // Se a mensagem tem um destino específico (Whisper ou Party)
                    if (data.targetId) {
                        if (data.targetId === this.peer.id) {
                            // Se for para o Host, processa localmente
                            window.dispatchEvent(new CustomEvent('netData', { detail: data }));
                        } else {
                            // Se for para outro Guest, o Host repassa
                            this.sendToId(data.targetId, data);
                        }
                    } else {
                        // Mensagens Globais (Broadcast)
                        window.dispatchEvent(new CustomEvent('netData', { detail: data }));
                        this.broadcast(data, conn.peer);
                    }
                }
            });
        });
    }

    joinRoom(targetID, password, nickname) {
        this.conn = this.peer.connect(targetID);
        
        this.conn.on('open', () => {
            this.conn.send({ type: 'AUTH_REQUEST', password, nickname });
        });

        this.conn.on('data', (data) => {
            if (data.type === 'AUTH_SUCCESS') {
                window.dispatchEvent(new CustomEvent('joined', { detail: data }));
            }
            else if (data.type === 'AUTH_FAIL') {
                alert(data.reason);
                this.conn.close();
            }
            else {
                // Recebe dados do Host (Globais ou direcionados a nós)
                window.dispatchEvent(new CustomEvent('netData', { detail: data }));
            }
        });
        
        this.conn.on('close', () => {
            alert("Sua conexão com o Host foi encerrada.");
            location.reload();
        });
    }

    /**
     * Envia um payload de dados. 
     * @param {Object} payload 
     * @param {string} targetId (Opcional) ID de um peer específico
     */
    sendPayload(payload, targetId = null) {
        if (targetId) payload.targetId = targetId; 

        if (this.isHost) {
            if (targetId) {
                if (targetId === this.peer.id) {
                    // Auto-processamento se o alvo for o próprio Host
                    window.dispatchEvent(new CustomEvent('netData', { detail: payload }));
                } else {
                    this.sendToId(targetId, payload);
                }
            } else {
                this.broadcast(payload);
            }
        } else {
            // Guests enviam tudo para o Host, que atua como roteador/servidor
            if (this.conn && this.conn.open) {
                this.conn.send(payload);
            }
        }
    }

    sendToId(peerId, data) {
        const targetConn = this.connections.find(c => c.peer === peerId);
        if (targetConn && targetConn.open) {
            targetConn.send(data);
        }
    }

    broadcast(data, excludePeerId = null) {
        this.connections.forEach(c => { 
            // Garante que o broadcast só atinja jogadores autenticados
            if (c.peer !== excludePeerId && c.open && this.authenticatedPeers.has(c.peer)) {
                c.send(data);
            }
        });
    }
}
