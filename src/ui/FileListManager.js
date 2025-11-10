import '../ui/theme.js'; // 导入主题相关功能
import { importJSON, importYAML, importMarkdown } from '../io/import.js'; // 导入文件导入相关功能

// 文件列表管理器
class FileListManager {
    constructor() {
        this.projectFilesList = document.getElementById('project-files-list');
        this.importFilesList = document.getElementById('import-files-list');
        // 更新路径为 sample/Project 和 sample/Import
        this.projectsDir = '../sample/Project/';
        this.importsDir = '../sample/Import/';
    }

    /**
     * 初始化文件列表
     */
    async init() {
        await this.loadProjectFiles();
        await this.loadImportFiles();
    }

    /**
     * 从目录获取文件列表
     * @param {string} dirPath - 目录路径
     * @returns {Promise<Array<string>>} 文件列表
     */
    async fetchFileList(dirPath) {
        try {
            // 尝试获取目录列表（Python http.server 会返回 HTML 目录列表）
            const response = await fetch(dirPath);
            if (!response.ok) {
                throw new Error(`无法访问目录: ${dirPath}`);
            }
            
            const html = await response.text();
            
            // 解析 HTML 目录列表，提取文件名
            const parser = new DOMParser();
            const doc = parser.parseFromString(html, 'text/html');
            const links = doc.querySelectorAll('a');
            
            const files = [];
            links.forEach(link => {
                const href = link.getAttribute('href');
                if (href && href !== '../' && !href.endsWith('/')) {
                    try {
                        // 尝试解码 URL 编码的文件名
                        let fileName = href;
                        // 如果包含 % 编码，进行解码
                        if (href.includes('%')) {
                            fileName = decodeURIComponent(href);
                        }
                        // 过滤掉父目录链接和其他非文件项
                        if (fileName && fileName !== '..' && !fileName.endsWith('/')) {
                            files.push(fileName);
                        }
                    } catch (e) {
                        // 如果解码失败，使用原始 href
                        if (href && href !== '../' && !href.endsWith('/')) {
                            files.push(href);
                        }
                    }
                }
            });
            
            // 去重并排序
            return [...new Set(files)].sort();
        } catch (error) {
            console.error('获取文件列表失败:', error);
            return [];
        }
    }

    /**
     * 加载演示项目文件列表
     */
    async loadProjectFiles() {
        if (!this.projectFilesList) return;

        try {
            // 从目录动态读取文件列表
            const files = await this.fetchFileList(this.projectsDir);
            
            if (files.length === 0) {
                this.projectFilesList.innerHTML = '<div style="padding: 10px; color: #969696; text-align: center;">暂无项目文件</div>';
                return;
            }

            // 渲染文件列表
            this.renderFileList(this.projectFilesList, files, 'project');
        } catch (error) {
            console.error('加载项目文件列表失败:', error);
            this.projectFilesList.innerHTML = '<div style="padding: 10px; color: #f44336; text-align: center;">无法加载项目文件</div>';
        }
    }

    /**
     * 加载演示导入文件列表
     */
    async loadImportFiles() {
        if (!this.importFilesList) return;

        try {
            // 从目录动态读取文件列表
            const files = await this.fetchFileList(this.importsDir);
            
            if (files.length === 0) {
                this.importFilesList.innerHTML = '<div style="padding: 10px; color: #969696; text-align: center;">暂无导入文件</div>';
                return;
            }

            // 渲染文件列表
            this.renderFileList(this.importFilesList, files, 'import');
        } catch (error) {
            console.error('加载导入文件列表失败:', error);
            this.importFilesList.innerHTML = '<div style="padding: 10px; color: #f44336; text-align: center;">无法加载导入文件</div>';
        }
    }

    /**
     * 渲染文件列表
     * @param {HTMLElement} container 容器元素
     * @param {Array} files 文件列表
     * @param {string} type 文件类型 ('project' 或 'import')
     */
    renderFileList(container, files, type) {
        if (!container) return;

        container.innerHTML = '';

        if (files.length === 0) {
            container.innerHTML = '<div style="padding: 10px; color: #969696; text-align: center;">暂无文件</div>';
            return;
        }

        files.forEach(fileName => {
            const fileExtension = fileName.split('.').pop().toLowerCase();
            const fileItem = this.createFileItemElement(fileName, fileExtension, type);
            container.appendChild(fileItem);
        });
    }

    /**
     * 创建文件项元素
     * @param {string} fileName 文件名
     * @param {string} fileExtension 文件扩展名
     * @param {string} type 文件类型 ('project' 或 'import')
     * @returns {HTMLElement} 文件项元素
     */
    createFileItemElement(fileName, fileExtension, type) {
        const fileItem = document.createElement('div');
        fileItem.className = 'file-item';
        
        // 设置文件图标
        let fileIcon = '📄'; // 默认图标
        if (fileExtension === 'json') {
            fileIcon = '🔄';
        } else if (fileExtension === 'md') {
            fileIcon = '📝';
        } else if (fileExtension === 'yaml' || fileExtension === 'yml') {
            fileIcon = '📊';
        }

        // 构建文件项内容
        fileItem.innerHTML = `
            <span class="file-icon">${fileIcon}</span>
            <span class="file-name">${fileName}</span>
            <span class="file-type">.${fileExtension}</span>
        `;

        // 添加点击事件
        fileItem.addEventListener('click', () => {
            this.handleFileClick(fileName, type);
        });

        return fileItem;
    }

    /**
     * 处理文件点击事件
     * @param {string} fileName - 文件名
     * @param {string} fileType - 文件类型 ('project' 或 'import')
     */
    async handleFileClick(fileName, fileType) {
        console.log(`点击了${fileType}文件:`, fileName);
        
        try {
            if (fileType === 'project') {
                // 实现打开项目文件的逻辑
                await this.openProjectFile(fileName);
            } else if (fileType === 'import') {
                // 根据文件扩展名实现对应的导入功能
                const extension = fileName.split('.').pop().toLowerCase();
                await this.importFile(fileName, extension);
            }
            
            // 关闭欢迎页面
            if (window.welcomeScreen) {
                window.welcomeScreen.hide();
            }
        } catch (error) {
            console.error('处理文件时发生错误:', error);
            // 这里可以添加错误提示
        }
    }
    
    /**
     * 打开项目文件
     * @param {string} fileName - 文件名
     */
    async openProjectFile(fileName) {
        try {
            // 获取编辑器实例
            const editor = window.editor;
            if (!editor) {
                throw new Error('编辑器实例未找到');
            }
            
            // 对文件名进行 URL 编码，确保中文文件名能正确访问
            const encodedFileName = encodeURIComponent(fileName);
            // 从服务器获取文件内容
            const response = await fetch(this.projectsDir + encodedFileName);
            if (!response.ok) {
                throw new Error(`无法获取项目文件: ${fileName}`);
            }
            
            const content = await response.text();
            
            // 导入JSON数据作为项目
            await importJSON(content, editor);
            
            console.log(`成功打开项目: ${fileName}`);
        } catch (error) {
            console.error('打开项目文件失败:', error);
            throw error;
        }
    }
    
    /**
     * 导入文件
     * @param {string} fileName - 文件名
     * @param {string} extension - 文件扩展名
     */
    async importFile(fileName, extension) {
        try {
            // 获取编辑器实例
            const editor = window.editor;
            if (!editor) {
                throw new Error('编辑器实例未找到');
            }
            
            // 对文件名进行 URL 编码，确保中文文件名能正确访问
            const encodedFileName = encodeURIComponent(fileName);
            // 从服务器获取文件内容
            const response = await fetch(this.importsDir + encodedFileName);
            if (!response.ok) {
                throw new Error(`无法获取导入文件: ${fileName}`);
            }
            
            const content = await response.text();
            
            // 根据文件扩展名调用不同的导入函数
            switch (extension) {
                case 'json':
                    await importJSON(content, editor);
                    break;
                case 'yaml':
                case 'yml':
                    await importYAML(content, editor);
                    break;
                case 'md':
                case 'markdown':
                    await importMarkdown(content, editor);
                    break;
                default:
                    throw new Error(`不支持的文件格式: ${extension}`);
            }
            
            console.log(`成功导入文件: ${fileName}`);
        } catch (error) {
            console.error('导入文件失败:', error);
            throw error;
        }
    }
}

export default FileListManager;