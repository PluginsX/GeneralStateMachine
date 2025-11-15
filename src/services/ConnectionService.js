// 连线业务逻辑服务
// 负责连线的业务操作，如验证、计算端点等
export default class ConnectionService {
    /**
     * 计算连线的端点坐标
     * @param {ConnectionModel} connection - 连线模型
     * @param {NodeModel} sourceNode - 源节点
     * @param {NodeModel} targetNode - 目标节点
     * @returns {{start: {x: number, y: number}, end: {x: number, y: number}}}
     */
    static calculateConnectionPoints(connection, sourceNode, targetNode) {
        const start = this.getConnectionPoint(sourceNode, connection.fromSide);
        const end = this.getConnectionPoint(targetNode, connection.toSide);
        return { start, end };
    }
    
    /**
     * 获取节点指定侧的连接点
     * @param {NodeModel} node - 节点模型
     * @param {string} side - 侧边：'top', 'right', 'bottom', 'left'
     * @returns {{x: number, y: number}}
     */
    static getConnectionPoint(node, side) {
        // 获取节点位置
        const nodePos = (node.transform && node.transform.position) ? node.transform.position : { x: 0, y: 0 };
        
        switch (side) {
            case 'top':
                return { x: nodePos.x + node.width / 2, y: nodePos.y };
            case 'right':
                return { x: nodePos.x + node.width, y: nodePos.y + node.height / 2 };
            case 'bottom':
                return { x: nodePos.x + node.width / 2, y: nodePos.y + node.height };
            case 'left':
            default:
                return { x: nodePos.x, y: nodePos.y + node.height / 2 };
        }
    }
    
    /**
     * 验证连线数据
     * @param {ConnectionModel} connection - 连线模型
     * @param {Map<string, NodeModel>} nodes - 节点映射
     * @returns {{valid: boolean, errors: string[]}}
     */
    static validate(connection, nodes) {
        const errors = [];
        
        if (!nodes.has(connection.sourceNodeId)) {
            errors.push('源节点不存在');
        }
        
        if (!nodes.has(connection.targetNodeId)) {
            errors.push('目标节点不存在');
        }
        
        if (connection.sourceNodeId === connection.targetNodeId) {
            errors.push('连线不能连接同一个节点');
        }
        
        return {
            valid: errors.length === 0,
            errors
        };
    }
    
    /**
     * 检查两条连线是否重复
     * @param {ConnectionModel} conn1 - 连线1
     * @param {ConnectionModel} conn2 - 连线2
     * @returns {boolean}
     */
    static isDuplicate(conn1, conn2) {
        return conn1.sourceNodeId === conn2.sourceNodeId &&
               conn1.targetNodeId === conn2.targetNodeId &&
               conn1.fromSide === conn2.fromSide &&
               conn1.toSide === conn2.toSide;
    }
}

