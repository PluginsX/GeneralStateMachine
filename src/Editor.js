// 编辑器入口文件 - 整合所有模块，对外提供API
// 导入各层模块

// 数据模型层
import Node from './core/model/Node.js';
import Connection from './core/model/Connection.js';
import EditorState from './core/model/EditorState.js';

// 视图模型层
import NodeManager from './core/view-model/NodeManager.js';
import ConnectionManager from './core/view-model/ConnectionManager.js';
import ViewManager from './core/view-model/ViewManager.js';
import HistoryManager from './core/view-model/HistoryManager.js';

// 视图层
import CanvasRenderer from './view/CanvasRenderer.js';
import PropertyPanel from './view/PropertyPanel.js';
import UIToolbar from './view/UIToolbar.js';
import Tooltip from './view/Tooltip.js';

// 交互层
import MouseHandler from './interaction/MouseHandler.js';
import KeyboardHandler from './interaction/KeyboardHandler.js';
import DragDropHandler from './interaction/DragDropHandler.js';

export default class Editor {
    constructor(config) {
        // 配置项
        this.config = {
            canvasId: 'canvas',
            propertyPanelId: 'property-panel',
            toolbarId: 'toolbar',
            ...config
        };
        
        // 初始化各层实例
        this.initModel();
        this.initViewModel();
        this.initView();
        this.initInteraction();
        
        // 设置模块间通信
        this.setupCommunication();
        
        // 初始化编辑器
        this.initialize();
    }
    
    // 初始化数据模型层
    initModel() {
        this.editorState = new EditorState();
    }
    
    // 初始化视图模型层
    initViewModel() {
        this.nodeManager = new NodeManager(this.editorState);
        this.connectionManager = new ConnectionManager(this.editorState);
        this.viewManager = new ViewManager(this.editorState);
        this.historyManager = new HistoryManager(
            this.nodeManager,
            this.connectionManager,
            this.viewManager
        );
    }
    
    // 初始化视图层
    initView() {
        this.canvas = document.getElementById(this.config.canvasId);
        if (!this.canvas) {
            throw new Error(`Canvas element with id "${this.config.canvasId}" not found`);
        }
        
        this.canvasRenderer = new CanvasRenderer(this.canvas);
        this.propertyPanel = new PropertyPanel(this.config.propertyPanelId);
        this.toolbar = new UIToolbar(this.config.toolbarId);
        this.tooltip = new Tooltip();
    }
    
    // 初始化交互层
    initInteraction() {
        this.mouseHandler = new MouseHandler(this.canvas);
        this.keyboardHandler = new KeyboardHandler();
        this.dragDropHandler = new DragDropHandler(this.canvas);
    }
    
    // 设置模块间通信
    setupCommunication() {
        // 视图模型层 -> 视图层
        this.nodeManager.onNodesChanged = () => this.render();
        this.connectionManager.onConnectionsChanged = () => this.render();
        this.viewManager.onViewStateChanged = () => this.render();
        
        // 交互层 -> 视图模型层
        this.setupInteractionCallbacks();
        
        // 视图层 -> 视图模型层
        this.setupViewCallbacks();
    }
    
    // 设置交互层回调
    setupInteractionCallbacks() {
        // 鼠标处理器回调
        this.mouseHandler.setCallbacks({
            // 节点操作
            onNodeClick: (node) => this.handleNodeClick(node),
            onNodeDrag: (node, dx, dy) => this.handleNodeDrag(node, dx, dy),
            
            // 连线操作
            onConnectionCreate: (source, target) => this.handleConnectionCreate(source, target),
            
            // 画布操作
            onCanvasClick: (x, y) => this.handleCanvasClick(x, y),
            onCanvasDrag: (dx, dy) => this.handleCanvasDrag(dx, dy),
            
            // 选择操作
            onSelectionChange: (selection) => this.handleSelectionChange(selection),
            
            // 上下文菜单
            onContextMenu: (x, y, node, connection) => this.handleContextMenu(x, y, node, connection),
            
            // 辅助方法
            findNodeAtPosition: (x, y) => this.findNodeAtPosition(x, y),
            findConnectionAtPosition: (x, y) => this.findConnectionAtPosition(x, y),
            getAllNodes: () => this.nodeManager.getNodes()
        });
        
        // 键盘处理器回调
        this.keyboardHandler.setCallbacks({
            onDelete: () => this.handleDelete(),
            onCopy: () => this.handleCopy(),
            onPaste: () => this.handlePaste(),
            onUndo: () => this.handleUndo(),
            onRedo: () => this.handleRedo(),
            onSelectAll: () => this.handleSelectAll(),
            onNewNode: () => this.handleNewNode(),
            onExport: () => this.handleExport(),
            onImport: () => this.handleImport(),
            onSave: () => this.handleSave(),
            onLoad: () => this.handleLoad(),
            onZoomIn: () => this.handleZoomIn(),
            onZoomOut: () => this.handleZoomOut(),
            onResetView: () => this.handleResetView()
        });
        
        // 拖放处理器回调
        this.dragDropHandler.setCallbacks({
            onNodeDrop: (x, y, data) => this.handleNodeDrop(x, y, data),
            onConnectionDrop: (x, y, data) => this.handleConnectionDrop(x, y, data)
        });
    }
    
    // 设置视图层回调
    setupViewCallbacks() {
        // 属性面板回调
        this.propertyPanel.setCallbacks({
            onNodeUpdate: (node, updates) => this.handleNodeUpdate(node, updates),
            onConnectionUpdate: (connection, updates) => this.handleConnectionUpdate(connection, updates)
        });
        
        // 工具栏回调
        this.toolbar.setCallbacks({
            onNewNode: () => this.handleNewNode(),
            onDeleteSelected: () => this.handleDelete(),
            onUndo: () => this.handleUndo(),
            onRedo: () => this.handleRedo(),
            onZoomIn: () => this.handleZoomIn(),
            onZoomOut: () => this.handleZoomOut(),
            onResetView: () => this.handleResetView(),
            onExportImage: () => this.handleExportImage(),
            onExportMarkdown: () => this.handleExportMarkdown(),
            onImport: (file) => this.handleImportFile(file),
            onSave: () => this.handleSave(),
            onLoad: () => this.handleLoad(),
            onAutoArrange: () => this.handleAutoArrange()
        });
    }
    
    // 初始化编辑器
    initialize() {
        // 初始化画布尺寸
        this.resizeCanvas();
        window.addEventListener('resize', () => this.resizeCanvas());
        
        // 首次渲染
        this.render();
        
        // 初始化历史记录
        this.historyManager.init();
        
        // 更新工具栏状态
        this.updateUIState();
    }
    
    // 渲染编辑器
    render() {
        // 获取当前状态
        const nodes = this.nodeManager.getNodes();
        const connections = this.connectionManager.getConnections();
        const viewState = this.editorState.getViewState();
        const selection = {
            nodes: this.mouseHandler.getSelectedNodes(),
            connections: this.mouseHandler.getSelectedConnections()
        };
        
        // 渲染画布
        this.canvasRenderer.render({
            nodes,
            connections,
            viewState,
            selection,
            selectionRect: this.mouseHandler.getSelectionRect()
        });
    }
    
    // 调整画布尺寸
    resizeCanvas() {
        const container = this.canvas.parentElement;
        if (container) {
            this.canvas.width = container.clientWidth;
            this.canvas.height = container.clientHeight;
        }
        this.render();
    }
    
    // 交互处理方法
    handleNodeClick(node) {
        // 更新属性面板
        this.propertyPanel.setNode(node);
    }
    
    handleNodeDrag(node, dx, dy) {
        // 移动节点时更新相关连线
        this.connectionManager.updateNodeConnections(node);
        this.render();
    }
    
    handleConnectionCreate(source, target) {
        // 创建新连线
        const connection = this.connectionManager.createConnection(source, target);
        if (connection) {
            this.historyManager.addHistoryItem({
                type: 'ADD_CONNECTION',
                data: { connection: connection.clone() }
            });
        }
    }
    
    handleCanvasClick(x, y) {
        // 清空属性面板
        this.propertyPanel.clear();
    }
    
    handleCanvasDrag(dx, dy) {
        // 平移视图
        this.viewManager.pan(dx, dy);
    }
    
    handleSelectionChange(selection) {
        // 更新属性面板显示选中的元素
        if (selection.nodes.length === 1) {
            this.propertyPanel.setNode(selection.nodes[0]);
        } else if (selection.connections.length === 1) {
            this.propertyPanel.setConnection(selection.connections[0]);
        } else if (selection.nodes.length > 1 || selection.connections.length > 1) {
            this.propertyPanel.setMultiSelection(selection);
        } else {
            this.propertyPanel.clear();
        }
        
        // 更新工具栏状态
        this.updateUIState();
    }
    
    handleContextMenu(x, y, node, connection) {
        // 可以在这里实现右键菜单逻辑
        console.log('Context menu at:', x, y, 'Node:', node, 'Connection:', connection);
    }
    
    handleDelete() {
        const selectedNodes = this.mouseHandler.getSelectedNodes();
        const selectedConnections = this.mouseHandler.getSelectedConnections();
        
        if (selectedNodes.length > 0 || selectedConnections.length > 0) {
            // 记录删除操作到历史
            this.historyManager.addHistoryItem({
                type: 'DELETE_SELECTION',
                data: {
                    nodes: selectedNodes.map(n => n.clone()),
                    connections: selectedConnections.map(c => c.clone())
                }
            });
            
            // 删除选中的节点和连线
            selectedNodes.forEach(node => this.nodeManager.removeNode(node));
            selectedConnections.forEach(connection => this.connectionManager.removeConnection(connection));
            
            // 清空选择
            this.mouseHandler.clearSelection();
            
            // 清空属性面板
            this.propertyPanel.clear();
        }
    }
    
    handleCopy() {
        // 实现复制功能
        const selectedNodes = this.mouseHandler.getSelectedNodes();
        if (selectedNodes.length > 0) {
            this.clipboard = selectedNodes.map(node => node.clone());
            this.toolbar.showInfo('已复制 ' + selectedNodes.length + ' 个节点');
        }
    }
    
    handlePaste() {
        // 实现粘贴功能
        if (this.clipboard && this.clipboard.length > 0) {
            const pastedNodes = [];
            
            // 计算偏移量
            const offsetX = 20;
            const offsetY = 20;
            
            // 复制节点并添加到编辑器
            for (const node of this.clipboard) {
                const newNode = node.clone();
                newNode.x += offsetX;
                newNode.y += offsetY;
                this.nodeManager.addNode(newNode);
                pastedNodes.push(newNode);
            }
            
            // 选中粘贴的节点
            this.mouseHandler.clearSelection();
            pastedNodes.forEach(node => this.mouseHandler.selectedNodes.add(node));
            this.mouseHandler.notifySelectionChange();
            
            // 记录到历史
            this.historyManager.addHistoryItem({
                type: 'PASTE_NODES',
                data: { nodes: pastedNodes.map(n => n.clone()) }
            });
            
            this.toolbar.showInfo('已粘贴 ' + pastedNodes.length + ' 个节点');
        }
    }
    
    handleUndo() {
        if (this.historyManager.canUndo()) {
            this.historyManager.undo();
            this.updateUIState();
        }
    }
    
    handleRedo() {
        if (this.historyManager.canRedo()) {
            this.historyManager.redo();
            this.updateUIState();
        }
    }
    
    handleSelectAll() {
        const nodes = this.nodeManager.getNodes();
        this.mouseHandler.clearSelection();
        nodes.forEach(node => this.mouseHandler.selectedNodes.add(node));
        this.mouseHandler.notifySelectionChange();
    }
    
    handleNewNode() {
        // 创建新节点
        const newNode = this.nodeManager.createNode({
            name: '新节点',
            description: '',
            x: 100,
            y: 100
        });
        
        // 选中新节点
        this.mouseHandler.clearSelection();
        this.mouseHandler.selectedNodes.add(newNode);
        this.mouseHandler.notifySelectionChange();
        
        // 记录到历史
        this.historyManager.addHistoryItem({
            type: 'ADD_NODE',
            data: { node: newNode.clone() }
        });
    }
    
    handleExport() {
        // 实现导出功能
        this.handleExportImage();
    }
    
    handleExportImage() {
        // 导出为图片
        const dataURL = this.canvas.toDataURL('image/png');
        const link = document.createElement('a');
        link.download = 'state-machine-' + new Date().toISOString().slice(0, 10) + '.png';
        link.href = dataURL;
        link.click();
    }
    
    handleExportMarkdown() {
        // 导出为Markdown
        const nodes = this.nodeManager.getNodes();
        const connections = this.connectionManager.getConnections();
        
        let markdown = '# 状态机图\n\n';
        
        // 导出节点
        markdown += '## 节点\n\n';
        nodes.forEach(node => {
            markdown += `- **${node.name}**`;
            if (node.description) {
                markdown += `: ${node.description}`;
            }
            markdown += '\n';
        });
        
        // 导出连线
        markdown += '\n## 连线\n\n';
        connections.forEach(conn => {
            const source = nodes.find(n => n.id === conn.sourceId);
            const target = nodes.find(n => n.id === conn.targetId);
            
            if (source && target) {
                markdown += `- ${source.name} -> ${target.name}`;
                if (conn.condition) {
                    markdown += ` (${conn.condition})`;
                }
                markdown += '\n';
            }
        });
        
        // 下载文件
        const blob = new Blob([markdown], { type: 'text/markdown' });
        const url = URL.createObjectURL(blob);
        const link = document.createElement('a');
        link.download = 'state-machine-' + new Date().toISOString().slice(0, 10) + '.md';
        link.href = url;
        link.click();
        URL.revokeObjectURL(url);
    }
    
    handleImport() {
        // 触发文件选择对话框
        const input = document.createElement('input');
        input.type = 'file';
        input.accept = '.json';
        input.onchange = (e) => {
            if (e.target.files && e.target.files[0]) {
                this.handleImportFile(e.target.files[0]);
            }
        };
        input.click();
    }
    
    handleImportFile(file) {
        // 导入项目文件
        const reader = new FileReader();
        reader.onload = (e) => {
            try {
                const data = JSON.parse(e.target.result);
                this.loadProject(data);
                this.toolbar.showSuccess('项目导入成功');
            } catch (error) {
                console.error('Import error:', error);
                this.toolbar.showError('导入失败: ' + error.message);
            }
        };
        reader.readAsText(file);
    }
    
    handleSave() {
        // 保存项目
        const project = this.exportProject();
        const json = JSON.stringify(project, null, 2);
        const blob = new Blob([json], { type: 'application/json' });
        const url = URL.createObjectURL(blob);
        const link = document.createElement('a');
        link.download = 'state-machine-' + new Date().toISOString().slice(0, 10) + '.json';
        link.href = url;
        link.click();
        URL.revokeObjectURL(url);
        
        this.toolbar.showSuccess('项目已保存');
    }
    
    handleLoad() {
        // 加载项目
        this.handleImport();
    }
    
    handleZoomIn() {
        this.viewManager.zoomIn();
    }
    
    handleZoomOut() {
        this.viewManager.zoomOut();
    }
    
    handleResetView() {
        this.viewManager.resetView();
    }
    
    handleNodeDrop(x, y, data) {
        // 创建新节点
        const newNode = this.nodeManager.createNode({
            name: data.name || '新节点',
            description: data.description || '',
            x: x,
            y: y
        });
        
        // 选中新节点
        this.mouseHandler.clearSelection();
        this.mouseHandler.selectedNodes.add(newNode);
        this.mouseHandler.notifySelectionChange();
    }
    
    handleConnectionDrop(x, y, data) {
        // 可以在这里实现连线拖放逻辑
    }
    
    handleNodeUpdate(node, updates) {
        // 更新节点属性
        this.nodeManager.updateNode(node, updates);
        
        // 记录到历史
        this.historyManager.addHistoryItem({
            type: 'UPDATE_NODE',
            data: {
                nodeId: node.id,
                oldValues: { ...node },
                newValues: updates
            }
        });
    }
    
    handleConnectionUpdate(connection, updates) {
        // 更新连线属性
        this.connectionManager.updateConnection(connection, updates);
        
        // 记录到历史
        this.historyManager.addHistoryItem({
            type: 'UPDATE_CONNECTION',
            data: {
                connectionId: connection.id,
                oldValues: { ...connection },
                newValues: updates
            }
        });
    }
    
    // 辅助方法
    findNodeAtPosition(x, y) {
        const nodes = this.nodeManager.getNodes();
        const viewState = this.editorState.getViewState();
        
        // 转换屏幕坐标到世界坐标
        const worldX = (x - viewState.panX) / viewState.zoom;
        const worldY = (y - viewState.panY) / viewState.zoom;
        
        // 从后往前遍历，优先选择上层节点
        for (let i = nodes.length - 1; i >= 0; i--) {
            const node = nodes[i];
            // 简化的碰撞检测
            if (worldX >= node.x && worldX <= node.x + (node.width || 100) &&
                worldY >= node.y && worldY <= node.y + (node.height || 50)) {
                return node;
            }
        }
        
        return null;
    }
    
    findConnectionAtPosition(x, y) {
        const connections = this.connectionManager.getConnections();
        const nodes = this.nodeManager.getNodes();
        const viewState = this.editorState.getViewState();
        
        // 转换屏幕坐标到世界坐标
        const worldX = (x - viewState.panX) / viewState.zoom;
        const worldY = (y - viewState.panY) / viewState.zoom;
        
        // 查找最近的连线
        for (const connection of connections) {
            const sourceNode = nodes.find(n => n.id === connection.sourceId);
            const targetNode = nodes.find(n => n.id === connection.targetId);
            
            if (sourceNode && targetNode) {
                // 计算连线的起点和终点
                const startX = sourceNode.x + (sourceNode.width || 100);
                const startY = sourceNode.y + (sourceNode.height || 50) / 2;
                const endX = targetNode.x;
                const endY = targetNode.y + (targetNode.height || 50) / 2;
                
                // 计算点到线段的距离
                const distance = this.pointToLineDistance(worldX, worldY, startX, startY, endX, endY);
                
                // 如果距离小于阈值，认为点击了连线
                if (distance < 5 / viewState.zoom) {
                    return connection;
                }
            }
        }
        
        return null;
    }
    
    pointToLineDistance(px, py, x1, y1, x2, y2) {
        // 计算点到线段的距离
        const A = px - x1;
        const B = py - y1;
        const C = x2 - x1;
        const D = y2 - y1;
        
        const dot = A * C + B * D;
        const lenSq = C * C + D * D;
        let param = -1;
        
        if (lenSq !== 0) {
            param = dot / lenSq;
        }
        
        let xx, yy;
        
        if (param < 0) {
            xx = x1;
            yy = y1;
        } else if (param > 1) {
            xx = x2;
            yy = y2;
        } else {
            xx = x1 + param * C;
            yy = y1 + param * D;
        }
        
        const dx = px - xx;
        const dy = py - yy;
        
        return Math.sqrt(dx * dx + dy * dy);
    }
    
    // 更新UI状态
    updateUIState() {
        // 更新工具栏状态
        this.toolbar.update({
            canUndo: this.historyManager.canUndo(),
            canRedo: this.historyManager.canRedo()
        }, this.mouseHandler.getSelectedNodes().length > 0 || this.mouseHandler.getSelectedConnections().length > 0);
    }
    
    // 导出项目
    exportProject() {
        return {
            version: '1.0',
            nodes: this.nodeManager.getNodes().map(node => node.clone()),
            connections: this.connectionManager.getConnections().map(conn => conn.clone()),
            viewState: { ...this.editorState.getViewState() }
        };
    }
    
    // 加载项目
    loadProject(data) {
        // 清空当前内容
        this.nodeManager.clearNodes();
        this.connectionManager.clearConnections();
        this.mouseHandler.clearSelection();
        
        // 加载节点
        if (data.nodes) {
            data.nodes.forEach(nodeData => {
                const node = new Node(nodeData);
                this.nodeManager.addNode(node);
            });
        }
        
        // 加载连线
        if (data.connections) {
            data.connections.forEach(connData => {
                const connection = new Connection(connData);
                this.connectionManager.addConnection(connection);
            });
        }
        
        // 加载视图状态
        if (data.viewState) {
            this.editorState.setViewState(data.viewState);
        }
        
        // 重置历史记录
        this.historyManager.clear();
        
        // 更新UI状态
        this.updateUIState();
        this.propertyPanel.clear();
        
        // 重新渲染
        this.render();
    }
    
    // 获取编辑器状态
    getState() {
        return {
            nodes: this.nodeManager.getNodes(),
            connections: this.connectionManager.getConnections(),
            viewState: this.editorState.getViewState(),
            selection: {
                nodes: this.mouseHandler.getSelectedNodes(),
                connections: this.mouseHandler.getSelectedConnections()
            }
        };
    }
    
    // 处理自动排列
    handleAutoArrange() {
        const nodes = this.nodeManager.getNodes();
        if (nodes.length === 0) {
            this.toolbar.showInfo('没有节点需要排列');
            return;
        }
        
        // 记录历史
        this.historyManager.addHistory('arrange-nodes', {
            nodes: nodes.map(node => ({ ...node }))
        });
        
        // 执行树形排列
        this.arrangeNodesAsTree();
        
        this.toolbar.showSuccess('节点已自动排列');
    }
    
    // 树形排列算法
    arrangeNodesAsTree() {
        const nodes = this.nodeManager.getNodes();
        const connections = this.connectionManager.getConnections();
        
        // 构建节点映射和依赖关系
        const nodeMap = new Map();
        const nodeDependencies = new Map();
        const nodeDependents = new Map();
        
        nodes.forEach(node => {
            nodeMap.set(node.id, node);
            nodeDependencies.set(node.id, new Set()); // 依赖的节点（上游）
            nodeDependents.set(node.id, new Set()); // 被依赖的节点（下游）
        });
        
        connections.forEach(conn => {
            if (nodeMap.has(conn.sourceNodeId) && nodeMap.has(conn.targetNodeId)) {
                nodeDependencies.get(conn.targetNodeId).add(conn.sourceNodeId);
                nodeDependents.get(conn.sourceNodeId).add(conn.targetNodeId);
            }
        });
        
        // 找到根节点（没有入边的节点）
        const rootNodes = [];
        nodes.forEach(node => {
            if (nodeDependencies.get(node.id).size === 0) {
                rootNodes.push(node.id);
            }
        });
        
        // 如果没有根节点，选择一个入度最少的节点作为根
        if (rootNodes.length === 0 && nodes.length > 0) {
            let minInDegree = Infinity;
            let rootId = null;
            
            nodes.forEach(node => {
                const inDegree = nodeDependencies.get(node.id).size;
                if (inDegree < minInDegree) {
                    minInDegree = inDegree;
                    rootId = node.id;
                }
            });
            
            if (rootId) {
                rootNodes.push(rootId);
            }
        }
        
        // 如果仍然没有根节点，使用第一个节点
        if (rootNodes.length === 0 && nodes.length > 0) {
            rootNodes.push(nodes[0].id);
        }
        
        // 计算节点层级和位置
        const nodeLevels = new Map();
        const levelNodes = new Map();
        const maxLevel = this.calculateNodeLevels(rootNodes, nodeDependents, nodeLevels, levelNodes, 0);
        
        // 计算每层的节点数量和间距
        const horizontalSpacing = 200;
        const verticalSpacing = 150;
        const startX = 50;
        const startY = 100;
        
        // 排列每个层级的节点
        levelNodes.forEach((levelNodeList, level) => {
            const count = levelNodeList.length;
            const totalWidth = (count - 1) * horizontalSpacing;
            const firstX = startX + level * horizontalSpacing - totalWidth / 2;
            
            levelNodeList.forEach((nodeId, index) => {
                const node = nodeMap.get(nodeId);
                node.x = firstX + index * horizontalSpacing;
                node.y = startY + level * verticalSpacing;
            });
        });
        
        // 重置视图，让所有节点可见
        this.resetView();
        
        // 触发重新渲染
        this.render();
    }
    
    // 计算节点的层级
    calculateNodeLevels(nodeIds, nodeDependents, nodeLevels, levelNodes, currentLevel) {
        if (nodeIds.length === 0) return currentLevel - 1;
        
        let maxLevel = currentLevel;
        
        // 记录当前层级的节点
        if (!levelNodes.has(currentLevel)) {
            levelNodes.set(currentLevel, []);
        }
        
        nodeIds.forEach(nodeId => {
            // 如果节点已经被处理过，跳过
            if (nodeLevels.has(nodeId)) return;
            
            // 设置节点层级
            nodeLevels.set(nodeId, currentLevel);
            levelNodes.get(currentLevel).push(nodeId);
            
            // 处理子节点
            const children = Array.from(nodeDependents.get(nodeId) || []);
            const childLevel = this.calculateNodeLevels(children, nodeDependents, nodeLevels, levelNodes, currentLevel + 1);
            maxLevel = Math.max(maxLevel, childLevel);
        });
        
        return maxLevel;
    }
    
    // 销毁编辑器
    destroy() {
        // 移除事件监听器
        window.removeEventListener('resize', () => this.resizeCanvas());
        
        // 销毁各层实例
        this.mouseHandler.destroy();
        this.keyboardHandler.destroy();
        this.dragDropHandler.destroy();
        this.tooltip.destroy();
    }
}