// 布局服务 - 负责节点排列相关的业务逻辑
export default class LayoutService {
    /**
     * 使用D3.js进行力导向图排列（单次）
     * @param {NodeModel[]} nodes - 要排列的节点
     * @param {ConnectionModel[]} connections - 连线数组
     * @param {number} canvasWidth - 画布宽度
     * @param {number} canvasHeight - 画布高度
     * @returns {Promise<{success: boolean, message: string}>}
     */
    static async arrangeWithForceLayout(nodes, connections, canvasWidth = 800, canvasHeight = 600) {
        if (typeof d3 === 'undefined') {
            return { success: false, message: 'D3.js库未加载' };
        }
        
        if (nodes.length === 0) {
            return { success: false, message: '没有节点需要排列' };
        }
        
        try {
            // 准备D3.js数据结构
            const nodeMap = new Map();
            const d3Nodes = nodes.map(node => {
                const d3Node = {
                    id: node.id,
                    x: node.x || Math.random() * 400,
                    y: node.y || Math.random() * 300,
                    width: node.width || 180,
                    height: node.height || 80
                };
                nodeMap.set(node.id, d3Node);
                return d3Node;
            });
            
            // 过滤出与当前节点相关的连接
            const nodeIds = new Set(nodes.map(n => n.id));
            const d3Links = connections
                .filter(conn => nodeIds.has(conn.sourceNodeId) && nodeIds.has(conn.targetNodeId))
                .map(conn => {
                    const source = nodeMap.get(conn.sourceNodeId);
                    const target = nodeMap.get(conn.targetNodeId);
                    return { source, target };
                })
                .filter(link => link.source && link.target);
            
            // 创建力导向图模拟
            // 单次排列优化：使用更强的力和更快的收敛速度
            const simulation = d3.forceSimulation(d3Nodes)
                .force('link', d3.forceLink(d3Links).id(d => d.id).distance(150))
                .force('charge', d3.forceManyBody().strength(-500)) // 增强电荷力，加快收敛
                .force('center', d3.forceCenter(canvasWidth / 2, canvasHeight / 2))
                .force('collision', d3.forceCollide().radius(d => 
                    Math.max((d.width || 180) / 2, (d.height || 80) / 2) + 20
                ))
                .alphaTarget(0) // 设置目标alpha为0，让模拟自然收敛
                .alphaDecay(0.05); // 加快alpha衰减速度（默认0.0228），让模拟更快收敛
            
            // 使用异步方式运行模拟，避免阻塞主线程
            // 单次排列应该比实时排列快得多，所以使用更少的迭代和更高的停止阈值
            return new Promise((resolve) => {
                let tickCount = 0;
                const maxTicks = 100; // 减少最大迭代次数（从300降到100），单次排列不需要太多迭代
                const minAlpha = 0.01; // 提高停止阈值（从0.001提高到0.01），更快停止
                
                // 使用tick事件来异步执行
                simulation.on('tick', () => {
                    tickCount++;
                    const alpha = simulation.alpha();
                    
                    // 如果alpha足够小或达到最大迭代次数，停止模拟
                    if (alpha < minAlpha || tickCount >= maxTicks) {
                        simulation.stop();
                        
                        // 应用计算出的位置到实际节点
                        d3Nodes.forEach(d3Node => {
                            const node = nodes.find(n => n.id === d3Node.id);
                            if (node) {
                                node.x = d3Node.x;
                                node.y = d3Node.y;
                            }
                        });
                        
                        // 清理事件监听器
                        simulation.on('tick', null);
                        
                        resolve({ success: true, message: '自动排列完成' });
                    }
                });
                
                // 启动模拟
                simulation.restart();
            });
        } catch (error) {
            console.error('力导向图排列失败:', error);
            return { success: false, message: `排列失败: ${error.message}` };
        }
    }
    
    /**
     * 创建实时力导向图模拟
     * @param {NodeModel[]} nodes - 要排列的节点
     * @param {ConnectionModel[]} connections - 连线数组
     * @param {Function} onTick - tick回调函数
     * @param {number} canvasWidth - 画布宽度
     * @param {number} canvasHeight - 画布高度
     * @returns {Object|null} D3.js模拟对象
     */
    static createRealTimeSimulation(nodes, connections, onTick, canvasWidth = 800, canvasHeight = 600) {
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
                const d3Node = {
                    id: node.id,
                    x: node.x || 0,
                    y: node.y || 0,
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
                .force("link", d3.forceLink(d3Links).id(d => d.id).distance(150))
                .force("charge", d3.forceManyBody().strength(-300))
                .force("collide", d3.forceCollide().radius(d => 
                    Math.max(d.width || 150, d.height || 100) / 2 + 15))
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
                            const currentX = d3Node.fx !== undefined ? d3Node.fx : d3Node.x;
                            const currentY = d3Node.fy !== undefined ? d3Node.fy : d3Node.y;
                            originalNode.x = currentX;
                            originalNode.y = currentY;
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
            node.x = startX + col * (NODE_WIDTH + SPACING);
            node.y = startY + row * (NODE_HEIGHT + SPACING);
        });
    }
}

