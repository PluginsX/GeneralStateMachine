import { isLightMode } from '../ui/theme.js';

// 导出Markdown
export const exportMarkdown = (editor) => {
    let mdContent = '# 节点图导出\n\n';
    
    // 导出节点
    editor.nodes.forEach(node => {
        mdContent += `## ${node.name}\n`;
        if (node.description) {
            mdContent += `${node.description}\n\n`;
        }
        
        // 导出从当前节点出发的连接
        const outgoingConnections = editor.connections.filter(
            conn => conn.sourceNodeId === node.id
        );
        
        if (outgoingConnections.length > 0) {
            mdContent += '连接到：\n';
            outgoingConnections.forEach(conn => {
                const targetNode = editor.nodes.find(n => n.id === conn.targetNodeId);
                if (targetNode) {
                    mdContent += `- ${targetNode.name}\n`;
                    
                    // 导出条件
                    if (conn.conditions.length > 0) {
                        conn.conditions.forEach(cond => {
                            mdContent += `  - 条件: ${cond.key} ${cond.operator} ${cond.value}\n`;
                        });
                    }
                }
            });
            mdContent += '\n';
        }
    });
    
    // 创建下载链接
    const blob = new Blob([mdContent], { type: 'text/markdown' });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = '节点图导出.md';
    document.body.appendChild(a);
    a.click();
    document.body.removeChild(a);
    URL.revokeObjectURL(url);
};

// 导出为图片
export const exportAsImage = (editor) => {
    // 创建一个临时canvas用于导出
    const exportCanvas = document.createElement('canvas');
    const ctx = exportCanvas.getContext('2d');
    
    // 计算所有元素的边界框
    let minX = Infinity, minY = Infinity;
    let maxX = -Infinity, maxY = -Infinity;
    
    // 考虑所有节点
    editor.nodes.forEach(node => {
        minX = Math.min(minX, node.x);
        minY = Math.min(minY, node.y);
        maxX = Math.max(maxX, node.x + node.width);
        maxY = Math.max(maxY, node.y + node.height);
    });
    
    // 考虑连线的起点和终点
    editor.connections.forEach(connection => {
        const sourceNode = editor.nodes.find(n => n.id === connection.sourceNodeId);
        const targetNode = editor.nodes.find(n => n.id === connection.targetNodeId);
        
        if (sourceNode && targetNode) {
            const startX = sourceNode.x + sourceNode.width / 2;
            const startY = sourceNode.y + sourceNode.height / 2;
            const endX = targetNode.x + targetNode.width / 2;
            const endY = targetNode.y + targetNode.height / 2;
            
            minX = Math.min(minX, startX, endX);
            minY = Math.min(minY, startY, endY);
            maxX = Math.max(maxX, startX, endX);
            maxY = Math.max(maxY, startY, endY);
        }
    });
    
    // 如果没有元素，使用默认尺寸
    if (editor.nodes.length === 0 && editor.connections.length === 0) {
        minX = 0;
        minY = 0;
        maxX = 800;
        maxY = 600;
    } else {
        // 添加边距
        const padding = 50;
        minX -= padding;
        minY -= padding;
        maxX += padding;
        maxY += padding;
    }
    
    // 设置导出canvas尺寸
    const width = maxX - minX;
    const height = maxY - minY;
    exportCanvas.width = width;
    exportCanvas.height = height;
    
    // 保存当前视图状态
    const originalPan = { ...editor.pan };
    const originalZoom = editor.zoom;
    const originalSelectedElements = [...editor.selectedElements];
    
    // 临时调整视图以适应所有元素
    editor.pan.x = -minX;
    editor.pan.y = -minY;
    editor.zoom = 1;
    editor.selectedElements = [];
    
    // 渲染到导出canvas
    ctx.fillStyle = isLightMode() ? '#f5f5f5' : '#1e1e1e';
    ctx.fillRect(0, 0, width, height);
    
    // 保存原始上下文状态
    const originalCtx = editor.ctx;
    const originalCanvas = editor.canvas;
    
    // 临时设置导出canvas为编辑器canvas（用于绘制）
    editor.ctx = ctx;
    editor.canvas = exportCanvas;
    
    // 绘制网格和元素
    editor.drawGrid(ctx, width, height, minX, minY, maxX, maxY);
    editor.drawConnections(ctx);
    editor.nodes.forEach(node => {
        node.calculateAutoSize(ctx);
        editor.drawNode(ctx, node);
    });
    
    // 恢复原始上下文
    editor.ctx = originalCtx;
    editor.canvas = originalCanvas;
    
    // 恢复原始视图状态
    editor.pan = originalPan;
    editor.zoom = originalZoom;
    editor.selectedElements = originalSelectedElements;
    
    // 创建下载链接
    exportCanvas.toBlob(blob => {
        const url = URL.createObjectURL(blob);
        const a = document.createElement('a');
        a.href = url;
        a.download = '节点图导出.png';
        document.body.appendChild(a);
        a.click();
        document.body.removeChild(a);
        URL.revokeObjectURL(url);
    });
    
    editor.scheduleRender();
};

// 保存项目
export const saveProject = (editor) => {
    const projectData = {
        // 项目文件识别字段
        version: '1.0',
        type: 'node-graph-editor-project',
        // 项目数据
        nodes: editor.nodes.map(node => ({
            id: node.id,
            name: node.name,
            description: node.description,
            x: node.x,
            y: node.y,
            width: node.width,
            height: node.height,
            autoSize: node.autoSize,
            color: node.color || null
        })),
        connections: editor.connections.map(conn => ({
            id: conn.id,
            sourceNodeId: conn.sourceNodeId,
            targetNodeId: conn.targetNodeId,
            conditions: conn.conditions.map(cond => ({
                type: cond.type,
                key: cond.key,
                operator: cond.operator,
                value: cond.value
            })),
            color: conn.color || null,
            lineWidth: conn.lineWidth || null,
            lineType: conn.lineType || 'solid',
            arrowSize: conn.arrowSize || null,
            arrowColor: conn.arrowColor || null
        }))
    };
    
    const json = JSON.stringify(projectData, null, 2);
    const blob = new Blob([json], { type: 'application/json' });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = '节点图项目.json';
    document.body.appendChild(a);
    a.click();
    document.body.removeChild(a);
    URL.revokeObjectURL(url);
};