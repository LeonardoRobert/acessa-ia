/* AcessaIA – Dashboard da pesquisa de campo
 * Lê data/pesquisa.json e desenha os gráficos à mão com Canvas 2D (Computação Gráfica):
 * - escala para telas de alta densidade (devicePixelRatio)
 * - cores lidas das variáveis CSS do tema ativo, redesenho ao trocar tema/fonte/tamanho
 * - cada gráfico acompanha uma tabela equivalente para leitores de tela
 */
let DADOS = null;
const GRAFICOS = [];

async function carregar() {
  let fonte = 'data/pesquisa.json';
  let json = await (await fetch(fonte)).json();
  if (!json.respostas.length) {
    // Sem respostas reais ainda: mostra os dados de exemplo com aviso bem visível
    fonte = 'data/pesquisa-exemplo.json';
    json = await (await fetch(fonte)).json();
  }
  DADOS = json;
  if (json.meta.exemplo) {
    document.getElementById('avisoExemplo').innerHTML =
      '<p class="aviso" role="alert">⚠️ Exibindo DADOS FICTÍCIOS de teste. Substitua por data/pesquisa.json com as respostas reais (veja tools/csv_para_json.py).</p>';
  }
  document.getElementById('metaPesquisa').textContent =
    `${json.respostas.length} participantes · ${json.meta.periodo} · ${json.meta.fonte}`;
  montar(json.respostas);
}

/* ---------- Agregações ---------- */
function contar(resps, campo) {
  const c = {};
  resps.forEach(r => [].concat(r[campo] ?? []).forEach(v => { if (v !== '') c[v] = (c[v] || 0) + 1; }));
  return Object.entries(c).sort((a, b) => b[1] - a[1]);
}
function escala15(resps, campo) {
  const c = { 1: 0, 2: 0, 3: 0, 4: 0, 5: 0 };
  resps.forEach(r => { if (c[r[campo]] !== undefined) c[r[campo]]++; });
  return Object.entries(c);
}
const media = (resps, campo) => (resps.reduce((s, r) => s + (+r[campo] || 0), 0) / resps.length).toFixed(1);
const pct = (n, t) => `${Math.round((n / t) * 100)}%`;

function montar(resps) {
  const n = resps.length;
  const barreiras = contar(resps, 'barreiras');
  const celular = resps.filter(r => r.dispositivo === 'Celular').length;

  const kpis = [
    ['Participantes', n],
    ['Usam principalmente o celular', pct(celular, n)],
    ['Frequência média de barreiras (1–5)', media(resps, 'frequenciaBarreiras')],
    ['Satisfação média com acessibilidade (1–5)', media(resps, 'satisfacao')],
    ['Barreira mais citada', barreiras[0] ? barreiras[0][0] : '–'],
  ];
  document.getElementById('kpis').innerHTML = kpis.map(([nome, v]) =>
    `<div class="kpi"><div class="valor" style="${String(v).length > 8 ? 'font-size:1.15rem' : ''}">${v}</div><div class="nome">${nome}</div></div>`).join('');

  const defs = [
    { id: 'g1', titulo: 'Barreiras mais encontradas', tipo: 'barrasH', dados: barreiras, total: n },
    { id: 'g2', titulo: 'Tipo de deficiência', tipo: 'rosca', dados: contar(resps, 'deficiencia'), total: n },
    { id: 'g3', titulo: 'Recursos de IA que ajudariam', tipo: 'barrasH', dados: contar(resps, 'recursosDesejados'), total: n },
    { id: 'g4', titulo: 'Serviços mais difíceis de usar', tipo: 'barrasH', dados: contar(resps, 'servicosDificeis'), total: n },
    { id: 'g5', titulo: 'Frequência com que encontra barreiras (1 = nunca, 5 = sempre)', tipo: 'colunas', dados: escala15(resps, 'frequenciaBarreiras'), total: n },
    { id: 'g6', titulo: 'Satisfação com a acessibilidade atual (1 = péssima, 5 = ótima)', tipo: 'colunas', dados: escala15(resps, 'satisfacao'), total: n },
  ];
  const area = document.getElementById('graficos');
  area.innerHTML = defs.map(d => `
    <figure class="grafico" style="margin:0">
      <h3 id="${d.id}-t">${d.titulo}</h3>
      <canvas id="${d.id}" role="img" aria-labelledby="${d.id}-t" aria-describedby="${d.id}-d"></canvas>
      <p id="${d.id}-d" class="sr-only">${d.dados.map(([k, v]) => `${k}: ${v}`).join('; ')}</p>
      <details class="tabela-acessivel"><summary>Ver dados em tabela</summary>
        <table><thead><tr><th scope="col">Categoria</th><th scope="col">Respostas</th><th scope="col">% dos participantes</th></tr></thead>
        <tbody>${d.dados.map(([k, v]) => `<tr><td>${k}</td><td>${v}</td><td>${pct(v, d.total)}</td></tr>`).join('')}</tbody></table>
      </details>
    </figure>`).join('');
  GRAFICOS.length = 0; GRAFICOS.push(...defs);
  desenharTodos();

  const relatos = resps.filter(r => r.relato && r.relato.trim());
  document.getElementById('relatos').innerHTML = relatos.length
    ? relatos.map(r => `<blockquote>“${r.relato}”<br><small>— Participante ${r.id}, deficiência ${r.deficiencia.toLowerCase()}</small></blockquote>`).join('')
    : '<p>Nenhum relato registrado.</p>';
}

/* ---------- Motor gráfico (Canvas 2D) ---------- */
function cores() {
  const cs = getComputedStyle(document.documentElement);
  const v = n => cs.getPropertyValue(n).trim();
  const contraste = document.documentElement.hasAttribute('data-tema');
  return {
    texto: v('--texto'), grade: v('--borda'), fundo: v('--superficie'), primaria: v('--primaria'),
    // Paleta categórica distinguível por daltônicos (Okabe-Ito); nos temas de contraste usa padrões de hachura
    serie: contraste ? [v('--primaria')] : ['#0072B2', '#E69F00', '#009E73', '#CC79A7', '#56B4E9', '#D55E00', '#F0E442', '#000000'],
    contraste,
    fonte: parseFloat(cs.fontSize),
  };
}

function prepararCanvas(cv, alturaCss) {
  const dpr = window.devicePixelRatio || 1;
  const largura = cv.clientWidth;
  cv.style.height = alturaCss + 'px';
  cv.width = Math.round(largura * dpr);
  cv.height = Math.round(alturaCss * dpr);
  const ctx = cv.getContext('2d');
  ctx.setTransform(dpr, 0, 0, dpr, 0, 0); // transformação de escala: desenha em pixels CSS
  return { ctx, w: largura, h: alturaCss };
}

// Hachuras para diferenciar categorias sem depender de cor (temas de alto contraste)
function hachura(ctx, cor, i) {
  const p = document.createElement('canvas'); p.width = p.height = 10;
  const c = p.getContext('2d'); c.strokeStyle = cor; c.fillStyle = cor; c.lineWidth = 2;
  [() => c.fillRect(0, 0, 10, 10),
   () => { c.beginPath(); c.moveTo(0, 10); c.lineTo(10, 0); c.stroke(); },
   () => { c.beginPath(); c.moveTo(0, 5); c.lineTo(10, 5); c.stroke(); },
   () => { c.beginPath(); c.arc(5, 5, 2, 0, 7); c.fill(); },
   () => { c.beginPath(); c.moveTo(5, 0); c.lineTo(5, 10); c.stroke(); },
   () => { c.strokeRect(1, 1, 8, 8); }][i % 6]();
  return ctx.createPattern(p, 'repeat');
}
const preencher = (ctx, C, i) => C.contraste ? hachura(ctx, C.serie[0], i) : C.serie[i % C.serie.length];

function quebrar(ctx, txt, max) {
  const palavras = txt.split(' '); const linhas = []; let l = '';
  palavras.forEach(p => { const t = l ? l + ' ' + p : p; if (ctx.measureText(t).width > max && l) { linhas.push(l); l = p; } else l = t; });
  linhas.push(l); return linhas.slice(0, 2);
}

function barrasH(cv, dados, total, C) {
  const f = C.fonte * 0.8, linha = Math.max(34, f * 2.6);
  const { ctx, w } = prepararCanvas(cv, dados.length * linha + 10);
  ctx.font = `${f}px system-ui, sans-serif`;
  const rotulo = Math.min(w * 0.42, 220), max = Math.max(...dados.map(d => d[1]), 1);
  const areaBarra = w - rotulo - 60;
  dados.forEach(([k, v], i) => {
    const y = i * linha + 5;
    ctx.fillStyle = C.texto; ctx.textBaseline = 'middle'; ctx.textAlign = 'right';
    const ls = quebrar(ctx, k, rotulo - 10);
    ls.forEach((t, j) => ctx.fillText(t, rotulo - 8, y + linha / 2 + (j - (ls.length - 1) / 2) * f * 1.1));
    const bw = (v / max) * areaBarra;
    ctx.fillStyle = preencher(ctx, C, 0);
    ctx.beginPath(); ctx.roundRect(rotulo, y + linha * 0.2, Math.max(bw, 2), linha * 0.6, 4); ctx.fill();
    if (C.contraste) { ctx.strokeStyle = C.texto; ctx.stroke(); }
    ctx.fillStyle = C.texto; ctx.textAlign = 'left';
    ctx.fillText(`${v} (${Math.round(v / total * 100)}%)`, rotulo + bw + 6, y + linha / 2);
  });
}

function colunas(cv, dados, total, C) {
  const f = C.fonte * 0.8;
  const { ctx, w, h } = prepararCanvas(cv, 220);
  ctx.font = `${f}px system-ui, sans-serif`;
  const base = h - f * 2.2, topo = f * 1.8, max = Math.max(...dados.map(d => d[1]), 1);
  const passo = w / dados.length, larg = passo * 0.55;
  ctx.strokeStyle = C.grade; ctx.beginPath(); ctx.moveTo(0, base + 0.5); ctx.lineTo(w, base + 0.5); ctx.stroke();
  dados.forEach(([k, v], i) => {
    const x = i * passo + (passo - larg) / 2, bh = (v / max) * (base - topo);
    ctx.fillStyle = preencher(ctx, C, i);
    ctx.beginPath(); ctx.roundRect(x, base - bh, larg, bh, [4, 4, 0, 0]); ctx.fill();
    if (C.contraste) { ctx.strokeStyle = C.texto; ctx.stroke(); }
    ctx.fillStyle = C.texto; ctx.textAlign = 'center';
    ctx.textBaseline = 'bottom'; ctx.fillText(v, x + larg / 2, base - bh - 4);
    ctx.textBaseline = 'top'; ctx.fillText(k, x + larg / 2, base + 6);
  });
}

function rosca(cv, dados, total, C) {
  const f = C.fonte * 0.8;
  const altura = Math.max(220, dados.length * f * 2 + 20);
  const { ctx, w, h } = prepararCanvas(cv, altura);
  ctx.font = `${f}px system-ui, sans-serif`;
  const soma = dados.reduce((s, d) => s + d[1], 0) || 1;
  // Reserva espaço para a legenda mais longa antes de definir o raio
  const legW = Math.max(...dados.map(([k, v]) => ctx.measureText(`${k} – ${v} (${Math.round(v / soma * 100)}%)`).width)) + f * 1.6;
  const r = Math.max(50, Math.min(h / 2 - 10, (w - legW - 44) / 2)), cx = r + 10, cy = h / 2;
  let ang = -Math.PI / 2;
  dados.forEach(([k, v], i) => {
    const fatia = (v / soma) * Math.PI * 2;
    ctx.beginPath(); ctx.moveTo(cx, cy); ctx.arc(cx, cy, r, ang, ang + fatia); ctx.closePath();
    ctx.fillStyle = preencher(ctx, C, i); ctx.fill();
    ctx.strokeStyle = C.fundo; ctx.lineWidth = 2; if (C.contraste) ctx.strokeStyle = C.texto; ctx.stroke();
    ang += fatia;
  });
  ctx.beginPath(); ctx.arc(cx, cy, r * 0.55, 0, Math.PI * 2); ctx.fillStyle = C.fundo; ctx.fill();
  ctx.fillStyle = C.texto; ctx.textAlign = 'center'; ctx.textBaseline = 'middle';
  ctx.font = `bold ${f * 1.6}px system-ui, sans-serif`; ctx.fillText(total, cx, cy);
  // Legenda
  ctx.font = `${f}px system-ui, sans-serif`; ctx.textAlign = 'left';
  const lx = cx + r + 24, ly0 = cy - (dados.length * f * 1.9) / 2;
  dados.forEach(([k, v], i) => {
    const y = ly0 + i * f * 1.9;
    ctx.fillStyle = preencher(ctx, C, i); ctx.fillRect(lx, y, f * 1.1, f * 1.1);
    if (C.contraste) { ctx.strokeStyle = C.texto; ctx.lineWidth = 1; ctx.strokeRect(lx, y, f * 1.1, f * 1.1); }
    ctx.fillStyle = C.texto; ctx.textBaseline = 'top';
    ctx.fillText(`${k} – ${v} (${Math.round(v / soma * 100)}%)`, lx + f * 1.6, y);
  });
}

function desenharTodos() {
  const C = cores();
  const fn = { barrasH, colunas, rosca };
  GRAFICOS.forEach(g => fn[g.tipo](document.getElementById(g.id), g.dados, g.total, C));
}

/* ---------- Resumo falado ---------- */
function resumo() {
  const r = DADOS.respostas, b = contar(r, 'barreiras'), rec = contar(r, 'recursosDesejados');
  return `A pesquisa teve ${r.length} participantes. ` +
    `As barreiras mais citadas foram: ${b.slice(0, 3).map(x => `${x[0]}, com ${x[1]} menções`).join('; ')}. ` +
    `Os recursos de inteligência artificial mais desejados foram: ${rec.slice(0, 3).map(x => x[0]).join(', ')}. ` +
    `A satisfação média com a acessibilidade atual é ${media(r, 'satisfacao').replace('.', ',')} de 5.`;
}
document.getElementById('btnResumo').addEventListener('click', () => { Acess.falar(resumo()); Acess.vibrar('confirmacao'); });

document.addEventListener('tema-alterado', () => requestAnimationFrame(desenharTodos));
let t; window.addEventListener('resize', () => { clearTimeout(t); t = setTimeout(desenharTodos, 150); });
carregar().catch(e => {
  document.getElementById('metaPesquisa').textContent = 'Erro ao carregar os dados. Abra o site por um servidor (GitHub Pages ou Live Server).';
  console.error(e);
});
