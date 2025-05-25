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

            // 创建更多操作按钮
            const actionsBtn = document.createElement('button');
            actionsBtn.className = 'image-actions-btn';
            actionsBtn.innerHTML = '⋮';
            
            // 创建操作菜单
            const actionsMenu = document.createElement('div');
            actionsMenu.className = 'image-actions-menu';
            
            // 删除选项
            const deleteItem = document.createElement('div');
            deleteItem.className = 'image-action-item delete';
            deleteItem.innerHTML = `
                <span class="icon">
                    <svg viewBox="0 0 24 24" width="16" height="16" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round">
                        <path d="M3 6h18"></path>
                        <path d="M19 6v14a2 2 0 0 1-2 2H7a2 2 0 0 1-2-2V6m3 0V4a2 2 0 0 1 2-2h4a2 2 0 0 1 2 2v2"></path>
                        <line x1="10" y1="11" x2="10" y2="17"></line>
                        <line x1="14" y1="11" x2="14" y2="17"></line>
                    </svg>
                </span>
                <span>删除</span>
            `;

            // 添加到相册选项
            const addToAlbumItem = document.createElement('div');
            addToAlbumItem.className = 'image-action-item add-to-album';
            addToAlbumItem.innerHTML = `
                <span class="icon">
                    <svg viewBox="0 0 24 24" width="16" height="16" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round">
                        <path d="M3 9l9-7 9 7v11a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2z"></path>
                        <polyline points="9 22 9 12 15 12 15 22"></polyline>
                    </svg>
                </span>
                <span>添加到相册</span>
            `;

            addToAlbumItem.addEventListener('click', async (e) => {
                e.stopPropagation();
                try {
                    // 获取相册列表
                    const response = await fetchWithAuth('/albums');
                    if (!response.success) {
                        return;
                    }

                    // 创建相册选择对话框
                    const dialog = document.createElement('div');
                    dialog.className = 'album-dialog';
                    dialog.innerHTML = `
                        <div class="album-dialog-content">
                            <h3>选择相册</h3>
                            <div class="album-list"></div>
                            <div class="dialog-buttons">
                                <button class="button cancel">取消</button>
                            </div>
                        </div>
                    `;

                    // 渲染相册列表
                    const albumList = dialog.querySelector('.album-list');
                    albumList.innerHTML = response.albums.map(album => `
                        <div class="album-item" data-name="${album.name}">
                            <span class="album-name">${album.name}</span>
                            <span class="album-count">${album.count} 张图片</span>
                        </div>
                    `).join('');

                    // 添加相册点击事件
                    albumList.addEventListener('click', async (e) => {
                        const albumItem = e.target.closest('.album-item');
                        if (!albumItem) return;

                        const albumName = albumItem.dataset.name;
                        try {
                            const addResponse = await fetchWithAuth(`/albums/${encodeURIComponent(albumName)}/images`, {
                                method: 'POST',
                                headers: {
                                    'Content-Type': 'application/json'
                                },
                                body: JSON.stringify({
                                    imagePath: image.path
                                })
                            });

                            if (addResponse.success) {
                                document.body.removeChild(dialog);
                            }
                        } catch (error) {
                            console.error('添加到相册失败:', error);
                        }
                    });

                    // 添加取消按钮事件
                    dialog.querySelector('.cancel').addEventListener('click', () => {
                        document.body.removeChild(dialog);
                    });

                    // 添加点击外部关闭事件
                    dialog.addEventListener('click', (e) => {
                        if (e.target === dialog) {
                            document.body.removeChild(dialog);
                        }
                    });

                    // 添加到页面
                    document.body.appendChild(dialog);
                } catch (error) {
                    console.error('获取相册列表失败:', error);
                }
                actionsMenu.classList.remove('show');
            });

            // 组装菜单
            actionsMenu.appendChild(addToAlbumItem);
            actionsMenu.appendChild(deleteItem);
            
            // 点击更多按钮显示/隐藏菜单
            actionsBtn.addEventListener('click', (e) => {
                e.stopPropagation(); // 阻止事件冒泡
                actionsMenu.classList.toggle('show');
            });
            
            // 点击其他地方关闭菜单
            document.addEventListener('click', (e) => {
                if (!actionsMenu.contains(e.target) && e.target !== actionsBtn) {
                    actionsMenu.classList.remove('show');
                }
            });

            div.appendChild(img);
            div.appendChild(actionsBtn);
            div.appendChild(actionsMenu);

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

        // 创建左右箭头按钮
        const prevBtn = document.createElement('button');
        prevBtn.className = 'nav-button prev-button';
        prevBtn.innerHTML = '❮';
        
        const nextBtn = document.createElement('button');
        nextBtn.className = 'nav-button next-button';
        nextBtn.innerHTML = '❯';

        // 获取当前图片索引
        let currentIndex = this.images.findIndex(img => img.path === image.path);
        
        // 更新导航按钮状态
        const updateNavButtons = () => {
            prevBtn.style.display = currentIndex > 0 ? 'flex' : 'none';
            nextBtn.style.display = currentIndex < this.images.length - 1 ? 'flex' : 'none';
        };
        
        // 显示上一张图片
        const showPrevImage = () => {
            if (currentIndex > 0) {
                currentIndex--;
                const prevImage = this.images[currentIndex];
                showImage(prevImage);
                updateNavButtons();
            }
        };
        
        // 显示下一张图片
        const showNextImage = () => {
            if (currentIndex < this.images.length - 1) {
                currentIndex++;
                const nextImage = this.images[currentIndex];
                showImage(nextImage);
                updateNavButtons();
            }
        };
        
        // 显示指定图片
        const showImage = (image) => {
            loading.style.display = 'flex';
            fullImage.style.opacity = '0';
            fullImage.src = `${this.apiBaseUrl}${image.path}`;
            info.textContent = image.name;
        };
        
        // 添加导航按钮事件监听
        prevBtn.addEventListener('click', (e) => {
            e.stopPropagation();
            showPrevImage();
        });
        
        nextBtn.addEventListener('click', (e) => {
            e.stopPropagation();
            showNextImage();
        });
        
        // 添加键盘事件监听
        const handleKeyDown = (e) => {
            if (e.key === 'ArrowLeft') {
                showPrevImage();
            } else if (e.key === 'ArrowRight') {
                showNextImage();
            } else if (e.key === 'Escape') {
                document.body.removeChild(overlay);
                document.body.style.overflow = '';
            }
        };
        
        document.addEventListener('keydown', handleKeyDown);
        
        // 添加触摸滑动支持
        let touchStartX = 0;
        let touchEndX = 0;
        
        const handleTouchStart = (e) => {
            touchStartX = e.touches[0].clientX;
        };
        
        const handleTouchMove = (e) => {
            touchEndX = e.touches[0].clientX;
        };
        
        const handleTouchEnd = () => {
            const swipeThreshold = 50;
            const diff = touchStartX - touchEndX;
            
            if (Math.abs(diff) > swipeThreshold) {
                if (diff > 0) {
                    showNextImage();
                } else {
                    showPrevImage();
                }
            }
        };
        
        container.addEventListener('touchstart', handleTouchStart);
        container.addEventListener('touchmove', handleTouchMove);
        container.addEventListener('touchend', handleTouchEnd);
        
        // 组装DOM
        container.appendChild(prevBtn);
        container.appendChild(nextBtn);
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
        
        // 初始化导航按钮状态
        updateNavButtons();
        
        // 清理事件监听器
        overlay.addEventListener('remove', () => {
            document.removeEventListener('keydown', handleKeyDown);
            container.removeEventListener('touchstart', handleTouchStart);
            container.removeEventListener('touchmove', handleTouchMove);
            container.removeEventListener('touchend', handleTouchEnd);
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