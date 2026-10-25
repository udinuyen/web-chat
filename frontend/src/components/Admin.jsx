import React, { useState, useEffect } from 'react';
import io from 'socket.io-client';
import { SOCKET_URL } from '../config';

let socket;

// Không cần form đăng nhập nữa vì App.jsx đã cấp cho ta quyền và Token rồi
export default function Admin({ token, onLogout }) {
    const [stats, setStats] = useState({ online: 0, waiting: 0, matches: 0, reports: 0 });
    const [broadcastMsg, setBroadcastMsg] = useState('');
    const [reportList, setReportList] = useState([]);

   
useEffect(() => {
    if (!token) return;

    const adminSocket = io(SOCKET_URL, {
        auth: { token },
        reconnection: true,
        reconnectionAttempts: Infinity,
        reconnectionDelay: 1000,
    });

    socket = adminSocket;

    adminSocket.on('connect', () => {
        console.log('Admin Socket đã kết nối:', adminSocket.id);
    });

    adminSocket.on('connect_error', (err) => {
        console.error('Lỗi kết nối Admin Socket:', err.message);
    });

    adminSocket.on('admin_auth_success', (historyReports) => {
        setReportList(historyReports || []);
    });

    adminSocket.on('admin_stats', (data) => {
        setStats(data);
    });

    adminSocket.on('admin_new_report', (newReport) => {
        setReportList((prev) => [newReport, ...prev]);
    });

    return () => {
        adminSocket.disconnect();

        if (socket === adminSocket) {
            socket = null;
        }
    };
}, [token]);


    const sendBroadcast = () => {
        if (!broadcastMsg.trim()) return;
        socket.emit('admin_broadcast', { message: broadcastMsg });
        setBroadcastMsg('');
        alert("Đã phát loa thông báo thành công!");
    };

    return (
        <div style={{ padding: '20px', maxWidth: '900px', margin: '0 auto', fontFamily: 'sans-serif' }}>
            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                <h1 style={{ color: 'red' }}>⚙️ TỔNG LÃNH SỰ QUÁN ADMIN (Secure Mode)</h1>
                <button onClick={onLogout} style={{ padding: '8px 20px', cursor: 'pointer' }}>Đăng Xuất</button>
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
                                <th style={{ padding: '10px', border: '1px solid #ddd' }}>Kẻ bị tố cáo (ID Ẩn)</th>
                                <th style={{ padding: '10px', border: '1px solid #ddd' }}>Lý do vi phạm</th>
                                <th style={{ padding: '10px', border: '1px solid #ddd', textAlign: 'center' }}>Hành động</th>
                            </tr>
                        </thead>
                        <tbody>
                            {reportList.map((report) => (
                                <tr key={report.id}>
                                    <td style={{ padding: '10px', border: '1px solid #ddd' }}>{report.time}</td>
                                    <td style={{ padding: '10px', border: '1px solid #ddd', fontWeight: 'bold' }}>{report.reporterName}</td>
                                    <td style={{ padding: '10px', border: '1px solid #ddd', color: 'red', fontWeight: 'bold' }}>
                                        {report.reportedName} <br/> <span style={{fontSize: '10px', color: '#999'}}>ID: {report.reportedId}</span>
                                    </td>
                                    <td style={{ padding: '10px', border: '1px solid #ddd' }}>{report.reason}</td>
                                    <td style={{ padding: '10px', border: '1px solid #ddd', textAlign: 'center' }}>
                                        <button 
                                            onClick={() => {
                                                if(window.confirm(`Bạn có chắc muốn KHÓA VĨNH VIỄN thiết bị/tài khoản này?`)) {
                                                    // Gửi ID thật của kẻ đó lên server để ban tận gốc
                                                    socket.emit('admin_ban_user', report.reportedId);
                                                    alert(`Đã khóa thành công ${report.reportedName}!`);
                                                }
                                            }} 
                                            style={{ padding: '5px 15px', backgroundColor: '#d32f2f', color: 'white', border: 'none', borderRadius: '4px', cursor: 'pointer', fontWeight: 'bold' }}
                                        >
                                            🚫 Ban ID
                                        </button>
                                    </td>
                                </tr>
                            ))}
                        </tbody>
                    </table>
                )}
            </div>
        </div>
    );
}