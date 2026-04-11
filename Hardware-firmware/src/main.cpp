// ESP8266 - NodeMCU 1.0 Firmware for Voice Controlled Pic & Place Robot.
#include <Arduino.h>
#include <ESP8266WiFi.h>
#include <Servo.h>
#include <WebSocketsClient.h>
#include <ArduinoJson.h>

// Motor Driver Pins (Using L298N module)
const int ENA = D1; // Motor A PWM control (GPIO5)
const int IN1 = D2; // Motor A Direction (GPIO4)
const int IN2 = D3; // Motor A Direction (GPIO0)
const int IN3 = D5; // Motor B Direction (GPIO14)
const int IN4 = D6; // Motor B Direction (GPIO12)
const int ENB = D7; // Motor B PWM control (GPIO13)

// Servo Pins
const int servoPin1 = D8; // Gripper Servo (GPIO15)
const int servoPin2 = D4; // Elbow Servo (GPIO2)

// WiFi credentials
const char *SSID = "WiFi SSID";
const char *PASSWORD = "WiFi PASSWORD";

// Server credentials (Websockets)
const char *ws_host = "serverurl.com"; // server address.
const uint16_t ws_port = 443;          // https (secured ssl) websocket port.
const char *ws_path = "/";             // "/" default path (mainly).
const char *auth_token = "xxxx";       // Auth token configured on express app.
uint8_t fingerprint[20] = {            // SHA-256 Server fingerprint eg: {0x11, 0x22, 0x33.......}
    0x00, 0x00, 0x00, 0x00, 0x00,
    0x00, 0x00, 0x00, 0x00, 0x00,
    0x00, 0x00, 0x00, 0x00, 0x00,
    0x00, 0x00, 0x00, 0x00, 0x00};

WebSocketsClient webSocket;
WiFiClientSecure client;
JsonDocument jsonDoc;

Servo servo1;
Servo servo2;

// Class for servo driver functions
class RoboArm
{
public:
  // Gripper control method
  void driveGripper(int sliderValue = 0)
  { // servo angle 0 = open and 80 = closed. (Clamped to 75)
    Serial.print("Gripper Angle\t");
    Serial.println(sliderValue);
    servo1.write(sliderValue);
  }
  void driveElbow(int sliderValue = 0)
  {
    // Configured calculation logic so that when slider = 0, servo = 45°;
    int computedAngle = (sliderValue * 131) / 135 + 45; // 0 -> 45, 135 -> 45+131=176
    Serial.print("Elbow Angle\t");
    Serial.println(computedAngle);
    servo2.write(computedAngle);
  }
};

// Class for motor driver functions
class MotorDriver
{
private:
  int motorSpeed = 50; // initial motorSpeed (50%) will be set via the web slider.

public:
  void moveForward()
  {
    Serial.println("Move Forward!");
    digitalWrite(IN1, HIGH);
    digitalWrite(IN2, LOW);
    digitalWrite(IN3, HIGH);
    digitalWrite(IN4, LOW);
  }

  void moveBackward()
  {
    Serial.println("Move Back!");
    digitalWrite(IN1, LOW);
    digitalWrite(IN2, HIGH);
    digitalWrite(IN3, LOW);
    digitalWrite(IN4, HIGH);
  }

  void moveLeft()
  {
    Serial.println("Move Left!");
    digitalWrite(IN1, HIGH);
    digitalWrite(IN2, LOW);
    digitalWrite(IN3, LOW);
    digitalWrite(IN4, HIGH);
  }

  void moveRight()
  {
    Serial.println("Move Right!");
    digitalWrite(IN1, LOW);
    digitalWrite(IN2, HIGH);
    digitalWrite(IN3, HIGH);
    digitalWrite(IN4, LOW);
  }

  void stopBotMotion()
  {
    Serial.println("Stop!");
    digitalWrite(IN1, LOW);
    digitalWrite(IN2, LOW);
    digitalWrite(IN3, LOW);
    digitalWrite(IN4, LOW);
  }

  void setMotorSpeed(int speed = 255)
  {
    motorSpeed = speed;
    int speedPWM = map(motorSpeed, 0, 100, 0, 255);

    Serial.print("speed: ");
    Serial.print(motorSpeed);
    Serial.print("\t=>\t");
    Serial.println(speedPWM);

    analogWrite(ENA, speedPWM);
    analogWrite(ENB, speedPWM);
  }
};

MotorDriver motor;
RoboArm roboArm;
void processReq(char *cmd)
{
  DeserializationError error = deserializeJson(jsonDoc, cmd);
  if (error) // Json Validation Check!
  {
    Serial.print("Deserialization failed: ");
    Serial.println(error.c_str());
    return;
  }

  const char *alias = jsonDoc["alias"] | "";
  if (strcmp(alias, "") == 0)
  {
    return;
  }

  if (strcmp(alias, "servo") != 0)
  {
    const char *value = jsonDoc["cmd"] | "";
    if (strcmp(alias, "direction") == 0)
    {
      if (strcmp(value, "1") == 0)
        motor.moveForward();
      else if (strcmp(value, "-1") == 0)
        motor.moveBackward();
      else if (strcmp(value, "2") == 0)
        motor.moveRight();
      else if (strcmp(value, "-2") == 0)
        motor.moveLeft();
      else
        motor.stopBotMotion();
    }
    else if (strcmp(alias, "speed") == 0)
    {
      int speedRange = atoi(value);
      motor.setMotorSpeed(speedRange);
    }
  }
  else if (strcmp(alias, "servo") == 0)
  {
    JsonObject cmd_Obj = jsonDoc["cmd"].as<JsonObject>();
    const char *servoID = cmd_Obj["servo"] | "";
    const char *angle = cmd_Obj["angle"] | "";
    if (strcmp(servoID, "") == 0 || strcmp(angle, "") == 0)
    {
      return;
    }

    Serial.print(servoID);
    Serial.print("\t=>\t");
    Serial.println(angle);

    int servoAngle = atoi(angle);

    if (strcmp(servoID, "1"))
      roboArm.driveGripper(servoAngle);
    else if (strcmp(servoID, "2"))
      roboArm.driveElbow(servoAngle);
  }
}

void webSocketEvent(WStype_t type, uint8_t *payload, size_t length)
{
  switch (type)
  {
  case WStype_DISCONNECTED:
    Serial.println("[WS] Disconnected");
    digitalWrite(LED_BUILTIN, HIGH);
    motor.stopBotMotion();
    break;

  case WStype_CONNECTED:
    digitalWrite(LED_BUILTIN, LOW);
    Serial.println("[WS] Connected to server");

    // Send initial message
    webSocket.sendTXT("ESP8266 connected");
    break;

  case WStype_TEXT:
    Serial.println("[WS] Received Data!");
    processReq((char *)payload);
    break;

  case WStype_ERROR:
    Serial.println("[WS] Error");
    digitalWrite(LED_BUILTIN, HIGH);
    motor.stopBotMotion();
    break;

  default:
    break;
  }
}

void setup()
{
  Serial.begin(115200); // debug serial (USB)
  pinMode(LED_BUILTIN, OUTPUT);
  digitalWrite(LED_BUILTIN, HIGH); // Active-low (setting default off)

  // Motor Driver pins as outputs.
  pinMode(ENA, OUTPUT);
  pinMode(IN1, OUTPUT);
  pinMode(IN2, OUTPUT);
  pinMode(IN3, OUTPUT);
  pinMode(IN4, OUTPUT);
  pinMode(ENB, OUTPUT);

  // Initialize servos.
  servo1.attach(servoPin1);
  servo2.attach(servoPin2, 500, 2500); // Elbow servo custom pulse width range

  WiFi.mode(WIFI_STA);
  WiFi.hostname("PIC_&_PLACE_BOT");
  WiFi.begin(SSID, PASSWORD);
  Serial.println("\n Connecting to WiFi...");
  while (WiFi.status() != WL_CONNECTED)
  {
    digitalWrite(LED_BUILTIN, LOW);
    delay(100);
    digitalWrite(LED_BUILTIN, HIGH);
    delay(100);
  }
  digitalWrite(LED_BUILTIN, LOW);
  Serial.println("Connected to WiFi");

  char headerBuff[64];
  snprintf(headerBuff, sizeof(headerBuff), "x-device-token: %s", auth_token);
  webSocket.setExtraHeaders(headerBuff); // Auth token (Hard-coded for dev test only!, use token = hash(MAC + secret) instead for simplicity and security for prod!)

  // Start websocket connection...
  webSocket.beginSSL(ws_host, ws_port, ws_path, fingerprint);
  webSocket.onEvent(webSocketEvent);
  // Retry reconnect every 5 seconds on error
  webSocket.setReconnectInterval(5000);
  webSocket.enableHeartbeat(15000, 3000, 2); // Ping to prevent idle timeout
}

void loop()
{
  webSocket.loop();
  if (WiFi.status() == WL_DISCONNECTED)
  {
    digitalWrite(LED_BUILTIN, HIGH);
    motor.stopBotMotion();
    WiFi.reconnect();
  }
}
