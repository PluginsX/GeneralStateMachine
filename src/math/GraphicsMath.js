/**
 * 图形学基础数据结构
 * 提供2D/3D图形学中常用的基本数据结构实现
 * 包括向量、矩阵、变换、颜色等基础类型
 */

/**
 * 2D向量类
 */
export class Vector2 {
    /**
     * 构造函数
     * @param {number} x - X坐标
     * @param {number} y - Y坐标
     */
    constructor(x = 0, y = 0) {
        this.x = x;
        this.y = y;
    }

    /**
     * 从数组创建向量
     * @param {number[]} array - 包含2个元素的数组
     * @returns {Vector2}
     */
    static fromArray(array) {
        return new Vector2(array[0] || 0, array[1] || 0);
    }

    /**
     * 复制向量
     * @returns {Vector2}
     */
    clone() {
        return new Vector2(this.x, this.y);
    }

    /**
     * 向量加法
     * @param {Vector2} v - 另一个向量
     * @returns {Vector2}
     */
    add(v) {
        return new Vector2(this.x + v.x, this.y + v.y);
    }

    /**
     * 向量减法
     * @param {Vector2} v - 另一个向量
     * @returns {Vector2}
     */
    subtract(v) {
        return new Vector2(this.x - v.x, this.y - v.y);
    }

    /**
     * 向量乘法（标量）
     * @param {number} scalar - 标量
     * @returns {Vector2}
     */
    multiply(scalar) {
        return new Vector2(this.x * scalar, this.y * scalar);
    }

    /**
     * 向量除法（标量）
     * @param {number} scalar - 标量
     * @returns {Vector2}
     */
    divide(scalar) {
        return new Vector2(this.x / scalar, this.y / scalar);
    }

    /**
     * 计算向量长度
     * @returns {number}
     */
    magnitude() {
        return Math.sqrt(this.x * this.x + this.y * this.y);
    }

    /**
     * 计算向量长度的平方
     * @returns {number}
     */
    magnitudeSquared() {
        return this.x * this.x + this.y * this.y;
    }

    /**
     * 归一化向量
     * @returns {Vector2}
     */
    normalize() {
        const mag = this.magnitude();
        if (mag === 0) return new Vector2(0, 0);
        return this.divide(mag);
    }

    /**
     * 计算点积
     * @param {Vector2} v - 另一个向量
     * @returns {number}
     */
    dot(v) {
        return this.x * v.x + this.y * v.y;
    }

    /**
     * 计算叉积（2D中返回标量）
     * @param {Vector2} v - 另一个向量
     * @returns {number}
     */
    cross(v) {
        return this.x * v.y - this.y * v.x;
    }

    /**
     * 计算距离
     * @param {Vector2} v - 另一个向量
     * @returns {number}
     */
    distanceTo(v) {
        return this.subtract(v).magnitude();
    }

    /**
     * 线性插值
     * @param {Vector2} v - 目标向量
     * @param {number} t - 插值参数 [0, 1]
     * @returns {Vector2}
     */
    lerp(v, t) {
        return this.add(v.subtract(this).multiply(t));
    }

    /**
     * 旋转向量
     * @param {number} angle - 旋转角度（弧度）
     * @returns {Vector2}
     */
    rotate(angle) {
        const cos = Math.cos(angle);
        const sin = Math.sin(angle);
        return new Vector2(
            this.x * cos - this.y * sin,
            this.x * sin + this.y * cos
        );
    }

    /**
     * 转换为数组
     * @returns {number[]}
     */
    toArray() {
        return [this.x, this.y];
    }

    /**
     * 转换为字符串
     * @returns {string}
     */
    toString() {
        return `Vector2(${this.x}, ${this.y})`;
    }

    /**
     * 判断是否相等
     * @param {Vector2} v - 另一个向量
     * @param {number} epsilon - 误差范围
     * @returns {boolean}
     */
    equals(v, epsilon = 1e-6) {
        return Math.abs(this.x - v.x) < epsilon && Math.abs(this.y - v.y) < epsilon;
    }
}

/**
 * 3D向量类
 */
export class Vector3 {
    /**
     * 构造函数
     * @param {number} x - X坐标
     * @param {number} y - Y坐标
     * @param {number} z - Z坐标
     */
    constructor(x = 0, y = 0, z = 0) {
        this.x = x;
        this.y = y;
        this.z = z;
    }

    /**
     * 从数组创建向量
     * @param {number[]} array - 包含3个元素的数组
     * @returns {Vector3}
     */
    static fromArray(array) {
        return new Vector3(array[0] || 0, array[1] || 0, array[2] || 0);
    }

    /**
     * 复制向量
     * @returns {Vector3}
     */
    clone() {
        return new Vector3(this.x, this.y, this.z);
    }

    /**
     * 向量加法
     * @param {Vector3} v - 另一个向量
     * @returns {Vector3}
     */
    add(v) {
        return new Vector3(this.x + v.x, this.y + v.y, this.z + v.z);
    }

    /**
     * 向量减法
     * @param {Vector3} v - 另一个向量
     * @returns {Vector3}
     */
    subtract(v) {
        return new Vector3(this.x - v.x, this.y - v.y, this.z - v.z);
    }

    /**
     * 向量乘法（标量）
     * @param {number} scalar - 标量
     * @returns {Vector3}
     */
    multiply(scalar) {
        return new Vector3(this.x * scalar, this.y * scalar, this.z * scalar);
    }

    /**
     * 向量除法（标量）
     * @param {number} scalar - 标量
     * @returns {Vector3}
     */
    divide(scalar) {
        return new Vector3(this.x / scalar, this.y / scalar, this.z / scalar);
    }

    /**
     * 计算向量长度
     * @returns {number}
     */
    magnitude() {
        return Math.sqrt(this.x * this.x + this.y * this.y + this.z * this.z);
    }

    /**
     * 计算向量长度的平方
     * @returns {number}
     */
    magnitudeSquared() {
        return this.x * this.x + this.y * this.y + this.z * this.z;
    }

    /**
     * 归一化向量
     * @returns {Vector3}
     */
    normalize() {
        const mag = this.magnitude();
        if (mag === 0) return new Vector3(0, 0, 0);
        return this.divide(mag);
    }

    /**
     * 计算点积
     * @param {Vector3} v - 另一个向量
     * @returns {number}
     */
    dot(v) {
        return this.x * v.x + this.y * v.y + this.z * v.z;
    }

    /**
     * 计算叉积
     * @param {Vector3} v - 另一个向量
     * @returns {Vector3}
     */
    cross(v) {
        return new Vector3(
            this.y * v.z - this.z * v.y,
            this.z * v.x - this.x * v.z,
            this.x * v.y - this.y * v.x
        );
    }

    /**
     * 计算距离
     * @param {Vector3} v - 另一个向量
     * @returns {number}
     */
    distanceTo(v) {
        return this.subtract(v).magnitude();
    }

    /**
     * 线性插值
     * @param {Vector3} v - 目标向量
     * @param {number} t - 插值参数 [0, 1]
     * @returns {Vector3}
     */
    lerp(v, t) {
        return this.add(v.subtract(this).multiply(t));
    }

    /**
     * 转换为数组
     * @returns {number[]}
     */
    toArray() {
        return [this.x, this.y, this.z];
    }

    /**
     * 转换为字符串
     * @returns {string}
     */
    toString() {
        return `Vector3(${this.x}, ${this.y}, ${this.z})`;
    }

    /**
     * 判断是否相等
     * @param {Vector3} v - 另一个向量
     * @param {number} epsilon - 误差范围
     * @returns {boolean}
     */
    equals(v, epsilon = 1e-6) {
        return Math.abs(this.x - v.x) < epsilon && 
               Math.abs(this.y - v.y) < epsilon && 
               Math.abs(this.z - v.z) < epsilon;
    }
}

/**
 * 颜色类
 */
export class Color {
    /**
     * 构造函数
     * @param {number} r - 红色分量 [0, 255]
     * @param {number} g - 绿色分量 [0, 255]
     * @param {number} b - 蓝色分量 [0, 255]
     * @param {number} a - 透明度 [0, 1]
     */
    constructor(r = 255, g = 255, b = 255, a = 1) {
        this.r = Math.max(0, Math.min(255, r));
        this.g = Math.max(0, Math.min(255, g));
        this.b = Math.max(0, Math.min(255, b));
        this.a = Math.max(0, Math.min(1, a));
    }

    /**
     * 从十六进制字符串创建颜色
     * @param {string} hex - 十六进制颜色字符串 (#RRGGBB 或 #RGB)
     * @returns {Color}
     */
    static fromHex(hex) {
        const result = /^#?([a-f\d]{2})([a-f\d]{2})([a-f\d]{2})$/i.exec(hex);
        if (!result) {
            // 处理简写格式 #RGB
            const shortResult = /^#?([a-f\d])([a-f\d])([a-f\d])$/i.exec(hex);
            if (shortResult) {
                return new Color(
                    parseInt(shortResult[1] + shortResult[1], 16),
                    parseInt(shortResult[2] + shortResult[2], 16),
                    parseInt(shortResult[3] + shortResult[3], 16)
                );
            }
            return new Color();
        }
        return new Color(
            parseInt(result[1], 16),
            parseInt(result[2], 16),
            parseInt(result[3], 16)
        );
    }

    /**
     * 从RGB字符串创建颜色
     * @param {string} rgb - RGB字符串 (rgb(r, g, b) 或 rgba(r, g, b, a))
     * @returns {Color}
     */
    static fromRGB(rgb) {
        const match = rgb.match(/rgba?\((\d+),\s*(\d+),\s*(\d+)(?:,\s*([\d.]+))?\)/);
        if (!match) return new Color();
        
        return new Color(
            parseInt(match[1]),
            parseInt(match[2]),
            parseInt(match[3]),
            match[4] ? parseFloat(match[4]) : 1
        );
    }

    /**
     * 复制颜色
     * @returns {Color}
     */
    clone() {
        return new Color(this.r, this.g, this.b, this.a);
    }

    /**
     * 转换为十六进制字符串
     * @returns {string}
     */
    toHex() {
        const toHex = (n) => {
            const hex = Math.round(n).toString(16);
            return hex.length === 1 ? '0' + hex : hex;
        };
        return `#${toHex(this.r)}${toHex(this.g)}${toHex(this.b)}`;
    }

    /**
     * 转换为RGB字符串
     * @returns {string}
     */
    toRGB() {
        if (this.a < 1) {
            return `rgba(${this.r}, ${this.g}, ${this.b}, ${this.a})`;
        }
        return `rgb(${this.r}, ${this.g}, ${this.b})`;
    }

    /**
     * 线性插值
     * @param {Color} color - 目标颜色
     * @param {number} t - 插值参数 [0, 1]
     * @returns {Color}
     */
    lerp(color, t) {
        return new Color(
            this.r + (color.r - this.r) * t,
            this.g + (color.g - this.g) * t,
            this.b + (color.b - this.b) * t,
            this.a + (color.a - this.a) * t
        );
    }

    /**
     * 判断是否相等
     * @param {Color} color - 另一个颜色
     * @returns {boolean}
     */
    equals(color) {
        return this.r === color.r && 
               this.g === color.g && 
               this.b === color.b && 
               this.a === color.a;
    }

    /**
     * 转换为数组
     * @returns {number[]}
     */
    toArray() {
        return [this.r, this.g, this.b, this.a];
    }

    /**
     * 转换为字符串
     * @returns {string}
     */
    toString() {
        return this.toRGB();
    }
}

/**
 * 矩形类
 */
export class Rectangle {
    /**
     * 构造函数
     * @param {number} x - X坐标
     * @param {number} y - Y坐标
     * @param {number} width - 宽度
     * @param {number} height - 高度
     */
    constructor(x = 0, y = 0, width = 0, height = 0) {
        this.x = x;
        this.y = y;
        this.width = width;
        this.height = height;
    }

    /**
     * 从位置和大小创建矩形
     * @param {Vector2} position - 位置
     * @param {Vector2} size - 大小
     * @returns {Rectangle}
     */
    static fromPositionAndSize(position, size) {
        return new Rectangle(position.x, position.y, size.x, size.y);
    }

    /**
     * 复制矩形
     * @returns {Rectangle}
     */
    clone() {
        return new Rectangle(this.x, this.y, this.width, this.height);
    }

    /**
     * 获取左边界
     * @returns {number}
     */
    get left() {
        return this.x;
    }

    /**
     * 获取右边界
     * @returns {number}
     */
    get right() {
        return this.x + this.width;
    }

    /**
     * 获取上边界
     * @returns {number}
     */
    get top() {
        return this.y;
    }

    /**
     * 获取下边界
     * @returns {number}
     */
    get bottom() {
        return this.y + this.height;
    }

    /**
     * 获取中心点
     * @returns {Vector2}
     */
    get center() {
        return new Vector2(this.x + this.width / 2, this.y + this.height / 2);
    }

    /**
     * 获取大小
     * @returns {Vector2}
     */
    get size() {
        return new Vector2(this.width, this.height);
    }

    /**
     * 获取位置
     * @returns {Vector2}
     */
    get position() {
        return new Vector2(this.x, this.y);
    }

    /**
     * 检查点是否在矩形内
     * @param {Vector2} point - 点
     * @returns {boolean}
     */
    contains(point) {
        return point.x >= this.x && point.x <= this.right &&
               point.y >= this.y && point.y <= this.bottom;
    }

    /**
     * 检查是否与另一个矩形相交
     * @param {Rectangle} rect - 另一个矩形
     * @returns {boolean}
     */
    intersects(rect) {
        return !(this.right < rect.left || this.left > rect.right ||
                this.bottom < rect.top || this.top > rect.bottom);
    }

    /**
     * 计算与另一个矩形的交集
     * @param {Rectangle} rect - 另一个矩形
     * @returns {Rectangle|null}
     */
    intersection(rect) {
        if (!this.intersects(rect)) return null;
        
        const x = Math.max(this.x, rect.x);
        const y = Math.max(this.y, rect.y);
        const width = Math.min(this.right, rect.right) - x;
        const height = Math.min(this.bottom, rect.bottom) - y;
        
        return new Rectangle(x, y, width, height);
    }

    /**
     * 计算包含另一个矩形的最小矩形
     * @param {Rectangle} rect - 另一个矩形
     * @returns {Rectangle}
     */
    union(rect) {
        const x = Math.min(this.x, rect.x);
        const y = Math.min(this.y, rect.y);
        const width = Math.max(this.right, rect.right) - x;
        const height = Math.max(this.bottom, rect.bottom) - y;
        
        return new Rectangle(x, y, width, height);
    }

    /**
     * 膨胀矩形
     * @param {number} amount - 膨胀量
     * @returns {Rectangle}
     */
    inflate(amount) {
        return new Rectangle(
            this.x - amount,
            this.y - amount,
            this.width + amount * 2,
            this.height + amount * 2
        );
    }

    /**
     * 转换为数组
     * @returns {number[]}
     */
    toArray() {
        return [this.x, this.y, this.width, this.height];
    }

    /**
     * 转换为字符串
     * @returns {string}
     */
    toString() {
        return `Rectangle(${this.x}, ${this.y}, ${this.width}, ${this.height})`;
    }
}

// 常用颜色常量
export const Colors = {
    WHITE: new Color(255, 255, 255),
    BLACK: new Color(0, 0, 0),
    RED: new Color(255, 0, 0),
    GREEN: new Color(0, 255, 0),
    BLUE: new Color(0, 0, 255),
    YELLOW: new Color(255, 255, 0),
    CYAN: new Color(0, 255, 255),
    MAGENTA: new Color(255, 0, 255),
    GRAY: new Color(128, 128, 128),
    LIGHT_GRAY: new Color(192, 192, 192),
    DARK_GRAY: new Color(64, 64, 64),
    ORANGE: new Color(255, 165, 0),
    PURPLE: new Color(128, 0, 128),
    PINK: new Color(255, 192, 203),
    BROWN: new Color(165, 42, 42),
    TRANSPARENT: new Color(255, 255, 255, 0)
};

// 常用向量常量
export const Vectors = {
    ZERO2: new Vector2(0, 0),
    ONE2: new Vector2(1, 1),
    UP2: new Vector2(0, -1),
    DOWN2: new Vector2(0, 1),
    LEFT2: new Vector2(-1, 0),
    RIGHT2: new Vector2(1, 0),
    
    ZERO3: new Vector3(0, 0, 0),
    ONE3: new Vector3(1, 1, 1),
    UP3: new Vector3(0, 1, 0),
    DOWN3: new Vector3(0, -1, 0),
    LEFT3: new Vector3(-1, 0, 0),
    RIGHT3: new Vector3(1, 0, 0),
    FORWARD3: new Vector3(0, 0, -1),
    BACK3: new Vector3(0, 0, 1)
};