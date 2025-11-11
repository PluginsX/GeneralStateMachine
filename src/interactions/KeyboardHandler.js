// 键盘事件处理器 - 使用新的快捷键配置系统
import ShortcutManager from '../services/ShortcutManager.js';
import CommandService from '../services/CommandService.js';

export default class KeyboardHandler {
    constructor(editorController) {
        this.editorController = editorController;
        this.commandService = new CommandService();
        this.shortcutManager = new ShortcutManager(this.commandService);
        
        // 注册所有命令
        this.registerCommands();
        
        // 加载配置
        this.init();
    }
    
    // 初始化
    async init() {
        // 等待默认配置加载完成
        await this.shortcutManager.loadDefaultConfig();
        
        // 尝试加载自定义配置
        await this.shortcutManager.loadCustomConfig();
        
        // 初始化事件监听
        this.initEventListeners();
    }
    
    // 注册所有命令
    registerCommands() {
        const editor = this.editorController;
        
        // 编辑命令
        this.commandService.registerCommand('editor.deleteSelected', () => {
            this.handleDelete();
        }, '删除选中对象');
        
        this.commandService.registerCommand('editor.copySelected', () => {
            this.handleCopy();
        }, '复制选中对象');
        
        this.commandService.registerCommand('editor.paste', () => {
            this.handlePaste();
        }, '粘贴对象');
        
        this.commandService.registerCommand('editor.duplicateSelected', () => {
            this.handleDuplicate();
        }, '复制选中对象到鼠标位置');
        
        this.commandService.registerCommand('editor.selectAll', () => {
            this.handleSelectAll();
        }, '全选');
        
        this.commandService.registerCommand('editor.deselectAll', () => {
            this.handleDeselectAll();
        }, '取消选择');
        
        // 历史命令
        this.commandService.registerCommand('editor.undo', () => {
            editor.undo();
        }, '撤销');
        
        this.commandService.registerCommand('editor.redo', () => {
            editor.redo();
        }, '重做');
        
        // 视图命令
        this.commandService.registerCommand('editor.zoomIn', () => {
            editor.zoomIn();
        }, '放大');
        
        this.commandService.registerCommand('editor.zoomOut', () => {
            editor.zoomOut();
        }, '缩小');
        
        this.commandService.registerCommand('editor.resetView', () => {
            // TODO: 实现重置视图
            console.log('重置视图');
        }, '重置视图');
        
        this.commandService.registerCommand('editor.fitToScreen', () => {
            // TODO: 实现适应屏幕
            console.log('适应屏幕');
        }, '适应屏幕');
        
        // 文件命令
        this.commandService.registerCommand('editor.newProject', () => {
            editor.newProject();
        }, '新建项目');
        
        this.commandService.registerCommand('editor.openProject', () => {
            editor.openProject();
        }, '打开项目');
        
        this.commandService.registerCommand('editor.saveProject', () => {
            editor.saveProject();
        }, '保存项目');
        
        this.commandService.registerCommand('editor.import', () => {
            // TODO: 实现导入
            console.log('导入');
        }, '导入');
        
        this.commandService.registerCommand('editor.export', () => {
            // TODO: 实现导出
            console.log('导出');
        }, '导出');
        
        // 节点命令
        this.commandService.registerCommand('editor.createNode', () => {
            // TODO: 实现在鼠标位置创建节点
            console.log('创建节点');
        }, '创建新节点');
        
        this.commandService.registerCommand('editor.deleteSelectedNodes', () => {
            // TODO: 实现删除选中节点
            console.log('删除选中节点');
        }, '删除选中节点');
        
        this.commandService.registerCommand('editor.duplicateNodes', () => {
            // TODO: 实现复制节点
            console.log('复制节点');
        }, '复制节点');
        
        // 连线命令
        this.commandService.registerCommand('editor.cancelConnectionCreation', () => {
            // TODO: 实现取消连线创建
            console.log('取消连线创建');
        }, '取消连线创建');
        
        // 布局命令
        this.commandService.registerCommand('editor.arrangeNodes', () => {
            editor.arrangeNodes();
        }, '自动排列节点');
        
        this.commandService.registerCommand('editor.toggleRealTimeArrange', () => {
            editor.toggleRealTimeArrange();
        }, '实时自动排列');
    }
    
    // 初始化事件监听器
    initEventListeners() {
        document.addEventListener('keydown', (e) => this.handleKeyDown(e));
    }
    
    // 处理键盘按下事件
    handleKeyDown(event) {
        // 使用ShortcutManager处理
        const handled = this.shortcutManager.handleKeyDown(event);
        
        if (handled) {
            // 某些快捷键需要阻止默认行为
            const key = event.key.toLowerCase();
            if (['s', 'o', 'i', 'e', 'n'].includes(key) && (event.ctrlKey || event.metaKey)) {
                event.preventDefault();
            }
        }
    }
    
    // 处理删除
    handleDelete() {
        const editorState = this.editorController.getViewModel().getEditorState();
        const nodeViewModel = this.editorController.getViewModel().getNodeViewModel();
        const connectionViewModel = this.editorController.getViewModel().getConnectionViewModel();
        
        // 删除选中的节点
        if (editorState.selectedNodeIds.size > 0) {
            nodeViewModel.deleteSelectedNodes();
        }
        
        // 删除选中的连线
        if (editorState.selectedConnectionIds.size > 0) {
            connectionViewModel.deleteSelectedConnections();
        }
        
        this.editorController.getCanvasView().scheduleRender();
    }
    
    // 处理复制
    handleCopy() {
        // TODO: 实现复制功能
        console.log('复制');
    }
    
    // 处理粘贴
    handlePaste() {
        // TODO: 实现粘贴功能
        console.log('粘贴');
    }
    
    // 处理复制到鼠标位置
    handleDuplicate() {
        // TODO: 实现复制到鼠标位置
        console.log('复制到鼠标位置');
    }
    
    // 处理全选
    handleSelectAll() {
        const nodeViewModel = this.editorController.getViewModel().getNodeViewModel();
        const allNodes = nodeViewModel.getAllNodes();
        
        const editorState = this.editorController.getViewModel().getEditorState();
        editorState.clearSelection();
        
        allNodes.forEach(node => {
            nodeViewModel.selectNode(node.id, true);
        });
        
        this.editorController.getCanvasView().scheduleRender();
    }
    
    // 处理取消选择
    handleDeselectAll() {
        const editorState = this.editorController.getViewModel().getEditorState();
        editorState.clearSelection();
        this.editorController.getCanvasView().scheduleRender();
    }
    
    // 设置上下文
    setContext(context) {
        this.shortcutManager.setContext(context);
    }
    
    // 获取快捷键管理器
    getShortcutManager() {
        return this.shortcutManager;
    }
    
    // 获取命令服务
    getCommandService() {
        return this.commandService;
    }
    
    // 加载自定义配置
    async loadCustomConfig(path) {
        await this.shortcutManager.loadCustomConfig(path);
    }
    
    // 从JSON加载配置
    loadConfigFromJSON(json) {
        this.shortcutManager.loadConfigFromJSON(json);
    }
    
    // 导出配置
    exportConfig() {
        return this.shortcutManager.exportConfig();
    }
}

