import { createConditionElement } from '../utils/dom.js';

// 属性面板管理
export const updatePropertyPanel = (editor) => {
    const nodeProperties = document.getElementById('node-properties');
    const connectionProperties = document.getElementById('connection-properties');
    const noSelection = document.getElementById('no-selection');
    
    // 隐藏所有面板
    nodeProperties.classList.add('hidden');
    connectionProperties.classList.add('hidden');
    noSelection.classList.add('hidden');
    
    // 显示适当的面板
    if (editor.selectedElements.length === 1) {
        const element = editor.selectedElements[0];
        
        if (element.type === 'node') {
            showNodeProperties(element, editor);
        } else if (element.type === 'connection') {
            showConnectionProperties(element, editor);
        }
    } else {
        noSelection.classList.remove('hidden');
    }
};

export const showNodeProperties = (node, editor) => {
    const nodeProperties = document.getElementById('node-properties');
    const nodeNameInput = document.getElementById('node-name');
    const nodeDescInput = document.getElementById('node-description');
    const nodeWidthInput = document.getElementById('node-width');
    const nodeHeightInput = document.getElementById('node-height');
    const nodeAutosizeInput = document.getElementById('node-autosize');
    const nodeColorInput = document.getElementById('node-color');
    const nodeColorResetBtn = document.getElementById('node-color-reset');
    
    // 填充表单
    nodeNameInput.value = node.name;
    nodeDescInput.value = node.description;
    nodeWidthInput.value = node.width;
    nodeHeightInput.value = node.height;
    nodeAutosizeInput.checked = node.autoSize;
    nodeColorInput.value = node.color || '#ffffff';
    
    // 控制尺寸输入的可用性
    nodeWidthInput.disabled = node.autoSize;
    nodeHeightInput.disabled = node.autoSize;
    
    // 颜色输入事件（立即更新）
    nodeColorInput.oninput = () => {
        node.color = nodeColorInput.value;
        editor.scheduleRender();
    };
    
    // 重置颜色按钮
    nodeColorResetBtn.onclick = () => {
        node.color = null;
        nodeColorInput.value = '#ffffff';
        editor.scheduleRender();
    };
    
    // 显示连线列表
    updateNodeConnectionsList(node, editor);
    
    // 显示面板
    nodeProperties.classList.remove('hidden');
};

// 更新节点连线列表
export const updateNodeConnectionsList = (node, editor) => {
    const outgoingList = document.getElementById('outgoing-connections');
    const incomingList = document.getElementById('incoming-connections');
    
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

// 创建连线列表项
const createConnectionListItem = (connection, targetName, type, editor) => {
    const item = document.createElement('div');
    item.className = 'connection-list-item';
    
    const label = document.createElement('span');
    label.textContent = type === 'outgoing' ? `→ ${targetName}` : `← ${targetName}`;
    item.appendChild(label);
    
    const deleteBtn = document.createElement('button');
    deleteBtn.className = 'btn-small btn-danger';
    deleteBtn.textContent = '删除';
    deleteBtn.addEventListener('click', () => {
        if (confirm('确定要删除这条连线吗？')) {
            editor.removeConnection(connection.id);
            updateNodeConnectionsList(editor.selectedElements[0], editor);
            editor.scheduleRender();
        }
    });
    item.appendChild(deleteBtn);
    
    return item;
};

export const showConnectionProperties = (connection, editor) => {
    const connectionProperties = document.getElementById('connection-properties');
    const conditionsList = document.getElementById('conditions-list');
    
    // 填充连线属性
    const colorInput = document.getElementById('connection-color');
    const lineWidthInput = document.getElementById('connection-line-width');
    const lineTypeInput = document.getElementById('connection-line-type');
    const arrowSizeInput = document.getElementById('connection-arrow-size');
    const arrowColorInput = document.getElementById('connection-arrow-color');
    
    if (colorInput) {
        colorInput.value = connection.color || '#666666';
        colorInput.oninput = () => {
            connection.color = colorInput.value === '#666666' ? null : colorInput.value;
            editor.scheduleRender();
        };
    }
    
    const colorResetBtn = document.getElementById('connection-color-reset');
    if (colorResetBtn) {
        colorResetBtn.onclick = () => {
            connection.color = null;
            colorInput.value = '#666666';
            editor.scheduleRender();
        };
    }
    
    if (lineWidthInput) {
        lineWidthInput.value = connection.lineWidth || 1.5;
        lineWidthInput.oninput = () => {
            connection.lineWidth = parseFloat(lineWidthInput.value) || null;
            editor.scheduleRender();
        };
    }
    
    const lineWidthResetBtn = document.getElementById('connection-line-width-reset');
    if (lineWidthResetBtn) {
        lineWidthResetBtn.onclick = () => {
            connection.lineWidth = null;
            lineWidthInput.value = 1.5;
            editor.scheduleRender();
        };
    }
    
    if (lineTypeInput) {
        lineTypeInput.value = connection.lineType || 'solid';
        lineTypeInput.onchange = () => {
            connection.lineType = lineTypeInput.value;
            editor.scheduleRender();
        };
    }
    
    if (arrowSizeInput) {
        arrowSizeInput.value = connection.arrowSize || 15;
        arrowSizeInput.oninput = () => {
            connection.arrowSize = parseInt(arrowSizeInput.value) || null;
            editor.scheduleRender();
        };
    }
    
    const arrowSizeResetBtn = document.getElementById('connection-arrow-size-reset');
    if (arrowSizeResetBtn) {
        arrowSizeResetBtn.onclick = () => {
            connection.arrowSize = null;
            arrowSizeInput.value = 15;
            editor.scheduleRender();
        };
    }
    
    if (arrowColorInput) {
        arrowColorInput.value = connection.arrowColor || '#888888';
        arrowColorInput.oninput = () => {
            connection.arrowColor = arrowColorInput.value === '#888888' ? null : arrowColorInput.value;
            editor.scheduleRender();
        };
    }
    
    const arrowColorResetBtn = document.getElementById('connection-arrow-color-reset');
    if (arrowColorResetBtn) {
        arrowColorResetBtn.onclick = () => {
            connection.arrowColor = null;
            arrowColorInput.value = '#888888';
            editor.scheduleRender();
        };
    }
    
    // 清空现有条件
    conditionsList.innerHTML = '';
    
    // 添加所有条件
    connection.conditions.forEach((condition, index) => {
        conditionsList.appendChild(createConditionElement(condition, index, editor));
    });
    
    // 显示面板
    connectionProperties.classList.remove('hidden');
};