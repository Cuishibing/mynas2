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

            const div = document.createElement('div');
            div.className = 'image-item';
            div.appendChild(img);
            this.container.appendChild(div);
        });
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

        // 添加到图片数组
        this.images.unshift(imageData);
        this.total++;

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
        
        imageItem.appendChild(img);
        this.container.insertBefore(imageItem, this.container.firstChild);
    }
} 