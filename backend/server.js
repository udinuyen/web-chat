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
  },
  maxHttpBufferSize: 1e7
});

let waitingUsers = [];
let pendingMatches = {}; // Quản lý các cặp đang chờ xác nhận

// Công thức Haversine tính khoảng cách (trả về km)
function calculateDistance(lat1, lon1, lat2, lon2) {
  const R = 6371; // Bán kính trái đất tính bằng km
  const dLat = (lat2 - lat1) * Math.PI / 180;
  const dLon = (lon2 - lon1) * Math.PI / 180;
  const a = 
    Math.sin(dLat/2) * Math.sin(dLat/2) +
    Math.cos(lat1 * Math.PI / 180) * Math.cos(lat2 * Math.PI / 180) * 
    Math.sin(dLon/2) * Math.sin(dLon/2); 
  const c = 2 * Math.atan2(Math.sqrt(a), Math.sqrt(1-a)); 
  const d = R * c; 
  return d;
}

io.on('connection', (socket) => {
  console.log('Một người dùng đã kết nối:', socket.id);

  socket.on('find_stranger', (userData) => {
    socket.userData = userData; 

    if (waitingUsers.length > 0) {
      const partner = waitingUsers.shift();
      const matchId = `${socket.id}#${partner.id}`;
      
      // Tính khoảng cách
      let distance = 'Chưa xác định';
      if (socket.userData.location && partner.userData.location) {
        const distKm = calculateDistance(
          socket.userData.location.lat, socket.userData.location.lng,
          partner.userData.location.lat, partner.userData.location.lng
        );
        distance = distKm < 1 ? '< 1 km' : `${distKm.toFixed(1)} km`;
      }

      // Lưu trạng thái chờ xác nhận
      pendingMatches[matchId] = {
        user1: socket.id,
        user2: partner.id,
        user1Confirm: null,
        user2Confirm: null
      };
      
      socket.currentMatch = matchId;
      partner.currentMatch = matchId;

      // Gửi yêu cầu xác nhận cho cả 2
      socket.emit('match_found', { distance: distance, partnerName: 'Người lạ' });
      partner.emit('match_found', { distance: distance, partnerName: 'Người lạ' });

    } else {
      waitingUsers.push(socket);
      socket.emit('waiting', { message: 'Đang tìm kiếm người lạ...' });
    }
  });

  // Xử lý xác nhận/từ chối từ client
  socket.on('match_response', (response) => {
    const matchId = socket.currentMatch;
    if (!matchId || !pendingMatches[matchId]) return;

    const match = pendingMatches[matchId];
    
    // Lưu phản hồi
    if (socket.id === match.user1) match.user1Confirm = response.accept;
    if (socket.id === match.user2) match.user2Confirm = response.accept;

    // Nếu có 1 người từ chối
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

    // Nếu cả 2 cùng đồng ý
    if (match.user1Confirm === true && match.user2Confirm === true) {
      const roomName = matchId;
      const otherId = socket.id === match.user1 ? match.user2 : match.user1;
      const otherSocket = io.sockets.sockets.get(otherId);

      if (otherSocket) {
        socket.join(roomName);
        otherSocket.join(roomName);

        socket.room = roomName;
        otherSocket.room = roomName;
        socket.partnerId = otherSocket.id;
        otherSocket.partnerId = socket.id;

        io.to(roomName).emit('chat_start', { message: 'Đã kết nối! Hãy bắt đầu trò chuyện.' });
      }
      
      socket.currentMatch = null;
      if (otherSocket) otherSocket.currentMatch = null;
      delete pendingMatches[matchId];
    }
  });


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
    
    // Nếu đang chờ xác nhận mà out
    if (socket.currentMatch) {
        const match = pendingMatches[socket.currentMatch];
        if (match) {
            const otherId = socket.id === match.user1 ? match.user2 : match.user1;
            const otherSocket = io.sockets.sockets.get(otherId);
            if (otherSocket) {
                 otherSocket.emit('match_rejected', { message: 'Người lạ đã rời đi.' });
                 otherSocket.currentMatch = null;
            }
            delete pendingMatches[socket.currentMatch];
        }
    }
    waitingUsers = waitingUsers.filter(u => u.id !== socket.id);
  });
});

const PORT = process.env.PORT || 5000;
server.listen(PORT, () => {
  console.log(`Server đang chạy trên cổng ${PORT}`);
});