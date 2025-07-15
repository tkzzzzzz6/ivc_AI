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
        this.scrollContainer = document.querySelector('.messages-container');
        this.usersListContainer = document.getElementById('users-list');
        this.usernameDisplay = document.getElementById('username-display');
        this.userCountDisplay = document.getElementById('user-count');
        this.currentRoomDisplay = document.getElementById('current-room');
        this.roomUsersCountDisplay = document.getElementById('room-users-count');
        this.notificationContainer = document.getElementById('notification');

        // 音乐播放器DOM元素
        this.musicPlayer = document.getElementById('music-player');
        this.musicTitle = document.getElementById('music-title');
        this.musicArtist = document.getElementById('music-artist');
        this.musicCoverImg = document.getElementById('music-cover-img');
        this.playPauseBtn = document.getElementById('play-pause-btn');
        this.progressBar = document.querySelector('.progress-bar');
        this.progressFill = document.getElementById('progress-fill');
        this.currentTimeDisplay = document.getElementById('current-time');
        this.durationDisplay = document.getElementById('duration');
        this.volumeBtn = document.getElementById('volume-btn');
        this.audioPlayer = document.getElementById('audio-player');

        // 绑定事件
        this.bindEvents();
        
        // 初始化Socket.IO连接
        this.initSocket();
        
        // 初始化音乐播放器
        this.initMusicPlayer();
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
        
        // 音乐播放器事件
        this.bindMusicEvents();
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

        // 音乐播放事件
        this.socket.on('music-play', (musicData) => {
            this.playMusic(musicData);
        });

        // 音乐停止事件
        this.socket.on('music-stop', () => {
            this.stopMusic();
        });

        // 音乐同步事件
        this.socket.on('music-sync', (syncData) => {
            this.syncMusicState(syncData);
        });

        // 音乐播放/暂停切换事件
        this.socket.on('music-toggle', (toggleData) => {
            this.handleMusicToggle(toggleData);
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
        
        // 确保自动滚动到最新消息
        this.scrollToBottom();
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
        this.scrollToBottom();
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

    scrollToBottom() {
        // 使用requestAnimationFrame确保DOM更新后再滚动
        requestAnimationFrame(() => {
            // 滚动外层容器（.messages-container）
            if (this.scrollContainer) {
                this.scrollContainer.scrollTop = this.scrollContainer.scrollHeight;
            }
            
            // 备用方案：滚动最新的消息到视图中
            const messages = this.messagesContainer.children;
            if (messages.length > 0) {
                const lastMessage = messages[messages.length - 1];
                lastMessage.scrollIntoView({ 
                    behavior: 'smooth', 
                    block: 'end',
                    inline: 'nearest'
                });
            }
        });
    }

    escapeHtml(text) {
        const div = document.createElement('div');
        div.textContent = text;
        return div.innerHTML;
    }

    // 音乐播放器初始化
    initMusicPlayer() {
        // 音乐播放器状态
        this.isPlaying = false;
        this.isMuted = false;
        this.currentMusic = null;
        this.isServerControlled = false; // 标记是否被服务器控制
        this.autoHideTimer = null; // 自动隐藏定时器
        this.isUserInteracting = false; // 用户是否正在交互
        this.hasUserInteracted = false; // 用户是否曾经交互过页面
        this.pendingPlay = null; // 待播放的音乐数据
        
        // 播放器初始状态为隐藏，只有调用/music后才显示
        this.musicPlayer.classList.add('hidden');
        
        // 绑定鼠标事件用于自动隐藏
        this.bindAutoHideEvents();
        
        // 监听用户交互以启用自动播放
        this.setupUserInteractionDetection();
    }

    // 绑定音乐播放器事件
    bindMusicEvents() {
        // 播放/暂停按钮
        this.playPauseBtn.addEventListener('click', () => {
            this.togglePlay();
        });

        // 进度条点击
        this.progressBar.addEventListener('click', (e) => {
            const rect = this.progressBar.getBoundingClientRect();
            const percent = (e.clientX - rect.left) / rect.width;
            this.seekTo(percent);
        });

        // 音量按钮
        this.volumeBtn.addEventListener('click', () => {
            this.toggleMute();
        });

        // 关闭播放器按钮
        const closePlayerBtn = document.getElementById('close-player-btn');
        if (closePlayerBtn) {
            closePlayerBtn.addEventListener('click', () => {
                this.hideMusicPlayer();
            });
        }

        // 音频事件
        this.audioPlayer.addEventListener('loadedmetadata', () => {
            this.updateDuration();
        });

        this.audioPlayer.addEventListener('timeupdate', () => {
            this.updateProgress();
        });

        this.audioPlayer.addEventListener('ended', () => {
            this.onMusicEnded();
        });

        this.audioPlayer.addEventListener('error', (e) => {
            console.error('音频播放错误:', e);
            this.showError('音频播放失败');
        });
    }

    // 播放音乐
    playMusic(musicData) {
        this.currentMusic = musicData;
        this.isServerControlled = true;
        
        // 显示播放器
        this.showMusicPlayer();
        
        // 更新界面
        this.musicTitle.textContent = musicData.name || '未知歌曲';
        this.musicArtist.textContent = musicData.artist || '未知艺术家';
        
        // 更新封面
        if (musicData.cover) {
            this.musicCoverImg.src = musicData.cover;
            this.musicCoverImg.style.display = 'block';
            this.musicCoverImg.parentElement.querySelector('.music-cover-placeholder').style.display = 'none';
        } else {
            this.musicCoverImg.style.display = 'none';
            this.musicCoverImg.parentElement.querySelector('.music-cover-placeholder').style.display = 'flex';
        }
        
        // 设置音频源
        this.audioPlayer.src = musicData.url;
        
        // 如果用户还没有交互过页面，等待交互后再播放
        if (!this.hasUserInteracted) {
            this.pendingPlay = musicData;
            this.showNotification('点击页面任意位置开始播放音乐', 'warning');
            return;
        }
        
        // 如果有当前播放时间，跳转到指定位置
        if (musicData.currentTime && musicData.currentTime > 0) {
            this.audioPlayer.addEventListener('loadedmetadata', () => {
                this.audioPlayer.currentTime = musicData.currentTime;
                if (musicData.isPlaying) {
                    this.tryAutoPlay();
                }
            }, { once: true });
        } else {
            // 新音乐自动播放
            this.tryAutoPlay();
        }
        
        // 重置自动隐藏定时器
        this.resetAutoHideTimer();
    }

    // 切换播放/暂停
    togglePlay() {
        if (!this.audioPlayer.src) return;
        
        // 用户手动点击播放按钮时，记录为已交互
        this.hasUserInteracted = true;
        
        // 如果是服务器控制的音乐，发送暂停/播放命令到服务器
        if (this.isServerControlled) {
            this.sendMessageToServer(this.isPlaying ? '/pause' : '/play');
            return;
        }
        
        if (this.isPlaying) {
            this.audioPlayer.pause();
            this.isPlaying = false;
            this.musicPlayer.classList.remove('playing');
        } else {
            this.audioPlayer.play().then(() => {
                this.isPlaying = true;
                this.musicPlayer.classList.add('playing');
                // 移除播放按钮的提示效果
                this.playPauseBtn.style.animation = '';
                this.playPauseBtn.style.boxShadow = '';
            }).catch(error => {
                console.error('播放失败:', error);
                this.showError('播放失败');
            });
        }
        
        this.updatePlayButton();
        this.resetAutoHideTimer();
    }

    // 更新播放按钮状态
    updatePlayButton() {
        const playIcon = this.playPauseBtn.querySelector('.play-icon');
        const pauseIcon = this.playPauseBtn.querySelector('.pause-icon');
        
        if (this.isPlaying) {
            playIcon.classList.add('hidden');
            pauseIcon.classList.remove('hidden');
        } else {
            playIcon.classList.remove('hidden');
            pauseIcon.classList.add('hidden');
        }
    }

    // 跳转到指定位置
    seekTo(percent) {
        if (!this.audioPlayer.duration) return;
        
        this.audioPlayer.currentTime = this.audioPlayer.duration * percent;
    }

    // 切换静音
    toggleMute() {
        this.isMuted = !this.isMuted;
        this.audioPlayer.muted = this.isMuted;
        
        this.volumeBtn.textContent = this.isMuted ? '🔇' : '🔊';
    }

    // 更新播放进度
    updateProgress() {
        if (!this.audioPlayer.duration) return;
        
        const percent = (this.audioPlayer.currentTime / this.audioPlayer.duration) * 100;
        this.progressFill.style.width = percent + '%';
        
        this.currentTimeDisplay.textContent = this.formatTime(this.audioPlayer.currentTime);
    }

    // 更新总时长
    updateDuration() {
        this.durationDisplay.textContent = this.formatTime(this.audioPlayer.duration);
    }

    // 格式化时间
    formatTime(seconds) {
        if (!seconds || isNaN(seconds)) return '0:00';
        
        const minutes = Math.floor(seconds / 60);
        const remainingSeconds = Math.floor(seconds % 60);
        return `${minutes}:${remainingSeconds.toString().padStart(2, '0')}`;
    }

    // 音乐播放结束
    onMusicEnded() {
        this.isPlaying = false;
        this.updatePlayButton();
        this.musicPlayer.classList.remove('playing');
        this.progressFill.style.width = '0%';
        this.currentTimeDisplay.textContent = '0:00';
        
        // 播放结束后5秒自动隐藏播放器
        setTimeout(() => {
            this.startAutoHide();
        }, 5000);
    }

    // 停止音乐
    stopMusic() {
        this.audioPlayer.pause();
        this.audioPlayer.currentTime = 0;
        this.isPlaying = false;
        this.updatePlayButton();
        this.musicPlayer.classList.remove('playing');
        this.progressFill.style.width = '0%';
        this.currentTimeDisplay.textContent = '0:00';
    }

    // 显示错误消息
    showError(message) {
        // 使用现有的通知系统显示错误
        if (this.showNotification) {
            this.showNotification(message, 'error');
        } else {
            console.error(message);
        }
    }

    // 同步音乐状态
    syncMusicState(syncData) {
        if (!this.currentMusic || !this.isServerControlled) return;
        
        // 同步播放时间
        const timeDiff = Math.abs(this.audioPlayer.currentTime - syncData.currentTime);
        if (timeDiff > 2) { // 如果时间差超过2秒，强制同步
            this.audioPlayer.currentTime = syncData.currentTime;
        }
        
        // 同步播放状态
        if (syncData.isPlaying !== this.isPlaying) {
            if (syncData.isPlaying) {
                this.audioPlayer.play().catch(error => {
                    console.error('同步播放失败:', error);
                });
            } else {
                this.audioPlayer.pause();
            }
            this.isPlaying = syncData.isPlaying;
            this.updatePlayButton();
            
            if (this.isPlaying) {
                this.musicPlayer.classList.add('playing');
            } else {
                this.musicPlayer.classList.remove('playing');
            }
        }
    }

    // 处理音乐播放/暂停切换
    handleMusicToggle(toggleData) {
        if (!this.currentMusic) return;
        
        this.isPlaying = toggleData.isPlaying;
        
        if (toggleData.isPlaying) {
            this.audioPlayer.currentTime = toggleData.currentTime;
            
            // 如果用户还没有交互过，不能自动播放
            if (!this.hasUserInteracted) {
                this.pendingPlay = this.currentMusic;
                this.showNotification('点击播放按钮开始播放', 'warning');
                this.addPlayButtonPrompt();
                return;
            }
            
            this.audioPlayer.play().then(() => {
                this.musicPlayer.classList.add('playing');
            }).catch(error => {
                console.error('切换播放失败:', error);
                this.showError('播放失败，请手动点击播放按钮');
                this.addPlayButtonPrompt();
            });
        } else {
            this.audioPlayer.pause();
            this.musicPlayer.classList.remove('playing');
        }
        
        this.updatePlayButton();
        this.resetAutoHideTimer();
    }

    // 发送消息的辅助方法
    sendMessageToServer(message) {
        if (this.socket && this.currentRoom) {
            this.socket.emit('send-message', { message: message });
        }
    }
    
    // === 自动隐藏功能 ===
    
    // 绑定自动隐藏相关事件
    bindAutoHideEvents() {
        // 鼠标进入播放器区域
        this.musicPlayer.addEventListener('mouseenter', () => {
            this.isUserInteracting = true;
            this.clearAutoHideTimer();
            this.stopAutoHide();
        });
        
        // 鼠标离开播放器区域
        this.musicPlayer.addEventListener('mouseleave', () => {
            this.isUserInteracting = false;
            // 延迟3秒后开始自动隐藏
            this.resetAutoHideTimer();
        });
        
        // 点击播放器时重置定时器
        this.musicPlayer.addEventListener('click', () => {
            this.resetAutoHideTimer();
        });
    }
    
    // 显示音乐播放器
    showMusicPlayer() {
        this.musicPlayer.classList.remove('hidden');
        this.musicPlayer.classList.add('show');
        this.stopAutoHide();
        this.resetAutoHideTimer();
    }
    
    // 隐藏音乐播放器
    hideMusicPlayer() {
        this.musicPlayer.classList.add('hidden');
        this.musicPlayer.classList.remove('show', 'auto-hide');
        this.clearAutoHideTimer();
        
        // 停止播放
        this.stopMusic();
        this.currentMusic = null;
    }
    
    // 开始自动隐藏
    startAutoHide() {
        if (!this.isUserInteracting && !this.musicPlayer.classList.contains('hidden')) {
            this.musicPlayer.classList.add('auto-hide');
        }
    }
    
    // 停止自动隐藏
    stopAutoHide() {
        this.musicPlayer.classList.remove('auto-hide');
    }
    
    // 重置自动隐藏定时器
    resetAutoHideTimer() {
        this.clearAutoHideTimer();
        
        // 如果正在播放音乐，10秒后开始自动隐藏
        // 如果没有播放音乐，5秒后开始自动隐藏
        const delay = this.isPlaying ? 10000 : 5000;
        
        this.autoHideTimer = setTimeout(() => {
            if (!this.isUserInteracting) {
                this.startAutoHide();
            }
        }, delay);
    }
    
    // 清除自动隐藏定时器
    clearAutoHideTimer() {
        if (this.autoHideTimer) {
            clearTimeout(this.autoHideTimer);
            this.autoHideTimer = null;
        }
    }
    
    // === 自动播放相关方法 ===
    
    // 设置用户交互检测
    setupUserInteractionDetection() {
        const events = ['click', 'keydown', 'touchstart', 'mousedown'];
        
        const enableAutoPlay = () => {
            this.hasUserInteracted = true;
            console.log('用户已交互，启用自动播放');
            
            // 如果有待播放的音乐，立即播放
            if (this.pendingPlay) {
                console.log('播放待播放的音乐:', this.pendingPlay.name);
                this.tryAutoPlay();
                this.pendingPlay = null;
            }
            
            // 移除事件监听器，不再需要
            events.forEach(event => {
                document.removeEventListener(event, enableAutoPlay, { passive: true });
            });
        };
        
        // 添加事件监听器
        events.forEach(event => {
            document.addEventListener(event, enableAutoPlay, { passive: true });
        });
    }
    
    // 尝试自动播放
    tryAutoPlay() {
        if (!this.audioPlayer.src) {
            console.warn('没有音频源，无法播放');
            return;
        }
        
        // 先尝试静音播放来检测是否可以自动播放
        const originalVolume = this.audioPlayer.volume;
        this.audioPlayer.volume = 0;
        
        this.audioPlayer.play().then(() => {
            // 静音播放成功，恢复音量并正常播放
            this.audioPlayer.pause();
            this.audioPlayer.volume = originalVolume;
            this.audioPlayer.currentTime = 0;
            
            return this.audioPlayer.play();
        }).then(() => {
            // 播放成功
            this.isPlaying = true;
            this.updatePlayButton();
            this.musicPlayer.classList.add('playing');
            console.log('自动播放成功');
        }).catch(error => {
            // 播放失败，恢复音量
            this.audioPlayer.volume = originalVolume;
            console.error('自动播放失败:', error);
            
            // 检测失败原因
            if (error.name === 'NotAllowedError') {
                this.showError('需要用户交互才能播放音乐，请点击播放按钮');
                this.addPlayButtonPrompt();
            } else if (error.name === 'NotSupportedError') {
                this.showError('音频格式不支持或文件损坏');
            } else {
                this.showError('播放失败，请检查网络连接');
            }
        });
    }
    
    // 添加播放按钮提示效果
    addPlayButtonPrompt() {
        this.playPauseBtn.style.animation = 'pulse 1s infinite';
        this.playPauseBtn.style.boxShadow = '0 0 20px rgba(255, 215, 0, 0.8)';
        
        // 5秒后移除提示效果
        setTimeout(() => {
            this.playPauseBtn.style.animation = '';
            this.playPauseBtn.style.boxShadow = '';
        }, 5000);
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