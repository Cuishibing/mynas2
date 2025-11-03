const express = require('express');
const multer = require('multer');
const cors = require('cors');
const fs = require('fs');
const path = require('path');
const sharp = require('sharp');
const bcrypt = require('bcryptjs');
const jwt = require('jsonwebtoken');
const archiver = require('archiver');
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

// ========== 图片索引管理函数 ==========

// 获取日期字符串（YYYY-MM-DD格式）
function getDateString(date) {
    return date.toISOString().split('T')[0];
}

// 获取用户索引目录
function getImagesIndexDir(username) {
    return path.join(dataDir, username, 'images_index');
}

// 获取指定日期的索引文件路径
function getIndexFilePath(username, dateString) {
    const indexDir = getImagesIndexDir(username);
    return path.join(indexDir, `${dateString}.json`);
}

// 读取指定日期的索引文件
function readIndexFile(username, dateString) {
    const indexPath = getIndexFilePath(username, dateString);
    if (!fs.existsSync(indexPath)) {
        return [];
    }
    try {
        const content = fs.readFileSync(indexPath, 'utf8');
        return JSON.parse(content);
    } catch (error) {
        console.error(`读取索引文件失败 ${indexPath}:`, error);
        return [];
    }
}

// 追加图片到索引（追加模式）
function appendToIndexFile(username, imageMetadata) {
    const dateString = getDateString(new Date(imageMetadata.shotDate));
    const indexPath = getIndexFilePath(username, dateString);
    
    // 确保索引目录存在
    const indexDir = getImagesIndexDir(username);
    if (!fs.existsSync(indexDir)) {
        fs.mkdirSync(indexDir, { recursive: true });
    }
    
    // 读取现有索引（如果存在）
    let images = [];
    if (fs.existsSync(indexPath)) {
        images = readIndexFile(username, dateString);
    }
    
    // 检查是否已存在（避免重复）
    const exists = images.some(img => img.filename === imageMetadata.filename);
    if (!exists) {
        images.push(imageMetadata);
        // 按拍摄时间排序（最新的在前）
        images.sort((a, b) => new Date(b.shotDate) - new Date(a.shotDate));
        // 写入文件
        fs.writeFileSync(indexPath, JSON.stringify(images, null, 2));
    }
}

// 从索引中删除图片
function removeFromIndexFile(username, filename, shotDate) {
    if (!shotDate) {
        // 如果没有提供shotDate，需要遍历所有索引文件查找
        const indexDir = getImagesIndexDir(username);
        if (!fs.existsSync(indexDir)) {
            return;
        }
        
        const dateFiles = fs.readdirSync(indexDir)
            .filter(file => /^\d{4}-\d{2}-\d{2}\.json$/.test(file));
        
        for (const dateFile of dateFiles) {
            const dateString = dateFile.replace('.json', '');
            const indexPath = path.join(indexDir, dateFile);
            const images = JSON.parse(fs.readFileSync(indexPath, 'utf8'));
            const image = images.find(img => img.filename === filename);
            
            if (image) {
                removeFromIndexFile(username, filename, image.shotDate);
                return;
            }
        }
        return;
    }
    
    const dateString = getDateString(new Date(shotDate));
    const indexPath = getIndexFilePath(username, dateString);
    
    if (!fs.existsSync(indexPath)) {
        return;
    }
    
    try {
        const images = readIndexFile(username, dateString);
        const newImages = images.filter(img => img.filename !== filename);
        
        if (newImages.length === 0) {
            // 如果该日期没有图片了，删除索引文件
            fs.unlinkSync(indexPath);
        } else {
            // 更新索引文件
            fs.writeFileSync(indexPath, JSON.stringify(newImages, null, 2));
        }
    } catch (error) {
        console.error(`删除索引失败 ${indexPath}:`, error);
    }
}

// 从图片提取拍摄日期
async function extractShotDate(filePath) {
    try {
        const metadata = await sharp(filePath).metadata();
        
        // 尝试从EXIF获取拍摄日期
        if (metadata.exif) {
            // EXIF日期格式通常是 "YYYY:MM:DD HH:mm:ss"
            const exifDate = metadata.exif.DateTimeOriginal || 
                           metadata.exif.DateTimeDigitized ||
                           metadata.exif.DateTime;
            
            if (exifDate) {
                // 解析EXIF日期格式 "2024:01:15 10:30:00"
                const dateStr = exifDate.replace(/(\d{4}):(\d{2}):(\d{2})/, '$1-$2-$3');
                return new Date(dateStr);
            }
        }
        
        // 如果没有EXIF日期，使用文件创建时间
        const stats = fs.statSync(filePath);
        return stats.birthtime && stats.birthtime.getTime() > 0 ? stats.birthtime : stats.ctime;
    } catch (error) {
        console.error('提取拍摄日期失败:', error);
        // 降级到文件时间
        const stats = fs.statSync(filePath);
        return stats.birthtime && stats.birthtime.getTime() > 0 ? stats.birthtime : stats.ctime;
    }
}

// 格式化日期显示
function formatDateDisplay(dateString) {
    const date = new Date(dateString);
    const today = new Date();
    today.setHours(0, 0, 0, 0);
    const yesterday = new Date(today);
    yesterday.setDate(yesterday.getDate() - 1);
    
    const dateOnly = new Date(date);
    dateOnly.setHours(0, 0, 0, 0);
    
    if (dateOnly.getTime() === today.getTime()) {
        return '今天';
    } else if (dateOnly.getTime() === yesterday.getTime()) {
        return '昨天';
    } else {
        // 格式化为 "2024年1月15日"
        return `${date.getFullYear()}年${date.getMonth() + 1}月${date.getDate()}日`;
    }
}

// 为已存在的图片生成索引（数据迁移）
async function migrateExistingImages(username) {
    const userUploadDir = path.join(uploadDir, username);
    if (!fs.existsSync(userUploadDir)) {
        return;
    }
    
    const indexDir = getImagesIndexDir(username);
    // 如果索引目录已存在且有文件，说明已经迁移过，跳过
    if (fs.existsSync(indexDir) && fs.readdirSync(indexDir).length > 0) {
        return;
    }
    
    console.log(`开始为用户 ${username} 迁移现有图片索引...`);
    const files = fs.readdirSync(userUploadDir)
        .filter(file => IMAGE_EXTENSION_REGEX.test(file) && !file.includes('thumbnails'));
    
    let migratedCount = 0;
    for (const file of files) {
        try {
            const filePath = path.join(userUploadDir, file);
            const shotDate = await extractShotDate(filePath);
            
            const imageMetadata = {
                filename: file,
                shotDate: shotDate.toISOString(),
                uploadDate: shotDate.toISOString(),
                path: `/images/${username}/${encodeURIComponent(file)}`,
                thumbnail: `/thumbnails/${username}/thumbnails/${encodeURIComponent(file)}`
            };
            
            appendToIndexFile(username, imageMetadata);
            migratedCount++;
        } catch (error) {
            console.error(`迁移图片 ${file} 失败:`, error);
        }
    }
    
    console.log(`用户 ${username} 索引迁移完成，共迁移 ${migratedCount} 张图片`);
}

// 生成缩略图并保存索引
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
        
        // 提取拍摄日期并保存索引
        const shotDate = await extractShotDate(filePath);
        const imageMetadata = {
            filename: filename,
            shotDate: shotDate.toISOString(),
            uploadDate: new Date().toISOString(),
            path: `/images/${username}/${encodeURIComponent(filename)}`,
            thumbnail: `/thumbnails/${username}/thumbnails/${encodeURIComponent(filename)}`
        };
        
        appendToIndexFile(username, imageMetadata);
        
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

        // 从所有相册中删除该图片
        const userDir = path.join(dataDir, req.user.username);
        if (fs.existsSync(userDir)) {
            const files = fs.readdirSync(userDir);
            const albumFiles = files.filter(file => file.startsWith('xiangce_'));
            
            albumFiles.forEach(albumFile => {
                const albumPath = path.join(userDir, albumFile);
                try {
                    const content = fs.readFileSync(albumPath, 'utf8');
                    const images = JSON.parse(content);
                    // 过滤掉要删除的图片
                    const newImages = images.filter(path => !path.includes(decodedFilename));
                    // 如果相册内容有变化，则更新相册文件
                    if (newImages.length !== images.length) {
                        fs.writeFileSync(albumPath, JSON.stringify(newImages));
                        console.log(`从相册 ${albumFile} 中删除图片 ${decodedFilename}`);
                    }
                } catch (error) {
                    console.error(`处理相册 ${albumFile} 时出错:`, error);
                }
            });
        }
        
        // 从索引中删除图片
        removeFromIndexFile(req.user.username, decodedFilename);
        
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

// 获取所有图片列表（按日期分组，支持分页）
app.get('/api/images', authenticateToken, async (req, res) => {
    console.log('获取图片列表');
    const username = req.user.username;
    
    // 首次请求时，如果没有索引文件，执行数据迁移
    const indexDir = getImagesIndexDir(username);
    const userUploadDir = path.join(uploadDir, username);
    
    // 如果上传目录存在但索引目录不存在或为空，执行迁移
    if (fs.existsSync(userUploadDir) && (!fs.existsSync(indexDir) || fs.readdirSync(indexDir).length === 0)) {
        // 异步执行迁移，不阻塞响应
        migrateExistingImages(username).catch(err => {
            console.error('数据迁移失败:', err);
        });
    }
    
    // 获取所有索引文件
    if (!fs.existsSync(indexDir)) {
        return res.json({ groups: [], total: 0, totalGroups: 0, page: 1, pageSize: 3, hasMore: false });
    }
    
    const dateFiles = fs.readdirSync(indexDir)
        .filter(file => /^\d{4}-\d{2}-\d{2}\.json$/.test(file))
        .sort()
        .reverse(); // 按日期倒序（最新的在前）
    
    // 分页参数
    const page = parseInt(req.query.page) || 1;
    const pageSize = parseInt(req.query.pageSize) || 3; // 每次加载3个日期组（3天）
    const start = (page - 1) * pageSize;
    const end = start + pageSize;
    
    const totalGroups = dateFiles.length;
    const paginatedDateFiles = dateFiles.slice(start, end);
    
    // 读取当前页的索引并分组
    const groups = [];
    let totalImages = 0;
    
    for (const dateFile of paginatedDateFiles) {
        const dateString = dateFile.replace('.json', '');
        const images = readIndexFile(username, dateString);
        
        if (images.length > 0) {
            groups.push({
                date: dateString,
                dateDisplay: formatDateDisplay(dateString),
                images: images,
                count: images.length
            });
            totalImages += images.length;
        }
    }
    
    // 计算总图片数（只在第一页时计算，后续页面可以复用前端计算）
    let totalAllImages = 0;
    if (page === 1 || req.query.includeTotal === 'true') {
        // 只在第一页或明确要求时计算总数（避免每次都计算，提升性能）
        for (const dateFile of dateFiles) {
            const dateString = dateFile.replace('.json', '');
            const images = readIndexFile(username, dateString);
            totalAllImages += images.length;
        }
    } else {
        // 其他页面返回0，让前端自己累加（或者前端可以通过第一页的总数来维护）
        totalAllImages = 0;
    }
    
    console.log('图片列表:', { page, pageSize, groups: groups.length, totalGroups, hasMore: end < totalGroups });
    res.json({
        groups: groups,
        total: totalAllImages, // 只有第一页返回总数，其他页面返回0
        totalGroups: totalGroups,
        page: page,
        pageSize: pageSize,
        hasMore: end < totalGroups
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

// 压缩图片接口
app.post('/api/images/compress', authenticateToken, async (req, res) => {
    try {
        const { filenames } = req.body;
        if (!filenames || !Array.isArray(filenames) || filenames.length === 0) {
            return res.status(400).json({ error: '请选择要压缩的图片' });
        }

        // 创建临时目录用于存放压缩文件
        const tempDir = path.join(__dirname, 'temp');
        if (!fs.existsSync(tempDir)) {
            fs.mkdirSync(tempDir, { recursive: true });
        }

        // 生成唯一的压缩文件名
        const timestamp = new Date().getTime();
        const zipFilename = `images_${timestamp}.zip`;
        const zipPath = path.join(tempDir, zipFilename);

        // 创建一个标记文件来表示压缩正在进行
        const statusFile = `${zipPath}.status`;
        fs.writeFileSync(statusFile, 'compressing');

        // 立即返回下载链接
        res.json({
            success: true,
            downloadUrl: `/${zipFilename}`
        });

        // 异步进行压缩
        const output = fs.createWriteStream(zipPath);
        const archive = archiver('zip', {
            zlib: { 
                level: 9,  // 最高压缩级别
                memLevel: 9,  // 最大内存使用
                strategy: 3,  // 使用最大压缩策略
                dictionarySize: 32768  // 使用较大的字典大小
            },
            store: false  // 确保所有文件都被压缩，而不是仅存储
        });

        // 监听压缩完成事件
        output.on('close', () => {
            console.log('压缩完成:', zipFilename);
            // 删除状态文件
            if (fs.existsSync(statusFile)) {
                fs.unlinkSync(statusFile);
            }
        });

        // 监听错误事件
        archive.on('error', (err) => {
            console.error('压缩文件时发生错误:', err);
            // 如果压缩失败，删除临时文件和状态文件
            if (fs.existsSync(zipPath)) {
                fs.unlinkSync(zipPath);
            }
            if (fs.existsSync(statusFile)) {
                fs.unlinkSync(statusFile);
            }
        });

        // 将压缩流管道到输出流
        archive.pipe(output);

        // 添加文件到压缩包
        for (const filename of filenames) {
            const filePath = path.join(uploadDir, req.user.username, filename);
            if (fs.existsSync(filePath)) {
                archive.file(filePath, { name: filename });
            }
        }

        // 完成压缩
        await archive.finalize();
    } catch (error) {
        console.error('压缩图片失败:', error);
        // 注意：这里不返回错误，因为响应已经发送
    }
});

// 下载文件接口
app.get('/api/download/:filename', (req, res) => {
    const filename = req.params.filename;
    const filePath = path.join(__dirname, 'temp', filename);
    const statusFile = `${filePath}.status`;

    // 检查文件是否存在
    if (!fs.existsSync(filePath)) {
        return res.status(404).json({ error: '文件不存在' });
    }

    // 检查是否正在压缩
    if (fs.existsSync(statusFile)) {
        return res.status(409).json({ 
            error: '文件正在压缩中',
            status: 'compressing'
        });
    }

    const stat = fs.statSync(filePath);
    const fileSize = stat.size;
    const range = req.headers.range;

    if (range) {
        // 处理断点续传请求
        const parts = range.replace(/bytes=/, "").split("-");
        const start = parseInt(parts[0], 10);
        const end = parts[1] ? parseInt(parts[1], 10) : fileSize - 1;
        const chunksize = (end - start) + 1;
        const file = fs.createReadStream(filePath, { start, end });
        const head = {
            'Content-Range': `bytes ${start}-${end}/${fileSize}`,
            'Accept-Ranges': 'bytes',
            'Content-Length': chunksize,
            'Content-Type': 'application/zip',
            'Content-Disposition': `attachment; filename="${filename}"`,
            'Cache-Control': 'public, max-age=31536000'
        };

        res.writeHead(206, head);
        file.pipe(res);
    } else {
        // 处理普通下载请求
        const head = {
            'Content-Length': fileSize,
            'Content-Type': 'application/zip',
            'Content-Disposition': `attachment; filename="${filename}"`,
            'Accept-Ranges': 'bytes',
            'Cache-Control': 'public, max-age=31536000'
        };

        res.writeHead(200, head);
        fs.createReadStream(filePath).pipe(res);
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