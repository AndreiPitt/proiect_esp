#include <WiFi.h>
#include <LittleFS.h>
#include <AsyncTCP.h>
#include <ESPAsyncWebServer.h>
#include <ArduinoJson.h>
#include "driver/ledc.h"
#include "esp_err.h"

// Detalii rețea Wi-Fi (configurat ca Access Point)
const char *ssid = "Ghpy1668";
const char *password = "ghpy1668";

// Obiecte pentru serverul web și WebSocket
AsyncWebServer server(80);
AsyncWebSocket ws("/ws");

// Configurații LEDC
#define LEDC_TIMER LEDC_TIMER_0
#define LEDC_MODE LEDC_LOW_SPEED_MODE
#define LEDC_DUTY_RES LEDC_TIMER_10_BIT // 10 biti rezolutie (0-1023)
#define MAX_DUTY_VALUE ((1 << LEDC_DUTY_RES) - 1)

// Enum pentru a distinge starea pinilor
enum PinFunction {
    PIN_NONE,
    PIN_GPIO_OUT,
    PIN_GPIO_IN,
    PIN_PWM,
    PIN_ADC
};

// Structură pentru a stoca configurațiile pinilor
struct PinConfig {
    PinFunction function;
    int ledcChannel; // -1 dacă nu este folosit
};

// Array pentru a stoca configurațiile pinilor.
PinConfig pinConfigurations[40];
int ledcChannelCount = 0; // Contor pentru a aloca canale LEDC

// Funcție ajutătoare pentru a extrage numărul GPIO dintr-un string de tip "IOXX"
int getGpioNum(const char *pinIdString) {
    if (strstr(pinIdString, "IO") != nullptr) {
        return atoi(pinIdString + 2);
    } else if (strstr(pinIdString, "D") != nullptr) {
        return atoi(pinIdString + 1);
    } else if (strcmp(pinIdString, "SCL") == 0) {
        return 22;
    } else if (strcmp(pinIdString, "SDA") == 0) {
        return 21;
    } else if (strcmp(pinIdString, "RX0") == 0) {
        return 3;
    } else if (strcmp(pinIdString, "TX0") == 0) {
        return 1;
    }
    return -1;
}

// Funcție de resetare a tuturor pinilor configurabili
void resetAllPins() {
    Serial.println("Resetting all configurable pins to default state...");
    const int configurablePins[] = {
        1, 2, 3, 4, 5, 12, 13, 14, 15, 16, 17, 18, 19, 21, 22, 23, 25, 26, 27, 32, 33, 34, 35, 36, 39
    };
    const int numPins = sizeof(configurablePins) / sizeof(configurablePins[0]);
    for (int i = 0; i < numPins; i++) {
        int pin_num = configurablePins[i];
        if (pinConfigurations[pin_num].function == PIN_PWM) {
            ledc_stop(LEDC_MODE, (ledc_channel_t)pinConfigurations[pin_num].ledcChannel, 0);
        }
        pinMode(pin_num, INPUT);
        pinConfigurations[pin_num].function = PIN_NONE;
        pinConfigurations[pin_num].ledcChannel = -1;
    }
    ledcChannelCount = 0;
    Serial.println("All configurable pins have been reset.");
}

// Funcție de gestionare a evenimentelor WebSocket
void onWsEvent(AsyncWebSocket *server, AsyncWebSocketClient *client, AwsEventType type, void *arg, uint8_t *data, size_t len) {
    if (type == WS_EVT_CONNECT) {
        Serial.printf("WebSocket client #%u connected from %s\n", client->id(), client->remoteIP().toString().c_str());
    } else if (type == WS_EVT_DISCONNECT) {
        Serial.printf("WebSocket client #%u disconnected\n", client->id());
    } else if (type == WS_EVT_DATA) {
        StaticJsonDocument<512> doc;
        DeserializationError error = deserializeJson(doc, data, len);

        if (error) {
            Serial.print(F("deserializeJson() failed: "));
            Serial.println(error.f_str());
            return;
        }

        const char *command = doc["command"];

        if (strcmp(command, "configurePin") == 0) {
            const char *pinIdStr = doc["pinId"];
            if (pinIdStr == nullptr) {
                Serial.println("Missing pinId in JSON data for configurePin.");
                return;
            }
            int gpio_num = getGpioNum(pinIdStr);
            if (gpio_num == -1 || gpio_num >= 40) {
                Serial.println("Invalid pinId format or not a configurable pin.");
                return;
            }

            const char *function = doc["function"];

            if (strstr(function, "GPIO") != nullptr || strstr(function, "IO") != nullptr) {
                const char *pinType = doc["type"];
                if (strcmp(pinType, "Output") == 0) {
                    pinMode(gpio_num, OUTPUT);
                    int value = doc["value"] | 0;
                    digitalWrite(gpio_num, value);
                    pinConfigurations[gpio_num].function = PIN_GPIO_OUT;
                    Serial.printf("Configured GPIO %d as OUTPUT, initial state %d\n", gpio_num, value);
                } else if (strcmp(pinType, "Input") == 0) {
                    pinMode(gpio_num, INPUT);
                    pinConfigurations[gpio_num].function = PIN_GPIO_IN;
                    Serial.printf("Configured GPIO %d as INPUT\n", gpio_num);
                }
            } else if (strstr(function, "PWM") != nullptr) {
                long freq = doc["freq"] | 1000;
                int duty = doc["duty"] | 50;
                int phase = doc["phase"] | 0;

                int ledcChannel = pinConfigurations[gpio_num].ledcChannel;
                if (ledcChannel == -1) {
                    if (ledcChannelCount >= 16) {
                        Serial.println("Nu mai sunt canale LEDC disponibile.");
                        return;
                    }
                    ledcChannel = ledcChannelCount++;
                    
                    // Configurare Canal LEDC
                    ledc_channel_config_t ledc_channel = {
                        .gpio_num       = gpio_num,
                        .speed_mode     = LEDC_MODE,
                        .channel        = (ledc_channel_t)ledcChannel,
                        .intr_type      = LEDC_INTR_DISABLE,
                        .timer_sel      = LEDC_TIMER,
                        .duty           = 0,
                        .hpoint         = 0
                    };
                    ESP_ERROR_CHECK(ledc_channel_config(&ledc_channel));
                    pinConfigurations[gpio_num].ledcChannel = ledcChannel;
                    pinConfigurations[gpio_num].function = PIN_PWM;
                    Serial.printf("Configured GPIO %d as PWM on channel %d\n", gpio_num, ledcChannel);
                }

                // Actualizare frecvență, duty cycle și fază
                ESP_ERROR_CHECK(ledc_set_freq(LEDC_MODE, LEDC_TIMER, freq));
                int duty_value = map(duty, 0, 100, 0, MAX_DUTY_VALUE);
                ESP_ERROR_CHECK(ledc_set_duty(LEDC_MODE, (ledc_channel_t)ledcChannel, duty_value));
                ESP_ERROR_CHECK(ledc_update_duty(LEDC_MODE, (ledc_channel_t)ledcChannel));

                Serial.printf("Updated PWM on GPIO %d. Freq: %ld Hz, Duty: %d%%, Phase: %d deg\n", gpio_num, freq, duty, phase);

            } else if (strstr(function, "ADC") != nullptr) {
                pinConfigurations[gpio_num].function = PIN_ADC;
                Serial.printf("Configured GPIO %d as ADC\n", gpio_num);
            }
        } else if (strcmp(command, "setPinState") == 0) {
            const char *pinIdStr = doc["pinId"];
            if (pinIdStr == nullptr) {
                Serial.println("Missing pinId in JSON data for setPinState.");
                return;
            }
            int gpio_num = getGpioNum(pinIdStr);
            if (gpio_num == -1 || gpio_num >= 40 || pinConfigurations[gpio_num].function != PIN_GPIO_OUT) {
                Serial.println("Invalid pinId or pin not configured as OUTPUT.");
                return;
            }

            int newState = doc["value"];
            digitalWrite(gpio_num, newState);
            Serial.printf("Set GPIO %d to %d\n", gpio_num, newState);

        } else if (strcmp(command, "resetPins") == 0) {
            resetAllPins();
        }
    }
}

// Inițializare server web
void initWebServer() {
    Serial.begin(115200);
    WiFi.begin(ssid, password);
    delay(2000);

    while (WiFi.status() != WL_CONNECTED) {
        delay(1000);
        Serial.print(".");
    }

    Serial.println("\nWiFi connected.");
    Serial.print("IP address: ");
    Serial.println(WiFi.localIP());

    if (!LittleFS.begin(true)) {
        Serial.println("LittleFS Mount Failed!");
        return;
    } else {
        Serial.println("LittleFS Mounted Successfully.");
    }

    ws.onEvent(onWsEvent);
    server.addHandler(&ws);

    server.serveStatic("/", LittleFS, "/");

    server.on("/", HTTP_GET, [](AsyncWebServerRequest *request) {
        request->send(LittleFS, "/index.html", "text/html");
    });

    server.onNotFound([](AsyncWebServerRequest *request) {
        request->send(404, "text/plain", "Not found");
    });

    server.begin();
    Serial.println("Server started.");
}

void setup() {
    // Initializare array de configurații
    for (int i = 0; i < 40; i++) {
        pinConfigurations[i].function = PIN_NONE;
        pinConfigurations[i].ledcChannel = -1;
    }
    
    // Configurare Timer LEDC O SINGURĂ DATĂ
    ledc_timer_config_t ledc_timer;
    ledc_timer.speed_mode = LEDC_MODE;
    ledc_timer.timer_num = LEDC_TIMER;
    ledc_timer.duty_resolution = LEDC_DUTY_RES;
    ledc_timer.freq_hz = 5000;
    ledc_timer.clk_cfg = LEDC_AUTO_CLK;

    ESP_ERROR_CHECK(ledc_timer_config(&ledc_timer));

    initWebServer();
}

void loop() {
    ws.cleanupClients();
}