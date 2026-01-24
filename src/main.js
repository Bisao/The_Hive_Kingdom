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
let camera = { x: 0, y: 0 };

// --- CONFIGURAÇÕES DE TEMPO E CHANCE ---
const PLANT_SPAWN_CHANCE = 0.15; // 15% de chance ao curar
const FLOWER_COOLDOWN_TIME = 10000; // 10s para recuperar pólen
const GROWTH_TIMES = {
    BROTO: 30000,    // 30 segundos
    MUDA: 120000,    // 2 minutos
    FLOR: 300000     // 5 minutos
};

// Assets
const assets = { flower: new Image() };
assets.flower.src = 'assets/Flower.png';

// --- UI SETUP ---
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
            if(net.isHost) startHostSimulation(); // Inicia a IA do mundo
        }
    });
};

document.getElementById('btn-join').onclick = () => {
    const nick = document.getElementById('nickname').value || "Guest";
    const id = document.getElementById('join-id').value;
    const pass = document.getElementById('join-pass').value;
    net.init(null, (ok) => { if(ok) net.joinRoom(id, pass, nick); });
};

window.addEventListener('joined', e => {
    const data = e.detail;
    if (data.worldState) worldState.applyFullState(data.worldState);
    startGame(data.seed, net.peer.id, document.getElementById('nickname').value);
});

window.addEventListener('netData', e => {
    const d = e.detail;
    
    // Sincroniza players
    if(d.type === 'MOVE') {
        if(!remotePlayers[d.id]) remotePlayers[d.id] = new Player(d.id, d.nick);
        remotePlayers[d.id].targetPos = { x: d.x, y: d.y };
        remotePlayers[d.id].currentDir = d.dir;
    }
    
    // Sincroniza mapa
    if(d.type === 'TILE_CHANGE') {
        worldState.setTile(d.x, d.y, d.tileType);

        // LÓGICA DO HOST: Reação a eventos
        if (net.isHost) {
            // Se alguém curou grama, chance de nascer planta
            if (d.tileType === 'GRAMA') {
                if (Math.random() < PLANT_SPAWN_CHANCE) {
                    worldState.addGrowingPlant(d.x, d.y); // Começa timer
                    console.log(`Semente plantada em ${d.x},${d.y}`);
                }
            }
            // Se flor entrou em cooldown, agendar volta
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

// --- LOOP DE SIMULAÇÃO DO HOST (1 Segundo Tick) ---
function startHostSimulation() {
    setInterval(() => {
        const now = Date.now();

        // 1. Processar Crescimento
        for (const [key, startTime] of Object.entries(worldState.growingPlants)) {
            const [x, y] = key.split(',').map(Number);
            const elapsed = now - startTime;
            const currentType = worldState.getModifiedTile(x, y);

            // Evolução: Grama -> Broto
            if (currentType === 'GRAMA' && elapsed > GROWTH_TIMES.BROTO) {
                changeTile(x, y, 'BROTO');
            }
            // Evolução: Broto -> Muda
            else if (currentType === 'BROTO' && elapsed > GROWTH_TIMES.MUDA) {
                changeTile(x, y, 'MUDA');
            }
            // Evolução: Muda -> Flor Adulta
            else if (currentType === 'MUDA' && elapsed > GROWTH_TIMES.FLOR) {
                changeTile(x, y, 'FLOR');
                worldState.removeGrowingPlant(x, y); // Para de crescer
            }
        }

        // 2. Processar Cura Passiva das Flores Adultas
        // Percorre todos os tiles modificados para achar flores
        for (const [key, type] of Object.entries(worldState.modifiedTiles)) {
            if (type === 'FLOR') {
                // Tenta curar um tile aleatório em 3x3
                if (Math.random() < 0.3) { // 30% de chance por segundo
                    const [fx, fy] = key.split(',').map(Number);
                    const dx = Math.floor(Math.random() * 3) - 1; // -1, 0, 1
                    const dy = Math.floor(Math.random() * 3) - 1;
                    
                    const targetX = fx + dx;
                    const targetY = fy + dy;
                    
                    // Verifica o que tem no alvo
                    const targetType = worldState.getModifiedTile(targetX, targetY) || world.getTileAt(targetX, targetY);
                    
                    if (targetType === 'TERRA_QUEIMADA') {
                        changeTile(targetX, targetY, 'GRAMA');
                        // Nota: Ao curar passivamente, também dispara a chance de nascer nova planta
                        // pois envia TILE_CHANGE 'GRAMA' que o Host escuta no listener acima.
                    }
                }
            }
        }

    }, 1000);
}

// --- GAME LOOP VISUAL ---
function loop() {
    update();
    draw();
    requestAnimationFrame(loop);
}

function update() {
    if(!localPlayer) return;

    const m = input.getMovement();
    localPlayer.update(m);

    if(m.x !== 0 || m.y !== 0) {
        localPlayer.pos.x += m.x * localPlayer.speed;
        localPlayer.pos.y += m.y * localPlayer.speed;
        net.sendPayload({ 
            type: 'MOVE', id: localPlayer.id, nick: localPlayer.nickname, 
            x: localPlayer.pos.x, y: localPlayer.pos.y, dir: localPlayer.currentDir
        });
    }

    const gridX = Math.round(localPlayer.pos.x);
    const gridY = Math.round(localPlayer.pos.y);
    const currentTile = worldState.getModifiedTile(gridX, gridY) || world.getTileAt(gridX, gridY);

    // 1. Coleta Gradual
    if (currentTile === 'FLOR' && localPlayer.pollen < localPlayer.maxPollen) {
        // Coleta 1 de pólen a cada 10 frames (aprox) para ser gradual
        if (Date.now() % 10 === 0) {
            localPlayer.pollen++;
            updateUI();
            
            // Se encheu o tanque, a flor entra em cooldown
            if (localPlayer.pollen >= localPlayer.maxPollen) {
                changeTile(gridX, gridY, 'FLOR_COOLDOWN');
            }
        }
    }

    // 2. Cura Manual (Gasta pólen)
    if (currentTile === 'TERRA_QUEIMADA' && localPlayer.pollen > 0) {
        localPlayer.pollen--;
        updateUI();
        changeTile(gridX, gridY, 'GRAMA');
        // O Host detectará esse 'GRAMA' e rolará o dado para ver se nasce uma semente
    }

    camera.x = localPlayer.pos.x;
    camera.y = localPlayer.pos.y;
    Object.values(remotePlayers).forEach(p => p.update({x:0, y:0}));
}

function changeTile(x, y, newType) {
    if(worldState.setTile(x, y, newType)) {
        net.sendPayload({ type: 'TILE_CHANGE', x, y, tileType: newType });
    }
}

function updateUI() {
    document.getElementById('pollen-count').innerText = `${localPlayer.pollen} / ${localPlayer.maxPollen}`;
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
                
                // --- CAMADA 1: CHÃO ---
                let color = '#34495e'; // Terra Queimada
                if(['GRAMA', 'BROTO', 'MUDA', 'FLOR', 'FLOR_COOLDOWN'].includes(finalType)) color = '#2ecc71';
                if(finalType === 'COLMEIA') color = '#f1c40f';
                
                ctx.fillStyle = color;
                ctx.fillRect(sX, sY, world.tileSize, world.tileSize);

                // --- CAMADA 2: OBJETOS ---
                
                // BROTO (30s): Quadradinho verde escuro pequeno
                if (finalType === 'BROTO') {
                    ctx.fillStyle = '#006400';
                    ctx.fillRect(sX + 10, sY + 10, 12, 12);
                }

                // MUDA (2m): Quadrado verde médio
                else if (finalType === 'MUDA') {
                    ctx.fillStyle = '#228B22';
                    ctx.fillRect(sX + 6, sY + 6, 20, 20);
                }

                // FLOR (5m): Sprite
                else if ((finalType === 'FLOR' || finalType === 'FLOR_COOLDOWN') && assets.flower.complete) {
                    if (finalType === 'FLOR_COOLDOWN') ctx.globalAlpha = 0.4;
                    ctx.drawImage(assets.flower, sX, sY, world.tileSize, world.tileSize);
                    ctx.globalAlpha = 1.0;
                }
            }
        });
    }

    Object.values(remotePlayers).forEach(p => p.draw(ctx, camera, canvas, world.tileSize));
    localPlayer.draw(ctx, camera, canvas, world.tileSize);
}

function resize() { canvas.width = window.innerWidth; canvas.height = window.innerHeight; }
window.onresize = resize;
