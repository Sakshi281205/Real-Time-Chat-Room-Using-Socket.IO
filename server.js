const express = require('express');
const http = require('http');
const socketIo = require('socket.io');
const cors = require('cors');
const path = require('path');
const { v4: uuidv4 } = require('uuid');
const moment = require('moment');

const app = express();
const server = http.createServer(app);
const io = socketIo(server, {
  cors: {
    origin: "*",
    methods: ["GET", "POST"]
  }
});

// Middleware
app.use(cors());
app.use(express.json());
app.use(express.static(path.join(__dirname, 'public')));

// Store connected users and messages
const connectedUsers = new Map();
const messages = [];
const MAX_MESSAGES = 100;

// Routes
app.get('/', (req, res) => {
  res.sendFile(path.join(__dirname, 'public', 'index.html'));
});

app.get('/api/users', (req, res) => {
  res.json(Array.from(connectedUsers.values()));
});

app.get('/api/messages', (req, res) => {
  res.json(messages);
});

// Socket.IO connection handling
io.on('connection', (socket) => {
  console.log('New client connected:', socket.id);

  // Handle user joining
  socket.on('user_join', (userData) => {
    const user = {
      id: socket.id,
      username: userData.username,
      avatar: userData.avatar || `https://api.dicebear.com/7.x/avataaars/svg?seed=${userData.username}`,
      joinTime: moment().format('YYYY-MM-DD HH:mm:ss'),
      isTyping: false
    };

    connectedUsers.set(socket.id, user);
    
    // Send welcome message
    const welcomeMessage = {
      id: uuidv4(),
      type: 'system',
      content: `Welcome ${user.username}! 🎉`,
      timestamp: moment().format('YYYY-MM-DD HH:mm:ss'),
      user: null
    };
    
    messages.push(welcomeMessage);
    if (messages.length > MAX_MESSAGES) {
      messages.shift();
    }

    // Broadcast user joined
    socket.broadcast.emit('user_joined', {
      user: user,
      message: welcomeMessage
    });

    // Send current users and messages to new user
    socket.emit('initialize', {
      users: Array.from(connectedUsers.values()),
      messages: messages
    });

    // Update online users list
    io.emit('users_updated', Array.from(connectedUsers.values()));
  });

  // Handle new message
  socket.on('send_message', (messageData) => {
    const user = connectedUsers.get(socket.id);
    if (!user) return;

    const message = {
      id: uuidv4(),
      type: 'message',
      content: messageData.content,
      timestamp: moment().format('YYYY-MM-DD HH:mm:ss'),
      user: {
        id: user.id,
        username: user.username,
        avatar: user.avatar
      }
    };

    messages.push(message);
    if (messages.length > MAX_MESSAGES) {
      messages.shift();
    }

    // Broadcast message to all clients
    io.emit('new_message', message);
  });

  // Handle typing indicator
  socket.on('typing_start', () => {
    const user = connectedUsers.get(socket.id);
    if (user) {
      user.isTyping = true;
      socket.broadcast.emit('user_typing', {
        userId: socket.id,
        username: user.username,
        isTyping: true
      });
    }
  });

  socket.on('typing_stop', () => {
    const user = connectedUsers.get(socket.id);
    if (user) {
      user.isTyping = false;
      socket.broadcast.emit('user_typing', {
        userId: socket.id,
        username: user.username,
        isTyping: false
      });
    }
  });

  // Handle user disconnect
  socket.on('disconnect', () => {
    const user = connectedUsers.get(socket.id);
    if (user) {
      const leaveMessage = {
        id: uuidv4(),
        type: 'system',
        content: `${user.username} has left the chat 👋`,
        timestamp: moment().format('YYYY-MM-DD HH:mm:ss'),
        user: null
      };

      messages.push(leaveMessage);
      if (messages.length > MAX_MESSAGES) {
        messages.shift();
      }

      connectedUsers.delete(socket.id);
      
      // Broadcast user left
      socket.broadcast.emit('user_left', {
        user: user,
        message: leaveMessage
      });

      // Update online users list
      io.emit('users_updated', Array.from(connectedUsers.values()));
    }
    
    console.log('Client disconnected:', socket.id);
  });

  // Handle private messages
  socket.on('private_message', (data) => {
    const sender = connectedUsers.get(socket.id);
    const recipient = connectedUsers.get(data.recipientId);
    
    if (sender && recipient) {
      const privateMessage = {
        id: uuidv4(),
        type: 'private',
        content: data.content,
        timestamp: moment().format('YYYY-MM-DD HH:mm:ss'),
        sender: {
          id: sender.id,
          username: sender.username,
          avatar: sender.avatar
        },
        recipient: {
          id: recipient.id,
          username: recipient.username,
          avatar: recipient.avatar
        }
      };

      // Send to sender and recipient only
      socket.emit('private_message', privateMessage);
      io.to(data.recipientId).emit('private_message', privateMessage);
    }
  });
});

const PORT = process.env.PORT || 3000;

server.listen(PORT, () => {
  console.log(`🚀 Server running on port ${PORT}`);
  console.log(`📱 Chat room available at: http://localhost:${PORT}`);
}); 