import { config } from '../config.js';

// 统一的请求处理函数
export async function fetchWithAuth(url, options = {}) {
    const token = localStorage.getItem('token');
    
    // 设置默认headers
    const headers = {
        ...options.headers,
        'Authorization': token ? `Bearer ${token}` : ''
    };

    try {
        const response = await fetch(`${config.apiBaseUrl}${url}`, {
            ...options,
            headers
        });

        // 处理未认证的情况
        if (response.status === 401 || response.status === 403) {
            // 清除无效的token
            localStorage.removeItem('token');
            // 跳转到登录页面
            window.location.href = '/login.html';
            throw new Error('未登录或登录已过期，请重新登录');
        }

        if (!response.ok) {
            const error = await response.json();
            throw new Error(error.error || '请求失败');
        }

        return await response.json();
    } catch (error) {
        console.error('API请求失败:', error);
        throw error;
    }
}

// 上传文件的特殊处理函数
export function uploadFile(url, file, onProgress) {
    return new Promise((resolve, reject) => {
        const token = localStorage.getItem('token');
        const xhr = new XMLHttpRequest();
        const formData = new FormData();
        formData.append('file', file);

        xhr.upload.addEventListener('progress', (e) => {
            if (e.lengthComputable && onProgress) {
                const percentComplete = Math.round((e.loaded / e.total) * 100);
                onProgress(percentComplete);
            }
        });

        xhr.addEventListener('load', () => {
            if (xhr.status === 401 || xhr.status === 403) {
                localStorage.removeItem('token');
                window.location.href = '/login.html';
                reject(new Error('未登录或登录已过期，请重新登录'));
                return;
            }

            if (xhr.status >= 200 && xhr.status < 300) {
                resolve(JSON.parse(xhr.responseText));
            } else {
                reject(new Error(xhr.responseText || '上传失败'));
            }
        });

        xhr.addEventListener('error', () => {
            reject(new Error('网络错误'));
        });

        xhr.open('POST', `${config.apiBaseUrl}${url}`);
        xhr.setRequestHeader('Authorization', token ? `Bearer ${token}` : '');
        xhr.send(formData);
    });
} 