// 支持的图片格式配置
const SUPPORTED_IMAGE_EXTENSIONS = {
    // 常见图片格式
    JPG: ['.jpg', '.JPG'],
    JPEG: ['.jpeg', '.JPEG'],
    PNG: ['.png', '.PNG'],
    GIF: ['.gif', '.GIF'],
    // RAW格式
    NEF: ['.nef', '.NEF'],  // Nikon RAW格式
};

// 获取所有支持的扩展名数组（包含大小写）
const SUPPORTED_EXTENSIONS_ARRAY = Object.values(SUPPORTED_IMAGE_EXTENSIONS).flat();

// 获取文件扩展名正则表达式
const IMAGE_EXTENSION_REGEX = new RegExp(
    `\\.(${SUPPORTED_EXTENSIONS_ARRAY.map(ext => ext.slice(1)).join('|')})$`,
    'i'
);

// 缩略图配置
const THUMBNAIL_CONFIG = {
    width: 300,
    height: 300,
    quality: 80,
    format: 'jpeg'
};

module.exports = {
    SUPPORTED_IMAGE_EXTENSIONS,
    SUPPORTED_EXTENSIONS_ARRAY,
    IMAGE_EXTENSION_REGEX,
    THUMBNAIL_CONFIG
}; 