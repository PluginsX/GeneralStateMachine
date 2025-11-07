// 数学相关工具函数
export const isPointInRect = (x, y, rect) => {
    return x >= rect.x && x <= rect.x + rect.width && 
           y >= rect.y && y <= rect.y + rect.height;
};

export const doRectsOverlap = (rect1, rect2) => {
    return rect1.x < rect2.x + rect2.width &&
           rect1.x + rect1.width > rect2.x &&
           rect1.y < rect2.y + rect2.height &&
           rect1.y + rect1.height > rect2.y;
};

export const isPointNearLine = (px, py, x1, y1, x2, y2, tolerance) => {
    // 线段长度的平方
    const len2 = (x2 - x1) **2 + (y2 - y1)** 2;
    if (len2 === 0) return false; // 线段长度为0
    
    // 计算投影比例
    let t = ((px - x1) * (x2 - x1) + (py - y1) * (y2 - y1)) / len2;
    t = Math.max(0, Math.min(1, t)); // 限制在[0,1]范围内
    
    // 计算投影点
    const projX = x1 + t * (x2 - x1);
    const projY = y1 + t * (y2 - y1);
    
    // 计算点到投影点的距离
    const dx = px - projX;
    const dy = py - projY;
    const dist2 = dx * dx + dy * dy;
    
    return dist2 <= tolerance * tolerance;
};