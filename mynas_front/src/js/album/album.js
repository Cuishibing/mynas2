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
} 