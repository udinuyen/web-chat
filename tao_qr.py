import qrcode

# Thay URL bên dưới bằng link web Vercel hoặc link Google Drive của bạn
url_app = "https://web-chat-plum-nine.vercel.app/"

qr = qrcode.QRCode(version=1, box_size=10, border=4)
qr.add_data(url_app)
qr.make(fit=True)

# Xuất ra file ảnh
img = qr.make_image(fill_color="black", back_color="white")
img.save("app_qr_code.png")
print("Đã tạo xong file app_qr_code.png!")