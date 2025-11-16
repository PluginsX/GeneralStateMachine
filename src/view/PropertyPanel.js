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
        
        // 节点分组
        form.appendChild(this.createFormGroup('分组', 'group', node.group, 'text'));
        
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
        
        const nodePos = (node.transform && node.transform.position) ? node.transform.position : { x: 0, y: 0 };
        positionRow.appendChild(this.createPositionInput('x', nodePos.x));
        positionRow.appendChild(this.createPositionInput('y', nodePos.y));
        
        positionContainer.appendChild(positionRow);
        form.appendChild(positionContainer);
        
        // 自动调整大小
        form.appendChild(this.createCheckbox('自动调整大小', 'autoSize', node.autoSize));
        
        // 力导向图参数
        const forceGroup = document.createElement('div');
        forceGroup.className = 'property-group force-params';
        forceGroup.innerHTML = '<label>力导向图参数</label>';
        
        // 电荷力
        const chargeGroup = this.createFormGroup('电荷力', 'forceCharge', node.forceCharge, 'number');
        chargeGroup.querySelector('input').placeholder = '默认: -300';
        forceGroup.appendChild(chargeGroup);
        
        // 碰撞半径
        const collideGroup = this.createFormGroup('碰撞半径', 'forceCollideRadius', node.forceCollideRadius, 'number');
        collideGroup.querySelector('input').placeholder = '默认: 自动计算';
        forceGroup.appendChild(collideGroup);
        
        // 力强度
        const strengthGroup = this.createFormGroup('力强度', 'forceStrength', node.forceStrength, 'number');
        strengthGroup.querySelector('input').placeholder = '默认: 1';
        forceGroup.appendChild(strengthGroup);
        
        // 固定位置
        forceGroup.appendChild(this.createCheckbox('固定位置', 'fixedPosition', node.fixedPosition));
        
        form.appendChild(forceGroup);
        
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
        
        // 线类型选择
        form.appendChild(this.createSelect('线类型', 'lineType', connection.lineType, [
            { value: 'solid', label: '连续线' },
            { value: 'dashed', label: '间隔线' }
        ]));
        
        // 力导向图参数
        const forceGroup = document.createElement('div');
        forceGroup.className = 'property-group force-params';
        forceGroup.innerHTML = '<label>力导向图参数</label>';
        
        // 连接距离
        const distanceGroup = this.createFormGroup('连接距离', 'linkDistance', connection.linkDistance, 'number');
        distanceGroup.querySelector('input').placeholder = '默认: 150';
        forceGroup.appendChild(distanceGroup);
        
        // 连接强度
        const strengthGroup = this.createFormGroup('连接强度', 'linkStrength', connection.linkStrength, 'number');
        strengthGroup.querySelector('input').placeholder = '默认: 1';
        forceGroup.appendChild(strengthGroup);
        
        form.appendChild(forceGroup);
        
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
    
    // 创建下拉选择框
    createSelect(label, name, value, options) {
        const group = document.createElement('div');
        group.className = 'property-group';
        
        const labelEl = document.createElement('label');
        labelEl.textContent = label;
        labelEl.htmlFor = `prop-${name}`;
        group.appendChild(labelEl);
        
        const select = document.createElement('select');
        select.id = `prop-${name}`;
        select.name = name;
        
        // 添加选项
        options.forEach(option => {
            const optionEl = document.createElement('option');
            optionEl.value = option.value;
            optionEl.textContent = option.label;
            optionEl.selected = option.value === value;
            select.appendChild(optionEl);
        });
        
        group.appendChild(select);
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
        
        // 下拉选择框监听
        const selectInputs = form.querySelectorAll('select');
        selectInputs.forEach(select => {
            select.addEventListener('change', (e) => {
                this.handleInputChange(item, select.name, e.target.value, type);
            });
        });
    }
    
    // 处理输入变化
    handleInputChange(item, property, value, type) {
        // 更新项目属性
        if (property === 'x' || property === 'y') {
            // 处理位置属性更新
            if (!item.transform) {
                item.transform = {};
            }
            if (!item.transform.position) {
                item.transform.position = { x: item.x || 0, y: item.y || 0 };
            }
            
            // 确保位置值为整数
            const integerValue = Math.round(value);
            
            // 更新transform.position
            item.transform.position[property] = integerValue;
            
            // 触发更新回调
            if (type === 'node' && this.onNodeUpdate) {
                this.onNodeUpdate(item.id, { 
                    ['transform.position.' + property]: integerValue
                });
            } else if (type === 'text' && this.onNodeUpdate) {
                // 对于文本内容也使用相同的更新回调
                this.onNodeUpdate(item.id, { 
                    ['transform.position.' + property]: integerValue
                });
            }
            
            // 同步更新input显示为整数
            const input = document.querySelector(`input.position-input[name="${property}"]`);
            if (input) {
                input.value = integerValue;
            }
        } else if (type === 'text') {
            // 处理文本内容的特殊属性
            // 对于颜色属性，需要特殊处理
            if (property === 'fontColor' || property === 'backgroundColor' || property === 'borderColor') {
                // 假设Color类有一个fromString方法或构造函数接受颜色字符串
                const Color = window.Color || require('../math/GraphicsMath.js').Color;
                item[property] = new Color(value);
            } else if (['width', 'height', 'fontSize', 'lineHeight', 'padding', 'borderWidth'].includes(property)) {
                // 数字属性确保为有效值
                item[property] = Math.max(0, parseFloat(value) || 0);
                // 对于宽度和高度，如果开启了自动尺寸，则重新计算
                if (property === 'width' || property === 'height') {
                    if (item.autoSize) {
                        item._needsRecalculation = true;
                    }
                }
            } else if (['fontSize', 'lineHeight'].includes(property)) {
                // 字体相关数字属性，更新后需要重新计算
                item[property] = Math.max(0, parseFloat(value) || 0);
                item._needsRecalculation = true;
            } else {
                // 其他属性直接赋值
                item[property] = value;
            }
            
            // 触发更新回调
            if (this.onNodeUpdate) {
                this.onNodeUpdate(item.id, { [property]: value });
            }
        } else {
            // 处理其他类型属性
            item[property] = value;
            
            // 触发更新回调
            if (type === 'node' && this.onNodeUpdate) {
                this.onNodeUpdate(item.id, { [property]: value });
            } else if (type === 'connection' && this.onConnectionUpdate) {
                this.onConnectionUpdate(item.id, { [property]: value });
            }
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
            } else if (item.type === 'text') {
                this.showTextContentProperties(item);
            }
        } else {
            // 多个选中项时显示统计信息
            this.showMultipleSelectionInfo(selectedItems);
        }
    }
    
    // 显示文本内容属性
    showTextContentProperties(textContent) {
        if (!textContent || !this.container) return;
        
        this.container.innerHTML = '';
        
        // 创建标题
        const title = document.createElement('h3');
        title.textContent = '文字内容属性';
        this.container.appendChild(title);
        
        // 创建表单
        const form = document.createElement('form');
        form.className = 'property-form';
        
        // 文本内容
        const textGroup = document.createElement('div');
        textGroup.className = 'property-group';
        
        const textLabel = document.createElement('label');
        textLabel.textContent = '文本内容';
        textGroup.appendChild(textLabel);
        
        const textarea = document.createElement('textarea');
        textarea.id = 'prop-text';
        textarea.name = 'text';
        textarea.value = textContent.text || '';
        textarea.rows = 5;
        textGroup.appendChild(textarea);
        
        form.appendChild(textGroup);
        
        // 文本位置
        const positionContainer = document.createElement('div');
        positionContainer.className = 'property-group position-group';
        
        const positionLabel = document.createElement('label');
        positionLabel.textContent = '位置';
        positionContainer.appendChild(positionLabel);
        
        const positionRow = document.createElement('div');
        positionRow.className = 'position-row';
        
        const nodePos = (textContent.transform && textContent.transform.position) ? textContent.transform.position : { x: 0, y: 0 };
        positionRow.appendChild(this.createPositionInput('x', nodePos.x));
        positionRow.appendChild(this.createPositionInput('y', nodePos.y));
        
        positionContainer.appendChild(positionRow);
        form.appendChild(positionContainer);
        
        // 尺寸设置
        const sizeGroup = document.createElement('div');
        sizeGroup.className = 'property-group';
        sizeGroup.innerHTML = '<label>尺寸设置</label>';
        
        // 自动尺寸
        sizeGroup.appendChild(this.createCheckbox('自动调整大小', 'autoSize', textContent.autoSize));
        
        // 宽度和高度
        const sizeRow = document.createElement('div');
        sizeRow.className = 'size-row';
        
        const widthInput = document.createElement('input');
        widthInput.type = 'number';
        widthInput.name = 'width';
        widthInput.value = textContent.width || 200;
        widthInput.className = 'size-input';
        widthInput.placeholder = '宽度';
        sizeRow.appendChild(widthInput);
        
        const heightInput = document.createElement('input');
        heightInput.type = 'number';
        heightInput.name = 'height';
        heightInput.value = textContent.height || 100;
        heightInput.className = 'size-input';
        heightInput.placeholder = '高度';
        sizeRow.appendChild(heightInput);
        
        sizeGroup.appendChild(sizeRow);
        form.appendChild(sizeGroup);
        
        // 字体设置
        const fontGroup = document.createElement('div');
        fontGroup.className = 'property-group';
        fontGroup.innerHTML = '<label>字体设置</label>';
        
        // 字体大小
        fontGroup.appendChild(this.createFormGroup('字体大小', 'fontSize', textContent.fontSize, 'number'));
        
        // 行高
        fontGroup.appendChild(this.createFormGroup('行高', 'lineHeight', textContent.lineHeight, 'number'));
        
        // 字体颜色
        const colorInput = document.createElement('input');
        colorInput.type = 'color';
        colorInput.name = 'fontColor';
        colorInput.value = textContent.fontColor ? textContent.fontColor.toString() : '#000000';
        colorInput.className = 'color-input';
        
        const colorGroup = document.createElement('div');
        colorGroup.className = 'property-group';
        colorGroup.innerHTML = '<label>字体颜色</label>';
        colorGroup.appendChild(colorInput);
        fontGroup.appendChild(colorGroup);
        
        // 字体族
        fontGroup.appendChild(this.createFormGroup('字体族', 'fontFamily', textContent.fontFamily, 'text'));
        
        // 字体粗细
        fontGroup.appendChild(this.createSelect('字体粗细', 'fontWeight', textContent.fontWeight, [
            { value: 'normal', label: '正常' },
            { value: 'bold', label: '粗体' },
            { value: 'lighter', label: '细体' }
        ]));
        
        // 字体样式
        fontGroup.appendChild(this.createSelect('字体样式', 'fontStyle', textContent.fontStyle, [
            { value: 'normal', label: '正常' },
            { value: 'italic', label: '斜体' },
            { value: 'oblique', label: '倾斜' }
        ]));
        
        form.appendChild(fontGroup);
        
        // 文本对齐
        const alignGroup = document.createElement('div');
        alignGroup.className = 'property-group';
        alignGroup.innerHTML = '<label>文本对齐</label>';
        
        // 水平对齐
        alignGroup.appendChild(this.createSelect('水平对齐', 'textAlign', textContent.textAlign, [
            { value: 'left', label: '左对齐' },
            { value: 'center', label: '居中' },
            { value: 'right', label: '右对齐' },
            { value: 'justify', label: '两端对齐' }
        ]));
        
        // 垂直对齐
        alignGroup.appendChild(this.createSelect('垂直对齐', 'textVerticalAlign', textContent.textVerticalAlign, [
            { value: 'top', label: '顶部' },
            { value: 'middle', label: '中间' },
            { value: 'bottom', label: '底部' }
        ]));
        
        form.appendChild(alignGroup);
        
        // 文本处理
        const textProcessGroup = document.createElement('div');
        textProcessGroup.className = 'property-group';
        textProcessGroup.innerHTML = '<label>文本处理</label>';
        
        // 自动换行
        textProcessGroup.appendChild(this.createCheckbox('自动换行', 'wordWrap', textContent.wordWrap));
        
        // 最大宽度
        textProcessGroup.appendChild(this.createFormGroup('最大宽度', 'maxWidth', textContent.maxWidth, 'number'));
        
        // 最大高度
        textProcessGroup.appendChild(this.createFormGroup('最大高度', 'maxHeight', textContent.maxHeight, 'number'));
        
        // 内边距
        textProcessGroup.appendChild(this.createFormGroup('内边距', 'padding', textContent.padding, 'number'));
        
        form.appendChild(textProcessGroup);
        
        // 背景设置
        const backgroundGroup = document.createElement('div');
        backgroundGroup.className = 'property-group';
        backgroundGroup.innerHTML = '<label>背景设置</label>';
        
        // 背景透明
        backgroundGroup.appendChild(this.createCheckbox('背景透明', 'backgroundTransparent', textContent.backgroundTransparent));
        
        // 背景颜色
        const bgColorInput = document.createElement('input');
        bgColorInput.type = 'color';
        bgColorInput.name = 'backgroundColor';
        bgColorInput.value = textContent.backgroundColor ? textContent.backgroundColor.toString() : '#ffffff';
        bgColorInput.className = 'color-input';
        
        const bgColorGroup = document.createElement('div');
        bgColorGroup.className = 'property-group';
        bgColorGroup.innerHTML = '<label>背景颜色</label>';
        bgColorGroup.appendChild(bgColorInput);
        backgroundGroup.appendChild(bgColorGroup);
        
        form.appendChild(backgroundGroup);
        
        // 边框设置
        const borderGroup = document.createElement('div');
        borderGroup.className = 'property-group';
        borderGroup.innerHTML = '<label>边框设置</label>';
        
        // 显示边框
        borderGroup.appendChild(this.createCheckbox('显示边框', 'showBorder', textContent.showBorder));
        
        // 边框颜色
        const borderColorInput = document.createElement('input');
        borderColorInput.type = 'color';
        borderColorInput.name = 'borderColor';
        borderColorInput.value = textContent.borderColor ? textContent.borderColor.toString() : '#000000';
        borderColorInput.className = 'color-input';
        
        const borderColorGroup = document.createElement('div');
        borderColorGroup.className = 'property-group';
        borderColorGroup.innerHTML = '<label>边框颜色</label>';
        borderColorGroup.appendChild(borderColorInput);
        borderGroup.appendChild(borderColorGroup);
        
        // 边框宽度
        borderGroup.appendChild(this.createFormGroup('边框宽度', 'borderWidth', textContent.borderWidth, 'number'));
        
        // 边框样式
        borderGroup.appendChild(this.createSelect('边框样式', 'borderStyle', textContent.borderStyle, [
            { value: 'solid', label: '实线' },
            { value: 'dashed', label: '虚线' }
        ]));
        
        form.appendChild(borderGroup);
        
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
        this.setupFormListeners(form, textContent, 'text');
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