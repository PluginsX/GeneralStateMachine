import NodeGraphEditor from './core/editor.js';
import { mergeNodes, mergeConditions, removeDuplicateConnections, concentrateArrange } from './utils/automation.js';
import WelcomeScreen from './ui/WelcomeScreen.js';
import FileListManager from './ui/FileListManager.js';

// 禁用默认右键菜单
document.addEventListener('DOMContentLoaded', () => {
    document.addEventListener('contextmenu', e => e.preventDefault());
    
    // 初始化编辑器
    const editor = new NodeGraphEditor('editor-canvas');
    // 将编辑器实例赋值给window，以便其他地方可以访问
    window.editor = editor;
    
    // 初始化欢迎页面
    const welcomeScreen = new WelcomeScreen();
    welcomeScreen.init();
    // 将欢迎页面实例赋值给window，以便其他地方可以访问
    window.welcomeScreen = welcomeScreen;
    
    // 初始化文件列表管理器
    const fileListManager = new FileListManager();
    fileListManager.init();
    // 将文件列表管理器实例赋值给window，以便其他地方可以访问
    window.fileListManager = fileListManager;
    
    // 初始化UI布局调整功能
    initLayoutResizers();
    
    // 初始化工具栏纵向布局调整功能（已移除，改用卷展栏）
    // initToolbarResizer();
    
    // 初始化卷展栏功能
    initCollapsibleSections();
    
    // 绑定自动化工具按钮
    const mergeNodesBtn = document.getElementById('merge-nodes-btn');
    const mergeConditionsBtn = document.getElementById('merge-conditions-btn');
    const removeDuplicateConnectionsBtn = document.getElementById('remove-duplicate-connections-btn');
    
    if (mergeNodesBtn) {
        mergeNodesBtn.addEventListener('click', () => {
            mergeNodes(editor);
        });
    }
    
    if (mergeConditionsBtn) {
        mergeConditionsBtn.addEventListener('click', () => {
            mergeConditions(editor);
        });
    }
    
    if (removeDuplicateConnectionsBtn) {
        removeDuplicateConnectionsBtn.addEventListener('click', () => {
            removeDuplicateConnections(editor);
        });
    }
    
    // 绑定集中排列按钮
    const concentrateArrangeBtn = document.getElementById('concentrate-arrange-btn');
    if (concentrateArrangeBtn) {
        concentrateArrangeBtn.addEventListener('click', () => {
            concentrateArrange(editor);
        });
    }
    
    // 初始化设置菜单
    initSettingsMenu();
});

// 初始化布局调整器
function initLayoutResizers() {
    const toolPanel = document.querySelector('.tool-panel');
    const workspace = document.querySelector('.workspace');
    const propertyPanel = document.querySelector('.property-panel');
    const toolResizer = document.getElementById('tool-panel-resizer');
    const workspaceResizer = document.getElementById('workspace-resizer');
    
    if (!toolPanel || !workspace || !propertyPanel || !toolResizer || !workspaceResizer) {
        console.warn('布局调整器初始化失败：缺少必要的DOM元素');
        return;
    }
    
    let isResizing = false;
    let currentResizer = null;
    let startX = 0;
    let startToolWidth = 0;
    let startPropertyWidth = 0;
    
    // 工具栏调整器
    toolResizer.addEventListener('mousedown', (e) => {
        isResizing = true;
        currentResizer = 'tool';
        startX = e.clientX;
        startToolWidth = toolPanel.offsetWidth;
        toolResizer.classList.add('resizing');
        document.body.style.cursor = 'col-resize';
        document.body.style.userSelect = 'none';
        e.preventDefault();
        e.stopPropagation();
    });
    
    // 工作区调整器
    workspaceResizer.addEventListener('mousedown', (e) => {
        isResizing = true;
        currentResizer = 'workspace';
        startX = e.clientX;
        startPropertyWidth = propertyPanel.offsetWidth;
        workspaceResizer.classList.add('resizing');
        document.body.style.cursor = 'col-resize';
        document.body.style.userSelect = 'none';
        e.preventDefault();
        e.stopPropagation();
    });
    
    // 鼠标移动事件
    const handleMouseMove = (e) => {
        if (!isResizing) return;
        
        const deltaX = e.clientX - startX;
        
        if (currentResizer === 'tool') {
            const newWidth = startToolWidth + deltaX;
            const minWidth = 150;
            const maxWidth = 400;
            if (newWidth >= minWidth && newWidth <= maxWidth) {
                toolPanel.style.width = newWidth + 'px';
            }
        } else if (currentResizer === 'workspace') {
            const newWidth = startPropertyWidth - deltaX;
            const minWidth = 200;
            const maxWidth = 600;
            if (newWidth >= minWidth && newWidth <= maxWidth) {
                propertyPanel.style.width = newWidth + 'px';
            }
        }
    };
    
    document.addEventListener('mousemove', handleMouseMove);
    
    // 鼠标松开事件
    const handleMouseUp = () => {
        if (isResizing) {
            isResizing = false;
            currentResizer = null;
            toolResizer.classList.remove('resizing');
            workspaceResizer.classList.remove('resizing');
            document.body.style.cursor = '';
            document.body.style.userSelect = '';
        }
    };
    
    document.addEventListener('mouseup', handleMouseUp);
    document.addEventListener('mouseleave', handleMouseUp); // 鼠标离开窗口时也停止调整
}

// 初始化卷展栏功能
function initCollapsibleSections() {
    // 工具卷展栏
    const toolsHeader = document.getElementById('tools-header');
    const toolsContent = document.getElementById('tools-content');
    
    if (toolsHeader && toolsContent) {
        toolsHeader.addEventListener('click', () => {
            const isCollapsed = toolsContent.classList.contains('collapsed');
            if (isCollapsed) {
                toolsContent.classList.remove('collapsed');
                toolsHeader.classList.remove('collapsed');
            } else {
                toolsContent.classList.add('collapsed');
                toolsHeader.classList.add('collapsed');
            }
        });
    }
    
    // 对象卷展栏
    const objectsHeader = document.getElementById('objects-header');
    const objectsContent = document.getElementById('objects-content');
    
    if (objectsHeader && objectsContent) {
        objectsHeader.addEventListener('click', () => {
            const isCollapsed = objectsContent.classList.contains('collapsed');
            if (isCollapsed) {
                objectsContent.classList.remove('collapsed');
                objectsHeader.classList.remove('collapsed');
            } else {
                objectsContent.classList.add('collapsed');
                objectsHeader.classList.add('collapsed');
            }
        });
    }
}

// 初始化设置菜单
function initSettingsMenu() {
    // 热键设置按钮 - 使用事件委托，因为按钮可能在子菜单中
    document.addEventListener('click', (e) => {
        if (e.target && e.target.id === 'Hotkey-settings') {
            e.preventDefault();
            e.stopPropagation();
            console.log('热键设置按钮被点击');
            openShortcutConfigWindow();
        }
    });
    
    // 也直接绑定一次（如果按钮已存在）
    const hotkeySettingsBtn = document.getElementById('Hotkey-settings');
    if (hotkeySettingsBtn) {
        hotkeySettingsBtn.addEventListener('click', (e) => {
            e.preventDefault();
            e.stopPropagation();
            console.log('热键设置按钮被点击（直接绑定）');
            openShortcutConfigWindow();
        });
    }
}

// 打开快捷键配置窗口
async function openShortcutConfigWindow() {
    try {
        console.log('开始打开快捷键配置窗口...');
        
        // 动态导入模块
        const { default: ShortcutConfigWindow } = await import('./ui/ShortcutConfigWindow.js');
        const { default: ShortcutManager } = await import('./services/ShortcutManager.js');
        const { default: CommandService } = await import('./services/CommandService.js');
        
        console.log('模块导入成功');
        
        // 获取或创建ShortcutManager
        let shortcutManager = window.shortcutManager;
        if (!shortcutManager) {
            console.log('创建新的ShortcutManager...');
            // 如果没有全局的shortcutManager，创建一个
            const commandService = new CommandService();
            shortcutManager = new ShortcutManager(commandService);
            await shortcutManager.loadDefaultConfig();
            window.shortcutManager = shortcutManager;
            console.log('ShortcutManager创建完成');
        } else {
            console.log('使用现有的ShortcutManager');
        }
        
        // 创建并显示窗口
        console.log('创建ShortcutConfigWindow...');
        const configWindow = new ShortcutConfigWindow(shortcutManager);
        configWindow.show();
        console.log('窗口已显示');
    } catch (error) {
        console.error('打开快捷键配置窗口失败:', error);
        alert('打开快捷键设置窗口失败: ' + error.message);
    }
}