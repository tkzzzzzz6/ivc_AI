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
                
                // 存储当前房间播放的音乐
                this.currentMusic.set(roomName, {
                    ...musicInfo,
                    startTime: Date.now(),
                    requestUser: username
                });
                
                // 发送音乐播放消息
                const musicMessage = MessageUtils.formatMessage(
                    '🎵 音乐小助手', 
                    `${username} 点播了音乐：《${musicInfo.name}》 - ${musicInfo.auther}`,
                    MESSAGE_TYPES.SYSTEM
                );
                io.to(roomName).emit('message', musicMessage);
                
                // 广播音乐数据到房间所有用户
                io.to(roomName).emit('music-play', {
                    id: musicInfo.id,
                    name: musicInfo.name,
                    artist: musicInfo.auther,
                    cover: musicInfo.picUrl,
                    url: musicInfo.url,
                    requestUser: username
                });
                
                // 存储音乐消息到房间历史
                this.roomManager.addMessageToRoom(roomName, musicMessage);
                
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
        if (this.currentMusic.has(roomName)) {
            this.currentMusic.delete(roomName);
            io.to(roomName).emit('music-stop');
            
            const stopMessage = MessageUtils.formatMessage(
                '🎵 音乐小助手', 
                '音乐播放已停止',
                MESSAGE_TYPES.SYSTEM
            );
            io.to(roomName).emit('message', stopMessage);
        }
    }

    /**
     * 清理房间音乐数据
     * @param {string} roomName - 房间名
     */
    clearRoomMusic(roomName) {
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