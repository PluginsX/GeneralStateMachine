// 通用工具函数
export const generateId = () => crypto.randomUUID();

// 深拷贝函数
export function deepClone(obj, hash = new WeakMap()) {
    // 处理null或非对象类型
    if (obj === null || typeof obj !== 'object') {
        return obj;
    }
    
    // 处理循环引用
    if (hash.has(obj)) {
        return hash.get(obj);
    }
    
    let clone;
    
    // 处理日期
    if (obj instanceof Date) {
        clone = new Date();
        clone.setTime(obj.getTime());
        hash.set(obj, clone);
        return clone;
    }
    
    // 处理数组
    if (obj instanceof Array) {
        clone = [];
        hash.set(obj, clone);
        for (let i = 0; i < obj.length; i++) {
            clone[i] = deepClone(obj[i], hash);
        }
        return clone;
    }
    
    // 处理对象
    if (obj instanceof Object) {
        clone = {};
        hash.set(obj, clone);
        // 只克隆自身可枚举属性
        for (const key in obj) {
            if (obj.hasOwnProperty(key)) {
                // 跳过循环引用的属性（例如连接中的节点引用）
                // 这里可以根据实际情况添加过滤条件
                if (key === 'sourceNode' || key === 'targetNode') {
                    // 对于节点引用，只复制ID而不是整个对象
                    clone[key + 'Id'] = obj[key].id;
                } else {
                    clone[key] = deepClone(obj[key], hash);
                }
            }
        }
        return clone;
    }
    
    return obj;
}