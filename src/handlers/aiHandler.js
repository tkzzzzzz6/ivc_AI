const { spawn } = require('child_process');
const { MAX_AI_HISTORY_LENGTH, AI_TIMEOUT, MESSAGE_TYPES } = require('../config/constants');
const MessageUtils = require('../utils/messageUtils');

/**
 * AI处理器
 */
class AIHandler {
    constructor(roomManager) {
        this.roomManager = roomManager;
        this.aiChatHistory = new Map();
    }

    /**
     * 处理AI回复
     * @param {string} roomName - 房间名
     * @param {string} userMessage - 用户消息
     * @param {object} io - Socket.IO实例
     */
    async handleAIResponse(roomName, userMessage, io) {
        try {
            // 获取或创建该房间的AI聊天历史
            if (!this.aiChatHistory.has(roomName)) {
                this.aiChatHistory.set(roomName, []);
            }
            
            const history = this.aiChatHistory.get(roomName);
            
            // 添加用户消息到历史
            history.push({ role: 'user', content: userMessage });
            
            // 限制历史记录长度
            if (history.length > MAX_AI_HISTORY_LENGTH) {
                history.splice(0, 2); // 删除最旧的一对对话
            }
            
            // 调用Python脚本处理AI回复
            const aiResponse = await this.callPythonAI(userMessage, history);
            
            if (aiResponse) {
                // 添加AI回复到历史
                history.push({ role: 'assistant', content: aiResponse });
                
                // 格式化AI回复消息
                const aiMessage = MessageUtils.formatMessage('🤖 AI助手', aiResponse, MESSAGE_TYPES.AI);
                
                // 广播AI回复到房间
                io.to(roomName).emit('message', aiMessage);
                
                // 存储AI回复到房间历史
                this.roomManager.addMessageToRoom(roomName, aiMessage);
                
                console.log(`AI回复在房间 ${roomName}: ${aiResponse}`);
            }
        } catch (error) {
            console.error('AI处理错误:', error);
            
            // 发送错误提示
            const errorMessage = MessageUtils.formatMessage('🤖 AI助手', '抱歉，我现在无法回复，请稍后再试。', MESSAGE_TYPES.SYSTEM);
            io.to(roomName).emit('message', errorMessage);
        }
    }

    /**
     * 调用Python AI脚本
     * @param {string} message - 用户消息
     * @param {Array} history - 对话历史
     * @returns {Promise<string>} AI回复
     */
    callPythonAI(message, history) {
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
            }, AI_TIMEOUT);
        });
    }

    /**
     * 清除房间的AI聊天历史
     * @param {string} roomName - 房间名
     */
    clearRoomHistory(roomName) {
        this.aiChatHistory.delete(roomName);
    }

    /**
     * 获取房间的AI聊天历史
     * @param {string} roomName - 房间名
     * @returns {Array} 聊天历史
     */
    getRoomHistory(roomName) {
        return this.aiChatHistory.get(roomName) || [];
    }
}

module.exports = AIHandler;