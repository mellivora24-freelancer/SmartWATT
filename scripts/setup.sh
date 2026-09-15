#!/usr/bin/env bash

# Hàm lấy tên Wi-Fi tự động tương thích macOS, Linux và Windows (Git Bash/WSL)
get_wifi_name() {
    if [[ "$OSTYPE" == "darwin"* ]]; then
        # macOS
        wifi=$(ipconfig getsummary en0 2>/dev/null | grep ' SSID' | awk -F': ' '{print $2}')
        [ -z "$wifi" ] && wifi=$(ipconfig getsummary en1 2>/dev/null | grep ' SSID' | awk -F': ' '{print $2}')
        echo "$wifi"
    elif [[ "$OSTYPE" == "linux"* ]]; then
        # Linux
        if command -v nmcli &> /dev/null; then
            wifi=$(nmcli -t -f active,ssid dev wifi 2>/dev/null | grep '^yes' | cut -d: -f2)
        elif command -v iwgetid &> /dev/null; then
            wifi=$(iwgetid -r)
        fi
        echo "$wifi"
    else
        # Windows (chạy qua Git Bash hoặc MSYS)
        wifi=$(netsh wlan show interfaces 2>/dev/null | grep -E '^\s*SSID\s*:' | awk -F': ' '{print $2}' | tr -d '\r')
        echo "$wifi"
    fi
}

# Hàm lấy IP mạng nội bộ
get_ip_address() {
    if [[ "$OSTYPE" == "darwin"* ]]; then
        # macOS
        ip=$(ipconfig getifaddr en0 2>/dev/null)
        [ -z "$ip" ] && ip=$(ipconfig getifaddr en1 2>/dev/null)
        echo "$ip"
    elif [[ "$OSTYPE" == "linux"* ]]; then
        # Linux
        if command -v hostname &> /dev/null; then
            ip=$(hostname -I 2>/dev/null | awk '{print $1}')
        fi
        if [ -z "$ip" ] && command -v ip &> /dev/null; then
            ip=$(ip route get 1.1.1.1 2>/dev/null | awk '{print $7}')
        fi
        echo "$ip"
    else
        # Windows (Git Bash)
        ip=$(ipconfig 2>/dev/null | grep -i "IPv4" | head -n 1 | awk -F': ' '{print $2}' | tr -d '\r')
        echo "$ip"
    fi
}

WIFI_SSID=$(get_wifi_name)
IP_ADDR=$(get_ip_address)

# Nếu không lấy được thông tin thì báo Không xác định
[ -z "$WIFI_SSID" ] && WIFI_SSID="Không xác định"
[ -z "$IP_ADDR" ] && IP_ADDR="Không xác định"

# In ra màn hình theo đúng định dạng
echo "Thông tin cấu hình:"
echo "- WiFi đang sử dụng: $WIFI_SSID"
echo "- IP của broker MQTT: $IP_ADDR"
echo ""
echo "Hãy nhập cấu hình trên vào trang cấu hình. Chúng tôi không thể hiển thị mật khẩu wifi cho bạn."