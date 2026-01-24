import { NetworkManager } from './core/network.js';
import { WorldGenerator } from './world/worldGen.js';
import { WorldState } from './world/worldState.js';
import { Player } from './entities/player.js';
import { InputHandler } from './core/input.js';

const canvas = document.getElementById('gameCanvas');
const ctx = canvas.getContext('2d');
const net = new NetworkManager();
const input = new InputHandler();
const worldState = new WorldState();

let world, localPlayer;
let remotePlayers = {};
let particles = [];
let camera = { x: 0, y: 0 };

// --- CONFIGURAÇÕES DE BALANÇO ---
const PLANT_SPAWN_CHANCE = 0.10; // Chance do jogador plantar uma flor (10%)
const CURE_ATTEMPT_RATE = 20;    // Frequência de gasto de pólen ao voar
const FLOWER_COOLDOWN_TIME = 10000;
const COLLECTION_RATE = 5; 

// --- TEMPOS DE CRESCIMENTO ---
// Mantive rápido para teste. Para produção, aumente os valores.
const GROWTH_TIMES = {
    BROTO: 5000,    // 5s
    MUDA: 10000,    // 10s
    FLOR: 15000     // 15s
};

let collectionFrameCounter = 0;
let cureFrameCounter = 0;

const assets = { flower: new Image() };
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
            net.hostRoom(id, pass, seed, () => worldState.getFullState());
            startGame(seed, id, nick);
            if(net.isHost) startHostSimulation();
        }
    });
};

document.getElementById('btn-join').onclick = () => {
    const nick = document.getElementById('nickname').value || "Guest";
    const id = document.getElementById('join-id').value;
    const pass = document.getElementById('join-pass').value;
    net.init(null, (ok) => { if(ok) net.joinRoom(id, pass, nick); });
};

// --- REDE ---
window.addEventListener('joined', e => {
    const data = e.detail;
    if (data.worldState) worldState.applyFullState(data.worldState);
    startGame(data.seed, net.peer.id, document.getElementById('nickname').value);
});

window.addEventListener('netData', e => {
    const d = e.detail;
    
    if(d.type === 'MOVE') {
        if(!remotePlayers[d.id]) remotePlayers[d.id] = new Player(d.id, d.nick);
        remotePlayers[d.id].targetPos = { x: d.x, y: d.y };
        remotePlayers[d.id].currentDir = d.dir;
    }
    
    if(d.type === 'TILE_CHANGE') {
        worldState.setTile(d.x, d.y, d.tileType);

        if (net.isHost) {
            // Se o tile mudou para GRAMA (pelo jogador), inicia crescimento
            // (Note que a cura passiva da flor não usa o tipo 'GRAMA', veja abaixo)
            if (d.tileType === 'GRAMA') {
                worldState.addGrowingPlant(d.x, d.y);
            }
            if (d.tileType === 'FLOR_COOLDOWN') {
                setTimeout(() => changeTile(d.x, d.y, 'FLOR'), FLOWER_COOLDOWN_TIME);
            }
        }
    }
});

function startGame(seed, id, nick) {
    document.getElementById('lobby-container').style.display = 'none';
    document.getElementById('game-ui').style.display = 'block';
    canvas.style.display = 'block';
    world = new WorldGenerator(seed);
    localPlayer = new Player(id, nick, true);
    resize();
    requestAnimationFrame(loop);
}

// --- HOST SIMULATION ---
function startHostSimulation() {
    setInterval(() => {
        const now = Date.now();

        // 1. Processar Crescimento (Só tiles 'GRAMA' evoluem)
        for (const [key, startTime] of Object.entries(worldState.growingPlants)) {
            const [x, y] = key.split(',').map(Number);
            const elapsed = now - startTime;
            const currentType = worldState.getModifiedTile(x, y);

            if (currentType === 'GRAMA' && elapsed > GROWTH_TIMES.BROTO) changeTile(x, y, 'BROTO');
            else if (currentType === 'BROTO' && elapsed > GROWTH_TIMES.MUDA) changeTile(x, y, 'MUDA');
            else if (currentType === 'MUDA' && elapsed > GROWTH_TIMES.FLOR) {
                changeTile(x, y, 'FLOR');
                worldState.removeGrowingPlant(x, y);
            }
        }

        // 2. Cura Passiva (Flor Adulta cura vizinhos, mas NÃO planta sementes)
        for (const [key, type] of Object.entries(worldState.modifiedTiles)) {
            if (type === 'FLOR') {
                // Tenta expandir (30% chance/segundo)
                if (Math.random() < 0.30) { 
                    const [fx, fy] = key.split(',').map(Number);
                    const tx = fx + (Math.floor(Math.random() * 3) - 1);
                    const ty = fy + (Math.floor(Math.random() * 3) - 1);
                    
                    const tType = worldState.getModifiedTile(tx, ty) || world.getTileAt(tx, ty);
                    
                    if (tType === 'TERRA_QUEIMADA') {
                        // AQUI ESTÁ A MUDANÇA:
                        // Cura passiva define como 'GRAMA_SAFE'.
                        // Visualmente é verde igual, mas o Host NÃO inicia crescimento nela.
                        changeTile(tx, ty, 'GRAMA_SAFE');
                    }
                }
            }
        }
    }, 1000);
}

function loop() {
    update();
    draw();
    requestAnimationFrame(loop);
}

// Partículas
function spawnPollenParticle() {
    particles.push({
        x: localPlayer.pos.x + (Math.random() * 0.4 - 0.2),
        y: localPlayer.pos.y + (Math.random() * 0.4 - 0.2),
        size: Math.random() * 3 + 2,
        speedY: Math.random() * 0.02 + 0.01,
        life: 1.0
    });
}

function updateParticles() {
    for (let i = particles.length - 1; i >= 0; i--) {
        let p = particles[i];
        p.y += p.speedY;
        p.life -= 0.02;
        if (p.life <= 0) particles.splice(i, 1);
    }
}

function update() {
    if(!localPlayer) return;

    const m = input.getMovement();
    localPlayer.update(m);

    const isMoving = m.x !== 0 || m.y !== 0;

    if(isMoving) {
        localPlayer.pos.x += m.x * localPlayer.speed;
        localPlayer.pos.y += m.y * localPlayer.speed;
        net.sendPayload({ 
            type: 'MOVE', id: localPlayer.id, nick: localPlayer.nickname, 
            x: localPlayer.pos.x, y: localPlayer.pos.y, dir: localPlayer.currentDir
        });
    }

    // 1. Efeito Visual Constante: Se tem pólen, solta partícula (Mesmo parado)
    if (localPlayer.pollen > 0) {
        // Chance menor se estiver parado para não virar uma "fonte" de partículas
        // Chance maior se estiver voando
        if (isMoving || Math.random() < 0.3) {
            spawnPollenParticle();
        }
    }
    updateParticles();

    const gridX = Math.round(localPlayer.pos.x);
    const gridY = Math.round(localPlayer.pos.y);
    const currentTile = worldState.getModifiedTile(gridX, gridY) || world.getTileAt(gridX, gridY);

    // 2. Coleta de Pólen (Só tile exato)
    if (currentTile === 'FLOR' && localPlayer.pollen < localPlayer.maxPollen) {
        collectionFrameCounter++;
        if (collectionFrameCounter >= COLLECTION_RATE) {
            localPlayer.pollen++;
            collectionFrameCounter = 0;
            updateUI();
            if (localPlayer.pollen >= localPlayer.maxPollen) changeTile(gridX, gridY, 'FLOR_COOLDOWN');
        }
    } else {
        collectionFrameCounter = 0;
    }

    // 3. Cura Manual (Semente) - Só gasta se estiver voando
    if (currentTile === 'TERRA_QUEIMADA' && localPlayer.pollen > 0 && isMoving) {
        cureFrameCounter++;
        if (cureFrameCounter >= CURE_ATTEMPT_RATE) {
            cureFrameCounter = 0;
            localPlayer.pollen--;
            updateUI();

            if (Math.random() < PLANT_SPAWN_CHANCE) {
                // Jogador planta uma semente real ('GRAMA')
                changeTile(gridX, gridY, 'GRAMA');
            } 
        }
    } else {
        cureFrameCounter = 0;
    }

    camera.x = localPlayer.pos.x;
    camera.y = localPlayer.pos.y;
    Object.values(remotePlayers).forEach(p => p.update({x:0, y:0}));
}

function changeTile(x, y, newType) {
    if(worldState.setTile(x, y, newType)) {
        
        // Host inicia crescimento SE for 'GRAMA' (do player). 
        // Se for 'GRAMA_SAFE' (da flor), ele ignora.
        if (net.isHost && newType === 'GRAMA') {
            worldState.addGrowingPlant(x, y);
        }

        net.sendPayload({ type: 'TILE_CHANGE', x, y, tileType: newType });
    }
}

function updateUI() {
    const el = document.getElementById('pollen-count');
    if(el) el.innerText = `${localPlayer.pollen} / ${localPlayer.maxPollen}`;
}

function draw() {
    ctx.fillStyle = "#0d0d0d"; 
    ctx.fillRect(0, 0, canvas.width, canvas.height);
    if(!world) return;

    const cX = Math.floor(localPlayer.pos.x / world.chunkSize);
    const cY = Math.floor(localPlayer.pos.y / world.chunkSize);

    for(let x=-1; x<=1; x++) for(let y=-1; y<=1; y++) {
        world.getChunk(cX+x, cY+y).forEach(t => {
            const sX = (t.x - camera.x) * world.tileSize + canvas.width/2;
            const sY = (t.y - camera.y) * world.tileSize + canvas.height/2;

            if(sX > -32 && sX < canvas.width+32 && sY > -32 && sY < canvas.height+32) {
                const finalType = worldState.getModifiedTile(t.x, t.y) || t.type;
                
                let color = '#34495e'; // Preto (Queimado)
                
                // Tanto 'GRAMA' (Semente) quanto 'GRAMA_SAFE' (Estéril) ficam verdes
                if(['GRAMA', 'GRAMA_SAFE', 'BROTO', 'MUDA', 'FLOR', 'FLOR_COOLDOWN'].includes(finalType)) {
                    color = '#2ecc71';
                }
                if(finalType === 'COLMEIA') color = '#f1c40f';
                
                ctx.fillStyle = color;
                ctx.fillRect(sX, sY, world.tileSize, world.tileSize);

                if (finalType === 'BROTO') {
                    ctx.fillStyle = '#006400'; ctx.fillRect(sX + 10, sY + 10, 12, 12);
                }
                else if (finalType === 'MUDA') {
                    ctx.fillStyle = '#228B22'; ctx.fillRect(sX + 6, sY + 6, 20, 20);
                }
                else if ((finalType === 'FLOR' || finalType === 'FLOR_COOLDOWN') && assets.flower.complete) {
                    if (finalType === 'FLOR_COOLDOWN') ctx.globalAlpha = 0.4;
                    ctx.drawImage(assets.flower, sX, sY, world.tileSize, world.tileSize);
                    ctx.globalAlpha = 1.0;
                }
            }
        });
    }

    particles.forEach(p => {
        const sX = (p.x - camera.x) * world.tileSize + canvas.width/2;
        const sY = (p.y - camera.y) * world.tileSize + canvas.height/2;
        ctx.fillStyle = `rgba(241, 196, 15, ${p.life})`;
        ctx.fillRect(sX, sY, p.size, p.size);
    });

    Object.values(remotePlayers).forEach(p => p.draw(ctx, camera, canvas, world.tileSize));
    localPlayer.draw(ctx, camera, canvas, world.tileSize);
}

function resize() { canvas.width = window.innerWidth; canvas.height = window.innerHeight; }
window.onresize = resize;
