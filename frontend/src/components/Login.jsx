import React, { useState } from 'react';
import { GoogleLogin } from '@react-oauth/google';
import { jwtDecode } from "jwt-decode";

export default function Login({ onLogin }) {
  const [customName, setCustomName] = useState('');
  const [myGender, setMyGender] = useState('Nam'); // Giới tính của mình
  const [targetGender, setTargetGender] = useState('Bất kỳ'); // Giới tính muốn tìm

  const handleGuestLogin = () => {
    const randomNum = Math.floor(Math.random() * 10000);
    onLogin({ name: `Guest_${randomNum}`, isGuest: true, myGender, targetGender });
  };

  const handleGoogleSuccess = (credentialResponse) => {
    const decoded = jwtDecode(credentialResponse.credential);
    onLogin({ name: decoded.name, email: decoded.email, picture: decoded.picture, isGuest: false, myGender, targetGender });
  };

  const handleCustomLogin = (e) => {
    e.preventDefault();
    if (customName.trim() === '') return;
    onLogin({ name: customName.trim(), isGuest: false, myGender, targetGender });
  };

  return (
    <div className="login-container">
      <h1>Stranger Chat</h1>
      <p style={{marginBottom: 10}}>Trò chuyện ẩn danh với người lạ</p>
      
      {/* Khu vực chọn giới tính */}
      <div style={{ display: 'flex', gap: '10px', marginBottom: '20px', width: '100%' }}>
        <select value={myGender} onChange={e => setMyGender(e.target.value)} style={{ flex: 1, padding: '10px', borderRadius: '5px', border: '1px solid #ccc' }}>
          <option value="Nam">Tôi là: Nam</option>
          <option value="Nữ">Tôi là: Nữ</option>
        </select>
        <select value={targetGender} onChange={e => setTargetGender(e.target.value)} style={{ flex: 1, padding: '10px', borderRadius: '5px', border: '1px solid #ccc' }}>
          <option value="Bất kỳ">Tìm: Bất kỳ</option>
          <option value="Nam">Tìm: Nam</option>
          <option value="Nữ">Tìm: Nữ</option>
        </select>
      </div>

      <GoogleLogin onSuccess={handleGoogleSuccess} onError={() => console.log('Đăng nhập Google thất bại')} />

      <div style={{margin: '15px 0', color: '#888'}}>HOẶC</div>

      {/* Form nhập tên thủ công cho Admin hoặc người chơi tùy chỉnh */}
      <form onSubmit={handleCustomLogin} style={{ display: 'flex', flexDirection: 'column', gap: '10px', marginBottom: '15px', width: '100%' }}>
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