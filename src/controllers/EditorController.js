// 编辑器控制器 - 组装所有组件，协调Model、View和ViewModel
import EditorViewModel from '../view-models/EditorViewModel.js';
import CanvasView from '../views/CanvasView.js';
import CanvasMouseHandler from '../interactions/CanvasMouseHandler.js';
import KeyboardHandler from '../interactions/KeyboardHandler.js';
// import DragDropHandler from '../interaction/DragDropHandler.js';

export default class EditorController {
    constructor(canvasId) {
        // 创建ViewModel
        this.viewModel = new EditorViewModel();
        
        // 创建View
        this.canvasView = new CanvasView(canvasId, this.viewModel);
        
        // 创建Interaction Handlers
        this.mouseHandler = new CanvasMouseHandler(this.canvasView, this.viewModel);
        this.keyboardHandler = new KeyboardHandler(this);
        // this.dragDropHandler = new DragDropHandler(this.canvasView, this.viewModel);
        
        // 设置ViewModel变更回调，触发视图更新
        this.viewModel.setOnChangeCallback(() => {
            this.canvasView.scheduleRender();
        });
        
        // 初始化事件监听
        this.setupEventListeners();
        this.setupUIListeners();
    }
    
    // 设置Canvas事件监听
    setupEventListeners() {
        const canvas = this.canvasView.getCanvas();
        
        // 鼠标事件
        canvas.addEventListener('mousedown', (e) => this.mouseHandler.handleMouseDown(e));
        canvas.addEventListener('mousemove', (e) => this.mouseHandler.handleMouseMove(e));
        canvas.addEventListener('mouseup', (e) => this.mouseHandler.handleMouseUp(e));
        canvas.addEventListener('wheel', (e) => this.mouseHandler.handleWheel(e));
        canvas.addEventListener('dblclick', (e) => this.mouseHandler.handleDoubleClick(e));
        canvas.addEventListener('mouseleave', (e) => this.mouseHandler.handleMouseLeave(e));
        
        // 禁用右键菜单
        canvas.addEventListener('contextmenu', (e) => e.preventDefault());
        
        // 键盘事件（由KeyboardHandler统一处理）
        // document.addEventListener('keydown', (e) => this.keyboardHandler.handleKeyDown(e));
    }
    
    // 设置UI元素监听
    setupUIListeners() {
        // 菜单按钮
        const newProjectBtn = document.getElementById('new-project');
        const openProjectBtn = document.getElementById('open-project');
        const saveProjectBtn = document.getElementById('save-project');
        const undoBtn = document.getElementById('undo');
        const redoBtn = document.getElementById('redo');
        const zoomInBtn = document.getElementById('zoom-in');
        const zoomOutBtn = document.getElementById('zoom-out');
        const autoArrangeBtn = document.getElementById('auto-arrange-btn');
        const realTimeArrangeBtn = document.getElementById('real-time-arrange');
        
        if (newProjectBtn) {
            newProjectBtn.addEventListener('click', () => this.newProject());
        }
        
        if (openProjectBtn) {
            openProjectBtn.addEventListener('click', () => this.openProject());
        }
        
        if (saveProjectBtn) {
            saveProjectBtn.addEventListener('click', () => this.saveProject());
        }
        
        if (undoBtn) {
            undoBtn.addEventListener('click', () => this.undo());
        }
        
        if (redoBtn) {
            redoBtn.addEventListener('click', () => this.redo());
        }
        
        if (zoomInBtn) {
            zoomInBtn.addEventListener('click', () => this.zoomIn());
        }
        
        if (zoomOutBtn) {
            zoomOutBtn.addEventListener('click', () => this.zoomOut());
        }
        
        if (autoArrangeBtn) {
            autoArrangeBtn.addEventListener('click', () => this.arrangeNodes());
        }
        
        if (realTimeArrangeBtn) {
            realTimeArrangeBtn.addEventListener('click', () => this.toggleRealTimeArrange());
        }
    }
    
    // 新建项目
    newProject() {
        if (confirm('确定要新建项目吗？当前项目的更改将会丢失。')) {
            this.viewModel.clear();
            this.canvasView.scheduleRender();
        }
    }
    
    // 打开项目
    openProject() {
        // 这里需要调用导入服务
        // 暂时保留接口
        console.log('打开项目功能待实现');
    }
    
    // 保存项目
    saveProject() {
        // 这里需要调用导出服务
        const data = this.viewModel.exportData();
        console.log('保存项目:', data);
    }
    
    // 撤销
    undo() {
        this.viewModel.undo();
    }
    
    // 重做
    redo() {
        this.viewModel.redo();
    }
    
    // 放大
    zoomIn() {
        const canvasViewModel = this.viewModel.getCanvasViewModel();
        canvasViewModel.zoomIn();
    }
    
    // 缩小
    zoomOut() {
        const canvasViewModel = this.viewModel.getCanvasViewModel();
        canvasViewModel.zoomOut();
    }
    
    // 自动排列节点
    async arrangeNodes() {
        const nodeViewModel = this.viewModel.getNodeViewModel();
        const connectionViewModel = this.viewModel.getConnectionViewModel();
        const canvas = this.canvasView.getCanvas();
        
        const nodes = nodeViewModel.getAllNodes();
        const connections = connectionViewModel.getAllConnections();
        
        // 使用LayoutService进行排列
        const LayoutService = (await import('../services/LayoutService.js')).default;
        const result = await LayoutService.arrangeWithForceLayout(
            nodes,
            connections,
            canvas.width,
            canvas.height
        );
        
        if (result.success) {
            this.canvasView.scheduleRender();
        }
    }
    
    // 切换实时排列
    toggleRealTimeArrange() {
        // 实时排列功能需要更复杂的实现
        // 暂时保留接口
        console.log('实时排列功能待实现');
    }
    
    // 获取ViewModel（供外部使用）
    getViewModel() {
        return this.viewModel;
    }
    
    // 获取CanvasView（供外部使用）
    getCanvasView() {
        return this.canvasView;
    }
}

