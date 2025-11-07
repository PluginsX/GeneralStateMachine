// 条件类
export default class Condition {
    constructor(type = 'int', key = '', operator = '>', value = '') {
        this.type = type;
        this.key = key;
        this.operator = operator;
        this.value = value;
    }

    clone() {
        return new Condition(this.type, this.key, this.operator, this.value);
    }
}