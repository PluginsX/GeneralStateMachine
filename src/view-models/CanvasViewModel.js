// Canvas ViewModel - 管理画布视图相关的状态和操作
import EditorStateModel from '../models/EditorStateModel.js';
import ViewManager from '../core/view-model/ViewManager.js';

export default class CanvasViewModel {
    constructor(editorState, historyManager) {
        this.editorState = editorState;
        this.historyManager = historyManager;
        this.viewManager = new ViewManager(editorState);
        
        // 渲染相关状态
        this.visibleNodes = [];
        this.visibleConnections = [];
        this.lastVisibleBounds = null;
        
        // 性能优化工具（延迟初始化）
        this.visibilityCuller = null;
        this.lodManager = null;
        this.performanceMonitor = null;
        this.quadTree = null;
        this.useQuadTree = false;
        
        this.onChange = null;
    }
    
    setOnChangeCallback(callback) {
        this.onChange = callback;
        this.viewManager.setOnChangeCallback(callback);
    }
    
    // 初始化性能优化工具
    initPerformanceTools(canvas, pan, zoom) {
        // 这些工具需要从utils/performance.js导入
        // 暂时先不初始化，等重构View层时再处理
    }
    
    // 更新可视对象缓存
    updateVisibleObjects(forceUpdate = false) {
        // 这个方法需要配合VisibilityCuller使用
        // 暂时保留接口，等重构View层时实现
    }
    
    // 获取ViewManager
    getViewManager() {
        return this.viewManager;
    }
    
    // 缩放
    zoom(delta, centerX, centerY) {
        this.viewManager.zoom(delta, centerX, centerY);
    }
    
    zoomIn() {
        this.viewManager.zoomIn();
    }
    
    zoomOut() {
        this.viewManager.zoomOut();
    }
    
    setZoom(zoom, centerX, centerY) {
        this.viewManager.setZoom(zoom, centerX, centerY);
    }
    
    // 平移
    pan(deltaX, deltaY) {
        this.viewManager.pan(deltaX, deltaY);
    }
    
    // 重置视图
    resetView() {
        this.viewManager.resetView();
    }
    
    // 居中显示所有元素
    centerView(nodes, connections, canvasWidth, canvasHeight) {
        this.viewManager.centerView(nodes, connections, canvasWidth, canvasHeight);
    }
    
    // 坐标转换
    worldToCanvas(x, y) {
        return this.viewManager.worldToCanvas(x, y);
    }
    
    canvasToWorld(x, y) {
        return this.viewManager.canvasToWorld(x, y);
    }
    
    notifyChange() {
        if (this.onChange) {
            this.onChange();
        }
    }
}

