const winston = require('winston');

// Định dạng log: [Ngày giờ] MỨC_ĐỘ: Nội dung
const customFormat = winston.format.printf(({ timestamp, level, message }) => {
    return `[${timestamp}] ${level.toUpperCase()}: ${message}`;
});

const logger = winston.createLogger({
    level: 'info',
    format: winston.format.combine(
        winston.format.timestamp({ format: 'YYYY-MM-DD HH:mm:ss' }),
        customFormat
    ),
    transports: [
        // 1. In ra màn hình console (để xem trên Render)
        new winston.transports.Console(),
        
        // 2. Tự động lưu những lỗi nghiêm trọng ra một file riêng
        new winston.transports.File({ filename: 'logs/error.log', level: 'error' }),
        
        // 3. Tự động lưu lại mọi hoạt động của server
        new winston.transports.File({ filename: 'logs/system.log' })
    ],
});

module.exports = logger;