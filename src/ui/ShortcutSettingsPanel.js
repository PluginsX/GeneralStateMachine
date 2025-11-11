// 快捷键设置面板 - 用于查看和编辑快捷键配置
import ShortcutConfig from '../config/ShortcutConfig.js';

export default class ShortcutSettingsPanel {
    constructor(shortcutManager) {
        this.shortcutManager = shortcutManager;
        this.panel = null;
        this.isEditing = false;
        this.editingKey = null;
    }
    
    // 创建设置面板
    createPanel() {
        const panel = document.createElement('div');
        panel.className = 'shortcut-settings-panel';
        panel.innerHTML = `
            <div class="shortcut-settings-header">
                <h3>快捷键设置</h3>
                <button class="close-btn" onclick="this.closest('.shortcut-settings-panel').remove()">×</button>
            </div>
            <div class="shortcut-settings-content">
                <div class="shortcut-settings-toolbar">
                    <button class="btn-export">导出配置</button>
                    <button class="btn-import">导入配置</button>
                    <button class="btn-reset">重置为默认</button>
                </div>
                <div class="shortcut-settings-list" id="shortcut-list"></div>
            </div>
        `;
        
        this.panel = panel;
        this.setupEventListeners();
        this.renderShortcuts();
        
        return panel;
    }
    
    // 设置事件监听
    setupEventListeners() {
        const exportBtn = this.panel.querySelector('.btn-export');
        const importBtn = this.panel.querySelector('.btn-import');
        const resetBtn = this.panel.querySelector('.btn-reset');
        
        exportBtn.addEventListener('click', () => this.exportConfig());
        importBtn.addEventListener('click', () => this.importConfig());
        resetBtn.addEventListener('click', () => this.resetToDefault());
    }
    
    // 渲染快捷键列表
    renderShortcuts() {
        const list = this.panel.querySelector('#shortcut-list');
        list.innerHTML = '';
        
        const config = this.shortcutManager.getConfig();
        if (!config) {
            list.innerHTML = '<p>未加载配置</p>';
            return;
        }
        
        const shortcuts = config.getAllShortcuts();
        const categories = {};
        
        // 按分类组织
        for (const [path, shortcut] of Object.entries(shortcuts)) {
            const [category, name] = path.split('.');
            if (!categories[category]) {
                categories[category] = [];
            }
            categories[category].push({ path, name, ...shortcut });
        }
        
        // 渲染每个分类
        for (const [category, items] of Object.entries(categories)) {
            const categoryDiv = document.createElement('div');
            categoryDiv.className = 'shortcut-category';
            categoryDiv.innerHTML = `<h4>${this.getCategoryName(category)}</h4>`;
            
            const itemsList = document.createElement('div');
            itemsList.className = 'shortcut-items';
            
            items.forEach(item => {
                const itemDiv = document.createElement('div');
                itemDiv.className = 'shortcut-item';
                
                const keys = item.keys.map(key => {
                    return `<span class="key-badge">${key}</span>`;
                }).join(' ');
                
                itemDiv.innerHTML = `
                    <div class="shortcut-info">
                        <span class="shortcut-description">${item.description || item.name}</span>
                        <span class="shortcut-command">${item.command}</span>
                    </div>
                    <div class="shortcut-keys">
                        ${keys}
                        <button class="btn-edit" data-path="${item.path}">编辑</button>
                    </div>
                `;
                
                const editBtn = itemDiv.querySelector('.btn-edit');
                editBtn.addEventListener('click', () => this.startEdit(item.path));
                
                itemsList.appendChild(itemDiv);
            });
            
            categoryDiv.appendChild(itemsList);
            list.appendChild(categoryDiv);
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
    
    // 开始编辑快捷键
    startEdit(path) {
        this.isEditing = true;
        this.editingKey = path;
        
        // 显示编辑界面
        const item = document.querySelector(`[data-path="${path}"]`).closest('.shortcut-item');
        const keysDiv = item.querySelector('.shortcut-keys');
        
        keysDiv.innerHTML = `
            <input type="text" class="key-input" placeholder="按下要设置的快捷键..." />
            <button class="btn-save">保存</button>
            <button class="btn-cancel">取消</button>
        `;
        
        const input = keysDiv.querySelector('.key-input');
        const saveBtn = keysDiv.querySelector('.btn-save');
        const cancelBtn = keysDiv.querySelector('.btn-cancel');
        
        // 监听按键
        input.addEventListener('keydown', (e) => {
            e.preventDefault();
            const keyCombo = this.buildKeyCombo(e);
            input.value = keyCombo;
        });
        
        saveBtn.addEventListener('click', () => this.saveEdit(path, input.value));
        cancelBtn.addEventListener('click', () => this.cancelEdit());
    }
    
    // 构建按键组合
    buildKeyCombo(event) {
        const parts = [];
        if (event.ctrlKey || event.metaKey) parts.push('Ctrl');
        if (event.shiftKey) parts.push('Shift');
        if (event.altKey) parts.push('Alt');
        
        const key = event.key;
        if (!['Control', 'Shift', 'Alt', 'Meta'].includes(key)) {
            parts.push(key);
        }
        
        return parts.join('+');
    }
    
    // 保存编辑
    saveEdit(path, keyCombo) {
        if (!keyCombo) {
            alert('请输入快捷键');
            return;
        }
        
        const config = this.shortcutManager.getConfig();
        const [category, name] = path.split('.');
        
        if (config.shortcuts[category] && config.shortcuts[category][name]) {
            config.shortcuts[category][name].keys = [keyCombo];
            this.shortcutManager.applyConfig(config);
            this.renderShortcuts();
        }
        
        this.cancelEdit();
    }
    
    // 取消编辑
    cancelEdit() {
        this.isEditing = false;
        this.editingKey = null;
        this.renderShortcuts();
    }
    
    // 导出配置
    exportConfig() {
        const json = this.shortcutManager.exportConfig();
        if (json) {
            const blob = new Blob([json], { type: 'application/json' });
            const url = URL.createObjectURL(blob);
            const a = document.createElement('a');
            a.href = url;
            a.download = 'shortcuts.custom.json';
            a.click();
            URL.revokeObjectURL(url);
        }
    }
    
    // 导入配置
    importConfig() {
        const input = document.createElement('input');
        input.type = 'file';
        input.accept = '.json';
        input.onchange = (e) => {
            const file = e.target.files[0];
            if (file) {
                const reader = new FileReader();
                reader.onload = (event) => {
                    try {
                        const json = JSON.parse(event.target.result);
                        this.shortcutManager.loadConfigFromJSON(json);
                        this.renderShortcuts();
                        alert('配置导入成功');
                    } catch (error) {
                        alert('配置文件格式错误');
                    }
                };
                reader.readAsText(file);
            }
        };
        input.click();
    }
    
    // 重置为默认
    resetToDefault() {
        if (confirm('确定要重置为默认配置吗？')) {
            this.shortcutManager.loadDefaultConfig();
            this.renderShortcuts();
        }
    }
    
    // 显示面板
    show() {
        if (!this.panel) {
            this.createPanel();
        }
        document.body.appendChild(this.panel);
    }
    
    // 隐藏面板
    hide() {
        if (this.panel && this.panel.parentElement) {
            this.panel.parentElement.removeChild(this.panel);
        }
    }
}

