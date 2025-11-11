// 快捷键管理器 - 加载、解析、应用快捷键配置
import ShortcutConfig from '../config/ShortcutConfig.js';
import CommandService from './CommandService.js';

export default class ShortcutManager {
    constructor(commandService) {
        this.commandService = commandService;
        this.config = null;
        this.defaultConfig = null;
        this.customConfig = null;
        this.currentContext = 'global';
        this.keyBindings = new Map(); // keyCombo -> commandId
        this.contextShortcuts = new Map(); // context -> Set<keyCombo>
        
        // 加载默认配置
        this.loadDefaultConfig();
    }
    
    // 加载默认配置
    async loadDefaultConfig() {
        try {
            // 尝试从多个路径加载
            const paths = [
                './config/shortcuts.default.json',
                '/config/shortcuts.default.json',
                '../config/shortcuts.default.json',
                './public/config/shortcuts.default.json',
                '/public/config/shortcuts.default.json'
            ];
            
            let loaded = false;
            for (const path of paths) {
                try {
                    const response = await fetch(path);
                    if (response.ok) {
                        const json = await response.json();
                        this.defaultConfig = ShortcutConfig.fromJSON(json);
                        this.applyConfig(this.defaultConfig);
                        loaded = true;
                        console.log('Default shortcut config loaded from:', path);
                        break;
                    }
                } catch (e) {
                    continue;
                }
            }
            
            if (!loaded) {
                // 如果文件加载失败，使用内置的默认配置
                console.warn('Failed to load default shortcut config from file, using built-in default');
                this.defaultConfig = this.getBuiltInDefaultConfig();
                this.applyConfig(this.defaultConfig);
            }
        } catch (error) {
            console.warn('Failed to load default shortcut config:', error);
            this.defaultConfig = this.getBuiltInDefaultConfig();
            this.applyConfig(this.defaultConfig);
        }
    }
    
    // 获取内置默认配置（作为fallback）
    getBuiltInDefaultConfig() {
        return ShortcutConfig.fromJSON({
            version: "1.0",
            description: "内置默认快捷键配置",
            shortcuts: {
                edit: {
                    delete: {
                        keys: ["Delete", "Backspace"],
                        description: "删除选中对象",
                        command: "editor.deleteSelected"
                    },
                    copy: {
                        keys: ["Ctrl+C", "Meta+C"],
                        description: "复制选中对象",
                        command: "editor.copySelected"
                    },
                    paste: {
                        keys: ["Ctrl+V", "Meta+V"],
                        description: "粘贴对象",
                        command: "editor.paste"
                    },
                    duplicate: {
                        keys: ["Ctrl+D", "Meta+D"],
                        description: "复制选中对象到鼠标位置",
                        command: "editor.duplicateSelected"
                    },
                    selectAll: {
                        keys: ["Ctrl+A", "Meta+A"],
                        description: "全选",
                        command: "editor.selectAll"
                    },
                    deselectAll: {
                        keys: ["Escape"],
                        description: "取消选择",
                        command: "editor.deselectAll"
                    }
                },
                history: {
                    undo: {
                        keys: ["Ctrl+Z", "Meta+Z"],
                        description: "撤销",
                        command: "editor.undo"
                    },
                    redo: {
                        keys: ["Ctrl+Y", "Meta+Y", "Ctrl+Shift+Z", "Meta+Shift+Z"],
                        description: "重做",
                        command: "editor.redo"
                    }
                },
                view: {
                    zoomIn: {
                        keys: ["+", "=", "Ctrl+=", "Meta+="],
                        description: "放大",
                        command: "editor.zoomIn"
                    },
                    zoomOut: {
                        keys: ["-", "Ctrl+-", "Meta+-"],
                        description: "缩小",
                        command: "editor.zoomOut"
                    },
                    resetView: {
                        keys: ["f", "F"],
                        description: "重置视图（居中显示）",
                        command: "editor.resetView"
                    }
                },
                file: {
                    new: {
                        keys: ["Ctrl+N", "Meta+N"],
                        description: "新建项目",
                        command: "editor.newProject"
                    },
                    open: {
                        keys: ["Ctrl+O", "Meta+O"],
                        description: "打开项目",
                        command: "editor.openProject"
                    },
                    save: {
                        keys: ["Ctrl+S", "Meta+S"],
                        description: "保存项目",
                        command: "editor.saveProject"
                    }
                },
                layout: {
                    arrange: {
                        keys: ["Ctrl+R", "Meta+R"],
                        description: "自动排列节点",
                        command: "editor.arrangeNodes"
                    }
                }
            },
            contexts: {
                global: {
                    description: "全局快捷键",
                    shortcuts: ["edit.delete", "edit.copy", "edit.paste", "history.undo", "history.redo", "view.zoomIn", "view.zoomOut", "view.resetView", "file.new", "file.open", "file.save", "layout.arrange"]
                },
                canvas: {
                    description: "画布上的快捷键",
                    shortcuts: ["edit.selectAll", "edit.deselectAll"]
                },
                input: {
                    description: "输入框中的快捷键",
                    shortcuts: ["edit.delete"]
                }
            }
        });
    }
    
    // 加载自定义配置
    async loadCustomConfig(path = './config/shortcuts.custom.json') {
        try {
            const paths = [
                path,
                './config/shortcuts.custom.json',
                '/config/shortcuts.custom.json',
                '../config/shortcuts.custom.json'
            ];
            
            let loaded = false;
            for (const configPath of paths) {
                try {
                    const response = await fetch(configPath);
                    if (response.ok) {
                        const json = await response.json();
                        this.customConfig = ShortcutConfig.fromJSON(json);
                        this.mergeConfig(this.defaultConfig, this.customConfig);
                        loaded = true;
                        console.log('Custom shortcut config loaded from:', configPath);
                        break;
                    }
                } catch (e) {
                    continue;
                }
            }
            
            if (!loaded) {
                console.info('Custom shortcut config not found, using default only');
            }
        } catch (error) {
            console.warn('Failed to load custom shortcut config:', error);
        }
    }
    
    // 从JSON对象加载配置
    loadConfigFromJSON(json) {
        this.customConfig = ShortcutConfig.fromJSON(json);
        this.mergeConfig(this.defaultConfig, this.customConfig);
    }
    
    // 合并配置（自定义配置覆盖默认配置）
    mergeConfig(defaultConfig, customConfig) {
        if (!defaultConfig) {
            this.config = customConfig || new ShortcutConfig();
            this.applyConfig(this.config);
            return;
        }
        
        // 创建合并后的配置
        const merged = new ShortcutConfig(defaultConfig.toJSON());
        
        // 合并自定义配置
        if (customConfig) {
            const customShortcuts = customConfig.getAllShortcuts();
            for (const [path, shortcut] of Object.entries(customShortcuts)) {
                const [category, name] = path.split('.');
                merged.setShortcut(category, name, shortcut);
            }
            
            // 合并上下文
            if (customConfig.contexts) {
                merged.contexts = { ...merged.contexts, ...customConfig.contexts };
            }
        }
        
        this.config = merged;
        this.applyConfig(this.config);
    }
    
    // 应用配置
    applyConfig(config) {
        if (!config) return;
        
        this.config = config;
        this.keyBindings.clear();
        this.contextShortcuts.clear();
        
        // 构建快捷键映射
        const allShortcuts = config.getAllShortcuts();
        for (const [path, shortcut] of Object.entries(allShortcuts)) {
            if (shortcut.keys && shortcut.command) {
                for (const keyCombo of shortcut.keys) {
                    // 标准化按键组合
                    const normalizedKey = this.normalizeKeyCombo(keyCombo);
                    this.keyBindings.set(normalizedKey, {
                        command: shortcut.command,
                        path: path,
                        description: shortcut.description
                    });
                }
            }
        }
        
        // 构建上下文映射
        if (config.contexts) {
            for (const [contextName, context] of Object.entries(config.contexts)) {
                const shortcuts = new Set();
                for (const shortcutPath of context.shortcuts || []) {
                    const shortcut = allShortcuts[shortcutPath];
                    if (shortcut && shortcut.keys) {
                        for (const keyCombo of shortcut.keys) {
                            shortcuts.add(this.normalizeKeyCombo(keyCombo));
                        }
                    }
                }
                this.contextShortcuts.set(contextName, shortcuts);
            }
        }
    }
    
    // 标准化按键组合（统一格式）
    normalizeKeyCombo(keyCombo) {
        // 转换为小写并统一格式
        // 例如: "Ctrl+C" -> "ctrl+c", "Meta+C" -> "meta+c"
        return keyCombo
            .toLowerCase()
            .replace(/meta/g, 'ctrl') // macOS的Meta键统一为Ctrl
            .replace(/\s+/g, '')
            .split('+')
            .sort((a, b) => {
                // 修饰键排序：ctrl, shift, alt
                const order = { ctrl: 0, shift: 1, alt: 2 };
                return (order[a] ?? 99) - (order[b] ?? 99);
            })
            .join('+');
    }
    
    // 从键盘事件构建按键组合
    buildKeyCombo(event) {
        const parts = [];
        
        // 修饰键（按顺序）
        if (event.ctrlKey || event.metaKey) parts.push('ctrl');
        if (event.shiftKey) parts.push('shift');
        if (event.altKey) parts.push('alt');
        
        // 主键
        const key = event.key.toLowerCase();
        if (!['control', 'shift', 'alt', 'meta'].includes(key)) {
            // 特殊键处理
            if (key === ' ') {
                parts.push('space');
            } else if (key.length === 1) {
                parts.push(key);
            } else {
                parts.push(key);
            }
        }
        
        return parts.join('+');
    }
    
    // 处理键盘事件
    handleKeyDown(event, context = null) {
        // 如果正在输入，只允许特定快捷键
        const activeElement = document.activeElement;
        const isInput = activeElement && 
            (activeElement.tagName === 'INPUT' || activeElement.tagName === 'TEXTAREA');
        
        const currentContext = context || (isInput ? 'input' : this.currentContext);
        
        // 构建按键组合
        const keyCombo = this.buildKeyCombo(event);
        const normalizedKey = this.normalizeKeyCombo(keyCombo);
        
        // 检查当前上下文是否允许此快捷键
        const contextShortcuts = this.contextShortcuts.get(currentContext) || new Set();
        const globalShortcuts = this.contextShortcuts.get('global') || new Set();
        
        const isAllowed = contextShortcuts.has(normalizedKey) || 
                        (currentContext !== 'global' && globalShortcuts.has(normalizedKey));
        
        if (!isAllowed) {
            return false; // 快捷键在当前上下文中不可用
        }
        
        // 查找并执行命令
        const binding = this.keyBindings.get(normalizedKey);
        if (binding && this.commandService.hasCommand(binding.command)) {
            // 执行命令
            this.commandService.execute(binding.command, event);
            return true;
        }
        
        return false;
    }
    
    // 设置当前上下文
    setContext(context) {
        this.currentContext = context || 'global';
    }
    
    // 获取当前上下文
    getContext() {
        return this.currentContext;
    }
    
    // 获取快捷键配置
    getConfig() {
        return this.config;
    }
    
    // 获取所有快捷键绑定
    getAllBindings() {
        return Array.from(this.keyBindings.entries()).map(([key, binding]) => ({
            key,
            command: binding.command,
            description: binding.description,
            path: binding.path
        }));
    }
    
    // 根据命令获取快捷键
    getShortcutByCommand(commandId) {
        for (const [key, binding] of this.keyBindings.entries()) {
            if (binding.command === commandId) {
                return key;
            }
        }
        return null;
    }
    
    // 导出配置为JSON
    exportConfig() {
        return this.config ? JSON.stringify(this.config.toJSON(), null, 2) : null;
    }
    
    // 验证配置
    validate() {
        if (!this.config) {
            return { valid: false, errors: ['No configuration loaded'] };
        }
        return this.config.validate();
    }
}

