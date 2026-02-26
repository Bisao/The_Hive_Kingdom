/**
 * main.js
 * Ponto de entrada da aplicação.
 * Inicializa a instância principal do Jogo.
 */
import { Game } from './core/Game.js';

window.addEventListener('load', () => {
    console.log("[Main] Iniciando Wings That Heal...");

    // Verifica se o canvas existe antes de iniciar para evitar erros
    const canvas = document.getElementById('gameCanvas');
    if (!canvas) {
        console.error("[Main] Erro Crítico: Elemento 'gameCanvas' não encontrado no DOM.");
        return;
    }

    try {
        // Inicializa o jogo
        const game = new Game();

        // Expõe a instância globalmente para facilitar depuração no console (ex: digitar 'game.localPlayer')
        window.game = game;
        
        console.log("[Main] Jogo inicializado com sucesso.");
    } catch (error) {
        console.error("[Main] Falha fatal ao inicializar o jogo:", error);
    }
});