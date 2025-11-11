// 条件数据模型 - 纯数据，不包含业务逻辑
export default class ConditionModel {
    constructor(type = 'Float', key = '', operator = '', value = '') {
        this.type = type;
        this.key = key;
        
        // 根据类型设置默认值
        if (type === 'Trigger') {
            this.operator = operator || '==';
            this.value = value || 'true';
        } else if (type === 'Bool') {
            this.operator = operator || '==';
            this.value = value || 'false';
        } else {
            // Float和Int类型
            this.operator = operator || '>';
            this.value = value || '0';
        }
    }

    clone() {
        return new ConditionModel(this.type, this.key, this.operator, this.value);
    }
    
    // 从数据恢复条件
    static fromData(data) {
        return new ConditionModel(data.type, data.key, data.operator, data.value);
    }
}

