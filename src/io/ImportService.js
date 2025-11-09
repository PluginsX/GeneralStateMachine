// ImportService.js - 导入服务模块
// 负责处理各种格式的导入功能，包括Markdown和项目文件
import Condition from '../core/condition.js';
import Connection from '../core/connection.js';
import Node from '../core/node.js';
import { PopUp_Window } from '../utils/popup.js';

export default class ImportService {
    constructor() {
        this.nodeIdMap = new Map(); // 用于存储旧ID到新ID的映射
    }

    /**
     * 从文件导入项目
     * @param {File} file - 要导入的文件对象
     * @returns {Promise<Object>} - 导入的项目数据
     */
    async importFromFile(file) {
        return new Promise((resolve, reject) => {
            const reader = new FileReader();
            
            reader.onload = async (e) => {
                try {
                    const content = e.target.result;
                    const extension = this.getFileExtension(file.name).toLowerCase();
                    
                    let projectData;
                    switch (extension) {
                        case 'json':
                            projectData = await this.importFromJSON(content);
                            break;
                        case 'md':
                        case 'markdown':
                            projectData = await this.importFromMarkdown(content);
                            break;
                        default:
                            throw new Error(`不支持的文件格式: ${extension}`);
                    }
                    
                    resolve(projectData);
                } catch (error) {
                    reject(error);
                }
            };
            
            reader.onerror = () => {
                reject(new Error('文件读取失败'));
            };
            
            if (file.type === 'application/json' || file.name.endsWith('.json')) {
                reader.readAsText(file);
            } else if (file.type.includes('markdown') || file.name.endsWith('.md')) {
                reader.readAsText(file);
            } else {
                reject(new Error('不支持的文件类型'));
            }
        });
    }

    /**
     * 检测JSON数据的格式类型
     * @param {Object} data - 解析后的JSON对象
     * @returns {string} - 格式类型标识：'editor-project', 'unity-animator', 或 'generic'
     */
    detectJSONFormat(data) {
        console.log('开始检测JSON格式类型');
        
        // 验证数据类型
        if (!data || typeof data !== 'object') {
            console.warn('警告：无效的JSON对象，将按普通格式处理');
            return 'generic';
        }
        
        // 检查是否为编辑器标准工程文件格式
        if (data.type === 'node-graph-editor-project') {
            if (data.nodes && Array.isArray(data.nodes)) {
                console.log('确认格式：编辑器标准工程文件');
                return 'editor-project';
            } else {
                console.warn('警告：type为node-graph-editor-project，但缺少有效的nodes数组');
            }
        }
        
        // 检查是否为Unity动画状态机导出格式
        if (data.type === 'UnityAnimatorControllerExporter') {
            if (data.Nodes && Array.isArray(data.Nodes) && 
                data.Transitions && Array.isArray(data.Transitions)) {
                console.log('确认格式：Unity动画状态机导出格式');
                return 'unity-animator';
            } else {
                console.warn('警告：type为UnityAnimatorControllerExporter，但缺少必要的Nodes或Transitions数组');
            }
        }
        
        // 向后兼容：仅通过Nodes和Transitions字段判断Unity格式
        if (!data.type && 
            data.Nodes && Array.isArray(data.Nodes) && 
            data.Transitions && Array.isArray(data.Transitions)) {
            console.log('确认格式：Unity动画状态机导出格式（向后兼容模式）');
            return 'unity-animator';
        }
        
        // 有type字段但不匹配任何已知类型
        if (data.type) {
            console.log(`警告：未知的type值: ${data.type}，将按普通格式处理`);
        }
        
        console.log('格式检测结果：generic（普通JSON格式）');
        return 'generic';
    }
    
    /**
     * 从编辑器标准工程格式导入
     * @param {Object} data - 编辑器标准格式的JSON数据
     * @returns {Object} - 标准化的项目数据
     */
    importFromEditorProject(data) {
        console.log('开始从编辑器标准工程文件导入');
        
        try {
            // 验证必需字段
            if (!data.nodes || !Array.isArray(data.nodes)) {
                console.error('错误：JSON格式错误，缺少必要的nodes数组');
                throw new Error('错误：JSON格式错误，缺少必要的nodes数组');
            }
            
            // 记录版本信息（如果有）
            if (data.version) {
                console.log(`项目版本: ${data.version}`);
            }
            
            // 验证节点数组内容
            if (data.nodes.length === 0) {
                console.warn('警告：导入的节点数组为空');
            }
            
            // 预先验证所有节点格式
            data.nodes.forEach((node, index) => {
                if (!node || typeof node !== 'object') {
                    console.error(`错误：节点索引${index}不是有效的对象`);
                    throw new Error(`错误：节点索引${index}不是有效的对象`);
                }
                if (node.name === undefined && node.name !== '') {
                    console.error(`错误：节点索引${index}缺少name属性`);
                    throw new Error(`错误：节点索引${index}缺少name属性`);
                }
            });
            
            // 验证连接数组（如果存在）
            if (data.connections && !Array.isArray(data.connections)) {
                console.error('错误：connections字段必须是数组');
                throw new Error('错误：connections字段必须是数组');
            }
            
            // 生成新的唯一ID并创建映射
            this.nodeIdMap.clear();
            console.log(`开始处理 ${data.nodes.length} 个节点`);
            
            // 处理节点，添加单个节点错误处理
            const nodes = data.nodes.map((node, index) => {
                try {
                    const normalizedNode = this.normalizeNode(node);
                    console.log(`节点 ${index + 1} 处理成功: ${normalizedNode.name || normalizedNode.id}`);
                    return normalizedNode;
                } catch (nodeError) {
                    console.error(`处理节点 ${index + 1} 失败:`, nodeError);
                    // 为失败的节点创建一个替代节点，避免整个导入失败
                    return this.createNode(`错误节点 (${index + 1})`, nodeError.message, 100 + index * 50, 100);
                }
            });
            
            // 处理连接，添加错误处理
            let connections = [];
            if (data.connections) {
                console.log(`开始处理 ${data.connections.length} 个连接`);
                try {
                    connections = this.normalizeConnections(data.connections, nodes);
                    console.log(`连接处理完成，成功导入 ${connections.length} 个连接`);
                } catch (connError) {
                    console.error('连接处理失败:', connError);
                    console.warn('将继续导入，忽略连接数据');
                    connections = [];
                }
            }
            
            const result = {
                version: data.version || '1.0',
                nodes: nodes,
                connections: connections,
                viewState: this.normalizeViewState(data.viewState)
            };
            
            console.log(`成功导入编辑器项目：${nodes.length}个节点，${connections.length}个连接`);
            
            // 验证最终结果
            const validation = this.validateImportData(result);
            if (!validation.valid) {
                console.warn('导入数据存在验证问题:', validation.errors);
            }
            
            return result;
        } catch (error) {
            console.error('编辑器项目导入过程中发生错误:', error);
            throw new Error(`编辑器项目导入失败：${error.message}`);
        }
    }
    
    /**
     * 从普通JSON格式导入（树形结构）
     * 将JSON的树形结构转换为节点和连接
     * @param {Object} data - 普通JSON数据
     * @returns {Object} - 标准化的项目数据
     */
    importFromGenericJSON(data) {
        console.log('开始处理普通JSON格式（树形结构）');
        
        try {
            // 验证数据类型
            if (!data || typeof data !== 'object') {
                console.error('错误：输入不是有效的JSON对象');
                throw new Error('错误：输入不是有效的JSON对象');
            }
            
            // 重置ID映射
            this.nodeIdMap.clear();
            
            // 创建节点数组和连接数组
            const nodes = [];
            const connections = [];
            
            console.log('开始递归处理JSON树形结构...');
            
            // 递归处理JSON树形结构
            this._processJSONTree(data, null, nodes, connections);
            
            // 如果处理后没有节点，尝试将整个数据作为单个根节点
            if (nodes.length === 0) {
                const rootNode = this.createNode('Root', JSON.stringify(data).substring(0, 100) + '...', 200, 200);
                nodes.push(rootNode);
                console.log('创建了单个根节点');
            }
            
            console.log(`树形结构处理完成，共导入 ${nodes.length} 个节点和 ${connections.length} 个连接`);
            
            return {
                version: '1.0',
                nodes: nodes,
                connections: connections,
                viewState: this.getDefaultViewState(),
                formatType: 'generic'
            };
        } catch (error) {
            console.error('普通JSON导入过程中发生错误:', error);
            throw new Error(`普通JSON导入失败：${error.message}`);
        } finally {
            console.log('普通JSON导入操作完成');
        }
    }
    
    /**
     * 递归处理JSON树形结构
     * @param {any} value - 当前处理的值
     * @param {string|null} parentId - 父节点ID
     * @param {Array} nodes - 节点数组（输出参数）
     * @param {Array} connections - 连接数组（输出参数）
     * @param {string} path - 当前路径，用于生成节点名称
     * @param {number} [depth=0] - 当前深度（用于限制递归深度）
     */
    _processJSONTree(value, parentId, nodes, connections, path = 'root', depth = 0) {
        try {
            // 限制递归深度，防止栈溢出
            const MAX_DEPTH = 10;
            if (depth > MAX_DEPTH) {
                console.warn(`递归深度超过限制（${MAX_DEPTH}），跳过处理路径: ${path}`);
                return;
            }
            
            console.debug(`处理路径: ${path}, 深度: ${depth}, 数据类型: ${typeof value}`);
            
            // 跳过null和undefined
            if (value === null || value === undefined) {
                console.debug(`跳过null或undefined值: ${path}`);
                return;
            }
            
            // 处理对象类型
            if (typeof value === 'object' && !Array.isArray(value)) {
                try {
                    // 创建当前节点
                    const nodeName = path || 'Object';
                    const keyCount = Object.keys(value).length;
                    const nodeDescription = keyCount > 0 ? 
                        `Object with ${keyCount} properties` : 'Empty object';
                    
                    const node = this.createNode(nodeName, nodeDescription, 
                        100 + Math.random() * 400, 100 + Math.random() * 400);
                    nodes.push(node);
                    console.debug(`创建对象节点: ${nodeName} (${node.id}), 属性数量: ${keyCount}`);
                    
                    // 如果有父节点，创建连接
                    if (parentId) {
                        const connection = this.createConnection(parentId, node.id, '');
                        connections.push(connection);
                        console.debug(`创建连接: ${parentId} -> ${node.id}`);
                    }
                    
                    // 递归处理属性
                    Object.entries(value).forEach(([key, val]) => {
                        try {
                            this._processJSONTree(val, node.id, nodes, connections, `${path}.${key}`, depth + 1);
                        } catch (propError) {
                            console.error(`处理对象属性 ${path}.${key} 失败:`, propError);
                            // 记录错误但继续处理其他属性
                        }
                    });
                } catch (objError) {
                    console.error(`处理对象 ${path} 时发生错误:`, objError);
                    this._createErrorNode(path, objError.message, parentId, nodes, connections);
                }
            }
            // 处理数组类型
            else if (Array.isArray(value)) {
                try {
                    // 创建当前数组节点
                    const nodeName = path || 'Array';
                    const nodeDescription = `Array with ${value.length} items`;
                    
                    const node = this.createNode(nodeName, nodeDescription, 
                        100 + Math.random() * 400, 100 + Math.random() * 400);
                    nodes.push(node);
                    console.debug(`创建数组节点: ${nodeName} (${node.id}), 元素数量: ${value.length}`);
                    
                    // 如果有父节点，创建连接
                    if (parentId) {
                        const connection = this.createConnection(parentId, node.id, '');
                        connections.push(connection);
                        console.debug(`创建连接: ${parentId} -> ${node.id}`);
                    }
                    
                    // 递归处理数组元素（限制处理前10个元素以避免性能问题）
                    const maxItemsToProcess = 10;
                    const itemsToProcess = value.slice(0, maxItemsToProcess);
                    
                    itemsToProcess.forEach((item, index) => {
                        try {
                            this._processJSONTree(item, node.id, nodes, connections, `${path}[${index}]`, depth + 1);
                        } catch (itemError) {
                            console.error(`处理数组元素 ${path}[${index}] 失败:`, itemError);
                            // 记录错误但继续处理其他元素
                        }
                    });
                    
                    // 如果数组过长，提示用户
                    if (value.length > maxItemsToProcess) {
                        console.warn(`数组${path}长度为${value.length}，仅处理前${maxItemsToProcess}个元素`);
                    }
                } catch (arrayError) {
                    console.error(`处理数组 ${path} 时发生错误:`, arrayError);
                    this._createErrorNode(path, arrayError.message, parentId, nodes, connections);
                }
            }
            // 处理基本类型（创建叶节点）
            else {
                try {
                    const nodeName = path || 'Value';
                    const valueStr = String(value).substring(0, 50);
                    const nodeDescription = `${typeof value}: ${valueStr}`;
                    
                    const node = this.createNode(nodeName, nodeDescription, 
                        100 + Math.random() * 400, 100 + Math.random() * 400);
                    nodes.push(node);
                    console.debug(`创建基本类型节点: ${nodeName} (${node.id}), 值: ${valueStr}`);
                    
                    // 如果有父节点，创建连接
                    if (parentId) {
                        const connection = this.createConnection(parentId, node.id, '');
                        connections.push(connection);
                        console.debug(`创建连接: ${parentId} -> ${node.id}`);
                    }
                } catch (primitiveError) {
                    console.error(`处理基本类型 ${path} 时发生错误:`, primitiveError);
                    this._createErrorNode(path, primitiveError.message, parentId, nodes, connections);
                }
            }
        } catch (error) {
            console.error(`处理路径 ${path} 时发生未预期错误:`, error);
            // 尝试创建一个错误节点，以便用户知道哪里出错了
            try {
                this._createErrorNode(path, error.message, parentId, nodes, connections);
            } catch (nodeError) {
                console.error('无法创建错误节点:', nodeError);
            }
        }
    }
    
    /**
     * 创建错误节点
     * @private
     * @param {string} path - 错误发生的路径
     * @param {string} errorMsg - 错误消息
     * @param {string|null} parentId - 父节点ID
     * @param {Array} nodes - 节点数组
     * @param {Array} connections - 连接数组
     */
    _createErrorNode(path, errorMsg, parentId, nodes, connections) {
        const errorNode = this.createNode(
            `Error: ${path}`, 
            `处理失败: ${errorMsg}`, 
            100 + Math.random() * 400, 
            100 + Math.random() * 400
        );
        nodes.push(errorNode);
        console.debug(`创建错误节点: ${errorNode.name}`);
        
        if (parentId) {
            const errorConnection = this.createConnection(parentId, errorNode.id, 'error');
            connections.push(errorConnection);
            console.debug(`创建错误连接: ${parentId} -> ${errorNode.id}`);
        }
    }
    
    /**
     * 从JSON导入项目
     * @param {string|Object} jsonData - JSON字符串或对象
     * @returns {Object} - 标准化的项目数据
     * @throws {Error} - 当导入失败时抛出错误
     */
    async importFromJSON(jsonData) {
        console.log('开始导入JSON数据');
        
        // 参数验证
        if (jsonData === undefined || jsonData === null) {
            console.error('错误：JSON数据不能为空');
            throw new Error('错误：JSON数据不能为空');
        }
        
        try {
            // 尝试解析JSON（如果是字符串）
            let data;
            if (typeof jsonData === 'string') {
                console.log(`处理JSON字符串，长度: ${jsonData.length}`);
                try {
                    data = JSON.parse(jsonData);
                    console.log('JSON解析成功');
                } catch (parseError) {
                    console.error('JSON解析失败:', parseError);
                    throw new Error(`错误：JSON格式无效，请检查语法。详细错误：${parseError.message}`);
                }
            } else if (typeof jsonData === 'object') {
                console.log('处理JSON对象');
                data = jsonData;
            } else {
                console.error(`错误：输入类型无效，预期为string或object，实际为${typeof jsonData}`);
                throw new Error('错误：输入必须是字符串格式的JSON或对象');
            }
            
            // 检测JSON格式类型
            const formatType = this.detectJSONFormat(data);
            console.log(`检测到JSON格式类型: ${formatType}`);
            
            // 获取格式名称用于显示
            let formatName;
            switch (formatType) {
                case 'editor-project':
                    formatName = '编辑器标准工程文件';
                    break;
                case 'unity-animator':
                    formatName = 'Unity动画状态机导出格式';
                    break;
                default:
                    formatName = '普通JSON格式';
            }
            
            // 显示弹窗提示用户并获取确认
            const confirmImport = await PopUp_Window(
                'JSON导入信息',
                `检测到该json文件为：${formatName}`,
                '导入',
                '取消'
            );
            
            // 如果用户取消导入，抛出错误中断操作
            if (!confirmImport) {
                console.log('用户取消了JSON导入');
                throw new Error('导入已取消');
            }
            
            // 根据格式类型选择对应的导入策略
            switch (formatType) {
                case 'editor-project':
                    return this.importFromEditorProject(data);
                case 'unity-animator':
                    return this.importFromStateMachineJSON(data);
                default:
                    return this.importFromGenericJSON(data);
            }
        } catch (error) {
            console.error('导入JSON失败:', error);
            throw error;
        } finally {
            console.log('JSON导入操作完成');
        }
    }
    
    /**
     * 从Unity动画状态机格式JSON导入项目
     * @param {Object} data - Unity动画状态机格式的JSON数据
     * @returns {Object} - 标准化的项目数据
     */
    importFromStateMachineJSON(data) {
        console.log('开始从Unity动画状态机格式导入');
        
        try {
            // 验证数据对象
            if (!data || typeof data !== 'object') {
                console.error('无效的数据对象');
                throw new Error('无效的数据对象');
            }
            
            // 记录格式信息
            const version = data.version || '1.0';
            const formatType = data.type || 'UnityAnimatorControllerExporter';
            console.log(`导入Unity动画状态机数据，版本: ${version}, 类型: ${formatType}`);
            
            // 验证必需字段
            if (!data.Nodes || !Array.isArray(data.Nodes)) {
                console.error('无效的Unity动画状态机数据: 缺少Nodes数组');
                throw new Error('无效的Unity动画状态机数据: 缺少Nodes数组');
            }
            
            if (!data.Transitions || !Array.isArray(data.Transitions)) {
                console.error('无效的Unity动画状态机数据: 缺少Transitions数组');
                throw new Error('无效的Unity动画状态机数据: 缺少Transitions数组');
            }
            
            console.log(`检测到 ${data.Nodes.length} 个状态节点和 ${data.Transitions.length} 个过渡连接`);
            
            // 验证节点格式（现在支持对象格式，从Name字段获取名称）
            try {
                data.Nodes.forEach((node, index) => {
                    let nodeName;
                    if (typeof node === 'string') {
                        // 兼容旧格式：纯字符串节点
                        nodeName = node;
                    } else if (typeof node === 'object' && node !== null) {
                        // 新格式：对象节点，从Name字段获取名称
                        if (!node.Name || typeof node.Name !== 'string') {
                            throw new Error(`索引${index}处的节点对象缺少有效的Name字段`);
                        }
                        nodeName = node.Name;
                    } else {
                        throw new Error(`索引${index}处的节点格式无效，应为字符串或对象`);
                    }
                    
                    if (nodeName.trim() === '') {
                        throw new Error(`索引${index}处的节点名称为空`);
                    }
                });
                console.log('节点格式验证通过');
            } catch (nodeError) {
                console.error('节点验证失败:', nodeError);
                throw new Error(`节点验证失败: ${nodeError.message}`);
            }
            
            // 验证转换数据
            try {
                data.Transitions.forEach((transition, index) => {
                    if (!transition || typeof transition !== 'object') {
                        throw new Error(`索引${index}处的转换对象无效`);
                    }
                    
                    if (!transition.From || typeof transition.From !== 'string') {
                        throw new Error(`索引${index}处的转换缺少有效的From字段`);
                    }
                    
                    if (!transition.To || typeof transition.To !== 'string') {
                        throw new Error(`索引${index}处的转换缺少有效的To字段`);
                    }
                    
                    // 验证条件格式（如果存在）
                    if (transition.Conditions) {
                        if (!Array.isArray(transition.Conditions)) {
                            throw new Error(`索引${index}处的Conditions必须是数组`);
                        }
                        
                        transition.Conditions.forEach((cond, condIndex) => {
                            if (!cond || typeof cond !== 'object') {
                                throw new Error(`转换${index}的条件${condIndex}无效`);
                            }
                            
                            if (!cond.Parameter || typeof cond.Parameter !== 'string') {
                                throw new Error(`转换${index}的条件${condIndex}缺少有效的Parameter字段`);
                            }
                            
                            if (!cond.Type || typeof cond.Type !== 'string') {
                                throw new Error(`转换${index}的条件${condIndex}缺少有效的Type字段`);
                            }
                            
                            // 对于非Trigger类型，需要Compare和Value
                            if (cond.Type !== 'Trigger') {
                                if (!cond.Compare || typeof cond.Compare !== 'string') {
                                    throw new Error(`非Trigger类型的条件${condIndex}缺少有效的Compare字段`);
                                }
                                
                                if (cond.Value === undefined) {
                                    throw new Error(`非Trigger类型的条件${condIndex}缺少有效的Value字段`);
                                }
                            }
                        });
                    }
                });
                console.log('转换数据验证通过');
            } catch (transitionError) {
                console.error('转换数据验证失败:', transitionError);
                throw new Error(`转换验证失败: ${transitionError.message}`);
            }
            
            // 生成新的唯一ID并创建映射
            this.nodeIdMap.clear();
            console.log('开始创建节点并自动布局...');
            
            // 创建节点并自动布局
            const nodes = this.createNodesFromStateMachine(data.Nodes);
            console.log(`成功创建 ${nodes.length} 个节点`);
            
            // 创建连线，包括条件解析
            console.log('开始创建连线，包括条件解析...');
            const connections = this.createConnectionsFromTransitions(data.Transitions, nodes);
            console.log(`成功创建 ${connections.length} 个连线`);
            
            console.log('Unity动画状态机数据导入成功');
            
            return {
                version: version,
                formatType: formatType,
                nodes: nodes,
                connections: connections,
                viewState: this.getDefaultViewState()
            };
        } catch (error) {
            console.error('导入状态机JSON失败:', error);
            throw new Error(`Unity动画状态机导入失败: ${error.message}`);
        } finally {
            console.log('Unity动画状态机导入操作完成');
        }
    }

    /**
     * 从Markdown导入项目
     * @param {string} markdown - Markdown文本
     * @returns {Object} - 项目数据
     */
    importFromMarkdown(markdown) {
        try {
            const nodes = [];
            const connections = [];
            
            // 重置ID映射
            this.nodeIdMap.clear();
            
            // 解析Markdown中的节点
            const nodeMatches = markdown.match(/-\s*\*\*(.+?)\*\*(\s*:\s*(.+?))?/g) || [];
            
            let x = 100;
            let y = 100;
            let rowCount = 0;
            
            // 创建节点
            nodeMatches.forEach((match, index) => {
                const nodeInfo = match.match(/-\s*\*\*(.+?)\*\*(\s*:\s*(.+?))?/);
                if (nodeInfo) {
                    const name = nodeInfo[1].trim();
                    const description = (nodeInfo[3] || '').trim();
                    
                    const node = this.createNode(name, description, x, y);
                    nodes.push(node);
                    
                    // 节点布局：每行放置3个节点
                    rowCount++;
                    if (rowCount % 3 === 0) {
                        x = 100;
                        y += 150;
                    } else {
                        x += 250;
                    }
                }
            });
            
            // 解析Markdown中的连线
            const connectionMatches = markdown.match(/-\s*(.+?)\s*->\s*(.+?)(\s*\((.+?)\))?/g) || [];
            
            connectionMatches.forEach(match => {
                const connInfo = match.match(/-\s*(.+?)\s*->\s*(.+?)(\s*\((.+?)\))?/);
                if (connInfo) {
                    const sourceName = connInfo[1].trim();
                    const targetName = connInfo[2].trim();
                    const condition = (connInfo[4] || '').trim();
                    
                    // 查找源节点和目标节点
                    const sourceNode = nodes.find(node => node.name === sourceName);
                    const targetNode = nodes.find(node => node.name === targetName);
                    
                    if (sourceNode && targetNode) {
                        const connection = this.createConnection(sourceNode.id, targetNode.id, condition);
                        connections.push(connection);
                    }
                }
            });
            
            return {
                version: '1.0',
                nodes: nodes,
                connections: connections,
                viewState: this.getDefaultViewState()
            };
        } catch (error) {
            throw new Error(`Markdown导入失败: ${error.message}`);
        }
    }

    /**
     * 从剪贴板导入数据
     * @returns {Promise<Object|null>} - 导入的项目数据或null
     */
    async importFromClipboard() {
        try {
            if (!navigator.clipboard) {
                throw new Error('当前浏览器不支持剪贴板API');
            }
            
            const text = await navigator.clipboard.readText();
            
            // 尝试作为JSON解析
            try {
                return this.importFromJSON(text);
            } catch (jsonError) {
                // 尝试作为Markdown解析
                try {
                    return this.importFromMarkdown(text);
                } catch (markdownError) {
                    throw new Error('剪贴板内容不是有效的JSON或Markdown');
                }
            }
        } catch (error) {
            throw new Error(`剪贴板导入失败: ${error.message}`);
        }
    }

    /**
     * 标准化节点数据
     * @param {Object} node - 原始节点数据
     * @returns {Object} - 标准化的节点数据
     * @throws {Error} - 当节点数据无效时抛出错误
     */
    normalizeNode(node) {
        console.debug('开始标准化节点数据');
        
        try {
            // 参数验证
            if (!node || typeof node !== 'object') {
                console.error('错误：无效的节点数据，必须是对象，收到:', typeof node);
                throw new Error('错误：无效的节点数据，必须是对象');
            }
            
            // 生成新的唯一ID
            const newId = this.generateUniqueId();
            console.debug(`生成节点ID: ${newId}`);
            
            // 保存ID映射
            if (node.id) {
                console.debug(`添加到ID映射: ${node.id} -> ${newId}`);
                this.nodeIdMap.set(node.id, newId);
            }
            
            // 验证必需字段 - 名称
            let nodeName;
            if (node.name === undefined || node.name === null) {
                console.warn('警告：节点缺少名称属性，将使用默认名称');
                nodeName = `未命名节点 ${newId.substring(0, 8)}`;
            } else {
                nodeName = String(node.name).trim();
                if (nodeName === '') {
                    console.warn('警告：节点名称为空字符串，将使用默认名称');
                    nodeName = `空节点 ${newId.substring(0, 8)}`;
                }
            }
            
            // 验证坐标和尺寸数据
            console.debug('验证节点坐标...');
            const x = this.validateNumber(node.x, 100, '节点X坐标');
            const y = this.validateNumber(node.y, 100, '节点Y坐标');
            const width = this.validateNumber(node.width, 120, '节点宽度', 50, 500);
            const height = this.validateNumber(node.height, 60, '节点高度', 20, 300);
            
            // 构建标准化的节点数据
            const normalizedNode = {
                id: newId,
                name: nodeName,
                description: node.description || '',
                x: x,
                y: y,
                width: width,
                height: height
            };
            
            console.debug(`节点标准化完成: ${nodeName} (${newId})`);
            return normalizedNode;
        } catch (error) {
            console.error('节点标准化失败:', error);
            throw new Error(`标准化节点时出错: ${error.message}`);
        }
    }
    
    /**
     * 验证数字值
     * @param {any} value - 要验证的值
     * @param {number} defaultValue - 默认值
     * @param {string} fieldName - 字段名称，用于错误消息
     * @param {number} min - 最小值（可选）
     * @param {number} max - 最大值（可选）
     * @returns {number} - 验证后的数字
     */
    validateNumber(value, defaultValue, fieldName, min, max) {
        // 如果值未定义，返回默认值
        if (value === undefined || value === null) {
            return defaultValue;
        }
        
        // 转换为数字
        const num = Number(value);
        
        // 检查是否为有效数字
        if (isNaN(num)) {
            console.warn(`警告：${fieldName}不是有效数字，使用默认值${defaultValue}`);
            return defaultValue;
        }
        
        // 检查范围
        if (min !== undefined && num < min) {
            console.warn(`警告：${fieldName}(${num})小于最小值${min}，使用最小值`);
            return min;
        }
        
        if (max !== undefined && num > max) {
            console.warn(`警告：${fieldName}(${num})大于最大值${max}，使用最大值`);
            return max;
        }
        
        return num;
    }

    /**
     * 标准化连线数据
     * @param {Array} connections - 原始连线数组
     * @param {Array} nodes - 节点数组
     * @returns {Array} - 标准化的连线数组
     */
    normalizeConnections(connections, nodes) {
        console.debug('开始标准化连线数据');
        
        try {
            // 参数验证
            if (!Array.isArray(connections)) {
                console.error('错误：连接数组参数必须是数组类型，收到:', typeof connections);
                return [];
            }
            
            if (!Array.isArray(nodes)) {
                console.error('错误：节点数组参数必须是数组类型，收到:', typeof nodes);
                return [];
            }
            
            // 创建节点ID到节点对象的映射，方便查找
            const nodeMap = new Map();
            nodes.forEach(node => {
                nodeMap.set(node.id, node);
            });
            console.debug(`创建了 ${nodeMap.size} 个节点的ID映射`);
            
            const validConnections = [];
            const invalidConnectionsCount = {
                missingSource: 0,
                missingTarget: 0,
                selfLoop: 0,
                invalidData: 0
            };
            
            console.debug(`开始处理 ${connections.length} 个连接`);
            
            // 过滤并标准化连接
            connections.forEach((conn, index) => {
                try {
                    if (!conn || typeof conn !== 'object') {
                        console.warn(`警告：索引${index}处的连接数据无效，跳过`);
                        invalidConnectionsCount.invalidData++;
                        return;
                    }
                    
                    // 获取新的源节点和目标节点ID
                    const sourceId = this.nodeIdMap.get(conn.sourceId) || this.findNodeIdByName(conn.sourceName, nodes);
                    const targetId = this.nodeIdMap.get(conn.targetId) || this.findNodeIdByName(conn.targetName, nodes);
                    
                    console.debug(`处理连接 ${index}: 源节点ID=${sourceId}, 目标节点ID=${targetId}`);
                    
                    // 检查源节点和目标节点是否存在
                    const sourceNode = nodeMap.get(sourceId);
                    const targetNode = nodeMap.get(targetId);
                    
                    if (!sourceId || !sourceNode) {
                        console.warn(`警告：连接${index}的源节点不存在或ID无效，跳过`);
                        invalidConnectionsCount.missingSource++;
                        return;
                    }
                    
                    if (!targetId || !targetNode) {
                        console.warn(`警告：连接${index}的目标节点不存在或ID无效，跳过`);
                        invalidConnectionsCount.missingTarget++;
                        return;
                    }
                    
                    // 检查是否是自环连接
                    if (sourceId === targetId) {
                        console.warn(`警告：连接${index}是自环连接，已跳过`);
                        invalidConnectionsCount.selfLoop++;
                        return;
                    }
                    
                    // 创建Connection类实例
                    const connectionId = this.generateUniqueId();
                    const newConnection = new Connection(sourceId, targetId);
                    newConnection.id = connectionId;
                    
                    // 处理条件
                    if (conn.conditions && Array.isArray(conn.conditions)) {
                        // 如果有conditions数组，使用parseConditions方法处理
                        newConnection.conditions = this.parseConditions(conn.conditions);
                    } else if (conn.condition) {
                        // 兼容旧格式的单个condition字符串
                        newConnection.condition = conn.condition;
                    }
                    
                    validConnections.push(newConnection);
                    console.debug(`连接 ${index} 处理成功: ${sourceNode.name} -> ${targetNode.name}`);
                    
                } catch (error) {
                    console.error(`错误：处理连接${index}时发生异常：`, error);
                    invalidConnectionsCount.invalidData++;
                }
            });
            
            // 输出详细统计信息
            const totalInvalid = Object.values(invalidConnectionsCount).reduce((sum, count) => sum + count, 0);
            if (totalInvalid > 0) {
                console.warn(`导入连接统计：成功${validConnections.length}个，失败${totalInvalid}个，总处理${connections.length}个`);
                console.warn('失败详情：', invalidConnectionsCount);
            } else {
                console.debug(`所有 ${connections.length} 个连接都成功处理`);
            }
            
            console.debug(`连接标准化完成，有效连接: ${validConnections.length}`);
            return validConnections;
        } catch (error) {
            console.error('连线标准化过程中发生错误:', error);
            throw new Error(`标准化连线时出错: ${error.message}`);
        }
    }

    /**
     * 标准化视图状态
     * @param {Object} viewState - 原始视图状态
     * @returns {Object} - 标准化的视图状态
     */
    normalizeViewState(viewState = {}) {
        return {
            zoom: viewState.zoom || 1,
            panX: viewState.panX || 0,
            panY: viewState.panY || 0
        };
    }

    /**
     * 创建节点
     * @param {string} name - 节点名称
     * @param {string} description - 节点描述
     * @param {number} x - X坐标
     * @param {number} y - Y坐标
     * @returns {Object} - 节点对象
     */
    createNode(name, description, x, y) {
        // 创建Node类的实例
        const node = new Node(name || '未命名节点', x || 100, y || 100);
        node.description = description || '';
        node.width = 120;
        node.height = 60;
        
        return node;
    }

    /**
     * 创建连线
     * @param {string} sourceId - 源节点ID
     * @param {string} targetId - 目标节点ID
     * @param {string} condition - 连线条件
     * @returns {Object} - 连线对象
     */
    createConnection(sourceId, targetId, condition) {
        // 创建Connection类的实例
        const connection = new Connection(sourceId, targetId);
        
        // 如果提供了条件，解析并添加到conditions数组
        if (condition) {
            // 如果condition已经是数组，直接使用；否则创建一个包含单个条件的数组
            const conditionObjects = Array.isArray(condition) ? 
                condition.map(cond => {
                    if (typeof cond === 'string') {
                        // 对于字符串条件，创建新的Condition实例
                        const c = new Condition();
                        c.description = cond;
                        return c;
                    }
                    return cond;
                }) : 
                [condition];
            connection.conditions = conditionObjects;
        }
        
        return connection;
    }

    /**
     * 根据节点名称查找节点ID
     * @param {string} name - 节点名称
     * @param {Array} nodes - 节点数组
     * @returns {string|null} - 节点ID或null
     */
    findNodeIdByName(name, nodes) {
        if (!name) return null;
        
        const node = nodes.find(n => n.name === name);
        return node ? node.id : null;
    }

    /**
     * 生成唯一ID
     * @returns {string} - 唯一ID
     */
    generateUniqueId() {
        return Date.now().toString(36) + Math.random().toString(36).substr(2);
    }

    /**
     * 获取文件扩展名
     * @param {string} filename - 文件名
     * @returns {string} - 文件扩展名
     */
    getFileExtension(filename) {
        const parts = filename.split('.');
        return parts.length > 1 ? parts[parts.length - 1] : '';
    }

    /**
     * 从状态机格式创建节点数组
     * @param {Array} nodeNames - 节点名称数组
     * @returns {Array} - 节点对象数组
     */
    createNodesFromStateMachine(nodeDataList) {
        const nodes = [];
        const nodeNameMap = new Map(); // 名称到节点对象的映射
        
        // 自动布局配置
        const startX = 200;
        const startY = 150;
        const horizontalSpacing = 250;
        const verticalSpacing = 150;
        const nodesPerRow = 3;
        
        nodeDataList.forEach((nodeData, index) => {
            const row = Math.floor(index / nodesPerRow);
            const col = index % nodesPerRow;
            
            // 计算节点位置
            const x = startX + col * horizontalSpacing;
            const y = startY + row * verticalSpacing;
            
            // 从节点数据中提取名称
            let nodeName, nodeColor;
            if (typeof nodeData === 'string') {
                // 兼容旧格式：纯字符串节点
                nodeName = nodeData;
            } else if (typeof nodeData === 'object' && nodeData !== null) {
                // 新格式：对象节点
                nodeName = nodeData.Name || 'Unknown';
                nodeColor = nodeData.color; // 提取颜色信息
            } else {
                nodeName = 'Invalid Node';
            }
            
            // 创建节点
            const node = new Node(nodeName, x, y);
            node.description = '';
            node.width = 150;
            node.height = 50;
            
            // 应用节点颜色（如果有）
            if (nodeColor && typeof nodeColor === 'string' && nodeColor.startsWith('#')) {
                node.color = nodeColor;
            }
            
            nodes.push(node);
            nodeNameMap.set(nodeName, node);
        });
        
        // 保存节点名称到ID的映射
        this.nodeNameToIdMap = nodeNameMap;
        
        return nodes;
    }
    
    /**
     * 从Transitions创建连线数组
     * @param {Array} transitions - 转换数组
     * @param {Array} nodes - 节点数组
     * @returns {Array} - 连线对象数组
     */
    createConnectionsFromTransitions(transitions, nodes) {
        const connections = [];
        
        transitions.forEach(transition => {
            // 查找源节点和目标节点
            const sourceNode = this.findNodeByName(transition.From, nodes);
            const targetNode = this.findNodeByName(transition.To, nodes);
            
            if (!sourceNode || !targetNode) {
                console.warn(`跳过无效的转换: ${transition.From} -> ${transition.To}, 找不到源节点或目标节点`);
                return;
            }
            
            // 创建Connection类的实例
            const connection = new Connection(sourceNode.id, targetNode.id);
            
            // 设置额外属性
            connection.name = transition.Name || '';
            connection.fromSide = 'right';
            connection.toSide = 'left';
            connection.defaultConnection = false;
            connection.lineType = 'solid';
            
            // 解析条件
            if (transition.Conditions && Array.isArray(transition.Conditions)) {
                connection.conditions = this.parseConditions(transition.Conditions);
            }
            
            connections.push(connection);
        });
        
        return connections;
    }
    
    /**
     * 解析条件数组
     * @param {Array} conditions - 原始条件数组
     * @returns {Array} - Condition对象数组
     */
    parseConditions(conditions) {
        return conditions.map(cond => {
            // 映射比较操作符
            const operatorMap = {
                'Greater': '>',
                'Less': '<',
                'Equal': '==',
                'NotEqual': '!='
            };
            
            // 创建条件对象
            const condition = new Condition(
                cond.Type || 'Float',
                cond.Parameter || '',
                operatorMap[cond.Compare] || '==',
                cond.Value !== undefined ? cond.Value.toString() : ''
            );
            
            // 特殊处理Trigger类型
            if (cond.Type === 'Trigger') {
                condition.operator = '==';
                condition.value = 'true';
            }
            
            return condition;
        });
    }
    
    /**
     * 根据节点名称查找节点
     * @param {string} name - 节点名称
     * @param {Array} nodes - 节点数组
     * @returns {Object|null} - 节点对象或null
     */
    findNodeByName(name, nodes) {
        if (!name) return null;
        return nodes.find(node => node.name === name) || null;
    }
    
    /**
     * 获取默认视图状态
     * @returns {Object} - 默认视图状态
     */
    getDefaultViewState() {
        return {
            zoom: 1,
            panX: 0,
            panY: 0
        };
    }

    /**
     * 验证导入的数据
     * @param {Object} data - 导入的数据
     * @returns {Object} - 验证结果 {valid: boolean, errors: Array}
     */
    validateImportData(data) {
        const errors = [];
        
        // 验证节点
        if (!data.nodes || !Array.isArray(data.nodes)) {
            errors.push('缺少有效的nodes数组');
        } else {
            // 检查是否有重复的节点名称
            const nodeNames = new Set();
            data.nodes.forEach((node, index) => {
                if (!node.name) {
                    errors.push(`节点 ${index + 1} 缺少名称`);
                } else if (nodeNames.has(node.name)) {
                    errors.push(`发现重复的节点名称: ${node.name}`);
                } else {
                    nodeNames.add(node.name);
                }
            });
        }
        
        // 验证连线
        if (data.connections && Array.isArray(data.connections)) {
            data.connections.forEach((conn, index) => {
                if (!conn.sourceId || !conn.targetId) {
                    errors.push(`连线 ${index + 1} 缺少有效的源节点或目标节点ID`);
                }
            });
        }
        
        return {
            valid: errors.length === 0,
            errors: errors
        };
    }
}