/*
 * AcessaIA – Pulseira de feedback tátil (ESP32)
 * Recebe padrões de vibração do site pela USB (Web Serial) e aciona um motor de vibração.
 *
 * Comando recebido (uma linha):  VIB:80,60,80
 *   -> vibra 80 ms, pausa 60 ms, vibra 80 ms
 *
 * Ligações:
 *   Motor de vibração (moeda 3V, tipo celular) -> transistor NPN 2N2222 (ou módulo de vibração)
 *   GPIO 25 --[resistor 1kΩ]--> base do transistor
 *   Coletor -> negativo do motor | Positivo do motor -> 3V3 | Emissor -> GND
 *   Diodo 1N4148 em paralelo com o motor (proteção)
 *   LED de estado no GPIO 2 (LED interno da placa)
 *
 * Simulação sem hardware: https://wokwi.com (troque o motor por um LED no GPIO 25)
 */

const int PINO_MOTOR = 25;
const int PINO_LED = 2;
const int INTENSIDADE = 200;  // 0–255 (PWM). Ajuste conforme o conforto do usuário.

String buffer = "";

void setup() {
  Serial.begin(115200);
  pinMode(PINO_LED, OUTPUT);
  ledcAttach(PINO_MOTOR, 5000, 8);  // ESP32 core 3.x: PWM de 5 kHz, 8 bits
  // Para core 2.x use: ledcSetup(0, 5000, 8); ledcAttachPin(PINO_MOTOR, 0);
  Serial.println("AcessaIA pulseira pronta");
  vibrarPadrao("100,80,100");  // sinal de pronto
}

void loop() {
  while (Serial.available()) {
    char c = Serial.read();
    if (c == '\n') {
      buffer.trim();
      if (buffer.startsWith("VIB:")) {
        vibrarPadrao(buffer.substring(4));
        Serial.println("OK");
      }
      buffer = "";
    } else if (buffer.length() < 64) {
      buffer += c;
    }
  }
}

// Percorre a lista "on,off,on,off..." alternando motor ligado/desligado
void vibrarPadrao(String padrao) {
  bool ligado = true;
  int inicio = 0;
  while (inicio < (int)padrao.length()) {
    int virgula = padrao.indexOf(',', inicio);
    if (virgula == -1) virgula = padrao.length();
    int ms = constrain(padrao.substring(inicio, virgula).toInt(), 0, 1000);
    ledcWrite(PINO_MOTOR, ligado ? INTENSIDADE : 0);
    digitalWrite(PINO_LED, ligado ? HIGH : LOW);
    delay(ms);
    ligado = !ligado;
    inicio = virgula + 1;
  }
  ledcWrite(PINO_MOTOR, 0);
  digitalWrite(PINO_LED, LOW);
}
