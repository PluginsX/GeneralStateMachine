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
    
    // 初始化工具栏纵向布局调整功能
    initToolbarResizer();
    
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

// 初始化工具栏纵向布局调整器
function initToolbarResizer() {
    const toolbarSection = document.querySelector('.toolbar-section');
    const objectSection = document.querySelector('.object-section');
    const toolbarResizer = document.getElementById('toolbar-resizer');
    
    if (!toolbarSection || !objectSection || !toolbarResizer) {
        console.warn('工具栏布局调整器初始化失败：缺少必要的DOM元素');
        return;
    }
    
    let isResizing = false;
    let startY = 0;
    let startToolbarHeight = 0;
    
    toolbarResizer.addEventListener('mousedown', (e) => {
        isResizing = true;
        startY = e.clientY;
        startToolbarHeight = toolbarSection.offsetHeight;
        toolbarResizer.classList.add('resizing');
        document.body.style.cursor = 'row-resize';
        document.body.style.userSelect = 'none';
        e.preventDefault();
        e.stopPropagation();
    });
    
    const handleMouseMove = (e) => {
        if (!isResizing) return;
        
        const deltaY = e.clientY - startY;
        const newHeight = startToolbarHeight + deltaY;
        const minHeight = 80;
        const maxHeight = window.innerHeight - 200; // 留出一些空间给对象栏
        
        if (newHeight >= minHeight && newHeight <= maxHeight) {
            toolbarSection.style.height = newHeight + 'px';
            toolbarSection.style.flex = '0 0 auto';
        }
    };
    
    document.addEventListener('mousemove', handleMouseMove);
    
    const handleMouseUp = () => {
        if (isResizing) {
            isResizing = false;
            toolbarResizer.classList.remove('resizing');
            document.body.style.cursor = '';
            document.body.style.userSelect = '';
        }
    };
    
    document.addEventListener('mouseup', handleMouseUp);
    document.addEventListener('mouseleave', handleMouseUp);
}