import { config } from '../config.js';
import { fetchWithAuth } from '../utils/api.js';

export class ImageGallery {
    constructor() {
        this.apiBaseUrl = config.apiBaseUrl;
        this.images = [];
        this.container = document.getElementById('image-grid');
        this.page = 1;
        this.pageSize = 20;
        this.total = 0;
        this.hasMore = true;
        this.isLoading = false;
        this.init();
    }

    init() {
        this.loadImages();
        // 添加滚动监听
        window.addEventListener('scroll', this.handleScroll.bind(this));
    }

    async loadImages() {
        if (this.isLoading || !this.hasMore) return;
        
        this.isLoading = true;
        try {
            const data = await this.fetchImages();
            this.images = [...this.images, ...data.images];
            this.total = data.total;
            this.hasMore = data.hasMore;
            this.page = data.page;
            this.displayImages(data.images);
        } catch (error) {
            console.error('加载图片失败:', error);
        } finally {
            this.isLoading = false;
        }
    }

    async fetchImages() {
        try {
            return await fetchWithAuth(`/images?page=${this.page}&pageSize=${this.pageSize}`);
        } catch (error) {
            console.error('获取图片列表失败:', error);
            throw error;
        }
    }

    displayImages(newImages) {
        newImages.forEach(image => {
            const div = document.createElement('div');
            div.className = 'image-item';
            
            const img = document.createElement('img');
            img.src = `${this.apiBaseUrl}${image.thumbnail}`;
            img.alt = image.name;
            img.loading = 'lazy';
            
            let retryCount = 0;
            const maxRetries = 3;
            
            img.onerror = () => {
                if (retryCount < maxRetries) {
                    retryCount++;
                    console.log(`重试加载图片 ${image.name}，第 ${retryCount} 次尝试`);
                    img.src = `${this.apiBaseUrl}${image.thumbnail}`;
                } else {
                    console.error(`图片 ${image.name} 加载失败`);
                    // img.src = 'data:image/svg+xml;base64,PHN2ZyB4bWxucz0iaHR0cDovL3d3dy53My5vcmcvMjAwMC9zdmciIHdpZHRoPSIyMDAiIGhlaWdodD0iMjAwIiB2aWV3Qm94PSIwIDAgMjAwIDIwMCI+PHJlY3Qgd2lkdGg9IjIwMCIgaGVpZ2h0PSIyMDAiIGZpbGw9IiNlZWUiLz48dGV4dCB4PSI1MCUiIHk9IjUwJSIgZm9udC1mYW1pbHk9IkFyaWFsIiBmb250LXNpemU9IjE2IiBmaWxsPSIjOTk5IiB0ZXh0LWFuY2hvcj0ibWlkZGxlIiBkeT0iLjNlbSI+图片加载失败</dGV4dD48L3N2Zz4=';
                }
            };

            // 创建删除按钮
            const deleteBtn = document.createElement('button');
            deleteBtn.className = 'image-delete-btn';
            deleteBtn.innerHTML = '删除';
            deleteBtn.addEventListener('click', async (e) => {
                e.stopPropagation(); // 阻止事件冒泡，避免触发图片预览
                if (confirm('确定要删除这张图片吗？')) {
                    try {
                        const response = await fetchWithAuth('/images/delete', {
                            method: 'POST',
                            headers: {
                                'Content-Type': 'application/json'
                            },
                            body: JSON.stringify({
                                filename: image.name
                            })
                        });
                        
                        if (response.success) {
                            // 从DOM中移除图片元素
                            div.remove();
                            // 从图片数组中移除
                            this.images = this.images.filter(img => img.name !== image.name);
                            this.total--;
                        } else {
                            alert('删除失败');
                        }
                    } catch (error) {
                        console.error('删除图片失败:', error);
                        alert('删除失败');
                    }
                }
            });

            div.appendChild(img);
            div.appendChild(deleteBtn);

            // 添加点击事件（预览图片）
            div.addEventListener('click', () => this.showFullImage(image));
            
            this.container.appendChild(div);
        });
    }

    showFullImage(image) {
        // 禁止页面滚动
        document.body.style.overflow = 'hidden';
        
        // 创建遮罩层
        const overlay = document.createElement('div');
        overlay.className = 'image-overlay show';
        
        // 创建图片容器
        const container = document.createElement('div');
        container.className = 'full-image-container';
        
        // 创建加载指示器
        const loading = document.createElement('div');
        loading.className = 'image-loading';
        loading.innerHTML = `
            <div class="loading-spinner"></div>
            <div class="loading-text">加载中...</div>
        `;
        
        // 创建大图
        const fullImage = document.createElement('img');
        fullImage.src = `${this.apiBaseUrl}${image.path}`;
        fullImage.alt = image.name;
        fullImage.className = 'full-image';
        
        // 创建关闭按钮
        const closeBtn = document.createElement('button');
        closeBtn.className = 'close-button';
        closeBtn.innerHTML = '×';
        closeBtn.addEventListener('click', () => {
            document.body.removeChild(overlay);
            // 恢复页面滚动
            document.body.style.overflow = '';
        });

        // 创建图片信息
        const info = document.createElement('div');
        info.className = 'image-info';
        info.textContent = image.name;
        
        // 组装DOM
        container.appendChild(fullImage);
        container.appendChild(closeBtn);
        container.appendChild(info);
        overlay.appendChild(container);
        overlay.appendChild(loading);
        
        // 点击遮罩层关闭
        overlay.addEventListener('click', (e) => {
            if (e.target === overlay) {
                document.body.removeChild(overlay);
                // 恢复页面滚动
                document.body.style.overflow = '';
            }
        });
        
        // 添加到页面
        document.body.appendChild(overlay);
        
        // 图片加载完成后隐藏加载指示器
        fullImage.onload = () => {
            loading.style.display = 'none';
            fullImage.style.opacity = '1';
        };
    }

    handleScroll() {
        if (this.isLoading || !this.hasMore) return;

        const scrollHeight = document.documentElement.scrollHeight;
        const scrollTop = window.scrollY || document.documentElement.scrollTop;
        const clientHeight = document.documentElement.clientHeight;

        // 当滚动到距离底部100px时加载更多
        if (scrollHeight - scrollTop - clientHeight < 100) {
            this.page++;
            this.loadImages();
        }
    }

    addImage(imageData) {
        // 检查图片是否已存在
        const existingImage = this.images.find(img => img.name === imageData.name);
        if (existingImage) {
            return;
        }

        // 添加到图片数组的开头
        this.images.unshift(imageData);
        this.total++;

        // 如果当前显示的图片数量超过pageSize，移除最后一个
        if (this.images.length > this.pageSize) {
            this.images = this.images.slice(0, this.pageSize);
            // 移除最后一个图片元素
            const lastImage = this.container.lastElementChild;
            if (lastImage) {
                this.container.removeChild(lastImage);
            }
        }

        // 创建新的图片元素
        const imageItem = document.createElement('div');
        imageItem.className = 'image-item';
        
        const img = document.createElement('img');
        img.src = `${this.apiBaseUrl}${imageData.thumbnail}`;
        img.alt = imageData.name;
        img.loading = 'lazy';
        
        img.onerror = (e) => {
            console.error('图片加载失败:', imageData.path);
            let retryCount = 0;
            const maxRetries = 3;
            
            const retryLoad = () => {
                if (retryCount < maxRetries) {
                    retryCount++;
                    console.log(`重试加载图片 (${retryCount}/${maxRetries}):`, imageData.path);
                    img.src = `${this.apiBaseUrl}${imageData.thumbnail}`;
                } else {
                    img.src = 'data:image/svg+xml;base64,PHN2ZyB3aWR0aD0iMjAwIiBoZWlnaHQ9IjIwMCIgeG1sbnM9Imh0dHA6Ly93d3cudzMub3JnLzIwMDAvc3ZnIj48cmVjdCB3aWR0aD0iMjAwIiBoZWlnaHQ9IjIwMCIgZmlsbD0iI2YwZjBmMCIvPjx0ZXh0IHg9IjUwJSIgeT0iNTAlIiBmb250LWZhbWlseT0iQXJpYWwiIGZvbnQtc2l6ZT0iMTYiIGZpbGw9IiM5OTkiIHRleHQtYW5jaG9yPSJtaWRkbGUiIGR5PSIuM2VtIj7lm77niYfmnKzmlL7lhoXlrrk8L3RleHQ+PC9zdmc+';
                    img.alt = '图片加载失败';
                }
            };
            
            img.onerror = retryLoad;
        };
        
        // 添加点击事件
        imageItem.addEventListener('click', () => this.showFullImage(imageData));
        
        imageItem.appendChild(img);
        this.container.insertBefore(imageItem, this.container.firstChild);
    }
} 