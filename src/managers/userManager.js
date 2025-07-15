const { MAX_USERS_PER_ROOM, ROOM_TYPES } = require('../config/constants');

/**
 * 用户管理器
 */
class UserManager {
    constructor(roomManager) {
        this.users = new Map();
        this.roomManager = roomManager;
    }

    /**
     * 用户加入房间
     * @param {object} socket - Socket对象
     * @param {string} username - 用户名
     * @param {string} roomName - 房间名
     * @returns {boolean} 是否加入成功
     */
    userJoinRoom(socket, username, roomName) {
        const room = this.roomManager.getRoom(roomName);
        if (!room) return false;
        
        // 检查房间是否已满（AI聊天室不限人数）
        if (room.type === ROOM_TYPES.NORMAL && room.users.size >= MAX_USERS_PER_ROOM) {
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
        this.users.set(socket.id, user);
        socket.join(roomName);
        
        console.log(`用户 "${username}" 加入房间 "${roomName}"`);
        return true;
    }

    /**
     * 用户离开房间
     * @param {object} socket - Socket对象
     */
    userLeaveRoom(socket) {
        const user = this.users.get(socket.id);
        if (!user) return;
        
        const room = this.roomManager.getRoom(user.roomName);
        if (room) {
            room.users.delete(socket.id);
            socket.leave(user.roomName);
            
            // 如果房间为空，删除房间
            if (room.users.size === 0) {
                this.roomManager.deleteRoom(user.roomName);
            }
        }
        
        this.users.delete(socket.id);
        console.log(`用户 "${user.username}" 离开房间 "${user.roomName}"`);
    }

    /**
     * 获取用户信息
     * @param {string} socketId - Socket ID
     * @returns {object|null} 用户对象
     */
    getUser(socketId) {
        return this.users.get(socketId);
    }

    /**
     * 获取全局在线用户数
     * @returns {number}
     */
    getGlobalUserCount() {
        return this.users.size;
    }

    /**
     * 检查用户名是否在房间中已存在
     * @param {string} username - 用户名
     * @param {string} roomName - 房间名
     * @returns {boolean}
     */
    isUsernameExistsInRoom(username, roomName) {
        const roomUsers = this.roomManager.getRoomUsers(roomName);
        return roomUsers.some(user => user.username === username);
    }

    /**
     * 获取所有用户
     * @returns {Map} 用户Map
     */
    getAllUsers() {
        return this.users;
    }
}

module.exports = UserManager;