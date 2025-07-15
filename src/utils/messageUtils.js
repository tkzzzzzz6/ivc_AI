const { MESSAGE_TYPES } = require('../config/constants');

/**
 * 消息工具类
 */
class MessageUtils {
    /**
     * 格式化消息
     * @param {string} username - 用户名
     * @param {string} message - 消息内容
     * @param {string} type - 消息类型
     * @returns {object} 格式化后的消息对象
     */
    static formatMessage(username, message, type = MESSAGE_TYPES.USER) {
        return {
            username: username,
            message: message,
            timestamp: new Date(),
            type: type
        };
    }

    /**
     * 验证消息输入
     * @param {string} message - 消息内容（应该已经trim过）
     * @param {number} maxLength - 最大长度
     * @returns {object} 验证结果
     */
    static validateMessage(message, maxLength) {
        // 检查消息是否为空（假设传入的message已经被trim过）
        if (!message || message === '') {
            return { valid: false, error: '消息不能为空' };
        }
        
        if (message.length > maxLength) {
            return { valid: false, error: `消息不能超过${maxLength}个字符` };
        }
        
        return { valid: true };
    }

    /**
     * 验证用户名
     * @param {string} username - 用户名
     * @param {number} maxLength - 最大长度
     * @returns {object} 验证结果
     */
    static validateUsername(username, maxLength) {
        if (!username || username.trim() === '') {
            return { valid: false, error: '用户名不能为空' };
        }
        
        if (username.length > maxLength) {
            return { valid: false, error: `用户名不能超过${maxLength}个字符` };
        }
        
        return { valid: true };
    }

    /**
     * 验证房间名
     * @param {string} roomName - 房间名
     * @param {number} maxLength - 最大长度
     * @returns {object} 验证结果
     */
    static validateRoomName(roomName, maxLength) {
        if (!roomName || roomName.trim() === '') {
            return { valid: false, error: '房间名不能为空' };
        }
        
        if (roomName.length > maxLength) {
            return { valid: false, error: `房间名不能超过${maxLength}个字符` };
        }
        
        return { valid: true };
    }
}

module.exports = MessageUtils;