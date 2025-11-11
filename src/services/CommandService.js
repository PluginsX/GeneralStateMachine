// 命令服务 - 统一管理所有命令
export default class CommandService {
    constructor() {
        this.commands = new Map();
        this.commandHistory = [];
    }
    
    // 注册命令
    registerCommand(commandId, handler, description = '') {
        if (typeof handler !== 'function') {
            throw new Error(`Command handler for "${commandId}" must be a function`);
        }
        
        this.commands.set(commandId, {
            handler,
            description,
            id: commandId
        });
    }
    
    // 执行命令
    execute(commandId, ...args) {
        const command = this.commands.get(commandId);
        if (!command) {
            console.warn(`Command "${commandId}" not found`);
            return false;
        }
        
        try {
            const result = command.handler(...args);
            this.commandHistory.push({
                commandId,
                args,
                timestamp: Date.now()
            });
            return result;
        } catch (error) {
            console.error(`Error executing command "${commandId}":`, error);
            return false;
        }
    }
    
    // 检查命令是否存在
    hasCommand(commandId) {
        return this.commands.has(commandId);
    }
    
    // 获取命令信息
    getCommand(commandId) {
        return this.commands.get(commandId);
    }
    
    // 获取所有命令
    getAllCommands() {
        return Array.from(this.commands.values());
    }
    
    // 取消注册命令
    unregisterCommand(commandId) {
        return this.commands.delete(commandId);
    }
    
    // 批量注册命令
    registerCommands(commandMap) {
        for (const [commandId, handler] of Object.entries(commandMap)) {
            this.registerCommand(commandId, handler);
        }
    }
}

