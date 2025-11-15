import ConnectionModel from '../models/ConnectionModel.js';
import Condition from '../core/condition.js';
import NodeModel from '../models/NodeModel.js';
import { extractMermaidCharts, parseMermaidChart, parseMarkdownList } from '../utils/mermaidParser.js';
import { AlertDialog, ConfirmDialog, PopUp_Window } from '../utils/popup.js';
import ImportService from './ImportService.js';

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
            const node = new NodeModel(nodeData.name, nodeData.x, nodeData.y);
            node.group = nodeData.group || ''; // 设置Group属性
            nodeMap.set(nodeData.id, node.id);
            editor.nodes.push(node);
        });
        
        connections.forEach(connData => {
                const connection = new ConnectionModel(
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
                const node = new NodeModel(nodeData.name, nodeData.x, nodeData.y);
                node.group = nodeData.group || ''; // 设置Group属性
                nodeMap.set(nodeData.id, node.id);
                editor.nodes.push(node);
            });
            
            connections.forEach(connData => {
                const connection = new ConnectionModel(
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
    // 强制更新可视对象缓存，确保导入的对象可以被鼠标事件检测到
    editor.updateVisibleObjects(true);
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
            currentNode = new NodeModel(
                title,
                100 + (nodeCounter % 5) * 200,
                100 + Math.floor(nodeCounter / 5) * 150
            );
            currentNode.group = ''; // 初始化Group属性
            
            editor.nodes.push(currentNode);
            nodesMap.set(title, currentNode.id);
            nodeCounter++;
        } 
        // 列表项作为连接
        else if (line.startsWith('-') && currentNode) {
            const text = line.substring(1).trim();
            if (nodesMap.has(text)) {
                editor.connections.push(
                    new ConnectionModel(currentNode.id, nodesMap.get(text))
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

// 加载项目数据（核心逻辑，可被打开工程和导入JSON复用）
export const loadProjectData = async (projectData, editor) => {
    // 验证项目文件格式
    if (!projectData.type || projectData.type !== 'node-graph-editor-project') {
        throw new Error('这不是一个有效的项目文件');
    }
    
    // 清空现有内容
    editor.nodes = [];
    editor.connections = [];
    editor.selectedElements = [];
    
    // 导入节点
    if (projectData.nodes && Array.isArray(projectData.nodes)) {
        projectData.nodes.forEach((nodeData) => {
            const node = new NodeModel(nodeData.name, nodeData.x, nodeData.y);
            node.id = nodeData.id;
            node.description = nodeData.description || '';
            node.group = nodeData.group || ''; // 设置Group属性
            node.width = nodeData.width || 150;
            node.height = nodeData.height || 50;
            node.autoSize = nodeData.autoSize || false;
            node.color = nodeData.color || null;
            editor.nodes.push(node);
        });
    }
    
    // 导入连接
    if (projectData.connections && Array.isArray(projectData.connections)) {
        projectData.connections.forEach((connData) => {
            const connection = new ConnectionModel(connData.sourceNodeId, connData.targetNodeId);
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
    // 强制更新可视对象缓存，确保导入的对象可以被鼠标事件检测到
    editor.updateVisibleObjects(true);
    editor.scheduleRender();
    // 更新状态栏
    if (editor.updateStatusBar) {
        editor.updateStatusBar();
    }
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
            
            // 使用统一的加载项目数据函数
            await loadProjectData(projectData, editor);
            
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

// 导入JSON文件（任意JSON格式）
export const importJSON = async (content, editor) => {
    try {
        console.log('开始执行importJSON函数');
        
        // 解析JSON
        const jsonData = typeof content === 'string' ? JSON.parse(content) : content;
        console.log('JSON解析完成');
        
        // 检测是否为项目工程文件格式
        if (jsonData.type === 'node-graph-editor-project') {
            console.log('检测到项目工程文件格式');
            
            // 显示弹窗提示用户并获取确认（与ImportService保持一致）
            const confirmImport = await PopUp_Window(
                'JSON导入信息',
                '检测到该json文件为：编辑器标准工程文件',
                '导入',
                '取消'
            );
            
            // 如果用户取消导入，抛出错误中断操作
            if (!confirmImport) {
                console.log('用户取消了JSON导入');
                throw new Error('导入已取消');
            }
            
            // 用户确认后，直接复用打开工程的逻辑，无需通过ImportService
            await loadProjectData(jsonData, editor);
            
            // 记录导入操作到历史记录
            if (editor.historyManager) {
                try {
                    console.log('记录历史操作');
                    editor.historyManager.addHistory('import', { description: '导入项目工程文件' });
                    console.log('历史操作记录成功');
                } catch (historyError) {
                    console.error('记录历史操作失败:', historyError);
                }
            }
            
            console.log('项目工程文件导入成功');
            return;
        }
        
        // 对于其他格式（Unity状态机、普通JSON），使用ImportService处理
        const importService = new ImportService();
        
        // 调用带弹窗提示的导入方法
        console.log('调用importService.importFromJSON');
        const importResult = await importService.importFromJSON(jsonData);
        console.log('importFromJSON调用完成，结果:', importResult ? '有返回值' : '无返回值');
        
        // 检查importResult是否存在
        if (!importResult) {
            console.error('importResult为空或undefined');
            throw new Error('导入结果为空');
        }
        
        // 清空现有内容
        editor.nodes = [];
        editor.connections = [];
        editor.selectedElements = [];
        
        // 应用导入的节点和连接
        if (importResult.nodes) {
            editor.nodes = importResult.nodes;
            console.log('应用了导入的节点，数量:', importResult.nodes.length);
        } else {
            console.warn('importResult.nodes不存在');
        }
        
        if (importResult.connections) {
            editor.connections = importResult.connections;
            console.log('应用了导入的连接，数量:', importResult.connections.length);
        } else {
            console.warn('importResult.connections不存在');
        }
        
        // 更新视图状态（如果有）
        if (importResult.viewState) {
            // 确保editor.viewState已初始化
            if (!editor.viewState) {
                console.warn('editor.viewState未初始化，创建空对象');
                editor.viewState = {};
            }
            Object.assign(editor.viewState, importResult.viewState);
            console.log('应用了导入的视图状态');
        } else {
            console.warn('importResult.viewState不存在');
        }
        
        editor.deselectAll();
        // 强制更新可视对象缓存，确保导入的对象可以被鼠标事件检测到
        editor.updateVisibleObjects(true);
        editor.scheduleRender();
        // 更新状态栏
        if (editor.updateStatusBar) {
            editor.updateStatusBar();
        }
        console.log('视图更新完成');
        
        // 记录导入操作到历史记录（仅在非项目工程文件格式时记录，项目工程文件格式已在loadProjectData中记录）
        if (editor.historyManager) {
            try {
                // 检查是否已经记录过历史（项目工程文件格式已在loadProjectData中记录）
                // 这里只记录非项目工程文件格式的导入
                if (jsonData.type !== 'node-graph-editor-project') {
                    console.log('记录历史操作');
                    editor.historyManager.addHistory('import', { description: '导入JSON' });
                    console.log('历史操作记录成功');
                }
            } catch (historyError) {
                console.error('记录历史操作失败:', historyError);
                // 历史记录失败不应该阻止导入成功
            }
        }
        console.log('JSON导入完全成功');
    } catch (error) {
        console.error('importJSON捕获到错误:', error);
        if (error.message !== '导入已取消') {
            await AlertDialog('JSON导入失败: ' + error.message);
        }
        throw error;
    }
};

// 检测是否为Unity YAML格式
const isUnityYAML = (yamlContent) => {
    // 检查是否包含Unity特有的标记
    return yamlContent.includes('%YAML 1.1') && 
           (yamlContent.includes('%TAG !u!') || yamlContent.includes('!u!'));
};

// Unity YAML解析器（支持Unity 2017格式）
const parseUnityYAML = (yamlContent) => {
    const result = {};
    const lines = yamlContent.split('\n');
    let currentObject = null;
    let currentObjectName = null;
    const objectStack = [];
    const arrayKeys = new Map(); // 存储键和其对应的缩进，用于识别数组
    
    for (let i = 0; i < lines.length; i++) {
        const line = lines[i];
        const trimmed = line.trim();
        
        // 跳过空行、注释和指令行
        if (!trimmed || trimmed.startsWith('#') || 
            trimmed.startsWith('%YAML') || trimmed.startsWith('%TAG')) {
            continue;
        }
        
        // 检测对象分隔符 `--- !u!类型 &ID`
        if (trimmed.startsWith('---')) {
            const match = trimmed.match(/^---\s+!u!(\d+)\s+&(\d+)$/);
            if (match) {
                const type = match[1];
                const id = match[2];
                
                // 创建新对象
                currentObjectName = `UnityObject_${type}_${id}`;
                currentObject = {};
                result[currentObjectName] = currentObject;
                objectStack.length = 0;
                objectStack.push({ obj: currentObject, indent: -1 });
                arrayKeys.clear();
                continue;
            }
        }
        
        if (!currentObject) continue;
        
        // 计算缩进
        const indentMatch = line.match(/^(\s*)/);
        const indent = indentMatch ? indentMatch[1].length : 0;
        
        // 处理缩进栈
        while (objectStack.length > 1 && objectStack[objectStack.length - 1].indent >= indent) {
            objectStack.pop();
        }
        
        const current = objectStack[objectStack.length - 1];
        
        // 检查是否是列表项（以 `-` 开头）
        if (trimmed.startsWith('-')) {
            // 找到对应的数组键（缩进比列表项小的最近的键）
            let targetArrayKey = null;
            let bestKey = null;
            let bestIndent = -1;
            
            // 查找所有可能的数组键
            for (const [key, keyIndent] of arrayKeys.entries()) {
                if (keyIndent < indent) {
                    if (keyIndent > bestIndent) {
                        bestIndent = keyIndent;
                        bestKey = key;
                    }
                }
            }
            
            // 如果找到了候选键，检查它是否是数组或空对象
            if (bestKey) {
                if (Array.isArray(current.obj[bestKey])) {
                    targetArrayKey = bestKey;
                } else if (typeof current.obj[bestKey] === 'object' && 
                          Object.keys(current.obj[bestKey]).length === 0) {
                    // 空对象，转换为数组
                    current.obj[bestKey] = [];
                    targetArrayKey = bestKey;
                }
            }
            
            // 如果还没找到，查找最近的数组
            if (!targetArrayKey) {
                const keys = Object.keys(current.obj);
                for (let j = keys.length - 1; j >= 0; j--) {
                    const k = keys[j];
                    if (Array.isArray(current.obj[k])) {
                        targetArrayKey = k;
                        break;
                    }
                }
            }
            
            const listMatch = trimmed.match(/^-\s*(.+)$/);
            if (listMatch) {
                const itemContent = listMatch[1].trim();
                
                // 检查列表项内容是否是键值对
                const itemColonIndex = itemContent.indexOf(':');
                if (itemColonIndex !== -1) {
                    // 列表项是对象
                    const itemKey = itemContent.substring(0, itemColonIndex).trim();
                    let itemValue = itemContent.substring(itemColonIndex + 1).trim();
                    
                    if (targetArrayKey && Array.isArray(current.obj[targetArrayKey])) {
                        const newItem = {};
                        newItem[itemKey] = parseUnityValue(itemValue);
                        current.obj[targetArrayKey].push(newItem);
                    } else {
                        // 创建新数组，使用最近的键或默认键
                        const arrayKey = targetArrayKey || bestKey || 'items';
                        if (!Array.isArray(current.obj[arrayKey])) {
                            // 如果是空对象，转换为数组
                            if (typeof current.obj[arrayKey] === 'object' && 
                                Object.keys(current.obj[arrayKey]).length === 0) {
                                current.obj[arrayKey] = [];
                            } else {
                                current.obj[arrayKey] = [];
                            }
                        }
                        const newItem = {};
                        newItem[itemKey] = parseUnityValue(itemValue);
                        current.obj[arrayKey].push(newItem);
                        arrayKeys.set(arrayKey, bestIndent >= 0 ? bestIndent : indent - 2);
                    }
                } else {
                    // 列表项是简单值
                    const value = parseUnityValue(itemContent);
                    if (targetArrayKey && Array.isArray(current.obj[targetArrayKey])) {
                        current.obj[targetArrayKey].push(value);
                    } else {
                        const arrayKey = targetArrayKey || bestKey || 'items';
                        if (!Array.isArray(current.obj[arrayKey])) {
                            // 如果是空对象，转换为数组
                            if (typeof current.obj[arrayKey] === 'object' && 
                                Object.keys(current.obj[arrayKey]).length === 0) {
                                current.obj[arrayKey] = [];
                            } else {
                                current.obj[arrayKey] = [];
                            }
                        }
                        current.obj[arrayKey].push(value);
                        arrayKeys.set(arrayKey, bestIndent >= 0 ? bestIndent : indent - 2);
                    }
                }
            }
            continue;
        }
        
        // 解析键值对
        const colonIndex = trimmed.indexOf(':');
        if (colonIndex === -1) continue;
        
        const key = trimmed.substring(0, colonIndex).trim();
        let value = trimmed.substring(colonIndex + 1).trim();
        
        // 处理值
        if (!value) {
            // 空值，可能是嵌套对象或数组
            const newObj = {};
            current.obj[key] = newObj;
            objectStack.push({ obj: newObj, indent });
            // 标记这个键可能是数组
            arrayKeys.set(key, indent);
        } else {
            // 有值
            current.obj[key] = parseUnityValue(value);
            // 移除数组标记（因为已经有值了）
            arrayKeys.delete(key);
        }
    }
    
    return result;
};

// 解析Unity YAML值
const parseUnityValue = (value) => {
    // 处理Unity引用格式 {fileID: 123}
    const fileIDMatch = value.match(/\{fileID:\s*(\d+)\}/);
    if (fileIDMatch) {
        return `{fileID: ${fileIDMatch[1]}}`;
    }
    
    // 处理向量格式 {x: 0, y: 0, z: 0, w: 1}
    const vectorMatch = value.match(/\{x:\s*([-\d.]+),\s*y:\s*([-\d.]+)(?:,\s*z:\s*([-\d.]+))?(?:,\s*w:\s*([-\d.]+))?\}/);
    if (vectorMatch) {
        return value; // 保持原样
    }
    
    // 移除引号
    if ((value.startsWith('"') && value.endsWith('"')) || 
        (value.startsWith("'") && value.endsWith("'"))) {
        value = value.slice(1, -1);
    }
    
    // 尝试转换为数字或布尔值
    if (value === 'true') {
        return true;
    } else if (value === 'false') {
        return false;
    } else if (value === 'null' || value === '~') {
        return null;
    } else if (/^-?\d+$/.test(value)) {
        return parseInt(value, 10);
    } else if (/^-?\d+\.\d+$/.test(value)) {
        return parseFloat(value);
    }
    
    return value;
};

// 简单的YAML解析器（支持YAML 1.1基本格式）
const parseYAML = (yamlContent) => {
    const lines = yamlContent.split('\n');
    const result = {};
    const stack = [{ obj: result, indent: -1, isArray: false }];
    
    for (let i = 0; i < lines.length; i++) {
        const line = lines[i];
        const trimmed = line.trim();
        
        // 跳过空行和注释
        if (!trimmed || trimmed.startsWith('#')) {
            continue;
        }
        
        // 计算缩进
        const indent = line.match(/^(\s*)/)[1].length;
        
        // 移除栈中缩进小于等于当前行的项
        while (stack.length > 1 && stack[stack.length - 1].indent >= indent) {
            stack.pop();
        }
        
        const current = stack[stack.length - 1];
        
        // 解析键值对
        const colonIndex = trimmed.indexOf(':');
        if (colonIndex === -1) {
            // 没有冒号，可能是列表项
            const listMatch = trimmed.match(/^-\s*(.+)$/);
            if (listMatch) {
                let value = listMatch[1].trim();
                
                // 移除引号
                if ((value.startsWith('"') && value.endsWith('"')) || 
                    (value.startsWith("'") && value.endsWith("'"))) {
                    value = value.slice(1, -1);
                }
                
                // 尝试转换为数字或布尔值
                let parsedValue = value;
                if (value === 'true') {
                    parsedValue = true;
                } else if (value === 'false') {
                    parsedValue = false;
                } else if (value === 'null' || value === '~') {
                    parsedValue = null;
                } else if (/^-?\d+$/.test(value)) {
                    parsedValue = parseInt(value, 10);
                } else if (/^-?\d+\.\d+$/.test(value)) {
                    parsedValue = parseFloat(value);
                }
                
                // 如果当前对象不是数组，转换为数组
                if (!Array.isArray(current.obj)) {
                    const keys = Object.keys(current.obj);
                    const newArray = keys.length > 0 ? keys.map(k => current.obj[k]) : [];
                    Object.keys(current.obj).forEach(k => delete current.obj[k]);
                    current.obj = newArray;
                    current.isArray = true;
                }
                
                current.obj.push(parsedValue);
            }
            continue;
        }
        
        const key = trimmed.substring(0, colonIndex).trim();
        let value = trimmed.substring(colonIndex + 1).trim();
        
        // 处理值
        if (!value) {
            // 空值，可能是嵌套对象
            const newObj = {};
            current.obj[key] = newObj;
            stack.push({ obj: newObj, indent, isArray: false });
        } else {
            // 有值
            // 移除引号
            if ((value.startsWith('"') && value.endsWith('"')) || 
                (value.startsWith("'") && value.endsWith("'"))) {
                value = value.slice(1, -1);
            }
            
            // 尝试转换为数字或布尔值
            let parsedValue = value;
            if (value === 'true') {
                parsedValue = true;
            } else if (value === 'false') {
                parsedValue = false;
            } else if (value === 'null' || value === '~') {
                parsedValue = null;
            } else if (/^-?\d+$/.test(value)) {
                parsedValue = parseInt(value, 10);
            } else if (/^-?\d+\.\d+$/.test(value)) {
                parsedValue = parseFloat(value);
            }
            
            current.obj[key] = parsedValue;
        }
    }
    
    return result;
};

// 导入YAML文件
export const importYAML = async (content, editor) => {
    try {
        let yamlData;
        
        // 检测是否为Unity YAML格式
        if (isUnityYAML(content)) {
            // 使用Unity YAML解析器
            yamlData = parseUnityYAML(content);
        } else {
            // 使用通用YAML解析器
            yamlData = parseYAML(content);
        }
        
        // 使用与JSON相同的转换逻辑
        await importJSON(yamlData, editor);
    } catch (error) {
        if (error.message !== '导入已取消') {
            await AlertDialog('YAML导入失败: ' + error.message);
        }
        throw error;
    }
};

// 处理JSON文件选择
export const handleJSONFileSelect = async (e, editor) => {
    const file = e.target.files[0];
    if (!file) return;
    
    const reader = new FileReader();
    reader.onload = async (event) => {
        try {
            const content = event.target.result;
            await importJSON(content, editor);
        } catch (error) {
            await AlertDialog('导入失败: ' + error.message);
        }
    };
    
    if (file.name.endsWith('.json')) {
        reader.readAsText(file);
    } else {
        await AlertDialog('请选择JSON文件 (.json)');
    }
    
    // 重置文件输入
    e.target.value = '';
};

// 处理YAML文件选择
export const handleYAMLFileSelect = async (e, editor) => {
    const file = e.target.files[0];
    if (!file) return;
    
    const reader = new FileReader();
    reader.onload = async (event) => {
        try {
            const content = event.target.result;
            await importYAML(content, editor);
        } catch (error) {
            await AlertDialog('导入失败: ' + error.message);
        }
    };
    
    if (file.name.endsWith('.yaml') || file.name.endsWith('.yml')) {
        reader.readAsText(file);
    } else {
        await AlertDialog('请选择YAML文件 (.yaml 或 .yml)');
    }
    
    // 重置文件输入
    e.target.value = '';
};