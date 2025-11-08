import { HistoryManager } from '../history/history.js';
import { exportAsImage, exportMarkdown, saveProject } from '../io/export.js';
import { handleFileSelect, openProject, handleProjectFileSelect } from '../io/import.js';
import { showConnectionProperties, updatePropertyPanel } from '../ui/panel.js';
import { isLightMode, toggleTheme } from '../ui/theme.js';
import { deepClone } from '../utils/common.js';
import { showContextMenu } from '../utils/dom.js';
import { doRectsOverlap, isPointInRect, isPointNearLine } from '../utils/math.js';
import Condition from './condition.js';
import Connection from './connection.js';
import Node from './node.js';

// 辅助函数：将十六进制颜色转换为RGB
function hexToRgb(hex) {
    const result = /^#?([a-f\d]{2})([a-f\d]{2})([a-f\d]{2})$/i.exec(hex);
    return result ? {
        r: parseInt(result[1], 16),
        g: parseInt(result[2], 16),
        b: parseInt(result[3], 16)
    } : null;
}

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
        
        // 拖动检测
        this.mouseDownPos = { x: 0, y: 0 };
        this.mouseDownTime = 0;
        this.hasMoved = false;
        this.dragThreshold = 5; // 像素阈值，超过这个距离才算拖动
        this.clickTimeout = null;
        
        // 历史记录
        this.historyManager = new HistoryManager(50);
        
        // 性能优化
        this.animationId = null;
        this.lastRenderTime = 0;
        this.renderDelay = 16; // ~60FPS
        
        // 节点悬浮提示框
        this.hoveredNode = null;
        this.hoverStartTime = 0;
        this.hoverTimeout = null;
        this.tooltipElement = null;
        
        // 绑定事件处理函数（用于正确移除事件监听器）
        this.boundHandleGlobalMouseMove = this.handleGlobalMouseMove.bind(this);
        this.boundHandleGlobalMouseUp = this.handleGlobalMouseUp.bind(this);
        
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
        
        // 监听工作区尺寸变化（包括布局调整）
        const workspace = this.canvas.parentElement;
        if (workspace) {
            const resizeObserver = new ResizeObserver(() => {
                resizeCanvas();
            });
            resizeObserver.observe(workspace);
        }
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
        
        // 全局鼠标松开事件（处理在画布外松开鼠标的情况）
        document.addEventListener('mouseup', e => this.handleGlobalMouseUpForPanning(e));
        
        // 拖放事件
        this.canvas.addEventListener('dragover', e => e.preventDefault());
        this.canvas.addEventListener('drop', e => this.handleDrop(e));

        // 鼠标离开事件
        this.canvas.addEventListener('mouseleave', e => this.handleMouseLeave(e));
        
        // 键盘事件
        document.addEventListener('keydown', e => this.handleKeyDown(e));
    }
    
    // 设置UI元素监听器
    setupUIListeners() {
        // 菜单按钮
        document.getElementById('new-project').addEventListener('click', () => this.newProject());
        document.getElementById('open-project').addEventListener('click', () => openProject(this));
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
        document.getElementById('project-input').addEventListener('change', e => handleProjectFileSelect(e, this));
        
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
    
    // 重置视图（缩放和移动画布，让所有节点整体居中显示）
    resetView() {
        // 确定要居中的节点：如果有选中对象，只居中选中的节点；否则居中所有节点
        let nodesToCenter = [];
        
        if (this.selectedElements.length > 0) {
            // 只居中选中的节点
            nodesToCenter = this.selectedElements.filter(el => el instanceof Node);
        } else {
            // 居中所有节点
            nodesToCenter = this.nodes;
        }
        
        if (nodesToCenter.length === 0) {
            // 如果没有节点，重置到默认视图
            this.zoom = 1.0;
            this.pan = { x: 0, y: 0 };
            this.updateZoomDisplay();
            this.scheduleRender();
            return;
        }
        
        // 计算节点的边界框
        let minX = Infinity, minY = Infinity;
        let maxX = -Infinity, maxY = -Infinity;
        
        nodesToCenter.forEach(node => {
            minX = Math.min(minX, node.x);
            minY = Math.min(minY, node.y);
            maxX = Math.max(maxX, node.x + node.width);
            maxY = Math.max(maxY, node.y + node.height);
        });
        
        // 添加边距
        const padding = 50;
        minX -= padding;
        minY -= padding;
        maxX += padding;
        maxY += padding;
        
        // 计算内容尺寸
        const contentWidth = maxX - minX;
        const contentHeight = maxY - minY;
        
        // 计算画布尺寸
        const canvasWidth = this.canvas.width;
        const canvasHeight = this.canvas.height;
        
        // 计算合适的缩放比例（留出一些边距）
        const scaleX = (canvasWidth * 0.9) / contentWidth;
        const scaleY = (canvasHeight * 0.9) / contentHeight;
        this.zoom = Math.min(scaleX, scaleY, 1.0); // 不放大超过1.0
        
        // 计算中心点
        const centerX = (minX + maxX) / 2;
        const centerY = (minY + maxY) / 2;
        
        // 设置平移，使内容居中
        this.pan.x = canvasWidth / 2 - centerX * this.zoom;
        this.pan.y = canvasHeight / 2 - centerY * this.zoom;
        
        this.updateZoomDisplay();
        this.scheduleRender();
    }
    
    // 处理鼠标按下事件
    handleMouseDown(e) {
        const rect = this.canvas.getBoundingClientRect();
        const x = e.clientX - rect.left;
        const y = e.clientY - rect.top;
        this.lastMouseX = e.clientX;
        this.lastMouseY = e.clientY;
        const worldPos = this.screenToWorld(x, y);
        
        // 记录鼠标按下位置和时间（用于区分单击和拖动）
        this.mouseDownPos = { x: e.clientX, y: e.clientY };
        this.mouseDownTime = Date.now();
        this.hasMoved = false;
        
        // 清除之前的点击超时
        if (this.clickTimeout) {
            clearTimeout(this.clickTimeout);
            this.clickTimeout = null;
        }
        
        // 右键菜单处理
        if (e.button === 2) {
            this.handleRightClick(worldPos, x, y, e.clientX, e.clientY);
            return;
        }
        
        // 中键平移
        if (e.button === 1) {
            e.preventDefault(); // 防止中键的默认行为（如打开链接、滚动等）
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
            const clickedConnections = this.getConnectionAtPosition(worldPos);
            if (clickedConnections && clickedConnections.length > 0) {
                this.handleConnectionClick(clickedConnections, e);
                return;
            }
            
            // 如果没有点击任何元素，开始框选
            this.startSelection(x, y);
            this.deselectAll();
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
        document.addEventListener('mousemove', this.boundHandleGlobalMouseMove);
        document.addEventListener('mouseup', this.boundHandleGlobalMouseUp);
    }
    
    // 处理节点点击（在鼠标按下时调用，用于准备拖动）
    handleNodeClick(node, worldPos, e) {
        // 处理连接创建
        if (this.creatingConnection) {
            this.finishConnectionCreation(node.id);
            return;
        }
        
        // 根据筛选器判断是否可以选择节点
        if (this.selectionFilter === 'connections') {
            // 如果筛选器设置为仅选择连线，则忽略节点点击
            return;
        }
        
        // 检查节点是否已经被选中
        const isAlreadySelected = this.selectedElements.some(el => el.id === node.id);
        
        // 如果节点已经被选中，直接准备拖动（不改变选择状态）
        if (isAlreadySelected) {
            // 将点击的节点移到最上层（显示层次优化）
            this.bringNodeToFront(node);
            
            // 准备拖动
            this.draggingElement = node;
            this.draggingOffset.x = worldPos.x - node.x;
            this.draggingOffset.y = worldPos.y - node.y;
            return;
        }
        
        // 如果节点未被选中，先选中节点（但延迟到鼠标松开时确认，如果是拖动则不改变选择）
        // 选择逻辑
        if (!e.ctrlKey && !e.metaKey) {
            // 如果节点已经被选中且当前有多选，保持多选状态
            if (this.selectedElements.filter(el => el.type === 'node').length <= 1) {
                this.deselectAll();
            }
        }
        
        // 切换节点选择状态（只有在按住Ctrl键时才切换）
        if (e.ctrlKey || e.metaKey) {
            const index = this.selectedElements.findIndex(el => el.id === node.id);
            if (index === -1) {
                this.selectedElements.push(node);
            } else {
                this.selectedElements.splice(index, 1);
            }
        } else {
            // 如果没有按住Ctrl键，确保节点被选中
            if (!isAlreadySelected) {
                this.selectedElements.push(node);
            }
        }
        
        // 应用筛选器
        this.filterSelectedElements();
        
        // 将点击的节点移到最上层（显示层次优化）
        this.bringNodeToFront(node);
        
        // 准备拖动（使用第一个选中的节点作为拖动元素）
        const selectedNodes = this.selectedElements.filter(el => el.type === 'node');
        if (selectedNodes.length > 0) {
            this.draggingElement = node; // 使用点击的节点作为拖动参考
            this.draggingOffset.x = worldPos.x - node.x;
            this.draggingOffset.y = worldPos.y - node.y;
        }
        
        updatePropertyPanel(this);
        this.scheduleRender();
    }
    
    // 将节点移到最上层（显示层次优化）
    bringNodeToFront(node) {
        const index = this.nodes.indexOf(node);
        if (index !== -1) {
            // 从数组中移除节点
            this.nodes.splice(index, 1);
            // 添加到数组末尾（最后绘制的在最上层）
            this.nodes.push(node);
        }
    }
    
    // 处理连线点击（支持多条连线）
    handleConnectionClick(connections, e) {
        // connections 可能是单个连线或连线数组
        const connectionArray = Array.isArray(connections) ? connections : [connections];
        
        // 根据筛选器判断是否可以选择连线
        if (this.selectionFilter === 'nodes') {
            // 如果筛选器设置为仅选择节点，则忽略连线点击
            return;
        }
        
        if (!e.ctrlKey && !e.metaKey) {
            this.deselectAll();
        }
        
        // 如果点击的是多条连线，选择所有连线
        connectionArray.forEach(connection => {
            const index = this.selectedElements.findIndex(el => el.id === connection.id);
            if (index === -1) {
                this.selectedElements.push(connection);
            } else {
                // 如果按住Ctrl键，则取消选择
                if (e.ctrlKey || e.metaKey) {
                    this.selectedElements.splice(index, 1);
                }
            }
        });
        
        // 应用筛选器
        this.filterSelectedElements();
        
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
        
        // 检测鼠标是否在节点上方
        this.checkNodeHover(worldPos, x, y);
        
        // 检测是否移动（用于区分单击和拖动）
        if (this.mouseDownPos) {
            const dx = e.clientX - this.mouseDownPos.x;
            const dy = e.clientY - this.mouseDownPos.y;
            const distance = Math.sqrt(dx * dx + dy * dy);
            if (distance > this.dragThreshold) {
                this.hasMoved = true;
            }
        }
        
        // 平移处理（确保不在框选状态下）
        if (this.isPanning && !this.isSelecting) {
            this.pan.x += x - this.panStart.x;
            this.pan.y += y - this.panStart.y;
            this.panStart.x = x;
            this.panStart.y = y;
            this.scheduleRender();
            return;
        }
        
        // 拖动节点处理（支持多选拖动）
        if (this.draggingElement && this.draggingElement.type === 'node') {
            // 计算拖动偏移量
            const deltaX = worldPos.x - this.draggingElement.x - this.draggingOffset.x;
            const deltaY = worldPos.y - this.draggingElement.y - this.draggingOffset.y;
            
            // 获取所有选中的节点
            const selectedNodes = this.selectedElements.filter(el => el.type === 'node');
            
            // 如果只有一个节点被选中，直接移动它
            if (selectedNodes.length === 1) {
                this.draggingElement.x = worldPos.x - this.draggingOffset.x;
                this.draggingElement.y = worldPos.y - this.draggingOffset.y;
            } else {
                // 如果有多个节点被选中，移动所有选中的节点
                selectedNodes.forEach(node => {
                    node.x += deltaX;
                    node.y += deltaY;
                });
                // 更新拖动偏移量，以便下次移动时使用正确的偏移
                this.draggingOffset.x = worldPos.x - this.draggingElement.x;
                this.draggingOffset.y = worldPos.y - this.draggingElement.y;
            }
            
            this.scheduleRender();
            return;
        }
        
        // 正在创建连线
        if (this.creatingConnection) {
            this.scheduleRender();
        }
    }
    
    // 处理鼠标松开事件
    handleMouseUp(e) {
        // 只处理左键和中键的松开事件（右键用于上下文菜单）
        if (e.button === 0 || e.button === 1) {
            // 如果是拖动，不执行单击逻辑
            if (this.hasMoved) {
                this.hasMoved = false;
                this.mouseDownPos = null;
                this.stopPanningAndDragging();
                return;
            }
            
            // 如果是单击（没有移动），且之前有节点被点击但未选中，现在执行选择
            // 这个逻辑已经在 handleNodeClick 中处理了，这里只需要清理状态
            this.hasMoved = false;
            this.mouseDownPos = null;
            
            this.stopPanningAndDragging();
        }
    }
    
    // 处理键盘按下事件
    handleKeyDown(e) {
        // 如果正在输入框中输入，忽略快捷键
        const activeElement = document.activeElement;
        if (activeElement && (activeElement.tagName === 'INPUT' || activeElement.tagName === 'TEXTAREA')) {
            // 但允许Delete键在输入框中工作
            if (e.key === 'Delete' || e.key === 'Backspace') {
                return;
            }
            return;
        }
        
        // F键：重置视图
        if (e.key === 'f' || e.key === 'F') {
            e.preventDefault();
            this.resetView();
            return;
        }
        
        // Delete键：删除选中对象
        if (e.key === 'Delete' || e.key === 'Backspace') {
            e.preventDefault();
            if (this.selectedElements.length > 0) {
                // 删除节点
                const nodesToDelete = this.selectedElements.filter(el => el.type === 'node');
                if (nodesToDelete.length > 0) {
                    this.deleteSelectedNodes();
                }
                // 删除连线
                const connectionsToDelete = this.selectedElements.filter(el => el.type === 'connection');
                if (connectionsToDelete.length > 0) {
                    this.deleteSelectedConnections();
                }
            }
            return;
        }
        
        // Ctrl+D：复制选中对象到鼠标位置
        if ((e.ctrlKey || e.metaKey) && (e.key === 'd' || e.key === 'D')) {
            e.preventDefault();
            if (this.selectedElements.length > 0) {
                this.duplicateSelectedElements();
            }
            return;
        }
    }
    
    // 复制选中的元素到鼠标位置
    duplicateSelectedElements() {
        if (this.selectedElements.length === 0) return;
        
        // 获取鼠标位置（世界坐标）
        const worldPos = this.screenToWorld(this.lastMouseX - this.canvas.getBoundingClientRect().left, 
                                           this.lastMouseY - this.canvas.getBoundingClientRect().top);
        
        // 计算选中元素的边界框
        let minX = Infinity, minY = Infinity;
        const selectedNodes = this.selectedElements.filter(el => el.type === 'node');
        
        if (selectedNodes.length === 0) return;
        
        selectedNodes.forEach(node => {
            minX = Math.min(minX, node.x);
            minY = Math.min(minY, node.y);
        });
        
        // 计算偏移量
        const offsetX = worldPos.x - minX;
        const offsetY = worldPos.y - minY;
        
        // 创建节点映射（旧ID -> 新节点）
        const nodeMap = new Map();
        const newNodes = [];
        const newConnections = [];
        
        // 复制节点
        selectedNodes.forEach(node => {
            const newNode = new Node(node.name, node.x + offsetX, node.y + offsetY);
            newNode.description = node.description;
            newNode.width = node.width;
            newNode.height = node.height;
            newNode.autoSize = node.autoSize;
            newNode.color = node.color;
            nodeMap.set(node.id, newNode);
            newNodes.push(newNode);
        });
        
        // 复制连线（只复制选中节点之间的连线）
        const selectedNodeIds = new Set(selectedNodes.map(n => n.id));
        this.connections.forEach(conn => {
            if (selectedNodeIds.has(conn.sourceNodeId) && selectedNodeIds.has(conn.targetNodeId)) {
                const newConnection = new Connection(
                    nodeMap.get(conn.sourceNodeId).id,
                    nodeMap.get(conn.targetNodeId).id
                );
                // 复制条件
                conn.conditions.forEach(cond => {
                    const newCond = new Condition(cond.type, cond.key, cond.operator, cond.value);
                    newConnection.conditions.push(newCond);
                });
                // 复制连线属性
                newConnection.color = conn.color;
                newConnection.lineWidth = conn.lineWidth;
                newConnection.lineType = conn.lineType;
                newConnection.arrowSize = conn.arrowSize;
                newConnection.arrowColor = conn.arrowColor;
                newConnections.push(newConnection);
            }
        });
        
        // 记录历史
        this.historyManager.addHistory('duplicate-elements', {
            nodes: newNodes.map(n => n.clone()),
            connections: newConnections.map(c => c.clone())
        });
        
        // 添加新节点和连线
        newNodes.forEach(node => this.nodes.push(node));
        newConnections.forEach(conn => this.connections.push(conn));
        
        // 选中新创建的元素
        this.selectedElements = [...newNodes];
        
        updatePropertyPanel(this);
        this.scheduleRender();
    }
    
    // 处理全局鼠标松开事件（用于在画布外松开鼠标时停止平移）
    handleGlobalMouseUpForPanning(e) {
        // 只处理左键和中键的松开事件，且不在框选状态下
        if ((e.button === 0 || e.button === 1) && !this.isSelecting) {
            this.stopPanningAndDragging();
        }
    }
    
    // 停止平移和拖动
    stopPanningAndDragging() {
        // 停止平移
        if (this.isPanning) {
            this.isPanning = false;
            this.canvas.style.cursor = 'default';
        }
        
        // 停止拖动节点
        if (this.draggingElement) {
            this.draggingElement = null;
        }
        
        this.scheduleRender();
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
        document.removeEventListener('mousemove', this.boundHandleGlobalMouseMove);
        document.removeEventListener('mouseup', this.boundHandleGlobalMouseUp);
        
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
        
        // 停止平移和拖动
        this.stopPanningAndDragging();
    }
    
    // 处理鼠标离开事件
    handleMouseLeave(e) {
        // 框选过程中鼠标离开画布时不结束框选
        if (this.isSelecting) return;
        
        // 隐藏提示框
        this.hideTooltip();
        
        // 结束拖动和平移
        this.stopPanningAndDragging();
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
    handleRightClick(worldPos, screenX, screenY, clientX, clientY) {
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
        const clickedConnections = this.getConnectionAtPosition(worldPos);
        const clickedConnection = clickedConnections && clickedConnections.length > 0 ? clickedConnections[0] : null;
        
        // 显示上下文菜单（无论是否点击到元素都显示）
        // 使用 clientX, clientY 作为页面坐标（相对于视口）
        const element = clickedNode || clickedConnection || null;
        showContextMenu(clientX, clientY, element, this, worldPos);
    }
    
    // 检测点是否在三角形内（用于箭头点击检测）
    _isPointInTriangle(px, py, x1, y1, x2, y2, x3, y3) {
        // 使用叉积判断点是否在三角形内
        const d1 = (px - x2) * (y1 - y2) - (x1 - x2) * (py - y2);
        const d2 = (px - x3) * (y2 - y3) - (x2 - x3) * (py - y3);
        const d3 = (px - x1) * (y3 - y1) - (x3 - x1) * (py - y1);
        return (d1 >= 0 && d2 >= 0 && d3 >= 0) || (d1 <= 0 && d2 <= 0 && d3 <= 0);
    }
    
    // 获取指定位置的连线（支持双向连线的左右区域分别点击，支持箭头点击）
    getConnectionAtPosition(pos) {
        // 按节点对分组连线
        const connectionGroups = this.groupConnectionsByNodePair();
        
        for (const group of connectionGroups) {
            const nodeA = this.nodes.find(n => n.id === group.nodeA);
            const nodeB = this.nodes.find(n => n.id === group.nodeB);
            
            if (!nodeA || !nodeB) continue;
            
            // 计算连线的起点和终点
            const startX = nodeA.x + nodeA.width / 2;
            const startY = nodeA.y + nodeA.height / 2;
            const endX = nodeB.x + nodeB.width / 2;
            const endY = nodeB.y + nodeB.height / 2;
            
            // 判断是否有双向连线
            const hasForward = group.forward.length > 0;
            const hasBackward = group.backward.length > 0;
            const isBidirectional = hasForward && hasBackward;
            
            // 先检测是否点击了箭头（优先检测箭头）
            const midX = (startX + endX) / 2;
            const midY = (startY + endY) / 2;
            const angle = Math.atan2(endY - startY, endX - startX);
            
            // 检查forward方向的箭头（箭头位置已保存为世界坐标）
            if (hasForward) {
                const forwardConn = group.forward[0];
                if (forwardConn._arrowPositions) {
                    for (const arrowPos of forwardConn._arrowPositions) {
                        if (this._isPointInTriangle(
                            pos.x, pos.y,
                            arrowPos.tip.x, arrowPos.tip.y,
                            arrowPos.base1.x, arrowPos.base1.y,
                            arrowPos.base2.x, arrowPos.base2.y
                        )) {
                            return group.forward;
                        }
                    }
                }
            }
            
            // 检查backward方向的箭头（箭头位置已保存为世界坐标）
            if (hasBackward) {
                const backwardConn = group.backward[0];
                if (backwardConn._arrowPositions) {
                    for (const arrowPos of backwardConn._arrowPositions) {
                        if (this._isPointInTriangle(
                            pos.x, pos.y,
                            arrowPos.tip.x, arrowPos.tip.y,
                            arrowPos.base1.x, arrowPos.base1.y,
                            arrowPos.base2.x, arrowPos.base2.y
                        )) {
                            return group.backward;
                        }
                    }
                }
            }
            
            // 检测是否点击了连线
            if (!isPointNearLine(pos.x, pos.y, startX, startY, endX, endY, 5 / this.zoom)) {
                continue;
            }
            
            if (isBidirectional) {
                // 双向连线：需要判断点击的是左侧还是右侧（以中心点为分割）
                // 计算从中心点到点击位置的向量（沿连线方向）
                const dx = pos.x - midX;
                const dy = pos.y - midY;
                
                // 计算点击位置在连线方向上的投影（平行于连线）
                const parallelProjection = dx * Math.cos(angle) + dy * Math.sin(angle);
                
                // 判断点击位置更靠近哪个节点
                // 如果点击位置在中心点向A节点方向（startX, startY），选择forward（A -> B）
                // 如果点击位置在中心点向B节点方向（endX, endY），选择backward（B -> A）
                // 注意：startX是A节点，endX是B节点
                // parallelProjection > 0 表示从中心点向B节点方向（endX方向）
                // parallelProjection < 0 表示从中心点向A节点方向（startX方向）
                if (parallelProjection > 0) {
                    // 点击的是从中心点向B节点方向，应该选择backward（B -> A方向）
                    return group.backward.length > 0 ? group.backward : null;
                } else {
                    // 点击的是从中心点向A节点方向，应该选择forward（A -> B方向）
                    return group.forward.length > 0 ? group.forward : null;
                }
            } else {
                // 单向连线：直接返回该方向的连线
                if (hasForward) {
                    return group.forward.length > 0 ? group.forward : null;
                } else {
                    return group.backward.length > 0 ? group.backward : null;
                }
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
                    // 检查是否选中箭头或端点
                    const isConnected = this._isConnectionSelectedByArrowOrEndpoints(sourceNode, targetNode, selectionRect, connection);
                    
                    if (isConnected) {
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
    
    // 检查连线是否通过箭头或端点被选中
    _isConnectionSelectedByArrowOrEndpoints(sourceNode, targetNode, selectionRect, connection) {
        // 检查端点是否在选择框内（原有逻辑）
        const sourceCenterX = sourceNode.x + sourceNode.width / 2;
        const sourceCenterY = sourceNode.y + sourceNode.height / 2;
        const targetCenterX = targetNode.x + targetNode.width / 2;
        const targetCenterY = targetNode.y + targetNode.height / 2;
        
        const startInRect = isPointInRect(sourceCenterX, sourceCenterY, selectionRect);
        const endInRect = isPointInRect(targetCenterX, targetCenterY, selectionRect);
        
        // 如果两个端点都在选择框内，保持原有逻辑
        if (startInRect && endInRect) {
            return true;
        }
        
        // 计算连线方向和箭头位置
        const dx = targetCenterX - sourceCenterX;
        const dy = targetCenterY - sourceCenterY;
        const angle = Math.atan2(dy, dx);
        
        // 箭头大小默认为10（与drawArrow方法一致）
        const arrowSize = 10;
        
        // 计算连线中点（箭头实际绘制在中点位置）
        const midX = (sourceCenterX + targetCenterX) / 2;
        const midY = (sourceCenterY + targetCenterY) / 2;
        
        // 计算箭头中心位置（使用连线中点作为箭头中心，与drawConnectionGroup方法中的绘制逻辑一致）
        const arrowCenterX = midX;
        const arrowCenterY = midY;
        
        // 计算箭头的三个顶点
        const tipX = arrowCenterX + arrowSize * Math.cos(angle);
        const tipY = arrowCenterY + arrowSize * Math.sin(angle);
        const base1X = arrowCenterX - arrowSize * Math.cos(angle - Math.PI / 3);
        const base1Y = arrowCenterY - arrowSize * Math.sin(angle - Math.PI / 3);
        const base2X = arrowCenterX - arrowSize * Math.cos(angle + Math.PI / 3);
        const base2Y = arrowCenterY - arrowSize * Math.sin(angle + Math.PI / 3);
        
        // 检查箭头三角形是否与选择框相交
        // 1. 检查箭头的任意一个顶点是否在选择框内
        const tipInRect = isPointInRect(tipX, tipY, selectionRect);
        const base1InRect = isPointInRect(base1X, base1Y, selectionRect);
        const base2InRect = isPointInRect(base2X, base2Y, selectionRect);
        
        if (tipInRect || base1InRect || base2InRect) {
            return true;
        }
        
        // 2. 对于多条平行连线的情况，也检查另一个方向的箭头
        // 查找是否有反向连接（多条平行连线）
        const hasReverseConnection = this.connections.some(conn => 
            conn.sourceNodeId === connection.targetNodeId && 
            conn.targetNodeId === connection.sourceNodeId
        );
        
        if (hasReverseConnection) {
            // 对于反向连接，箭头位置也在中点，但方向相反
            const reverseAngle = angle + Math.PI;
            
            // 计算反向箭头的三个顶点
            const reverseTipX = arrowCenterX + arrowSize * Math.cos(reverseAngle);
            const reverseTipY = arrowCenterY + arrowSize * Math.sin(reverseAngle);
            const reverseBase1X = arrowCenterX - arrowSize * Math.cos(reverseAngle - Math.PI / 3);
            const reverseBase1Y = arrowCenterY - arrowSize * Math.sin(reverseAngle - Math.PI / 3);
            const reverseBase2X = arrowCenterX - arrowSize * Math.cos(reverseAngle + Math.PI / 3);
            const reverseBase2Y = arrowCenterY - arrowSize * Math.sin(reverseAngle + Math.PI / 3);
            
            // 检查反向箭头的顶点是否在选择框内
            const reverseTipInRect = isPointInRect(reverseTipX, reverseTipY, selectionRect);
            const reverseBase1InRect = isPointInRect(reverseBase1X, reverseBase1Y, selectionRect);
            const reverseBase2InRect = isPointInRect(reverseBase2X, reverseBase2Y, selectionRect);
            
            if (reverseTipInRect || reverseBase1InRect || reverseBase2InRect) {
                return true;
            }
        }
        
        return false;
    }
    
    // 取消所有选择
    deselectAll() {
        this.selectedElements = [];
        updatePropertyPanel(this);
        this.scheduleRender();
    }
    
    // 添加节点
    addNode(node) {
        // 确保节点使用正确的默认尺寸（强制设置，防止被其他地方修改）
        node.width = 150;
        node.height = 50;
        node.autoSize = false; // 确保不是自适应尺寸
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
        const colorInput = document.getElementById('node-color');
        if (colorInput) {
            node.color = colorInput.value === '#ffffff' ? null : colorInput.value;
        }
        
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
        
        // 绘制节点背景（使用节点颜色或默认颜色，选中时不改变颜色）
        if (node.color) {
            ctx.fillStyle = node.color;
            // 根据颜色亮度调整边框颜色
            const rgb = hexToRgb(node.color);
            if (rgb) {
                const brightness = (rgb.r * 299 + rgb.g * 587 + rgb.b * 114) / 1000;
                ctx.strokeStyle = brightness > 128 ? '#cccccc' : '#4a4a4a';
            } else {
                ctx.strokeStyle = isLightMode() ? '#cccccc' : '#4a4a4a';
            }
        } else {
            ctx.fillStyle = isLightMode() ? '#ffffff' : '#2d2d30';
            ctx.strokeStyle = isLightMode() ? '#cccccc' : '#4a4a4a';
        }
        
        ctx.lineWidth = 1;
        
        ctx.beginPath();
        ctx.roundRect(screenPos.x, screenPos.y, width, height, 4);
        ctx.fill();
        ctx.stroke();
        
        // 如果节点被选中，绘制白色外框
        if (isSelected) {
            ctx.save();
            ctx.strokeStyle = isLightMode() ? '#000000' : '#ffffff';
            ctx.lineWidth = 2;
            var Padding = 2;
            ctx.beginPath();
            ctx.roundRect(screenPos.x-Padding, screenPos.y-Padding, width+Padding*2, height+Padding*2, 4);
            ctx.stroke();
            ctx.restore();
        }
        
        // 计算字体大小（相对于节点尺寸，保持比例）
        // 基础字体大小相对于节点高度，假设节点高度50时字体大小为14
        const baseFontSize = 14;
        const baseNodeHeight = 50;
        const fontSize = (node.height / baseNodeHeight) * baseFontSize * this.zoom;
        
        // 绘制节点名称
        ctx.font = `bold ${fontSize}px Arial`;
        ctx.fillStyle = isSelected ?  isLightMode() ? '#000000' : '#ffffff' : isLightMode() ? '#333333' : '#e0e0e0';
        ctx.textAlign = 'center';
        ctx.textBaseline = 'middle';
        
        // 处理节点名称文本（当没有启用自适应尺寸时，如果名称过长则截断）
        let displayName = node.name;
        if (!node.autoSize) {
            // 计算可显示的字符数
            const maxWidth = node.width * this.zoom * 0.9; // 留10%边距
            ctx.font = `bold ${fontSize}px Arial`;
            const metrics = ctx.measureText(displayName);
            
            if (metrics.width > maxWidth) {
                // 文本过长，需要截断
                let truncated = '';
                for (let i = 0; i < displayName.length; i++) {
                    const testText = displayName.substring(0, i + 1) + '...';
                    const testMetrics = ctx.measureText(testText);
                    if (testMetrics.width > maxWidth) {
                        truncated = displayName.substring(0, i) + '...';
                        break;
                    }
                }
                if (truncated) {
                    displayName = truncated;
                }
            }
        }
        
        // 计算文本位置（如果有描述，名称稍微上移，描述在下方）
        let nameY = screenPos.y + height / 2;
        if (node.description) {
            nameY = screenPos.y + height / 2 - fontSize * 0.3;
        }
        
        // 绘制节点名称（居中显示）
        ctx.fillText(displayName, screenPos.x + width / 2, nameY);
        
        // 绘制节点描述（如果有描述，显示在名称下方）
        if (node.description) {
            const descFontSize = fontSize * 0.7; // 描述字体稍小
            ctx.font = `${descFontSize}px Arial`;
            ctx.fillStyle = isSelected ? 'rgba(255, 255, 255, 0.8)' : isLightMode() ? '#666666' : '#969696';
            
            // 截断长描述
            let displayText = node.description;
            const maxDescWidth = node.width * this.zoom * 0.9; // 留10%边距
            const descMetrics = ctx.measureText(displayText);
            
            if (descMetrics.width > maxDescWidth) {
                // 文本过长，需要截断
                let truncated = '';
                for (let i = 0; i < displayText.length; i++) {
                    const testText = displayText.substring(0, i + 1) + '...';
                    const testMetrics = ctx.measureText(testText);
                    if (testMetrics.width > maxDescWidth) {
                        truncated = displayText.substring(0, i) + '...';
                        break;
                    }
                }
                if (truncated) {
                    displayText = truncated;
                }
            }
            
            // 描述文本显示在名称下方
            const descY = screenPos.y + height / 2 + fontSize * 0.4;
            ctx.fillText(displayText, screenPos.x + width / 2, descY);
        }
        
        ctx.restore();
    }
    
    // 按节点对分组连线
    groupConnectionsByNodePair() {
        const groups = new Map();
        
        this.connections.forEach(connection => {
            const sourceNode = this.nodes.find(n => n.id === connection.sourceNodeId);
            const targetNode = this.nodes.find(n => n.id === connection.targetNodeId);
            
            if (!sourceNode || !targetNode) return;
            
            // 创建节点对的唯一键（较小的ID在前，确保双向连线使用同一个键）
            const nodePairKey = [connection.sourceNodeId, connection.targetNodeId]
                .sort()
                .join('|');
            
            if (!groups.has(nodePairKey)) {
                groups.set(nodePairKey, {
                    nodeA: connection.sourceNodeId < connection.targetNodeId 
                        ? connection.sourceNodeId 
                        : connection.targetNodeId,
                    nodeB: connection.sourceNodeId < connection.targetNodeId 
                        ? connection.targetNodeId 
                        : connection.sourceNodeId,
                    forward: [],  // A -> B 方向的连线
                    backward: []   // B -> A 方向的连线
                });
            }
            
            const group = groups.get(nodePairKey);
            // 判断连线方向
            if (connection.sourceNodeId === group.nodeA) {
                group.forward.push(connection);
            } else {
                group.backward.push(connection);
            }
        });
        
        return Array.from(groups.values());
    }
    
    // 绘制单个箭头（平行于连线链式排列，最多两个箭头）
    drawArrow(ctx, centerX, centerY, angle, connectionCount, arrowSize, arrowColor, isReversed = false, isSelected = false) {
        ctx.save();
        
        // 使用默认箭头尺寸（回退到上一个版本）
        const baseArrowSize = arrowSize || 10;
        
        // 最多绘制两个箭头：1条连线=1个箭头，多条连线=2个箭头
        const arrowCount = connectionCount > 1 ? 2 : 1;
        
        // 箭头之间的间距（平行于连线方向）
        const spacing = baseArrowSize * 1.5;
        
        // 计算箭头组的整体长度
        const totalLength = (arrowCount - 1) * spacing;
        
        // 计算第一个箭头的中心位置（使整个箭头组中心对齐）
        const startOffset = -totalLength / 2;
        
        // 保存箭头位置用于点击检测
        const arrowPositions = [];
        
        for (let i = 0; i < arrowCount; i++) {
            // 箭头中心位置（平行于连线方向排列）
            const arrowCenterX = centerX + (startOffset + i * spacing) * Math.cos(angle);
            const arrowCenterY = centerY + (startOffset + i * spacing) * Math.sin(angle);
            
            // 箭头方向（如果反向则翻转180度）
            const arrowAngle = isReversed ? angle + Math.PI : angle;
            
            // 箭头顶点（指向目标方向）
            const tipX = arrowCenterX + baseArrowSize * Math.cos(arrowAngle);
            const tipY = arrowCenterY + baseArrowSize * Math.sin(arrowAngle);
            
            // 箭头底部的两个点
            const base1X = arrowCenterX - baseArrowSize * Math.cos(arrowAngle - Math.PI / 3);
            const base1Y = arrowCenterY - baseArrowSize * Math.sin(arrowAngle - Math.PI / 3);
            const base2X = arrowCenterX - baseArrowSize * Math.cos(arrowAngle + Math.PI / 3);
            const base2Y = arrowCenterY - baseArrowSize * Math.sin(arrowAngle + Math.PI / 3);
            
            // 保存箭头位置用于点击检测（屏幕坐标，稍后转换为世界坐标）
            arrowPositions.push({
                tip: { x: tipX, y: tipY },
                base1: { x: base1X, y: base1Y },
                base2: { x: base2X, y: base2Y }
            });
            
            // 如果选中，先绘制白色外发光
            if (isSelected) {
                ctx.save();
                ctx.strokeStyle = isLightMode()?'#0066cc':'#ffffff';
                ctx.lineWidth = baseArrowSize + 2; // 10像素外发光 / 2
                ctx.globalAlpha = 1;
                ctx.beginPath();
                ctx.moveTo(tipX, tipY);
                ctx.lineTo(base1X, base1Y);
                ctx.lineTo(base2X, base2Y);
                ctx.closePath();
                ctx.stroke();
                ctx.restore();
            }
            
            // 绘制箭头
            ctx.fillStyle = arrowColor;
            ctx.beginPath();
            ctx.moveTo(tipX, tipY);
            ctx.lineTo(base1X, base1Y);
            ctx.lineTo(base2X, base2Y);
            ctx.closePath();
            ctx.fill();
        }
        
        ctx.restore();
        
        // 返回箭头位置（屏幕坐标）
        return arrowPositions;
    }
    
    // 绘制连线组
    drawConnectionGroup(ctx, group) {
        const nodeA = this.nodes.find(n => n.id === group.nodeA);
        const nodeB = this.nodes.find(n => n.id === group.nodeB);
        
        if (!nodeA || !nodeB) return;
        
        // 计算连线的起点和终点
        const startX = nodeA.x + nodeA.width / 2;
        const startY = nodeA.y + nodeA.height / 2;
        const endX = nodeB.x + nodeB.width / 2;
        const endY = nodeB.y + nodeB.height / 2;
        
        // 转换为屏幕坐标
        const screenStart = this.worldToScreen(startX, startY);
        const screenEnd = this.worldToScreen(endX, endY);
        
        // 计算连线角度
        const angle = Math.atan2(screenEnd.y - screenStart.y, screenEnd.x - screenStart.x);
        
        // 计算连线中点（屏幕坐标）
        const midScreenX = (screenStart.x + screenEnd.x) / 2;
        const midScreenY = (screenStart.y + screenEnd.y) / 2;
        
        // 判断是否有双向连线
        const hasForward = group.forward.length > 0;
        const hasBackward = group.backward.length > 0;
        const isBidirectional = hasForward && hasBackward;
        
        // 获取连线属性（使用第一条连线的属性作为代表）
        const representativeConnection = group.forward[0] || group.backward[0];
        const isSelected = this.selectedElements.some(el => 
            (hasForward && group.forward.some(c => c.id === el.id)) ||
            (hasBackward && group.backward.some(c => c.id === el.id))
        );
        
        ctx.save();
        
        // 判断选中的是哪一侧（对向连线时）
        let selectedSide = null;
        if (isBidirectional && isSelected) {
            // 检查选中的连线属于哪一侧
            const forwardSelected = group.forward.some(c => 
                this.selectedElements.some(el => el.id === c.id));
            const backwardSelected = group.backward.some(c => 
                this.selectedElements.some(el => el.id === c.id));
            
            if (forwardSelected && !backwardSelected) {
                selectedSide = 'forward';
            } else if (backwardSelected && !forwardSelected) {
                selectedSide = 'backward';
            }
        }
        
        // 绘制连线（使用连接属性或默认值）
        ctx.strokeStyle = representativeConnection.color || 
            (isLightMode() ? '#666666' : '#969696');
        ctx.lineWidth = representativeConnection.lineWidth || 1.5;
        
        // 设置连线类型
        if (representativeConnection.lineType === 'dashed') {
            ctx.setLineDash([5, 5]);
        } else {
            ctx.setLineDash([]);
        }
        
        // 如果选中，先绘制外发光效果
        if (isSelected) {
            // 计算需要高亮的线段
            let highlightStart = screenStart;
            let highlightEnd = screenEnd;
            
            if (isBidirectional && selectedSide) {
                // 对向连线：只高亮选中的一侧
                const midScreenX = (screenStart.x + screenEnd.x) / 2;
                const midScreenY = (screenStart.y + screenEnd.y) / 2;
                
                if (selectedSide === 'forward') {
                    // 高亮从A节点到中心点的线段
                    highlightStart = screenStart;
                    highlightEnd = { x: midScreenX, y: midScreenY };
                } else {
                    // 高亮从中心点到B节点的线段
                    highlightStart = { x: midScreenX, y: midScreenY };
                    highlightEnd = screenEnd;
                }
            }
            
            // 绘制白色外发光（10像素宽度）
            ctx.save();
            ctx.strokeStyle = isLightMode()?'#0066cc':'#ffffff';
            ctx.lineWidth = (representativeConnection.lineWidth || 1.5) + 5; // 10像素外发光 / 2
            ctx.globalAlpha = 0.5;
            ctx.beginPath();
            ctx.moveTo(highlightStart.x, highlightStart.y);
            ctx.lineTo(highlightEnd.x, highlightEnd.y);
            ctx.stroke();
            ctx.restore();
        }
        
        // 绘制直线连线
        ctx.beginPath();
        ctx.moveTo(screenStart.x, screenStart.y);
        ctx.lineTo(screenEnd.x, screenEnd.y);
        ctx.stroke();
        
        // 箭头颜色（使用连接属性或默认值）
        let arrowColor;
        if (representativeConnection.arrowColor) {
            arrowColor = representativeConnection.arrowColor;
        } else if (isLightMode()) {
            arrowColor = '#888888';
        } else {
            arrowColor = '#aaaaaa';
        }
        
        // 使用默认箭头尺寸（回退到上一个版本）
        const arrowSize = representativeConnection.arrowSize || 10;
        
        // 保存箭头信息用于点击检测
        const arrowInfo = {
            centerX: midScreenX,
            centerY: midScreenY,
            angle: angle,
            forwardCount: group.forward.length,
            backwardCount: group.backward.length,
            isBidirectional: isBidirectional,
            forward: group.forward,
            backward: group.backward,
            nodeA: nodeA,
            nodeB: nodeB,
            startX: startX,
            startY: startY,
            endX: endX,
            endY: endY
        };
        
        // 双向连线：绘制双向箭头
        if (isBidirectional) {
            // 绘制中心圆点
            const circleRadius = 4;
            ctx.fillStyle = arrowColor;
            ctx.beginPath();
            ctx.arc(midScreenX, midScreenY, circleRadius, 0, Math.PI * 2);
            ctx.fill();
            
            // 计算箭头间距（平行于连线方向）
            const arrowSpacing = arrowSize * 1.5;
            // 计算箭头组的整体长度（最多2个箭头）
            const maxArrowCount = 2;
            const maxArrowGroupLength = (maxArrowCount - 1) * arrowSpacing;
            
            // 中心点两侧的偏移 = 圆半径 + 箭头组长度的一半（确保箭头尖部与圆相切，且两个箭头组不重叠）
            const centerOffset = circleRadius + maxArrowGroupLength / 2 + arrowSize;
            
            // 绘制左侧箭头（A -> B方向）
            const leftConnectionCount = group.forward.length;
            if (leftConnectionCount > 0) {
                // 左侧箭头组的中心位置（在中心点左侧，平行于连线，向后偏移）
                const leftCenterX = midScreenX - centerOffset * Math.cos(angle);
                const leftCenterY = midScreenY - centerOffset * Math.sin(angle);
                const leftSelected = selectedSide === 'forward' || (selectedSide === null && isSelected);
                const leftArrowPositions = this.drawArrow(ctx, leftCenterX, leftCenterY, angle, leftConnectionCount, arrowSize, arrowColor, false, leftSelected);
                
                // 转换为世界坐标并保存到连线对象
                if (leftArrowPositions) {
                    const forwardArrowPositions = leftArrowPositions.map(pos => ({
                        tip: this.screenToWorld(pos.tip.x, pos.tip.y),
                        base1: this.screenToWorld(pos.base1.x, pos.base1.y),
                        base2: this.screenToWorld(pos.base2.x, pos.base2.y)
                    }));
                    group.forward.forEach(conn => {
                        conn._arrowPositions = forwardArrowPositions;
                    });
                }
            }
            
            // 绘制右侧箭头（B -> A方向）
            const rightConnectionCount = group.backward.length;
            if (rightConnectionCount > 0) {
                // 右侧箭头组的中心位置（在中心点右侧，平行于连线，向后偏移）
                const rightCenterX = midScreenX + centerOffset * Math.cos(angle);
                const rightCenterY = midScreenY + centerOffset * Math.sin(angle);
                const rightSelected = selectedSide === 'backward' || (selectedSide === null && isSelected);
                const rightArrowPositions = this.drawArrow(ctx, rightCenterX, rightCenterY, angle, rightConnectionCount, arrowSize, arrowColor, true, rightSelected);
                
                // 转换为世界坐标并保存到连线对象
                if (rightArrowPositions) {
                    const backwardArrowPositions = rightArrowPositions.map(pos => ({
                        tip: this.screenToWorld(pos.tip.x, pos.tip.y),
                        base1: this.screenToWorld(pos.base1.x, pos.base1.y),
                        base2: this.screenToWorld(pos.base2.x, pos.base2.y)
                    }));
                    group.backward.forEach(conn => {
                        conn._arrowPositions = backwardArrowPositions;
                    });
                }
            }
        } else {
            // 单向连线：只绘制一个方向的箭头
            const connectionCount = hasForward ? group.forward.length : group.backward.length;
            const arrowPositions = this.drawArrow(ctx, midScreenX, midScreenY, angle, connectionCount, arrowSize, arrowColor, hasBackward, isSelected);
            
            // 转换为世界坐标并保存到连线对象
            if (arrowPositions) {
                const worldArrowPositions = arrowPositions.map(pos => ({
                    tip: this.screenToWorld(pos.tip.x, pos.tip.y),
                    base1: this.screenToWorld(pos.base1.x, pos.base1.y),
                    base2: this.screenToWorld(pos.base2.x, pos.base2.y)
                }));
                
                if (hasForward) {
                    group.forward.forEach(conn => {
                        conn._arrowPositions = worldArrowPositions;
                    });
                } else {
                    group.backward.forEach(conn => {
                        conn._arrowPositions = worldArrowPositions;
                    });
                }
            }
        }
        
        // 保存箭头信息到组中所有连线（用于点击检测）
        const midWorld = this.screenToWorld(midScreenX, midScreenY);
        
        // 保存箭头信息（箭头位置已在绘制时保存）
        group.forward.forEach(conn => {
            conn._arrowInfo = { ...arrowInfo, side: 'forward' };
            conn._arrowCenter = { x: midWorld.x, y: midWorld.y };
        });
        group.backward.forEach(conn => {
            conn._arrowInfo = { ...arrowInfo, side: 'backward' };
            conn._arrowCenter = { x: midWorld.x, y: midWorld.y };
        });
        
        ctx.restore();
    }
    
    // 绘制连线（已移至render方法中，此方法保留用于向后兼容）
    drawConnections(ctx) {
        // 按节点对分组连线
        const connectionGroups = this.groupConnectionsByNodePair();
        
        // 绘制每个连线组
        connectionGroups.forEach(group => {
            this.drawConnectionGroup(ctx, group);
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

        // 分离选中的节点和未选中的节点
        const selectedNodes = [];
        const unselectedNodes = [];
        
        this.nodes.forEach(node => {
            if (this.selectedElements.includes(node)) {
                selectedNodes.push(node);
            } else {
                unselectedNodes.push(node);
            }
        });
        
        // 先绘制未选中的连线
        const connectionGroups = this.groupConnectionsByNodePair();
        const selectedGroups = [];
        const unselectedGroups = [];
        
        connectionGroups.forEach(group => {
            const isSelected = group.forward.some(conn => this.selectedElements.includes(conn)) ||
                              group.backward.some(conn => this.selectedElements.includes(conn));
            if (isSelected) {
                selectedGroups.push(group);
            } else {
                unselectedGroups.push(group);
            }
        });
        
        // 1. 绘制未选中的连线
        unselectedGroups.forEach(group => {
            this.drawConnectionGroup(this.ctx, group);
        });
        
        // 2. 绘制未选中的节点
        unselectedNodes.forEach(node => {
            node.calculateAutoSize(this.ctx);
            this.drawNode(this.ctx, node);
        });
        
        // 3. 检查是否有选中的连线
        const hasSelectedConnections = selectedGroups.some(group => 
            group.forward.some(conn => this.selectedElements.includes(conn)) ||
            group.backward.some(conn => this.selectedElements.includes(conn))
        );
        
        // 4. 检查是否只有选中的节点
        const hasSelectedNodesOnly = selectedNodes.length > 0 && !hasSelectedConnections;
        
        if (hasSelectedNodesOnly) {
            // 4.1 当单选节点时，该选中的节点在最后绘制(最上层)
            // 不在这里绘制，留到最后绘制所有选中节点
        } else {
            // 4.2 当选中的是连线时，先绘制选中的连线
            selectedGroups.forEach(group => {
                this.drawConnectionGroup(this.ctx, group);
            });
            
            // 分离选中连线的起始和终止节点
            const selectedConnectionNodes = new Set();
            selectedGroups.forEach(group => {
                group.forward.forEach(conn => {
                    if (this.selectedElements.includes(conn)) {
                        selectedConnectionNodes.add(conn.sourceNodeId);
                        selectedConnectionNodes.add(conn.targetNodeId);
                    }
                });
                group.backward.forEach(conn => {
                    if (this.selectedElements.includes(conn)) {
                        selectedConnectionNodes.add(conn.sourceNodeId);
                        selectedConnectionNodes.add(conn.targetNodeId);
                    }
                });
            });
            
            // 先绘制非连线相关的选中节点
            selectedNodes.forEach(node => {
                if (!selectedConnectionNodes.has(node.id)) {
                    node.calculateAutoSize(this.ctx);
                    this.drawNode(this.ctx, node);
                }
            });
            
            // 最后绘制选中连线的起始和终止节点（最顶层，覆盖选中连线）
            selectedNodes.forEach(node => {
                if (selectedConnectionNodes.has(node.id)) {
                    node.calculateAutoSize(this.ctx);
                    this.drawNode(this.ctx, node);
                }
            });
        }
        
        // 如果只有选中的节点，则在这里绘制（最顶层）
        if (hasSelectedNodesOnly) {
            selectedNodes.forEach(node => {
                node.calculateAutoSize(this.ctx);
                this.drawNode(this.ctx, node);
            });
        }
        
        // 绘制正在创建的连线（最顶层）
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
                
                this.ctx.save();
                this.ctx.strokeStyle = '#007acc';
                this.ctx.lineWidth = 1.5;
                this.ctx.setLineDash([5, 5]);
                
                this.ctx.beginPath();
                this.ctx.moveTo(screenStart.x, screenStart.y);
                this.ctx.lineTo(mouseX, mouseY);
                this.ctx.stroke();
                this.ctx.restore();
            }
        }
        
        // 继续渲染循环
        this.scheduleRender();
    }
    
    // 检测节点悬浮
    checkNodeHover(worldPos, screenX, screenY) {
        // 查找鼠标下方的节点（从后往前，优先检测最上层的节点）
        let hoveredNode = null;
        for (let i = this.nodes.length - 1; i >= 0; i--) {
            const node = this.nodes[i];
            if (isPointInRect(worldPos.x, worldPos.y, node.x, node.y, node.width, node.height)) {
                hoveredNode = node;
                break;
            }
        }
        
        // 如果悬浮的节点发生变化
        if (hoveredNode !== this.hoveredNode) {
            // 清除之前的定时器
            if (this.hoverTimeout) {
                clearTimeout(this.hoverTimeout);
                this.hoverTimeout = null;
            }
            
            // 隐藏之前的提示框
            this.hideTooltip();
            
            // 更新当前悬浮的节点
            this.hoveredNode = hoveredNode;
            
            // 如果有新节点且节点有描述信息，设置定时器显示提示框
            if (hoveredNode && hoveredNode.description && hoveredNode.description.trim()) {
                this.hoverStartTime = Date.now();
                // 使用函数参数传递节点引用，避免闭包中的引用问题
                this.hoverTimeout = setTimeout((nodeRef) => {
                    // 再次检查节点是否仍然被悬浮
                    if (this.hoveredNode === nodeRef) {
                        // 使用当前的鼠标位置计算提示框位置
                        const rect = this.canvas.getBoundingClientRect();
                        const currentScreenX = this.lastMouseX - rect.left;
                        const currentScreenY = this.lastMouseY - rect.top;
                        this.showTooltip(nodeRef, currentScreenX, currentScreenY);
                    }
                }, 1000, hoveredNode); // 1秒后显示
            }
        }
    }
    
    // 显示节点提示框
    showTooltip(node, screenX, screenY) {
        try {
            // 如果提示框已存在，先移除
            this.hideTooltip();
            
            // 创建提示框元素
            const tooltip = document.createElement('div');
            tooltip.className = 'node-tooltip';
            tooltip.id = 'node-tooltip';
            
            // 设置样式 - 使用更可靠的样式设置方式
            tooltip.style.position = 'absolute';
            tooltip.style.minWidth = '150px';
            tooltip.style.maxWidth = '300px';
            tooltip.style.padding = '8px 12px';
            tooltip.style.borderRadius = '4px';
            tooltip.style.boxShadow = '0 2px 8px rgba(0, 0, 0, 0.2)';
            tooltip.style.fontSize = '12px';
            tooltip.style.lineHeight = '1.4';
            tooltip.style.zIndex = '10000';
            tooltip.style.pointerEvents = 'none';
            tooltip.style.wordWrap = 'break-word';
            tooltip.style.whiteSpace = 'pre-wrap';
            tooltip.style.opacity = '0';
            tooltip.style.transition = 'opacity 0.2s ease-in-out';
            
            // 根据主题设置颜色
            const isLight = document.body.classList.contains('light-mode');
            tooltip.style.backgroundColor = isLight ? '#ffffff' : '#2d2d30';
            tooltip.style.color = isLight ? '#333333' : '#e0e0e0';
            tooltip.style.border = `1px solid ${isLight ? '#ccc' : '#3e3e42'}`;
            
            // 设置内容
            tooltip.textContent = node.description || '';
            
            // 添加到body
            document.body.appendChild(tooltip);
            
            // 计算位置：使用鼠标位置而不是节点位置
            const rect = this.canvas.getBoundingClientRect();
            let tooltipX = this.lastMouseX + 10; // 鼠标右侧10px
            let tooltipY = this.lastMouseY + 10; // 鼠标下方10px
            
            // 确保提示框不会超出视口边界
            const tooltipRect = tooltip.getBoundingClientRect();
            if (tooltipX + tooltipRect.width > window.innerWidth) {
                tooltipX = this.lastMouseX - tooltipRect.width - 10;
            }
            if (tooltipY + tooltipRect.height > window.innerHeight) {
                tooltipY = this.lastMouseY - tooltipRect.height - 10;
            }
            
            // 设置位置
            tooltip.style.left = tooltipX + 'px';
            tooltip.style.top = tooltipY + 'px';
            
            // 触发重排后再设置opacity，实现淡入效果
            tooltip.offsetHeight; // 强制重排
            tooltip.style.opacity = '1';
            
            this.tooltipElement = tooltip;
        } catch (error) {
            console.error('Error showing tooltip:', error);
        }
    }
    
    // 隐藏节点提示框
    hideTooltip() {
        try {
            // 如果有定时器，清除它
            if (this.hoverTimeout) {
                clearTimeout(this.hoverTimeout);
                this.hoverTimeout = null;
            }
            
            // 移除提示框元素
            if (this.tooltipElement && document.body.contains(this.tooltipElement)) {
                // 添加淡出效果
                this.tooltipElement.style.opacity = '0';
                setTimeout(() => {
                    if (this.tooltipElement && document.body.contains(this.tooltipElement)) {
                        this.tooltipElement.remove();
                    }
                }, 200); // 等待淡出动画完成
            }
            
            // 重置状态
            this.tooltipElement = null;
            this.hoveredNode = null;
            this.hoverStartTime = 0;
        } catch (error) {
            console.error('Error hiding tooltip:', error);
            // 确保状态被重置
            this.tooltipElement = null;
            this.hoveredNode = null;
            this.hoverTimeout = null;
            this.hoverStartTime = 0;
        }
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