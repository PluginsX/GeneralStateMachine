import Connection from '../core/connection.js';
import Condition from '../core/condition.js';
import Node from '../core/node.js';
import { extractMermaidCharts, parseMermaidChart, parseMarkdownList } from '../utils/mermaidParser.js';
import { AlertDialog, ConfirmDialog } from '../utils/popup.js';

// 导入Markdown
export const importMarkdown = (content, editor) => {
    // 清空现有内容
    editor.nodes = [];
    editor.connections = [];
    
    // 尝试从mermaid图表导入
    const mermaidCharts = extractMermaidCharts(content);
    
    if (mermaidCharts.length > 0) {
        // 如果找到mermaid图表，导入第一个图表
        const { type, code } = mermaidCharts[0];
        const { nodes, connections } = parseMermaidChart(type, code);
        
        // 转换为实际的Node和Connection对象
        const nodeMap = new Map();
        
        nodes.forEach(nodeData => {
            const node = new Node(nodeData.name, nodeData.x, nodeData.y);
            nodeMap.set(nodeData.id, node.id);
            editor.nodes.push(node);
        });
        
        connections.forEach(connData => {
            const connection = new Connection(
                nodeMap.get(connData.sourceNodeId),
                nodeMap.get(connData.targetNodeId)
            );
            editor.connections.push(connection);
        });
    } 
    // 尝试从无序列表导入
    else {
        const { nodes, connections } = parseMarkdownList(content);
        
        if (nodes.length > 0) {
            // 转换为实际的Node和Connection对象
            const nodeMap = new Map();
            
            nodes.forEach(nodeData => {
                const node = new Node(nodeData.name, nodeData.x, nodeData.y);
                nodeMap.set(nodeData.id, node.id);
                editor.nodes.push(node);
            });
            
            connections.forEach(connData => {
                const connection = new Connection(
                    nodeMap.get(connData.sourceNodeId),
                    nodeMap.get(connData.targetNodeId)
                );
                editor.connections.push(connection);
            });
        }
        // 回退到原始的标题解析
        else {
            importMarkdownLegacy(content, editor);
        }
    }
    
    editor.deselectAll();
    editor.scheduleRender();
};

// 原始的Markdown解析方法（作为回退）
const importMarkdownLegacy = (content, editor) => {
    // 简单的Markdown解析示例
    const lines = content.split('\n');
    let currentNode = null;
    let nodesMap = new Map();
    let nodeCounter = 0;
    
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
};

// 处理文件选择（导入）
export const handleFileSelect = async (e, editor) => {
    const file = e.target.files[0];
    if (!file) return;
    
    const reader = new FileReader();
    reader.onload = async (event) => {
        try {
            const content = event.target.result;
            importMarkdown(content, editor);
        } catch (error) {
            await AlertDialog('导入失败: ' + error.message);
        }
    };
    
    if (file.name.endsWith('.md')) {
        reader.readAsText(file);
    } else {
        await AlertDialog('请选择Markdown文件 (.md)');
    }
    
    // 重置文件输入，允许重复选择同一个文件
    e.target.value = '';
};

// 打开项目文件
export const openProject = async (editor) => {
    const input = document.getElementById('project-input');
    if (!input) {
        await AlertDialog('项目文件输入元素不存在');
        return;
    }
    
    input.click();
};

// 处理项目文件选择
export const handleProjectFileSelect = async (e, editor) => {
    const file = e.target.files[0];
    if (!file) return;
    
    const reader = new FileReader();
    reader.onload = async (event) => {
        try {
            const jsonContent = event.target.result;
            const projectData = JSON.parse(jsonContent);
            
            // 验证项目文件格式
            if (!projectData.type || projectData.type !== 'node-graph-editor-project') {
                await AlertDialog('这不是一个有效的项目文件');
                return;
            }
            
            // 清空现有内容
            editor.nodes = [];
            editor.connections = [];
            editor.selectedElements = [];
            
            // 导入节点
            if (projectData.nodes && Array.isArray(projectData.nodes)) {
                projectData.nodes.forEach(nodeData => {
                    const node = new Node(nodeData.name, nodeData.x, nodeData.y);
                    node.id = nodeData.id;
                    node.description = nodeData.description || '';
                    node.width = nodeData.width || 150;
                    node.height = nodeData.height || 50;
                    node.autoSize = nodeData.autoSize || false;
                    node.color = nodeData.color || null;
                    editor.nodes.push(node);
                });
            }
            
            // 导入连接
            if (projectData.connections && Array.isArray(projectData.connections)) {
                projectData.connections.forEach(connData => {
                    const connection = new Connection(connData.sourceNodeId, connData.targetNodeId);
                    connection.id = connData.id;
                    
                    // 导入条件
                    if (connData.conditions && Array.isArray(connData.conditions)) {
                        connData.conditions.forEach(condData => {
                            const condition = new Condition();
                            condition.type = condData.type;
                            condition.key = condData.key;
                            condition.operator = condData.operator;
                            condition.value = condData.value;
                            connection.conditions.push(condition);
                        });
                    }
                    
                    // 导入连接属性
                    connection.color = connData.color || null;
                    connection.lineWidth = connData.lineWidth || null;
                    connection.lineType = connData.lineType || 'solid';
                    connection.arrowSize = connData.arrowSize || null;
                    connection.arrowColor = connData.arrowColor || null;
                    
                    editor.connections.push(connection);
                });
            }
            
            editor.deselectAll();
            editor.scheduleRender();
            
        } catch (error) {
                await AlertDialog('打开项目失败: ' + error.message);
            }
    };
    
    if (file.name.endsWith('.json')) {
        reader.readAsText(file);
    } else {
        await AlertDialog('请选择JSON项目文件 (.json)');
    }
    
    // 重置文件输入，允许重复选择同一个文件
    e.target.value = '';
};
