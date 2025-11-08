// 编辑器状态模型
// 管理编辑器的视图状态，如缩放、平移、选中状态等
export default class EditorState {
    constructor() {
        // 视图控制相关
        this.zoom = 1;           // 缩放比例
        this.panX = 0;           // 平移X坐标
        this.panY = 0;           // 平移Y坐标
        this.minZoom = 0.1;      // 最小缩放
        this.maxZoom = 3;        // 最大缩放
        this.zoomStep = 0.1;     // 缩放步长
        
        // 选中状态
        this.selectedNodeIds = new Set();        // 选中的节点ID集合
        this.selectedConnectionIds = new Set();  // 选中的连线ID集合
        
        // 编辑状态
        this.isCreatingConnection = false;  // 是否正在创建连线
        this.connectionStartNode = null;    // 连线起点节点
        this.connectionStartSide = null;    // 连线起点侧边
        
        // 拖拽状态
        this.isDragging = false;           // 是否正在拖拽
        this.dragStartX = 0;               // 拖拽起始X坐标
        this.dragStartY = 0;               // 拖拽起始Y坐标
        this.dragOffsetX = 0;              // 拖拽偏移X
        this.dragOffsetY = 0;              // 拖拽偏移Y
        
        // 框选状态
        this.isMarqueeSelecting = false;   // 是否正在框选
        this.marqueeStartX = 0;            // 框选起始X
        this.marqueeStartY = 0;            // 框选起始Y
        this.marqueeEndX = 0;              // 框选结束X
        this.marqueeEndY = 0;              // 框选结束Y
    }
    
    // 重置缩放和平移
    resetView() {
        this.zoom = 1;
        this.panX = 0;
        this.panY = 0;
    }
    
    // 全选所有节点和连线
    selectAll() {
        // 此方法需要在ViewModel层实现，这里仅提供接口
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
}