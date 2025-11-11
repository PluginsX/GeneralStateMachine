// 编辑器状态模型 - 纯状态数据，不包含业务逻辑
export default class EditorStateModel {
    constructor() {
        // 视图控制相关
        this.zoom = 1.0;
        this.panX = 0;
        this.panY = 0;
        this.minZoom = 0.1;
        this.maxZoom = 5.0;
        this.zoomStep = 0.1;
        
        // 选中状态
        this.selectedNodeIds = new Set();
        this.selectedConnectionIds = new Set();
        this.selectionFilter = 'all'; // 'all', 'nodes', 'connections'
        
        // 编辑状态
        this.isCreatingConnection = false;
        this.connectionStartNodeId = null;
        this.connectionStartSide = null;
        
        // 拖拽状态
        this.isDragging = false;
        this.dragStartX = 0;
        this.dragStartY = 0;
        this.dragOffsetX = 0;
        this.dragOffsetY = 0;
        
        // 平移状态
        this.isPanning = false;
        this.panStartX = 0;
        this.panStartY = 0;
        
        // 框选状态
        this.isMarqueeSelecting = false;
        this.marqueeStartX = 0;
        this.marqueeStartY = 0;
        this.marqueeEndX = 0;
        this.marqueeEndY = 0;
    }
    
    // 重置视图
    resetView() {
        this.zoom = 1.0;
        this.panX = 0;
        this.panY = 0;
    }
    
    // 清空选中状态
    clearSelection() {
        this.selectedNodeIds.clear();
        this.selectedConnectionIds.clear();
    }
    
    // 检查是否有选中的元素
    hasSelection() {
        return this.selectedNodeIds.size > 0 || this.selectedConnectionIds.size > 0;
    }
    
    // 获取选中节点的数量
    getSelectedNodeCount() {
        return this.selectedNodeIds.size;
    }
    
    // 获取选中连线的数量
    getSelectedConnectionCount() {
        return this.selectedConnectionIds.size;
    }
    
    // 克隆状态（用于历史记录）
    clone() {
        const clone = new EditorStateModel();
        clone.zoom = this.zoom;
        clone.panX = this.panX;
        clone.panY = this.panY;
        clone.selectedNodeIds = new Set(this.selectedNodeIds);
        clone.selectedConnectionIds = new Set(this.selectedConnectionIds);
        clone.selectionFilter = this.selectionFilter;
        return clone;
    }
}

