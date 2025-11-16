// Canvas渲染器 - 视图层（纯渲染，无业务逻辑）
// 负责Canvas绘制：网格、节点、连线绘制
export default class CanvasRenderer {
    constructor(canvas, editorState) {
        this.canvas = canvas;
        this.ctx = canvas.getContext('2d');
        this.editorState = editorState; // EditorStateModel实例
        this.cellSize = 20; // 网格大小
        
        // 样式配置
        this.colors = {
            grid: '#e0e0e0',
            node: '#ffffff',
            nodeBorder: '#2196f3',
            nodeSelected: '#1976d2',
            nodeText: '#333333',
            nodeDescription: '#666666',
            connection: '#888888',
            connectionSelected: '#ff5722',
            connectionHover: '#ff9800',
            marquee: 'rgba(33, 150, 243, 0.2)',
            marqueeBorder: '#2196f3'
        };
    }
    
    // 调整画布大小
    resize(width, height) {
        this.canvas.width = width;
        this.canvas.height = height;
    }
    
    // 清空画布
    clear() {
        this.ctx.clearRect(0, 0, this.canvas.width, this.canvas.height);
    }
    
    // 开始绘制
    beginDraw() {
        this.clear();
        
        // 保存当前上下文状态
        this.ctx.save();
        
        // 应用变换（平移和缩放）
        this.ctx.translate(this.canvas.width / 2, this.canvas.height / 2);
        this.ctx.scale(this.editorState.zoom, this.editorState.zoom);
        this.ctx.translate(-this.canvas.width / 2, -this.canvas.height / 2);
        
        // 应用平移偏移
        this.ctx.translate(this.editorState.panX, this.editorState.panY);
    }
    
    // 结束绘制
    endDraw() {
        // 恢复上下文状态
        this.ctx.restore();
    }
    
    // 绘制网格
    drawGrid() {
        const { ctx, cellSize } = this;
        const { zoom } = this.editorState;
        
        // 计算网格线间隔（基于缩放级别调整）
        let gridInterval = cellSize;
        if (zoom < 0.5) {
            gridInterval = cellSize * 2;
        } else if (zoom < 0.25) {
            gridInterval = cellSize * 4;
        }
        
        // 计算可见区域的网格范围
        const startX = Math.floor((-this.editorState.panX) / gridInterval) * gridInterval;
        const startY = Math.floor((-this.editorState.panY) / gridInterval) * gridInterval;
        const endX = startX + this.canvas.width / zoom + gridInterval;
        const endY = startY + this.canvas.height / zoom + gridInterval;
        
        // 确保使用实线绘制网格
        ctx.setLineDash([]);
        ctx.strokeStyle = this.colors.grid;
        ctx.lineWidth = 0.5 / zoom;
        ctx.beginPath();
        
        // 绘制垂直线
        for (let x = startX; x <= endX; x += gridInterval) {
            ctx.moveTo(x, startY);
            ctx.lineTo(x, endY);
        }
        
        // 绘制水平线
        for (let y = startY; y <= endY; y += gridInterval) {
            ctx.moveTo(startX, y);
            ctx.lineTo(endX, y);
        }
        
        ctx.stroke();
    }
    
    // 绘制节点
    drawNode(node) {
        const { ctx } = this;
        
        // 防御性检查：确保节点及其属性存在
        if (!node) {
            return;
        }
        
        // 获取节点位置
        const nodePos = (node.transform && node.transform.position) ? node.transform.position : { x: 0, y: 0 };
        
        // 获取节点尺寸和视觉属性
        const nodeSize = (node.size && node.size.width !== undefined && node.size.height !== undefined) ? node.size : { width: 100, height: 60 };
        const nodeVisual = (node.visual && node.visual.color !== undefined) ? node.visual : { color: this.colors.node };
        
        if (nodePos.x === undefined || nodePos.y === undefined) {
            return;
        }
        
        // 计算节点颜色
        const isSelected = this.editorState.selectedNodeIds.has(node.id);
        const nodeColor = nodeVisual.color || this.colors.node;
        const borderColor = isSelected ? this.colors.nodeSelected : this.colors.nodeBorder;
        
        // 绘制节点背景
        ctx.fillStyle = nodeColor;
        // 确保使用实线绘制节点边框
        ctx.setLineDash([]);
        ctx.strokeStyle = borderColor;
        ctx.lineWidth = isSelected ? 3 : 2;
        ctx.beginPath();
        ctx.roundRect(nodePos.x, nodePos.y, nodeSize.width, nodeSize.height, 5);
        ctx.fill();
        ctx.stroke();
        
        // 绘制节点名称
        if (node.name) {
            ctx.fillStyle = this.colors.nodeText;
            ctx.font = '14px Arial';
            ctx.textAlign = 'center';
            ctx.textBaseline = 'middle';
            ctx.fillText(node.name, nodePos.x + node.width / 2, nodePos.y + node.height / 2 - 5);
        }
        
        // 绘制节点描述（如果有）
        if (node.description) {
            ctx.fillStyle = this.colors.nodeDescription;
            ctx.font = '10px Arial';
            // 截断过长的描述
            const displayText = node.description.length > 30 ? 
                node.description.substring(0, 30) + '...' : node.description;
            ctx.fillText(displayText, nodePos.x + node.width / 2, nodePos.y + node.height / 2 + 8);
        }
    }
    
    // 绘制连线
    drawConnection(connection, nodes) {
        const { ctx } = this;
        const sourceNode = nodes.get(connection.sourceNodeId);
        const targetNode = nodes.get(connection.targetNodeId);
        
        if (!sourceNode || !targetNode) return;
        
        // 计算连线的起点和终点
        const { x: startX, y: startY } = this.calculateConnectionPoint(sourceNode, connection.fromSide);
        const { x: endX, y: endY } = this.calculateConnectionPoint(targetNode, connection.toSide);
        
        // 计算连线颜色和样式
        const isSelected = this.editorState.selectedConnectionIds.has(connection.id);
        
        // 获取连线样式属性
        const connectionStyle = (connection.style && typeof connection.style === 'object') ? connection.style : {};
        const lineType = connectionStyle.lineType || 'solid';
        const color = connectionStyle.color;
        const width = connectionStyle.width || 1.5;
        
        // 根据连线类型设置线条样式
        if (lineType === 'dashed') {
            ctx.setLineDash([5, 5]);
        } else {
            ctx.setLineDash([]);
        }
        
        ctx.strokeStyle = color || (isSelected ? this.colors.connectionSelected : this.colors.connection);
        ctx.lineWidth = isSelected ? 3 : width;
        ctx.lineCap = 'round';
        
        // 绘制连线
        ctx.beginPath();
        ctx.moveTo(startX, startY);
        
        // 使用贝塞尔曲线使连线更平滑
        const controlPointOffset = 50;
        if (connection.fromSide === 'right' && connection.toSide === 'left') {
            // 水平方向的连线
            const midX = (startX + endX) / 2;
            ctx.bezierCurveTo(midX + controlPointOffset, startY, midX - controlPointOffset, endY, endX, endY);
        } else {
            // 其他方向的连线，使用直线
            ctx.lineTo(endX, endY);
        }
        
        ctx.stroke();
        
        // 绘制箭头
        this.drawArrow(ctx, startX, startY, endX, endY);
    }
    
    // 计算连线端点 - 总是返回节点的中心点
    calculateConnectionPoint(node, side) {
        // 防御性检查：确保节点存在
        if (!node) {
            return { x: 0, y: 0 };
        }
        
        // 获取节点位置
        const nodePos = (node.transform && node.transform.position) ? node.transform.position : { x: 0, y: 0 };
        
        // 获取节点尺寸（优先使用直接定义的width和height属性）
        const width = node.width || 150; // 默认值与NodeModel构造函数一致
        const height = node.height || 50; // 默认值与NodeModel构造函数一致
        
        if (nodePos.x === undefined || nodePos.y === undefined) {
            return { x: 0, y: 0 };
        }
        
        // 计算并返回节点中心点坐标
        // 中心点 = 位置 + 尺寸的一半
        return {
            x: nodePos.x + width / 2,
            y: nodePos.y + height / 2
        };
    }
    
    // 绘制箭头
    drawArrow(ctx, startX, startY, endX, endY) {
        const headLength = 10;
        const angle = Math.atan2(endY - startY, endX - startX);
        
        ctx.save();
        ctx.translate(endX, endY);
        ctx.rotate(angle);
        ctx.beginPath();
        ctx.moveTo(0, 0);
        ctx.lineTo(-headLength, -headLength / 2);
        ctx.lineTo(-headLength, headLength / 2);
        ctx.closePath();
        ctx.fill();
        ctx.restore();
    }
    
    // 绘制临时连线（正在创建的连线）
    drawTempConnection(startX, startY, endX, endY) {
        const { ctx } = this;
        
        // 保存当前状态
        ctx.save();
        
        // 设置临时连线样式
        ctx.strokeStyle = this.colors.connectionHover;
        ctx.lineWidth = 1.5;
        ctx.lineDashOffset = 0;
        ctx.setLineDash([5, 5]);
        
        // 绘制临时连线
        ctx.beginPath();
        ctx.moveTo(startX, startY);
        ctx.lineTo(endX, endY);
        ctx.stroke();
        
        // 恢复状态
        ctx.restore();
        
        // 绘制箭头（使用默认实线样式）
        this.drawArrow(ctx, startX, startY, endX, endY);
    }
    
    // 绘制框选矩形
    drawMarquee() {
        const { ctx } = this;
        const { marqueeStartX, marqueeStartY, marqueeEndX, marqueeEndY } = this.editorState;
        
        const x = Math.min(marqueeStartX, marqueeEndX);
        const y = Math.min(marqueeStartY, marqueeEndY);
        const width = Math.abs(marqueeEndX - marqueeStartX);
        const height = Math.abs(marqueeEndY - marqueeStartY);
        
        ctx.fillStyle = this.colors.marquee;
        ctx.strokeStyle = this.colors.marqueeBorder;
        ctx.lineWidth = 1;
        ctx.fillRect(x, y, width, height);
        ctx.strokeRect(x, y, width, height);
    }
    
    // 绘制整个场景
    render(nodes, connections) {
        this.beginDraw();
        
        // 绘制网格
        this.drawGrid();
        
        // 绘制连线（先绘制，这样节点会在连线上方）
        connections.forEach(connection => {
            this.drawConnection(connection, nodes);
        });
        
        // 绘制节点
        nodes.forEach(node => {
            this.drawNode(node);
        });
        
        // 绘制临时连线（如果正在创建连线）
        if (this.editorState.isCreatingConnection && 
            this.editorState.connectionStartNode && 
            this.editorState.marqueeEndX !== undefined && 
            this.editorState.marqueeEndY !== undefined) {
            
            const startNode = nodes.get(this.editorState.connectionStartNode);
            if (startNode) {
                const { x: startX, y: startY } = this.calculateConnectionPoint(
                    startNode, 
                    this.editorState.connectionStartSide
                );
                this.drawTempConnection(
                    startX, 
                    startY, 
                    this.editorState.marqueeEndX, 
                    this.editorState.marqueeEndY
                );
            }
        }
        
        // 绘制框选矩形
        if (this.editorState.isMarqueeSelecting) {
            this.drawMarquee();
        }
        
        this.endDraw();
    }
}