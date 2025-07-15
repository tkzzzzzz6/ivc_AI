const axios = require('axios');
const { MUSIC_API, MESSAGE_TYPES } = require('../config/constants');
const MessageUtils = require('../utils/messageUtils');

/**
 * 音乐处理器
 */
class MusicHandler {
    constructor(roomManager) {
        this.roomManager = roomManager;
        this.currentMusic = new Map(); // 存储每个房间当前播放的音乐
        this.syncIntervals = new Map(); // 存储每个房间的同步定时器
    }

    /**
     * 处理音乐播放请求
     * @param {string} roomName - 房间名
     * @param {string} username - 请求用户名
     * @param {object} io - Socket.IO实例
     */
    async handleMusicRequest(roomName, username, io) {
        try {
            console.log(`用户 ${username} 在房间 ${roomName} 请求播放音乐`);
            
            // 获取随机音乐
            const musicData = await this.getRandomMusic();
            
            if (musicData && musicData.success) {
                const musicInfo = musicData.info;
                
                // 停止当前播放的音乐（如果有）
                this.stopRoomMusic(roomName, io);
                
                // 存储当前房间播放的音乐状态
                const musicState = {
                    id: musicInfo.id,
                    name: musicInfo.name,
                    artist: musicInfo.auther,
                    cover: musicInfo.pic_url || musicInfo.picUrl,
                    url: musicInfo.url,
                    requestUser: username,
                    startTime: Date.now(),
                    isPlaying: true,
                    currentTime: 0,
                    duration: 0
                };
                
                this.currentMusic.set(roomName, musicState);
                
                // 发送音乐播放消息
                const musicMessage = MessageUtils.formatMessage(
                    '🎵 音乐小助手', 
                    `${username} 点播了音乐：《${musicInfo.name}》 - ${musicInfo.auther}`,
                    MESSAGE_TYPES.SYSTEM
                );
                io.to(roomName).emit('message', musicMessage);
                
                // 广播音乐数据到房间所有用户
                io.to(roomName).emit('music-play', musicState);
                
                // 存储音乐消息到房间历史
                this.roomManager.addMessageToRoom(roomName, musicMessage);
                
                // 启动同步定时器
                this.startSyncTimer(roomName, io);
                
                console.log(`音乐播放成功: ${musicInfo.name} - ${musicInfo.auther}`);
                
            } else {
                throw new Error('获取音乐数据失败');
            }
            
        } catch (error) {
            console.error('音乐播放错误:', error);
            
            // 发送错误提示
            const errorMessage = MessageUtils.formatMessage(
                '🎵 音乐小助手', 
                '抱歉，音乐服务暂时不可用，请稍后再试。',
                MESSAGE_TYPES.SYSTEM
            );
            io.to(roomName).emit('message', errorMessage);
        }
    }

    /**
     * 启动音乐同步定时器
     * @param {string} roomName - 房间名
     * @param {object} io - Socket.IO实例
     */
    startSyncTimer(roomName, io) {
        // 清除现有定时器
        this.clearSyncTimer(roomName);
        
        // 每秒同步一次播放状态
        const interval = setInterval(() => {
            const musicState = this.currentMusic.get(roomName);
            if (!musicState || !musicState.isPlaying) {
                this.clearSyncTimer(roomName);
                return;
            }
            
            // 计算当前播放时间
            const elapsed = (Date.now() - musicState.startTime) / 1000;
            musicState.currentTime = elapsed;
            
            // 广播同步信息
            io.to(roomName).emit('music-sync', {
                currentTime: musicState.currentTime,
                isPlaying: musicState.isPlaying
            });
            
        }, 1000);
        
        this.syncIntervals.set(roomName, interval);
    }

    /**
     * 清除同步定时器
     * @param {string} roomName - 房间名
     */
    clearSyncTimer(roomName) {
        const interval = this.syncIntervals.get(roomName);
        if (interval) {
            clearInterval(interval);
            this.syncIntervals.delete(roomName);
        }
    }

    /**
     * 处理音乐播放/暂停切换
     * @param {string} roomName - 房间名
     * @param {string} username - 操作用户名
     * @param {object} io - Socket.IO实例
     */
    handleMusicToggle(roomName, username, io) {
        const musicState = this.currentMusic.get(roomName);
        if (!musicState) return;
        
        musicState.isPlaying = !musicState.isPlaying;
        
        if (musicState.isPlaying) {
            // 恢复播放时更新开始时间
            musicState.startTime = Date.now() - (musicState.currentTime * 1000);
            this.startSyncTimer(roomName, io);
        } else {
            // 暂停时停止同步定时器
            this.clearSyncTimer(roomName);
        }
        
        // 广播播放状态变化
        io.to(roomName).emit('music-toggle', {
            isPlaying: musicState.isPlaying,
            currentTime: musicState.currentTime,
            username: username
        });
        
        // 发送系统消息
        const action = musicState.isPlaying ? '继续播放' : '暂停了';
        const toggleMessage = MessageUtils.formatMessage(
            '🎵 音乐小助手', 
            `${username} ${action}音乐`,
            MESSAGE_TYPES.SYSTEM
        );
        io.to(roomName).emit('message', toggleMessage);
    }

    /**
     * 停止房间音乐播放
     * @param {string} roomName - 房间名
     * @param {object} io - Socket.IO实例
     */
    stopRoomMusic(roomName, io) {
        if (this.currentMusic.has(roomName)) {
            this.clearSyncTimer(roomName);
            this.currentMusic.delete(roomName);
            io.to(roomName).emit('music-stop');
        }
    }

    /**
     * 获取房间当前音乐状态（用于新用户加入时同步）
     * @param {string} roomName - 房间名
     * @returns {object|null} 音乐状态
     */
    getRoomMusicState(roomName) {
        const musicState = this.currentMusic.get(roomName);
        if (!musicState) return null;
        
        // 更新当前播放时间
        if (musicState.isPlaying) {
            musicState.currentTime = (Date.now() - musicState.startTime) / 1000;
        }
        
        return musicState;
    }

    /**
     * 从API获取随机音乐
     * @returns {Promise<object>} 音乐数据
     */
    async getRandomMusic() {
        try {
            const response = await axios.get(MUSIC_API.URL, {
                timeout: MUSIC_API.TIMEOUT,
                headers: {
                    'User-Agent': MUSIC_API.USER_AGENT,
                    'Accept': 'application/json',
                    'Accept-Language': 'zh-CN,zh;q=0.9,en;q=0.8',
                    'Accept-Encoding': 'gzip, deflate, br',
                    'Connection': 'keep-alive',
                    'Upgrade-Insecure-Requests': '1'
                }
            });
            
            if (response.status === 200 && response.data) {
                return response.data;
            } else {
                throw new Error(`API请求失败: ${response.status}`);
            }
            
        } catch (error) {
            if (error.code === 'ECONNABORTED') {
                throw new Error('音乐API请求超时');
            } else if (error.response) {
                throw new Error(`音乐API错误: ${error.response.status} ${error.response.statusText}`);
            } else if (error.request) {
                throw new Error('无法连接到音乐服务');
            } else {
                throw new Error(`音乐请求失败: ${error.message}`);
            }
        }
    }

    /**
     * 获取房间当前播放的音乐
     * @param {string} roomName - 房间名
     * @returns {object|null} 音乐信息
     */
    getCurrentMusic(roomName) {
        return this.currentMusic.get(roomName);
    }

    /**
     * 停止房间音乐播放
     * @param {string} roomName - 房间名
     * @param {object} io - Socket.IO实例
     */
    stopMusic(roomName, io) {
        this.stopRoomMusic(roomName, io);
        
        const stopMessage = MessageUtils.formatMessage(
            '🎵 音乐小助手', 
            '音乐播放已停止',
            MESSAGE_TYPES.SYSTEM
        );
        io.to(roomName).emit('message', stopMessage);
    }

    /**
     * 清理房间音乐数据
     * @param {string} roomName - 房间名
     */
    clearRoomMusic(roomName) {
        this.clearSyncTimer(roomName);
        this.currentMusic.delete(roomName);
    }

    /**
     * 获取音乐播放统计
     * @returns {object} 统计信息
     */
    getMusicStats() {
        return {
            activeRooms: this.currentMusic.size,
            totalRequests: 0 // 可以在后续版本中添加计数器
        };
    }
}

module.exports = MusicHandler;