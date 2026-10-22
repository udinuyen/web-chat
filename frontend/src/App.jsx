import React, { useState, useEffect } from 'react';
import Login from './components/Login';
import Chat from './components/Chat';
import Admin from './components/Admin'; 

function App() {
  const [authData, setAuthData] = useState(null); 
  const [isOffline, setIsOffline] = useState(!navigator.onLine); 

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

  const handleLogout = () => {
      setAuthData(null);
  };

  return (
    <div className="app-container">
      {isOffline && (
        <div style={{ backgroundColor: '#ff4d4f', color: 'white', padding: '10px', textAlign: 'center', position: 'fixed', top: 0, left: 0, right: 0, zIndex: 9999, fontWeight: 'bold' }}>
            ⚠️ Đang mất kết nối mạng. Đang tự động thử kết nối lại...
        </div>
      )}

      {!authData ? (
        <Login onLogin={setAuthData} />
      ) : authData.user.role === 'admin' ? (
        <Admin token={authData.token} onLogout={handleLogout} />
      ) : (
        <Chat token={authData.token} user={authData.user} onLogout={handleLogout} />
      )}
    </div>
  );
}

export default App;