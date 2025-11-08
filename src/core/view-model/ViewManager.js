// 视图管理器 - 视图模型层
// 负责视图控制：缩放、平移、重置视图等
export default class ViewManager {
    constructor(editorState) {
        this.editorState = editorState;
        this.onChange = null; // 变更回调函数
    }
    
    // 设置变更回调
    setOnChangeCallback(callback) {
        this.onChange = callback;
    }
    
    // 缩放画布
    zoom(delta, centerX, centerY) {
        // 计算新的缩放比例
        const newZoom = Math.max(
            this.editorState.minZoom,
            Math.min(this.editorState.maxZoom, this.editorState.zoom + delta)
        );
        
        if (newZoom === this.editorState.zoom) return;
        
        // 计算缩放中心的偏移量
        const scaleFactor = newZoom / this.editorState.zoom;
        
        // 调整平移位置以保持缩放中心不变
        if (centerX !== undefined && centerY !== undefined) {
            this.editorState.panX = centerX - (centerX - this.editorState.panX) * scaleFactor;
            this.editorState.panY = centerY - (centerY - this.editorState.panY) * scaleFactor;
        }
        
        // 更新缩放比例
        this.editorState.zoom = newZoom;
        
        // 触发变更
        this.notifyChange();
    }
    
    // 放大
    zoomIn() {
        this.zoom(this.editorState.zoomStep);
    }
    
    // 缩小
    zoomOut() {
        this.zoom(-this.editorState.zoomStep);
    }
    
    // 设置缩放比例
    setZoom(zoom, centerX, centerY) {
        const clampedZoom = Math.max(
            this.editorState.minZoom,
            Math.min(this.editorState.maxZoom, zoom)
        );
        
        if (clampedZoom === this.editorState.zoom) return;
        
        // 计算缩放中心的偏移量
        const scaleFactor = clampedZoom / this.editorState.zoom;
        
        // 调整平移位置以保持缩放中心不变
        if (centerX !== undefined && centerY !== undefined) {
            this.editorState.panX = centerX - (centerX - this.editorState.panX) * scaleFactor;
            this.editorState.panY = centerY - (centerY - this.editorState.panY) * scaleFactor;
        }
        
        // 更新缩放比例
        this.editorState.zoom = clampedZoom;
        
        // 触发变更
        this.notifyChange();
    }
    
    // 平移画布
    pan(deltaX, deltaY) {
        this.editorState.panX += deltaX;
        this.editorState.panY += deltaY;
        
        // 触发变更
        this.notifyChange();
    }
    
    // 重置视图
    resetView() {
        this.editorState.resetView();
        
        // 触发变更
        this.notifyChange();
    }
    
    // 居中显示所有元素
    centerView(nodes, connections, canvasWidth, canvasHeight) {
        if (nodes.length === 0) {
            this.resetView();
            return;
        }
        
        // 计算所有节点的边界框
        let minX = Infinity, minY = Infinity;
        let maxX = -Infinity, maxY = -Infinity;
        
        nodes.forEach(node => {
            minX = Math.min(minX, node.x);
            minY = Math.min(minY, node.y);
            maxX = Math.max(maxX, node.x + node.width);
            maxY = Math.max(maxY, node.y + node.height);
        });
        
        // 计算中心点
        const centerX = (minX + maxX) / 2;
        const centerY = (minY + maxY) / 2;
        
        // 计算所需的缩放比例
        const contentWidth = maxX - minX;
        const contentHeight = maxY - minY;
        
        // 考虑边距（20%）
        const requiredWidth = contentWidth * 1.2;
        const requiredHeight = contentHeight * 1.2;
        
        // 计算缩放比例（适应画布）
        const scaleX = canvasWidth / requiredWidth;
        const scaleY = canvasHeight / requiredHeight;
        const scale = Math.min(scaleX, scaleY, 1); // 最大缩放为1
        
        // 应用缩放和平移
        this.editorState.zoom = Math.max(this.editorState.minZoom, scale);
        this.editorState.panX = canvasWidth / 2 - centerX;
        this.editorState.panY = canvasHeight / 2 - centerY;
        
        // 触发变更
        this.notifyChange();
    }
    
    // 世界坐标转换为画布坐标
    worldToCanvas(x, y) {
        return {
            x: (x - this.editorState.panX) * this.editorState.zoom,
            y: (y - this.editorState.panY) * this.editorState.zoom
        };
    }
    
    // 画布坐标转换为世界坐标
    canvasToWorld(x, y) {
        return {
            x: x / this.editorState.zoom + this.editorState.panX,
            y: y / this.editorState.zoom + this.editorState.panY
        };
    }
    
    // 获取当前视图状态
    getViewState() {
        return {
            zoom: this.editorState.zoom,
            panX: this.editorState.panX,
            panY: this.editorState.panY
        };
    }
    
    // 保存视图状态
    saveViewState() {
        return deepClone(this.getViewState());
    }
    
    // 恢复视图状态
    restoreViewState(viewState) {
        if (!viewState) return;
        
        this.setZoom(viewState.zoom);
        this.editorState.panX = viewState.panX;
        this.editorState.panY = viewState.panY;
        
        // 触发变更
        this.notifyChange();
    }
    
    // 通知变更
    notifyChange() {
        if (this.onChange) {
            this.onChange();
        }
    }
}

// 辅助函数：深克隆
function deepClone(obj) {
    if (obj === null || typeof obj !== 'object') return obj;
    if (obj instanceof Date) return new Date(obj.getTime());
    if (obj instanceof Array) return obj.map(item => deepClone(item));
    
    const clonedObj = {};
    for (const key in obj) {
        if (obj.hasOwnProperty(key)) {
            clonedObj[key] = deepClone(obj[key]);
        }
    }
    return clonedObj;
}