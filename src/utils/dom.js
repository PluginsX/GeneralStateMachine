// DOM操作工具函数
import NodeModel from '../models/NodeModel.js';
import { ConfirmDialog } from './popup.js';
import { Vector2 } from '../math/GraphicsMath.js';

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
    
    // 类型选择（与Unity动画控制器参数一致）
    const typeSelect = document.createElement('select');
    typeSelect.innerHTML = `
        <option value="Float">Float</option>
        <option value="Int">Int</option>
        <option value="Bool">Bool</option>
        <option value="Trigger">Trigger</option>
    `;
    typeSelect.value = condition.type;
    typeSelect.addEventListener('change', (e) => {
        editor.updateCondition(index, 'type', e.target.value);
        // 重新创建条件元素以更新UI
        updateConditionFields();
    });
    
    // 键输入
    const keyInput = document.createElement('input');
    keyInput.type = 'text';
    keyInput.placeholder = '键';
    keyInput.value = condition.key || '';
    // 改为input事件以实现实时更新
    keyInput.addEventListener('input', (e) => 
        editor.updateCondition(index, 'key', e.target.value));
    
    // 根据类型更新条件字段的函数
    const updateConditionFields = () => {
        // 清空现有字段，保留类型和键输入
        while (fields.lastChild) {
            if (fields.lastChild === typeSelect || fields.lastChild === keyInput) {
                break;
            }
            fields.removeChild(fields.lastChild);
        }
        
        const currentType = typeSelect.value;
        
        if (currentType === 'Trigger') {
            // Trigger类型只显示"Active"文本
            const activeLabel = document.createElement('span');
            activeLabel.textContent = 'Active';
            activeLabel.className = 'trigger-active-label';
            fields.appendChild(activeLabel);
        } else {
            // 操作符选择 - 根据类型动态生成选项
            const operatorSelect = document.createElement('select');
            let operatorOptions = '';
            
            if (currentType === 'Bool') {
                // Bool类型只有等于和不等于
                operatorOptions = `
                    <option value="==">等于</option>
                    <option value="!=">不等于</option>
                `;
            } else {
                // Float和Int类型有所有运算符
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
            // 改为input事件以实现实时更新
            operatorSelect.addEventListener('change', (e) => 
                editor.updateCondition(index, 'operator', e.target.value));
            
            // 值输入 - 根据类型使用不同的输入控件
            let valueControl;
            
            if (currentType === 'Bool') {
                // Bool类型使用复选框
                valueControl = document.createElement('input');
                valueControl.type = 'checkbox';
                valueControl.checked = condition.value === 'true' || condition.value === true;
                // 改为change事件以实现实时更新
                valueControl.addEventListener('change', (e) => 
                    editor.updateCondition(index, 'value', e.target.checked.toString()));
            } else {
                // Float和Int类型使用数字输入框
                valueControl = document.createElement('input');
                valueControl.type = 'number';
                if (currentType === 'Int') {
                    valueControl.step = '1';
                    valueControl.value = condition.value !== undefined ? parseInt(condition.value) : 0;
                } else { // Float
                    valueControl.step = '0.1';
                    valueControl.value = condition.value !== undefined ? parseFloat(condition.value) : 0;
                }
                // 改为input事件以实现实时更新
                valueControl.addEventListener('input', (e) => {
                    const value = currentType === 'Int' ? 
                        parseInt(e.target.value) || 0 : 
                        parseFloat(e.target.value) || 0;
                    editor.updateCondition(index, 'value', value.toString());
                });
            }
            
            fields.appendChild(operatorSelect);
            fields.appendChild(valueControl);
        }
    };
    
    // 添加类型和键输入
    fields.appendChild(typeSelect);
    fields.appendChild(keyInput);
    
    // 初始更新字段
    updateConditionFields();
    
    conditionItem.appendChild(header);
    conditionItem.appendChild(fields);
    
    return conditionItem;
};

export const removeContextMenu = () => {
    const existingMenu = document.querySelector('.context-menu');
    if (existingMenu) {
        existingMenu.remove();
    }
    // 清理事件监听器
    if (currentMenuCloseHandlers) {
        document.removeEventListener('click', currentMenuCloseHandlers.closeMenu);
        document.removeEventListener('mousedown', currentMenuCloseHandlers.closeOnMouseDown);
        currentMenuCloseHandlers = null;
    }
};

// 保存当前菜单的事件监听器引用，以便正确清理
let currentMenuCloseHandlers = null;

export const showContextMenu = (x, y, element, editor, worldPos = null) => {
    // 清除现有菜单和事件监听器
    removeContextMenu();
    
    // 清理旧的事件监听器
    if (currentMenuCloseHandlers) {
        document.removeEventListener('click', currentMenuCloseHandlers.closeMenu);
        document.removeEventListener('mousedown', currentMenuCloseHandlers.closeOnMouseDown);
        currentMenuCloseHandlers = null;
    }
    
    // 创建新菜单
    const menu = document.createElement('div');
    menu.className = 'context-menu';
    // x, y 是 clientX, clientY（相对于视口的坐标）
    // 需要加上滚动偏移，转换为相对于文档的坐标
    menu.style.left = (x + window.scrollX) + 'px';
    menu.style.top = (y + window.scrollY) + 'px';
    document.body.appendChild(menu);
    
    // 保存 worldPos 到菜单元素上，以便在点击时使用
    menu.dataset.worldPosX = worldPos ? worldPos.x : '';
    menu.dataset.worldPosY = worldPos ? worldPos.y : '';
    
    // 添加菜单项
    if (!element) {
        // 空白区域的菜单
        const createNodeItem = document.createElement('div');
        createNodeItem.className = 'context-menu-item';
        createNodeItem.textContent = '创建节点';
        createNodeItem.addEventListener('mousedown', (e) => {
            e.stopPropagation(); // 阻止事件冒泡
            e.stopImmediatePropagation(); // 阻止同一元素上的其他监听器
        }, true); // 使用捕获阶段，确保在 closeOnMouseDown 之前执行
        createNodeItem.addEventListener('click', (e) => {
            e.stopPropagation(); // 阻止事件冒泡
            e.stopImmediatePropagation(); // 阻止同一元素上的其他监听器
            e.preventDefault(); // 防止默认行为
            // 从菜单元素获取 worldPos
            const posX = parseFloat(menu.dataset.worldPosX);
            const posY = parseFloat(menu.dataset.worldPosY);
            if (!isNaN(posX) && !isNaN(posY)) {
                // 调试信息：输出坐标转换过程
                console.log('右键创建节点坐标调试:');
                console.log('- worldPos:', { x: posX, y: posY });
                console.log('- 菜单位置:', { x: menu.style.left, y: menu.style.top });
                console.log('- editor.pan:', editor.pan);
                console.log('- editor.zoom:', editor.zoom);
                
                // 使用 editor 的 addNode 方法创建节点
                const newNode = new NodeModel({
                    name: '新节点',
                    position: new Vector2(posX, posY)
                });
                newNode.group = ''; // 初始化Group属性
                
                // 确保transform和position对象存在（参考集中排列代码的做法）
                if (!newNode.transform) {
                    newNode.transform = {};
                }
                if (!newNode.transform.position) {
                    newNode.transform.position = { x: 0, y: 0 };
                }
                
                // 直接设置位置（参考集中排列代码的做法）
                newNode.transform.position.x = posX;
                newNode.transform.position.y = posY;
                
                editor.addNode(newNode);
                
                // 验证节点位置
                console.log('- 创建的节点位置:', { x: newNode.transform.position.x, y: newNode.transform.position.y });
                console.log('- Vector2创建参数:', { x: posX, y: posY });
            }
            // 然后关闭菜单
            removeContextMenu();
            // 清理事件监听器
            if (currentMenuCloseHandlers) {
                document.removeEventListener('click', currentMenuCloseHandlers.closeMenu);
                document.removeEventListener('mousedown', currentMenuCloseHandlers.closeOnMouseDown);
                currentMenuCloseHandlers = null;
            }
        }, true); // 使用捕获阶段，确保在其他监听器之前执行
        menu.appendChild(createNodeItem);
        
        const resetViewItem = document.createElement('div');
        resetViewItem.className = 'context-menu-item';
        resetViewItem.textContent = '重置视图';
        resetViewItem.addEventListener('mousedown', (e) => {
            e.stopPropagation(); // 阻止事件冒泡
        });
        resetViewItem.addEventListener('click', (e) => {
            e.stopPropagation(); // 阻止事件冒泡
            editor.resetView();
            removeContextMenu();
        });
        menu.appendChild(resetViewItem);
    } else if (element.type === 'node') {
        // 节点上的菜单
        const connectItem = document.createElement('div');
        connectItem.className = 'context-menu-item';
        connectItem.textContent = '创建连接';
        connectItem.addEventListener('mousedown', (e) => {
            e.stopPropagation(); // 阻止事件冒泡
        });
        connectItem.addEventListener('click', (e) => {
            e.stopPropagation(); // 阻止事件冒泡
            editor.startConnectionCreation(element.id);
            removeContextMenu();
        });
        menu.appendChild(connectItem);
        
        // 获取选中的节点
        const selectedNodes = editor.selectedElements.filter(el => el.type === 'node');
        const hasMultipleNodes = selectedNodes.length > 1;
        const isCurrentNodeSelected = selectedNodes.includes(element);
        
        if (hasMultipleNodes && isCurrentNodeSelected) {
            // 多个节点被选中时的菜单选项
            const fixAllItem = document.createElement('div');
            fixAllItem.className = 'context-menu-item';
            fixAllItem.textContent = '全部固定位置';
            fixAllItem.addEventListener('mousedown', (e) => {
                e.stopPropagation(); // 阻止事件冒泡
            });
            fixAllItem.addEventListener('click', (e) => {
                e.stopPropagation(); // 阻止事件冒泡
                // 固定所有选中的节点
                selectedNodes.forEach(node => {
                    // 获取D3模拟中的最新节点位置
                    const nodePos = (node.transform && node.transform.position) ? node.transform.position : { x: 0, y: 0 };
                    let currentX = nodePos.x;
                    let currentY = nodePos.y;
                    
                    // 注意：在新的树形排列系统中，不再从D3 nodeMap获取位置
                    // 因为树形排列是一次性计算，没有实时力导向模拟
                    
                    node.fixedPosition = true;
                    // 注意：在新的树形排列系统中，不再更新D3模拟中的固定属性
                    // 因为树形排列是一次性计算，不支持实时力导向的固定功能
                });
                // 注意：在新的树形排列系统中，不再重启模拟
                // 因为树形排列是一次性计算，没有实时力导向模拟
                // 更新属性面板
                import('../ui/panel.js').then(({ updatePropertyPanel }) => {
                    updatePropertyPanel(editor);
                });
                removeContextMenu();
            });
            menu.appendChild(fixAllItem);
            
            const unfixAllItem = document.createElement('div');
            unfixAllItem.className = 'context-menu-item';
            unfixAllItem.textContent = '全部取消固定';
            unfixAllItem.addEventListener('mousedown', (e) => {
                e.stopPropagation(); // 阻止事件冒泡
            });
            unfixAllItem.addEventListener('click', (e) => {
                e.stopPropagation(); // 阻止事件冒泡
                // 取消固定所有选中的节点
                selectedNodes.forEach(node => {
                    node.fixedPosition = false;
                    // 注意：在新的树形排列系统中，不再清除D3模拟中的固定属性
                    // 因为树形排列是一次性计算，没有实时力导向模拟
                });
                // 注意：在新的树形排列系统中，不再重启模拟
                // 因为树形排列是一次性计算，没有实时力导向模拟
                // 更新属性面板
                import('../ui/panel.js').then(({ updatePropertyPanel }) => {
                    updatePropertyPanel(editor);
                });
                removeContextMenu();
            });
            menu.appendChild(unfixAllItem);
        } else {
            // 单个节点时的菜单选项
            const fixItem = document.createElement('div');
            fixItem.className = 'context-menu-item';
            fixItem.textContent = element.fixedPosition ? '取消固定' : '固定位置';
            fixItem.addEventListener('mousedown', (e) => {
                e.stopPropagation(); // 阻止事件冒泡
            });
            fixItem.addEventListener('click', (e) => {
                e.stopPropagation(); // 阻止事件冒泡
                // 获取D3模拟中的最新节点位置
                const elementPos = (element.transform && element.transform.position) ? element.transform.position : { x: 0, y: 0 };
                let currentX = elementPos.x;
                let currentY = elementPos.y;
                
                // 注意：在新的树形排列系统中，不再从D3 nodeMap获取位置
                // 因为树形排列是一次性计算，没有实时力导向模拟
                
                // 切换节点的固定状态
                element.fixedPosition = !element.fixedPosition;
                
                // 注意：在新的树形排列系统中，不再更新D3模拟中的固定属性
                // 因为树形排列是一次性计算，不支持实时力导向的固定功能
                
                // 注意：在新的树形排列系统中，不再重启模拟
                // 因为树形排列是一次性计算，没有实时力导向模拟
                
                // 更新属性面板
                import('../ui/panel.js').then(({ updatePropertyPanel }) => {
                    updatePropertyPanel(editor);
                });
                removeContextMenu();
            });
            menu.appendChild(fixItem);
        }
        
        const deleteItem = document.createElement('div');
        deleteItem.className = 'context-menu-item';
        deleteItem.textContent = '删除节点';
        deleteItem.addEventListener('mousedown', (e) => {
            e.stopPropagation(); // 阻止事件冒泡
        });
        deleteItem.addEventListener('click', async (e) => {
            e.stopPropagation(); // 阻止事件冒泡
            editor.selectedElements = [element];
            await editor.deleteSelectedNodes();
            removeContextMenu();
        });
        menu.appendChild(deleteItem);
    } else if (element.type === 'connection') {
        // 连线上的菜单
        const deleteItem = document.createElement('div');
        deleteItem.className = 'context-menu-item';
        deleteItem.textContent = '删除连线';
        deleteItem.addEventListener('mousedown', (e) => {
            e.stopPropagation(); // 阻止事件冒泡
        });
        deleteItem.addEventListener('click', async (e) => {
            e.stopPropagation(); // 阻止事件冒泡
            editor.selectedElements = [element];
            await editor.deleteSelectedConnections();
            removeContextMenu();
        });
        menu.appendChild(deleteItem);
    }
    
    // 点击其他地方关闭菜单
    const closeMenu = (e) => {
        // 如果菜单已经被移除，不处理
        if (!document.body.contains(menu)) {
            return;
        }
        // 如果点击的是菜单本身或其子元素，不关闭
        if (e && e.target && (menu === e.target || menu.contains(e.target))) {
            return;
        }
        
        // 如果是右键按下，不在这里关闭（handleRightClick 会处理）
        if (e && e.button === 2) {
            return;
        }
        
        removeContextMenu();
        // 清理事件监听器
        if (currentMenuCloseHandlers) {
            document.removeEventListener('click', currentMenuCloseHandlers.closeMenu);
            document.removeEventListener('mousedown', currentMenuCloseHandlers.closeOnMouseDown);
            currentMenuCloseHandlers = null;
        }
    };
    
    // 监听鼠标按下事件（左键、中键）关闭菜单，但需要更严格的检查
    const closeOnMouseDown = (e) => {
        // 如果菜单已经被移除，不处理
        if (!document.body.contains(menu)) {
            return;
        }
        // 如果点击的是菜单本身或其子元素，不关闭
        if (e.target && (menu === e.target || menu.contains(e.target))) {
            return;
        }
        // 如果是右键，不关闭
        if (e.button === 2) {
            return;
        }
        // 如果是左键或中键，且不在菜单上，关闭菜单
        if (e.button === 0 || e.button === 1) {
            removeContextMenu();
            // 清理事件监听器
            if (currentMenuCloseHandlers) {
                document.removeEventListener('click', currentMenuCloseHandlers.closeMenu);
                document.removeEventListener('mousedown', currentMenuCloseHandlers.closeOnMouseDown);
                currentMenuCloseHandlers = null;
            }
        }
    };
    
    // 保存事件监听器引用，以便后续清理
    currentMenuCloseHandlers = {
        closeMenu: closeMenu,
        closeOnMouseDown: closeOnMouseDown
    };
    
    // 延迟添加事件监听，避免立即触发
    setTimeout(() => {
        // 监听左键点击关闭菜单（使用捕获阶段，但优先级低于菜单项）
        document.addEventListener('click', closeMenu, true);
        // 监听鼠标按下事件（左键、中键）关闭菜单（使用捕获阶段，但优先级低于菜单项）
        document.addEventListener('mousedown', closeOnMouseDown, true);
    }, 100);
};