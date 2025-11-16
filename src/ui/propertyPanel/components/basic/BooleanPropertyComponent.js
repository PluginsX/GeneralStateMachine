import { PropertyComponentBase } from '../PropertyComponentBase.js';

class BooleanPropertyComponent extends PropertyComponentBase {
  constructor(propertyName, propertyValue, onChangeCallback, options = {}) {
    super(propertyName, !!propertyValue, onChangeCallback, options);
    this.useToggle = !!options.useToggle; // 使用开关样式还是复选框
    this.trueLabel = options.trueLabel || 'True';
    this.falseLabel = options.falseLabel || 'False';
  }

  createElement() {
    const container = document.createElement('div');
    container.className = 'property-component boolean-property';

    // 创建标签
    const label = this._createLabel();
    container.appendChild(label);

    // 创建输入容器
    const inputContainer = document.createElement('div');
    inputContainer.className = 'property-input-container';

    if (this.useToggle) {
      // 创建开关组件
      this._createToggleElement(inputContainer);
    } else {
      // 创建复选框
      this._createCheckboxElement(inputContainer);
    }

    container.appendChild(inputContainer);

    // 设置初始禁用状态
    this.setDisabled(this.isDisabled);

    this.element = container;
    return container;
  }

  // 创建开关样式元素
  _createToggleElement(container) {
    const toggleContainer = document.createElement('label');
    toggleContainer.className = 'property-toggle';
    
    this.inputElement = document.createElement('input');
    this.inputElement.type = 'checkbox';
    this.inputElement.checked = this.propertyValue;
    
    const slider = document.createElement('span');
    slider.className = 'toggle-slider';
    
    // 添加状态文本
    const statusText = document.createElement('span');
    statusText.className = 'toggle-status';
    statusText.textContent = this.propertyValue ? this.trueLabel : this.falseLabel;
    
    // 添加事件监听
    this.inputElement.addEventListener('change', (e) => {
      if (!this.isDisabled) {
        const newValue = e.target.checked;
        statusText.textContent = newValue ? this.trueLabel : this.falseLabel;
        this._triggerChange(newValue);
      }
    });
    
    toggleContainer.appendChild(this.inputElement);
    toggleContainer.appendChild(slider);
    toggleContainer.appendChild(statusText);
    container.appendChild(toggleContainer);
  }

  // 创建复选框样式元素
  _createCheckboxElement(container) {
    this.inputElement = document.createElement('input');
    this.inputElement.type = 'checkbox';
    this.inputElement.className = 'property-checkbox';
    this.inputElement.checked = this.propertyValue;
    
    // 添加状态文本
    const statusText = document.createElement('span');
    statusText.className = 'checkbox-status';
    statusText.textContent = this.propertyValue ? this.trueLabel : this.falseLabel;
    
    // 添加事件监听
    this.inputElement.addEventListener('change', (e) => {
      if (!this.isDisabled) {
        const newValue = e.target.checked;
        statusText.textContent = newValue ? this.trueLabel : this.falseLabel;
        this._triggerChange(newValue);
      }
    });
    
    container.appendChild(this.inputElement);
    container.appendChild(statusText);
  }

  _updateUI() {
    if (this.inputElement) {
      this.inputElement.checked = this.propertyValue;
      
      // 更新状态文本
      const statusText = this.element.querySelector('.toggle-status, .checkbox-status');
      if (statusText) {
        statusText.textContent = this.propertyValue ? this.trueLabel : this.falseLabel;
      }
    }
  }

  setDisabled(disabled) {
    super.setDisabled(disabled);
    if (this.inputElement) {
      this.inputElement.disabled = disabled;
    }
  }

  // 获取当前值
  getValue() {
    return this.propertyValue;
  }
}

export default BooleanPropertyComponent;