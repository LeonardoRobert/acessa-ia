# AcessaIA – Interfaces Gráficas Acessíveis com Apoio da IA

Projeto Integrador VI – Computação Gráfica · UNIG EAD · Projeto de Extensão
Profª Denise Moraes · ODS 10 – Redução das Desigualdades (Meta 10.2)

Protótipo de portal web que **adapta a interface** às necessidades de pessoas com deficiência, a partir de uma **pesquisa de campo** sobre as barreiras que elas encontram em sites e aplicativos.

**Demonstração:** `https://SEU-USUARIO.github.io/acessa-ia/` *(ative o GitHub Pages)*

---

## Recursos

| Recurso | Tecnologia | Barreira atendida |
|---|---|---|
| Comando de voz | Web Speech API (SpeechRecognition, pt-BR) | Não dá para navegar por voz ou teclado |
| Leitura em voz alta | Web Speech API (SpeechSynthesis) | Baixa visão, dificuldade de leitura |
| Descrição de imagens por IA | TensorFlow.js + MobileNet v2, rodando no navegador | Imagens sem descrição (gera o `alt` automaticamente) |
| Temas de alto contraste | Variáveis CSS (padrão, alto contraste, amarelo/preto) | Baixo contraste |
| Ajuste de fonte e leitura fácil | Escala de `rem` + espaçamento de linha/letra | Letras pequenas, dislexia |
| Feedback tátil | Vibration API + ESP32 via Web Serial | Confirmação de ações sem depender da tela ou do som |
| Dashboard da pesquisa | Canvas 2D desenhado à mão + tabelas acessíveis | Apresentação dos dados coletados |

## Integração das disciplinas do período

- **Computação Gráfica:** gráficos desenhados manualmente em `<canvas>` (primitivas, arcos, transformação de escala por `devicePixelRatio`, padrões de hachura), temas gráficos por variáveis CSS e redesenho em tempo real quando o tema ou a fonte mudam.
- **Inteligência Artificial e IoT:** rede neural convolucional MobileNet (classificação de imagens, ImageNet) executada no cliente; reconhecimento de fala; pulseira ESP32 com motor de vibração.
- **Sistemas Embarcados:** firmware em `esp32/pulseira_tatil.ino` com protocolo serial `VIB:on,off,on…` e controle PWM do motor.
- **Banco de Dados / BI:** dados da pesquisa normalizados em JSON (`data/pesquisa.json`), ETL do CSV do Google Forms (`tools/csv_para_json.py`) e agregações no dashboard.
- **Interação Humano-Computador:** WCAG 2.1. Alvos de toque ≥ 44 px, foco visível, link "pular para o conteúdo", `aria-live`, `aria-pressed`, alternativas textuais para gráficos e preferências salvas.

## Estrutura

```
acessa-ia/
├── index.html              # portal acessível
├── dashboard.html          # resultados da pesquisa
├── css/style.css           # temas e escalas
├── js/acessibilidade.js    # tema, fonte, TTS, vibração, ESP32 (compartilhado)
├── js/app.js               # carga do JSON, voz, IA, IoT
├── js/dashboard.js         # motor gráfico em canvas
├── data/conteudo.json      # conteúdo do site (carregado dinamicamente)
├── data/pesquisa.json      # respostas reais da pesquisa (anônimas)
├── data/pesquisa-exemplo.json  # DADOS FICTÍCIOS, apenas para teste
├── esp32/pulseira_tatil.ino
└── tools/csv_para_json.py  # Google Forms CSV -> pesquisa.json
```

## Como executar

O site lê arquivos JSON com `fetch`, então **precisa ser aberto por um servidor** (abrir com duplo clique não funciona):

- **GitHub Pages:** Settings › Pages › Branch `main` / root.
- **VS Code:** extensão *Live Server* › "Open with Live Server".
- **Python:** `python -m http.server` na pasta e abra `http://localhost:8000`.

Use o **Chrome ou o Edge** (comando de voz e Web Serial).

### Atualizar o dashboard com as respostas reais

1. Google Forms › Respostas › Planilhas › Arquivo › Download › CSV.
2. `python tools/csv_para_json.py respostas.csv`
3. Faça commit de `data/pesquisa.json`. O dashboard é atualizado sozinho.

Respostas sem consentimento no TCLE são descartadas automaticamente, e nenhum nome ou e-mail é gravado.

### Pulseira ESP32 (opcional)

Componentes: ESP32 DevKit, motor de vibração 3 V, transistor 2N2222, resistor 1 kΩ, diodo 1N4148. O esquema de ligação está no cabeçalho do `.ino`. Sem o hardware, dá para simular no [Wokwi](https://wokwi.com) usando um LED no GPIO 25. No site, clique em **Conectar pulseira ESP32**.

## Limitações e próximos passos

- A MobileNet reconhece objetos (1000 classes), mas não gera frases completas. Uma evolução seria um modelo de legenda de imagem (image captioning) ou uma API de visão.
- Os nomes dos objetos são traduzidos para português por um dicionário em `conteudo.json`, que pode ser ampliado.
- No iPhone, o navegador não permite vibração pela web.
- Os próximos passos são testar com leitores de tela (NVDA e TalkBack) e validar com uma instituição parceira.

## Ética

A pesquisa seguiu o TCLE do projeto: participação voluntária, anonimato e uso exclusivamente acadêmico.
