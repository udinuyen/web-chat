import React, { useState } from 'react';
import Login from './components/Login';
import Chat from './components/Chat';
import Admin from './components/Admin'; // Thêm dòng import này

function App() {
  const [user, setUser] = useState(null); // null = chưa đăng nhập

  return (
    <div className="app-container">
      {!user ? (
        <Login onLogin={setUser} />
      ) : user.name.toLowerCase() === 'admin' ? (
        // Nếu tên đăng nhập là "admin" thì hiển thị trang Quản trị
        <Admin onLogout={() => setUser(null)} />
      ) : (
        // Nếu là người dùng bình thường thì vào Chat
        <Chat user={user} onLogout={() => setUser(null)} />
      )}
    </div>
  );
}

export default App;