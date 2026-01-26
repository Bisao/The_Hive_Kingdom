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
                window.dispatchEvent(new CustomEvent('peerDisconnected', { detail: { peerId: conn.peer } }));
            });

            conn.on('data', (data) => {
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
                    // --- LÓGICA DE ROTEAMENTO PROFISSIONAL ---
                    
                    // 1. Se a mensagem tem um alvo específico (Ex: Cochicho)
                    if (data.targetId) {
                        if (data.targetId === this.peer.id) {
                            // Se o alvo for o próprio Host, processa localmente
                            window.dispatchEvent(new CustomEvent('netData', { detail: data }));
                        } else {
                            // Se for para outro Guest, o Host repassa (Proxy)
                            this.sendToId(data.targetId, data);
                        }
                    } else {
                        // 2. Se não tem alvo, é Broadcast (Movimento, Chat Global)
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
                // Mensagens recebidas do Host (podem ser globais ou cochichos repassados)
                window.dispatchEvent(new CustomEvent('netData', { detail: data }));
            }
        });
        
        this.conn.on('close', () => {
            alert("Desconectado do Host.");
            location.reload();
        });
    }

    /**
     * Envia dados para a rede.
     * @param {Object} payload - Dados a enviar
     * @param {string} targetId - (Opcional) ID do Peer de destino
     */
    sendPayload(payload, targetId = null) {
        if (targetId) payload.targetId = targetId; 

        if (this.isHost) {
            if (targetId) {
                if (targetId === this.peer.id) {
                    window.dispatchEvent(new CustomEvent('netData', { detail: payload }));
                } else {
                    this.sendToId(targetId, payload);
                }
            } else {
                this.broadcast(payload);
            }
        } else {
            // Se somos Guest, enviamos tudo para o Host. 
            // O Host decidirá se processa ou repassa com base no targetId.
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
            if (c.peer !== excludePeerId && c.open) {
                c.send(data);
            }
        });
    }
}
