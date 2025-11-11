// 箭头样式定义
/**
 * 箭头样式类型枚举
 */
export const ArrowStyleType = {
    TRIANGLE: 'triangle',      // 三角形箭头（默认）
    DIAMOND: 'diamond',        // 菱形箭头
    CIRCLE: 'circle',          // 圆形箭头
    ARROW: 'arrow',            // 箭头形状（带杆）
    NONE: 'none'               // 无箭头
};

/**
 * 箭头样式配置
 */
export class ArrowStyle {
    /**
     * 构造函数
     * @param {string} type - 箭头类型（ArrowStyleType）
     * @param {number} size - 箭头大小（像素）
     * @param {string} color - 箭头颜色
     */
    constructor(type = ArrowStyleType.TRIANGLE, size = 10, color = null) {
        this.type = type;
        this.size = size;
        this.color = color; // null表示使用连线颜色
    }
    
    /**
     * 复制箭头样式
     * @returns {ArrowStyle}
     */
    clone() {
        return new ArrowStyle(this.type, this.size, this.color);
    }
    
    /**
     * 从数据恢复箭头样式
     * @param {Object} data - 箭头样式数据
     * @returns {ArrowStyle}
     */
    static fromData(data) {
        if (!data) return null;
        return new ArrowStyle(data.type, data.size, data.color);
    }
    
    /**
     * 转换为JSON
     * @returns {Object}
     */
    toJSON() {
        return {
            type: this.type,
            size: this.size,
            color: this.color
        };
    }
}

/**
 * 默认箭头样式
 */
export const DEFAULT_ARROW_STYLE = new ArrowStyle(
    ArrowStyleType.TRIANGLE,
    10,
    null
);

