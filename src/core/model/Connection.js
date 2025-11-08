// 连线数据模型
// 仅包含数据结构和基础操作，不包含业务逻辑
export default class Connection {
    constructor(sourceNodeId, targetNodeId, fromSide, toSide) {
        this.id = crypto.randomUUID();
        this.type = 'connection';
        this.sourceNodeId = sourceNodeId;
        this.targetNodeId = targetNodeId;
        this.fromSide = fromSide || 'right';
        this.toSide = toSide || 'left';
        
        // 条件属性
        this.conditions = [];
        this.defaultConnection = false;
        
        // 连线样式属性
        this.color = null;           // 连线颜色（null表示使用默认颜色）
        this.lineWidth = null;        // 连线粗细（null表示使用默认粗细）
        this.lineType = 'solid';      // 连线类型：'solid'（连续线）或'dashed'（间隔线）
        this.arrowSize = null;        // 箭头尺寸（null表示使用默认尺寸）
        this.arrowColor = null;       // 箭头颜色（null表示使用默认颜色）
    }
    
    // 复制连线
    clone() {
        const clone = new Connection(this.sourceNodeId, this.targetNodeId, this.fromSide, this.toSide);
        clone.id = this.id;
        clone.conditions = JSON.parse(JSON.stringify(this.conditions));
        clone.defaultConnection = this.defaultConnection;
        clone.color = this.color;
        clone.lineWidth = this.lineWidth;
        clone.lineType = this.lineType;
        clone.arrowSize = this.arrowSize;
        clone.arrowColor = this.arrowColor;
        return clone;
    }
}