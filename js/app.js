/* AcessaIA – página principal
 * 1. Carrega o conteúdo dinamicamente de data/conteudo.json
 * 2. Reconhecimento de voz (Web Speech API) para comandos
 * 3. Descrição de imagens com IA (MobileNet / TensorFlow.js)
 * 4. Conexão com a pulseira ESP32 (Web Serial)
 */
let CONTEUDO = null;
let modeloIA = null;

/* ================= 1. CARREGAMENTO DINÂMICO (JSON) ================= */
async function carregarConteudo() {
  try {
    const resp = await fetch('data/conteudo.json');
    if (!resp.ok) throw new Error(resp.status);
    CONTEUDO = await resp.json();
    renderizar(CONTEUDO);
  } catch (e) {
    document.getElementById('secoesDinamicas').innerHTML =
      `<p class="aviso">Não foi possível carregar o conteúdo (data/conteudo.json). Abra o site por um servidor (GitHub Pages ou Live Server), e não com duplo clique no arquivo.</p>`;
    console.error(e);
  }
}

function renderizar(c) {
  document.getElementById('titulo').textContent = c.titulo;
  document.getElementById('subtitulo').textContent = c.subtitulo;
  document.title = `${c.titulo} – ${c.subtitulo}`;

  const alvo = document.getElementById('secoesDinamicas');
  alvo.innerHTML = '';
  c.secoes.forEach(s => {
    const sec = document.createElement('section');
    sec.id = s.id;
    sec.setAttribute('aria-labelledby', `t-${s.id}`);
    let html = `<h2 id="t-${s.id}">${s.titulo}</h2>`;
    if (s.texto) html += `<p>${s.texto}</p>`;
    if (s.itens) {
      html += `<div class="grade">` + s.itens.map(i => `
        <article class="cartao">
          <div class="icone" aria-hidden="true">${i.icone}</div>
          <h3>${i.nome}</h3>
          <p>${i.descricao}</p>
          <p class="barreira"><strong>Barreira atendida:</strong> ${i.barreira}</p>
        </article>`).join('') + `</div>`;
    }
    sec.innerHTML = html;
    alvo.appendChild(sec);
  });

  document.getElementById('listaComandos').innerHTML =
    c.comandosVoz.map(cmd => `<li>“${cmd.frase}”</li>`).join('');
  document.getElementById('odsNumero').textContent = c.ods.numero;
  document.getElementById('odsNome').textContent = `ODS ${c.ods.numero} – ${c.ods.nome}`;
  document.getElementById('odsMeta').textContent = c.ods.meta;
}

/* ================= 2. COMANDO DE VOZ ================= */
const Reconhecimento = window.SpeechRecognition || window.webkitSpeechRecognition;
let rec = null, ouvindo = false;

function statusVoz(msg) { document.getElementById('statusVoz').textContent = msg; }

function alternarVoz() {
  const btn = document.getElementById('btnVoz');
  if (!Reconhecimento) {
    statusVoz('Seu navegador não suporta reconhecimento de voz. Use o Chrome ou o Edge.');
    Acess.vibrar('erro'); return;
  }
  if (ouvindo) { ouvindo = false; rec.stop(); btn.setAttribute('aria-pressed', 'false'); statusVoz('Comando de voz desligado.'); return; }

  rec = new Reconhecimento();
  rec.lang = 'pt-BR'; rec.continuous = true; rec.interimResults = false;
  rec.onresult = ev => {
    const fala = ev.results[ev.results.length - 1][0].transcript.toLowerCase().trim();
    executarComando(fala);
  };
  rec.onerror = ev => statusVoz(`Erro no microfone: ${ev.error}. Verifique a permissão do navegador.`);
  rec.onend = () => { if (ouvindo) rec.start(); }; // mantém escutando
  rec.start();
  ouvindo = true; btn.setAttribute('aria-pressed', 'true');
  statusVoz('🎙️ Ouvindo… diga um comando, por exemplo “ler página”.');
  Acess.vibrar('ouvindo');
}

// Normaliza acentos para tolerar variações do reconhecimento ("padrao" x "padrão")
const norm = s => s.normalize('NFD').replace(/[̀-ͯ]/g, '');

function executarComando(fala) {
  const cmd = CONTEUDO?.comandosVoz.find(c => norm(fala).includes(norm(c.frase)));
  if (!cmd) { statusVoz(`Não entendi: “${fala}”. Diga “ajuda” para ouvir os comandos.`); Acess.vibrar('erro'); return; }
  statusVoz(`✅ Comando reconhecido: “${cmd.frase}”`);
  Acess.vibrar('confirmacao');
  ACOES[cmd.acao]?.();
}

const ACOES = {
  lerPagina: () => Acess.falar(document.getElementById('conteudo').innerText),
  pararLeitura: () => Acess.parar(),
  temaContraste: () => { Acess.tema('contraste'); Acess.falar('Alto contraste ativado'); },
  temaAmarelo: () => { Acess.tema('amarelo'); Acess.falar('Tema amarelo ativado'); },
  temaPadrao: () => { Acess.tema('padrao'); Acess.falar('Tema padrão ativado'); },
  aumentarFonte: () => { const e = Acess.escala(0.15); Acess.falar(`Texto em ${Math.round(e * 100)} por cento`); },
  diminuirFonte: () => { const e = Acess.escala(-0.15); Acess.falar(`Texto em ${Math.round(e * 100)} por cento`); },
  descreverImagem: () => descreverImagem(),
  irDashboard: () => { location.href = 'dashboard.html'; },
  ajuda: () => Acess.falar('Comandos disponíveis: ' + CONTEUDO.comandosVoz.map(c => c.frase).join(', ')),
};

/* ================= 3. DESCRIÇÃO DE IMAGEM COM IA ================= */
async function descreverImagem() {
  const saida = document.getElementById('saidaIA');
  const img = document.getElementById('imgIA');
  try {
    if (!modeloIA) {
      saida.textContent = '⏳ Carregando o modelo de IA (cerca de 16 MB, só na primeira vez)…';
      modeloIA = await mobilenet.load({ version: 2, alpha: 1.0 });
    }
    saida.textContent = '🔍 Analisando a imagem…';
    const preds = await modeloIA.classify(img, 3);
    const trad = CONTEUDO?.traducoesIA || {};
    // Procura a tradução em todos os sinônimos que a MobileNet devolve ("tabby, tabby cat")
    const nome = p => {
      const sinonimos = p.className.split(',').map(s => s.trim());
      const achado = sinonimos.find(s => trad[s]);
      return achado ? trad[achado] : `${sinonimos[0]} (termo em inglês)`;
    };

    const principal = preds[0];
    const conf = Math.round(principal.probability * 100);
    let texto;
    if (conf < 20) {
      // IA responsável: abaixo de 20% de confiança, não afirma nada para não enganar quem não enxerga a imagem
      texto = `Não consegui reconhecer o conteúdo desta imagem com segurança. A imagem pode estar escura, desfocada ou mostrar algo fora do que o modelo conhece. Confiança máxima de ${conf} por cento.`;
      img.alt = 'Imagem não identificada pela IA';
    } else {
      const certeza = conf >= 60 ? 'Provavelmente é' : conf >= 35 ? 'Pode ser' : 'Não tenho certeza, mas parece';
      texto = `${certeza} ${nome(principal)}. Confiança de ${conf} por cento.`;
      img.alt = `Imagem descrita pela IA: ${nome(principal)}`; // gera texto alternativo automaticamente
    }

    saida.textContent = texto;
    document.getElementById('listaProb').innerHTML = preds.map(p => {
      const pc = Math.round(p.probability * 100);
      return `<li><span>${nome(p)}</span><span class="barra-prob" aria-hidden="true"><span style="width:${pc}%"></span></span><span>${pc}%</span></li>`;
    }).join('');
    Acess.falar(texto);
    Acess.vibrar('confirmacao');
  } catch (e) {
    saida.textContent = 'Não foi possível descrever a imagem. Verifique a conexão com a internet (o modelo é baixado na primeira vez).';
    Acess.vibrar('erro'); console.error(e);
  }
}

document.getElementById('arquivoIA').addEventListener('change', ev => {
  const arq = ev.target.files[0]; if (!arq) return;
  const img = document.getElementById('imgIA');
  img.onload = () => descreverImagem();
  img.src = URL.createObjectURL(arq);
});

/* ================= 4. IoT – ESP32 ================= */
document.getElementById('btnESP').addEventListener('click', async () => {
  const st = document.getElementById('statusIoT');
  try { await Acess.conectarESP(); st.textContent = '✅ Pulseira ESP32 conectada. As confirmações agora vibram na pulseira.'; }
  catch (e) { st.textContent = `Não conectado: ${e.message}`; }
});
document.getElementById('btnTesteVib').addEventListener('click', () => {
  Acess.vibrar('confirmacao');
  document.getElementById('statusIoT').textContent = navigator.vibrate ? 'Vibração enviada.' : 'Este aparelho não vibra pelo navegador (computadores e iPhone). Conecte a pulseira ESP32.';
});

/* ================= EVENTOS GERAIS ================= */
document.getElementById('btnVoz').addEventListener('click', alternarVoz);
document.getElementById('btnLer').addEventListener('click', () => ACOES.lerPagina());
document.getElementById('btnDescrever').addEventListener('click', descreverImagem);
document.addEventListener('keydown', e => {
  if (e.altKey && e.key.toLowerCase() === 'v') { e.preventDefault(); alternarVoz(); }
  if (e.key === 'Escape') Acess.parar();
});

carregarConteudo();
