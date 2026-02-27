export class NetworkManager {
    constructor() {
        this.peer = null;
        this.conn = null; 
        this.connections = []; 
        this.isHost = false;
        this.roomData = { id: '', pass: '', seed: '' };
        
        // Callbacks para integração (Injetados pelo Game.js)
        this.getStateCallback = null;
        this.getGuestDataCallback = null; 
        this.getFullGuestDBStatsCallback = null; 
        this.getHomeBaseCallback = null; 

        this.authenticatedPeers = new Set();
    }

    _log(msg, color = "#00ff00") {
        console.log(`%c[Network] ${msg}`, `color: ${color}; font-weight: bold;`);
    }

    /**
     * Inicializa o PeerJS com servidores STUN públicos para atravessar firewalls.
     */
    init(customID, callback) {
        this._log(`Inicializando Peer... ${customID || 'ID Aleatório'}`, "#3498db");
        
        const cleanID = customID ? customID.replace(/[^a-zA-Z0-9_-]/g, '') : null;

        const options = { 
            debug: 1,
            config: {
                'iceServers': [
                    { urls: 'stun:stun.l.google.com:19302' },
                    { urls: 'stun:global.stun.twilio.com:3478' },
                    { urls: 'stun:stun1.l.google.com:19302' }
                ]
            }
        };

        try {
            this.peer = cleanID ? new Peer(cleanID, options) : new Peer(options);
        } catch (e) {
            this._log(`Erro Crítico ao criar Peer: ${e.message}`, "#ff0000");
            if(callback) callback(false, null);
            return;
        }
        
        this.peer.on('open', (id) => {
            this._log(`Peer aberto com sucesso! ID: ${id}`, "#2ecc71");
            if(callback) callback(true, id);
        });
        
        this.peer.on('error', (err) => {
            this._log(`Erro no PeerJS: ${err.type}`, "#ff4d4d");
            if (err.type === 'unavailable-id') {
                alert("Este ID de Colmeia já está sendo usado ou é inválido!");
            }
            if(callback) callback(false, err.type);
        });

        // O Host fica ouvindo novas conexões
        this.peer.on('connection', (conn) => {
            this.handleIncomingConnection(conn);
        });
    }

    /**
     * Define este cliente como o Host da sala.
     */
    hostRoom(id, pass, seed, getStateFn, getGuestDataFn, getFullDBFn, getHomeBaseFn) {
        this._log(`Configurando como HOST da colmeia '${id}'...`, "#f1c40f");
        this.isHost = true;
        this.roomData = { id, pass, seed };
        
        this.getStateCallback = getStateFn;
        this.getGuestDataCallback = getGuestDataFn;
        this.getFullGuestDBStatsCallback = getFullDBFn;
        this.getHomeBaseCallback = getHomeBaseFn;

        window.dispatchEvent(new CustomEvent('joined', { 
            detail: { seed: seed } 
        }));
    }

    /**
     * Lógica do Host ao receber um novo jogador.
     */
    handleIncomingConnection(conn) {
        if (!this.isHost) return;

        this._log(`Tentativa de conexão recebida: ${conn.peer}`, "#bdc3c7");

        conn.on('open', () => {
            this._log(`Socket aberto com ${conn.peer}. Aguardando AUTH...`);
        });

        conn.on('close', () => {
            this._log(`Peer desconectado: ${conn.peer}`, "#e67e22");
            this.connections = this.connections.filter(c => c.peer !== conn.peer);
            this.authenticatedPeers.delete(conn.peer);
            
            // 1. Avisa o Game.js local (Host) para remover o boneco
            window.dispatchEvent(new CustomEvent('peerDisconnected', { detail: { peerId: conn.peer } }));
            
            // 2. Avisa todos os outros convidados para limparem o "fantasma"
            this.broadcast({ type: 'PEER_DISCONNECT', peerId: conn.peer });
        });

        conn.on('data', (data) => {
            // --- FASE DE AUTENTICAÇÃO ---
            if (data.type === 'AUTH_REQUEST') {
                if (!this.roomData.pass || data.password === this.roomData.pass) {
                    this._log(`Autenticando jogador: ${data.nickname || 'Guest'}`);
                    
                    // Prevenção de Fantasmas: Se o mesmo Nickname entrar de novo, derruba a conexão antiga
                    if (data.nickname) {
                        const ghosts = this.connections.filter(c => c._nickname === data.nickname && c.peer !== conn.peer);
                        ghosts.forEach(ghostConn => {
                            this._log(`Limpando conexão fantasma: ${data.nickname}`, "#e74c3c");
                            this.authenticatedPeers.delete(ghostConn.peer);
                            window.dispatchEvent(new CustomEvent('peerDisconnected', { detail: { peerId: ghostConn.peer } }));
                            this.broadcast({ type: 'PEER_DISCONNECT', peerId: ghostConn.peer });
                            ghostConn.close();
                        });
                        this.connections = this.connections.filter(c => c._nickname !== data.nickname || c.peer === conn.peer);
                        conn._nickname = data.nickname;
                    }

                    // Prepara o pacote de boas-vindas com o estado ATUAL do mundo
                    const currentState = this.getStateCallback ? this.getStateCallback() : {};
                    const savedPlayerData = (this.getGuestDataCallback && data.nickname) ? this.getGuestDataCallback(data.nickname) : null;
                    const fullGuestsDB = this.getFullGuestDBStatsCallback ? this.getFullGuestDBStatsCallback() : {};
                    const currentHomeBase = this.getHomeBaseCallback ? this.getHomeBaseCallback() : null; 

                    this.authenticatedPeers.add(conn.peer);
                    this.connections.push(conn);

                    conn.send({ 
                        type: 'AUTH_SUCCESS', 
                        seed: this.roomData.seed, 
                        worldState: currentState,
                        playerData: savedPlayerData,
                        guests: fullGuestsDB,
                        homeBase: currentHomeBase 
                    });
                } else {
                    this._log(`Senha incorreta de: ${conn.peer}`, "#c0392b");
                    conn.send({ type: 'AUTH_FAIL', reason: 'Senha da Colmeia Incorreta' });
                    setTimeout(() => conn.close(), 500);
                }
                return;
            }

            // Segurança: Ignora dados de quem não passou pela AUTH
            if (!this.authenticatedPeers.has(conn.peer)) return;

            // Carimba a origem real do pacote (evita spoofing de ID)
            data.fromId = conn.peer;
            if (data.id) data.id = conn.peer; 
            if (data.ownerId) data.ownerId = conn.peer; 

            // Roteia o pacote
            this.processAndRoute(data);
        });
    }

    /**
     * Lógica do Guest para entrar em uma sala existente.
     */
    joinRoom(targetID, password, nickname) {
        const cleanTarget = targetID.replace(/[^a-zA-Z0-9_-]/g, '');
        this._log(`Conectando ao Host: ${cleanTarget}...`, "#3498db");
        
        this.conn = this.peer.connect(cleanTarget, { reliable: true });
        
        this.conn.on('open', () => {
            this._log("Conexão estabelecida. Solicitando entrada...", "#2ecc71");
            this.conn.send({ type: 'AUTH_REQUEST', password, nickname });
        });

        this.conn.on('data', (data) => {
            if (data.type === 'AUTH_SUCCESS') {
                this._log("Entrada autorizada!", "#27ae60");
                window.dispatchEvent(new CustomEvent('joined', { detail: data }));
            } else if (data.type === 'AUTH_FAIL') {
                alert(data.reason);
                this.conn.close();
                location.reload();
            } else {
                // Encaminha pacotes de jogo para o Game.js
                window.dispatchEvent(new CustomEvent('netData', { detail: data }));
            }
        });
        
        this.conn.on('close', () => {
            alert("A conexão com o Host foi perdida.");
            location.reload();
        });

        this.conn.on('error', (err) => {
            console.error("Erro na conexão:", err);
            alert("Não foi possível alcançar esta Colmeia.");
        });
    }

    /**
     * O Cérebro da Rede: Decide se o pacote é para o Host ou se deve ser repassado.
     */
    processAndRoute(data) {
        // Se o pacote tem um destino específico ou múltiplos destinos
        if (data.targetIds && Array.isArray(data.targetIds)) {
            data.targetIds.forEach(tId => {
                if (tId === this.peer.id) {
                    window.dispatchEvent(new CustomEvent('netData', { detail: data }));
                } else {
                    this.sendToId(tId, data);
                }
            });
        } 
        else if (data.targetId) {
            if (data.targetId === this.peer.id) {
                window.dispatchEvent(new CustomEvent('netData', { detail: data }));
            } else {
                this.sendToId(data.targetId, data);
            }
        } 
        // Se não tem destino, é um Broadcast (Geral)
        else {
            window.dispatchEvent(new CustomEvent('netData', { detail: data }));
            this.broadcast(data, data.fromId);
        }
    }

    /**
     * Envia um pacote para a rede. 
     * @param {object} payload - Os dados
     * @param {string|string[]} targetIdOrIds - Destinatário único ou lista (opcional)
     */
    sendPayload(payload, targetIdOrIds = null) {
        if (!this.peer) return;
        
        payload.fromId = this.peer.id; 
        
        // Garante integridade de IDs em ações críticas
        if (['MOVE', 'SPAWN_INFO', 'SHOOT', 'POLLEN_COLLECTED', 'PARTY_RESCUE'].includes(payload.type)) {
            if (payload.type === 'SHOOT') payload.ownerId = this.peer.id;
            else payload.id = this.peer.id;
        }

        if (this.isHost) {
            if (Array.isArray(targetIdOrIds)) {
                targetIdOrIds.forEach(id => {
                    if (id === this.peer.id) window.dispatchEvent(new CustomEvent('netData', { detail: payload }));
                    else this.sendToId(id, payload);
                });
            } else if (targetIdOrIds) {
                if (targetIdOrIds === this.peer.id) window.dispatchEvent(new CustomEvent('netData', { detail: payload }));
                else this.sendToId(targetIdOrIds, payload);
            } else {
                this.broadcast(payload, this.peer.id);
            }
        } else if (this.conn && this.conn.open) {
            // Se for Guest, anexa o destino e envia para o Host rotear
            if (Array.isArray(targetIdOrIds)) {
                payload.targetIds = targetIdOrIds;
            } else if (targetIdOrIds) {
                payload.targetId = targetIdOrIds;
            }
            this.conn.send(payload);
        }
    }

    /**
     * Sincroniza o estado de cura de flores.
     */
    sendHealToPlayers(playerIds, flowerX, flowerY, ownerId) {
        if (!this.isHost) return;
        
        const healPayload = {
            type: 'FLOWER_CURE',
            x: flowerX,
            y: flowerY,
            ownerId: ownerId,
            amount: 10
        };

        playerIds.forEach(id => {
            if (id === this.peer.id) {
                window.dispatchEvent(new CustomEvent('netData', { detail: healPayload }));
            } else {
                this.sendToId(id, healPayload);
            }
        });
    }

    /**
     * Transmite o dicionário de flores completo para todos (usado pelo Host).
     */
    syncFlowerData(flowerDict) {
        if (!this.isHost) return;

        const payload = {
            type: 'SYNC_FLOWERS',
            data: flowerDict
        };

        this.broadcast(payload, this.peer.id);
        window.dispatchEvent(new CustomEvent('netData', { detail: payload }));
    }

    /**
     * Envia diretamente para uma conexão específica.
     */
    sendToId(peerId, data) {
        const targetConn = this.connections.find(c => c.peer === peerId);
        if (targetConn && targetConn.open) {
            targetConn.send(data);
        }
    }

    /**
     * Envia para todos os autenticados, exceto para um peer específico (opcional).
     */
    broadcast(data, excludePeerId = null) {
        this.connections.forEach(c => { 
            if (c.peer !== excludePeerId && c.open && this.authenticatedPeers.has(c.peer)) {
                c.send(data);
            }
        });
    }
}
