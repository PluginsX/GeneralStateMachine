import { HistoryManager } from '../history/history.js';
import { exportAsImage, exportMarkdown, saveProject } from '../io/export.js';
import { handleFileSelect, openProject, handleProjectFileSelect, handleJSONFileSelect, handleYAMLFileSelect } from '../io/import.js';
import { showConnectionProperties, updatePropertyPanel } from '../ui/panel.js';
import { isLightMode, toggleTheme } from '../ui/theme.js';
import { deepClone } from '../utils/common.js';
import { showContextMenu } from '../utils/dom.js';
import { doRectsOverlap, isPointInRect, isPointNearLine } from '../utils/math.js';
import { ConfirmDialog } from '../utils/popup.js';
import { VisibilityCuller, LODManager, QuadTree, PerformanceMonitor, perfLog } from '../utils/performance.js';
import { Vector2, Color } from '../math/GraphicsMath.js';
import { Transform2D } from '../math/Transform.js';
import LegacyShortcutManager from '../core/LegacyShortcutManager.js';
import Condition from '../core/condition.js';
import ConnectionModel from '../models/ConnectionModel.js';
import NodeModel from '../models/NodeModel.js';
// 已经使用NodeModel，不需要导入Node
import NodeService from '../services/NodeService.js';
import { TextContent } from '../models/TextContent.js';

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
export default class NodeGraphEditorController {
    constructor(canvasId) {
        // 获取DOM元素
        this.canvas = document.getElementById(canvasId);
        this.ctx = this.canvas.getContext('2d');
        this.selectionRectangle = document.querySelector('.selection-rectangle');
        this.zoomLevelDisplay = document.getElementById('zoom-level');
        
        // 编辑器状态
        this.nodes = [];
        this.connections = [];
        this.textContents = []; // 文字内容数组
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
        
        // 实时排列相关状态
        this.forceSimulation = null;
        this.isRealTimeArrangeActive = false;
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
        
        // 快捷键管理器
        this.shortcutManager = new LegacyShortcutManager(this);
        
        // 性能优化
        this.animationId = null;
        this.lastRenderTime = 0;
        this.renderDelay = 16; // ~60FPS
        this.renderCount = 0;
        
        // 性能优化工具
        this.visibilityCuller = new VisibilityCuller(this.canvas, this.pan, this.zoom);
        this.lodManager = new LODManager();
        this.performanceMonitor = new PerformanceMonitor();
        this.quadTree = null; // 延迟初始化（节点数 > 500 时）
        this.useQuadTree = false; // 是否使用四叉树
        
        // 节点悬浮提示框
        this.hoveredNode = null;
        this.hoverStartTime = 0;
        this.hoverTimeout = null;
        this.tooltipElement = null;
        
        // 绑定事件处理函数（用于正确移除事件监听器）
        this.boundHandleGlobalMouseMove = this.handleGlobalMouseMove.bind(this);
        this.boundHandleGlobalMouseUp = this.handleGlobalMouseUp.bind(this);
        
        // 用户输入状态检测
        this.isUserActive = true;
        this.lastUserInputTime = Date.now();
        this.noInputThreshold = 10000; // 10秒无输入阈值
        
        // 可视对象缓存
        this.visibleNodes = [];
        this.visibleConnections = [];
        this.visibleTextContents = []; // 可见的文字内容数组
        this.lastVisibleBounds = null;
        
        // 初始化
        this.init();
    }
    
    // 初始化编辑器
    init() {
        this.setupCanvas();
        this.setupEventListeners();
        this.setupUIListeners();
        this.scheduleRender();
        
        // 初始化时确保按钮状态正确
        this.updateArrangeButtonState();
        
        // 初始化状态栏（延迟执行确保DOM已加载）
        setTimeout(() => {
            this.updateStatusBar();
        }, 100);
        
        // 设置页面可见性检测
        document.addEventListener('visibilitychange', () => {
            this.isUserActive = !document.hidden;
            if (this.isUserActive) {
                this.updateUserInputStatus();
            }
        });
        
        // 设置窗口焦点检测
        window.addEventListener('focus', () => {
            this.isUserActive = true;
            this.updateUserInputStatus();
        });
        
        window.addEventListener('blur', () => {
            this.isUserActive = false;
        });
        
        // 定期检查用户输入状态
        setInterval(() => this.checkUserInputState(), 500);
    }
    
    // 更新用户输入状态
    updateUserInputStatus() {
        this.lastUserInputTime = Date.now();
        this.isUserActive = true;
    }
    
    // 检查用户输入状态
    checkUserInputState() {
        const currentTime = Date.now();
        const timeSinceLastInput = currentTime - this.lastUserInputTime;
        
        // 如果超过阈值且页面不可见或未聚焦，则认为用户不活动
        if (timeSinceLastInput > this.noInputThreshold || !this.isUserActive) {
            this.isUserActive = false;
        } else {
            this.isUserActive = true;
        }
    }
    
    /**
     * 更新可视对象缓存
     * @param {boolean} forceUpdate - 是否强制更新（即使可视区域没有变化）
     */
    updateVisibleObjects(forceUpdate = false) {
        // 更新可视性检测器的视图状态
        this.visibilityCuller.updateView(this.pan, this.zoom);
        
        // 获取当前可视区域
        const visibleBounds = this.visibilityCuller.getVisibleBounds();
        
        // 检查是否需要更新（视图变化时才更新，除非强制更新）
        if (!forceUpdate && this.lastVisibleBounds && 
            Math.abs(this.lastVisibleBounds.minX - visibleBounds.minX) < 1 &&
            Math.abs(this.lastVisibleBounds.minY - visibleBounds.minY) < 1 &&
            Math.abs(this.lastVisibleBounds.maxX - visibleBounds.maxX) < 1 &&
            Math.abs(this.lastVisibleBounds.maxY - visibleBounds.maxY) < 1) {
            return; // 可视区域变化很小，不需要重新计算
        }
        
        this.lastVisibleBounds = visibleBounds;
        
        // 过滤出可见的节点
        this.visibleNodes = this.nodes.filter(node => 
            node && 
            node.id !== undefined && 
            node.transform && 
            node.transform.position && 
            this.visibilityCuller.isNodeVisible(node, visibleBounds)
        );
        
        // 过滤出可见的连线
        this.visibleConnections = [];
        const nodeMap = new Map(this.nodes
            .filter(node => node && node.id !== undefined)
            .map(node => [node.id, node])
        );
        
        for (const connection of this.connections) {
            const sourceNode = nodeMap.get(connection.sourceNodeId);
            const targetNode = nodeMap.get(connection.targetNodeId);
            if (sourceNode && targetNode && 
                this.visibilityCuller.isConnectionVisible(connection, sourceNode, targetNode, visibleBounds)) {
                this.visibleConnections.push(connection);
            }
        }
        
        // 过滤出可见的文字对象
        this.visibleTextContents = this.textContents.filter(textContent => 
            textContent && 
            textContent.id !== undefined && 
            textContent.transform && 
            textContent.transform.position && 
            this.visibilityCuller.isNodeVisible(textContent, visibleBounds)
        );
    }
    
    // 处理实时自动排列
    handleRealTimeArrange() {
        try {
            // 检查是否已有活跃的D3力导向图模拟，避免重复创建
            if (this.isRealTimeArrangeActive) {
                this.stopRealTimeArrange();
                this.showNotification('D3力导向图模拟已停止');
                return;
            }
            
            // 判断是否有选中的节点
            const selectedNodes = this.selectedElements.filter(el => el instanceof Node);
            
            // 确定要排列的节点：如果有选中的节点，则仅使用选中的节点；否则使用全局节点
            let nodes;
            if (selectedNodes.length > 0) {
                // 仅排列选中的节点
                nodes = selectedNodes;
            } else {
                // 没有选中任何节点，或选中的只有连接没有节点，则排列全局节点
                nodes = this.nodes;
            }
            
            if (nodes.length === 0) {
                this.showNotification('没有节点需要排列');
                return;
            }
            
            // 启动D3力导向图模拟
            this.startForceLayoutSimulation(nodes);
            
        } catch (error) {
            console.error('处理D3力导向图模拟时发生错误:', error);
            // 发生错误时，确保状态被正确重置
            this.stopRealTimeArrange();
        }
    }
    
    // 启动D3力导向图模拟
    startForceLayoutSimulation(nodes) {
        // 导入LayoutService
        import('../services/LayoutService.js').then(({ default: LayoutService }) => {
            // 获取与这些节点相关的连接（只包含两端都在节点列表中的连接）
            const nodeIds = new Set(nodes.map(n => n.id));
            const connections = this.connections
                .filter(conn => nodeIds.has(conn.sourceNodeId) && nodeIds.has(conn.targetNodeId));
            
            // 获取画布尺寸
            const canvasWidth = this.canvas.width || 800;
            const canvasHeight = this.canvas.height || 600;
            
            // 创建D3力导向图模拟
            const simulation = LayoutService.createRealTimeSimulation(
                nodes, 
                connections, 
                () => {
                    // 每次tick后触发重新渲染
                    this.scheduleRender();
                },
                canvasWidth,
                canvasHeight
            );
            
            if (simulation) {
                // 保存模拟对象
                this.forceSimulation = simulation;
                
                // 设置排列状态为活跃
                this.isRealTimeArrangeActive = true;
                
                // 更新按钮状态
                this.updateArrangeButtonState();
                
                // 更新状态栏
                this.updateStatusBar();
                
                // 显示通知
                this.showNotification('D3力导向图模拟已启动');
                
                // 初始渲染
                this.scheduleRender();
            } else {
                this.showNotification('无法创建D3力导向图模拟，请检查D3.js是否已加载');
            }
            
        }).catch(error => {
            console.error('无法加载LayoutService:', error);
            this.showNotification('布局服务加载失败');
        });
    }
    
    // 使用树形结构排列节点（从左到右，从上到下）
    performTreeLayoutArrange(nodes) {
        console.log('开始使用树形结构进行节点排列');
        
        // 导入LayoutService
        import('../services/LayoutService.js').then(({ default: LayoutService }) => {
            // 获取与这些节点相关的连接（只包含两端都在节点列表中的连接）
            const nodeIds = new Set(nodes.map(n => n.id));
            const connections = this.connections
                .filter(conn => nodeIds.has(conn.sourceNodeId) && nodeIds.has(conn.targetNodeId));
            
            // 使用树形布局服务
            LayoutService.arrangeWithTreeLayout(nodes, connections, {
                horizontalSpacing: 200,
                verticalSpacing: 100,
                startX: 100,
                startY: 100
            }).then(result => {
                // 应用计算出的位置
                nodes.forEach(node => {
                    const position = result.positions[node.id];
                    if (position) {
                        // 确保transform和position存在
                        if (!node.transform) {
                            node.transform = {};
                        }
                        if (!node.transform.position) {
                            node.transform.position = { x: 0, y: 0 };
                        }
                        
                        // 设置新位置
                        node.transform.position.x = position.x;
                        node.transform.position.y = position.y;
                    }
                });
                
                // 设置排列状态为活跃
                this.isRealTimeArrangeActive = true;
                
                // 更新按钮状态
                this.updateArrangeButtonState();
                
                // 更新状态栏
                this.updateStatusBar();
                
                // 调度渲染以显示更新后的位置
                this.scheduleRender();
                
                // 显示通知
                this.showNotification('树形结构排列已完成');
                
            }).catch(error => {
                console.error('树形排列失败:', error);
                this.showNotification('树形排列失败，请检查节点连接');
            });
        }).catch(error => {
            console.error('无法加载LayoutService:', error);
            this.showNotification('布局服务加载失败');
        });
    }
    
    // 停止实时排列
    stopRealTimeArrange() {
        // 停止D3力导向图模拟
        if (this.forceSimulation) {
            this.forceSimulation.stop();
            this.forceSimulation = null;
        }
        
        this.isRealTimeArrangeActive = false;
        
        // 更新按钮状态
        this.updateArrangeButtonState();
        
        // 更新状态栏
        this.updateStatusBar();
        
        // 显示通知
        this.showNotification('D3力导向图模拟已停止');
    }
    
    // 更新排列按钮状态
    updateArrangeButtonState() {
        // 直接获取按钮元素（不依赖toolbar）
        const button = document.getElementById('real-time-arrange');
        
        if (button) {
            // 更新按钮文字
            button.textContent = this.isRealTimeArrangeActive ? '停止力导向图' : '启动力导向图';
            
            // 更新按钮样式（添加/移除 active-green 类）
            if (this.isRealTimeArrangeActive) {
                button.classList.add('active-green');
            } else {
                button.classList.remove('active-green');
            }
        }
        
        // 同时更新单次自动排列按钮的可用性
        const autoArrangeBtn = document.getElementById('auto-arrange-btn');
        if (autoArrangeBtn) {
            if (this.isRealTimeArrangeActive) {
                autoArrangeBtn.classList.add('disabled');
                autoArrangeBtn.disabled = true;
            } else {
                autoArrangeBtn.classList.remove('disabled');
                autoArrangeBtn.disabled = false;
            }
        }
        
        // 如果toolbar存在，也调用它的方法（保持兼容性）
        if (this.toolbar && typeof this.toolbar.updateArrangeButtons === 'function') {
            this.toolbar.updateArrangeButtons(this.isRealTimeArrangeActive);
        }
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
        // 确保pan和zoom是有效的数值
        const panX = typeof this.pan.x === 'number' && !isNaN(this.pan.x) ? this.pan.x : 0;
        const panY = typeof this.pan.y === 'number' && !isNaN(this.pan.y) ? this.pan.y : 0;
        const zoomLevel = typeof this.zoom === 'number' && !isNaN(this.zoom) && this.zoom > 0 ? this.zoom : 1;
        
        // 应用坐标转换
        const worldX = (x - panX) / zoomLevel;
        const worldY = (y - panY) / zoomLevel;
        
        // 返回Vector2实例，确保与NodeModel和Transform2D兼容
        return new Vector2(worldX, worldY);
    }
    
    // 世界坐标转屏幕坐标
    worldToScreen(x, y) {
        // 确保pan和zoom是有效的数值
        const panX = typeof this.pan.x === 'number' && !isNaN(this.pan.x) ? this.pan.x : 0;
        const panY = typeof this.pan.y === 'number' && !isNaN(this.pan.y) ? this.pan.y : 0;
        const zoomLevel = typeof this.zoom === 'number' && !isNaN(this.zoom) && this.zoom > 0 ? this.zoom : 1;
        
        // 应用坐标转换
        const screenX = x * zoomLevel + panX;
        const screenY = y * zoomLevel + panY;
        
        return { x: screenX, y: screenY };
    }
    
    // 设置事件监听器
    setupEventListeners() {
        // 鼠标事件
        this.canvas.addEventListener('mousedown', e => this.handleMouseDown(e));
        this.canvas.addEventListener('mousemove', e => this.handleMouseMove(e));
        this.canvas.addEventListener('mouseup', e => this.handleMouseUp(e));
        this.canvas.addEventListener('wheel', e => this.handleWheel(e));
        this.canvas.addEventListener('dblclick', e => this.handleDoubleClick(e));
        
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
        document.getElementById('import-json').addEventListener('click', () => 
            document.getElementById('json-input').click());
        document.getElementById('import-yaml').addEventListener('click', () => 
            document.getElementById('yaml-input').click());
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
        
        // 自动排列
        document.getElementById('auto-arrange-btn').addEventListener('click', () => this.arrangeNodesWithForceLayout());
        // 实时自动排列
        document.getElementById('real-time-arrange').addEventListener('click', () => {
            try {
                // 直接调用当前NodeGraphEditor实例的handleRealTimeArrange方法
                this.handleRealTimeArrange();
            } catch (error) {
                console.error('点击实时排列按钮时发生错误:', error);
            }
        });
        
        // 属性面板
        document.getElementById('update-node').addEventListener('click', () => this.updateSelectedNode());
        document.getElementById('delete-node').addEventListener('click', () => this.deleteSelectedNodes());
        document.getElementById('add-condition').addEventListener('click', () => this.addCondition());
        document.getElementById('delete-connection').addEventListener('click', () => this.deleteSelectedConnections());
        
        // 添加文字按钮
        document.getElementById('add-text').addEventListener('click', () => this.addTextAtCenter());
        
        // 自适应尺寸切换
        document.getElementById('node-autosize').addEventListener('change', e => {
            this.toggleAutoSize(e.target.checked);
        });
        
        // 文件输入
        document.getElementById('file-input').addEventListener('change', e => handleFileSelect(e, this));
        document.getElementById('json-input').addEventListener('change', e => handleJSONFileSelect(e, this));
        document.getElementById('yaml-input').addEventListener('change', e => handleYAMLFileSelect(e, this));
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
        // 强制更新可见对象列表，确保撤销操作后的对象状态正确
        this.updateVisibleObjects(true);
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
        // 强制更新可见对象列表，确保重做操作后的对象状态正确
        this.updateVisibleObjects(true);
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
            if (node.transform && node.transform.position) {
                minX = Math.min(minX, node.transform.position.x);
                minY = Math.min(minY, node.transform.position.y);
                maxX = Math.max(maxX, node.transform.position.x + node.width);
                maxY = Math.max(maxY, node.transform.position.y + node.height);
            }
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
        // 限制缩放范围在 0.1 (10%) 到 5.0 (500%) 之间
        this.zoom = Math.max(0.1, Math.min(scaleX, scaleY, 5.0));
        
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
        this.updateUserInputStatus();
        const rect = this.canvas.getBoundingClientRect();
        const x = e.clientX - rect.left;
        const y = e.clientY - rect.top;
        this.lastMouseX = e.clientX;
        this.lastMouseY = e.clientY;
        const worldPos = this.screenToWorld(x, y);
        
        // 调试右键坐标转换
        if (e.button === 2) {
            console.log('右键坐标转换调试:');
            console.log('- e.clientX, e.clientY:', e.clientX, e.clientY);
            console.log('- rect.left, rect.top:', rect.left, rect.top);
            console.log('- canvas相对坐标 x, y:', x, y);
            console.log('- 当前 pan:', this.pan);
            console.log('- 当前 zoom:', this.zoom);
            console.log('- 转换后的 worldPos:', worldPos);
        }
        
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
            // 如果正在创建连接，需要特殊处理
            if (this.creatingConnection) {
                // 检查是否点击了节点
                const clickedNode = this.visibleNodes.find(node => 
                    node.transform && node.transform.position &&
                    isPointInRect(worldPos.x, worldPos.y, {
                        x: node.transform.position.x,
                        y: node.transform.position.y,
                        width: node.width,
                        height: node.height
                    })
                );
                
                if (clickedNode) {
                    // 如果点击了节点，完成连接创建
                    this.finishConnectionCreation(clickedNode.id);
                } else {
                    // 如果点击的不是节点，取消连接创建
                    this.creatingConnection = null;
                    this.scheduleRender();
                }
                return;
            }
            
            // 正常情况下的左键处理（非连接创建状态）
            // 首先检查是否点击了文字内容对象（优先检测，因为文字内容可能在节点上方）
            if (this.textContents && this.textContents.length > 0) {
                const clickedText = this.textContents.find(text => {
                    const position = (text.transform && text.transform.position) ? 
                        text.transform.position : { x: 0, y: 0 };
                    return isPointInRect(worldPos.x, worldPos.y, {
                        x: position.x,
                        y: position.y,
                        width: text.width || 200,
                        height: text.height || 100
                    });
                });
                
                if (clickedText) {
                    this.handleTextContentClick(clickedText, worldPos, e);
                    return;
                }
            }
            
            // 检查是否点击了节点
            const clickedNode = this.visibleNodes.find(node => 
                node.transform && node.transform.position &&
                isPointInRect(worldPos.x, worldPos.y, {
                    x: node.transform.position.x,
                    y: node.transform.position.y,
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
        
        // 如果节点已经被选中且按住Ctrl键，取消选择该节点
        if (isAlreadySelected && (e.ctrlKey || e.metaKey)) {
            const index = this.selectedElements.findIndex(el => el.id === node.id);
            if (index !== -1) {
                this.selectedElements.splice(index, 1);
                // 同步更新viewModel中的选中状态
                if (this.viewModel && this.viewModel.getNodeViewModel()) {
                    this.viewModel.getNodeViewModel().deselectNode(node.id);
                }
                updatePropertyPanel(this);
                this.scheduleRender();
            }
            return;
        }
        
        // 如果节点已经被选中（且没有按住Ctrl键），准备拖动
        if (isAlreadySelected) {
            // 将点击的节点移到最上层（显示层次优化）
            this.bringNodeToFront(node);
            
            // 准备拖动
            this.draggingElement = node;
            const nodePos = (node.transform && node.transform.position) ? 
                node.transform.position : { x: 0, y: 0 };
            this.draggingOffset.x = worldPos.x - nodePos.x;
            this.draggingOffset.y = worldPos.y - nodePos.y;
            return;
        }
        
        // 新选择节点的情况
        if (!isAlreadySelected) {
            // 清空之前的选择（除非按住Ctrl键）
            if (!(e.ctrlKey || e.metaKey)) {
                this.selectedElements = [];
            }
            
            // 确保节点有type属性（关键修复：确保节点可以被正确识别）
            if (!node.type) {
                node.type = 'node';
            }
            
            // 添加新节点到选择列表
            this.selectedElements.push(node);
            
            // 同步更新viewModel中的选中状态
            if (this.viewModel && this.viewModel.getNodeViewModel()) {
                this.viewModel.getNodeViewModel().selectNode(node.id, e.ctrlKey || e.metaKey);
            }
            
            updatePropertyPanel(this);
            this.scheduleRender();
            
            // 将点击的节点移到最上层（显示层次优化）
            this.bringNodeToFront(node);
            
            // 准备拖动
            this.draggingElement = node;
            const nodePos = (node.transform && node.transform.position) ? 
                node.transform.position : { x: 0, y: 0 };
            this.draggingOffset.x = worldPos.x - nodePos.x;
            this.draggingOffset.y = worldPos.y - nodePos.y;
        }
        
        // 选择逻辑已经在前面的条件分支中处理完成
        // 新的实现确保了selectedElements和viewModel的selectedNodeIds同步
        
        // 应用筛选器
        this.filterSelectedElements();
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
    
    // 处理文字内容点击（参考handleNodeClick的实现）
    handleTextContentClick(textContent, worldPos, e) {
        // 根据筛选器判断是否可以选择文字内容
        if (this.selectionFilter === 'nodes' || this.selectionFilter === 'connections') {
            // 如果筛选器设置为仅选择节点或连线，则忽略文字内容点击
            return;
        }
        
        // 检查文字内容是否已经被选中
        const isAlreadySelected = this.selectedElements.some(el => el.id === textContent.id);
        
        // 如果文字内容已经被选中且按住Ctrl键，取消选择
        if (isAlreadySelected && (e.ctrlKey || e.metaKey)) {
            const index = this.selectedElements.findIndex(el => el.id === textContent.id);
            if (index !== -1) {
                this.selectedElements.splice(index, 1);
                updatePropertyPanel(this);
                this.scheduleRender();
            }
            return;
        }
        
        // 如果文字内容已经被选中（且没有按住Ctrl键），准备拖动
        if (isAlreadySelected) {
            // 准备拖动
            this.draggingElement = textContent;
            const textPos = (textContent.transform && textContent.transform.position) ? 
                textContent.transform.position : { x: 0, y: 0 };
            this.draggingOffset.x = worldPos.x - textPos.x;
            this.draggingOffset.y = worldPos.y - textPos.y;
            return;
        }
        
        // 新选择文字内容的情况
        if (!isAlreadySelected) {
            // 清空之前的选择（除非按住Ctrl键）
            if (!(e.ctrlKey || e.metaKey)) {
                this.selectedElements = [];
            }
            
            // 添加新文字内容到选择列表
            this.selectedElements.push(textContent);
            
            updatePropertyPanel(this);
            this.scheduleRender();
            
            // 准备拖动
            this.draggingElement = textContent;
            const textPos = (textContent.transform && textContent.transform.position) ? 
                textContent.transform.position : { x: 0, y: 0 };
            this.draggingOffset.x = worldPos.x - textPos.x;
            this.draggingOffset.y = worldPos.y - textPos.y;
        }
        
        // 应用筛选器
        this.filterSelectedElements();
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
            // 确保连接有type属性（关键修复：确保连接可以被正确识别）
            if (!connection.type) {
                connection.type = 'connection';
            }
            
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
        this.updateUserInputStatus();
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
        
        // 拖动文字内容对象处理（支持多选拖动）
        if (this.draggingElement && this.draggingElement.type === 'text') {
            // 确保transform对象存在，并获取当前位置（统一使用transform.position）
            if (!this.draggingElement.transform) {
                this.draggingElement.transform = {};
            }
            if (!this.draggingElement.transform.position) {
                this.draggingElement.transform.position = { x: 0, y: 0 };
            }
            
            // 计算拖动偏移量（使用transform.position而不是x/y属性）
            const deltaX = worldPos.x - this.draggingElement.transform.position.x - this.draggingOffset.x;
            const deltaY = worldPos.y - this.draggingElement.transform.position.y - this.draggingOffset.y;
            
            // 获取所有选中的文字内容对象
            const selectedTexts = this.selectedElements.filter(el => el.type === 'text');
            
            // 如果只有一个文字对象被选中，直接移动它
            if (selectedTexts.length === 1) {
                // 计算新位置
                const newX = worldPos.x - this.draggingOffset.x;
                const newY = worldPos.y - this.draggingOffset.y;
                
                // 更新transform.position
                this.draggingElement.transform.position.x = newX;
                this.draggingElement.transform.position.y = newY;
            } else {
                // 如果有多个文字对象被选中，移动所有选中的文字对象
                selectedTexts.forEach(text => {
                    const textPos = (text.transform && text.transform.position) ? 
                        text.transform.position : { x: 0, y: 0 };
                    
                    // 确保transform对象存在
                    if (!text.transform) {
                        text.transform = {};
                    }
                    if (!text.transform.position) {
                        text.transform.position = { x: 0, y: 0 };
                    }
                    
                    // 更新transform.position中的坐标
                    text.transform.position.x = textPos.x + deltaX;
                    text.transform.position.y = textPos.y + deltaY;
                });
                // 更新拖动偏移量，以便下次移动时使用正确的偏移
                const dragTextPos = (this.draggingElement.transform && this.draggingElement.transform.position) ? 
                    this.draggingElement.transform.position : { x: 0, y: 0 };
                this.draggingOffset.x = worldPos.x - dragTextPos.x;
                this.draggingOffset.y = worldPos.y - dragTextPos.y;
            }
            
            this.scheduleRender();
            return;
        }
        
        // 拖动节点处理（支持多选拖动）
        if (this.draggingElement && this.draggingElement.type === 'node') {
            // 确保transform对象存在，并获取当前位置（统一使用transform.position）
            if (!this.draggingElement.transform) {
                this.draggingElement.transform = {};
            }
            if (!this.draggingElement.transform.position) {
                this.draggingElement.transform.position = { x: 0, y: 0 };
            }
            
            // 计算拖动偏移量（使用transform.position而不是x/y属性）
            const deltaX = worldPos.x - this.draggingElement.transform.position.x - this.draggingOffset.x;
            const deltaY = worldPos.y - this.draggingElement.transform.position.y - this.draggingOffset.y;
            
            // 获取所有选中的节点
            const selectedNodes = this.selectedElements.filter(el => el.type === 'node');
            
            // 如果只有一个节点被选中，直接移动它
            if (selectedNodes.length === 1) {
                // 计算新位置
                const newX = worldPos.x - this.draggingOffset.x;
                const newY = worldPos.y - this.draggingOffset.y;
                
                // 更新transform.position（参考集中排列代码的做法）
                this.draggingElement.transform.position.x = newX;
                this.draggingElement.transform.position.y = newY;
                
                // 注意：在新的树形排列系统中，不再操作D3模拟中的节点位置
                // 因为树形排列是一次性计算，没有实时力导向模拟
            } else {
                // 如果有多个节点被选中，移动所有选中的节点
                selectedNodes.forEach(node => {
                    const nodePos = (node.transform && node.transform.position) ? 
                        node.transform.position : { x: 0, y: 0 };
                    
                    // 确保transform对象存在
                    if (!node.transform) {
                        node.transform = {};
                    }
                    if (!node.transform.position) {
                        node.transform.position = { x: 0, y: 0 };
                    }
                    
                    // 更新transform.position中的坐标
                    node.transform.position.x = nodePos.x + deltaX;
                    node.transform.position.y = nodePos.y + deltaY;
                    
                    // 注意：在新的树形排列系统中，不再操作D3模拟中的节点位置
                    // 因为树形排列是一次性计算，没有实时力导向模拟
                });
                // 更新拖动偏移量，以便下次移动时使用正确的偏移
                const dragNodePos = (this.draggingElement.transform && this.draggingElement.transform.position) ? 
                    this.draggingElement.transform.position : { x: 0, y: 0 };
                this.draggingOffset.x = worldPos.x - dragNodePos.x;
                this.draggingOffset.y = worldPos.y - dragNodePos.y;
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
        this.updateUserInputStatus();
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
        this.updateUserInputStatus();
        
        // 使用快捷键管理器处理键盘事件
        if (this.shortcutManager.handleKeyDown(e)) {
            return; // 快捷键已处理，直接返回
        }
        
        // 如果没有匹配的快捷键，继续原有的处理逻辑
        // （这里可以保留一些特殊的处理逻辑）
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
        const selectedTexts = this.selectedElements.filter(el => el.type === 'text');
        
        // 计算节点边界
        selectedNodes.forEach(node => {
            if (node.transform && node.transform.position) {
                minX = Math.min(minX, node.transform.position.x);
                minY = Math.min(minY, node.transform.position.y);
            }
        });
        
        // 计算文字内容对象边界
        selectedTexts.forEach(text => {
            if (text.transform && text.transform.position) {
                minX = Math.min(minX, text.transform.position.x);
                minY = Math.min(minY, text.transform.position.y);
            }
        });
        
        if (selectedNodes.length === 0 && selectedTexts.length === 0) return;
        
        // 计算偏移量
        const offsetX = worldPos.x - minX;
        const offsetY = worldPos.y - minY;
        
        // 创建节点映射（旧ID -> 新节点）
        const nodeMap = new Map();
        const newNodes = [];
        const newConnections = [];
        const newTexts = [];
        
        // 复制节点
        selectedNodes.forEach(node => {
            const nodePos = (node.transform && node.transform.position) ? node.transform.position : { x: 0, y: 0 };
            const newPosition = new Vector2(nodePos.x + offsetX, nodePos.y + offsetY);
            const newNode = new NodeModel({
                name: node.name,
                position: newPosition,
                description: node.description,
                width: node.width,
                height: node.height,
                autoSize: node.autoSize,
                color: node.color,
                group: node.group || ''
            });
            // 确保transform正确设置
            if (!newNode.transform) {
                newNode.transform = new Transform2D(newPosition, 0, new Vector2(1, 1));
            } else {
                newNode.transform.position = newPosition;
            }
            nodeMap.set(node.id, newNode);
            newNodes.push(newNode);
        });
        
        // 复制文字内容对象
        selectedTexts.forEach(text => {
            const textPos = (text.transform && text.transform.position) ? text.transform.position : { x: 0, y: 0 };
            const newPosition = new Vector2(textPos.x + offsetX, textPos.y + offsetY);
            const newText = new TextContent({
                text: text.text || '',
                width: text.width || 200,
                height: text.height || 100,
                autoSize: text.autoSize !== undefined ? text.autoSize : true,
                fontSize: text.fontSize || 14,
                fontColor: text.fontColor || '#000000',
                fontFamily: text.fontFamily || 'Arial, sans-serif',
                fontWeight: text.fontWeight || 'normal',
                fontStyle: text.fontStyle || 'normal',
                textAlign: text.textAlign || 'left',
                textVerticalAlign: text.textVerticalAlign || 'top',
                wordWrap: text.wordWrap !== undefined ? text.wordWrap : true,
                padding: text.padding || 10,
                transform: new Transform2D(newPosition, 0, new Vector2(1, 1))
            });
            newTexts.push(newText);
        });
        
        // 复制连线（只复制选中节点之间的连线）
        const selectedNodeIds = new Set(selectedNodes.map(n => n.id));
        this.connections.forEach(conn => {
            if (selectedNodeIds.has(conn.sourceNodeId) && selectedNodeIds.has(conn.targetNodeId)) {
                const newConnection = new ConnectionModel({
                    sourceNodeId: nodeMap.get(conn.sourceNodeId).id,
                    targetNodeId: nodeMap.get(conn.targetNodeId).id
                });
                // 复制条件
                if (conn.conditions && Array.isArray(conn.conditions)) {
                    conn.conditions.forEach(cond => {
                        const newCond = new Condition(cond.type, cond.key, cond.operator, cond.value);
                        newConnection.conditions.push(newCond);
                    });
                }
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
            connections: newConnections.map(c => c.clone()),
            textContents: newTexts.map(t => t.clone())
        });
        
        // 添加新节点、连线和文字内容对象
        newNodes.forEach(node => this.nodes.push(node));
        newConnections.forEach(conn => this.connections.push(conn));
        newTexts.forEach(text => {
            if (!this.textContents) {
                this.textContents = [];
            }
            this.textContents.push(text);
        });
        
        // 选中新创建的元素
        this.selectedElements = [...newNodes, ...newTexts];
        
        // 强制更新可见对象列表，确保导入的对象可以被鼠标事件检测到
        this.updateVisibleObjects(true);
        updatePropertyPanel(this);
        this.scheduleRender();
    }
    
    // 处理全局鼠标松开事件（用于在画布外松开鼠标时停止平移）
    handleGlobalMouseUpForPanning(e) {
        this.updateUserInputStatus();
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
            // 注意：在新的树形排列系统中，不再操作D3模拟中的节点位置
            // 因为树形排列是一次性计算，没有实时力导向模拟
            
            this.draggingElement = null;
        }
        
        this.scheduleRender();
    }
    
    // 处理全局鼠标移动（框选）
    handleGlobalMouseMove(e) {
        this.updateUserInputStatus();
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
        this.updateUserInputStatus();
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
        this.updateUserInputStatus();
        // 框选过程中鼠标离开画布时不结束框选
        if (this.isSelecting) return;
        
        // 重置提示框状态
        this.resetTooltipState();
        
        // 结束拖动和平移
        this.stopPanningAndDragging();
    }
    
    // 处理滚轮事件（缩放）
    handleWheel(e) {
        this.updateUserInputStatus();
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
            // 确保worldPos是Vector2对象或包含x和y属性的对象
            const position = (worldPos instanceof Vector2) ? worldPos : new Vector2(worldPos.x || 0, worldPos.y || 0);
            const newNode = new NodeModel({
                name: '新节点',
                position: position
            });
            newNode.group = ''; // 初始化Group属性
            
            // 确保transform和position正确设置（关键修复：确保新节点可以拖拽）
            if (!newNode.transform) {
                newNode.transform = new Transform2D(new Vector2(), 0, new Vector2(1, 1));
            }
            if (!newNode.transform.position) {
                newNode.transform.position = new Vector2(position.x, position.y);
            } else {
                // 如果position已存在，确保它被正确设置
                newNode.transform.position.x = position.x;
                newNode.transform.position.y = position.y;
            }
            
            this.addNode(newNode);
        } else if (type === 'connection') {
            // 开始创建连线
            const nodeUnderCursor = this.nodes.find(node => 
                node.transform && node.transform.position &&
                isPointInRect(worldPos.x, worldPos.y, {
                    x: node.transform.position.x,
                    y: node.transform.position.y,
                    width: node.width,
                    height: node.height
                })
            );
            
            if (nodeUnderCursor) {
                this.startConnectionCreation(nodeUnderCursor.id);
            }
        } else if (type === 'text') {
            // 创建文字对象
            const newText = new TextContent({
                text: '新文字',
                fontSize: 14,
                fontColor: '#000000',
                autoSize: true,
                width: 200,
                height: 50
            });
            // 设置位置
            newText.setPosition(worldPos.x, worldPos.y);
            this.addTextContent(newText);
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
            
            // 创建连接对象（使用对象参数格式）
            const newConnection = new ConnectionModel({
                sourceNodeId: this.creatingConnection.sourceNodeId,
                targetNodeId: targetNodeId,
                conditions: [] // 初始化conditions数组
            });
            
            this.addConnection(newConnection);
        }
        
        this.creatingConnection = null;
        this.scheduleRender();
    }
    
    // 处理右键点击
    handleRightClick(worldPos, screenX, screenY, clientX, clientY) {
        this.updateUserInputStatus();
        // 检查是否点击了节点 - 更健壮的节点查找逻辑
        const clickedNode = this.nodes.find(node => {
            // 尝试从节点中获取位置信息，处理不同的节点结构
            let nodeX, nodeY;
            if (node.transform && node.transform.position) {
                nodeX = node.transform.position.x;
                nodeY = node.transform.position.y;
            } else {
                // 如果既没有transform.position也没有x/y，使用默认值
                nodeX = 0;
                nodeY = 0;
            }
            
            // 确保宽度和高度有默认值
            const width = node.width || 100; // 默认宽度
            const height = node.height || 50; // 默认高度
            
            return isPointInRect(worldPos.x, worldPos.y, {
                x: nodeX,
                y: nodeY,
                width: width,
                height: height
            });
        });
        
        // 检查是否点击了连线
        const clickedConnections = this.getConnectionAtPosition(worldPos);
        const clickedConnection = clickedConnections && clickedConnections.length > 0 ? clickedConnections[0] : null;
        
        // 显示上下文菜单（无论是否点击到元素都显示）
        // 使用 clientX, clientY 作为页面坐标（相对于视口）
        let element = clickedNode || clickedConnection || null;
        
        // 为节点和连线添加类型标识，确保右键菜单正确识别
        if (element) {
            if (clickedNode) {
                element.type = 'node';
            } else if (clickedConnection) {
                element.type = 'connection';
            }
        }
        
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
        // 按节点对分组可视连线
        const connectionGroups = this.groupConnectionsByNodePair(this.visibleConnections);
        
        for (const group of connectionGroups) {
            const nodeA = this.nodes.find(n => n.id === group.nodeA);
            const nodeB = this.nodes.find(n => n.id === group.nodeB);
            
            if (!nodeA || !nodeB) continue;
            
            // 计算连线的起点和终点（使用transform.position）
            const startPos = (nodeA.transform && nodeA.transform.position) ? 
                nodeA.transform.position : { x: 0, y: 0 };
            const endPos = (nodeB.transform && nodeB.transform.position) ? 
                nodeB.transform.position : { x: 0, y: 0 };
            
            const startX = startPos.x + nodeA.width / 2;
            const startY = startPos.y + nodeA.height / 2;
            const endX = endPos.x + nodeB.width / 2;
            const endY = endPos.y + nodeB.height / 2;
            
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
        // 框选文字内容对象
        this.visibleTextContents.forEach(text => {
            const position = (text.transform && text.transform.position) ? 
                text.transform.position : { x: 0, y: 0 };
            const textCenterX = position.x + (text.width || 200) / 2;
            const textCenterY = position.y + (text.height || 30) / 2;
            
            if (textCenterX >= minX && textCenterX <= maxX && 
                textCenterY >= minY && textCenterY <= maxY) {
                // 检查是否已经被选中
                const isAlreadySelected = this.selectedElements.some(el => el.id === text.id);
                if (!isAlreadySelected) {
                    this.selectedElements.push(text);
                }
            }
        });
        
        // 框选节点（原有逻辑）
        const selectionRect = { x: minX, y: minY, width: maxX - minX, height: maxY - minY };
        
        // 根据筛选器类型选择元素
        if (this.selectionFilter === 'all' || this.selectionFilter === 'nodes') {
            this.visibleNodes.forEach(node => {
                const nodePos = node.transform && node.transform.position ? node.transform.position : { x: 0, y: 0 };
                const nodeRect = {
                    x: nodePos.x,
                    y: nodePos.y,
                    width: node.width,
                    height: node.height
                };
                
                if (doRectsOverlap(selectionRect, nodeRect)) {
                    this.selectedElements.push(node);
                }
            });
        }
        
        if (this.selectionFilter === 'all' || this.selectionFilter === 'connections') {
            this.visibleConnections.forEach(connection => {
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
        const sourcePos = sourceNode.transform && sourceNode.transform.position ? sourceNode.transform.position : { x: 0, y: 0 };
        const targetPos = targetNode.transform && targetNode.transform.position ? targetNode.transform.position : { x: 0, y: 0 };
        
        const sourceCenterX = sourcePos.x + sourceNode.width / 2;
        const sourceCenterY = sourcePos.y + sourceNode.height / 2;
        const targetCenterX = targetPos.x + targetNode.width / 2;
        const targetCenterY = targetPos.y + targetNode.height / 2;
        
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
    
    // 全选对象
    selectAll() {
        this.selectedElements = [];
        
        // 根据选择筛选器决定选择哪些对象
        if (this.selectionFilter === 'all' || this.selectionFilter === 'nodes') {
            // 添加所有节点（直接添加NodeModel实例，保持与其他地方一致）
            this.nodes.forEach(node => {
                this.selectedElements.push(node);
            });
        }
        
        if (this.selectionFilter === 'all' || this.selectionFilter === 'connections') {
            // 添加所有连线（直接添加ConnectionModel实例，保持与其他地方一致）
            this.connections.forEach(connection => {
                this.selectedElements.push(connection);
            });
        }
        
        // 添加所有文字内容对象（完善文字内容对象的交互操作）
        if (this.selectionFilter === 'all' || this.selectionFilter === 'texts') {
            if (this.textContents && Array.isArray(this.textContents)) {
                this.textContents.forEach(text => {
                    this.selectedElements.push(text);
                });
            }
        }
        
        updatePropertyPanel(this);
        this.scheduleRender();
    }
    
    // 添加节点
    addNode(node) {
        // 确保节点使用正确的默认尺寸（强制设置，防止被其他地方修改）
        node.width = 150;
        node.height = 50;
        node.autoSize = false; // 确保不是自适应尺寸
        node.group = node.group || ''; // 初始化Group属性
        
        // 确保transform和position正确设置（关键修复：确保新节点可以拖拽）
        if (!node.transform) {
            node.transform = new Transform2D(new Vector2(), 0, new Vector2(1, 1));
        }
        if (!node.transform.position) {
            // 如果position不存在，从options.position或默认值创建
            const initialPos = (node.position && (node.position instanceof Vector2 || (node.position.x !== undefined && node.position.y !== undefined))) ?
                new Vector2(node.position.x || 0, node.position.y || 0) : new Vector2(0, 0);
            node.transform.position = initialPos;
        } else {
            // 如果position已存在，确保它是Vector2对象或至少包含x和y属性
            if (!(node.transform.position instanceof Vector2)) {
                const pos = node.transform.position;
                node.transform.position = new Vector2(pos.x || 0, pos.y || 0);
            }
        }
        
        // 确保节点有type属性（关键修复：确保节点可以被正确识别和选择）
        if (!node.type) {
            node.type = 'node';
        }
        
        // 确保节点有所有必需的属性（参考右键设置固定位置时的操作）
        // 初始化D3力导向图相关参数（如果未设置）
        if (node.forceCharge === undefined) {
            node.forceCharge = -300;
        }
        if (node.forceCollideRadius === undefined) {
            node.forceCollideRadius = null;
        }
        if (node.forceStrength === undefined) {
            node.forceStrength = 1;
        }
        if (node.fixedPosition === undefined) {
            node.fixedPosition = false;
        }
        
        // 确保节点有id（如果缺失）
        if (!node.id) {
            node.id = `node_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`;
        }
        
        this.nodes.push(node);
        this.historyManager.addHistory('add-node', node.clone());
        this.selectedElements = [node];
        // 强制更新可见对象列表，确保新节点可以被鼠标事件检测到
        this.updateVisibleObjects(true);
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
        
        // 强制更新可见对象列表，确保删除的节点和连接从可见列表中移除
        this.updateVisibleObjects(true);
        updatePropertyPanel(this);
        this.scheduleRender();
    }
    
    // 添加连线
    addConnection(connection) {
        // 确保连接有type属性（关键修复：确保连接可以被正确识别）
        if (!connection.type || connection.type !== 'connection') {
            connection.type = 'connection';
        }
        
        // 确保连接有id（如果缺失）
        if (!connection.id) {
            connection.id = `connection_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`;
        }
        
        // 确保连接有conditions数组（关键修复：防止undefined错误）
        if (!connection.conditions || !Array.isArray(connection.conditions)) {
            connection.conditions = [];
        }
        
        // 确保连接有linkDistance和linkStrength属性（力导向图参数）
        if (connection.linkDistance === undefined) {
            connection.linkDistance = 150;
        }
        if (connection.linkStrength === undefined) {
            connection.linkStrength = 1;
        }
        
        this.connections.push(connection);
        this.historyManager.addHistory('add-connection', connection.clone());
        this.selectedElements = [connection];
        // 强制更新可见对象列表，确保新连接可以被鼠标事件检测到
        this.updateVisibleObjects(true);
        updatePropertyPanel(this);
        this.scheduleRender();
    }
    
    // 添加文字内容
    addTextContent(textContent) {
        this.textContents.push(textContent);
        this.historyManager.addHistory('add-text', textContent.clone());
        this.selectedElements = [textContent];
        // 强制更新可见对象列表，确保新文字可以被鼠标事件检测到
        this.updateVisibleObjects(true);
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
            
            // 强制更新可见对象列表，确保删除的连接从可见列表中移除
            this.updateVisibleObjects(true);
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
        NodeService.calculateAutoSize(node, this.ctx);
        
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
        NodeService.calculateAutoSize(node, this.ctx);
        
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
    async deleteSelectedNodes() {
        const nodesToDelete = this.selectedElements.filter(el => el.type === 'node');
        if (nodesToDelete.length === 0) return;
        
        // 显示确认对话框
        const confirmed = await ConfirmDialog(
            `确定要删除选中的 ${nodesToDelete.length} 个节点吗？\n这将同时删除相关的连线。`
        );
        
        if (!confirmed) return;
        
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
        updatePropertyPanel(this);
        this.scheduleRender();
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
    async deleteSelectedConnections() {
        const connectionsToDelete = this.selectedElements.filter(el => el.type === 'connection');
        if (connectionsToDelete.length === 0) return;
        
        // 显示确认对话框
        const confirmed = await ConfirmDialog(
            `确定要删除选中的 ${connectionsToDelete.length} 条连线吗？`
        );
        
        if (!confirmed) return;
        
        // 记录历史
        this.historyManager.addHistory('delete-connections', connectionsToDelete.map(c => c.clone()));
        
        // 删除连线
        connectionsToDelete.forEach(conn => this.removeConnection(conn.id));
        
        this.deselectAll();
        updatePropertyPanel(this);
        this.scheduleRender();
    }
    
    // 删除选中的文字对象
    deleteSelectedTextContents() {
        const textContentsToDelete = this.selectedElements.filter(el => el.type === 'text');
        if (textContentsToDelete.length === 0) return;
        
        // 显示确认对话框
        const confirmed = confirm(
            `确定要删除选中的 ${textContentsToDelete.length} 个文字对象吗？`
        );
        
        if (!confirmed) return;
        
        // 记录历史
        this.historyManager.addHistory({
            type: 'delete-text-contents',
            textContents: textContentsToDelete.map(t => t.clone()),
            editor: this // 添加editor实例引用
        });
        
        // 删除文字对象
        textContentsToDelete.forEach(text => this.removeTextContent(text.id));
        
        this.deselectAll();
        updatePropertyPanel(this);
        this.scheduleRender();
    }
    
    // 在视图中心添加文字对象
    addTextAtCenter() {
        const centerX = this.canvas.width / 2;
        const centerY = this.canvas.height / 2;
        const worldPos = this.screenToWorld(centerX, centerY);
        
        const defaultText = '双击编辑文字';
        const position = new Vector2(worldPos.x, worldPos.y);
        const textContent = new TextContent({
            text: defaultText,
            transform: new Transform2D(position, 0, new Vector2(1, 1))
        });
        this.addTextContent(textContent);
    }
    
    // 根据ID获取文字对象
    getTextContentById(id) {
        return this.textContents.find(text => text.id === id);
    }
    
    // 开始编辑文字对象
    startEditTextContent(textContent) {
        // 保存当前编辑的文字对象
        this.editingTextContent = textContent;
        
        // 创建一个临时的输入框用于编辑
        const input = document.createElement('input');
        input.type = 'text';
        input.value = textContent.text;
        input.style.position = 'absolute';
        input.style.left = '0px';
        input.style.top = '0px';
        input.style.zIndex = '10000';
        input.style.fontSize = '14px';
        input.style.padding = '4px 8px';
        input.style.border = '1px solid #007acc';
        input.style.borderRadius = '3px';
        input.style.outline = 'none';
        input.style.backgroundColor = 'white';
        
        // 将输入框添加到body
        document.body.appendChild(input);
        
        // 将文字对象的屏幕坐标计算出来
        const textPos = (textContent.transform && textContent.transform.position) ? 
            textContent.transform.position : { x: 0, y: 0 };
        const screenPos = this.worldToScreen(textPos.x, textPos.y);
        
        // 设置输入框位置
        const canvasRect = this.canvas.getBoundingClientRect();
        input.style.left = (canvasRect.left + screenPos.x) + 'px';
        input.style.top = (canvasRect.top + screenPos.y - 10) + 'px';
        
        // 选中文本
        input.select();
        input.focus();
        
        // 保存原始文本内容
        const originalText = textContent.text;
        
        // 完成编辑的函数
        const finishEdit = () => {
            const newText = input.value.trim();
            
            // 如果文本发生了变化，则更新并添加历史记录
            if (newText !== originalText) {
                // 保存当前状态用于撤销
                const previousState = {
                    id: textContent.id,
                    text: originalText
                };
                
                // 更新文本内容
                textContent.text = newText || '双击编辑文字';
                
                // 添加历史记录
                this.addHistory({
                    type: 'update-text-content',
                    textContentId: textContent.id,
                    previousState: previousState,
                    newState: {
                        id: textContent.id,
                        text: textContent.text
                    },
                    editor: this // 添加editor实例引用
                });
                
                // 重新渲染
                this.scheduleRender();
            }
            
            // 清理
            document.body.removeChild(input);
            this.editingTextContent = null;
        };
        
        // 取消编辑的函数
        const cancelEdit = () => {
            document.body.removeChild(input);
            this.editingTextContent = null;
        };
        
        // 绑定事件
        input.addEventListener('keydown', (e) => {
            if (e.key === 'Enter') {
                e.preventDefault();
                finishEdit();
            } else if (e.key === 'Escape') {
                e.preventDefault();
                cancelEdit();
            }
        });
        
        input.addEventListener('blur', () => {
            // 延迟执行，避免与其他事件冲突
            setTimeout(finishEdit, 10);
        });
    }
    
    // 删除文字对象
    removeTextContent(textId) {
        const index = this.textContents.findIndex(t => t.id === textId);
        if (index !== -1) {
            this.textContents.splice(index, 1);
            this.updateVisibleObjects(true);
        }
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
        
        // 手动保存状态
        const originalStrokeStyle = ctx.strokeStyle;
        const originalLineWidth = ctx.lineWidth;
        
        const canvasWidth = this.canvas.width;
        const canvasHeight = this.canvas.height;

        // 根据LOD级别调整栅格密度
        // LOD0 (zoom >= 1.0): 高密度，gridSize = 20
        // LOD1 (0.6 <= zoom < 1.0): 中密度，gridSize = 40
        // LOD2 (0.4 <= zoom < 0.6): 低密度，gridSize = 80
        // LOD3 (zoom < 0.4): 极低密度，gridSize = 200
        let gridSize;
        const lodLevel = this.lodManager.getLODLevel(this.zoom);
        switch (lodLevel) {
            case 'LOD0':
                gridSize = 20;  // 高密度
                break;
            case 'LOD1':
                gridSize = 40;  // 中密度
                break;
            case 'LOD2':
                gridSize = 80;  // 低密度
                break;
            case 'LOD3':
                gridSize = 200; // 极低密度
                break;
            default:
                gridSize = 20;
        }

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

        // 根据LOD级别调整栅格线透明度
        let gridAlpha;
        switch (lodLevel) {
            case 'LOD0':
                gridAlpha = 0.05;  // 高精度：正常透明度
                break;
            case 'LOD1':
                gridAlpha = 0.03;  // 中精度：稍低透明度
                break;
            case 'LOD2':
                gridAlpha = 0.02;  // 低精度：更低透明度
                break;
            case 'LOD3':
                gridAlpha = 0.01;  // 占位符：极低透明度
                break;
            default:
                gridAlpha = 0.05;
        }

        // 绘制主网格线
        ctx.strokeStyle = isLightMode() 
            ? `rgba(0, 0, 0, ${gridAlpha})` 
            : `rgba(255, 255, 255, ${gridAlpha})`;
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

        // 手动恢复状态
        ctx.strokeStyle = originalStrokeStyle;
        ctx.lineWidth = originalLineWidth;
    }
    

    // 绘制节点（支持LOD分级绘制）
    drawNode(ctx, node) {
        const nodePos = (node.transform && node.transform.position) ? 
            node.transform.position : { x: 0, y: 0 };
        const screenPos = this.worldToScreen(nodePos.x, nodePos.y);
        // 获取节点尺寸
        const nodeSize = (node.size && node.size.width !== undefined && node.size.height !== undefined) ? node.size : { width: 100, height: 60 };
        const width = nodeSize.width * this.zoom;
        const height = nodeSize.height * this.zoom;
        
        // 检查节点是否可见（使用可视性检测器）
        const visibleBounds = this.visibilityCuller.getVisibleBounds();
        if (!this.visibilityCuller.isNodeVisible(node, visibleBounds)) {
            // 每100个节点输出一次被过滤的日志（避免日志过多）
            if (Math.random() < 0.01) {
                perfLog(`[性能优化] 节点被可视性检测过滤`);
            }
            return;
        }
        
        // 根据缩放比例获取LOD等级
        const lodLevel = this.lodManager.getLODLevel(this.zoom);
        
        // 根据LOD等级选择绘制方法
        switch (lodLevel) {
            case 'LOD0':
                this.drawNodeLOD0(ctx, node, screenPos, width, height);
                break;
            case 'LOD1':
                this.drawNodeLOD1(ctx, node, screenPos, width, height);
                break;
            case 'LOD2':
                this.drawNodeLOD2(ctx, node, screenPos, width, height);
                break;
            case 'LOD3':
                this.drawNodeLOD3(ctx, node, screenPos, width, height);
                break;
        }
    }
    
    // LOD0：高精度（完整细节）
    drawNodeLOD0(ctx, node, screenPos, width, height) {
        // 手动保存所有会修改的状态属性
        const originalFillStyle = ctx.fillStyle;
        const originalStrokeStyle = ctx.strokeStyle;
        const originalLineWidth = ctx.lineWidth;
        const originalFont = ctx.font;
        const originalTextAlign = ctx.textAlign;
        const originalTextBaseline = ctx.textBaseline;
        
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
            const previousStrokeStyle = ctx.strokeStyle;
            const previousLineWidth = ctx.lineWidth;
            
            ctx.strokeStyle = isLightMode() ? '#000000' : '#ffffff';
            ctx.lineWidth = 2;
            const padding = 2;
            ctx.beginPath();
            ctx.roundRect(screenPos.x - padding, screenPos.y - padding, width + padding * 2, height + padding * 2, 4);
            ctx.stroke();
            
            ctx.strokeStyle = previousStrokeStyle;
            ctx.lineWidth = previousLineWidth;
        }
        
        // 计算字体大小（相对于节点尺寸，保持比例）
        const baseFontSize = 14;
        const baseNodeHeight = 50;
        const fontSize = (node.height / baseNodeHeight) * baseFontSize * this.zoom;
        
        // 绘制节点名称
        ctx.font = `bold ${fontSize}px Arial`;
        ctx.fillStyle = isSelected ? (isLightMode() ? '#000000' : '#ffffff') : (isLightMode() ? '#333333' : '#e0e0e0');
        ctx.textAlign = 'center';
        ctx.textBaseline = 'middle';
        
        // 处理节点名称文本
        let displayName = node.name;
        if (!node.autoSize) {
            const maxWidth = node.width * this.zoom * 0.9;
            const metrics = ctx.measureText(displayName);
            
            if (metrics.width > maxWidth) {
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
            const descFontSize = fontSize * 0.7;
            ctx.font = `${descFontSize}px Arial`;
            ctx.fillStyle = isSelected ? 'rgba(255, 255, 255, 0.8)' : (isLightMode() ? '#666666' : '#969696');
            
            // 截断长描述
            let displayText = node.description;
            const maxDescWidth = node.width * this.zoom * 0.9;
            const descMetrics = ctx.measureText(displayText);
            
            if (descMetrics.width > maxDescWidth) {
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
        
        // 手动恢复所有状态属性
        ctx.fillStyle = originalFillStyle;
        ctx.strokeStyle = originalStrokeStyle;
        ctx.lineWidth = originalLineWidth;
        ctx.font = originalFont;
        ctx.textAlign = originalTextAlign;
        ctx.textBaseline = originalTextBaseline;
    }
    
    // 绘制文字对象
    drawTextContent(ctx, textContent) {
        // 获取正确的位置和尺寸属性
        const position = (textContent.transform && textContent.transform.position) ? 
            textContent.transform.position : { x: 0, y: 0 };
        const width = textContent.width || 100;
        const height = textContent.height || 60;
        
        // 检查文字对象是否在可见区域内（修复：确保正确检测可见性）
        const visibleBounds = this.visibilityCuller.getVisibleBounds();
        const textBounds = {
            x: position.x,
            y: position.y,
            width: width,
            height: height
        };
        
        // 使用正确的可见性检测方法（修复LOD0级别绘制问题）
        // 确保即使缩放很小，文字内容也能被正确检测到
        const isVisible = this.visibilityCuller.isNodeVisible(textBounds, visibleBounds);
        if (!isVisible) {
            // 对于文字内容，即使稍微超出可见区域也应该绘制（修复缩放后消失的问题）
            // 只有当缩放非常小或完全不可见时才不绘制
            if (this.zoom < 0.05) {
                return; // 缩放太小，不绘制
            }
            // 检查是否完全在可见区域外（增加容差）
            const padding = 100; // 增加容差，确保文字内容不会因为边界检测过于严格而消失
            const expandedBounds = {
                x: visibleBounds.x - padding,
                y: visibleBounds.y - padding,
                width: visibleBounds.width + padding * 2,
                height: visibleBounds.height + padding * 2
            };
            if (textBounds.x + textBounds.width < expandedBounds.x ||
                textBounds.x > expandedBounds.x + expandedBounds.width ||
                textBounds.y + textBounds.height < expandedBounds.y ||
                textBounds.y > expandedBounds.y + expandedBounds.height) {
                return; // 完全在可见区域外，不绘制
            }
            // 否则继续绘制（部分可见或接近可见区域）
        }
        
        // 转换到屏幕坐标
        const screenPos = this.worldToScreen(position.x, position.y);
        const screenWidth = width * this.zoom;
        const screenHeight = height * this.zoom;
        
        // 根据LOD级别选择绘制方法
        const lodLevel = this.lodManager.getLODLevel(this.zoom);
        
        switch (lodLevel) {
            case 'LOD0':
                this.drawTextContentLOD0(ctx, textContent, screenPos, screenWidth, screenHeight);
                break;
            case 'LOD1':
                this.drawTextContentLOD1(ctx, textContent, screenPos, screenWidth, screenHeight);
                break;
            case 'LOD2':
                this.drawTextContentLOD2(ctx, textContent, screenPos, screenWidth, screenHeight);
                break;
            case 'LOD3':
                this.drawTextContentLOD3(ctx, textContent, screenPos, screenWidth, screenHeight);
                break;
        }
    }
    
    // LOD0: 高精度（完整细节）
    drawTextContentLOD0(ctx, textContent, screenPos, width, height) {
        // 手动保存状态
        const originalFillStyle = ctx.fillStyle;
        const originalStrokeStyle = ctx.strokeStyle;
        const originalFont = ctx.font;
        const originalTextAlign = ctx.textAlign;
        const originalTextBaseline = ctx.textBaseline;
        const originalGlobalAlpha = ctx.globalAlpha;
        
        // 检查是否被选中
        const isSelected = this.selectedElements.some(el => el.id === textContent.id);
        
        // 设置透明度
        ctx.globalAlpha = textContent.opacity;
        
        // 绘制背景（如果有背景色）
        if (textContent.backgroundColor) {
            const bgColor = textContent.backgroundColor instanceof Color ? 
                textContent.backgroundColor.toString() : 
                (typeof textContent.backgroundColor === 'string' ? textContent.backgroundColor : null);
            if (bgColor) {
                ctx.fillStyle = bgColor;
                ctx.fillRect(screenPos.x, screenPos.y, width, height);
            }
        }
        
        // 绘制边框（如果有边框）
        if (textContent.borderColor) {
            ctx.strokeStyle = textContent.borderColor;
            ctx.lineWidth = textContent.borderWidth * this.zoom;
            ctx.strokeRect(screenPos.x, screenPos.y, width, height);
        }
        
        // 绘制文本
        const fontSize = textContent.fontSize * this.zoom;
        ctx.font = `${textContent.fontStyle} ${textContent.fontWeight} ${fontSize}px ${textContent.fontFamily}`;
        ctx.fillStyle = textContent.fontColor || '#000000';
        ctx.textAlign = textContent.textAlign || 'left';
        ctx.textBaseline = textContent.textBaseline || 'middle';
        
        // 计算文本位置
        let textX = screenPos.x;
        let textY = screenPos.y;
        
        switch (textContent.textAlign) {
            case 'center':
                textX += width / 2;
                break;
            case 'right':
                textX += width;
                break;
        }
        
        const currentTextBaseline = textContent.textBaseline || 'middle';
        switch (currentTextBaseline) {
            case 'middle':
                textY += height / 2;
                break;
            case 'bottom':
                textY += height;
                break;
        }
        
        // 处理多行文本
        const lines = textContent.text.split('\n');
        const lineHeight = fontSize * 1.2;
        
        lines.forEach((line, index) => {
            const lineY = textY + (index - (lines.length - 1) / 2) * lineHeight;
            ctx.fillText(line, textX, lineY);
        });
        
        // 如果被选中，绘制选择框
        if (isSelected) {
            ctx.strokeStyle = isLightMode() ? '#000000' : '#ffffff';
            ctx.lineWidth = 2;
            ctx.setLineDash([5, 5]);
            ctx.strokeRect(screenPos.x - 2, screenPos.y - 2, width + 4, height + 4);
            ctx.setLineDash([]);
        }
        
        // 恢复状态
        ctx.fillStyle = originalFillStyle;
        ctx.strokeStyle = originalStrokeStyle;
        ctx.font = originalFont;
        ctx.textAlign = originalTextAlign;
        ctx.textBaseline = originalTextBaseline;
        ctx.globalAlpha = originalGlobalAlpha;
    }
    
    // LOD1: 中精度（简化细节）
    drawTextContentLOD1(ctx, textContent, screenPos, width, height) {
        const originalFillStyle = ctx.fillStyle;
        const originalStrokeStyle = ctx.strokeStyle;
        const originalFont = ctx.font;
        const originalTextAlign = ctx.textAlign;
        const originalTextBaseline = ctx.textBaseline;
        const originalGlobalAlpha = ctx.globalAlpha;
        
        const isSelected = this.selectedElements.some(el => el.id === textContent.id);
        
        // 设置透明度
        ctx.globalAlpha = textContent.opacity;
        
        // 简化绘制背景（纯色填充）
        if (textContent.backgroundColor) {
            ctx.fillStyle = textContent.backgroundColor;
            ctx.fillRect(screenPos.x, screenPos.y, width, height);
        }
        
        // 简化绘制边框（细线）
        if (textContent.borderColor) {
            ctx.strokeStyle = textContent.borderColor;
            ctx.lineWidth = 0.5; // 细线
            ctx.strokeRect(screenPos.x, screenPos.y, width, height);
        }
        
        // 绘制文本（简化，只显示第一行）
        const fontSize = Math.max(6, textContent.fontSize * this.zoom); // 最小字体6px
        ctx.font = `normal normal ${fontSize}px sans-serif`; // 简化字体设置
        ctx.fillStyle = textContent.fontColor || '#000000';
        ctx.textAlign = 'center';
        ctx.textBaseline = 'middle';
        
        // 获取文本内容（限制6字符）
        let displayText = textContent.text;
        if (displayText.length > 6) {
            displayText = displayText.substring(0, 6) + '...';
        }
        
        // 居中显示
        ctx.fillText(displayText, screenPos.x + width / 2, screenPos.y + height / 2);
        
        // 如果被选中，绘制简化选择框
        if (isSelected) {
            ctx.strokeStyle = isLightMode() ? '#000000' : '#ffffff';
            ctx.lineWidth = 1;
            ctx.setLineDash([3, 3]);
            ctx.strokeRect(screenPos.x - 1, screenPos.y - 1, width + 2, height + 2);
            ctx.setLineDash([]);
        }
        
        // 恢复状态
        ctx.fillStyle = originalFillStyle;
        ctx.strokeStyle = originalStrokeStyle;
        ctx.font = originalFont;
        ctx.textAlign = originalTextAlign;
        ctx.textBaseline = originalTextBaseline;
        ctx.globalAlpha = originalGlobalAlpha;
    }
    
    // LOD2: 低精度（纯色矩形+文字占位）
    drawTextContentLOD2(ctx, textContent, screenPos, width, height) {
        const originalFillStyle = ctx.fillStyle;
        const originalStrokeStyle = ctx.strokeStyle;
        const originalLineWidth = ctx.lineWidth;
        
        const isSelected = this.selectedElements.some(el => el.id === textContent.id);
        
        // 绘制纯色矩形
        ctx.fillStyle = textContent.backgroundColor || (isLightMode() ? '#f0f0f0' : '#333333');
        ctx.fillRect(screenPos.x, screenPos.y, width, height);
        
        // 绘制细线边框
        ctx.strokeStyle = isLightMode() ? '#cccccc' : '#4a4a4a';
        ctx.lineWidth = 0.5;
        ctx.strokeRect(screenPos.x, screenPos.y, width, height);
        
        // 绘制文字占位长条
        const textBarHeight = Math.max(4, height * 0.3);
        const textBarWidth = Math.max(10, width * 0.7);
        ctx.fillStyle = isLightMode() ? '#aaaaaa' : '#666666';
        ctx.fillRect(
            screenPos.x + (width - textBarWidth) / 2,
            screenPos.y + (height - textBarHeight) / 2,
            textBarWidth,
            textBarHeight
        );
        
        // 如果被选中，绘制简化选择框
        if (isSelected) {
            ctx.strokeStyle = isLightMode() ? '#000000' : '#ffffff';
            ctx.lineWidth = 1;
            ctx.strokeRect(screenPos.x, screenPos.y, width, height);
        }
        
        // 恢复状态
        ctx.fillStyle = originalFillStyle;
        ctx.strokeStyle = originalStrokeStyle;
        ctx.lineWidth = originalLineWidth;
    }
    
    // LOD3: 占位符（仅纯色矩形）
    drawTextContentLOD3(ctx, textContent, screenPos, width, height) {
        const originalFillStyle = ctx.fillStyle;
        const originalStrokeStyle = ctx.strokeStyle;
        const originalLineWidth = ctx.lineWidth;
        
        const isSelected = this.selectedElements.some(el => el.id === textContent.id);
        
        // 仅绘制纯色矩形占位符
        ctx.fillStyle = textContent.backgroundColor || (isLightMode() ? '#f0f0f0' : '#333333');
        ctx.fillRect(screenPos.x, screenPos.y, width, height);
        
        // 如果被选中，绘制选中矩形
        if (isSelected) {
            ctx.strokeStyle = isLightMode() ? '#000000' : '#ffffff';
            ctx.lineWidth = 1;
            ctx.strokeRect(screenPos.x, screenPos.y, width, height);
        }
        
        // 恢复状态
        ctx.fillStyle = originalFillStyle;
        ctx.strokeStyle = originalStrokeStyle;
        ctx.lineWidth = originalLineWidth;
    }
    
    // LOD1：中精度（简化细节）
    drawNodeLOD1(ctx, node, screenPos, width, height) {
        const originalFillStyle = ctx.fillStyle;
        const originalStrokeStyle = ctx.strokeStyle;
        const originalLineWidth = ctx.lineWidth;
        const originalFont = ctx.font;
        const originalTextAlign = ctx.textAlign;
        const originalTextBaseline = ctx.textBaseline;
        
        const isSelected = this.selectedElements.some(el => el.id === node.id);
        
        // 矩形（无圆角）+ 细线边框
        if (node.color) {
            ctx.fillStyle = node.color;
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
        
        ctx.lineWidth = 0.5; // 细线
        ctx.fillRect(screenPos.x, screenPos.y, width, height); // 无圆角
        ctx.strokeRect(screenPos.x, screenPos.y, width, height);
        
        // 如果节点被选中，绘制外框
        if (isSelected) {
            ctx.strokeStyle = isLightMode() ? '#000000' : '#ffffff';
            ctx.lineWidth = 2;
            ctx.strokeRect(screenPos.x - 2, screenPos.y - 2, width + 4, height + 4);
        }
        
        // 仅绘制节点名称（无描述）
        const fontSize = 12 * this.zoom;
        ctx.font = `bold ${fontSize}px Arial`;
        ctx.fillStyle = isSelected ? (isLightMode() ? '#000000' : '#ffffff') : (isLightMode() ? '#333333' : '#e0e0e0');
        ctx.textAlign = 'center';
        ctx.textBaseline = 'middle';
        
        let displayName = node.name || node.id || 'Unknown';
        if (displayName && displayName.length > 6) {
            displayName = displayName.slice(0, 6) + '...';
        }
        ctx.fillText(displayName, screenPos.x + width / 2, screenPos.y + height / 2);
        
        // 恢复状态
        ctx.fillStyle = originalFillStyle;
        ctx.strokeStyle = originalStrokeStyle;
        ctx.lineWidth = originalLineWidth;
        ctx.font = originalFont;
        ctx.textAlign = originalTextAlign;
        ctx.textBaseline = originalTextBaseline;
    }
    
    // LOD2：低精度（纯色矩形 + 文字占位长条）
    drawNodeLOD2(ctx, node, screenPos, width, height) {
        const originalFillStyle = ctx.fillStyle;
        const isSelected = this.selectedElements.some(el => el.id === node.id);
        
        // 1. 绘制节点背景（纯色矩形）
        // 如果节点被选中，使用选中线框的颜色填充整个矩形
        if (isSelected) {
            ctx.fillStyle = isLightMode() ? '#000000' : '#ffffff'; // 选中时的线框颜色
        } else {
            ctx.fillStyle = node.color || (isLightMode() ? '#eee' : '#444');
        }
        ctx.fillRect(screenPos.x, screenPos.y, width, height);
        
        // 2. 在原本显示文字的位置绘制一个长条矩形（文字占位符）
        // 如果节点被选中，文字占位符使用与背景对比的颜色
        const fontSize = 12 * this.zoom;
        const rectHeight = fontSize; // 高度保持原本字体的高度
        const rectWidth = width * 0.5; // 统一宽度，不考虑真实文字宽度
        
        // 文字占位符颜色：选中时使用对比色，未选中时使用文字颜色
        let textColor;
        if (isSelected) {
            // 选中时，文字占位符使用与背景对比的颜色（反转）
            textColor = isLightMode() ? '#ffffff' : '#000000';
        } else {
            // 未选中时，使用正常的文字颜色
            textColor = isLightMode() ? '#333333' : '#e0e0e0';
        }
        
        ctx.fillStyle = textColor;
        // 矩形居中绘制（以节点中心为基准）
        const rectX = screenPos.x + width / 2 - rectWidth / 2;
        const rectY = screenPos.y + height / 2 - rectHeight / 2;
        ctx.fillRect(rectX, rectY, rectWidth, rectHeight);
        
        ctx.fillStyle = originalFillStyle;
    }
    
    // LOD3：占位符（保持矩形尺寸比例的纯色矩形）
    drawNodeLOD3(ctx, node, screenPos, width, height) {
        const originalFillStyle = ctx.fillStyle;
        const isSelected = this.selectedElements.some(el => el.id === node.id);
        
        // 保持节点原本的矩形尺寸比例，仅绘制纯色矩形（无圆角、无边框、无文字）
        // 如果节点被选中，使用选中线框的颜色填充整个矩形
        if (isSelected) {
            ctx.fillStyle = isLightMode() ? '#000000' : '#ffffff'; // 选中时的线框颜色
        } else {
            ctx.fillStyle = node.color || (isLightMode() ? '#ddd' : '#555');
        }
        ctx.fillRect(screenPos.x, screenPos.y, width, height);
        
        ctx.fillStyle = originalFillStyle;
    }
    
    // 按节点对分组连线
    groupConnectionsByNodePair(connections = null) {
        const groups = new Map();
        const targetConnections = connections || this.connections;
        
        targetConnections.forEach(connection => {
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
        
        // 如果选中，先绘制所有箭头的外发光
        if (isSelected) {
            // 保存一次状态
            ctx.save();
            ctx.strokeStyle = isLightMode()?'#0066cc':'#ffffff';
            ctx.lineWidth = baseArrowSize + 2; // 10像素外发光 / 2
            ctx.globalAlpha = 1;
            ctx.setLineDash([]); // 确保外发光始终使用实线绘制，不受连线类型影响
            
            for (let i = 0; i < arrowCount; i++) {
                // 箭头中心位置（平行于连线方向排列）
                const arrowCenterX = centerX + (startOffset + i * spacing) * Math.cos(angle);
                const arrowCenterY = centerY + (startOffset + i * spacing) * Math.sin(angle);
                
                // 箭头方向（如果反向则翻转180度）
                const arrowAngle = isReversed ? angle + Math.PI : angle;
                
                // 计算箭头坐标
                const tipX = arrowCenterX + baseArrowSize * Math.cos(arrowAngle);
                const tipY = arrowCenterY + baseArrowSize * Math.sin(arrowAngle);
                const base1X = arrowCenterX - baseArrowSize * Math.cos(arrowAngle - Math.PI / 3);
                const base1Y = arrowCenterY - baseArrowSize * Math.sin(arrowAngle - Math.PI / 3);
                const base2X = arrowCenterX - baseArrowSize * Math.cos(arrowAngle + Math.PI / 3);
                const base2Y = arrowCenterY - baseArrowSize * Math.sin(arrowAngle + Math.PI / 3);
                
                // 保存箭头位置用于点击检测
                arrowPositions.push({
                    tip: { x: tipX, y: tipY },
                    base1: { x: base1X, y: base1Y },
                    base2: { x: base2X, y: base2Y }
                });
                
                // 绘制外发光
                ctx.beginPath();
                ctx.moveTo(tipX, tipY);
                ctx.lineTo(base1X, base1Y);
                ctx.lineTo(base2X, base2Y);
                ctx.closePath();
                ctx.stroke();
            }
            
            // 恢复一次状态
            ctx.restore();
        } else {
            // 不选中时，只计算位置
            for (let i = 0; i < arrowCount; i++) {
                const arrowCenterX = centerX + (startOffset + i * spacing) * Math.cos(angle);
                const arrowCenterY = centerY + (startOffset + i * spacing) * Math.sin(angle);
                const arrowAngle = isReversed ? angle + Math.PI : angle;
                
                const tipX = arrowCenterX + baseArrowSize * Math.cos(arrowAngle);
                const tipY = arrowCenterY + baseArrowSize * Math.sin(arrowAngle);
                const base1X = arrowCenterX - baseArrowSize * Math.cos(arrowAngle - Math.PI / 3);
                const base1Y = arrowCenterY - baseArrowSize * Math.sin(arrowAngle - Math.PI / 3);
                const base2X = arrowCenterX - baseArrowSize * Math.cos(arrowAngle + Math.PI / 3);
                const base2Y = arrowCenterY - baseArrowSize * Math.sin(arrowAngle + Math.PI / 3);
                
                arrowPositions.push({
                    tip: { x: tipX, y: tipY },
                    base1: { x: base1X, y: base1Y },
                    base2: { x: base2X, y: base2Y }
                });
            }
        }
        
        // 保存一次状态用于填充箭头
        ctx.save();
        ctx.fillStyle = arrowColor;
        
        // 绘制所有箭头
        for (let i = 0; i < arrowCount; i++) {
            const arrowPos = arrowPositions[i];
            ctx.beginPath();
            ctx.moveTo(arrowPos.tip.x, arrowPos.tip.y);
            ctx.lineTo(arrowPos.base1.x, arrowPos.base1.y);
            ctx.lineTo(arrowPos.base2.x, arrowPos.base2.y);
            ctx.closePath();
            ctx.fill();
        }
        
        // 恢复一次状态
        ctx.restore();
        
        // 返回箭头位置（屏幕坐标）
        return arrowPositions;
    }
    
    // 绘制连线组（支持LOD和可视性检测）
    drawConnectionGroup(ctx, group) {
        const nodeA = this.nodes.find(n => n.id === group.nodeA);
        const nodeB = this.nodes.find(n => n.id === group.nodeB);
        
        if (!nodeA || !nodeB) return;
        
        // 可视性检测
        const visibleBounds = this.visibilityCuller.getVisibleBounds();
        const representativeConnection = group.forward[0] || group.backward[0];
        if (!this.visibilityCuller.isConnectionVisible(representativeConnection, nodeA, nodeB, visibleBounds)) {
            // 每100个连线组输出一次被过滤的日志（避免日志过多）
            if (Math.random() < 0.01) {
                perfLog(`[性能优化] 连线被可视性检测过滤`);
            }
            return;
        }
        
        // 根据LOD等级选择绘制方法
        const lodLevel = this.lodManager.getLODLevel(this.zoom);
        
        // 计算连线的起点和终点（使用transform.position）
        const nodeAPos = (nodeA.transform && nodeA.transform.position) ? 
            nodeA.transform.position : { x: 0, y: 0 };
        const nodeBPos = (nodeB.transform && nodeB.transform.position) ? 
            nodeB.transform.position : { x: 0, y: 0 };
        const startX = nodeAPos.x + nodeA.width / 2;
        const startY = nodeAPos.y + nodeA.height / 2;
        const endX = nodeBPos.x + nodeB.width / 2;
        const endY = nodeBPos.y + nodeB.height / 2;
        
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
        
        // 获取连线属性（使用第一条连线的属性作为代表，已在上面声明）
        const isSelected = this.selectedElements.some(el => 
            (hasForward && group.forward.some(c => c.id === el.id)) ||
            (hasBackward && group.backward.some(c => c.id === el.id))
        );
        
        ctx.save();
        
        // LOD3级别：简化绘制（纯粹的一根实线）
        if (lodLevel === 'LOD3') {
            // 设置实线样式（不考虑lineType和lineWidth）
            ctx.setLineDash([]);
            ctx.lineWidth = 1.0; // 固定线宽
            
            // 如果选中，先绘制高亮效果
            if (isSelected) {
                // 计算需要高亮的线段
                let highlightStart = screenStart;
                let highlightEnd = screenEnd;
                
                if (isBidirectional) {
                    // 判断选中的是哪一侧
                    const forwardSelected = group.forward.some(c => 
                        this.selectedElements.some(el => el.id === c.id));
                    const backwardSelected = group.backward.some(c => 
                        this.selectedElements.some(el => el.id === c.id));
                    
                    if (forwardSelected && !backwardSelected) {
                        // 只高亮从A节点到中心点的线段
                        highlightStart = screenStart;
                        highlightEnd = { x: midScreenX, y: midScreenY };
                    } else if (backwardSelected && !forwardSelected) {
                        // 只高亮从中心点到B节点的线段
                        highlightStart = { x: midScreenX, y: midScreenY };
                        highlightEnd = screenEnd;
                    }
                    // 如果两侧都选中或都不选中，高亮整条线
                }
                
                // 绘制高亮效果
                const originalStrokeStyle = ctx.strokeStyle;
                const originalLineWidth = ctx.lineWidth;
                const originalGlobalAlpha = ctx.globalAlpha;
                
                // light-mode时为蓝色，非light-mode时为纯白色
                ctx.strokeStyle = isLightMode() ? '#000000' : '#ffffff';
                ctx.lineWidth = 1.0; // 高亮线宽
                ctx.globalAlpha = 1.0;
                ctx.beginPath();
                ctx.moveTo(highlightStart.x, highlightStart.y);
                ctx.lineTo(highlightEnd.x, highlightEnd.y);
                ctx.stroke();
                
                // 恢复状态
                ctx.strokeStyle = originalStrokeStyle;
                ctx.lineWidth = originalLineWidth;
                ctx.globalAlpha = originalGlobalAlpha;
            }
            
            // 绘制连线（考虑原本的颜色）
            ctx.strokeStyle = representativeConnection.color || 
                (isLightMode() ? '#666666' : '#969696');
            ctx.beginPath();
            ctx.moveTo(screenStart.x, screenStart.y);
            ctx.lineTo(screenEnd.x, screenEnd.y);
            ctx.stroke();
            
            ctx.restore();
            return; // LOD3不绘制箭头，直接返回
        }
        
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
            
            // 绘制白色外发光（10像素宽度）- 手动保存和恢复状态
            const originalStrokeStyle = ctx.strokeStyle;
            const originalLineWidth = ctx.lineWidth;
            const originalGlobalAlpha = ctx.globalAlpha;
            
            ctx.strokeStyle = isLightMode()?'#0066cc':'#ffffff';
            ctx.lineWidth = (representativeConnection.lineWidth || 1.5) + 5; // 10像素外发光 / 2
            ctx.globalAlpha = 0.5;
            ctx.beginPath();
            ctx.moveTo(highlightStart.x, highlightStart.y);
            ctx.lineTo(highlightEnd.x, highlightEnd.y);
            ctx.stroke();
            
            // 手动恢复状态
            ctx.strokeStyle = originalStrokeStyle;
            ctx.lineWidth = originalLineWidth;
            ctx.globalAlpha = originalGlobalAlpha;
        }
        
        // 所有LOD级别都使用直线绘制连线
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
        
        // 根据LOD等级决定是否绘制箭头
        if (!this.lodManager.shouldDrawArrow(this.zoom)) {
            // LOD2及以下不绘制箭头，直接返回
            ctx.restore();
            return;
        }
        
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
    }
    
    // 绘制连线（已移至render方法中，此方法保留用于向后兼容）
    drawConnections(ctx) {
        // 按节点对分组可视连线
        const connectionGroups = this.groupConnectionsByNodePair(this.visibleConnections);
        
        // 绘制每个连线组
        connectionGroups.forEach(group => {
            this.drawConnectionGroup(ctx, group);
        });
        
        // 绘制正在创建的连线
        if (this.creatingConnection) {
            const sourceNode = this.nodes.find(n => n.id === this.creatingConnection.sourceNodeId);
            if (sourceNode) {
                const sourcePos = (sourceNode.transform && sourceNode.transform.position) ? 
                    sourceNode.transform.position : { x: 0, y: 0 };
                const startX = sourcePos.x + (sourceNode.width || 100) / 2;
                const startY = sourcePos.y + (sourceNode.height || 60) / 2;
                const screenStart = this.worldToScreen(startX, startY);
                
                // 获取鼠标位置
                const rect = this.canvas.getBoundingClientRect();
                const mouseX = this.lastMouseX - rect.left;
                const mouseY = this.lastMouseY - rect.top;
                
                // 手动保存状态
                const originalStrokeStyle = ctx.strokeStyle;
                const originalLineWidth = ctx.lineWidth;
                const originalLineDash = ctx.getLineDash();
                
                ctx.strokeStyle = '#007acc';
                ctx.lineWidth = 1.5;
                ctx.setLineDash([5, 5]);
                
                ctx.beginPath();
                ctx.moveTo(screenStart.x, screenStart.y);
                ctx.lineTo(mouseX, mouseY);
                ctx.stroke();
                
                // 手动恢复状态
                ctx.strokeStyle = originalStrokeStyle;
                ctx.lineWidth = originalLineWidth;
                ctx.setLineDash(originalLineDash);
            }
        }
    }
    
    // 渲染函数（优化版本 - 实现渲染批处理、可视性检测、LOD分级绘制）
    render(timestamp) {
        // 性能监控开始
        const startTime = performance.now();
        
        // 限制渲染频率
        if (timestamp - this.lastRenderTime < this.renderDelay) {
            this.scheduleRender();
            return;
        }
        
        this.lastRenderTime = timestamp;
        
        // 更新可视对象缓存
        this.updateVisibleObjects();
        
        // 1. 首先清空画布
        this.ctx.clearRect(0, 0, this.canvas.width, this.canvas.height);
        
        // 2. 绘制栅格（只需要一次状态保存/恢复）
        this.drawGrid(this.ctx);
        
        // 3. 预计算可见节点的自动尺寸，避免在渲染循环中重复计算
        this.visibleNodes.forEach(node => {
            NodeService.calculateAutoSize(node, this.ctx);
        });
        
        // 4. 判断当前有无选中对象并进行分离
        const hasSelectedElements = this.selectedElements.length > 0;
        
        // 5. 可视性检测和空间索引优化
        const visibleBounds = this.visibilityCuller.getVisibleBounds();
        // 每10帧输出一次可视区域信息（用于调试）
        if (this.renderCount % 10 === 0) {
            // 计算节点实际分布范围
            let nodeMinX = Infinity, nodeMinY = Infinity, nodeMaxX = -Infinity, nodeMaxY = -Infinity;
            if (this.nodes.length > 0) {
                this.nodes.forEach(node => {
                const nodePos = (node.transform && node.transform.position) ? 
                    node.transform.position : { x: 0, y: 0 };
                nodeMinX = Math.min(nodeMinX, nodePos.x);
                nodeMinY = Math.min(nodeMinY, nodePos.y);
                nodeMaxX = Math.max(nodeMaxX, nodePos.x + (node.width || 100));
                nodeMaxY = Math.max(nodeMaxY, nodePos.y + (node.height || 60));
            });
            }
            perfLog(`[调试] 可视区域: (${visibleBounds.minX.toFixed(0)}, ${visibleBounds.minY.toFixed(0)}) - (${visibleBounds.maxX.toFixed(0)}, ${visibleBounds.maxY.toFixed(0)}), ` +
                    `节点范围: (${nodeMinX.toFixed(0)}, ${nodeMinY.toFixed(0)}) - (${nodeMaxX.toFixed(0)}, ${nodeMaxY.toFixed(0)}), ` +
                    `pan: (${this.pan.x.toFixed(0)}, ${this.pan.y.toFixed(0)}), zoom: ${this.zoom.toFixed(2)}`);
        }
        
        // 如果节点数 > 500，使用四叉树加速查询
        if (this.nodes.length > 500 && !this.useQuadTree) {
            perfLog(`[性能优化] 节点数 ${this.nodes.length} > 500，启用四叉树空间索引`);
            this.useQuadTree = true;
            // 计算节点边界范围
            let minX = Infinity, minY = Infinity, maxX = -Infinity, maxY = -Infinity;
            this.nodes.forEach(node => {
                const nodePos = (node.transform && node.transform.position) ? 
                    node.transform.position : { x: 0, y: 0 };
                minX = Math.min(minX, nodePos.x);
                minY = Math.min(minY, nodePos.y);
                maxX = Math.max(maxX, nodePos.x + (node.width || 100));
                maxY = Math.max(maxY, nodePos.y + (node.height || 60));
            });
            const bounds = {
                x: minX - 1000,
                y: minY - 1000,
                width: maxX - minX + 2000,
                height: maxY - minY + 2000
            };
            this.quadTree = new QuadTree(bounds);
            // 将节点插入四叉树
            this.nodes.forEach(node => {
                const nodePos = (node.transform && node.transform.position) ? 
                    node.transform.position : { x: 0, y: 0 };
                this.quadTree.insert({
                    x: nodePos.x,
                    y: nodePos.y,
                    width: node.width,
                    height: node.height,
                    data: node
                });
            });
        } else if (this.nodes.length <= 500 && this.useQuadTree) {
            perfLog(`[性能优化] 节点数 ${this.nodes.length} <= 500，禁用四叉树空间索引`);
            this.useQuadTree = false;
            this.quadTree = null;
        }
        
        // 获取可见节点（使用四叉树或全量遍历）
        let visibleNodes;
        const visibilityStartTime = performance.now();
        if (this.useQuadTree && this.quadTree) {
            // 重建四叉树（节点位置可能已改变）
            let minX = Infinity, minY = Infinity, maxX = -Infinity, maxY = -Infinity;
            this.nodes.forEach(node => {
                const nodePos = (node.transform && node.transform.position) ? 
                    node.transform.position : { x: 0, y: 0 };
                minX = Math.min(minX, nodePos.x);
                minY = Math.min(minY, nodePos.y);
                maxX = Math.max(maxX, nodePos.x + (node.width || 100));
                maxY = Math.max(maxY, nodePos.y + (node.height || 60));
            });
            const bounds = {
                x: minX - 1000,
                y: minY - 1000,
                width: maxX - minX + 2000,
                height: maxY - minY + 2000
            };
            this.quadTree.clear();
            this.quadTree.bounds = bounds;
            this.nodes.forEach(node => {
                const nodePos = (node.transform && node.transform.position) ? 
                    node.transform.position : { x: 0, y: 0 };
                this.quadTree.insert({
                    x: nodePos.x,
                    y: nodePos.y,
                    width: node.width,
                    height: node.height,
                    data: node
                });
            });
            // 将visibleBounds转换为四叉树期望的格式 {x, y, width, height}
            const queryArea = {
                x: visibleBounds.minX,
                y: visibleBounds.minY,
                width: visibleBounds.maxX - visibleBounds.minX,
                height: visibleBounds.maxY - visibleBounds.minY
            };
            visibleNodes = this.quadTree.query(queryArea);
            const visibilityTime = performance.now() - visibilityStartTime;
            // 每10帧输出一次查询信息
            if (this.renderCount % 10 === 0) {
                // 手动验证几个节点的可见性
                let manualVisibleCount = 0;
                const sampleSize = Math.min(10, this.nodes.length);
                for (let i = 0; i < sampleSize; i++) {
                    if (this.visibilityCuller.isNodeVisible(this.nodes[i], visibleBounds)) {
                        manualVisibleCount++;
                    }
                }
                perfLog(`[性能优化] 四叉树查询: 总节点 ${this.nodes.length}, 可见节点 ${visibleNodes.length}, 耗时 ${visibilityTime.toFixed(2)}ms, ` +
                        `查询区域: (${queryArea.x.toFixed(0)}, ${queryArea.y.toFixed(0)}) 尺寸: (${queryArea.width.toFixed(0)}, ${queryArea.height.toFixed(0)}), ` +
                        `手动验证前${sampleSize}个节点: ${manualVisibleCount}个可见`);
            }
        } else {
            // 全量遍历（节点数较少时）
            visibleNodes = this.nodes.filter(node => 
                this.visibilityCuller.isNodeVisible(node, visibleBounds)
            );
            const visibilityTime = performance.now() - visibilityStartTime;
            // 每10帧输出一次查询信息
            if (this.renderCount % 10 === 0) {
                perfLog(`[性能优化] 全量遍历: 总节点 ${this.nodes.length}, 可见节点 ${visibleNodes.length}, 耗时 ${visibilityTime.toFixed(2)}ms`);
            }
        }
        
        // 获取LOD等级
        const lodLevel = this.lodManager.getLODLevel(this.zoom);
        // 每100帧输出一次LOD信息（避免日志过多）
        if (this.renderCount % 100 === 0) {
            perfLog(`[性能优化] LOD等级: ${lodLevel} (zoom: ${this.zoom.toFixed(2)})`);
        }
        
        // 6. 使用分组方法来处理连线
        const connectionGroups = this.groupConnectionsByNodePair(this.visibleConnections);
        
        // 按选中状态和类型分组元素，以便批处理绘制
        const groups = {
            unselectedConnections: [],
            unselectedNodes: [],
            selectedConnections: [],
            selectedNodes: []
        };
        
        // 分离可见节点到不同组
        visibleNodes.forEach(node => {
            const isSelected = hasSelectedElements && this.selectedElements.includes(node);
            if (isSelected) {
                groups.selectedNodes.push(node);
            } else {
                groups.unselectedNodes.push(node);
            }
        });
        
        // 分离连线组到不同组
        connectionGroups.forEach(group => {
            const isSelected = group.forward.some(conn => this.selectedElements.includes(conn)) ||
                              group.backward.some(conn => this.selectedElements.includes(conn));
            if (isSelected) {
                groups.selectedConnections.push(group);
            } else {
                groups.unselectedConnections.push(group);
            }
        });
        
        // 6. 批量绘制元素，按照绘制顺序并减少状态切换
        // 6.1 批量绘制未选中的连接组
        if (groups.unselectedConnections.length > 0) {
            groups.unselectedConnections.forEach(group => {
                this.drawConnectionGroup(this.ctx, group);
            });
        }
        
        // 统计实际绘制的节点数
        let drawnNodeCount = 0;
        
        // 6.2 批量绘制未选中的节点
        if (groups.unselectedNodes.length > 0) {
            // 只设置一次节点绘制的基本状态，避免重复设置
            groups.unselectedNodes.forEach(node => {
                this.drawNode(this.ctx, node);
                drawnNodeCount++;
            });
        }
        
        // 6.3 批量绘制选中的连接组
        if (groups.selectedConnections.length > 0) {
            groups.selectedConnections.forEach(group => {
                this.drawConnectionGroup(this.ctx, group);
            });
        }
        
        // 6.4 处理选中节点和相关节点
        if (groups.selectedNodes.length > 0) {
            // 批量绘制选中的节点
            groups.selectedNodes.forEach(node => {
                this.drawNode(this.ctx, node);
                drawnNodeCount++;
            });
        } else if (groups.selectedConnections.length > 0 && hasSelectedElements) {
            // 如果只有选中的连接，绘制这些连接两端的节点
            const connectedNodeIds = new Set();
            groups.selectedConnections.forEach(group => {
                group.forward.forEach(conn => {
                    connectedNodeIds.add(conn.sourceNodeId);
                    connectedNodeIds.add(conn.targetNodeId);
                });
                group.backward.forEach(conn => {
                    connectedNodeIds.add(conn.sourceNodeId);
                    connectedNodeIds.add(conn.targetNodeId);
                });
            });
            
            // 批量绘制连接的节点
            const connectedNodes = this.nodes.filter(node => connectedNodeIds.has(node.id));
            connectedNodes.forEach(node => {
                this.drawNode(this.ctx, node);
                drawnNodeCount++;
            });
        }
        
        // 输出可视性检测结果日志（每10帧输出一次）
        if (this.renderCount % 10 === 0) {
            perfLog(`[可视性检测] 总节点数: ${this.nodes.length}, 可见节点数: ${visibleNodes.length}, 实际绘制节点数: ${drawnNodeCount}`);
        }

        // 7. 绘制文字对象
        this.textContents.forEach(textContent => {
            this.drawTextContent(this.ctx, textContent);
        });

        // 8. 绘制节点描述提示框（始终在最上层）
        if (this.hoveredNode) {
            // 获取鼠标位置
            const rect = this.canvas.getBoundingClientRect();
            const mouseX = this.lastMouseX - rect.left;
            const mouseY = this.lastMouseY - rect.top;
            
            // 绘制Canvas提示框
            this.drawTooltip(this.ctx, this.hoveredNode, mouseX, mouseY);
        }
        
        // 8. 绘制正在创建的连线（最顶层）- 使用手动状态保存/恢复代替ctx.save()/ctx.restore()
        if (this.creatingConnection) {
            const sourceNode = this.nodes.find(n => n.id === this.creatingConnection.sourceNodeId);
            if (sourceNode) {
                const sourcePos = (sourceNode.transform && sourceNode.transform.position) ? 
                    sourceNode.transform.position : { x: 0, y: 0 };
                const startX = sourcePos.x + (sourceNode.width || 100) / 2;
                const startY = sourcePos.y + (sourceNode.height || 60) / 2;
                const screenStart = this.worldToScreen(startX, startY);
                
                // 获取鼠标位置
                const rect = this.canvas.getBoundingClientRect();
                const mouseX = this.lastMouseX - rect.left;
                const mouseY = this.lastMouseY - rect.top;
                
                // 手动保存状态
                const originalStrokeStyle = this.ctx.strokeStyle;
                const originalLineWidth = this.ctx.lineWidth;
                const originalLineDash = this.ctx.getLineDash();
                
                // 设置状态
                this.ctx.strokeStyle = '#007acc';
                this.ctx.lineWidth = 1.5;
                this.ctx.setLineDash([5, 5]);
                
                this.ctx.beginPath();
                this.ctx.moveTo(screenStart.x, screenStart.y);
                this.ctx.lineTo(mouseX, mouseY);
                this.ctx.stroke();
                
                // 手动恢复状态
                this.ctx.strokeStyle = originalStrokeStyle;
                this.ctx.lineWidth = originalLineWidth;
                this.ctx.setLineDash(originalLineDash);
            }
        }
        // 性能监控结束
        const endTime = performance.now();
        const renderTime = endTime - startTime;
        
        // 使用性能监控器记录
        this.performanceMonitor.recordFrame(renderTime);
        
        // 每10帧输出一次详细性能日志
        if (this.renderCount % 10 === 0) {
            const fps = 1000 / renderTime;
            perfLog(`[性能监控] 渲染时间: ${renderTime.toFixed(2)}ms, FPS: ${fps.toFixed(1)}, ` +
                    `总节点: ${this.nodes.length}, 可见节点: ${visibleNodes.length}, ` +
                    `总连接: ${this.connections.length}, LOD: ${lodLevel}`);
        }
        
        // 更新状态栏信息
        this.updateStatusBar();
        
        this.renderCount++;
    }
    
    // 更新状态栏信息
    updateStatusBar() {
        const nodeCountEl = document.getElementById('node-count');
        const connectionCountEl = document.getElementById('connection-count');
        const selectionInfoEl = document.getElementById('selection-info');
        const forceStatusEl = document.getElementById('force-simulation-status');
        
        if (nodeCountEl) {
            nodeCountEl.textContent = `节点: ${this.nodes.length}`;
        }
        
        if (connectionCountEl) {
            connectionCountEl.textContent = `连接: ${this.connections.length}`;
        }
        
        if (selectionInfoEl) {
            // 准确判断节点和连接
            const selectedNodes = this.selectedElements.filter(el => {
                // 节点：有type='node'，或者没有sourceNodeId/targetNodeId属性
                return el.type === 'node' || (!el.sourceNodeId && !el.targetNodeId && el.id);
            });
            const selectedConnections = this.selectedElements.filter(el => {
                // 连接：有type='connection'，或者有sourceNodeId/targetNodeId属性
                return el.type === 'connection' || (el.sourceNodeId && el.targetNodeId);
            });
            const totalSelected = this.selectedElements.length;
            
            if (totalSelected === 0) {
                selectionInfoEl.textContent = '选中: 0';
            } else {
                let info = `选中: ${totalSelected}`;
                if (selectedNodes.length > 0 && selectedConnections.length > 0) {
                    info += ` (节点: ${selectedNodes.length}, 连接: ${selectedConnections.length})`;
                } else if (selectedNodes.length > 0) {
                    info += ` (节点: ${selectedNodes.length})`;
                } else if (selectedConnections.length > 0) {
                    info += ` (连接: ${selectedConnections.length})`;
                }
                selectionInfoEl.textContent = info;
            }
        }
        
        // 更新力学模拟状态
        if (forceStatusEl) {
            if (this.isRealTimeArrangeActive) {
                forceStatusEl.classList.remove('hidden');
            } else {
                forceStatusEl.classList.add('hidden');
            }
        }
    }
    
    // 检测节点悬浮
    checkNodeHover(worldPos, screenX, screenY) {
        // 查找鼠标下方的节点（从后往前，优先检测最上层的节点）
        let hoveredNode = null;
        for (let i = this.visibleNodes.length - 1; i >= 0; i--) {
            const node = this.visibleNodes[i];
            const nodePos = (node.transform && node.transform.position) ? 
                node.transform.position : { x: 0, y: 0 };
            if (node && isPointInRect(worldPos.x, worldPos.y, {
                x: nodePos.x,
                y: nodePos.y,
                width: node.width || 100,
                height: node.height || 60
            })) {
                hoveredNode = node;
                break;
            }
        }
        
        // 如果悬浮的节点发生变化
        if (hoveredNode !== this.hoveredNode) {
            // 重置状态
            this.resetTooltipState();
            
            // 更新当前悬浮的节点
            this.hoveredNode = hoveredNode;
            
            // 如果有新节点且节点有描述信息，设置定时器记录显示时间
            if (hoveredNode && hoveredNode.description && hoveredNode.description.trim()) {
                this.hoverStartTime = Date.now();
                // 记录悬浮时间，用于在render中判断是否显示提示框
            }
        }
    }
    

    
    // 重置提示框状态
    resetTooltipState() {
        if (this.hoverTimeout) {
            clearTimeout(this.hoverTimeout);
            this.hoverTimeout = null;
        }
        this.hoverStartTime = 0;
    }
    
    // 使用Canvas绘制节点提示框
    drawTooltip(ctx, node, mouseX, mouseY) {
        if (!node || !node.description || !node.description.trim()) {
            return;
        }
        
        // 检查悬浮时间是否超过1秒
        const currentTime = Date.now();
        if (currentTime - this.hoverStartTime < 1000) {
            return;
        }
        
        // 配置项
        const padding = 8;
        const borderRadius = 4;
        const maxWidth = 300;
        const fontSize = 12;
        
        // 获取主题颜色
        const isLight = document.body.classList.contains('light-mode');
        const bgColor = isLight ? 'rgba(255, 255, 255, 0.95)' : 'rgba(45, 45, 48, 0.95)';
        const borderColor = isLight ? '#ccc' : '#3e3e42';
        const textColor = isLight ? '#333333' : '#e0e0e0';
        
        // 手动保存所有会修改的状态属性
        const originalFillStyle = ctx.fillStyle;
        const originalStrokeStyle = ctx.strokeStyle;
        const originalLineWidth = ctx.lineWidth;
        const originalFont = ctx.font;
        const originalTextBaseline = ctx.textBaseline;
        
        // 设置字体
        ctx.font = `${fontSize}px Arial, sans-serif`;
        ctx.textBaseline = 'top';
        
        // 文本换行处理
        const text = node.description.trim();
        const lines = [];
        let currentLine = '';
        
        // 按单词分割处理换行
        const words = text.split(' ');
        for (let i = 0; i < words.length; i++) {
            const testLine = currentLine + (currentLine ? ' ' : '') + words[i];
            const metrics = ctx.measureText(testLine);
            
            if (metrics.width > maxWidth - (padding * 2)) {
                if (currentLine) {
                    lines.push(currentLine);
                    currentLine = words[i];
                } else {
                    // 单个单词就超过最大宽度，强制截断
                    let truncated = words[i];
                    while (ctx.measureText(truncated).width > maxWidth - (padding * 2)) {
                        truncated = truncated.slice(0, -1);
                    }
                    lines.push(truncated + '...');
                    currentLine = '';
                }
            } else {
                currentLine = testLine;
            }
        }
        
        if (currentLine) {
            lines.push(currentLine);
        }
        
        // 计算提示框尺寸
        let textHeight = fontSize * lines.length;
        let boxWidth = maxWidth;
        let boxHeight = textHeight + (padding * 2);
        
        // 调整位置，避免超出画布边界
        let x = mouseX + 10;
        let y = mouseY + 10;
        
        if (x + boxWidth > this.canvas.width) {
            x = mouseX - boxWidth - 10;
        }
        if (y + boxHeight > this.canvas.height) {
            y = mouseY - boxHeight - 10;
        }
        
        // 确保不小于画布边界
        x = Math.max(0, x);
        y = Math.max(0, y);
        
        // 绘制提示框背景
        ctx.fillStyle = bgColor;
        ctx.strokeStyle = borderColor;
        ctx.lineWidth = 1;
        
        // 绘制圆角矩形
        ctx.beginPath();
        ctx.moveTo(x + borderRadius, y);
        ctx.lineTo(x + boxWidth - borderRadius, y);
        ctx.arcTo(x + boxWidth, y, x + boxWidth, y + borderRadius, borderRadius);
        ctx.lineTo(x + boxWidth, y + boxHeight - borderRadius);
        ctx.arcTo(x + boxWidth, y + boxHeight, x + boxWidth - borderRadius, y + boxHeight, borderRadius);
        ctx.lineTo(x + borderRadius, y + boxHeight);
        ctx.arcTo(x, y + boxHeight, x, y + boxHeight - borderRadius, borderRadius);
        ctx.lineTo(x, y + borderRadius);
        ctx.arcTo(x, y, x + borderRadius, y, borderRadius);
        ctx.closePath();
        
        ctx.fill();
        ctx.stroke();
        
        // 绘制文本
        ctx.fillStyle = textColor;
        for (let i = 0; i < lines.length; i++) {
            ctx.fillText(lines[i], x + padding, y + padding + (i * fontSize));
        }
        
        // 手动恢复所有状态属性
        ctx.fillStyle = originalFillStyle;
        ctx.strokeStyle = originalStrokeStyle;
        ctx.lineWidth = originalLineWidth;
        ctx.font = originalFont;
        ctx.textBaseline = originalTextBaseline;
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
    
    // 使用纯树形结构进行自动排列（从左到右，从上到下）
    /**
     * 使用树形结构算法进行自动排列
     */
    arrangeNodesWithForceLayout() {
        try {
            // 确定要排列的节点：如果有选中的节点，则只排列选中的节点，否则排列所有节点
            const selectedNodes = this.selectedElements.filter(el => el.type === 'node');
            const nodesToArrange = selectedNodes.length > 0 ? selectedNodes : this.nodes;
            
            if (nodesToArrange.length === 0) {
                this.showNotification('没有节点需要排列');
                return;
            }
            
            // 保存当前位置以便撤销
            const oldPositions = nodesToArrange.map(node => {
                const nodePos = (node.transform && node.transform.position) ? 
                    node.transform.position : { x: 0, y: 0 };
                return {
                    id: node.id,
                    x: nodePos.x,
                    y: nodePos.y
                };
            });
            
            // 实现互斥逻辑：如果实时排列正在运行，则先停止它
            if (this.isRealTimeArrangeActive) {
                this.stopRealTimeArrange();
                this.showNotification('已停止实时排列，开始树形自动排列');
            }
            
            // 使用纯树形结构算法排列节点
            this.arrangeNodesInTreeLayout(nodesToArrange);
            
            // 保存历史记录
            this.historyManager.addHistory('arrange', {
                oldPositions: oldPositions,
                editor: this
            });
            
            // 显示操作成功提示
            this.showNotification('节点已按树形结构排列');
            
        } catch (error) {
            console.error('自动排列失败:', error);
            this.showNotification('自动排列失败: ' + error.message);
        }
    }
    
    /**
     * 纯树形结构排列算法
     * @param {Node[]} nodesToArrange - 要排列的节点数组
     */
    arrangeNodesInTreeLayout(nodesToArrange) {
        const NODE_WIDTH = 180;
        const NODE_HEIGHT = 80;
        const HORIZONTAL_SPACING = 200;  // 水平间距
        const VERTICAL_SPACING = 100;    // 垂直间距
        const START_X = 100;             // 起始X坐标
        const START_Y = 100;             // 起始Y坐标
        
        // 过滤出非固定节点进行排列
        const movableNodes = nodesToArrange.filter(node => !node.fixedPosition);
        const fixedNodes = nodesToArrange.filter(node => node.fixedPosition);
        
        if (movableNodes.length === 0) {
            this.showNotification('没有可移动的节点（所有节点都已固定位置）');
            return;
        }
        
        // 构建节点图结构（只包含可移动节点）
        const nodeMap = new Map();
        movableNodes.forEach(node => nodeMap.set(node.id, node));
        
        // 找出根节点（没有入边的节点）
        const rootNodes = [];
        const hasIncomingEdge = new Set();
        
        // 标记有入边的节点（只考虑可移动节点之间的连接）
        this.connections.forEach(conn => {
            if (nodeMap.has(conn.targetNodeId) && nodeMap.has(conn.sourceNodeId)) {
                hasIncomingEdge.add(conn.targetNodeId);
            }
        });
        
        // 找出所有根节点
        movableNodes.forEach(node => {
            if (!hasIncomingEdge.has(node.id)) {
                rootNodes.push(node);
            }
        });
        
        // 如果没有根节点（存在环），选择第一个节点作为根
        if (rootNodes.length === 0 && movableNodes.length > 0) {
            rootNodes.push(movableNodes[0]);
        }
        
        // 按层级排列节点
        const levels = []; // 每层包含的节点
        const visited = new Set();
        const queue = [];
        
        // 初始化队列，放入所有根节点
        rootNodes.forEach(root => {
            queue.push({ node: root, level: 0 });
            visited.add(root.id);
        });
        
        // 广度优先遍历构建层级
        while (queue.length > 0) {
            const { node, level } = queue.shift();
            
            // 确保层级数组存在
            if (!levels[level]) {
                levels[level] = [];
            }
            levels[level].push(node);
            
            // 找到当前节点的所有子节点（通过出边）
            this.connections.forEach(conn => {
                if (conn.sourceNodeId === node.id && 
                    nodeMap.has(conn.targetNodeId) && 
                    !visited.has(conn.targetNodeId)) {
                    queue.push({ 
                        node: nodeMap.get(conn.targetNodeId), 
                        level: level + 1 
                    });
                    visited.add(conn.targetNodeId);
                }
            });
        }
        
        // 添加未被访问的节点（可能是孤立节点或环中的节点）
        movableNodes.forEach(node => {
            if (!visited.has(node.id)) {
                // 放在最后一层
                const lastLevel = levels.length;
                if (!levels[lastLevel]) {
                    levels[lastLevel] = [];
                }
                levels[lastLevel].push(node);
            }
        });
        
        // 计算每个节点的位置
        levels.forEach((levelNodes, levelIndex) => {
            const levelY = START_Y + levelIndex * (NODE_HEIGHT + VERTICAL_SPACING);
            
            levelNodes.forEach((node, nodeIndex) => {
                const nodeX = START_X + nodeIndex * (NODE_WIDTH + HORIZONTAL_SPACING);
                
                // 确保transform和position存在
                if (!node.transform) {
                    node.transform = {};
                }
                if (!node.transform.position) {
                    node.transform.position = { x: 0, y: 0 };
                }
                
                // 设置节点位置
                node.transform.position.x = nodeX;
                node.transform.position.y = levelY;
            });
        });
        
        // 显示操作结果信息
        if (fixedNodes.length > 0) {
            this.showNotification(`已排列 ${movableNodes.length} 个节点，${fixedNodes.length} 个固定位置节点未移动`);
        } else {
            this.showNotification(`已排列 ${movableNodes.length} 个节点`);
        }
        
        // 触发一次渲染
        this.scheduleRender();
    }
    
    // 当D3.js不可用时的简单排列回退方案
    simpleArrangeFallback(nodes) {
        const NODE_WIDTH = 180;
        const NODE_HEIGHT = 80;
        const SPACING = 50;
        const START_X = 100;
        const START_Y = 100;
        const COLUMNS = 4;
        
        // 过滤出非固定节点进行排列
        const movableNodes = nodes.filter(node => !node.fixedPosition);
        const fixedNodes = nodes.filter(node => node.fixedPosition);
        
        if (movableNodes.length === 0) {
            this.showNotification('没有可移动的节点（所有节点都已固定位置）');
            return;
        }
        
        movableNodes.forEach((node, index) => {
            const col = index % COLUMNS;
            const row = Math.floor(index / COLUMNS);
            const newX = START_X + col * (NODE_WIDTH + SPACING);
            const newY = START_Y + row * (NODE_HEIGHT + SPACING);
            
            if (node.transform && node.transform.position) {
                node.transform.position.x = newX;
                node.transform.position.y = newY;
            } else {
                // 确保transform对象存在
                if (!node.transform) {
                    node.transform = {};
                }
                if (!node.transform.position) {
                    node.transform.position = { x: 0, y: 0 };
                }
                node.transform.position.x = newX;
                node.transform.position.y = newY;
            }
        });
        
        // 显示操作结果信息
        if (fixedNodes.length > 0) {
            this.showNotification(`已排列 ${movableNodes.length} 个节点，${fixedNodes.length} 个固定位置节点未移动`);
        } else {
            this.showNotification(`已排列 ${movableNodes.length} 个节点`);
        }
    }
    
    // 识别孤立节点和有连接的节点
    identifyNodeGroups(nodes = null) {
        // 如果没有提供nodes参数，则使用可视节点
        const targetNodes = nodes || this.visibleNodes;
        const connectedNodeIds = new Set();
        
        // 收集有连接的节点ID（只考虑与目标节点相关的连接）
        this.visibleConnections.forEach(conn => {
            // 检查连接的源节点或目标节点是否在目标节点集合中
            if (targetNodes.some(node => node.id === conn.sourceNodeId || node.id === conn.targetNodeId)) {
                connectedNodeIds.add(conn.sourceNodeId);
                connectedNodeIds.add(conn.targetNodeId);
            }
        });
        
        // 分离孤立节点和有连接的节点
        const isolatedNodes = [];
        const connectedNodes = [];
        
        targetNodes.forEach(node => {
            if (connectedNodeIds.has(node.id)) {
                connectedNodes.push(node);
            } else {
                isolatedNodes.push(node);
            }
        });
        
        return { isolatedNodes, connectedNodes };
    }
    
    // 排列孤立节点为矩阵
    arrangeIsolatedNodes(isolatedNodes, startX, startY, nodeWidth) {
        const columns = Math.ceil(Math.sqrt(isolatedNodes.length));
        const rows = Math.ceil(isolatedNodes.length / columns);
        const spacing = nodeWidth * 1.5;
        
        let minX = Infinity;
        let minY = Infinity;
        let maxX = -Infinity;
        let maxY = -Infinity;
        
        // 计算矩阵中心偏移，使矩阵居中
        const totalWidth = (columns - 1) * spacing;
        const centerOffsetX = totalWidth / 2;
        
        isolatedNodes.forEach((node, index) => {
            const row = Math.floor(index / columns);
            const col = index % columns;
            
            const newX = startX + col * spacing - centerOffsetX;
            const newY = startY + row * spacing;
            
            if (node.transform && node.transform.position) {
                node.transform.position.x = newX;
                node.transform.position.y = newY;
            } else {
                // 确保transform对象存在
                if (!node.transform) {
                    node.transform = {};
                }
                if (!node.transform.position) {
                    node.transform.position = { x: 0, y: 0 };
                }
                node.transform.position.x = newX;
                node.transform.position.y = newY;
            }
            
            // 更新边界
            const nodeWidth = node.width || 100;
            minX = Math.min(minX, newX - nodeWidth / 2);
            minY = Math.min(minY, newY - 40);
            maxX = Math.max(maxX, newX + nodeWidth / 2);
            maxY = Math.max(maxY, newY + 40);
        });
        
        return { left: minX, top: minY, right: maxX, bottom: maxY };
    }
    
    // 查找连通分量（互相连接的节点组）
    findConnectedGroups(nodes) {
        const nodeMap = new Map();
        const adjacencyList = new Map();
        const visited = new Set();
        const groups = [];
        
        // 构建节点映射
        nodes.forEach(node => {
            nodeMap.set(node.id, node);
            adjacencyList.set(node.id, []);
        });
        
        // 构建邻接表（忽略连接方向）
        this.connections.forEach(conn => {
            if (nodeMap.has(conn.sourceNodeId) && nodeMap.has(conn.targetNodeId)) {
                adjacencyList.get(conn.sourceNodeId).push(conn.targetNodeId);
                adjacencyList.get(conn.targetNodeId).push(conn.sourceNodeId);
            }
        });
        
        // DFS查找连通分量
        function dfs(nodeId, currentGroup) {
            visited.add(nodeId);
            currentGroup.push(nodeMap.get(nodeId));
            
            adjacencyList.get(nodeId).forEach(neighborId => {
                if (!visited.has(neighborId)) {
                    dfs(neighborId, currentGroup);
                }
            });
        }
        
        // 遍历所有节点，找出所有连通分量
        nodes.forEach(node => {
            if (!visited.has(node.id)) {
                const group = [];
                dfs(node.id, group);
                groups.push(group);
            }
        });
        
        return groups;
    }
    
    // 处理双击事件
    handleDoubleClick(e) {
        const rect = this.canvas.getBoundingClientRect();
        const x = e.clientX - rect.left;
        const y = e.clientY - rect.top;
        const worldPos = this.screenToWorld(x, y);
        
        // 首先检查是否双击了文字对象
        const clickedText = this.textContents.find(text => {
            const position = (text.transform && text.transform.position) ? 
                text.transform.position : { x: 0, y: 0 };
            return isPointInRect(worldPos.x, worldPos.y, {
                x: position.x,
                y: position.y,
                width: text.width || 200, // 默认宽度
                height: text.height || 30  // 默认高度
            });
        });
        
        if (clickedText) {
            this.startEditTextContent(clickedText);
            return true;
        }
        
        // 检查是否点击了节点
        const clickedNode = this.nodes.find(node => {
            const nodePos = (node.transform && node.transform.position) ? 
                node.transform.position : { x: 0, y: 0 };
            return isPointInRect(worldPos.x, worldPos.y, {
                x: nodePos.x,
                y: nodePos.y,
                width: node.width || 100,
                height: node.height || 60
            });
        });
        
        if (clickedNode) {
            // 查找所有连通分量
            const allGroups = this.findConnectedGroups(this.nodes);
            
            // 找到包含点击节点的连通分量
            const targetGroup = allGroups.find(group => 
                group.some(node => node.id === clickedNode.id)
            );
            
            if (targetGroup) {
                // 如果没有按住Ctrl键，则清除当前选择
                if (!e.ctrlKey && !e.metaKey) {
                    this.deselectAll();
                }
                
                // 选中连通分量中的所有节点
                targetGroup.forEach(node => {
                    // 检查节点是否已经被选中
                    const isAlreadySelected = this.selectedElements.some(el => el.id === node.id);
                    if (!isAlreadySelected) {
                        this.selectedElements.push(node);
                    }
                });
                
                // 应用筛选器
                this.filterSelectedElements();
                
                // 更新属性面板
                updatePropertyPanel(this);
                
                // 重新渲染
                this.scheduleRender();
            }
        }
        
        return true;
    }
    
    // 计算每个节点的连接数量
    calculateNodeConnectionCounts(nodes) {
        const connectionCounts = new Map();
        const nodeIdSet = new Set(nodes.map(n => n.id));
        
        // 初始化计数
        nodes.forEach(node => {
            connectionCounts.set(node.id, 0);
        });
        
        // 统计经过每个节点的连接数量
        this.visibleConnections.forEach(conn => {
            if (nodeIdSet.has(conn.sourceNodeId)) {
                connectionCounts.set(conn.sourceNodeId, connectionCounts.get(conn.sourceNodeId) + 1);
            }
            if (nodeIdSet.has(conn.targetNodeId)) {
                connectionCounts.set(conn.targetNodeId, connectionCounts.get(conn.targetNodeId) + 1);
            }
        });
        
        return connectionCounts;
    }
    
    // 按连接数量分组并排序节点
    groupNodesByConnectionCount(nodes, connectionCounts) {
        const nodesByCount = new Map();
        
        // 按连接数量分组
        nodes.forEach(node => {
            const count = connectionCounts.get(node.id);
            if (!nodesByCount.has(count)) {
                nodesByCount.set(count, []);
            }
            nodesByCount.get(count).push(node);
        });
        
        // 对每个连接数量组内的节点按ID排序
        nodesByCount.forEach((nodeList, count) => {
            nodeList.sort((a, b) => a.id.localeCompare(b.id));
        });
        
        // 获取降序排列的连接数量
        const sortedCounts = Array.from(nodesByCount.keys()).sort((a, b) => b - a);
        
        return { nodesByCount, sortedCounts };
    }
    
    // 辐射状排列组内节点（按距离根节点的层级）
    arrangeNodesInRadialPattern(group, nodesByConnectionCount, startX, startY, nodeWidth, nodeHeight, minDistance) {
        if (group.length === 0) {
            return { left: 0, top: 0, right: 0, bottom: 0 };
        }
        
        // 找出连接数量最多的节点作为根节点
        const maxCount = nodesByConnectionCount.sortedCounts[0];
        const rootNode = nodesByConnectionCount.nodesByCount.get(maxCount)[0];
        
        // 设置根节点位置
        if (rootNode.transform && rootNode.transform.position) {
            rootNode.transform.position.x = startX;
            rootNode.transform.position.y = startY;
        } else {
            // 确保transform对象存在
            if (!rootNode.transform) {
                rootNode.transform = {};
            }
            if (!rootNode.transform.position) {
                rootNode.transform.position = { x: 0, y: 0 };
            }
            rootNode.transform.position.x = startX;
            rootNode.transform.position.y = startY;
        }
        
        // 跟踪已放置的节点
        const placedNodes = new Set([rootNode.id]);
        
        // 构建依赖图（无向图）
        const dependencyGraph = {};
        group.forEach(node => {
            dependencyGraph[node.id] = [];
        });
        
        // 构建连接关系
        this.connections.forEach(conn => {
            if (dependencyGraph[conn.sourceNodeId] && dependencyGraph[conn.targetNodeId]) {
                dependencyGraph[conn.sourceNodeId].push(conn.targetNodeId);
                dependencyGraph[conn.targetNodeId].push(conn.sourceNodeId);
            }
        });
        
        // 计算每个节点距离根节点的层级
        const nodeLevels = this.calculateNodeLevels(dependencyGraph, [rootNode]);
        
        // 按层级分组节点
        const nodesByLevel = {};
        group.forEach(node => {
            const level = nodeLevels[node.id] || 0;
            if (!nodesByLevel[level]) {
                nodesByLevel[level] = [];
            }
            nodesByLevel[level].push(node);
        });
        
        // 获取所有层级并排序
        const levels = Object.keys(nodesByLevel).map(Number).sort((a, b) => a - b);
        
        // 层级半径设置
        const radiusPerLevel = minDistance * 1.5;
        
        // 固定角度间隔（20度，转换为弧度）
        const angleInterval = (20 * Math.PI) / 180;
        
        // 为每一层的节点分配位置
        levels.forEach(level => {
            if (level === 0) return; // 根节点已经放置
            
            const nodes = nodesByLevel[level];
            const radius = level * radiusPerLevel;
            
            // 从根节点上方开始，顺时针排列
            let currentAngle = -Math.PI / 2;
            
            nodes.forEach(node => {
                // 只放置未放置的节点
                if (!placedNodes.has(node.id)) {
                    const rootPos = (rootNode.transform && rootNode.transform.position) ? 
                        rootNode.transform.position : { x: 0, y: 0 };
                    const newX = rootPos.x + radius * Math.cos(currentAngle);
                    const newY = rootPos.y + radius * Math.sin(currentAngle);
                    
                    if (node.transform && node.transform.position) {
                        node.transform.position.x = newX;
                        node.transform.position.y = newY;
                    } else {
                        // 确保transform对象存在
                        if (!node.transform) {
                            node.transform = {};
                        }
                        if (!node.transform.position) {
                            node.transform.position = { x: 0, y: 0 };
                        }
                        node.transform.position.x = newX;
                        node.transform.position.y = newY;
                    }
                    
                    placedNodes.add(node.id);
                    
                    // 顺时针增加固定角度
                    currentAngle += angleInterval;
                }
            });
        });
        
        // 计算组的外接矩形
        let minX = Infinity;
        let minY = Infinity;
        let maxX = -Infinity;
        let maxY = -Infinity;
        
        group.forEach(node => {
            const nodePos = (node.transform && node.transform.position) ? 
                node.transform.position : { x: 0, y: 0 };
            const nodeWidth = node.width || 100;
            minX = Math.min(minX, nodePos.x - nodeWidth / 2);
            minY = Math.min(minY, nodePos.y - 40);
            maxX = Math.max(maxX, nodePos.x + nodeWidth / 2);
            maxY = Math.max(maxY, nodePos.y + 40);
        });
        
        // 如果组只有一个节点，设置一个默认大小的矩形
        if (group.length === 1) {
            const rootPos = (rootNode.transform && rootNode.transform.position) ? 
                rootNode.transform.position : { x: 0, y: 0 };
            const nodeWidth = rootNode.width || 100;
            const nodeHeight = rootNode.height || 60;
            minX = rootPos.x - nodeWidth;
            maxX = rootPos.x + nodeWidth;
            minY = rootPos.y - nodeHeight;
            maxY = rootPos.y + nodeHeight;
        }
        
        return { left: minX, top: minY, right: maxX, bottom: maxY };
    }
    
    // 计算每个节点的层级
    /**
     * 注意：此函数是为真正的树形排列设计的，但目前未被使用
     * 当前系统使用力导向图算法进行排列，而非树形排列
     * 建议在确认不再需要真正的树形排列功能后删除此函数
     */
    calculateNodeLevels(dependencyGraph, roots) {
        const nodeLevels = {};
        const visited = new Set();
        const recursionStack = new Set(); // 用于检测循环依赖
        
        // 使用DFS计算层级
        function dfs(nodeId, currentLevel) {
            // 检测循环依赖
            if (recursionStack.has(nodeId)) {
                console.warn(`检测到循环依赖: ${nodeId}，跳过以避免栈溢出`);
                return;
            }
            
            if (visited.has(nodeId)) {
                // 如果节点已访问，检查是否需要更新层级（取较大值）
                if (nodeLevels[nodeId] < currentLevel) {
                    nodeLevels[nodeId] = currentLevel;
                    // 递归更新子节点层级，但避免循环
                    dependencyGraph[nodeId].forEach(childId => {
                        if (!recursionStack.has(childId)) {
                            dfs(childId, currentLevel + 1);
                        }
                    });
                }
                return;
            }
            
            // 标记当前节点在递归栈中
            recursionStack.add(nodeId);
            visited.add(nodeId);
            nodeLevels[nodeId] = currentLevel;
            
            // 递归处理子节点
            dependencyGraph[nodeId].forEach(childId => {
                dfs(childId, currentLevel + 1);
            });
            
            // 处理完子节点后，从递归栈中移除当前节点
            recursionStack.delete(nodeId);
        }
        
        // 从根节点开始DFS
        roots.forEach(rootNode => {
            if (rootNode && rootNode.id) { // 确保rootNode有效
                dfs(rootNode.id, 0);
            }
        });
        
        return nodeLevels;
    }
    
    // 创建节点
    createNode(x, y, name = '新节点', description = '') {
        const node = new NodeModel({
            name: name,
            position: { x: x || 100, y: y || 100 }
        });
        node.description = description;
        node.group = '';
        node.width = 120;
        node.height = 60;
        
        // 确保transform对象存在
        if (!node.transform) {
            node.transform = {};
        }
        if (!node.transform.position) {
            node.transform.position = { x: x || 100, y: y || 100 };
        }
        
        return node;
    }
    
    // 添加节点到编辑器
    addNode(node) {
        if (!node) {
            throw new Error('节点不能为空');
        }
        
        // 确保节点有ID
        if (!node.id) {
            node.id = this.generateUniqueId();
        }
        
        // 确保transform对象存在
        if (!node.transform) {
            node.transform = {};
        }
        if (!node.transform.position) {
            node.transform.position = { x: node.x || 100, y: node.y || 100 };
        }
        
        this.nodes.push(node);
        
        // 更新可视对象
        this.updateVisibleObjects(true);
        
        // 记录历史
        this.historyManager.addHistory('add-node', {
            node: node.clone()
        });
        
        // 重新渲染
        this.scheduleRender();
        
        return node;
    }
    
    // 创建连线
    createConnection(sourceNode, targetNode, conditions = []) {
        if (!sourceNode || !targetNode) {
            throw new Error('源节点和目标节点不能为空');
        }
        
        if (sourceNode.id === targetNode.id) {
            throw new Error('不能创建自连接');
        }
        
        const connection = new ConnectionModel({
            sourceNodeId: sourceNode.id,
            targetNodeId: targetNode.id
        });
        
        // 添加条件
        if (Array.isArray(conditions)) {
            connection.conditions = conditions;
        } else if (conditions) {
            connection.conditions = [conditions];
        }
        
        return connection;
    }
    
    // 添加连线到编辑器
    addConnection(connection) {
        if (!connection) {
            throw new Error('连线不能为空');
        }
        
        // 移除连接重复检查，允许节点间创建多个连接
        
        this.connections.push(connection);
        
        // 更新可视对象
        this.updateVisibleObjects(true);
        
        // 记录历史
        this.historyManager.addHistory('add-connection', {
            connection: connection.clone()
        });
        
        // 重新渲染
        this.scheduleRender();
        
        return connection;
    }
    
    // 生成唯一ID
    generateUniqueId() {
        return Date.now().toString(36) + Math.random().toString(36).substr(2);
    }
    
    // 清空所有内容
    clearAll() {
        this.nodes = [];
        this.connections = [];
        this.textContents = [];
        this.selectedElements = [];
        
        // 更新可视对象
        this.updateVisibleObjects(true);
        
        // 记录历史
        this.historyManager.addHistory('clear-all', {
            nodes: [],
            connections: [],
            textContents: []
        });
        
        // 重新渲染
        this.scheduleRender();
    }
    
    // 显示通知
    showNotification(message) {
        // 创建通知元素
        const notification = document.createElement('div');
        notification.className = 'notification';
        notification.textContent = message;
        notification.style.cssText = `
            position: fixed;
            top: 48px;
            right: 24px;
            background-color: #36b374ff;
            color: white;
            padding: 12px 24px;
            border-radius: 4px;
            z-index: 1000;
            font-size: 14px;
            box-shadow: 0 2px 8px rgba(0,0,0,0.2);
            animation: slideIn 0.3s ease-out;
        `;
        
        // 添加动画样式
        const style = document.createElement('style');
        style.textContent = `
            @keyframes slideIn {
                from {
                    transform: translateX(100%);
                    opacity: 0;
                }
                to {
                    transform: translateX(0);
                    opacity: 1;
                }
            }
        `;
        document.head.appendChild(style);
        
        // 添加到文档
        document.body.appendChild(notification);
        
        // 3秒后移除
        setTimeout(() => {
            notification.style.animation = 'none';
            notification.style.transition = 'opacity 0.3s, transform 0.3s';
            notification.style.opacity = '0';
            notification.style.transform = 'translateX(100%)';
            setTimeout(() => {
                document.body.removeChild(notification);
                document.head.removeChild(style);
            }, 300);
        }, 3000);
    }
}

// 导出NodeGraphEditorController类
export { NodeGraphEditorController };