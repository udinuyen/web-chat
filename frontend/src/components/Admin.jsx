import React, { useState, useEffect } from 'react';
import io from 'socket.io-client';
import { SOCKET_URL } from '../config';

let socket;

export default function Admin({ onLogout }) {
    const [isAuthenticated, setIsAuthenticated] = useState(false);
    const [password, setPassword] = useState('');
    const [stats, setStats] = useState({ online: 0, waiting: 0, matches: 0 });
    const [broadcastMsg, setBroadcastMsg] = useState('');

    useEffect(() => {
        socket = io(SOCKET_URL);
        
        socket.on('admin_auth_success', () => setIsAuthenticated(true));
        socket.on('admin_auth_fail', () => alert("Sai mật khẩu Admin!"));
        
        socket.on('admin_stats', (data) => setStats(data));

        return () => socket.disconnect();
    }, []);

    const handleLogin = (e) => {
        e.preventDefault();
        socket.emit('admin_login', password);
    };

    const sendBroadcast = () => {
        if (!broadcastMsg.trim()) return;
        socket.emit('admin_broadcast', { message: broadcastMsg });
        setBroadcastMsg('');
        alert("Đã phát loa thông báo thành công!");
    };

    if (!isAuthenticated) {
        return (
            <div style={{ textAlign: 'center', marginTop: '50px' }}>
                <h2>Đăng nhập Admin</h2>
                <form onSubmit={handleLogin}>
                    <input type="password" placeholder="Nhập mật khẩu..." value={password} onChange={e => setPassword(e.target.value)} style={{ padding: '10px' }} />
                    <button type="submit" style={{ padding: '10px', marginLeft: '10px', backgroundColor: 'black', color: 'white' }}>Vào</button>
                </form>
            </div>
        );
    }

    return (
        <div style={{ padding: '20px', maxWidth: '600px', margin: '0 auto', fontFamily: 'sans-serif' }}>
            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                <h1 style={{ color: 'red' }}>⚙️ BẢNG ĐIỀU KHIỂN ADMIN</h1>
                <button onClick={onLogout} style={{ padding: '5px 15px' }}>Thoát</button>
            </div>
            
            {/* THỐNG KÊ THỜI GIAN THỰC */}
            <div style={{ display: 'flex', gap: '20px', marginTop: '20px' }}>
                <div style={{ flex: 1, padding: '20px', backgroundColor: '#e3f2fd', borderRadius: '10px', textAlign: 'center' }}>
                    <h3>Đang Online</h3>
                    <h1 style={{ color: '#0d47a1', margin: 0 }}>{stats.online}</h1>
                </div>
                <div style={{ flex: 1, padding: '20px', backgroundColor: '#fff3e0', borderRadius: '10px', textAlign: 'center' }}>
                    <h3>Đang Chờ Ghép</h3>
                    <h1 style={{ color: '#e65100', margin: 0 }}>{stats.waiting}</h1>
                </div>
                <div style={{ flex: 1, padding: '20px', backgroundColor: '#e8f5e9', borderRadius: '10px', textAlign: 'center' }}>
                    <h3>Đang Xác nhận</h3>
                    <h1 style={{ color: '#1b5e20', margin: 0 }}>{stats.matches}</h1>
                </div>
            </div>

            {/* PHÁT LOA THÔNG BÁO */}
            <div style={{ marginTop: '30px', padding: '20px', backgroundColor: '#ffebee', borderRadius: '10px' }}>
                <h3>📢 Phát Loa Thông Báo (Toàn Server)</h3>
                <input 
                    type="text" 
                    placeholder="Nhập thông báo (vd: Server bảo trì lúc 12h)..." 
                    value={broadcastMsg}
                    onChange={e => setBroadcastMsg(e.target.value)}
                    style={{ width: '100%', padding: '10px', boxSizing: 'border-box', marginBottom: '10px' }}
                />
                <button onClick={sendBroadcast} style={{ width: '100%', padding: '15px', backgroundColor: 'red', color: 'white', fontWeight: 'bold', border: 'none', borderRadius: '5px' }}>
                    GỬI THÔNG BÁO NGAY LẬP TỨC
                </button>
            </div>
        </div>
    );
}