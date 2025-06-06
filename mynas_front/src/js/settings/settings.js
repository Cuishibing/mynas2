import { config } from '../config.js';
import { fetchWithAuth } from '../utils/api.js';

export class Settings {
    constructor() {
        this.albumList = document.querySelector('.album-list');
        this.albumNameInput = document.getElementById('album-name');
        this.createAlbumBtn = document.getElementById('create-album');
        this.timelineToggle = document.getElementById('timeline-toggle');
        
        this.init();
    }

    init() {
        this.loadAlbums();
        this.createAlbumBtn.addEventListener('click', () => this.createAlbum());
        this.initTimelineSetting();
    }

    initTimelineSetting() {
        // 从本地存储加载设置
        const savedSetting = localStorage.getItem('albumTimelineEnabled');
        if (savedSetting !== null) {
            this.timelineToggle.checked = savedSetting === 'true';
        } else {
            // 使用默认配置
            this.timelineToggle.checked = config.album.enableTimeline;
        }

        // 监听设置变化
        this.timelineToggle.addEventListener('change', (e) => {
            const enabled = e.target.checked;
            localStorage.setItem('albumTimelineEnabled', enabled);
            // 通知相册页面更新显示方式
            window.dispatchEvent(new CustomEvent('timelineSettingChanged', {
                detail: { enabled }
            }));
        });
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
                <div class="album-actions">
                    <button class="album-action-btn">⋮</button>
                    <div class="album-action-menu">
                        <div class="album-action-item compress">
                            <span class="icon">
                                <svg viewBox="0 0 24 24" width="16" height="16" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round">
                                    <path d="M21 15v4a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2v-4"></path>
                                    <polyline points="7 10 12 15 17 10"></polyline>
                                    <line x1="12" y1="15" x2="12" y2="3"></line>
                                </svg>
                            </span>
                            <span>压缩下载</span>
                        </div>
                    </div>
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
                // 如果点击的是删除按钮或操作按钮，不触发查看
                if (e.target.closest('.album-delete') || e.target.closest('.album-action-btn')) {
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

            // 添加操作按钮事件
            const actionBtn = item.querySelector('.album-action-btn');
            const actionMenu = item.querySelector('.album-action-menu');
            
            actionBtn.addEventListener('click', (e) => {
                e.stopPropagation();
                actionMenu.classList.toggle('show');
            });

            // 点击其他地方关闭菜单
            document.addEventListener('click', (e) => {
                if (!actionMenu.contains(e.target) && e.target !== actionBtn) {
                    actionMenu.classList.remove('show');
                }
            });

            // 添加压缩下载功能
            const compressBtn = item.querySelector('.album-action-item.compress');
            compressBtn.addEventListener('click', async (e) => {
                e.stopPropagation();
                const albumName = item.dataset.name;
                await this.compressAlbum(albumName);
                actionMenu.classList.remove('show');
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

    async compressAlbum(albumName) {
        try {
            // 获取相册中的图片列表
            const response = await fetchWithAuth(`/albums/${encodeURIComponent(albumName)}`);
            if (!response.success || !response.images || response.images.length === 0) {
                alert('相册中没有图片');
                return;
            }

            // 提取文件名
            const filenames = response.images.map(path => path.split('/').pop());
            
            // 请求压缩
            const compressResponse = await fetchWithAuth('/images/compress', {
                method: 'POST',
                headers: {
                    'Content-Type': 'application/json'
                },
                body: JSON.stringify({ filenames })
            });

            if (compressResponse.success) {
                // 获取当前浏览器地址
                const currentHost = window.location.host;
                // 判断apiBaseUrl是否包含IP地址
                const hasIpAddress = /^(https?:\/\/)?(\d{1,3}\.\d{1,3}\.\d{1,3}\.\d{1,3}(:\d+)?)/.test(config.apiBaseUrl);
                // 根据情况选择使用哪个地址
                const downloadBaseUrl = hasIpAddress ? config.apiBaseUrl : `http://${currentHost}${config.apiBaseUrl}`;

                // 创建下载对话框
                const dialog = document.createElement('div');
                dialog.className = 'download-dialog';
                dialog.innerHTML = `
                    <div class="download-dialog-content">
                        <h3>下载文件</h3>
                        <p>文件正在压缩中，您可以复制下载链接稍后下载</p>
                        <div class="download-link">
                            <input type="text" class="link-input" readonly value="${downloadBaseUrl}/download${compressResponse.downloadUrl}">
                            <button class="button copy-btn">复制链接</button>
                        </div>
                        <div class="dialog-buttons">
                            <button class="button download-btn">立即下载</button>
                            <button class="button cancel-btn">取消</button>
                        </div>
                    </div>
                `;

                // 添加复制链接功能
                const linkInput = dialog.querySelector('.link-input');
                const copyBtn = dialog.querySelector('.copy-btn');
                const downloadBtn = dialog.querySelector('.download-btn');
                
                copyBtn.addEventListener('click', () => {
                    linkInput.select();
                    document.execCommand('copy');
                    copyBtn.textContent = '已复制';
                    setTimeout(() => {
                        copyBtn.textContent = '复制链接';
                    }, 2000);
                });

                // 修改下载按钮事件
                downloadBtn.addEventListener('click', async () => {
                    try {
                        downloadBtn.disabled = true;
                        downloadBtn.textContent = '检查中...';
                        
                        const response = await fetch(`${downloadBaseUrl}/download${compressResponse.downloadUrl}`);
                        
                        if (response.status === 409) {
                            // 文件正在压缩中
                            const data = await response.json();
                            downloadBtn.textContent = '正在压缩...';
                            // 5秒后重试
                            setTimeout(() => {
                                downloadBtn.textContent = '立即下载';
                                downloadBtn.disabled = false;
                            }, 5000);
                        } else if (response.ok) {
                            // 文件已准备好，开始下载
                            const blob = await response.blob();
                            const url = window.URL.createObjectURL(blob);
                            const link = document.createElement('a');
                            link.href = url;
                            link.download = ''; // 让浏览器自动处理文件名
                            document.body.appendChild(link);
                            link.click();
                            document.body.removeChild(link);
                            window.URL.revokeObjectURL(url);
                            document.body.removeChild(dialog);
                        } else {
                            throw new Error('下载失败');
                        }
                    } catch (error) {
                        console.error('下载失败:', error);
                        downloadBtn.textContent = '重试下载';
                        downloadBtn.disabled = false;
                    }
                });

                // 添加取消按钮事件
                dialog.querySelector('.cancel-btn').addEventListener('click', () => {
                    document.body.removeChild(dialog);
                });

                // 点击对话框外部关闭
                dialog.addEventListener('click', (e) => {
                    if (e.target === dialog) {
                        document.body.removeChild(dialog);
                    }
                });

                document.body.appendChild(dialog);
            }
        } catch (error) {
            console.error('压缩相册失败:', error);
            alert('压缩相册失败，请重试');
        }
    }
} 