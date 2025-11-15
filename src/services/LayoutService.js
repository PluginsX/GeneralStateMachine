// 布局服务 - 负责节点排列相关的业务逻辑
export default class LayoutService {
    /**
     * 使用树形结构排列节点（从左到右，从上到下）
     * @param {Array} nodes - 节点数组
     * @param {Array} connections - 连接数组
     * @param {Object} options - 排列选项
     * @returns {Promise<Object>} 排列结果
     */
    static arrangeWithTreeLayout(nodes, connections, options = {}) {
        return new Promise((resolve) => {
            const NODE_WIDTH = 180;
            const NODE_HEIGHT = 80;
            const HORIZONTAL_SPACING = options.horizontalSpacing || 200;
            const VERTICAL_SPACING = options.verticalSpacing || 100;
            const START_X = options.startX || 100;
            const START_Y = options.startY || 100;
            
            // 构建节点图结构
            const nodeMap = new Map();
            nodes.forEach(node => nodeMap.set(node.id, node));
            
            // 找出根节点（没有入边的节点）
            const rootNodes = [];
            const hasIncomingEdge = new Set();
            
            // 标记有入边的节点
            connections.forEach(conn => {
                if (nodeMap.has(conn.targetNodeId)) {
                    hasIncomingEdge.add(conn.targetNodeId);
                }
            });
            
            // 找出所有根节点
            nodes.forEach(node => {
                if (!hasIncomingEdge.has(node.id)) {
                    rootNodes.push(node);
                }
            });
            
            // 如果没有根节点（存在环），选择第一个节点作为根
            if (rootNodes.length === 0 && nodes.length > 0) {
                rootNodes.push(nodes[0]);
            }
            
            // 按层级排列节点
            const levels = []; // 每层包含的节点
            const visited = new Set();
            const queue = [];
            
            // 初始化队列，放入所有根节点
            rootNodes.forEach(root => {
                queue.push({ node: root, level: 0 });
                visited.add(root.id);
            });
            
            // 广度优先遍历构建层级
            while (queue.length > 0) {
                const { node, level } = queue.shift();
                
                // 确保层级数组存在
                if (!levels[level]) {
                    levels[level] = [];
                }
                levels[level].push(node);
                
                // 找到当前节点的所有子节点（通过出边）
                connections.forEach(conn => {
                    if (conn.sourceNodeId === node.id && 
                        nodeMap.has(conn.targetNodeId) && 
                        !visited.has(conn.targetNodeId)) {
                        queue.push({ 
                            node: nodeMap.get(conn.targetNodeId), 
                            level: level + 1 
                        });
                        visited.add(conn.targetNodeId);
                    }
                });
            }
            
            // 添加未被访问的节点（可能是孤立节点或环中的节点）
            nodes.forEach(node => {
                if (!visited.has(node.id)) {
                    // 放在最后一层
                    const lastLevel = levels.length;
                    if (!levels[lastLevel]) {
                        levels[lastLevel] = [];
                    }
                    levels[lastLevel].push(node);
                }
            });
            
            // 计算每个节点的位置
            const positions = {};
            levels.forEach((levelNodes, levelIndex) => {
                const levelY = START_Y + levelIndex * (NODE_HEIGHT + VERTICAL_SPACING);
                
                levelNodes.forEach((node, nodeIndex) => {
                    const nodeX = START_X + nodeIndex * (NODE_WIDTH + HORIZONTAL_SPACING);
                    
                    positions[node.id] = {
                        x: nodeX,
                        y: levelY
                    };
                });
            });
            
            resolve({
                positions: positions,
                levels: levels
            });
        });
    }
    
    /**
     * 创建实时力导向图模拟 - 已弃用（使用树形排列替代）
     * @param {NodeModel[]} nodes - 要排列的节点
     * @param {ConnectionModel[]} connections - 连线数组
     * @param {Function} onTick - tick回调函数
     * @param {number} canvasWidth - 画布宽度
     * @param {number} canvasHeight - 画布高度
     * @returns {Object|null} D3.js模拟对象
     */
    static createRealTimeSimulation(nodes, connections, onTick, canvasWidth = 800, canvasHeight = 600) {
        // 注意：此方法已弃用，现在使用树形排列系统
        // 保留此方法仅为向后兼容，但不再使用D3.js
        console.warn('createRealTimeSimulation已弃用，请使用树形排列系统');
        return null;
        
        /* 原始D3.js实现已注释
        if (typeof d3 === 'undefined') {
            return null;
        }
        
        if (nodes.length === 0) {
            return null;
        }
        
        try {
            // 准备D3.js数据结构
            const nodeMap = new Map();
            const d3Nodes = nodes.map(node => {
                // 获取节点位置，优先使用transform.position，回退到旧的x/y属性
                const nodePos = (node.transform && node.transform.position) ? node.transform.position : { x: 0, y: 0 };
                
                const d3Node = {
                    id: node.id,
                    x: nodePos.x || 0,
                    y: nodePos.y || 0,
                    width: node.width || 150,
                    height: node.height || 100
                };
                nodeMap.set(node.id, d3Node);
                return d3Node;
            });
            
            const nodeIds = new Set(nodes.map(n => n.id));
            const d3Links = connections
                .filter(conn => nodeIds.has(conn.sourceNodeId) && nodeIds.has(conn.targetNodeId))
                .map(conn => {
                    const source = nodeMap.get(conn.source);
                    const target = nodeMap.get(conn.target);
                    return { source, target };
                })
                .filter(link => link.source && link.target);
            
            // 创建力导向模拟
            const simulation = d3.forceSimulation(d3Nodes)
                .force("link", d3.forceLink(d3Links).id(d => d.id)
                    .distance(d => {
                        // 获取连接对象以获取差异化距离参数
                        const connection = connections.find(conn => 
                            nodeIds.has(conn.sourceNodeId) && 
                            nodeIds.has(conn.targetNodeId) &&
                            ((nodeMap.get(conn.sourceNodeId) === d.source && nodeMap.get(conn.targetNodeId) === d.target) ||
                             (nodeMap.get(conn.sourceNodeId) === d.target && nodeMap.get(conn.targetNodeId) === d.source))
                        );
                        return connection && connection.linkDistance ? connection.linkDistance : 150;
                    })
                    .strength(d => {
                        // 获取连接对象以获取差异化强度参数
                        const connection = connections.find(conn => 
                            nodeIds.has(conn.sourceNodeId) && 
                            nodeIds.has(conn.targetNodeId) &&
                            ((nodeMap.get(conn.sourceNodeId) === d.source && nodeMap.get(conn.targetNodeId) === d.target) ||
                             (nodeMap.get(conn.sourceNodeId) === d.target && nodeMap.get(conn.targetNodeId) === d.source))
                        );
                        return connection && connection.linkStrength !== undefined ? connection.linkStrength : 1;
                    })
                )
                .force("charge", d3.forceManyBody().strength(d => {
                    // 获取节点对象以获取差异化电荷力参数
                    const node = nodes.find(n => nodeMap.get(n.id) === d);
                    return node && node.forceCharge !== undefined ? node.forceCharge : -300;
                }))
                .force("collide", d3.forceCollide().radius(d => {
                    // 获取节点对象以获取差异化碰撞半径参数
                    const node = nodes.find(n => nodeMap.get(n.id) === d);
                    const baseRadius = Math.max(d.width || 150, d.height || 100) / 2;
                    const collisionRadius = node && node.forceCollideRadius !== undefined ? node.forceCollideRadius : 15;
                    return baseRadius + collisionRadius;
                }))
                .force("center", d3.forceCenter(canvasWidth / 2, canvasHeight / 2));
            
            // 保存节点映射
            simulation.nodeMap = nodeMap;
            
            // 添加tick事件监听器
            if (onTick) {
                simulation.on("tick", () => {
                    // 更新原始节点位置
                    d3Nodes.forEach(d3Node => {
                        const originalNode = nodes.find(n => n.id === d3Node.id);
                        if (originalNode) {
                            // 获取当前D3节点的位置
                            const currentX = d3Node.fx !== undefined ? d3Node.fx : d3Node.x;
                            const currentY = d3Node.fy !== undefined ? d3Node.fy : d3Node.y;
                            
                            // 更新transform.position，如果不存在则创建
                            if (!originalNode.transform) {
                                originalNode.transform = {};
                            }
                            if (!originalNode.transform.position) {
                                originalNode.transform.position = { x: 0, y: 0 };
                            }
                            
                            originalNode.transform.position.x = currentX;
                            originalNode.transform.position.y = currentY;
                        }
                    });
                    onTick();
                });
            }
            
            return simulation;
        } catch (error) {
            console.error('创建实时模拟失败:', error);
            return null;
        }
        */
    }
    
    /**
     * 简单网格排列（回退方案）
     * @param {NodeModel[]} nodes - 要排列的节点
     * @param {number} startX - 起始X坐标
     * @param {number} startY - 起始Y坐标
     * @param {number} columns - 列数
     */
    static arrangeInGrid(nodes, startX = 100, startY = 100, columns = 4) {
        const NODE_WIDTH = 180;
        const NODE_HEIGHT = 80;
        const SPACING = 50;
        
        nodes.forEach((node, index) => {
            const col = index % columns;
            const row = Math.floor(index / columns);
            const newX = startX + col * (NODE_WIDTH + SPACING);
            const newY = startY + row * (NODE_HEIGHT + SPACING);
            
            // 更新transform.position，如果不存在则创建
            if (!node.transform) {
                node.transform = {};
            }
            if (!node.transform.position) {
                node.transform.position = { x: 0, y: 0 };
            }
            
            node.transform.position.x = newX;
            node.transform.position.y = newY;
        });
    }
}

