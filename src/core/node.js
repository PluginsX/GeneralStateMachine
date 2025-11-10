import { generateId } from '../utils/common.js';

// 节点类
export default class Node {
    constructor(name, x, y) {
        this.id = generateId();
        this.type = 'node';
        this.name = name || '新节点';
        this.description = '';
        this.x = x;
        this.y = y;
        
        // 尺寸属性
        this.width = 150;
        this.height = 50;
        this.autoSize = false; // 是否自适应尺寸
        this.minWidth = 50;    // 最小宽度
        this.minHeight = 50;   // 最小高度
        this.padding = 20;     // 内边距
        this.color = null;     // 节点颜色（null表示使用默认颜色）
    }
    
    // 计算自适应尺寸
    calculateAutoSize(ctx) {
        if (!this.autoSize) return;
        
        // 测量名称文本宽度
        ctx.font = '14px Arial';
        const nameMetrics = ctx.measureText(this.name);
        const nameWidth = nameMetrics.width + this.padding * 2;
        
        // 测量描述文本宽度
        let descWidth = 0;
        if (this.description) {
            ctx.font = '10px Arial';
            const desc = this.description.length > 30 ? 
                this.description.substring(0, 30) + '...' : this.description;
            descWidth = ctx.measureText(desc).width + this.padding * 2;
        }
        
        // 计算最终尺寸
        this.width = Math.max(this.minWidth, nameWidth, descWidth);
        this.height = this.minHeight + (this.description ? 25 : 0);
    }

    // 复制节点
    clone() {
        const clone = new Node(this.name, this.x, this.y);
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
}