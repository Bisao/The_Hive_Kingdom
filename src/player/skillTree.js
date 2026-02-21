export class SkillTree {
    constructor(player) {
        this.player = player;
        this.isOpen = false;

        // Definição das Habilidades
        // [ATUALIZADO] As coordenadas (x, y) agora são porcentagens (0 a 100) para garantir
        // que a árvore sempre caiba dentro do modal, independente do tamanho da tela.
        this.skills = {
            // RAMO A: EXPLORAÇÃO (Verde)
            'speed_1': {
                id: 'speed_1',
                name: "Voo Leve",
                desc: "+10% Velocidade",
                cost: 1,
                unlocked: false,
                color: '#2ecc71',
                x: 20, y: 80, // % de posicionamento
                parent: null,
                effect: (p) => p.speed *= 1.10
            },
            'range_1': {
                id: 'range_1',
                name: "Pólen Magnético",
                desc: "Coleta mais longe",
                cost: 1,
                unlocked: false,
                color: '#2ecc71',
                x: 20, y: 50,
                parent: 'speed_1',
                effect: (p) => p.collectionRange = (p.collectionRange || 1.5) + 0.5
            },
            'lava_resist': {
                id: 'lava_resist',
                name: "Casca Térmica",
                desc: "-50% Dano Lava",
                cost: 2,
                unlocked: false,
                color: '#e67e22',
                x: 20, y: 20,
                parent: 'range_1',
                effect: (p) => p.lavaResistance = true
            },

            // RAMO B: SOBREVIVÊNCIA (Amarelo)
            'hp_1': {
                id: 'hp_1',
                name: "Geléia Real",
                desc: "+20 Vida",
                cost: 1,
                unlocked: false,
                color: '#f1c40f',
                x: 50, y: 80,
                parent: null,
                effect: (p) => { p.maxHp += 20; p.hp += 20; }
            },
            'regen_1': {
                id: 'regen_1',
                name: "Simbiose",
                desc: "Regen na Flor",
                cost: 2,
                unlocked: false,
                color: '#f1c40f',
                x: 50, y: 50,
                parent: 'hp_1',
                effect: (p) => p.passiveRegen = true
            },

            // RAMO C: CARGA (Azul)
            'cargo_1': {
                id: 'cargo_1',
                name: "Bolsas Extras",
                desc: "+15 Capacidade",
                cost: 1,
                unlocked: false,
                color: '#3498db',
                x: 80, y: 80,
                parent: null,
                effect: (p) => p.maxPollen += 15
            }
        };

        this.createUI();
    }

    createUI() {
        const oldModal = document.getElementById('skill-tree-modal');
        if (oldModal) oldModal.remove();

        const div = document.createElement('div');
        div.id = 'skill-tree-modal';
        // [ATUALIZADO] CSS Responsivo: max-width em vez de width fixo, flexbox para conteúdo interno
        div.style.cssText = `
            display: none; 
            position: fixed; 
            top: 50%; 
            left: 50%; 
            transform: translate(-50%, -50%); 
            width: 90%; 
            max-width: 600px; 
            height: 80vh; 
            max-height: 500px; 
            background: rgba(20, 20, 20, 0.95); 
            border: 4px solid #f1c40f; 
            border-radius: 15px; 
            z-index: 10000; 
            box-shadow: 0 0 30px rgba(0,0,0,0.8); 
            font-family: 'Nunito', sans-serif; 
            color: white;
            display: flex;
            flex-direction: column;
        `;
        // Esconde inicialmente (o flex sobrescreve o display:none do cssText)
        div.style.display = 'none';
        
        div.innerHTML = `
            <div style="padding:15px; text-align:center; border-bottom:1px solid #444; position: relative;">
                <h2 style="margin:0; font-size:18px; color:#f1c40f; text-shadow:0 0 10px orange;">ÁRVORE DE EVOLUÇÃO</h2>
                <div id="sp-display" style="font-size:12px; color:#aaa; margin-top:5px;">
                    Pontos Disponíveis: <span id="sp-count" style="color:white; font-weight:bold; font-size:16px;">0</span>
                </div>
                <button id="btn-close-skills" style="position:absolute; top:10px; right:15px; background:var(--danger, #e74c3c); border:none; color:white; width:30px; height:30px; border-radius:50%; cursor:pointer; font-weight:bold; font-size: 16px;">X</button>
            </div>
            
            <div id="skill-canvas-container" style="position:relative; flex-grow: 1; width:100%; background:radial-gradient(circle, #2c3e50 0%, #000 100%); overflow:hidden; border-bottom-left-radius: 10px; border-bottom-right-radius: 10px;">
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
        
        if (!container || !svg) {
            this.createUI();
            container = document.getElementById('skill-canvas-container');
            svg = document.getElementById('skill-lines');
            if (!container || !svg) return; 
        }
        
        // Limpa filhos exceto SVG e Tooltip
        Array.from(container.children).forEach(c => { 
            if (c.id !== 'skill-lines' && c.id !== 'skill-tooltip') c.remove(); 
        });
        svg.innerHTML = ''; 

        // Garante que a tooltip exista
        let tooltip = document.getElementById('skill-tooltip');
        if (!tooltip) {
            tooltip = document.createElement('div');
            tooltip.id = 'skill-tooltip';
            tooltip.style.cssText = "position:absolute; display:none; background:rgba(0,0,0,0.9); border:2px solid #f1c40f; padding:10px; border-radius:8px; z-index:10001; pointer-events:none; text-align:center; min-width: 120px; transform: translate(-50%, -110%);";
            container.appendChild(tooltip);
        }

        // Pega as dimensões atuais do container responsivo para converter % em pixels reais
        const cWidth = container.clientWidth;
        const cHeight = container.clientHeight;

        Object.values(this.skills).forEach(skill => {
            // Conversão de porcentagem para pixels relativos ao container
            const pxX = (skill.x / 100) * cWidth;
            const pxY = (skill.y / 100) * cHeight;

            // 1. Desenhar Linha
            if (skill.parent) {
                const parent = this.skills[skill.parent];
                const pX = (parent.x / 100) * cWidth;
                const pY = (parent.y / 100) * cHeight;
                
                const line = document.createElementNS('http://www.w3.org/2000/svg', 'line');
                // Adiciona metade do tamanho do botão (25px) para centralizar a linha
                line.setAttribute('x1', pX); 
                line.setAttribute('y1', pY);
                line.setAttribute('x2', pxX);
                line.setAttribute('y2', pxY);
                line.setAttribute('stroke', parent.unlocked ? '#f1c40f' : '#555');
                line.setAttribute('stroke-width', '4');
                svg.appendChild(line);
            }

            // 2. Criar Botão
            const btn = document.createElement('div');
            btn.className = 'skill-node';
            
            const canBuy = !skill.unlocked && this.player.skillPoints >= skill.cost && (!skill.parent || this.skills[skill.parent].unlocked);
            const isAnimating = canBuy ? 'animation: pulse 1s infinite;' : '';
            const bColor = skill.unlocked ? '#fff' : (canBuy ? '#f1c40f' : '#555');

            // Usar transform translate(-50%, -50%) garante que o botão fique perfeitamente centralizado na cordenada %
            btn.style.cssText = `
                position: absolute; 
                left: ${skill.x}%; 
                top: ${skill.y}%; 
                transform: translate(-50%, -50%);
                width: 50px; 
                height: 50px; 
                background: ${skill.unlocked ? skill.color : '#333'}; 
                border: 3px solid ${bColor}; 
                border-radius: 50%; 
                cursor: pointer;
                display: flex; justify-content: center; align-items: center;
                box-shadow: 0 0 10px black;
                transition: transform 0.1s;
                z-index: 2;
                ${isAnimating}
            `;
            
            btn.innerHTML = `<span style="font-weight:bold; font-size:20px; color:${skill.unlocked ? 'white' : '#777'}">${skill.name[0]}</span>`;
            
            // Lógica de Tooltip dinâmica (Melhor pro Mobile do que a tag 'title')
            btn.addEventListener('touchstart', (e) => this.showTooltip(skill, pxX, pxY, tooltip), {passive: true});
            btn.addEventListener('mouseenter', () => this.showTooltip(skill, pxX, pxY, tooltip));
            
            btn.addEventListener('touchend', () => tooltip.style.display = 'none');
            btn.addEventListener('mouseleave', () => tooltip.style.display = 'none');

            btn.onclick = () => {
                tooltip.style.display = 'none'; // Esconde ao clicar
                this.tryBuySkill(skill);
            };

            container.appendChild(btn);
        });

        const spCount = document.getElementById('sp-count');
        if (spCount) spCount.innerText = this.player.skillPoints;
    }

    showTooltip(skill, pxX, pxY, tooltip) {
        tooltip.innerHTML = `
            <b style="color:${skill.color}; font-size:14px;">${skill.name}</b><br>
            <span style="font-size:11px; color:#ccc;">${skill.desc}</span><br>
            <b style="font-size:12px; color:#f1c40f; margin-top:5px; display:block;">Custo: ${skill.cost} SP</b>
        `;
        // Posiciona o tooltip acima do botão
        tooltip.style.left = `${pxX}px`;
        tooltip.style.top = `${pxY - 15}px`; 
        tooltip.style.display = 'block';
    }

    tryBuySkill(skill) {
        if (skill.unlocked) return; 

        if (skill.parent && !this.skills[skill.parent].unlocked) {
            // Usa o Toast/Alert do UIManager para uma experiência melhor que o alert() padrão do navegador
            const toast = document.getElementById('toast-msg');
            if (toast) {
                toast.innerText = "Desbloqueie a habilidade anterior!";
                toast.style.background = "#e74c3c";
                toast.style.opacity = "1";
                toast.style.transform = "translateX(-50%) translateY(0)";
                setTimeout(() => toast.style.opacity = "0", 2000);
            }
            return;
        }

        if (this.player.skillPoints >= skill.cost) {
            this.player.skillPoints -= skill.cost;
            skill.unlocked = true;
            
            skill.effect(this.player);
            this.renderTree(); 
            
            // Verifica se não estamos no host
            if (window.gameInstance && window.gameInstance.net.isHost) {
                window.gameInstance.saveProgress(true);
            }
        } else {
             const toast = document.getElementById('toast-msg');
             if (toast) {
                 toast.innerText = "Pontos insuficientes!";
                 toast.style.background = "#e74c3c";
                 toast.style.opacity = "1";
                 toast.style.transform = "translateX(-50%) translateY(0)";
                 setTimeout(() => toast.style.opacity = "0", 2000);
             }
        }
    }

    toggle() {
        this.isOpen = !this.isOpen;
        const modal = document.getElementById('skill-tree-modal');
        
        if (this.isOpen) {
            if (modal) {
                modal.style.display = 'flex'; // Importante para manter a responsividade do flexbox
                // Usar requestAnimationFrame garante que o CSS renderize o container antes de calcular o SVG
                requestAnimationFrame(() => this.renderTree());
            }
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

// Injeta animação CSS
if (!document.getElementById('skill-anim-style')) {
    const style = document.createElement('style');
    style.id = 'skill-anim-style';
    style.innerHTML = `@keyframes pulse { 0% { transform: translate(-50%, -50%) scale(1); box-shadow: 0 0 0 0 rgba(241, 196, 15, 0.7); } 70% { transform: translate(-50%, -50%) scale(1.1); box-shadow: 0 0 0 10px rgba(241, 196, 15, 0); } 100% { transform: translate(-50%, -50%) scale(1); box-shadow: 0 0 0 0 rgba(241, 196, 15, 0); } }`;
    document.head.appendChild(style);
}
