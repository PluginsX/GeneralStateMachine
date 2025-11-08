// 条件类
export default class Condition {
    constructor(type = 'Float', key = '', operator = '', value = '') {
        this.type = type;
        this.key = key;
        
        // 根据类型设置默认值
        if (type === 'Trigger') {
            // Trigger类型默认使用==运算符和true值
            this.operator = operator || '==';
            this.value = value || 'true';
        } else if (type === 'Bool') {
            // Bool类型默认使用==运算符和false值
            this.operator = operator || '==';
            this.value = value || 'false';
        } else {
            // Float和Int类型默认使用>运算符和0值
            this.operator = operator || '>';
            this.value = value || '0';
        }
    }

    clone() {
        return new Condition(this.type, this.key, this.operator, this.value);
    }
}