import React, { useState, useEffect, useRef } from 'react';
import io from 'socket.io-client';
// Không cần import Message nữa vì ta sẽ render trực tiếp để hỗ trợ cả ảnh và chữ
import { SOCKET_URL } from '../config';

let socket;

export default function Chat({ user, onLogout }) {
  const [chatState, setChatState] = useState('IDLE'); // IDLE, WAITING, CONNECTED
  const [messages, setMessages] = useState([]);
  const [inputText, setInputText] = useState('');
  const messagesEndRef = useRef(null);

  useEffect(() => {
    socket = io(SOCKET_URL);

    socket.on('waiting', (data) => {
      setChatState('WAITING');
      setMessages([{ type: 'system', text: data.message }]);
    });

    socket.on('chat_start', (data) => {
      setChatState('CONNECTED');
      setMessages([{ type: 'system', text: data.message }]);
    });

    // CẬP NHẬT: Nhận cả text và image từ người lạ
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
  }, []);

  useEffect(() => {
    messagesEndRef.current?.scrollIntoView({ behavior: 'smooth' });
  }, [messages]);

  const findStranger = () => {
    setMessages([]);
    socket.emit('find_stranger', user);
  };

  const leaveChat = () => {
    socket.emit('leave_chat');
    setChatState('IDLE');
    setMessages([{ type: 'system', text: 'Bạn đã ngắt kết nối.' }]);
  };

const sendMessage = (e) => {
    e.preventDefault();
    if (inputText.trim() === '' || chatState !== 'CONNECTED') return;

    // Cập nhật cấu trúc tin nhắn để truyền qua socket giống với tính năng ảnh
    const messageData = { 
        text: inputText 
    };

    setMessages((prev) => [...prev, { type: 'me', text: inputText }]);
    
    // Gửi đúng object messageData
    socket.emit('send_message', messageData); 
    setInputText('');
  };

  // CẬP NHẬT: Hàm gửi ảnh đã được đồng bộ với biến messages
  const sendImage = (event) => {
    const file = event.target.files[0];
    if (file && chatState === 'CONNECTED') {
        if (file.size > 2 * 1024 * 1024) {
            alert("Vui lòng chọn ảnh nhỏ hơn 2MB!");
            return;
        }

        const reader = new FileReader();
        reader.readAsDataURL(file);
        reader.onload = () => {
            const base64Image = reader.result;
            
            // Gửi qua server
            socket.emit("send_message", { image: base64Image });
            
            // Hiển thị lên màn hình của mình
            setMessages((prev) => [...prev, { type: 'me', image: base64Image }]);
        };
    }
  };

  return (
    <div className="chat-wrapper">
      <div className="chat-header">
        <div>
          <strong>{user.name}</strong>
          <div style={{ fontSize: 12 }}>{chatState === 'CONNECTED' ? 'Đang chat' : 'Trống'}</div>
        </div>
        <button onClick={onLogout}>Đăng xuất</button>
      </div>

      <div className="chat-messages">
        {messages.map((msg, index) => {
          if (msg.type === 'system') {
            return <div key={index} className="status-text">{msg.text}</div>;
          }
          
          // CẬP NHẬT: Giao diện tin nhắn xử lý cả chữ và ảnh
          return (
            <div key={index} className={`message ${msg.type}`} style={{ textAlign: msg.type === 'me' ? 'right' : 'left', margin: '10px 0' }}>
              <div className="message-content" style={{ display: 'inline-block', padding: '10px', borderRadius: '8px', backgroundColor: msg.type === 'me' ? '#dcf8c6' : '#f1f0f0', textAlign: 'left' }}>
                {msg.text && <p style={{ margin: 0 }}>{msg.text}</p>}
                {msg.image && (
                  <img 
                    src={msg.image} 
                    alt="sent-img" 
                    style={{ maxWidth: "200px", borderRadius: "8px", marginTop: msg.text ? "5px" : "0" }} 
                  />
                )}
              </div>
            </div>
          );
        })}
        <div ref={messagesEndRef} />
        
        {chatState === 'IDLE' && (
          <button className="find-btn" onClick={findStranger}>TÌM NGƯỜI LẠ</button>
        )}
      </div>

      {/* CẬP NHẬT: Gộp chung ô nhập chữ và nút gửi ảnh vào một thanh duy nhất */}
      <form className="chat-input-area" onSubmit={sendMessage} style={{ display: 'flex', alignItems: 'center', marginTop: '10px' }}>
        <input
          type="text"
          placeholder="Nhập tin nhắn..."
          value={inputText}
          onChange={(e) => setInputText(e.target.value)}
          disabled={chatState !== 'CONNECTED'}
          style={{ flex: 1, padding: '10px' }}
        />
        
        <label className="image-upload-btn" style={{ cursor: chatState === 'CONNECTED' ? 'pointer' : 'not-allowed', margin: '0 10px', fontSize: '24px' }}>
          📷
          <input 
              type="file" 
              accept="image/*" 
              style={{ display: "none" }} 
              onChange={sendImage} 
              disabled={chatState !== 'CONNECTED'}
          />
        </label>

        <button type="submit" disabled={chatState !== 'CONNECTED'} style={{ padding: '10px 20px' }}>Gửi</button>
      </form>
    </div>
  );
}