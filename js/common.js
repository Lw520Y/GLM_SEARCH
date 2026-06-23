// API 基础地址（使用相对路径）
const API_BASE = '';

// 存储的Key列表
let storedKeys = [];

// 查询缓存（5分钟有效期）
const queryCache = new Map();
const CACHE_DURATION = 5 * 60 * 1000; // 5分钟

// 获取缓存的查询结果
function getCachedResult(key) {
    const cached = queryCache.get(key);
    if (cached && Date.now() - cached.timestamp < CACHE_DURATION) {
        return cached.data;
    }
    queryCache.delete(key);
    return null;
}

// 设置缓存
function setCachedResult(key, data) {
    queryCache.set(key, {
        data: data,
        timestamp: Date.now()
    });
}

// 清除缓存
function clearCache() {
    queryCache.clear();
}

// 从服务器加载Key
async function loadKeys() {
    try {
        const response = await fetch(`${API_BASE}/api/keys`);
        const data = await response.json();
        if (data.code === 200) {
            storedKeys = data.data;
        }
    } catch (error) {
        console.error('加载Key失败:', error);
    }
}

// 查询实际Token使用量
async function queryActualUsage(apiKey, month) {
    try {
        const monthParam = month || new Date().toISOString().substring(0, 7);
        const response = await fetch(`${API_BASE}/api/usage?key=${encodeURIComponent(apiKey)}&month=${monthParam}`);
        const data = await response.json();
        if (data.code === 200 && data.rows) {
            return data.rows;
        }
    } catch (error) {
        console.error('查询实际使用量失败:', error);
    }
    return null;
}

// 从使用量数据中提取指定Key的使用量
function extractKeyUsage(rows, apiKey) {
    if (!rows || !apiKey) return 0;
    const keyPrefix = apiKey.split('.')[0]; // 获取Key的前半部分
    const row = rows.find(r => r.apiKey && keyPrefix.startsWith(r.apiKey));
    return row ? (row.deductUsage || 0) : 0;
}

// 格式化Token数量
function formatTokenCount(count) {
    if (count >= 100000000) {
        return (count / 100000000).toFixed(2) + '亿';
    } else if (count >= 10000) {
        return (count / 10000).toFixed(2) + '万';
    }
    return count.toString();
}

// 标准化数据格式
function normalizeData(data) {
    let token5hUsed = 0;
    let token5hTotal = 0;
    let token5hPercent = 0;
    let tokenMonthUsed = 0;
    let tokenMonthTotal = 0;
    let tokenMonthPercent = 0;
    let timeUsed = 0;
    let timeTotal = 0;
    let timeRemaining = 0;
    let level = data.level || 'unknown';

    if (data.limits && Array.isArray(data.limits)) {
        data.limits.forEach(limit => {
            if (limit.type === 'TOKENS_LIMIT') {
                if (limit.unit === 3) {
                    // 5小时Token限额：percentage是使用率百分比，number是总次数
                    token5hTotal = limit.number || 0;
                    token5hPercent = limit.percentage || 0;
                    token5hUsed = Math.round(token5hTotal * token5hPercent / 100);
                } else if (limit.unit === 6) {
                    // MCP月度调用：percentage是使用率百分比
                    // Pro套餐默认1000次/月
                    tokenMonthPercent = limit.percentage || 0;
                    tokenMonthTotal = level === 'pro' ? 1000 : (limit.number || 0);
                    tokenMonthUsed = Math.round(tokenMonthTotal * tokenMonthPercent / 100);
                }
            } else if (limit.type === 'TIME_LIMIT') {
                timeUsed = limit.currentValue || 0;
                timeTotal = limit.usage || 0;
                timeRemaining = limit.remaining || 0;
            }
        });
    }

    return {
        planType: level === 'pro' ? 'Pro套餐' : level === 'free' ? '免费套餐' : 'Coding Plan',
        tokenUsed: token5hUsed,
        tokenTotal: token5hTotal,
        tokenUnit: '次/5小时',
        tokenPercent: token5hPercent,
        mcpUsed: tokenMonthUsed,
        mcpTotal: tokenMonthTotal,
        mcpUnit: '次/月',
        mcpPercent: tokenMonthPercent,
        timeUsed: timeUsed,
        timeTotal: timeTotal,
        timeRemaining: timeRemaining
    };
}

// 获取进度条样式类
function getProgressClass(percent) {
    if (percent >= 80) return 'high';
    if (percent >= 50) return 'medium';
    return 'low';
}

// 获取状态
function getStatus(percent) {
    if (percent >= 80) return { class: 'badge-danger', text: '危险' };
    if (percent >= 50) return { class: 'badge-warning', text: '警告' };
    return { class: 'badge-success', text: '正常' };
}

// 格式化数字
function formatNumber(num) {
    if (num >= 1000000) {
        return (num / 1000000).toFixed(1) + 'M';
    } else if (num >= 1000) {
        return (num / 1000).toFixed(1) + 'K';
    }
    return num.toString();
}

// Key脱敏显示
function maskKey(key) {
    if (!key || key.length < 12) return key;
    return key.substring(0, 8) + '****' + key.substring(key.length - 4);
}

// 测试连接
async function testConnection() {
    try {
        const response = await fetch(`${API_BASE}/api/keys`, {
            method: 'GET',
            headers: { 'Content-Type': 'application/json' }
        });
        const data = await response.json();
        if (data.code === 200) {
            alert('连接成功！\n服务器正常运行\n已保存 ' + data.data.length + ' 个Key');
        } else {
            alert('连接异常: ' + data.msg);
        }
    } catch (error) {
        alert('连接失败: ' + error.message + '\n\n请确保代理服务器已启动:\nnode proxy.js');
    }
}

// 删除Key
async function deleteKey(key) {
    try {
        const response = await fetch(`${API_BASE}/api/keys/delete`, {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({ key: key })
        });

        const data = await response.json();
        if (data.code === 200) {
            storedKeys = data.data;
            return true;
        } else {
            alert(data.msg || '删除失败');
            return false;
        }
    } catch (error) {
        alert('删除失败: ' + error.message);
        return false;
    }
}

// 保存Key
async function saveKey(key, name) {
    try {
        const response = await fetch(`${API_BASE}/api/keys`, {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({ key: key, name: name || '未命名Key' })
        });

        const data = await response.json();
        if (data.code === 200) {
            storedKeys = data.data;
            return true;
        } else {
            alert(data.msg || '保存失败');
            return false;
        }
    } catch (error) {
        alert('保存失败: ' + error.message);
        return false;
    }
}

// 导出数据
function exportData(filename, data) {
    const dataStr = JSON.stringify(data, null, 2);
    const blob = new Blob([dataStr], { type: 'application/json' });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = filename || `export-${new Date().toISOString().split('T')[0]}.json`;
    a.click();
    URL.revokeObjectURL(url);
}

// 验证API Key格式
function validateApiKey(key) {
    if (!key || typeof key !== 'string') {
        return { valid: false, message: 'API Key不能为空' };
    }
    key = key.trim();
    if (key.length < 10) {
        return { valid: false, message: 'API Key长度不足' };
    }
    // 智谱AI Key格式：32位字母数字 + 点号 + 16位字母数字
    const pattern = /^[a-zA-Z0-9]{32}\.[a-zA-Z0-9]{16}$/;
    if (!pattern.test(key)) {
        return { valid: false, message: 'API Key格式不正确' };
    }
    return { valid: true, message: '' };
}
