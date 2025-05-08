const express = require('express');
const multer = require('multer');
const cors = require('cors');
const fs = require('fs');
const path = require('path');
const sharp = require('sharp');

const app = express();
const port = 3000;

// 添加请求日志中间件
app.use((req, res, next) => {
    console.log(`[${new Date().toISOString()}] ${req.method} ${req.url}`);
    if (req.method === 'POST') {
        console.log('请求体:', req.body);
    }
    next();
});

// 配置 CORS
app.use(cors({
    origin: '*',
    methods: ['GET', 'POST', 'OPTIONS'],
    allowedHeaders: ['Content-Type', 'Authorization'],
    credentials: true,
    maxAge: 86400 // 预检请求缓存24小时
}));

// 确保上传目录存在
const uploadDir = path.join(__dirname, 'uploads');
const thumbnailDir = path.join(__dirname, 'uploads', 'thumbnails');

function ensureDirectoriesExist() {
    if (!fs.existsSync(uploadDir)) {
        console.log('创建上传目录:', uploadDir);
        fs.mkdirSync(uploadDir, { recursive: true });
    }
    if (!fs.existsSync(thumbnailDir)) {
        console.log('创建缩略图目录:', thumbnailDir);
        fs.mkdirSync(thumbnailDir, { recursive: true });
    }
}

// 初始化时创建目录
ensureDirectoriesExist();

// 生成缩略图
async function generateThumbnail(filePath, filename) {
    ensureDirectoriesExist(); // 确保目录存在
    const thumbnailPath = path.join(thumbnailDir, filename);
    try {
        await sharp(filePath)
            .resize(300, 300, {
                fit: 'inside',
                withoutEnlargement: true
            })
            .jpeg({ quality: 80 })
            .toFile(thumbnailPath);
        return true;
    } catch (error) {
        console.error('生成缩略图失败:', error);
        return false;
    }
}

// 配置文件存储
const storage = multer.diskStorage({
    destination: (req, file, cb) => {
        ensureDirectoriesExist(); // 确保目录存在
        cb(null, uploadDir);
    },
    filename: (req, file, cb) => {
        // 使用原始文件名
        const filename = file.originalname;
        console.log('上传文件信息:', {
            originalname: file.originalname,
            mimetype: file.mimetype
        });
        
        cb(null, filename);
    }
});

// 创建multer实例
const upload = multer({
    storage: storage,
    limits: {
        fileSize: 50 * 1024 * 1024 // 限制文件大小为 50MB
    }
});

// 解析 JSON 请求体
app.use(express.json());

// 提供静态文件访问
app.use('/api/images', express.static(path.join(__dirname, 'uploads'), {
    setHeaders: (res, path) => {
        res.set('Access-Control-Allow-Origin', '*');
        res.set('Access-Control-Allow-Methods', 'GET');
        res.set('Cache-Control', 'public, max-age=31536000');
        res.set('Content-Type', 'image/jpeg');
    }
}));

// 提供缩略图访问
app.use('/api/thumbnails', express.static(path.join(__dirname, 'uploads', 'thumbnails'), {
    setHeaders: (res, path) => {
        res.set('Access-Control-Allow-Origin', '*');
        res.set('Access-Control-Allow-Methods', 'GET');
        res.set('Cache-Control', 'public, max-age=31536000');
        res.set('Content-Type', 'image/jpeg');
    }
}));

// 获取所有图片列表
app.get('/api/images', (req, res) => {
    console.log('获取图片列表');
    const uploadDir = path.join(__dirname, 'uploads');
    if (!fs.existsSync(uploadDir)) {
        return res.json({ images: [], total: 0 });
    }

    const page = parseInt(req.query.page) || 1;
    const pageSize = parseInt(req.query.pageSize) || 20;
    const start = (page - 1) * pageSize;
    const end = start + pageSize;

    const allFiles = fs.readdirSync(uploadDir)
        .filter(file => /\.(jpg|jpeg|png|gif)$/i.test(file));

    const total = allFiles.length;
    const files = allFiles.slice(start, end).map(file => {
        // 移除/api前缀
        const fullPath = `/images/${encodeURIComponent(file)}`;
        const thumbnailPath = `/thumbnails/${encodeURIComponent(file)}`;
        console.log('处理文件:', { file, fullPath, thumbnailPath });
        return {
            name: file,
            path: fullPath,
            thumbnail: thumbnailPath
        };
    });

    console.log('图片列表:', { page, pageSize, total, files });
    res.json({
        images: files,
        total,
        page,
        pageSize,
        hasMore: end < total
    });
});

// 检查图片是否存在
app.get('/api/images/check/:filename', (req, res) => {
    const filename = decodeURIComponent(req.params.filename);
    console.log('检查图片是否存在:', filename);
    
    const uploadDir = path.join(__dirname, 'uploads');
    const files = fs.readdirSync(uploadDir);
    const exists = files.includes(filename);
    
    console.log('检查结果:', { filename, exists });
    res.json({ exists });
});

// 上传图片
app.post('/api/images/upload', (req, res, next) => {
    // 先解析multipart/form-data
    upload.single('file')(req, res, async (err) => {
        if (err) {
            console.error('文件上传错误:', err);
            return res.status(400).json({ error: err.message });
        }

        console.log('上传图片请求:', {
            body: req.body,
            file: req.file
        });

        if (!req.file) {
            console.error('没有文件上传');
            return res.status(400).json({ error: '没有文件上传' });
        }

        // 生成缩略图
        await generateThumbnail(req.file.path, req.file.filename);

        res.json({
            success: true,
            file: {
                name: req.file.originalname,
                path: `/images/${encodeURIComponent(req.file.filename)}`,
                thumbnail: `/thumbnails/${encodeURIComponent(req.file.filename)}`
            }
        });
    });
});

// 错误处理中间件
app.use((err, req, res, next) => {
    console.error('错误:', err);
    res.status(500).json({ error: err.message });
});

// 启动服务器
app.listen(port, '0.0.0.0', () => {
    console.log(`服务器运行在 http://localhost:${port}`);
}); 