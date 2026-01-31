// main.js - O Ponto de Entrada Final
import { Game } from './core/Game.js';

window.onload = () => {
    // Inicializa o jogo quando a janela carregar
    const game = new Game();
    console.log("[Main] Jogo inicializado com sucesso.");
};
