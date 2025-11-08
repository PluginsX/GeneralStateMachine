// 键盘事件处理 - 交互层
// 负责处理快捷键、删除、复制等键盘事件
export default class KeyboardHandler {
    constructor() {
        // 快捷键映射
        this.keyBindings = new Map();
        
        // 当前状态
        this.isCtrlPressed = false;
        this.isShiftPressed = false;
        this.isAltPressed = false;
        
        // 回调函数
        this.onDelete = null;
        this.onCopy = null;
        this.onPaste = null;
        this.onUndo = null;
        this.onRedo = null;
        this.onSelectAll = null;
        this.onNewNode = null;
        this.onExport = null;
        this.onImport = null;
        this.onSave = null;
        this.onLoad = null;
        this.onZoomIn = null;
        this.onZoomOut = null;
        this.onResetView = null;
        
        // 初始化事件监听
        this.initEventListeners();
        
        // 设置默认快捷键
        this.setDefaultKeyBindings();
    }
    
    // 初始化事件监听器
    initEventListeners() {
        // 全局键盘事件（监听整个document）
        document.addEventListener('keydown', this.handleKeyDown.bind(this));
        document.addEventListener('keyup', this.handleKeyUp.bind(this));
    }
    
    // 设置默认快捷键
    setDefaultKeyBindings() {
        // 编辑操作
        this.addKeyBinding('Delete', () => this.onDelete?.());
        this.addKeyBinding('Backspace', () => this.onDelete?.());
        this.addKeyBinding('Ctrl+C', () => this.onCopy?.());
        this.addKeyBinding('Ctrl+V', () => this.onPaste?.());
        this.addKeyBinding('Ctrl+A', () => this.onSelectAll?.());
        
        // 历史操作
        this.addKeyBinding('Ctrl+Z', () => this.onUndo?.());
        this.addKeyBinding('Ctrl+Y', () => this.onRedo?.());
        this.addKeyBinding('Ctrl+Shift+Z', () => this.onRedo?.());
        
        // 视图操作
        this.addKeyBinding('+', () => this.onZoomIn?.());
        this.addKeyBinding('=', () => this.onZoomIn?.());
        this.addKeyBinding('-', () => this.onZoomOut?.());
        this.addKeyBinding('0', () => this.onResetView?.());
        
        // 文件操作
        this.addKeyBinding('Ctrl+S', (event) => {
            event.preventDefault();
            this.onSave?.();
        });
        this.addKeyBinding('Ctrl+O', (event) => {
            event.preventDefault();
            this.onLoad?.();
        });
        this.addKeyBinding('Ctrl+I', (event) => {
            event.preventDefault();
            this.onImport?.();
        });
        this.addKeyBinding('Ctrl+E', (event) => {
            event.preventDefault();
            this.onExport?.();
        });
        
        // 创建新节点
        this.addKeyBinding('N', () => this.onNewNode?.());
    }
    
    // 处理按键按下事件
    handleKeyDown(event) {
        // 更新修饰键状态
        this.isCtrlPressed = event.ctrlKey || event.metaKey;
        this.isShiftPressed = event.shiftKey;
        this.isAltPressed = event.altKey;
        
        // 构建按键组合字符串
        let keyCombo = '';
        if (this.isCtrlPressed) keyCombo += 'Ctrl+';
        if (this.isShiftPressed) keyCombo += 'Shift+';
        if (this.isAltPressed) keyCombo += 'Alt+';
        
        // 添加主按键（忽略修饰键）
        const key = event.key;
        if (!['Control', 'Shift', 'Alt', 'Meta'].includes(key)) {
            keyCombo += key;
        }
        
        // 特殊处理数字键和功能键
        const isNumberKey = /^\d$/.test(key);
        const isFunctionKey = /^F\d+$/.test(key);
        
        // 如果是单独的修饰键，不执行任何操作
        if (keyCombo === 'Ctrl+' || keyCombo === 'Shift+' || keyCombo === 'Alt+') {
            return;
        }
        
        // 查找并执行绑定的快捷键
        if (this.keyBindings.has(keyCombo)) {
            const handler = this.keyBindings.get(keyCombo);
            handler(event);
        } else if (isNumberKey && !this.isCtrlPressed && !this.isAltPressed) {
            // 处理纯数字键（可用于节点状态快速切换等）
            this.handleNumberKey(key, event);
        } else if (isFunctionKey) {
            // 处理功能键
            this.handleFunctionKey(key, event);
        }
    }
    
    // 处理按键释放事件
    handleKeyUp(event) {
        // 更新修饰键状态
        if (!event.ctrlKey && !event.metaKey) this.isCtrlPressed = false;
        if (!event.shiftKey) this.isShiftPressed = false;
        if (!event.altKey) this.isAltPressed = false;
    }
    
    // 处理数字键
    handleNumberKey(key, event) {
        // 可以根据需要扩展，例如用于快速切换节点状态
        console.log('Number key pressed:', key);
    }
    
    // 处理功能键
    handleFunctionKey(key, event) {
        // 可以根据需要扩展，例如F1帮助等
        console.log('Function key pressed:', key);
    }
    
    // 添加快捷键绑定
    addKeyBinding(keyCombo, handler) {
        if (typeof handler !== 'function') {
            console.error('Key handler must be a function');
            return;
        }
        
        this.keyBindings.set(keyCombo, handler);
    }
    
    // 移除快捷键绑定
    removeKeyBinding(keyCombo) {
        this.keyBindings.delete(keyCombo);
    }
    
    // 替换快捷键绑定
    replaceKeyBinding(keyCombo, handler) {
        if (typeof handler !== 'function') {
            console.error('Key handler must be a function');
            return;
        }
        
        this.keyBindings.set(keyCombo, handler);
    }
    
    // 清除所有快捷键绑定
    clearKeyBindings() {
        this.keyBindings.clear();
    }
    
    // 获取所有快捷键绑定
    getAllKeyBindings() {
        return new Map(this.keyBindings);
    }
    
    // 设置回调函数
    setCallbacks(callbacks) {
        this.onDelete = callbacks.onDelete;
        this.onCopy = callbacks.onCopy;
        this.onPaste = callbacks.onPaste;
        this.onUndo = callbacks.onUndo;
        this.onRedo = callbacks.onRedo;
        this.onSelectAll = callbacks.onSelectAll;
        this.onNewNode = callbacks.onNewNode;
        this.onExport = callbacks.onExport;
        this.onImport = callbacks.onImport;
        this.onSave = callbacks.onSave;
        this.onLoad = callbacks.onLoad;
        this.onZoomIn = callbacks.onZoomIn;
        this.onZoomOut = callbacks.onZoomOut;
        this.onResetView = callbacks.onResetView;
    }
    
    // 检查是否有某个快捷键绑定
    hasKeyBinding(keyCombo) {
        return this.keyBindings.has(keyCombo);
    }
    
    // 获取当前修饰键状态
    getModifierState() {
        return {
            isCtrlPressed: this.isCtrlPressed,
            isShiftPressed: this.isShiftPressed,
            isAltPressed: this.isAltPressed
        };
    }
    
    // 防止默认行为（用于特定按键）
    preventDefault(event, key) {
        if (event.key === key) {
            event.preventDefault();
        }
    }
    
    // 阻止事件冒泡
    stopPropagation(event) {
        event.stopPropagation();
    }
    
    // 阻止默认行为和事件冒泡
    stopEvent(event) {
        event.preventDefault();
        event.stopPropagation();
    }
    
    // 销毁事件监听器
    destroy() {
        document.removeEventListener('keydown', this.handleKeyDown);
        document.removeEventListener('keyup', this.handleKeyUp);
        
        // 清除所有绑定
        this.clearKeyBindings();
    }
}