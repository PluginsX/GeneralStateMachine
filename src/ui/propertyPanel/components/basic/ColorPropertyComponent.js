import PropertyComponentBase from '../PropertyComponentBase.js';

class ColorPropertyComponent extends PropertyComponentBase {
  constructor(propertyName, propertyValue, onChangeCallback, options = {}) {
    // 确保颜色值是有效的
    const colorValue = this._validateColor(propertyValue || '#000000');
    super(propertyName, colorValue, onChangeCallback, options);
    
    this.showAlpha = !!options.showAlpha;
    this.format = options.format || 'hex'; // hex, rgb, rgba
  }

  createElement() {
    const container = document.createElement('div');
    container.className = 'property-component color-property';

    // 创建标签
    const label = this._createLabel();
    container.appendChild(label);

    // 创建输入容器
    const inputContainer = document.createElement('div');
    inputContainer.className = 'property-input-container color-input-container';

    // 创建颜色预览框
    this.colorPreview = document.createElement('div');
    this.colorPreview.className = 'color-preview';
    this.colorPreview.style.backgroundColor = this.propertyValue;
    inputContainer.appendChild(this.colorPreview);

    // 创建颜色输入框
    this.inputElement = document.createElement('input');
    this.inputElement.type = 'color';
    this.inputElement.className = 'property-color-input';
    this.inputElement.value = this._toHexFormat(this.propertyValue);
    
    // 对于支持alpha的浏览器，可以使用新的color input特性
    if (this.showAlpha && this.inputElement.type === 'color') {
      this.inputElement.setAttribute('list', `alpha-options-${this.propertyName}`);
    }

    // 添加事件监听
    this.inputElement.addEventListener('input', (e) => {
      if (!this.isDisabled) {
        const newValue = e.target.value;
        this.colorPreview.style.backgroundColor = newValue;
      }
    });

    this.inputElement.addEventListener('change', (e) => {
      if (!this.isDisabled) {
        const newValue = e.target.value;
        this._triggerChange(newValue);
      }
    });

    inputContainer.appendChild(this.inputElement);

    // 如果需要显示alpha通道，添加额外的输入控制
    if (this.showAlpha) {
      this._createAlphaControls(inputContainer);
    }

    container.appendChild(inputContainer);

    // 设置初始禁用状态
    this.setDisabled(this.isDisabled);

    this.element = container;
    return container;
  }

  // 创建Alpha通道控制
  _createAlphaControls(container) {
    const alphaContainer = document.createElement('div');
    alphaContainer.className = 'alpha-control-container';

    // Alpha标签
    const alphaLabel = document.createElement('span');
    alphaLabel.className = 'alpha-label';
    alphaLabel.textContent = 'Alpha:';
    alphaContainer.appendChild(alphaLabel);

    // Alpha滑块
    this.alphaSlider = document.createElement('input');
    this.alphaSlider.type = 'range';
    this.alphaSlider.className = 'alpha-slider';
    this.alphaSlider.min = '0';
    this.alphaSlider.max = '100';
    this.alphaSlider.value = this._extractAlpha(this.propertyValue) * 100;
    
    // Alpha数值输入
    this.alphaInput = document.createElement('input');
    this.alphaInput.type = 'number';
    this.alphaInput.className = 'alpha-input';
    this.alphaInput.min = '0';
    this.alphaInput.max = '1';
    this.alphaInput.step = '0.01';
    this.alphaInput.value = this._extractAlpha(this.propertyValue).toFixed(2);

    // 同步滑块和输入框
    this.alphaSlider.addEventListener('input', (e) => {
      if (!this.isDisabled) {
        const alpha = parseFloat(e.target.value) / 100;
        this.alphaInput.value = alpha.toFixed(2);
        this._updateColorWithAlpha(alpha);
      }
    });

    this.alphaInput.addEventListener('change', (e) => {
      if (!this.isDisabled) {
        let alpha = parseFloat(e.target.value);
        // 限制alpha在有效范围内
        alpha = Math.max(0, Math.min(1, alpha));
        this.alphaInput.value = alpha.toFixed(2);
        this.alphaSlider.value = Math.round(alpha * 100);
        this._updateColorWithAlpha(alpha);
      }
    });

    alphaContainer.appendChild(this.alphaSlider);
    alphaContainer.appendChild(this.alphaInput);
    container.appendChild(alphaContainer);
  }

  // 更新颜色的alpha值
  _updateColorWithAlpha(alpha) {
    const rgb = this._hexToRgb(this._toHexFormat(this.propertyValue));
    const newColor = `rgba(${rgb.r}, ${rgb.g}, ${rgb.b}, ${alpha})`;
    this.colorPreview.style.backgroundColor = newColor;
    this._triggerChange(newColor);
  }

  // 验证颜色值
  _validateColor(color) {
    // 创建一个临时元素来验证颜色
    const tempElement = document.createElement('div');
    tempElement.style.color = color;
    return tempElement.style.color === color ? color : '#000000';
  }

  // 将颜色转换为hex格式
  _toHexFormat(color) {
    // 如果已经是hex格式且没有alpha，直接返回
    if (/^#[0-9A-Fa-f]{6}$/.test(color)) {
      return color;
    }
    
    // 从rgb/rgba转换
    const rgb = this._parseColor(color);
    if (rgb) {
      return `#${this._componentToHex(rgb.r)}${this._componentToHex(rgb.g)}${this._componentToHex(rgb.b)}`;
    }
    
    return '#000000';
  }

  // 从颜色字符串解析RGB值
  _parseColor(color) {
    const rgbMatch = color.match(/rgba?\((\d+),\s*(\d+),\s*(\d+)(?:,\s*([\d.]+))?\)/);
    if (rgbMatch) {
      return {
        r: parseInt(rgbMatch[1]),
        g: parseInt(rgbMatch[2]),
        b: parseInt(rgbMatch[3]),
        a: rgbMatch[4] ? parseFloat(rgbMatch[4]) : 1
      };
    }
    return null;
  }

  // 提取alpha值
  _extractAlpha(color) {
    const rgb = this._parseColor(color);
    return rgb ? (rgb.a !== undefined ? rgb.a : 1) : 1;
  }

  // 组件值转hex
  _componentToHex(c) {
    const hex = c.toString(16);
    return hex.length === 1 ? '0' + hex : hex;
  }

  // Hex转RGB
  _hexToRgb(hex) {
    const result = /^#?([a-f\d]{2})([a-f\d]{2})([a-f\d]{2})$/i.exec(hex);
    return result ? {
      r: parseInt(result[1], 16),
      g: parseInt(result[2], 16),
      b: parseInt(result[3], 16)
    } : null;
  }

  _updateUI() {
    if (this.colorPreview) {
      this.colorPreview.style.backgroundColor = this.propertyValue;
    }
    
    if (this.inputElement && !this.showAlpha) {
      this.inputElement.value = this._toHexFormat(this.propertyValue);
    }
    
    if (this.showAlpha) {
      const alpha = this._extractAlpha(this.propertyValue);
      if (this.alphaSlider) {
        this.alphaSlider.value = Math.round(alpha * 100);
      }
      if (this.alphaInput) {
        this.alphaInput.value = alpha.toFixed(2);
      }
    }
  }

  setDisabled(disabled) {
    super.setDisabled(disabled);
    if (this.inputElement) {
      this.inputElement.disabled = disabled;
    }
    if (this.alphaSlider) {
      this.alphaSlider.disabled = disabled;
    }
    if (this.alphaInput) {
      this.alphaInput.disabled = disabled;
    }
  }

  // 获取当前值
  getValue() {
    return this.propertyValue;
  }
}

export default ColorPropertyComponent;