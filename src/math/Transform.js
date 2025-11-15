/**
 * 变换类
 * 实现图形学中的变换操作，包括位置、旋转和缩放
 */

import { Vector2, Vector3 } from './GraphicsMath.js';

/**
 * 2D变换类
 */
export class Transform2D {
    /**
     * 构造函数
     * @param {Vector2} position - 位置
     * @param {number} rotation - 旋转角度（弧度）
     * @param {Vector2} scale - 缩放
     */
    constructor(position = null, rotation = 0, scale = null) {
        this.position = position || new Vector2();
        this.rotation = rotation;
        this.scale = scale || new Vector2(1, 1);
    }

    /**
     * 创建单位变换
     * @returns {Transform2D}
     */
    static identity() {
        return new Transform2D(new Vector2(), 0, new Vector2(1, 1));
    }

    /**
     * 复制变换
     * @returns {Transform2D}
     */
    clone() {
        return new Transform2D(this.position.clone(), this.rotation, this.scale.clone());
    }

    /**
     * 重置为单位变换
     */
    reset() {
        this.position = new Vector2();
        this.rotation = 0;
        this.scale = new Vector2(1, 1);
    }

    /**
     * 平移变换
     * @param {Vector2} translation - 平移向量
     * @returns {Transform2D}
     */
    translate(translation) {
        this.position = this.position.add(translation);
        return this;
    }

    /**
     * 旋转变换
     * @param {number} angle - 旋转角度（弧度）
     * @returns {Transform2D}
     */
    rotate(angle) {
        this.rotation += angle;
        return this;
    }

    /**
     * 设置旋转角度
     * @param {number} angle - 旋转角度（弧度）
     * @returns {Transform2D}
     */
    setRotation(angle) {
        this.rotation = angle;
        return this;
    }

    /**
     * 缩放变换
     * @param {Vector2} scale - 缩放向量
     * @returns {Transform2D}
     */
    scaleBy(scale) {
        this.scale = this.scale.multiply(scale);
        return this;
    }

    /**
     * 设置缩放
     * @param {Vector2} scale - 缩放向量
     * @returns {Transform2D}
     */
    setScale(scale) {
        this.scale = scale.clone();
        return this;
    }

    /**
     * 应用变换到点
     * @param {Vector2} point - 输入点
     * @returns {Vector2} 变换后的点
     */
    transformPoint(point) {
        // 应用缩放
        let result = point.multiply(this.scale);
        // 应用旋转
        result = result.rotate(this.rotation);
        // 应用平移
        result = result.add(this.position);
        return result;
    }

    /**
     * 应用逆变换到点
     * @param {Vector2} point - 输入点
     * @returns {Vector2} 逆变换后的点
     */
    inverseTransformPoint(point) {
        // 逆平移
        let result = point.subtract(this.position);
        // 逆旋转
        result = result.rotate(-this.rotation);
        // 逆缩放
        result = new Vector2(result.x / this.scale.x, result.y / this.scale.y);
        return result;
    }

    /**
     * 组合另一个变换
     * @param {Transform2D} other - 另一个变换
     * @returns {Transform2D}
     */
    combine(other) {
        // 组合旋转
        this.rotation += other.rotation;
        
        // 组合缩放
        this.scale = this.scale.multiply(other.scale);
        
        // 组合位置（需要考虑旋转和缩放）
        const rotatedOtherPos = other.position.rotate(this.rotation);
        const scaledOtherPos = new Vector2(
            rotatedOtherPos.x * this.scale.x,
            rotatedOtherPos.y * this.scale.y
        );
        this.position = this.position.add(scaledOtherPos);
        
        return this;
    }

    /**
     * 线性插值到另一个变换
     * @param {Transform2D} other - 目标变换
     * @param {number} t - 插值参数 [0, 1]
     * @returns {Transform2D}
     */
    lerp(other, t) {
        return new Transform2D(
            this.position.lerp(other.position, t),
            this.rotation + (other.rotation - this.rotation) * t,
            this.position.lerp(other.scale, t)
        );
    }

    /**
     * 获取变换矩阵（3x3齐次坐标矩阵）
     * @returns {number[]} 3x3矩阵数组
     */
    getMatrix() {
        const cos = Math.cos(this.rotation);
        const sin = Math.sin(this.rotation);
        
        return [
            cos * this.scale.x, sin * this.scale.x, 0,
            -sin * this.scale.y, cos * this.scale.y, 0,
            this.position.x, this.position.y, 1
        ];
    }

    /**
     * 判断是否相等
     * @param {Transform2D} other - 另一个变换
     * @param {number} epsilon - 误差范围
     * @returns {boolean}
     */
    equals(other, epsilon = 1e-6) {
        return this.position.equals(other.position, epsilon) &&
               Math.abs(this.rotation - other.rotation) < epsilon &&
               this.scale.equals(other.scale, epsilon);
    }

    /**
     * 转换为字符串
     * @returns {string}
     */
    toString() {
        return `Transform2D(position: ${this.position}, rotation: ${this.rotation}, scale: ${this.scale})`;
    }
}

/**
 * 3D变换类
 */
export class Transform3D {
    /**
     * 构造函数
     * @param {Vector3} position - 位置
     * @param {Vector3} rotation - 欧拉角（弧度）
     * @param {Vector3} scale - 缩放
     */
    constructor(position = null, rotation = null, scale = null) {
        this.position = position || new Vector3();
        this.rotation = rotation || new Vector3(); // Euler angles: x(pitch), y(yaw), z(roll)
        this.scale = scale || new Vector3(1, 1, 1);
    }

    /**
     * 创建单位变换
     * @returns {Transform3D}
     */
    static identity() {
        return new Transform3D(new Vector3(), new Vector3(), new Vector3(1, 1, 1));
    }

    /**
     * 复制变换
     * @returns {Transform3D}
     */
    clone() {
        return new Transform3D(
            this.position.clone(),
            this.rotation.clone(),
            this.scale.clone()
        );
    }

    /**
     * 重置为单位变换
     */
    reset() {
        this.position = new Vector3();
        this.rotation = new Vector3();
        this.scale = new Vector3(1, 1, 1);
    }

    /**
     * 平移变换
     * @param {Vector3} translation - 平移向量
     * @returns {Transform3D}
     */
    translate(translation) {
        this.position = this.position.add(translation);
        return this;
    }

    /**
     * 旋转变换
     * @param {Vector3} rotation - 旋转向量（欧拉角，弧度）
     * @returns {Transform3D}
     */
    rotate(rotation) {
        this.rotation = this.rotation.add(rotation);
        return this;
    }

    /**
     * 设置旋转角度
     * @param {Vector3} rotation - 旋转向量（欧拉角，弧度）
     * @returns {Transform3D}
     */
    setRotation(rotation) {
        this.rotation = rotation.clone();
        return this;
    }

    /**
     * 缩放变换
     * @param {Vector3} scale - 缩放向量
     * @returns {Transform3D}
     */
    scaleBy(scale) {
        this.scale = this.scale.multiply(scale);
        return this;
    }

    /**
     * 设置缩放
     * @param {Vector3} scale - 缩放向量
     * @returns {Transform3D}
     */
    setScale(scale) {
        this.scale = scale.clone();
        return this;
    }

    /**
     * 应用变换到点
     * @param {Vector3} point - 输入点
     * @returns {Vector3} 变换后的点
     */
    transformPoint(point) {
        // 应用缩放
        let result = point.multiply(this.scale);
        // 应用旋转（简化版本，实际应该使用四元数或旋转矩阵）
        result = this._applyEulerRotation(result);
        // 应用平移
        result = result.add(this.position);
        return result;
    }

    /**
     * 应用逆变换到点
     * @param {Vector3} point - 输入点
     * @returns {Vector3} 逆变换后的点
     */
    inverseTransformPoint(point) {
        // 逆平移
        let result = point.subtract(this.position);
        // 逆旋转
        result = this._applyInverseEulerRotation(result);
        // 逆缩放
        result = new Vector3(
            result.x / this.scale.x,
            result.y / this.scale.y,
            result.z / this.scale.z
        );
        return result;
    }

    /**
     * 应用欧拉角旋转（简化实现）
     * @param {Vector3} point - 输入点
     * @returns {Vector3}
     */
    _applyEulerRotation(point) {
        let result = point.clone();
        
        // 绕X轴旋转（Pitch）
        const cosX = Math.cos(this.rotation.x);
        const sinX = Math.sin(this.rotation.x);
        const y1 = result.y * cosX - result.z * sinX;
        const z1 = result.y * sinX + result.z * cosX;
        result = new Vector3(result.x, y1, z1);
        
        // 绕Y轴旋转（Yaw）
        const cosY = Math.cos(this.rotation.y);
        const sinY = Math.sin(this.rotation.y);
        const x2 = result.x * cosY + result.z * sinY;
        const z2 = -result.x * sinY + result.z * cosY;
        result = new Vector3(x2, result.y, z2);
        
        // 绕Z轴旋转（Roll）
        const cosZ = Math.cos(this.rotation.z);
        const sinZ = Math.sin(this.rotation.z);
        const x3 = result.x * cosZ - result.y * sinZ;
        const y3 = result.x * sinZ + result.y * cosZ;
        result = new Vector3(x3, y3, result.z);
        
        return result;
    }

    /**
     * 应用逆欧拉角旋转
     * @param {Vector3} point - 输入点
     * @returns {Vector3}
     */
    _applyInverseEulerRotation(point) {
        // 逆旋转就是用负角度旋转
        const inverseRotation = this.rotation.multiply(-1);
        const tempRotation = this.rotation;
        this.rotation = inverseRotation;
        const result = this._applyEulerRotation(point);
        this.rotation = tempRotation;
        return result;
    }

    /**
     * 获取前方向向量
     * @returns {Vector3}
     */
    get forward() {
        return this._applyEulerRotation(new Vector3(0, 0, -1)).normalize();
    }

    /**
     * 获取右方向向量
     * @returns {Vector3}
     */
    get right() {
        return this._applyEulerRotation(new Vector3(1, 0, 0)).normalize();
    }

    /**
     * 获取上方向向量
     * @returns {Vector3}
     */
    get up() {
        return this._applyEulerRotation(new Vector3(0, 1, 0)).normalize();
    }

    /**
     * 线性插值到另一个变换
     * @param {Transform3D} other - 目标变换
     * @param {number} t - 插值参数 [0, 1]
     * @returns {Transform3D}
     */
    lerp(other, t) {
        return new Transform3D(
            this.position.lerp(other.position, t),
            this.position.lerp(other.rotation, t),
            this.position.lerp(other.scale, t)
        );
    }

    /**
     * 判断是否相等
     * @param {Transform3D} other - 另一个变换
     * @param {number} epsilon - 误差范围
     * @returns {boolean}
     */
    equals(other, epsilon = 1e-6) {
        return this.position.equals(other.position, epsilon) &&
               this.rotation.equals(other.rotation, epsilon) &&
               this.scale.equals(other.scale, epsilon);
    }

    /**
     * 转换为字符串
     * @returns {string}
     */
    toString() {
        return `Transform3D(position: ${this.position}, rotation: ${this.rotation}, scale: ${this.scale})`;
    }
}

// 导出常用的变换常量
export const Transforms = {
    IDENTITY_2D: Transform2D.identity(),
    IDENTITY_3D: Transform3D.identity()
};