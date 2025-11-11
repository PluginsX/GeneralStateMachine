// 节点业务逻辑服务
// 负责节点的业务操作，如计算尺寸、验证等
export default class NodeService {
    /**
     * 计算节点的自适应尺寸
     * @param {NodeModel} node - 节点模型
     * @param {CanvasRenderingContext2D} ctx - Canvas上下文
     */
    static calculateAutoSize(node, ctx) {
        if (!node.autoSize) return;
        
        // 测量名称文本宽度
        ctx.font = '14px Arial';
        const nameMetrics = ctx.measureText(node.name);
        const nameWidth = nameMetrics.width + node.padding * 2;
        
        // 测量描述文本宽度
        let descWidth = 0;
        if (node.description) {
            ctx.font = '10px Arial';
            const desc = node.description.length > 30 ? 
                node.description.substring(0, 30) + '...' : node.description;
            descWidth = ctx.measureText(desc).width + node.padding * 2;
        }
        
        // 计算最终尺寸
        node.width = Math.max(node.minWidth, nameWidth, descWidth);
        node.height = node.minHeight + (node.description ? 25 : 0);
    }
    
    /**
     * 检查点是否在节点内
     * @param {NodeModel} node - 节点模型
     * @param {number} x - 世界坐标X
     * @param {number} y - 世界坐标Y
     * @returns {boolean}
     */
    static isPointInNode(node, x, y) {
        return x >= node.x && 
               x <= node.x + node.width &&
               y >= node.y && 
               y <= node.y + node.height;
    }
    
    /**
     * 获取节点的边界框
     * @param {NodeModel} node - 节点模型
     * @returns {{x: number, y: number, width: number, height: number}}
     */
    static getBounds(node) {
        return {
            x: node.x,
            y: node.y,
            width: node.width,
            height: node.height
        };
    }
    
    /**
     * 验证节点数据
     * @param {NodeModel} node - 节点模型
     * @returns {{valid: boolean, errors: string[]}}
     */
    static validate(node) {
        const errors = [];
        
        if (!node.name || node.name.trim() === '') {
            errors.push('节点名称不能为空');
        }
        
        if (node.width < node.minWidth) {
            errors.push(`节点宽度不能小于${node.minWidth}`);
        }
        
        if (node.height < node.minHeight) {
            errors.push(`节点高度不能小于${node.minHeight}`);
        }
        
        return {
            valid: errors.length === 0,
            errors
        };
    }
}

