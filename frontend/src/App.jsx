
import React, { useState, useEffect } from 'react';
import Login from './components/Login';
import Chat from './components/Chat';
import Admin from './components/Admin';

function App() {
  const [authData, setAuthData] = useState(() => {
    try {
      const saved = localStorage.getItem('authData');
      return saved ? JSON.parse(saved) : null;
    } catch (error) {
      console.error('Không thể khôi phục phiên đăng nhập:', error);
      localStorage.removeItem('authData');
      return null;
    }
  });

  const [isOffline, setIsOffline] = useState(!navigator.onLine);

  // Theo dõi kết nối mạng
  useEffect(() => {
    const handleOnline = () => setIsOffline(false);
    const handleOffline = () => setIsOffline(true);

    window.addEventListener('online', handleOnline);
    window.addEventListener('offline', handleOffline);

    return () => {
      window.removeEventListener('online', handleOnline);
      window.removeEventListener('offline', handleOffline);
    };
  }, []);

  // Nhận dữ liệu sau khi đăng nhập
  const handleLogin = (data) => {
    console.log('Đăng nhập thành công:', {
      user: data?.user,
      hasToken: Boolean(data?.token),
    });

    if (!data?.token || !data?.user) {
      alert('Dữ liệu đăng nhập không hợp lệ!');
      return;
    }

    try {
      localStorage.setItem('authData', JSON.stringify(data));
      setAuthData(data);
    } catch (error) {
      console.error('Không thể lưu phiên đăng nhập:', error);
      alert('Không thể lưu phiên đăng nhập trên thiết bị.');
    }
  };

  // Đăng xuất
  const handleLogout = () => {
    localStorage.removeItem('authData');
    setAuthData(null);
  };

  // Kiểm tra dữ liệu phiên đăng nhập
  if (
    authData &&
    (!authData.token || !authData.user || !authData.user.role)
  ) {
    localStorage.removeItem('authData');

    return <Login onLogin={handleLogin} />;
  }

  return (
    <div className="app-container">
      {isOffline && (
        <div
          style={{
            backgroundColor: '#ff4d4f',
            color: 'white',
            padding: '10px',
            textAlign: 'center',
            position: 'fixed',
            top: 0,
            left: 0,
            right: 0,
            zIndex: 9999,
            fontWeight: 'bold',
          }}
        >
          ⚠️ Đang mất kết nối mạng. Đang thử kết nối lại...
        </div>
      )}

      {!authData ? (
        <Login onLogin={handleLogin} />
      ) : authData.user.role === 'admin' ? (
        <Admin
          token={authData.token}
          onLogout={handleLogout}
        />
      ) : (
        <Chat
          token={authData.token}
          user={authData.user}
          onLogout={handleLogout}
        />
      )}
    </div>
  );
}

export default App;
