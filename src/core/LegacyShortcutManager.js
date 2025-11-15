// 旧系统快捷键管理器 - 统一管理所有快捷键
export default class LegacyShortcutManager {
    constructor(editor) {
        this.editor = editor;
        this.shortcuts = new Map();
        this.initializeShortcuts();
    }
    
    // 初始化所有快捷键
    initializeShortcuts() {
        // 视图操作快捷键
        this.registerShortcut(['f', 'F'], () => {
            this.editor.resetView();
        }, '重置视图');
        
        this.registerShortcut(['Escape', 'Esc'], () => {
            if (this.editor.creatingConnection) {
                this.editor.creatingConnection = null;
                this.editor.scheduleRender();
            }
        }, '取消连接创建');
        
        // 编辑操作快捷键
        this.registerShortcut(['Delete', 'Backspace'], () => {
            if (this.editor.selectedElements.length > 0) {
                // 删除节点
                const nodesToDelete = this.editor.selectedElements.filter(el => el.type === 'node');
                if (nodesToDelete.length > 0) {
                    this.editor.deleteSelectedNodes();
                }
                // 删除连线
                const connectionsToDelete = this.editor.selectedElements.filter(el => el.type === 'connection');
                if (connectionsToDelete.length > 0) {
                    this.editor.deleteSelectedConnections();
                }
                // 删除文字对象
                const textContentsToDelete = this.editor.selectedElements.filter(el => el.type === 'text');
                if (textContentsToDelete.length > 0) {
                    this.editor.deleteSelectedTextContents();
                }
            }
        }, '删除选中对象');
        
        // Ctrl组合键
        this.registerShortcut(['Ctrl+a', 'Meta+a', 'Ctrl+A', 'Meta+A'], () => {
            this.editor.selectAll();
        }, '全选对象');
        
        this.registerShortcut(['Ctrl+d', 'Meta+d', 'Ctrl+D', 'Meta+D'], () => {
            if (this.editor.selectedElements.length > 0) {
                this.editor.duplicateSelectedElements();
            }
        }, '复制选中对象到鼠标位置');
        
        // 可以继续添加更多快捷键...
        this.registerShortcut(['Ctrl+z', 'Meta+z', 'Ctrl+Z', 'Meta+Z'], () => {
            if (this.editor.historyManager) {
                this.editor.historyManager.undo();
            }
        }, '撤销');
        
        this.registerShortcut(['Ctrl+y', 'Meta+y', 'Ctrl+Y', 'Meta+Y'], () => {
            if (this.editor.historyManager) {
                this.editor.historyManager.redo();
            }
        }, '重做');
    }
    
    // 注册快捷键
    registerShortcut(keys, callback, description) {
        keys.forEach(key => {
            this.shortcuts.set(key, {
                callback,
                description
            });
        });
    }
    
    // 处理键盘事件
    handleKeyDown(e) {
        // 如果正在输入框中输入，忽略大部分快捷键
        const activeElement = document.activeElement;
        if (activeElement && (activeElement.tagName === 'INPUT' || activeElement.tagName === 'TEXTAREA')) {
            // 但允许Delete键在输入框中工作
            if (e.key === 'Delete' || e.key === 'Backspace') {
                return false;
            }
            return true; // 阻止其他快捷键
        }
        
        // 构建快捷键字符串
        const keyCombo = this.buildKeyCombo(e);
        
        // 查找匹配的快捷键
        const shortcut = this.shortcuts.get(keyCombo);
        if (shortcut) {
            e.preventDefault();
            shortcut.callback();
            return true;
        }
        
        return false;
    }
    
    // 构建快捷键字符串
    buildKeyCombo(e) {
        const parts = [];
        
        if (e.ctrlKey) parts.push('Ctrl');
        if (e.metaKey) parts.push('Meta');
        if (e.shiftKey) parts.push('Shift');
        if (e.altKey) parts.push('Alt');
        
        parts.push(e.key);
        
        return parts.join('+');
    }
    
    // 获取所有快捷键列表（用于帮助文档）
    getAllShortcuts() {
        const result = [];
        this.shortcuts.forEach((value, key) => {
            result.push({
                key,
                description: value.description
            });
        });
        return result;
    }
    
    // 添加新的快捷键
    addShortcut(keys, callback, description) {
        this.registerShortcut(keys, callback, description);
    }
    
    // 移除快捷键
    removeShortcut(keys) {
        keys.forEach(key => {
            this.shortcuts.delete(key);
        });
    }
}