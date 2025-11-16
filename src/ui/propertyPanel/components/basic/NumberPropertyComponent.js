import PropertyComponentBase from '../PropertyComponentBase.js';

class NumberPropertyComponent extends PropertyComponentBase {
  constructor(propertyName, propertyValue, onChangeCallback, options = {}) {
    super(propertyName, propertyValue || 0, onChangeCallback, options);
    this.min = options.min;
    this.max = options.max;
    this.step = options.step || 1;
    this.isInteger = !!options.isInteger;
    this.showSlider = !!options.showSlider;
  }

  createElement() {
    const container = document.createElement('div');
    container.className = 'property-component number-property';

    // 创建标签
    const label = this._createLabel();
    container.appendChild(label);

    // 创建输入容器
    const inputContainer = document.createElement('div');
    inputContainer.className = 'property-input-container';

    // 创建数值输入框
    this.inputElement = document.createElement('input');
    this.inputElement.type = this.isInteger ? 'number' : 'number';
    this.inputElement.className = 'property-input number-input';
    this.inputElement.value = this.propertyValue;
    this.inputElement.step = this.step;
    
    if (this.min !== undefined) {
      this.inputElement.min = this.min;
    }
    
    if (this.max !== undefined) {
      this.inputElement.max = this.max;
    }

    // 添加事件监听
    this.inputElement.addEventListener('change', (e) => {
      if (!this.isDisabled) {
        let value = parseFloat(e.target.value);
        
        // 验证并限制范围
        value = this._validateNumber(value);
        
        // 更新输入框的值
        e.target.value = value;
        
        // 触发变更事件
        this._triggerChange(value);
      }
    });

    inputContainer.appendChild(this.inputElement);
    
    // 如果启用滑块，添加滑块控件
    if (this.showSlider && this.min !== undefined && this.max !== undefined) {
      this.sliderElement = document.createElement('input');
      this.sliderElement.type = 'range';
      this.sliderElement.className = 'property-slider';
      this.sliderElement.min = this.min;
      this.sliderElement.max = this.max;
      this.sliderElement.step = this.step;
      this.sliderElement.value = this.propertyValue;

      // 滑块值变更时同步到输入框
      this.sliderElement.addEventListener('input', (e) => {
        if (!this.isDisabled) {
          let value = parseFloat(e.target.value);
          if (this.isInteger) {
            value = Math.round(value);
          }
          this.inputElement.value = value;
        }
      });

      // 滑块结束拖动时触发变更事件
      this.sliderElement.addEventListener('change', (e) => {
        if (!this.isDisabled) {
          let value = parseFloat(e.target.value);
          if (this.isInteger) {
            value = Math.round(value);
          }
          value = this._validateNumber(value);
          this._triggerChange(value);
        }
      });

      inputContainer.appendChild(this.sliderElement);
    }

    container.appendChild(inputContainer);

    // 设置初始禁用状态
    this.setDisabled(this.isDisabled);

    this.element = container;
    return container;
  }

  _updateUI() {
    if (this.inputElement) {
      this.inputElement.value = this.propertyValue;
    }
    
    if (this.sliderElement) {
      this.sliderElement.value = this.propertyValue;
    }
  }

  setDisabled(disabled) {
    super.setDisabled(disabled);
    if (this.inputElement) {
      this.inputElement.disabled = disabled;
    }
    if (this.sliderElement) {
      this.sliderElement.disabled = disabled;
    }
  }

  // 验证数字并限制在有效范围内
  _validateNumber(value) {
    // 检查是否为有效数字
    if (isNaN(value)) {
      return this.propertyValue; // 保持原值
    }

    // 如果是整数，进行四舍五入
    if (this.isInteger) {
      value = Math.round(value);
    }

    // 限制在最小值和最大值之间
    if (this.min !== undefined && value < this.min) {
      value = this.min;
    }
    if (this.max !== undefined && value > this.max) {
      value = this.max;
    }

    return value;
  }

  // 获取当前值
  getValue() {
    return this.propertyValue;
  }
}

export default NumberPropertyComponent;