const express = require('express');
const http = require('http');
const { Server } = require('socket.io');
const cors = require('cors');
const { OAuth2Client } = require('google-auth-library');
const jwt = require('jsonwebtoken');
require('dotenv').config();

const app = express();
app.use(cors());
app.use(express.json()); // Hỗ trợ đọc JSON body

const server = http.createServer(app);
const io = new Server(server, {
  cors: { origin: "*", methods: ["GET", "POST"] },
  maxHttpBufferSize: 1e7
});

// CẤU HÌNH BẢO MẬT
const GOOGLE_CLIENT_ID = process.env.GOOGLE_CLIENT_ID || "YOUR_GOOGLE_CLIENT_ID";
const client = new OAuth2Client(GOOGLE_CLIENT_ID);
const JWT_SECRET = process.env.JWT_SECRET || "chuoi-bao-mat-sieu-cap-vip-pro-2026";

let waitingUsers = [];
let pendingMatches = {}; 
let reportsList = [];
let bannedUsers = []; // Lưu ID thật thay vì Tên để chống đổi tên lách luật

// ----------------------------------------------------
// 1. CÁC ENDPOINT API XÁC THỰC (AUTHENTICATION)
// ----------------------------------------------------

// Đăng nhập bằng Google
app.post('/api/auth/google', async (req, res) => {
    try {
        const { token, myGender, targetGender } = req.body;
        // Xác minh chữ ký từ Google thật 100%
        const ticket = await client.verifyIdToken({
            idToken: token,
            audience: GOOGLE_CLIENT_ID,
        });
        const payload = ticket.getPayload();
        
        // Tạo JWT nội bộ
        const user = { id: payload.sub, name: payload.name, email: payload.email, role: 'user', myGender, targetGender, avatar: payload.picture };
        const authToken = jwt.sign(user, JWT_SECRET, { expiresIn: '24h' });
        res.json({ token: authToken, user });
    } catch (err) {
        console.error(err);
        res.status(401).json({ error: 'Token Google không hợp lệ hoặc đã hết hạn.' });
    }
});

// Đăng nhập Khách (Server tự cấp ID)
app.post('/api/auth/guest', (req, res) => {
    const { myGender, targetGender } = req.body;
    const guestId = 'guest_' + Math.random().toString(36).substr(2, 10);
    const guestName = 'Guest_' + Math.floor(Math.random() * 10000);
    
    const user = { id: guestId, name: guestName, role: 'guest', myGender, targetGender };
    const authToken = jwt.sign(user, JWT_SECRET, { expiresIn: '24h' });
    res.json({ token: authToken, user });
});

// Đăng nhập Admin
app.post('/api/auth/admin', (req, res) => {
    const { password } = req.body;
    if (password === 'admin123') { 
        const user = { id: 'admin_master', name: 'Quản Trị Viên', role: 'admin' };
        const authToken = jwt.sign(user, JWT_SECRET, { expiresIn: '12h' });
        res.json({ token: authToken, user });
    } else {
        res.status(401).json({ error: 'Sai mật khẩu Admin!' });
    }
});

// ----------------------------------------------------
// 2. MIDDLEWARE SOCKET.IO (NGƯỜI GÁC CỔNG)
// ----------------------------------------------------
io.use((socket, next) => {
    const token = socket.handshake.auth.token;
    if (!token) return next(new Error("LỖI: Truy cập trái phép (Thiếu Token)"));
    
    jwt.verify(token, JWT_SECRET, (err, decoded) => {
        if (err) return next(new Error("LỖI: Token đã hết hạn hoặc bị giả mạo"));
        
        // Kiểm tra xem ID này có đang bị cấm không
        if (bannedUsers.includes(decoded.id)) {
            return next(new Error("BANNED"));
        }
        
        // Gắn danh tính thật vào socket (Không tin tưởng dữ liệu client tự gửi nữa)
        socket.user = decoded; 
        next();
    });
});

// ----------------------------------------------------
// 3. SOCKET.IO LOGIC CHÍNH
// ----------------------------------------------------
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
  // Tự động phân quyền vào phòng Admin
  if (socket.user.role === 'admin') {
      socket.join('admin_room');
      socket.emit('admin_auth_success', reportsList);
  }

  socket.on('admin_broadcast', (data) => {
    if (socket.user.role === 'admin') {
        io.emit('system_broadcast', { message: data.message });
    }
  });

  socket.on('admin_ban_user', (badUserId) => {
      if (socket.user.role === 'admin') {
          if (!bannedUsers.includes(badUserId)) bannedUsers.push(badUserId);
          
          for (let [id, s] of io.sockets.sockets) {
              if (s.user && s.user.id === badUserId) {
                  s.emit('system_broadcast', { message: 'Tài khoản của bạn đã bị KHÓA vĩnh viễn!' });
                  s.disconnect(true);
              }
          }
      }
  });

  socket.on('report_user', (data) => {
    if (socket.room && socket.partnerId) {
        const partnerSocket = io.sockets.sockets.get(socket.partnerId);
        if(!partnerSocket) return;
        
        const newReport = {
            id: Date.now(),
            time: new Date().toLocaleTimeString(),
            reporterId: socket.user.id,
            reporterName: socket.user.name,
            reportedId: partnerSocket.user.id, // Báo cáo bằng ID thật
            reportedName: partnerSocket.user.name,
            reason: data.reason || 'Vi phạm cộng đồng'
        };
        reportsList.unshift(newReport);
        io.to('admin_room').emit('admin_new_report', newReport);
    }
  });

  socket.on('find_stranger', (locationData) => {
    // Client chỉ được gửi lên vị trí, danh tính lấy từ token
    const myIdentity = socket.user; 
    socket.location = locationData; // Lưu vị trí tạm thời
    
    let partnerIndex = waitingUsers.findIndex(partner => {
        const matchMyTarget = myIdentity.targetGender === 'Bất kỳ' || myIdentity.targetGender === partner.user.myGender;
        const matchPartnerTarget = partner.user.targetGender === 'Bất kỳ' || partner.user.targetGender === myIdentity.myGender;
        return matchMyTarget && matchPartnerTarget;
    });

    if (partnerIndex !== -1) {
      const partner = waitingUsers.splice(partnerIndex, 1)[0];
      const matchId = `${socket.id}#${partner.id}`;
      
      let distance = 'Chưa xác định';
      if (socket.location && partner.location) {
        const distKm = calculateDistance(socket.location.lat, socket.location.lng, partner.location.lat, partner.location.lng);
        distance = distKm < 1 ? '< 1 km' : `${distKm.toFixed(1)} km`;
      }

      pendingMatches[matchId] = { user1: socket.id, user2: partner.id, user1Confirm: null, user2Confirm: null };
      socket.currentMatch = matchId; partner.currentMatch = matchId;

      socket.emit('match_found', { distance, partnerName: partner.user.name, partnerGender: partner.user.myGender });
      partner.emit('match_found', { distance, partnerName: myIdentity.name, partnerGender: myIdentity.myGender });
    } else {
      waitingUsers.push(socket);
      socket.emit('waiting', { message: `Đang tìm ${myIdentity.targetGender !== 'Bất kỳ' ? myIdentity.targetGender : 'người lạ'} phù hợp...` });
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

 // --- THÊM BIẾN LƯU THỜI GIAN ĐỂ CHỐNG SPAM ---
  socket.lastMessageTime = 0;

  socket.on("send_message", (data) => {
    // 1. Kiểm tra quyền: Phải đang ở trong phòng chat (đã ghép đôi) mới được gửi
    if (!socket.room) return;

    // 2. Chống Spam (Rate Limiting): Bắt buộc cách nhau ít nhất 0.5 giây (500ms) mỗi tin
    const now = Date.now();
    if (now - socket.lastMessageTime < 500) {
        socket.emit('system_broadcast', { message: 'Bạn gửi tin nhắn quá nhanh, vui lòng chậm lại!' });
        return;
    }
    socket.lastMessageTime = now;

    // 3. Kiểm duyệt Dữ liệu (Validation)
    if (data.text) {
        // Chặn tin nhắn quá dài (giới hạn 1000 ký tự)
        if (data.text.length > 1000) {
            socket.emit('system_broadcast', { message: 'Tin nhắn của bạn quá dài (tối đa 1000 ký tự).' });
            return;
        }
        // Làm sạch mã HTML cơ bản (chống tấn công XSS - Cross Site Scripting)
        data.text = data.text.replace(/</g, "&lt;").replace(/>/g, "&gt;");
    }

    if (data.image) {
        // Chặn ảnh nén dung lượng ảo từ hacker (2MB Base64 ~ 2.8 triệu ký tự)
        if (data.image.length > 2.8 * 1024 * 1024) {
            socket.emit('system_broadcast', { message: 'File ảnh không hợp lệ hoặc quá lớn!' });
            return;
        }
    }

    // 4. Vượt qua hết vòng kiểm duyệt -> Phát tin nhắn đi
    socket.to(socket.room).emit("receive_message", data);
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