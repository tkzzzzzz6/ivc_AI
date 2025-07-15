# 星露谷物语聊天室

一个基于Node.js和Socket.IO的局域网聊天室应用，采用星露谷物语风格的UI设计。

## 功能特点

- 局域网实时聊天
- 支持多房间聊天（每个房间最多10人）
- 星露谷物语风格的UI界面
- 用户在线状态显示
- 房间管理功能

## 安装和运行

1. 安装依赖：
```bash
npm install
```

2. 启动服务器：
```bash
npm start
```

3. 访问聊天室：
在浏览器中打开 `http://localhost:3000`

## 开发模式

使用以下命令启动开发模式（自动重启）：
```bash
npm run dev
```

## 技术栈

- 后端：Node.js + Express + Socket.IO
- 前端：HTML5 + CSS3 + JavaScript
- 实时通信：WebSocket (Socket.IO)

## 项目结构

```
ivc/
├── package.json          # 项目配置文件
├── server.js             # 后端服务器
├── public/               # 前端静态文件
│   ├── index.html        # 主页面
│   ├── style.css         # 样式文件
│   └── script.js         # 前端逻辑
├── README.md             # 项目说明
└── TEST_GUIDE.md         # 测试指南
```

## 功能特性

### 已实现功能
- ✅ 用户登录和房间管理
- ✅ 实时消息发送和接收
- ✅ 用户在线状态显示
- ✅ 房间容量限制（10人）
- ✅ 用户名重复检查
- ✅ 消息长度限制（200字符）
- ✅ 星露谷物语风格UI
- ✅ 响应式设计支持
- ✅ 系统通知功能
- ✅ 自动房间清理

### 安全特性
- 输入验证和过滤
- XSS防护
- 字符长度限制
- 房间容量控制

## 局域网部署

### 1. 获取本机IP地址

在Windows上：
```cmd
ipconfig
```

在Linux/Mac上：
```bash
ifconfig
```

### 2. 修改服务器监听地址（可选）

如果需要允许局域网访问，可以修改`server.js`：

```javascript
const PORT = process.env.PORT || 3000;
server.listen(PORT, '0.0.0.0', () => {
    console.log(`🌱 星露谷物语聊天室服务器运行在端口 ${PORT}`);
});
```

### 3. 局域网访问

其他设备通过以下地址访问：
- `http://[您的IP地址]:3000`
- 例如：`http://192.168.1.100:3000`

## 测试

查看详细测试指南：[TEST_GUIDE.md](./TEST_GUIDE.md)

### 快速测试
1. 启动服务器：`npm start`
2. 打开多个浏览器窗口
3. 使用不同用户名加入同一房间
4. 测试消息发送和接收

## 开发指南

### 添加新功能
1. 后端：在`server.js`中添加Socket.IO事件处理
2. 前端：在`script.js`中添加相应的事件监听和处理
3. 样式：在`style.css`中添加新的样式

### 调试技巧
- 打开浏览器开发者工具查看控制台日志
- 查看Network标签页的WebSocket连接状态
- 服务器端日志会显示连接和房间信息

## 常见问题

### Q: 如何修改房间最大用户数？
A: 在`server.js`中修改`MAX_USERS_PER_ROOM`常量

### Q: 如何添加消息历史记录？
A: 在房间对象中添加messages数组，并在用户加入时发送历史消息

### Q: 如何实现私聊功能？
A: 添加新的Socket.IO事件处理私聊消息，并修改前端界面

## 贡献指南

欢迎提交Issue和Pull Request！

1. Fork项目
2. 创建功能分支
3. 提交更改
4. 发起Pull Request 