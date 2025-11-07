// 主题管理
export const toggleTheme = () => {
    document.body.classList.toggle('light-mode');
};

export const isLightMode = () => {
    return document.body.classList.contains('light-mode');
};