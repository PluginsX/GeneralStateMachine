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
    
    // 填充表单
    nodeNameInput.value = node.name;
    nodeDescInput.value = node.description;
    nodeWidthInput.value = node.width;
    nodeHeightInput.value = node.height;
    nodeAutosizeInput.checked = node.autoSize;
    
    // 控制尺寸输入的可用性
    nodeWidthInput.disabled = node.autoSize;
    nodeHeightInput.disabled = node.autoSize;
    
    // 显示面板
    nodeProperties.classList.remove('hidden');
};

export const showConnectionProperties = (connection, editor) => {
    const connectionProperties = document.getElementById('connection-properties');
    const conditionsList = document.getElementById('conditions-list');
    
    // 清空现有条件
    conditionsList.innerHTML = '';
    
    // 添加所有条件
    connection.conditions.forEach((condition, index) => {
        conditionsList.appendChild(createConditionElement(condition, index, editor));
    });
    
    // 显示面板
    connectionProperties.classList.remove('hidden');
};