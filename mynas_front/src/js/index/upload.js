import { config } from '../config.js';
import { uploadFile } from '../utils/api.js';

export class ImageUploader {
    constructor() {
        this.apiBaseUrl = config.apiBaseUrl;
        this.uploadQueue = [];
        this.isUploading = false;
        this.progressItems = new Map();
        this.totalProgress = 0;
        this.init();
    }

    init() {
        this.uploadBtn = document.getElementById('upload-btn');
        this.fileInput = document.getElementById('image-upload');
        this.uploadBox = document.querySelector('.upload-box');
        this.progressBar = document.querySelector('.upload-progress');
        this.progressList = document.querySelector('.progress-list');
        
        // 绑定上传按钮点击事件
        this.uploadBtn.addEventListener('click', () => this.handleUpload());
        
        // 绑定文件选择事件
        this.fileInput.addEventListener('change', () => {
            if (this.fileInput.files.length > 0) {
                this.uploadBtn.textContent = `上传 ${this.fileInput.files.length} 个文件`;
            } else {
                this.uploadBtn.textContent = '开始上传';
            }
        });
        
        // 绑定拖放事件
        this.uploadBox.addEventListener('dragover', (e) => {
            e.preventDefault();
            this.uploadBox.classList.add('dragover');
        });
        
        this.uploadBox.addEventListener('dragleave', () => {
            this.uploadBox.classList.remove('dragover');
        });
        
        this.uploadBox.addEventListener('drop', (e) => {
            e.preventDefault();
            this.uploadBox.classList.remove('dragover');
            this.fileInput.files = e.dataTransfer.files;
            if (this.fileInput.files.length > 0) {
                this.uploadBtn.textContent = `上传 ${this.fileInput.files.length} 个文件`;
            }
        });

        // 添加进度条展开/收起功能
        this.progressBar.addEventListener('click', (e) => {
            if (e.target === this.progressBar) {
                this.progressList.classList.toggle('collapsed');
            }
        });
    }

    createProgressItem(fileName) {
        const progressItem = document.createElement('div');
        progressItem.className = 'progress-item';
        progressItem.innerHTML = `
            <div class="progress-info">
                <span class="progress-text">${fileName}</span>
                <span class="progress-percentage">0%</span>
            </div>
            <div class="progress-bar">
                <div class="progress-bar-inner"></div>
            </div>
        `;
        return progressItem;
    }

    async handleUpload() {
        const files = this.fileInput.files;
        if (!files.length) {
            alert('请选择要上传的图片');
            return;
        }

        // 如果正在上传，直接返回
        if (this.isUploading) {
            return;
        }

        // 禁用上传按钮和文件选择
        this.uploadBtn.disabled = true;
        this.fileInput.disabled = true;
        this.uploadBox.style.pointerEvents = 'none';
        this.uploadBox.style.opacity = '0.6';

        // 清空进度列表
        this.progressList.innerHTML = '';
        this.progressItems.clear();
        this.totalProgress = 0;

        // 将文件添加到队列并创建进度条
        for (const file of files) {
            if (!file.type.startsWith('image/')) {
                alert(`文件 ${file.name} 不是图片格式`);
                continue;
            }
            this.uploadQueue.push(file);
            const progressItem = this.createProgressItem(file.name);
            this.progressList.appendChild(progressItem);
            this.progressItems.set(file.name, progressItem);
        }

        // 显示进度条区域
        this.progressBar.style.display = 'block';
        this.progressList.classList.remove('collapsed');

        // 开始处理队列
        if (!this.isUploading) {
            this.processQueue();
        }
    }

    async processQueue() {
        if (this.uploadQueue.length === 0) {
            this.isUploading = false;
            this.progressBar.style.display = 'none';
            this.fileInput.value = '';
            this.uploadBtn.textContent = '开始上传';
            this.uploadBtn.style.background = '#2196f3';
            
            // 重新启用上传按钮和文件选择
            this.uploadBtn.disabled = false;
            this.fileInput.disabled = false;
            this.uploadBox.style.pointerEvents = 'auto';
            this.uploadBox.style.opacity = '1';
            return;
        }

        this.isUploading = true;
        const file = this.uploadQueue[0];
        
        try {
            // 检查文件是否已存在
            if (await this.isFileExists(file.name)) {
                console.log(`文件 ${file.name} 已存在，跳过上传`);
                const progressItem = this.progressItems.get(file.name);
                if (progressItem) {
                    progressItem.classList.add('completed');
                    progressItem.querySelector('.progress-bar-inner').style.width = '100%';
                    progressItem.querySelector('.progress-percentage').textContent = '100%';
                }
                this.uploadQueue.shift();
                this.processQueue();
                return;
            }

            // 上传文件
            const result = await this.uploadFile(file);
            
            // 添加新图片到画廊
            window.app.gallery.addImage(result.file);
            
            // 从队列中移除已上传的文件
            this.uploadQueue.shift();
            
            // 处理下一个文件
            this.processQueue();
        } catch (error) {
            console.error('上传失败:', error);
            const progressItem = this.progressItems.get(file.name);
            if (progressItem) {
                progressItem.classList.add('error');
            }
            this.uploadQueue.shift();
            this.processQueue();
        }
    }

    async isFileExists(filename) {
        try {
            const response = await fetchWithAuth(`/images/check/${encodeURIComponent(filename)}`);
            return response.exists;
        } catch (error) {
            console.error('检查文件存在失败:', error);
            return false;
        }
    }

    async uploadFile(file) {
        try {
            const result = await uploadFile('/images/upload', file, (percentComplete) => {
                this.updateProgress(file.name, percentComplete);
            });
            
            const progressItem = this.progressItems.get(file.name);
            if (progressItem) {
                progressItem.classList.add('completed');
            }
            return result;
        } catch (error) {
            const progressItem = this.progressItems.get(file.name);
            if (progressItem) {
                progressItem.classList.add('error');
            }
            throw error;
        }
    }

    updateProgress(fileName, percent) {
        const progressItem = this.progressItems.get(fileName);
        if (progressItem) {
            progressItem.querySelector('.progress-percentage').textContent = `${percent}%`;
            progressItem.querySelector('.progress-bar-inner').style.width = `${percent}%`;
        }

        // 更新总进度
        const totalFiles = this.uploadQueue.length + this.progressItems.size;
        const completedFiles = Array.from(this.progressItems.values())
            .filter(item => item.classList.contains('completed')).length;
        this.totalProgress = Math.round(((completedFiles * 100 + percent) / totalFiles));
        
        // 更新按钮文字和样式
        this.uploadBtn.textContent = `上传中 ${this.totalProgress}%`;
        this.uploadBtn.style.background = `linear-gradient(to right, #2196f3 ${this.totalProgress}%, #e0e0e0 ${this.totalProgress}%)`;
    }
} 