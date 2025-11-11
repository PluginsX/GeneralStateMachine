// 编辑器主ViewModel - 统一管理所有ViewModel和状态
import EditorStateModel from '../models/EditorStateModel.js';
import NodeViewModel from './NodeViewModel.js';
import ConnectionViewModel from './ConnectionViewModel.js';
import CanvasViewModel from './CanvasViewModel.js';
import { HistoryManager } from '../history/history.js';

export default class EditorViewModel {
    constructor() {
        // 核心状态
        this.editorState = new EditorStateModel();
        this.historyManager = new HistoryManager(50);
        
        // 子ViewModel
        this.nodeViewModel = new NodeViewModel(this.editorState, this.historyManager);
        this.connectionViewModel = new ConnectionViewModel(this.editorState, this.historyManager);
        this.canvasViewModel = new CanvasViewModel(this.editorState, this.historyManager);
        
        // 统一变更回调
        this.onChange = null;
        
        // 设置子ViewModel的变更回调
        this.nodeViewModel.setOnChangeCallback(() => this.notifyChange());
        this.connectionViewModel.setOnChangeCallback(() => this.notifyChange());
        this.canvasViewModel.setOnChangeCallback(() => this.notifyChange());
    }
    
    // 设置变更回调
    setOnChangeCallback(callback) {
        this.onChange = callback;
    }
    
    // 获取节点ViewModel
    getNodeViewModel() {
        return this.nodeViewModel;
    }
    
    // 获取连线ViewModel
    getConnectionViewModel() {
        return this.connectionViewModel;
    }
    
    // 获取画布ViewModel
    getCanvasViewModel() {
        return this.canvasViewModel;
    }
    
    // 获取编辑器状态
    getEditorState() {
        return this.editorState;
    }
    
    // 获取历史管理器
    getHistoryManager() {
        return this.historyManager;
    }
    
    // 撤销
    undo() {
        const item = this.historyManager.undo();
        if (!item) return false;
        
        // 根据历史记录类型执行撤销操作
        // 这里需要根据实际的历史记录结构来实现
        this.notifyChange();
        return true;
    }
    
    // 重做
    redo() {
        const item = this.historyManager.redo();
        if (!item) return false;
        
        // 根据历史记录类型执行重做操作
        this.notifyChange();
        return true;
    }
    
    // 清空所有数据
    clear() {
        this.nodeViewModel.nodes.clear();
        this.connectionViewModel.connections.clear();
        this.editorState.clearSelection();
        this.editorState.resetView();
        this.historyManager = new HistoryManager(50);
        this.notifyChange();
    }
    
    // 从数据加载
    loadFromData(data) {
        this.nodeViewModel.loadFromData(data);
        this.connectionViewModel.loadFromData(data);
        this.notifyChange();
    }
    
    // 导出数据
    exportData() {
        return {
            nodes: this.nodeViewModel.getAllNodes().map(node => {
                const { id, type, name, description, x, y, width, height, autoSize, color } = node;
                return { id, type, name, description, x, y, width, height, autoSize, color };
            }),
            connections: this.connectionViewModel.getAllConnections().map(conn => {
                const { id, type, sourceNodeId, targetNodeId, fromSide, toSide, conditions, color, lineWidth, lineType } = conn;
                return { id, type, sourceNodeId, targetNodeId, fromSide, toSide, conditions, color, lineWidth, lineType };
            })
        };
    }
    
    // 通知变更
    notifyChange() {
        if (this.onChange) {
            this.onChange();
        }
    }
}

