import { createConditionElement } from '../utils/dom.js';
import Condition from '../core/condition.js';

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
    } else if (editor.selectedElements.length > 1) {
        // 多条连线被选中
        const connections = editor.selectedElements.filter(el => el.type === 'connection');
        if (connections.length > 0) {
            showMultipleConnectionProperties(connections, editor);
        } else {
            noSelection.classList.remove('hidden');
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
    
    // 节点名称输入事件（实时更新）
    nodeNameInput.oninput = () => {
        node.name = nodeNameInput.value;
        editor.scheduleRender();
    };
    
    // 节点描述输入事件（实时更新）
    nodeDescInput.oninput = () => {
        node.description = nodeDescInput.value;
        editor.scheduleRender();
    };
    
    // 节点宽度输入事件（实时更新）
    nodeWidthInput.oninput = () => {
        if (!node.autoSize) {
            node.width = parseInt(nodeWidthInput.value) || 150;
            editor.scheduleRender();
        }
    };
    
    // 节点高度输入事件（实时更新）
    nodeHeightInput.oninput = () => {
        if (!node.autoSize) {
            node.height = parseInt(nodeHeightInput.value) || 50;
            editor.scheduleRender();
        }
    };
    
    // 自适应尺寸切换事件（实时更新）
    nodeAutosizeInput.onchange = () => {
        node.autoSize = nodeAutosizeInput.checked;
        nodeWidthInput.disabled = node.autoSize;
        nodeHeightInput.disabled = node.autoSize;
        editor.scheduleRender();
    };
    
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
    
    // 获取起始节点和终止节点名称
    const sourceNode = editor.nodes.find(n => n.id === connection.sourceNodeId);
    const targetNode = editor.nodes.find(n => n.id === connection.targetNodeId);
    const sourceNodeName = sourceNode ? sourceNode.name : '未知节点';
    const targetNodeName = targetNode ? targetNode.name : '未知节点';
    
    // 清空conditionsList，准备添加节点信息
    conditionsList.innerHTML = '';
    
    // 显示节点信息（在最上面）
    const nodeInfo = document.createElement('div');
    nodeInfo.className = 'form-group';
    nodeInfo.style.cssText = 'margin-bottom: 15px; padding: 10px; background: rgba(0, 122, 204, 0.1); border-radius: 3px;';
    nodeInfo.innerHTML = `
        <div style="font-size: 12px; color: #969696;">
            <div>起始节点: <strong style="color: #e0e0e0;">${sourceNodeName}</strong></div>
            <div>终止节点: <strong style="color: #e0e0e0;">${targetNodeName}</strong></div>
        </div>
    `;
    if (document.body.classList.contains('light-mode')) {
        nodeInfo.style.background = 'rgba(0, 102, 204, 0.1)';
        nodeInfo.querySelector('div').style.color = '#666';
        nodeInfo.querySelectorAll('strong').forEach(s => s.style.color = '#333');
    }
    conditionsList.insertBefore(nodeInfo, conditionsList.firstChild);
    
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
        arrowSizeInput.value = connection.arrowSize || 10;
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
    
    // 单一连线时，显示静态按钮
    const addConditionBtnStatic = document.getElementById('add-condition');
    const deleteConnectionBtnStatic = document.getElementById('delete-connection');
    if (addConditionBtnStatic) addConditionBtnStatic.style.display = 'inline-block';
    if (deleteConnectionBtnStatic) deleteConnectionBtnStatic.style.display = 'inline-block';
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
        deleteBtn.addEventListener('click', () => {
            if (confirm('确定要删除这条连线吗？')) {
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