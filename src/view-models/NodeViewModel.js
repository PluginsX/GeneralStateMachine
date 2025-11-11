// 节点ViewModel - 管理节点相关的状态和操作
import NodeModel from '../models/NodeModel.js';
import NodeService from '../services/NodeService.js';
import { deepClone } from '../utils/common.js';

export default class NodeViewModel {
    constructor(editorState, historyManager) {
        this.nodes = new Map(); // 存储所有节点，key为nodeId
        this.editorState = editorState;
        this.historyManager = historyManager;
        this.onChange = null; // 变更回调函数
    }
    
    // 设置变更回调
    setOnChangeCallback(callback) {
        this.onChange = callback;
    }
    
    // 添加节点
    addNode(name, x, y) {
        const node = new NodeModel(name, x, y);
        this.nodes.set(node.id, node);
        
        // 记录历史
        if (this.historyManager) {
            this.historyManager.addHistory('add-node', {
                nodeId: node.id,
                node: deepClone(node)
            });
        }
        
        this.notifyChange();
        return node;
    }
    
    // 删除节点
    deleteNode(nodeId) {
        if (!this.nodes.has(nodeId)) return false;
        
        const node = this.nodes.get(nodeId);
        this.nodes.delete(nodeId);
        
        // 从选中状态中移除
        this.editorState.selectedNodeIds.delete(nodeId);
        
        // 记录历史
        if (this.historyManager) {
            this.historyManager.addHistory('delete-node', {
                node: deepClone(node)
            });
        }
        
        this.notifyChange();
        return true;
    }
    
    // 删除选中的节点
    deleteSelectedNodes() {
        const deletedNodes = [];
        const selectedIds = Array.from(this.editorState.selectedNodeIds);
        
        for (const nodeId of selectedIds) {
            if (this.nodes.has(nodeId)) {
                deletedNodes.push(deepClone(this.nodes.get(nodeId)));
                this.nodes.delete(nodeId);
            }
        }
        
        this.editorState.selectedNodeIds.clear();
        
        if (this.historyManager && deletedNodes.length > 0) {
            this.historyManager.addHistory('delete-selected-nodes', {
                nodes: deletedNodes
            });
        }
        
        this.notifyChange();
        return deletedNodes.length > 0;
    }
    
    // 更新节点属性
    updateNode(nodeId, updates) {
        const node = this.nodes.get(nodeId);
        if (!node) return false;
        
        const oldValues = {};
        Object.keys(updates).forEach(key => {
            oldValues[key] = node[key];
            node[key] = updates[key];
        });
        
        if (this.historyManager) {
            this.historyManager.addHistory('update-node', {
                nodeId: nodeId,
                oldValues: oldValues,
                newValues: updates
            });
        }
        
        this.notifyChange();
        return true;
    }
    
    // 获取节点
    getNode(nodeId) {
        return this.nodes.get(nodeId);
    }
    
    // 获取所有节点（返回数组）
    getAllNodes() {
        return Array.from(this.nodes.values());
    }
    
    // 获取所有节点的迭代器（性能优化：避免创建数组）
    getAllNodesIterator() {
        return this.nodes.values();
    }
    
    // 获取节点数量（用于性能监控）
    getNodeCount() {
        return this.nodes.size;
    }
    
    // 移动节点
    moveNode(nodeId, deltaX, deltaY) {
        const node = this.nodes.get(nodeId);
        if (!node) return false;
        
        node.x += deltaX;
        node.y += deltaY;
        
        this.notifyChange();
        return true;
    }
    
    // 移动选中的节点
    moveSelectedNodes(deltaX, deltaY) {
        let moved = false;
        this.editorState.selectedNodeIds.forEach(nodeId => {
            if (this.moveNode(nodeId, deltaX, deltaY)) {
                moved = true;
            }
        });
        return moved;
    }
    
    // 选中节点
    selectNode(nodeId, multiSelect = false) {
        if (!this.nodes.has(nodeId)) return false;
        
        if (!multiSelect) {
            this.editorState.clearSelection();
        }
        
        this.editorState.selectedNodeIds.add(nodeId);
        this.notifyChange();
        return true;
    }
    
    // 取消选中节点
    deselectNode(nodeId) {
        this.editorState.selectedNodeIds.delete(nodeId);
        this.notifyChange();
    }
    
    // 获取包含指定点的节点（从所有节点中查找 - 性能较差，不推荐使用）
    getNodeAtPoint(x, y) {
        for (const node of this.nodes.values()) {
            if (NodeService.isPointInNode(node, x, y)) {
                return node;
            }
        }
        return null;
    }
    
    // 获取包含指定点的节点（从可见节点列表中查找 - 性能优化版本，推荐使用）
    // 从后往前遍历，优先检测最上层的节点（最后绘制的）
    getNodeAtPointFromVisible(x, y, visibleNodes) {
        if (!visibleNodes || visibleNodes.length === 0) return null;
        
        for (let i = visibleNodes.length - 1; i >= 0; i--) {
            const node = visibleNodes[i];
            if (NodeService.isPointInNode(node, x, y)) {
                return node;
            }
        }
        return null;
    }
    
    // 批量获取节点（避免多次Map查找）
    getNodesByIds(nodeIds) {
        const result = [];
        for (const id of nodeIds) {
            const node = this.nodes.get(id);
            if (node) {
                result.push(node);
            }
        }
        return result;
    }
    
    // 计算节点自适应尺寸（使用Service）
    calculateAutoSize(nodeId, ctx) {
        const node = this.nodes.get(nodeId);
        if (!node) return false;
        
        NodeService.calculateAutoSize(node, ctx);
        this.notifyChange();
        return true;
    }
    
    // 从数据加载节点
    loadFromData(data) {
        this.nodes.clear();
        if (data.nodes && Array.isArray(data.nodes)) {
            data.nodes.forEach(nodeData => {
                const node = NodeModel.fromData(nodeData);
                this.nodes.set(node.id, node);
            });
        }
        this.notifyChange();
    }
    
    // 通知变更
    notifyChange() {
        if (this.onChange) {
            this.onChange();
        }
    }
}
