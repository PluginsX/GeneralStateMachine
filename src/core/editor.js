import { HistoryManager } from '../history/history.js';
import { exportAsImage, exportMarkdown, saveProject } from '../io/export.js';
import { handleFileSelect } from '../io/import.js';
import { showConnectionProperties, updatePropertyPanel } from '../ui/panel.js';
import { isLightMode, toggleTheme } from '../ui/theme.js';
import { deepClone } from '../utils/common.js';
import { showContextMenu } from '../utils/dom.js';
import { doRectsOverlap, isPointInRect, isPointNearLine } from '../utils/math.js';
import Condition from './condition.js';
import Connection from './connection.js';
import Node from './node.js';

// 编辑器主类
export default class NodeGraphEditor {
    constructor(canvasId) {
        // 获取DOM元素
        this.canvas = document.getElementById(canvasId);
        this.ctx = this.canvas.getContext('2d');
        this.selectionRectangle = document.querySelector('.selection-rectangle');
        this.zoomLevelDisplay = document.getElementById('zoom-level');
        
        // 编辑器状态
        this.nodes = [];
        this.connections = [];
        this.selectedElements = []; // 支持多选
        this.draggingElement = null;
        this.draggingOffset = { x: 0, y: 0 };
        this.creatingConnection = null;
        this.selectionFilter = 'all'; // 选择筛选器：'all', 'nodes', 'connections'
        
        // 框选相关
        this.isSelecting = false;
        this.selectionStart = { x: 0, y: 0 };
        this.selectionCurrent = { x: 0, y: 0 };
        
        // 视图状态
        this.zoom = 1.0;
        this.pan = { x: 0, y: 0 };
        this.isPanning = false;
        this.panStart = { x: 0, y: 0 };
        this.lastMouseX = 0;
        this.lastMouseY = 0;
        
        // 历史记录
        this.historyManager = new HistoryManager(50);
        
        // 性能优化
        this.animationId = null;
        this.lastRenderTime = 0;
        this.renderDelay = 16; // ~60FPS
        
        // 初始化
        this.init();
    }
    
    // 初始化编辑器
    init() {
        this.setupCanvas();
        this.setupEventListeners();
        this.setupUIListeners();
        this.scheduleRender();
    }
    
    // 设置画布尺寸
    setupCanvas() {
        const resizeCanvas = () => {
            const container = this.canvas.parentElement;
            this.canvas.width = container.clientWidth;
            this.canvas.height = container.clientHeight;
            this.scheduleRender();
        };
        
        resizeCanvas();
        window.addEventListener('resize', resizeCanvas);
    }
    
    // 屏幕坐标转世界坐标
    screenToWorld(x, y) {
        return {
            x: (x - this.pan.x) / this.zoom,
            y: (y - this.pan.y) / this.zoom
        };
    }
    
    // 世界坐标转屏幕坐标
    worldToScreen(x, y) {
        return {
            x: x * this.zoom + this.pan.x,
            y: y * this.zoom + this.pan.y
        };
    }
    
    // 设置事件监听器
    setupEventListeners() {
        // 鼠标事件
        this.canvas.addEventListener('mousedown', e => this.handleMouseDown(e));
        this.canvas.addEventListener('mousemove', e => this.handleMouseMove(e));
        this.canvas.addEventListener('mouseup', e => this.handleMouseUp(e));
        this.canvas.addEventListener('wheel', e => this.handleWheel(e));
        
        // 拖放事件
        this.canvas.addEventListener('dragover', e => e.preventDefault());
        this.canvas.addEventListener('drop', e => this.handleDrop(e));

        // 鼠标离开事件
        this.canvas.addEventListener('mouseleave', e => this.handleMouseLeave(e));
    }
    
    // 设置UI元素监听器
    setupUIListeners() {
        // 菜单按钮
        document.getElementById('new-project').addEventListener('click', () => this.newProject());
        document.getElementById('import-md').addEventListener('click', () => 
            document.getElementById('file-input').click());
        document.getElementById('export-md').addEventListener('click', () => exportMarkdown(this));
        document.getElementById('export-image').addEventListener('click', () => exportAsImage(this));
        document.getElementById('save-project').addEventListener('click', () => saveProject(this));
        document.getElementById('undo').addEventListener('click', () => this.undo());
        document.getElementById('redo').addEventListener('click', () => this.redo());
        document.getElementById('toggle-theme').addEventListener('click', () => {
            toggleTheme();
            this.scheduleRender();
        });
        
        // 选择筛选器
        document.getElementById('selection-filter').addEventListener('change', e => {
            this.selectionFilter = e.target.value;
            this.filterSelectedElements();
            updatePropertyPanel(this);
            this.scheduleRender();
        });
        
        // 缩放控制
        document.getElementById('zoom-in').addEventListener('click', () => this.zoomIn());
        document.getElementById('zoom-out').addEventListener('click', () => this.zoomOut());
        
        // 属性面板
        document.getElementById('update-node').addEventListener('click', () => this.updateSelectedNode());
        document.getElementById('delete-node').addEventListener('click', () => this.deleteSelectedNodes());
        document.getElementById('add-condition').addEventListener('click', () => this.addCondition());
        document.getElementById('delete-connection').addEventListener('click', () => this.deleteSelectedConnections());
        
        // 自适应尺寸切换
        document.getElementById('node-autosize').addEventListener('change', e => {
            this.toggleAutoSize(e.target.checked);
        });
        
        // 文件输入
        document.getElementById('file-input').addEventListener('change', e => handleFileSelect(e, this));
        
        // 工具栏拖拽
        document.querySelectorAll('.tool-item').forEach(item => {
            item.addEventListener('dragstart', e => {
                e.dataTransfer.setData('text/plain', item.dataset.type);
            });
        });
    }
    
    // 过滤选中的元素
    filterSelectedElements() {
        this.selectedElements = this.selectedElements.filter(el => {
            if (this.selectionFilter === 'all') return true;
            if (this.selectionFilter === 'nodes' && el.type === 'node') return true;
            if (this.selectionFilter === 'connections' && el.type === 'connection') return true;
            return false;
        });
    }
    
    // 撤销操作
    undo() {
        const item = this.historyManager.undo();
        if (!item) return;
        
        switch (item.type) {
            case 'add-node':
                this.removeNode(item.data.id);
                break;
                
            case 'add-connection':
                this.removeConnection(item.data.id);
                break;
                
            case 'delete-nodes':
                this.nodes.push(...item.data.nodes);
                this.connections.push(...item.data.connections);
                break;
                
            case 'delete-connections':
                this.connections.push(...item.data);
                break;
                
            case 'modify-node':
                const nodeToRestore = this.nodes.find(n => n.id === item.data.id);
                if (nodeToRestore) {
                    Object.assign(nodeToRestore, item.data.oldValue);
                }
                break;
        }
        
        this.selectedElements = [];
        updatePropertyPanel(this);
        this.scheduleRender();
    }
    
    // 重做操作
    redo() {
        const item = this.historyManager.redo();
        if (!item) return;
        
        switch (item.type) {
            case 'add-node':
                this.nodes.push(item.data);
                break;
                
            case 'add-connection':
                this.connections.push(item.data);
                break;
                
            case 'delete-nodes':
                const nodeIds = item.data.nodes.map(n => n.id);
                this.nodes = this.nodes.filter(n => !nodeIds.includes(n.id));
                this.connections = this.connections.filter(conn => 
                    !nodeIds.includes(conn.sourceNodeId) && !nodeIds.includes(conn.targetNodeId)
                );
                break;
                
            case 'delete-connections':
                const connIds = item.data.map(c => c.id);
                this.connections = this.connections.filter(c => !connIds.includes(c.id));
                break;
                
            case 'modify-node':
                const nodeToModify = this.nodes.find(n => n.id === item.data.id);
                if (nodeToModify) {
                    Object.assign(nodeToModify, item.data.newValue);
                }
                break;
        }
        
        this.selectedElements = [];
        updatePropertyPanel(this);
        this.scheduleRender();
    }
    
    // 缩放控制
    zoomIn() {
        this.zoom = Math.min(this.zoom * 1.2, 5.0);
        this.updateZoomDisplay();
        this.scheduleRender();
    }
    
    zoomOut() {
        this.zoom = Math.max(this.zoom / 1.2, 0.1);
        this.updateZoomDisplay();
        this.scheduleRender();
    }
    
    updateZoomDisplay() {
        this.zoomLevelDisplay.textContent = `${Math.round(this.zoom * 100)}%`;
    }
    
    // 处理鼠标按下事件
    handleMouseDown(e) {
        const rect = this.canvas.getBoundingClientRect();
        const x = e.clientX - rect.left;
        const y = e.clientY - rect.top;
        this.lastMouseX = e.clientX;
        this.lastMouseY = e.clientY;
        const worldPos = this.screenToWorld(x, y);
        
        // 右键菜单处理
        if (e.button === 2) {
            this.handleRightClick(worldPos, x, y);
            return;
        }
        
        // 中键平移
        if (e.button === 1) {
            this.startPanning(x, y);
            return;
        }
        
        // 左键处理
        if (e.button === 0) {
            // 检查是否点击了节点
            const clickedNode = this.nodes.find(node => 
                isPointInRect(worldPos.x, worldPos.y, {
                    x: node.x,
                    y: node.y,
                    width: node.width,
                    height: node.height
                })
            );
            
            if (clickedNode) {
                this.handleNodeClick(clickedNode, worldPos, e);
                return;
            }
            
            // 检查是否点击了连线
            const clickedConnection = this.getConnectionAtPosition(worldPos);
            if (clickedConnection) {
                this.handleConnectionClick(clickedConnection, e);
                return;
            }
            
            // 如果没有点击任何元素，开始框选或平移
            if (e.ctrlKey || e.metaKey) {
                this.startSelection(x, y);
            } else {
                this.startPanning(x, y);
                this.deselectAll();
            }
        }
    }
    
    // 开始平移
    startPanning(x, y) {
        this.isPanning = true;
        this.panStart.x = x;
        this.panStart.y = y;
        this.canvas.style.cursor = 'grabbing';
    }
    
    // 开始框选
    startSelection(x, y) {
        this.isSelecting = true;
        this.selectionStart.x = x;
        this.selectionStart.y = y;
        this.selectionCurrent.x = x;
        this.selectionCurrent.y = y;
        
        // 显示选择框
        this.selectionRectangle.style.left = x + 'px';
        this.selectionRectangle.style.top = y + 'px';
        this.selectionRectangle.style.width = '0px';
        this.selectionRectangle.style.height = '0px';
        this.selectionRectangle.classList.remove('hidden');
        
        // 添加全局事件监听
        document.addEventListener('mousemove', this.handleGlobalMouseMove.bind(this));
        document.addEventListener('mouseup', this.handleGlobalMouseUp.bind(this));
    }
    
    // 处理节点点击
    handleNodeClick(node, worldPos, e) {
        // 处理连接创建
        if (this.creatingConnection) {
            this.finishConnectionCreation(node.id);
            return;
        }
        
        // 选择逻辑
        if (!e.ctrlKey && !e.metaKey) {
            this.deselectAll();
        }
        
        // 切换节点选择状态
        const index = this.selectedElements.findIndex(el => el.id === node.id);
        if (index === -1) {
            this.selectedElements.push(node);
        } else {
            this.selectedElements.splice(index, 1);
        }
        
        // 准备拖动
        this.draggingElement = node;
        this.draggingOffset.x = worldPos.x - node.x;
        this.draggingOffset.y = worldPos.y - node.y;
        
        updatePropertyPanel(this);
        this.scheduleRender();
    }
    
    // 处理连线点击
    handleConnectionClick(connection, e) {
        if (!e.ctrlKey && !e.metaKey) {
            this.deselectAll();
        }
        
        // 切换连线选择状态
        const index = this.selectedElements.findIndex(el => el.id === connection.id);
        if (index === -1) {
            this.selectedElements.push(connection);
        } else {
            this.selectedElements.splice(index, 1);
        }
        
        updatePropertyPanel(this);
        this.scheduleRender();
    }
    
    // 处理鼠标移动事件
    handleMouseMove(e) {
        const rect = this.canvas.getBoundingClientRect();
        const x = e.clientX - rect.left;
        const y = e.clientY - rect.top;
        this.lastMouseX = e.clientX;
        this.lastMouseY = e.clientY;
        const worldPos = this.screenToWorld(x, y);
        
        // 平移处理
        if (this.isPanning) {
            this.pan.x += x - this.panStart.x;
            this.pan.y += y - this.panStart.y;
            this.panStart.x = x;
            this.panStart.y = y;
            this.scheduleRender();
            return;
        }
        
        // 拖动节点处理
        if (this.draggingElement && this.draggingElement.type === 'node') {
            this.draggingElement.x = worldPos.x - this.draggingOffset.x;
            this.draggingElement.y = worldPos.y - this.draggingOffset.y;
            this.scheduleRender();
            return;
        }
        
        // 正在创建连线
        if (this.creatingConnection) {
            this.scheduleRender();
        }
    }
    
    // 处理全局鼠标移动（框选）
    handleGlobalMouseMove(e) {
        if (!this.isSelecting) return;
        
        const rect = this.canvas.getBoundingClientRect();
        const x = e.clientX - rect.left;
        const y = e.clientY - rect.top;
        
        // 更新选择框位置和大小
        const left = Math.min(x, this.selectionStart.x);
        const top = Math.min(y, this.selectionStart.y);
        const width = Math.abs(x - this.selectionStart.x);
        const height = Math.abs(y - this.selectionStart.y);
        
        this.selectionCurrent.x = x;
        this.selectionCurrent.y = y;
        this.selectionRectangle.style.left = left + 'px';
        this.selectionRectangle.style.top = top + 'px';
        this.selectionRectangle.style.width = width + 'px';
        this.selectionRectangle.style.height = height + 'px';
    }
    
    // 处理全局鼠标释放（框选结束）
    handleGlobalMouseUp(e) {
        if (!this.isSelecting) return;
        
        // 移除全局事件监听
        document.removeEventListener('mousemove', this.handleGlobalMouseMove.bind(this));
        document.removeEventListener('mouseup', this.handleGlobalMouseUp.bind(this));
        
        // 处理框选完成逻辑
        this.isSelecting = false;
        this.selectionRectangle.classList.add('hidden');
        
        const rect = this.canvas.getBoundingClientRect();
        const x = e.clientX - rect.left;
        const y = e.clientY - rect.top;
        
        // 计算选择框的世界坐标
        const start = this.screenToWorld(this.selectionStart.x, this.selectionStart.y);
        const end = this.screenToWorld(x, y);
        
        const selectionMinX = Math.min(start.x, end.x);
        const selectionMinY = Math.min(start.y, end.y);
        const selectionMaxX = Math.max(start.x, end.x);
        const selectionMaxY = Math.max(start.y, end.y);
        
        // 处理选择
        this.processSelection(selectionMinX, selectionMinY, selectionMaxX, selectionMaxY);
        
        this.draggingElement = null;
        this.isPanning = false;
        this.scheduleRender();
    }
    
    // 处理鼠标离开事件
    handleMouseLeave(e) {
        // 框选过程中鼠标离开画布时不结束框选
        if (this.isSelecting) return;
        
        // 结束拖动和平移
        this.draggingElement = null;
        this.isPanning = false;
        this.canvas.style.cursor = 'default';
    }
    
    // 处理滚轮事件（缩放）
    handleWheel(e) {
        e.preventDefault();
        
        const rect = this.canvas.getBoundingClientRect();
        const mouseX = e.clientX - rect.left;
        const mouseY = e.clientY - rect.top;
        
        // 缩放前的鼠标世界坐标
        const mouseWorldX = (mouseX - this.pan.x) / this.zoom;
        const mouseWorldY = (mouseY - this.pan.y) / this.zoom;
        
        // 应用缩放
        if (e.deltaY < 0) {
            this.zoom = Math.min(this.zoom * 1.1, 5.0);
        } else {
            this.zoom = Math.max(this.zoom / 1.1, 0.1);
        }
        
        // 调整平移，使鼠标指向的世界坐标保持不变
        this.pan.x = mouseX - mouseWorldX * this.zoom;
        this.pan.y = mouseY - mouseWorldY * this.zoom;
        
        this.updateZoomDisplay();
        this.scheduleRender();
    }
    
    // 处理拖放事件
    handleDrop(e) {
        e.preventDefault();
        const type = e.dataTransfer.getData('text/plain');
        const rect = this.canvas.getBoundingClientRect();
        const x = e.clientX - rect.left;
        const y = e.clientY - rect.top;
        const worldPos = this.screenToWorld(x, y);
        
        if (type === 'node') {
            this.addNode(new Node('新节点', worldPos.x, worldPos.y));
        } else if (type === 'connection') {
            // 开始创建连线
            const nodeUnderCursor = this.nodes.find(node => 
                isPointInRect(worldPos.x, worldPos.y, {
                    x: node.x,
                    y: node.y,
                    width: node.width,
                    height: node.height
                })
            );
            
            if (nodeUnderCursor) {
                this.startConnectionCreation(nodeUnderCursor.id);
            }
        }
    }
    
    // 开始创建连线
    startConnectionCreation(sourceNodeId) {
        this.creatingConnection = {
            sourceNodeId: sourceNodeId
        };
        this.scheduleRender();
    }
    
    // 完成连线创建
    finishConnectionCreation(targetNodeId) {
        if (this.creatingConnection && 
            this.creatingConnection.sourceNodeId !== targetNodeId) {
            
            const newConnection = new Connection(
                this.creatingConnection.sourceNodeId,
                targetNodeId
            );
            
            this.addConnection(newConnection);
        }
        
        this.creatingConnection = null;
        this.scheduleRender();
    }
    
    // 处理右键点击
    handleRightClick(worldPos, screenX, screenY) {
        // 检查是否点击了节点
        const clickedNode = this.nodes.find(node => 
            isPointInRect(worldPos.x, worldPos.y, {
                x: node.x,
                y: node.y,
                width: node.width,
                height: node.height
            })
        );
        
        // 检查是否点击了连线
        const clickedConnection = this.getConnectionAtPosition(worldPos);
        
        // 显示上下文菜单
        if (clickedNode || clickedConnection) {
            showContextMenu(screenX, screenY, clickedNode || clickedConnection, this);
        }
    }
    
    // 获取指定位置的连线
    getConnectionAtPosition(pos) {
        for (const connection of this.connections) {
            const sourceNode = this.nodes.find(n => n.id === connection.sourceNodeId);
            const targetNode = this.nodes.find(n => n.id === connection.targetNodeId);
            
            if (!sourceNode || !targetNode) continue;
            
            // 计算连线的起点和终点
            const startX = sourceNode.x + sourceNode.width / 2;
            const startY = sourceNode.y + sourceNode.height / 2;
            const endX = targetNode.x + targetNode.width / 2;
            const endY = targetNode.y + targetNode.height / 2;
            
            // 简单的连线点击检测
            if (isPointNearLine(pos.x, pos.y, startX, startY, endX, endY, 5 / this.zoom)) {
                return connection;
            }
        }
        return null;
    }
    
    // 处理框选
    processSelection(minX, minY, maxX, maxY) {
        const selectionRect = { x: minX, y: minY, width: maxX - minX, height: maxY - minY };
        
        // 根据筛选器类型选择元素
        if (this.selectionFilter === 'all' || this.selectionFilter === 'nodes') {
            this.nodes.forEach(node => {
                const nodeRect = {
                    x: node.x,
                    y: node.y,
                    width: node.width,
                    height: node.height
                };
                
                if (doRectsOverlap(selectionRect, nodeRect)) {
                    this.selectedElements.push(node);
                }
            });
        }
        
        if (this.selectionFilter === 'all' || this.selectionFilter === 'connections') {
            this.connections.forEach(connection => {
                const sourceNode = this.nodes.find(n => n.id === connection.sourceNodeId);
                const targetNode = this.nodes.find(n => n.id === connection.targetNodeId);
                
                if (sourceNode && targetNode) {
                    // 检查连线的两个端点是否在选择框内
                    const startInRect = isPointInRect(
                        sourceNode.x + sourceNode.width / 2,
                        sourceNode.y + sourceNode.height / 2,
                        selectionRect
                    );
                    
                    const endInRect = isPointInRect(
                        targetNode.x + targetNode.width / 2,
                        targetNode.y + targetNode.height / 2,
                        selectionRect
                    );
                    
                    if (startInRect && endInRect) {
                        this.selectedElements.push(connection);
                    }
                }
            });
        }
        
        // 去重
        this.selectedElements = [...new Map(
            this.selectedElements.map(item => [item.id, item])
        ).values()];
        
        updatePropertyPanel(this);
    }
    
    // 取消所有选择
    deselectAll() {
        this.selectedElements = [];
        updatePropertyPanel(this);
        this.scheduleRender();
    }
    
    // 添加节点
    addNode(node) {
        this.nodes.push(node);
        this.historyManager.addHistory('add-node', node.clone());
        this.selectedElements = [node];
        updatePropertyPanel(this);
        this.scheduleRender();
    }
    
    // 移除节点
    removeNode(nodeId) {
        // 找到要删除的节点
        const nodeIndex = this.nodes.findIndex(n => n.id === nodeId);
        if (nodeIndex === -1) return;
        
        const node = this.nodes[nodeIndex];
        
        // 找到相关的连线
        const connectedConnections = this.connections.filter(conn => 
            conn.sourceNodeId === nodeId || conn.targetNodeId === nodeId
        );
        
        // 移除节点和相关连线
        this.nodes.splice(nodeIndex, 1);
        connectedConnections.forEach(conn => {
            const connIndex = this.connections.findIndex(c => c.id === conn.id);
            if (connIndex !== -1) {
                this.connections.splice(connIndex, 1);
            }
        });
        
        // 更新选择
        this.selectedElements = this.selectedElements.filter(
            el => el.id !== nodeId && !connectedConnections.some(c => c.id === el.id)
        );
        
        updatePropertyPanel(this);
        this.scheduleRender();
    }
    
    // 添加连线
    addConnection(connection) {
        this.connections.push(connection);
        this.historyManager.addHistory('add-connection', connection.clone());
        this.selectedElements = [connection];
        updatePropertyPanel(this);
        this.scheduleRender();
    }
    
    // 移除连线
    removeConnection(connectionId) {
        const connIndex = this.connections.findIndex(c => c.id === connectionId);
        if (connIndex !== -1) {
            this.connections.splice(connIndex, 1);
            
            // 更新选择
            this.selectedElements = this.selectedElements.filter(el => el.id !== connectionId);
            
            updatePropertyPanel(this);
            this.scheduleRender();
        }
    }
    
    // 更新节点属性
    updateSelectedNode() {
        if (this.selectedElements.length !== 1 || this.selectedElements[0].type !== 'node') {
            return;
        }
        
        const node = this.selectedElements[0];
        const oldValue = node.clone();
        
        // 更新属性
        node.name = document.getElementById('node-name').value;
        node.description = document.getElementById('node-description').value;
        
        if (!node.autoSize) {
            node.width = parseInt(document.getElementById('node-width').value) || node.width;
            node.height = parseInt(document.getElementById('node-height').value) || node.height;
        }
        
        // 计算自适应尺寸
        node.calculateAutoSize(this.ctx);
        
        // 记录历史
        this.historyManager.addHistory('modify-node', {
            id: node.id,
            oldValue: oldValue,
            newValue: deepClone(node)
        });
        
        this.scheduleRender();
    }
    
    // 切换自适应尺寸
    toggleAutoSize(enabled) {
        if (this.selectedElements.length !== 1 || this.selectedElements[0].type !== 'node') {
            return;
        }
        
        const node = this.selectedElements[0];
        const oldValue = node.clone();
        
        node.autoSize = enabled;
        document.getElementById('node-width').disabled = enabled;
        document.getElementById('node-height').disabled = enabled;
        
        // 计算自适应尺寸
        node.calculateAutoSize(this.ctx);
        
        // 更新输入框
        document.getElementById('node-width').value = node.width;
        document.getElementById('node-height').value = node.height;
        
        // 记录历史
        this.historyManager.addHistory('modify-node', {
            id: node.id,
            oldValue: oldValue,
            newValue: deepClone(node)
        });
        
        this.scheduleRender();
    }
    
    // 删除选中的节点
    deleteSelectedNodes() {
        const nodesToDelete = this.selectedElements.filter(el => el.type === 'node');
        if (nodesToDelete.length === 0) return;
        
        // 找到相关的连线
        const nodeIds = nodesToDelete.map(n => n.id);
        const connectionsToDelete = this.connections.filter(conn => 
            nodeIds.includes(conn.sourceNodeId) || nodeIds.includes(conn.targetNodeId)
        );
        
        // 记录历史
        this.historyManager.addHistory('delete-nodes', {
            nodes: nodesToDelete.map(n => n.clone()),
            connections: connectionsToDelete.map(c => c.clone())
        });
        
        // 删除节点
        nodesToDelete.forEach(node => this.removeNode(node.id));
        
        this.deselectAll();
    }
    
    // 添加条件
    addCondition() {
        if (this.selectedElements.length !== 1 || this.selectedElements[0].type !== 'connection') {
            return;
        }
        
        const connection = this.selectedElements[0];
        connection.conditions.push(new Condition());
        showConnectionProperties(connection, this);
    }
    
    // 更新条件
    updateCondition(index, property, value) {
        if (this.selectedElements.length !== 1 || this.selectedElements[0].type !== 'connection') {
            return;
        }
        
        const connection = this.selectedElements[0];
        if (index >= 0 && index < connection.conditions.length) {
            connection.conditions[index][property] = value;
        }
    }
    
    // 上移条件
    moveConditionUp(index) {
        if (index <= 0) return;
        this.swapConditions(index, index - 1);
    }
    
    // 下移条件
    moveConditionDown(index) {
        if (this.selectedElements.length !== 1 || this.selectedElements[0].type !== 'connection') {
            return;
        }
        
        const connection = this.selectedElements[0];
        if (index >= connection.conditions.length - 1) return;
        this.swapConditions(index, index + 1);
    }
    
    // 交换条件位置
    swapConditions(i, j) {
        if (this.selectedElements.length !== 1 || this.selectedElements[0].type !== 'connection') {
            return;
        }
        
        const connection = this.selectedElements[0];
        [connection.conditions[i], connection.conditions[j]] = 
        [connection.conditions[j], connection.conditions[i]];
        
        showConnectionProperties(connection, this);
    }
    
    // 删除条件
    deleteCondition(index) {
        if (this.selectedElements.length !== 1 || this.selectedElements[0].type !== 'connection') {
            return;
        }
        
        const connection = this.selectedElements[0];
        connection.conditions.splice(index, 1);
        showConnectionProperties(connection, this);
    }
    
    // 删除选中的连线
    deleteSelectedConnections() {
        const connectionsToDelete = this.selectedElements.filter(el => el.type === 'connection');
        if (connectionsToDelete.length === 0) return;
        
        // 记录历史
        this.historyManager.addHistory('delete-connections', connectionsToDelete.map(c => c.clone()));
        
        // 删除连线
        connectionsToDelete.forEach(conn => this.removeConnection(conn.id));
        
        this.deselectAll();
    }
    
    // 新建项目
    newProject() {
        if (confirm('确定要新建项目吗？当前项目的更改将会丢失。')) {
            this.nodes = [];
            this.connections = [];
            this.selectedElements = [];
            this.historyManager = new HistoryManager(50);
            updatePropertyPanel(this);
            this.scheduleRender();
        }
    }
    
    // 绘制网格
    drawGrid(ctx, width = this.canvas.width, height = this.canvas.height, 
             minX = 0, minY = 0, maxX = width, maxY = height) {
        
        ctx.save();
        
        const canvasWidth = this.canvas.width;
        const canvasHeight = this.canvas.height;

        // 以 world-space 网格为准，gridSize 为世界单位
        var gridSize = 20;

        // 计算可见世界坐标范围（多加一个格子缓冲，避免边缘空白）
        const visibleLeft = -this.pan.x/this.zoom - gridSize;
        const visibleTop = -this.pan.y/this.zoom - gridSize;
        const visibleRight = (canvasWidth - this.pan.x)/this.zoom + gridSize;
        const visibleBottom = (canvasHeight - this.pan.y)/this.zoom + gridSize;

        // 起止（以 gridSize 对齐）
        const startX = Math.floor(visibleLeft / gridSize) * gridSize;
        const endX = Math.ceil(visibleRight / gridSize) * gridSize;
        const startY = Math.floor(visibleTop / gridSize) * gridSize;
        const endY = Math.ceil(visibleBottom / gridSize) * gridSize;

        // 绘制主网格线
        ctx.strokeStyle = isLightMode() ? 'rgba(0, 0, 0, 0.05)' : 'rgba(255, 255, 255, 0.05)';
        ctx.lineWidth = 1;
        
        // 水平线
        ctx.beginPath();
        for (let y = startY; y <= endY; y += gridSize) {
            const screenY = this.worldToScreen(0, y).y;
            ctx.moveTo(0, screenY);
            ctx.lineTo(width, screenY);
        }
        // 垂直线
        for (let x = startX; x <= endX; x += gridSize) {
            const screenX = this.worldToScreen(x, 0).x;
            ctx.moveTo(screenX, 0);
            ctx.lineTo(screenX, height);
        }
        ctx.stroke();

        // 绘制较粗的网格线
        // ctx.strokeStyle = isLightMode() ? 'rgba(0, 0, 0, 0.1)' : 'rgba(255, 255, 255, 0.1)';
        // ctx.lineWidth = 1.5;
        // gridSize = 200;

        ctx.restore();
    }
    

    // 绘制节点
    drawNode(ctx, node) {
        const screenPos = this.worldToScreen(node.x, node.y);
        const width = node.width * this.zoom;
        const height = node.height * this.zoom;
        
        // 检查节点是否可见
        if (screenPos.x + width < 0 || screenPos.x > this.canvas.width ||
            screenPos.y + height < 0 || screenPos.y > this.canvas.height) {
            return;
        }
        
        ctx.save();
        
        // 节点是否被选中
        const isSelected = this.selectedElements.some(el => el.id === node.id);
        
        // 绘制节点背景
        ctx.fillStyle = isSelected 
            ? '#007acc' 
            : isLightMode() ? '#ffffff' : '#2d2d30';
        
        ctx.strokeStyle = isSelected 
            ? '#005a9e' 
            : isLightMode() ? '#cccccc' : '#4a4a4a';
        
        ctx.lineWidth = isSelected ? 2 : 1;
        
        ctx.beginPath();
        ctx.roundRect(screenPos.x, screenPos.y, width, height, 4);
        ctx.fill();
        ctx.stroke();
        
        // 绘制节点名称
        ctx.font = 'bold 14px Arial';
        ctx.fillStyle = isSelected ? '#ffffff' : isLightMode() ? '#333333' : '#e0e0e0';
        ctx.textAlign = 'center';
        ctx.textBaseline = 'middle';
        ctx.fillText(node.name, screenPos.x + width / 2, screenPos.y + height / 3);
        
        // 绘制节点描述
        if (node.description) {
            ctx.font = '10px Arial';
            ctx.fillStyle = isSelected ? 'rgba(255, 255, 255, 0.8)' : isLightMode() ? '#666666' : '#969696';
            
            // 截断长描述
            let displayText = node.description;
            if (displayText.length > 30) {
                displayText = displayText.substring(0, 30) + '...';
            }
            
            ctx.fillText(displayText, screenPos.x + width / 2, screenPos.y + height * 2 / 3);
        }
        
        ctx.restore();
    }
    
    // 绘制连线
    drawConnections(ctx) {
        this.connections.forEach(connection => {
            const sourceNode = this.nodes.find(n => n.id === connection.sourceNodeId);
            const targetNode = this.nodes.find(n => n.id === connection.targetNodeId);
            
            if (!sourceNode || !targetNode) return;
            
            // 计算连线的起点和终点
            const startX = sourceNode.x + sourceNode.width / 2;
            const startY = sourceNode.y + sourceNode.height / 2;
            const endX = targetNode.x + targetNode.width / 2;
            const endY = targetNode.y + targetNode.height / 2;
            
            // 转换为屏幕坐标
            const screenStart = this.worldToScreen(startX, startY);
            const screenEnd = this.worldToScreen(endX, endY);
            
            // 连线是否被选中
            const isSelected = this.selectedElements.some(el => el.id === connection.id);
            
            ctx.save();
            
            // 绘制连线
            ctx.strokeStyle = isSelected ? '#007acc' : isLightMode() ? '#666666' : '#969696';
            ctx.lineWidth = isSelected ? 2 : 1.5;
            ctx.setLineDash([]);
            
            ctx.beginPath();
            ctx.moveTo(screenStart.x, screenStart.y);
            
            // 计算控制点，使连线有一个弧度
            const controlX = (screenStart.x + screenEnd.x) / 2;
            ctx.quadraticCurveTo(controlX, screenStart.y, screenEnd.x, screenEnd.y);
            
            ctx.stroke();
            
            // 绘制箭头
            const arrowSize = 6;
            const angle = Math.atan2(screenEnd.y - screenStart.y, screenEnd.x - screenStart.x);
            
            ctx.fillStyle = ctx.strokeStyle;
            ctx.beginPath();
            ctx.moveTo(screenEnd.x, screenEnd.y);
            ctx.lineTo(
                screenEnd.x - arrowSize * Math.cos(angle - Math.PI / 6),
                screenEnd.y - arrowSize * Math.sin(angle - Math.PI / 6)
            );
            ctx.lineTo(
                screenEnd.x - arrowSize * Math.cos(angle + Math.PI / 6),
                screenEnd.y - arrowSize * Math.sin(angle + Math.PI / 6)
            );
            ctx.closePath();
            ctx.fill();
            
            // 如果有条件，在连线中间绘制一个标记
            if (connection.conditions.length > 0) {
                const midX = (screenStart.x + screenEnd.x) / 2;
                const midY = (screenStart.y + screenEnd.y) / 2 - 10;
                
                ctx.fillStyle = isLightMode() ? '#ffffff' : '#2d2d30';
                ctx.strokeStyle = ctx.strokeStyle;
                ctx.lineWidth = 1;
                
                ctx.beginPath();
                ctx.arc(midX, midY, 8, 0, Math.PI * 2);
                ctx.fill();
                ctx.stroke();
                
                ctx.font = '8px Arial';
                ctx.fillStyle = ctx.strokeStyle;
                ctx.textAlign = 'center';
                ctx.textBaseline = 'middle';
                ctx.fillText(connection.conditions.length, midX, midY);
            }
            
            ctx.restore();
        });
        
        // 绘制正在创建的连线
        if (this.creatingConnection) {
            const sourceNode = this.nodes.find(n => n.id === this.creatingConnection.sourceNodeId);
            if (sourceNode) {
                const startX = sourceNode.x + sourceNode.width / 2;
                const startY = sourceNode.y + sourceNode.height / 2;
                const screenStart = this.worldToScreen(startX, startY);
                
                // 获取鼠标位置
                const rect = this.canvas.getBoundingClientRect();
                const mouseX = this.lastMouseX - rect.left;
                const mouseY = this.lastMouseY - rect.top;
                
                ctx.save();
                ctx.strokeStyle = '#007acc';
                ctx.lineWidth = 1.5;
                ctx.setLineDash([5, 5]);
                
                ctx.beginPath();
                ctx.moveTo(screenStart.x, screenStart.y);
                ctx.lineTo(mouseX, mouseY);
                ctx.stroke();
                ctx.restore();
            }
        }
    }
    
    // 渲染函数
    render(timestamp) {
        // 限制渲染频率
        if (timestamp - this.lastRenderTime < this.renderDelay) {
            this.scheduleRender();
            return;
        }
        
        this.lastRenderTime = timestamp;
        
        // 清空画布
        this.ctx.clearRect(0, 0, this.canvas.width, this.canvas.height);
        
        // 绘制网格
        this.drawGrid(this.ctx);

        // 绘制连线
        this.drawConnections(this.ctx);
        
        // 绘制节点
        this.nodes.forEach(node => {
            node.calculateAutoSize(this.ctx);
            this.drawNode(this.ctx, node);
        });
        
        // 继续渲染循环
        this.scheduleRender();
    }
    
    // 安排渲染
    scheduleRender() {
        if (!this.animationId) {
            this.animationId = requestAnimationFrame(timestamp => {
                this.animationId = null;
                this.render(timestamp);
            });
        }
    }
}