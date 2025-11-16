/**
 * 主题管理器类
 * 负责管理属性面板的主题切换、应用和状态维护
 */
class ThemeManager {
  constructor() {
    // 主题状态枚举
    this.THEMES = {
      LIGHT: 'light',
      DARK: 'dark',
      SYSTEM: 'system'
    };
    
    // 当前主题状态
    this._currentTheme = null;
    
    // 主题变化监听器
    this._listeners = [];
    
    // 初始化主题
    this.init();
  }
  
  /**
   * 初始化主题管理器
   */
  init() {
    // 尝试从本地存储恢复主题设置
    const savedTheme = localStorage.getItem('propertyPanelTheme');
    
    // 如果没有保存的主题设置，使用系统默认
    if (!savedTheme || !Object.values(this.THEMES).includes(savedTheme)) {
      this._currentTheme = this.THEMES.SYSTEM;
    } else {
      this._currentTheme = savedTheme;
    }
    
    // 应用初始主题
    this.applyTheme();
    
    // 监听系统主题变化
    this._setupSystemThemeListener();
  }
  
  /**
   * 设置系统主题变化监听器
   */
  _setupSystemThemeListener() {
    // 检查是否支持系统主题查询
    if (window.matchMedia && window.matchMedia('(prefers-color-scheme: dark)').addEventListener) {
      // 监听系统主题变化
      window.matchMedia('(prefers-color-scheme: dark)').addEventListener('change', (e) => {
        // 只有当当前主题设置为跟随系统时才响应变化
        if (this._currentTheme === this.THEMES.SYSTEM) {
          this.applyTheme();
        }
      });
    }
  }
  
  /**
   * 获取当前实际应用的主题（考虑系统主题）
   * @returns {string} 实际应用的主题名称（'light'或'dark'）
   */
  getActiveTheme() {
    if (this._currentTheme === this.THEMES.SYSTEM) {
      // 检查系统主题偏好
      if (window.matchMedia && window.matchMedia('(prefers-color-scheme: dark)').matches) {
        return this.THEMES.DARK;
      } else {
        return this.THEMES.LIGHT;
      }
    }
    return this._currentTheme;
  }
  
  /**
   * 获取当前主题设置（可能是'system'）
   * @returns {string} 当前主题设置
   */
  getCurrentThemeSetting() {
    return this._currentTheme;
  }
  
  /**
   * 切换到指定主题
   * @param {string} theme 主题名称（'light', 'dark'或'system'）
   */
  setTheme(theme) {
    if (!Object.values(this.THEMES).includes(theme)) {
      console.warn(`不支持的主题: ${theme}，使用默认主题`);
      return;
    }
    
    this._currentTheme = theme;
    
    // 保存主题设置到本地存储
    localStorage.setItem('propertyPanelTheme', theme);
    
    // 应用主题
    this.applyTheme();
    
    // 通知所有监听器
    this._notifyListeners();
  }
  
  /**
   * 切换到明主题
   */
  setLightTheme() {
    this.setTheme(this.THEMES.LIGHT);
  }
  
  /**
   * 切换到暗主题
   */
  setDarkTheme() {
    this.setTheme(this.THEMES.DARK);
  }
  
  /**
   * 切换到系统主题
   */
  setSystemTheme() {
    this.setTheme(this.THEMES.SYSTEM);
  }
  
  /**
   * 切换明暗主题（不包括系统主题）
   */
  toggleTheme() {
    const activeTheme = this.getActiveTheme();
    if (activeTheme === this.THEMES.LIGHT) {
      this.setDarkTheme();
    } else {
      this.setLightTheme();
    }
  }
  
  /**
   * 应用当前主题到DOM
   */
  applyTheme() {
    const activeTheme = this.getActiveTheme();
    
    // 移除所有主题类
    document.documentElement.classList.remove('theme-light', 'theme-dark');
    
    // 设置data-theme属性
    if (activeTheme === this.THEMES.DARK) {
      document.documentElement.setAttribute('data-theme', 'dark');
      document.documentElement.classList.add('theme-dark');
    } else {
      document.documentElement.setAttribute('data-theme', 'light');
      document.documentElement.classList.add('theme-light');
    }
    
    // 添加全局CSS类以便于识别当前主题
    document.body.classList.toggle('dark-theme', activeTheme === this.THEMES.DARK);
    document.body.classList.toggle('light-theme', activeTheme === this.THEMES.LIGHT);
    
    // 触发自定义主题变更事件
    this._dispatchThemeChangeEvent(activeTheme);
  }
  
  /**
   * 触发自定义主题变更事件
   * @param {string} theme 新的主题名称
   */
  _dispatchThemeChangeEvent(theme) {
    const event = new CustomEvent('propertyPanelThemeChange', {
      detail: {
        theme: theme,
        setting: this._currentTheme
      },
      bubbles: true,
      cancelable: true
    });
    
    document.dispatchEvent(event);
  }
  
  /**
   * 注册主题变化监听器
   * @param {Function} listener 监听器函数，接收新主题作为参数
   * @returns {Function} 取消注册的函数
   */
  addThemeChangeListener(listener) {
    if (typeof listener !== 'function') {
      console.error('主题监听器必须是一个函数');
      return () => {};
    }
    
    this._listeners.push(listener);
    
    // 返回取消注册的函数
    return () => {
      this.removeThemeChangeListener(listener);
    };
  }
  
  /**
   * 移除主题变化监听器
   * @param {Function} listener 要移除的监听器函数
   */
  removeThemeChangeListener(listener) {
    const index = this._listeners.indexOf(listener);
    if (index !== -1) {
      this._listeners.splice(index, 1);
    }
  }
  
  /**
   * 通知所有主题变化监听器
   */
  _notifyListeners() {
    const activeTheme = this.getActiveTheme();
    this._listeners.forEach(listener => {
      try {
        listener(activeTheme, this._currentTheme);
      } catch (error) {
        console.error('主题监听器执行出错:', error);
      }
    });
  }
  
  /**
   * 获取主题CSS变量值
   * @param {string} variable 变量名（可以带或不带--前缀）
   * @param {HTMLElement} element 要查询的元素，默认为document.documentElement
   * @returns {string} CSS变量值
   */
  getCssVariable(variable, element = document.documentElement) {
    // 确保变量名带有--前缀
    const varName = variable.startsWith('--') ? variable : `--${variable}`;
    
    // 获取计算后的样式
    const computedStyle = window.getComputedStyle(element);
    
    return computedStyle.getPropertyValue(varName).trim();
  }
  
  /**
   * 设置CSS变量值
   * @param {string} variable 变量名（可以带或不带--前缀）
   * @param {string} value 变量值
   * @param {HTMLElement} element 要设置的元素，默认为document.documentElement
   */
  setCssVariable(variable, value, element = document.documentElement) {
    // 确保变量名带有--前缀
    const varName = variable.startsWith('--') ? variable : `--${variable}`;
    
    element.style.setProperty(varName, value);
  }
  
  /**
   * 检查当前是否为暗主题
   * @returns {boolean} 是否为暗主题
   */
  isDarkTheme() {
    return this.getActiveTheme() === this.THEMES.DARK;
  }
  
  /**
   * 检查当前是否为明主题
   * @returns {boolean} 是否为明主题
   */
  isLightTheme() {
    return this.getActiveTheme() === this.THEMES.LIGHT;
  }
  
  /**
   * 获取主题配置信息
   * @returns {Object} 主题配置对象
   */
  getThemeInfo() {
    return {
      currentSetting: this._currentTheme,
      activeTheme: this.getActiveTheme(),
      isDark: this.isDarkTheme(),
      isLight: this.isLightTheme(),
      isSystem: this._currentTheme === this.THEMES.SYSTEM,
      availableThemes: Object.values(this.THEMES)
    };
  }
  
  /**
   * 重置主题设置为默认值（系统主题）
   */
  resetTheme() {
    localStorage.removeItem('propertyPanelTheme');
    this.setSystemTheme();
  }
  
  /**
   * 获取主题CSS类名
   * @returns {string} 主题CSS类名
   */
  getThemeClassName() {
    return this.isDarkTheme() ? 'theme-dark' : 'theme-light';
  }
  
  /**
   * 创建主题切换按钮
   * @param {Object} options 按钮选项
   * @returns {HTMLButtonElement} 创建的按钮元素
   */
  createThemeToggleButton(options = {}) {
    const defaultOptions = {
      showText: true,
      showIcon: true,
      size: 'medium', // small, medium, large
      className: ''
    };
    
    const config = { ...defaultOptions, ...options };
    
    const button = document.createElement('button');
    button.className = `theme-toggle-button ${config.size} ${config.className}`;
    button.title = '切换主题';
    
    // 设置按钮内容
    let buttonContent = '';
    
    if (config.showIcon) {
      const icon = document.createElement('span');
      icon.className = `theme-icon theme-${this.getActiveTheme()}`;
      icon.innerHTML = this.isDarkTheme() ? '☀️' : '🌙';
      buttonContent += icon.outerHTML;
    }
    
    if (config.showText) {
      const textSpan = document.createElement('span');
      textSpan.className = 'theme-text';
      textSpan.textContent = this.isDarkTheme() ? '明' : '暗';
      buttonContent += textSpan.outerHTML;
    }
    
    button.innerHTML = buttonContent;
    
    // 添加点击事件处理
    button.addEventListener('click', () => {
      this.toggleTheme();
      
      // 更新按钮图标和文本
      if (config.showIcon) {
        const icon = button.querySelector('.theme-icon');
        if (icon) {
          icon.className = `theme-icon theme-${this.getActiveTheme()}`;
          icon.innerHTML = this.isDarkTheme() ? '☀️' : '🌙';
        }
      }
      
      if (config.showText) {
        const textSpan = button.querySelector('.theme-text');
        if (textSpan) {
          textSpan.textContent = this.isDarkTheme() ? '明' : '暗';
        }
      }
    });
    
    return button;
  }
}

// 导出单例实例
const themeManager = new ThemeManager();
export default themeManager;

// 导出类（如果需要创建多个实例）
export { ThemeManager };