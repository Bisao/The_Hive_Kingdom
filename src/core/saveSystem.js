export class SaveSystem {
    constructor() {
        this.DB_KEY = 'WingsThatHeal_Save_v1';
        this.BACKUP_KEY = 'WingsThatHeal_Backup_v1';
    }

    /**
     * Salva os dados do jogo.
     * @param {Object} data - Objeto contendo { seed, world, host, guests }
     */
    save(data) {
        try {
            const jsonString = JSON.stringify({
                timestamp: Date.now(),
                version: '1.0',
                data: data
            });

            // 1. Tenta criar um backup do save atual antes de sobrescrever
            const currentSave = localStorage.getItem(this.DB_KEY);
            if (currentSave) {
                localStorage.setItem(this.BACKUP_KEY, currentSave);
            }

            // 2. Salva o novo estado
            localStorage.setItem(this.DB_KEY, jsonString);
            
            // Feedback no console apenas (para não poluir a UI)
            // console.log(`[SaveSystem] Jogo salvo. (${new Date().toLocaleTimeString()})`);
            return true;
        } catch (error) {
            console.error("[SaveSystem] Falha crítica ao salvar!", error);
            return false;
        }
    }

    /**
     * Carrega o jogo. Tenta o principal, se falhar, tenta o backup.
     */
    load() {
        let rawData = localStorage.getItem(this.DB_KEY);
        
        if (!rawData) {
            // Se não tem save principal, tenta o backup
            rawData = localStorage.getItem(this.BACKUP_KEY);
            if (rawData) console.log("[SaveSystem] Restaurando do Backup...");
        }

        if (!rawData) return null;

        try {
            const parsed = JSON.parse(rawData);
            return parsed.data;
        } catch (error) {
            console.error("[SaveSystem] Save corrompido! Tentando backup...", error);
            
            // Tentativa final com backup
            const backupData = localStorage.getItem(this.BACKUP_KEY);
            if (backupData) {
                try {
                    return JSON.parse(backupData).data;
                } catch (e) {
                    console.error("[SaveSystem] Backup também corrompido.");
                }
            }
            return null;
        }
    }

    clear() {
        localStorage.removeItem(this.DB_KEY);
        localStorage.removeItem(this.BACKUP_KEY);
        console.log("[SaveSystem] Dados limpos.");
    }
}
