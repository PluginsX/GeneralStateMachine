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