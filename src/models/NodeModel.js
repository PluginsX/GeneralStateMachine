// 节点数据模型 - 纯数据，不包含业务逻辑
import ObjectBase from './ObjectBase.js';

export default class NodeModel extends ObjectBase {
    constructor(name, x, y) {
        super('node');
        
        this.name = name || '新节点';
        this.description = '';
        this.x = x || 0;
        this.y = y || 0;
        
        // 尺寸属性
        this.width = 150;
        this.height = 50;
        this.autoSize = false;
        this.minWidth = 50;
        this.minHeight = 50;
        this.padding = 20;
    }
    
    /**
     * 复制节点（纯数据复制）
     * @returns {NodeModel}
     */
    clone() {
        const clone = new NodeModel(this.name, this.x, this.y);
        clone.id = this.id;
        clone.description = this.description;
        clone.width = this.width;
        clone.height = this.height;
        clone.autoSize = this.autoSize;
        clone.minWidth = this.minWidth;
        clone.minHeight = this.minHeight;
        clone.padding = this.padding;
        clone.color = this.color;
        clone.createdAt = this.createdAt;
        clone.updatedAt = this.updatedAt;
        return clone;
    }
    
    /**
     * 从数据恢复节点
     * @param {Object} data - 节点数据
     * @returns {NodeModel}
     */
    static fromData(data) {
        const node = new NodeModel(data.name, data.x, data.y);
        Object.assign(node, data);
        return node;
    }
    
    /**
     * 转换为JSON
     * @returns {Object}
     */
    toJSON() {
        return {
            ...super.toJSON(),
            name: this.name,
            description: this.description,
            x: this.x,
            y: this.y,
            width: this.width,
            height: this.height,
            autoSize: this.autoSize,
            minWidth: this.minWidth,
            minHeight: this.minHeight,
            padding: this.padding
        };
    }
    
    /**
     * 获取对象的显示名称
     * @returns {string}
     */
    getDisplayName() {
        return this.name || '未命名节点';
    }
    
    /**
     * 检查节点是否有效
     * @returns {{valid: boolean, errors: string[]}}
     */
    validate() {
        const baseValidation = super.validate();
        const errors = [...baseValidation.errors];
        
        if (!this.name || this.name.trim() === '') {
            errors.push('节点名称不能为空');
        }
        
        if (this.width < this.minWidth) {
            errors.push(`节点宽度不能小于${this.minWidth}`);
        }
        
        if (this.height < this.minHeight) {
            errors.push(`节点高度不能小于${this.minHeight}`);
        }
        
        return {
            valid: errors.length === 0,
            errors
        };
    }
}

