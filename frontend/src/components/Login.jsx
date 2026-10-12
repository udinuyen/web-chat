import React, { useState } from 'react';
import { GoogleLogin } from '@react-oauth/google';
import { jwtDecode } from "jwt-decode";

export default function Login({ onLogin }) {
  const [customName, setCustomName] = useState(''); // Thêm state để lưu tên tự nhập

  const handleGuestLogin = () => {
    const randomNum = Math.floor(Math.random() * 10000);
    onLogin({
      name: `Guest_${randomNum}`,
      isGuest: true
    });
  };

  const handleGoogleSuccess = (credentialResponse) => {
    const decoded = jwtDecode(credentialResponse.credential);
    onLogin({
      name: decoded.name,
      email: decoded.email,
      picture: decoded.picture,
      isGuest: false
    });
  };

  const handleCustomLogin = (e) => {
    e.preventDefault();
    if (customName.trim() === '') return;
    onLogin({
      name: customName.trim(),
      isGuest: false 
    });
  };

  return (
    <div className="login-container">
      <h1>Stranger Chat</h1>
      <p style={{marginBottom: 20}}>Trò chuyện ẩn danh với người lạ</p>
      
      <GoogleLogin
        onSuccess={handleGoogleSuccess}
        onError={() => console.log('Đăng nhập Google thất bại')}
      />

      <div style={{margin: '20px 0', color: '#888'}}>HOẶC</div>

      {/* Khu vực nhập tên thủ công (Dành cho Admin hoặc người dùng tự chọn tên) */}
      <form onSubmit={handleCustomLogin} style={{ display: 'flex', flexDirection: 'column', gap: '10px', marginBottom: '20px', width: '100%' }}>
        <input 
          type="text" 
          placeholder="Nhập tên của bạn (hoặc gõ admin)..." 
          value={customName}
          onChange={(e) => setCustomName(e.target.value)}
          style={{ padding: '10px', borderRadius: '5px', border: '1px solid #ccc', outline: 'none' }}
        />
        <button type="submit" style={{ padding: '10px', backgroundColor: '#333', color: 'white', borderRadius: '5px', border: 'none', cursor: 'pointer', fontWeight: 'bold' }}>
          Đăng nhập bằng tên này
        </button>
      </form>

      <div style={{margin: '10px 0', color: '#888'}}>HOẶC</div>

      <button className="guest-btn" onClick={handleGuestLogin} style={{ width: '100%' }}>
        Chơi ngay (Khách ngẫu nhiên)
      </button>
    </div>
  );
}