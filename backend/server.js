const express = require('express');
const http = require('http');
const { Server } = require('socket.io');
const cors = require('cors');
require('dotenv').config();

const app = express();
app.use(cors());

const server = http.createServer(app);

// 1. Khởi tạo Socket.io ĐÚNG (Chỉ 1 lần duy nhất)
const io = new Server(server, {
  cors: {
    origin: "*",
    methods: ["GET", "POST"]
  },
  maxHttpBufferSize: 1e7 // Cho phép gửi ảnh lên tới 10MB
});

let waitingUsers = [];

io.on('connection', (socket) => {
  console.log('Một người dùng đã kết nối:', socket.id);

  socket.on('find_stranger', (userData) => {
    socket.userData = userData; 

    if (waitingUsers.length > 0) {
      const partner = waitingUsers.shift();
      const roomName = `${socket.id}#${partner.id}`;
      
      socket.join(roomName);
      partner.join(roomName);

      socket.room = roomName;
      partner.room = roomName;
      socket.partnerId = partner.id;
      partner.partnerId = socket.id;

      io.to(roomName).emit('chat_start', { message: 'Đã tìm thấy người lạ! Hãy gửi lời chào.' });
    } else {
      waitingUsers.push(socket);
      socket.emit('waiting', { message: 'Đang tìm kiếm người lạ...' });
    }
  });

  // 2. Xử lý gửi tin nhắn (Đã sửa dụng socket.room để chuyển tiếp)
  socket.on("send_message", (data) => {
    if (socket.room) {
        socket.to(socket.room).emit("receive_message", data);
    }
  }); 

  socket.on('leave_chat', () => {
    if (socket.room) {
      socket.to(socket.room).emit('stranger_left', { message: 'Người lạ đã rời khỏi cuộc trò chuyện.' });
      
      const partnerSocket = io.sockets.sockets.get(socket.partnerId);
      if (partnerSocket) {
        partnerSocket.leave(socket.room);
        partnerSocket.room = null;
        partnerSocket.partnerId = null;
      }
      
      socket.leave(socket.room);
      socket.room = null;
      socket.partnerId = null;
    } else {
      waitingUsers = waitingUsers.filter(u => u.id !== socket.id);
    }
  });

  socket.on('disconnect', () => {
    if (socket.room) {
      socket.to(socket.room).emit('stranger_left', { message: 'Người lạ đã mất kết nối.' });
    }
    waitingUsers = waitingUsers.filter(u => u.id !== socket.id);
    console.log('Người dùng ngắt kết nối:', socket.id);
  });
});

const PORT = process.env.PORT || 5000;
server.listen(PORT, () => {
  console.log(`Server đang chạy trên cổng ${PORT}`);
});