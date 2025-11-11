// 节点数据模型 - 纯数据，不包含业务逻辑
import { generateId } from '../utils/common.js';

export default class NodeModel {
    constructor(name, x, y) {
        this.id = generateId();
        this.type = 'node';
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
        this.color = null; // null表示使用默认颜色
    }
    
    // 复制节点（纯数据复制）
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
        return clone;
    }
    
    // 从数据恢复节点
    static fromData(data) {
        const node = new NodeModel(data.name, data.x, data.y);
        Object.assign(node, data);
        return node;
    }
}

