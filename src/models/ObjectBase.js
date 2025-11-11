// 工作区对象基类 - 所有可以在Canvas中放置的对象的基类
import { generateId } from '../utils/common.js';

/**
 * ObjectBase - 工作区对象基类
 * 
 * 所有可以在Canvas中放置的对象都应该继承此类
 * 提供共同的基础属性和方法
 */
export default class ObjectBase {
    /**
     * 构造函数
     * @param {string} type - 对象类型（如 'node', 'connection'）
     */
    constructor(type) {
        if (!type) {
            throw new Error('ObjectBase: type is required');
        }
        
        this.id = generateId();
        this.type = type;
        
        // 通用样式属性
        this.color = null; // null表示使用默认颜色
        
        // 元数据
        this.createdAt = Date.now();
        this.updatedAt = Date.now();
    }
    
    /**
     * 更新对象的更新时间戳
     */
    touch() {
        this.updatedAt = Date.now();
    }
    
    /**
     * 复制对象（纯数据复制）
     * 子类应该重写此方法以包含特定属性
     * @returns {ObjectBase} 新对象实例
     */
    clone() {
        const clone = new this.constructor();
        clone.id = this.id;
        clone.type = this.type;
        clone.color = this.color;
        clone.createdAt = this.createdAt;
        clone.updatedAt = this.updatedAt;
        return clone;
    }
    
    /**
     * 从数据恢复对象
     * 子类应该重写此方法以包含特定属性
     * @param {Object} data - 对象数据
     * @returns {ObjectBase} 新对象实例
     */
    static fromData(data) {
        const instance = new this();
        Object.assign(instance, data);
        return instance;
    }
    
    /**
     * 转换为JSON（用于序列化）
     * @returns {Object} JSON对象
     */
    toJSON() {
        return {
            id: this.id,
            type: this.type,
            color: this.color,
            createdAt: this.createdAt,
            updatedAt: this.updatedAt
        };
    }
    
    /**
     * 检查对象是否有效
     * 子类可以重写此方法以添加特定验证
     * @returns {{valid: boolean, errors: string[]}}
     */
    validate() {
        const errors = [];
        
        if (!this.id) {
            errors.push('对象ID不能为空');
        }
        
        if (!this.type) {
            errors.push('对象类型不能为空');
        }
        
        return {
            valid: errors.length === 0,
            errors
        };
    }
    
    /**
     * 获取对象的显示名称（用于UI显示）
     * 子类应该重写此方法
     * @returns {string}
     */
    getDisplayName() {
        return `${this.type}(${this.id.substring(0, 8)})`;
    }
}

