// DOM操作工具函数
export const createConditionElement = (condition, index, editor) => {
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
    upBtn.addEventListener('click', () => editor.moveConditionUp(index));
    
    const downBtn = document.createElement('button');
    downBtn.innerHTML = '↓';
    downBtn.disabled = index === editor.selectedElements[0].conditions.length - 1;
    downBtn.addEventListener('click', () => editor.moveConditionDown(index));
    
    const deleteBtn = document.createElement('button');
    deleteBtn.innerHTML = '✕';
    deleteBtn.addEventListener('click', () => editor.deleteCondition(index));
    
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
        <option value="int">整数</option>
        <option value="float">浮点数</option>
        <option value="string">字符串</option>
        <option value="boolean">布尔值</option>
    `;
    typeSelect.value = condition.type;
    typeSelect.addEventListener('change', (e) => 
        editor.updateCondition(index, 'type', e.target.value));
    
    // 键输入
    const keyInput = document.createElement('input');
    keyInput.type = 'text';
    keyInput.placeholder = '键';
    keyInput.value = condition.key;
    keyInput.addEventListener('change', (e) => 
        editor.updateCondition(index, 'key', e.target.value));
    
    // 操作符选择
    const operatorSelect = document.createElement('select');
    operatorSelect.innerHTML = `
        <option value=">">大于</option>
        <option value="<">小于</option>
        <option value="==">等于</option>
        <option value="!=">不等于</option>
        <option value=">=">大于等于</option>
        <option value="<=">小于等于</option>
    `;
    operatorSelect.value = condition.operator;
    operatorSelect.addEventListener('change', (e) => 
        editor.updateCondition(index, 'operator', e.target.value));
    
    // 值输入
    const valueInput = document.createElement('input');
    valueInput.type = 'text';
    valueInput.placeholder = '值';
    valueInput.value = condition.value;
    valueInput.addEventListener('change', (e) => 
        editor.updateCondition(index, 'value', e.target.value));
    
    fields.appendChild(typeSelect);
    fields.appendChild(keyInput);
    fields.appendChild(operatorSelect);
    fields.appendChild(valueInput);
    
    conditionItem.appendChild(header);
    conditionItem.appendChild(fields);
    
    return conditionItem;
};

export const removeContextMenu = () => {
    const existingMenu = document.querySelector('.context-menu');
    if (existingMenu) {
        existingMenu.remove();
    }
};

export const showContextMenu = (x, y, element, editor) => {
    // 清除现有菜单
    removeContextMenu();
    
    // 创建新菜单
    const menu = document.createElement('div');
    menu.className = 'context-menu';
    menu.style.left = x + 'px';
    menu.style.top = y + 'px';
    document.body.appendChild(menu);
    
    // 添加菜单项
    if (element.type === 'node') {
        const deleteItem = document.createElement('div');
        deleteItem.className = 'context-menu-item';
        deleteItem.textContent = '删除节点';
        deleteItem.addEventListener('click', () => {
            editor.selectedElements = [element];
            editor.deleteSelectedNodes();
            removeContextMenu();
        });
        menu.appendChild(deleteItem);
        
        const connectItem = document.createElement('div');
        connectItem.className = 'context-menu-item';
        connectItem.textContent = '创建连线';
        connectItem.addEventListener('click', () => {
            editor.startConnectionCreation(element.id);
            removeContextMenu();
        });
        menu.appendChild(connectItem);
    } else if (element.type === 'connection') {
        const deleteItem = document.createElement('div');
        deleteItem.className = 'context-menu-item';
        deleteItem.textContent = '删除连线';
        deleteItem.addEventListener('click', () => {
            editor.selectedElements = [element];
            editor.deleteSelectedConnections();
            removeContextMenu();
        });
        menu.appendChild(deleteItem);
    }
    
    // 点击其他地方关闭菜单
    const closeMenu = () => {
        removeContextMenu();
        document.removeEventListener('click', closeMenu);
    };
    
    setTimeout(() => {
        document.addEventListener('click', closeMenu);
    }, 100);
};