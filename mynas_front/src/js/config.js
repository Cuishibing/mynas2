// 服务器配置
export const config = {
    // API服务器地址
    apiBaseUrl: process.env.API_BASE_URL || 'http://10.42.0.172:3000/api',
    
    // 其他配置项
    upload: {
        maxFileSize: 50 * 1024 * 1024, // 50MB
        allowedTypes: ['image/jpeg', 'image/png', 'image/gif']
    },
    
    // 分页配置
    pagination: {
        defaultPageSize: 20
    }
}; 