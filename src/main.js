// src/main.js
import { NetworkManager } from './core/network.js';
import { WorldGenerator } from './world/worldGen.js';
import { Player } from './entities/player.js';

const canvas = document.getElementById('gameCanvas');
const ctx = canvas.getContext('2d');
const net = new NetworkManager();

let world;
let localPlayer;
let remotePlayers = {}; // Guarda as outras abelhas { id: PlayerObject }
let camera = { x: 0, y: 0 };

// Ajusta o tamanho do canvas
function resize() {
    canvas.width = window.innerWidth;
    canvas.height = window.innerHeight;
}
window.addEventListener('resize', resize);
resize();

// --- LÓGICA DE CONEXÃO (UI) ---
// (Mantenha os eventListeners dos botões btn-create e btn-join do script anterior aqui)

// --- INICIALIZAÇÃO DO JOGO ---
window.addEventListener('joined', (e) => {
    const { seed, id } = e.detail;
    
    document.getElementById('lobby-container').style.display = 'none';
    canvas.style.display = 'block';

    world = new WorldGenerator(seed);
    localPlayer = new Player(id, document.getElementById('nickname').value, true);
    
    // Inicia o Loop
    requestAnimationFrame(gameLoop);
});

// --- GAME LOOP PROFISSIONAL ---
function gameLoop() {
    update();
    draw();
    requestAnimationFrame(gameLoop);
}

function update() {
    if (!localPlayer) return;

    // 1. Movimentação Local (será refinada no input.js depois)
    // 2. Atualizar Câmera para seguir o Player
    camera.x = localPlayer.pos.x;
    camera.y = localPlayer.pos.y;

    // 3. Enviar posição para os outros via Network
    if (Date.now() % 50 === 0) { // Envia a cada 50ms para não sobrecarregar
        const posData = {
            type: 'PLAYER_MOVE',
            id: localPlayer.id,
            x: localPlayer.pos.x,
            y: localPlayer.pos.y
        };
        
        if (net.isHost) {
            net.connections.forEach(conn => conn.send(posData));
        } else if (net.conn) {
            net.conn.send(posData);
        }
    }

    // 4. Atualizar jogadores remotos (interpolação)
    Object.values(remotePlayers).forEach(p => p.update());
}

function draw() {
    ctx.clearRect(0, 0, canvas.width, canvas.height);

    if (!world || !localPlayer) return;

    // 1. Renderizar o Mapa por Chunks (Foco em Performance)
    const currentChunkX = Math.floor(localPlayer.pos.x / world.chunkSize);
    const currentChunkY = Math.floor(localPlayer.pos.y / world.chunkSize);

    // Renderiza o chunk atual e os 8 ao redor (3x3 grid de chunks)
    for (let cx = -1; cx <= 1; cx++) {
        for (let cy = -1; cy <= 1; cy++) {
            const chunk = world.getChunk(currentChunkX + cx, currentChunkY + cy);
            drawChunk(chunk);
        }
    }

    // 2. Renderizar Outros Jogadores
    Object.values(remotePlayers).forEach(p => p.draw(ctx, camera));

    // 3. Renderizar Jogador Local
    localPlayer.draw(ctx, camera);
}

function drawChunk(tiles) {
    tiles.forEach(tile => {
        const screenX = (tile.x - camera.x) * world.tileSize + canvas.width / 2;
        const screenY = (tile.y - camera.y) * world.tileSize + canvas.height / 2;

        // Frustum Culling básico: Só desenha se estiver na tela
        if (screenX > -32 && screenX < canvas.width + 32 &&
            screenY > -32 && screenY < canvas.height + 32) {
            
            ctx.fillStyle = getTileColor(tile.type);
            ctx.fillRect(screenX, screenY, world.tileSize, world.tileSize);
            
            // Debug de grid (opcional)
            ctx.strokeStyle = "rgba(0,0,0,0.1)";
            ctx.strokeRect(screenX, screenY, world.tileSize, world.tileSize);
        }
    });
}

function getTileColor(type) {
    switch(type) {
        case 'COLMEIA': return '#f1c40f';
        case 'GRAMA': return '#2ecc71';
        case 'FLOR_POLEM': return '#e74c3c';
        case 'TERRA_QUEIMADA': return '#34495e';
        default: return '#27ae60';
    }
}
