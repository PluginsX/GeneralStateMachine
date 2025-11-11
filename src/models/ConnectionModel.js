// 连线数据模型 - 纯数据，不包含业务逻辑
import ObjectBase from './ObjectBase.js';
import { ArrowStyle, DEFAULT_ARROW_STYLE, ArrowStyleType } from './ArrowStyle.js';

export default class ConnectionModel extends ObjectBase {
    constructor(sourceNodeId, targetNodeId, fromSide, toSide) {
        super('connection');
        
        this.sourceNodeId = sourceNodeId;
        this.targetNodeId = targetNodeId;
        this.fromSide = fromSide || 'right';
        this.toSide = toSide || 'left';
        
        // 条件属性
        this.conditions = [];
        this.defaultConnection = false;
        
        // 连线样式属性
        this.lineWidth = null; // null表示使用默认粗细
        this.lineType = 'solid'; // 'solid' 或 'dashed'
        
        // 箭头样式（使用新的ArrowStyle对象）
        // 为了向后兼容，保留arrowSize和arrowColor属性，但优先使用arrowStyle
        this.arrowStyle = DEFAULT_ARROW_STYLE.clone();
        this.arrowSize = null; // 已废弃，使用arrowStyle.size
        this.arrowColor = null; // 已废弃，使用arrowStyle.color
    }
    
    /**
     * 获取箭头大小（兼容旧代码）
     * @returns {number}
     */
    getArrowSize() {
        return this.arrowSize !== null ? this.arrowSize : this.arrowStyle.size;
    }
    
    /**
     * 设置箭头大小（兼容旧代码）
     * @param {number} size
     */
    setArrowSize(size) {
        this.arrowSize = size;
        if (this.arrowStyle) {
            this.arrowStyle.size = size;
        }
    }
    
    /**
     * 获取箭头颜色（兼容旧代码）
     * @returns {string|null}
     */
    getArrowColor() {
        return this.arrowColor !== null ? this.arrowColor : this.arrowStyle.color;
    }
    
    /**
     * 设置箭头颜色（兼容旧代码）
     * @param {string|null} color
     */
    setArrowColor(color) {
        this.arrowColor = color;
        if (this.arrowStyle) {
            this.arrowStyle.color = color;
        }
    }
    
    /**
     * 设置箭头样式
     * @param {ArrowStyle|Object} style - 箭头样式对象或配置对象
     */
    setArrowStyle(style) {
        if (style instanceof ArrowStyle) {
            this.arrowStyle = style.clone();
        } else if (typeof style === 'object') {
            this.arrowStyle = new ArrowStyle(
                style.type || ArrowStyleType.TRIANGLE,
                style.size || this.getArrowSize(),
                style.color !== undefined ? style.color : this.getArrowColor()
            );
        }
        // 同步到旧属性以保持兼容性
        this.arrowSize = this.arrowStyle.size;
        this.arrowColor = this.arrowStyle.color;
    }
    
    /**
     * 获取箭头样式
     * @returns {ArrowStyle}
     */
    getArrowStyle() {
        // 如果旧属性存在但arrowStyle不存在，从旧属性创建
        if (!this.arrowStyle && (this.arrowSize !== null || this.arrowColor !== null)) {
            this.arrowStyle = new ArrowStyle(
                ArrowStyleType.TRIANGLE,
                this.arrowSize || DEFAULT_ARROW_STYLE.size,
                this.arrowColor !== null ? this.arrowColor : DEFAULT_ARROW_STYLE.color
            );
        }
        return this.arrowStyle || DEFAULT_ARROW_STYLE;
    }
    
    /**
     * 复制连线（纯数据复制）
     * @returns {ConnectionModel}
     */
    clone() {
        const clone = new ConnectionModel(
            this.sourceNodeId, 
            this.targetNodeId, 
            this.fromSide, 
            this.toSide
        );
        clone.id = this.id;
        clone.conditions = this.conditions.map(cond => {
            // 如果condition有clone方法则调用，否则深拷贝
            return cond.clone ? cond.clone() : JSON.parse(JSON.stringify(cond));
        });
        clone.defaultConnection = this.defaultConnection;
        clone.color = this.color;
        clone.lineWidth = this.lineWidth;
        clone.lineType = this.lineType;
        
        // 复制箭头样式
        clone.arrowStyle = this.getArrowStyle().clone();
        clone.arrowSize = this.arrowSize;
        clone.arrowColor = this.arrowColor;
        
        clone.createdAt = this.createdAt;
        clone.updatedAt = this.updatedAt;
        return clone;
    }
    
    /**
     * 从数据恢复连线
     * @param {Object} data - 连线数据
     * @returns {ConnectionModel}
     */
    static fromData(data) {
        const connection = new ConnectionModel(
            data.sourceNodeId,
            data.targetNodeId,
            data.fromSide,
            data.toSide
        );
        Object.assign(connection, data);
        
        // 处理箭头样式
        if (data.arrowStyle) {
            connection.arrowStyle = ArrowStyle.fromData(data.arrowStyle);
        } else if (data.arrowSize !== null || data.arrowColor !== null) {
            // 从旧属性创建箭头样式
            connection.arrowStyle = new ArrowStyle(
                ArrowStyleType.TRIANGLE,
                data.arrowSize || DEFAULT_ARROW_STYLE.size,
                data.arrowColor !== null ? data.arrowColor : DEFAULT_ARROW_STYLE.color
            );
        }
        
        return connection;
    }
    
    /**
     * 转换为JSON
     * @returns {Object}
     */
    toJSON() {
        return {
            ...super.toJSON(),
            sourceNodeId: this.sourceNodeId,
            targetNodeId: this.targetNodeId,
            fromSide: this.fromSide,
            toSide: this.toSide,
            conditions: this.conditions.map(cond => {
                return cond.toJSON ? cond.toJSON() : cond;
            }),
            defaultConnection: this.defaultConnection,
            lineWidth: this.lineWidth,
            lineType: this.lineType,
            arrowStyle: this.getArrowStyle().toJSON(),
            // 保留旧属性以保持兼容性
            arrowSize: this.arrowSize,
            arrowColor: this.arrowColor
        };
    }
    
    /**
     * 获取对象的显示名称
     * @returns {string}
     */
    getDisplayName() {
        return `连接(${this.sourceNodeId.substring(0, 8)} → ${this.targetNodeId.substring(0, 8)})`;
    }
    
    /**
     * 检查连线是否有效
     * @param {Map<string, NodeModel>} nodes - 节点映射（可选，用于验证节点是否存在）
     * @returns {{valid: boolean, errors: string[]}}
     */
    validate(nodes = null) {
        const baseValidation = super.validate();
        const errors = [...baseValidation.errors];
        
        if (!this.sourceNodeId) {
            errors.push('源节点ID不能为空');
        }
        
        if (!this.targetNodeId) {
            errors.push('目标节点ID不能为空');
        }
        
        if (this.sourceNodeId === this.targetNodeId) {
            errors.push('连线不能连接同一个节点');
        }
        
        // 如果提供了节点映射，验证节点是否存在
        if (nodes) {
            if (!nodes.has(this.sourceNodeId)) {
                errors.push('源节点不存在');
            }
            if (!nodes.has(this.targetNodeId)) {
                errors.push('目标节点不存在');
            }
        }
        
        return {
            valid: errors.length === 0,
            errors
        };
    }
}

