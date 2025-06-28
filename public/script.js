const socket = io();

let currentUser = null;
let typingTimeout = null;

// DOM Elements
const loginModal = document.getElementById('login-modal');
const loginForm = document.getElementById('login-form');
const usernameInput = document.getElementById('username-input');
const chatApp = document.getElementById('chat-app');
const userInfo = document.getElementById('user-info');
const usersList = document.getElementById('users-list');
const messagesDiv = document.getElementById('messages');
const messageForm = document.getElementById('message-form');
const messageInput = document.getElementById('message-input');
const typingIndicator = document.getElementById('typing-indicator');

// Show login modal
loginModal.style.display = 'flex';
chatApp.style.display = 'none';

loginForm.addEventListener('submit', (e) => {
  e.preventDefault();
  const username = usernameInput.value.trim();
  if (!username) return;
  currentUser = {
    username,
    avatar: `https://api.dicebear.com/7.x/avataaars/svg?seed=${username}`
  };
  socket.emit('user_join', currentUser);
  loginModal.style.display = 'none';
  chatApp.style.display = 'flex';
  userInfo.innerHTML = `<img src="${currentUser.avatar}" class="avatar" style="width:28px;height:28px;vertical-align:middle;"> <b>${currentUser.username}</b>`;
});

// Initialize chat with users and messages
socket.on('initialize', (data) => {
  updateUsersList(data.users);
  messagesDiv.innerHTML = '';
  data.messages.forEach(addMessageToUI);
  scrollMessagesToBottom();
});

// New user joined
socket.on('user_joined', (data) => {
  addMessageToUI(data.message);
  updateUsersListUI();
});

// User left
socket.on('user_left', (data) => {
  addMessageToUI(data.message);
  updateUsersListUI();
});

// Users updated
socket.on('users_updated', (users) => {
  updateUsersList(users);
});

// New message
socket.on('new_message', (message) => {
  addMessageToUI(message);
  scrollMessagesToBottom();
});

// Typing indicator
socket.on('user_typing', (data) => {
  if (data.isTyping) {
    typingIndicator.textContent = `${data.username} is typing...`;
  } else {
    typingIndicator.textContent = '';
  }
});

// Private message (not shown in this UI, but can be extended)
socket.on('private_message', (message) => {
  // Optionally handle private messages
});

// Send message
messageForm.addEventListener('submit', (e) => {
  e.preventDefault();
  const content = messageInput.value.trim();
  if (!content) return;
  socket.emit('send_message', { content });
  messageInput.value = '';
  socket.emit('typing_stop');
});

// Typing events
messageInput.addEventListener('input', () => {
  socket.emit('typing_start');
  clearTimeout(typingTimeout);
  typingTimeout = setTimeout(() => {
    socket.emit('typing_stop');
  }, 1000);
});

function addMessageToUI(message) {
  const div = document.createElement('div');
  div.classList.add('message');
  if (message.type === 'system') {
    div.classList.add('system');
    div.textContent = message.content;
  } else {
    if (message.user) {
      div.innerHTML = `
        <img src="${message.user.avatar}" class="avatar">
        <div class="message-content">
          <div class="username">${message.user.username} <span class="timestamp">${message.timestamp}</span></div>
          <div>${escapeHTML(message.content)}</div>
        </div>
      `;
    } else {
      div.innerHTML = `<div class="message-content">${escapeHTML(message.content)}</div>`;
    }
  }
  messagesDiv.appendChild(div);
}

function updateUsersList(users) {
  usersList.innerHTML = '';
  users.forEach(user => {
    const li = document.createElement('li');
    li.innerHTML = `<img src="${user.avatar}" alt="avatar"> <span>${user.username}</span>`;
    usersList.appendChild(li);
  });
}

function updateUsersListUI() {
  socket.emit('get_users');
}

function scrollMessagesToBottom() {
  messagesDiv.scrollTop = messagesDiv.scrollHeight;
}

function escapeHTML(str) {
  return str.replace(/[&<>'"]/g, tag => ({'&':'&amp;','<':'&lt;','>':'&gt;','\'':'&#39;','"':'&quot;'}[tag]));
} 