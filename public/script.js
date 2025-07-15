// 星露谷物语聊天室前端逻辑
class ChatRoom {
    constructor() {
        this.socket = null;
        this.currentUser = null;
        this.currentRoom = null;
        this.init();
    }

    init() {
        // 获取DOM元素
        this.loginScreen = document.getElementById('login-screen');
        this.chatScreen = document.getElementById('chat-screen');
        this.usernameInput = document.getElementById('username');
        this.roomNameInput = document.getElementById('room-name');
        this.joinBtn = document.getElementById('join-btn');
        this.messageInput = document.getElementById('message-input');
        this.sendBtn = document.getElementById('send-btn');
        this.leaveBtn = document.getElementById('leave-btn');
        this.messagesContainer = document.getElementById('messages');
        this.usersListContainer = document.getElementById('users-list');
        this.usernameDisplay = document.getElementById('username-display');
        this.userCountDisplay = document.getElementById('user-count');
        this.currentRoomDisplay = document.getElementById('current-room');
        this.roomUsersCountDisplay = document.getElementById('room-users-count');
        this.notificationContainer = document.getElementById('notification');

        // 绑定事件
        this.bindEvents();
        
        // 初始化Socket.IO连接
        this.initSocket();
    }

    bindEvents() {
        // 登录相关事件
        this.joinBtn.addEventListener('click', () => this.joinRoom());
        this.usernameInput.addEventListener('keypress', (e) => {
            if (e.key === 'Enter') this.joinRoom();
        });
        this.roomNameInput.addEventListener('keypress', (e) => {
            if (e.key === 'Enter') this.joinRoom();
        });

        // 聊天相关事件
        this.sendBtn.addEventListener('click', () => this.sendMessage());
        this.messageInput.addEventListener('keypress', (e) => {
            if (e.key === 'Enter') this.sendMessage();
        });
        this.leaveBtn.addEventListener('click', () => this.leaveRoom());

        // 房间类型选择事件
        document.querySelectorAll('input[name="room-type"]').forEach(radio => {
            radio.addEventListener('change', (e) => {
                this.handleRoomTypeChange(e.target.value);
            });
        });

        // 防止表单默认提交
        document.addEventListener('keypress', (e) => {
            if (e.key === 'Enter') {
                e.preventDefault();
            }
        });
    }

    initSocket() {
        this.socket = io();

        // 连接成功
        this.socket.on('connect', () => {
            console.log('已连接到服务器');
            this.showNotification('已连接到服务器', 'success');
        });

        // 连接断开
        this.socket.on('disconnect', () => {
            console.log('与服务器断开连接');
            this.showNotification('与服务器断开连接', 'error');
        });

        // 加入房间成功
        this.socket.on('join-success', (data) => {
            this.currentUser = data.username;
            this.currentRoom = data.roomName;
            this.showChatScreen();
            this.showNotification(`成功加入房间 "${data.roomName}"`, 'success');
            
            // 如果是AI聊天室，显示使用提示
            if (data.roomName === 'AI聊天室') {
                setTimeout(() => {
                    this.addMessage({
                        username: '🤖 系统提示',
                        message: '欢迎来到AI聊天室！\n💬 正常聊天：直接发送消息\n🤖 AI对话：输入 /model + 你的问题\n\n例如：/model 你好，请介绍一下自己',
                        timestamp: new Date().toISOString(),
                        type: 'system'
                    });
                }, 500);
            }
        });

        // 加入房间失败
        this.socket.on('join-error', (data) => {
            this.showNotification(data.message, 'error');
            this.joinBtn.disabled = false;
        });

        // 离开房间成功
        this.socket.on('leave-success', () => {
            this.currentUser = null;
            this.currentRoom = null;
            this.showLoginScreen();
            this.showNotification('已离开房间', 'success');
        });

        // 接收消息
        this.socket.on('message', (data) => {
            this.addMessage(data);
        });

        // 接收历史消息
        this.socket.on('history-messages', (messages) => {
            this.loadHistoryMessages(messages);
        });

        // 用户列表更新
        this.socket.on('users-update', (users) => {
            this.updateUsersList(users);
        });

        // 错误处理
        this.socket.on('error', (data) => {
            this.showNotification(data.message, 'error');
        });

        // 接收全局统计信息
        this.socket.on('global-stats', (stats) => {
            this.updateGlobalStats(stats);
        });

        // 接收房间通知
        this.socket.on('room-notification', (data) => {
            this.showRoomNotification(data);
        });
    }

    joinRoom() {
        const username = this.usernameInput.value.trim();
        const roomName = this.roomNameInput.value.trim();
        const roomType = document.querySelector('input[name="room-type"]:checked').value;

        if (!username) {
            this.showNotification('请输入用户名', 'error');
            return;
        }

        if (username.length > 20) {
            this.showNotification('用户名不能超过20个字符', 'error');
            return;
        }

        // AI聊天室特殊处理
        if (roomType === 'ai') {
            this.joinBtn.disabled = true;
            this.socket.emit('join-room', { 
                username, 
                roomName: 'AI聊天室', 
                roomType: 'ai' 
            });
            return;
        }

        // 普通聊天室验证
        if (!roomName) {
            this.showNotification('请输入房间名称', 'error');
            return;
        }

        if (roomName.length > 30) {
            this.showNotification('房间名不能超过30个字符', 'error');
            return;
        }

        this.joinBtn.disabled = true;
        this.socket.emit('join-room', { username, roomName, roomType: 'normal' });
    }

    leaveRoom() {
        if (confirm('确定要离开房间吗？')) {
            this.socket.emit('leave-room');
        }
    }

    handleRoomTypeChange(roomType) {
        const roomNameInput = this.roomNameInput;
        const roomNameLabel = document.querySelector('label[for="room-name"]');
        
        if (roomType === 'ai') {
            roomNameInput.disabled = true;
            roomNameInput.placeholder = 'AI聊天室（固定）';
            roomNameInput.value = '';
            roomNameLabel.textContent = 'AI聊天室（无人数限制）:';
            roomNameLabel.style.color = 'var(--warning-color)';
        } else {
            roomNameInput.disabled = false;
            roomNameInput.placeholder = '输入房间名称';
            roomNameLabel.textContent = '选择或创建房间:';
            roomNameLabel.style.color = 'var(--text-color)';
        }
    }

    sendMessage() {
        const message = this.messageInput.value.trim();
        
        if (!message) {
            this.showNotification('请输入消息内容', 'error');
            return;
        }

        if (message.length > 200) {
            this.showNotification('消息不能超过200个字符', 'error');
            return;
        }

        this.socket.emit('send-message', { message });
        this.messageInput.value = '';
    }

    addMessage(data) {
        const messageElement = document.createElement('div');
        messageElement.className = `message ${data.type}`;
        
        const timestamp = new Date(data.timestamp).toLocaleTimeString();
        
        messageElement.innerHTML = `
            <div class="message-header">
                <span class="message-user">${data.username}</span>
                <span class="message-time">${timestamp}</span>
            </div>
            <div class="message-content">${this.escapeHtml(data.message)}</div>
        `;
        
        this.messagesContainer.appendChild(messageElement);
        this.messagesContainer.scrollTop = this.messagesContainer.scrollHeight;
    }

    loadHistoryMessages(messages) {
        // 清空现有消息
        this.messagesContainer.innerHTML = '';
        
        // 如果有历史消息，显示分隔线
        if (messages.length > 0) {
            const historyDivider = document.createElement('div');
            historyDivider.className = 'history-divider';
            historyDivider.innerHTML = '<span>📜 历史消息</span>';
            this.messagesContainer.appendChild(historyDivider);
        }
        
        // 显示历史消息
        messages.forEach(message => {
            const messageElement = document.createElement('div');
            messageElement.className = `message ${message.type} history`;
            
            const timestamp = new Date(message.timestamp).toLocaleTimeString();
            
            messageElement.innerHTML = `
                <div class="message-header">
                    <span class="message-user">${message.username}</span>
                    <span class="message-time">${timestamp}</span>
                </div>
                <div class="message-content">${this.escapeHtml(message.message)}</div>
            `;
            
            this.messagesContainer.appendChild(messageElement);
        });
        
        // 如果有历史消息，添加分隔线
        if (messages.length > 0) {
            const currentDivider = document.createElement('div');
            currentDivider.className = 'history-divider';
            currentDivider.innerHTML = '<span>🕐 当前消息</span>';
            this.messagesContainer.appendChild(currentDivider);
        }
        
        // 滚动到底部
        this.messagesContainer.scrollTop = this.messagesContainer.scrollHeight;
    }

    updateUsersList(users) {
        this.usersListContainer.innerHTML = '';
        
        users.forEach(user => {
            const userElement = document.createElement('li');
            userElement.textContent = user.username;
            if (user.username === this.currentUser) {
                userElement.style.fontWeight = 'bold';
                userElement.style.color = 'var(--primary-color)';
            }
            this.usersListContainer.appendChild(userElement);
        });

        // 更新当前房间用户数量显示
        const isAIRoom = this.currentRoom === 'AI聊天室';
        if (isAIRoom) {
            this.roomUsersCountDisplay.textContent = `用户数: ${users.length} (无限制)`;
            this.roomUsersCountDisplay.style.color = 'var(--warning-color)';
        } else {
            this.roomUsersCountDisplay.textContent = `用户数: ${users.length}/10`;
            this.roomUsersCountDisplay.style.color = 'var(--text-color)';
        }
    }

    updateGlobalStats(stats) {
        // 更新全局在线用户数显示
        this.userCountDisplay.textContent = `在线: ${stats.totalUsers}`;
        
        console.log(`📊 更新全局统计: 总用户数=${stats.totalUsers}, 总房间数=${stats.totalRooms}`);
        console.log(`📊 更新显示元素:`, this.userCountDisplay);
    }

    showLoginScreen() {
        this.loginScreen.classList.remove('hidden');
        this.chatScreen.classList.add('hidden');
        this.usernameInput.value = '';
        this.roomNameInput.value = '';
        this.joinBtn.disabled = false;
        this.usernameDisplay.textContent = '游客';
        // 不要强制设置用户数为0，让服务器的统计信息来更新
        // this.userCountDisplay.textContent = '在线: 0';
        this.messagesContainer.innerHTML = '';
        this.usersListContainer.innerHTML = '';
    }

    showChatScreen() {
        this.loginScreen.classList.add('hidden');
        this.chatScreen.classList.remove('hidden');
        this.usernameDisplay.textContent = this.currentUser;
        this.currentRoomDisplay.textContent = this.currentRoom;
        this.messageInput.focus();
    }

    showNotification(message, type = 'success') {
        // 清除之前的通知
        this.notificationContainer.className = 'notification hidden';
        
        // 短暂延迟后显示新通知
        setTimeout(() => {
            this.notificationContainer.textContent = message;
            this.notificationContainer.className = `notification ${type}`;
            
            // 3秒后自动隐藏
            setTimeout(() => {
                this.notificationContainer.classList.add('hidden');
            }, 3000);
        }, 100);
    }

    showRoomNotification(data) {
        // 只在聊天室界面显示房间通知
        if (this.chatScreen.classList.contains('hidden')) {
            return;
        }

        const notification = document.createElement('div');
        notification.className = 'room-notification';
        
        const iconClass = data.type === 'join' ? 'join' : 'leave';
        const icon = data.type === 'join' ? '🎉' : '👋';
        const actionText = data.type === 'join' ? '加入房间' : '退出房间';
        
        notification.innerHTML = `
            <button class="room-notification-close">×</button>
            <div class="room-notification-content">
                <div class="room-notification-icon ${iconClass}">${icon}</div>
                <div class="room-notification-text">
                    <span class="room-notification-username">${this.escapeHtml(data.username)}</span>
                    ${actionText}
                </div>
            </div>
        `;

        // 添加到页面
        document.body.appendChild(notification);

        // 点击关闭功能
        const closeBtn = notification.querySelector('.room-notification-close');
        const closeNotification = () => {
            notification.classList.add('closing');
            setTimeout(() => {
                if (notification.parentNode) {
                    notification.parentNode.removeChild(notification);
                }
            }, 300);
        };

        closeBtn.addEventListener('click', (e) => {
            e.stopPropagation();
            closeNotification();
        });

        // 点击整个通知也可以关闭
        notification.addEventListener('click', closeNotification);

        // 3秒后自动关闭
        setTimeout(() => {
            if (notification.parentNode) {
                closeNotification();
            }
        }, 3000);
    }

    escapeHtml(text) {
        const div = document.createElement('div');
        div.textContent = text;
        return div.innerHTML;
    }
}

// 页面加载完成后初始化聊天室
document.addEventListener('DOMContentLoaded', () => {
    window.chatRoom = new ChatRoom();
});

// 页面关闭前确认
window.addEventListener('beforeunload', (event) => {
    if (window.chatRoom && window.chatRoom.currentRoom) {
        event.preventDefault();
        event.returnValue = '确定要离开聊天室吗？';
        return '确定要离开聊天室吗？';
    }
});

// 防止页面刷新时丢失连接
window.addEventListener('beforeunload', () => {
    if (window.chatRoom && window.chatRoom.socket) {
        window.chatRoom.socket.disconnect();
    }
}); 