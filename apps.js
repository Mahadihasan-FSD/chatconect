// Global variables
let currentUser = null;
let socket = null;
let currentChat = null;
let contacts = [];

// DOM Elements
const authScreen = document.getElementById('authScreen');
const chatScreen = document.getElementById('chatScreen');
const signupForm = document.getElementById('signupForm');
const loginForm = document.getElementById('loginForm');
const loginLink = document.getElementById('loginLink');
const signupLink = document.getElementById('signupLink');
const logoutBtn = document.getElementById('logoutBtn');
const chatList = document.querySelector('.chat-list');
const messagesContainer = document.querySelector('.messages-container');
const chatInput = document.querySelector('.chat-input');
const sendButton = document.querySelector('.send-button');
const fileInput = document.getElementById('fileInput');
const imageButton = document.querySelector('.image-button');
const userNameDisplay = document.querySelector('.user-info h3');
const userAvatar = document.querySelector('.header-actions .avatar');

// Initialize the application
function initApp() {
    // Check if user is logged in
    const savedUser = localStorage.getItem('currentUser');
    if (savedUser) {
        currentUser = JSON.parse(savedUser);
        showChatScreen();
        initializeSocket();
    } else {
        showAuthScreen();
    }
    
    // Setup event listeners
    setupEventListeners();
}

// Setup event listeners
function setupEventListeners() {
    // Authentication forms
    signupForm.addEventListener('submit', handleSignup);
    loginForm.addEventListener('submit', handleLogin);
    loginLink.addEventListener('click', toggleAuthForms);
    signupLink.addEventListener('click', toggleAuthForms);
    
    // Chat functionality
    sendButton.addEventListener('click', sendMessage);
    chatInput.addEventListener('keypress', e => {
        if (e.key === 'Enter') sendMessage();
    });
    
    // Image upload
    imageButton.addEventListener('click', () => fileInput.click());
    fileInput.addEventListener('change', handleImageUpload);
    
    // Logout
    logoutBtn.addEventListener('click', handleLogout);
}

// Authentication handlers
async function handleSignup(e) {
    e.preventDefault();
    
    const formData = {
        fullName: document.getElementById('fullName').value,
        email: document.getElementById('email').value,
        phone: document.getElementById('phone').value,
        password: document.getElementById('password').value
    };
    
    try {
        const response = await fetch('/register', {
            method: 'POST',
            headers: {
                'Content-Type': 'application/json'
            },
            body: JSON.stringify(formData)
        });
        
        const data = await response.json();
        
        if (data.success) {
            currentUser = data.user;
            localStorage.setItem('currentUser', JSON.stringify(currentUser));
            showChatScreen();
            initializeSocket();
        } else {
            alert(data.error || 'Registration failed');
        }
    } catch (error) {
        console.error('Error during signup:', error);
        alert('Registration failed. Please try again.');
    }
}

async function handleLogin(e) {
    e.preventDefault();
    
    const formData = {
        email: document.getElementById('loginEmail').value,
        password: document.getElementById('loginPassword').value
    };
    
    try {
        const response = await fetch('/login', {
            method: 'POST',
            headers: {
                'Content-Type': 'application/json'
            },
            body: JSON.stringify(formData)
        });
        
        const data = await response.json();
        
        if (data.success) {
            currentUser = data.user;
            localStorage.setItem('currentUser', JSON.stringify(currentUser));
            showChatScreen();
            initializeSocket();
        } else {
            alert(data.error || 'Login failed');
        }
    } catch (error) {
        console.error('Error during login:', error);
        alert('Login failed. Please try again.');
    }
}

async function handleLogout() {
    try {
        await fetch('/logout', {
            method: 'POST'
        });
        
        // Disconnect socket
        if (socket) {
            socket.disconnect();
        }
        
        // Clear user data
        localStorage.removeItem('currentUser');
        currentUser = null;
        
        // Show auth screen
        showAuthScreen();
        
    } catch (error) {
        console.error('Error during logout:', error);
    }
}

// UI helpers
function toggleAuthForms(e) {
    e.preventDefault();
    
    const loginFormContainer = document.getElementById('loginFormContainer');
    const signupFormContainer = document.getElementById('signupFormContainer');
    
    if (loginFormContainer.style.display === 'none') {
        loginFormContainer.style.display = 'block';
        signupFormContainer.style.display = 'none';
    } else {
        loginFormContainer.style.display = 'none';
        signupFormContainer.style.display = 'block';
    }
}

function showAuthScreen() {
    authScreen.style.display = 'flex';
    chatScreen.style.display = 'none';
}

function showChatScreen() {
    authScreen.style.display = 'none';
    chatScreen.style.display = 'flex';
    
    // Update UI with user data
    if (currentUser) {
        userNameDisplay.textContent = currentUser.fullName;
        userAvatar.textContent = currentUser.avatar;
    }
}

// Socket.io Implementation
function initializeSocket() {
    socket = io();
    
    // Authenticate socket connection
    socket.on('connect', () => {
        socket.emit('authenticate', currentUser.id);
    });
    
    // Listen for chat history
    socket.on('chat_history', handleChatHistory);
    
    // Listen for new messages
    socket.on('new_message', handleNewMessage);
    
    // Listen for user status updates
    socket.on('user_status', handleUserStatus);
}

// Chat functionality
function handleChatHistory(chats) {
    // Clear existing chats
    chatList.innerHTML = '';
    
    // Process and display chats
    Object.keys(chats).forEach(chatId => {
        const messages = chats[chatId];
        if (messages.length === 0) return;
        
        // Get the other user's ID
        const userIds = chatId.split('_');
        const otherUserId = userIds[0] === currentUser.id ? userIds[1] : userIds[0];
        
        // Find other user in contacts
        const otherUser = contacts.find(c => c.id === otherUserId);
        if (!otherUser) return;
        
        // Get the last message
        const lastMessage = messages[messages.length - 1];
        
        // Create chat item
        addChatToList(otherUser, lastMessage);
    });
}

function addChatToList(user, lastMessage) {
    const chatItem = document.createElement('div');
    chatItem.className = 'chat-item';
    chatItem.dataset.userId = user.id;
    
    const lastMessageText = lastMessage.type === 'image' ? 
        'Sent an image' : lastMessage.message;
    
    const date = new Date(lastMessage.timestamp);
    const timeString = date.getHours() + ':' + 
                      (date.getMinutes() < 10 ? '0' : '') + 
                      date.getMinutes();
    
    chatItem.innerHTML = `
        <div class="avatar">${user.avatar}</div>
        <div class="chat-info">
            <div class="chat-info-header">
                <h4>${user.fullName}</h4>
                <span>${timeString}</span>
            </div>
            <div class="last-message">
                ${lastMessageText}
            </div>
        </div>
    `;
    
    // Add unread badge if necessary
    if (lastMessage.senderId !== currentUser.id && !lastMessage.read) {
        const badge = document.createElement('div');
        badge.className = 'chat-badge';
        badge.textContent = '1';
        chatItem.appendChild(badge);
    }
    
    // Add click handler
    chatItem.addEventListener('click', () => {
        openChat(user.id);
    });
    
    chatList.appendChild(chatItem);
}

function openChat(userId) {
    // Set current chat
    currentChat = userId;
    
    // Update UI
    document.querySelectorAll('.chat-item').forEach(item => {
        item.classList.remove('active');
        if (item.dataset.userId === userId) {
            item.classList.add('active');
            // Remove unread badge
            const badge = item.querySelector('.chat-badge');
            if (badge) badge.remove();
        }
    });
    
    // Clear messages container
    messagesContainer.innerHTML = '';
    
    // Load messages for this chat
    const chatUsers = [currentUser.id, userId].sort();
    const chatId = `${chatUsers[0]}_${chatUsers[1]}`;
    
    if (chatMessages[chatId]) {
        chatMessages[chatId].forEach(msg => {
            displayMessage(msg);
        });
    }
    
    // Scroll to bottom
    messagesContainer.scrollTop = messagesContainer.scrollHeight;
}

function sendMessage() {
    if (!currentChat) return;
    
    const message = chatInput.value.trim();
    if (!message) return;
    
    const timestamp = new Date().toISOString();
    
    // Create message object
    const messageData = {
        recipientId: currentChat,
        message,
        timestamp,
        type: 'text'
    };
    
    // Send via socket
    socket.emit('send_message', messageData);
    
    // Clear input
    chatInput.value = '';
    
    // Display message locally (optimistic UI)
    displayMessage({
        senderId: currentUser.id,
        message,
        timestamp,
        type: 'text'
    });
    
    // Scroll to bottom
    messagesContainer.scrollTop = messagesContainer.scrollHeight;
}

function handleNewMessage(data) {
    const { chatId, message } = data;
    
    // Check if message belongs to current chat
    const userIds = chatId.split('_');
    const otherUserId = userIds[0] === currentUser.id ? userIds[1] : userIds[0];
    
    // Update chat list
    const existingChat = document.querySelector(`.chat-item[data-userId="${otherUserId}"]`);
    if (existingChat) {
        const lastMessageEl = existingChat.querySelector('.last-message');
        lastMessageEl.textContent = message.type === 'image' ? 'Sent an image' : message.message;
        
        // Add unread badge if not current chat
        if (otherUserId !== currentChat) {
            if (!existingChat.querySelector('.chat-badge')) {
                const badge = document.createElement('div');
                badge.className = 'chat-badge';
                badge.textContent = '1';
                existingChat.appendChild(badge);
            }
        }
    }
    
    // Display if in current chat
    if (otherUserId === currentChat) {
        displayMessage(message);
        // Scroll to bottom
        messagesContainer.scrollTop = messagesContainer.scrollHeight;
    }
}

function displayMessage(message) {
    const isSent = message.senderId === currentUser.id;
    const className = isSent ? 'message sent' : 'message received';
    
    const date = new Date(message.timestamp);
    const timeString = date.getHours() + ':' + 
                      (date.getMinutes() < 10 ? '0' : '') + 
                      date.getMinutes();
    
    const messageEl = document.createElement('div');
    messageEl.className = className;
    
    const avatar = isSent ? currentUser.avatar : (
        contacts.find(c => c.id === message.senderId)?.avatar || '?'
    );
    
    let contentHtml = '';
    if (message.type === 'image') {
        contentHtml = `
            <div class="message-image">
                <img src="${message.message}" alt="Image">
            </div>
        `;
    } else {
        contentHtml = `
            <div class="message-bubble">
                ${message.message}
            </div>
        `;
    }
    
    messageEl.innerHTML = `
        <div class="message-avatar">${avatar}</div>
        <div class="message-content">
            ${contentHtml}
            <span class="message-time">${timeString}</span>
        </div>
    `;
    
    messagesContainer.appendChild(messageEl);
}

function handleImageUpload(e) {
    const file = e.target.files[0];
    if (!file) return;
    
    const reader = new FileReader();
    reader.onload = function(event) {
        // Send image data
        const imageData = event.target.result;
        const timestamp = new Date().toISOString();
        
        // Send via socket
        socket.emit('send_image', {
            recipientId: currentChat,
            imageData,
            timestamp
        });
        
        // Display locally
        displayMessage({
            senderId: currentUser.id,
            message: imageData,
            timestamp,
            type: 'image'
        });
        
        // Scroll to bottom
        messagesContainer.scrollTop = messagesContainer.scrollHeight;
    };
    reader.readAsDataURL(file);
    
    // Reset file input
    fileInput.value = '';
}

function handleUserStatus(data) {
    const { userId, status } = data;
    
    // Update contact status
    const contact = contacts.find(c => c.id === userId);
    if (contact) {
        contact.status = status;
    }
    
    // Update UI if this is the current chat
    if (userId === currentChat) {
        const statusEl = document.querySelector('.user-info p');
        statusEl.textContent = status === 'online' ? 'Online' : 'Offline';
        statusEl.style.color = status === 'online' ? '#10b981' : '#9ca3af';
    }
}

// Initialize app when DOM content is loaded
document.addEventListener('DOMContentLoaded', initApp);