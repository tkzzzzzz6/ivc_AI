// 应用配置常量
module.exports = {
    // 房间配置
    MAX_USERS_PER_ROOM: 10,
    MAX_ROOM_MESSAGES: 50,
    
    // 用户配置
    MAX_USERNAME_LENGTH: 20,
    MAX_ROOMNAME_LENGTH: 30,
    MAX_MESSAGE_LENGTH: 200,
    
    // AI配置
    MAX_AI_HISTORY_LENGTH: 20,
    AI_TIMEOUT: 30000, // 30秒
    
    // 系统配置
    ROOM_CLEANUP_INTERVAL: 60000, // 1分钟
    
    // 消息类型
    MESSAGE_TYPES: {
        USER: 'user',
        SYSTEM: 'system',
        AI: 'ai'
    },
    
    // 房间类型
    ROOM_TYPES: {
        NORMAL: 'normal',
        AI: 'ai'
    }
};