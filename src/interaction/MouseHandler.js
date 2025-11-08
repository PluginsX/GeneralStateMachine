// 鼠标事件处理 - 交互层
// 负责处理点击、拖拽、框选等鼠标事件
export default class MouseHandler {
    constructor(canvas) {
        this.canvas = canvas;
        this.ctx = canvas.getContext('2d');
        
        // 鼠标状态
        this.isDragging = false;
        this.isPanning = false;
        this.isDrawingSelection = false;
        this.isCreatingConnection = false;
        
        // 鼠标位置
        this.lastMousePos = { x: 0, y: 0 };
        this.currentMousePos = { x: 0, y: 0 };
        this.dragStartPos = { x: 0, y: 0 };
        
        // 选中状态
        this.selectedNodes = new Set();
        this.selectedConnections = new Set();
        
        // 框选矩形
        this.selectionRect = null;
        
        // 连线创建
        this.connectionSource = null;
        this.connectionTarget = null;
        
        // 回调函数
        this.onNodeClick = null;
        this.onNodeDrag = null;
        this.onConnectionCreate = null;
        this.onCanvasClick = null;
        this.onCanvasDrag = null;
        this.onSelectionChange = null;
        this.onConnectionStart = null;
        this.onConnectionEnd = null;
        this.onContextMenu = null;
        
        // 初始化事件监听
        this.initEventListeners();
    }
    
    // 初始化事件监听器
    initEventListeners() {
        // 鼠标按下
        this.canvas.addEventListener('mousedown', this.handleMouseDown.bind(this));
        
        // 鼠标移动
        this.canvas.addEventListener('mousemove', this.handleMouseMove.bind(this));
        
        // 鼠标释放
        this.canvas.addEventListener('mouseup', this.handleMouseUp.bind(this));
        
        // 鼠标离开
        this.canvas.addEventListener('mouseleave', this.handleMouseLeave.bind(this));
        
        // 右键菜单
        this.canvas.addEventListener('contextmenu', this.handleContextMenu.bind(this));
        
        // 滚轮缩放（在CanvasRenderer中处理）
    }
    
    // 处理鼠标按下事件
    handleMouseDown(event) {
        // 获取相对canvas的鼠标位置
        const rect = this.canvas.getBoundingClientRect();
        const x = event.clientX - rect.left;
        const y = event.clientY - rect.top;
        
        // 保存当前位置
        this.currentMousePos = { x, y };
        this.lastMousePos = { x, y };
        this.dragStartPos = { x, y };
        
        // 根据点击目标和按键类型处理不同的操作
        if (event.button === 0) { // 左键
            this.handleLeftMouseDown(event, x, y);
        } else if (event.button === 1) { // 中键
            this.handleMiddleMouseDown(event, x, y);
        }
    }
    
    // 处理左键按下
    handleLeftMouseDown(event, x, y) {
        // 检查是否按下Ctrl/Cmd键（多选）
        const isMultiSelect = event.ctrlKey || event.metaKey;
        
        // 尝试查找点击的节点
        const clickedNode = this.findNodeAtPosition(x, y);
        
        if (clickedNode) {
            // 点击了节点
            this.handleNodeClick(event, clickedNode, isMultiSelect);
        } else {
            // 点击了空白区域
            this.handleCanvasClick(event, x, y);
        }
    }
    
    // 处理中键按下（平移）
    handleMiddleMouseDown(event, x, y) {
        event.preventDefault();
        this.isPanning = true;
        this.canvas.style.cursor = 'grabbing';
    }
    
    // 处理鼠标移动事件
    handleMouseMove(event) {
        // 获取相对canvas的鼠标位置
        const rect = this.canvas.getBoundingClientRect();
        const x = event.clientX - rect.left;
        const y = event.clientY - rect.top;
        
        // 更新当前位置
        this.currentMousePos = { x, y };
        
        // 处理不同的移动状态
        if (this.isDragging && this.dragTarget) {
            // 拖拽节点
            this.handleNodeDrag(event, x, y);
        } else if (this.isPanning) {
            // 平移画布
            this.handleCanvasPan(event, x, y);
        } else if (this.isDrawingSelection) {
            // 绘制选择框
            this.handleSelectionDraw(event, x, y);
        } else if (this.isCreatingConnection) {
            // 创建连线
            this.handleConnectionDraw(event, x, y);
        } else {
            // 更新鼠标状态
            this.updateCursor(event, x, y);
        }
    }
    
    // 处理鼠标释放事件
    handleMouseUp(event) {
        const rect = this.canvas.getBoundingClientRect();
        const x = event.clientX - rect.left;
        const y = event.clientY - rect.top;
        
        // 处理不同的释放状态
        if (this.isDragging && this.dragTarget) {
            // 结束拖拽
            this.endNodeDrag(event, x, y);
        } else if (this.isPanning) {
            // 结束平移
            this.endCanvasPan(event, x, y);
        } else if (this.isDrawingSelection) {
            // 结束框选
            this.endSelectionDraw(event, x, y);
        } else if (this.isCreatingConnection) {
            // 结束连线创建
            this.endConnectionCreate(event, x, y);
        }
        
        // 重置状态
        this.isDragging = false;
        this.isPanning = false;
        this.isDrawingSelection = false;
        this.isCreatingConnection = false;
        
        // 重置画布样式
        this.canvas.style.cursor = '';
    }
    
    // 处理鼠标离开事件
    handleMouseLeave(event) {
        // 重置所有拖拽状态
        this.isDragging = false;
        this.isPanning = false;
        this.isDrawingSelection = false;
        this.isCreatingConnection = false;
        
        // 重置画布样式
        this.canvas.style.cursor = '';
    }
    
    // 处理右键菜单
    handleContextMenu(event) {
        event.preventDefault();
        
        const rect = this.canvas.getBoundingClientRect();
        const x = event.clientX - rect.left;
        const y = event.clientY - rect.top;
        
        // 查找点击的元素
        const clickedNode = this.findNodeAtPosition(x, y);
        const clickedConnection = this.findConnectionAtPosition(x, y);
        
        // 调用右键菜单回调
        if (this.onContextMenu) {
            this.onContextMenu(event.clientX, event.clientY, clickedNode, clickedConnection);
        }
    }
    
    // 处理节点点击
    handleNodeClick(event, node, isMultiSelect) {
        // 开始拖拽
        this.isDragging = true;
        this.dragTarget = node;
        
        // 处理选中状态
        if (!isMultiSelect) {
            // 单选模式，清空之前的选择
            this.clearSelection();
            this.selectedNodes.add(node);
        } else {
            // 多选模式，切换节点选中状态
            if (this.selectedNodes.has(node)) {
                this.selectedNodes.delete(node);
            } else {
                this.selectedNodes.add(node);
            }
        }
        
        // 通知选中状态变化
        this.notifySelectionChange();
        
        // 调用节点点击回调
        this.onNodeClick?.(node, event);
    }
    
    // 处理空白区域点击
    handleCanvasClick(event, x, y) {
        const isMultiSelect = event.ctrlKey || event.metaKey;
        
        if (!isMultiSelect) {
            // 单选模式，清空所有选择
            this.clearSelection();
            this.notifySelectionChange();
        } else {
            // 多选模式，开始框选
            this.isDrawingSelection = true;
            this.selectionRect = {
                x: x,
                y: y,
                width: 0,
                height: 0
            };
        }
        
        // 调用画布点击回调
        this.onCanvasClick?.(x, y, event);
    }
    
    // 处理节点拖拽
    handleNodeDrag(event, x, y) {
        const dx = x - this.lastMousePos.x;
        const dy = y - this.lastMousePos.y;
        
        // 更新节点位置
        this.dragTarget.x += dx;
        this.dragTarget.y += dy;
        
        // 调用拖拽回调
        this.onNodeDrag?.(this.dragTarget, dx, dy, event);
        
        // 更新上一次位置
        this.lastMousePos = { x, y };
    }
    
    // 结束节点拖拽
    endNodeDrag(event, x, y) {
        // 清除拖拽目标
        this.dragTarget = null;
    }
    
    // 处理画布平移
    handleCanvasPan(event, x, y) {
        const dx = x - this.lastMousePos.x;
        const dy = y - this.lastMousePos.y;
        
        // 调用平移回调
        this.onCanvasDrag?.(dx, dy, event);
        
        // 更新上一次位置
        this.lastMousePos = { x, y };
    }
    
    // 结束画布平移
    endCanvasPan(event, x, y) {
        // 平移完成后的处理
    }
    
    // 处理选择框绘制
    handleSelectionDraw(event, x, y) {
        // 更新选择框尺寸
        this.selectionRect.width = x - this.selectionRect.x;
        this.selectionRect.height = y - this.selectionRect.y;
        
        // 调用绘制选择框回调
        this.onSelectionDraw?.(this.selectionRect, event);
    }
    
    // 结束选择框绘制
    endSelectionDraw(event, x, y) {
        // 如果选择框太小，视为无效选择
        const minSize = 5;
        if (Math.abs(this.selectionRect.width) < minSize || Math.abs(this.selectionRect.height) < minSize) {
            this.selectionRect = null;
            return;
        }
        
        // 获取所有节点
        const nodes = this.getAllNodes?.() || [];
        const newlySelected = new Set();
        
        // 计算实际的选择框（考虑拖拽方向）
        const rect = {
            x: Math.min(this.selectionRect.x, x),
            y: Math.min(this.selectionRect.y, y),
            width: Math.abs(this.selectionRect.width),
            height: Math.abs(this.selectionRect.height)
        };
        
        // 查找选择框内的节点
        for (const node of nodes) {
            if (this.isNodeInRect(node, rect)) {
                newlySelected.add(node);
            }
        }
        
        // 如果按下Ctrl/Cmd键，将新选中的节点添加到当前选择中
        if (event.ctrlKey || event.metaKey) {
            for (const node of newlySelected) {
                if (!this.selectedNodes.has(node)) {
                    this.selectedNodes.add(node);
                }
            }
        } else {
            // 否则替换当前选择
            this.selectedNodes = newlySelected;
        }
        
        // 通知选中状态变化
        this.notifySelectionChange();
        
        // 清除选择框
        this.selectionRect = null;
    }
    
    // 检查节点是否在矩形内
    isNodeInRect(node, rect) {
        // 简化的节点矩形碰撞检测
        // 实际实现可能需要根据节点的实际形状进行调整
        const nodeRect = {
            x: node.x,
            y: node.y,
            width: node.width || 100,
            height: node.height || 50
        };
        
        return nodeRect.x < rect.x + rect.width &&
               nodeRect.x + nodeRect.width > rect.x &&
               nodeRect.y < rect.y + rect.height &&
               nodeRect.y + nodeRect.height > rect.y;
    }
    
    // 处理连线创建绘制
    handleConnectionDraw(event, x, y) {
        // 调用连线绘制回调
        this.onConnectionDraw?.(this.connectionSource, { x, y }, event);
    }
    
    // 结束连线创建
    endConnectionCreate(event, x, y) {
        // 查找目标节点
        const targetNode = this.findNodeAtPosition(x, y);
        
        if (targetNode && targetNode !== this.connectionSource) {
            // 创建连线
            this.onConnectionCreate?.(this.connectionSource, targetNode, event);
        }
        
        // 重置连线源
        this.connectionSource = null;
    }
    
    // 更新鼠标指针样式
    updateCursor(event, x, y) {
        // 检查是否在节点上
        const node = this.findNodeAtPosition(x, y);
        if (node) {
            this.canvas.style.cursor = 'move';
            return;
        }
        
        // 检查是否在连线上
        const connection = this.findConnectionAtPosition(x, y);
        if (connection) {
            this.canvas.style.cursor = 'pointer';
            return;
        }
        
        // 默认样式
        this.canvas.style.cursor = '';
    }
    
    // 查找指定位置的节点
    findNodeAtPosition(x, y) {
        // 应该由外部提供节点列表和碰撞检测逻辑
        // 这里返回null，由外部实现具体逻辑
        return null;
    }
    
    // 查找指定位置的连线
    findConnectionAtPosition(x, y) {
        // 应该由外部提供连线列表和碰撞检测逻辑
        // 这里返回null，由外部实现具体逻辑
        return null;
    }
    
    // 清除所有选择
    clearSelection() {
        this.selectedNodes.clear();
        this.selectedConnections.clear();
    }
    
    // 通知选中状态变化
    notifySelectionChange() {
        if (this.onSelectionChange) {
            this.onSelectionChange({
                nodes: Array.from(this.selectedNodes),
                connections: Array.from(this.selectedConnections)
            });
        }
    }
    
    // 开始创建连线
    startConnection(sourceNode) {
        this.isCreatingConnection = true;
        this.connectionSource = sourceNode;
        
        // 调用连线开始回调
        this.onConnectionStart?.(sourceNode);
    }
    
    // 取消连线创建
    cancelConnection() {
        this.isCreatingConnection = false;
        this.connectionSource = null;
        
        // 调用连线结束回调
        this.onConnectionEnd?.();
    }
    
    // 设置回调函数
    setCallbacks(callbacks) {
        this.onNodeClick = callbacks.onNodeClick;
        this.onNodeDrag = callbacks.onNodeDrag;
        this.onConnectionCreate = callbacks.onConnectionCreate;
        this.onCanvasClick = callbacks.onCanvasClick;
        this.onCanvasDrag = callbacks.onCanvasDrag;
        this.onSelectionChange = callbacks.onSelectionChange;
        this.onConnectionStart = callbacks.onConnectionStart;
        this.onConnectionEnd = callbacks.onConnectionEnd;
        this.onSelectionDraw = callbacks.onSelectionDraw;
        this.onConnectionDraw = callbacks.onConnectionDraw;
        this.onContextMenu = callbacks.onContextMenu;
        
        // 外部提供的辅助方法
        this.findNodeAtPosition = callbacks.findNodeAtPosition || this.findNodeAtPosition;
        this.findConnectionAtPosition = callbacks.findConnectionAtPosition || this.findConnectionAtPosition;
        this.getAllNodes = callbacks.getAllNodes || this.getAllNodes;
    }
    
    // 获取当前选中的节点
    getSelectedNodes() {
        return Array.from(this.selectedNodes);
    }
    
    // 获取当前选中的连线
    getSelectedConnections() {
        return Array.from(this.selectedConnections);
    }
    
    // 获取选择框
    getSelectionRect() {
        return this.selectionRect;
    }
    
    // 销毁事件监听器
    destroy() {
        this.canvas.removeEventListener('mousedown', this.handleMouseDown);
        this.canvas.removeEventListener('mousemove', this.handleMouseMove);
        this.canvas.removeEventListener('mouseup', this.handleMouseUp);
        this.canvas.removeEventListener('mouseleave', this.handleMouseLeave);
        this.canvas.removeEventListener('contextmenu', this.handleContextMenu);
    }
}