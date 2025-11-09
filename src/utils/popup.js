// 弹窗功能工具函数

/**
 * 显示一个自定义弹窗
 * @param {string} title - 弹窗标题
 * @param {string} content - 弹窗内容
 * @param {string} btnLeft - 左侧按钮文本
 * @param {string} btnRight - 右侧按钮文本
 * @returns {Promise<boolean>} - 点击左侧按钮返回true，点击右侧按钮返回false
 */
export const PopUp_Window = (title, content, btnLeft, btnRight) => {
    return new Promise((resolve) => {
        // 创建弹窗背景
        const popupOverlay = document.createElement('div');
        popupOverlay.className = 'popup-overlay';
        popupOverlay.style.position = 'fixed';
        popupOverlay.style.top = '0';
        popupOverlay.style.left = '0';
        popupOverlay.style.width = '100%';
        popupOverlay.style.height = '100%';
        popupOverlay.style.backgroundColor = 'rgba(0, 0, 0, 0.5)';
        popupOverlay.style.display = 'flex';
        popupOverlay.style.justifyContent = 'center';
        popupOverlay.style.alignItems = 'center';
        popupOverlay.style.zIndex = '2000';
        popupOverlay.style.transition = 'background-color 0.3s ease';

        // 当处于浅色模式时调整背景透明度
        if (document.body.classList.contains('light-mode')) {
            popupOverlay.style.backgroundColor = 'rgba(0, 0, 0, 0.3)';
        }

        // 创建弹窗容器
        const popupContainer = document.createElement('div');
        popupContainer.className = 'popup-container';
        popupContainer.style.backgroundColor = document.body.classList.contains('light-mode') ? '#f0f0f0' : '#2d2d30';
        popupContainer.style.border = `1px solid ${document.body.classList.contains('light-mode') ? '#ccc' : '#3e3e42'}`;
        popupContainer.style.borderRadius = '4px';
        popupContainer.style.boxShadow = document.body.classList.contains('light-mode') ? '0 4px 8px rgba(0, 0, 0, 0.1)' : '0 4px 8px rgba(0, 0, 0, 0.3)';
        popupContainer.style.width = '400px';
        popupContainer.style.maxWidth = '90%';
        popupContainer.style.maxHeight = '80%';
        popupContainer.style.display = 'flex';
        popupContainer.style.flexDirection = 'column';
        popupContainer.style.overflow = 'hidden';

        // 创建标题部分
        const popupTitle = document.createElement('div');
        popupTitle.className = 'popup-title';
        popupTitle.style.padding = '12px 16px';
        popupTitle.style.borderBottom = `1px solid ${document.body.classList.contains('light-mode') ? '#ccc' : '#3e3e42'}`;
        popupTitle.style.fontWeight = 'bold';
        popupTitle.style.fontSize = '14px';
        popupTitle.style.color = document.body.classList.contains('light-mode') ? '#333' : '#e0e0e0';
        popupTitle.textContent = title;

        // 创建内容部分
        const popupContent = document.createElement('div');
        popupContent.className = 'popup-content';
        popupContent.style.padding = '16px';
        popupContent.style.color = document.body.classList.contains('light-mode') ? '#333' : '#e0e0e0';
        popupContent.style.fontSize = '13px';
        popupContent.style.lineHeight = '1.5';
        popupContent.style.flex = '1';
        popupContent.style.overflowY = 'auto';
        popupContent.textContent = content;

        // 创建按钮部分
        const popupButtons = document.createElement('div');
        popupButtons.className = 'popup-buttons';
        popupButtons.style.padding = '12px 16px';
        popupButtons.style.borderTop = `1px solid ${document.body.classList.contains('light-mode') ? '#ccc' : '#3e3e42'}`;
        popupButtons.style.display = 'flex';
        popupButtons.style.justifyContent = 'flex-end';
        popupButtons.style.gap = '8px';

        // 创建左侧按钮
        const leftButton = document.createElement('button');
        leftButton.className = 'popup-btn popup-btn-left';
        leftButton.style.padding = '6px 12px';
        leftButton.style.border = 'none';
        leftButton.style.borderRadius = '3px';
        leftButton.style.fontSize = '13px';
        leftButton.style.cursor = 'pointer';
        leftButton.style.backgroundColor = document.body.classList.contains('light-mode') ? '#0066cc' : '#0e639c';
        leftButton.style.color = 'white';
        leftButton.style.transition = 'background-color 0.2s';
        leftButton.textContent = btnLeft;

        leftButton.addEventListener('mouseover', () => {
            leftButton.style.backgroundColor = document.body.classList.contains('light-mode') ? '#0052aa' : '#1177bb';
        });

        leftButton.addEventListener('mouseout', () => {
            leftButton.style.backgroundColor = document.body.classList.contains('light-mode') ? '#0066cc' : '#0e639c';
        });

        // 创建右侧按钮
        const rightButton = document.createElement('button');
        rightButton.className = 'popup-btn popup-btn-right';
        rightButton.style.padding = '6px 12px';
        rightButton.style.border = `1px solid ${document.body.classList.contains('light-mode') ? '#ccc' : '#464647'}`;
        rightButton.style.borderRadius = '3px';
        rightButton.style.fontSize = '13px';
        rightButton.style.cursor = 'pointer';
        rightButton.style.backgroundColor = document.body.classList.contains('light-mode') ? '#f0f0f0' : '#2d2d30';
        rightButton.style.color = document.body.classList.contains('light-mode') ? '#333' : '#e0e0e0';
        rightButton.style.transition = 'background-color 0.2s';
        rightButton.textContent = btnRight;

        rightButton.addEventListener('mouseover', () => {
            rightButton.style.backgroundColor = document.body.classList.contains('light-mode') ? '#e0e0e0' : '#37373d';
        });

        rightButton.addEventListener('mouseout', () => {
            rightButton.style.backgroundColor = document.body.classList.contains('light-mode') ? '#f0f0f0' : '#2d2d30';
        });

        // 按钮点击事件处理
        const handleClose = (result) => {
            // 添加淡出动画
            popupOverlay.style.opacity = '0';
            popupContainer.style.transform = 'translateY(20px)';
            popupContainer.style.opacity = '0';

            // 动画结束后移除元素
            setTimeout(() => {
                document.body.removeChild(popupOverlay);
                resolve(result);
            }, 300);
        };

        leftButton.addEventListener('click', () => handleClose(true));
        rightButton.addEventListener('click', () => handleClose(false));

        // 添加键盘事件监听
        const handleKeyDown = (e) => {
            if (e.key === 'Escape') {
                handleClose(false);
            } else if (e.key === 'Enter') {
                handleClose(true);
            }
        };

        // 主题切换监听
        const handleThemeChange = () => {
            // 更新背景颜色
            popupOverlay.style.backgroundColor = document.body.classList.contains('light-mode') ? 'rgba(0, 0, 0, 0.3)' : 'rgba(0, 0, 0, 0.5)';
            
            // 更新容器样式
            popupContainer.style.backgroundColor = document.body.classList.contains('light-mode') ? '#f0f0f0' : '#2d2d30';
            popupContainer.style.border = `1px solid ${document.body.classList.contains('light-mode') ? '#ccc' : '#3e3e42'}`;
            popupContainer.style.boxShadow = document.body.classList.contains('light-mode') ? '0 4px 8px rgba(0, 0, 0, 0.1)' : '0 4px 8px rgba(0, 0, 0, 0.3)';
            
            // 更新标题样式
            popupTitle.style.borderBottom = `1px solid ${document.body.classList.contains('light-mode') ? '#ccc' : '#3e3e42'}`;
            popupTitle.style.color = document.body.classList.contains('light-mode') ? '#333' : '#e0e0e0';
            
            // 更新内容样式
            popupContent.style.color = document.body.classList.contains('light-mode') ? '#333' : '#e0e0e0';
            
            // 更新按钮区域样式
            popupButtons.style.borderTop = `1px solid ${document.body.classList.contains('light-mode') ? '#ccc' : '#3e3e42'}`;
            
            // 更新按钮样式
            leftButton.style.backgroundColor = document.body.classList.contains('light-mode') ? '#0066cc' : '#0e639c';
            rightButton.style.border = `1px solid ${document.body.classList.contains('light-mode') ? '#ccc' : '#464647'}`;
            rightButton.style.backgroundColor = document.body.classList.contains('light-mode') ? '#f0f0f0' : '#2d2d30';
            rightButton.style.color = document.body.classList.contains('light-mode') ? '#333' : '#e0e0e0';
        };

        // 组装弹窗
        popupButtons.appendChild(leftButton);
        popupButtons.appendChild(rightButton);
        popupContainer.appendChild(popupTitle);
        popupContainer.appendChild(popupContent);
        popupContainer.appendChild(popupButtons);
        popupOverlay.appendChild(popupContainer);

        // 添加到文档
        document.body.appendChild(popupOverlay);

        // 初始动画
        popupOverlay.style.opacity = '0';
        popupContainer.style.transform = 'translateY(-20px)';
        popupContainer.style.opacity = '0';
        popupContainer.style.transition = 'transform 0.3s ease, opacity 0.3s ease';
        popupOverlay.style.transition = 'opacity 0.3s ease';

        setTimeout(() => {
            popupOverlay.style.opacity = '1';
            popupContainer.style.transform = 'translateY(0)';
            popupContainer.style.opacity = '1';
        }, 10);

        // 聚焦到左侧按钮
        leftButton.focus();

        // 监听主题变化
        const observer = new MutationObserver((mutations) => {
            mutations.forEach(mutation => {
                if (mutation.attributeName === 'class') {
                    handleThemeChange();
                }
            });
        });

        observer.observe(document.body, { attributes: true });

        // 添加键盘事件监听
        document.addEventListener('keydown', handleKeyDown);

        // 清理函数
        const cleanup = () => {
            observer.disconnect();
            document.removeEventListener('keydown', handleKeyDown);
        };

        // 确保清理函数在弹窗关闭时执行
        leftButton.addEventListener('click', cleanup);
        rightButton.addEventListener('click', cleanup);
    });
};

/**
 * 简化版的确认弹窗
 * @param {string} content - 确认消息内容
 * @returns {Promise<boolean>} - 确认返回true，取消返回false
 */
export const ConfirmDialog = (content) => {
    return PopUp_Window('确认', content, '确认', '取消');
};

/**
 * 简化版的提示弹窗
 * @param {string} content - 提示消息内容
 * @returns {Promise<void>}
 */
export const AlertDialog = (content) => {
    return PopUp_Window('提示', content, '确定', '取消');
};

/**
 * 带参数输入的弹窗
 * @param {string} title - 弹窗标题
 * @param {string} btnLeft - 左侧按钮文本（确定）
 * @param {string} btnRight - 右侧按钮文本（取消）
 * @param {Object} parameters - 参数对象，格式为 {key: value}，value 可以是 number, string, boolean 等
 * @param {Object} outParameters - 输出参数对象，用于接收用户输入的值
 * @returns {Promise<boolean>} - 点击确定返回true，点击取消返回false
 */
export const PopUp_Window_Parameters = (title, btnLeft, btnRight, parameters, outParameters) => {
    return new Promise((resolve) => {
        // 创建弹窗背景
        const popupOverlay = document.createElement('div');
        popupOverlay.className = 'popup-overlay';
        popupOverlay.style.position = 'fixed';
        popupOverlay.style.top = '0';
        popupOverlay.style.left = '0';
        popupOverlay.style.width = '100%';
        popupOverlay.style.height = '100%';
        popupOverlay.style.backgroundColor = 'rgba(0, 0, 0, 0.5)';
        popupOverlay.style.display = 'flex';
        popupOverlay.style.justifyContent = 'center';
        popupOverlay.style.alignItems = 'center';
        popupOverlay.style.zIndex = '2000';
        popupOverlay.style.transition = 'background-color 0.3s ease';

        if (document.body.classList.contains('light-mode')) {
            popupOverlay.style.backgroundColor = 'rgba(0, 0, 0, 0.3)';
        }

        // 创建弹窗容器
        const popupContainer = document.createElement('div');
        popupContainer.className = 'popup-container';
        popupContainer.style.backgroundColor = document.body.classList.contains('light-mode') ? '#f0f0f0' : '#2d2d30';
        popupContainer.style.border = `1px solid ${document.body.classList.contains('light-mode') ? '#ccc' : '#3e3e42'}`;
        popupContainer.style.borderRadius = '4px';
        popupContainer.style.boxShadow = document.body.classList.contains('light-mode') ? '0 4px 8px rgba(0, 0, 0, 0.1)' : '0 4px 8px rgba(0, 0, 0, 0.3)';
        popupContainer.style.width = '500px';
        popupContainer.style.maxWidth = '90%';
        popupContainer.style.maxHeight = '80%';
        popupContainer.style.display = 'flex';
        popupContainer.style.flexDirection = 'column';
        popupContainer.style.overflow = 'hidden';

        // 创建标题部分
        const popupTitle = document.createElement('div');
        popupTitle.className = 'popup-title';
        popupTitle.style.padding = '12px 16px';
        popupTitle.style.borderBottom = `1px solid ${document.body.classList.contains('light-mode') ? '#ccc' : '#3e3e42'}`;
        popupTitle.style.fontWeight = 'bold';
        popupTitle.style.fontSize = '14px';
        popupTitle.style.color = document.body.classList.contains('light-mode') ? '#333' : '#e0e0e0';
        popupTitle.textContent = title;

        // 创建内容部分
        const popupContent = document.createElement('div');
        popupContent.className = 'popup-content';
        popupContent.style.padding = '16px';
        popupContent.style.color = document.body.classList.contains('light-mode') ? '#333' : '#e0e0e0';
        popupContent.style.fontSize = '13px';
        popupContent.style.flex = '1';
        popupContent.style.overflowY = 'auto';
        popupContent.style.display = 'flex';
        popupContent.style.flexDirection = 'column';
        popupContent.style.gap = '12px';

        // 存储输入框引用
        const inputFields = {};

        // 为每个参数创建输入行
        Object.keys(parameters).forEach(key => {
            const paramRow = document.createElement('div');
            paramRow.style.display = 'flex';
            paramRow.style.alignItems = 'center';
            paramRow.style.gap = '12px';
            paramRow.style.padding = '8px 0';
            paramRow.style.borderBottom = `1px solid ${document.body.classList.contains('light-mode') ? '#e0e0e0' : '#3e3e42'}`;

            // 键名标签
            const keyLabel = document.createElement('label');
            keyLabel.textContent = key + ':';
            keyLabel.style.minWidth = '120px';
            keyLabel.style.fontSize = '13px';
            keyLabel.style.color = document.body.classList.contains('light-mode') ? '#333' : '#e0e0e0';

            // 输入框
            const input = document.createElement('input');
            const originalValue = parameters[key];
            const valueType = typeof originalValue;
            
            // 初始化输出参数
            outParameters[key] = originalValue;

            // 根据类型设置输入框
            if (valueType === 'number') {
                input.type = 'number';
                input.value = originalValue;
                input.step = Number.isInteger(originalValue) ? '1' : '0.1';
                
                // 输入验证：只允许数字
                input.addEventListener('input', (e) => {
                    const value = e.target.value;
                    if (value === '' || value === '-') {
                        return; // 允许空值或负号（输入中）
                    }
                    const numValue = Number(value);
                    if (!isNaN(numValue)) {
                        outParameters[key] = Number.isInteger(originalValue) ? Math.floor(numValue) : numValue;
                    }
                });
            } else if (valueType === 'boolean') {
                input.type = 'checkbox';
                input.checked = originalValue;
                input.addEventListener('change', (e) => {
                    outParameters[key] = e.target.checked;
                });
            } else {
                input.type = 'text';
                input.value = String(originalValue);
                input.addEventListener('input', (e) => {
                    outParameters[key] = e.target.value;
                });
            }

            input.style.flex = '1';
            input.style.padding = '6px 8px';
            input.style.border = `1px solid ${document.body.classList.contains('light-mode') ? '#ccc' : '#464647'}`;
            input.style.borderRadius = '3px';
            input.style.backgroundColor = document.body.classList.contains('light-mode') ? '#fff' : '#1e1e1e';
            input.style.color = document.body.classList.contains('light-mode') ? '#333' : '#e0e0e0';
            input.style.fontSize = '13px';

            inputFields[key] = input;
            paramRow.appendChild(keyLabel);
            paramRow.appendChild(input);
            popupContent.appendChild(paramRow);
        });

        // 创建按钮部分
        const popupButtons = document.createElement('div');
        popupButtons.className = 'popup-buttons';
        popupButtons.style.padding = '12px 16px';
        popupButtons.style.borderTop = `1px solid ${document.body.classList.contains('light-mode') ? '#ccc' : '#3e3e42'}`;
        popupButtons.style.display = 'flex';
        popupButtons.style.justifyContent = 'flex-end';
        popupButtons.style.gap = '8px';

        // 创建左侧按钮（确定）
        const leftButton = document.createElement('button');
        leftButton.className = 'popup-btn popup-btn-left';
        leftButton.style.padding = '6px 12px';
        leftButton.style.border = 'none';
        leftButton.style.borderRadius = '3px';
        leftButton.style.fontSize = '13px';
        leftButton.style.cursor = 'pointer';
        leftButton.style.backgroundColor = document.body.classList.contains('light-mode') ? '#0066cc' : '#0e639c';
        leftButton.style.color = 'white';
        leftButton.style.transition = 'background-color 0.2s';
        leftButton.textContent = btnLeft;

        leftButton.addEventListener('mouseover', () => {
            leftButton.style.backgroundColor = document.body.classList.contains('light-mode') ? '#0052aa' : '#1177bb';
        });

        leftButton.addEventListener('mouseout', () => {
            leftButton.style.backgroundColor = document.body.classList.contains('light-mode') ? '#0066cc' : '#0e639c';
        });

        // 创建右侧按钮（取消）
        const rightButton = document.createElement('button');
        rightButton.className = 'popup-btn popup-btn-right';
        rightButton.style.padding = '6px 12px';
        rightButton.style.border = `1px solid ${document.body.classList.contains('light-mode') ? '#ccc' : '#464647'}`;
        rightButton.style.borderRadius = '3px';
        rightButton.style.fontSize = '13px';
        rightButton.style.cursor = 'pointer';
        rightButton.style.backgroundColor = document.body.classList.contains('light-mode') ? '#f0f0f0' : '#2d2d30';
        rightButton.style.color = document.body.classList.contains('light-mode') ? '#333' : '#e0e0e0';
        rightButton.style.transition = 'background-color 0.2s';
        rightButton.textContent = btnRight;

        rightButton.addEventListener('mouseover', () => {
            rightButton.style.backgroundColor = document.body.classList.contains('light-mode') ? '#e0e0e0' : '#37373d';
        });

        rightButton.addEventListener('mouseout', () => {
            rightButton.style.backgroundColor = document.body.classList.contains('light-mode') ? '#f0f0f0' : '#2d2d30';
        });

        // 按钮点击事件处理
        const handleClose = (result) => {
            popupOverlay.style.opacity = '0';
            popupContainer.style.transform = 'translateY(20px)';
            popupContainer.style.opacity = '0';

            setTimeout(() => {
                document.body.removeChild(popupOverlay);
                resolve(result);
            }, 300);
        };

        leftButton.addEventListener('click', () => handleClose(true));
        rightButton.addEventListener('click', () => handleClose(false));

        // 键盘事件
        const handleKeyDown = (e) => {
            if (e.key === 'Escape') {
                handleClose(false);
            } else if (e.key === 'Enter' && e.target.tagName !== 'INPUT') {
                handleClose(true);
            }
        };

        // 主题切换监听
        const handleThemeChange = () => {
            popupOverlay.style.backgroundColor = document.body.classList.contains('light-mode') ? 'rgba(0, 0, 0, 0.3)' : 'rgba(0, 0, 0, 0.5)';
            popupContainer.style.backgroundColor = document.body.classList.contains('light-mode') ? '#f0f0f0' : '#2d2d30';
            popupContainer.style.border = `1px solid ${document.body.classList.contains('light-mode') ? '#ccc' : '#3e3e42'}`;
            popupTitle.style.borderBottom = `1px solid ${document.body.classList.contains('light-mode') ? '#ccc' : '#3e3e42'}`;
            popupTitle.style.color = document.body.classList.contains('light-mode') ? '#333' : '#e0e0e0';
            popupContent.style.color = document.body.classList.contains('light-mode') ? '#333' : '#e0e0e0';
            popupButtons.style.borderTop = `1px solid ${document.body.classList.contains('light-mode') ? '#ccc' : '#3e3e42'}`;
            leftButton.style.backgroundColor = document.body.classList.contains('light-mode') ? '#0066cc' : '#0e639c';
            rightButton.style.border = `1px solid ${document.body.classList.contains('light-mode') ? '#ccc' : '#464647'}`;
            rightButton.style.backgroundColor = document.body.classList.contains('light-mode') ? '#f0f0f0' : '#2d2d30';
            rightButton.style.color = document.body.classList.contains('light-mode') ? '#333' : '#e0e0e0';
            
            // 更新输入框样式
            Object.values(inputFields).forEach(input => {
                input.style.border = `1px solid ${document.body.classList.contains('light-mode') ? '#ccc' : '#464647'}`;
                input.style.backgroundColor = document.body.classList.contains('light-mode') ? '#fff' : '#1e1e1e';
                input.style.color = document.body.classList.contains('light-mode') ? '#333' : '#e0e0e0';
            });
        };

        // 组装弹窗
        popupButtons.appendChild(leftButton);
        popupButtons.appendChild(rightButton);
        popupContainer.appendChild(popupTitle);
        popupContainer.appendChild(popupContent);
        popupContainer.appendChild(popupButtons);
        popupOverlay.appendChild(popupContainer);
        document.body.appendChild(popupOverlay);

        // 初始动画
        popupOverlay.style.opacity = '0';
        popupContainer.style.transform = 'translateY(-20px)';
        popupContainer.style.opacity = '0';
        popupContainer.style.transition = 'transform 0.3s ease, opacity 0.3s ease';
        popupOverlay.style.transition = 'opacity 0.3s ease';

        setTimeout(() => {
            popupOverlay.style.opacity = '1';
            popupContainer.style.transform = 'translateY(0)';
            popupContainer.style.opacity = '1';
        }, 10);

        // 聚焦到第一个输入框
        const firstInput = Object.values(inputFields)[0];
        if (firstInput) {
            setTimeout(() => firstInput.focus(), 100);
        }

        // 监听主题变化
        const observer = new MutationObserver((mutations) => {
            mutations.forEach(mutation => {
                if (mutation.attributeName === 'class') {
                    handleThemeChange();
                }
            });
        });

        observer.observe(document.body, { attributes: true });
        document.addEventListener('keydown', handleKeyDown);

        // 清理函数
        const cleanup = () => {
            observer.disconnect();
            document.removeEventListener('keydown', handleKeyDown);
        };

        leftButton.addEventListener('click', cleanup);
        rightButton.addEventListener('click', cleanup);
    });
};

/**
 * 进度条弹窗
 * @param {string} title - 弹窗标题
 * @param {string} content - 弹窗内容
 * @param {string} btnCancel - 取消按钮文本
 * @param {Function} taskFunction - 任务函数，接收一个进度更新函数作为参数，返回 Promise<boolean>
 * @returns {Promise<boolean>} - 任务完成返回true，取消或失败返回false
 */
export const PopUp_Window_Progress = (title, content, btnCancel, taskFunction) => {
    return new Promise((resolve) => {
        let isCancelled = false;
        let progress = 0;

        // 创建弹窗背景
        const popupOverlay = document.createElement('div');
        popupOverlay.className = 'popup-overlay';
        popupOverlay.style.position = 'fixed';
        popupOverlay.style.top = '0';
        popupOverlay.style.left = '0';
        popupOverlay.style.width = '100%';
        popupOverlay.style.height = '100%';
        popupOverlay.style.backgroundColor = 'rgba(0, 0, 0, 0.5)';
        popupOverlay.style.display = 'flex';
        popupOverlay.style.justifyContent = 'center';
        popupOverlay.style.alignItems = 'center';
        popupOverlay.style.zIndex = '2000';
        popupOverlay.style.transition = 'background-color 0.3s ease';

        if (document.body.classList.contains('light-mode')) {
            popupOverlay.style.backgroundColor = 'rgba(0, 0, 0, 0.3)';
        }

        // 创建弹窗容器
        const popupContainer = document.createElement('div');
        popupContainer.className = 'popup-container';
        popupContainer.style.backgroundColor = document.body.classList.contains('light-mode') ? '#f0f0f0' : '#2d2d30';
        popupContainer.style.border = `1px solid ${document.body.classList.contains('light-mode') ? '#ccc' : '#3e3e42'}`;
        popupContainer.style.borderRadius = '4px';
        popupContainer.style.boxShadow = document.body.classList.contains('light-mode') ? '0 4px 8px rgba(0, 0, 0, 0.1)' : '0 4px 8px rgba(0, 0, 0, 0.3)';
        popupContainer.style.width = '400px';
        popupContainer.style.maxWidth = '90%';
        popupContainer.style.maxHeight = '80%';
        popupContainer.style.display = 'flex';
        popupContainer.style.flexDirection = 'column';
        popupContainer.style.overflow = 'hidden';

        // 创建标题部分
        const popupTitle = document.createElement('div');
        popupTitle.className = 'popup-title';
        popupTitle.style.padding = '12px 16px';
        popupTitle.style.borderBottom = `1px solid ${document.body.classList.contains('light-mode') ? '#ccc' : '#3e3e42'}`;
        popupTitle.style.fontWeight = 'bold';
        popupTitle.style.fontSize = '14px';
        popupTitle.style.color = document.body.classList.contains('light-mode') ? '#333' : '#e0e0e0';
        popupTitle.textContent = title;

        // 创建内容部分
        const popupContent = document.createElement('div');
        popupContent.className = 'popup-content';
        popupContent.style.padding = '16px';
        popupContent.style.color = document.body.classList.contains('light-mode') ? '#333' : '#e0e0e0';
        popupContent.style.fontSize = '13px';
        popupContent.style.lineHeight = '1.5';
        popupContent.style.flex = '1';
        popupContent.style.overflowY = 'auto';
        popupContent.style.display = 'flex';
        popupContent.style.flexDirection = 'column';
        popupContent.style.gap = '16px';

        // 文本内容
        const contentText = document.createElement('div');
        contentText.textContent = content;
        popupContent.appendChild(contentText);

        // 创建进度条容器
        const progressContainer = document.createElement('div');
        progressContainer.style.width = '100%';
        progressContainer.style.height = '20px';
        progressContainer.style.backgroundColor = document.body.classList.contains('light-mode') ? '#e0e0e0' : '#3e3e42';
        progressContainer.style.borderRadius = '10px';
        progressContainer.style.overflow = 'hidden';
        progressContainer.style.position = 'relative';

        // 创建进度条填充
        const progressBar = document.createElement('div');
        progressBar.style.width = '0%';
        progressBar.style.height = '100%';
        progressBar.style.backgroundColor = document.body.classList.contains('light-mode') ? '#0066cc' : '#0e639c';
        progressBar.style.transition = 'width 0.3s ease';
        progressBar.style.borderRadius = '10px';

        // 创建进度文本
        const progressText = document.createElement('div');
        progressText.style.position = 'absolute';
        progressText.style.top = '50%';
        progressText.style.left = '50%';
        progressText.style.transform = 'translate(-50%, -50%)';
        progressText.style.fontSize = '11px';
        progressText.style.color = document.body.classList.contains('light-mode') ? '#333' : '#e0e0e0';
        progressText.style.pointerEvents = 'none';
        progressText.textContent = '0%';

        progressContainer.appendChild(progressBar);
        progressContainer.appendChild(progressText);
        popupContent.appendChild(progressContainer);

        // 更新进度的函数
        const updateProgress = (value) => {
            if (isCancelled) return;
            progress = Math.max(0, Math.min(1, value));
            const percent = Math.round(progress * 100);
            progressBar.style.width = percent + '%';
            progressText.textContent = percent + '%';
        };

        // 创建按钮部分（只有取消按钮）
        const popupButtons = document.createElement('div');
        popupButtons.className = 'popup-buttons';
        popupButtons.style.padding = '12px 16px';
        popupButtons.style.borderTop = `1px solid ${document.body.classList.contains('light-mode') ? '#ccc' : '#3e3e42'}`;
        popupButtons.style.display = 'flex';
        popupButtons.style.justifyContent = 'flex-end';
        popupButtons.style.gap = '8px';

        // 创建取消按钮
        const cancelButton = document.createElement('button');
        cancelButton.className = 'popup-btn popup-btn-cancel';
        cancelButton.style.padding = '6px 12px';
        cancelButton.style.border = `1px solid ${document.body.classList.contains('light-mode') ? '#ccc' : '#464647'}`;
        cancelButton.style.borderRadius = '3px';
        cancelButton.style.fontSize = '13px';
        cancelButton.style.cursor = 'pointer';
        cancelButton.style.backgroundColor = document.body.classList.contains('light-mode') ? '#f0f0f0' : '#2d2d30';
        cancelButton.style.color = document.body.classList.contains('light-mode') ? '#333' : '#e0e0e0';
        cancelButton.style.transition = 'background-color 0.2s';
        cancelButton.textContent = btnCancel;

        cancelButton.addEventListener('mouseover', () => {
            cancelButton.style.backgroundColor = document.body.classList.contains('light-mode') ? '#e0e0e0' : '#37373d';
        });

        cancelButton.addEventListener('mouseout', () => {
            cancelButton.style.backgroundColor = document.body.classList.contains('light-mode') ? '#f0f0f0' : '#2d2d30';
        });

        // 关闭弹窗函数
        const handleClose = (result) => {
            isCancelled = true;
            popupOverlay.style.opacity = '0';
            popupContainer.style.transform = 'translateY(20px)';
            popupContainer.style.opacity = '0';

            setTimeout(() => {
                if (popupOverlay.parentNode) {
                    document.body.removeChild(popupOverlay);
                }
                resolve(result);
            }, 300);
        };

        cancelButton.addEventListener('click', () => handleClose(false));

        // 键盘事件
        const handleKeyDown = (e) => {
            if (e.key === 'Escape') {
                handleClose(false);
            }
        };

        // 主题切换监听
        const handleThemeChange = () => {
            popupOverlay.style.backgroundColor = document.body.classList.contains('light-mode') ? 'rgba(0, 0, 0, 0.3)' : 'rgba(0, 0, 0, 0.5)';
            popupContainer.style.backgroundColor = document.body.classList.contains('light-mode') ? '#f0f0f0' : '#2d2d30';
            popupContainer.style.border = `1px solid ${document.body.classList.contains('light-mode') ? '#ccc' : '#3e3e42'}`;
            popupTitle.style.borderBottom = `1px solid ${document.body.classList.contains('light-mode') ? '#ccc' : '#3e3e42'}`;
            popupTitle.style.color = document.body.classList.contains('light-mode') ? '#333' : '#e0e0e0';
            popupContent.style.color = document.body.classList.contains('light-mode') ? '#333' : '#e0e0e0';
            popupButtons.style.borderTop = `1px solid ${document.body.classList.contains('light-mode') ? '#ccc' : '#3e3e42'}`;
            cancelButton.style.border = `1px solid ${document.body.classList.contains('light-mode') ? '#ccc' : '#464647'}`;
            cancelButton.style.backgroundColor = document.body.classList.contains('light-mode') ? '#f0f0f0' : '#2d2d30';
            cancelButton.style.color = document.body.classList.contains('light-mode') ? '#333' : '#e0e0e0';
            progressContainer.style.backgroundColor = document.body.classList.contains('light-mode') ? '#e0e0e0' : '#3e3e42';
            progressBar.style.backgroundColor = document.body.classList.contains('light-mode') ? '#0066cc' : '#0e639c';
            progressText.style.color = document.body.classList.contains('light-mode') ? '#333' : '#e0e0e0';
        };

        // 组装弹窗
        popupButtons.appendChild(cancelButton);
        popupContainer.appendChild(popupTitle);
        popupContainer.appendChild(popupContent);
        popupContainer.appendChild(popupButtons);
        popupOverlay.appendChild(popupContainer);
        document.body.appendChild(popupOverlay);

        // 初始动画
        popupOverlay.style.opacity = '0';
        popupContainer.style.transform = 'translateY(-20px)';
        popupContainer.style.opacity = '0';
        popupContainer.style.transition = 'transform 0.3s ease, opacity 0.3s ease';
        popupOverlay.style.transition = 'opacity 0.3s ease';

        setTimeout(() => {
            popupOverlay.style.opacity = '1';
            popupContainer.style.transform = 'translateY(0)';
            popupContainer.style.opacity = '1';
        }, 10);

        // 监听主题变化
        const observer = new MutationObserver((mutations) => {
            mutations.forEach(mutation => {
                if (mutation.attributeName === 'class') {
                    handleThemeChange();
                }
            });
        });

        observer.observe(document.body, { attributes: true });
        document.addEventListener('keydown', handleKeyDown);

        // 清理函数
        const cleanup = () => {
            observer.disconnect();
            document.removeEventListener('keydown', handleKeyDown);
        };

        cancelButton.addEventListener('click', cleanup);

        // 执行任务函数
        if (taskFunction && typeof taskFunction === 'function') {
            Promise.resolve(taskFunction(updateProgress))
                .then((result) => {
                    if (!isCancelled) {
                        handleClose(result === true);
                    }
                })
                .catch((error) => {
                    console.error('任务执行错误:', error);
                    if (!isCancelled) {
                        handleClose(false);
                    }
                });
        } else {
            // 如果没有任务函数，直接关闭
            handleClose(false);
        }
    });
};