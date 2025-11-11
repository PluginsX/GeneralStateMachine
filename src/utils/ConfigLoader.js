// 配置加载工具 - 用于加载各种配置文件
export default class ConfigLoader {
    /**
     * 加载JSON配置文件
     * @param {string} path - 配置文件路径
     * @returns {Promise<Object|null>} 配置对象或null
     */
    static async loadJSON(path) {
        try {
            const paths = [
                path,
                `./${path}`,
                `/${path}`,
                `../${path}`
            ];
            
            for (const configPath of paths) {
                try {
                    const response = await fetch(configPath);
                    if (response.ok) {
                        const json = await response.json();
                        return json;
                    }
                } catch (e) {
                    continue;
                }
            }
            
            return null;
        } catch (error) {
            console.error(`Failed to load config from ${path}:`, error);
            return null;
        }
    }
    
    /**
     * 从多个路径尝试加载配置
     * @param {string[]} paths - 配置文件路径数组
     * @returns {Promise<Object|null>} 配置对象或null
     */
    static async loadFromPaths(paths) {
        for (const path of paths) {
            const config = await this.loadJSON(path);
            if (config) {
                return config;
            }
        }
        return null;
    }
    
    /**
     * 保存JSON配置到文件（浏览器环境）
     * @param {Object} config - 配置对象
     * @param {string} filename - 文件名
     */
    static saveJSON(config, filename = 'config.json') {
        const json = JSON.stringify(config, null, 2);
        const blob = new Blob([json], { type: 'application/json' });
        const url = URL.createObjectURL(blob);
        const a = document.createElement('a');
        a.href = url;
        a.download = filename;
        document.body.appendChild(a);
        a.click();
        document.body.removeChild(a);
        URL.revokeObjectURL(url);
    }
    
    /**
     * 从文件读取JSON配置（浏览器环境）
     * @returns {Promise<Object|null>} 配置对象或null
     */
    static async readJSONFromFile() {
        return new Promise((resolve) => {
            const input = document.createElement('input');
            input.type = 'file';
            input.accept = '.json';
            input.onchange = async (e) => {
                const file = e.target.files[0];
                if (file) {
                    try {
                        const text = await file.text();
                        const json = JSON.parse(text);
                        resolve(json);
                    } catch (error) {
                        console.error('Failed to parse JSON file:', error);
                        resolve(null);
                    }
                } else {
                    resolve(null);
                }
            };
            input.click();
        });
    }
}

