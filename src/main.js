import { NetworkManager } from './core/network.js';
import { WorldGenerator } from './world/worldGen.js';
import { Player } from './entities/player.js';
import { InputHandler } from './core/input.js';

const canvas = document.getElementById('gameCanvas');
const ctx = canvas.getContext('2d');
const net = new NetworkManager();
const input = new InputHandler();

let world, localPlayer;
let remotePlayers = {};
let camera = { x: 0, y: 0 };

// Carregamento de Assets Estáticos
const assets = {
    flower: new Image()
};
assets.flower.src = 'assets/Flower.png';

// --- UI HANDLERS ---
document.getElementById('btn-create').onclick = () => {
    const nick = document.getElementById('nickname').value || "Host";
    const id = document.getElementById('create-id').value;
    const pass = document.getElementById('create-pass').value;
    const seed = document.getElementById('world-seed').value || Date.now().toString();
    if(!id) return alert("ID obrigatório");
    net.init(id, (ok) => {
        if(ok) {
            net.hostRoom(id, pass, seed);
            setupGame(seed, id, nick);
        }
    });
};

document.getElementById('btn-join').onclick = () => {
    const nick = document.getElementById('nickname').value || "Guest";
    const id = document.getElementById('join-id').value;
    const pass = document.getElementById('join-pass').value;
    net.init(null, (ok) => { if(ok) net.joinRoom(id, pass, nick); });
};

window.addEventListener('joined', e => setupGame(e.detail.seed, net.peer.id, document.getElementById('nickname').value));

window.addEventListener('netData', e => {
    const d = e.detail;
    if(d.type === 'MOVE') {
        if(!remotePlayers[d.id]) remotePlayers[d.id] = new Player(d.id, d.nick);
        remotePlayers[d.id].targetPos = { x: d.x, y: d.y };
        remotePlayers[d.id].currentDir = d.dir; // Sincroniza a direção visual
    }
});

function setupGame(seed, id, nick) {
    document.getElementById('lobby-container').style.display = 'none';
    canvas.style.display = 'block';
    world = new WorldGenerator(seed);
    localPlayer = new Player(id, nick, true);
    resize();
    requestAnimationFrame(loop);
}

function loop() {
    update();
    draw();
    requestAnimationFrame(loop);
}

function update() {
    if(!localPlayer) return;
    const m = input.getMovement();
    
    // Atualiza lógica interna (direção e estado)
    localPlayer.update(m);

    if(m.x !== 0 || m.y !== 0) {
        localPlayer.pos.x += m.x * localPlayer.speed;
        localPlayer.pos.y += m.y * localPlayer.speed;
        
        // Enviamos também a direção (dir) para os outros players
        net.sendPayload({ 
            type: 'MOVE', 
            id: localPlayer.id, 
            nick: localPlayer.nickname, 
            x: localPlayer.pos.x, 
            y: localPlayer.pos.y,
            dir: localPlayer.currentDir 
        });
    }
    
    camera.x = localPlayer.pos.x;
    camera.y = localPlayer.pos.y;
    Object.values(remotePlayers).forEach(p => p.update({x:0, y:0}));
}

function draw() {
    ctx.fillStyle = "#1a1a1a";
    ctx.fillRect(0, 0, canvas.width, canvas.height);
    if(!world) return;

    const cX = Math.floor(localPlayer.pos.x / world.chunkSize);
    const cY = Math.floor(localPlayer.pos.y / world.chunkSize);

    for(let x=-1; x<=1; x++) for(let y=-1; y<=1; y++) {
        world.getChunk(cX+x, cY+y).forEach(t => {
            const sX = (t.x - camera.x) * world.tileSize + canvas.width/2;
            const sY = (t.y - camera.y) * world.tileSize + canvas.height/2;
            
            if(sX > -32 && sX < canvas.width+32 && sY > -32 && sY < canvas.height+32) {
                // Desenha o chão primeiro
                ctx.fillStyle = (t.type === 'GRAMA' || t.type === 'FLOR_POLEM') ? '#2ecc71' : 
                               (t.type === 'COLMEIA' ? '#f1c40f' : '#34495e');
                ctx.fillRect(sX, sY, world.tileSize, world.tileSize);

                // Se for flor, desenha o sprite por cima da grama
                if(t.type === 'FLOR_POLEM' && assets.flower.complete) {
                    ctx.drawImage(assets.flower, sX, sY, world.tileSize, world.tileSize);
                }
            }
        });
    }
    
    Object.values(remotePlayers).forEach(p => p.draw(ctx, camera, canvas, world.tileSize));
    localPlayer.draw(ctx, camera, canvas, world.tileSize);
}

function resize() { canvas.width = window.innerWidth; canvas.height = window.innerHeight; }
window.onresize = resize;
