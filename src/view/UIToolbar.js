// 工具栏UI - 视图层
// 负责工具栏按钮绑定、状态同步
export default class UIToolbar {
    constructor(containerId) {
        this.container = document.getElementById(containerId);
        if (!this.container) {
            console.error('工具栏容器不存在:', containerId);
            return;
        }
        
        // 回调函数
        this.onNewNode = null;       // 新建节点回调
        this.onDeleteSelected = null; // 删除选中回调
        this.onUndo = null;          // 撤销回调
        this.onRedo = null;          // 重做回调
        this.onZoomIn = null;        // 放大回调
        this.onZoomOut = null;       // 缩小回调
        this.onResetView = null;     // 重置视图回调
        this.onExportImage = null;   // 导出图片回调
        this.onExportMarkdown = null; // 导出Markdown回调
        this.onImport = null;        // 导入回调
        this.onSave = null;          // 保存回调
        this.onLoad = null;          // 加载回调
        this.onAutoArrange = null;   // 自动排列回调
        this.onRealTimeArrange = null; // 实时自动排列回调
        this.onConcentrateArrange = null; // 集中排列回调
        
        // 工具可用性状态 - 默认所有工具都是可用的
        this.toolAvailability = {
            'new-node': true,
            'delete-selected': true,
            'zoom-in': true,
            'zoom-out': true,
            'reset-view': true,
            'auto-arrange': true,
            'real-time-arrange': true,
            'concentrate-arrange': true, // 集中排列
            'export-image': true,
            'export-markdown': true,
            'import': true,
            'save': true,
            'load': true,
            'undo': false, // 初始状态禁用
            'redo': false  // 初始状态禁用
        };
        
        // 保存所有按钮的引用
        this.buttons = {};
        
        this.init();
    }
    
    // 初始化工具栏
    init() {
        this.container.innerHTML = '';
        this.container.className = 'toolbar';
        
        // 创建按钮组
        this.createButtonGroups();
    }
    
    // 创建按钮组
    createButtonGroups() {
        // 基础操作组
        this.createBasicActionsGroup();
        
        // 视图控制组
        this.createViewControlsGroup();
        
        // 导入导出组
        this.createImportExportGroup();
        
        // 历史操作组
        this.createHistoryGroup();
    }
    
    // 创建基础操作组
    createBasicActionsGroup() {
        const group = this.createButtonGroup('基础操作');
        
        this.addButton(group, 'new-node', '新建节点', '添加新节点', () => this.onNewNode?.());
        this.addButton(group, 'delete-selected', '删除选中', '删除选中的元素', () => this.onDeleteSelected?.());
        
        this.container.appendChild(group);
    }
    
    // 创建视图控制组
    createViewControlsGroup() {
        const group = this.createButtonGroup('视图控制');
        
        this.addButton(group, 'zoom-in', '放大', '放大视图', () => this.onZoomIn?.());
        this.addButton(group, 'zoom-out', '缩小', '缩小视图', () => this.onZoomOut?.());
        this.addButton(group, 'reset-view', '重置视图', '重置缩放和平移', () => this.onResetView?.());
        this.addButton(group, 'auto-arrange', '自动排列', '按照树形结构重新排列节点', () => this.onAutoArrange?.());
        this.addButton(group, 'real-time-arrange', '实时自动排列', '实时自动排列节点', () => this.onRealTimeArrange?.());
        this.addButton(group, 'concentrate-arrange', '集中排列', '集中排列所有节点', () => this.onConcentrateArrange?.());
        
        this.container.appendChild(group);
    }
    
    // 创建导入导出组
    createImportExportGroup() {
        const group = this.createButtonGroup('导入导出');
        
        this.addButton(group, 'export-image', '导出图片', '导出为图片', () => this.onExportImage?.());
        this.addButton(group, 'export-markdown', '导出Markdown', '导出为Markdown', () => this.onExportMarkdown?.());
        
        // 导入按钮（使用file input）
        const importButton = document.createElement('label');
        importButton.className = 'toolbar-button import-button';
        importButton.title = '导入项目文件';
        
        const importInput = document.createElement('input');
        importInput.type = 'file';
        importInput.accept = '.json';
        importInput.style.display = 'none';
        importInput.addEventListener('change', (e) => {
            if (e.target.files && e.target.files[0]) {
                this.onImport?.(e.target.files[0]);
                // 重置input以允许再次选择同一个文件
                e.target.value = '';
            }
        });
        
        importButton.appendChild(importInput);
        importButton.appendChild(document.createTextNode('导入'));
        
        group.appendChild(importButton);
        
        // 保存和加载按钮（如果需要本地保存）
        this.addButton(group, 'save', '保存', '保存到本地', () => this.onSave?.());
        this.addButton(group, 'load', '加载', '从本地加载', () => this.onLoad?.());
        
        this.container.appendChild(group);
    }
    
    // 创建历史操作组
    createHistoryGroup() {
        const group = this.createButtonGroup('历史操作');
        
        this.undoButton = this.addButton(group, 'undo', '撤销', '撤销上一步操作', () => this.onUndo?.());
        this.redoButton = this.addButton(group, 'redo', '重做', '重做上一步操作', () => this.onRedo?.());
        
        // 初始禁用状态
        this.updateHistoryButtons(false, false);
        
        this.container.appendChild(group);
    }
    
    // 创建按钮组容器
    createButtonGroup(title) {
        const group = document.createElement('div');
        group.className = 'toolbar-group';
        
        if (title) {
            const groupTitle = document.createElement('span');
            groupTitle.className = 'toolbar-group-title';
            groupTitle.textContent = title;
            group.appendChild(groupTitle);
        }
        
        return group;
    }
    
    // 添加按钮
    addButton(parent, id, text, title, onClick) {
        const button = document.createElement('button');
        button.id = `toolbar-${id}`;
        button.className = 'toolbar-button';
        button.textContent = text;
        button.title = title || text;
        
        // 根据可用性状态设置按钮的禁用状态
        const isAvailable = this.toolAvailability[id] !== false;
        button.disabled = !isAvailable;
        if (!isAvailable) {
            button.classList.add('disabled');
        }
        
        // 添加点击事件处理，但只有在可用时才执行回调
        button.addEventListener('click', (e) => {
            if (this.toolAvailability[id] !== false) {
                onClick(e);
            }
        });
        
        parent.appendChild(button);
        
        // 保存按钮引用
        this.buttons[id] = button;
        
        return button;
    }
    
    // 更新工具的可用性状态
    updateToolAvailability(toolId, isAvailable) {
        if (this.toolAvailability.hasOwnProperty(toolId)) {
            this.toolAvailability[toolId] = isAvailable;
            
            // 更新DOM按钮状态
            const button = this.buttons[toolId] || document.getElementById(`toolbar-${toolId}`);
            if (button) {
                button.disabled = !isAvailable;
                if (isAvailable) {
                    button.classList.remove('disabled');
                } else {
                    button.classList.add('disabled');
                }
            }
        }
    }
    
    // 更新自动排列按钮状态
    updateArrangeButtons(isRealTimeActive) {
        // 当实时排列激活时，禁用单次自动排列
        this.updateToolAvailability('auto-arrange', !isRealTimeActive);
        
        // 更新实时排列按钮的样式（运行时紫色）
        const realTimeButton = document.getElementById('real-time-arrange')||this.buttons['real-time-arrange'];
        if (realTimeButton) {
            if (isRealTimeActive) {
                realTimeButton.classList.add('active-green');
            } else {
                realTimeButton.classList.remove('active-green');
            }
        }
    }
    
    // 更新历史按钮状态
    updateHistoryButtons(canUndo, canRedo) {
        // 使用统一的工具可用性更新方法
        this.updateToolAvailability('undo', canUndo);
        this.updateToolAvailability('redo', canRedo);
    }
    
    // 设置回调函数
    setCallbacks(callbacks) {
        this.onNewNode = callbacks.onNewNode;
        this.onDeleteSelected = callbacks.onDeleteSelected;
        this.onUndo = callbacks.onUndo;
        this.onRedo = callbacks.onRedo;
        this.onZoomIn = callbacks.onZoomIn;
        this.onZoomOut = callbacks.onZoomOut;
        this.onResetView = callbacks.onResetView;
        this.onExportImage = callbacks.onExportImage;
        this.onExportMarkdown = callbacks.onExportMarkdown;
        this.onImport = callbacks.onImport;
        this.onSave = callbacks.onSave;
        this.onLoad = callbacks.onLoad;
        this.onAutoArrange = callbacks.onAutoArrange;
        this.onRealTimeArrange = callbacks.onRealTimeArrange;
        this.onConcentrateArrange = callbacks.onConcentrateArrange;
    }
    
    // 更新工具栏状态
    update(historyState, hasSelection) {
        // 更新历史按钮状态
        if (historyState) {
            this.updateHistoryButtons(historyState.canUndo, historyState.canRedo);
        }
        
        // 更新删除按钮状态
        this.updateToolAvailability('delete-selected', hasSelection);
    }
    
    // 显示消息提示
    showMessage(message, type = 'info') {
        // 移除之前的消息
        const oldMessage = this.container.querySelector('.toolbar-message');
        if (oldMessage) {
            oldMessage.remove();
        }
        
        // 创建新消息
        const messageEl = document.createElement('div');
        messageEl.className = `toolbar-message ${type}`;
        messageEl.textContent = message;
        
        // 添加到工具栏顶部
        this.container.insertBefore(messageEl, this.container.firstChild);
        
        // 一段时间后自动移除
        setTimeout(() => {
            const currentMessage = this.container.querySelector('.toolbar-message');
            if (currentMessage) {
                currentMessage.classList.add('fade-out');
                setTimeout(() => currentMessage.remove(), 300);
            }
        }, 3000);
    }
    
    // 显示成功消息
    showSuccess(message) {
        this.showMessage(message, 'success');
    }
    
    // 显示错误消息
    showError(message) {
        this.showMessage(message, 'error');
    }
    
    // 显示信息消息
    showInfo(message) {
        this.showMessage(message, 'info');
    }
}