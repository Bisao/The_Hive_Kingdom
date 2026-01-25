import { NetworkManager } from './core/network.js';
import { WorldGenerator } from './world/worldGen.js';
import { WorldState } from './world/worldState.js';
import { Player } from './entities/player.js';
import { InputHandler } from './core/input.js';
import { SaveSystem } from './core/saveSystem.js';
import { ChatSystem } from './core/chatSystem.js';

// --- INICIALIZAÇÃO DE CORE ---
const canvas = document.getElementById('gameCanvas');
const ctx = canvas.getContext('2d');
const net = new NetworkManager();
const input = new InputHandler(); 
const worldState = new WorldState();
const saveSystem = new SaveSystem();
const chat = new ChatSystem();

// --- ESTADO GLOBAL ---
let world, localPlayer;
let remotePlayers = {};
let pollenParticles = [];
let smokeParticles = []; 
let camera = { x: 0, y: 0 };
let guestDataDB = {}; 

// Estado de UI e Social
let lastGridX = -9999, lastGridY = -9999;
let currentPartyPartner = null; 
let selectedPlayerId = null;    
let pendingInviteFrom = null;   

// Configurações de Zoom
let zoomLevel = 1.0; 
const MIN_ZOOM = 0.5, MAX_ZOOM = 1.5;

// --- CONFIGURAÇÕES DE GAMEPLAY ---
const PLANT_SPAWN_CHANCE = 0.20; 
const CURE_ATTEMPT_RATE = 60;    
const FLOWER_COOLDOWN_TIME = 10000;
const COLLECTION_RATE = 5; 

const DAMAGE_RATE = 2, DAMAGE_AMOUNT = 0.2; 
const HEAL_RATE = 1, HEAL_AMOUNT = 1;   
const XP_PER_CURE = 15, XP_PER_POLLEN = 0.2, XP_PASSIVE_CURE = 5;

const GROWTH_TIMES = { BROTO: 5000, MUDA: 10000, FLOR: 15000 };

let collectionFrameCounter = 0, cureFrameCounter = 0, damageFrameCounter = 0, uiUpdateCounter = 0;

const assets = { flower: new Image() };
assets.flower.src = 'assets/Flower.png';

// --- UI HANDLERS (LOBBY) ---
document.getElementById('btn-create').onclick = () => {
    const nick = document.getElementById('host-nickname').value || "Host";
    const id = document.getElementById('create-id').value;
    const pass = document.getElementById('create-pass').value;
    const seed = document.getElementById('world-seed').value || Date.now().toString();
    if(!id) return alert("ID obrigatório");
    
    net.init(id, (ok) => {
        if(ok) {
            net.hostRoom(id, pass, seed, () => worldState.getFullState(), (guestNick) => guestDataDB[guestNick]);
            startGame(seed, id, nick);
            if(net.isHost) startHostSimulation();
        } else { document.getElementById('status-msg').innerText = "Erro ao criar sala."; }
    });
};

document.getElementById('btn-join').onclick = () => {
    const nick = document.getElementById('join-nickname').value || "Guest", id = document.getElementById('join-id').value, pass = document.getElementById('join-pass').value;
    if(!id) return alert("ID obrigatório");
    net.init(null, (ok) => { if(ok) net.joinRoom(id, pass, nick); });
};

// --- ZOOM E CONTROLES ---
window.addEventListener('wheel', (e) => {
    if (!localPlayer) return;
    zoomLevel = Math.max(MIN_ZOOM, Math.min(MAX_ZOOM, zoomLevel + (e.deltaY > 0 ? -0.05 : 0.05)));
    if (document.getElementById('zoom-slider')) document.getElementById('zoom-slider').value = zoomLevel;
}, { passive: true });

const zoomSlider = document.getElementById('zoom-slider');
if(zoomSlider) zoomSlider.oninput = (e) => { zoomLevel = parseFloat(e.target.value); };

// --- INTERAÇÃO SOCIAL (PARTY/WHISPER) ---

window.addEventListener('playerClicked', e => {
    const targetNick = e.detail;
    const targetId = Object.keys(remotePlayers).find(id => remotePlayers[id].nickname === targetNick);
    if (targetId) {
        selectedPlayerId = targetId;
        const p = remotePlayers[targetId];
        document.getElementById('modal-player-name').innerText = p.nickname;
        document.getElementById('modal-player-info').innerText = `Nível: ${p.level || 1}`;
        const partyBtn = document.getElementById('btn-party-action');
        partyBtn.innerText = (currentPartyPartner === targetId) ? "Sair da Party" : "Convidar para Party";
        partyBtn.style.background = (currentPartyPartner === targetId) ? "#e74c3c" : "#3498db";
        document.getElementById('player-modal').style.display = 'block';
    }
});

document.getElementById('btn-party-action').onclick = () => {
    if (!selectedPlayerId) return;
    if (currentPartyPartner === selectedPlayerId) {
        net.sendPayload({ type: 'PARTY_LEAVE', fromId: localPlayer.id }, selectedPlayerId);
        chat.addMessage('SYSTEM', null, `Você saiu da party com ${remotePlayers[selectedPlayerId].nickname}.`);
        currentPartyPartner = null;
    } else {
        net.sendPayload({ type: 'PARTY_INVITE', fromId: localPlayer.id, fromNick: localPlayer.nickname }, selectedPlayerId);
        chat.addMessage('SYSTEM', null, `Convite enviado para ${remotePlayers[selectedPlayerId].nickname}.`);
    }
    document.getElementById('player-modal').style.display = 'none';
};

document.getElementById('btn-whisper-action').onclick = () => {
    if (!selectedPlayerId) return;
    const msg = prompt(`Cochichar para ${remotePlayers[selectedPlayerId].nickname}:`);
    if (msg?.trim()) {
        net.sendPayload({ type: 'WHISPER', fromNick: localPlayer.nickname, text: msg }, selectedPlayerId);
        chat.addMessage('WHISPER', remotePlayers[selectedPlayerId].nickname, `(Para): ${msg}`);
    }
    document.getElementById('player-modal').style.display = 'none';
};

document.getElementById('btn-accept-invite').onclick = () => {
    if (pendingInviteFrom) {
        currentPartyPartner = pendingInviteFrom;
        net.sendPayload({ type: 'PARTY_ACCEPT', fromId: localPlayer.id, fromNick: localPlayer.nickname }, pendingInviteFrom);
        chat.addMessage('SYSTEM', null, `Você entrou na party.`);
        document.getElementById('party-invite').style.display = 'none';
        pendingInviteFrom = null;
    }
};

document.getElementById('btn-decline-invite').onclick = () => {
    document.getElementById('party-invite').style.display = 'none';
    pendingInviteFrom = null;
};

// --- REDE E CHAT ---
window.addEventListener('chatSend', e => {
    if (!localPlayer) return;
    chat.addMessage('SELF', localPlayer.nickname, e.detail);
    net.sendPayload({ type: 'CHAT_MSG', id: localPlayer.id, nick: localPlayer.nickname, text: e.detail });
});

window.addEventListener('joined', e => {
    const data = e.detail;
    if (data.worldState) worldState.applyFullState(data.worldState);
    startGame(data.seed, net.peer.id, document.getElementById('join-nickname').value || "Guest");
    if (data.playerData) { localPlayer.deserialize(data.playerData); updateUI(); }
});

window.addEventListener('peerDisconnected', e => {
    const id = e.detail.peerId;
    if (remotePlayers[id]) {
        chat.addMessage('SYSTEM', null, `${remotePlayers[id].nickname} saiu.`);
        if (currentPartyPartner === id) currentPartyPartner = null;
        guestDataDB[remotePlayers[id].nickname] = remotePlayers[id].serialize().stats;
        saveProgress();
        delete remotePlayers[id];
        updateRanking();
    }
});

window.addEventListener('netData', e => {
    const d = e.detail;
    switch(d.type) {
        case 'CHAT_MSG': chat.addMessage('GLOBAL', d.nick, d.text); break;
        case 'WHISPER': chat.addMessage('WHISPER', d.fromNick, d.text); chat.updateNotification(); break;
        case 'PARTY_INVITE': pendingInviteFrom = d.fromId; document.getElementById('invite-text').innerText = `${d.fromNick} convidou você para party.`; document.getElementById('party-invite').style.display = 'block'; break;
        case 'PARTY_ACCEPT': currentPartyPartner = d.fromId; chat.addMessage('SYSTEM', null, `${d.fromNick} aceitou a party!`); break;
        case 'PARTY_LEAVE': if (currentPartyPartner === d.fromId) { chat.addMessage('SYSTEM', null, `Party desfeita.`); currentPartyPartner = null; } break;
        case 'MOVE':
            if(!remotePlayers[d.id]) { remotePlayers[d.id] = new Player(d.id, d.nick); chat.addMessage('SYSTEM', null, `${d.nick} entrou.`); }
            remotePlayers[d.id].targetPos = { x: d.x, y: d.y }; remotePlayers[d.id].currentDir = d.dir;
            if (d.stats) remotePlayers[d.id].deserialize({ stats: d.stats });
            break;
        case 'TILE_CHANGE': changeTile(d.x, d.y, d.tileType, d.ownerId); break;
        case 'FLOWER_CURE':
            if (localPlayer?.id === d.ownerId) { localPlayer.tilesCured++; gainXp(XP_PASSIVE_CURE); }
            if (remotePlayers[d.ownerId]) remotePlayers[d.ownerId].tilesCured = (remotePlayers[d.ownerId].tilesCured || 0) + 1;
            break;
    }
});

// --- ENGINE PRINCIPAL ---
function startGame(seed, id, nick) {
    document.getElementById('lobby-overlay').style.display = 'none';
    document.getElementById('rpg-hud').style.display = 'block';
    document.getElementById('chat-toggle-btn').style.display = 'block';
    canvas.style.display = 'block';
    if (input.isMobile) {
        document.getElementById('zoom-controls').style.display = 'flex';
        document.getElementById('mobile-controls').style.display = 'block';
    }

    world = new WorldGenerator(seed);
    localPlayer = new Player(id, nick, true);

    const hives = world.getHiveLocations();
    let spawnIdx = net.isHost ? 0 : (Math.abs(id.split('').reduce((a,b)=>a+b.charCodeAt(0),0)) % (hives.length - 1)) + 1;
    localPlayer.homeBase = hives[spawnIdx] || {x:0, y:0};
    localPlayer.pos = { ...localPlayer.homeBase };
    localPlayer.targetPos = { ...localPlayer.pos };

    if (net.isHost) {
        const saved = saveSystem.load();
        if (saved) { worldState.applyFullState(saved.world); if (saved.host) localPlayer.deserialize({ stats: saved.host }); guestDataDB = saved.guests || {}; }
    }
    updateUI(); resize(); requestAnimationFrame(loop);
}

function startHostSimulation() {
    setInterval(() => {
        const now = Date.now();
        let changed = false;
        for (const [key, plantData] of Object.entries(worldState.growingPlants)) {
            const startTime = plantData.time || plantData, ownerId = plantData.owner || null;
            const [x, y] = key.split(',').map(Number), elapsed = now - startTime, type = worldState.getModifiedTile(x, y);

            if (type === 'GRAMA' && elapsed > GROWTH_TIMES.BROTO) changeTile(x, y, 'BROTO', ownerId);
            else if (type === 'BROTO' && elapsed > GROWTH_TIMES.MUDA) changeTile(x, y, 'MUDA', ownerId);
            else if (type === 'MUDA' && elapsed > GROWTH_TIMES.FLOR) changeTile(x, y, 'FLOR', ownerId);

            if (type === 'FLOR' && Math.random() < 0.10) {
                const tx = x + (Math.floor(Math.random()*3)-1), ty = y + (Math.floor(Math.random()*3)-1);
                if ((worldState.getModifiedTile(tx, ty) || world.getTileAt(tx, ty)) === 'TERRA_QUEIMADA') {
                    changeTile(tx, ty, 'GRAMA_SAFE');
                    if (ownerId) net.sendPayload({ type: 'FLOWER_CURE', ownerId: ownerId });
                    changed = true;
                }
            }
        }
        if (changed) saveProgress();
    }, 1000);
    setInterval(saveProgress, 30000);
}

function update() {
    if(!localPlayer) return;
    const curX = Math.round(localPlayer.pos.x), curY = Math.round(localPlayer.pos.y);
    if (curX !== lastGridX || curY !== lastGridY) {
        lastGridX = curX; lastGridY = curY;
        const el = document.getElementById('hud-coords');
        if(el) el.innerText = `${curX}, ${curY}`;
    }

    const m = input.getMovement();
    localPlayer.update(m);
    if (m.x !== 0 || m.y !== 0 || Math.random() < 0.05) {
        localPlayer.pos.x += m.x * localPlayer.speed; localPlayer.pos.y += m.y * localPlayer.speed;
        net.sendPayload({ type: 'MOVE', id: localPlayer.id, nick: localPlayer.nickname, x: localPlayer.pos.x, y: localPlayer.pos.y, dir: localPlayer.currentDir, stats: { level: localPlayer.level, hp: localPlayer.hp, maxHp: localPlayer.maxHp, tilesCured: localPlayer.tilesCured }});
    }

    if (localPlayer.pollen > 0 && (m.x !== 0 || m.y !== 0)) spawnPollenParticle();
    updateParticles();

    const tile = worldState.getModifiedTile(curX, curY) || world.getTileAt(curX, curY);
    const isSafe = ['GRAMA', 'GRAMA_SAFE', 'BROTO', 'MUDA', 'FLOR', 'FLOR_COOLDOWN', 'COLMEIA'].includes(tile);
    
    if (!isSafe) {
        if (++damageFrameCounter >= DAMAGE_RATE) {
            damageFrameCounter = 0; localPlayer.hp -= DAMAGE_AMOUNT; updateUI();
            if (localPlayer.hp <= 0) { localPlayer.respawn(); localPlayer.pos = {...localPlayer.homeBase}; updateUI(); }
        }
    } else {
        damageFrameCounter = 0; if (localPlayer.hp < localPlayer.maxHp) { localPlayer.hp = Math.min(localPlayer.maxHp, localPlayer.hp + HEAL_AMOUNT); updateUI(); }
    }

    if (tile === 'FLOR' && localPlayer.pollen < localPlayer.maxPollen && ++collectionFrameCounter >= COLLECTION_RATE) {
        localPlayer.pollen++; collectionFrameCounter = 0; gainXp(XP_PER_POLLEN);
        if (localPlayer.pollen >= localPlayer.maxPollen) changeTile(curX, curY, 'FLOR_COOLDOWN', localPlayer.id);
    }

    if (tile === 'TERRA_QUEIMADA' && localPlayer.pollen > 0 && (m.x !== 0 || m.y !== 0) && ++cureFrameCounter >= CURE_ATTEMPT_RATE) {
        cureFrameCounter = 0; localPlayer.pollen--;
        if (Math.random() < PLANT_SPAWN_CHANCE) { changeTile(curX, curY, 'GRAMA', localPlayer.id); localPlayer.tilesCured++; gainXp(XP_PER_CURE); saveProgress(); }
        updateUI();
    }

    uiUpdateCounter++; if(uiUpdateCounter > 60) { updateRanking(); uiUpdateCounter = 0; }
    camera.x = localPlayer.pos.x; camera.y = localPlayer.pos.y;
    Object.values(remotePlayers).forEach(p => p.update({x:0, y:0}));
}

function draw() {
    ctx.fillStyle = "#0d0d0d"; ctx.fillRect(0, 0, canvas.width, canvas.height);
    if(!world) return;
    const rTileSize = world.tileSize * zoomLevel;
    const cX = Math.floor(localPlayer.pos.x / world.chunkSize), cY = Math.floor(localPlayer.pos.y / world.chunkSize);
    
    for(let x=-2; x<=2; x++) for(let y=-2; y<=2; y++) {
        world.getChunk(cX+x, cY+y).forEach(t => {
            const sX = (t.x - camera.x) * rTileSize + canvas.width/2, sY = (t.y - camera.y) * rTileSize + canvas.height/2;
            if(sX > -rTileSize && sX < canvas.width+rTileSize && sY > -rTileSize && sY < canvas.height+rTileSize) {
                const type = worldState.getModifiedTile(t.x, t.y) || t.type;
                ctx.fillStyle = (type === 'COLMEIA') ? '#f1c40f' : (['GRAMA','GRAMA_SAFE','BROTO','MUDA','FLOR'].includes(type) ? '#2ecc71' : '#34495e');
                ctx.fillRect(sX, sY, rTileSize, rTileSize);
                if (type === 'FLOR' && assets.flower.complete) ctx.drawImage(assets.flower, sX, sY, rTileSize, rTileSize);
            }
        });
    }

    pollenParticles.forEach(p => { 
        const psX = (p.wx - camera.x) * rTileSize + canvas.width/2, psY = (p.wy - camera.y) * rTileSize + canvas.height/2;
        ctx.fillStyle = `rgba(241, 196, 15, ${p.life})`; ctx.fillRect(psX, psY, 2*zoomLevel, 2*zoomLevel);
    });

    Object.values(remotePlayers).forEach(p => p.draw(ctx, camera, canvas, rTileSize));
    localPlayer.draw(ctx, camera, canvas, rTileSize);
    
    // Bússola
    if (localPlayer.homeBase && Math.sqrt(Math.pow(localPlayer.homeBase.x - localPlayer.pos.x, 2) + Math.pow(localPlayer.homeBase.y - localPlayer.pos.y, 2)) > 30) {
        const angle = Math.atan2(localPlayer.homeBase.y - localPlayer.pos.y, localPlayer.homeBase.x - localPlayer.pos.x), orbit = 60 * zoomLevel;
        ctx.save(); ctx.translate(canvas.width/2 + Math.cos(angle)*orbit, canvas.height/2 + Math.sin(angle)*orbit); ctx.rotate(angle);
        ctx.fillStyle = "#f1c40f"; ctx.beginPath(); ctx.moveTo(0,0); ctx.lineTo(-10*zoomLevel, -5*zoomLevel); ctx.lineTo(-10*zoomLevel, 5*zoomLevel); ctx.fill(); ctx.restore();
    }
}

// --- UTILITÁRIOS ---
function loop() { update(); draw(); requestAnimationFrame(loop); }
function resize() { canvas.width = window.innerWidth; canvas.height = window.innerHeight; }
function spawnPollenParticle() { pollenParticles.push({wx: localPlayer.pos.x + Math.random()*0.4-0.2, wy: localPlayer.pos.y + Math.random()*0.4-0.2, life: 1.0}); }
function updateParticles() { pollenParticles = pollenParticles.filter(p => (p.life -= 0.02) > 0); }
function gainXp(amt) { localPlayer.xp += amt; if(localPlayer.xp >= localPlayer.maxXp) { localPlayer.level++; localPlayer.xp=0; localPlayer.maxXp*=1.5; chat.addMessage('SYSTEM', null, `Nível ${localPlayer.level}!`); saveProgress(); } updateUI(); }
function updateUI() {
    document.getElementById('hud-name').innerText = localPlayer.nickname;
    document.getElementById('hud-lvl').innerText = localPlayer.level;
    document.getElementById('bar-hp-fill').style.width = `${(localPlayer.hp/localPlayer.maxHp)*100}%`;
    document.getElementById('bar-hp-text').innerText = `${Math.ceil(localPlayer.hp)}/${localPlayer.maxHp}`;
    document.getElementById('bar-xp-fill').style.width = `${(localPlayer.xp/localPlayer.maxXp)*100}%`;
    document.getElementById('bar-xp-text').innerText = `${Math.floor(localPlayer.xp)}/${localPlayer.maxXp}`;
    document.getElementById('bar-pollen-fill').style.width = `${(localPlayer.pollen/localPlayer.maxPollen)*100}%`;
    document.getElementById('bar-pollen-text').innerText = `${localPlayer.pollen}/${localPlayer.maxPollen}`;
}
function updateRanking() {
    const list = document.getElementById('ranking-list'); if (!list || list.style.display === 'none') return;
    const all = [localPlayer, ...Object.values(remotePlayers)].sort((a,b) => b.tilesCured - a.tilesCured);
    list.innerHTML = all.slice(0,5).map((p,i) => `<div class="rank-item"><span>${i+1}. ${p.nickname}</span><span class="rank-val">${p.tilesCured}</span></div>`).join('');
}
function saveProgress() {
    if (!net.isHost || !localPlayer) return;
    Object.values(remotePlayers).forEach(p => guestDataDB[p.nickname] = p.serialize().stats);
    saveSystem.save({ seed: world.seedVal, world: worldState.getFullState(), host: localPlayer.serialize().stats, guests: guestDataDB });
}
function changeTile(x, y, type, owner) { 
    if(worldState.setTile(x,y,type)) { 
        if(net.isHost && type==='GRAMA') worldState.addGrowingPlant(x,y,owner); 
        net.sendPayload({type:'TILE_CHANGE', x, y, tileType:type, ownerId:owner}); 
    } 
}

window.onresize = resize;
