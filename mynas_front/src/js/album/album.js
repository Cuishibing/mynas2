import { config } from '../config.js';
import { fetchWithAuth } from '../utils/api.js';
import { ImageGallery } from '../index/gallery.js';

export class AlbumView extends ImageGallery {
    constructor() {
        super();
        // 从URL中获取相册名称
        const params = new URLSearchParams(window.location.search);
        this.albumName = params.get('name');
        if (!this.albumName) {
            window.location.href = '/settings.html';
            return;
        }
        this.init();
    }

    init() {
        document.title = `${this.albumName} - MyNAS`;
        document.getElementById('album-title').textContent = this.albumName;
        this.loadAlbumImages();
    }

    async loadAlbumImages() {
        try {
            const response = await fetchWithAuth(`/albums/${encodeURIComponent(this.albumName)}`);
            if (response.success) {
                this.images = response.images.map(path => {
                    const filename = path.split('/').pop();
                    // 修正缩略图路径格式
                    const thumbnailPath = `/thumbnails/${path.split('/')[2]}/thumbnails/${filename}`;
                    return {
                        name: filename,
                        path: path,
                        thumbnail: thumbnailPath
                    };
                });
                this.total = this.images.length;
                this.displayImages(this.images);
            }
        } catch (error) {
            console.error('加载相册图片失败:', error);
        }
    }

    async deleteImage(image) {
        try {
            // 先从相册中移除图片
            const response = await fetchWithAuth(`/albums/${encodeURIComponent(this.albumName)}/images`, {
                method: 'DELETE',
                headers: {
                    'Content-Type': 'application/json'
                },
                body: JSON.stringify({
                    imagePath: image.path
                })
            });

            if (response.success) {
                const div = document.querySelector(`[data-image="${image.name}"]`);
                if (div) {
                    div.remove();
                }
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

    async removeFromAlbum(image) {
        try {
            const response = await fetchWithAuth(`/albums/${encodeURIComponent(this.albumName)}/images/remove`, {
                method: 'POST',
                headers: {
                    'Content-Type': 'application/json'
                },
                body: JSON.stringify({
                    imagePath: image.path
                })
            });

            if (response.success) {
                const div = document.querySelector(`[data-image="${image.name}"]`);
                if (div) {
                    div.remove();
                }
                this.images = this.images.filter(img => img.name !== image.name);
                this.total--;
            } else {
                alert('从相册移除失败');
            }
        } catch (error) {
            console.error('从相册移除失败:', error);
            alert('从相册移除失败');
        }
    }

    displayImages(newImages) {
        newImages.forEach(image => {
            const div = document.createElement('div');
            div.className = 'image-item';
            div.setAttribute('data-image', image.name);
            
            const img = document.createElement('img');
            img.src = `${this.apiBaseUrl}${image.thumbnail}`;
            img.alt = image.name;
            img.loading = 'lazy';
            
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

            // 从相册移除选项
            const removeFromAlbumItem = document.createElement('div');
            removeFromAlbumItem.className = 'image-action-item remove-from-album';
            removeFromAlbumItem.innerHTML = `
                <span class="icon">
                    <svg viewBox="0 0 24 24" width="16" height="16" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round">
                        <path d="M3 6h18"></path>
                        <path d="M19 6v14a2 2 0 0 1-2 2H7a2 2 0 0 1-2-2V6m3 0V4a2 2 0 0 1 2-2h4a2 2 0 0 1 2 2v2"></path>
                        <line x1="10" y1="11" x2="10" y2="17"></line>
                        <line x1="14" y1="11" x2="14" y2="17"></line>
                    </svg>
                </span>
                <span>从相册移除</span>
            `;

            // 添加删除事件处理
            deleteItem.addEventListener('click', async (e) => {
                e.stopPropagation();
                if (confirm('确定要删除这张图片吗？')) {
                    await this.deleteImage(image);
                }
                actionsMenu.classList.remove('show');
            });

            // 添加从相册移除的事件处理
            removeFromAlbumItem.addEventListener('click', async (e) => {
                e.stopPropagation();
                await this.removeFromAlbum(image);
                actionsMenu.classList.remove('show');
            });

            // 添加到相册事件处理
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
            actionsMenu.appendChild(deleteItem);
            actionsMenu.appendChild(addToAlbumItem);
            actionsMenu.appendChild(removeFromAlbumItem);
            
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
} 