import ObjectBase from './ObjectBase.js';
import { Vector2, Rectangle, Color } from '../math/GraphicsMath.js';

/**
 * 文本内容类 - 继承自ObjectBase
 * 用于在场景中放置纯文本内容
 */
export class TextContent extends ObjectBase {
    /**
     * 构造函数
     * @param {Object} options - 文本选项
     * @param {string} options.text - 文本内容
     * @param {number} options.width - 宽度
     * @param {number} options.height - 高度
     * @param {boolean} options.autoSize - 是否自适应尺寸
     * @param {number} options.fontSize - 字体大小
     * @param {number} options.lineHeight - 行高
     * @param {Color|string} options.fontColor - 文字颜色
     * @param {string} options.fontFamily - 字体族
     * @param {string} options.fontWeight - 字体粗细
     * @param {string} options.fontStyle - 字体样式
     * @param {string} options.textAlign - 文本对齐
     * @param {string} options.textVerticalAlign - 垂直对齐
     * @param {number} options.wordWrap - 是否自动换行
     * @param {number} options.maxWidth - 最大宽度
     * @param {number} options.maxHeight - 最大高度
     * @param {number} options.padding - 内边距
     */
    constructor(options = {}) {
        super('text', options);
        
        // 文本内容
        this.text = options.text || '';
        
        // 尺寸属性
        this.width = options.width || 200;
        this.height = options.height || 100;
        this.autoSize = options.autoSize !== false; // 默认为true
        
        // 字体属性
        this.fontSize = options.fontSize || 14;
        this.lineHeight = options.lineHeight || 1.5;
        this.fontColor = options.fontColor ? new Color(options.fontColor) : new Color('#000000');
        this.fontFamily = options.fontFamily || 'Arial, sans-serif';
        this.fontWeight = options.fontWeight || 'normal';
        this.fontStyle = options.fontStyle || 'normal';
        
        // 文本布局
        this.textAlign = options.textAlign || 'left'; // left, center, right, justify
        this.textVerticalAlign = options.textVerticalAlign || 'top'; // top, middle, bottom
        
        // 文本处理
        this.wordWrap = options.wordWrap !== false; // 默认为true
        this.maxWidth = options.maxWidth || 0;
        this.maxHeight = options.maxHeight || 0;
        this.padding = options.padding || 10;
        
        // 文本状态
        this.isEditing = false;
        this.cursorPosition = 0;
        this.selectionStart = 0;
        this.selectionEnd = 0;
        
        // 缓存
        this._cachedLines = null;
        this._cachedBounds = null;
        this._needsRecalculation = true;
    }

    /**
     * 设置文本内容
     * @param {string} text - 文本内容
     * @returns {TextContent}
     */
    setText(text) {
        this.text = text || '';
        this._needsRecalculation = true;
        return this.touch();
    }

    /**
     * 获取文本内容
     * @returns {string}
     */
    getText() {
        return this.text;
    }

    /**
     * 设置尺寸
     * @param {number} width - 宽度
     * @param {number} height - 高度
     * @returns {TextContent}
     */
    setSize(width, height) {
        this.width = width;
        this.height = height;
        this._needsRecalculation = true;
        return this.touch();
    }

    /**
     * 获取尺寸
     * @returns {Vector2}
     */
    getSize() {
        if (this.autoSize && this._needsRecalculation) {
            this._calculateAutoSize();
        }
        return new Vector2(this.width, this.height);
    }

    /**
     * 设置字体大小
     * @param {number} fontSize - 字体大小
     * @returns {TextContent}
     */
    setFontSize(fontSize) {
        this.fontSize = Math.max(1, fontSize);
        this._needsRecalculation = true;
        return this.touch();
    }

    /**
     * 设置字体颜色
     * @param {Color|string} fontColor - 字体颜色
     * @returns {TextContent}
     */
    setFontColor(fontColor) {
        this.fontColor = fontColor instanceof Color ? fontColor : new Color(fontColor);
        return this.touch();
    }

    /**
     * 设置行高
     * @param {number} lineHeight - 行高
     * @returns {TextContent}
     */
    setLineHeight(lineHeight) {
        this.lineHeight = Math.max(0.5, lineHeight);
        this._needsRecalculation = true;
        return this.touch();
    }

    /**
     * 启用/禁用自动尺寸
     * @param {boolean} autoSize - 是否自动尺寸
     * @returns {TextContent}
     */
    setAutoSize(autoSize) {
        this.autoSize = autoSize;
        this._needsRecalculation = true;
        return this.touch();
    }

    /**
     * 获取文本行数
     * @returns {number}
     */
    getLineCount() {
        if (this._needsRecalculation) {
            this._calculateLines();
        }
        return this._cachedLines.length;
    }

    /**
     * 获取指定行的文本
     * @param {number} lineIndex - 行索引
     * @returns {string}
     */
    getLine(lineIndex) {
        if (this._needsRecalculation) {
            this._calculateLines();
        }
        return this._cachedLines[lineIndex] || '';
    }

    /**
     * 获取所有行
     * @returns {string[]}
     */
    getLines() {
        if (this._needsRecalculation) {
            this._calculateLines();
        }
        return [...this._cachedLines];
    }

    /**
     * 计算自动尺寸
     * @private
     */
    _calculateAutoSize() {
        if (!this.text) {
            this.width = 100;
            this.height = this.fontSize * this.lineHeight;
            return;
        }

        const lines = this._calculateLines();
        const maxLineWidth = Math.max(...lines.map(line => this._calculateLineWidth(line)));
        
        this.width = Math.max(100, maxLineWidth + this.padding * 2);
        this.height = Math.max(
            this.fontSize * this.lineHeight,
            lines.length * this.fontSize * this.lineHeight + this.padding * 2
        );
    }

    /**
     * 计算文本行
     * @private
     * @returns {string[]}
     */
    _calculateLines() {
        if (!this.text) {
            this._cachedLines = [''];
            return this._cachedLines;
        }

        const lines = this.text.split('\n');
        
        if (!this.wordWrap) {
            this._cachedLines = lines;
            return this._cachedLines;
        }

        const wrappedLines = [];
        const maxWidth = this.maxWidth > 0 ? this.maxWidth : this.width - this.padding * 2;

        for (const line of lines) {
            if (this._calculateLineWidth(line) <= maxWidth) {
                wrappedLines.push(line);
            } else {
                // 简单的换行逻辑
                const words = line.split(' ');
                let currentLine = '';
                
                for (const word of words) {
                    const testLine = currentLine ? `${currentLine} ${word}` : word;
                    if (this._calculateLineWidth(testLine) <= maxWidth) {
                        currentLine = testLine;
                    } else {
                        if (currentLine) {
                            wrappedLines.push(currentLine);
                            currentLine = word;
                        } else {
                            // 单词太长，强制换行
                            wrappedLines.push(word);
                        }
                    }
                }
                
                if (currentLine) {
                    wrappedLines.push(currentLine);
                }
            }
        }

        this._cachedLines = wrappedLines;
        return this._cachedLines;
    }

    /**
     * 计算行宽度
     * @private
     * @param {string} line - 行文本
     * @returns {number}
     */
    _calculateLineWidth(line) {
        // 简化实现：假设每个字符宽度为字体大小的0.6倍
        return line.length * this.fontSize * 0.6;
    }

    /**
     * 获取世界边界矩形
     * @returns {Rectangle}
     */
    getBounds() {
        if (this._needsRecalculation) {
            this._calculateAutoSize();
        }
        
        const pos = this.getPosition();
        return new Rectangle(pos.x, pos.y, this.width, this.height);
    }

    /**
     * 检查点是否在文本区域内
     * @param {Vector2} point - 点坐标
     * @returns {boolean}
     */
    containsPoint(point) {
        return this.getBounds().contains(point);
    }

    /**
     * 获取文本在指定位置的字符索引
     * @param {Vector2} localPoint - 本地坐标点
     * @returns {number}
     */
    getCharacterIndexAt(localPoint) {
        if (this._needsRecalculation) {
            this._calculateLines();
        }

        const x = localPoint.x - this.padding;
        const y = localPoint.y - this.padding;
        
        const lineHeight = this.fontSize * this.lineHeight;
        const lineIndex = Math.floor(y / lineHeight);
        
        if (lineIndex < 0) return 0;
        if (lineIndex >= this._cachedLines.length) return this.text.length;
        
        const line = this._cachedLines[lineIndex];
        const charIndex = Math.floor(x / (this.fontSize * 0.6));
        
        return Math.min(Math.max(0, charIndex), line.length);
    }

    /**
     * 验证文本内容
     * @returns {boolean}
     */
    validate() {
        this.errors = [];
        this.warnings = [];
        
        // 基础验证
        if (this.fontSize <= 0) {
            this.errors.push('字体大小必须大于0');
        }
        
        if (this.lineHeight <= 0) {
            this.errors.push('行高必须大于0');
        }
        
        if (this.width <= 0 || this.height <= 0) {
            this.errors.push('文本尺寸必须大于0');
        }
        
        // 警告
        if (this.text.length > 1000) {
            this.warnings.push('文本内容过长，可能影响性能');
        }
        
        this.valid = this.errors.length === 0;
        return this.valid;
    }

    /**
     * 克隆文本对象
     * @returns {TextContent}
     */
    clone() {
        return TextContent.fromData(this.toJSON());
    }

    /**
     * 从数据创建文本对象
     * @param {Object} data - 文本数据
     * @returns {TextContent}
     */
    static fromData(data) {
        const text = new TextContent({
            text: data.text,
            width: data.width,
            height: data.height,
            autoSize: data.autoSize,
            fontSize: data.fontSize,
            lineHeight: data.lineHeight,
            fontColor: data.fontColor,
            fontFamily: data.fontFamily,
            fontWeight: data.fontWeight,
            fontStyle: data.fontStyle,
            textAlign: data.textAlign,
            textVerticalAlign: data.textVerticalAlign,
            wordWrap: data.wordWrap,
            maxWidth: data.maxWidth,
            maxHeight: data.maxHeight,
            padding: data.padding
        });
        
        // 恢复基础属性
        text.id = data.id;
        text.createdAt = data.createdAt ? new Date(data.createdAt) : new Date();
        text.updatedAt = data.updatedAt ? new Date(data.updatedAt) : new Date();
        
        // 恢复状态
        text.visible = data.visible !== false;
        text.selected = data.selected || false;
        text.locked = data.locked || false;
        
        // 恢复自定义属性
        if (data.customProperties) {
            text.customProperties = new Map(Object.entries(data.customProperties));
        }
        
        return text;
    }

    /**
     * 转换为JSON对象
     * @returns {Object}
     */
    toJSON() {
        return {
            id: this.id,
            type: this.type,
            text: this.text,
            width: this.width,
            height: this.height,
            autoSize: this.autoSize,
            fontSize: this.fontSize,
            lineHeight: this.lineHeight,
            fontColor: this.fontColor.toString(),
            fontFamily: this.fontFamily,
            fontWeight: this.fontWeight,
            fontStyle: this.fontStyle,
            textAlign: this.textAlign,
            textVerticalAlign: this.textVerticalAlign,
            wordWrap: this.wordWrap,
            maxWidth: this.maxWidth,
            maxHeight: this.maxHeight,
            padding: this.padding,
            visible: this.visible,
            selected: this.selected,
            locked: this.locked,
            createdAt: this.createdAt.toISOString(),
            updatedAt: this.updatedAt.toISOString(),
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
     * 获取显示名称
     * @returns {string}
     */
    getDisplayName() {
        const preview = this.text.length > 20 ? this.text.substring(0, 20) + '...' : this.text;
        return `文本: ${preview}`;
    }
}

export default TextContent;