// 通用工具函数
export const generateId = () => crypto.randomUUID();

export const deepClone = (obj) => {
    if (obj === null || typeof obj !== 'object') return obj;
    
    if (obj instanceof Array) {
        return obj.map(item => deepClone(item));
    }
    
    const clone = {};
    for (const key in obj) {
        if (obj.hasOwnProperty(key)) {
            clone[key] = deepClone(obj[key]);
        }
    }
    return clone;
};