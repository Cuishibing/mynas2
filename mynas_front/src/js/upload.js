export class ImageUploader {
    constructor() {
        this.apiBaseUrl = 'http://10.42.0.172:3000/api'; // API 基础地址
        this.uploadQueue = [];
        this.isUploading = false;
        this.progressItems = new Map();
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

        // 清空进度列表
        this.progressList.innerHTML = '';
        this.progressItems.clear();

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
            const response = await fetch(`${this.apiBaseUrl}/images/check/${encodeURIComponent(filename)}`);
            const data = await response.json();
            return data.exists;
        } catch (error) {
            console.error('检查文件存在失败:', error);
            return false;
        }
    }

    async uploadFile(file) {
        const formData = new FormData();
        formData.append('file', file);

        console.log('上传文件:', {
            fileName: file.name,
            fileType: file.type,
            fileSize: file.size
        });

        const xhr = new XMLHttpRequest();
        
        return new Promise((resolve, reject) => {
            xhr.upload.addEventListener('progress', (e) => {
                if (e.lengthComputable) {
                    const percentComplete = Math.round((e.loaded / e.total) * 100);
                    this.updateProgress(file.name, percentComplete);
                }
            });

            xhr.addEventListener('load', () => {
                if (xhr.status >= 200 && xhr.status < 300) {
                    const progressItem = this.progressItems.get(file.name);
                    if (progressItem) {
                        progressItem.classList.add('completed');
                    }
                    resolve(JSON.parse(xhr.responseText));
                } else {
                    const progressItem = this.progressItems.get(file.name);
                    if (progressItem) {
                        progressItem.classList.add('error');
                    }
                    reject(new Error(xhr.responseText || '上传失败'));
                }
            });

            xhr.addEventListener('error', () => {
                const progressItem = this.progressItems.get(file.name);
                if (progressItem) {
                    progressItem.classList.add('error');
                }
                reject(new Error('网络错误'));
            });

            xhr.open('POST', `${this.apiBaseUrl}/images/upload`);
            xhr.send(formData);
        });
    }

    updateProgress(fileName, percent) {
        const progressItem = this.progressItems.get(fileName);
        if (progressItem) {
            progressItem.querySelector('.progress-percentage').textContent = `${percent}%`;
            progressItem.querySelector('.progress-bar-inner').style.width = `${percent}%`;
        }
    }
} 