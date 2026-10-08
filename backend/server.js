const express = require('express');
const http = require('http');
const { Server } = require('socket.io');
const cors = require('cors');
require('dotenv').config();

const app = express();
app.use(cors());

const server = http.createServer(app);
const io = new Server(server, {
  cors: {
    origin: "*",
    methods: ["GET", "POST"]
  }
});

// Mảng chứa những người đang tìm kiếm
let waitingUsers = [];

io.on('connection', (socket) => {
  console.log('Một người dùng đã kết nối:', socket.id);

  // Xử lý khi user bấm "Tìm người lạ"
  socket.on('find_stranger', (userData) => {
    socket.userData = userData; // Lưu thông tin user (tên, avatar...)

    if (waitingUsers.length > 0) {
      // Ghép đôi với người đang đợi đầu tiên
      const partner = waitingUsers.shift();
      const roomName = `${socket.id}#${partner.id}`;
      
      socket.join(roomName);
      partner.join(roomName);

      // Lưu lại thông tin phòng và đối tác
      socket.room = roomName;
      partner.room = roomName;
      socket.partnerId = partner.id;
      partner.partnerId = socket.id;

      // Thông báo cho cả 2 là đã ghép đôi thành công
      io.to(roomName).emit('chat_start', { message: 'Đã tìm thấy người lạ! Hãy gửi lời chào.' });
    } else {
      // Không có ai, đưa vào hàng đợi
      waitingUsers.push(socket);
      socket.emit('waiting', { message: 'Đang tìm kiếm người lạ...' });
    }
  });

  // Xử lý gửi tin nhắn
socket.on("send_message", (data) => {
    // data lúc này sẽ là: { room: "...", sender: "...", text: "...", image: "base64..." }
    // Phát (broadcast) dữ liệu này cho người đang ở chung phòng
    socket.to(data.room).emit("receive_message", data);
});

  // Xử lý khi user chủ động ngắt/bỏ qua người hiện tại
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
      // Nếu đang trong hàng đợi mà hủy
      waitingUsers = waitingUsers.filter(u => u.id !== socket.id);
    }
  });

  // Xử lý khi user đóng tab/mất kết nối mạng
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