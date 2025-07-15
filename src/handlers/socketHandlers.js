const { 
    MAX_USERNAME_LENGTH, 
    MAX_ROOMNAME_LENGTH, 
    MAX_MESSAGE_LENGTH,
    MAX_USERS_PER_ROOM,
    ROOM_TYPES,
    MESSAGE_TYPES,
    MUSIC_COMMAND
} = require('../config/constants');
const MessageUtils = require('../utils/messageUtils');

/**
 * Socket事件处理器
 */
class SocketHandlers {
    constructor(roomManager, userManager, aiHandler, musicHandler) {
        this.roomManager = roomManager;
        this.userManager = userManager;
        this.aiHandler = aiHandler;
        this.musicHandler = musicHandler;
    }

    /**
     * 处理用户连接
     * @param {object} socket - Socket对象
     * @param {object} io - Socket.IO实例
     */
    handleConnection(socket, io) {
        console.log(`用户连接: ${socket.id}`);
        
        // 发送全局统计信息给新连接的用户
        socket.emit('global-stats', {
            totalUsers: this.userManager.getGlobalUserCount(),
            totalRooms: this.roomManager.getGlobalRoomCount()
        });
    }

    /**
     * 处理用户加入房间
     * @param {object} socket - Socket对象
     * @param {object} data - 请求数据
     * @param {object} io - Socket.IO实例
     */
    handleJoinRoom(socket, data, io) {
        const { username, roomName, roomType = ROOM_TYPES.NORMAL } = data;
        
        // 验证用户名
        const usernameValidation = MessageUtils.validateUsername(username, MAX_USERNAME_LENGTH);
        if (!usernameValidation.valid) {
            socket.emit('join-error', { message: usernameValidation.error });
            return;
        }
        
        // 验证房间名
        const roomNameValidation = MessageUtils.validateRoomName(roomName, MAX_ROOMNAME_LENGTH);
        if (!roomNameValidation.valid) {
            socket.emit('join-error', { message: roomNameValidation.error });
            return;
        }
        
        // 创建房间（如果不存在）
        if (!this.roomManager.roomExists(roomName)) {
            this.roomManager.createRoom(roomName, roomType);
        }
        
        // 检查房间是否已满（AI聊天室不限人数）
        const room = this.roomManager.getRoom(roomName);
        if (room.type === ROOM_TYPES.NORMAL && this.roomManager.getRoomUserCount(roomName) >= MAX_USERS_PER_ROOM) {
            socket.emit('join-error', { message: '房间已满，无法加入' });
            return;
        }
        
        // 检查用户名是否已存在
        if (this.userManager.isUsernameExistsInRoom(username, roomName)) {
            socket.emit('join-error', { message: '用户名已存在，请选择其他用户名' });
            return;
        }
        
        // 用户加入房间
        if (this.userManager.userJoinRoom(socket, username, roomName)) {
            // 发送成功消息
            socket.emit('join-success', {
                username: username,
                roomName: roomName,
                userCount: this.roomManager.getRoomUserCount(roomName)
            });
            
            // 向房间内其他用户广播新用户加入
            const systemMessage = MessageUtils.formatMessage('系统', `${username} 加入了房间`, MESSAGE_TYPES.SYSTEM);
            socket.to(roomName).emit('message', systemMessage);
            
            // 向房间内其他用户发送房间通知
            socket.to(roomName).emit('room-notification', {
                type: 'join',
                username: username,
                roomName: roomName
            });
            
            // 将系统消息存储到房间历史记录中
            this.roomManager.addMessageToRoom(roomName, systemMessage);
            
            // 发送当前在线用户列表
            const roomUsers = this.roomManager.getRoomUsers(roomName);
            io.to(roomName).emit('users-update', roomUsers);
            
            // 发送历史消息
            const messages = this.roomManager.getRoomMessages(roomName);
            if (messages.length > 0) {
                socket.emit('history-messages', messages);
            }
            
            // 发送欢迎消息
            const welcomeMessage = MessageUtils.formatMessage('系统', `欢迎 ${username} 来到 ${roomName} 房间！`, MESSAGE_TYPES.SYSTEM);
            socket.emit('message', welcomeMessage);
            
            // 如果是AI聊天室，发送使用说明
            if (room.type === ROOM_TYPES.AI) {
                const aiWelcomeMessage = MessageUtils.formatMessage('🤖 AI助手', '您好！我是AI助手。使用 "/model 您的问题" 格式与我对话。例如：/model 你好', MESSAGE_TYPES.SYSTEM);
                socket.emit('message', aiWelcomeMessage);
            }
            
            // 广播全局统计信息更新
            this.broadcastGlobalStats(io);
        } else {
            socket.emit('join-error', { message: '加入房间失败' });
        }
    }

    /**
     * 处理用户发送消息
     * @param {object} socket - Socket对象
     * @param {object} data - 消息数据
     * @param {object} io - Socket.IO实例
     */
    handleSendMessage(socket, data, io) {
        const user = this.userManager.getUser(socket.id);
        if (!user) {
            socket.emit('error', { message: '用户未登录' });
            return;
        }
        
        const { message } = data;
        
        // 验证消息
        const messageValidation = MessageUtils.validateMessage(message, MAX_MESSAGE_LENGTH);
        if (!messageValidation.valid) {
            socket.emit('error', { message: messageValidation.error });
            return;
        }
        
        const trimmedMessage = message.trim();
        
        // 检查是否是音乐命令
        if (trimmedMessage === MUSIC_COMMAND) {
            this.musicHandler.handleMusicRequest(user.roomName, user.username, io);
            return;
        }
        
        // 广播消息到房间内所有用户
        const formattedMessage = MessageUtils.formatMessage(user.username, trimmedMessage, MESSAGE_TYPES.USER);
        io.to(user.roomName).emit('message', formattedMessage);
        
        // 将消息存储到房间历史记录中
        this.roomManager.addMessageToRoom(user.roomName, formattedMessage);
        
        console.log(`消息来自 ${user.username} 在房间 ${user.roomName}: ${message}`);
        
        // 如果是AI聊天室且消息以/model开头，调用AI处理
        const room = this.roomManager.getRoom(user.roomName);
        if (room && room.type === ROOM_TYPES.AI && trimmedMessage.startsWith('/model ')) {
            // 提取真正的消息内容（去掉/model前缀）
            const aiMessage = trimmedMessage.substring(7); // 去掉'/model '（7个字符）
            if (aiMessage.length > 0) {
                this.aiHandler.handleAIResponse(user.roomName, aiMessage, io);
            }
        }
    }

    /**
     * 处理用户离开房间
     * @param {object} socket - Socket对象
     * @param {object} io - Socket.IO实例
     */
    handleLeaveRoom(socket, io) {
        const user = this.userManager.getUser(socket.id);
        if (user) {
            // 向房间内其他用户广播用户离开
            const systemMessage = MessageUtils.formatMessage('系统', `${user.username} 离开了房间`, MESSAGE_TYPES.SYSTEM);
            socket.to(user.roomName).emit('message', systemMessage);
            
            // 向房间内其他用户发送房间通知
            socket.to(user.roomName).emit('room-notification', {
                type: 'leave',
                username: user.username,
                roomName: user.roomName
            });
            
            const roomName = user.roomName;
            
            // 用户离开房间
            this.userManager.userLeaveRoom(socket);
            
            // 更新在线用户列表
            const roomUsers = this.roomManager.getRoomUsers(roomName);
            io.to(roomName).emit('users-update', roomUsers);
            
            // 发送离开成功消息
            socket.emit('leave-success');
            
            // 广播全局统计信息更新
            this.broadcastGlobalStats(io);
        }
    }

    /**
     * 处理用户断开连接
     * @param {object} socket - Socket对象
     * @param {object} io - Socket.IO实例
     */
    handleDisconnect(socket, io) {
        const user = this.userManager.getUser(socket.id);
        if (user) {
            // 向房间内其他用户广播用户离开
            const systemMessage = MessageUtils.formatMessage('系统', `${user.username} 离开了房间`, MESSAGE_TYPES.SYSTEM);
            socket.to(user.roomName).emit('message', systemMessage);
            
            // 向房间内其他用户发送房间通知
            socket.to(user.roomName).emit('room-notification', {
                type: 'leave',
                username: user.username,
                roomName: user.roomName
            });
            
            const roomName = user.roomName;
            
            // 用户离开房间
            this.userManager.userLeaveRoom(socket);
            
            // 更新在线用户列表
            const roomUsers = this.roomManager.getRoomUsers(roomName);
            io.to(roomName).emit('users-update', roomUsers);
            
            // 广播全局统计信息更新
            this.broadcastGlobalStats(io);
        }
        
        console.log(`用户断开连接: ${socket.id}`);
    }

    /**
     * 处理获取房间统计信息
     * @param {object} socket - Socket对象
     */
    handleGetRoomStats(socket) {
        const totalRooms = this.roomManager.getGlobalRoomCount();
        const totalUsers = this.userManager.getGlobalUserCount();
        socket.emit('room-stats', { totalRooms, totalUsers });
    }

    /**
     * 广播全局统计信息
     * @param {object} io - Socket.IO实例
     */
    broadcastGlobalStats(io) {
        const globalStats = {
            totalUsers: this.userManager.getGlobalUserCount(),
            totalRooms: this.roomManager.getGlobalRoomCount()
        };
        console.log(`📊 广播全局统计: 总用户数=${globalStats.totalUsers}, 总房间数=${globalStats.totalRooms}`);
        io.emit('global-stats', globalStats);
    }
}

module.exports = SocketHandlers;