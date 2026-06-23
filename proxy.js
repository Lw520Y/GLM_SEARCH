const http = require('http');
const https = require('https');
const url = require('url');
const fs = require('fs');
const path = require('path');

const PORT = 8085;
const DATA_DIR = path.join(__dirname, 'data');
const STATIC_DIR = __dirname;

// 确保data目录存在
if (!fs.existsSync(DATA_DIR)) {
    fs.mkdirSync(DATA_DIR, { recursive: true });
}

// 数据文件路径
const KEYS_FILE = path.join(DATA_DIR, 'keys.json');
const HISTORY_FILE = path.join(DATA_DIR, 'history.json');

// 读取JSON文件（异步版本）
async function readJsonFile(filePath, defaultValue = []) {
    try {
        if (fs.existsSync(filePath)) {
            const data = await fs.promises.readFile(filePath, 'utf-8');
            return JSON.parse(data);
        }
    } catch (error) {
        console.error('读取文件失败:', filePath, error);
    }
    return defaultValue;
}

// 写入JSON文件（异步版本）
async function writeJsonFile(filePath, data) {
    try {
        await fs.promises.writeFile(filePath, JSON.stringify(data, null, 2), 'utf-8');
        return true;
    } catch (error) {
        console.error('写入文件失败:', filePath, error);
        return false;
    }
}

// Key脱敏函数
function maskKey(key) {
    if (!key || key.length < 12) return key;
    return key.substring(0, 8) + '****' + key.substring(key.length - 4);
}

// 解析请求体
function parseBody(req) {
    return new Promise((resolve, reject) => {
        let body = '';
        req.on('data', chunk => body += chunk);
        req.on('end', () => {
            try {
                resolve(body ? JSON.parse(body) : {});
            } catch (error) {
                reject(error);
            }
        });
        req.on('error', reject);
    });
}

const server = http.createServer(async (req, res) => {
    // 设置CORS头
    res.setHeader('Access-Control-Allow-Origin', '*');
    res.setHeader('Access-Control-Allow-Methods', 'GET, POST, PUT, DELETE, OPTIONS');
    res.setHeader('Access-Control-Allow-Headers', 'Content-Type, Authorization');

    if (req.method === 'OPTIONS') {
        res.writeHead(200);
        res.end();
        return;
    }

    const parsedUrl = url.parse(req.url, true);
    let pathname = parsedUrl.pathname;

    // 处理根路径
    if (pathname === '/') {
        pathname = '/index.html';
    }

    // 静态文件服务
    if (!pathname.startsWith('/api/')) {
        const filePath = path.join(STATIC_DIR, pathname);
        const ext = path.extname(filePath).toLowerCase();
        const mimeTypes = {
            '.html': 'text/html',
            '.css': 'text/css',
            '.js': 'application/javascript',
            '.json': 'application/json',
            '.png': 'image/png',
            '.jpg': 'image/jpeg',
            '.gif': 'image/gif',
            '.svg': 'image/svg+xml',
            '.ico': 'image/x-icon'
        };

        try {
            if (fs.existsSync(filePath) && fs.statSync(filePath).isFile()) {
                const contentType = mimeTypes[ext] || 'application/octet-stream';
                const content = fs.readFileSync(filePath);
                res.writeHead(200, { 'Content-Type': contentType + '; charset=utf-8' });
                res.end(content);
                return;
            }
        } catch (error) {
            console.error('静态文件读取失败:', error);
        }
    }

    try {
        // API: 查询Token使用量（配额限制）
        if (pathname === '/api/quota' && req.method === 'GET') {
            const apiKey = parsedUrl.query.key || req.headers['authorization']?.replace('Bearer ', '');

            if (!apiKey) {
                res.writeHead(400, { 'Content-Type': 'application/json' });
                res.end(JSON.stringify({ code: 400, msg: '缺少API Key' }));
                return;
            }

            const options = {
                hostname: 'bigmodel.cn',
                port: 443,
                path: '/api/monitor/usage/quota/limit',
                method: 'GET',
                headers: {
                    'Authorization': `Bearer ${apiKey}`,
                    'Content-Type': 'application/json'
                }
            };

            const proxyReq = https.request(options, (proxyRes) => {
                let data = '';
                proxyRes.on('data', (chunk) => data += chunk);
                proxyRes.on('end', () => {
                    res.writeHead(proxyRes.statusCode, { 'Content-Type': 'application/json' });
                    res.end(data);
                });
            });

            proxyReq.on('error', (error) => {
                console.error('Proxy error:', error);
                res.writeHead(500, { 'Content-Type': 'application/json' });
                res.end(JSON.stringify({ code: 500, msg: '代理请求失败: ' + error.message }));
            });

            proxyReq.end();
            return;
        }

        // API: 查询Token实际使用量（财务账单）
        if (pathname === '/api/usage' && req.method === 'GET') {
            const apiKey = parsedUrl.query.key || req.headers['authorization']?.replace('Bearer ', '');
            const month = parsedUrl.query.month || new Date().toISOString().substring(0, 7);

            if (!apiKey) {
                res.writeHead(400, { 'Content-Type': 'application/json' });
                res.end(JSON.stringify({ code: 400, msg: '缺少API Key' }));
                return;
            }

            const options = {
                hostname: 'open.bigmodel.cn',
                port: 443,
                path: `/api/finance/chartBill/apiKey/${month}?month=${month}`,
                method: 'GET',
                headers: {
                    'Authorization': `Bearer ${apiKey}`,
                    'Content-Type': 'application/json'
                }
            };

            console.log('请求财务账单接口:', options.hostname + options.path);

            const proxyReq = https.request(options, (proxyRes) => {
                let data = '';
                proxyRes.on('data', (chunk) => data += chunk);
                proxyRes.on('end', () => {
                    console.log('财务账单响应状态:', proxyRes.statusCode);
                    console.log('财务账单响应数据:', data.substring(0, 200));
                    res.writeHead(proxyRes.statusCode, { 'Content-Type': 'application/json' });
                    res.end(data);
                });
            });

            proxyReq.on('error', (error) => {
                console.error('财务账单请求错误:', error);
                res.writeHead(500, { 'Content-Type': 'application/json' });
                res.end(JSON.stringify({ code: 500, msg: '代理请求失败: ' + error.message }));
            });

            proxyReq.end();
            return;
        }

        // API: 获取所有Key
        if (pathname === '/api/keys' && req.method === 'GET') {
            const keys = await readJsonFile(KEYS_FILE);
            res.writeHead(200, { 'Content-Type': 'application/json' });
            res.end(JSON.stringify({ code: 200, data: keys }));
            return;
        }

        // API: 保存Key
        if (pathname === '/api/keys' && req.method === 'POST') {
            const body = await parseBody(req);
            const keys = await readJsonFile(KEYS_FILE);

            // 检查是否已存在
            const exists = keys.find(k => k.key === body.key);
            if (exists) {
                res.writeHead(400, { 'Content-Type': 'application/json' });
                res.end(JSON.stringify({ code: 400, msg: '该Key已存在' }));
                return;
            }

            keys.push({
                key: body.key,
                name: body.name || '未命名Key',
                addedTime: new Date().toISOString()
            });

            if (await writeJsonFile(KEYS_FILE, keys)) {
                res.writeHead(200, { 'Content-Type': 'application/json' });
                res.end(JSON.stringify({ code: 200, msg: '保存成功', data: keys }));
            } else {
                res.writeHead(500, { 'Content-Type': 'application/json' });
                res.end(JSON.stringify({ code: 500, msg: '保存失败' }));
            }
            return;
        }

        // API: 删除Key
        if (pathname === '/api/keys/delete' && req.method === 'POST') {
            const body = await parseBody(req);
            let keys = await readJsonFile(KEYS_FILE);
            keys = keys.filter(k => k.key !== body.key);

            if (await writeJsonFile(KEYS_FILE, keys)) {
                res.writeHead(200, { 'Content-Type': 'application/json' });
                res.end(JSON.stringify({ code: 200, msg: '删除成功', data: keys }));
            } else {
                res.writeHead(500, { 'Content-Type': 'application/json' });
                res.end(JSON.stringify({ code: 500, msg: '删除失败' }));
            }
            return;
        }

        // API: 获取历史记录（支持分页）
        if (pathname === '/api/history' && req.method === 'GET') {
            const history = await readJsonFile(HISTORY_FILE);
            const page = parseInt(parsedUrl.query.page) || 1;
            const pageSize = parseInt(parsedUrl.query.pageSize) || 50;
            const key = parsedUrl.query.key || '';

            // 过滤指定Key的记录
            let filteredHistory = history;
            if (key) {
                filteredHistory = history.filter(h => h.fullKey && h.fullKey.includes(key));
            }

            // 按时间倒序排列
            filteredHistory.sort((a, b) => new Date(b.time) - new Date(a.time));

            // 计算分页
            const total = filteredHistory.length;
            const totalPages = Math.ceil(total / pageSize);
            const start = (page - 1) * pageSize;
            const end = start + pageSize;
            const paginatedHistory = filteredHistory.slice(start, end);

            res.writeHead(200, { 'Content-Type': 'application/json' });
            res.end(JSON.stringify({
                code: 200,
                data: paginatedHistory,
                pagination: {
                    page: page,
                    pageSize: pageSize,
                    total: total,
                    totalPages: totalPages
                }
            }));
            return;
        }

        // API: 保存历史记录
        if (pathname === '/api/history' && req.method === 'POST') {
            const body = await parseBody(req);
            const history = await readJsonFile(HISTORY_FILE);

            // 脱敏处理：只存储脱敏后的Key
            const maskedBody = { ...body };
            if (maskedBody.fullKey) {
                maskedBody.fullKey = maskKey(maskedBody.fullKey);
            }

            history.push({
                id: Date.now().toString(36) + Math.random().toString(36).substr(2),
                time: new Date().toISOString(),
                ...maskedBody
            });

            // 限制历史记录数量
            if (history.length > 1000) {
                history = history.slice(-1000);
            }

            if (await writeJsonFile(HISTORY_FILE, history)) {
                res.writeHead(200, { 'Content-Type': 'application/json' });
                res.end(JSON.stringify({ code: 200, msg: '保存成功', data: history }));
            } else {
                res.writeHead(500, { 'Content-Type': 'application/json' });
                res.end(JSON.stringify({ code: 500, msg: '保存失败' }));
            }
            return;
        }

        // API: 删除历史记录
        if (pathname === '/api/history/delete' && req.method === 'POST') {
            const body = await parseBody(req);
            let history = await readJsonFile(HISTORY_FILE);

            if (body.id) {
                history = history.filter(h => h.id !== body.id);
            } else {
                history = [];
            }

            if (await writeJsonFile(HISTORY_FILE, history)) {
                res.writeHead(200, { 'Content-Type': 'application/json' });
                res.end(JSON.stringify({ code: 200, msg: '删除成功', data: history }));
            } else {
                res.writeHead(500, { 'Content-Type': 'application/json' });
                res.end(JSON.stringify({ code: 500, msg: '删除失败' }));
            }
            return;
        }

        // API: 导出数据
        if (pathname === '/api/export' && req.method === 'GET') {
            const keys = await readJsonFile(KEYS_FILE);
            const history = await readJsonFile(HISTORY_FILE);
            res.writeHead(200, { 'Content-Type': 'application/json' });
            res.end(JSON.stringify({ code: 200, data: { keys, history } }));
            return;
        }

        // 404
        res.writeHead(404, { 'Content-Type': 'application/json' });
        res.end(JSON.stringify({ code: 404, msg: 'Not Found' }));

    } catch (error) {
        console.error('Server error:', error);
        res.writeHead(500, { 'Content-Type': 'application/json' });
        res.end(JSON.stringify({ code: 500, msg: '服务器错误: ' + error.message }));
    }
});

server.listen(PORT, () => {
    console.log(`服务器运行在 http://localhost:${PORT}`);
    console.log(`数据目录: ${DATA_DIR}`);
    console.log(`API接口:`);
    console.log(`  GET  /api/quota?key=YOUR_API_KEY  - 查询Token使用量`);
    console.log(`  GET  /api/keys                     - 获取所有Key`);
    console.log(`  POST /api/keys                     - 保存Key`);
    console.log(`  POST /api/keys/delete              - 删除Key`);
    console.log(`  GET  /api/history                  - 获取历史记录`);
    console.log(`  POST /api/history                  - 保存历史记录`);
    console.log(`  POST /api/history/delete           - 删除历史记录`);
    console.log(`  GET  /api/export                   - 导出所有数据`);
});
