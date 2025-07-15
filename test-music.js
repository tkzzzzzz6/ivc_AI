// 音乐功能测试脚本
const axios = require('axios');
const MusicHandler = require('./src/handlers/musicHandler');
const RoomManager = require('./src/managers/roomManager');

async function testMusicAPI() {
    console.log('🎵 开始测试音乐API...');
    
    try {
        const response = await axios.get('https://api.vvhan.com/api/wyMusic/%E7%83%AD%E6%AD%8C%E6%A6%9C?type=json', {
            timeout: 10000,
            headers: {
                'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/91.0.4472.124 Safari/537.36'
            }
        });
        
        if (response.data && response.data.success) {
            console.log('✅ API测试成功!');
            console.log(`🎶 歌曲: ${response.data.info.name}`);
            console.log(`🎤 歌手: ${response.data.info.auther}`);
            console.log(`🔗 链接: ${response.data.info.url}`);
            
            // 测试音乐处理器
            console.log('\n🔧 测试音乐处理器...');
            const roomManager = new RoomManager();
            const musicHandler = new MusicHandler(roomManager);
            
            // 创建测试房间
            roomManager.createRoom('测试房间');
            
            // 模拟IO对象
            const mockIO = {
                to: (roomName) => ({
                    emit: (event, data) => {
                        console.log(`📡 向房间 ${roomName} 发送事件: ${event}`);
                        if (event === 'music-play') {
                            console.log(`🎵 播放音乐: ${data.name} - ${data.artist}`);
                        }
                    }
                })
            };
            
            // 测试音乐请求处理
            await musicHandler.handleMusicRequest('测试房间', '测试用户', mockIO);
            
            console.log('\n🎉 音乐功能测试完成!');
            
        } else {
            console.log('❌ API返回失败:', response.data);
        }
        
    } catch (error) {
        console.error('❌ 测试失败:', error.message);
    }
}

testMusicAPI();