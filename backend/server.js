const express = require('express');
const http = require('http');
const { Server } = require('socket.io');
const cors = require('cors');
require('dotenv').config();

const app = express();
app.use(cors());

const server = http.createServer(app);
const io = new Server(server, {
  cors: { origin: "*", methods: ["GET", "POST"] },
  maxHttpBufferSize: 1e7
});

let waitingUsers = [];
let pendingMatches = {}; 

// Hàm tính khoảng cách
function calculateDistance(lat1, lon1, lat2, lon2) {
  const R = 6371; 
  const dLat = (lat2 - lat1) * Math.PI / 180;
  const dLon = (lon2 - lon1) * Math.PI / 180;
  const a = Math.sin(dLat/2) * Math.sin(dLat/2) + Math.cos(lat1 * Math.PI / 180) * Math.cos(lat2 * Math.PI / 180) * Math.sin(dLon/2) * Math.sin(dLon/2); 
  const c = 2 * Math.atan2(Math.sqrt(a), Math.sqrt(1-a)); 
  return R * c;
}

// Gửi thống kê cho Admin mỗi 3 giây
setInterval(() => {
    if (io.sockets.adapter.rooms.get('admin_room')) {
        const stats = {
            online: io.engine.clientsCount, // Tổng số người đang mở web/app
            waiting: waitingUsers.length,   // Số người đang chờ ghép đôi
            matches: Object.keys(pendingMatches).length // Số cặp đang chờ xác nhận
        };
        io.to('admin_room').emit('admin_stats', stats);
    }
}, 3000);

io.on('connection', (socket) => {
  console.log('User connected:', socket.id);

  // 1. TÍNH NĂNG DÀNH RIÊNG CHO ADMIN
  socket.on('admin_login', (password) => {
    if (password === 'admin123') { // Mật khẩu quản trị của bạn
      socket.join('admin_room');
      socket.emit('admin_auth_success');
    } else {
      socket.emit('admin_auth_fail');
    }
  });

  socket.on('admin_broadcast', (data) => {
    if (socket.rooms.has('admin_room')) {
        // Gửi thông báo đến TẤT CẢ mọi người
        io.emit('system_broadcast', { message: data.message });
    }
  });

  // 2. TÍNH NĂNG CHAT NGƯỜI LẠ (Giữ nguyên)
  socket.on('find_stranger', (userData) => {
    socket.userData = userData; 
    if (waitingUsers.length > 0) {
      const partner = waitingUsers.shift();
      const matchId = `${socket.id}#${partner.id}`;
      
      let distance = 'Chưa xác định';
      if (socket.userData.location && partner.userData.location) {
        const distKm = calculateDistance(socket.userData.location.lat, socket.userData.location.lng, partner.userData.location.lat, partner.userData.location.lng);
        distance = distKm < 1 ? '< 1 km' : `${distKm.toFixed(1)} km`;
      }

      pendingMatches[matchId] = { user1: socket.id, user2: partner.id, user1Confirm: null, user2Confirm: null };
      socket.currentMatch = matchId; partner.currentMatch = matchId;

      socket.emit('match_found', { distance, partnerName: 'Người lạ' });
      partner.emit('match_found', { distance, partnerName: 'Người lạ' });
    } else {
      waitingUsers.push(socket);
      socket.emit('waiting', { message: 'Đang tìm kiếm người lạ...' });
    }
  });

  socket.on('match_response', (response) => {
    const matchId = socket.currentMatch;
    if (!matchId || !pendingMatches[matchId]) return;
    const match = pendingMatches[matchId];
    
    if (socket.id === match.user1) match.user1Confirm = response.accept;
    if (socket.id === match.user2) match.user2Confirm = response.accept;

    if (match.user1Confirm === false || match.user2Confirm === false) {
      const otherId = socket.id === match.user1 ? match.user2 : match.user1;
      const otherSocket = io.sockets.sockets.get(otherId);
      if (otherSocket) {
        otherSocket.emit('match_rejected', { message: 'Người lạ đã từ chối.' });
        otherSocket.currentMatch = null;
      }
      socket.emit('match_rejected', { message: 'Đã hủy ghép đôi.' });
      socket.currentMatch = null;
      delete pendingMatches[matchId];
      return;
    }

    if (match.user1Confirm === true && match.user2Confirm === true) {
      const roomName = matchId;
      const otherId = socket.id === match.user1 ? match.user2 : match.user1;
      const otherSocket = io.sockets.sockets.get(otherId);
      if (otherSocket) {
        socket.join(roomName); otherSocket.join(roomName);
        socket.room = roomName; otherSocket.room = roomName;
        socket.partnerId = otherSocket.id; otherSocket.partnerId = socket.id;
        io.to(roomName).emit('chat_start', { message: 'Đã kết nối! Hãy bắt đầu trò chuyện.' });
      }
      socket.currentMatch = null;
      if (otherSocket) otherSocket.currentMatch = null;
      delete pendingMatches[matchId];
    }
  });

  socket.on("send_message", (data) => {
    if (socket.room) socket.to(socket.room).emit("receive_message", data);
  }); 

  socket.on('leave_chat', () => {
    if (socket.room) {
      socket.to(socket.room).emit('stranger_left', { message: 'Người lạ đã rời khỏi cuộc trò chuyện.' });
      const partnerSocket = io.sockets.sockets.get(socket.partnerId);
      if (partnerSocket) {
        partnerSocket.leave(socket.room);
        partnerSocket.room = null; partnerSocket.partnerId = null;
      }
      socket.leave(socket.room);
      socket.room = null; socket.partnerId = null;
    } else {
      waitingUsers = waitingUsers.filter(u => u.id !== socket.id);
    }
  });

  socket.on('disconnect', () => {
    if (socket.room) socket.to(socket.room).emit('stranger_left', { message: 'Người lạ đã mất kết nối.' });
    if (socket.currentMatch && pendingMatches[socket.currentMatch]) {
        const match = pendingMatches[socket.currentMatch];
        const otherId = socket.id === match.user1 ? match.user2 : match.user1;
        const otherSocket = io.sockets.sockets.get(otherId);
        if (otherSocket) {
            otherSocket.emit('match_rejected', { message: 'Người lạ đã rời đi.' });
            otherSocket.currentMatch = null;
        }
        delete pendingMatches[socket.currentMatch];
    }
    waitingUsers = waitingUsers.filter(u => u.id !== socket.id);
  });
});

const PORT = process.env.PORT || 5000;
server.listen(PORT, () => console.log(`Server đang chạy trên cổng ${PORT}`));