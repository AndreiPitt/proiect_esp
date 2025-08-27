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

// Funcție ajutătoare pentru a extrage numărul GPIO dintr-un string de tip "IOXX"
int getGpioNum(const char* pinIdString) {
    if (pinIdString == nullptr || strlen(pinIdString) < 3 || pinIdString[0] != 'I' || pinIdString[1] != 'O') {
        return -1; // Format invalid
    }
    // atoi va converti "22" din "IO22" la 22
    return atoi(pinIdString + 2);
}

// Funcția de gestionare a evenimentelor WebSocket
void onWsEvent(AsyncWebSocket *server, AsyncWebSocketClient *client, AwsEventType type, void *arg, uint8_t *data, size_t len) {
    if (type == WS_EVT_CONNECT) {
        Serial.printf("WebSocket client #%u connected from %s\n", client->id(), client->remoteIP().toString().c_str());
    } else if (type == WS_EVT_DISCONNECT) {
        Serial.printf("WebSocket client #%u disconnected\n", client->id());
    } else if (type == WS_EVT_DATA) {
        // Parsarea datelor JSON primite de la browser
        StaticJsonDocument<256> doc;
        DeserializationError error = deserializeJson(doc, data, len);

        if (error) {
            Serial.print(F("deserializeJson() failed: "));
            Serial.println(error.f_str());
            return;
        }

        // Extrage comanda și ID-ul pinului
        const char* command = doc["command"];
        const char* pinIdStr = doc["pinId"];

        if (pinIdStr == nullptr) {
            Serial.println("Missing pinId in JSON data.");
            return;
        }

        Serial.printf("Received command: %s for pin %s\n", command, pinIdStr);
        int gpio_num = getGpioNum(pinIdStr);
        if (gpio_num == -1) {
            Serial.println("Invalid pinId format.");
            return;
        }

        // Procesează comenzile
        if (strcmp(command, "configurePin") == 0) {
            const char* selectedFunction = doc["function"];
            if (selectedFunction == nullptr) return;

            // Logica pentru configurarea unui pin GPIO
            if (strcmp(selectedFunction, "GPIO") == 0 || strcmp(selectedFunction, "IO") == 0) {
                const char* pinType = doc["type"];
                if (pinType == nullptr) return;

                if (strcmp(pinType, "Output") == 0) {
                    pinMode(gpio_num, OUTPUT);
                    Serial.printf("Configured GPIO %d as OUTPUT\n", gpio_num);
                    
                    // Setează o valoare inițială dacă este specificată (pentru a simplifica logica)
                    if (doc.containsKey("value")) {
                        int newState = doc["value"];
                        digitalWrite(gpio_num, newState);
                        Serial.printf("Set initial state for GPIO %d to %d\n", gpio_num, newState);
                    }
                } else if (strcmp(pinType, "Input") == 0) {
                    pinMode(gpio_num, INPUT);
                    Serial.printf("Configured GPIO %d as INPUT\n", gpio_num);
                }
            }
            // Aici poți adăuga logica pentru PWM, ADC etc.
        } else if (strcmp(command, "setPinState") == 0) {
            // Logica pentru setarea stării unui pin deja configurat
            int newState = doc["value"]; // 0 sau 1
            digitalWrite(gpio_num, newState);
            Serial.printf("Set GPIO %d to %d\n", gpio_num, newState);
        }
    }
}

// Inițializare server web
void initWebServer() {
    Serial.begin(115200);

    // Conectare la Wi-Fi (mod Access Point)
    WiFi.softAP(ssid, password, 1);
    delay(2000);
    Serial.print("Access Point IP: ");
    Serial.println(WiFi.softAPIP());

    // Inițializare LittleFS
    if (!LittleFS.begin(true)) {
        Serial.println("LittleFS Mount Failed!");
        return;
    } else {
        Serial.println("LittleFS Mounted Successfully.");
    }
    
    // Gestionează evenimentele WebSocket
    ws.onEvent(onWsEvent);
    server.addHandler(&ws);

    // Serveste fișierele statice din LittleFS
    server.serveStatic("/", LittleFS, "/");

    // Răspunde la cererea pentru pagina de pornire (index.html)
    server.on("/", HTTP_GET, [](AsyncWebServerRequest *request) {
        request->send(LittleFS, "/index.html", "text/html");
    });
    
    // Tratare de erori 404
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