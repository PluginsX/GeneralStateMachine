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
        
        // 加载自定义配置（从localStorage）
        this.loadCustomConfigFromStorage();
    }
    
    // 从localStorage加载自定义配置
    loadCustomConfigFromStorage() {
        try {
            const stored = localStorage.getItem('shortcut_config');
            if (stored) {
                const data = JSON.parse(stored);
                this.customConfig = ShortcutConfig.fromJSON(data);
                // 等待默认配置加载完成后再合并
                if (this.defaultConfig) {
                    this.mergeConfig(this.defaultConfig, this.customConfig);
                    console.log('ShortcutManager: Loaded custom config from localStorage');
                } else {
                    // 如果默认配置还没加载，标记需要合并
                    this.pendingCustomConfig = this.customConfig;
                }
            }
        } catch (e) {
            console.warn('Failed to load custom config from localStorage:', e);
        }
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
            }
            
            // 应用配置（合并自定义配置如果有）
            if (this.pendingCustomConfig) {
                this.mergeConfig(this.defaultConfig, this.pendingCustomConfig);
                this.pendingCustomConfig = null;
            } else {
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
        try {
            console.log('ShortcutManager: Loading config from JSON:', json);
            
            // 创建新的配置对象
            this.customConfig = ShortcutConfig.fromJSON(json);
            
            // 合并配置
            this.mergeConfig(this.defaultConfig, this.customConfig);
            
            console.log('ShortcutManager: Config loaded and applied from JSON successfully');
            console.log('ShortcutManager: Total key bindings after load:', this.keyBindings.size);
            
            // 验证关键绑定是否正确
            this.validateKeyBindings();
            
        } catch (error) {
            console.error('Failed to load config from JSON:', error);
            throw error;
        }
    }
    
    // 验证关键绑定
    validateKeyBindings() {
        const testKeys = ['ctrl+c', 'ctrl+v', 'delete', 'escape'];
        console.log('ShortcutManager: Validating key bindings...');
        
        for (const key of testKeys) {
            const binding = this.keyBindings.get(key);
            if (binding) {
                console.log(`  ✓ "${key}" -> "${binding.command}"`);
            } else {
                console.log(`  ✗ "${key}" -> No binding found`);
            }
        }
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
        if (!config) {
            console.warn('ShortcutManager: Cannot apply null config');
            return;
        }
        
        this.config = config;
        this.keyBindings.clear();
        this.contextShortcuts.clear();
        
        // 构建快捷键映射
        const allShortcuts = config.getAllShortcuts();
        console.log('ShortcutManager: Applying config with', Object.keys(allShortcuts).length, 'shortcuts');
        
        let bindingCount = 0;
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
                    bindingCount++;
                    
                    // 调试输出每个绑定
                    console.log(`ShortcutManager: Bound "${normalizedKey}" -> "${shortcut.command}" (${path})`);
                }
            } else {
                console.warn('ShortcutManager: Invalid shortcut:', path, shortcut);
            }
        }
        
        console.log('ShortcutManager: Built', bindingCount, 'key bindings (', this.keyBindings.size, 'unique)');
        
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
                    } else {
                        console.warn('ShortcutManager: Shortcut not found for context:', shortcutPath);
                    }
                }
                this.contextShortcuts.set(contextName, shortcuts);
                console.log('ShortcutManager: Context', contextName, 'has', shortcuts.size, 'shortcuts');
            }
        } else {
            console.warn('ShortcutManager: No contexts defined in config');
        }
        
        // 输出所有绑定用于调试
        if (this.keyBindings.size > 0) {
            console.log('ShortcutManager: All key bindings:');
            for (const [key, binding] of this.keyBindings.entries()) {
                console.log(`  "${key}" -> "${binding.command}" (${binding.path})`);
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
        let key = event.key;
        
        // 处理特殊键名
        const keyMap = {
            ' ': 'space',
            'Space': 'space',
            'Enter': 'enter',
            'Escape': 'escape',
            'Escape': 'escape',
            'Delete': 'delete',
            'Backspace': 'backspace',
            'Tab': 'tab',
            'ArrowUp': 'arrowup',
            'ArrowDown': 'arrowdown',
            'ArrowLeft': 'arrowleft',
            'ArrowRight': 'arrowright',
            'Home': 'home',
            'End': 'end',
            'PageUp': 'pageup',
            'PageDown': 'pagedown',
            'Insert': 'insert',
            'F1': 'f1',
            'F2': 'f2',
            'F3': 'f3',
            'F4': 'f4',
            'F5': 'f5',
            'F6': 'f6',
            'F7': 'f7',
            'F8': 'f8',
            'F9': 'f9',
            'F10': 'f10',
            'F11': 'f11',
            'F12': 'f12'
        };
        
        // 转换特殊键
        if (keyMap[key]) {
            key = keyMap[key];
        } else {
            key = key.toLowerCase();
        }
        
        // 忽略修饰键本身
        if (!['control', 'shift', 'alt', 'meta', 'ctrl'].includes(key)) {
            // 特殊键处理
            if (key === ' ') {
                parts.push('space');
            } else if (key.length === 1 || key.startsWith('f') || key.startsWith('arrow')) {
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
            (activeElement.tagName === 'INPUT' || activeElement.tagName === 'TEXTAREA' || 
             activeElement.isContentEditable);
        
        const currentContext = context !== null ? context : (isInput ? 'input' : this.currentContext);
        
        // 构建按键组合
        const keyCombo = this.buildKeyCombo(event);
        const normalizedKey = this.normalizeKeyCombo(keyCombo);
        
        // 调试信息（总是输出，便于调试）
        console.log('ShortcutManager.handleKeyDown:', {
            originalKey: event.key,
            keyCombo,
            normalizedKey,
            currentContext,
            isInput,
            keyBindingsSize: this.keyBindings.size,
            hasBinding: this.keyBindings.has(normalizedKey)
        });
        
        // 首先检查是否有绑定（不依赖上下文，因为上下文检查可能有问题）
        const binding = this.keyBindings.get(normalizedKey);
        if (!binding) {
            // 尝试其他可能的键格式
            const altNormalized = this.tryAlternativeKeyFormats(keyCombo);
            if (altNormalized) {
                const altBinding = this.keyBindings.get(altNormalized);
                if (altBinding) {
                    console.log('Found binding using alternative format:', altNormalized);
                    // 找到匹配，执行命令
                    event.preventDefault();
                    event.stopPropagation();
                    this.commandService.execute(altBinding.command, event);
                    return true;
                }
            }
            console.log('No binding found for key:', normalizedKey);
            return false;
        }
        
        // 检查当前上下文是否允许此快捷键
        const contextShortcuts = this.contextShortcuts.get(currentContext) || new Set();
        const globalShortcuts = this.contextShortcuts.get('global') || new Set();
        
        // 允许条件：在当前上下文中，或者在全局上下文中
        const isAllowed = contextShortcuts.has(normalizedKey) || 
                        globalShortcuts.has(normalizedKey) ||
                        currentContext === 'global' ||
                        !this.contextShortcuts.has(currentContext); // 如果上下文没有定义，允许所有快捷键
        
        if (!isAllowed) {
            console.log('Shortcut not allowed in context:', {
                normalizedKey,
                currentContext,
                contextShortcuts: Array.from(contextShortcuts),
                globalShortcuts: Array.from(globalShortcuts)
            });
            return false;
        }
        
        // 检查命令是否存在
        if (!this.commandService.hasCommand(binding.command)) {
            console.warn('Command not found:', binding.command);
            return false;
        }
        
        // 立即阻止默认行为，防止浏览器快捷键触发
        event.preventDefault();
        event.stopPropagation();
        
        console.log('Executing command:', binding.command, 'for key:', normalizedKey);
        
        // 执行命令
        try {
            this.commandService.execute(binding.command, event);
            if (this.config && this.config.debug) {
                console.log('Command executed:', binding.command);
            }
            return true;
        } catch (error) {
            console.error('Error executing command:', binding.command, error);
            return false;
        }
    }
    
    // 尝试其他可能的键格式（增强版本）
    tryAlternativeKeyFormats(keyCombo) {
        const formats = [
            keyCombo, // 原始格式
            this.normalizeKeyCombo(keyCombo), // 标准化格式
            keyCombo.toLowerCase(), // 小写格式
            keyCombo.toUpperCase(), // 大写格式
            this.buildAlternativeFormat(keyCombo) // 替代格式
        ];
        
        for (const format of formats) {
            if (this.keyBindings.has(format)) {
                console.log('Found matching format:', format, 'for original:', keyCombo);
                return format;
            }
        }
        
        return null;
    }
    
    // 构建替代格式（处理可能的格式差异）
    buildAlternativeFormat(keyCombo) {
        // 处理可能的格式差异，比如空格、加号等
        return keyCombo
            .replace(/\s+/g, '+') // 空格替换为加号
            .replace(/\++/g, '+') // 多个加号替换为单个加号
            .toLowerCase();
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

