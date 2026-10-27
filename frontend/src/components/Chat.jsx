import React, { useState, useEffect, useRef } from 'react';
import io from 'socket.io-client';
import { SOCKET_URL } from '../config';

let socket;

export default function Chat({ token, user, onLogout }) {
  const [chatState, setChatState] = useState('IDLE');
  const [messages, setMessages] = useState([]);
  const [inputText, setInputText] = useState('');
  const [matchInfo, setMatchInfo] = useState(null); 
  const messagesEndRef = useRef(null);
  const [showQR, setShowQR] = useState(false);

  useEffect(() => {
    // 1. CHỨNG THỰC BẢO MẬT QUA SOCKET (Gửi Token)
    socket = io(SOCKET_URL, {
        auth: { token }
    });

    socket.on("connect_error", (err) => {
        if (err.message === "BANNED") {
            alert("Tài khoản của bạn đã bị khóa vĩnh viễn!");
            onLogout();
        } else {
            console.error("Lỗi xác thực:", err.message);
        }
    });

    socket.on('waiting', (data) => {
      setChatState('WAITING');
      setMessages([{ type: 'system', text: data.message }]);
    });
    
    socket.on('system_broadcast', (data) => {
        alert("📢 THÔNG BÁO TỪ HỆ THỐNG:\n\n" + data.message);
    });

    socket.on('match_found', (data) => {
        setChatState('PENDING_CONFIRM');
        setMatchInfo(data);
    });
    
    socket.on('match_rejected', (data) => {
        setChatState('IDLE');
        setMatchInfo(null);
        setMessages([{ type: 'system', text: data.message }]);
    });

    socket.on('chat_start', (data) => {
      setChatState('CONNECTED');
      setMatchInfo(null);
      setMessages([{ type: 'system', text: data.message }]);
    });

    socket.on('receive_message', (data) => {
      setMessages((prev) => [...prev, { type: 'stranger', text: data.text, image: data.image }]);
    });

    socket.on('stranger_left', (data) => {
      setChatState('IDLE');
      setMessages((prev) => [...prev, { type: 'system', text: data.message }]);
    });

    return () => {
      socket.disconnect();
    };
  }, [token, onLogout]);

  useEffect(() => {
    messagesEndRef.current?.scrollIntoView({ behavior: 'smooth' });
  }, [messages]);

  // Hàm xử lý cuộn khi bàn phím ảo điện thoại bật lên
  const handleFocus = (e) => {
    setTimeout(() => {
        e.target.scrollIntoView({ behavior: 'smooth', block: 'end' });
        messagesEndRef.current?.scrollIntoView({ behavior: 'smooth' });
    }, 300);
  };

  const findStranger = () => {
    setMessages([]);
    setChatState('WAITING');
    
    // Gửi vị trí, KHÔNG gửi user info vì server đã tự đọc từ Token
    if ("geolocation" in navigator) {
        navigator.geolocation.getCurrentPosition(
            (position) => {
                socket.emit('find_stranger', {
                    lat: position.coords.latitude,
                    lng: position.coords.longitude
                });
            },
            (error) => {
                socket.emit('find_stranger', null); 
            },
            { timeout: 5000 }
        );
    } else {
        socket.emit('find_stranger', null);
    }
  };
  
  const handleMatchResponse = (accept) => {
      socket.emit('match_response', { accept });
      if (!accept) {
          setChatState('IDLE');
          setMatchInfo(null);
      } else {
          setMessages([{ type: 'system', text: 'Đang chờ đối phương xác nhận...' }]);
      }
  }

  const leaveChat = () => {
    socket.emit('leave_chat');
    setChatState('IDLE');
    setMessages([{ type: 'system', text: 'Bạn đã ngắt kết nối.' }]);
  };

  const handleReport = () => {
    if (chatState !== 'CONNECTED') return;
    const reason = window.prompt("Nhập lý do báo cáo:", "");
    if (reason !== null) {
        socket.emit('report_user', { reason: reason || 'Vi phạm tiêu chuẩn cộng đồng' });
        alert("Đã gửi báo cáo! Bạn sẽ ngắt kết nối với người này.");
        leaveChat(); 
    }
  };

  const sendMessage = (e) => {
    e.preventDefault();
    if (inputText.trim() === '' || chatState !== 'CONNECTED') return;
    setMessages((prev) => [...prev, { type: 'me', text: inputText }]);
    socket.emit('send_message', { text: inputText });
    setInputText('');
  };

  const sendImage = (event) => {
    const file = event.target.files[0];
    if (file && chatState === 'CONNECTED') {
        if (file.size > 2 * 1024 * 1024) return alert("Ảnh phải nhỏ hơn 2MB!");
        const reader = new FileReader();
        reader.readAsDataURL(file);
        reader.onload = () => {
            socket.emit("send_message", { image: reader.result });
            setMessages((prev) => [...prev, { type: 'me', image: reader.result }]);
        };
    }
  };

  return (
    <div className="chat-wrapper" style={{ display: 'flex', flexDirection: 'column', height: '100%' }}>
      <div className="chat-header">
        <div>
          <strong>{user.name}</strong>
          <div style={{ fontSize: 12 }}>{chatState === 'CONNECTED' ? 'Đang chat' : 'Trống'}</div>
        </div>
        <div style={{ display: 'flex', gap: '10px' }}>
            {chatState === 'CONNECTED' && (
                <button onClick={handleReport} style={{ backgroundColor: '#dc3545', color: 'white', border: 'none', padding: '8px 15px', borderRadius: '5px', cursor: 'pointer' }}>🚨 Báo Cáo</button>
            )}
            <button onClick={() => setShowQR(true)} style={{ backgroundColor: '#ff9800', color: 'white', border: 'none', padding: '8px 15px', borderRadius: '5px', cursor: 'pointer' }}>📱 Tải App</button>
            <button onClick={onLogout}>Đăng xuất</button>
            
            {/* Nút báo cáo lỗi Google Form */}
          <button 
    onClick={() => window.open('https://docs.google.com/forms/d/e/1FAIpQLSdIyAGyb_N9KbYeR4VHZeXvPSfgjGUlzfxOWw439_YGM1uwxA/viewform', '_blank')}
    style={{
        backgroundColor: '#4f46e5',
        color: 'white',
        border: 'none',
        padding: '8px 12px',
        borderRadius: '8px',
        cursor: 'pointer',
        fontSize: '12px',
        fontWeight: 'bold',
        marginLeft: '10px' 
    }}
>
    💡 Góp ý / Báo lỗi
</button>
        </div>
      </div>

      {showQR && (
          <div style={{ position: 'fixed', top: 0, left: 0, width: '100%', height: '100%', backgroundColor: 'rgba(0,0,0,0.6)', zIndex: 9999, display: 'flex', justifyContent: 'center', alignItems: 'center' }}>
              <div style={{ backgroundColor: 'white', padding: '25px', borderRadius: '15px', textAlign: 'center' }}>
                  <h3 style={{ color: '#000' }}>Quét mã để tải App</h3>
                  <img src="/app_qr_code.png" alt="QR Code" style={{ width: '250px', height: '250px', margin: '15px 0' }} />
                  <br />
                  <button onClick={() => setShowQR(false)} style={{ padding: '10px 25px', backgroundColor: '#dc3545', color: 'white', border: 'none', borderRadius: '8px', cursor: 'pointer' }}>Đóng</button>
              </div>
          </div>
      )}

      <div className="chat-messages" style={{ position: 'relative', flex: 1, overflowY: 'auto', paddingBottom: '10px' }}>
        {chatState === 'PENDING_CONFIRM' && matchInfo && (
            <div style={{ position: 'absolute', top: '50%', left: '50%', transform: 'translate(-50%, -50%)', backgroundColor: 'white', padding: '20px', borderRadius: '10px', boxShadow: '0 4px 8px rgba(0,0,0,0.2)', textAlign: 'center', zIndex: 10, width: '80%', color: '#000' }}>
                <h4 style={{ margin: '0 0 10px' }}>Tìm thấy người lạ!</h4>
                <p>Đối phương là: <strong style={{ color: matchInfo.partnerGender === 'Nữ' ? '#e91e63' : '#2196f3' }}>{matchInfo.partnerGender}</strong></p>
                <p>Khoảng cách: <strong>{matchInfo.distance}</strong></p>
                <p>Bạn có muốn trò chuyện không?</p>
                <div style={{ display: 'flex', justifyContent: 'space-around', marginTop: '15px' }}>
                    <button onClick={() => handleMatchResponse(true)} style={{ backgroundColor: '#28a745', padding: '8px 20px', borderRadius: '5px', color: 'white', border: 'none', cursor: 'pointer' }}>Vào Chat</button>
                    <button onClick={() => handleMatchResponse(false)} style={{ backgroundColor: '#dc3545', padding: '8px 20px', borderRadius: '5px', color: 'white', border: 'none', cursor: 'pointer' }}>Từ Chối</button>
                </div>
            </div>
        )}
        {messages.map((msg, index) => {
          if (msg.type === 'system') return <div key={index} className="status-text" style={{ textAlign: 'center', margin: '10px', color: 'gray' }}>{msg.text}</div>;
          return (
            <div key={index} className={`message ${msg.type}`} style={{ textAlign: msg.type === 'me' ? 'right' : 'left', margin: '10px 0' }}>
              <div className="message-content" style={{ display: 'inline-block', padding: '10px', borderRadius: '8px', backgroundColor: msg.type === 'me' ? '#dcf8c6' : '#f1f0f0', color: '#000', textAlign: 'left' }}>
                {msg.text && <p style={{ margin: 0 }}>{msg.text}</p>}
                {msg.image && <img src={msg.image} alt="img" style={{ maxWidth: "200px", borderRadius: "8px", marginTop: msg.text ? "5px" : "0" }} />}
              </div>
            </div>
          );
        })}
        <div ref={messagesEndRef} />
        {chatState === 'IDLE' && <button className="find-btn" onClick={findStranger} style={{ width: '100%', padding: '15px', backgroundColor: '#007bff', color: 'white', border: 'none', borderRadius: '5px', fontWeight: 'bold', cursor: 'pointer', marginTop: '15px' }}>TÌM NGƯỜI LẠ</button>}
      </div>
      
      <form className="chat-input-area" onSubmit={sendMessage} style={{ display: 'flex', alignItems: 'center', marginTop: '10px' }}>
        <input 
            type="text" 
            placeholder="Nhập tin nhắn..." 
            value={inputText} 
            onChange={(e) => setInputText(e.target.value)} 
            onFocus={handleFocus} /* Gọi hàm cuộn khi bàn phím ảo bật lên */
            disabled={chatState !== 'CONNECTED'} 
            style={{ flex: 1, padding: '10px' }} 
        />
        <label className="image-upload-btn" style={{ cursor: chatState === 'CONNECTED' ? 'pointer' : 'not-allowed', margin: '0 10px', fontSize: '24px' }}>
          📷<input type="file" accept="image/*" style={{ display: "none" }} onChange={sendImage} disabled={chatState !== 'CONNECTED'} />
        </label>
        <button type="submit" disabled={chatState !== 'CONNECTED'} style={{ padding: '10px 20px', backgroundColor: chatState === 'CONNECTED' ? '#007bff' : '#ccc', color: 'white', border: 'none', borderRadius: '5px' }}>Gửi</button>
      </form>
    </div>
  );
}