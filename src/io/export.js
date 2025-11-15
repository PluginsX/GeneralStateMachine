import { isLightMode } from '../ui/theme.js';
import { PopUp_Window_Parameters, PopUp_Window_Progress } from '../utils/popup.js';
import NodeService from '../services/NodeService.js';

// 导出Markdown
export const exportMarkdown = async (editor) => {
    let mdContent = '# 节点图导出\n\n';
    
    // 导出节点
    editor.nodes.forEach((node) => {
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
export const exportAsImage = async (editor) => {
    // 第一步：显示参数输入弹窗
    const parameters = {
        '尺寸缩放': 2,  // 默认缩放值为2
        '透明背景': false  // 默认不透明
    };
    const outParameters = {};
    
    const confirmed = await PopUp_Window_Parameters(
        '导出图片设置',
        '确定',
        '取消',
        parameters,
        outParameters
    );
    
    if (!confirmed) {
        return; // 用户取消
    }
    
    const scale = Math.max(1, Math.floor(outParameters['尺寸缩放'] || 2)); // 确保缩放值至少为1，且为整数
    const transparentBackground = outParameters['透明背景'] === true; // 获取透明背景选项
    
    // 第二步：显示进度条弹窗并执行导出
    const exportSuccess = await PopUp_Window_Progress(
        '导出图片',
        '正在导出图片，请稍候...',
        '取消',
        async (updateProgress) => {
            try {
                // 创建一个临时canvas用于导出
                const exportCanvas = document.createElement('canvas');
                const ctx = exportCanvas.getContext('2d');
                
                updateProgress(0.1);
                
                // 计算所有元素的边界框
                let minX = Infinity, minY = Infinity;
                let maxX = -Infinity, maxY = -Infinity;
                
                // 考虑所有节点
                editor.nodes.forEach(node => {
                    const nodePos = (node.transform && node.transform.position) ? node.transform.position : { x: 0, y: 0 };
                    minX = Math.min(minX, nodePos.x);
                    minY = Math.min(minY, nodePos.y);
                    maxX = Math.max(maxX, nodePos.x + node.width);
                    maxY = Math.max(maxY, nodePos.y + node.height);
                });
                
                updateProgress(0.2);
                
                // 考虑连线的起点和终点
                editor.connections.forEach(connection => {
                    const sourceNode = editor.nodes.find(n => n.id === connection.sourceNodeId);
                    const targetNode = editor.nodes.find(n => n.id === connection.targetNodeId);
                    
                    if (sourceNode && targetNode) {
                        const sourcePos = (sourceNode.transform && sourceNode.transform.position) ? sourceNode.transform.position : { x: 0, y: 0 };
                        const targetPos = (targetNode.transform && targetNode.transform.position) ? targetNode.transform.position : { x: 0, y: 0 };
                        const startX = sourcePos.x + sourceNode.width / 2;
                        const startY = sourcePos.y + sourceNode.height / 2;
                        const endX = targetPos.x + targetNode.width / 2;
                        const endY = targetPos.y + targetNode.height / 2;
                        
                        minX = Math.min(minX, startX, endX);
                        minY = Math.min(minY, startY, endY);
                        maxX = Math.max(maxX, startX, endX);
                        maxY = Math.max(maxY, startY, endY);
                    }
                });
                
                updateProgress(0.3);
                
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
                
                // 设置导出canvas尺寸（应用缩放）
                const baseWidth = maxX - minX;
                const baseHeight = maxY - minY;
                exportCanvas.width = baseWidth * scale;
                exportCanvas.height = baseHeight * scale;
                
                updateProgress(0.4);
                
                // 保存当前视图状态
                const originalPan = { ...editor.pan };
                const originalZoom = editor.zoom;
                const originalSelectedElements = [...editor.selectedElements];
                
                // 临时调整视图以适应所有元素
                editor.pan.x = -minX;
                editor.pan.y = -minY;
                editor.zoom = 1;
                editor.selectedElements = [];
                
                updateProgress(0.5);
                
                // 渲染到导出canvas
                // 如果选择透明背景，则不填充背景色，保持透明
                if (!transparentBackground) {
                    ctx.fillStyle = isLightMode() ? '#f5f5f5' : '#1e1e1e';
                    ctx.fillRect(0, 0, exportCanvas.width, exportCanvas.height);
                }
                
                // 应用缩放
                ctx.scale(scale, scale);
                
                updateProgress(0.6);
                
                // 保存原始上下文状态
                const originalCtx = editor.ctx;
                const originalCanvas = editor.canvas;
                
                // 临时设置导出canvas为编辑器canvas（用于绘制）
                editor.ctx = ctx;
                editor.canvas = exportCanvas;
                
                updateProgress(0.7);
                
                // 绘制网格和元素
                // 如果选择透明背景，则不绘制网格
                if (!transparentBackground) {
                    editor.drawGrid(ctx, baseWidth, baseHeight, minX, minY, maxX, maxY);
                }
                
                updateProgress(0.8);
                
                editor.drawConnections(ctx);
                editor.nodes.forEach(node => {
                    NodeService.calculateAutoSize(node, ctx);
                    editor.drawNode(ctx, node);
                });
                
                updateProgress(0.9);
                
                // 恢复原始上下文
                editor.ctx = originalCtx;
                editor.canvas = originalCanvas;
                
                // 恢复原始视图状态
                editor.pan = originalPan;
                editor.zoom = originalZoom;
                editor.selectedElements = originalSelectedElements;
                
                // 创建下载链接
                return new Promise((resolve) => {
                    exportCanvas.toBlob(blob => {
                        try {
                            const url = URL.createObjectURL(blob);
                            const a = document.createElement('a');
                            a.href = url;
                            a.download = `节点图导出_${scale}x.png`;
                            document.body.appendChild(a);
                            a.click();
                            document.body.removeChild(a);
                            URL.revokeObjectURL(url);
                            
                            updateProgress(1.0);
                            editor.scheduleRender();
                            resolve(true);
                        } catch (error) {
                            console.error('导出失败:', error);
                            resolve(false);
                        }
                    }, 'image/png');
                });
            } catch (error) {
                console.error('导出过程出错:', error);
                return false;
            }
        }
    );
    
    if (!exportSuccess) {
        // 导出失败或取消
        return;
    }
};

// 保存项目
export const saveProject = async (editor) => {
    const projectData = {
        // 项目文件识别字段
        version: '1.0',
        type: 'node-graph-editor-project',
        // 项目数据
        nodes: editor.nodes.map(node => {
            const nodePos = (node.transform && node.transform.position) ? node.transform.position : { x: 0, y: 0 };
            return {
                id: node.id,
                name: node.name,
                description: node.description,
                x: nodePos.x,
                y: nodePos.y,
                width: node.width,
                height: node.height,
                autoSize: node.autoSize,
                color: node.color || null
            };
        }),
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