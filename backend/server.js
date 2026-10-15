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
let reportsList = [];
let bannedUsers = []; // DANH SÁCH ĐEN chứa những cái tên bị Admin cấm

function calculateDistance(lat1, lon1, lat2, lon2) {
  const R = 6371; 
  const dLat = (lat2 - lat1) * Math.PI / 180;
  const dLon = (lon2 - lon1) * Math.PI / 180;
  const a = Math.sin(dLat/2) * Math.sin(dLat/2) + Math.cos(lat1 * Math.PI / 180) * Math.cos(lat2 * Math.PI / 180) * Math.sin(dLon/2) * Math.sin(dLon/2); 
  return R * (2 * Math.atan2(Math.sqrt(a), Math.sqrt(1-a)));
}

setInterval(() => {
    if (io.sockets.adapter.rooms.get('admin_room')) {
        io.to('admin_room').emit('admin_stats', {
            online: io.engine.clientsCount,
            waiting: waitingUsers.length,
            matches: Object.keys(pendingMatches).length,
            reports: reportsList.length
        });
    }
}, 3000);

io.on('connection', (socket) => {
  
  // --- ADMIN LOGIC ---
  socket.on('admin_login', (password) => {
    if (password === 'admin123') { 
      socket.join('admin_room');
      socket.emit('admin_auth_success', reportsList); 
    } else {
      socket.emit('admin_auth_fail');
    }
  });

  socket.on('admin_broadcast', (data) => {
    if (socket.rooms.has('admin_room')) {
        io.emit('system_broadcast', { message: data.message });
    }
  });

  // TÍNH NĂNG MỚI: ADMIN KHÓA TÀI KHOẢN
  socket.on('admin_ban_user', (badUserName) => {
      if (socket.rooms.has('admin_room')) {
          if (!bannedUsers.includes(badUserName)) {
              bannedUsers.push(badUserName); // Thêm vào sổ đen
          }
          
          // Quét toàn bộ server, nếu thấy kẻ này đang online thì đá văng ngay lập tức
          for (let [id, s] of io.sockets.sockets) {
              if (s.userData && s.userData.name === badUserName) {
                  s.emit('system_broadcast', { message: 'Tài khoản của bạn đã bị ADMIN KHÓA vĩnh viễn do vi phạm quy tắc cộng đồng!' });
                  s.disconnect(true); // Cắt mạng người này
              }
          }
      }
  });

  // --- XỬ LÝ BÁO CÁO ---
  socket.on('report_user', (data) => {
    if (socket.room && socket.partnerId) {
        const partnerSocket = io.sockets.sockets.get(socket.partnerId);
        const partnerName = partnerSocket ? partnerSocket.userData.name : 'Người lạ';
        
        const newReport = {
            id: Date.now(),
            time: new Date().toLocaleTimeString(),
            reporter: socket.userData.name,
            reported: partnerName,
            reason: data.reason || 'Quấy rối / Spam'
        };
        reportsList.unshift(newReport);
        io.to('admin_room').emit('admin_new_report', newReport);
    }
  });

  // --- CHAT LOGIC ---
  socket.on('find_stranger', (userData) => {
    socket.userData = userData; 

    // CHẶN CỬA: Nếu người này nằm trong sổ đen, không cho tìm người lạ
    if (bannedUsers.includes(userData.name)) {
        socket.emit('system_broadcast', { message: 'Bạn không thể tìm người lạ vì tài khoản này đã bị khóa!' });
        socket.emit('match_rejected', { message: 'Tài khoản của bạn đang bị cấm.' });
        return;
    }

    let partnerIndex = waitingUsers.findIndex(partner => {
        const pData = partner.userData;
        const matchMyTarget = userData.targetGender === 'Bất kỳ' || userData.targetGender === pData.myGender;
        const matchPartnerTarget = pData.targetGender === 'Bất kỳ' || pData.targetGender === userData.myGender;
        return matchMyTarget && matchPartnerTarget;
    });

    if (partnerIndex !== -1) {
      const partner = waitingUsers.splice(partnerIndex, 1)[0];
      const matchId = `${socket.id}#${partner.id}`;
      
      let distance = 'Chưa xác định';
      if (socket.userData.location && partner.userData.location) {
        const distKm = calculateDistance(socket.userData.location.lat, socket.userData.location.lng, partner.userData.location.lat, partner.userData.location.lng);
        distance = distKm < 1 ? '< 1 km' : `${distKm.toFixed(1)} km`;
      }

      pendingMatches[matchId] = { user1: socket.id, user2: partner.id, user1Confirm: null, user2Confirm: null };
      socket.currentMatch = matchId; partner.currentMatch = matchId;

      socket.emit('match_found', { distance, partnerName: partner.userData.name, partnerGender: partner.userData.myGender });
      partner.emit('match_found', { distance, partnerName: socket.userData.name, partnerGender: socket.userData.myGender });
    } else {
      waitingUsers.push(socket);
      socket.emit('waiting', { message: `Đang tìm ${userData.targetGender !== 'Bất kỳ' ? userData.targetGender : 'người lạ'} phù hợp...` });
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