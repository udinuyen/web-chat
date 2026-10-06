import React, { useState, useEffect, useRef } from 'react';
import io from 'socket.io-client';
import Message from './Message';
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

    socket.on('receive_message', (data) => {
      setMessages((prev) => [...prev, { type: 'stranger', text: data.text }]);
    });

    socket.on('stranger_left', (data) => {
      setChatState('IDLE');
      setMessages((prev) => [...prev, { type: 'system', text: data.message }]);
    });

    return () => {
      socket.disconnect();
    };
  }, []);

  // Tự động cuộn xuống tin nhắn mới
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

    // Hiển thị tin nhắn của mình
    setMessages((prev) => [...prev, { type: 'me', text: inputText }]);
    // Gửi qua server
    socket.emit('send_message', { text: inputText });
    setInputText('');
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
          return <Message key={index} type={msg.type} text={msg.text} />;
        })}
        <div ref={messagesEndRef} />
        
        {chatState === 'IDLE' && (
          <button className="find-btn" onClick={findStranger}>TÌM NGƯỜI LẠ</button>
        )}
      </div>

      <form className="chat-input-area" onSubmit={sendMessage}>
        <input
          type="text"
          placeholder="Nhập tin nhắn..."
          value={inputText}
          onChange={(e) => setInputText(e.target.value)}
          disabled={chatState !== 'CONNECTED'}
        />
        <button type="submit" disabled={chatState !== 'CONNECTED'}>Gửi</button>
      </form>
    </div>
  );
}