#include <WiFi.h>
#include <LittleFS.h>
#include <AsyncTCP.h>
#include <ESPAsyncWebServer.h>
#include <ArduinoJson.h>

// Detalii rețea Wi-Fi (configurat ca Access Point)
const char *ssid = "ESPu-lu-Pitt";
const char *password = "12345678";

// Obiecte pentru serverul web și WebSocket
AsyncWebServer server(80);
AsyncWebSocket ws("/ws");

// Structură pentru a stoca configurațiile pinilor
struct PinConfig {
    String function;
    String type;
    int value; // folosit pentru GPIO Output
    int duty;  // folosit pentru PWM
};

// Array pentru a stoca configurațiile pinilor.
PinConfig pinConfigurations[40];

// Funcție ajutătoare pentru a extrage numărul GPIO dintr-un string de tip "IOXX"
int getGpioNum(const char* pinIdString) {
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

// Funcția de gestionare a evenimentelor WebSocket
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

        const char* command = doc["command"];
        const char* pinIdStr = doc["pinId"];

        if (pinIdStr == nullptr) {
            Serial.println("Missing pinId in JSON data.");
            return;
        }

        int gpio_num = getGpioNum(pinIdStr);
        if (gpio_num == -1 || gpio_num >= 40) {
            Serial.println("Invalid pinId format or not a configurable pin.");
            return;
        }

        Serial.printf("Received command: %s for pin %s (GPIO %d)\n", command, pinIdStr, gpio_num);

        if (strcmp(command, "configurePin") == 0) {
            const char* function = doc["function"];
            
            if (strstr(function, "GPIO") != nullptr || strstr(function, "IO") != nullptr) {
                const char* pinType = doc["type"];
                if (strcmp(pinType, "Output") == 0) {
                    pinMode(gpio_num, OUTPUT);
                    int value = doc["value"] | 0;
                    digitalWrite(gpio_num, value);
                    Serial.printf("Configured GPIO %d as OUTPUT, initial state %d\n", gpio_num, value);
                } else if (strcmp(pinType, "Input") == 0) {
                    pinMode(gpio_num, INPUT);
                    Serial.printf("Configured GPIO %d as INPUT\n", gpio_num);
                }
            } else if (strstr(function, "PWM") != nullptr) {
                int duty = doc["duty"] | 50;
                
                // Configurare PWM simplificată folosind analogWrite
                analogWrite(gpio_num, map(duty, 0, 100, 0, 255));

                Serial.printf("Configured GPIO %d as PWM. Duty: %d%%\n", gpio_num, duty);
            } else if (strstr(function, "ADC") != nullptr) {
                Serial.printf("Configured GPIO %d as ADC\n", gpio_num);
            }
        } else if (strcmp(command, "setPinState") == 0) {
            int newState = doc["value"];
            digitalWrite(gpio_num, newState);
            Serial.printf("Set GPIO %d to %d\n", gpio_num, newState);
        }
    }
}

// Inițializare server web
void initWebServer() {
    Serial.begin(115200);

    WiFi.softAP(ssid, password);
    delay(2000);
    Serial.print("Access Point IP: ");
    Serial.println(WiFi.softAPIP());

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
    initWebServer();
}

void loop() {
    ws.cleanupClients();
}