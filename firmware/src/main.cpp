#include <WiFi.h>
#include <WebServer.h>
#include <PubSubClient.h>
#include <EEPROM.h>
#include <ArduinoJson.h>
#include <Adafruit_GFX.h>
#include <Adafruit_ST7735.h>
#include <PZEM004Tv30.h>
#include <time.h>
#include "CONFIG.h"

WebServer portalServer(80);
WiFiClient mqttWifiClient;
PubSubClient mqttClient(mqttWifiClient);
Adafruit_ST7735 tft(PIN_TFT_CS, PIN_TFT_DC, PIN_TFT_SDA, PIN_TFT_SCL, PIN_TFT_RST);
HardwareSerial pzemSerial(2);
PZEM004Tv30 pzem(pzemSerial, PIN_PZEM_RX, PIN_PZEM_TX);

WifiConfig wifiConfig;
ServerConfig serverConfig;
DataCache dataCache;

DeviceState currentState = STATE_BOOT_SPLASH;

BuzzerMode buzzerMode = BUZZER_IDLE;
unsigned long buzzerEventStart = 0;
unsigned long buzzerLastToggle = 0;
bool buzzerOn = false;
uint8_t connectedBeepStep = 0;
unsigned long connectedBeepStepStart = 0;
bool wasFullyConnected = false;

struct MelodyNote { uint16_t freq; uint16_t duration; };
const MelodyNote STARTUP_MELODY[] = {
  { 523, 200 },
  { 587, 200 },
  { 784, 360 },
};

const uint8_t STARTUP_MELODY_LEN = sizeof(STARTUP_MELODY) / sizeof(STARTUP_MELODY[0]);
uint8_t startupMelodyStep = 0;
unsigned long startupMelodyStepStart = 0;

bool bootButtonPressed = false;
unsigned long bootButtonPressStart = 0;
bool setupModeTriggered = false;
bool pendingSetupEntry = false;

unsigned long splashStartTime = 0;
bool widgetsDrawn = false;

volatile uint32_t pulseCounter = 0;
unsigned long lastWaterMeasureTime = 0;
float latestWaterFlowLpm = 0;

float latestVoltage = NAN;
float latestCurrent = NAN;
float latestPower = NAN;
float latestPowerFactor = NAN;
float latestFrequency = NAN;
unsigned long lastPzemReadTime = 0;

float lastSentVoltage = -999.0f;
float lastSentCurrent = -999.0f;
float lastSentPower = -999.0f;
float lastSentPowerFactor = -999.0f;
float lastSentFrequency = -999.0f;
float lastSentWaterFlow = -999.0f;
double lastSentEnergyTotal = -999.0;
double lastSentWaterTotal = -999.0;

bool wifiConnectInProgress = false;
unsigned long wifiConnectStartTime = 0;
unsigned long lastWifiRetryTime = 0;
bool ntpSynced = false;
bool bootMonthCheckDone = false;
unsigned long lastBootMonthCheckAttempt = 0;

unsigned long lastMqttRetryTime = 0;
unsigned long lastConfigRequestTime = 0;

unsigned long lastTelemetryPublish = 0;
unsigned long lastPzemRead = 0;
unsigned long lastWaterUpdate = 0;
unsigned long lastDisplayRefresh = 0;
unsigned long lastMonthlyCheck = 0;

char prevEnergyStr[16] = "";
char prevWaterStr[16] = "";
char prevCurrentStr[12] = "";
char prevPowerStr[12] = "";
char prevFlowStr[12] = "";

const char PORTAL_HTML[] PROGMEM = R"====(
<!DOCTYPE html>
<html>
<head>
<meta charset="utf-8">
<meta name="viewport" content="width=device-width, initial-scale=1">
<title>SmartWATT Setup</title>
<style>
  body { font-family: -apple-system, Segoe UI, Roboto, sans-serif; background:#f4f5f7; margin:0; padding:24px; color:#1f2430; }
  .card { max-width:360px; margin:0 auto; background:#ffffff; border-radius:12px; padding:24px; box-shadow:0 1px 4px rgba(0,0,0,0.08); }
  h1 { font-size:20px; margin:0 0 4px 0; }
  p.sub { color:#6b7280; font-size:13px; margin:0 0 20px 0; }
  label { display:block; font-size:13px; font-weight:600; margin:14px 0 6px; }
  input { width:100%; box-sizing:border-box; padding:10px 12px; border:1px solid #d7dae0; border-radius:8px; font-size:14px; }
  input:focus { outline:none; border-color:#2f6feb; }
  button { width:100%; margin-top:22px; padding:11px; background:#2f6feb; color:#fff; border:none; border-radius:8px; font-size:15px; font-weight:600; cursor:pointer; }
  button:active { background:#2559c7; }
</style>
</head>
<body>
  <div class="card">
    <h1>SmartWATT</h1>
    <p class="sub">ấu hình kết nối Wi-Fi và MQTT broker</p>
    <form action="/save" method="POST">
      <label>Chọn mạng Wi-Fi</label>
      <input type="text" name="ssid" maxlength="31" required>
      <label>Nhập mật khẩu WiFi</label>
      <input type="password" name="password" maxlength="63">
      <label>Địa chỉ IP MQTT Broker</label>
      <input type="text" name="mqtt_ip" maxlength="15" required placeholder="192.168.1.10">
      <button type="submit">Lưu cấu hình</button>
    </form>
  </div>
</body>
</html>
)====";

void loadWifiConfig();
void saveWifiConfig();
void loadServerConfig();
void saveServerConfig();
void loadDataCache();
void saveDataCache();
void startBuzzerStartup();
void startBuzzerPressBeep();
void startBuzzerSetupEnter();
void startBuzzerConnected();
void startBuzzerDisconnected();
void startBuzzerAlert();
void stopBuzzer();
void updateBuzzer();
void updateDoubleBeepStep(unsigned long onDuration, unsigned long gapDuration);
void updateConnectionBuzzer();
void checkBootButton();
void enterSetupMode();
void handlePortalRoot();
void handlePortalSave();
void startWiFiPortal();
void beginWiFiConnect();
void manageWiFiConnection();
void manageMqttConnection();
void requestServerConfig();
void mqttCallback(char *topic, byte *payload, unsigned int length);
bool hasSignificantChange();
void publishTelemetry(const char *reason = "change");
void readPzemData();
void IRAM_ATTR yf201PulseISR();
void updateWaterFlow();
void syncNtpTime();
void resetMonthlyAccumulators(int year, int month);
void checkMonthlyReset();
bool checkMonthlyResetOnBoot();
void drawSplashScreen();
void drawSetupModeScreen();
void drawWidgetsStatic();
void drawValueField(int x, int y, int w, int h, const char *newValue, char *prevValue, size_t prevSize, uint16_t textColor, uint16_t bgColor, uint8_t textSize);
void refreshWidgetValues();

// Loads Wi-Fi/MQTT connection settings from EEPROM
void loadWifiConfig() {
  EEPROM.get(EEPROM_ADDR_WIFI, wifiConfig);
  if (wifiConfig.magic != EEPROM_MAGIC_BYTE) {
    memset(&wifiConfig, 0, sizeof(wifiConfig));
  }
}

// Persists Wi-Fi/MQTT connection settings to EEPROM
void saveWifiConfig() {
  wifiConfig.magic = EEPROM_MAGIC_BYTE;
  EEPROM.put(EEPROM_ADDR_WIFI, wifiConfig);
  EEPROM.commit();
}

// Loads server-provided thresholds from EEPROM
void loadServerConfig() {
  EEPROM.get(EEPROM_ADDR_SERVER, serverConfig);
  if (serverConfig.magic != EEPROM_MAGIC_BYTE) {
    memset(&serverConfig, 0, sizeof(serverConfig));
  }
}

// Persists server-provided thresholds to EEPROM
void saveServerConfig() {
  serverConfig.magic = EEPROM_MAGIC_BYTE;
  EEPROM.put(EEPROM_ADDR_SERVER, serverConfig);
  EEPROM.commit();
}

// Loads accumulated energy/water totals from EEPROM, resetting to zero if the stored data is missing or implausible
void loadDataCache() {
  EEPROM.get(EEPROM_ADDR_CACHE, dataCache);

  bool invalid = (dataCache.magic != EEPROM_MAGIC_BYTE) ||
                 isnan(dataCache.energyTotal) || dataCache.energyTotal < 0 ||
                 dataCache.energyTotal > MAX_PLAUSIBLE_ENERGY_TOTAL ||
                 isnan(dataCache.waterTotalL) || dataCache.waterTotalL < 0 ||
                 dataCache.waterTotalL > MAX_PLAUSIBLE_WATER_TOTAL;

  if (invalid) {
    memset(&dataCache, 0, sizeof(dataCache));
    saveDataCache();
  }
}

// Persists accumulated energy/water totals to EEPROM
void saveDataCache() {
  dataCache.magic = EEPROM_MAGIC_BYTE;
  EEPROM.put(EEPROM_ADDR_CACHE, dataCache);
  EEPROM.commit();
}

// Starts the boot-up melody
void startBuzzerStartup() {
  buzzerMode = BUZZER_STARTUP_BEEP;
  startupMelodyStep = 0;
  startupMelodyStepStart = millis();
  buzzerOn = true;
  tone(PIN_BUZZER, STARTUP_MELODY[0].freq);
}

// Starts a short single beep for a boot-button press
void startBuzzerPressBeep() {
  buzzerMode = BUZZER_PRESS_BEEP;
  buzzerEventStart = millis();
  buzzerOn = true;
  digitalWrite(PIN_BUZZER, HIGH);
}

// Starts the double beep played just before entering setup mode
void startBuzzerSetupEnter() {
  buzzerMode = BUZZER_SETUP_ENTER_BEEP;
  connectedBeepStep = 0;
  connectedBeepStepStart = millis();
  buzzerOn = true;
  digitalWrite(PIN_BUZZER, HIGH);
}

// Starts the one-shot double beep played when Wi-Fi and MQTT both connect
void startBuzzerConnected() {
  buzzerMode = BUZZER_CONNECTED_BEEP;
  connectedBeepStep = 0;
  connectedBeepStepStart = millis();
  buzzerOn = true;
  digitalWrite(PIN_BUZZER, HIGH);
}

// Starts the repeating single beep (once per second) while Wi-Fi/MQTT is down
void startBuzzerDisconnected() {
  buzzerMode = BUZZER_DISCONNECTED_BEEP;
  buzzerOn = true;
  buzzerLastToggle = millis();
  digitalWrite(PIN_BUZZER, HIGH);
}

// Starts the fast repeating alert beep, auto-stopping after ALERT_BEEP_MAX_DURATION
void startBuzzerAlert() {
  buzzerMode = BUZZER_ALERT_BEEP;
  buzzerOn = true;
  buzzerLastToggle = millis();
  buzzerEventStart = millis();
  digitalWrite(PIN_BUZZER, HIGH);
}

// Silences the buzzer and clears the active pattern
void stopBuzzer() {
  buzzerMode = BUZZER_IDLE;
  buzzerOn = false;
  noTone(PIN_BUZZER);
  digitalWrite(PIN_BUZZER, LOW);
}

// Advances a generic one-shot "beep - gap - beep" pattern
void updateDoubleBeepStep(unsigned long onDuration, unsigned long gapDuration) {
  unsigned long now = millis();
  unsigned long elapsed = now - connectedBeepStepStart;
  if (connectedBeepStep == 0 && elapsed >= onDuration) {
    digitalWrite(PIN_BUZZER, LOW);
    connectedBeepStep = 1;
    connectedBeepStepStart = now;
  } else if (connectedBeepStep == 1 && elapsed >= gapDuration) {
    digitalWrite(PIN_BUZZER, HIGH);
    connectedBeepStep = 2;
    connectedBeepStepStart = now;
  } else if (connectedBeepStep == 2 && elapsed >= onDuration) {
    stopBuzzer();
  }
}

// Advances the current buzzer pattern without blocking the loop
void updateBuzzer() {
  unsigned long now = millis();

  if (buzzerMode == BUZZER_STARTUP_BEEP) {
    if (now - startupMelodyStepStart >= STARTUP_MELODY[startupMelodyStep].duration) {
      startupMelodyStep++;
      if (startupMelodyStep >= STARTUP_MELODY_LEN) {
        stopBuzzer();
      } else {
        startupMelodyStepStart = now;
        tone(PIN_BUZZER, STARTUP_MELODY[startupMelodyStep].freq);
      }
    }
  } else if (buzzerMode == BUZZER_PRESS_BEEP) {
    if (now - buzzerEventStart >= PRESS_BEEP_DURATION) {
      stopBuzzer();
    }
  } else if (buzzerMode == BUZZER_SETUP_ENTER_BEEP) {
    updateDoubleBeepStep(SETUP_ENTER_BEEP_ON_DURATION, SETUP_ENTER_BEEP_GAP_DURATION);
  } else if (buzzerMode == BUZZER_CONNECTED_BEEP) {
    updateDoubleBeepStep(CONNECTED_BEEP_ON_DURATION, CONNECTED_BEEP_GAP_DURATION);
  } else if (buzzerMode == BUZZER_DISCONNECTED_BEEP) {
    if (buzzerOn) {
      if (now - buzzerLastToggle >= DISCONNECTED_BEEP_ON_DURATION) {
        buzzerOn = false;
        buzzerLastToggle = now;
        digitalWrite(PIN_BUZZER, LOW);
      }
    } else {
      if (now - buzzerLastToggle >= (DISCONNECTED_BEEP_INTERVAL - DISCONNECTED_BEEP_ON_DURATION)) {
        buzzerOn = true;
        buzzerLastToggle = now;
        digitalWrite(PIN_BUZZER, HIGH);
      }
    }
  } else if (buzzerMode == BUZZER_ALERT_BEEP) {
    if (now - buzzerEventStart >= ALERT_BEEP_MAX_DURATION) {
      stopBuzzer();
    } else if (buzzerOn) {
      if (now - buzzerLastToggle >= ALERT_BEEP_ON_DURATION) {
        buzzerOn = false;
        buzzerLastToggle = now;
        digitalWrite(PIN_BUZZER, LOW);
      }
    } else {
      if (now - buzzerLastToggle >= ALERT_BEEP_GAP_DURATION) {
        buzzerOn = true;
        buzzerLastToggle = now;
        digitalWrite(PIN_BUZZER, HIGH);
      }
    }
  }
}

// Watches Wi-Fi/MQTT connection state and drives the connected/disconnected beep patterns
void updateConnectionBuzzer() {
  bool isFullyConnected = (WiFi.status() == WL_CONNECTED) && mqttClient.connected();

  if (isFullyConnected && !wasFullyConnected) {
    wasFullyConnected = true;
    if (buzzerMode != BUZZER_STARTUP_BEEP) {
      startBuzzerConnected();
    }
  } else if (!isFullyConnected) {
    wasFullyConnected = false;
    if (buzzerMode == BUZZER_IDLE) {
      startBuzzerDisconnected();
    }
  }
}

// Tracks BOOT button hold duration, triggering the setup-mode entry sequence once held long enough
void checkBootButton() {
  bool pressed = digitalRead(PIN_BOOT_BTN) == LOW;
  unsigned long now = millis();

  if (pressed && !bootButtonPressed) {
    bootButtonPressed = true;
    bootButtonPressStart = now;
    startBuzzerPressBeep();
  } else if (!pressed && bootButtonPressed) {
    bootButtonPressed = false;
    setupModeTriggered = false;
  }

  if (bootButtonPressed && !setupModeTriggered && (now - bootButtonPressStart >= BOOT_HOLD_TIME)) {
    setupModeTriggered = true;
    pendingSetupEntry = true;
    startBuzzerSetupEnter();
  }
}

// Switches the device into Wi-Fi/MQTT setup mode
void enterSetupMode() {
  if (currentState == STATE_SETUP_MODE) return;
  currentState = STATE_SETUP_MODE;
  startWiFiPortal();
  drawSetupModeScreen();
}

// Serves the setup portal form
void handlePortalRoot() {
  portalServer.send_P(200, "text/html", PORTAL_HTML);
}

// Saves submitted Wi-Fi/MQTT settings and reboots the device
void handlePortalSave() {
  String ssid = portalServer.arg("ssid");
  String password = portalServer.arg("password");
  String mqttIp = portalServer.arg("mqtt_ip");

  ssid.toCharArray(wifiConfig.ssid, sizeof(wifiConfig.ssid));
  password.toCharArray(wifiConfig.password, sizeof(wifiConfig.password));
  mqttIp.toCharArray(wifiConfig.mqttBrokerIp, sizeof(wifiConfig.mqttBrokerIp));
  saveWifiConfig();

  portalServer.send(200, "text/html", "<html><body><h3>Cấu hình đã được lưu. Thiết bị sẽ khởi động lại...</h3></body></html>");
  delay(300);
  ESP.restart();
}

// Starts the AP and HTTP server used for network bootstrap
void startWiFiPortal() {
  WiFi.mode(WIFI_AP);
  String apName = String("SmartWATT-") + DEVICE_CODE;
  WiFi.softAP(apName.c_str());
  portalServer.on("/", handlePortalRoot);
  portalServer.on("/save", HTTP_POST, handlePortalSave);
  portalServer.begin();
}

// Starts a non-blocking Wi-Fi station connection attempt
void beginWiFiConnect() {
  WiFi.mode(WIFI_STA);
  WiFi.begin(wifiConfig.ssid, wifiConfig.password);
  wifiConnectInProgress = true;
  wifiConnectStartTime = millis();
}

// Supervises Wi-Fi connection state and retries on a timer
void manageWiFiConnection() {
  unsigned long now = millis();

  if (WiFi.status() == WL_CONNECTED) {
    wifiConnectInProgress = false;
    return;
  }

  if (!wifiConnectInProgress) {
    if (now - lastWifiRetryTime >= WIFI_RECONNECT_INTERVAL) {
      lastWifiRetryTime = now;
      beginWiFiConnect();
    }
  } else if (now - wifiConnectStartTime >= WIFI_RECONNECT_INTERVAL) {
    wifiConnectInProgress = false;
    lastWifiRetryTime = now;
  }
}

// Requests the current thresholds config from the server
void requestServerConfig() {
  JsonDocument doc;
  doc["device_code"] = DEVICE_CODE;
  char buffer[64];
  serializeJson(doc, buffer);
  mqttClient.publish(TOPIC_CONFIG_REQUEST, buffer);
  lastConfigRequestTime = millis();
}

// Supervises MQTT connection state, subscriptions and reconnect timing
void manageMqttConnection() {
  if (WiFi.status() != WL_CONNECTED) return;

  if (mqttClient.connected()) {
    mqttClient.loop();
    return;
  }

  unsigned long now = millis();
  if (now - lastMqttRetryTime < MQTT_RECONNECT_INTERVAL) return;
  lastMqttRetryTime = now;

  String clientId = String("smartwatt-") + DEVICE_CODE;
  if (mqttClient.connect(clientId.c_str())) {
    mqttClient.subscribe(TOPIC_CONFIG_RESPONSE);
    mqttClient.subscribe(TOPIC_CMD_BUZZER);
    requestServerConfig();
  }
}

// Handles incoming MQTT messages for config updates and buzzer commands
void mqttCallback(char *topic, byte *payload, unsigned int length) {
  JsonDocument doc;
  if (deserializeJson(doc, payload, length) != DeserializationError::Ok) return;

  const char *code = doc["device_code"] | "";
  if (strcmp(code, DEVICE_CODE) != 0) return;

  if (strcmp(topic, TOPIC_CONFIG_RESPONSE) == 0) {
    if (!doc["min_voltage"].isNull()) serverConfig.minVoltage = doc["min_voltage"].as<float>();
    if (!doc["max_voltage"].isNull()) serverConfig.maxVoltage = doc["max_voltage"].as<float>();
    if (!doc["min_current"].isNull()) serverConfig.minCurrent = doc["min_current"].as<float>();
    if (!doc["max_current"].isNull()) serverConfig.maxCurrent = doc["max_current"].as<float>();
    if (!doc["min_power"].isNull()) serverConfig.minPower = doc["min_power"].as<float>();
    if (!doc["max_power"].isNull()) serverConfig.maxPower = doc["max_power"].as<float>();
    if (!doc["min_frequency"].isNull()) serverConfig.minFrequency = doc["min_frequency"].as<float>();
    if (!doc["max_frequency"].isNull()) serverConfig.maxFrequency = doc["max_frequency"].as<float>();
    if (!doc["min_power_factor"].isNull()) serverConfig.minPowerFactor = doc["min_power_factor"].as<float>();
    if (!doc["max_power_factor"].isNull()) serverConfig.maxPowerFactor = doc["max_power_factor"].as<float>();
    if (!doc["min_water_flow"].isNull()) serverConfig.minWaterFlow = doc["min_water_flow"].as<float>();
    if (!doc["max_water_flow"].isNull()) serverConfig.maxWaterFlow = doc["max_water_flow"].as<float>();
    saveServerConfig();
    Serial.println("[MQTT] Server config synced and saved to EEPROM");
  } else if (strcmp(topic, TOPIC_CMD_BUZZER) == 0) {
    const char *action = doc["action"] | "";
    if (strcmp(action, "ON") == 0) {
      startBuzzerAlert();
    } else if (strcmp(action, "OFF") == 0) {
      stopBuzzer();
    }
  }
}

// Evaluates whether sensor readings have changed enough to warrant publishing
bool hasSignificantChange() {
  if (lastSentVoltage < -900.0f) return true;

  float v = isnan(latestVoltage) ? 0.0f : latestVoltage;
  float c = isnan(latestCurrent) ? 0.0f : latestCurrent;
  float p = isnan(latestPower) ? 0.0f : latestPower;
  float pf = isnan(latestPowerFactor) ? 0.0f : latestPowerFactor;
  float f = isnan(latestFrequency) ? 0.0f : latestFrequency;
  float wFlow = latestWaterFlowLpm;
  double eTotal = dataCache.energyTotal;
  double wTotal = dataCache.waterTotalL;

  if (fabs(p - lastSentPower) >= THRESHOLD_DELTA_POWER) return true;
  if (fabs(c - lastSentCurrent) >= THRESHOLD_DELTA_CURRENT) return true;
  if (fabs(v - lastSentVoltage) >= THRESHOLD_DELTA_VOLTAGE) return true;
  if (fabs(wFlow - lastSentWaterFlow) >= THRESHOLD_DELTA_WATER_FLOW) return true;
  if (fabs(wTotal - lastSentWaterTotal) >= THRESHOLD_DELTA_WATER_TOTAL) return true;
  if (fabs(eTotal - lastSentEnergyTotal) >= THRESHOLD_DELTA_ENERGY_TOTAL) return true;
  if (fabs(pf - lastSentPowerFactor) >= THRESHOLD_DELTA_PF) return true;
  if (fabs(f - lastSentFrequency) >= THRESHOLD_DELTA_FREQ) return true;

  return false;
}

// Publishes all metrics in a single payload when triggered by data change or heartbeat
void publishTelemetry(const char *reason) {
  if (!mqttClient.connected()) return;

  float v = isnan(latestVoltage) ? 0.0f : latestVoltage;
  float c = isnan(latestCurrent) ? 0.0f : latestCurrent;
  float p = isnan(latestPower) ? 0.0f : latestPower;
  float pf = isnan(latestPowerFactor) ? 0.0f : latestPowerFactor;
  float f = isnan(latestFrequency) ? 0.0f : latestFrequency;
  float wFlow = latestWaterFlowLpm;
  double eTotal = dataCache.energyTotal;
  double wTotal = dataCache.waterTotalL;

  JsonDocument doc;
  doc["device_code"] = DEVICE_CODE;
  doc["voltage"] = v;
  doc["current"] = c;
  doc["power"] = p;
  doc["power_factor"] = pf;
  doc["frequency"] = f;
  doc["energy_total"] = eTotal;
  doc["water_flow_lpm"] = wFlow;
  doc["water_total_l"] = wTotal;
  doc["pulse_count"] = dataCache.pulseCountTotal;

  char buffer[384];
  serializeJson(doc, buffer);
  mqttClient.publish(TOPIC_TELEMETRY, buffer);

  lastSentVoltage = v;
  lastSentCurrent = c;
  lastSentPower = p;
  lastSentPowerFactor = pf;
  lastSentFrequency = f;
  lastSentWaterFlow = wFlow;
  lastSentEnergyTotal = eTotal;
  lastSentWaterTotal = wTotal;
  lastTelemetryPublish = millis();

  Serial.printf("[MQTT] Sent telemetry (%s): P=%.0fW, V=%.1fV, I=%.2fA, Q=%.2fL/m, Etot=%.3fkWh, Wtot=%.3fL\n",
                reason, p, v, c, wFlow, eTotal, wTotal);
}

// Reads PZEM-004T values (rejecting implausible readings) and integrates instantaneous power into energy_total
void readPzemData() {
  unsigned long now = millis();
  unsigned long dt = now - lastPzemReadTime;
  lastPzemReadTime = now;

  float v = pzem.voltage();
  float c = pzem.current();
  float p = pzem.power();
  float pf = pzem.pf();
  float f = pzem.frequency();

  if (!isnan(v) && v >= PZEM_MIN_VOLTAGE && v <= PZEM_MAX_VOLTAGE) latestVoltage = v;
  if (!isnan(c) && c >= PZEM_MIN_CURRENT && c <= PZEM_MAX_CURRENT) latestCurrent = c;
  if (!isnan(f) && f >= PZEM_MIN_FREQ && f <= PZEM_MAX_FREQ) latestFrequency = f;
  if (!isnan(pf) && pf >= PZEM_MIN_PF && pf <= PZEM_MAX_PF) latestPowerFactor = pf;

  if (!isnan(p) && p >= PZEM_MIN_POWER && p <= PZEM_MAX_POWER) {
    latestPower = p;
    dataCache.energyTotal += (p * (dt / 3600000.0)) / 1000.0;
  }
}

// Interrupt handler counting raw pulses from the YF-201 sensor
void IRAM_ATTR yf201PulseISR() {
  pulseCounter++;
}

// Derives instantaneous flow rate and accumulates total volume from pulse deltas
void updateWaterFlow() {
  unsigned long now = millis();
  unsigned long dt = now - lastWaterMeasureTime;
  if (dt == 0) return;
  lastWaterMeasureTime = now;

  noInterrupts();
  uint32_t currentPulses = pulseCounter;
  pulseCounter = 0;
  interrupts();

  uint32_t deltaPulses = currentPulses;

  if (dt > 0) {
    latestWaterFlowLpm = ((1000.0f / (float)dt) * (float)deltaPulses) / YF201_CALIBRATION_FACTOR;
  }

  double deltaLiters = (double)deltaPulses / (double)YF201_PULSES_PER_LITER;
  dataCache.waterTotalL += deltaLiters;
  dataCache.pulseCountTotal += deltaPulses;

  if (deltaPulses > 0) {
    Serial.printf("[YF201] Pulses: +%u (Total: %u) | Flow: %.2f L/min | Water Total: %.3f L\n",
                  deltaPulses, dataCache.pulseCountTotal, latestWaterFlowLpm, dataCache.waterTotalL);
  }
}

// Configures the system clock via NTP
void syncNtpTime() {
  configTime(7 * 3600, 0, "pool.ntp.org", "time.google.com");
}

// Zeroes accumulated totals and records the month this reset applies to
void resetMonthlyAccumulators(int year, int month) {
  dataCache.energyTotal = 0;
  dataCache.waterTotalL = 0;
  dataCache.pulseCountTotal = 0;
  dataCache.lastResetYear = year;
  dataCache.lastResetMonth = month;
  saveDataCache();
}

// Resets accumulated totals at 00:00 on the 1st of each month, once per month
void checkMonthlyReset() {
  struct tm timeInfo;
  if (!getLocalTime(&timeInfo, 100)) return;

  int currentYear = timeInfo.tm_year + 1900;
  int currentMonth = timeInfo.tm_mon + 1;
  bool isResetMoment = (timeInfo.tm_mday == 1 && timeInfo.tm_hour == 0 && timeInfo.tm_min == 0);

  if (!isResetMoment) return;

  bool alreadyReset = (dataCache.lastResetYear == currentYear && dataCache.lastResetMonth == currentMonth);
  if (alreadyReset) return;

  resetMonthlyAccumulators(currentYear, currentMonth);
}

// Applies any monthly reset that was missed while the device was powered off, once NTP time is available
bool checkMonthlyResetOnBoot() {
  struct tm timeInfo;
  if (!getLocalTime(&timeInfo, 100)) return false;

  int currentYear = timeInfo.tm_year + 1900;
  int currentMonth = timeInfo.tm_mon + 1;
  bool alreadyResetThisMonth = (dataCache.lastResetYear == currentYear && dataCache.lastResetMonth == currentMonth);

  if (!alreadyResetThisMonth) {
    resetMonthlyAccumulators(currentYear, currentMonth);
  }

  return true;
}

// Draws the short green SMARTWATT splash screen
void drawSplashScreen() {
  tft.fillScreen(ST77XX_BLACK);
  tft.setTextColor(ST77XX_GREEN);
  tft.setTextSize(2);
  tft.setCursor(26, 56);
  tft.print("SMARTWATT");
  splashStartTime = millis();
}

// Draws the static setup mode instructions screen
void drawSetupModeScreen() {
  tft.fillScreen(ST77XX_BLACK);
  tft.setTextColor(ST77XX_YELLOW);
  tft.setTextSize(1);
  tft.setCursor(10, 30);
  tft.print("SETUP MODE");
  tft.setTextColor(ST77XX_WHITE);
  tft.setCursor(10, 55);
  tft.print("Connect to Wi-Fi AP:");
  tft.setCursor(10, 70);
  tft.print("SmartWATT-" DEVICE_CODE);
}

// Draws the static labels and widget backgrounds once, avoiding flicker on redraw
void drawWidgetsStatic() {
  tft.fillScreen(ST77XX_BLACK);

  tft.fillRect(0, 0, 80, 80, ST77XX_YELLOW);
  tft.setTextColor(ST77XX_BLACK);
  tft.setTextSize(1);
  tft.setCursor(4, 4);
  tft.print("DIEN (kWh)");

  tft.fillRect(80, 0, 80, 80, ST77XX_BLUE);
  tft.setTextColor(ST77XX_WHITE);
  tft.setCursor(84, 4);
  tft.print("NUOC (L)");

  tft.drawFastVLine(54, 80, 48, ST77XX_WHITE);
  tft.drawFastVLine(107, 80, 48, ST77XX_WHITE);

  tft.setTextColor(ST77XX_CYAN);
  tft.setCursor(4, 84);
  tft.print("I(A)");
  tft.setCursor(58, 84);
  tft.print("P(W)");
  tft.setCursor(111, 84);
  tft.print("Q(L/m)");

  memset(prevEnergyStr, 0, sizeof(prevEnergyStr));
  memset(prevWaterStr, 0, sizeof(prevWaterStr));
  memset(prevCurrentStr, 0, sizeof(prevCurrentStr));
  memset(prevPowerStr, 0, sizeof(prevPowerStr));
  memset(prevFlowStr, 0, sizeof(prevFlowStr));
}

// Redraws a numeric field only when its value has actually changed
void drawValueField(int x, int y, int w, int h, const char *newValue, char *prevValue, size_t prevSize, uint16_t textColor, uint16_t bgColor, uint8_t textSize) {
  if (strncmp(newValue, prevValue, prevSize) == 0) return;

  tft.fillRect(x, y, w, h, bgColor);
  tft.setTextColor(textColor);
  tft.setTextSize(textSize);
  tft.setCursor(x, y);
  tft.print(newValue);

  strncpy(prevValue, newValue, prevSize - 1);
  prevValue[prevSize - 1] = '\0';
}

// Updates all widget values on screen using partial, flicker-free redraws
void refreshWidgetValues() {
  char buf[16];

  snprintf(buf, sizeof(buf), "%.2f", dataCache.energyTotal);
  drawValueField(4, 24, 72, 44, buf, prevEnergyStr, sizeof(prevEnergyStr), ST77XX_BLACK, ST77XX_YELLOW, 2);

  if (dataCache.waterTotalL < 100.0) {
    snprintf(buf, sizeof(buf), "%.2f", dataCache.waterTotalL);
  } else {
    snprintf(buf, sizeof(buf), "%.1f", dataCache.waterTotalL);
  }
  drawValueField(84, 24, 72, 44, buf, prevWaterStr, sizeof(prevWaterStr), ST77XX_WHITE, ST77XX_BLUE, 2);

  snprintf(buf, sizeof(buf), "%.1f", isnan(latestCurrent) ? 0 : latestCurrent);
  drawValueField(4, 102, 46, 20, buf, prevCurrentStr, sizeof(prevCurrentStr), ST77XX_WHITE, ST77XX_BLACK, 1);

  snprintf(buf, sizeof(buf), "%.0f", isnan(latestPower) ? 0 : latestPower);
  drawValueField(58, 102, 44, 20, buf, prevPowerStr, sizeof(prevPowerStr), ST77XX_WHITE, ST77XX_BLACK, 1);

  snprintf(buf, sizeof(buf), "%.2f", latestWaterFlowLpm);
  drawValueField(111, 102, 44, 20, buf, prevFlowStr, sizeof(prevFlowStr), ST77XX_WHITE, ST77XX_BLACK, 1);
}

// Initializes peripherals, loads persisted config, and shows the boot splash
void setup() {
  Serial.begin(115200);

  pinMode(PIN_BUZZER, OUTPUT);
  digitalWrite(PIN_BUZZER, LOW);
  pinMode(PIN_BOOT_BTN, INPUT_PULLUP);
  pinMode(PIN_YF201, INPUT_PULLUP);
  attachInterrupt(digitalPinToInterrupt(PIN_YF201), yf201PulseISR, FALLING);

  EEPROM.begin(EEPROM_SIZE);
  loadWifiConfig();
  loadServerConfig();
  loadDataCache();

  tft.initR(INITR_BLACKTAB);
  tft.setRotation(3);

  drawSplashScreen();
  startBuzzerStartup();

  mqttClient.setServer(wifiConfig.mqttBrokerIp, MQTT_PORT);
  mqttClient.setCallback(mqttCallback);

  lastPzemReadTime = millis();
  lastWaterMeasureTime = millis();
}

// Main loop: drives connection management, sensor reads, telemetry publishing and the display
void loop() {
  unsigned long now = millis();

  checkBootButton();
  updateBuzzer();

  if (pendingSetupEntry && buzzerMode == BUZZER_IDLE) {
    pendingSetupEntry = false;
    enterSetupMode();
  }

  if (currentState == STATE_BOOT_SPLASH) {
    if (now - splashStartTime >= SPLASH_SCREEN_DURATION) {
      currentState = STATE_NORMAL;
    }
    return;
  }

  if (currentState == STATE_SETUP_MODE) {
    portalServer.handleClient();
    return;
  }

  if (!widgetsDrawn) {
    drawWidgetsStatic();
    widgetsDrawn = true;
  }

  manageWiFiConnection();

  if (WiFi.status() == WL_CONNECTED) {
    if (!ntpSynced) {
      syncNtpTime();
      ntpSynced = true;
    }

    if (!bootMonthCheckDone && now - lastBootMonthCheckAttempt >= BOOT_MONTH_CHECK_RETRY_INTERVAL) {
      lastBootMonthCheckAttempt = now;
      if (checkMonthlyResetOnBoot()) {
        bootMonthCheckDone = true;
      }
    }

    manageMqttConnection();
  }

  updateConnectionBuzzer();

  if (now - lastPzemRead >= PZEM_READ_INTERVAL) {
    lastPzemRead = now;
    readPzemData();
  }

  if (now - lastWaterUpdate >= WATER_MEASURE_INTERVAL) {
    lastWaterUpdate = now;
    updateWaterFlow();
  }


  if (mqttClient.connected()) {
    unsigned long timeSinceLastPub = now - lastTelemetryPublish;
    if (timeSinceLastPub >= TELEMETRY_MIN_INTERVAL && hasSignificantChange()) {
      publishTelemetry("data_changed");
      saveDataCache();
    } else if (timeSinceLastPub >= TELEMETRY_MAX_INTERVAL) {
      publishTelemetry("heartbeat");
      saveDataCache();
    }
  }

  if (now - lastMonthlyCheck >= MONTHLY_RESET_CHECK_INTERVAL) {
    lastMonthlyCheck = now;
    checkMonthlyReset();
  }

  if (now - lastDisplayRefresh >= DISPLAY_REFRESH_INTERVAL) {
    lastDisplayRefresh = now;
    refreshWidgetValues();
  }
}
