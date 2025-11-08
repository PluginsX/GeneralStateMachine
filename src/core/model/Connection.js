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
    }
    
    // 复制连线
    clone() {
        const clone = new Connection(this.sourceNodeId, this.targetNodeId, this.fromSide, this.toSide);
        clone.id = this.id;
        clone.conditions = JSON.parse(JSON.stringify(this.conditions));
        clone.defaultConnection = this.defaultConnection;
        return clone;
    }
}