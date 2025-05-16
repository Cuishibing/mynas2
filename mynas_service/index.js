const express = require('express');
const multer = require('multer');
const cors = require('cors');
const fs = require('fs');
const path = require('path');
const sharp = require('sharp');
const bcrypt = require('bcryptjs');
const jwt = require('jsonwebtoken');

const app = express();
const port = 3000;

// JWT密钥
const JWT_SECRET = process.env.JWT_SECRET || 'your-secret-key';

// 从启动参数获取上传目录，默认为当前目录下的uploads
const uploadDir = process.env.UPLOAD_DIR || path.join(__dirname, 'uploads');

// 从启动参数获取用户数据存储目录，默认为当前目录下的data
const dataDir = process.env.DATA_DIR || path.join(__dirname, 'data');
const usersFile = path.join(dataDir, 'users.json');

// 确保用户数据目录存在
function ensureUsersDataExists() {
    if (!fs.existsSync(dataDir)) {
        fs.mkdirSync(dataDir, { recursive: true });
    }
    if (!fs.existsSync(usersFile)) {
        fs.writeFileSync(usersFile, JSON.stringify([]));
    }
}

// 初始化用户数据
ensureUsersDataExists();

// 读取用户数据
function getUsers() {
    const data = fs.readFileSync(usersFile, 'utf8');
    return JSON.parse(data);
}

// 保存用户数据
function saveUsers(users) {
    fs.writeFileSync(usersFile, JSON.stringify(users, null, 2));
}

// 验证JWT token的中间件
function authenticateToken(req, res, next) {
    const authHeader = req.headers['authorization'];
    const token = authHeader && authHeader.split(' ')[1];

    if (!token) {
        return res.status(401).json({ error: '未提供认证token' });
    }

    jwt.verify(token, JWT_SECRET, (err, user) => {
        if (err) {
            return res.status(403).json({ error: 'token无效或已过期' });
        }
        req.user = user;
        next();
    });
}

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

function ensureDirectoriesExist(username) {
    const userUploadDir = path.join(uploadDir, username);
    const userThumbnailDir = path.join(userUploadDir, 'thumbnails');

    if (!fs.existsSync(uploadDir)) {
        console.log('创建上传目录:', uploadDir);
        fs.mkdirSync(uploadDir, { recursive: true });
    }
    if (!fs.existsSync(userUploadDir)) {
        console.log('创建用户上传目录:', userUploadDir);
        fs.mkdirSync(userUploadDir, { recursive: true });
    }
    if (!fs.existsSync(userThumbnailDir)) {
        console.log('创建用户缩略图目录:', userThumbnailDir);
        fs.mkdirSync(userThumbnailDir, { recursive: true });
    }

    return {
        userUploadDir,
        userThumbnailDir
    };
}

// 生成缩略图
async function generateThumbnail(filePath, filename, username) {
    const { userThumbnailDir } = ensureDirectoriesExist(username);
    const thumbnailPath = path.join(userThumbnailDir, filename);
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
        const { userUploadDir } = ensureDirectoriesExist(req.user.username);
        cb(null, userUploadDir);
    },
    filename: (req, file, cb) => {
        // 使用原始文件名
        const filename = file.originalname;
        console.log('上传文件信息:', {
            originalname: file.originalname,
            mimetype: file.mimetype,
            username: req.user.username
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
app.use('/api/thumbnails', express.static(path.join(__dirname, 'uploads'), {
    setHeaders: (res, path) => {
        res.set('Access-Control-Allow-Origin', '*');
        res.set('Access-Control-Allow-Methods', 'GET');
        res.set('Cache-Control', 'public, max-age=31536000');
        res.set('Content-Type', 'image/jpeg');
    }
}));

// 获取所有图片列表
app.get('/api/images', authenticateToken, (req, res) => {
    console.log('获取图片列表');
    const userUploadDir = path.join(uploadDir, req.user.username);
    if (!fs.existsSync(userUploadDir)) {
        return res.json({ images: [], total: 0 });
    }

    const page = parseInt(req.query.page) || 1;
    const pageSize = parseInt(req.query.pageSize) || 20;
    const start = (page - 1) * pageSize;
    const end = start + pageSize;

    const allFiles = fs.readdirSync(userUploadDir)
        .filter(file => /\.(jpg|jpeg|png|gif)$/i.test(file) && !file.includes('thumbnails'));

    const total = allFiles.length;
    const files = allFiles.slice(start, end).map(file => {
        // 移除/api前缀
        const fullPath = `/images/${req.user.username}/${encodeURIComponent(file)}`;
        const thumbnailPath = `/thumbnails/${req.user.username}/thumbnails/${encodeURIComponent(file)}`;
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
app.get('/api/images/check/:filename', authenticateToken, (req, res) => {
    const filename = decodeURIComponent(req.params.filename);
    console.log('检查图片是否存在:', filename);
    
    const userUploadDir = path.join(uploadDir, req.user.username);
    const files = fs.existsSync(userUploadDir) ? fs.readdirSync(userUploadDir) : [];
    const exists = files.includes(filename);
    
    console.log('检查结果:', { filename, exists });
    res.json({ exists });
});

// 上传图片
app.post('/api/images/upload', authenticateToken, (req, res, next) => {
    // 先解析multipart/form-data
    upload.single('file')(req, res, async (err) => {
        if (err) {
            console.error('文件上传错误:', err);
            return res.status(400).json({ error: err.message });
        }

        console.log('上传图片请求:', {
            body: req.body,
            file: req.file,
            username: req.user.username
        });

        if (!req.file) {
            console.error('没有文件上传');
            return res.status(400).json({ error: '没有文件上传' });
        }

        // 生成缩略图
        await generateThumbnail(req.file.path, req.file.filename, req.user.username);

        res.json({
            success: true,
            file: {
                name: req.file.originalname,
                path: `/images/${req.user.username}/${encodeURIComponent(req.file.filename)}`,
                thumbnail: `/thumbnails/${req.user.username}/thumbnails/${encodeURIComponent(req.file.filename)}`
            }
        });
    });
});

// 登录接口
app.post('/api/login', async (req, res) => {
    const { username, password } = req.body;

    if (!username || !password) {
        return res.status(400).json({ error: '用户名和密码不能为空' });
    }

    const users = getUsers();
    const user = users.find(u => u.username === username);

    if (!user) {
        return res.status(401).json({ error: '用户名或密码错误' });
    }

    const validPassword = await bcrypt.compare(password, user.password);
    if (!validPassword) {
        return res.status(401).json({ error: '用户名或密码错误' });
    }

    const token = jwt.sign({ id: user.id, username: user.username }, JWT_SECRET, { expiresIn: '24h' });
    res.json({
        success: true,
        token,
        user: {
            id: user.id,
            username: user.username
        }
    });
});

// 注册接口
app.post('/api/register', async (req, res) => {
    const { username, password } = req.body;

    if (!username || !password) {
        return res.status(400).json({ error: '用户名和密码不能为空' });
    }

    const users = getUsers();
    if (users.some(u => u.username === username)) {
        return res.status(400).json({ error: '用户名已存在' });
    }

    const hashedPassword = await bcrypt.hash(password, 10);
    const newUser = {
        id: Date.now().toString(),
        username,
        password: hashedPassword
    };

    users.push(newUser);
    saveUsers(users);

    const token = jwt.sign({ id: newUser.id, username: newUser.username }, JWT_SECRET, { expiresIn: '24h' });
    res.json({
        success: true,
        token,
        user: {
            id: newUser.id,
            username: newUser.username
        }
    });
});

// 获取当前用户信息
app.get('/api/user', authenticateToken, (req, res) => {
    res.json({
        success: true,
        user: {
            id: req.user.id,
            username: req.user.username
        }
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
    console.log(`上传目录: ${uploadDir}`);
}); 