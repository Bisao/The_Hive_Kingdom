import { WaveEffect } from './WaveEffect.js';

/**
 * Tree.js
 * Gerencia a lógica de cura e evolução da Grande Árvore da Colmeia.
 */
export class Tree {
    constructor(x, y, ownerNick) {
        this.x = x;
        this.y = y;
        this.ownerNick = ownerNick;
        
        // Configurações de Cura da Árvore (Mais potente que as flores)
        this.healRadius = 6.0;   // Alcance maior
        this.healAmount = 15;    // Cura mais HP
        this.healCooldown = 5000; // Pulsa a cada 5 segundos
        this.lastHealTime = Date.now();
        
        // Cores da Árvore (Dourado/Mel)
        this.waveColor = "rgba(241, 196, 15, ALPHA)";
    }

    /**
     * Realiza o pulso de cura da árvore.
     * Deve ser chamado dentro do loop do Host no HostSimulation ou no Game.
     */
    updateAndHeal(game) {
        const now = Date.now();
        if (now - this.lastHealTime < this.healCooldown) return;

        this.lastHealTime = now;

        // 1. Criar efeito visual local para o Host
        game.activeWaves.push(new WaveEffect(
            this.x, 
            this.y, 
            this.healRadius, 
            this.waveColor, 
            this.healAmount
        ));

        // 2. Se for o Host, propaga a cura para a rede
        if (game.net && game.net.isHost) {
            // Avisa a todos para desenharem a onda da árvore
            game.net.sendPayload({
                type: 'WAVE_SPAWN',
                x: this.x,
                y: this.y,
                radius: this.healRadius,
                color: this.waveColor,
                amount: this.healAmount
            });

            // 3. Detectar quem está perto da árvore para curar
            const allPlayers = { [game.localPlayer.id]: game.localPlayer, ...game.remotePlayers };
            const nearbyIds = game.worldState.getPlayersInHealRange(
                this.x, 
                this.y, 
                allPlayers, 
                this.healRadius
            );

            nearbyIds.forEach(id => {
                if (id === game.localPlayer.id) {
                    // Cura o host localmente
                    game.localPlayer.applyHeal(this.healAmount);
                    game.ui.updateHUD(game.localPlayer);
                } else {
                    // Envia comando de cura direta para o player remoto (Guest)
                    game.net.sendPayload({
                        type: 'PARTY_RESCUE', // Reutilizamos a lógica de cura/resgate
                        healOnly: true,
                        amount: this.healAmount
                    }, id);
                }
            });
            
            console.log(`[Tree] Grande Árvore de ${this.ownerNick} emitiu pulso de cura.`);
        }
    }
}
