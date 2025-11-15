// 节点数据模型 - 纯数据，不包含业务逻辑
import ObjectBase from './ObjectBase.js';
import { Vector2, Rectangle } from '../math/GraphicsMath.js';
import { Transform2D } from '../math/Transform.js';

export default class NodeModel extends ObjectBase {
    /**
     * 构造函数
     * @param {Object} options - 配置选项
     * @param {string} options.id - 节点ID
     * @param {string} options.name - 节点名称
     * @param {string} options.type - 节点类型
     * @param {Vector2} options.position - 位置
     * @param {number} options.width - 宽度
     * @param {number} options.height - 高度
     * @param {string} options.color - 节点颜色
     * @param {Object} options.data - 节点数据
     * @param {Array} options.inputs - 输入端口
     * @param {Array} options.outputs - 输出端口
     * @param {Transform2D} options.transform - 变换属性
     * @param {number} options.objectId - 对象ID
     */
    constructor(options = {}) {
        super({
            type: options.type || 'node',
            name: options.name,
            transform: options.transform || new Transform2D(
                options.position || new Vector2(),
                0,
                new Vector2(1, 1)
            ),
            objectId: options.objectId,
            color: options.color
        });

        // 节点特有属性
        this.id = options.id || this.id;
        this.width = options.width || 150;
        this.height = options.height || 50;
        this.data = options.data || {};
        this.description = options.description || '';
        this.group = options.group || 'root';
        
        // 尺寸属性
        this.autoSize = options.autoSize || false;
        this.minWidth = options.minWidth || 50;
        this.minHeight = options.minHeight || 50;
        this.padding = options.padding || 20;
        
        // 端口定义
        this.inputs = options.inputs || [];
        this.outputs = options.outputs || [];
        
        // 力导向图参数
        this.fx = null; // 固定x位置
        this.fy = null; // 固定y位置
        this.vx = 0; // x方向速度
        this.vy = 0; // y方向速度
        this.forceCharge = options.forceCharge || -300; // 电荷力强度
        this.forceCollideRadius = options.forceCollideRadius || null; // 碰撞力半径
        this.forceStrength = options.forceStrength || 1; // 节点强度系数
        this.fixedPosition = options.fixedPosition || false; // 是否固定位置
        
        // 节点状态
        this.expanded = options.expanded || false;
        this.minimized = options.minimized || false;
        
        // 视觉样式
        this.borderColor = options.borderColor || null;
        this.borderWidth = options.borderWidth || 2;
        this.borderStyle = options.borderStyle || 'solid';
        this.backgroundColor = options.backgroundColor || null;
        this.textColor = options.textColor || '#333333';
        this.fontSize = options.fontSize || 14;
        this.fontFamily = options.fontFamily || 'Arial, sans-serif';
        
        // 阴影效果
        this.shadowEnabled = options.shadowEnabled || false;
        this.shadowColor = options.shadowColor || 'rgba(0, 0, 0, 0.2)';
        this.shadowBlur = options.shadowBlur || 4;
        this.shadowOffsetX = options.shadowOffsetX || 2;
        this.shadowOffsetY = options.shadowOffsetY || 2;
        
        // 圆角
        this.borderRadius = options.borderRadius || 8;
        
        // 节点类型特定属性
        this.nodeType = options.nodeType || 'default';
        this.category = options.category || 'general';
        
        // 验证和状态
        this.valid = true;
        this.errors = [];
        this.warnings = [];
        
        // 性能优化相关
        this.lastRenderTime = 0;
        this.needsRedraw = true;
        
        // 交互状态
        this.hovered = false;
        this.dragging = false;
        this.resizing = false;
        
        // 自定义属性
        this.customProperties = new Map();
        if (options.customProperties) {
            for (const [key, value] of Object.entries(options.customProperties)) {
                this.customProperties.set(key, value);
            }
        }
    }
    
    /**
     * 复制节点（纯数据复制）
     * @returns {NodeModel}
     */
    clone() {
        const clone = new NodeModel({
            name: this.name,
            position: this.transform.position,
            width: this.width,
            height: this.height,
            color: this.color,
            description: this.description,
            group: this.group,
            autoSize: this.autoSize,
            minWidth: this.minWidth,
            minHeight: this.minHeight,
            padding: this.padding,
            forceCharge: this.forceCharge,
            forceCollideRadius: this.forceCollideRadius,
            forceStrength: this.forceStrength,
            fixedPosition: this.fixedPosition
        });
        clone.id = this.id;
        clone.createdAt = this.createdAt;
        clone.updatedAt = this.updatedAt;
        return clone;
    }
    
    /**
     * 从数据创建节点
     * @param {Object} data - 节点数据
     * @returns {NodeModel}
     */
    static fromData(data) {
        const node = new NodeModel({
            type: data.type || 'default',
            name: data.name,
            description: data.description,
            position: data.transform ? new Vector2(data.transform.position.x, data.transform.position.y) : new Vector2(data.x || 0, data.y || 0),
            width: data.width,
            height: data.height,
            color: data.color,
            fontSize: data.fontSize,
            inputs: data.inputs || [],
            outputs: data.outputs || [],
            forceDirected: data.forceDirected,
            visualStyle: data.visualStyle
        });
        
        // 恢复Transform属性
        if (data.transform) {
            node.transform.position = new Vector2(
                data.transform.position.x || 0,
                data.transform.position.y || 0
            );
            node.transform.rotation = data.transform.rotation || 0;
            node.transform.scale = new Vector2(
                data.transform.scale.x || 1,
                data.transform.scale.y || 1
            );
        }
        
        // 恢复基础属性
        node.id = data.id;
        node.createdAt = data.createdAt ? new Date(data.createdAt) : new Date();
        node.updatedAt = data.updatedAt ? new Date(data.updatedAt) : new Date();
        
        // 恢复状态
        node.visible = data.visible !== false;
        node.selected = data.selected || false;
        node.locked = data.locked || false;
        
        // 恢复自定义属性
        if (data.customProperties) {
            node.customProperties = new Map(Object.entries(data.customProperties));
        }
        
        // 恢复端口连接状态
        if (data.inputs) {
            node.inputs = data.inputs.map(input => ({
                ...input,
                connected: input.connected || false
            }));
        }
        
        if (data.outputs) {
            node.outputs = data.outputs.map(output => ({
                ...output,
                connected: output.connected || false
            }));
        }
        
        return node;
    }

    /**
     * 转换为JSON对象
     * @returns {Object}
     */
    toJSON() {
        return {
            id: this.id,
            type: this.type,
            name: this.name,
            description: this.description,
            width: this.width,
            height: this.height,
            minWidth: this.minWidth,
            minHeight: this.minHeight,
            color: this.color,
            fontSize: this.fontSize,
            padding: this.padding,
            visible: this.visible,
            selected: this.selected,
            locked: this.locked,
            createdAt: this.createdAt.toISOString(),
            updatedAt: this.updatedAt.toISOString(),
            inputs: this.inputs,
            outputs: this.outputs,
            forceDirected: this.forceDirected,
            visualStyle: this.visualStyle,
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
            customProperties: Object.fromEntries(this.customProperties)
        };
    }
    
    /**
     * 获取对象的显示名称
     * @returns {string}
     */
    getDisplayName() {
        return this.name || '未命名节点';
    }
    
    /**
     * 获取节点中心位置
     * @returns {Vector2}
     */
    getCenter() {
        return new Vector2(
            this.transform.position.x + this.width / 2,
            this.transform.position.y + this.height / 2
        );
    }

    /**
     * 设置节点位置
     * @param {Vector2|number} x - X坐标或Vector2对象
     * @param {number} y - Y坐标（当x为Vector2时可选）
     * @returns {NodeModel}
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
     * 获取节点位置
     * @returns {Vector2}
     */
    getPosition() {
        return this.transform.position.clone();
    }

    /**
     * 获取世界边界矩形
     * @returns {Rectangle}
     */
    getBounds() {
        const pos = this.getPosition();
        return new Rectangle(pos.x, pos.y, this.width, this.height);
    }

    /**
     * 检查点是否在节点内
     * @param {Vector2} point - 点坐标
     * @returns {boolean}
     */
    containsPoint(point) {
        return this.getBounds().contains(point);
    }

    /**
     * 设置节点尺寸
     * @param {number} width - 宽度
     * @param {number} height - 高度
     * @returns {NodeModel}
     */
    setSize(width, height) {
        this.width = Math.max(this.minWidth, width);
        this.height = Math.max(this.minHeight, height);
        return this.touch();
    }

    /**
     * 获取节点尺寸
     * @returns {Vector2}
     */
    getSize() {
        return new Vector2(this.width, this.height);
    }

    /**
     * 自动调整节点尺寸以适应内容
     * @returns {NodeModel}
     */
    autoSizeContent() {
        // 简化实现，实际应该根据文本内容计算
        const textWidth = this.name.length * this.fontSize * 0.6;
        const textHeight = this.fontSize + this.padding * 2;
        
        this.width = Math.max(this.minWidth, textWidth + this.padding * 2);
        this.height = Math.max(this.minHeight, textHeight);
        
        return this.touch();
    }

    /**
     * 添加输入端口
     * @param {Object} port - 端口配置
     * @returns {NodeModel}
     */
    addInput(port) {
        this.inputs.push({
            id: port.id || `input_${this.inputs.length}`,
            name: port.name || `Input ${this.inputs.length + 1}`,
            type: port.type || 'any',
            required: port.required || false,
            multiple: port.multiple || false,
            defaultValue: port.defaultValue || null,
            ...port
        });
        return this.touch();
    }

    /**
     * 添加输出端口
     * @param {Object} port - 端口配置
     * @returns {NodeModel}
     */
    addOutput(port) {
        this.outputs.push({
            id: port.id || `output_${this.outputs.length}`,
            name: port.name || `Output ${this.outputs.length + 1}`,
            type: port.type || 'any',
            multiple: port.multiple || false,
            ...port
        });
        return this.touch();
    }

    /**
     * 移除输入端口
     * @param {string} portId - 端口ID
     * @returns {NodeModel}
     */
    removeInput(portId) {
        this.inputs = this.inputs.filter(port => port.id !== portId);
        return this.touch();
    }

    /**
     * 移除输出端口
     * @param {string} portId - 端口ID
     * @returns {NodeModel}
     */
    removeOutput(portId) {
        this.outputs = this.outputs.filter(port => port.id !== portId);
        return this.touch();
    }

    /**
     * 获取输入端口
     * @param {string} portId - 端口ID
     * @returns {Object|null}
     */
    getInput(portId) {
        return this.inputs.find(port => port.id === portId) || null;
    }

    /**
     * 获取输出端口
     * @param {string} portId - 端口ID
     * @returns {Object|null}
     */
    getOutput(portId) {
        return this.outputs.find(port => port.id === portId) || null;
    }

    /**
     * 检查节点是否有效
     * @returns {{valid: boolean, errors: string[]}}
     */
    validate() {
        const baseValidation = super.validate();
        const errors = [...baseValidation.errors];
        
        if (!this.name || this.name.trim() === '') {
            errors.push('节点名称不能为空');
        }
        
        if (this.width < this.minWidth) {
            errors.push(`节点宽度不能小于${this.minWidth}`);
        }
        
        if (this.height < this.minHeight) {
            errors.push(`节点高度不能小于${this.minHeight}`);
        }
        
        // 端口验证
        const inputIds = this.inputs.map(p => p.id);
        const outputIds = this.outputs.map(p => p.id);
        
        if (new Set(inputIds).size !== inputIds.length) {
            errors.push('输入端口ID不能重复');
        }
        
        if (new Set(outputIds).size !== outputIds.length) {
            errors.push('输出端口ID不能重复');
        }
        
        // 检查必需的输入端口
        this.inputs.forEach(port => {
            if (port.required && !port.defaultValue && !port.connected) {
                this.warnings.push(`必需的输入端口"${port.name}"未连接`);
            }
        });
        
        return {
            valid: errors.length === 0,
            errors
        };
    }
}

