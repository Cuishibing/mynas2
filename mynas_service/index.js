const express = require('express');
const multer = require('multer');
const cors = require('cors');
const fs = require('fs');
const path = require('path');
const sharp = require('sharp');
const bcrypt = require('bcryptjs');
const jwt = require('jsonwebtoken');
const { IMAGE_EXTENSION_REGEX, THUMBNAIL_CONFIG } = require('./config');

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
        // 读取原始图片的EXIF信息
        const metadata = await sharp(filePath).metadata();
        
        // 生成缩略图时保留EXIF信息
        await sharp(filePath)
            .rotate() // 自动根据EXIF信息旋转图片
            .resize(THUMBNAIL_CONFIG.width, THUMBNAIL_CONFIG.height, {
                fit: 'inside',
                withoutEnlargement: true
            })
            .withMetadata() // 保留EXIF信息
            .jpeg({ quality: THUMBNAIL_CONFIG.quality })
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
        fileSize: 100 * 1024 * 1024 // 限制文件大小为 100MB
    }
});

// 解析 JSON 请求体
app.use(express.json());

// 删除图片
app.post('/api/images/delete', authenticateToken, (req, res) => {
    const { filename } = req.body;
    if (!filename) {
        return res.status(400).json({ error: '文件名不能为空' });
    }

    const decodedFilename = decodeURIComponent(filename);
    console.log('删除图片:', decodedFilename);
    
    const userUploadDir = path.join(uploadDir, req.user.username);
    const userThumbnailDir = path.join(userUploadDir, 'thumbnails');
    const filePath = path.join(userUploadDir, decodedFilename);
    const thumbnailPath = path.join(userThumbnailDir, decodedFilename);
    
    try {
        // 检查文件是否存在
        if (!fs.existsSync(filePath)) {
            console.error('文件不存在:', filePath);
            return res.status(404).json({ error: '文件不存在' });
        }
        
        // 删除原图和缩略图
        fs.unlinkSync(filePath);
        if (fs.existsSync(thumbnailPath)) {
            fs.unlinkSync(thumbnailPath);
        }
        
        console.log('图片删除成功:', decodedFilename);
        res.json({ success: true });
    } catch (error) {
        console.error('删除图片失败:', error);
        res.status(500).json({ error: '删除图片失败' });
    }
});

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
        .filter(file => /\.(jpg|jpeg|png|gif)$/i.test(file) && !file.includes('thumbnails'))
        .map(file => {
            const filePath = path.join(userUploadDir, file);
            const stats = fs.statSync(filePath);
            // 检查 birthtime 是否存在且有效
            const birthtime = stats.birthtime && stats.birthtime.getTime() > 0 ? stats.birthtime : null;
            return {
                name: file,
                birthtime: birthtime,
                ctime: stats.ctime
            };
        })
        .sort((a, b) => {
            // 如果两个文件都有有效的 birthtime，使用 birthtime 比较
            if (a.birthtime && b.birthtime) {
                return b.birthtime - a.birthtime;
            }
            // 如果只有 a 有有效的 birthtime，a 排在前面
            if (a.birthtime) {
                return -1;
            }
            // 如果只有 b 有有效的 birthtime，b 排在前面
            if (b.birthtime) {
                return 1;
            }
            // 如果都没有有效的 birthtime，使用 ctime 比较
            return b.ctime - a.ctime;
        })
        .map(file => file.name);

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

// 获取相册列表
app.get('/api/albums', authenticateToken, (req, res) => {
    try {
        const userDir = path.join(dataDir, req.user.username);
        if (!fs.existsSync(userDir)) {
            return res.json({
                success: true,
                albums: []
            });
        }

        const files = fs.readdirSync(userDir);
        const albums = files
            .filter(file => file.startsWith('xiangce_'))
            .map(file => ({
                name: file.replace('xiangce_', '').replace('.json', ''),
                path: file
            }));

        // 获取每个相册的图片数量
        const albumsWithCount = albums.map(album => {
            try {
                const content = fs.readFileSync(path.join(userDir, album.path), 'utf8');
                const images = JSON.parse(content);
                return {
                    ...album,
                    count: images.length
                };
            } catch (error) {
                console.error(`读取相册 ${album.name} 失败:`, error);
                return {
                    ...album,
                    count: 0
                };
            }
        });

        res.json({
            success: true,
            albums: albumsWithCount
        });
    } catch (error) {
        console.error('获取相册列表失败:', error);
        res.status(500).json({
            success: false,
            message: '获取相册列表失败'
        });
    }
});

// 创建相册
app.post('/api/albums', authenticateToken, (req, res) => {
    try {
        const { name } = req.body;
        if (!name) {
            return res.status(400).json({
                success: false,
                message: '相册名称不能为空'
            });
        }

        const userDir = path.join(dataDir, req.user.username);
        if (!fs.existsSync(userDir)) {
            fs.mkdirSync(userDir, { recursive: true });
        }

        const albumPath = path.join(userDir, `xiangce_${name}.json`);

        // 检查相册是否已存在
        if (fs.existsSync(albumPath)) {
            return res.status(400).json({
                success: false,
                message: '相册已存在'
            });
        }

        // 创建空相册
        fs.writeFileSync(albumPath, JSON.stringify([]));

        res.json({
            success: true,
            message: '相册创建成功'
        });
    } catch (error) {
        console.error('创建相册失败:', error);
        res.status(500).json({
            success: false,
            message: '创建相册失败'
        });
    }
});

// 删除相册
app.post('/api/albums/delete', authenticateToken, (req, res) => {
    try {
        const { name } = req.body;
        if (!name) {
            return res.status(400).json({
                success: false,
                message: '相册名称不能为空'
            });
        }

        const userDir = path.join(dataDir, req.user.username);
        const albumPath = path.join(userDir, `xiangce_${name}.json`);

        // 检查相册是否存在
        if (!fs.existsSync(albumPath)) {
            return res.status(404).json({
                success: false,
                message: '相册不存在'
            });
        }

        // 删除相册文件
        fs.unlinkSync(albumPath);

        res.json({
            success: true,
            message: '相册删除成功'
        });
    } catch (error) {
        console.error('删除相册失败:', error);
        res.status(500).json({
            success: false,
            message: '删除相册失败'
        });
    }
});

// 获取相册内容
app.get('/api/albums/:name', authenticateToken, (req, res) => {
    try {
        const { name } = req.params;
        const userDir = path.join(dataDir, req.user.username);
        const albumPath = path.join(userDir, `xiangce_${name}.json`);

        // 检查相册是否存在
        if (!fs.existsSync(albumPath)) {
            return res.status(404).json({
                success: false,
                message: '相册不存在'
            });
        }

        // 读取相册内容
        const content = fs.readFileSync(albumPath, 'utf8');
        const images = JSON.parse(content);

        res.json({
            success: true,
            images
        });
    } catch (error) {
        console.error('获取相册内容失败:', error);
        res.status(500).json({
            success: false,
            message: '获取相册内容失败'
        });
    }
});

// 添加图片到相册
app.post('/api/albums/:name/images', authenticateToken, (req, res) => {
    try {
        const { name } = req.params;
        const { imagePath } = req.body;
        const userDir = path.join(dataDir, req.user.username);
        const albumPath = path.join(userDir, `xiangce_${name}.json`);

        // 检查相册是否存在
        if (!fs.existsSync(albumPath)) {
            return res.status(404).json({
                success: false,
                message: '相册不存在'
            });
        }

        // 读取相册内容
        const content = fs.readFileSync(albumPath, 'utf8');
        const images = JSON.parse(content);

        // 检查图片是否已在相册中
        if (images.includes(imagePath)) {
            return res.status(400).json({
                success: false,
                message: '图片已在相册中'
            });
        }

        // 添加图片到相册
        images.push(imagePath);
        fs.writeFileSync(albumPath, JSON.stringify(images));

        res.json({
            success: true,
            message: '添加图片成功'
        });
    } catch (error) {
        console.error('添加图片到相册失败:', error);
        res.status(500).json({
            success: false,
            message: '添加图片到相册失败'
        });
    }
});

// 从相册中移除图片
app.post('/api/albums/:name/images/remove', authenticateToken, (req, res) => {
    try {
        const { name } = req.params;
        const { imagePath } = req.body;
        const userDir = path.join(dataDir, req.user.username);
        const albumPath = path.join(userDir, `xiangce_${name}.json`);

        // 检查相册是否存在
        if (!fs.existsSync(albumPath)) {
            return res.status(404).json({
                success: false,
                message: '相册不存在'
            });
        }

        // 读取相册内容
        const content = fs.readFileSync(albumPath, 'utf8');
        const images = JSON.parse(content);

        // 从相册中移除图片
        const newImages = images.filter(path => path !== imagePath);
        fs.writeFileSync(albumPath, JSON.stringify(newImages));

        res.json({
            success: true,
            message: '移除图片成功'
        });
    } catch (error) {
        console.error('从相册中移除图片失败:', error);
        res.status(500).json({
            success: false,
            message: '从相册中移除图片失败'
        });
    }
});

// 错误处理中间件
app.use((err, req, res, next) => {
    console.error('错误:', err);
    res.status(500).json({ error: err.message });
});

// 检查并生成缺失的缩略图
let isCheckingThumbnails = false;

async function checkAndGenerateMissingThumbnails() {
    if (isCheckingThumbnails) {
        console.log('缩略图检查正在进行中，跳过本次执行');
        return;
    }

    try {
        isCheckingThumbnails = true;
        console.log('开始检查缺失的缩略图...');
        const users = getUsers();
        
        for (const user of users) {
            const userUploadDir = path.join(uploadDir, user.username);
            const userThumbnailDir = path.join(userUploadDir, 'thumbnails');
            
            if (!fs.existsSync(userUploadDir)) {
                console.log(`用户 ${user.username} 的上传目录不存在，跳过`);
                continue;
            }
            
            const files = fs.readdirSync(userUploadDir)
                .filter(file => IMAGE_EXTENSION_REGEX.test(file) && !file.includes('thumbnails'));
                
            for (const file of files) {
                const thumbnailPath = path.join(userThumbnailDir, file);
                if (!fs.existsSync(thumbnailPath)) {
                    console.log(`为用户 ${user.username} 生成文件 ${file} 的缩略图`);
                    const filePath = path.join(userUploadDir, file);
                    await generateThumbnail(filePath, file, user.username);
                }
            }
        }
        console.log('缩略图检查完成');
    } catch (error) {
        console.error('缩略图检查过程中发生错误:', error);
    } finally {
        isCheckingThumbnails = false;
    }
}

// 启动服务器
app.listen(port, '0.0.0.0', async () => {
    console.log(`服务器运行在 http://localhost:${port}`);
    console.log(`上传目录: ${uploadDir}`);
    
    // 启动时立即执行一次检查
    await checkAndGenerateMissingThumbnails();
    
    // 设置定时任务，每分钟执行一次
    setInterval(checkAndGenerateMissingThumbnails, 60 * 1000);
}); 