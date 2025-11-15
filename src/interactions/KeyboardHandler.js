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
        
        // 验证配置已加载
        if (!this.shortcutManager.config) {
            console.error('KeyboardHandler: ShortcutManager config not loaded!');
        } else {
            console.log('KeyboardHandler: ShortcutManager initialized with', 
                       this.shortcutManager.keyBindings.size, 'key bindings');
        }
        
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
            editor.resetView();
        }, '重置视图');
        
        this.commandService.registerCommand('editor.fitToScreen', () => {
            this.handleFitToScreen();
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
            this.handleImport();
        }, '导入');
        
        this.commandService.registerCommand('editor.export', () => {
            this.handleExport();
        }, '导出');
        
        // 节点命令
        this.commandService.registerCommand('editor.createNode', () => {
            this.handleCreateNode();
        }, '创建新节点');
        
        this.commandService.registerCommand('editor.deleteSelectedNodes', () => {
            this.handleDeleteSelectedNodes();
        }, '删除选中节点');
        
        this.commandService.registerCommand('editor.duplicateNodes', () => {
            this.handleDuplicateNodes();
        }, '复制节点');
        
        // 连线命令
        this.commandService.registerCommand('editor.cancelConnectionCreation', () => {
            this.handleCancelConnectionCreation();
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
        // 使用捕获阶段（true），确保在浏览器默认行为之前处理
        document.addEventListener('keydown', (e) => this.handleKeyDown(e), true);
    }
    
    // 处理键盘按下事件
    handleKeyDown(event) {
        // 如果正在输入框中，只处理特定快捷键
        const activeElement = document.activeElement;
        const isInput = activeElement && 
            (activeElement.tagName === 'INPUT' || activeElement.tagName === 'TEXTAREA' || 
             activeElement.isContentEditable);
        
        // 使用ShortcutManager处理
        const handled = this.shortcutManager.handleKeyDown(event, isInput ? 'input' : null);
        
        if (handled) {
            // 如果快捷键被处理，阻止所有默认行为
            event.preventDefault();
            event.stopPropagation();
            return;
        }
        
        // 即使没有匹配的快捷键，也要检查是否需要阻止浏览器默认行为
        // 这可以防止某些浏览器快捷键在编辑器中触发
        if (!isInput) {
            // 在画布上，阻止常见的浏览器快捷键
            const key = event.key.toLowerCase();
            const hasModifier = event.ctrlKey || event.metaKey || event.altKey;
            
            // 阻止常见的浏览器快捷键（如果它们可能干扰编辑器）
            if (hasModifier) {
                // Ctrl/Cmd + 字母键
                if ((event.ctrlKey || event.metaKey) && /^[a-z]$/.test(key)) {
                    // 这些快捷键在编辑器中可能有用途，但如果没有匹配，不阻止
                    // 只阻止明确会干扰的快捷键
                    const browserShortcuts = ['w', 't', 'r', 'u']; // Ctrl+W关闭标签页等
                    if (browserShortcuts.includes(key)) {
                        event.preventDefault();
                    }
                }
                // F5刷新等
                if (key === 'f5') {
                    event.preventDefault();
                }
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
        const editorState = this.editorController.getViewModel().getEditorState();
        const nodeViewModel = this.editorController.getViewModel().getNodeViewModel();
        const connectionViewModel = this.editorController.getViewModel().getConnectionViewModel();
        
        // 收集选中的节点和连线
        const selectedNodes = [];
        const selectedConnections = [];
        
        // 复制选中的节点
        editorState.selectedNodeIds.forEach(nodeId => {
            const node = nodeViewModel.getNode(nodeId);
            if (node) {
                selectedNodes.push(deepClone(node));
            }
        });
        
        // 复制选中的连线（只复制两端节点都选中的连线）
        const selectedNodeIdsSet = new Set(editorState.selectedNodeIds);
        editorState.selectedConnectionIds.forEach(connectionId => {
            const connection = connectionViewModel.getConnection(connectionId);
            if (connection) {
                selectedConnections.push(deepClone(connection));
            }
        });
        
        // 同时复制选中节点之间的连线
        connectionViewModel.getAllConnections().forEach(connection => {
            if (selectedNodeIdsSet.has(connection.sourceNodeId) && 
                selectedNodeIdsSet.has(connection.targetNodeId) &&
                !selectedConnections.find(c => c.id === connection.id)) {
                selectedConnections.push(deepClone(connection));
            }
        });
        
        if (selectedNodes.length > 0 || selectedConnections.length > 0) {
            this.clipboardService.copy({
                nodes: selectedNodes,
                connections: selectedConnections,
                timestamp: Date.now()
            });
            console.log(`已复制 ${selectedNodes.length} 个节点和 ${selectedConnections.length} 条连线`);
        }
    }
    
    // 处理粘贴
    handlePaste() {
        if (!this.clipboardService.hasData()) {
            // 尝试从系统剪贴板读取
            this.clipboardService.readFromSystem().then(data => {
                if (data) {
                    this.pasteData(data);
                }
            });
            return;
        }
        
        const data = this.clipboardService.get();
        this.pasteData(data);
    }
    
    // 执行粘贴操作
    pasteData(data) {
        if (!data || !data.nodes || data.nodes.length === 0) {
            return;
        }
        
        const nodeViewModel = this.editorController.getViewModel().getNodeViewModel();
        const connectionViewModel = this.editorController.getViewModel().getConnectionViewModel();
        const editorState = this.editorController.getViewModel().getEditorState();
        
        // 计算偏移量（粘贴到鼠标位置）
        const offsetX = this.lastMousePosition.x;
        const offsetY = this.lastMousePosition.y;
        
        // 计算原始节点的最小边界
        let minX = Infinity, minY = Infinity;
        data.nodes.forEach(node => {
            const nodePos = (node.transform && node.transform.position) ? 
                node.transform.position : { x: 0, y: 0 };
            minX = Math.min(minX, nodePos.x);
            minY = Math.min(minY, nodePos.y);
        });
        
        // 计算偏移量（使第一个节点在鼠标位置）
        const deltaX = offsetX - minX;
        const deltaY = offsetY - minY;
        
        // 创建节点ID映射（旧ID -> 新ID）
        const nodeIdMap = new Map();
        const newNodes = [];
        
        // 粘贴节点
        data.nodes.forEach(nodeData => {
            const nodePos = (nodeData.transform && nodeData.transform.position) ? 
                nodeData.transform.position : { x: 0, y: 0 };
            const newNode = nodeViewModel.addNode(
                nodeData.name,
                nodePos.x + deltaX,
                nodePos.y + deltaY
            );
            
            // 复制其他属性
            if (nodeData.description !== undefined) newNode.description = nodeData.description;
            if (nodeData.width !== undefined) newNode.width = nodeData.width;
            if (nodeData.height !== undefined) newNode.height = nodeData.height;
            if (nodeData.autoSize !== undefined) newNode.autoSize = nodeData.autoSize;
            if (nodeData.color !== undefined) newNode.color = nodeData.color;
            
            nodeIdMap.set(nodeData.id, newNode.id);
            newNodes.push(newNode);
        });
        
        // 粘贴连线
        if (data.connections) {
            data.connections.forEach(connectionData => {
                const newSourceId = nodeIdMap.get(connectionData.sourceNodeId);
                const newTargetId = nodeIdMap.get(connectionData.targetNodeId);
                
                if (newSourceId && newTargetId) {
                    const newConnection = connectionViewModel.addConnection(
                        newSourceId,
                        newTargetId,
                        connectionData.fromSide || 'right',
                        connectionData.toSide || 'left'
                    );
                    
                    // 复制其他属性
                    if (newConnection && connectionData.conditions) {
                        newConnection.conditions = deepClone(connectionData.conditions);
                    }
                    if (newConnection && connectionData.color !== undefined) {
                        newConnection.color = connectionData.color;
                    }
                }
            });
        }
        
        // 选中新粘贴的节点
        editorState.clearSelection();
        newNodes.forEach(node => {
            nodeViewModel.selectNode(node.id, true);
        });
        
        this.editorController.getCanvasView().scheduleRender();
        console.log(`已粘贴 ${newNodes.length} 个节点`);
    }
    
    // 处理复制到鼠标位置
    handleDuplicate() {
        const editorState = this.editorController.getViewModel().getEditorState();
        const nodeViewModel = this.editorController.getViewModel().getNodeViewModel();
        const connectionViewModel = this.editorController.getViewModel().getConnectionViewModel();
        
        if (editorState.selectedNodeIds.size === 0) {
            return;
        }
        
        // 获取选中的节点
        const selectedNodes = [];
        editorState.selectedNodeIds.forEach(nodeId => {
            const node = nodeViewModel.getNode(nodeId);
            if (node) {
                selectedNodes.push(node);
            }
        });
        
        if (selectedNodes.length === 0) return;
        
        // 计算选中节点的边界框
        let minX = Infinity, minY = Infinity;
        selectedNodes.forEach(node => {
            const nodePos = (node.transform && node.transform.position) ? 
                node.transform.position : { x: 0, y: 0 };
            minX = Math.min(minX, nodePos.x);
            minY = Math.min(minY, nodePos.y);
        });
        
        // 计算偏移量（复制到鼠标位置）
        const offsetX = this.lastMousePosition.x - minX;
        const offsetY = this.lastMousePosition.y - minY;
        
        // 创建节点ID映射
        const nodeIdMap = new Map();
        const newNodes = [];
        
        // 复制节点
        selectedNodes.forEach(node => {
            const nodePos = (node.transform && node.transform.position) ? 
                node.transform.position : { x: 0, y: 0 };
            const newNode = nodeViewModel.addNode(
                node.name,
                nodePos.x + offsetX,
                nodePos.y + offsetY
            );
            
            // 复制属性
            newNode.description = node.description;
            newNode.width = node.width;
            newNode.height = node.height;
            newNode.autoSize = node.autoSize;
            newNode.color = node.color;
            
            nodeIdMap.set(node.id, newNode.id);
            newNodes.push(newNode);
        });
        
        // 复制选中节点之间的连线
        const selectedNodeIdsSet = new Set(editorState.selectedNodeIds);
        connectionViewModel.getAllConnections().forEach(connection => {
            if (selectedNodeIdsSet.has(connection.sourceNodeId) && 
                selectedNodeIdsSet.has(connection.targetNodeId)) {
                const newSourceId = nodeIdMap.get(connection.sourceNodeId);
                const newTargetId = nodeIdMap.get(connection.targetNodeId);
                
                if (newSourceId && newTargetId) {
                    const newConnection = connectionViewModel.addConnection(
                        newSourceId,
                        newTargetId,
                        connection.fromSide,
                        connection.toSide
                    );
                    
                    if (newConnection && connection.conditions) {
                        newConnection.conditions = deepClone(connection.conditions);
                    }
                }
            }
        });
        
        // 选中新复制的节点
        editorState.clearSelection();
        newNodes.forEach(node => {
            nodeViewModel.selectNode(node.id, true);
        });
        
        this.editorController.getCanvasView().scheduleRender();
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
    
    // 处理重置视图
    handleResetView() {
        const canvasViewModel = this.editorController.getViewModel().getCanvasViewModel();
        const nodeViewModel = this.editorController.getViewModel().getNodeViewModel();
        const connectionViewModel = this.editorController.getViewModel().getConnectionViewModel();
        const canvas = this.editorController.getCanvasView().getCanvas();
        
        const nodes = nodeViewModel.getAllNodes();
        const connections = connectionViewModel.getAllConnections();
        
        // 居中显示所有元素
        canvasViewModel.centerView(nodes, connections, canvas.width, canvas.height);
        this.editorController.getCanvasView().scheduleRender();
    }
    
    // 处理适应屏幕
    handleFitToScreen() {
        // 和重置视图功能相同
        this.handleResetView();
    }
    
    // 处理导入
    async handleImport() {
        try {
            const ImportService = (await import('../io/ImportService.js')).default;
            const importService = new ImportService();
            
            const input = document.createElement('input');
            input.type = 'file';
            input.accept = '.json,.md,.yaml,.yml';
            input.onchange = async (e) => {
                const file = e.target.files[0];
                if (file) {
                    try {
                        const projectData = await importService.importFromFile(file);
                        
                        if (projectData) {
                            const viewModel = this.editorController.getViewModel();
                            
                            // 转换数据格式以匹配ViewModel的loadFromData格式
                            const data = {
                                nodes: projectData.nodes || [],
                                connections: projectData.connections || []
                            };
                            
                            viewModel.loadFromData(data);
                            this.editorController.getCanvasView().scheduleRender();
                            console.log('导入成功');
                        }
                    } catch (error) {
                        console.error('导入失败:', error);
                        alert('导入失败: ' + error.message);
                    }
                }
            };
            input.click();
        } catch (error) {
            console.error('导入功能加载失败:', error);
            alert('导入功能暂不可用');
        }
    }
    
    // 处理导出
    async handleExport() {
        try {
            const ExportService = (await import('../io/ExportService.js')).default;
            const viewModel = this.editorController.getViewModel();
            const data = viewModel.exportData();
            
            // 导出为JSON
            const json = JSON.stringify(data, null, 2);
            const blob = new Blob([json], { type: 'application/json' });
            const url = URL.createObjectURL(blob);
            const a = document.createElement('a');
            a.href = url;
            a.download = `project_${Date.now()}.json`;
            document.body.appendChild(a);
            a.click();
            document.body.removeChild(a);
            URL.revokeObjectURL(url);
            
            console.log('导出成功');
        } catch (error) {
            console.error('导出失败:', error);
            alert('导出失败: ' + error.message);
        }
    }
    
    // 处理创建节点
    handleCreateNode() {
        const nodeViewModel = this.editorController.getViewModel().getNodeViewModel();
        const editorState = this.editorController.getViewModel().getEditorState();
        
        // 在鼠标位置创建新节点
        const newNode = nodeViewModel.addNode('新节点', this.lastMousePosition.x, this.lastMousePosition.y);
        
        // 选中新创建的节点
        editorState.clearSelection();
        nodeViewModel.selectNode(newNode.id, false);
        
        this.editorController.getCanvasView().scheduleRender();
    }
    
    // 处理删除选中节点
    handleDeleteSelectedNodes() {
        // 和deleteSelected功能相同，但只删除节点
        const editorState = this.editorController.getViewModel().getEditorState();
        const nodeViewModel = this.editorController.getViewModel().getNodeViewModel();
        
        if (editorState.selectedNodeIds.size > 0) {
            nodeViewModel.deleteSelectedNodes();
            this.editorController.getCanvasView().scheduleRender();
        }
    }
    
    // 处理复制节点
    handleDuplicateNodes() {
        // 和duplicateSelected功能相同
        this.handleDuplicate();
    }
    
    // 处理取消连线创建
    handleCancelConnectionCreation() {
        const editorState = this.editorController.getViewModel().getEditorState();
        const mouseHandler = this.editorController.mouseHandler;
        
        // 取消连线创建状态
        if (mouseHandler && mouseHandler.creatingConnection) {
            mouseHandler.creatingConnection = null;
        }
        
        editorState.isCreatingConnection = false;
        editorState.connectionStartNodeId = null;
        
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

