// 快捷键配置窗口 - 继承自InternalWindowBase
import InternalWindowBase from './InternalWindowBase.js';
import ShortcutConfig from '../config/ShortcutConfig.js';
import ConfigLoader from '../utils/ConfigLoader.js';

export default class ShortcutConfigWindow extends InternalWindowBase {
    constructor(shortcutManager) {
        super({
            title: '快捷键设置',
            width: 800,
            height: 600,
            modal: true,
            closable: true,
            draggable: true,
            zIndex: 2000
        });
        
        this.shortcutManager = shortcutManager;
        this.config = null;
        this.defaultConfig = null;
        this.editingKey = null;
        this.keyCaptureHandler = null;
    }
    
    // 窗口显示时
    async onShow() {
        await this.loadConfig();
        this.render();
    }
    
    // 加载配置
    async loadConfig() {
        // 1. 优先从localStorage读取
        const storedConfig = this.loadFromStorage();
        if (storedConfig) {
            this.config = ShortcutConfig.fromJSON(storedConfig);
            console.log('Loaded shortcut config from localStorage');
        } else {
            // 2. 从默认配置文件读取
            const defaultConfig = await ConfigLoader.loadJSON('config/shortcuts.default.json') ||
                                 await ConfigLoader.loadJSON('public/config/shortcuts.default.json');
            if (defaultConfig) {
                this.config = ShortcutConfig.fromJSON(defaultConfig);
                this.defaultConfig = ShortcutConfig.fromJSON(defaultConfig);
                console.log('Loaded shortcut config from file');
            } else {
                // 3. 使用内置默认配置
                const builtInConfig = this.shortcutManager.getConfig();
                if (builtInConfig) {
                    this.config = ShortcutConfig.fromJSON(builtInConfig.toJSON());
                    this.defaultConfig = ShortcutConfig.fromJSON(builtInConfig.toJSON());
                    console.log('Using built-in default config');
                } else {
                    // 最后的fallback
                    this.config = new ShortcutConfig();
                    this.defaultConfig = new ShortcutConfig();
                    console.warn('Using empty config as fallback');
                }
            }
        }
        
        // 确保有默认配置（用于重置功能）
        if (!this.defaultConfig) {
            // 尝试从文件加载默认配置
            const defaultConfig = await ConfigLoader.loadJSON('config/shortcuts.default.json') ||
                                 await ConfigLoader.loadJSON('public/config/shortcuts.default.json');
            if (defaultConfig) {
                this.defaultConfig = ShortcutConfig.fromJSON(defaultConfig);
            } else {
                // 使用当前配置作为默认（如果没有其他选择）
                this.defaultConfig = this.config ? ShortcutConfig.fromJSON(this.config.toJSON()) : new ShortcutConfig();
            }
        }
    }
    
    // 从localStorage读取配置（更可靠，容量更大）
    loadFromStorage() {
        try {
            const stored = localStorage.getItem('shortcut_config');
            if (stored) {
                const data = JSON.parse(stored);
                console.log('Loaded shortcut config from localStorage');
                return data;
            }
        } catch (e) {
            console.error('Failed to load shortcut config from localStorage:', e);
            // 尝试从Cookie读取（向后兼容）
            return this.loadFromCookie();
        }
        return null;
    }
    
    // 从Cookie读取配置（向后兼容）
    loadFromCookie() {
        const name = 'shortcut_config';
        const cookies = document.cookie.split(';');
        for (let cookie of cookies) {
            const [key, value] = cookie.trim().split('=');
            if (key === name) {
                try {
                    const data = JSON.parse(decodeURIComponent(value));
                    // 如果从Cookie读取成功，迁移到localStorage
                    this.saveToStorage(data);
                    return data;
                } catch (e) {
                    console.error('Failed to parse cookie config:', e);
                    return null;
                }
            }
        }
        return null;
    }
    
    // 保存配置到localStorage（主要方式）
    saveToStorage(data = null) {
        try {
            const configData = data || (this.config ? this.config.toJSON() : null);
            if (!configData) return;
            
            localStorage.setItem('shortcut_config', JSON.stringify(configData));
            console.log('Saved shortcut config to localStorage');
            
            // 同时保存到Cookie（向后兼容，但可能因为大小限制失败）
            try {
                this.saveToCookie(configData);
            } catch (e) {
                console.warn('Failed to save to cookie (may be too large):', e);
            }
        } catch (e) {
            console.error('Failed to save shortcut config to localStorage:', e);
            // 如果localStorage失败，尝试使用Cookie
            if (data || this.config) {
                this.saveToCookie(data || this.config.toJSON());
            }
        }
    }
    
    // 保存配置到Cookie（备用方式，向后兼容）
    saveToCookie(data = null) {
        try {
            const configData = data || (this.config ? this.config.toJSON() : null);
            if (!configData) return;
            
            const name = 'shortcut_config';
            const value = encodeURIComponent(JSON.stringify(configData));
            
            // 检查大小（Cookie限制约4KB）
            if (value.length > 4000) {
                console.warn('Config too large for cookie, using localStorage only');
                return;
            }
            
            const days = 365; // 保存365天
            const date = new Date();
            date.setTime(date.getTime() + (days * 24 * 60 * 60 * 1000));
            const expires = `expires=${date.toUTCString()}`;
            
            document.cookie = `${name}=${value};${expires};path=/`;
            console.log('Saved shortcut config to cookie');
        } catch (e) {
            console.error('Failed to save to cookie:', e);
        }
    }
    
    // 渲染窗口内容
    render() {
        if (!this.config) {
            this.setContent('<p>配置加载失败</p>');
            return;
        }
        
        const shortcuts = this.config.getAllShortcuts();
        const categories = {};
        
        // 按分类组织
        for (const [path, shortcut] of Object.entries(shortcuts)) {
            const [category, name] = path.split('.');
            if (!categories[category]) {
                categories[category] = [];
            }
            categories[category].push({ path, name, ...shortcut });
        }
        
        let html = `
            <div style="display: flex; flex-direction: column; height: 100%;">
                <div style="flex: 1; overflow-y: auto; padding: 8px;">
                    <table style="width: 100%; border-collapse: collapse;">
                        <thead>
                            <tr style="border-bottom: 2px solid ${this.getThemeColor('border', '#3e3e42')};">
                                <th style="padding: 8px; text-align: left; font-weight: bold;">命令名称</th>
                                <th style="padding: 8px; text-align: left; font-weight: bold;">快捷键</th>
                                <th style="padding: 8px; text-align: center; font-weight: bold; width: 100px;">操作</th>
                            </tr>
                        </thead>
                        <tbody>
        `;
        
        // 渲染每个分类
        for (const [category, items] of Object.entries(categories)) {
            html += `
                <tr>
                    <td colspan="3" style="padding: 12px 8px 4px 8px; font-weight: bold; color: ${this.getThemeColor('textSecondary', '#999')};">
                        ${this.getCategoryName(category)}
                    </td>
                </tr>
            `;
            
            items.forEach(item => {
                const keys = item.keys.map(key => 
                    `<span style="display: inline-block; padding: 2px 6px; margin: 2px; background: ${this.getThemeColor('keyBg', '#3e3e42')}; border: 1px solid ${this.getThemeColor('border', '#464647')}; border-radius: 3px; font-size: 11px; font-family: monospace;">${key}</span>`
                ).join(' ');
                
                html += `
                    <tr style="border-bottom: 1px solid ${this.getThemeColor('border', '#3e3e42')};">
                        <td style="padding: 8px;">
                            <div style="font-weight: 500;">${item.description || item.name}</div>
                            <div style="font-size: 11px; color: ${this.getThemeColor('textSecondary', '#999')}; margin-top: 2px;">${item.command}</div>
                        </td>
                        <td style="padding: 8px;">
                            <button class="shortcut-key-btn" data-path="${item.path}" style="
                                padding: 4px 12px;
                                border: 1px solid ${this.getThemeColor('border', '#464647')};
                                border-radius: 3px;
                                background: ${this.getThemeColor('buttonBg', '#2d2d30')};
                                color: ${this.getThemeColor('text', '#e0e0e0')};
                                cursor: pointer;
                                font-size: 12px;
                                font-family: monospace;
                                min-width: 120px;
                                transition: all 0.2s;
                            ">${item.keys[0] || '未设置'}</button>
                        </td>
                        <td style="padding: 8px; text-align: center;">
                            <button class="shortcut-reset-btn" data-path="${item.path}" style="
                                padding: 4px 12px;
                                border: 1px solid ${this.getThemeColor('border', '#464647')};
                                border-radius: 3px;
                                background: ${this.getThemeColor('buttonBg', '#2d2d30')};
                                color: ${this.getThemeColor('text', '#e0e0e0')};
                                cursor: pointer;
                                font-size: 12px;
                            ">重置</button>
                        </td>
                    </tr>
                `;
            });
        }
        
        html += `
                        </tbody>
                    </table>
                </div>
            </div>
        `;
        
        this.setContent(html);
        
        // 绑定事件
        this.bindEvents();
    }
    
    // 绑定事件
    bindEvents() {
        // 快捷键按钮点击
        const keyButtons = this.content.querySelectorAll('.shortcut-key-btn');
        keyButtons.forEach(btn => {
            btn.addEventListener('click', (e) => {
                const path = e.target.getAttribute('data-path');
                this.startEditKey(path, e.target);
            });
        });
        
        // 重置按钮点击
        const resetButtons = this.content.querySelectorAll('.shortcut-reset-btn');
        resetButtons.forEach(btn => {
            btn.addEventListener('click', (e) => {
                const path = e.target.getAttribute('data-path');
                this.resetShortcut(path);
            });
        });
    }
    
    // 开始编辑快捷键
    startEditKey(path, button) {
        // 取消之前的编辑
        if (this.editingKey) {
            this.cancelEditKey();
        }
        
        this.editingKey = { path, button };
        
        // 更新按钮样式（灰色，表示正在监听）
        button.style.backgroundColor = this.getThemeColor('keyEditingBg', '#666');
        button.style.borderColor = this.getThemeColor('keyEditingBorder', '#888');
        button.textContent = '按下按键...';
        
        // 监听下一个按键
        this.keyCaptureHandler = (e) => {
            e.preventDefault();
            e.stopPropagation();
            
            const keyCombo = this.buildKeyCombo(e);
            if (keyCombo) {
                this.finishEditKey(path, keyCombo);
            }
        };
        
        document.addEventListener('keydown', this.keyCaptureHandler, true);
    }
    
    // 完成编辑快捷键
    finishEditKey(path, keyCombo) {
        if (!this.editingKey || this.editingKey.path !== path) return;
        
        // 移除监听
        document.removeEventListener('keydown', this.keyCaptureHandler, true);
        this.keyCaptureHandler = null;
        
        // 更新配置
        const [category, name] = path.split('.');
        if (this.config.shortcuts[category] && this.config.shortcuts[category][name]) {
            this.config.shortcuts[category][name].keys = [keyCombo];
        }
        
        // 更新按钮
        const button = this.editingKey.button;
        button.style.backgroundColor = this.getThemeColor('buttonBg', '#2d2d30');
        button.style.borderColor = this.getThemeColor('border', '#464647');
        button.textContent = keyCombo;
        
        this.editingKey = null;
    }
    
    // 取消编辑快捷键
    cancelEditKey() {
        if (!this.editingKey) return;
        
        // 移除监听
        if (this.keyCaptureHandler) {
            document.removeEventListener('keydown', this.keyCaptureHandler, true);
            this.keyCaptureHandler = null;
        }
        
        // 恢复按钮
        const button = this.editingKey.button;
        const path = this.editingKey.path;
        const [category, name] = path.split('.');
        
        if (this.config.shortcuts[category] && this.config.shortcuts[category][name]) {
            const keys = this.config.shortcuts[category][name].keys;
            button.textContent = keys[0] || '未设置';
        }
        
        button.style.backgroundColor = this.getThemeColor('buttonBg', '#2d2d30');
        button.style.borderColor = this.getThemeColor('border', '#464647');
        
        this.editingKey = null;
    }
    
    // 构建按键组合
    buildKeyCombo(event) {
        const parts = [];
        
        // 修饰键（按顺序）
        if (event.ctrlKey || event.metaKey) parts.push('Ctrl');
        if (event.shiftKey) parts.push('Shift');
        if (event.altKey) parts.push('Alt');
        
        // 主键
        const key = event.key;
        if (!['Control', 'Shift', 'Alt', 'Meta'].includes(key)) {
            // 特殊键处理
            if (key === ' ') {
                parts.push('Space');
            } else if (key.length === 1) {
                parts.push(key);
            } else {
                // 功能键等
                parts.push(key);
            }
        } else {
            // 如果只有修饰键，返回null
            return null;
        }
        
        return parts.join('+');
    }
    
    // 重置快捷键
    resetShortcut(path) {
        if (!this.defaultConfig) return;
        
        const [category, name] = path.split('.');
        const defaultShortcut = this.defaultConfig.shortcuts[category]?.[name];
        
        if (defaultShortcut && this.config.shortcuts[category] && this.config.shortcuts[category][name]) {
            this.config.shortcuts[category][name].keys = [...defaultShortcut.keys];
            
            // 更新显示
            const button = this.content.querySelector(`.shortcut-key-btn[data-path="${path}"]`);
            if (button) {
                button.textContent = defaultShortcut.keys[0] || '未设置';
            }
        }
    }
    
    // 获取分类名称
    getCategoryName(category) {
        const names = {
            edit: '编辑',
            history: '历史',
            view: '视图',
            file: '文件',
            node: '节点',
            connection: '连线',
            layout: '布局'
        };
        return names[category] || category;
    }
    
    // 覆盖createFooter以添加按钮
    createFooter() {
        super.createFooter();
        this.footer.style.display = 'flex';
        
        // 确定按钮
        this.addFooterButton('确定', () => {
            this.save();
        }, { primary: true });
        
        // 重置按钮
        this.addFooterButton('重置为默认', () => {
            this.resetToDefault();
        });
    }
    
    // 保存配置
    save() {
        // 取消正在编辑的快捷键
        if (this.editingKey) {
            this.cancelEditKey();
        }
        
        if (!this.config) {
            console.error('No config to save');
            return;
        }
        
        // 验证配置
        const validation = this.config.validate();
        if (!validation.valid) {
            console.error('Config validation failed:', validation.errors);
            alert('配置验证失败: ' + validation.errors.join(', '));
            return;
        }
        
        // 保存到localStorage（主要方式）
        this.saveToStorage();
        
        // 应用到ShortcutManager（重要：确保立即生效）
        if (this.shortcutManager) {
            const configJSON = this.config.toJSON();
            console.log('Applying config to ShortcutManager:', configJSON);
            this.shortcutManager.loadConfigFromJSON(configJSON);
            console.log('Config applied successfully');
        }
        
        // 关闭窗口
        this.hide();
        
        // 提示保存成功
        console.log('快捷键配置已保存');
    }
    
    // 重置为默认配置
    resetToDefault() {
        if (!this.defaultConfig) {
            alert('无法重置：默认配置未加载');
            return;
        }
        
        if (confirm('确定要重置为默认配置吗？所有自定义设置将被清除。')) {
            this.config = ShortcutConfig.fromJSON(this.defaultConfig.toJSON());
            this.render();
            
            // 立即保存重置后的配置
            this.saveToStorage();
            
            // 应用到ShortcutManager
            if (this.shortcutManager) {
                this.shortcutManager.loadConfigFromJSON(this.config.toJSON());
            }
            
            console.log('已重置为默认配置');
        }
    }
    
    // 窗口隐藏时
    onHide() {
        // 取消正在编辑的快捷键
        if (this.editingKey) {
            this.cancelEditKey();
        }
    }
}

