import Connection from '../core/connection.js';
import Node from '../core/node.js';

// 导入Markdown
export const importMarkdown = (content, editor) => {
    // 简单的Markdown解析示例
    const lines = content.split('\n');
    let currentNode = null;
    let nodesMap = new Map();
    let nodeCounter = 0;
    
    // 清空现有内容
    editor.nodes = [];
    editor.connections = [];
    
    // 解析Markdown并创建节点
    lines.forEach(line => {
        line = line.trim();
        
        // 标题作为节点
        if (line.startsWith('#')) {
            const level = line.search(/\S|$/);
            const title = line.substring(level).trim();
            
            // 创建新节点
            currentNode = new Node(
                title,
                100 + (nodeCounter % 5) * 200,
                100 + Math.floor(nodeCounter / 5) * 150
            );
            
            editor.nodes.push(currentNode);
            nodesMap.set(title, currentNode.id);
            nodeCounter++;
        } 
        // 列表项作为连接
        else if (line.startsWith('-') && currentNode) {
            const text = line.substring(1).trim();
            if (nodesMap.has(text)) {
                editor.connections.push(
                    new Connection(currentNode.id, nodesMap.get(text))
                );
            }
        }
    });
    
    editor.deselectAll();
    editor.scheduleRender();
};

// 处理文件选择（导入）
export const handleFileSelect = (e, editor) => {
    const file = e.target.files[0];
    if (!file) return;
    
    const reader = new FileReader();
    reader.onload = (event) => {
        try {
            const content = event.target.result;
            importMarkdown(content, editor);
        } catch (error) {
            alert('导入失败: ' + error.message);
        }
    };
    
    if (file.name.endsWith('.md')) {
        reader.readAsText(file);
    } else {
        alert('请选择Markdown文件 (.md)');
    }
    
    // 重置文件输入，允许重复选择同一个文件
    e.target.value = '';
};