// ExportService.js - 导出服务模块
// 负责处理各种格式的导出功能，包括图片、Markdown和项目文件

export default class ExportService {
    constructor() {
        // 导出格式选项
        this.exportFormats = {
            JSON: 'json',
            MARKDOWN: 'markdown',
            IMAGE: 'image',
            HTML: 'html'
        };
    }

    /**
     * 导出项目到文件
     * @param {Object} projectData - 项目数据
     * @param {string} format - 导出格式
     * @param {Object} options - 导出选项
     */
    exportToFile(projectData, format = this.exportFormats.JSON, options = {}) {
        switch (format) {
            case this.exportFormats.JSON:
                this.exportToJSON(projectData, options);
                break;
            case this.exportFormats.MARKDOWN:
                this.exportToMarkdown(projectData, options);
                break;
            case this.exportFormats.IMAGE:
                if (!options.canvas) {
                    throw new Error('导出图片需要提供canvas元素');
                }
                this.exportToImage(options.canvas, options);
                break;
            case this.exportFormats.HTML:
                this.exportToHTML(projectData, options);
                break;
            default:
                throw new Error(`不支持的导出格式: ${format}`);
        }
    }

    /**
     * 导出为JSON文件
     * @param {Object} projectData - 项目数据
     * @param {Object} options - 导出选项
     * @returns {string} - JSON字符串
     */
    exportToJSON(projectData, options = {}) {
        try {
            // 准备导出数据
            const exportData = this.prepareExportData(projectData);
            
            // 格式化JSON
            const jsonString = JSON.stringify(exportData, null, options.pretty ? 2 : 0);
            
            // 创建文件名称
            const fileName = options.filename || `state-machine-${this.getDateString()}.json`;
            
            // 下载文件
            this.downloadFile(jsonString, fileName, 'application/json');
            
            return jsonString;
        } catch (error) {
            throw new Error(`JSON导出失败: ${error.message}`);
        }
    }

    /**
     * 导出为Markdown文件
     * @param {Object} projectData - 项目数据
     * @param {Object} options - 导出选项
     * @returns {string} - Markdown字符串
     */
    exportToMarkdown(projectData, options = {}) {
        try {
            const { nodes = [], connections = [] } = projectData;
            
            let markdown = `# ${options.title || '状态机图'}\n\n`;
            
            // 添加时间戳
            markdown += `*导出时间: ${new Date().toLocaleString('zh-CN')}*\n\n`;
            
            // 导出节点
            markdown += '## 节点\n\n';
            if (nodes.length === 0) {
                markdown += '- 无节点\n';
            } else {
                // 按名称排序节点
                const sortedNodes = [...nodes].sort((a, b) => a.name.localeCompare(b.name));
                
                sortedNodes.forEach(node => {
                    markdown += `- **${node.name}**`;
                    if (node.description) {
                        markdown += `: ${node.description}`;
                    }
                    markdown += '\n';
                });
            }
            
            // 导出连线
            markdown += '\n## 连线\n\n';
            if (connections.length === 0) {
                markdown += '- 无连线\n';
            } else {
                connections.forEach(connection => {
                    const sourceNode = nodes.find(n => n.id === connection.sourceId);
                    const targetNode = nodes.find(n => n.id === connection.targetId);
                    
                    if (sourceNode && targetNode) {
                        markdown += `- ${sourceNode.name} -> ${targetNode.name}`;
                        if (connection.condition) {
                            markdown += ` (${connection.condition})`;
                        }
                        markdown += '\n';
                    }
                });
            }
            
            // 导出统计信息
            markdown += '\n## 统计信息\n\n';
            markdown += `- 节点数量: ${nodes.length}\n`;
            markdown += `- 连线数量: ${connections.length}\n`;
            
            // 添加注释
            if (options.comment) {
                markdown += `\n## 注释\n\n${options.comment}\n`;
            }
            
            // 创建文件名称
            const fileName = options.filename || `state-machine-${this.getDateString()}.md`;
            
            // 下载文件
            this.downloadFile(markdown, fileName, 'text/markdown');
            
            return markdown;
        } catch (error) {
            throw new Error(`Markdown导出失败: ${error.message}`);
        }
    }

    /**
     * 导出为图片
     * @param {HTMLCanvasElement} canvas - Canvas元素
     * @param {Object} options - 导出选项
     * @returns {string} - Data URL
     */
    exportToImage(canvas, options = {}) {
        try {
            // 获取导出选项
            const format = options.format || 'png';
            const quality = options.quality || 1.0;
            const scale = options.scale || 2;
            
            // 创建临时canvas用于高分辨率导出
            const tempCanvas = document.createElement('canvas');
            const tempCtx = tempCanvas.getContext('2d');
            
            // 设置临时canvas尺寸
            tempCanvas.width = canvas.width * scale;
            tempCanvas.height = canvas.height * scale;
            
            // 调整缩放并绘制
            tempCtx.scale(scale, scale);
            tempCtx.drawImage(canvas, 0, 0);
            
            // 生成数据URL
            let dataURL;
            if (format === 'png') {
                dataURL = tempCanvas.toDataURL('image/png');
            } else if (format === 'jpeg' || format === 'jpg') {
                dataURL = tempCanvas.toDataURL('image/jpeg', quality);
            } else if (format === 'webp') {
                dataURL = tempCanvas.toDataURL('image/webp', quality);
            } else {
                throw new Error(`不支持的图片格式: ${format}`);
            }
            
            // 创建文件名称
            const fileName = options.filename || `state-machine-${this.getDateString()}.${format}`;
            
            // 下载文件
            this.downloadFileFromUrl(dataURL, fileName);
            
            return dataURL;
        } catch (error) {
            throw new Error(`图片导出失败: ${error.message}`);
        }
    }

    /**
     * 导出为HTML文件
     * @param {Object} projectData - 项目数据
     * @param {Object} options - 导出选项
     * @returns {string} - HTML字符串
     */
    exportToHTML(projectData, options = {}) {
        try {
            const { nodes = [], connections = [] } = projectData;
            
            const html = `<!DOCTYPE html>
<html lang="zh-CN">
<head>
    <meta charset="UTF-8">
    <meta name="viewport" content="width=device-width, initial-scale=1.0">
    <title>${options.title || '状态机图'}</title>
    <style>
        body {
            font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, 'Helvetica Neue', Arial, sans-serif;
            line-height: 1.6;
            color: #333;
            max-width: 1200px;
            margin: 0 auto;
            padding: 20px;
            background-color: #f5f5f5;
        }
        
        .container {
            background-color: white;
            border-radius: 8px;
            box-shadow: 0 2px 4px rgba(0,0,0,0.1);
            padding: 40px;
        }
        
        h1 {
            color: #2c3e50;
            margin-bottom: 20px;
            border-bottom: 2px solid #3498db;
            padding-bottom: 10px;
        }
        
        h2 {
            color: #2980b9;
            margin-top: 40px;
            margin-bottom: 20px;
        }
        
        .meta-info {
            color: #7f8c8d;
            font-size: 0.9em;
            margin-bottom: 30px;
            padding: 10px;
            background-color: #ecf0f1;
            border-radius: 4px;
        }
        
        .node-list {
            list-style: none;
            padding: 0;
        }
        
        .node-item {
            background-color: #f8f9fa;
            border-left: 4px solid #3498db;
            padding: 15px;
            margin-bottom: 10px;
            border-radius: 0 4px 4px 0;
        }
        
        .node-name {
            font-weight: bold;
            color: #2c3e50;
            font-size: 1.1em;
        }
        
        .node-description {
            color: #7f8c8d;
            margin-top: 5px;
            font-style: italic;
        }
        
        .connection-list {
            list-style: none;
            padding: 0;
        }
        
        .connection-item {
            background-color: #f8f9fa;
            border-left: 4px solid #2ecc71;
            padding: 15px;
            margin-bottom: 10px;
            border-radius: 0 4px 4px 0;
        }
        
        .connection-path {
            font-family: monospace;
            color: #2c3e50;
        }
        
        .connection-condition {
            color: #e74c3c;
            font-style: italic;
            margin-left: 10px;
        }
        
        .statistics {
            background-color: #f0f8ff;
            padding: 20px;
            border-radius: 4px;
            margin-top: 30px;
        }
        
        .stat-item {
            display: inline-block;
            margin-right: 30px;
            color: #2c3e50;
        }
        
        .stat-value {
            font-weight: bold;
            color: #3498db;
            font-size: 1.2em;
        }
    </style>
</head>
<body>
    <div class="container">
        <h1>${options.title || '状态机图'}</h1>
        
        <div class="meta-info">
            导出时间: ${new Date().toLocaleString('zh-CN')}
        </div>
        
        <h2>节点列表</h2>
        <ul class="node-list">
            ${nodes.length > 0 ? 
                nodes.sort((a, b) => a.name.localeCompare(b.name))
                    .map(node => `
                    <li class="node-item">
                        <div class="node-name">${this.escapeHtml(node.name)}</div>
                        ${node.description ? `<div class="node-description">${this.escapeHtml(node.description)}</div>` : ''}
                    </li>
                `).join('')
                : '<li>无节点</li>'
            }
        </ul>
        
        <h2>连线列表</h2>
        <ul class="connection-list">
            ${connections.length > 0 ? 
                connections.map(connection => {
                    const sourceNode = nodes.find(n => n.id === connection.sourceId);
                    const targetNode = nodes.find(n => n.id === connection.targetId);
                    
                    if (sourceNode && targetNode) {
                        return `
                        <li class="connection-item">
                            <div class="connection-path">
                                ${this.escapeHtml(sourceNode.name)} → ${this.escapeHtml(targetNode.name)}
                                ${connection.condition ? `<span class="connection-condition">(${this.escapeHtml(connection.condition)})</span>` : ''}
                            </div>
                        </li>
                        `;
                    }
                    return '';
                }).join('')
                : '<li>无连线</li>'
            }
        </ul>
        
        <div class="statistics">
            <div class="stat-item">
                节点数量: <span class="stat-value">${nodes.length}</span>
            </div>
            <div class="stat-item">
                连线数量: <span class="stat-value">${connections.length}</span>
            </div>
        </div>
        
        ${options.comment ? `
        <h2>注释</h2>
        <div>${this.escapeHtml(options.comment)}</div>
        ` : ''}
    </div>
</body>
</html>`;
            
            // 创建文件名称
            const fileName = options.filename || `state-machine-${this.getDateString()}.html`;
            
            // 下载文件
            this.downloadFile(html, fileName, 'text/html');
            
            return html;
        } catch (error) {
            throw new Error(`HTML导出失败: ${error.message}`);
        }
    }

    /**
     * 复制到剪贴板
     * @param {string} content - 要复制的内容
     * @returns {Promise<void>}
     */
    async copyToClipboard(content) {
        try {
            if (!navigator.clipboard) {
                // 降级方案
                this.fallbackCopyToClipboard(content);
                return;
            }
            
            await navigator.clipboard.writeText(content);
        } catch (error) {
            // 尝试降级方案
            try {
                this.fallbackCopyToClipboard(content);
            } catch (fallbackError) {
                throw new Error(`复制到剪贴板失败: ${fallbackError.message}`);
            }
        }
    }

    /**
     * 降级复制到剪贴板方案
     * @param {string} content - 要复制的内容
     */
    fallbackCopyToClipboard(content) {
        const textArea = document.createElement('textarea');
        textArea.value = content;
        textArea.style.position = 'fixed';
        textArea.style.left = '-999999px';
        textArea.style.top = '-999999px';
        document.body.appendChild(textArea);
        textArea.focus();
        textArea.select();
        
        try {
            document.execCommand('copy');
        } catch (error) {
            throw new Error('无法复制到剪贴板');
        } finally {
            document.body.removeChild(textArea);
        }
    }

    /**
     * 准备导出数据
     * @param {Object} projectData - 原始项目数据
     * @returns {Object} - 准备好的导出数据
     */
    prepareExportData(projectData) {
        const exportData = {
            version: projectData.version || '1.0',
            exportDate: new Date().toISOString(),
            nodes: [],
            connections: [],
            viewState: projectData.viewState || {}
        };
        
        // 复制节点数据
        if (Array.isArray(projectData.nodes)) {
            exportData.nodes = projectData.nodes.map(node => {
                const nodePos = (node.transform && node.transform.position) ? node.transform.position : { x: 0, y: 0 };
                return {
                    id: node.id,
                    name: node.name || '',
                    description: node.description || '',
                    group: node.group || 'root',
                    x: nodePos.x,
                    y: nodePos.y,
                    width: node.width || 120,
                    height: node.height || 60
                };
            });
        }
        
        // 复制连线数据
        if (Array.isArray(projectData.connections)) {
            exportData.connections = projectData.connections.map(conn => ({
                id: conn.id,
                sourceId: conn.sourceId,
                targetId: conn.targetId,
                condition: conn.condition || ''
            }));
        }
        
        return exportData;
    }

    /**
     * 下载文件
     * @param {string} content - 文件内容
     * @param {string} fileName - 文件名
     * @param {string} mimeType - MIME类型
     */
    downloadFile(content, fileName, mimeType) {
        const blob = new Blob([content], { type: mimeType });
        const url = URL.createObjectURL(blob);
        
        this.downloadFileFromUrl(url, fileName);
        
        // 清理
        setTimeout(() => {
            URL.revokeObjectURL(url);
        }, 100);
    }

    /**
     * 从URL下载文件
     * @param {string} url - 文件URL
     * @param {string} fileName - 文件名
     */
    downloadFileFromUrl(url, fileName) {
        const link = document.createElement('a');
        link.href = url;
        link.download = fileName;
        link.style.display = 'none';
        
        document.body.appendChild(link);
        link.click();
        
        // 清理
        setTimeout(() => {
            document.body.removeChild(link);
        }, 100);
    }

    /**
     * 获取格式化的日期字符串
     * @returns {string} - 日期字符串 YYYY-MM-DD
     */
    getDateString() {
        const now = new Date();
        const year = now.getFullYear();
        const month = String(now.getMonth() + 1).padStart(2, '0');
        const day = String(now.getDate()).padStart(2, '0');
        return `${year}-${month}-${day}`;
    }

    /**
     * HTML转义
     * @param {string} unsafe - 不安全的HTML
     * @returns {string} - 转义后的HTML
     */
    escapeHtml(unsafe) {
        if (!unsafe) return '';
        
        return unsafe
            .replace(/&/g, "&amp;")
            .replace(/</g, "&lt;")
            .replace(/>/g, "&gt;")
            .replace(/"/g, "&quot;")
            .replace(/'/g, "&#039;");
    }

    /**
     * 生成报告
     * @param {Object} projectData - 项目数据
     * @returns {Object} - 报告对象
     */
    generateReport(projectData) {
        const { nodes = [], connections = [] } = projectData;
        
        // 计算统计信息
        const nodeCount = nodes.length;
        const connectionCount = connections.length;
        
        // 计算每个节点的入度和出度
        const nodeStats = {};
        nodes.forEach(node => {
            nodeStats[node.id] = {
                name: node.name,
                inDegree: 0,
                outDegree: 0,
                totalDegree: 0
            };
        });
        
        connections.forEach(conn => {
            if (nodeStats[conn.sourceId]) {
                nodeStats[conn.sourceId].outDegree++;
            }
            if (nodeStats[conn.targetId]) {
                nodeStats[conn.targetId].inDegree++;
            }
        });
        
        // 计算总度数
        Object.keys(nodeStats).forEach(nodeId => {
            const stats = nodeStats[nodeId];
            stats.totalDegree = stats.inDegree + stats.outDegree;
        });
        
        // 查找孤立节点（无入度无出度）
        const isolatedNodes = Object.values(nodeStats)
            .filter(stats => stats.totalDegree === 0)
            .map(stats => stats.name);
        
        // 查找起点（无入度）和终点（无出度）
        const startNodes = Object.values(nodeStats)
            .filter(stats => stats.inDegree === 0 && stats.outDegree > 0)
            .map(stats => stats.name);
        
        const endNodes = Object.values(nodeStats)
            .filter(stats => stats.outDegree === 0 && stats.inDegree > 0)
            .map(stats => stats.name);
        
        return {
            nodeCount,
            connectionCount,
            isolatedNodes,
            startNodes,
            endNodes,
            averageConnectionsPerNode: nodeCount > 0 ? (connectionCount * 2 / nodeCount).toFixed(2) : 0
        };
    }
}