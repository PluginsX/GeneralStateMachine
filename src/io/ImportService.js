// ImportService.js - 导入服务模块
// 负责处理各种格式的导入功能，包括Markdown和项目文件

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
     * 从JSON导入项目
     * @param {string|Object} jsonData - JSON字符串或对象
     * @returns {Object} - 标准化的项目数据
     */
    importFromJSON(jsonData) {
        try {
            const data = typeof jsonData === 'string' ? JSON.parse(jsonData) : jsonData;
            
            // 验证必需字段
            if (!data.nodes || !Array.isArray(data.nodes)) {
                throw new Error('无效的项目数据: 缺少nodes数组');
            }
            
            // 生成新的唯一ID并创建映射
            this.nodeIdMap.clear();
            const nodes = data.nodes.map(node => this.normalizeNode(node));
            const connections = this.normalizeConnections(data.connections || [], nodes);
            
            return {
                version: data.version || '1.0',
                nodes: nodes,
                connections: connections,
                viewState: this.normalizeViewState(data.viewState)
            };
        } catch (error) {
            throw new Error(`JSON导入失败: ${error.message}`);
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
     */
    normalizeNode(node) {
        const newNode = {
            id: this.generateUniqueId(),
            name: node.name || '未命名节点',
            description: node.description || '',
            x: node.x || 100,
            y: node.y || 100,
            width: node.width || 120,
            height: node.height || 60
        };
        
        // 保存ID映射
        if (node.id) {
            this.nodeIdMap.set(node.id, newNode.id);
        }
        
        return newNode;
    }

    /**
     * 标准化连线数据
     * @param {Array} connections - 原始连线数组
     * @param {Array} nodes - 节点数组
     * @returns {Array} - 标准化的连线数组
     */
    normalizeConnections(connections, nodes) {
        return connections
            .map(conn => {
                // 获取新的源节点和目标节点ID
                const sourceId = this.nodeIdMap.get(conn.sourceId) || this.findNodeIdByName(conn.sourceName, nodes);
                const targetId = this.nodeIdMap.get(conn.targetId) || this.findNodeIdByName(conn.targetName, nodes);
                
                // 只保留有效连线
                if (!sourceId || !targetId) {
                    return null;
                }
                
                return {
                    id: this.generateUniqueId(),
                    sourceId: sourceId,
                    targetId: targetId,
                    condition: conn.condition || ''
                };
            })
            .filter(conn => conn !== null); // 过滤掉无效连线
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
        const node = {
            id: this.generateUniqueId(),
            name: name || '未命名节点',
            description: description || '',
            x: x || 100,
            y: y || 100,
            width: 120,
            height: 60
        };
        
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
        return {
            id: this.generateUniqueId(),
            sourceId: sourceId,
            targetId: targetId,
            condition: condition || ''
        };
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