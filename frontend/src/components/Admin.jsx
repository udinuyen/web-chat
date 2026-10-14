import React, { useState, useEffect } from 'react';
import io from 'socket.io-client';
import { SOCKET_URL } from '../config';

let socket;

export default function Admin({ onLogout }) {
    const [isAuthenticated, setIsAuthenticated] = useState(false);
    const [password, setPassword] = useState('');
    const [stats, setStats] = useState({ online: 0, waiting: 0, matches: 0, reports: 0 });
    const [broadcastMsg, setBroadcastMsg] = useState('');
    const [reportList, setReportList] = useState([]); // Mảng chứa danh sách báo cáo

    useEffect(() => {
        socket = io(SOCKET_URL);
        
        socket.on('admin_auth_success', (historyReports) => {
            setIsAuthenticated(true);
            setReportList(historyReports || []);
        });
        
        socket.on('admin_auth_fail', () => alert("Sai mật khẩu Admin!"));
        
        socket.on('admin_stats', (data) => setStats(data));

        // Nhận báo cáo mới theo thời gian thực
        socket.on('admin_new_report', (newReport) => {
            setReportList(prev => [newReport, ...prev]);
        });

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
        <div style={{ padding: '20px', maxWidth: '800px', margin: '0 auto', fontFamily: 'sans-serif' }}>
            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                <h1 style={{ color: 'red' }}>⚙️ BẢNG ĐIỀU KHIỂN ADMIN</h1>
                <button onClick={onLogout} style={{ padding: '5px 15px' }}>Thoát</button>
            </div>
            
            <div style={{ display: 'flex', gap: '20px', marginTop: '20px' }}>
                <div style={{ flex: 1, padding: '20px', backgroundColor: '#e3f2fd', borderRadius: '10px', textAlign: 'center' }}>
                    <h3>Đang Online</h3><h1 style={{ color: '#0d47a1', margin: 0 }}>{stats.online}</h1>
                </div>
                <div style={{ flex: 1, padding: '20px', backgroundColor: '#fff3e0', borderRadius: '10px', textAlign: 'center' }}>
                    <h3>Chờ Ghép</h3><h1 style={{ color: '#e65100', margin: 0 }}>{stats.waiting}</h1>
                </div>
                <div style={{ flex: 1, padding: '20px', backgroundColor: '#ffebee', borderRadius: '10px', textAlign: 'center' }}>
                    <h3>Báo Cáo Vi Phạm</h3><h1 style={{ color: 'red', margin: 0 }}>{stats.reports}</h1>
                </div>
            </div>

            <div style={{ marginTop: '30px', padding: '20px', backgroundColor: '#f1f1f1', borderRadius: '10px' }}>
                <h3>📢 Phát Loa Thông Báo</h3>
                <div style={{ display: 'flex', gap: '10px' }}>
                    <input type="text" placeholder="Nhập thông báo..." value={broadcastMsg} onChange={e => setBroadcastMsg(e.target.value)} style={{ flex: 1, padding: '10px' }} />
                    <button onClick={sendBroadcast} style={{ padding: '10px 20px', backgroundColor: 'red', color: 'white', border: 'none', borderRadius: '5px' }}>GỬI</button>
                </div>
            </div>

            {/* BẢNG HIỂN THỊ BÁO CÁO */}
            <div style={{ marginTop: '30px' }}>
                <h3 style={{ color: 'red' }}>🚨 DANH SÁCH BÁO CÁO GẦN ĐÂY</h3>
                {reportList.length === 0 ? (
                    <p style={{ color: 'gray' }}>Chưa có báo cáo nào.</p>
                ) : (
                    <table style={{ width: '100%', borderCollapse: 'collapse', backgroundColor: 'white' }}>
                        <thead>
                            <tr style={{ backgroundColor: '#ffcdd2', textAlign: 'left' }}>
                                <th style={{ padding: '10px', border: '1px solid #ddd' }}>Thời gian</th>
                                <th style={{ padding: '10px', border: '1px solid #ddd' }}>Người tố cáo</th>
                                <th style={{ padding: '10px', border: '1px solid #ddd' }}>Kẻ bị tố cáo</th>
                                <th style={{ padding: '10px', border: '1px solid #ddd' }}>Lý do vi phạm</th>
                            </tr>
                        </thead>
                        <tbody>
                            {reportList.map((report) => (
                                <tr key={report.id}>
                                    <td style={{ padding: '10px', border: '1px solid #ddd' }}>{report.time}</td>
                                    <td style={{ padding: '10px', border: '1px solid #ddd', fontWeight: 'bold' }}>{report.reporter}</td>
                                    <td style={{ padding: '10px', border: '1px solid #ddd', color: 'red', fontWeight: 'bold' }}>{report.reported}</td>
                                    <td style={{ padding: '10px', border: '1px solid #ddd' }}>{report.reason}</td>
                                </tr>
                            ))}
                        </tbody>
                    </table>
                )}
            </div>
        </div>
    );
}