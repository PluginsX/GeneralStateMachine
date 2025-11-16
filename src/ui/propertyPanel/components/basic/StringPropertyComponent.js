import { PropertyComponentBase } from '../PropertyComponentBase.js';

class StringPropertyComponent extends PropertyComponentBase {
  constructor(propertyName, propertyValue, onChangeCallback, options = {}) {
    super(propertyName, propertyValue || '', onChangeCallback, options);
    this.isMultiline = !!options.isMultiline;
    this.maxLength = options.maxLength;
    this.placeholder = options.placeholder || '';
  }

  createElement() {
    const container = document.createElement('div');
    container.className = 'property-component string-property';

    // 创建标签
    const label = this._createLabel();
    container.appendChild(label);

    // 创建输入框
    const inputContainer = document.createElement('div');
    inputContainer.className = 'property-input-container';

    if (this.isMultiline) {
      this.inputElement = document.createElement('textarea');
      this.inputElement.className = 'property-textarea';
      this.inputElement.rows = this.options.rows || 3;
    } else {
      this.inputElement = document.createElement('input');
      this.inputElement.type = 'text';
      this.inputElement.className = 'property-input';
    }

    this.inputElement.value = this.propertyValue;
    this.inputElement.placeholder = this.placeholder;
    
    if (this.maxLength !== undefined) {
      this.inputElement.maxLength = this.maxLength;
    }

    // 添加事件监听
    this.inputElement.addEventListener('input', (e) => {
      if (!this.isDisabled) {
        this._triggerChange(e.target.value);
      }
    });

    // 添加失去焦点事件（可选，用于验证或其他操作）
    if (this.options.onBlur) {
      this.inputElement.addEventListener('blur', (e) => {
        this.options.onBlur(this.propertyName, e.target.value);
      });
    }

    inputContainer.appendChild(this.inputElement);
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

export default StringPropertyComponent;