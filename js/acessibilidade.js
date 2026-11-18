/* AcessaIA – módulo compartilhado de acessibilidade
 * Temas, escala de fonte, leitura fácil, síntese de voz (TTS) e feedback tátil (vibração + ESP32).
 * Preferências salvas no navegador para que a pessoa não precise reconfigurar a cada visita.
 */
const Acess = (() => {
  const raiz = document.documentElement;
  const prefs = carregar();
  let portaSerial = null, escritor = null;

  function carregar() {
    try { return JSON.parse(localStorage.getItem('acessaia-prefs')) || {}; } catch { return {}; }
  }
  function salvar() {
    try { localStorage.setItem('acessaia-prefs', JSON.stringify(prefs)); } catch { /* modo privado */ }
  }

  /* ---------- TEMA ---------- */
  function tema(nome) {
    if (nome === 'padrao') raiz.removeAttribute('data-tema'); else raiz.setAttribute('data-tema', nome);
    document.querySelectorAll('[data-tema-btn]').forEach(b => b.setAttribute('aria-pressed', b.dataset.temaBtn === nome));
    prefs.tema = nome; salvar();
    document.dispatchEvent(new CustomEvent('tema-alterado'));
  }

  /* ---------- FONTE ---------- */
  function escala(delta) {
    const atual = prefs.escala || 1;
    const nova = Math.min(2, Math.max(0.85, +(atual + delta).toFixed(2)));
    raiz.style.setProperty('--escala', nova);
    prefs.escala = nova; salvar();
    document.dispatchEvent(new CustomEvent('tema-alterado'));
    return nova;
  }
  function leituraFacil(ativo) {
    if (ativo) raiz.setAttribute('data-leitura', 'facil'); else raiz.removeAttribute('data-leitura');
    const b = document.getElementById('leituraFacil'); if (b) b.setAttribute('aria-pressed', ativo);
    prefs.leituraFacil = ativo; salvar();
  }

  /* ---------- VOZ (TTS) ---------- */
  function falar(texto, { interromper = true } = {}) {
    if (!('speechSynthesis' in window)) return;
    if (interromper) speechSynthesis.cancel();
    // Divide em frases: evita o corte de falas longas que ocorre no Chrome
    const frases = texto.replace(/\s+/g, ' ').match(/[^.!?]+[.!?]?/g) || [texto];
    const voz = speechSynthesis.getVoices().find(v => v.lang.startsWith('pt'));
    frases.forEach((f, i) => {
      const u = new SpeechSynthesisUtterance(f.trim());
      u.lang = 'pt-BR'; u.rate = prefs.velocidade || 1; if (voz) u.voice = voz;
      // Legenda visual: cada frase aparece na tela enquanto é falada
      u.onstart = () => legenda(f.trim());
      if (i === frases.length - 1) u.onend = () => legenda(null);
      speechSynthesis.speak(u);
    });
  }
  function legenda(texto) {
    const el = document.getElementById('legendaFala'); if (!el) return;
    if (texto) { el.textContent = '🔊 ' + texto; el.hidden = false; } else { el.hidden = true; }
  }
  function parar() { if ('speechSynthesis' in window) speechSynthesis.cancel(); legenda(null); }

  /* ---------- FEEDBACK TÁTIL (IoT) ---------- */
  // Padrões em milissegundos: vibra, pausa, vibra…
  const PADROES = { ok: [80], confirmacao: [80, 60, 80], erro: [300, 100, 300], ouvindo: [40, 40, 40, 40, 40] };
  async function vibrar(tipo = 'ok') {
    const p = PADROES[tipo] || PADROES.ok;
    if (navigator.vibrate) navigator.vibrate(p);
    if (escritor) {
      try { await escritor.write(new TextEncoder().encode(`VIB:${p.join(',')}\n`)); } catch (e) { console.warn('ESP32:', e); }
    }
  }
  async function conectarESP() {
    if (!('serial' in navigator)) throw new Error('Este navegador não suporta Web Serial. Use o Chrome ou o Edge no computador.');
    portaSerial = await navigator.serial.requestPort();
    await portaSerial.open({ baudRate: 115200 });
    escritor = portaSerial.writable.getWriter();
    await vibrar('confirmacao');
  }

  /* ---------- APLICAR PREFERÊNCIAS SALVAS ---------- */
  function iniciar() {
    if (prefs.tema) tema(prefs.tema);
    if (prefs.escala) raiz.style.setProperty('--escala', prefs.escala);
    if (prefs.leituraFacil) leituraFacil(true);

    document.querySelectorAll('[data-tema-btn]').forEach(b => b.addEventListener('click', () => { tema(b.dataset.temaBtn); vibrar(); }));
    const on = (id, fn) => { const el = document.getElementById(id); if (el) el.addEventListener('click', fn); };
    on('fonteMais', () => { escala(0.15); vibrar(); });
    on('fonteMenos', () => { escala(-0.15); vibrar(); });
    on('leituraFacil', () => { leituraFacil(!prefs.leituraFacil); vibrar(); });
    on('btnParar', parar);
    if ('speechSynthesis' in window) speechSynthesis.getVoices(); // pré-carrega vozes
  }

  return { iniciar, tema, escala, leituraFacil, falar, parar, vibrar, conectarESP, prefs };
})();

document.addEventListener('DOMContentLoaded', Acess.iniciar);
