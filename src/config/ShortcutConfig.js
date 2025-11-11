// 快捷键配置模型
export default class ShortcutConfig {
    constructor(data = {}) {
        this.version = data.version || '1.0';
        this.description = data.description || '';
        this.shortcuts = data.shortcuts || {};
        this.contexts = data.contexts || {};
    }
    
    // 从JSON加载配置
    static fromJSON(json) {
        try {
            const data = typeof json === 'string' ? JSON.parse(json) : json;
            return new ShortcutConfig(data);
        } catch (error) {
            console.error('Failed to parse shortcut config:', error);
            return new ShortcutConfig();
        }
    }
    
    // 导出为JSON
    toJSON() {
        return {
            version: this.version,
            description: this.description,
            shortcuts: this.shortcuts,
            contexts: this.contexts
        };
    }
    
    // 获取所有快捷键定义
    getAllShortcuts() {
        const result = {};
        for (const category in this.shortcuts) {
            for (const name in this.shortcuts[category]) {
                const shortcut = this.shortcuts[category][name];
                result[`${category}.${name}`] = shortcut;
            }
        }
        return result;
    }
    
    // 根据命令获取快捷键
    getShortcutByCommand(command) {
        for (const category in this.shortcuts) {
            for (const name in this.shortcuts[category]) {
                const shortcut = this.shortcuts[category][name];
                if (shortcut.command === command) {
                    return {
                        category,
                        name,
                        ...shortcut
                    };
                }
            }
        }
        return null;
    }
    
    // 根据键获取命令
    getCommandByKey(keyCombo, context = 'global') {
        const contextShortcuts = this.contexts[context]?.shortcuts || [];
        const allShortcuts = this.getAllShortcuts();
        
        // 先检查上下文中的快捷键
        for (const shortcutPath of contextShortcuts) {
            const shortcut = allShortcuts[shortcutPath];
            if (shortcut && shortcut.keys && shortcut.keys.includes(keyCombo)) {
                return shortcut.command;
            }
        }
        
        // 如果上下文没有匹配，检查全局快捷键
        if (context !== 'global') {
            const globalShortcuts = this.contexts.global?.shortcuts || [];
            for (const shortcutPath of globalShortcuts) {
                const shortcut = allShortcuts[shortcutPath];
                if (shortcut && shortcut.keys && shortcut.keys.includes(keyCombo)) {
                    return shortcut.command;
                }
            }
        }
        
        return null;
    }
    
    // 添加或更新快捷键
    setShortcut(category, name, shortcut) {
        if (!this.shortcuts[category]) {
            this.shortcuts[category] = {};
        }
        this.shortcuts[category][name] = shortcut;
    }
    
    // 移除快捷键
    removeShortcut(category, name) {
        if (this.shortcuts[category]) {
            delete this.shortcuts[category][name];
        }
    }
    
    // 验证配置
    validate() {
        const errors = [];
        
        for (const category in this.shortcuts) {
            for (const name in this.shortcuts[category]) {
                const shortcut = this.shortcuts[category][name];
                if (!shortcut.keys || !Array.isArray(shortcut.keys) || shortcut.keys.length === 0) {
                    errors.push(`Shortcut ${category}.${name} has no keys`);
                }
                if (!shortcut.command) {
                    errors.push(`Shortcut ${category}.${name} has no command`);
                }
            }
        }
        
        return {
            valid: errors.length === 0,
            errors
        };
    }
}

