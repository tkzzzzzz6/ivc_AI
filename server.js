const express = require('express');
const http = require('http');
const socketIo = require('socket.io');
const path = require('path');
const { spawn } = require('child_process');

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
function createRoom(roomName, roomType = 'normal') {
    if (!rooms.has(roomName)) {
        rooms.set(roomName, {
            name: roomName,
            type: roomType,
            users: new Map(),
            messages: [], // 存储房间的聊天记录
            createdAt: new Date()
        });
        console.log(`房间 "${roomName}" 已创建 (类型: ${roomType})`);
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

// 工具函数：获取全局在线用户数
function getGlobalUserCount() {
    return users.size;
}

// 工具函数：获取全局房间数
function getGlobalRoomCount() {
    return rooms.size;
}

// 工具函数：广播全局统计信息
function broadcastGlobalStats() {
    const globalStats = {
        totalUsers: getGlobalUserCount(),
        totalRooms: getGlobalRoomCount()
    };
    console.log(`📊 广播全局统计: 总用户数=${globalStats.totalUsers}, 总房间数=${globalStats.totalRooms}`);
    io.emit('global-stats', globalStats);
}

// AI聊天历史记录
const aiChatHistory = new Map();

// 处理AI回复
async function handleAIResponse(roomName, userMessage) {
    try {
        // 获取或创建该房间的AI聊天历史
        if (!aiChatHistory.has(roomName)) {
            aiChatHistory.set(roomName, []);
        }
        
        const history = aiChatHistory.get(roomName);
        
        // 添加用户消息到历史
        history.push({ role: 'user', content: userMessage });
        
        // 限制历史记录长度
        if (history.length > 20) {
            history.splice(0, 2); // 删除最旧的一对对话
        }
        
        // 调用Python脚本处理AI回复
        const aiResponse = await callPythonAI(userMessage, history);
        
        if (aiResponse) {
            // 添加AI回复到历史
            history.push({ role: 'assistant', content: aiResponse });
            
            // 格式化AI回复消息
            const aiMessage = formatMessage('🤖 AI助手', aiResponse, 'ai');
            
            // 广播AI回复到房间
            io.to(roomName).emit('message', aiMessage);
            
            // 存储AI回复到房间历史
            const room = rooms.get(roomName);
            if (room) {
                room.messages.push(aiMessage);
                if (room.messages.length > 50) {
                    room.messages.shift();
                }
            }
            
            console.log(`AI回复在房间 ${roomName}: ${aiResponse}`);
        }
    } catch (error) {
        console.error('AI处理错误:', error);
        
        // 发送错误提示
        const errorMessage = formatMessage('🤖 AI助手', '抱歉，我现在无法回复，请稍后再试。', 'system');
        io.to(roomName).emit('message', errorMessage);
    }
}

// 调用Python AI脚本
function callPythonAI(message, history) {
    return new Promise((resolve, reject) => {
        // 创建Python脚本进程，设置编码
        const pythonProcess = spawn('python', ['ai_chat_handler.py'], {
            stdio: ['pipe', 'pipe', 'pipe'],
            encoding: 'utf8',
            env: {
                ...process.env,
                PYTHONIOENCODING: 'utf-8'
            }
        });
        
        let output = '';
        let errorOutput = '';
        
        // 设置流编码
        pythonProcess.stdout.setEncoding('utf8');
        pythonProcess.stderr.setEncoding('utf8');
        pythonProcess.stdin.setDefaultEncoding('utf8');
        
        // 准备发送给Python脚本的数据
        const inputData = {
            message: message,
            history: history
        };
        
        // 监听输出
        pythonProcess.stdout.on('data', (data) => {
            output += data;
        });
        
        // 监听错误
        pythonProcess.stderr.on('data', (data) => {
            errorOutput += data;
        });
        
        // 处理完成
        pythonProcess.on('close', (code) => {
            if (code === 0) {
                try {
                    // 解析Python脚本的输出
                    const result = JSON.parse(output.trim());
                    resolve(result.response);
                } catch (parseError) {
                    reject(new Error('解析AI回复失败: ' + parseError.message));
                }
            } else {
                reject(new Error('Python脚本执行失败: ' + errorOutput));
            }
        });
        
        // 处理错误
        pythonProcess.on('error', (error) => {
            reject(new Error('无法启动Python脚本: ' + error.message));
        });
        
        // 发送数据给Python脚本（确保UTF-8编码）
        pythonProcess.stdin.write(JSON.stringify(inputData, null, 0), 'utf8');
        pythonProcess.stdin.end();
        
        // 设置超时
        setTimeout(() => {
            pythonProcess.kill();
            reject(new Error('AI回复超时'));
        }, 30000); // 30秒超时
    });
}

// Socket.IO 连接处理
io.on('connection', (socket) => {
    console.log(`用户连接: ${socket.id}`);
    
    // 发送全局统计信息给新连接的用户
    socket.emit('global-stats', {
        totalUsers: getGlobalUserCount(),
        totalRooms: getGlobalRoomCount()
    });
    
    // 处理用户加入房间
    socket.on('join-room', (data) => {
        const { username, roomName, roomType = 'normal' } = data;
        
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
            createRoom(roomName, roomType);
        }
        
        // 检查房间是否已满（AI聊天室不限人数）
        if (roomType === 'normal' && getRoomUserCount(roomName) >= MAX_USERS_PER_ROOM) {
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
            // 获取房间对象
            const room = rooms.get(roomName);
            
            // 发送成功消息
            socket.emit('join-success', {
                username: username,
                roomName: roomName,
                userCount: getRoomUserCount(roomName)
            });
            
            // 向房间内其他用户广播新用户加入
            const systemMessage = formatMessage('系统', `${username} 加入了房间`, 'system');
            socket.to(roomName).emit('message', systemMessage);
            
            // 向房间内其他用户发送房间通知
            socket.to(roomName).emit('room-notification', {
                type: 'join',
                username: username,
                roomName: roomName
            });
            
            // 将系统消息存储到房间历史记录中
            if (room) {
                room.messages.push(systemMessage);
                // 限制历史消息数量，保留最近的50条消息
                if (room.messages.length > 50) {
                    room.messages.shift();
                }
            }
            
            // 发送当前在线用户列表
            const roomUsers = getRoomUsers(roomName);
            io.to(roomName).emit('users-update', roomUsers);
            
            // 发送历史消息
            if (room && room.messages.length > 0) {
                socket.emit('history-messages', room.messages);
            }
            
            // 发送欢迎消息
            const welcomeMessage = formatMessage('系统', `欢迎 ${username} 来到 ${roomName} 房间！`, 'system');
            socket.emit('message', welcomeMessage);
            
            // 广播全局统计信息更新
            broadcastGlobalStats();
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
        
        // 将消息存储到房间历史记录中
        const room = rooms.get(user.roomName);
        if (room) {
            room.messages.push(formattedMessage);
            // 限制历史消息数量，保留最近的50条消息
            if (room.messages.length > 50) {
                room.messages.shift();
            }
        }
        
        console.log(`消息来自 ${user.username} 在房间 ${user.roomName}: ${message}`);
        
        // 如果是AI聊天室且消息以/model开头，调用AI处理
        if (room && room.type === 'ai' && message.trim().startsWith('/model ')) {
            // 提取真正的消息内容（去掉/model前缀）
            const aiMessage = message.trim().substring(7); // 去掉'/model '（7个字符）
            if (aiMessage.length > 0) {
                handleAIResponse(user.roomName, aiMessage);
            }
        }
    });
    
    // 处理用户离开房间
    socket.on('leave-room', () => {
        const user = users.get(socket.id);
        if (user) {
            // 向房间内其他用户广播用户离开
            const systemMessage = formatMessage('系统', `${user.username} 离开了房间`, 'system');
            socket.to(user.roomName).emit('message', systemMessage);
            
            // 向房间内其他用户发送房间通知
            socket.to(user.roomName).emit('room-notification', {
                type: 'leave',
                username: user.username,
                roomName: user.roomName
            });
            
            // 用户离开房间
            userLeaveRoom(socket);
            
            // 更新在线用户列表
            const roomUsers = getRoomUsers(user.roomName);
            io.to(user.roomName).emit('users-update', roomUsers);
            
            // 发送离开成功消息
            socket.emit('leave-success');
            
            // 广播全局统计信息更新
            broadcastGlobalStats();
        }
    });
    
    // 处理用户断开连接
    socket.on('disconnect', () => {
        const user = users.get(socket.id);
        if (user) {
            // 向房间内其他用户广播用户离开
            const systemMessage = formatMessage('系统', `${user.username} 离开了房间`, 'system');
            socket.to(user.roomName).emit('message', systemMessage);
            
            // 向房间内其他用户发送房间通知
            socket.to(user.roomName).emit('room-notification', {
                type: 'leave',
                username: user.username,
                roomName: user.roomName
            });
            
            // 用户离开房间
            userLeaveRoom(socket);
            
            // 更新在线用户列表
            const roomUsers = getRoomUsers(user.roomName);
            io.to(user.roomName).emit('users-update', roomUsers);
            
            // 广播全局统计信息更新
            broadcastGlobalStats();
        }
        
        console.log(`用户断开连接: ${socket.id}`);
    });
    
    // 处理获取房间统计信息（已废弃，使用全局统计）
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