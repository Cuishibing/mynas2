import { config } from '../config.js';
import { fetchWithAuth } from '../utils/api.js';

export class Settings {
    constructor() {
        this.albumList = document.querySelector('.album-list');
        this.albumNameInput = document.getElementById('album-name');
        this.createAlbumBtn = document.getElementById('create-album');
        
        this.init();
    }

    init() {
        this.loadAlbums();
        this.createAlbumBtn.addEventListener('click', () => this.createAlbum());
    }

    async loadAlbums() {
        try {
            const response = await fetchWithAuth('/albums');
            if (response.success) {
                this.renderAlbumList(response.albums);
            }
        } catch (error) {
            console.error('加载相册列表失败:', error);
        }
    }

    renderAlbumList(albums) {
        this.albumList.innerHTML = albums.map(album => `
            <div class="album-item" data-name="${album.name}">
                <div class="album-info">
                    <span class="album-name">${album.name}</span>
                    <span class="album-count">${album.count} 张图片</span>
                </div>
                <div class="album-delete">删除</div>
            </div>
        `).join('');

        // 添加左滑删除功能
        this.albumList.querySelectorAll('.album-item').forEach(item => {
            let startX = 0;
            let currentX = 0;
            let isDragging = false;

            // 触摸开始
            item.addEventListener('touchstart', (e) => {
                startX = e.touches[0].clientX;
                isDragging = true;
            });

            // 触摸移动
            item.addEventListener('touchmove', (e) => {
                if (!isDragging) return;
                
                currentX = e.touches[0].clientX;
                const diff = currentX - startX;
                
                // 允许左右滑动
                if (item.classList.contains('active')) {
                    // 如果已经显示删除按钮，允许右滑取消
                    const translateX = Math.min(Math.max(diff, -80), 0);
                    item.style.transform = `translateX(${translateX}px)`;
                    
                    // 当右滑超过阈值时，取消显示删除按钮
                    if (translateX > -40) {
                        item.classList.remove('active');
                    }
                } else {
                    // 如果未显示删除按钮，只允许左滑
                    if (diff < 0) {
                        const translateX = Math.max(diff, -80);
                        item.style.transform = `translateX(${translateX}px)`;
                        
                        // 当左滑超过阈值时，显示删除按钮
                        if (translateX < -40) {
                            item.classList.add('active');
                        }
                    }
                }
            });

            // 触摸结束
            item.addEventListener('touchend', () => {
                isDragging = false;
                if (item.classList.contains('active')) {
                    // 保持显示删除按钮
                    item.style.transform = 'translateX(-80px)';
                } else {
                    // 恢复原位
                    item.style.transform = 'translateX(0)';
                }
            });

            // 点击相册项查看相册
            item.addEventListener('click', (e) => {
                // 如果点击的是删除按钮，不触发查看
                if (e.target.classList.contains('album-delete')) {
                    return;
                }
                const albumName = item.dataset.name;
                this.viewAlbum(albumName);
            });

            // 点击删除按钮
            item.querySelector('.album-delete').addEventListener('click', async (e) => {
                e.stopPropagation();
                const albumName = item.dataset.name;
                if (confirm(`确定要删除相册"${albumName}"吗？`)) {
                    await this.deleteAlbum(albumName);
                }
                // 恢复原位
                item.style.transform = 'translateX(0)';
                item.classList.remove('active');
            });
        });
    }

    viewAlbum(albumName) {
        window.location.href = `/album.html?name=${encodeURIComponent(albumName)}`;
    }

    async createAlbum() {
        const name = this.albumNameInput.value.trim();
        if (!name) {
            alert('请输入相册名称');
            return;
        }

        try {
            const response = await fetchWithAuth('/albums', {
                method: 'POST',
                headers: {
                    'Content-Type': 'application/json'
                },
                body: JSON.stringify({ name })
            });

            if (response.success) {
                this.albumNameInput.value = '';
                this.loadAlbums();
            } else {
                alert('创建相册失败');
            }
        } catch (error) {
            console.error('创建相册失败:', error);
            alert('创建相册失败');
        }
    }

    async deleteAlbum(name) {
        try {
            const response = await fetchWithAuth('/albums/delete', {
                method: 'POST',
                headers: {
                    'Content-Type': 'application/json'
                },
                body: JSON.stringify({ name })
            });

            if (response.success) {
                this.loadAlbums();
            } else {
                alert('删除相册失败');
            }
        } catch (error) {
            console.error('删除相册失败:', error);
            alert('删除相册失败');
        }
    }
} 