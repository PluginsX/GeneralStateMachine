import { createConditionElement } from '../utils/dom.js';
import Condition from '../core/condition.js';
import { ConfirmDialog } from '../utils/popup.js';

// 属性面板管理
export const updatePropertyPanel = (editor) => {
    const nodeProperties = document.getElementById('node-properties');
    const connectionProperties = document.getElementById('connection-properties');
    const noSelection = document.getElementById('no-selection');
    
    // 隐藏所有面板
    if (nodeProperties) nodeProperties.classList.add('hidden');
    if (connectionProperties) connectionProperties.classList.add('hidden');
    if (noSelection) noSelection.classList.add('hidden');
    
    // 从selectedElements获取选中状态（优先使用editor.selectedElements）
    if (editor && editor.selectedElements && editor.selectedElements.length > 0) {
        const selectedElements = editor.selectedElements;
        const selectedNodes = selectedElements.filter(el => el.type === 'node');
        const selectedConnections = selectedElements.filter(el => el.type === 'connection');
        const selectedTexts = selectedElements.filter(el => el.type === 'text');
        
        // 处理单个节点选中
        if (selectedNodes.length === 1 && selectedConnections.length === 0 && selectedTexts.length === 0) {
            const node = selectedNodes[0];
            if (node) {
                node.type = 'node';
                showNodeProperties(node, editor);
                return;
            }
        }
        // 处理单个连接选中
        else if (selectedConnections.length === 1 && selectedNodes.length === 0 && selectedTexts.length === 0) {
            const connection = selectedConnections[0];
            if (connection) {
                // 确保连接有type属性（关键修复：确保连接可以被正确识别）
                if (!connection.type || connection.type !== 'connection') {
                    connection.type = 'connection';
                }
                console.log('显示连接属性面板:', connection);
                showConnectionProperties(connection, editor);
                return;
            }
        }
        // 处理单个文字内容对象选中
        else if (selectedTexts.length === 1 && selectedNodes.length === 0 && selectedConnections.length === 0) {
            const text = selectedTexts[0];
            if (text) {
                text.type = 'text';
                showTextContentProperties(text, editor);
                return;
            }
        }
        // 处理多个选中项
        else if (selectedElements.length > 1) {
            showMultipleSelectionProperties(selectedElements, editor);
            return;
        }
    }
    
    // 如果没有选中项，尝试从ViewModel获取（兼容性处理）
    if (editor && editor.viewModel) {
        const editorState = editor.viewModel.getEditorState();
        const selectedNodeIds = Array.from(editorState.selectedNodeIds);
        const selectedConnectionIds = Array.from(editorState.selectedConnectionIds);
        
        // 处理单个节点选中
        if (selectedNodeIds.length === 1 && selectedConnectionIds.length === 0) {
            const nodeViewModel = editor.viewModel.getNodeViewModel();
            const node = nodeViewModel.getNode(selectedNodeIds[0]);
            if (node) {
                node.type = 'node';
                showNodeProperties(node, editor);
                return;
            }
        } 
        // 处理单个连接选中
        else if (selectedConnectionIds.length === 1 && selectedNodeIds.length === 0) {
            const connectionViewModel = editor.viewModel.getConnectionViewModel();
            const connection = connectionViewModel.getConnection(selectedConnectionIds[0]);
            if (connection) {
                connection.type = 'connection';
                showConnectionProperties(connection, editor);
                return;
            }
        }
        // 处理多个连接选中
        else if (selectedConnectionIds.length > 1) {
            const connectionViewModel = editor.viewModel.getConnectionViewModel();
            const connections = selectedConnectionIds.map(id => {
                const conn = connectionViewModel.getConnection(id);
                if (conn) conn.type = 'connection';
                return conn;
            }).filter(Boolean);
            showMultipleConnectionProperties(connections, editor);
            return;
        }
    }
    
    // 无选中状态
    if (noSelection) noSelection.classList.remove('hidden');
};

export const showNodeProperties = (node, editor) => {
    const nodeProperties = document.getElementById('node-properties');
    if (!nodeProperties) return;
    
    nodeProperties.classList.remove('hidden');
    nodeProperties.innerHTML = '';
    
    // 创建标题
    const title = document.createElement('h3');
    title.textContent = '节点属性';
    title.style.cssText = 'margin: 0 0 15px 0; padding-bottom: 10px; border-bottom: 1px solid rgba(255, 255, 255, 0.1); color: #e0e0e0;';
    if (document.body.classList.contains('light-mode')) {
        title.style.borderBottomColor = 'rgba(0, 0, 0, 0.1)';
        title.style.color = '#333';
    }
    nodeProperties.appendChild(title);
    
    // 节点名称
    const nameLabel = document.createElement('label');
    nameLabel.textContent = '节点名称:';
    nameLabel.style.cssText = 'display: block; margin-top: 10px; margin-bottom: 5px; color: #b0b0b0; font-size: 12px;';
    if (document.body.classList.contains('light-mode')) {
        nameLabel.style.color = '#666';
    }
    const nameInput = document.createElement('input');
    nameInput.type = 'text';
    nameInput.value = node.name || '';
    nameInput.style.cssText = 'width: 100%; padding: 6px; border: 1px solid rgba(255, 255, 255, 0.2); border-radius: 3px; background: rgba(255, 255, 255, 0.05); color: #e0e0e0; font-size: 13px;';
    if (document.body.classList.contains('light-mode')) {
        nameInput.style.borderColor = 'rgba(0, 0, 0, 0.2)';
        nameInput.style.background = '#fff';
        nameInput.style.color = '#333';
    }
    nameInput.oninput = () => {
        node.name = nameInput.value;
        editor.scheduleRender();
    };
    nodeProperties.appendChild(nameLabel);
    nodeProperties.appendChild(nameInput);
    
    // 节点描述
    const descLabel = document.createElement('label');
    descLabel.textContent = '节点描述:';
    descLabel.style.cssText = 'display: block; margin-top: 10px; margin-bottom: 5px; color: #b0b0b0; font-size: 12px;';
    if (document.body.classList.contains('light-mode')) {
        descLabel.style.color = '#666';
    }
    const descInput = document.createElement('textarea');
    descInput.value = node.description || '';
    descInput.rows = 3;
    descInput.style.cssText = 'width: 100%; padding: 6px; border: 1px solid rgba(255, 255, 255, 0.2); border-radius: 3px; background: rgba(255, 255, 255, 0.05); color: #e0e0e0; font-size: 13px; resize: vertical;';
    if (document.body.classList.contains('light-mode')) {
        descInput.style.borderColor = 'rgba(0, 0, 0, 0.2)';
        descInput.style.background = '#fff';
        descInput.style.color = '#333';
    }
    descInput.oninput = () => {
        node.description = descInput.value;
        editor.scheduleRender();
    };
    nodeProperties.appendChild(descLabel);
    nodeProperties.appendChild(descInput);
    
    // 节点组
    const groupLabel = document.createElement('label');
    groupLabel.textContent = '节点组:';
    groupLabel.style.cssText = 'display: block; margin-top: 10px; margin-bottom: 5px; color: #b0b0b0; font-size: 12px;';
    if (document.body.classList.contains('light-mode')) {
        groupLabel.style.color = '#666';
    }
    const groupInput = document.createElement('input');
    groupInput.type = 'text';
    groupInput.value = node.group || '';
    groupInput.style.cssText = 'width: 100%; padding: 6px; border: 1px solid rgba(255, 255, 255, 0.2); border-radius: 3px; background: rgba(255, 255, 255, 0.05); color: #e0e0e0; font-size: 13px;';
    if (document.body.classList.contains('light-mode')) {
        groupInput.style.borderColor = 'rgba(0, 0, 0, 0.2)';
        groupInput.style.background = '#fff';
        groupInput.style.color = '#333';
    }
    groupInput.oninput = () => {
        node.group = groupInput.value;
        editor.scheduleRender();
    };
    nodeProperties.appendChild(groupLabel);
    nodeProperties.appendChild(groupInput);
    
    // 位置
    const positionLabel = document.createElement('label');
    positionLabel.textContent = '位置:';
    positionLabel.style.cssText = 'display: block; margin-top: 10px; margin-bottom: 5px; color: #b0b0b0; font-size: 12px;';
    if (document.body.classList.contains('light-mode')) {
        positionLabel.style.color = '#666';
    }
    const posContainer = document.createElement('div');
    posContainer.style.display = 'flex';
    posContainer.style.gap = '10px';
    const posXInput = document.createElement('input');
    posXInput.type = 'number';
    const pos = (node.transform && node.transform.position) ? node.transform.position : { x: 0, y: 0 };
    posXInput.value = pos.x || 0;
    posXInput.style.cssText = 'flex: 1; padding: 6px; border: 1px solid rgba(255, 255, 255, 0.2); border-radius: 3px; background: rgba(255, 255, 255, 0.05); color: #e0e0e0; font-size: 13px;';
    if (document.body.classList.contains('light-mode')) {
        posXInput.style.borderColor = 'rgba(0, 0, 0, 0.2)';
        posXInput.style.background = '#fff';
        posXInput.style.color = '#333';
    }
    posXInput.oninput = () => {
        if (!node.transform) {
            node.transform = { position: { x: 0, y: 0 } };
        }
        if (!node.transform.position) {
            node.transform.position = { x: 0, y: 0 };
        }
        node.transform.position.x = parseFloat(posXInput.value) || 0;
        editor.scheduleRender();
    };
    const posYInput = document.createElement('input');
    posYInput.type = 'number';
    posYInput.value = pos.y || 0;
    posYInput.style.cssText = 'flex: 1; padding: 6px; border: 1px solid rgba(255, 255, 255, 0.2); border-radius: 3px; background: rgba(255, 255, 255, 0.05); color: #e0e0e0; font-size: 13px;';
    if (document.body.classList.contains('light-mode')) {
        posYInput.style.borderColor = 'rgba(0, 0, 0, 0.2)';
        posYInput.style.background = '#fff';
        posYInput.style.color = '#333';
    }
    posYInput.oninput = () => {
        if (!node.transform) {
            node.transform = { position: { x: 0, y: 0 } };
        }
        if (!node.transform.position) {
            node.transform.position = { x: 0, y: 0 };
        }
        node.transform.position.y = parseFloat(posYInput.value) || 0;
        editor.scheduleRender();
    };
    posContainer.appendChild(posXInput);
    posContainer.appendChild(posYInput);
    nodeProperties.appendChild(positionLabel);
    nodeProperties.appendChild(posContainer);
    
    // 尺寸
    const sizeLabel = document.createElement('label');
    sizeLabel.textContent = '尺寸:';
    sizeLabel.style.cssText = 'display: block; margin-top: 10px; margin-bottom: 5px; color: #b0b0b0; font-size: 12px;';
    if (document.body.classList.contains('light-mode')) {
        sizeLabel.style.color = '#666';
    }
    const sizeContainer = document.createElement('div');
    sizeContainer.style.display = 'flex';
    sizeContainer.style.gap = '10px';
    const widthInput = document.createElement('input');
    widthInput.type = 'number';
    widthInput.value = node.width || 150;
    widthInput.disabled = node.autoSize;
    widthInput.style.cssText = 'flex: 1; padding: 6px; border: 1px solid rgba(255, 255, 255, 0.2); border-radius: 3px; background: rgba(255, 255, 255, 0.05); color: #e0e0e0; font-size: 13px;';
    if (document.body.classList.contains('light-mode')) {
        widthInput.style.borderColor = 'rgba(0, 0, 0, 0.2)';
        widthInput.style.background = '#fff';
        widthInput.style.color = '#333';
    }
    widthInput.oninput = () => {
        if (!node.autoSize) {
            node.width = parseInt(widthInput.value) || 150;
            editor.scheduleRender();
        }
    };
    const heightInput = document.createElement('input');
    heightInput.type = 'number';
    heightInput.value = node.height || 50;
    heightInput.disabled = node.autoSize;
    heightInput.style.cssText = 'flex: 1; padding: 6px; border: 1px solid rgba(255, 255, 255, 0.2); border-radius: 3px; background: rgba(255, 255, 255, 0.05); color: #e0e0e0; font-size: 13px;';
    if (document.body.classList.contains('light-mode')) {
        heightInput.style.borderColor = 'rgba(0, 0, 0, 0.2)';
        heightInput.style.background = '#fff';
        heightInput.style.color = '#333';
    }
    heightInput.oninput = () => {
        if (!node.autoSize) {
            node.height = parseInt(heightInput.value) || 50;
            editor.scheduleRender();
        }
    };
    sizeContainer.appendChild(widthInput);
    sizeContainer.appendChild(heightInput);
    nodeProperties.appendChild(sizeLabel);
    nodeProperties.appendChild(sizeContainer);
    
    // 自适应尺寸
    const autosizeLabel = document.createElement('label');
    autosizeLabel.style.cssText = 'display: flex; align-items: center; margin-top: 10px; cursor: pointer;';
    const autosizeInput = document.createElement('input');
    autosizeInput.type = 'checkbox';
    autosizeInput.checked = node.autoSize || false;
    autosizeInput.onchange = () => {
        node.autoSize = autosizeInput.checked;
        widthInput.disabled = node.autoSize;
        heightInput.disabled = node.autoSize;
        editor.scheduleRender();
    };
    const autosizeText = document.createElement('span');
    autosizeText.textContent = '自适应尺寸';
    autosizeText.style.cssText = 'margin-left: 8px; color: #b0b0b0; font-size: 12px;';
    if (document.body.classList.contains('light-mode')) {
        autosizeText.style.color = '#666';
    }
    autosizeLabel.appendChild(autosizeInput);
    autosizeLabel.appendChild(autosizeText);
    nodeProperties.appendChild(autosizeLabel);
    
    // 颜色
    const colorLabel = document.createElement('label');
    colorLabel.textContent = '节点颜色:';
    colorLabel.style.cssText = 'display: block; margin-top: 10px; margin-bottom: 5px; color: #b0b0b0; font-size: 12px;';
    if (document.body.classList.contains('light-mode')) {
        colorLabel.style.color = '#666';
    }
    const colorContainer = document.createElement('div');
    colorContainer.style.display = 'flex';
    colorContainer.style.gap = '10px';
    const colorInput = document.createElement('input');
    colorInput.type = 'color';
    colorInput.value = node.color || '#ffffff';
    colorInput.style.cssText = 'flex: 1; padding: 2px; border: 1px solid rgba(255, 255, 255, 0.2); border-radius: 3px; background: rgba(255, 255, 255, 0.05);';
    colorInput.oninput = () => {
        node.color = colorInput.value;
        editor.scheduleRender();
    };
    const colorResetBtn = document.createElement('button');
    colorResetBtn.textContent = '重置';
    colorResetBtn.className = 'btn btn-small';
    colorResetBtn.style.cssText = 'padding: 6px 12px;';
    colorResetBtn.onclick = () => {
        node.color = null;
        colorInput.value = '#ffffff';
        editor.scheduleRender();
    };
    colorContainer.appendChild(colorInput);
    colorContainer.appendChild(colorResetBtn);
    nodeProperties.appendChild(colorLabel);
    nodeProperties.appendChild(colorContainer);
    
    // D3力导向图参数
    const forceSection = document.createElement('div');
    forceSection.style.cssText = 'margin-top: 15px; padding-top: 15px; border-top: 1px solid rgba(255, 255, 255, 0.1);';
    if (document.body.classList.contains('light-mode')) {
        forceSection.style.borderTopColor = 'rgba(0, 0, 0, 0.1)';
    }
    const forceTitle = document.createElement('h4');
    forceTitle.textContent = '力导向图参数';
    forceTitle.style.cssText = 'margin: 0 0 10px 0; font-size: 13px; color: #b0b0b0;';
    if (document.body.classList.contains('light-mode')) {
        forceTitle.style.color = '#666';
    }
    forceSection.appendChild(forceTitle);
    
    // 电荷力强度
    const forceChargeLabel = document.createElement('label');
    forceChargeLabel.textContent = '电荷力强度:';
    forceChargeLabel.style.cssText = 'display: block; margin-top: 10px; margin-bottom: 5px; color: #b0b0b0; font-size: 12px;';
    if (document.body.classList.contains('light-mode')) {
        forceChargeLabel.style.color = '#666';
    }
    const forceChargeInput = document.createElement('input');
    forceChargeInput.type = 'number';
    forceChargeInput.value = node.forceCharge !== undefined ? node.forceCharge : -300;
    forceChargeInput.style.cssText = 'width: 100%; padding: 6px; border: 1px solid rgba(255, 255, 255, 0.2); border-radius: 3px; background: rgba(255, 255, 255, 0.05); color: #e0e0e0; font-size: 13px;';
    if (document.body.classList.contains('light-mode')) {
        forceChargeInput.style.borderColor = 'rgba(0, 0, 0, 0.2)';
        forceChargeInput.style.background = '#fff';
        forceChargeInput.style.color = '#333';
    }
    forceChargeInput.oninput = () => {
        node.forceCharge = parseInt(forceChargeInput.value) || -300;
        editor.scheduleRender();
    };
    forceSection.appendChild(forceChargeLabel);
    forceSection.appendChild(forceChargeInput);
    
    // 碰撞力半径
    const forceCollideLabel = document.createElement('label');
    forceCollideLabel.textContent = '碰撞力半径:';
    forceCollideLabel.style.cssText = 'display: block; margin-top: 10px; margin-bottom: 5px; color: #b0b0b0; font-size: 12px;';
    if (document.body.classList.contains('light-mode')) {
        forceCollideLabel.style.color = '#666';
    }
    const forceCollideInput = document.createElement('input');
    forceCollideInput.type = 'number';
    forceCollideInput.value = node.forceCollideRadius !== undefined && node.forceCollideRadius !== null ? node.forceCollideRadius : '';
    forceCollideInput.placeholder = '留空使用默认值';
    forceCollideInput.style.cssText = 'width: 100%; padding: 6px; border: 1px solid rgba(255, 255, 255, 0.2); border-radius: 3px; background: rgba(255, 255, 255, 0.05); color: #e0e0e0; font-size: 13px;';
    if (document.body.classList.contains('light-mode')) {
        forceCollideInput.style.borderColor = 'rgba(0, 0, 0, 0.2)';
        forceCollideInput.style.background = '#fff';
        forceCollideInput.style.color = '#333';
    }
    forceCollideInput.oninput = () => {
        const value = forceCollideInput.value.trim();
        node.forceCollideRadius = value ? parseInt(value) : null;
        editor.scheduleRender();
    };
    forceSection.appendChild(forceCollideLabel);
    forceSection.appendChild(forceCollideInput);
    
    // 力强度系数
    const forceStrengthLabel = document.createElement('label');
    forceStrengthLabel.textContent = '力强度系数:';
    forceStrengthLabel.style.cssText = 'display: block; margin-top: 10px; margin-bottom: 5px; color: #b0b0b0; font-size: 12px;';
    if (document.body.classList.contains('light-mode')) {
        forceStrengthLabel.style.color = '#666';
    }
    const forceStrengthInput = document.createElement('input');
    forceStrengthInput.type = 'number';
    forceStrengthInput.step = '0.1';
    forceStrengthInput.value = node.forceStrength !== undefined ? node.forceStrength : 1;
    forceStrengthInput.style.cssText = 'width: 100%; padding: 6px; border: 1px solid rgba(255, 255, 255, 0.2); border-radius: 3px; background: rgba(255, 255, 255, 0.05); color: #e0e0e0; font-size: 13px;';
    if (document.body.classList.contains('light-mode')) {
        forceStrengthInput.style.borderColor = 'rgba(0, 0, 0, 0.2)';
        forceStrengthInput.style.background = '#fff';
        forceStrengthInput.style.color = '#333';
    }
    forceStrengthInput.oninput = () => {
        node.forceStrength = parseFloat(forceStrengthInput.value) || 1;
        editor.scheduleRender();
    };
    forceSection.appendChild(forceStrengthLabel);
    forceSection.appendChild(forceStrengthInput);
    
    // 固定位置
    const fixedPositionLabel = document.createElement('label');
    fixedPositionLabel.style.cssText = 'display: flex; align-items: center; margin-top: 10px; cursor: pointer;';
    const fixedPositionInput = document.createElement('input');
    fixedPositionInput.type = 'checkbox';
    fixedPositionInput.checked = node.fixedPosition || false;
    fixedPositionInput.onchange = () => {
        node.fixedPosition = fixedPositionInput.checked;
        editor.scheduleRender();
    };
    const fixedPositionText = document.createElement('span');
    fixedPositionText.textContent = '固定位置';
    fixedPositionText.style.cssText = 'margin-left: 8px; color: #b0b0b0; font-size: 12px;';
    if (document.body.classList.contains('light-mode')) {
        fixedPositionText.style.color = '#666';
    }
    fixedPositionLabel.appendChild(fixedPositionInput);
    fixedPositionLabel.appendChild(fixedPositionText);
    forceSection.appendChild(fixedPositionLabel);
    
    nodeProperties.appendChild(forceSection);
    
    // 删除按钮
    const deleteBtn = document.createElement('button');
    deleteBtn.className = 'btn btn-danger';
    deleteBtn.textContent = '删除节点';
    deleteBtn.style.cssText = 'margin-top: 15px; width: 100%;';
    deleteBtn.onclick = async () => {
        const confirmed = await ConfirmDialog('确定要删除这个节点吗？');
        if (confirmed) {
            editor.removeNode(node.id);
            editor.selectedElements = editor.selectedElements.filter(el => el.id !== node.id);
            updatePropertyPanel(editor);
            editor.scheduleRender();
        }
    };
    nodeProperties.appendChild(deleteBtn);
    
    // 显示连线列表（需要修改updateNodeConnectionsList以支持动态创建）
    const connectionsSection = document.createElement('div');
    connectionsSection.style.cssText = 'margin-top: 15px; padding-top: 15px; border-top: 1px solid rgba(255, 255, 255, 0.1);';
    if (document.body.classList.contains('light-mode')) {
        connectionsSection.style.borderTopColor = 'rgba(0, 0, 0, 0.1)';
    }
    const connectionsTitle = document.createElement('h4');
    connectionsTitle.textContent = '连线';
    connectionsTitle.style.cssText = 'margin: 0 0 10px 0; font-size: 13px; color: #b0b0b0;';
    if (document.body.classList.contains('light-mode')) {
        connectionsTitle.style.color = '#666';
    }
    connectionsSection.appendChild(connectionsTitle);
    
    const outgoingList = document.createElement('div');
    outgoingList.id = 'outgoing-connections-dynamic';
    const incomingList = document.createElement('div');
    incomingList.id = 'incoming-connections-dynamic';
    
    const outgoingLabel = document.createElement('div');
    outgoingLabel.textContent = '出发的连线:';
    outgoingLabel.style.cssText = 'font-size: 11px; color: #888; margin-bottom: 5px;';
    if (document.body.classList.contains('light-mode')) {
        outgoingLabel.style.color = '#999';
    }
    connectionsSection.appendChild(outgoingLabel);
    connectionsSection.appendChild(outgoingList);
    
    const incomingLabel = document.createElement('div');
    incomingLabel.textContent = '到达的连线:';
    incomingLabel.style.cssText = 'font-size: 11px; color: #888; margin-top: 10px; margin-bottom: 5px;';
    if (document.body.classList.contains('light-mode')) {
        incomingLabel.style.color = '#999';
    }
    connectionsSection.appendChild(incomingLabel);
    connectionsSection.appendChild(incomingList);
    
    nodeProperties.appendChild(connectionsSection);
    
    // 更新连线列表
    updateNodeConnectionsListDynamic(node, editor, outgoingList, incomingList);
};

// 更新节点连线列表（动态版本）
const updateNodeConnectionsListDynamic = (node, editor, outgoingList, incomingList) => {
    // 清空列表
    outgoingList.innerHTML = '';
    incomingList.innerHTML = '';
    
    // 获取出发的连线
    const outgoingConnections = editor.connections.filter(conn => conn.sourceNodeId === node.id);
    outgoingConnections.forEach(conn => {
        const targetNode = editor.nodes.find(n => n.id === conn.targetNodeId);
        if (targetNode) {
            const item = createConnectionListItem(conn, targetNode.name, 'outgoing', editor);
            outgoingList.appendChild(item);
        }
    });
    
    // 获取到达的连线
    const incomingConnections = editor.connections.filter(conn => conn.targetNodeId === node.id);
    incomingConnections.forEach(conn => {
        const sourceNode = editor.nodes.find(n => n.id === conn.sourceNodeId);
        if (sourceNode) {
            const item = createConnectionListItem(conn, sourceNode.name, 'incoming', editor);
            incomingList.appendChild(item);
        }
    });
    
    // 如果没有连线，显示提示
    if (outgoingConnections.length === 0) {
        const emptyItem = document.createElement('div');
        emptyItem.className = 'connection-list-empty';
        emptyItem.textContent = '无';
        emptyItem.style.cssText = 'color: #666; font-size: 11px; padding: 5px;';
        if (document.body.classList.contains('light-mode')) {
            emptyItem.style.color = '#999';
        }
        outgoingList.appendChild(emptyItem);
    }
    if (incomingConnections.length === 0) {
        const emptyItem = document.createElement('div');
        emptyItem.className = 'connection-list-empty';
        emptyItem.textContent = '无';
        emptyItem.style.cssText = 'color: #666; font-size: 11px; padding: 5px;';
        if (document.body.classList.contains('light-mode')) {
            emptyItem.style.color = '#999';
        }
        incomingList.appendChild(emptyItem);
    }
};

// 更新节点连线列表（保留原函数以兼容）
export const updateNodeConnectionsList = (node, editor, container) => {
    // 如果提供了container，使用动态版本
    if (container) {
        const outgoingList = container.querySelector('#outgoing-connections-dynamic') || container.querySelector('#outgoing-connections');
        const incomingList = container.querySelector('#incoming-connections-dynamic') || container.querySelector('#incoming-connections');
        if (outgoingList && incomingList) {
            updateNodeConnectionsListDynamic(node, editor, outgoingList, incomingList);
            return;
        }
    }
    
    // 否则使用原有的DOM元素查找方式（向后兼容）
    const outgoingList = document.getElementById('outgoing-connections');
    const incomingList = document.getElementById('incoming-connections');
    
    if (!outgoingList || !incomingList) return;
    
    // 清空列表
    outgoingList.innerHTML = '';
    incomingList.innerHTML = '';
    
    // 获取出发的连线
    const outgoingConnections = editor.connections.filter(conn => conn.sourceNodeId === node.id);
    outgoingConnections.forEach(conn => {
        const targetNode = editor.nodes.find(n => n.id === conn.targetNodeId);
        if (targetNode) {
            const item = createConnectionListItem(conn, targetNode.name, 'outgoing', editor);
            outgoingList.appendChild(item);
        }
    });
    
    // 获取到达的连线
    const incomingConnections = editor.connections.filter(conn => conn.targetNodeId === node.id);
    incomingConnections.forEach(conn => {
        const sourceNode = editor.nodes.find(n => n.id === conn.sourceNodeId);
        if (sourceNode) {
            const item = createConnectionListItem(conn, sourceNode.name, 'incoming', editor);
            incomingList.appendChild(item);
        }
    });
    
    // 如果没有连线，显示提示
    if (outgoingConnections.length === 0) {
        const emptyItem = document.createElement('div');
        emptyItem.className = 'connection-list-empty';
        emptyItem.textContent = '无';
        outgoingList.appendChild(emptyItem);
    }
    if (incomingConnections.length === 0) {
        const emptyItem = document.createElement('div');
        emptyItem.className = 'connection-list-empty';
        emptyItem.textContent = '无';
        incomingList.appendChild(emptyItem);
    }
};


// 创建连线列表项（卷展栏样式）
const createConnectionListItem = (connection, targetName, type, editor) => {
    const item = document.createElement('div');
    item.className = 'connection-list-item';
    item.dataset.connectionId = connection.id;
    
    // 创建卷展栏头部
    const header = document.createElement('div');
    header.className = 'connection-list-header collapsed';
    
    // 创建头部左侧内容（图标+标签）
    const headerLeft = document.createElement('div');
    headerLeft.style.display = 'flex';
    headerLeft.style.alignItems = 'center';
    
    // 展开/折叠图标
    const toggleIcon = document.createElement('span');
    toggleIcon.className = 'toggle-icon';
    toggleIcon.textContent = '▼';
    headerLeft.appendChild(toggleIcon);
    
    // 连接标签
    const label = document.createElement('span');
    label.textContent = type === 'outgoing' ? `→ ${targetName}` : `← ${targetName}`;
    headerLeft.appendChild(label);
    
    // 创建头部右侧内容（控制按钮）
    const controls = document.createElement('div');
    controls.className = 'connection-controls';
    
    // 删除按钮
    const deleteBtn = document.createElement('button');
    deleteBtn.className = 'btn-small btn-danger';
    deleteBtn.textContent = '删除';
    deleteBtn.addEventListener('click', async (e) => {
        e.stopPropagation(); // 阻止事件冒泡，避免触发卷展栏切换
        const confirmed = await ConfirmDialog('确定要删除这条连线吗？');
        if (confirmed) {
            editor.removeConnection(connection.id);
            updateNodeConnectionsList(editor.selectedElements[0], editor);
            editor.scheduleRender();
        }
    });
    controls.appendChild(deleteBtn);
    
    // 组装头部
    header.appendChild(headerLeft);
    header.appendChild(controls);
    
    // 创建卷展栏内容区域
    const content = document.createElement('div');
    content.className = 'connection-list-content';
    
    // 创建内容容器
    const contentContainer = document.createElement('div');
    contentContainer.className = 'connection-content-container';
    
    // 初始只显示一个占位符，稍后会在展开时填充详细内容
    contentContainer.innerHTML = '<div class="connection-placeholder">点击展开查看详情</div>';
    
    content.appendChild(contentContainer);
    
    // 组装整个项
    item.appendChild(header);
    item.appendChild(content);
    
    // 添加展开/折叠事件
    header.addEventListener('click', () => {
        const isCollapsed = header.classList.contains('collapsed');
        
        if (isCollapsed) {
            // 展开
            header.classList.remove('collapsed');
            content.classList.add('expanded');
            
            // 检查是否需要加载详细内容
            const placeholder = contentContainer.querySelector('.connection-placeholder');
            if (placeholder) {
                // 移除占位符
                contentContainer.innerHTML = '';
                
                // 填充连接的详细属性（这里我们会在后续任务中实现完整的属性显示）
                // 暂时只显示基本信息
                renderConnectionDetails(contentContainer, connection, editor);
            }
        } else {
            // 折叠
            header.classList.add('collapsed');
            content.classList.remove('expanded');
        }
    });
    
    return item;
};

// 渲染连接详情（完整版本，与showConnectionProperties完全一致）
const renderConnectionDetails = (container, connection, editor) => {
    // 创建详细信息容器
    const detailsContainer = document.createElement('div');
    detailsContainer.className = 'connection-details';
    
    // 获取起始节点和终止节点名称
    const sourceNode = editor.nodes.find(n => n.id === connection.sourceNodeId);
    const targetNode = editor.nodes.find(n => n.id === connection.targetNodeId);
    const sourceNodeName = sourceNode ? sourceNode.name : '未知节点';
    const targetNodeName = targetNode ? targetNode.name : '未知节点';
    
    // 显示节点信息
    const nodeInfo = document.createElement('div');
    nodeInfo.style.cssText = 'margin-bottom: 15px; padding: 10px; background: rgba(0, 122, 204, 0.1); border-radius: 3px;';
    if (document.body.classList.contains('light-mode')) {
        nodeInfo.style.background = 'rgba(0, 102, 204, 0.1)';
    }
    nodeInfo.innerHTML = `
        <div style="font-size: 12px; color: #969696;">
            <div>起始节点: <strong style="color: #e0e0e0;">${sourceNodeName}</strong></div>
            <div>终止节点: <strong style="color: #e0e0e0;">${targetNodeName}</strong></div>
        </div>
    `;
    if (document.body.classList.contains('light-mode')) {
        const div = nodeInfo.querySelector('div');
        if (div) div.style.color = '#666';
        nodeInfo.querySelectorAll('strong').forEach(s => s.style.color = '#333');
    }
    detailsContainer.appendChild(nodeInfo);
    
    // 连线颜色
    const colorLabel = document.createElement('label');
    colorLabel.textContent = '连线颜色:';
    colorLabel.style.cssText = 'display: block; margin-top: 10px; margin-bottom: 5px; color: #b0b0b0; font-size: 12px;';
    if (document.body.classList.contains('light-mode')) {
        colorLabel.style.color = '#666';
    }
    const colorContainer = document.createElement('div');
    colorContainer.style.display = 'flex';
    colorContainer.style.gap = '10px';
    const colorInput = document.createElement('input');
    colorInput.type = 'color';
    colorInput.value = connection.color || '#666666';
    colorInput.style.cssText = 'flex: 1; padding: 2px; border: 1px solid rgba(255, 255, 255, 0.2); border-radius: 3px; background: rgba(255, 255, 255, 0.05);';
    colorInput.oninput = () => {
        connection.color = colorInput.value === '#666666' ? null : colorInput.value;
        editor.scheduleRender();
    };
    const colorResetBtn = document.createElement('button');
    colorResetBtn.textContent = '重置';
    colorResetBtn.className = 'btn btn-small';
    colorResetBtn.style.cssText = 'padding: 6px 12px;';
    colorResetBtn.onclick = () => {
        connection.color = null;
        colorInput.value = '#666666';
        editor.scheduleRender();
    };
    colorContainer.appendChild(colorInput);
    colorContainer.appendChild(colorResetBtn);
    detailsContainer.appendChild(colorLabel);
    detailsContainer.appendChild(colorContainer);
    
    // 线宽
    const lineWidthLabel = document.createElement('label');
    lineWidthLabel.textContent = '线宽:';
    lineWidthLabel.style.cssText = 'display: block; margin-top: 10px; margin-bottom: 5px; color: #b0b0b0; font-size: 12px;';
    if (document.body.classList.contains('light-mode')) {
        lineWidthLabel.style.color = '#666';
    }
    const lineWidthContainer = document.createElement('div');
    lineWidthContainer.style.display = 'flex';
    lineWidthContainer.style.gap = '10px';
    const lineWidthInput = document.createElement('input');
    lineWidthInput.type = 'number';
    lineWidthInput.step = '0.1';
    lineWidthInput.value = connection.lineWidth || 1.5;
    lineWidthInput.style.cssText = 'flex: 1; padding: 6px; border: 1px solid rgba(255, 255, 255, 0.2); border-radius: 3px; background: rgba(255, 255, 255, 0.05); color: #e0e0e0; font-size: 13px;';
    if (document.body.classList.contains('light-mode')) {
        lineWidthInput.style.borderColor = 'rgba(0, 0, 0, 0.2)';
        lineWidthInput.style.background = '#fff';
        lineWidthInput.style.color = '#333';
    }
    lineWidthInput.oninput = () => {
        connection.lineWidth = parseFloat(lineWidthInput.value) || null;
        editor.scheduleRender();
    };
    const lineWidthResetBtn = document.createElement('button');
    lineWidthResetBtn.textContent = '重置';
    lineWidthResetBtn.className = 'btn btn-small';
    lineWidthResetBtn.style.cssText = 'padding: 6px 12px;';
    lineWidthResetBtn.onclick = () => {
        connection.lineWidth = null;
        lineWidthInput.value = 1.5;
        editor.scheduleRender();
    };
    lineWidthContainer.appendChild(lineWidthInput);
    lineWidthContainer.appendChild(lineWidthResetBtn);
    detailsContainer.appendChild(lineWidthLabel);
    detailsContainer.appendChild(lineWidthContainer);
    
    // 线型
    const lineTypeLabel = document.createElement('label');
    lineTypeLabel.textContent = '线型:';
    lineTypeLabel.style.cssText = 'display: block; margin-top: 10px; margin-bottom: 5px; color: #b0b0b0; font-size: 12px;';
    if (document.body.classList.contains('light-mode')) {
        lineTypeLabel.style.color = '#666';
    }
    const lineTypeInput = document.createElement('select');
    lineTypeInput.innerHTML = `
        <option value="solid">实线</option>
        <option value="dashed">虚线</option>
        <option value="dotted">点线</option>
    `;
    lineTypeInput.value = connection.lineType || 'solid';
    lineTypeInput.style.cssText = 'width: 100%; padding: 6px; border: 1px solid rgba(255, 255, 255, 0.2); border-radius: 3px; background: rgba(255, 255, 255, 0.05); color: #e0e0e0; font-size: 13px;';
    if (document.body.classList.contains('light-mode')) {
        lineTypeInput.style.borderColor = 'rgba(0, 0, 0, 0.2)';
        lineTypeInput.style.background = '#fff';
        lineTypeInput.style.color = '#333';
    }
    lineTypeInput.onchange = () => {
        connection.lineType = lineTypeInput.value;
        editor.scheduleRender();
    };
    detailsContainer.appendChild(lineTypeLabel);
    detailsContainer.appendChild(lineTypeInput);
    
    // 箭头大小
    const arrowSizeLabel = document.createElement('label');
    arrowSizeLabel.textContent = '箭头大小:';
    arrowSizeLabel.style.cssText = 'display: block; margin-top: 10px; margin-bottom: 5px; color: #b0b0b0; font-size: 12px;';
    if (document.body.classList.contains('light-mode')) {
        arrowSizeLabel.style.color = '#666';
    }
    const arrowSizeContainer = document.createElement('div');
    arrowSizeContainer.style.display = 'flex';
    arrowSizeContainer.style.gap = '10px';
    const arrowSizeInput = document.createElement('input');
    arrowSizeInput.type = 'number';
    arrowSizeInput.value = connection.arrowSize || 10;
    arrowSizeInput.style.cssText = 'flex: 1; padding: 6px; border: 1px solid rgba(255, 255, 255, 0.2); border-radius: 3px; background: rgba(255, 255, 255, 0.05); color: #e0e0e0; font-size: 13px;';
    if (document.body.classList.contains('light-mode')) {
        arrowSizeInput.style.borderColor = 'rgba(0, 0, 0, 0.2)';
        arrowSizeInput.style.background = '#fff';
        arrowSizeInput.style.color = '#333';
    }
    arrowSizeInput.oninput = () => {
        connection.arrowSize = parseInt(arrowSizeInput.value) || null;
        editor.scheduleRender();
    };
    const arrowSizeResetBtn = document.createElement('button');
    arrowSizeResetBtn.textContent = '重置';
    arrowSizeResetBtn.className = 'btn btn-small';
    arrowSizeResetBtn.style.cssText = 'padding: 6px 12px;';
    arrowSizeResetBtn.onclick = () => {
        connection.arrowSize = null;
        arrowSizeInput.value = 10;
        editor.scheduleRender();
    };
    arrowSizeContainer.appendChild(arrowSizeInput);
    arrowSizeContainer.appendChild(arrowSizeResetBtn);
    detailsContainer.appendChild(arrowSizeLabel);
    detailsContainer.appendChild(arrowSizeContainer);
    
    // 将详情容器添加到父容器
    container.appendChild(detailsContainer);
};

// 应用连接详情的样式
const applyConnectionDetailsStyles = (container) => {
    // 为详细信息添加样式
    const detailsElement = container.querySelector('.connection-details');
    detailsElement.style.padding = '10px';
    
    // 信息组样式
    const infoGroups = container.querySelectorAll('.info-group');
    infoGroups.forEach(group => {
        group.style.marginBottom = '15px';
        group.style.padding = '8px';
        group.style.backgroundColor = getComputedStyle(document.body).getPropertyValue('--bg-secondary') || '#f5f5f5';
        group.style.borderRadius = '4px';
    });
    
    // 信息项样式
    const infoItems = container.querySelectorAll('.info-item');
    infoItems.forEach(item => {
        item.style.display = 'flex';
        item.style.justifyContent = 'space-between';
        item.style.marginBottom = '5px';
        item.style.fontSize = '13px';
    });
    
    // 属性组样式
    const propertyGroups = container.querySelectorAll('.property-group');
    propertyGroups.forEach(group => {
        group.style.marginBottom = '15px';
    });
    
    // 属性项样式
    const propertyItems = container.querySelectorAll('.property-item');
    propertyItems.forEach(item => {
        item.style.display = 'flex';
        item.style.alignItems = 'center';
        item.style.marginBottom = '10px';
        item.style.fontSize = '13px';
    });
    
    // 标签样式
    const labels = container.querySelectorAll('.info-item label, .property-item label');
    labels.forEach(label => {
        label.style.fontWeight = '500';
        label.style.width = '100px';
        label.style.minWidth = '100px';
        label.style.color = getComputedStyle(document.body).getPropertyValue('--text-primary') || '#333';
    });
    
    // 输入控件样式
    const inputs = container.querySelectorAll('input, select');
    inputs.forEach(input => {
        input.style.padding = '4px 6px';
        input.style.border = '1px solid ' + (getComputedStyle(document.body).getPropertyValue('--border-color') || '#ddd');
        input.style.borderRadius = '3px';
        input.style.backgroundColor = getComputedStyle(document.body).getPropertyValue('--bg-primary') || '#fff';
        input.style.color = getComputedStyle(document.body).getPropertyValue('--text-primary') || '#333';
    });
    
    // 范围输入样式
    const ranges = container.querySelectorAll('input[type="range"]');
    ranges.forEach(range => {
        range.style.flexGrow = '1';
        range.style.margin = '0 10px';
    });
    
    // 范围值样式
    const rangeValues = container.querySelectorAll('.range-value');
    rangeValues.forEach(value => {
        value.style.width = '30px';
        value.style.textAlign = 'center';
        value.style.fontSize = '12px';
    });
    
    // 颜色输入样式
    const colorInputs = container.querySelectorAll('input[type="color"]');
    colorInputs.forEach(color => {
        color.style.width = '40px';
        color.style.height = '24px';
        color.style.padding = '0';
    });
    
    // 选择框样式
    const selects = container.querySelectorAll('select');
    selects.forEach(select => {
        select.style.flexGrow = '1';
    });
};

export const showConnectionProperties = (connection, editor) => {
    console.log('showConnectionProperties被调用:', connection);
    const connectionProperties = document.getElementById('connection-properties');
    console.log('connection-properties DOM元素:', connectionProperties);
    if (!connectionProperties) {
        console.error('找不到connection-properties DOM元素！');
        return;
    }
    
    connectionProperties.classList.remove('hidden');
    connectionProperties.innerHTML = '';
    
    // 创建标题
    const title = document.createElement('h3');
    title.textContent = '连线属性';
    title.style.cssText = 'margin: 0 0 15px 0; padding-bottom: 10px; border-bottom: 1px solid rgba(255, 255, 255, 0.1); color: #e0e0e0;';
    if (document.body.classList.contains('light-mode')) {
        title.style.borderBottomColor = 'rgba(0, 0, 0, 0.1)';
        title.style.color = '#333';
    }
    connectionProperties.appendChild(title);
    
    // 获取起始节点和终止节点名称
    const sourceNode = editor.nodes.find(n => n.id === connection.sourceNodeId);
    const targetNode = editor.nodes.find(n => n.id === connection.targetNodeId);
    const sourceNodeName = sourceNode ? sourceNode.name : '未知节点';
    const targetNodeName = targetNode ? targetNode.name : '未知节点';
    
    // 显示节点信息
    const nodeInfo = document.createElement('div');
    nodeInfo.style.cssText = 'margin-bottom: 15px; padding: 10px; background: rgba(0, 122, 204, 0.1); border-radius: 3px;';
    if (document.body.classList.contains('light-mode')) {
        nodeInfo.style.background = 'rgba(0, 102, 204, 0.1)';
    }
    nodeInfo.innerHTML = `
        <div style="font-size: 12px; color: #969696;">
            <div>起始节点: <strong style="color: #e0e0e0;">${sourceNodeName}</strong></div>
            <div>终止节点: <strong style="color: #e0e0e0;">${targetNodeName}</strong></div>
        </div>
    `;
    if (document.body.classList.contains('light-mode')) {
        const div = nodeInfo.querySelector('div');
        if (div) div.style.color = '#666';
        nodeInfo.querySelectorAll('strong').forEach(s => s.style.color = '#333');
    }
    connectionProperties.appendChild(nodeInfo);
    
    // 连线颜色
    const colorLabel = document.createElement('label');
    colorLabel.textContent = '连线颜色:';
    colorLabel.style.cssText = 'display: block; margin-top: 10px; margin-bottom: 5px; color: #b0b0b0; font-size: 12px;';
    if (document.body.classList.contains('light-mode')) {
        colorLabel.style.color = '#666';
    }
    const colorContainer = document.createElement('div');
    colorContainer.style.display = 'flex';
    colorContainer.style.gap = '10px';
    const colorInput = document.createElement('input');
    colorInput.type = 'color';
    colorInput.value = connection.color || '#666666';
    colorInput.style.cssText = 'flex: 1; padding: 2px; border: 1px solid rgba(255, 255, 255, 0.2); border-radius: 3px; background: rgba(255, 255, 255, 0.05);';
    colorInput.oninput = () => {
        connection.color = colorInput.value === '#666666' ? null : colorInput.value;
        editor.scheduleRender();
    };
    const colorResetBtn = document.createElement('button');
    colorResetBtn.textContent = '重置';
    colorResetBtn.className = 'btn btn-small';
    colorResetBtn.style.cssText = 'padding: 6px 12px;';
    colorResetBtn.onclick = () => {
        connection.color = null;
        colorInput.value = '#666666';
        editor.scheduleRender();
    };
    colorContainer.appendChild(colorInput);
    colorContainer.appendChild(colorResetBtn);
    connectionProperties.appendChild(colorLabel);
    connectionProperties.appendChild(colorContainer);
    
    // 线宽
    const lineWidthLabel = document.createElement('label');
    lineWidthLabel.textContent = '线宽:';
    lineWidthLabel.style.cssText = 'display: block; margin-top: 10px; margin-bottom: 5px; color: #b0b0b0; font-size: 12px;';
    if (document.body.classList.contains('light-mode')) {
        lineWidthLabel.style.color = '#666';
    }
    const lineWidthContainer = document.createElement('div');
    lineWidthContainer.style.display = 'flex';
    lineWidthContainer.style.gap = '10px';
    const lineWidthInput = document.createElement('input');
    lineWidthInput.type = 'number';
    lineWidthInput.step = '0.1';
    lineWidthInput.value = connection.lineWidth || 1.5;
    lineWidthInput.style.cssText = 'flex: 1; padding: 6px; border: 1px solid rgba(255, 255, 255, 0.2); border-radius: 3px; background: rgba(255, 255, 255, 0.05); color: #e0e0e0; font-size: 13px;';
    if (document.body.classList.contains('light-mode')) {
        lineWidthInput.style.borderColor = 'rgba(0, 0, 0, 0.2)';
        lineWidthInput.style.background = '#fff';
        lineWidthInput.style.color = '#333';
    }
    lineWidthInput.oninput = () => {
        connection.lineWidth = parseFloat(lineWidthInput.value) || null;
        editor.scheduleRender();
    };
    const lineWidthResetBtn = document.createElement('button');
    lineWidthResetBtn.textContent = '重置';
    lineWidthResetBtn.className = 'btn btn-small';
    lineWidthResetBtn.style.cssText = 'padding: 6px 12px;';
    lineWidthResetBtn.onclick = () => {
        connection.lineWidth = null;
        lineWidthInput.value = 1.5;
        editor.scheduleRender();
    };
    lineWidthContainer.appendChild(lineWidthInput);
    lineWidthContainer.appendChild(lineWidthResetBtn);
    connectionProperties.appendChild(lineWidthLabel);
    connectionProperties.appendChild(lineWidthContainer);
    
    // 线型
    const lineTypeLabel = document.createElement('label');
    lineTypeLabel.textContent = '线型:';
    lineTypeLabel.style.cssText = 'display: block; margin-top: 10px; margin-bottom: 5px; color: #b0b0b0; font-size: 12px;';
    if (document.body.classList.contains('light-mode')) {
        lineTypeLabel.style.color = '#666';
    }
    const lineTypeInput = document.createElement('select');
    lineTypeInput.innerHTML = `
        <option value="solid">实线</option>
        <option value="dashed">虚线</option>
        <option value="dotted">点线</option>
    `;
    lineTypeInput.value = connection.lineType || 'solid';
    lineTypeInput.style.cssText = 'width: 100%; padding: 6px; border: 1px solid rgba(255, 255, 255, 0.2); border-radius: 3px; background: rgba(255, 255, 255, 0.05); color: #e0e0e0; font-size: 13px;';
    if (document.body.classList.contains('light-mode')) {
        lineTypeInput.style.borderColor = 'rgba(0, 0, 0, 0.2)';
        lineTypeInput.style.background = '#fff';
        lineTypeInput.style.color = '#333';
    }
    lineTypeInput.onchange = () => {
        connection.lineType = lineTypeInput.value;
        editor.scheduleRender();
    };
    connectionProperties.appendChild(lineTypeLabel);
    connectionProperties.appendChild(lineTypeInput);
    
    // 箭头大小
    const arrowSizeLabel = document.createElement('label');
    arrowSizeLabel.textContent = '箭头大小:';
    arrowSizeLabel.style.cssText = 'display: block; margin-top: 10px; margin-bottom: 5px; color: #b0b0b0; font-size: 12px;';
    if (document.body.classList.contains('light-mode')) {
        arrowSizeLabel.style.color = '#666';
    }
    const arrowSizeContainer = document.createElement('div');
    arrowSizeContainer.style.display = 'flex';
    arrowSizeContainer.style.gap = '10px';
    const arrowSizeInput = document.createElement('input');
    arrowSizeInput.type = 'number';
    arrowSizeInput.value = connection.arrowSize || 10;
    arrowSizeInput.style.cssText = 'flex: 1; padding: 6px; border: 1px solid rgba(255, 255, 255, 0.2); border-radius: 3px; background: rgba(255, 255, 255, 0.05); color: #e0e0e0; font-size: 13px;';
    if (document.body.classList.contains('light-mode')) {
        arrowSizeInput.style.borderColor = 'rgba(0, 0, 0, 0.2)';
        arrowSizeInput.style.background = '#fff';
        arrowSizeInput.style.color = '#333';
    }
    arrowSizeInput.oninput = () => {
        connection.arrowSize = parseInt(arrowSizeInput.value) || null;
        editor.scheduleRender();
    };
    const arrowSizeResetBtn = document.createElement('button');
    arrowSizeResetBtn.textContent = '重置';
    arrowSizeResetBtn.className = 'btn btn-small';
    arrowSizeResetBtn.style.cssText = 'padding: 6px 12px;';
    arrowSizeResetBtn.onclick = () => {
        connection.arrowSize = null;
        arrowSizeInput.value = 10;
        editor.scheduleRender();
    };
    arrowSizeContainer.appendChild(arrowSizeInput);
    arrowSizeContainer.appendChild(arrowSizeResetBtn);
    connectionProperties.appendChild(arrowSizeLabel);
    connectionProperties.appendChild(arrowSizeContainer);
    
    // 箭头颜色
    const arrowColorLabel = document.createElement('label');
    arrowColorLabel.textContent = '箭头颜色:';
    arrowColorLabel.style.cssText = 'display: block; margin-top: 10px; margin-bottom: 5px; color: #b0b0b0; font-size: 12px;';
    if (document.body.classList.contains('light-mode')) {
        arrowColorLabel.style.color = '#666';
    }
    const arrowColorContainer = document.createElement('div');
    arrowColorContainer.style.display = 'flex';
    arrowColorContainer.style.gap = '10px';
    const arrowColorInput = document.createElement('input');
    arrowColorInput.type = 'color';
    arrowColorInput.value = connection.arrowColor || '#888888';
    arrowColorInput.style.cssText = 'flex: 1; padding: 2px; border: 1px solid rgba(255, 255, 255, 0.2); border-radius: 3px; background: rgba(255, 255, 255, 0.05);';
    arrowColorInput.oninput = () => {
        connection.arrowColor = arrowColorInput.value === '#888888' ? null : arrowColorInput.value;
        editor.scheduleRender();
    };
    const arrowColorResetBtn = document.createElement('button');
    arrowColorResetBtn.textContent = '重置';
    arrowColorResetBtn.className = 'btn btn-small';
    arrowColorResetBtn.style.cssText = 'padding: 6px 12px;';
    arrowColorResetBtn.onclick = () => {
        connection.arrowColor = null;
        arrowColorInput.value = '#888888';
        editor.scheduleRender();
    };
    arrowColorContainer.appendChild(arrowColorInput);
    arrowColorContainer.appendChild(arrowColorResetBtn);
    connectionProperties.appendChild(arrowColorLabel);
    connectionProperties.appendChild(arrowColorContainer);
    
    // 力导向图参数（连接）
    const forceSection = document.createElement('div');
    forceSection.style.cssText = 'margin-top: 15px; padding-top: 15px; border-top: 1px solid rgba(255, 255, 255, 0.1);';
    if (document.body.classList.contains('light-mode')) {
        forceSection.style.borderTopColor = 'rgba(0, 0, 0, 0.1)';
    }
    const forceTitle = document.createElement('h4');
    forceTitle.textContent = '力导向图参数';
    forceTitle.style.cssText = 'margin: 0 0 10px 0; font-size: 13px; color: #b0b0b0;';
    if (document.body.classList.contains('light-mode')) {
        forceTitle.style.color = '#666';
    }
    forceSection.appendChild(forceTitle);
    
    // 连接距离
    const linkDistanceLabel = document.createElement('label');
    linkDistanceLabel.textContent = '连接距离:';
    linkDistanceLabel.style.cssText = 'display: block; margin-top: 10px; margin-bottom: 5px; color: #b0b0b0; font-size: 12px;';
    if (document.body.classList.contains('light-mode')) {
        linkDistanceLabel.style.color = '#666';
    }
    const linkDistanceInput = document.createElement('input');
    linkDistanceInput.type = 'number';
    linkDistanceInput.value = connection.linkDistance !== undefined ? connection.linkDistance : 150;
    linkDistanceInput.style.cssText = 'width: 100%; padding: 6px; border: 1px solid rgba(255, 255, 255, 0.2); border-radius: 3px; background: rgba(255, 255, 255, 0.05); color: #e0e0e0; font-size: 13px;';
    if (document.body.classList.contains('light-mode')) {
        linkDistanceInput.style.borderColor = 'rgba(0, 0, 0, 0.2)';
        linkDistanceInput.style.background = '#fff';
        linkDistanceInput.style.color = '#333';
    }
    linkDistanceInput.oninput = () => {
        connection.linkDistance = parseInt(linkDistanceInput.value) || 150;
        editor.scheduleRender();
    };
    forceSection.appendChild(linkDistanceLabel);
    forceSection.appendChild(linkDistanceInput);
    
    // 连接强度
    const linkStrengthLabel = document.createElement('label');
    linkStrengthLabel.textContent = '连接强度:';
    linkStrengthLabel.style.cssText = 'display: block; margin-top: 10px; margin-bottom: 5px; color: #b0b0b0; font-size: 12px;';
    if (document.body.classList.contains('light-mode')) {
        linkStrengthLabel.style.color = '#666';
    }
    const linkStrengthInput = document.createElement('input');
    linkStrengthInput.type = 'number';
    linkStrengthInput.step = '0.1';
    linkStrengthInput.value = connection.linkStrength !== undefined ? connection.linkStrength : 1;
    linkStrengthInput.style.cssText = 'width: 100%; padding: 6px; border: 1px solid rgba(255, 255, 255, 0.2); border-radius: 3px; background: rgba(255, 255, 255, 0.05); color: #e0e0e0; font-size: 13px;';
    if (document.body.classList.contains('light-mode')) {
        linkStrengthInput.style.borderColor = 'rgba(0, 0, 0, 0.2)';
        linkStrengthInput.style.background = '#fff';
        linkStrengthInput.style.color = '#333';
    }
    linkStrengthInput.oninput = () => {
        connection.linkStrength = parseFloat(linkStrengthInput.value) || 1;
        editor.scheduleRender();
    };
    forceSection.appendChild(linkStrengthLabel);
    forceSection.appendChild(linkStrengthInput);
    
    connectionProperties.appendChild(forceSection);
    
    // 条件列表
    const conditionsTitle = document.createElement('h4');
    conditionsTitle.textContent = '条件';
    conditionsTitle.style.cssText = 'margin: 15px 0 10px 0; font-size: 13px; color: #b0b0b0;';
    if (document.body.classList.contains('light-mode')) {
        conditionsTitle.style.color = '#666';
    }
    connectionProperties.appendChild(conditionsTitle);
    
    const conditionsList = document.createElement('div');
    conditionsList.id = 'conditions-list-dynamic';
    conditionsList.style.cssText = 'max-height: 300px; overflow-y: auto;';
    
    // 确保连接有conditions数组（关键修复：防止undefined错误）
    if (!connection.conditions || !Array.isArray(connection.conditions)) {
        connection.conditions = [];
    }
    
    // 添加所有条件
    connection.conditions.forEach((condition, index) => {
        const conditionElement = createConditionElement(condition, index, editor);
        // 确保条件元素可以正确更新连接
        if (conditionElement) {
            // 如果createConditionElement返回的元素需要特殊处理，在这里添加
            conditionsList.appendChild(conditionElement);
        }
    });
    
    // 添加条件按钮
    const addConditionBtn = document.createElement('button');
    addConditionBtn.className = 'btn';
    addConditionBtn.textContent = '添加条件';
    addConditionBtn.style.cssText = 'margin-top: 10px; width: 100%;';
    addConditionBtn.onclick = () => {
        const newCondition = new Condition();
        connection.conditions.push(newCondition);
        showConnectionProperties(connection, editor);
        editor.scheduleRender();
    };
    
    connectionProperties.appendChild(conditionsList);
    connectionProperties.appendChild(addConditionBtn);
    
    // 删除按钮
    const deleteBtn = document.createElement('button');
    deleteBtn.className = 'btn btn-danger';
    deleteBtn.textContent = '删除连线';
    deleteBtn.style.cssText = 'margin-top: 15px; width: 100%;';
    deleteBtn.onclick = async () => {
        const confirmed = await ConfirmDialog('确定要删除这条连线吗？');
        if (confirmed) {
            editor.removeConnection(connection.id);
            editor.selectedElements = editor.selectedElements.filter(el => el.id !== connection.id);
            updatePropertyPanel(editor);
            editor.scheduleRender();
        }
    };
    connectionProperties.appendChild(deleteBtn);
};

// 显示多条连线属性
export const showMultipleConnectionProperties = (connections, editor) => {
    const connectionProperties = document.getElementById('connection-properties');
    const conditionsList = document.getElementById('conditions-list');
    
    // 清空现有内容
    conditionsList.innerHTML = '';
    
    // 获取第一条连线作为代表（用于绘制属性）
    const representativeConnection = connections[0];
    
    // 创建绘制属性区域（在顶部，影响画布绘制）
    const drawPropertiesSection = document.createElement('div');
    drawPropertiesSection.className = 'draw-properties-section';
    
    // 线颜色
    const colorInput = document.getElementById('connection-color');
    if (colorInput) {
        colorInput.value = representativeConnection.color || '#666666';
        colorInput.oninput = () => {
            const value = colorInput.value === '#666666' ? null : colorInput.value;
            connections.forEach(conn => {
                conn.color = value;
            });
            editor.scheduleRender();
        };
    }
    
    // 线粗细
    const lineWidthInput = document.getElementById('connection-line-width');
    if (lineWidthInput) {
        lineWidthInput.value = representativeConnection.lineWidth || 1.5;
        lineWidthInput.oninput = () => {
            const value = parseFloat(lineWidthInput.value) || null;
            connections.forEach(conn => {
                conn.lineWidth = value;
            });
            editor.scheduleRender();
        };
    }
    
    // 线类型
    const lineTypeInput = document.getElementById('connection-line-type');
    if (lineTypeInput) {
        lineTypeInput.value = representativeConnection.lineType || 'solid';
        lineTypeInput.onchange = () => {
            connections.forEach(conn => {
                conn.lineType = lineTypeInput.value;
            });
            editor.scheduleRender();
        };
    }
    
    // 箭头颜色
    const arrowColorInput = document.getElementById('connection-arrow-color');
    if (arrowColorInput) {
        arrowColorInput.value = representativeConnection.arrowColor || '#888888';
        arrowColorInput.oninput = () => {
            const value = arrowColorInput.value === '#888888' ? null : arrowColorInput.value;
            connections.forEach(conn => {
                conn.arrowColor = value;
            });
            editor.scheduleRender();
        };
    }
    
    // 箭头尺寸
    const arrowSizeInput = document.getElementById('connection-arrow-size');
    if (arrowSizeInput) {
        arrowSizeInput.value = representativeConnection.arrowSize || 10;
        arrowSizeInput.oninput = () => {
            const value = parseInt(arrowSizeInput.value) || null;
            connections.forEach(conn => {
                conn.arrowSize = value;
            });
            editor.scheduleRender();
        };
    }
    
    conditionsList.appendChild(drawPropertiesSection);
    
    // 为每条连线创建一个折叠区域（条件等属性）
    connections.forEach((connection, connIndex) => {
        const sourceNode = editor.nodes.find(n => n.id === connection.sourceNodeId);
        const targetNode = editor.nodes.find(n => n.id === connection.targetNodeId);
        
        if (!sourceNode || !targetNode) return;
        
        // 创建连线标题（显示起始节点和终止节点名称）
        const connectionHeader = document.createElement('div');
        connectionHeader.className = 'connection-header';
        //connectionHeader.style.cssText = 'padding: 10px; border-bottom: 1px solid #ddd; cursor: pointer; background: #f5f5f5;';
        connectionHeader.innerHTML = `
            <div style="font-weight: bold;">${sourceNode.name} → ${targetNode.name}</div>
            <div style="font-size: 11px; color: #969696; margin-top: 2px;">
                起始: ${sourceNode.name} | 终止: ${targetNode.name}
            </div>
        `;
        
        // 创建连线内容区域（默认展开）
        const connectionContent = document.createElement('div');
        connectionContent.className = 'connection-content';
        connectionContent.style.cssText = 'padding: 10px; display: block;';
        
        // 添加条件列表
        const connConditionsList = document.createElement('div');
        connConditionsList.className = 'conditions-list';
        
        connection.conditions.forEach((condition, index) => {
            // 创建自定义的条件元素，直接关联到当前connection
            const conditionItem = document.createElement('div');
            conditionItem.className = 'condition-item';
            conditionItem.dataset.index = index;
            
            // 条件头部
            const header = document.createElement('div');
            header.className = 'condition-header';
            header.innerHTML = `<span>条件 ${index + 1}</span>`;
            
            // 条件控制按钮
            const controls = document.createElement('div');
            controls.className = 'condition-controls';
            
            const upBtn = document.createElement('button');
            upBtn.innerHTML = '↑';
            upBtn.disabled = index === 0;
            upBtn.addEventListener('click', () => {
                if (connection.conditions[index - 1]) {
                    [connection.conditions[index], connection.conditions[index - 1]] = [connection.conditions[index - 1], connection.conditions[index]];
                    editor.scheduleRender();
                    showMultipleConnectionProperties(connections, editor);
                }
            });
            
            const downBtn = document.createElement('button');
            downBtn.innerHTML = '↓';
            downBtn.disabled = index === connection.conditions.length - 1;
            downBtn.addEventListener('click', () => {
                if (connection.conditions[index + 1]) {
                    [connection.conditions[index], connection.conditions[index + 1]] = [connection.conditions[index + 1], connection.conditions[index]];
                    editor.scheduleRender();
                    showMultipleConnectionProperties(connections, editor);
                }
            });
            
            const deleteBtn = document.createElement('button');
            deleteBtn.innerHTML = '✕';
            deleteBtn.addEventListener('click', () => {
                connection.conditions.splice(index, 1);
                editor.scheduleRender();
                showMultipleConnectionProperties(connections, editor);
            });
            
            controls.appendChild(upBtn);
            controls.appendChild(downBtn);
            controls.appendChild(deleteBtn);
            header.appendChild(controls);
            
            // 条件字段
            const fields = document.createElement('div');
            fields.className = 'condition-fields';
            
            // 类型选择
            const typeSelect = document.createElement('select');
            typeSelect.innerHTML = `
                <option value="Float">Float</option>
                <option value="Int">Int</option>
                <option value="Bool">Bool</option>
                <option value="Trigger">Trigger</option>
            `;
            typeSelect.value = condition.type;
            typeSelect.addEventListener('change', (e) => {
                conn.conditions[index].type = e.target.value;
                editor.scheduleRender();
                // 重新渲染以更新UI
                showMultipleConnectionProperties(connections, editor);
            });
            
            // 键输入
            const keyInput = document.createElement('input');
            keyInput.type = 'text';
            keyInput.placeholder = '键';
            keyInput.value = condition.key || '';
            keyInput.addEventListener('input', (e) => {
                conn.conditions[index].key = e.target.value;
                editor.scheduleRender();
            });
            
            // 添加类型和键输入
            fields.appendChild(typeSelect);
            fields.appendChild(keyInput);
            
            // 根据类型添加其他字段
            const currentType = condition.type;
            
            if (currentType !== 'Trigger') {
                // 操作符选择
                const operatorSelect = document.createElement('select');
                let operatorOptions = '';
                
                if (currentType === 'Bool') {
                    operatorOptions = `
                        <option value="==">等于</option>
                        <option value="!=">不等于</option>
                    `;
                } else {
                    operatorOptions = `
                        <option value=">">大于</option>
                        <option value="<">小于</option>
                        <option value="==">等于</option>
                        <option value="!=">不等于</option>
                        <option value=">=">大于等于</option>
                        <option value="<=">小于等于</option>
                    `;
                }
                
                operatorSelect.innerHTML = operatorOptions;
                operatorSelect.value = condition.operator || '==';
                operatorSelect.addEventListener('change', (e) => {
                    conn.conditions[index].operator = e.target.value;
                    editor.scheduleRender();
                });
                
                fields.appendChild(operatorSelect);
                
                // 值输入
                if (currentType === 'Bool') {
                    const valueCheckbox = document.createElement('input');
                    valueCheckbox.type = 'checkbox';
                    valueCheckbox.checked = condition.value === 'true' || condition.value === true;
                    valueCheckbox.addEventListener('change', (e) => {
                        conn.conditions[index].value = e.target.checked.toString();
                        editor.scheduleRender();
                    });
                    fields.appendChild(valueCheckbox);
                } else {
                    const valueInput = document.createElement('input');
                    valueInput.type = 'number';
                    valueInput.step = currentType === 'Int' ? '1' : '0.1';
                    valueInput.value = condition.value !== undefined ? 
                        (currentType === 'Int' ? parseInt(condition.value) : parseFloat(condition.value)) : 0;
                    valueInput.addEventListener('input', (e) => {
                        const value = currentType === 'Int' ? 
                            parseInt(e.target.value) || 0 : 
                            parseFloat(e.target.value) || 0;
                        conn.conditions[index].value = value.toString();
                        editor.scheduleRender();
                    });
                    fields.appendChild(valueInput);
                }
            } else {
                // Trigger类型显示Active标签
                const activeLabel = document.createElement('span');
                activeLabel.textContent = 'Active';
                activeLabel.className = 'trigger-active-label';
                fields.appendChild(activeLabel);
            }
            
            conditionItem.appendChild(header);
            conditionItem.appendChild(fields);
            connConditionsList.appendChild(conditionItem);
        });
        
        connectionContent.appendChild(connConditionsList);
        
        // 添加条件按钮
        const addConditionBtn = document.createElement('button');
        addConditionBtn.className = 'btn';
        addConditionBtn.textContent = '添加条件';
        addConditionBtn.style.cssText = 'margin-top: 10px;';
        addConditionBtn.addEventListener('click', () => {
            const conn = editor.connections.find(c => c.id === connection.id);
            if (conn) {
                conn.conditions.push(new Condition());
                // 重新显示，保持当前连线展开状态
                const wasExpanded = connectionContent.style.display !== 'none';
                showMultipleConnectionProperties(connections, editor);
                // 恢复展开状态
                if (wasExpanded) {
                    // 找到新创建的对应元素并展开
                    const newItems = conditionsList.querySelectorAll('.connection-item');
                    if (newItems[connIndex]) {
                        const newContent = newItems[connIndex].querySelector('.connection-content');
                        if (newContent) {
                            newContent.style.display = 'block';
                        }
                    }
                }
            }
        });
        connectionContent.appendChild(addConditionBtn);
        
        // 删除连线按钮
        const deleteBtn = document.createElement('button');
        deleteBtn.className = 'btn btn-danger';
        deleteBtn.textContent = '删除连线';
        deleteBtn.style.cssText = 'margin-top: 10px;';
        deleteBtn.addEventListener('click', async () => {
            const confirmed = await ConfirmDialog('确定要删除这条连线吗？');
            if (confirmed) {
                editor.removeConnection(connection.id);
                const remaining = editor.selectedElements.filter(el => el.id !== connection.id);
                editor.selectedElements = remaining;
                updatePropertyPanel(editor);
                editor.scheduleRender();
            }
        });
        connectionContent.appendChild(deleteBtn);
        
        // 折叠/展开功能（用户手动控制）
        connectionHeader.addEventListener('click', () => {
            const isHidden = connectionContent.style.display === 'none';
            connectionContent.style.display = isHidden ? 'block' : 'none';
            //connectionHeader.style.background = isHidden ? '#e5e5e5' : '#f5f5f5';
        });
        
        // 添加到列表
        const connectionItem = document.createElement('div');
        connectionItem.className = 'connection-item';
        connectionItem.style.cssText = 'margin-bottom: 10px; border: 1px solid #464647; border-radius: 3px;';
        connectionItem.appendChild(connectionHeader);
        connectionItem.appendChild(connectionContent);
        conditionsList.appendChild(connectionItem);
    });
    
    // 显示面板
    connectionProperties.classList.remove('hidden');
    
    // 复合连线时，隐藏静态按钮
    const addConditionBtnStatic = document.getElementById('add-condition');
    const deleteConnectionBtnStatic = document.getElementById('delete-connection');
    if (addConditionBtnStatic) addConditionBtnStatic.style.display = 'none';
    if (deleteConnectionBtnStatic) deleteConnectionBtnStatic.style.display = 'none';
};

// 显示文字内容对象属性
export const showTextContentProperties = (textContent, editor) => {
    const nodeProperties = document.getElementById('node-properties');
    if (!nodeProperties) return;
    
    nodeProperties.classList.remove('hidden');
    nodeProperties.innerHTML = '';
    
    // 创建标题
    const title = document.createElement('h3');
    title.textContent = '文字内容属性';
    title.style.cssText = 'margin: 0 0 15px 0; padding-bottom: 10px; border-bottom: 1px solid rgba(255, 255, 255, 0.1); color: #e0e0e0;';
    if (document.body.classList.contains('light-mode')) {
        title.style.borderBottomColor = 'rgba(0, 0, 0, 0.1)';
        title.style.color = '#333';
    }
    nodeProperties.appendChild(title);
    
    // 文字内容
    const textLabel = document.createElement('label');
    textLabel.textContent = '文字内容:';
    textLabel.style.cssText = 'display: block; margin-top: 10px; margin-bottom: 5px; color: #b0b0b0; font-size: 12px;';
    if (document.body.classList.contains('light-mode')) {
        textLabel.style.color = '#666';
    }
    const textInput = document.createElement('textarea');
    textInput.value = textContent.text || '';
    textInput.rows = 3;
    textInput.style.cssText = 'width: 100%; padding: 6px; border: 1px solid rgba(255, 255, 255, 0.2); border-radius: 3px; background: rgba(255, 255, 255, 0.05); color: #e0e0e0; font-size: 13px; resize: vertical;';
    if (document.body.classList.contains('light-mode')) {
        textInput.style.borderColor = 'rgba(0, 0, 0, 0.2)';
        textInput.style.background = '#fff';
        textInput.style.color = '#333';
    }
    textInput.oninput = () => {
        textContent.text = textInput.value;
        editor.scheduleRender();
    };
    nodeProperties.appendChild(textLabel);
    nodeProperties.appendChild(textInput);
    
    // 位置
    const positionLabel = document.createElement('label');
    positionLabel.textContent = '位置:';
    positionLabel.style.cssText = 'display: block; margin-top: 10px; margin-bottom: 5px; color: #b0b0b0; font-size: 12px;';
    if (document.body.classList.contains('light-mode')) {
        positionLabel.style.color = '#666';
    }
    const posContainer = document.createElement('div');
    posContainer.style.display = 'flex';
    posContainer.style.gap = '10px';
    
    const posXInput = document.createElement('input');
    posXInput.type = 'number';
    const pos = (textContent.transform && textContent.transform.position) ? 
        textContent.transform.position : { x: 0, y: 0 };
    posXInput.value = pos.x || 0;
    posXInput.style.cssText = 'flex: 1; padding: 6px; border: 1px solid rgba(255, 255, 255, 0.2); border-radius: 3px; background: rgba(255, 255, 255, 0.05); color: #e0e0e0; font-size: 13px;';
    if (document.body.classList.contains('light-mode')) {
        posXInput.style.borderColor = 'rgba(0, 0, 0, 0.2)';
        posXInput.style.background = '#fff';
        posXInput.style.color = '#333';
    }
    posXInput.oninput = () => {
        if (!textContent.transform) {
            textContent.transform = { position: { x: 0, y: 0 } };
        }
        if (!textContent.transform.position) {
            textContent.transform.position = { x: 0, y: 0 };
        }
        textContent.transform.position.x = parseFloat(posXInput.value) || 0;
        editor.scheduleRender();
    };
    
    const posYInput = document.createElement('input');
    posYInput.type = 'number';
    posYInput.value = pos.y || 0;
    posYInput.style.cssText = 'flex: 1; padding: 6px; border: 1px solid rgba(255, 255, 255, 0.2); border-radius: 3px; background: rgba(255, 255, 255, 0.05); color: #e0e0e0; font-size: 13px;';
    if (document.body.classList.contains('light-mode')) {
        posYInput.style.borderColor = 'rgba(0, 0, 0, 0.2)';
        posYInput.style.background = '#fff';
        posYInput.style.color = '#333';
    }
    posYInput.oninput = () => {
        if (!textContent.transform) {
            textContent.transform = { position: { x: 0, y: 0 } };
        }
        if (!textContent.transform.position) {
            textContent.transform.position = { x: 0, y: 0 };
        }
        textContent.transform.position.y = parseFloat(posYInput.value) || 0;
        editor.scheduleRender();
    };
    
    posContainer.appendChild(posXInput);
    posContainer.appendChild(posYInput);
    nodeProperties.appendChild(positionLabel);
    nodeProperties.appendChild(posContainer);
    
    // 字体大小
    const fontSizeLabel = document.createElement('label');
    fontSizeLabel.textContent = '字体大小:';
    fontSizeLabel.style.cssText = 'display: block; margin-top: 10px; margin-bottom: 5px; color: #b0b0b0; font-size: 12px;';
    if (document.body.classList.contains('light-mode')) {
        fontSizeLabel.style.color = '#666';
    }
    const fontSizeInput = document.createElement('input');
    fontSizeInput.type = 'number';
    fontSizeInput.value = textContent.fontSize || 14;
    fontSizeInput.style.cssText = 'width: 100%; padding: 6px; border: 1px solid rgba(255, 255, 255, 0.2); border-radius: 3px; background: rgba(255, 255, 255, 0.05); color: #e0e0e0; font-size: 13px;';
    if (document.body.classList.contains('light-mode')) {
        fontSizeInput.style.borderColor = 'rgba(0, 0, 0, 0.2)';
        fontSizeInput.style.background = '#fff';
        fontSizeInput.style.color = '#333';
    }
    fontSizeInput.oninput = () => {
        textContent.fontSize = parseFloat(fontSizeInput.value) || 14;
        editor.scheduleRender();
    };
    nodeProperties.appendChild(fontSizeLabel);
    nodeProperties.appendChild(fontSizeInput);
    
    // 背景颜色
    const bgColorLabel = document.createElement('label');
    bgColorLabel.textContent = '背景颜色:';
    bgColorLabel.style.cssText = 'display: block; margin-top: 10px; margin-bottom: 5px; color: #b0b0b0; font-size: 12px;';
    if (document.body.classList.contains('light-mode')) {
        bgColorLabel.style.color = '#666';
    }
    const bgColorContainer = document.createElement('div');
    bgColorContainer.style.display = 'flex';
    bgColorContainer.style.gap = '10px';
    const bgColorInput = document.createElement('input');
    bgColorInput.type = 'color';
    const bgColorValue = textContent.backgroundColor ? 
        (textContent.backgroundColor.toString ? textContent.backgroundColor.toString() : String(textContent.backgroundColor)) : 
        '#ffffff';
    bgColorInput.value = bgColorValue;
    bgColorInput.style.cssText = 'flex: 1; padding: 2px; border: 1px solid rgba(255, 255, 255, 0.2); border-radius: 3px; background: rgba(255, 255, 255, 0.05);';
    bgColorInput.oninput = async () => {
        const { Color } = await import('../math/GraphicsMath.js');
        textContent.backgroundColor = new Color(bgColorInput.value);
        editor.scheduleRender();
    };
    const bgColorResetBtn = document.createElement('button');
    bgColorResetBtn.textContent = '透明';
    bgColorResetBtn.className = 'btn btn-small';
    bgColorResetBtn.style.cssText = 'padding: 6px 12px;';
    bgColorResetBtn.onclick = () => {
        textContent.backgroundColor = null;
        bgColorInput.value = '#ffffff';
        editor.scheduleRender();
    };
    bgColorContainer.appendChild(bgColorInput);
    bgColorContainer.appendChild(bgColorResetBtn);
    nodeProperties.appendChild(bgColorLabel);
    nodeProperties.appendChild(bgColorContainer);
    
    // 删除按钮
    const deleteBtn = document.createElement('button');
    deleteBtn.className = 'btn btn-danger';
    deleteBtn.textContent = '删除文字对象';
    deleteBtn.style.cssText = 'margin-top: 15px; width: 100%;';
    deleteBtn.onclick = async () => {
        const { ConfirmDialog } = await import('../utils/popup.js');
        const confirmed = await ConfirmDialog('确定要删除这个文字对象吗？');
        if (confirmed) {
            editor.removeTextContent(textContent.id);
            editor.selectedElements = editor.selectedElements.filter(el => el.id !== textContent.id);
            updatePropertyPanel(editor);
            editor.scheduleRender();
        }
    };
    nodeProperties.appendChild(deleteBtn);
};

// 显示多个选中项的属性
export const showMultipleSelectionProperties = (selectedElements, editor) => {
    const nodeProperties = document.getElementById('node-properties');
    if (!nodeProperties) return;
    
    nodeProperties.classList.remove('hidden');
    nodeProperties.innerHTML = '';
    
    const title = document.createElement('h3');
    title.textContent = `多元素选中 (${selectedElements.length})`;
    nodeProperties.appendChild(title);
    
    const info = document.createElement('div');
    const nodes = selectedElements.filter(el => el.type === 'node');
    const connections = selectedElements.filter(el => el.type === 'connection');
    const texts = selectedElements.filter(el => el.type === 'text');
    
    let infoText = '';
    if (nodes.length > 0) infoText += `节点: ${nodes.length} `;
    if (connections.length > 0) infoText += `连接: ${connections.length} `;
    if (texts.length > 0) infoText += `文字: ${texts.length} `;
    
    info.textContent = infoText;
    nodeProperties.appendChild(info);
    
    // 删除按钮
    const deleteBtn = document.createElement('button');
    deleteBtn.className = 'btn btn-danger';
    deleteBtn.textContent = '删除选中';
    deleteBtn.style.cssText = 'margin-top: 10px;';
    deleteBtn.onclick = async () => {
        const { ConfirmDialog } = await import('../utils/popup.js');
        const confirmed = await ConfirmDialog(`确定要删除选中的 ${selectedElements.length} 个对象吗？`);
        if (confirmed) {
            nodes.forEach(node => editor.removeNode(node.id));
            connections.forEach(conn => editor.removeConnection(conn.id));
            texts.forEach(text => editor.removeTextContent(text.id));
            editor.selectedElements = [];
            updatePropertyPanel(editor);
            editor.scheduleRender();
        }
    };
    nodeProperties.appendChild(deleteBtn);
};