import React from 'react';

export default function Message({ type, text }) {
  // type: 'me' hoặc 'stranger'
  const isMe = type === 'me';
  
  return (
    <div className={`msg-row ${isMe ? 'msg-me' : 'msg-stranger'}`}>
      <div className="msg-bubble">
        {text}
      </div>
    </div>
  );
}