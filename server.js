const express = require('express');
const http = require('http');
const socketIo = require('socket.io');
const path = require('path');

const app = express();
const server = http.createServer(app);
const io = socketIo(server);

// 静态文件服务
app.use(express.static('public'));

// 存储房间和用户数据
const rooms = new Map();
const users = new Map();

// 房间最大用户数量限制
const MAX_USERS_PER_ROOM = 10;

// 工具函数：获取房间用户列表
function getRoomUsers(roomName) {
    const room = rooms.get(roomName);
    if (!room) return [];
    return Array.from(room.users.values());
}

// 工具函数：获取房间用户数量
function getRoomUserCount(roomName) {
    const room = rooms.get(roomName);
    return room ? room.users.size : 0;
}

// 工具函数：检查房间是否存在
function roomExists(roomName) {
    return rooms.has(roomName);
}

// 工具函数：创建房间
function createRoom(roomName) {
    if (!rooms.has(roomName)) {
        rooms.set(roomName, {
            name: roomName,
            users: new Map(),
            createdAt: new Date()
        });
        console.log(`房间 "${roomName}" 已创建`);
    }
}

// 工具函数：用户加入房间
function userJoinRoom(socket, username, roomName) {
    const room = rooms.get(roomName);
    if (!room) return false;
    
    // 检查房间是否已满
    if (room.users.size >= MAX_USERS_PER_ROOM) {
        return false;
    }
    
    // 检查用户名是否已存在
    for (let user of room.users.values()) {
        if (user.username === username) {
            return false;
        }
    }
    
    // 添加用户到房间
    const user = {
        id: socket.id,
        username: username,
        roomName: roomName,
        joinedAt: new Date()
    };
    
    room.users.set(socket.id, user);
    users.set(socket.id, user);
    socket.join(roomName);
    
    console.log(`用户 "${username}" 加入房间 "${roomName}"`);
    return true;
}

// 工具函数：用户离开房间
function userLeaveRoom(socket) {
    const user = users.get(socket.id);
    if (!user) return;
    
    const room = rooms.get(user.roomName);
    if (room) {
        room.users.delete(socket.id);
        socket.leave(user.roomName);
        
        // 如果房间为空，删除房间
        if (room.users.size === 0) {
            rooms.delete(user.roomName);
            console.log(`房间 "${user.roomName}" 已删除（无用户）`);
        }
    }
    
    users.delete(socket.id);
    console.log(`用户 "${user.username}" 离开房间 "${user.roomName}"`);
}

// 工具函数：格式化消息
function formatMessage(username, message, type = 'user') {
    return {
        username: username,
        message: message,
        timestamp: new Date(),
        type: type
    };
}

// Socket.IO 连接处理
io.on('connection', (socket) => {
    console.log(`用户连接: ${socket.id}`);
    
    // 处理用户加入房间
    socket.on('join-room', (data) => {
        const { username, roomName } = data;
        
        // 验证输入
        if (!username || !roomName || username.trim() === '' || roomName.trim() === '') {
            socket.emit('join-error', { message: '用户名和房间名不能为空' });
            return;
        }
        
        // 检查用户名长度
        if (username.length > 20) {
            socket.emit('join-error', { message: '用户名不能超过20个字符' });
            return;
        }
        
        // 检查房间名长度
        if (roomName.length > 30) {
            socket.emit('join-error', { message: '房间名不能超过30个字符' });
            return;
        }
        
        // 创建房间（如果不存在）
        if (!roomExists(roomName)) {
            createRoom(roomName);
        }
        
        // 检查房间是否已满
        if (getRoomUserCount(roomName) >= MAX_USERS_PER_ROOM) {
            socket.emit('join-error', { message: '房间已满，无法加入' });
            return;
        }
        
        // 检查用户名是否已存在
        const roomUsers = getRoomUsers(roomName);
        const existingUser = roomUsers.find(user => user.username === username);
        if (existingUser) {
            socket.emit('join-error', { message: '用户名已存在，请选择其他用户名' });
            return;
        }
        
        // 用户加入房间
        if (userJoinRoom(socket, username, roomName)) {
            // 发送成功消息
            socket.emit('join-success', {
                username: username,
                roomName: roomName,
                userCount: getRoomUserCount(roomName)
            });
            
            // 向房间内其他用户广播新用户加入
            const systemMessage = formatMessage('系统', `${username} 加入了房间`, 'system');
            socket.to(roomName).emit('message', systemMessage);
            
            // 发送当前在线用户列表
            const roomUsers = getRoomUsers(roomName);
            io.to(roomName).emit('users-update', roomUsers);
            
            // 发送欢迎消息
            const welcomeMessage = formatMessage('系统', `欢迎 ${username} 来到 ${roomName} 房间！`, 'system');
            socket.emit('message', welcomeMessage);
        } else {
            socket.emit('join-error', { message: '加入房间失败' });
        }
    });
    
    // 处理用户发送消息
    socket.on('send-message', (data) => {
        const user = users.get(socket.id);
        if (!user) {
            socket.emit('error', { message: '用户未登录' });
            return;
        }
        
        const { message } = data;
        
        // 验证消息
        if (!message || message.trim() === '') {
            socket.emit('error', { message: '消息不能为空' });
            return;
        }
        
        if (message.length > 200) {
            socket.emit('error', { message: '消息不能超过200个字符' });
            return;
        }
        
        // 广播消息到房间内所有用户
        const formattedMessage = formatMessage(user.username, message.trim(), 'user');
        io.to(user.roomName).emit('message', formattedMessage);
        
        console.log(`消息来自 ${user.username} 在房间 ${user.roomName}: ${message}`);
    });
    
    // 处理用户离开房间
    socket.on('leave-room', () => {
        const user = users.get(socket.id);
        if (user) {
            // 向房间内其他用户广播用户离开
            const systemMessage = formatMessage('系统', `${user.username} 离开了房间`, 'system');
            socket.to(user.roomName).emit('message', systemMessage);
            
            // 用户离开房间
            userLeaveRoom(socket);
            
            // 更新在线用户列表
            const roomUsers = getRoomUsers(user.roomName);
            io.to(user.roomName).emit('users-update', roomUsers);
            
            // 发送离开成功消息
            socket.emit('leave-success');
        }
    });
    
    // 处理用户断开连接
    socket.on('disconnect', () => {
        const user = users.get(socket.id);
        if (user) {
            // 向房间内其他用户广播用户离开
            const systemMessage = formatMessage('系统', `${user.username} 离开了房间`, 'system');
            socket.to(user.roomName).emit('message', systemMessage);
            
            // 用户离开房间
            userLeaveRoom(socket);
            
            // 更新在线用户列表
            const roomUsers = getRoomUsers(user.roomName);
            io.to(user.roomName).emit('users-update', roomUsers);
        }
        
        console.log(`用户断开连接: ${socket.id}`);
    });
    
    // 处理获取房间统计信息
    socket.on('get-room-stats', () => {
        const totalRooms = rooms.size;
        const totalUsers = users.size;
        socket.emit('room-stats', { totalRooms, totalUsers });
    });
});

// 定期清理空房间
setInterval(() => {
    for (let [roomName, room] of rooms.entries()) {
        if (room.users.size === 0) {
            rooms.delete(roomName);
            console.log(`清理空房间: ${roomName}`);
        }
    }
}, 60000); // 每分钟清理一次

// 启动服务器
const PORT = process.env.PORT || 3000;
server.listen(PORT, () => {
    console.log(`🌱 星露谷物语聊天室服务器运行在端口 ${PORT}`);
    console.log(`📖 访问地址: http://localhost:${PORT}`);
    console.log(`🎮 房间最大用户数: ${MAX_USERS_PER_ROOM}`);
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