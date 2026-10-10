import React, { useState, useEffect, useRef } from 'react';
import io from 'socket.io-client';
import { SOCKET_URL } from '../config';

let socket;

export default function Chat({ user, onLogout }) {
  const [chatState, setChatState] = useState('IDLE'); // IDLE, WAITING, PENDING_CONFIRM, CONNECTED
  const [messages, setMessages] = useState([]);
  const [inputText, setInputText] = useState('');
  const [matchInfo, setMatchInfo] = useState(null); 
  const messagesEndRef = useRef(null);

  useEffect(() => {
    socket = io(SOCKET_URL);

    socket.on('waiting', (data) => {
      setChatState('WAITING');
      setMessages([{ type: 'system', text: data.message }]);
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
  }, []);

  useEffect(() => {
    messagesEndRef.current?.scrollIntoView({ behavior: 'smooth' });
  }, [messages]);

  const findStranger = () => {
    setMessages([]);
    setChatState('WAITING');
    
    if ("geolocation" in navigator) {
        navigator.geolocation.getCurrentPosition(
            (position) => {
                const location = {
                    lat: position.coords.latitude,
                    lng: position.coords.longitude
                };
                socket.emit('find_stranger', { ...user, location: location });
            },
            (error) => {
                console.log("Lỗi lấy vị trí:", error);
                socket.emit('find_stranger', user); 
            },
            { timeout: 5000 }
        );
    } else {
        socket.emit('find_stranger', user);
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
        if (file.size > 2 * 1024 * 1024) {
            alert("Vui lòng chọn ảnh nhỏ hơn 2MB!");
            return;
        }

        const reader = new FileReader();
        reader.readAsDataURL(file);
        reader.onload = () => {
            const base64Image = reader.result;
            socket.emit("send_message", { image: base64Image });
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

      <div className="chat-messages" style={{ position: 'relative' }}>
        
        {chatState === 'PENDING_CONFIRM' && matchInfo && (
            <div style={{
                position: 'absolute', top: '50%', left: '50%', transform: 'translate(-50%, -50%)',
                backgroundColor: 'white', padding: '20px', borderRadius: '10px', boxShadow: '0 4px 8px rgba(0,0,0,0.2)',
                textAlign: 'center', zIndex: 10, width: '80%'
            }}>
                <h4 style={{ margin: '0 0 10px' }}>Tìm thấy người lạ!</h4>
                <p>Khoảng cách: <strong>{matchInfo.distance}</strong></p>
                <p>Bạn có muốn trò chuyện không?</p>
                <div style={{ display: 'flex', justifyContent: 'space-around', marginTop: '15px' }}>
                    <button onClick={() => handleMatchResponse(true)} style={{ backgroundColor: '#28a745', padding: '8px 20px', borderRadius: '5px', color: 'white', border: 'none', cursor: 'pointer' }}>Vào Chat</button>
                    <button onClick={() => handleMatchResponse(false)} style={{ backgroundColor: '#dc3545', padding: '8px 20px', borderRadius: '5px', color: 'white', border: 'none', cursor: 'pointer' }}>Từ Chối</button>
                </div>
            </div>
        )}

        {messages.map((msg, index) => {
          if (msg.type === 'system') {
            return <div key={index} className="status-text" style={{ textAlign: 'center', margin: '10px', color: 'gray' }}>{msg.text}</div>;
          }
          
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
          <button className="find-btn" onClick={findStranger} style={{ width: '100%', padding: '15px', backgroundColor: '#007bff', color: 'white', border: 'none', borderRadius: '5px', fontWeight: 'bold', cursor: 'pointer' }}>TÌM NGƯỜI LẠ</button>
        )}
      </div>

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

        <button type="submit" disabled={chatState !== 'CONNECTED'} style={{ padding: '10px 20px', backgroundColor: chatState === 'CONNECTED' ? '#007bff' : '#ccc', color: 'white', border: 'none', borderRadius: '5px', cursor: chatState === 'CONNECTED' ? 'pointer' : 'not-allowed' }}>Gửi</button>
      </form>
    </div>
  );
}