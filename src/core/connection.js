
// 连接类
import { generateId } from '../utils/common.js';
import ConnectionModel from '../../models/ConnectionModel.js';

export default class Connection {
    constructor(sourceNodeId, targetNodeId) {
        this.id = generateId();
        this.type = 'connection';
        this.sourceNodeId = sourceNodeId;
        this.targetNodeId = targetNodeId;
        this.conditions = [];
        // 连线属性
        this.color = null;           // 连线颜色（null表示使用默认颜色）
        this.lineWidth = null;        // 连线粗细（null表示使用默认粗细）
        this.lineType = 'solid';      // 连线类型：'solid'（连续线）或'dashed'（间隔线）
        this.arrowSize = null;        // 箭头尺寸（null表示使用默认尺寸）
        this.arrowColor = null;       // 箭头颜色（null表示使用默认颜色）
    }

    clone() {
        const clone = new Connection(this.sourceNodeId, this.targetNodeId);
        clone.id = this.id;
        clone.conditions = this.conditions.map(cond => cond.clone());
        clone.color = this.color;
        clone.lineWidth = this.lineWidth;
        clone.lineType = this.lineType;
        clone.arrowSize = this.arrowSize;
        clone.arrowColor = this.arrowColor;
        return clone;
    }
}