import React, { useState } from 'react';
import Login from './components/Login';
import Chat from './components/Chat';
import Admin from './components/Admin'; 

function App() {
  const [authData, setAuthData] = useState(null); // Lưu trữ { token, user }

  const handleLogout = () => {
      setAuthData(null);
  };

  return (
    <div className="app-container">
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