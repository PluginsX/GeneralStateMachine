// 属性面板 - 视图层
// 负责节点/连线属性编辑
export default class PropertyPanel {
    constructor(containerId) {
        this.container = document.getElementById(containerId);
        if (!this.container) {
            console.error('属性面板容器不存在:', containerId);
            return;
        }
        
        this.onNodeUpdate = null;     // 节点更新回调
        this.onConnectionUpdate = null; // 连线更新回调
        this.onDeleteCallback = null;   // 删除回调
        
        this.init();
    }
    
    // 初始化属性面板
    init() {
        // 清空容器
        this.container.innerHTML = '';
        
        // 创建默认内容
        this.createEmptyState();
    }
    
    // 创建空状态
    createEmptyState() {
        const emptyState = document.createElement('div');
        emptyState.className = 'property-panel-empty';
        emptyState.innerHTML = '<p>未选择任何元素</p>';
        this.container.appendChild(emptyState);
    }
    
    // 显示节点属性
    showNodeProperties(node) {
        if (!node || !this.container) return;
        
        this.container.innerHTML = '';
        
        // 创建标题
        const title = document.createElement('h3');
        title.textContent = '节点属性';
        this.container.appendChild(title);
        
        // 创建表单
        const form = document.createElement('form');
        form.className = 'property-form';
        
        // 节点名称
        form.appendChild(this.createFormGroup('名称', 'name', node.name, 'text'));
        
        // 节点描述
        form.appendChild(this.createFormGroup('描述', 'description', node.description, 'textarea'));
        
        // 节点位置
        const positionContainer = document.createElement('div');
        positionContainer.className = 'property-group position-group';
        
        const positionLabel = document.createElement('label');
        positionLabel.textContent = '位置';
        positionContainer.appendChild(positionLabel);
        
        const positionRow = document.createElement('div');
        positionRow.className = 'position-row';
        
        positionRow.appendChild(this.createPositionInput('x', node.x));
        positionRow.appendChild(this.createPositionInput('y', node.y));
        
        positionContainer.appendChild(positionRow);
        form.appendChild(positionContainer);
        
        // 自动调整大小
        form.appendChild(this.createCheckbox('自动调整大小', 'autoSize', node.autoSize));
        
        // 颜色选择器 (可选功能)
        // form.appendChild(this.createColorPicker('节点颜色', 'color', node.color));
        
        // 新节点按钮
        const newNodeBtn = document.createElement('button');
        newNodeBtn.type = 'button';
        newNodeBtn.textContent = '→ 新节点';
        newNodeBtn.className = 'new-node-btn';
        newNodeBtn.addEventListener('click', () => {
            this.onCreateNode(node);
        });
        form.appendChild(newNodeBtn);
        
        // 删除按钮
        const deleteBtn = document.createElement('button');
        deleteBtn.type = 'button';
        deleteBtn.textContent = '删除';
        deleteBtn.className = 'delete-btn';
        deleteBtn.addEventListener('click', () => {
            this.onDelete();
        });
        form.appendChild(deleteBtn);
        
        // 添加表单到容器
        this.container.appendChild(form);
        
        // 添加事件监听器
        this.setupFormListeners(form, node);
    }
    
    // 显示连线属性
    showConnectionProperties(connection, sourceNode, targetNode) {
        if (!connection || !this.container) return;
        
        this.container.innerHTML = '';
        
        // 创建标题
        const title = document.createElement('h3');
        title.textContent = '连线属性';
        this.container.appendChild(title);
        
        // 显示连线信息
        const infoContainer = document.createElement('div');
        infoContainer.className = 'connection-info';
        
        const sourceInfo = document.createElement('div');
        sourceInfo.className = 'connection-node';
        sourceInfo.innerHTML = `<strong>出发节点:</strong> ${sourceNode ? sourceNode.name : '未知'}`;
        infoContainer.appendChild(sourceInfo);
        
        const targetInfo = document.createElement('div');
        targetInfo.className = 'connection-node';
        targetInfo.innerHTML = `<strong>到达节点:</strong> ${targetNode ? targetNode.name : '未知'}`;
        infoContainer.appendChild(targetInfo);
        
        this.container.appendChild(infoContainer);
        
        // 创建表单
        const form = document.createElement('form');
        form.className = 'property-form';
        
        // 默认连接
        form.appendChild(this.createCheckbox('默认连接', 'defaultConnection', connection.defaultConnection));
        
        // 条件管理 (简化版)
        const conditionsContainer = document.createElement('div');
        conditionsContainer.className = 'property-group';
        
        const conditionsLabel = document.createElement('label');
        conditionsLabel.textContent = '条件';
        conditionsContainer.appendChild(conditionsLabel);
        
        const conditionsList = document.createElement('div');
        conditionsList.className = 'conditions-list';
        
        if (connection.conditions && connection.conditions.length > 0) {
            connection.conditions.forEach((condition, index) => {
                const conditionItem = document.createElement('div');
                conditionItem.className = 'condition-item';
                conditionItem.textContent = `条件 ${index + 1}: ${condition}`;
                conditionsList.appendChild(conditionItem);
            });
        } else {
            const noCondition = document.createElement('p');
            noCondition.textContent = '无条件';
            noCondition.className = 'no-condition';
            conditionsList.appendChild(noCondition);
        }
        
        conditionsContainer.appendChild(conditionsList);
        form.appendChild(conditionsContainer);
        
        // 删除按钮
        const deleteBtn = document.createElement('button');
        deleteBtn.type = 'button';
        deleteBtn.textContent = '删除';
        deleteBtn.className = 'delete-btn';
        deleteBtn.addEventListener('click', () => {
            this.onDelete();
        });
        form.appendChild(deleteBtn);
        
        // 添加表单到容器
        this.container.appendChild(form);
        
        // 添加事件监听器
        this.setupFormListeners(form, connection, 'connection');
    }
    
    // 创建表单组
    createFormGroup(label, name, value, type = 'text') {
        const group = document.createElement('div');
        group.className = 'property-group';
        
        const labelEl = document.createElement('label');
        labelEl.textContent = label;
        labelEl.htmlFor = `prop-${name}`;
        group.appendChild(labelEl);
        
        if (type === 'textarea') {
            const textarea = document.createElement('textarea');
            textarea.id = `prop-${name}`;
            textarea.name = name;
            textarea.value = value || '';
            textarea.rows = 3;
            group.appendChild(textarea);
        } else {
            const input = document.createElement('input');
            input.id = `prop-${name}`;
            input.name = name;
            input.value = value || '';
            input.type = type;
            group.appendChild(input);
        }
        
        return group;
    }
    
    // 创建位置输入
    createPositionInput(axis, value) {
        const input = document.createElement('input');
        input.type = 'number';
        input.name = axis;
        input.value = Math.round(value || 0);
        input.className = 'position-input';
        input.placeholder = axis.toUpperCase();
        return input;
    }
    
    // 创建复选框
    createCheckbox(label, name, checked) {
        const group = document.createElement('div');
        group.className = 'property-group checkbox-group';
        
        const checkbox = document.createElement('input');
        checkbox.type = 'checkbox';
        checkbox.id = `prop-${name}`;
        checkbox.name = name;
        checkbox.checked = checked || false;
        group.appendChild(checkbox);
        
        const labelEl = document.createElement('label');
        labelEl.textContent = label;
        labelEl.htmlFor = `prop-${name}`;
        group.appendChild(labelEl);
        
        return group;
    }
    
    // 设置表单监听器
    setupFormListeners(form, item, type = 'node') {
        // 文本输入监听
        const textInputs = form.querySelectorAll('input[type="text"], textarea');
        textInputs.forEach(input => {
            input.addEventListener('input', (e) => {
                this.handleInputChange(item, input.name, e.target.value, type);
            });
        });
        
        // 数字输入监听
        const numberInputs = form.querySelectorAll('input[type="number"]');
        numberInputs.forEach(input => {
            input.addEventListener('change', (e) => {
                this.handleInputChange(item, input.name, parseFloat(e.target.value) || 0, type);
            });
        });
        
        // 复选框监听
        const checkboxes = form.querySelectorAll('input[type="checkbox"]');
        checkboxes.forEach(checkbox => {
            checkbox.addEventListener('change', (e) => {
                this.handleInputChange(item, checkbox.name, e.target.checked, type);
            });
        });
    }
    
    // 处理输入变化
    handleInputChange(item, property, value, type) {
        // 更新项目属性
        item[property] = value;
        
        // 触发更新回调
        if (type === 'node' && this.onNodeUpdate) {
            this.onNodeUpdate(item.id, { [property]: value });
        } else if (type === 'connection' && this.onConnectionUpdate) {
            this.onConnectionUpdate(item.id, { [property]: value });
        }
    }
    
    // 创建新节点
    onCreateNode(sourceNode) {
        // 这个方法会在ViewModel层实现
        console.log('创建新节点:', sourceNode);
    }
    
    // 删除选中元素
    onDelete() {
        if (this.onDeleteCallback) {
            this.onDeleteCallback();
        }
    }
    
    // 设置更新回调
    setOnNodeUpdateCallback(callback) {
        this.onNodeUpdate = callback;
    }
    
    // 设置连线更新回调
    setOnConnectionUpdateCallback(callback) {
        this.onConnectionUpdate = callback;
    }
    
    // 设置删除回调
    setOnDeleteCallback(callback) {
        this.onDeleteCallback = callback;
    }
    
    // 更新显示
    update(selectedItems, nodes, connections) {
        // 清空当前显示
        this.container.innerHTML = '';
        
        if (!selectedItems || selectedItems.length === 0) {
            this.createEmptyState();
            return;
        }
        
        // 只处理单个选中项的属性显示
        if (selectedItems.length === 1) {
            const item = selectedItems[0];
            
            if (item.type === 'node') {
                this.showNodeProperties(item);
            } else if (item.type === 'connection') {
                const sourceNode = nodes.get(item.sourceNodeId);
                const targetNode = nodes.get(item.targetNodeId);
                this.showConnectionProperties(item, sourceNode, targetNode);
            }
        } else {
            // 多个选中项时显示统计信息
            this.showMultipleSelectionInfo(selectedItems);
        }
    }
    
    // 显示多个选中项的信息
    showMultipleSelectionInfo(selectedItems) {
        const infoContainer = document.createElement('div');
        infoContainer.className = 'multiple-selection-info';
        
        const title = document.createElement('h3');
        title.textContent = '多元素选中';
        infoContainer.appendChild(title);
        
        const nodeCount = selectedItems.filter(item => item.type === 'node').length;
        const connectionCount = selectedItems.filter(item => item.type === 'connection').length;
        
        const stats = document.createElement('div');
        stats.innerHTML = `
            <p>共选中 ${selectedItems.length} 个元素</p>
            <p>节点: ${nodeCount}</p>
            <p>连线: ${connectionCount}</p>
        `;
        infoContainer.appendChild(stats);
        
        // 删除按钮
        const deleteBtn = document.createElement('button');
        deleteBtn.type = 'button';
        deleteBtn.textContent = '删除选中';
        deleteBtn.className = 'delete-btn';
        deleteBtn.addEventListener('click', () => {
            this.onDelete();
        });
        infoContainer.appendChild(deleteBtn);
        
        this.container.appendChild(infoContainer);
    }
}