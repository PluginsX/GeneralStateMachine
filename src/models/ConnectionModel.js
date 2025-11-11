// 连线数据模型 - 纯数据，不包含业务逻辑
import { generateId } from '../utils/common.js';

export default class ConnectionModel {
    constructor(sourceNodeId, targetNodeId, fromSide, toSide) {
        this.id = generateId();
        this.type = 'connection';
        this.sourceNodeId = sourceNodeId;
        this.targetNodeId = targetNodeId;
        this.fromSide = fromSide || 'right';
        this.toSide = toSide || 'left';
        
        // 条件属性
        this.conditions = [];
        this.defaultConnection = false;
        
        // 连线样式属性
        this.color = null;
        this.lineWidth = null;
        this.lineType = 'solid'; // 'solid' 或 'dashed'
        this.arrowSize = null;
        this.arrowColor = null;
    }
    
    // 复制连线（纯数据复制）
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
        clone.arrowSize = this.arrowSize;
        clone.arrowColor = this.arrowColor;
        return clone;
    }
    
    // 从数据恢复连线
    static fromData(data) {
        const connection = new ConnectionModel(
            data.sourceNodeId,
            data.targetNodeId,
            data.fromSide,
            data.toSide
        );
        Object.assign(connection, data);
        return connection;
    }
}

