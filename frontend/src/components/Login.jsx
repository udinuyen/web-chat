import React, { useState } from 'react';
import { GoogleLogin } from '@react-oauth/google';
import { SOCKET_URL } from '../config';

export default function Login({ onLogin }) {
  const [customName, setCustomName] = useState('');
  const [myGender, setMyGender] = useState('Nam');
  const [targetGender, setTargetGender] = useState('Bất kỳ');
  const [loading, setLoading] = useState(false);

  const API_URL = `${SOCKET_URL}/api/auth`;

  const handleGuestLogin = async () => {
    setLoading(true);
    try {
        const res = await fetch(`${API_URL}/guest`, {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({ myGender, targetGender })
        });
        const data = await res.json();
        if (data.token) onLogin(data);
    } catch (err) {
        alert("Lỗi kết nối Server");
    }
    setLoading(false);
  };

  const handleGoogleSuccess = async (credentialResponse) => {
    setLoading(true);
    try {
        // Gửi token thô nguyên bản của Google lên Server để Server tự giải mã và xác thực
        const res = await fetch(`${API_URL}/google`, {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({ token: credentialResponse.credential, myGender, targetGender })
        });
        const data = await res.json();
        if (data.token) {
            onLogin(data); // data bao gồm { token, user }
        } else {
            alert(data.error);
        }
    } catch (err) {
        alert("Lỗi xác thực Google");
    }
    setLoading(false);
  };

 
const handleCustomLogin = async (e) => {
  e.preventDefault();

  if (customName.trim().toLowerCase() !== 'admin') {
    alert('Vui lòng nhập admin để đăng nhập quản trị.');
    return;
  }

  setLoading(true);

  try {
    const password = 'admin123'; // Chỉ dùng tạm để kiểm thử

    const res = await fetch(`${API_URL}/admin`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({ password }),
    });

    const data = await res.json().catch(() => ({}));

    if (!res.ok || !data.token || !data.user) {
      alert(data.error || 'Đăng nhập Admin thất bại!');
      return;
    }

    // Gửi dữ liệu cho App.jsx để chuyển sang giao diện Admin
    onLogin(data);
  } catch (error) {
    console.error('Lỗi đăng nhập Admin:', error);
    alert('Không kết nối được máy chủ. Vui lòng thử lại.');
  } finally {
    setLoading(false);
  }
};


  if (loading) return <div style={{textAlign: 'center', marginTop: '50px'}}>Đang xác thực bảo mật...</div>;

  return (
    <div className="login-container">
      <h1>Stranger Chat</h1>
      <p style={{marginBottom: 10}}>Bảo mật bằng JWT Socket.IO</p>
      
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

      <form onSubmit={handleCustomLogin} style={{ display: 'flex', flexDirection: 'column', gap: '10px', marginBottom: '15px', width: '100%' }}>
        <input 
          type="text" 
          placeholder="Gõ 'admin' để quản lý máy chủ" 
          value={customName}
          onChange={(e) => setCustomName(e.target.value)}
          style={{ padding: '10px', borderRadius: '5px', border: '1px solid #ccc', outline: 'none' }}
        />
        <button type="submit" style={{ padding: '10px', backgroundColor: '#333', color: 'white', borderRadius: '5px', border: 'none', cursor: 'pointer', fontWeight: 'bold' }}>
          Đăng nhập hệ thống
        </button>
      </form>

      <div style={{margin: '10px 0', color: '#888'}}>HOẶC</div>

      <button className="guest-btn" onClick={handleGuestLogin} style={{ width: '100%' }}>
        Chơi ngay (Khách ẩn danh)
      </button>
    </div>
  );
}