// 节点类
export default class Node {
    constructor(name, x, y) {
        this.id = crypto.randomUUID();
        this.type = 'node';
        this.name = name || '新节点';
        this.description = '';
        this.x = x;
        this.y = y;
        
        // 尺寸属性
        this.width = 120;
        this.height = 80;
        this.autoSize = false; // 是否自适应尺寸
        this.minWidth = 80;    // 最小宽度
        this.minHeight = 60;   // 最小高度
        this.padding = 20;     // 内边距
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
        return clone;
    }
}