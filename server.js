const express = require('express');
const http = require('http');
const socketIo = require('socket.io');

// 导入模块
const { ROOM_CLEANUP_INTERVAL } = require('./src/config/constants');
const RoomManager = require('./src/managers/roomManager');
const UserManager = require('./src/managers/userManager');
const AIHandler = require('./src/handlers/aiHandler');
const MusicHandler = require('./src/handlers/musicHandler');
const SocketHandlers = require('./src/handlers/socketHandlers');

// 创建Express应用和服务器
const app = express();
const server = http.createServer(app);
const io = socketIo(server);

// 静态文件服务
app.use(express.static('public'));

// 初始化管理器和处理器
const roomManager = new RoomManager();
const userManager = new UserManager(roomManager);
const aiHandler = new AIHandler(roomManager);
const musicHandler = new MusicHandler(roomManager);
const socketHandlers = new SocketHandlers(roomManager, userManager, aiHandler, musicHandler);

// Socket.IO 连接处理
io.on('connection', (socket) => {
    // 处理用户连接
    socketHandlers.handleConnection(socket, io);
    
    // 处理用户加入房间
    socket.on('join-room', (data) => {
        socketHandlers.handleJoinRoom(socket, data, io);
    });
    
    // 处理用户发送消息
    socket.on('send-message', (data) => {
        socketHandlers.handleSendMessage(socket, data, io);
    });
    
    // 处理用户离开房间
    socket.on('leave-room', () => {
        socketHandlers.handleLeaveRoom(socket, io);
    });
    
    // 处理用户断开连接
    socket.on('disconnect', () => {
        socketHandlers.handleDisconnect(socket, io);
    });
    
    // 处理获取房间统计信息（已废弃，使用全局统计）
    socket.on('get-room-stats', () => {
        socketHandlers.handleGetRoomStats(socket);
    });
});

// 定期清理空房间
setInterval(() => {
    roomManager.cleanupEmptyRooms();
}, ROOM_CLEANUP_INTERVAL);

// 启动服务器
const PORT = process.env.PORT || 3000;
server.listen(PORT, () => {
    console.log(`🌱 星露谷物语聊天室服务器运行在端口 ${PORT}`);
    console.log(`📖 访问地址: http://localhost:${PORT}`);
    console.log(`🎮 项目已模块化重构完成`);
});

// 优雅关闭
process.on('SIGINT', () => {
    console.log('\n📴 正在关闭服务器...');
    server.close(() => {
        console.log('✅ 服务器已关闭');
        process.exit(0);
    });
});

// 错误处理
process.on('uncaughtException', (error) => {
    console.error('❌ 未捕获的异常:', error);
});

process.on('unhandledRejection', (reason, promise) => {
    console.error('❌ 未处理的Promise拒绝:', reason);
});