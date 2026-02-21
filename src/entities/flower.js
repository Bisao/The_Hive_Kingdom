/**
 * Flower.js
 * Representa as flores no mundo que coletam pólen e emitem pulsos de cura.
 */
export class Flower {
    constructor(x, y, ownerId = null) {
        this.x = x;
        this.y = y;
        this.ownerId = ownerId; // Quem plantou/curou a flor
        this.pollen = 100;
        
        // Configurações de Cura
        this.healRadius = 3.0; // Raio de alcance da cura
        this.healAmount = 10;  // Quanto de HP recupera
        this.healCooldown = 3000; // Intervalo entre pulsos (3 segundos)
        this.lastHealTime = Date.now();
    }

    /**
     * Tenta realizar um pulso de cura global.
     * Esta lógica deve ser validada pelo Host no HostSimulation.
     * @param {Object} game - Referência ao objeto principal do jogo
     */
    emitHealWave(game) {
        const now = Date.now();
        if (now - this.lastHealTime < this.healCooldown) return;

        this.lastHealTime = now;

        // 1. Gera o efeito visual localmente (onda verde)
        const color = "rgba(46, 204, 113, ALPHA)";
        game.activeWaves.push(new WaveEffect(this.x, this.y, this.healRadius, color, this.healAmount));

        // 2. Notifica a rede para que todos os outros jogadores vejam a onda e se curem
        if (game.net && game.net.isHost) {
            game.net.sendPayload({
                type: 'WAVE_SPAWN',
                x: this.x,
                y: this.y,
                radius: this.healRadius,
                color: color,
                amount: this.healAmount,
                isHeal: true // Flag para identificar que é uma onda de cura
            });

            // 3. Aplica cura nos jogadores próximos (Lógica de Servidor)
            const nearbyPlayerIds = game.worldState.getPlayersInHealRange(
                this.x, 
                this.y, 
                { [game.localPlayer.id]: game.localPlayer, ...game.remotePlayers }, 
                this.healRadius
            );

            nearbyPlayerIds.forEach(id => {
                if (id === game.localPlayer.id) {
                    game.localPlayer.applyHeal(this.healAmount);
                    game.ui.updateHUD(game.localPlayer);
                } else {
                    // Envia comando de cura direta para o jogador remoto
                    game.net.sendPayload({
                        type: 'PLAYER_HEAL',
                        amount: this.healAmount
                    }, id);
                }
            });
        }
    }

    /**
     * Coleta pólen da flor
     * @returns {number} Quantidade coletada
     */
    collectPollen(amount) {
        const actual = Math.min(this.pollen, amount);
        this.pollen -= actual;
        return actual;
    }
}
