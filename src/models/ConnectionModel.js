import ObjectBase from './ObjectBase.js';
import { Vector2 } from '../math/GraphicsMath.js';

/**
 * 连接模型类 - 继承自ObjectBase
 * 表示节点之间的连接关系
 */
export class ConnectionModel extends ObjectBase {
    /**
     * 构造函数
     * @param {Object} options - 连接选项
     * @param {string} options.sourceNodeId - 源节点ID
     * @param {string} options.targetNodeId - 目标节点ID
     * @param {string} options.sourcePortId - 源端口ID
     * @param {string} options.targetPortId - 目标端口ID
     * @param {string} options.type - 连接类型
     * @param {Object} options.condition - 连接条件
     * @param {Object} options.style - 连接样式
     * @param {Object} options.arrowStyle - 箭头样式
     * @param {Object} options.forceDirected - 力导向图参数
     */
    constructor(options = {}) {
        super('connection', options);
        
        // 连接基本信息
        this.sourceNodeId = options.sourceNodeId || '';
        this.targetNodeId = options.targetNodeId || '';
        this.sourcePortId = options.sourcePortId || '';
        this.targetPortId = options.targetPortId || '';
        this.type = options.type || 'default';
        
        // 连接条件
        this.condition = {
            type: 'none',
            value: null,
            operator: 'equals',
            ...options.condition
        };
        
        // 连接样式
        this.style = {
            color: options.color || '#666666',
            width: options.width || 2,
            lineStyle: options.lineStyle || 'solid', // solid, dashed, dotted
            opacity: options.opacity || 1.0,
            curve: options.curve || 'bezier', // straight, bezier, step
            ...options.style
        };
        
        // 箭头样式
        this.arrowStyle = {
            show: options.showArrow !== false,
            size: options.arrowSize || 10,
            style: options.arrowStyle || 'triangle', // triangle, circle, diamond
            color: options.arrowColor || this.style.color,
            ...options.arrowStyle
        };
        
        // 力导向图参数
        this.forceDirected = {
            strength: options.forceStrength || 0.1,
            distance: options.forceDistance || 100,
            ...options.forceDirected
        };
        
        // 连接状态
        this.isValid = true;
        this.errors = [];
        this.warnings = [];
    }

    /**
     * 克隆连接
     * @returns {ConnectionModel}
     */
    clone() {
        return ConnectionModel.fromData(this.toJSON());
    }

    /**
     * 从数据创建连接
     * @param {Object} data - 连接数据
     * @returns {ConnectionModel}
     */
    static fromData(data) {
        const connection = new ConnectionModel({
            sourceNodeId: data.sourceNodeId,
            targetNodeId: data.targetNodeId,
            sourcePortId: data.sourcePortId,
            targetPortId: data.targetPortId,
            type: data.type,
            condition: data.condition,
            style: data.style,
            arrowStyle: data.arrowStyle,
            forceDirected: data.forceDirected
        });
        
        // 恢复基础属性
        connection.id = data.id;
        connection.createdAt = data.createdAt ? new Date(data.createdAt) : new Date();
        connection.updatedAt = data.updatedAt ? new Date(data.updatedAt) : new Date();
        
        // 恢复状态
        connection.visible = data.visible !== false;
        connection.selected = data.selected || false;
        connection.locked = data.locked || false;
        
        // 恢复自定义属性
        if (data.customProperties) {
            connection.customProperties = new Map(Object.entries(data.customProperties));
        }
        
        return connection;
    }

    /**
     * 转换为JSON对象
     * @returns {Object}
     */
    toJSON() {
        return {
            id: this.id,
            type: this.type,
            sourceNodeId: this.sourceNodeId,
            targetNodeId: this.targetNodeId,
            sourcePortId: this.sourcePortId,
            targetPortId: this.targetPortId,
            condition: this.condition,
            style: this.style,
            arrowStyle: this.arrowStyle,
            forceDirected: this.forceDirected,
            visible: this.visible,
            selected: this.selected,
            locked: this.locked,
            createdAt: this.createdAt.toISOString(),
            updatedAt: this.updatedAt.toISOString(),
            customProperties: Object.fromEntries(this.customProperties)
        };
    }

    /**
     * 验证连接
     * @returns {boolean}
     */
    validate() {
        this.errors = [];
        this.warnings = [];
        
        // 基础验证
        if (!this.sourceNodeId) {
            this.errors.push('源节点ID不能为空');
        }
        
        if (!this.targetNodeId) {
            this.errors.push('目标节点ID不能为空');
        }
        
        if (this.sourceNodeId === this.targetNodeId) {
            this.errors.push('源节点和目标节点不能相同');
        }
        
        // 样式验证
        if (this.style.width <= 0) {
            this.errors.push('连接线宽度必须大于0');
        }
        
        if (this.style.opacity < 0 || this.style.opacity > 1) {
            this.errors.push('连接线透明度必须在0-1之间');
        }
        
        this.isValid = this.errors.length === 0;
        return this.isValid;
    }

    /**
     * 获取连接中点
     * @param {Vector2} sourcePos - 源节点位置
     * @param {Vector2} targetPos - 目标节点位置
     * @returns {Vector2}
     */
    getMidpoint(sourcePos, targetPos) {
        return new Vector2(
            (sourcePos.x + targetPos.x) / 2,
            (sourcePos.y + targetPos.y) / 2
        );
    }

    /**
     * 检查点是否在连接附近
     * @param {Vector2} point - 检查点
     * @param {Vector2} sourcePos - 源节点位置
     * @param {Vector2} targetPos - 目标节点位置
     * @param {number} tolerance - 容差范围
     * @returns {boolean}
     */
    isPointNearConnection(point, sourcePos, targetPos, tolerance = 5) {
        // 简化实现：点到线段的距离
        const A = point.x - sourcePos.x;
        const B = point.y - sourcePos.y;
        const C = targetPos.x - sourcePos.x;
        const D = targetPos.y - sourcePos.y;

        const dot = A * C + B * D;
        const lenSq = C * C + D * D;
        let param = -1;

        if (lenSq !== 0) {
            param = dot / lenSq;
        }

        let xx, yy;

        if (param < 0) {
            xx = sourcePos.x;
            yy = sourcePos.y;
        } else if (param > 1) {
            xx = targetPos.x;
            yy = targetPos.y;
        } else {
            xx = sourcePos.x + param * C;
            yy = sourcePos.y + param * D;
        }

        const dx = point.x - xx;
        const dy = point.y - yy;
        const distance = Math.sqrt(dx * dx + dy * dy);

        return distance <= tolerance;
    }

    /**
     * 设置连接样式
     * @param {Object} style - 样式配置
     * @returns {ConnectionModel}
     */
    setStyle(style) {
        Object.assign(this.style, style);
        return this.touch();
    }

    /**
     * 设置箭头样式
     * @param {Object} arrowStyle - 箭头样式配置
     * @returns {ConnectionModel}
     */
    setArrowStyle(arrowStyle) {
        Object.assign(this.arrowStyle, arrowStyle);
        return this.touch();
    }

    /**
     * 设置连接条件
     * @param {Object} condition - 条件配置
     * @returns {ConnectionModel}
     */
    setCondition(condition) {
        Object.assign(this.condition, condition);
        return this.touch();
    }

    /**
     * 获取显示名称
     * @returns {string}
     */
    getDisplayName() {
        return `${this.sourceNodeId} → ${this.targetNodeId}`;
    }
}

export default ConnectionModel;

