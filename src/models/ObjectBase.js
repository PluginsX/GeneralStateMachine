// 工作区对象基类 - 所有可以在Canvas中放置的对象的基类
import { generateId } from '../utils/common.js';
import { Transform2D } from '../math/Transform.js';
import { Vector2, Rectangle } from '../math/GraphicsMath.js';

/**
 * 对象ID生成器
 */
class ObjectIdGenerator {
    static #nextId = 1;
    
    /**
     * 生成新的唯一ID
     * @returns {number}
     */
    static generate() {
        return ObjectIdGenerator.#nextId++;
    }
    
    /**
     * 重置ID生成器（主要用于测试）
     */
    static reset() {
        ObjectIdGenerator.#nextId = 1;
    }
}

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
     * @param {Object} options - 配置选项
     * @param {Transform2D} options.transform - 变换属性
     * @param {number} options.objectId - 对象ID（自动生成）
     * @param {string} options.color - 对象颜色
     */
    constructor(type, options = {}) {
        if (!type) {
            throw new Error('ObjectBase: type is required');
        }
        
        // 基础属性
        this.id = generateId();
        this.type = type;
        
        // 图形学属性
        this.objectId = options.objectId || ObjectIdGenerator.generate();
        this.transform = options.transform || new Transform2D();
        
        // 视觉属性
        this.color = options.color || null; // null表示使用默认颜色
        
        // 元数据
        this.createdAt = new Date();
        this.updatedAt = new Date();
        
        // 状态标志
        this.visible = true;
        this.selected = false;
        this.locked = false;
        
        // 自定义属性存储
        this.customProperties = new Map();
    }
    
    /**
     * 更新时间戳
     */
    touch() {
        this.updatedAt = new Date();
        return this;
    }

    /**
     * 设置位置
     * @param {Vector2|number} x - X坐标或Vector2对象
     * @param {number} y - Y坐标（当x为Vector2时可选）
     * @returns {ObjectBase}
     */
    setPosition(x, y) {
        if (x instanceof Vector2) {
            this.transform.position = x.clone();
        } else {
            this.transform.position = new Vector2(x, y);
        }
        return this.touch();
    }

    /**
     * 获取位置
     * @returns {Vector2}
     */
    getPosition() {
        return this.transform.position.clone();
    }

    /**
     * 设置旋转
     * @param {number} angle - 旋转角度（弧度）
     * @returns {ObjectBase}
     */
    setRotation(angle) {
        this.transform.rotation = angle;
        return this.touch();
    }

    /**
     * 获取旋转
     * @returns {number}
     */
    getRotation() {
        return this.transform.rotation;
    }

    /**
     * 设置缩放
     * @param {Vector2|number} x - X缩放或Vector2对象
     * @param {number} y - Y缩放（当x为Vector2时可选）
     * @returns {ObjectBase}
     */
    setScale(x, y) {
        if (x instanceof Vector2) {
            this.transform.scale = x.clone();
        } else {
            this.transform.scale = new Vector2(x, y || x);
        }
        return this.touch();
    }

    /**
     * 获取缩放
     * @returns {Vector2}
     */
    getScale() {
        return this.transform.scale.clone();
    }

    /**
     * 平移对象
     * @param {Vector2|number} x - X平移量或Vector2对象
     * @param {number} y - Y平移量（当x为Vector2时可选）
     * @returns {ObjectBase}
     */
    translate(x, y) {
        if (x instanceof Vector2) {
            this.transform.position = this.transform.position.add(x);
        } else {
            this.transform.position = this.transform.position.add(new Vector2(x, y));
        }
        return this.touch();
    }

    /**
     * 旋转对象
     * @param {number} angle - 旋转角度（弧度）
     * @returns {ObjectBase}
     */
    rotate(angle) {
        this.transform.rotation += angle;
        return this.touch();
    }

    /**
     * 缩放对象
     * @param {Vector2|number} x - X缩放量或Vector2对象
     * @param {number} y - Y缩放量（当x为Vector2时可选）
     * @returns {ObjectBase}
     */
    scale(x, y) {
        if (x instanceof Vector2) {
            this.transform.scale = this.transform.scale.multiply(x);
        } else {
            this.transform.scale = this.transform.scale.multiply(new Vector2(x, y || x));
        }
        return this.touch();
    }

    /**
     * 设置自定义属性
     * @param {string} key - 属性键
     * @param {*} value - 属性值
     * @returns {ObjectBase}
     */
    setCustomProperty(key, value) {
        this.customProperties.set(key, value);
        return this.touch();
    }

    /**
     * 获取自定义属性
     * @param {string} key - 属性键
     * @param {*} defaultValue - 默认值
     * @returns {*}
     */
    getCustomProperty(key, defaultValue = null) {
        return this.customProperties.get(key) ?? defaultValue;
    }

    /**
     * 删除自定义属性
     * @param {string} key - 属性键
     * @returns {ObjectBase}
     */
    removeCustomProperty(key) {
        this.customProperties.delete(key);
        return this.touch();
    }
    
    /**
     * 克隆对象
     * @returns {ObjectBase}
     */
    clone() {
        const cloned = new this.constructor(this.type, {
            transform: this.transform.clone(),
            objectId: ObjectIdGenerator.generate(),
            color: this.color
        });
        
        // 复制状态标志
        cloned.visible = this.visible;
        cloned.selected = false; // 克隆的对象默认不选中
        cloned.locked = this.locked;
        
        // 复制自定义属性
        for (const [key, value] of this.customProperties) {
            cloned.customProperties.set(key, value);
        }
        
        return cloned;
    }
    
    /**
     * 从数据创建对象
     * @param {Object} data - 数据对象
     * @returns {ObjectBase}
     */
    static fromData(data) {
        const obj = new ObjectBase({
            type: data.type,
            name: data.name,
            transform: new Transform2D(
                data.transform?.position ? new Vector2(data.transform.position.x, data.transform.position.y) : new Vector2(),
                data.transform?.rotation || 0,
                data.transform?.scale ? new Vector2(data.transform.scale.x, data.transform.scale.y) : new Vector2(1, 1)
            ),
            objectId: data.objectId,
            color: data.color
        });
        
        obj.id = data.id;
        obj.createdAt = new Date(data.createdAt);
        obj.updatedAt = new Date(data.updatedAt);
        obj.visible = data.visible ?? true;
        obj.selected = data.selected ?? false;
        obj.locked = data.locked ?? false;
        
        // 恢复自定义属性
        if (data.customProperties) {
            for (const [key, value] of Object.entries(data.customProperties)) {
                obj.customProperties.set(key, value);
            }
        }
        
        return obj;
    }

    /**
     * 转换为JSON数据
     * @returns {Object}
     */
    toJSON() {
        return {
            id: this.id,
            type: this.type,
            name: this.name,
            objectId: this.objectId,
            transform: {
                position: {
                    x: this.transform.position.x,
                    y: this.transform.position.y
                },
                rotation: this.transform.rotation,
                scale: {
                    x: this.transform.scale.x,
                    y: this.transform.scale.y
                }
            },
            color: this.color,
            visible: this.visible,
            selected: this.selected,
            locked: this.locked,
            customProperties: Object.fromEntries(this.customProperties),
            createdAt: this.createdAt.toISOString(),
            updatedAt: this.updatedAt.toISOString()
        };
    }

    /**
     * 验证对象数据
     * @returns {boolean}
     */
    validate() {
        return this.id && 
               this.type && 
               this.objectId > 0 && 
               this.transform instanceof Transform2D;
    }

    /**
     * 获取显示名称
     * @returns {string}
     */
    getDisplayName() {
        return this.name || `${this.type}_${this.objectId}`;
    }

    /**
     * 获取世界边界矩形
     * @returns {Rectangle}
     */
    getBounds() {
        // 子类应该重写此方法
        const pos = this.getPosition();
        return new Rectangle(pos.x, pos.y, 0, 0);
    }

    /**
     * 检查点是否在对象内
     * @param {Vector2} point - 点坐标
     * @returns {boolean}
     */
    containsPoint(point) {
        return this.getBounds().contains(point);
    }

    /**
     * 设置可见性
     * @param {boolean} visible - 是否可见
     * @returns {ObjectBase}
     */
    setVisible(visible) {
        this.visible = visible;
        return this.touch();
    }

    /**
     * 设置选中状态
     * @param {boolean} selected - 是否选中
     * @returns {ObjectBase}
     */
    setSelected(selected) {
        this.selected = selected;
        return this.touch();
    }

    /**
     * 设置锁定状态
     * @param {boolean} locked - 是否锁定
     * @returns {ObjectBase}
     */
    setLocked(locked) {
        this.locked = locked;
        return this.touch();
    }

    /**
     * 检查是否可交互
     * @returns {boolean}
     */
    isInteractive() {
        return this.visible && !this.locked;
    }

    /**
     * 应用变换到本地点
     * @param {Vector2} localPoint - 本地坐标点
     * @returns {Vector2} 世界坐标点
     */
    localToWorld(localPoint) {
        return this.transform.transformPoint(localPoint);
    }

    /**
     * 将世界坐标转换为本地坐标
     * @param {Vector2} worldPoint - 世界坐标点
     * @returns {Vector2} 本地坐标点
     */
    worldToLocal(worldPoint) {
        return this.transform.inverseTransformPoint(worldPoint);
    }
}

