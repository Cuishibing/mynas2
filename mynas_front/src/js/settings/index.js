import '../../css/style.css';
import { Settings } from './settings';

// 初始化应用
document.addEventListener('DOMContentLoaded', () => {
    // 初始化相册管理
    const settings = new Settings();

    // 导出模块到全局作用域（仅用于调试）
    window.app = {
        settings
    };

    // 添加错误处理
    window.addEventListener('error', (event) => {
        console.error('全局错误:', event.error);
    });

    // 添加未处理的 Promise 错误处理
    window.addEventListener('unhandledrejection', (event) => {
        console.error('未处理的 Promise 错误:', event.reason);
    });
}); 