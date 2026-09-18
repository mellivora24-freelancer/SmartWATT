#ifndef CONFIG_H
#define CONFIG_H

#include <Arduino.h>

#define PIN_TFT_SDA   21
#define PIN_TFT_SCL   22
#define PIN_TFT_RST   18
#define PIN_TFT_DC    19
#define PIN_TFT_CS    23

#define PIN_PZEM_RX   16
#define PIN_PZEM_TX   17

#define PIN_YF201     26

#define PIN_BUZZER    4

#define PIN_BOOT_BTN  0

#define DEVICE_CODE   "SW-001"

#define TOPIC_TELEMETRY       "smartwatt/telemetry"
#define TOPIC_CONFIG_REQUEST  "smartwatt/config/request"
#define TOPIC_CONFIG_RESPONSE "smartwatt/config/response"
#define TOPIC_CMD_BUZZER      "smartwatt/cmd/buzzer"

#define MQTT_PORT 1883

#define TELEMETRY_MIN_INTERVAL         1000UL
#define TELEMETRY_MAX_INTERVAL         30000UL
#define PZEM_READ_INTERVAL             1500UL
#define WATER_MEASURE_INTERVAL         1000UL
#define DISPLAY_REFRESH_INTERVAL       500UL
#define WIFI_RECONNECT_INTERVAL        10000UL
#define MQTT_RECONNECT_INTERVAL        5000UL
#define CONFIG_REQUEST_INTERVAL        15000UL

#define THRESHOLD_DELTA_POWER          3.0f
#define THRESHOLD_DELTA_CURRENT        0.03f
#define THRESHOLD_DELTA_VOLTAGE        1.5f
#define THRESHOLD_DELTA_WATER_FLOW     0.1f
#define THRESHOLD_DELTA_WATER_TOTAL    0.05
#define THRESHOLD_DELTA_ENERGY_TOTAL   0.005
#define THRESHOLD_DELTA_PF             0.05f
#define THRESHOLD_DELTA_FREQ           0.5f
#define BOOT_HOLD_TIME                 3000UL
#define SETUP_BUZZER_INTERVAL          300UL
#define STARTUP_BUZZER_DURATION        100UL
#define CONNECTED_BEEP_ON_DURATION     100UL
#define CONNECTED_BEEP_GAP_DURATION    100UL
#define DISCONNECTED_BEEP_INTERVAL     1000UL
#define DISCONNECTED_BEEP_ON_DURATION  100UL
#define ALERT_BEEP_ON_DURATION         80UL
#define ALERT_BEEP_GAP_DURATION        80UL
#define ALERT_BEEP_MAX_DURATION        8000UL
#define PRESS_BEEP_DURATION            80UL
#define SETUP_ENTER_BEEP_ON_DURATION   130UL
#define SETUP_ENTER_BEEP_GAP_DURATION  110UL
#define SPLASH_SCREEN_DURATION         2000UL
#define MONTHLY_RESET_CHECK_INTERVAL   30000UL
#define BOOT_MONTH_CHECK_RETRY_INTERVAL 2000UL

#define YF201_CALIBRATION_FACTOR 4.5f
#define YF201_PULSES_PER_LITER   (YF201_CALIBRATION_FACTOR * 60.0f)

#define PZEM_MIN_VOLTAGE     80.0f
#define PZEM_MAX_VOLTAGE     300.0f
#define PZEM_MIN_CURRENT     0.0f
#define PZEM_MAX_CURRENT     100.0f
#define PZEM_MIN_POWER       0.0f
#define PZEM_MAX_POWER       25000.0f
#define PZEM_MIN_PF          0.0f
#define PZEM_MAX_PF          1.0f
#define PZEM_MIN_FREQ        45.0f
#define PZEM_MAX_FREQ        65.0f

#define MAX_PLAUSIBLE_ENERGY_TOTAL   50000.0
#define MAX_PLAUSIBLE_WATER_TOTAL    1000000.0

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
  BUZZER_DISCONNECTED_BEEP,
  BUZZER_ALERT_BEEP
};

#endif
