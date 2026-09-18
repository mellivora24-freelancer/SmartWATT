# Cách chạy code

0. Đảm bảo docker đã được bật, các thiết bị kết nối cùng mạng wifi
1. Mở thư mục dự án trong VSCode.
2. Trong VSCode, ở 2 terminal và đặt tên là backend và frontend
3. Trong terminal backend, nhập lệnh:
```bash
cd backend & .venv\Scripts\activate & uvicorn app.main:app --host 0.0.0.0 --port 8000
```
Khi app hiển thị (Success) là thành công!
4. Nhấn Windows + R, gõ cmd và nhấn Enter. Sau đó dán lệnh này vào:
```bash
cmd /v:on /c "set "WIFI=Không xác định" & set "IP=Không xác định" & for /f "tokens=2 delims=:" %a in ('netsh wlan show interfaces ^| findstr /c:" SSID"') do (set "WIFI=%a" & set "WIFI=!WIFI:~1!") & for /f "tokens=2 delims=:" %a in ('ipconfig ^| findstr /i "IPv4"') do (set "IP=%a" & set "IP=!IP:~1!" & goto :print) & :print & echo - Tên WiFi: !WIFI! & echo - Địa chỉ IP: !IP!"
```
Để nguyên cửa sổ này, không tắt

Sau đó vào mục mobile trong code, ở file ".env", đổi "localhost" thành địa chỉ IP ở trên

5. Trong terminal mobile chạy lệnh:
```bash
cd mobile & npx expo start
```
Khi hiện mã QR ra thì dùng điện thoại để quét và vào app.

6. Bật thiết bị

# Cài đặt ban đầu cho thiết bị (hoặc bất cứ khi nào đổi WiFi)

0. Mở thiết bị lên, đợi thiết bị kêu "tít"
1. Nhấn và giữ nút boot cho đến khi thiết bị kêu "tít tít (2 lần)
2. Khi thiết bị vào SETUP MODE, mở phần WiFi trên điện thoại / laptop
3. Bắt WiFi có tên "SmartWATT-SW-001"
4. Vào trang web: 192.168.4.1
5. Khi trang web load xong, nhập tên WiFi, mật khẩu WiFi (cái mà laptop đang dùng)
6. Nhập địa chỉ IP của laptop (lấy ở bước 4 bên trên)
7. Nhấn lưu và thoát ra, bắt lại mạng WiFi cùng với điện thoại / laptop
