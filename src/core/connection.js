
// 连接类
export default class Connection {
    constructor(sourceNodeId, targetNodeId) {
        this.id = crypto.randomUUID();
        this.type = 'connection';
        this.sourceNodeId = sourceNodeId;
        this.targetNodeId = targetNodeId;
        this.conditions = [];
    }

    clone() {
        const clone = new Connection(this.sourceNodeId, this.targetNodeId);
        clone.id = this.id;
        clone.conditions = this.conditions.map(cond => cond.clone());
        return clone;
    }
}