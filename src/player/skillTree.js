export class SkillTree {
    constructor(player) {
        this.player = player;
        this.isOpen = false;

        // Definição das Habilidades
        this.skills = {
            // RAMO A: EXPLORAÇÃO (Verde)
            'speed_1': {
                id: 'speed_1',
                name: "Voo Leve",
                desc: "+10% Velocidade de Movimento",
                cost: 1,
                unlocked: false,
                color: '#2ecc71',
                x: 100, y: 300, 
                parent: null,
                effect: (p) => p.speed *= 1.10
            },
            'range_1': {
                id: 'range_1',
                name: "Pólen Magnético",
                desc: "Coleta pólen de mais longe",
                cost: 1,
                unlocked: false,
                color: '#2ecc71',
                x: 100, y: 200,
                parent: 'speed_1',
                effect: (p) => p.collectionRange = (p.collectionRange || 1.5) + 0.5
            },
            'lava_resist': {
                id: 'lava_resist',
                name: "Casca Térmica",
                desc: "Resistência ao calor (Dano de Lava -50%)",
                cost: 2,
                unlocked: false,
                color: '#e67e22',
                x: 100, y: 100,
                parent: 'range_1',
                effect: (p) => p.lavaResistance = true
            },

            // RAMO B: SOBREVIVÊNCIA (Amarelo)
            'hp_1': {
                id: 'hp_1',
                name: "Geléia Real",
                desc: "+20 Vida Máxima",
                cost: 1,
                unlocked: false,
                color: '#f1c40f',
                x: 300, y: 300,
                parent: null,
                effect: (p) => { p.maxHp += 20; p.hp += 20; }
            },
            'regen_1': {
                id: 'regen_1',
                name: "Simbiose",
                desc: "Recupera vida perto de FLORES",
                cost: 2,
                unlocked: false,
                color: '#f1c40f',
                x: 300, y: 200,
                parent: 'hp_1',
                effect: (p) => p.passiveRegen = true
            },

            // RAMO C: CARGA (Azul)
            'cargo_1': {
                id: 'cargo_1',
                name: "Bolsas Extras",
                desc: "+15 Capacidade de Pólen",
                cost: 1,
                unlocked: false,
                color: '#3498db',
                x: 500, y: 300,
                parent: null,
                effect: (p) => p.maxPollen += 15
            }
        };

        // Garante que a UI exista desde o início
        this.createUI();
    }

    createUI() {
        // Remove modal antigo se existir para evitar duplicatas
        const oldModal = document.getElementById('skill-tree-modal');
        if (oldModal) oldModal.remove();

        const div = document.createElement('div');
        div.id = 'skill-tree-modal';
        div.style.cssText = "display:none; position:fixed; top:50%; left:50%; transform:translate(-50%, -50%); width:700px; height:500px; background:rgba(20, 20, 20, 0.95); border:4px solid #f1c40f; border-radius:15px; z-index:10000; box-shadow:0 0 30px rgba(0,0,0,0.8); font-family:'Segoe UI', sans-serif; color:white;";
        
        div.innerHTML = `
            <div style="padding:20px; text-align:center; border-bottom:1px solid #444;">
                <h2 style="margin:0; color:#f1c40f; text-shadow:0 0 10px orange;">ÁRVORE DE EVOLUÇÃO</h2>
                <div id="sp-display" style="font-size:14px; color:#aaa; margin-top:5px;">Pontos Disponíveis: <span id="sp-count" style="color:white; font-weight:bold; font-size:18px;">0</span></div>
                <button id="btn-close-skills" style="position:absolute; top:15px; right:15px; background:red; border:none; color:white; width:30px; height:30px; border-radius:50%; cursor:pointer; font-weight:bold;">X</button>
            </div>
            <div id="skill-canvas-container" style="position:relative; width:100%; height:400px; background:radial-gradient(circle, #2c3e50 0%, #000 100%); overflow:hidden;">
                <svg id="skill-lines" style="position:absolute; top:0; left:0; width:100%; height:100%; pointer-events:none;"></svg>
            </div>
        `;
        document.body.appendChild(div);

        const closeBtn = document.getElementById('btn-close-skills');
        if (closeBtn) closeBtn.onclick = () => this.toggle();
    }

    renderTree() {
        let container = document.getElementById('skill-canvas-container');
        let svg = document.getElementById('skill-lines');
        
        // Recuperação de falha: Se a UI sumiu, recria
        if (!container || !svg) {
            console.warn("[SkillTree] Interface perdida. Tentando recuperar...");
            this.createUI();
            container = document.getElementById('skill-canvas-container');
            svg = document.getElementById('skill-lines');
            if (!container || !svg) return; // Aborta se falhar novamente
        }
        
        // [CORREÇÃO] Limpa apenas os botões (divs), preservando o SVG pelo ID
        Array.from(container.children).forEach(c => { 
            if (c.id !== 'skill-lines') c.remove(); 
        });

        // Limpa as linhas antigas dentro do SVG
        svg.innerHTML = ''; 

        Object.values(this.skills).forEach(skill => {
            // 1. Desenhar Linha para o Pai (se tiver)
            if (skill.parent) {
                const parent = this.skills[skill.parent];
                const line = document.createElementNS('http://www.w3.org/2000/svg', 'line');
                line.setAttribute('x1', parent.x + 25); 
                line.setAttribute('y1', parent.y + 25);
                line.setAttribute('x2', skill.x + 25);
                line.setAttribute('y2', skill.y + 25);
                line.setAttribute('stroke', parent.unlocked ? '#f1c40f' : '#555');
                line.setAttribute('stroke-width', '4');
                svg.appendChild(line);
            }

            // 2. Criar o Ícone da Skill
            const btn = document.createElement('div');
            btn.className = 'skill-node';
            btn.style.cssText = `
                position: absolute; 
                left: ${skill.x}px; 
                top: ${skill.y}px; 
                width: 50px; 
                height: 50px; 
                background: ${skill.unlocked ? skill.color : '#333'}; 
                border: 3px solid ${skill.unlocked ? '#fff' : '#555'}; 
                border-radius: 50%; 
                cursor: pointer;
                display: flex; justify-content: center; align-items: center;
                box-shadow: 0 0 10px black;
                transition: transform 0.1s;
                z-index: 2;
            `;
            
            btn.innerHTML = `<span style="font-weight:bold; font-size:20px; color:${skill.unlocked ? 'white' : '#777'}">${skill.name[0]}</span>`;
            btn.title = `${skill.name}\n${skill.desc}\nCusto: ${skill.cost} SP`;
            btn.onclick = () => this.tryBuySkill(skill);

            // Efeito visual se puder comprar
            const canBuy = !skill.unlocked && this.player.skillPoints >= skill.cost && (!skill.parent || this.skills[skill.parent].unlocked);
            if (canBuy) {
                btn.style.borderColor = '#f1c40f';
                btn.style.animation = 'pulse 1s infinite';
            }

            container.appendChild(btn);
        });

        const spCount = document.getElementById('sp-count');
        if (spCount) spCount.innerText = this.player.skillPoints;
    }

    tryBuySkill(skill) {
        if (skill.unlocked) return; 

        if (skill.parent && !this.skills[skill.parent].unlocked) {
            alert("Desbloqueie a habilidade anterior primeiro!");
            return;
        }

        if (this.player.skillPoints >= skill.cost) {
            this.player.skillPoints -= skill.cost;
            skill.unlocked = true;
            
            skill.effect(this.player);

            this.renderTree(); 
            
            if (window.saveProgress) window.saveProgress(true);
        } else {
            alert("Pontos de Habilidade insuficientes!");
        }
    }

    toggle() {
        this.isOpen = !this.isOpen;
        const modal = document.getElementById('skill-tree-modal');
        
        if (this.isOpen) {
            this.renderTree(); 
            if (modal) modal.style.display = 'block';
        } else {
            if (modal) modal.style.display = 'none';
        }
    }

    serialize() {
        const unlockedIds = [];
        for (let key in this.skills) {
            if (this.skills[key].unlocked) unlockedIds.push(key);
        }
        return unlockedIds;
    }

    deserialize(unlockedIds) {
        if (!unlockedIds) return;
        unlockedIds.forEach(id => {
            if (this.skills[id]) {
                this.skills[id].unlocked = true;
                this.skills[id].effect(this.player); 
            }
        });
    }
}

// Injeta animação CSS (segurança caso o CSS não carregue)
if (!document.getElementById('skill-anim-style')) {
    const style = document.createElement('style');
    style.id = 'skill-anim-style';
    style.innerHTML = `@keyframes pulse { 0% { transform: scale(1); box-shadow: 0 0 0 0 rgba(241, 196, 15, 0.7); } 70% { transform: scale(1.1); box-shadow: 0 0 0 10px rgba(241, 196, 15, 0); } 100% { transform: scale(1); box-shadow: 0 0 0 0 rgba(241, 196, 15, 0); } }`;
    document.head.appendChild(style);
}
