// mermaid图表解析器

/**
 * 支持的mermaid图表类型
 * 仅包含那些纯粹由节点和连线构成的图表类型
 */
export const SUPPORTED_MERMAID_TYPES = [
    'graph',    // 流程图
    'flowchart', // 流程图的别名
    'mindmap',  // 思维导图
    'graph TD', // 自上而下流程图
    'graph LR', // 从左到右流程图
    'graph RL', // 从右到左流程图
    'graph BT', // 自下而上流程图
    'flowchart TD',
    'flowchart LR',
    'flowchart RL',
    'flowchart BT'
];

/**
 * 从Markdown内容中提取mermaid图表
 * @param {string} markdownContent - Markdown内容
 * @returns {Array<{type: string, code: string}>} - 提取的mermaid图表列表
 */
export const extractMermaidCharts = (markdownContent) => {
    const charts = [];
    const mermaidRegex = /```mermaid\s+([\s\S]+?)```/g;
    let match;
    
    while ((match = mermaidRegex.exec(markdownContent)) !== null) {
        const code = match[1].trim();
        const firstLine = code.split('\n')[0].trim().toLowerCase();
        
        // 检测图表类型
        let chartType = 'unknown';
        for (const type of SUPPORTED_MERMAID_TYPES) {
            if (firstLine.startsWith(type)) {
                chartType = type.includes('graph') ? 'graph' : 
                            type.includes('flowchart') ? 'flowchart' : 'mindmap';
                break;
            }
        }
        
        if (chartType !== 'unknown') {
            charts.push({ type: chartType, code });
        }
    }
    
    return charts;
};

/**
 * 解析mermaid图表代码，转换为节点和连接数据
 * @param {string} chartType - 图表类型
 * @param {string} chartCode - mermaid图表代码
 * @returns {{nodes: Array, connections: Array}} - 节点和连接数据
 */
export const parseMermaidChart = (chartType, chartCode) => {
    const nodes = [];
    const connections = [];
    const nodeMap = new Map(); // 用于存储节点ID和名称的映射
    
    // 去除图表类型声明行
    const lines = chartCode.split('\n').slice(1).filter(line => line.trim() !== '');
    
    if (chartType === 'mindmap') {
        // 解析思维导图
        parseMindmap(lines, nodes, connections, nodeMap);
    } else if (chartType === 'graph' || chartType === 'flowchart') {
        // 解析流程图
        parseFlowchart(lines, nodes, connections, nodeMap);
    }
    
    return { nodes, connections };
};

/**
 * 解析思维导图
 * @param {Array<string>} lines - 图表代码行
 * @param {Array} nodes - 节点数组（输出）
 * @param {Array} connections - 连接数组（输出）
 * @param {Map} nodeMap - 节点映射（输出）
 */
const parseMindmap = (lines, nodes, connections, nodeMap) => {
    let nodeCounter = 0;
    const parentStack = [];
    
    lines.forEach(line => {
        const trimmed = line.trim();
        // 跳过注释行
        if (trimmed.startsWith('%%')) return;
        
        // 计算缩进级别（通过星号数量）
        const match = trimmed.match(/^(\*+)\s+(.+)$/);
        if (!match) return;
        
        const level = match[1].length;
        const text = match[2].trim();
        
        // 创建节点
        const node = {
            id: `node_${nodeCounter++}`,
            name: text,
            x: 100 + (nodeCounter % 5) * 200,
            y: 100 + Math.floor(nodeCounter / 5) * 150
        };
        
        nodes.push(node);
        nodeMap.set(text, node.id);
        
        // 根据缩进级别维护父节点栈
        while (parentStack.length >= level) {
            parentStack.pop();
        }
        
        // 如果有父节点，创建连接
        if (parentStack.length > 0) {
            connections.push({
                sourceNodeId: parentStack[parentStack.length - 1],
                targetNodeId: node.id
            });
        }
        
        // 将当前节点添加到栈中
        parentStack.push(node.id);
    });
};

/**
 * 解析流程图
 * @param {Array<string>} lines - 图表代码行
 * @param {Array} nodes - 节点数组（输出）
 * @param {Array} connections - 连接数组（输出）
 * @param {Map} nodeMap - 节点映射（输出）
 */
const parseFlowchart = (lines, nodes, connections, nodeMap) => {
    let nodeCounter = 0;
    
    lines.forEach(line => {
        const trimmed = line.trim();
        // 跳过注释行
        if (trimmed.startsWith('%%')) return;
        
        // 检测连接关系
        const connectionMatch = trimmed.match(/(.+?)\s*(-{2,}|>{1,})[\s-]*>(.+)/);
        if (connectionMatch) {
            const source = connectionMatch[1].trim();
            const target = connectionMatch[3].trim();
            
            // 处理源节点
            if (!nodeMap.has(source)) {
                const node = {
                    id: `node_${nodeCounter++}`,
                    name: cleanNodeName(source),
                    x: 100 + (nodeCounter % 5) * 200,
                    y: 100 + Math.floor(nodeCounter / 5) * 150
                };
                nodes.push(node);
                nodeMap.set(source, node.id);
            }
            
            // 处理目标节点
            if (!nodeMap.has(target)) {
                const node = {
                    id: `node_${nodeCounter++}`,
                    name: cleanNodeName(target),
                    x: 100 + (nodeCounter % 5) * 200,
                    y: 100 + Math.floor(nodeCounter / 5) * 150
                };
                nodes.push(node);
                nodeMap.set(target, node.id);
            }
            
            // 创建连接
            connections.push({
                sourceNodeId: nodeMap.get(source),
                targetNodeId: nodeMap.get(target)
            });
        } else {
            // 可能是单独的节点定义
            const nodeMatch = trimmed.match(/^([\w\s]+)$/);
            if (nodeMatch && !nodeMap.has(nodeMatch[1].trim())) {
                const node = {
                    id: `node_${nodeCounter++}`,
                    name: nodeMatch[1].trim(),
                    x: 100 + (nodeCounter % 5) * 200,
                    y: 100 + Math.floor(nodeCounter / 5) * 150
                };
                nodes.push(node);
                nodeMap.set(node.name, node.id);
            }
        }
    });
};

/**
 * 清理节点名称，去除mermaid语法中的特殊字符
 * @param {string} nodeName - 原始节点名称
 * @returns {string} - 清理后的节点名称
 */
const cleanNodeName = (nodeName) => {
    // 去除方括号、圆括号、引号等
    return nodeName
        .replace(/[\[\](){}]/g, '')
        .replace(/['"`]/g, '')
        .trim();
};

/**
 * 从Markdown无序列表中解析树形结构
 * @param {string} markdownContent - Markdown内容
 * @returns {{nodes: Array, connections: Array}} - 节点和连接数据
 */
export const parseMarkdownList = (markdownContent) => {
    const nodes = [];
    const connections = [];
    const nodeMap = new Map();
    const parentStack = [];
    let nodeCounter = 0;
    
    const lines = markdownContent.split('\n');
    let inList = false;
    let currentLevel = 0;
    
    lines.forEach(line => {
        const trimmed = line.trim();
        
        // 检测列表项
        if (trimmed.startsWith('- ')) {
            inList = true;
            const level = (line.length - line.trimLeft().length) / 2; // 假设使用两个空格缩进
            const text = trimmed.substring(2).trim();
            
            // 创建节点
            const node = {
                id: `node_${nodeCounter++}`,
                name: text,
                x: 100 + (nodeCounter % 5) * 200,
                y: 100 + Math.floor(nodeCounter / 5) * 150
            };
            
            nodes.push(node);
            nodeMap.set(text, node.id);
            
            // 调整父节点栈
            while (parentStack.length > level) {
                parentStack.pop();
            }
            
            // 如果有父节点，创建连接
            if (parentStack.length > 0) {
                connections.push({
                    sourceNodeId: parentStack[parentStack.length - 1].id,
                    targetNodeId: node.id
                });
            }
            
            // 将当前节点添加到栈中
            parentStack.push({ id: node.id, level });
            currentLevel = level;
        } else if (!trimmed && inList) {
            // 空行可能表示列表结束
            parentStack.length = 0;
            inList = false;
        }
    });
    
    return { nodes, connections };
};