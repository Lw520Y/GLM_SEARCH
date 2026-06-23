# GLM智谱套餐Token查询工具

实时查询智谱AI套餐的Token使用量。

## 快速开始

### 1. 启动服务器

只需要启动一个服务器：

```bash
cd D:/work/gitcode/glmsearch
node proxy.js
```

### 2. 访问页面

- 查询页面：http://localhost:8085/
- 数据列表：http://localhost:8085/data.html

### 3. 使用说明

1. 在查询页面输入智谱AI的API Key
2. 点击"测试连接"检查服务器状态
3. 点击"查询使用量"获取实时数据
4. 点击"保存Key"将Key保存到服务器
5. 查询结果会自动保存到 `data/` 目录
6. 点击"数据列表"查看所有保存的记录

## 文件结构

```
glmsearch/
├── index.html          # 查询页面
├── data.html           # 数据列表页面
├── proxy.js            # 代理服务器（端口8085）
├── styles/             # 样式文件目录
│   └── common.css      # 公共样式
├── js/                 # 脚本文件目录
│   └── common.js       # 公共脚本
├── data/               # 数据存储目录（自动创建）
│   ├── keys.json       # 保存的Key列表
│   └── history.json    # 查询历史记录
└── README.md           # 说明文档
```

## 功能特点

- 实时查询Token使用量
- 支持多个Key管理
- 数据自动保存到服务器
- 支持导出JSON
- 可视化进度条展示
- 自动刷新功能
- 查询结果缓存（5分钟有效期）
- API Key格式验证
- 历史记录分页查询

## API接口

代理服务器提供以下接口：

- `GET /api/quota?key=YOUR_API_KEY` - 查询Token配额限制和使用率
- `GET /api/usage?key=YOUR_API_KEY&month=2026-06` - 查询实际Token使用量
- `GET /api/keys` - 获取所有Key
- `POST /api/keys` - 保存Key
- `POST /api/keys/delete` - 删除Key
- `GET /api/history?page=1&pageSize=50&key=KEY` - 获取历史记录（支持分页和过滤）
- `POST /api/history` - 保存历史记录
- `POST /api/history/delete` - 删除历史记录
- `GET /api/export` - 导出所有数据

## 常见问题

### 查询一直显示"正在查询中..."

1. 确保代理服务器已启动：`node proxy.js`
2. 点击"测试连接"检查服务器状态
3. 查看浏览器控制台（F12）的错误信息

### 连接失败

确保代理服务器在端口8085运行：
```bash
node proxy.js
```

### API Key格式验证

智谱AI的API Key格式为：32位字母数字 + 点号 + 16位字母数字
例如：
