// 欢迎页面管理器
class WelcomeScreen {
    constructor() {
        this.welcomeScreen = document.getElementById('welcome-screen');
        this.PROJECTS_STORAGE_KEY = 'general_state_machine_has_opened';
    }

    /**
     * 初始化欢迎页面
     */
    init() {
        // 每次都显示欢迎页面
        this.show();
        
        // 添加按钮事件监听器
        this.setupEventListeners();
    }
    
    /**
     * 设置事件监听器
     */
    setupEventListeners() {
        // 打开工程按钮
        const openProjectBtn = document.getElementById('welcome-open-project');
        if (openProjectBtn) {
            openProjectBtn.addEventListener('click', () => {
                console.log('打开工程按钮被点击');
                // 触发打开工程的操作（模拟点击顶部菜单的打开工程按钮）
                const menuOpenProject = document.getElementById('open-project');
                if (menuOpenProject) {
                    menuOpenProject.click();
                }
                // 隐藏欢迎页面
                this.hide();
            });
        }
        
        // 新建工程按钮
        const newProjectBtn = document.getElementById('welcome-new-project');
        if (newProjectBtn) {
            newProjectBtn.addEventListener('click', () => {
                console.log('新建工程按钮被点击');
                // 触发新建工程的操作（模拟点击顶部菜单的新建工程按钮）
                const menuNewProject = document.getElementById('new-project');
                if (menuNewProject) {
                    menuNewProject.click();
                }
                // 隐藏欢迎页面
                this.hide();
            });
        }
    }

    /**
     * 显示欢迎页面
     */
    show() {
        if (this.welcomeScreen) {
            this.welcomeScreen.style.display = 'flex';
        }
    }

    /**
     * 隐藏欢迎页面
     */
    hide() {
        if (this.welcomeScreen) {
            // 设置动画效果
            this.welcomeScreen.style.opacity = '0';
            setTimeout(() => {
                this.welcomeScreen.style.display = 'none';
                this.welcomeScreen.style.opacity = '1'; // 重置透明度，以便下次显示
            }, 300);
        }
    }

    /**
     * 重置欢迎页面状态，下次打开时会再次显示
     */
    reset() {
        // 重置欢迎页面状态，以便下次重新显示
        localStorage.removeItem(this.PROJECTS_STORAGE_KEY);
        console.log('欢迎页面状态已重置');
    }
}

export default WelcomeScreen;

// 暴露WelcomeScreen类
window.WelcomeScreen = WelcomeScreen;

// 添加全局函数用于测试
window.resetWelcomeScreen = function() {
    if (window.welcomeScreen) {
        window.welcomeScreen.reset();
        window.welcomeScreen.show();
        console.log('欢迎页面已重新显示');
    }
};