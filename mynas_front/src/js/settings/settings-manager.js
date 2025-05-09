export class SettingsManager {
    constructor() {
        this.initializeElements();
        this.loadSettings();
        this.bindEvents();
    }

    initializeElements() {
        // 存储设置相关元素
        this.storagePathInput = document.getElementById('storage-path');
        this.maxStorageInput = document.getElementById('max-storage');
        this.browsePathButton = document.getElementById('browse-path');

        // 上传设置相关元素
        this.maxFileSizeInput = document.getElementById('max-file-size');
        this.allowedTypesInput = document.getElementById('allowed-types');

        // 操作按钮
        this.saveButton = document.getElementById('save-settings');
        this.resetButton = document.getElementById('reset-settings');
    }

    bindEvents() {
        // 绑定保存按钮事件
        this.saveButton.addEventListener('click', () => this.saveSettings());

        // 绑定重置按钮事件
        this.resetButton.addEventListener('click', () => this.resetSettings());

        // 绑定浏览按钮事件
        this.browsePathButton.addEventListener('click', () => this.browseStoragePath());
    }

    async loadSettings() {
        try {
            // 从后端获取设置
            const response = await fetch('/api/settings');
            const settings = await response.json();

            // 更新表单
            this.storagePathInput.value = settings.storagePath || '';
            this.maxStorageInput.value = settings.maxStorage || 100;
            this.maxFileSizeInput.value = settings.maxFileSize || 10;
            this.allowedTypesInput.value = settings.allowedTypes || 'jpg,png,gif';
        } catch (error) {
            console.error('加载设置失败:', error);
            // 使用默认值
            this.resetSettings();
        }
    }

    async saveSettings() {
        try {
            const settings = {
                storagePath: this.storagePathInput.value,
                maxStorage: parseInt(this.maxStorageInput.value),
                maxFileSize: parseInt(this.maxFileSizeInput.value),
                allowedTypes: this.allowedTypesInput.value
            };

            // 发送到后端保存
            const response = await fetch('/api/settings', {
                method: 'POST',
                headers: {
                    'Content-Type': 'application/json'
                },
                body: JSON.stringify(settings)
            });

            if (response.ok) {
                alert('设置保存成功！');
            } else {
                throw new Error('保存失败');
            }
        } catch (error) {
            console.error('保存设置失败:', error);
            alert('保存设置失败，请重试');
        }
    }

    resetSettings() {
        // 重置为默认值
        this.storagePathInput.value = '';
        this.maxStorageInput.value = 100;
        this.maxFileSizeInput.value = 10;
        this.allowedTypesInput.value = 'jpg,png,gif';
    }

    async browseStoragePath() {
        try {
            // 调用系统文件选择器
            const response = await fetch('/api/browse-path', {
                method: 'POST'
            });
            const result = await response.json();
            
            if (result.path) {
                this.storagePathInput.value = result.path;
            }
        } catch (error) {
            console.error('选择路径失败:', error);
            alert('选择路径失败，请重试');
        }
    }
} 