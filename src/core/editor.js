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
            this.visibilityCuller.isNodeVisible(node, visibleBounds)
        );
        
        // 过滤出可见的连线
        this.visibleConnections = [];
        const nodeMap = new Map(this.nodes.map(node => [node.id, node]));
        
        for (const connection of this.connections) {
            const sourceNode = nodeMap.get(connection.sourceNodeId);
            const targetNode = nodeMap.get(connection.targetNodeId);
            if (sourceNode && targetNode && 
                this.visibilityCuller.isConnectionVisible(connection, sourceNode, targetNode, visibleBounds)) {
                this.visibleConnections.push(connection);
            }
        }
    }
    
    // 处理实时自动排列
    handleRealTimeArrange() {
        try {
            // 直接调用节点图编辑器的力导向图排列方法
            // 此方法负责启动或停止实时排列功能，使用本地D3.js库
            this.performForceLayoutArrange();
        } catch (error) {
            console.error('处理实时排列时发生错误:', error);
            // 发生错误时，确保状态被正确重置
            if (this.forceSimulation) {
                this.stopForceLayout();
            }
        }
    }
    
    // 使用D3.js实现力导向图排列
    performForceLayoutArrange() {
        // 检查D3.js库是否已经加载
        if (typeof d3 !== 'undefined') {
            console.log('开始使用D3.js进行力导向图排列');
            
            // 检查是否已有活跃的模拟，避免重复创建
            if (this.forceSimulation) {
                this.stopForceLayout();
                this.showNotification('实时排列已停止');
                return;
            }
            
            // 判断是否有选中的节点
            const selectedNodes = this.selectedElements.filter(el => el instanceof Node);
            
            // 确定要排列的节点：如果有选中的节点，则仅使用选中的节点；否则使用全局节点
            let nodes;
            if (selectedNodes.length > 0) {
                // 仅模拟选中的节点
                nodes = selectedNodes;
            } else {
                // 没有选中任何节点，或选中的只有连接没有节点，则模拟全局节点
                nodes = this.nodes;
            }
            
            // 获取与这些节点相关的连接（只包含两端都在节点列表中的连接）
            const nodeIds = new Set(nodes.map(n => n.id));
            const links = this.connections
                .filter(conn => nodeIds.has(conn.sourceNodeId) && nodeIds.has(conn.targetNodeId))
                .map(conn => ({
                    source: conn.sourceNodeId,
                    target: conn.targetNodeId
                }));
            
            if (nodes.length === 0) {
                this.showNotification('没有节点需要排列');
                return;
            }
            
            // 准备D3.js数据结构 - 添加默认值以确保与单次排列兼容
            const nodeMap = new Map();
            const d3Nodes = nodes.map(node => {
                const d3Node = {
                    id: node.id,
                    x: node.x || 0,
                    y: node.y || 0,
                    width: node.width || 150, // 添加默认宽度
                    height: node.height || 100 // 添加默认高度
                };
                nodeMap.set(node.id, d3Node);
                return d3Node;
            });
            
            // 优化连接数据处理，确保节点ID查找的健壮性
            const d3Links = links
                .map(link => {
                    const sourceNode = nodeMap.get(link.source);
                    const targetNode = nodeMap.get(link.target);
                    return {
                        source: sourceNode,
                        target: targetNode
                    };
                })
                .filter(link => link.source && link.target); // 确保连接的两端都有效
            
            // 创建力导向模拟 - 使用本地D3.js库
            this.forceSimulation = d3.forceSimulation(d3Nodes)
                .force("link", d3.forceLink(d3Links).id(d => d.id).distance(150))
                .force("charge", d3.forceManyBody().strength(-300))
                .force("collide", d3.forceCollide().radius(d => Math.max(d.width || 150, d.height || 100) / 2 + 15))
                .force("center", d3.forceCenter(this.canvas.width / 2, this.canvas.height / 2));
            
            // 初始化节点位置历史记录，用于计算运动变化量
            const nodePositionHistory = new Map();
            nodes.forEach(node => {
                nodePositionHistory.set(node.id, { x: node.x, y: node.y });
            });
            
            // 设置运动检测阈值和计数器
            const MOTION_THRESHOLD = 0.5; // 运动变化量阈值
            const STATIC_TICK_COUNT = 20; // 连续静止的tick次数阈值
            let staticTickCounter = 0;
            
            // 添加tick事件监听器，实时更新节点位置
            this.forceSimulation.on("tick", () => {
                // 计算所有节点的平均运动变化量
                let totalMotion = 0;
                let nodeCount = 0;
                
                // 更新原始节点位置并计算运动变化
                d3Nodes.forEach(d3Node => {
                    const originalNode = nodes.find(n => n.id === d3Node.id);
                    if (originalNode) {
                        // 记录当前位置
                        const currentX = d3Node.fx !== undefined ? d3Node.fx : d3Node.x;
                        const currentY = d3Node.fy !== undefined ? d3Node.fy : d3Node.y;
                        
                        // 计算运动距离
                        const history = nodePositionHistory.get(originalNode.id);
                        const dx = currentX - history.x;
                        const dy = currentY - history.y;
                        const distance = Math.sqrt(dx * dx + dy * dy);
                        
                        // 累计总运动距离
                        totalMotion += distance;
                        nodeCount++;
                        
                        // 更新历史位置
                        history.x = currentX;
                        history.y = currentY;
                        
                        // 更新节点位置
                        originalNode.x = currentX;
                        originalNode.y = currentY;
                    }
                });
                
                // 计算平均运动变化量
                const avgMotion = nodeCount > 0 ? totalMotion / nodeCount : 0;
                
                // 检查是否接近静态
                if (avgMotion < MOTION_THRESHOLD) {
                    staticTickCounter++;
                    
                    // 如果连续多个tick都接近静态，且用户不活动时才自动停止模拟
                    if (staticTickCounter >= STATIC_TICK_COUNT && !this.isUserActive) {
                        console.log(`检测到节点运动变化过小（平均${avgMotion.toFixed(3)}px）且用户不活动，自动停止实时模拟`);
                        this.stopForceLayout();
                        this.showNotification('检测到节点接近静止且用户不活动，已自动停止实时排列');
                        return;
                    }
                } else {
                    // 有明显运动，重置计数器
                    staticTickCounter = 0;
                }
                
                // 记录当前alpha值（D3.js内置的活跃度指标）
                const currentAlpha = this.forceSimulation.alpha();
                
                // 当alpha值过低且用户不活动时，才考虑停止（D3.js的自然衰减）
                if (currentAlpha < 0.005 && !this.isUserActive) {
                    console.log(`D3.js模拟alpha值过低（${currentAlpha.toFixed(4)}）且用户不活动，自动停止实时模拟`);
                    this.stopForceLayout();
                    this.showNotification('模拟已自然收敛且用户不活动，已自动停止实时排列');
                    return;
                }
                
                // 调度渲染以显示更新后的位置
                this.scheduleRender();
            });
            
            // 保存节点映射，用于后续的拖拽处理
            this.forceSimulation.nodeMap = nodeMap;
            
            // 设置模拟状态标记
            this.isRealTimeArrangeActive = true;
            
            // 更新按钮状态
            this.updateArrangeButtonState();
            
            // 显示通知
            this.showNotification('实时交互式排列已启动');
        } else {
            console.error('D3.js库未找到，请确保已正确加载');
            this.showNotification('D3.js库未找到，无法执行自动排列');
        }
    }
    
    // 停止力导向图排列
    stopForceLayout() {
        if (this.forceSimulation) {
            this.forceSimulation.stop();
            this.forceSimulation = null;
            this.isRealTimeArrangeActive = false;
            
            // 更新按钮状态
            this.updateArrangeButtonState();
            
            // 恢复单次自动排列按钮的可用性
            if (this.toolbar) {
                this.toolbar.updateToolAvailability('auto-arrange', true);
            }
        }
    }
    
    // 更新排列按钮状态
    updateArrangeButtonState() {
        // 调用UIToolbar的方法更新按钮状态，保持代码一致性
        if (this.toolbar) {
            // 更新按钮状态和可用性
            this.toolbar.updateArrangeButtons(this.isRealTimeArrangeActive);
            
            // 更新按钮文字
            const button = document.getElementById('real-time-arrange')||this.toolbar.buttons['real-time-arrange'];
            if (button) {
                button.textContent = this.isRealTimeArrangeActive ? '停止实时排列' : '实时自动排列';
            }
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
                    isPointInRect(worldPos.x, worldPos.y, {
                        x: node.x,
                        y: node.y,
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
            // 检查是否点击了节点
            const clickedNode = this.visibleNodes.find(node => 
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
        
        // 如果节点已经被选中且按住Ctrl键，取消选择该节点
        if (isAlreadySelected && (e.ctrlKey || e.metaKey)) {
            const index = this.selectedElements.findIndex(el => el.id === node.id);
            if (index !== -1) {
                this.selectedElements.splice(index, 1);
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
                
                // 如果实时排列处于活动状态，固定D3.js模拟中的节点位置
                if (this.isRealTimeArrangeActive && this.forceSimulation && this.forceSimulation.nodeMap) {
                    const d3Node = this.forceSimulation.nodeMap.get(this.draggingElement.id);
                    if (d3Node) {
                        d3Node.fx = this.draggingElement.x;
                        d3Node.fy = this.draggingElement.y;
                    }
                }
            } else {
                // 如果有多个节点被选中，移动所有选中的节点
                selectedNodes.forEach(node => {
                    node.x += deltaX;
                    node.y += deltaY;
                    
                    // 如果实时排列处于活动状态，固定D3.js模拟中的节点位置
                    if (this.isRealTimeArrangeActive && this.forceSimulation && this.forceSimulation.nodeMap) {
                        const d3Node = this.forceSimulation.nodeMap.get(node.id);
                        if (d3Node) {
                            d3Node.fx = node.x;
                            d3Node.fy = node.y;
                        }
                    }
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
        
        // ESC键：取消连接创建
        if (e.key === 'Escape' || e.key === 'Esc') {
            e.preventDefault();
            if (this.creatingConnection) {
                this.creatingConnection = null;
                this.scheduleRender();
            }
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
            // 如果实时排列处于活动状态，取消D3.js模拟中的节点固定
            if (this.isRealTimeArrangeActive && this.forceSimulation && this.forceSimulation.nodeMap) {
                // 获取所有选中的节点
                const selectedNodes = this.selectedElements.filter(el => el.type === 'node');
                
                // 取消所有选中节点的固定
                selectedNodes.forEach(node => {
                    const d3Node = this.forceSimulation.nodeMap.get(node.id);
                    if (d3Node) {
                        // 保留当前位置作为初始值，但允许力模型进行调整
                        d3Node.x = d3Node.fx !== undefined ? d3Node.fx : d3Node.x;
                        d3Node.y = d3Node.fy !== undefined ? d3Node.fy : d3Node.y;
                        // 取消固定
                        d3Node.fx = undefined;
                        d3Node.fy = undefined;
                    }
                });
                
                // 重启模拟以允许其他节点调整
                this.forceSimulation.alpha(0.3).restart();
            }
            
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
        this.updateUserInputStatus();
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
        // 按节点对分组可视连线
        const connectionGroups = this.groupConnectionsByNodePair(this.visibleConnections);
        
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
            this.visibleNodes.forEach(node => {
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
        this.connections.push(connection);
        this.historyManager.addHistory('add-connection', connection.clone());
        this.selectedElements = [connection];
        // 强制更新可见对象列表，确保新连接可以被鼠标事件检测到
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
        const screenPos = this.worldToScreen(node.x, node.y);
        const width = node.width * this.zoom;
        const height = node.height * this.zoom;
        
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
        
        let displayName = node.name;
        if (displayName.length > 6) {
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
        if (lodLevel === 'LOD3') {
            return; // LOD3不绘制连线
        }
        
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
        
        // 获取连线属性（使用第一条连线的属性作为代表，已在上面声明）
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
                const startX = sourceNode.x + sourceNode.width / 2;
                const startY = sourceNode.y + sourceNode.height / 2;
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
            node.calculateAutoSize(this.ctx);
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
                    nodeMinX = Math.min(nodeMinX, node.x);
                    nodeMinY = Math.min(nodeMinY, node.y);
                    nodeMaxX = Math.max(nodeMaxX, node.x + node.width);
                    nodeMaxY = Math.max(nodeMaxY, node.y + node.height);
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
                minX = Math.min(minX, node.x);
                minY = Math.min(minY, node.y);
                maxX = Math.max(maxX, node.x + node.width);
                maxY = Math.max(maxY, node.y + node.height);
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
                this.quadTree.insert({
                    x: node.x,
                    y: node.y,
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
                minX = Math.min(minX, node.x);
                minY = Math.min(minY, node.y);
                maxX = Math.max(maxX, node.x + node.width);
                maxY = Math.max(maxY, node.y + node.height);
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
                this.quadTree.insert({
                    x: node.x,
                    y: node.y,
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
        const connectionGroups = this.groupConnectionsByNodePair();
        
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

        // 7. 绘制节点描述提示框（始终在最上层）
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
                const startX = sourceNode.x + sourceNode.width / 2;
                const startY = sourceNode.y + sourceNode.height / 2;
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
    }
    
    // 检测节点悬浮
    checkNodeHover(worldPos, screenX, screenY) {
        // 查找鼠标下方的节点（从后往前，优先检测最上层的节点）
        let hoveredNode = null;
        for (let i = this.visibleNodes.length - 1; i >= 0; i--) {
            const node = this.visibleNodes[i];
            if (isPointInRect(worldPos.x, worldPos.y, node.x, node.y, node.width, node.height)) {
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
    
    // 使用D3.js实现单次力导向图排列
    /**
     * 使用力导向图算法进行单次自动排列
     */
    arrangeNodesWithForceLayout() {
        (async () => {
            try {
                // 确定要排列的节点：如果有选中的节点，则只排列选中的节点，否则排列所有节点
                const selectedNodes = this.selectedElements.filter(el => el.type === 'node');
                const nodesToArrange = selectedNodes.length > 0 ? selectedNodes : this.nodes;
                
                if (nodesToArrange.length === 0) {
                    this.showNotification('没有节点需要排列');
                    return;
                }
                
                // 保存当前位置以便撤销
                const oldPositions = nodesToArrange.map(node => ({
                    id: node.id,
                    x: node.x,
                    y: node.y
                }));
                
                // 实现互斥逻辑：如果实时排列正在运行，则先停止它
                let wasRealTimeActive = false;
                if (this.isRealTimeArrangeActive) {
                    wasRealTimeActive = true;
                    this.stopForceLayout();
                    this.showNotification('已停止实时排列，开始单次自动排列');
                }
                
                // 检查D3.js库是否已经加载
                if (typeof d3 !== 'undefined') {
                    console.log('开始使用D3.js进行单次力导向图排列');
                    
                    // 准备D3.js数据结构 - 确保节点属性有默认值
                    const nodeMap = new Map();
                    const d3Nodes = nodesToArrange.map(node => {
                        const d3Node = {
                            id: node.id,
                            x: node.x || Math.random() * 400,
                            y: node.y || Math.random() * 300,
                            width: node.width || 180,
                            height: node.height || 80
                        };
                        nodeMap.set(node.id, d3Node);
                        return d3Node;
                    });
                    
                    // 过滤出与当前节点相关的连接
                    const d3Links = this.connections
                        .filter(conn => nodesToArrange.some(node => 
                            node.id === conn.sourceNodeId || node.id === conn.targetNodeId
                        ))
                        .map(conn => {
                            const source = nodeMap.get(conn.sourceNodeId);
                            const target = nodeMap.get(conn.targetNodeId);
                            return {
                                source: source,
                                target: target
                            };
                        })
                        .filter(link => link.source && link.target); // 确保源和目标节点都存在
                    
                    // 创建独立的力导向图模拟，使用局部变量避免与实时排列冲突
                    const simulation = d3.forceSimulation(d3Nodes)
                        .force('link', d3.forceLink(d3Links).id(d => d.id).distance(150))
                        .force('charge', d3.forceManyBody().strength(-300))
                        .force('center', d3.forceCenter(400, 300))
                        .force('collision', d3.forceCollide().radius(d => 
                            Math.max((d.width || 180) / 2, (d.height || 80) / 2) + 20
                        ));
                    
                    // 单次迭代：运行模拟一定次数后停止
                    const totalTicks = 300;
                    for (let i = 0; i < totalTicks; i++) {
                        simulation.tick();
                    }
                    
                    // 应用计算出的位置到实际节点
                    d3Nodes.forEach(d3Node => {
                        const node = nodesToArrange.find(n => n.id === d3Node.id);
                        if (node) {
                            node.x = d3Node.x;
                            node.y = d3Node.y;
                        }
                    });
                    
                    // 显式停止模拟并清理事件监听器，确保资源释放
                    simulation.stop();
                    simulation.on('tick', null); // 移除任何可能的事件监听器
                    
                    this.showNotification('自动排列完成');
                    
                } else {
                    console.error('D3.js库未加载，无法执行力导向图排列');
                    // 如果D3.js不可用，回退到简单排列
                    this.simpleArrangeFallback(nodesToArrange);
                }
                
                // 保存历史记录
                this.historyManager.addHistory('arrange', {
                    oldPositions: oldPositions,
                    editor: this
                });
                
                // 显示操作成功提示
                this.showNotification('节点已自动排列');
            } catch (error) {
                console.error('自动排列失败:', error);
            }
        })();
    }
    
    // 当D3.js不可用时的简单排列回退方案
    simpleArrangeFallback(nodes) {
        const NODE_WIDTH = 180;
        const NODE_HEIGHT = 80;
        const SPACING = 50;
        const START_X = 100;
        const START_Y = 100;
        const COLUMNS = 4;
        
        nodes.forEach((node, index) => {
            const col = index % COLUMNS;
            const row = Math.floor(index / COLUMNS);
            node.x = START_X + col * (NODE_WIDTH + SPACING);
            node.y = START_Y + row * (NODE_HEIGHT + SPACING);
        });
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
            
            node.x = startX + col * spacing - centerOffsetX;
            node.y = startY + row * spacing;
            
            // 更新边界
            minX = Math.min(minX, node.x - nodeWidth / 2);
            minY = Math.min(minY, node.y - 40);
            maxX = Math.max(maxX, node.x + nodeWidth / 2);
            maxY = Math.max(maxY, node.y + 40);
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
        rootNode.x = startX;
        rootNode.y = startY;
        
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
                    node.x = rootNode.x + radius * Math.cos(currentAngle);
                    node.y = rootNode.y + radius * Math.sin(currentAngle);
                    
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
            minX = Math.min(minX, node.x - nodeWidth / 2);
            minY = Math.min(minY, node.y - 40);
            maxX = Math.max(maxX, node.x + nodeWidth / 2);
            maxY = Math.max(maxY, node.y + 40);
        });
        
        // 如果组只有一个节点，设置一个默认大小的矩形
        if (group.length === 1) {
            minX = rootNode.x - nodeWidth;
            maxX = rootNode.x + nodeWidth;
            minY = rootNode.y - nodeHeight;
            maxY = rootNode.y + nodeHeight;
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