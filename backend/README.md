# SmartWatt Backend

FastAPI server cho hệ thống SmartWatt: MQTT ingest, lưu raw telemetry vào PostgreSQL,
đánh giá rule-base, đẩy realtime qua WebSocket, REST API cho mobile, dự đoán và AI chat.

## Kiến trúc

```
MQTT (smartwatt/*)  →  ingest  →  PostgreSQL (raw telemetry)
                          │
                          ├─→ rule-base  →  smartwatt/cmd/buzzer + Telegram + WebSocket
                          └─→ WebSocket  →  mobile app
FastAPI REST  →  auth, users, devices, telemetry history/summary, forecast, AI chat
```

| Module | Trách nhiệm |
|---|---|
| `app/config.py` | Cấu hình từ biến môi trường |
| `app/db.py` | Connection pool asyncpg |
| `app/repo.py` | Toàn bộ truy vấn SQL (raw + dữ liệu dẫn xuất) |
| `app/rules.py` | Ngưỡng mặc định, đánh giá rule-base, payload config cho thiết bị |
| `app/mqtt_client.py` | Cầu nối paho-mqtt chạy ở thread riêng, publish/subscribe |
| `app/ingest.py` | Xử lý telemetry và config request, tự tạo device mới |
| `app/alerts.py` | Chống spam cảnh báo, ghi alert log, gửi buzzer + Telegram |
| `app/monitor.py` | Vòng lặp nền định kỳ kiểm tra rò rỉ nước và tiêu thụ bất thường |
| `app/prediction.py` | Dự đoán điện/nước cuối tháng bằng hồi quy tuyến tính |
| `app/baseline.py` | Học profile theo giờ × thứ, phát hiện ngày/giờ khác thường |
| `app/tuning.py` | Đề xuất ngưỡng rule-base từ percentile của dữ liệu thật |
| `app/leaks.py` | Phát hiện rò rỉ nước từ lưu lượng ban đêm |
| `app/ai.py` | Dựng ngữ cảnh từ dữ liệu thật và gọi Gemini API |
| `app/realtime.py` | Quản lý kết nối WebSocket theo user |
| `app/api/` | Router FastAPI |

## Dữ liệu

- `telemetry` là **raw source of truth**: mỗi lần thiết bị publish là một dòng, không sửa.
- `energy_total` và `water_total_l` là counter cộng dồn. Mọi giá trị tiêu thụ theo thời gian
  đều được tính bằng delta của counter (bỏ qua delta âm để chống reset counter).
- `timestamp` do **server** gán khi nhận payload; firmware không gửi timestamp.

## Chạy toàn bộ stack

```bash
cd backend/infra
docker-compose up -d
```

Stack gồm PostgreSQL (tự chạy migration trong `infra/database` ở lần khởi tạo đầu),
Mosquitto và backend tại `http://localhost:8000` (docs: `/docs`).

## Chạy backend khi đã có sẵn Postgres/MQTT

```bash
cd backend
python3 -m venv .venv && . .venv/bin/activate
pip install -r requirements.txt
cp .env.example .env
psql -h localhost -U smartwatt -d smartwatt -f infra/database/001_init_schema.sql
psql -h localhost -U smartwatt -d smartwatt -f infra/database/002_alert_logs.sql
uvicorn app.main:app --host 0.0.0.0 --port 8000
```

## REST API

| Method | Endpoint | Mô tả |
|---|---|---|
| POST | `/auth/register` | Đăng ký bằng số điện thoại + mật khẩu |
| POST | `/auth/login` | Đăng nhập, trả JWT |
| GET/PUT | `/users/me` | Xem/cập nhật hồ sơ, đơn giá điện |
| GET | `/devices` | Danh sách thiết bị của user |
| POST | `/devices` | Thêm thiết bị theo `code`, gán luôn lịch sử đã ghi |
| GET/PUT/DELETE | `/devices/{id}` | Chi tiết, cập nhật ngưỡng/tên/vị trí, gỡ thiết bị |
| GET | `/devices/{id}/telemetry` | Lịch sử raw, có phân trang |
| GET | `/devices/{id}/summary` | Tổng hợp theo `minute/hour/day/month/year` |
| GET | `/devices/{id}/forecast` | Dự đoán điện/nước cuối tháng |
| GET | `/devices/{id}/alerts` | Lịch sử cảnh báo |
| GET | `/devices/{id}/baseline` | Profile học được theo giờ × thứ (7×24 ô) |
| GET | `/devices/{id}/deviation` | So một ngày với baseline, tìm giờ khác thường |
| GET | `/devices/{id}/threshold-suggestions` | Đề xuất ngưỡng min/max từ dữ liệu thật |
| POST | `/devices/{id}/threshold-suggestions/apply` | Áp dụng các ngưỡng đề xuất được chọn |
| GET | `/devices/{id}/water-leak` | Phân tích rò rỉ nước theo từng đêm |
| POST | `/ai/chat` | Chat với Gemini dựa trên dữ liệu thật của thiết bị |
| WS | `/ws?token=<jwt>` | Nhận realtime `telemetry` và `alert` |

## Phân tích dữ liệu (không cần dữ liệu huấn luyện)

Cả ba tính năng đều học từ chính lịch sử của thiết bị, không cần dataset ngoài.

**Baseline theo giờ × thứ (`baseline.py`)**
Gộp dữ liệu thành từng giờ, rồi với mỗi cặp (thứ, giờ) tính **median và MAD** trên
các ngày khác nhau. Dùng median/MAD thay vì mean/stddev vì đó là thống kê bền vững:
một ngày bất thường không kéo lệch baseline của chính nó. Điểm lệch là robust z-score
`(giá trị - median) / (MAD × 1.4826)`, chỉ báo bất thường khi vượt `BASELINE_Z_THRESHOLD`
**và** độ lệch tuyệt đối vượt ngưỡng tối thiểu (40W / 0.15 L/phút) để tránh báo động giả.
Ô nào chưa đủ `BASELINE_MIN_DAYS` ngày thì trả `no_baseline` thay vì đoán.

**Đề xuất ngưỡng (`tuning.py`)**
Lấy percentile của từng chỉ số tức thời rồi cộng biên 5%: ngưỡng trên từ p99, ngưỡng dưới
từ p01. Trả về `too_tight` / `too_loose` / `ok` / `missing` để app hiển thị. Server **không
tự ghi đè** ngưỡng; app gọi `apply` với đúng danh sách cột muốn áp dụng.

Một số ngưỡng **cố tình không suy ra từ thống kê** và được liệt kê trong `not_derived`
(min_current, min_power, min_water_flow, max_power_factor), vì giá trị thấp của chúng là
bình thường khi không có tải. `min_power_factor` chỉ tính trên các mẫu có tải
(`current >= 0.5A`) vì hệ số công suất vô nghĩa khi dòng quá nhỏ. `max_water_flow` chỉ
tính trên các mẫu có nước chảy, nếu không p99 sẽ luôn bằng 0.

**Rò rỉ nước (`leaks.py`)**
Với mỗi đêm trong khung `LEAK_NIGHT_START_HOUR`–`LEAK_NIGHT_END_HOUR`, tính tổng lượng nước
từ delta `water_total_l`, tỉ lệ mẫu có nước chảy, và lưu lượng đỉnh. Phân loại:

- `leak_continuous`: nước chảy ≥ 60% thời gian trong đêm (dạng rò rỉ bồn cầu, nhỏ nhưng liên tục)
- `leak_burst`: lượng nước vượt `max(4 × median các đêm trước, 5L)` **và** đỉnh ≥ 3 L/phút
- `normal`, hoặc `insufficient_data` khi chưa đủ `LEAK_MIN_BASELINE_NIGHTS` đêm

Baseline lấy median của các đêm trước đó, không tính đêm đang xét.

**Gửi cảnh báo (`monitor.py`)**
Một vòng lặp nền chạy mỗi `MONITOR_INTERVAL_SECONDS`, chỉ xét các thiết bị đã có chủ:

- **Rò rỉ nước**: kiểm tra mỗi vòng. Nếu đêm gần nhất bị `leak_suspected` thì gửi Telegram + WebSocket.
  Phát hiện được cả khi đêm đang diễn ra (cảnh báo sớm), miễn là đã có đủ mẫu.
- **Tiêu thụ khác thường**: mỗi ngày một lần, sau `DEVIATION_CHECK_HOUR`, phân tích ngày hôm trước.

Chống gửi trùng bằng `alert_logs` (không phải bằng bộ nhớ tạm): mỗi đêm/mỗi ngày chỉ gửi một lần,
nên restart server cũng không gửi lại. Cảnh báo rò rỉ nước **không** kích hoạt buzzer — còi dành cho
vi phạm ngưỡng điện (quá tải/sụt áp). Ứng dụng phân biệt hai nguồn cảnh báo qua `alerts[].metric`:
các metric `voltage`/`current`/`power`... là rule-base, `water_leak`/`baseline_deviation` là phân tích.

## MQTT contract

| Topic | Chiều | Payload |
|---|---|---|
| `smartwatt/telemetry` | thiết bị → server | `device_code, voltage, current, power, power_factor, frequency, energy_total, water_flow_lpm, water_total_l, pulse_count` |
| `smartwatt/config/request` | thiết bị → server | `device_code` |
| `smartwatt/config/response` | server → thiết bị | `device_code` + toàn bộ ngưỡng min/max |
| `smartwatt/cmd/buzzer` | server → thiết bị | `device_code, action` |

Thiết bị chưa từng biết sẽ được tự tạo với `user_id = NULL`; telemetry vẫn được ghi
bình thường và giữ nguyên khi user gán thiết bị sau này.

## Lưu ý

- Mật khẩu hiện lưu plaintext để khớp giai đoạn đầu của dự án. Không dùng ngoài mạng LAN.
- Cảnh báo được chống spam bằng `ALERT_COOLDOWN_SECONDS` (mặc định 300 giây cho mỗi
  cặp thiết bị + metric + loại vi phạm).
- Nếu chưa cấu hình `GEMINI_API_KEY`, endpoint chat trả về ngữ cảnh dữ liệu thay vì gọi AI.
