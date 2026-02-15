export class NetworkManager {
    constructor() {
        this.peer = null;
        this.conn = null; // Conexão do Client com o Host
        this.connections = []; // Lista de conexões ativas (Apenas Host usa)
        this.isHost = false;
        this.roomData = { id: '', pass: '', seed: '' };
        
        // Callbacks para integração com SaveSystem e WorldState
        this.getStateCallback = null;
        this.getGuestDataCallback = null; 
        this.getFullGuestDBStatsCallback = null; 

        this.authenticatedPeers = new Set();
    }

    _log(msg, color = "#00ff00") {
        // Estilização simples para o console do navegador
        console.log(`%c[Network] ${msg}`, `color: ${color}; font-weight: bold;`);
    }

    init(customID, callback) {
        this._log(`Inicializando Peer... ${customID || 'ID Aleatório'}`, "#3498db");
        
        // CORREÇÃO: Remove caracteres inválidos para PeerJS e força minúsculas
        const cleanID = customID ? customID.replace(/[^a-zA-Z0-9_-]/g, '') : null;

        const options = { 
            debug: 1,
            config: {
                'iceServers': [
                    { urls: 'stun:stun.l.google.com:19302' },
                    { urls: 'stun:global.stun.twilio.com:3478' }
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
                alert("Este ID de Colmeia já está sendo usado!");
            }
            if(callback) callback(false, err.type);
        });

        // Configura recebimento de conexões (apenas se tornarmos Host depois)
        this.peer.on('connection', (conn) => {
            this.handleIncomingConnection(conn);
        });
    }

    hostRoom(id, pass, seed, getStateFn, getGuestDataFn, getFullDBFn) {
        this._log(`Configurando como HOST da colmeia '${id}'...`, "#f1c40f");
        this.isHost = true;
        this.roomData = { id, pass, seed };
        
        // Armazena as funções para pegar dados do SaveSystem quando alguém entrar
        this.getStateCallback = getStateFn;
        this.getGuestDataCallback = getGuestDataFn;
        this.getFullGuestDBStatsCallback = getFullDBFn;

        // Dispara evento local para o próprio Host iniciar o jogo
        window.dispatchEvent(new CustomEvent('joined', { 
            detail: { seed: seed } 
        }));
    }

    handleIncomingConnection(conn) {
        if (!this.isHost) return; // Se não sou host, ignoro conexões de entrada inesperadas

        this._log(`Tentativa de conexão recebida: ${conn.peer}`, "#bdc3c7");

        conn.on('open', () => {
            // Conexão estabelecida, aguardando AUTH_REQUEST
        });

        conn.on('close', () => {
            this._log(`Peer desconectado: ${conn.peer}`, "#e67e22");
            this.connections = this.connections.filter(c => c.peer !== conn.peer);
            this.authenticatedPeers.delete(conn.peer);
            window.dispatchEvent(new CustomEvent('peerDisconnected', { detail: { peerId: conn.peer } }));
        });

        conn.on('data', (data) => {
            // 1. Lógica de Autenticação
            if (data.type === 'AUTH_REQUEST') {
                if (!this.roomData.pass || data.password === this.roomData.pass) {
                    this._log(`Autenticando jogador: ${data.nickname || 'Guest'}`);
                    
                    // Recupera dados frescos do jogo usando os callbacks
                    const currentState = this.getStateCallback ? this.getStateCallback() : {};
                    const savedPlayerData = (this.getGuestDataCallback && data.nickname) ? this.getGuestDataCallback(data.nickname) : null;
                    const fullGuestsDB = this.getFullGuestDBStatsCallback ? this.getFullGuestDBStatsCallback() : {};

                    this.authenticatedPeers.add(conn.peer);
                    this.connections.push(conn);

                    // Envia o pacote de boas-vindas com o mundo e o save do player
                    conn.send({ 
                        type: 'AUTH_SUCCESS', 
                        seed: this.roomData.seed, 
                        worldState: currentState,
                        playerData: savedPlayerData,
                        guests: fullGuestsDB 
                    });
                } else {
                    this._log(`Senha incorreta para: ${conn.peer}`, "#c0392b");
                    conn.send({ type: 'AUTH_FAIL', reason: 'Senha da Colmeia Incorreta' });
                    setTimeout(() => conn.close(), 500);
                }
                return;
            }

            // 2. Segurança: Ignora dados de peers não autenticados
            if (!this.authenticatedPeers.has(conn.peer)) return;

            // 3. Segurança: Sobrescreve IDs de origem para evitar spoofing
            data.fromId = conn.peer;
            if (data.id) data.id = conn.peer; 
            if (data.ownerId) data.ownerId = conn.peer; 

            // 4. Lógica de Roteamento (Party, Whisper, Broadcast)
            this.processAndRoute(data);
        });
    }

    joinRoom(targetID, password, nickname) {
        // Limpa ID para conectar
        const cleanTarget = targetID.replace(/[^a-zA-Z0-9_-]/g, '');
        this._log(`Conectando ao Host: ${cleanTarget}...`, "#3498db");
        
        this.conn = this.peer.connect(cleanTarget, { reliable: true });
        
        this.conn.on('open', () => {
            this._log("Conexão técnica estabelecida. Enviando credenciais...", "#2ecc71");
            this.conn.send({ type: 'AUTH_REQUEST', password, nickname });
        });

        this.conn.on('data', (data) => {
            if (data.type === 'AUTH_SUCCESS') {
                this._log("Autenticação aceita! Entrando no mundo...", "#27ae60");
                // Importante: Dispara o evento que o Game.js ouve para iniciar
                window.dispatchEvent(new CustomEvent('joined', { detail: data }));
            } else if (data.type === 'AUTH_FAIL') {
                alert(data.reason);
                this.conn.close();
                location.reload(); // Recarrega para limpar estado
            } else {
                // Dados normais de jogo
                window.dispatchEvent(new CustomEvent('netData', { detail: data }));
            }
        });
        
        this.conn.on('close', () => {
            alert("A conexão com a Colmeia Real (Host) foi perdida.");
            location.reload();
        });

        this.conn.on('error', (err) => {
            console.error("Erro na conexão:", err);
            alert("Não foi possível conectar a esta Colmeia.");
        });
    }

    processAndRoute(data) {
        // Roteamento baseado em alvos (Party/Whisper)
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
        else {
            // Broadcast (Global)
            // Host processa o dado também
            window.dispatchEvent(new CustomEvent('netData', { detail: data }));
            // E retransmite para os outros (excluindo quem mandou)
            this.broadcast(data, data.fromId);
        }
    }

    sendPayload(payload, targetIdOrIds = null) {
        if (!this.peer) return;
        
        // Host sempre assina seus pacotes
        payload.fromId = this.peer.id; 
        
        // Garante integridade do ID no payload local
        if (['MOVE', 'SPAWN_INFO', 'SHOOT'].includes(payload.type)) {
            if (payload.type === 'SHOOT') payload.ownerId = this.peer.id;
            else payload.id = this.peer.id;
        }

        if (this.isHost) {
            // Lógica de envio do Host
            if (Array.isArray(targetIdOrIds)) {
                targetIdOrIds.forEach(id => {
                    if (id === this.peer.id) window.dispatchEvent(new CustomEvent('netData', { detail: payload }));
                    else this.sendToId(id, payload);
                });
            } else if (targetIdOrIds) {
                if (targetIdOrIds === this.peer.id) window.dispatchEvent(new CustomEvent('netData', { detail: payload }));
                else this.sendToId(targetIdOrIds, payload);
            } else {
                // Host envia para todos (Broadcast)
                this.broadcast(payload);
            }
        } else if (this.conn && this.conn.open) {
            // Lógica de envio do Cliente (Guest)
            // Se tiver alvos, anexa ao payload para o Host rotear
            if (Array.isArray(targetIdOrIds)) {
                payload.targetIds = targetIdOrIds;
            } else if (targetIdOrIds) {
                payload.targetId = targetIdOrIds;
            }
            this.conn.send(payload);
        }
    }

    /**
     * Função utilitária para enviar cura específica para uma lista de IDs.
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

    sendToId(peerId, data) {
        const targetConn = this.connections.find(c => c.peer === peerId);
        if (targetConn && targetConn.open) {
            targetConn.send(data);
        }
    }

    broadcast(data, excludePeerId = null) {
        this.connections.forEach(c => { 
            // Só envia para peers que já passaram pela autenticação
            if (c.peer !== excludePeerId && c.open && this.authenticatedPeers.has(c.peer)) {
                c.send(data);
            }
        });
    }
}
