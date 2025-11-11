// 内部窗口基类 - 所有页内窗口的基础类
// 提供统一的窗口管理、主题支持、动画等功能
export default class InternalWindowBase {
    constructor(options = {}) {
        this.options = {
            title: options.title || '',
            width: options.width || 500,
            height: options.height || 400,
            minWidth: options.minWidth || 300,
            minHeight: options.minHeight || 200,
            maxWidth: options.maxWidth || null,
            maxHeight: options.maxHeight || null,
            modal: options.modal !== false, // 默认是模态窗口
            closable: options.closable !== false, // 默认可关闭
            resizable: options.resizable || false,
            draggable: options.draggable || false,
            zIndex: options.zIndex || 2000,
            ...options
        };
        
        this.overlay = null;
        this.container = null;
        this.titleBar = null;
        this.content = null;
        this.footer = null;
        this.isVisible = false;
        this.isDragging = false;
        this.dragOffset = { x: 0, y: 0 };
        this.themeObserver = null;
        
        this.init();
    }
    
    // 初始化窗口
    init() {
        this.createOverlay();
        this.createContainer();
        this.createTitleBar();
        this.createContent();
        this.createFooter();
        this.setupEventListeners();
        this.setupThemeObserver();
    }
    
    // 创建遮罩层
    createOverlay() {
        this.overlay = document.createElement('div');
        this.overlay.className = 'internal-window-overlay';
        this.overlay.style.position = 'fixed';
        this.overlay.style.top = '0';
        this.overlay.style.left = '0';
        this.overlay.style.width = '100%';
        this.overlay.style.height = '100%';
        this.overlay.style.backgroundColor = this.getThemeColor('overlayBg', 'rgba(0, 0, 0, 0.5)');
        this.overlay.style.display = 'flex';
        this.overlay.style.justifyContent = 'center';
        this.overlay.style.alignItems = 'center';
        this.overlay.style.zIndex = this.options.zIndex.toString();
        this.overlay.style.transition = 'opacity 0.3s ease';
        
        if (this.options.modal) {
            this.overlay.addEventListener('click', (e) => {
                if (e.target === this.overlay && this.options.closable) {
                    this.hide();
                }
            });
        }
    }
    
    // 创建容器
    createContainer() {
        this.container = document.createElement('div');
        this.container.className = 'internal-window-container';
        this.container.style.position = 'relative';
        this.container.style.width = `${this.options.width}px`;
        this.container.style.height = this.options.height ? `${this.options.height}px` : 'auto';
        this.container.style.minWidth = `${this.options.minWidth}px`;
        this.container.style.minHeight = `${this.options.minHeight}px`;
        if (this.options.maxWidth) {
            this.container.style.maxWidth = `${this.options.maxWidth}px`;
        }
        if (this.options.maxHeight) {
            this.container.style.maxHeight = `${this.options.maxHeight}px`;
        }
        this.container.style.maxWidth = this.container.style.maxWidth || '90vw';
        this.container.style.maxHeight = this.container.style.maxHeight || '80vh';
        this.container.style.backgroundColor = this.getThemeColor('containerBg', '#2d2d30');
        this.container.style.border = `1px solid ${this.getThemeColor('border', '#3e3e42')}`;
        this.container.style.borderRadius = '4px';
        this.container.style.boxShadow = this.getThemeColor('shadow', '0 4px 8px rgba(0, 0, 0, 0.3)');
        this.container.style.display = 'flex';
        this.container.style.flexDirection = 'column';
        this.container.style.overflow = 'hidden';
        
        this.overlay.appendChild(this.container);
    }
    
    // 创建标题栏
    createTitleBar() {
        this.titleBar = document.createElement('div');
        this.titleBar.className = 'internal-window-titlebar';
        this.titleBar.style.padding = '12px 16px';
        this.titleBar.style.borderBottom = `1px solid ${this.getThemeColor('border', '#3e3e42')}`;
        this.titleBar.style.display = 'flex';
        this.titleBar.style.justifyContent = 'space-between';
        this.titleBar.style.alignItems = 'center';
        this.titleBar.style.cursor = this.options.draggable ? 'move' : 'default';
        this.titleBar.style.userSelect = 'none';
        
        const titleText = document.createElement('div');
        titleText.className = 'internal-window-title';
        titleText.style.fontWeight = 'bold';
        titleText.style.fontSize = '14px';
        titleText.style.color = this.getThemeColor('text', '#e0e0e0');
        titleText.textContent = this.options.title;
        
        const titleActions = document.createElement('div');
        titleActions.className = 'internal-window-actions';
        titleActions.style.display = 'flex';
        titleActions.style.gap = '8px';
        
        if (this.options.closable) {
            const closeBtn = document.createElement('button');
            closeBtn.className = 'internal-window-close';
            closeBtn.innerHTML = '×';
            closeBtn.style.width = '24px';
            closeBtn.style.height = '24px';
            closeBtn.style.border = 'none';
            closeBtn.style.borderRadius = '4px';
            closeBtn.style.backgroundColor = 'transparent';
            closeBtn.style.color = this.getThemeColor('text', '#e0e0e0');
            closeBtn.style.cursor = 'pointer';
            closeBtn.style.fontSize = '20px';
            closeBtn.style.lineHeight = '1';
            closeBtn.style.display = 'flex';
            closeBtn.style.alignItems = 'center';
            closeBtn.style.justifyContent = 'center';
            closeBtn.style.transition = 'background-color 0.2s';
            
            closeBtn.addEventListener('mouseenter', () => {
                closeBtn.style.backgroundColor = this.getThemeColor('hoverBg', '#37373d');
            });
            closeBtn.addEventListener('mouseleave', () => {
                closeBtn.style.backgroundColor = 'transparent';
            });
            closeBtn.addEventListener('click', () => this.hide());
            
            titleActions.appendChild(closeBtn);
        }
        
        this.titleBar.appendChild(titleText);
        this.titleBar.appendChild(titleActions);
        this.container.appendChild(this.titleBar);
    }
    
    // 创建内容区（子类可覆盖）
    createContent() {
        this.content = document.createElement('div');
        this.content.className = 'internal-window-content';
        this.content.style.padding = '16px';
        this.content.style.color = this.getThemeColor('text', '#e0e0e0');
        this.content.style.fontSize = '13px';
        this.content.style.flex = '1';
        this.content.style.overflowY = 'auto';
        this.content.style.overflowX = 'hidden';
        
        this.container.appendChild(this.content);
    }
    
    // 创建底部栏（子类可覆盖）
    createFooter() {
        this.footer = document.createElement('div');
        this.footer.className = 'internal-window-footer';
        this.footer.style.padding = '12px 16px';
        this.footer.style.borderTop = `1px solid ${this.getThemeColor('border', '#3e3e42')}`;
        this.footer.style.display = 'flex';
        this.footer.style.justifyContent = 'flex-end';
        this.footer.style.gap = '8px';
        this.footer.style.display = 'none'; // 默认隐藏，子类需要时显示
        
        this.container.appendChild(this.footer);
    }
    
    // 设置事件监听
    setupEventListeners() {
        // 拖拽功能
        if (this.options.draggable) {
            this.titleBar.addEventListener('mousedown', (e) => {
                if (e.target === this.titleBar || e.target.closest('.internal-window-title')) {
                    this.startDrag(e);
                }
            });
        }
        
        // 键盘事件
        document.addEventListener('keydown', this.handleKeyDown.bind(this));
    }
    
    // 开始拖拽
    startDrag(e) {
        this.isDragging = true;
        const rect = this.container.getBoundingClientRect();
        this.dragOffset.x = e.clientX - rect.left;
        this.dragOffset.y = e.clientY - rect.top;
        
        document.addEventListener('mousemove', this.onDrag.bind(this));
        document.addEventListener('mouseup', this.stopDrag.bind(this));
    }
    
    // 拖拽中
    onDrag(e) {
        if (!this.isDragging) return;
        
        let left = e.clientX - this.dragOffset.x;
        let top = e.clientY - this.dragOffset.y;
        
        // 限制在视口内
        const maxLeft = window.innerWidth - this.container.offsetWidth;
        const maxTop = window.innerHeight - this.container.offsetHeight;
        left = Math.max(0, Math.min(left, maxLeft));
        top = Math.max(0, Math.min(top, maxTop));
        
        this.container.style.position = 'absolute';
        this.container.style.left = `${left}px`;
        this.container.style.top = `${top}px`;
        this.container.style.margin = '0';
    }
    
    // 停止拖拽
    stopDrag() {
        this.isDragging = false;
        document.removeEventListener('mousemove', this.onDrag.bind(this));
        document.removeEventListener('mouseup', this.stopDrag.bind(this));
    }
    
    // 键盘事件处理
    handleKeyDown(e) {
        if (!this.isVisible) return;
        
        if (e.key === 'Escape' && this.options.closable) {
            this.hide();
        }
    }
    
    // 设置主题观察者
    setupThemeObserver() {
        this.themeObserver = new MutationObserver(() => {
            this.updateTheme();
        });
        this.themeObserver.observe(document.body, { attributes: true, attributeFilter: ['class'] });
    }
    
    // 更新主题
    updateTheme() {
        if (!this.overlay || !this.container) return;
        
        this.overlay.style.backgroundColor = this.getThemeColor('overlayBg', 'rgba(0, 0, 0, 0.5)');
        this.container.style.backgroundColor = this.getThemeColor('containerBg', '#2d2d30');
        this.container.style.border = `1px solid ${this.getThemeColor('border', '#3e3e42')}`;
        this.container.style.boxShadow = this.getThemeColor('shadow', '0 4px 8px rgba(0, 0, 0, 0.3)');
        
        if (this.titleBar) {
            this.titleBar.style.borderBottom = `1px solid ${this.getThemeColor('border', '#3e3e42')}`;
            const title = this.titleBar.querySelector('.internal-window-title');
            if (title) {
                title.style.color = this.getThemeColor('text', '#e0e0e0');
            }
        }
        
        if (this.content) {
            this.content.style.color = this.getThemeColor('text', '#e0e0e0');
        }
        
        if (this.footer) {
            this.footer.style.borderTop = `1px solid ${this.getThemeColor('border', '#3e3e42')}`;
        }
    }
    
    // 获取主题颜色
    getThemeColor(key, darkValue) {
        const isLight = document.body.classList.contains('light-mode');
        const themeColors = {
            overlayBg: isLight ? 'rgba(0, 0, 0, 0.3)' : 'rgba(0, 0, 0, 0.5)',
            containerBg: isLight ? '#f0f0f0' : '#2d2d30',
            border: isLight ? '#ccc' : '#3e3e42',
            text: isLight ? '#333' : '#e0e0e0',
            textSecondary: isLight ? '#999' : '#999',
            shadow: isLight ? '0 4px 8px rgba(0, 0, 0, 0.1)' : '0 4px 8px rgba(0, 0, 0, 0.3)',
            hoverBg: isLight ? '#e0e0e0' : '#37373d',
            buttonBg: isLight ? '#f0f0f0' : '#2d2d30',
            keyBg: isLight ? '#e0e0e0' : '#3e3e42',
            keyEditingBg: isLight ? '#999' : '#666',
            keyEditingBorder: isLight ? '#777' : '#888',
            primaryBg: isLight ? '#0066cc' : '#0e639c',
            primaryHover: isLight ? '#0052aa' : '#1177bb'
        };
        
        return themeColors[key] || darkValue;
    }
    
    // 显示窗口
    show() {
        if (this.isVisible) return;
        
        if (!this.overlay.parentElement) {
            document.body.appendChild(this.overlay);
        }
        
        this.isVisible = true;
        
        // 动画
        this.overlay.style.opacity = '0';
        this.container.style.transform = 'translateY(-20px)';
        this.container.style.opacity = '0';
        this.container.style.transition = 'transform 0.3s ease, opacity 0.3s ease';
        
        setTimeout(() => {
            this.overlay.style.opacity = '1';
            this.container.style.transform = 'translateY(0)';
            this.container.style.opacity = '1';
        }, 10);
        
        // 调用子类的onShow方法
        if (typeof this.onShow === 'function') {
            this.onShow();
        }
    }
    
    // 隐藏窗口
    hide() {
        if (!this.isVisible) return;
        
        // 调用子类的onHide方法
        if (typeof this.onHide === 'function') {
            this.onHide();
        }
        
        // 动画
        this.overlay.style.opacity = '0';
        this.container.style.transform = 'translateY(20px)';
        this.container.style.opacity = '0';
        
        setTimeout(() => {
            if (this.overlay && this.overlay.parentElement) {
                this.overlay.parentElement.removeChild(this.overlay);
            }
            this.isVisible = false;
        }, 300);
    }
    
    // 设置内容（子类可覆盖）
    setContent(html) {
        if (this.content) {
            this.content.innerHTML = html;
        }
    }
    
    // 添加按钮到底部栏
    addFooterButton(text, onClick, options = {}) {
        if (!this.footer) return null;
        
        this.footer.style.display = 'flex';
        
        const button = document.createElement('button');
        button.className = `internal-window-btn ${options.className || ''}`;
        button.textContent = text;
        button.style.padding = '6px 12px';
        button.style.border = options.primary 
            ? 'none' 
            : `1px solid ${this.getThemeColor('border', '#464647')}`;
        button.style.borderRadius = '3px';
        button.style.fontSize = '13px';
        button.style.cursor = 'pointer';
        button.style.backgroundColor = options.primary
            ? this.getThemeColor('primaryBg', '#0e639c')
            : this.getThemeColor('buttonBg', '#2d2d30');
        button.style.color = options.primary ? 'white' : this.getThemeColor('text', '#e0e0e0');
        button.style.transition = 'background-color 0.2s';
        
        button.addEventListener('mouseenter', () => {
            button.style.backgroundColor = options.primary
                ? this.getThemeColor('primaryHover', '#1177bb')
                : this.getThemeColor('hoverBg', '#37373d');
        });
        button.addEventListener('mouseleave', () => {
            button.style.backgroundColor = options.primary
                ? this.getThemeColor('primaryBg', '#0e639c')
                : this.getThemeColor('buttonBg', '#2d2d30');
        });
        
        if (onClick) {
            button.addEventListener('click', onClick);
        }
        
        this.footer.appendChild(button);
        return button;
    }
    
    // 销毁窗口
    destroy() {
        if (this.themeObserver) {
            this.themeObserver.disconnect();
        }
        
        if (this.overlay && this.overlay.parentElement) {
            this.overlay.parentElement.removeChild(this.overlay);
        }
        
        this.overlay = null;
        this.container = null;
        this.titleBar = null;
        this.content = null;
        this.footer = null;
        this.isVisible = false;
    }
    
    // 子类可覆盖的方法
    onShow() {}
    onHide() {}
}

