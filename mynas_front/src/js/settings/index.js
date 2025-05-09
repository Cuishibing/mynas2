import '../../css/style.css';
import { SettingsManager } from './settings-manager';

// 初始化应用
document.addEventListener('DOMContentLoaded', () => {
    // 初始化设置管理器
    const settingsManager = new SettingsManager();

    // 导出模块到全局作用域（仅用于调试）
    window.app = {
        settings: settingsManager
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