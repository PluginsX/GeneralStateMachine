// 属性组件基类，所有属性组件都必须继承此类
class PropertyComponentBase {
  constructor(propertyName, propertyValue, onChangeCallback, options = {}) {
    this.propertyName = propertyName;
    this.propertyValue = propertyValue;
    this.onChangeCallback = onChangeCallback;
    this.options = options;
    this.element = null;
    this.isDisabled = false;
  }

  // 创建DOM元素
  createElement() {
    throw new Error('子类必须实现createElement方法');
  }

  // 更新组件的值
  updateValue(newValue) {
    this.propertyValue = newValue;
    this._updateUI();
  }

  // 更新UI显示
  _updateUI() {
    throw new Error('子类必须实现_updateUI方法');
  }

  // 设置组件是否禁用
  setDisabled(disabled) {
    this.isDisabled = disabled;
    if (this.element) {
      this.element.classList.toggle('property-component-disabled', disabled);
    }
  }

  // 获取DOM元素
  getElement() {
    if (!this.element) {
      this.createElement();
    }
    return this.element;
  }

  // 获取属性名称的显示标签
  _createLabel() {
    const label = document.createElement('label');
    label.className = 'property-label';
    label.textContent = this.options.displayName || this._formatPropertyName(this.propertyName);
    return label;
  }

  // 格式化属性名称为可读形式（驼峰转空格分隔的标题形式）
  _formatPropertyName(name) {
    return name
      .replace(/([A-Z])/g, ' $1')
      .replace(/^./, str => str.toUpperCase())
      .trim();
  }

  // 触发值变更事件
  _triggerChange(newValue) {
    if (this.onChangeCallback) {
      this.onChangeCallback(this.propertyName, newValue, this.propertyValue);
    }
  }
}