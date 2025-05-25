import { config } from '../config.js';
import { fetchWithAuth } from '../utils/api.js';

export class Settings {
    constructor() {
        this.apiBaseUrl = config.apiBaseUrl;
        this.init();
    }

    init() {
        this.initializeElements();
        this.loadAlbums();
    }

    initializeElements() {
        this.albumList = document.querySelector('.album-list');
        this.albumNameInput = document.querySelector('#album-name');
        this.createAlbumBtn = document.querySelector('#create-album');

        this.createAlbumBtn.addEventListener('click', () => this.createAlbum());
        this.albumList.addEventListener('click', (e) => this.handleAlbumAction(e));
    }

    handleAlbumAction(e) {
        const target = e.target;
        if (!target.matches('button')) return;

        const albumItem = target.closest('.album-item');
        if (!albumItem) return;

        const albumName = albumItem.querySelector('.album-name').textContent;
        
        if (target.classList.contains('delete')) {
            this.deleteAlbum(albumName);
        } else {
            this.viewAlbum(albumName);
        }
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
            <div class="album-item">
                <div class="album-info">
                    <span class="album-name">${album.name}</span>
                    <span class="album-count">${album.count} 张图片</span>
                </div>
                <div class="album-actions">
                    <button class="button">查看</button>
                    <button class="button delete">删除</button>
                </div>
            </div>
        `).join('');
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
        if (!confirm(`确定要删除相册"${name}"吗？`)) {
            return;
        }

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

    viewAlbum(name) {
        window.location.href = `/pages/album/album.html?name=${encodeURIComponent(name)}`;
    }
} 