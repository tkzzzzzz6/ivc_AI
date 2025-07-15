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

        // 用户列表更新
        this.socket.on('users-update', (users) => {
            this.updateUsersList(users);
        });

        // 错误处理
        this.socket.on('error', (data) => {
            this.showNotification(data.message, 'error');
        });
    }

    joinRoom() {
        const username = this.usernameInput.value.trim();
        const roomName = this.roomNameInput.value.trim();

        if (!username || !roomName) {
            this.showNotification('请输入用户名和房间名', 'error');
            return;
        }

        if (username.length > 20) {
            this.showNotification('用户名不能超过20个字符', 'error');
            return;
        }

        if (roomName.length > 30) {
            this.showNotification('房间名不能超过30个字符', 'error');
            return;
        }

        this.joinBtn.disabled = true;
        this.socket.emit('join-room', { username, roomName });
    }

    leaveRoom() {
        if (confirm('确定要离开房间吗？')) {
            this.socket.emit('leave-room');
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

        // 更新用户数量显示
        this.userCountDisplay.textContent = `在线: ${users.length}`;
        this.roomUsersCountDisplay.textContent = `用户数: ${users.length}/10`;
    }

    showLoginScreen() {
        this.loginScreen.classList.remove('hidden');
        this.chatScreen.classList.add('hidden');
        this.usernameInput.value = '';
        this.roomNameInput.value = '';
        this.joinBtn.disabled = false;
        this.usernameDisplay.textContent = '游客';
        this.userCountDisplay.textContent = '在线: 0';
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

    escapeHtml(text) {
        const div = document.createElement('div');
        div.textContent = text;
        return div.innerHTML;
    }
}

// 页面加载完成后初始化聊天室
document.addEventListener('DOMContentLoaded', () => {
    new ChatRoom();
});

// 页面关闭前确认
window.addEventListener('beforeunload', (event) => {
    if (window.chatRoom && window.chatRoom.currentRoom) {
        event.preventDefault();
        event.returnValue = '确定要离开聊天室吗？';
    }
});

// 防止页面刷新时丢失连接
window.addEventListener('beforeunload', () => {
    if (window.chatRoom && window.chatRoom.socket) {
        window.chatRoom.socket.disconnect();
    }
}); 