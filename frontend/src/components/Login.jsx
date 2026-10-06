import React from 'react';
import { GoogleLogin } from '@react-oauth/google';
import { jwtDecode } from "jwt-decode";

export default function Login({ onLogin }) {
  
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

  return (
    <div className="login-container">
      <h1>Stranger Chat</h1>
      <p style={{marginBottom: 20}}>Trò chuyện ẩn danh với người lạ</p>
      
      <GoogleLogin
        onSuccess={handleGoogleSuccess}
        onError={() => console.log('Đăng nhập Google thất bại')}
      />

      <div style={{margin: '20px 0', color: '#888'}}>HOẶC</div>

      <button className="guest-btn" onClick={handleGuestLogin}>
        Chơi ngay (Khách)
      </button>
    </div>
  );
}