#ifndef CONFIG_H
#define CONFIG_H

#include <Arduino.h>

// TFT display pins (SPI, module labels MOSI/SCK as SDA/SCL)
#define PIN_TFT_SDA   21
#define PIN_TFT_SCL   22
#define PIN_TFT_RST   18
#define PIN_TFT_DC    19
#define PIN_TFT_CS    23

// PZEM-004T UART2 pins
#define PIN_PZEM_RX   16
#define PIN_PZEM_TX   17

// YF-201 water flow sensor
#define PIN_YF201     26

// Buzzer
#define PIN_BUZZER    4

// BOOT button (onboard, active LOW)
#define PIN_BOOT_BTN  0

// Device identity
#define DEVICE_CODE   "SW-001"

// MQTT topics
#define TOPIC_TELEMETRY       "smartwatt/telemetry"
#define TOPIC_CONFIG_REQUEST  "smartwatt/config/request"
#define TOPIC_CONFIG_RESPONSE "smartwatt/config/response"
#define TOPIC_CMD_BUZZER      "smartwatt/cmd/buzzer"

#define MQTT_PORT 1883

// Timing constants (ms)
#define TELEMETRY_MIN_INTERVAL         1000UL   // Toi da 1 lan / 1s khi gia tri thay doi lien tuc
#define TELEMETRY_MAX_INTERVAL         30000UL  // Gui it nhat 1 lan / 30s (Heartbeat) ke ca khong doi
#define PZEM_READ_INTERVAL             1500UL
#define WATER_MEASURE_INTERVAL         1000UL
#define DISPLAY_REFRESH_INTERVAL       500UL
#define WIFI_RECONNECT_INTERVAL        10000UL
#define MQTT_RECONNECT_INTERVAL        5000UL
#define CONFIG_REQUEST_INTERVAL        15000UL

// Nguong phat hien thay doi de trigger gui du lieu (Deadbands)
#define THRESHOLD_DELTA_POWER          3.0f     // Watts (cong suat doi > 3W)
#define THRESHOLD_DELTA_CURRENT        0.03f    // Amperes (dong dien doi > 0.03A)
#define THRESHOLD_DELTA_VOLTAGE        1.5f     // Volts (dien ap doi > 1.5V)
#define THRESHOLD_DELTA_WATER_FLOW     0.1f    // L/min (dong nuoc chay/ngung/doi > 0.1 L/p)
#define THRESHOLD_DELTA_WATER_TOTAL    0.05     // Liters (tich luy them > 0.05L)
#define THRESHOLD_DELTA_ENERGY_TOTAL   0.005    // kWh (tich luy them > 5Wh)
#define THRESHOLD_DELTA_PF             0.05f    // He so cong suat
#define THRESHOLD_DELTA_FREQ           0.5f     // Tan so (Hz)
#define BOOT_HOLD_TIME                 3000UL
#define SETUP_BUZZER_INTERVAL          300UL
#define STARTUP_BUZZER_DURATION        100UL
#define CONNECTED_BEEP_ON_DURATION     100UL
#define CONNECTED_BEEP_GAP_DURATION    100UL
#define DISCONNECTED_BEEP_INTERVAL     1000UL
#define DISCONNECTED_BEEP_ON_DURATION  100UL
#define PRESS_BEEP_DURATION            80UL
#define SETUP_ENTER_BEEP_ON_DURATION   130UL
#define SETUP_ENTER_BEEP_GAP_DURATION  110UL
#define SPLASH_SCREEN_DURATION         2000UL
#define MONTHLY_RESET_CHECK_INTERVAL   30000UL
#define BOOT_MONTH_CHECK_RETRY_INTERVAL 2000UL

// YF-201 calibration from manufacturer: F = 4.5 * Q (Q in L/min, F in Hz)
#define YF201_CALIBRATION_FACTOR 4.5f
#define YF201_PULSES_PER_LITER   (YF201_CALIBRATION_FACTOR * 60.0f) // 270 pulses/L

// EEPROM layout
#define EEPROM_SIZE         512
#define EEPROM_ADDR_WIFI    0
#define EEPROM_ADDR_SERVER  128
#define EEPROM_ADDR_CACHE   320
#define EEPROM_MAGIC_BYTE   0xA5

struct WifiConfig {
  uint8_t magic;
  char ssid[32];
  char password[64];
  char mqttBrokerIp[16];
};

struct ServerConfig {
  uint8_t magic;
  float minVoltage;
  float maxVoltage;
  float minCurrent;
  float maxCurrent;
  float minPower;
  float maxPower;
  float minFrequency;
  float maxFrequency;
  float minPowerFactor;
  float maxPowerFactor;
  float minWaterFlow;
  float maxWaterFlow;
};

struct DataCache {
  uint8_t magic;
  double energyTotal;
  double waterTotalL;
  uint32_t pulseCountTotal;
  int16_t lastResetYear;
  int8_t lastResetMonth;
};

enum DeviceState {
  STATE_BOOT_SPLASH,
  STATE_NORMAL,
  STATE_SETUP_MODE
};

enum BuzzerMode {
  BUZZER_IDLE,
  BUZZER_STARTUP_BEEP,
  BUZZER_PRESS_BEEP,
  BUZZER_SETUP_ENTER_BEEP,
  BUZZER_CONNECTED_BEEP,
  BUZZER_DISCONNECTED_BEEP
};

#endif
