// Canvas鼠标事件处理器 - 使用ViewModel架构
import NodeService from '../services/NodeService.js';
import ConnectionService from '../services/ConnectionService.js';
import { isPointInRect, isPointNearLine } from '../utils/math.js';

export default class CanvasMouseHandler {
    constructor(canvasView, editorViewModel) {
        this.canvasView = canvasView;
        this.editorViewModel = editorViewModel;
        this.canvas = canvasView.getCanvas();
        
        // 鼠标状态
        this.mouseDownPos = { x: 0, y: 0 };
        this.mouseDownTime = 0;
        this.hasMoved = false;
        this.dragThreshold = 5;
        
        // 拖拽状态
        this.draggingNodeId = null;
        this.dragOffset = { x: 0, y: 0 };
        
        // 平移状态
        this.isPanning = false;
        this.panStart = { x: 0, y: 0 };
        
        // 框选状态
        this.isSelecting = false;
        this.selectionStart = { x: 0, y: 0 };
        
        // 连线创建状态
        this.creatingConnection = null;
    }
    
    // 屏幕坐标转世界坐标
    screenToWorld(screenX, screenY) {
        const canvasViewModel = this.editorViewModel.getCanvasViewModel();
        return canvasViewModel.canvasToWorld(screenX, screenY);
    }
    
    // 处理鼠标按下
    handleMouseDown(e) {
        const rect = this.canvas.getBoundingClientRect();
        const x = e.clientX - rect.left;
        const y = e.clientY - rect.top;
        const worldPos = this.screenToWorld(x, y);
        
        // 调试信息：输出鼠标按下坐标转换过程（仅右键）
        if (e.button === 2) {
            console.log('鼠标按下坐标调试:');
            console.log('- e.clientX, e.clientY:', { clientX: e.clientX, clientY: e.clientY });
            console.log('- rect.left, rect.top:', { left: rect.left, top: rect.top });
            console.log('- canvas相对坐标 (x, y):', { x, y });
            console.log('- screenToWorld结果:', worldPos);
        }
        
        this.mouseDownPos = { x: e.clientX, y: e.clientY };
        this.mouseDownTime = Date.now();
        this.hasMoved = false;
        
        // 右键菜单
        if (e.button === 2) {
            this.handleRightClick(worldPos, e.clientX, e.clientY);
            return;
        }
        
        // 中键平移
        if (e.button === 1) {
            e.preventDefault();
            this.startPanning(x, y);
            return;
        }
        
        // 左键处理
        if (e.button === 0) {
            // 如果正在创建连接（性能优化：只查询可见节点）
            if (this.creatingConnection) {
                const nodeViewModel = this.editorViewModel.getNodeViewModel();
                const visibleNodes = this.canvasView.getVisibleNodes();
                const clickedNode = nodeViewModel.getNodeAtPointFromVisible(worldPos.x, worldPos.y, visibleNodes);
                if (clickedNode && clickedNode.id !== this.creatingConnection.sourceNodeId) {
                    this.finishConnectionCreation(clickedNode.id);
                } else {
                    this.creatingConnection = null;
                    this.canvasView.scheduleRender();
                }
                return;
            }
            
            // 检查是否点击了节点（性能优化：只查询可见节点）
            const nodeViewModel = this.editorViewModel.getNodeViewModel();
            const visibleNodes = this.canvasView.getVisibleNodes();
            const clickedNode = nodeViewModel.getNodeAtPointFromVisible(worldPos.x, worldPos.y, visibleNodes);
            
            if (clickedNode) {
                this.handleNodeClick(clickedNode, worldPos, e);
                return;
            }
            
            // 检查是否点击了连线
            const clickedConnection = this.getConnectionAtPosition(worldPos);
            if (clickedConnection) {
                this.handleConnectionClick(clickedConnection, e);
                return;
            }
            
            // 开始框选
            this.startSelection(x, y);
            this.deselectAll();
        }
    }
    
    // 处理节点点击
    handleNodeClick(node, worldPos, e) {
        const editorState = this.editorViewModel.getEditorState();
        const nodeViewModel = this.editorViewModel.getNodeViewModel();
        
        // 检查是否已经被选中
        const isAlreadySelected = editorState.selectedNodeIds.has(node.id);
        
        // Ctrl+点击：切换选择
        if (e.ctrlKey || e.metaKey) {
            if (isAlreadySelected) {
                nodeViewModel.deselectNode(node.id);
            } else {
                nodeViewModel.selectNode(node.id, true);
            }
        } else {
            // 单选
            if (!isAlreadySelected) {
                editorState.clearSelection();
                nodeViewModel.selectNode(node.id, false);
            }
            
            // 准备拖动
            this.draggingNodeId = node.id;
            const nodePos = (node.transform && node.transform.position) ? node.transform.position : { x: 0, y: 0 };
            this.dragOffset.x = worldPos.x - nodePos.x;
            this.dragOffset.y = worldPos.y - nodePos.y;
        }
        
        this.canvasView.scheduleRender();
    }
    
    // 处理连线点击
    handleConnectionClick(connection, e) {
        const editorState = this.editorViewModel.getEditorState();
        const connectionViewModel = this.editorViewModel.getConnectionViewModel();
        
        if (!e.ctrlKey && !e.metaKey) {
            editorState.clearSelection();
        }
        
        connectionViewModel.selectConnection(connection.id, e.ctrlKey || e.metaKey);
        this.canvasView.scheduleRender();
    }
    
    // 处理鼠标移动
    handleMouseMove(e) {
        const rect = this.canvas.getBoundingClientRect();
        const x = e.clientX - rect.left;
        const y = e.clientY - rect.top;
        const worldPos = this.screenToWorld(x, y);
        
        // 更新最后鼠标位置（供KeyboardHandler使用）
        // 通过window.editorController访问（如果存在）
        if (window.editorController && window.editorController.keyboardHandler) {
            window.editorController.keyboardHandler.lastMousePosition = worldPos;
        }
        
        // 检测是否移动
        if (this.mouseDownPos) {
            const dx = e.clientX - this.mouseDownPos.x;
            const dy = e.clientY - this.mouseDownPos.y;
            const distance = Math.sqrt(dx * dx + dy * dy);
            if (distance > this.dragThreshold) {
                this.hasMoved = true;
            }
        }
        
        // 平移处理
        if (this.isPanning) {
            const canvasViewModel = this.editorViewModel.getCanvasViewModel();
            const deltaX = x - this.panStart.x;
            const deltaY = y - this.panStart.y;
            canvasViewModel.pan(deltaX, deltaY);
            this.panStart = { x, y };
            this.canvasView.scheduleRender();
            return;
        }
        
        // 拖动节点
        if (this.draggingNodeId) {
            const nodeViewModel = this.editorViewModel.getNodeViewModel();
            const node = nodeViewModel.getNode(this.draggingNodeId);
            if (node) {
                const nodePos = (node.transform && node.transform.position) ? node.transform.position : { x: 0, y: 0 };
                const deltaX = worldPos.x - nodePos.x - this.dragOffset.x;
                const deltaY = worldPos.y - nodePos.y - this.dragOffset.y;
                nodeViewModel.moveNode(this.draggingNodeId, deltaX, deltaY);
                this.canvasView.scheduleRender();
            }
        }
        
        // 框选处理
        if (this.isSelecting) {
            // 更新框选矩形
            const editorState = this.editorViewModel.getEditorState();
            editorState.marqueeEndX = worldPos.x;
            editorState.marqueeEndY = worldPos.y;
            this.canvasView.scheduleRender();
        }
        
        // 正在创建连线
        if (this.creatingConnection) {
            // 更新临时连线的终点
            const editorState = this.editorViewModel.getEditorState();
            editorState.marqueeEndX = worldPos.x;
            editorState.marqueeEndY = worldPos.y;
            this.canvasView.scheduleRender();
        }
    }
    
    // 处理鼠标松开
    handleMouseUp(e) {
        if (this.hasMoved) {
            this.hasMoved = false;
            this.mouseDownPos = null;
            this.stopPanningAndDragging();
            return;
        }
        
        this.hasMoved = false;
        this.mouseDownPos = null;
        this.stopPanningAndDragging();
        
        // 处理框选结束
        if (this.isSelecting) {
            this.finishSelection();
        }
    }
    
    // 处理滚轮（缩放）
    handleWheel(e) {
        e.preventDefault();
        
        const rect = this.canvas.getBoundingClientRect();
        const mouseX = e.clientX - rect.left;
        const mouseY = e.clientY - rect.top;
        
        const canvasViewModel = this.editorViewModel.getCanvasViewModel();
        const editorState = this.editorViewModel.getEditorState();
        
        // 缩放前的鼠标世界坐标
        const worldPos = canvasViewModel.canvasToWorld(mouseX, mouseY);
        
        // 应用缩放
        const delta = e.deltaY < 0 ? 0.1 : -0.1;
        canvasViewModel.zoom(delta, mouseX, mouseY);
        
        this.canvasView.scheduleRender();
    }
    
    // 处理双击
    handleDoubleClick(e) {
        const rect = this.canvas.getBoundingClientRect();
        const x = e.clientX - rect.left;
        const y = e.clientY - rect.top;
        const worldPos = this.screenToWorld(x, y);
        
        // 性能优化：只查询可见节点
        const nodeViewModel = this.editorViewModel.getNodeViewModel();
        const visibleNodes = this.canvasView.getVisibleNodes();
        const clickedNode = nodeViewModel.getNodeAtPointFromVisible(worldPos.x, worldPos.y, visibleNodes);
        
        if (clickedNode) {
            // 双击节点可以编辑属性
            // 这里可以触发属性面板更新
            console.log('双击节点:', clickedNode);
        }
    }
    
    // 处理鼠标离开
    handleMouseLeave(e) {
        this.stopPanningAndDragging();
    }
    
    // 开始平移
    startPanning(x, y) {
        this.isPanning = true;
        this.panStart = { x, y };
        this.canvas.style.cursor = 'grabbing';
    }
    
    // 开始框选
    startSelection(x, y) {
        this.isSelecting = true;
        const worldPos = this.screenToWorld(x, y);
        const editorState = this.editorViewModel.getEditorState();
        editorState.isMarqueeSelecting = true;
        editorState.marqueeStartX = worldPos.x;
        editorState.marqueeStartY = worldPos.y;
        editorState.marqueeEndX = worldPos.x;
        editorState.marqueeEndY = worldPos.y;
    }
    
    // 完成框选
    finishSelection() {
        this.isSelecting = false;
        const editorState = this.editorViewModel.getEditorState();
        editorState.isMarqueeSelecting = false;
        
        // 处理框选逻辑
        const minX = Math.min(editorState.marqueeStartX, editorState.marqueeEndX);
        const minY = Math.min(editorState.marqueeStartY, editorState.marqueeEndY);
        const maxX = Math.max(editorState.marqueeStartX, editorState.marqueeEndX);
        const maxY = Math.max(editorState.marqueeStartY, editorState.marqueeEndY);
        
        this.processSelection(minX, minY, maxX, maxY);
        this.canvasView.scheduleRender();
    }
    
    // 处理框选
    processSelection(minX, minY, maxX, maxY) {
        const selectionRect = { x: minX, y: minY, width: maxX - minX, height: maxY - minY };
        const nodeViewModel = this.editorViewModel.getNodeViewModel();
        const visibleNodes = this.canvasView.getVisibleNodes();
        
        visibleNodes.forEach(node => {
            if (node) {
                const nodePos = (node.transform && node.transform.position) ? node.transform.position : { x: 0, y: 0 };
                if (isPointInRect(nodePos.x + node.width / 2, nodePos.y + node.height / 2, selectionRect)) {
                    nodeViewModel.selectNode(node.id, true);
                }
            }
        });
    }
    
    // 停止平移和拖动
    stopPanningAndDragging() {
        if (this.isPanning) {
            this.isPanning = false;
            this.canvas.style.cursor = 'default';
        }
        
        if (this.draggingNodeId) {
            this.draggingNodeId = null;
        }
    }
    
    // 取消所有选择
    deselectAll() {
        const editorState = this.editorViewModel.getEditorState();
        editorState.clearSelection();
        this.canvasView.scheduleRender();
    }
    
    // 开始创建连线
    startConnectionCreation(sourceNodeId) {
        this.creatingConnection = { sourceNodeId };
        const editorState = this.editorViewModel.getEditorState();
        editorState.isCreatingConnection = true;
        editorState.connectionStartNodeId = sourceNodeId;
    }
    
    // 完成连线创建
    finishConnectionCreation(targetNodeId) {
        if (this.creatingConnection && 
            this.creatingConnection.sourceNodeId !== targetNodeId) {
            
            const connectionViewModel = this.editorViewModel.getConnectionViewModel();
            connectionViewModel.addConnection(
                this.creatingConnection.sourceNodeId,
                targetNodeId,
                'right',
                'left'
            );
        }
        
        this.creatingConnection = null;
        const editorState = this.editorViewModel.getEditorState();
        editorState.isCreatingConnection = false;
        this.canvasView.scheduleRender();
    }
    
    // 处理右键点击
    handleRightClick(worldPos, clientX, clientY) {
        // 调试信息：输出右键点击坐标转换过程
        console.log('右键点击坐标调试:');
        console.log('- clientX, clientY:', { clientX, clientY });
        console.log('- worldPos:', worldPos);
        
        // 获取Editor实例并调用其handleRightClick方法
        const editor = this.canvasView.getEditor();
        if (editor && editor.handleRightClick) {
            // Editor的handleRightClick需要(screenX, screenY, clientX, clientY)参数
            // 这里screenX和screenY使用clientX和clientY，因为Editor内部会进行坐标转换
            editor.handleRightClick(worldPos, clientX, clientY, clientX, clientY);
        }
    }
    
    // 获取指定位置的连线（性能优化：使用可见节点Map）
    getConnectionAtPosition(pos) {
        const visibleConnections = this.canvasView.getVisibleConnections();
        const visibleNodeMap = this.canvasView.getVisibleNodeMap();
        
        if (!visibleNodeMap) return null;
        
        // 从后往前遍历，优先检测最上层的连线
        for (let i = visibleConnections.length - 1; i >= 0; i--) {
            const connection = visibleConnections[i];
            const sourceNode = visibleNodeMap.get(connection.sourceNodeId);
            const targetNode = visibleNodeMap.get(connection.targetNodeId);
            
            // 如果节点不在可见Map中，尝试从ViewModel获取（可能只有一端可见）
            if (!sourceNode || !targetNode) {
                const nodeViewModel = this.editorViewModel.getNodeViewModel();
                const source = sourceNode || nodeViewModel.getNode(connection.sourceNodeId);
                const target = targetNode || nodeViewModel.getNode(connection.targetNodeId);
                if (!source || !target) continue;
                
                const points = ConnectionService.calculateConnectionPoints(connection, source, target);
                if (isPointNearLine(pos.x, pos.y, points.start.x, points.start.y, points.end.x, points.end.y, 5)) {
                    return connection;
                }
            } else {
                const points = ConnectionService.calculateConnectionPoints(connection, sourceNode, targetNode);
                if (isPointNearLine(pos.x, pos.y, points.start.x, points.start.y, points.end.x, points.end.y, 5)) {
                    return connection;
                }
            }
        }
        
        return null;
    }
}

