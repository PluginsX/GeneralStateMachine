import { PropertyComponentBase } from '../PropertyComponentBase.js';

class SelectPropertyComponent extends PropertyComponentBase {
  constructor(propertyName, propertyValue, onChangeCallback, options = {}) {
    super(propertyName, propertyValue, onChangeCallback, options);
    this.optionsList = options.options || []; // 选项列表，格式: [{value: 'value1', label: 'Label 1'}, ...]
    this.isMultiSelect = !!options.isMultiSelect;
    this.placeholder = options.placeholder || 'Select...';
  }

  createElement() {
    const container = document.createElement('div');
    container.className = 'property-component select-property';

    // 创建标签
    const label = this._createLabel();
    container.appendChild(label);

    // 创建输入容器
    const inputContainer = document.createElement('div');
    inputContainer.className = 'property-input-container';

    // 创建选择器
    this.inputElement = document.createElement('select');
    this.inputElement.className = 'property-select';
    
    if (this.isMultiSelect) {
      this.inputElement.multiple = true;
      this.inputElement.size = Math.min(5, this.optionsList.length + 1); // 设置默认显示行数
    }

    // 添加占位选项（仅在单选时）
    if (!this.isMultiSelect && this.placeholder) {
      const placeholderOption = document.createElement('option');
      placeholderOption.value = '';
      placeholderOption.disabled = true;
      placeholderOption.selected = this.propertyValue === undefined || this.propertyValue === null || this.propertyValue === '';
      placeholderOption.textContent = this.placeholder;
      this.inputElement.appendChild(placeholderOption);
    }

    // 添加选项
    this._populateOptions();

    // 添加事件监听
    this.inputElement.addEventListener('change', (e) => {
      if (!this.isDisabled) {
        let newValue;
        if (this.isMultiSelect) {
          // 处理多选情况
          newValue = Array.from(e.target.selectedOptions).map(option => option.value);
        } else {
          // 处理单选情况
          newValue = e.target.value;
          // 转换类型
          newValue = this._convertValue(newValue);
        }
        this._triggerChange(newValue);
      }
    });

    inputContainer.appendChild(this.inputElement);
    container.appendChild(inputContainer);

    // 设置初始禁用状态
    this.setDisabled(this.isDisabled);

    this.element = container;
    return container;
  }

  // 填充选项列表
  _populateOptions() {
    this.optionsList.forEach(option => {
      const optionElement = document.createElement('option');
      
      // 支持不同格式的选项定义
      if (typeof option === 'object') {
        optionElement.value = option.value;
        optionElement.textContent = option.label || option.value;
        
        // 设置提示信息
        if (option.tooltip) {
          optionElement.title = option.tooltip;
        }
      } else {
        // 如果是简单类型，直接使用
        optionElement.value = option;
        optionElement.textContent = option;
      }

      // 设置选中状态
      if (this.isMultiSelect) {
        // 多选情况
        if (Array.isArray(this.propertyValue) && this.propertyValue.includes(optionElement.value)) {
          optionElement.selected = true;
        }
      } else {
        // 单选情况
        if (String(this.propertyValue) === optionElement.value) {
          optionElement.selected = true;
        }
      }

      this.inputElement.appendChild(optionElement);
    });
  }

  // 根据选项值的实际类型进行转换
  _convertValue(value) {
    // 尝试找到对应的选项对象
    const option = this.optionsList.find(opt => String(opt.value) === value || String(opt) === value);
    
    if (option && typeof option === 'object') {
      // 如果选项有对应的类型，返回原始类型的值
      return option.value;
    }
    
    // 尝试转换为数字
    const numValue = Number(value);
    if (!isNaN(numValue) && String(numValue) === value) {
      return numValue;
    }
    
    // 尝试转换为布尔值
    if (value.toLowerCase() === 'true') return true;
    if (value.toLowerCase() === 'false') return false;
    
    // 默认为字符串
    return value;
  }

  _updateUI() {
    // 移除所有现有选项（保留占位符如果存在）
    const hasPlaceholder = this.inputElement.firstChild && this.inputElement.firstChild.disabled;
    const placeholder = hasPlaceholder ? this.inputElement.firstChild : null;
    
    while (this.inputElement.firstChild) {
      this.inputElement.removeChild(this.inputElement.firstChild);
    }
    
    // 重新添加占位符
    if (placeholder) {
      this.inputElement.appendChild(placeholder);
      placeholder.selected = this.propertyValue === undefined || this.propertyValue === null || this.propertyValue === '';
    }
    
    // 重新填充选项
    this._populateOptions();
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

  // 更新选项列表
  updateOptions(newOptions) {
    this.optionsList = newOptions || [];
    this._updateUI();
  }
}

export default SelectPropertyComponent;