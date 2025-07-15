const { ROOM_TYPES, MAX_ROOM_MESSAGES } = require('../config/constants');

/**
 * 房间管理器
 */
class RoomManager {
    constructor() {
        this.rooms = new Map();
    }

    /**
     * 检查房间是否存在
     * @param {string} roomName - 房间名
     * @returns {boolean}
     */
    roomExists(roomName) {
        return this.rooms.has(roomName);
    }

    /**
     * 创建房间
     * @param {string} roomName - 房间名
     * @param {string} roomType - 房间类型
     * @returns {object} 房间对象
     */
    createRoom(roomName, roomType = ROOM_TYPES.NORMAL) {
        if (!this.rooms.has(roomName)) {
            const room = {
                name: roomName,
                type: roomType,
                users: new Map(),
                messages: [],
                createdAt: new Date()
            };
            
            this.rooms.set(roomName, room);
            console.log(`房间 "${roomName}" 已创建 (类型: ${roomType})`);
            return room;
        }
        return this.rooms.get(roomName);
    }

    /**
     * 获取房间
     * @param {string} roomName - 房间名
     * @returns {object|null} 房间对象
     */
    getRoom(roomName) {
        return this.rooms.get(roomName);
    }

    /**
     * 删除房间
     * @param {string} roomName - 房间名
     * @returns {boolean} 是否删除成功
     */
    deleteRoom(roomName) {
        const deleted = this.rooms.delete(roomName);
        if (deleted) {
            console.log(`房间 "${roomName}" 已删除`);
        }
        return deleted;
    }

    /**
     * 获取房间用户列表
     * @param {string} roomName - 房间名
     * @returns {Array} 用户列表
     */
    getRoomUsers(roomName) {
        const room = this.rooms.get(roomName);
        if (!room) return [];
        return Array.from(room.users.values());
    }

    /**
     * 获取房间用户数量
     * @param {string} roomName - 房间名
     * @returns {number} 用户数量
     */
    getRoomUserCount(roomName) {
        const room = this.rooms.get(roomName);
        return room ? room.users.size : 0;
    }

    /**
     * 向房间添加消息
     * @param {string} roomName - 房间名
     * @param {object} message - 消息对象
     */
    addMessageToRoom(roomName, message) {
        const room = this.rooms.get(roomName);
        if (room) {
            room.messages.push(message);
            // 限制历史消息数量
            if (room.messages.length > MAX_ROOM_MESSAGES) {
                room.messages.shift();
            }
        }
    }

    /**
     * 获取房间历史消息
     * @param {string} roomName - 房间名
     * @returns {Array} 消息列表
     */
    getRoomMessages(roomName) {
        const room = this.rooms.get(roomName);
        return room ? room.messages : [];
    }

    /**
     * 获取全局房间数量
     * @returns {number}
     */
    getGlobalRoomCount() {
        return this.rooms.size;
    }

    /**
     * 清理空房间
     */
    cleanupEmptyRooms() {
        for (let [roomName, room] of this.rooms.entries()) {
            if (room.users.size === 0) {
                this.deleteRoom(roomName);
            }
        }
    }

    /**
     * 获取所有房间
     * @returns {Map} 房间Map
     */
    getAllRooms() {
        return this.rooms;
    }
}

module.exports = RoomManager;