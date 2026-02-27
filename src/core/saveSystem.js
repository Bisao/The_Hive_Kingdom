/**
 * saveSystem.js
 * Gerencia a persistência de dados localmente (LocalStorage).
 * Atualizado para suportar o Painel de Gerenciamento de Colmeias e Salvamento Assíncrono (Seguro contra Reloads).
 */
export class SaveSystem {
    constructor() {
        // Prefixos para separar os saves de outros dados do navegador
        this.PREFIX = 'BloomKeepers_World_';
        this.BACKUP_PREFIX = 'BloomKeepers_Backup_';
        this.lastSaveTime = 0;
    }

    /**
     * Gera a chave única de armazenamento baseada no ID do mundo.
     */
    _getKey(worldId) {
        if (!worldId) return null;
        // CORREÇÃO: Converte para String antes do replace para evitar erros silenciosos
        const safeId = String(worldId).replace(/[^a-zA-Z0-9_-]/g, '');
        return `${this.PREFIX}${safeId}`;
    }

    _getBackupKey(worldId) {
        if (!worldId) return null;
        // CORREÇÃO: Converte para String
        const safeId = String(worldId).replace(/[^a-zA-Z0-9_-]/g, '');
        return `${this.BACKUP_PREFIX}${safeId}`;
    }

    /**
     * Salva os dados de um mundo específico de forma ASSÍNCRONA.
     * Isso garante que a UI tenha tempo de atualizar e que a gravação não seja cortada por um reload de página.
     * @param {string} worldId - O ID único da Colmeia (ex: "Jardim1").
     * @param {Object} data - O objeto contendo o estado do jogo.
     */
    async save(worldId, data) {
        if (!worldId) {
            console.error("[SaveSystem] Erro: Tentativa de salvar sem ID de mundo.");
            return false;
        }

        // Este pequeno delay libera a thread do navegador por 50ms.
        // É o suficiente para a interface renderizar a mensagem "Salvando colmeia..."
        // antes que o processamento pesado do JSON.stringify trave a tela.
        await new Promise(resolve => setTimeout(resolve, 50));

        try {
            const key = this._getKey(worldId);
            const backupKey = this._getBackupKey(worldId);

            // Estrutura do Save com Metadados para o Painel Inicial
            const saveObj = {
                timestamp: Date.now(),
                version: '3.0', 
                id: worldId,
                // Metadados extraídos para exibição rápida no menu
                meta: {
                    seed: data.seed || "Desconhecida",
                    pass: data.pass || "", // Senha da colmeia
                    level: (data.host && data.host.level) ? data.host.level : 1,
                    nick: (data.host && data.host.nickname) ? data.host.nickname : "Abelha"
                },
                data: data
            };

            const jsonString = JSON.stringify(saveObj);

            // Sistema de Backup Rotativo
            const currentSave = localStorage.getItem(key);
            if (currentSave) {
                localStorage.setItem(backupKey, currentSave);
            }

            localStorage.setItem(key, jsonString);
            this.lastSaveTime = Date.now();
            console.log(`[SaveSystem] Colmeia '${worldId}' salva com sucesso.`);
            return true;
        } catch (error) {
            console.error(`[SaveSystem] Erro ao salvar colmeia '${worldId}'!`, error);
            return false;
        }
    }

    /**
     * Carrega os dados de um mundo específico.
     */
    load(worldId) {
        if (!worldId) return null;

        const key = this._getKey(worldId);
        const backupKey = this._getBackupKey(worldId);

        let rawData = localStorage.getItem(key);
        if (!rawData) rawData = localStorage.getItem(backupKey);
        if (!rawData) return null;

        try {
            const parsed = JSON.parse(rawData);
            if (!parsed || !parsed.data) throw new Error("Estrutura inválida.");
            return parsed.data;
        } catch (error) {
            console.error(`[SaveSystem] Falha ao carregar '${worldId}'`, error);
            return null;
        }
    }

    /**
     * Verifica se existe um save para este ID.
     */
    hasSave(worldId) {
        const key = this._getKey(worldId);
        return key && localStorage.getItem(key) !== null;
    }

    /**
     * Remove um save específico com confirmação externa.
     */
    deleteSave(worldId) {
        const key = this._getKey(worldId);
        const backupKey = this._getBackupKey(worldId);
        if (key) localStorage.removeItem(key);
        if (backupKey) localStorage.removeItem(backupKey);
        console.log(`[SaveSystem] Colmeia '${worldId}' removida.`);
        return true;
    }

    /**
     * [PROFISSIONAL] Lista todos os mundos salvos.
     * Retorna os metadados (Seed, Senha, Nível) para o Painel.
     */
    listAllSaves() {
        const saves = [];
        for (let i = 0; i < localStorage.length; i++) {
            const key = localStorage.key(i);
            
            // Filtra apenas chaves que são saves de mundo (ignora backups na lista)
            if (key && key.startsWith(this.PREFIX)) {
                try {
                    const raw = localStorage.getItem(key);
                    const parsed = JSON.parse(raw);
                    
                    if (parsed) {
                        saves.push({
                            id: parsed.id || key.replace(this.PREFIX, ''),
                            timestamp: parsed.timestamp || 0,
                            meta: parsed.meta || { seed: "???", pass: "", level: 1, nick: "Abelha" }
                        });
                    }
                } catch (e) {
                    console.warn(`[SaveSystem] Erro ao ler metadados da chave ${key}`);
                }
            }
        }
        // Ordena por data (mais recentes primeiro)
        return saves.sort((a, b) => b.timestamp - a.timestamp);
    }
    
    /**
     * Limpa apenas os saves deste jogo.
     */
    clearAll() {
        const keysToRemove = [];
        for (let i = 0; i < localStorage.length; i++) {
            const key = localStorage.key(i);
            if (key && (key.startsWith(this.PREFIX) || key.startsWith(this.BACKUP_PREFIX))) {
                keysToRemove.push(key);
            }
        }
        keysToRemove.forEach(k => localStorage.removeItem(k));
    }
}
