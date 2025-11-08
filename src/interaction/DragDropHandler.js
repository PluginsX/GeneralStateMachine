// 拖放事件处理 - 交互层
// 负责处理节点/连线的拖放添加操作
export default class DragDropHandler {
    constructor(canvas) {
        this.canvas = canvas;
        this.isDragging = false;
        
        // 拖拽数据
        this.dragData = null;
        this.dragType = null; // 'node' 或 'connection'
        this.dragStartPos = { x: 0, y: 0 };
        
        // 拖拽预览
        this.dragPreview = null;
        
        // 回调函数
        this.onNodeDrop = null;
        this.onConnectionDrop = null;
        this.onDragStart = null;
        this.onDragEnd = null;
        this.onDragOver = null;
        
        // 初始化事件监听
        this.initEventListeners();
    }
    
    // 初始化事件监听器
    initEventListeners() {
        // 画布上的拖放事件
        this.canvas.addEventListener('dragover', this.handleDragOver.bind(this));
        this.canvas.addEventListener('dragenter', this.handleDragEnter.bind(this));
        this.canvas.addEventListener('dragleave', this.handleDragLeave.bind(this));
        this.canvas.addEventListener('drop', this.handleDrop.bind(this));
        
        // 监听全局拖拽结束事件（当拖拽移出窗口时）
        document.addEventListener('dragend', this.handleGlobalDragEnd.bind(this));
    }
    
    // 设置可拖拽源元素
    setupDraggableSource(sourceElement, data, type) {
        if (!sourceElement || !data || !type) {
            console.error('Invalid parameters for setupDraggableSource');
            return;
        }
        
        // 设置元素为可拖拽
        sourceElement.draggable = true;
        
        // 添加拖拽开始事件
        sourceElement.addEventListener('dragstart', (event) => {
            this.handleDragStart(event, data, type);
        });
        
        // 添加拖拽结束事件
        sourceElement.addEventListener('dragend', (event) => {
            this.handleDragEnd(event);
        });
    }
    
    // 处理拖拽开始
    handleDragStart(event, data, type) {
        // 存储拖拽数据
        this.dragData = data;
        this.dragType = type;
        this.dragStartPos = {
            x: event.clientX,
            y: event.clientY
        };
        
        // 设置拖拽数据
        if (event.dataTransfer) {
            // 对于复杂对象，使用JSON字符串
            event.dataTransfer.setData('application/json', JSON.stringify({
                type: type,
                data: data
            }));
            
            // 设置拖拽效果
            event.dataTransfer.effectAllowed = 'copy';
            
            // 创建自定义拖拽图像
            if (type === 'node') {
                this.createNodeDragImage(event, data);
            }
        }
        
        // 设置拖拽状态
        this.isDragging = true;
        
        // 调用回调
        this.onDragStart?.(event, data, type);
    }
    
    // 处理拖拽经过
    handleDragOver(event) {
        event.preventDefault(); // 必须阻止默认行为，否则不会触发drop事件
        
        // 设置拖拽效果
        if (event.dataTransfer) {
            event.dataTransfer.dropEffect = 'copy';
        }
        
        // 调用回调
        this.onDragOver?.(event, this.getCanvasPosition(event));
    }
    
    // 处理拖拽进入
    handleDragEnter(event) {
        event.preventDefault();
        
        // 可以在这里添加视觉反馈
        this.canvas.classList.add('drag-over');
    }
    
    // 处理拖拽离开
    handleDragLeave(event) {
        // 检查是否真的离开了画布（而不是进入了画布的子元素）
        const rect = this.canvas.getBoundingClientRect();
        const isOutside = event.clientX < rect.left || 
                          event.clientX > rect.right || 
                          event.clientY < rect.top || 
                          event.clientY > rect.bottom;
        
        if (isOutside) {
            this.canvas.classList.remove('drag-over');
        }
    }
    
    // 处理放置
    handleDrop(event) {
        event.preventDefault();
        
        // 移除视觉反馈
        this.canvas.classList.remove('drag-over');
        
        try {
            // 获取拖拽数据
            let dragData = null;
            let dragType = null;
            
            // 首先尝试从event.dataTransfer获取
            if (event.dataTransfer) {
                const jsonData = event.dataTransfer.getData('application/json');
                if (jsonData) {
                    const parsed = JSON.parse(jsonData);
                    dragData = parsed.data;
                    dragType = parsed.type;
                }
            }
            
            // 如果没有获取到数据，使用内部存储的
            if (!dragData && this.dragData) {
                dragData = this.dragData;
                dragType = this.dragType;
            }
            
            // 获取在画布中的位置
            const canvasPos = this.getCanvasPosition(event);
            
            // 根据类型处理不同的放置操作
            if (dragType === 'node' && this.onNodeDrop) {
                this.onNodeDrop(canvasPos.x, canvasPos.y, dragData, event);
            } else if (dragType === 'connection' && this.onConnectionDrop) {
                this.onConnectionDrop(canvasPos.x, canvasPos.y, dragData, event);
            }
        } catch (error) {
            console.error('Error handling drop:', error);
        } finally {
            // 重置拖拽状态
            this.resetDragState();
        }
    }
    
    // 处理拖拽结束
    handleDragEnd(event) {
        // 移除视觉反馈
        this.canvas.classList.remove('drag-over');
        
        // 调用回调
        this.onDragEnd?.(event);
        
        // 重置拖拽状态
        this.resetDragState();
    }
    
    // 处理全局拖拽结束
    handleGlobalDragEnd(event) {
        // 当拖拽移出窗口时，确保重置状态
        if (this.isDragging) {
            this.resetDragState();
        }
    }
    
    // 创建节点拖拽预览
    createNodeDragImage(event, nodeData) {
        // 创建一个简单的拖拽预览元素
        const preview = document.createElement('div');
        preview.className = 'node-drag-preview';
        preview.style.position = 'absolute';
        preview.style.left = '-1000px'; // 移到视口外
        preview.style.top = '-1000px';
        preview.style.padding = '8px 12px';
        preview.style.background = '#f0f0f0';
        preview.style.border = '1px solid #ccc';
        preview.style.borderRadius = '4px';
        preview.style.fontSize = '12px';
        preview.textContent = nodeData.name || '新节点';
        
        // 添加到文档中
        document.body.appendChild(preview);
        
        // 设置为拖拽图像
        if (event.dataTransfer) {
            event.dataTransfer.setDragImage(preview, 10, 10);
        }
        
        // 保存引用以便之后移除
        this.dragPreview = preview;
        
        // 短暂延迟后移除预览元素
        setTimeout(() => {
            if (this.dragPreview && this.dragPreview.parentNode) {
                this.dragPreview.parentNode.removeChild(this.dragPreview);
                this.dragPreview = null;
            }
        }, 0);
    }
    
    // 获取在画布中的位置
    getCanvasPosition(event) {
        const rect = this.canvas.getBoundingClientRect();
        return {
            x: event.clientX - rect.left,
            y: event.clientY - rect.top
        };
    }
    
    // 重置拖拽状态
    resetDragState() {
        this.isDragging = false;
        this.dragData = null;
        this.dragType = null;
        this.dragStartPos = { x: 0, y: 0 };
        
        // 移除拖拽预览
        if (this.dragPreview && this.dragPreview.parentNode) {
            this.dragPreview.parentNode.removeChild(this.dragPreview);
            this.dragPreview = null;
        }
    }
    
    // 设置回调函数
    setCallbacks(callbacks) {
        this.onNodeDrop = callbacks.onNodeDrop;
        this.onConnectionDrop = callbacks.onConnectionDrop;
        this.onDragStart = callbacks.onDragStart;
        this.onDragEnd = callbacks.onDragEnd;
        this.onDragOver = callbacks.onDragOver;
    }
    
    // 获取当前拖拽状态
    getDragState() {
        return {
            isDragging: this.isDragging,
            dragType: this.dragType,
            dragData: this.dragData,
            dragStartPos: this.dragStartPos
        };
    }
    
    // 取消当前拖拽
    cancelDrag() {
        this.resetDragState();
    }
    
    // 检查是否正在拖拽
    isCurrentlyDragging() {
        return this.isDragging;
    }
    
    // 销毁事件监听器
    destroy() {
        // 移除画布上的事件监听器
        this.canvas.removeEventListener('dragover', this.handleDragOver);
        this.canvas.removeEventListener('dragenter', this.handleDragEnter);
        this.canvas.removeEventListener('dragleave', this.handleDragLeave);
        this.canvas.removeEventListener('drop', this.handleDrop);
        
        // 移除全局事件监听器
        document.removeEventListener('dragend', this.handleGlobalDragEnd);
        
        // 重置拖拽状态
        this.resetDragState();
    }
}