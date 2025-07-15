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
    },
    
    // 音乐相关配置
    MUSIC_API: {
        URL: 'https://api.vvhan.com/api/wyMusic/%E7%83%AD%E6%AD%8C%E6%A6%9C?type=json',
        TIMEOUT: 10000, // 10秒超时
        USER_AGENT: 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/91.0.4472.124 Safari/537.36'
    },
    
    // 音乐命令
    MUSIC_COMMAND: '/music'
};