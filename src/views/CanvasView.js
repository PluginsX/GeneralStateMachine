// Canvas视图 - 负责Canvas的DOM管理和事件绑定
import CanvasRenderer from './CanvasRenderer.js';
import NodeService from '../services/NodeService.js';
import { VisibilityCuller, LODManager, PerformanceMonitor } from '../utils/performance.js';

export default class CanvasView {
    constructor(canvasId, editorViewModel) {
        this.canvas = document.getElementById(canvasId);
        if (!this.canvas) {
            throw new Error(`Canvas element with id "${canvasId}" not found`);
        }
        
        this.ctx = this.canvas.getContext('2d');
        this.editorViewModel = editorViewModel;
        this.renderer = new CanvasRenderer(this.canvas, editorViewModel.getEditorState());
        
        // 性能优化工具
        this.visibilityCuller = null;
        this.lodManager = new LODManager();
        this.performanceMonitor = new PerformanceMonitor();
        
        // 渲染状态
        this.animationId = null;
        this.lastRenderTime = 0;
        this.renderDelay = 16; // ~60FPS
        this.renderCount = 0;
        
        // 可视对象缓存
        this.visibleNodes = [];
        this.visibleConnections = [];
        this.visibleNodeMap = null; // 可见节点的Map，用于快速查找
        this.lastVisibleBounds = null;
        
        // 初始化
        this.init();
    }
    
    init() {
        this.setupCanvas();
        this.updatePerformanceTools();
        this.scheduleRender();
    }
    
    // 设置画布尺寸
    setupCanvas() {
        const resizeCanvas = () => {
            const container = this.canvas.parentElement;
            this.canvas.width = container.clientWidth;
            this.canvas.height = container.clientHeight;
            this.updatePerformanceTools();
            this.scheduleRender();
        };
        
        resizeCanvas();
        window.addEventListener('resize', resizeCanvas);
        
        const workspace = this.canvas.parentElement;
        if (workspace) {
            const resizeObserver = new ResizeObserver(() => {
                resizeCanvas();
            });
            resizeObserver.observe(workspace);
        }
    }
    
    // 更新性能工具
    updatePerformanceTools() {
        const editorState = this.editorViewModel.getEditorState();
        const pan = { x: editorState.panX, y: editorState.panY };
        this.visibilityCuller = new VisibilityCuller(this.canvas, pan, editorState.zoom);
    }
    
    // 更新可视对象缓存（性能优化版本）
    updateVisibleObjects(forceUpdate = false) {
        if (!this.visibilityCuller) return;
        
        const editorState = this.editorViewModel.getEditorState();
        this.visibilityCuller.updateView(
            { x: editorState.panX, y: editorState.panY },
            editorState.zoom
        );
        
        const visibleBounds = this.visibilityCuller.getVisibleBounds();
        
        // 检查可视区域是否变化（避免不必要的更新）
        if (!forceUpdate && this.lastVisibleBounds && 
            Math.abs(this.lastVisibleBounds.minX - visibleBounds.minX) < 1 &&
            Math.abs(this.lastVisibleBounds.minY - visibleBounds.minY) < 1 &&
            Math.abs(this.lastVisibleBounds.maxX - visibleBounds.maxX) < 1 &&
            Math.abs(this.lastVisibleBounds.maxY - visibleBounds.maxY) < 1) {
            return; // 可视区域未变化，使用缓存的可见对象
        }
        
        this.lastVisibleBounds = visibleBounds;
        
        const nodeViewModel = this.editorViewModel.getNodeViewModel();
        const connectionViewModel = this.editorViewModel.getConnectionViewModel();
        
        // 性能优化：使用迭代器直接遍历Map，避免创建中间数组
        // 注意：这里仍然需要遍历所有节点进行可见性检测，但这是必要的
        // 真正的优化在于后续的事件检测只使用可见节点
        
        // 先收集所有节点到数组（用于反向遍历和连线检测）
        // 虽然创建数组有开销，但反向遍历需要数组，且后续连线检测也需要数组
        const allNodes = nodeViewModel.getAllNodes();
        const allConnections = connectionViewModel.getAllConnections();
        
        // 过滤可见节点（从后往前，优先检测最上层的节点）
        // 使用反向遍历，这样最上层的节点（最后添加的）会在数组末尾
        this.visibleNodes = [];
        for (let i = allNodes.length - 1; i >= 0; i--) {
            const node = allNodes[i];
            if (this.visibilityCuller.isNodeVisible(node, visibleBounds)) {
                this.visibleNodes.unshift(node); // 保持顺序，最上层在最后
            }
        }
        
        // 创建节点Map（用于连线检测，只包含可见节点）
        this.visibleNodeMap = new Map();
        this.visibleNodes.forEach(node => {
            this.visibleNodeMap.set(node.id, node);
        });
        
        // 过滤可见连线（性能优化：优先检查可见节点之间的连线）
        this.visibleConnections = [];
        
        // 性能优化：先快速收集两端都可见的连线（最常见情况）
        for (const connection of allConnections) {
            const sourceNode = this.visibleNodeMap.get(connection.sourceNodeId);
            const targetNode = this.visibleNodeMap.get(connection.targetNodeId);
            
            // 如果两端节点都可见，连线一定可见（快速路径）
            if (sourceNode && targetNode) {
                this.visibleConnections.push(connection);
                continue;
            }
            
            // 只有一端可见或都不可见，需要检查连线是否穿过可视区域（慢速路径）
            // 这种情况较少，所以放在后面检查
            if (sourceNode || targetNode) {
                const source = sourceNode || nodeViewModel.getNode(connection.sourceNodeId);
                const target = targetNode || nodeViewModel.getNode(connection.targetNodeId);
                if (source && target && 
                    this.visibilityCuller.isConnectionVisible(connection, source, target, visibleBounds)) {
                    this.visibleConnections.push(connection);
                }
            }
        }
    }
    
    // 渲染
    render(timestamp) {
        const startTime = performance.now();
        
        // 限制渲染频率
        if (timestamp - this.lastRenderTime < this.renderDelay) {
            this.scheduleRender();
            return;
        }
        
        this.lastRenderTime = timestamp;
        
        // 更新可视对象缓存
        this.updateVisibleObjects();
        
        // 获取数据
        const editorState = this.editorViewModel.getEditorState();
        const nodeViewModel = this.editorViewModel.getNodeViewModel();
        const connectionViewModel = this.editorViewModel.getConnectionViewModel();
        
        // 更新渲染器的状态
        this.renderer.editorState = editorState;
        
        // 开始绘制
        this.renderer.beginDraw();
        
        // 绘制网格
        this.renderer.drawGrid();
        
        // 计算节点自适应尺寸
        this.visibleNodes.forEach(node => {
            NodeService.calculateAutoSize(node, this.ctx);
        });
        
        // 绘制连线（先绘制，节点在上方）
        // 使用缓存的visibleNodeMap，避免重复创建
        if (this.visibleNodeMap) {
            this.visibleConnections.forEach(connection => {
                this.renderer.drawConnection(connection, this.visibleNodeMap);
            });
        }
        
        // 绘制节点
        this.visibleNodes.forEach(node => {
            this.renderer.drawNode(node);
        });
        
        // 结束绘制
        this.renderer.endDraw();
        
        // 性能监控
        const renderTime = performance.now() - startTime;
        this.performanceMonitor.recordFrame(renderTime);
        
        this.renderCount++;
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
    
    // 获取Canvas元素
    getCanvas() {
        return this.canvas;
    }
    
    // 获取Canvas上下文
    getContext() {
        return this.ctx;
    }
    
    // 获取可见节点
    getVisibleNodes() {
        return this.visibleNodes;
    }
    
    // 获取可见连线
    getVisibleConnections() {
        return this.visibleConnections;
    }
    
    // 获取可见节点Map（用于快速查找）
    getVisibleNodeMap() {
        return this.visibleNodeMap;
    }
}

