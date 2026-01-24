// src/main.js (ATUALIZADO)
import { NetworkManager } from './core/network.js';
import { WorldGenerator } from './world/worldGen.js';
import { Player } from './entities/player.js';
import { InputHandler } from './core/input.js';

const canvas = document.getElementById('gameCanvas');
const ctx = canvas.getContext('2d');
const net = new NetworkManager();
const input = new InputHandler();

let world;
let localPlayer;
let remotePlayers = {}; 
let camera = { x: 0, y: 0 };

// --- UI EVENT LISTENERS (Resumo) ---
document.getElementById('btn-create').onclick = () => {
    const nick = document.getElementById('nickname').value;
    const id = document.getElementById('create-id').value;
    const pass = document.getElementById('create-pass').value;
    const seed = document.getElementById('world-seed').value || Date.now().toString();
    
    net.init(id, (ok) => {
        if(ok) {
            net.hostRoom(id, pass, seed);
            window.dispatchEvent(new CustomEvent('joined', { detail: { seed, id, nickname: nick } }));
        }
    });
};

document.getElementById('btn-join').onclick = () => {
    const nick = document.getElementById('nickname').value;
    const id = document.getElementById('join-id').value;
    const pass = document.getElementById('join-pass').value;
    net.init(null, (ok) => { if(ok) net.joinRoom(id, pass, nick); });
};

// --- LOGICA DE REDE RECEBIDA ---
window.addEventListener('netData', (e) => {
    const data = e.detail;
    if (data.type === 'PLAYER_MOVE') {
        if (!remotePlayers[data.id]) {
            remotePlayers[data.id] = new Player(data.id, data.nickname || "Bee", false);
        }
        remotePlayers[data.id].targetPos = { x: data.x, y: data.y };
    }
});

window.addEventListener('joined', (e) => {
    const { seed, id, nickname } = e.detail;
    document.getElementById('lobby-container').style.display = 'none';
    canvas.style.display = 'block';
    world = new WorldGenerator(seed);
    localPlayer = new Player(id, nickname, true);
    resize();
    requestAnimationFrame(gameLoop);
});

function gameLoop() {
    update();
    draw();
    requestAnimationFrame(gameLoop);
}

function update() {
    if (!localPlayer) return;

    const move = input.getMovement();
    localPlayer.pos.x += move.x * localPlayer.speed;
    localPlayer.pos.y += move.y * localPlayer.speed;

    camera.x = localPlayer.pos.x;
    camera.y = localPlayer.pos.y;

    // Sincronização Profissional: Envia apenas se houver movimento relevante
    if (move.x !== 0 || move.y !== 0) {
        net.sendPayload({
            type: 'PLAYER_MOVE',
            id: localPlayer.id,
            nickname: localPlayer.nickname,
            x: localPlayer.pos.x,
            y: localPlayer.pos.y
        });
    }

    Object.values(remotePlayers).forEach(p => p.update());
}

function draw() {
    if (!world || !localPlayer) return;
    ctx.clearRect(0, 0, canvas.width, canvas.height);

    const currentChunkX = Math.floor(localPlayer.pos.x / world.chunkSize);
    const currentChunkY = Math.floor(localPlayer.pos.y / world.chunkSize);

    for (let cx = -1; cx <= 1; cx++) {
        for (let cy = -1; cy <= 1; cy++) {
            drawChunk(world.getChunk(currentChunkX + cx, currentChunkY + cy));
        }
    }

    Object.values(remotePlayers).forEach(p => p.draw(ctx, camera));
    localPlayer.draw(ctx, camera);
}

function drawChunk(tiles) {
    tiles.forEach(tile => {
        const screenX = (tile.x - camera.x) * world.tileSize + canvas.width / 2;
        const screenY = (tile.y - camera.y) * world.tileSize + canvas.height / 2;
        if (screenX > -32 && screenX < canvas.width + 32 && screenY > -32 && screenY < canvas.height + 32) {
            ctx.fillStyle = getTileColor(tile.type);
            ctx.fillRect(screenX, screenY, world.tileSize, world.tileSize);
        }
    });
}

function getTileColor(type) {
    switch(type) {
        case 'COLMEIA': return '#f1c40f';
        case 'GRAMA': return '#2ecc71';
        case 'FLOR_POLEM': return '#e74c3c';
        case 'TERRA_QUEIMADA': return '#34495e';
        default: return '#1a1a1a';
    }
}

function resize() {
    canvas.width = window.innerWidth;
    canvas.height = window.innerHeight;
}
window.addEventListener('resize', resize);
