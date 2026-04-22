/* ============================================================
   COPPA ITALIA · FANTA TABELLINO
   script.js — filter pills + render engine + voto calculation under player
   ============================================================ */

const BONUS_MAP = { G: 3, A: 1, Y: -0.5, R: -1, GS: -1, MG: -2 };

const FASE_FLAGS = {
  "Quarti di Finale":      { flag: "⚔️",  short: "Quarti" },
  "Semifinali - Andata":   { flag: "🔜",  short: "Semi Andata" },
  "Semifinali - Ritorno":  { flag: "🔚",  short: "Semi Ritorno" },
  "Semifinali":            { flag: "🏟️",  short: "Semifinali" },
  "Ottavi di Finale":      { flag: "🎯",  short: "Ottavi" },
  "Finale":                { flag: "🏆",  short: "Finale" },
};

const BONUS_NAMES = {
  G: "Gol",
  A: "Assist",
  Y: "Ammonizione",
  R: "Espulsione",
  GS: "Gol Subito",
  MG: "Maglia Strappata"
};

const BONUS_SYMBOLS = {
  G: "⚽",
  A: "🅰️",
  Y: "🟨",
  R: "🟥",
  GS: "🥅",
  MG: "👕"
};

let globalCardIdx = 0;
let activeFilter = "all";
let appData = null;

async function initApp() {
  try {
    const res  = await fetch('dati.json');
    appData    = await res.json();
    buildFilterPills(appData.fasi);
    renderContent("all");
  } catch (e) {
    console.error("Errore nel caricamento dei dati:", e);
  }
}

function buildFilterPills(fasi) {
  const scroll = document.getElementById('filter-scroll');
  scroll.innerHTML = '';

  const totalCount = fasi.reduce((acc, f) =>
    acc + f.partite.filter(p => p.casa.giocatori?.length).length, 0);

  const allPill = makePill("all", "🗂️", "Tutte", totalCount, true);
  scroll.appendChild(allPill);

  fasi.forEach(fase => {
    const count = fase.partite.filter(p => p.casa.giocatori?.length).length;
    if (!count) return;
    const meta  = FASE_FLAGS[fase.nome] || { flag: "📋", short: fase.nome };
    const pill  = makePill(fase.nome, meta.flag, meta.short, count, false);
    scroll.appendChild(pill);
  });
}

function makePill(value, flag, label, count, isActive) {
  const btn = document.createElement('button');
  btn.className = `filter-pill${isActive ? ' active' : ''}${value === 'all' ? ' all-pill' : ''}`;
  btn.setAttribute('data-filter', value);
  btn.setAttribute('role', 'tab');
  btn.setAttribute('aria-selected', isActive ? 'true' : 'false');
  btn.innerHTML = `
    <span class="pill-flag" aria-hidden="true">${flag}</span>
    <span class="pill-label">${label}</span>
    <span class="pill-count">${count}</span>`;
  btn.addEventListener('click', () => setFilter(value));
  return btn;
}

function setFilter(value) {
  activeFilter = value;
  document.querySelectorAll('.filter-pill').forEach(btn => {
    const isActive = btn.dataset.filter === value;
    btn.classList.toggle('active', isActive);
    btn.setAttribute('aria-selected', isActive ? 'true' : 'false');
  });
  renderContent(value);
}

function renderContent(filterValue) {
  const container  = document.getElementById('bracket-container');
  const emptyState = document.getElementById('empty-state');
  container.innerHTML = '';
  globalCardIdx = 0;

  const faseDaRenderare = filterValue === 'all'
    ? appData.fasi
    : appData.fasi.filter(f => f.nome === filterValue);

  let hasContent = false;

  faseDaRenderare.forEach((fase, fi) => {
    const partiteFiltrate = fase.partite.filter(p => p.casa.giocatori?.length);
    if (!partiteFiltrate.length) return;
    hasContent = true;

    const meta       = FASE_FLAGS[fase.nome] || { flag: "📋" };
    const faseEl     = document.createElement('div');
    faseEl.className = 'fase-header';
    faseEl.innerHTML = `
      <span class="fase-header-bar"></span>
      <span class="fase-header-text">${meta.flag}&nbsp;&nbsp;${fase.nome}</span>
      <span class="fase-header-line"></span>`;
    container.appendChild(faseEl);

    partiteFiltrate.forEach(partita => {
      container.appendChild(buildCard(partita));
      globalCardIdx++;
    });
  });

  emptyState.style.display = hasContent ? 'none' : 'block';
}

function calculateVotoWithDetails(giocatore) {
  const votoBase = giocatore.voto || 0;
  const eventi = giocatore.eventi || [];
  
  if (eventi.length === 0) {
    return {
      votoFinale: votoBase,
      votoBase: votoBase,
      bonusTotal: 0,
      dettagli: [],
      hasBonus: false
    };
  }
  
  let bonusTotal = 0;
  const dettagli = [];
  
  eventi.forEach(ev => {
    const valore = BONUS_MAP[ev] || 0;
    bonusTotal += valore;
    dettagli.push({
      evento: ev,
      nome: BONUS_NAMES[ev] || ev,
      simbolo: BONUS_SYMBOLS[ev] || "📌",
      valore: valore
    });
  });
  
  const votoFinale = votoBase + bonusTotal;
  
  return {
    votoFinale: votoFinale,
    votoBase: votoBase,
    bonusTotal: bonusTotal,
    dettagli: dettagli,
    hasBonus: true
  };
}

function buildCard(partita) {
  const casaRes  = calculateTeam(partita.casa);
  const trasfRes = calculateTeam(partita.trasferta);
  const rCasa    = getPenaltyScore(partita.casa);
  const rTrasf   = getPenaltyScore(partita.trasferta);
  const hasPens  = casaRes.gol === trasfRes.gol &&
                   (partita.casa.sequenza_rigori?.length || partita.trasferta.sequenza_rigori?.length);

  const id = `card-${globalCardIdx}`;

  const card = document.createElement('div');
  card.className = 'tabellino-card';
  card.style.animationDelay = `${Math.min(globalCardIdx * 0.06, 0.4)}s`;
  card.innerHTML = `
    <div class="score-banner">
      <div class="team-block home">
        <span class="team-name">${partita.casa.nome}</span>
        <span class="pts-badge"><span class="pts-dot"></span>${casaRes.punti.toFixed(1)} PTS</span>
      </div>

      <div class="score-center">
        <div class="main-goals">${casaRes.gol}&thinsp;–&thinsp;${trasfRes.gol}</div>
        ${hasPens ? `
          <div class="penalty-score-banner">${rCasa} – ${rTrasf}</div>
          <div class="dcr-label">D.C.R.</div>` : ''}
      </div>

      <div class="team-block away">
        <span class="team-name">${partita.trasferta.nome}</span>
        <span class="pts-badge"><span class="pts-dot"></span>${trasfRes.punti.toFixed(1)} PTS</span>
      </div>
    </div>

    <div class="players-grid">
      <div class="team-column">
        <div class="section-label">Titolari</div>
        <div id="${id}-casa-tit"></div>
        <div class="section-label">Panchina</div>
        <div id="${id}-casa-pan"></div>
        <div id="${id}-casa-rig-box" class="rigori-wrapper" style="display:none">
          <div class="section-label penalty-label">⚽ Rigori</div>
          <div id="${id}-casa-rig"></div>
        </div>
      </div>
      <div class="team-column">
        <div class="section-label">Titolari</div>
        <div id="${id}-trasf-tit"></div>
        <div class="section-label">Panchina</div>
        <div id="${id}-trasf-pan"></div>
        <div id="${id}-trasf-rig-box" class="rigori-wrapper" style="display:none">
          <div class="section-label penalty-label">⚽ Rigori</div>
          <div id="${id}-trasf-rig"></div>
        </div>
      </div>
    </div>`;

  renderPlayersWithDetails(partita.casa.giocatori, card.querySelector(`#${id}-casa-tit`));
  renderPlayersWithDetails(partita.casa.panchina, card.querySelector(`#${id}-casa-pan`), true);
  renderPlayersWithDetails(partita.trasferta.giocatori, card.querySelector(`#${id}-trasf-tit`));
  renderPlayersWithDetails(partita.trasferta.panchina, card.querySelector(`#${id}-trasf-pan`), true);

  renderPenalties(partita.casa,
    card.querySelector(`#${id}-casa-rig`),
    card.querySelector(`#${id}-casa-rig-box`));
  renderPenalties(partita.trasferta,
    card.querySelector(`#${id}-trasf-rig`),
    card.querySelector(`#${id}-trasf-rig-box`));

  return card;
}

function renderPlayersWithDetails(players, container, isBench = false) {
  if (!container) return;
  
  if (!players || players.length === 0) {
    if (isBench) {
      const emptyMsg = document.createElement('div');
      emptyMsg.className = 'empty-bench';
      emptyMsg.innerHTML = '📋 Nessun giocatore in panchina';
      container.appendChild(emptyMsg);
    }
    return;
  }
  
  players.forEach(p => {
    const votoCalc = calculateVotoWithDetails(p);
    const votoFinale = votoCalc.votoFinale;
    const votoBase = votoCalc.votoBase;
    const dettagli = votoCalc.dettagli;
    
    const icons = (p.eventi || []).map(ev =>
      `<span class="icon icon-${ev}" title="${BONUS_NAMES[ev] || ev}"></span>`).join('');
    
    const row = document.createElement('div');
    row.className = `player-row${isBench ? ' bench' : ''}`;
    
    // Main row: info giocatore a sinistra, voto finale a destra
    let mainRowHtml = `
      <div class="player-info">
        <div class="role-badge ${p.ruolo}">${p.ruolo}</div>
        <div class="player-name">${p.nome}</div>
        <div class="bonus-icons">${icons}</div>
      </div>
      <div class="final-voto">${votoFinale.toFixed(1).replace('.', ',')}</div>
    `;
    
    row.innerHTML = mainRowHtml;
    
    // Se ci sono bonus/malus, aggiungi riga di calcolo sotto, allineata a destra
    if (dettagli.length > 0) {
      let calcHtml = `<div class="voto-calcolo">`;
      calcHtml += `<span class="calc-base">${votoBase.toFixed(1).replace('.', ',')}</span>`;
      
      dettagli.forEach(d => {
        const isNegative = d.valore < 0;
        const absValue = Math.abs(d.valore);
        const sign = isNegative ? '−' : '+';
        calcHtml += `
          <span class="calc-bonus-item ${isNegative ? 'calc-bonus-negative' : 'calc-bonus-positive'}">
            <span class="calc-symbol">${d.simbolo}</span>
            <span>${sign} ${absValue.toFixed(1).replace('.', ',')}</span>
          </span>
        `;
      });
      
      calcHtml += `<span class="calc-arrow">→</span>`;
      calcHtml += `<span class="calc-total">${votoFinale.toFixed(1).replace('.', ',')}</span>`;
      calcHtml += `</div>`;
      
      row.innerHTML += calcHtml;
    }
    
    container.appendChild(row);
  });
}

function calculateTeam(squadra) {
  let punti = 0, gol = 0;
  [...(squadra.giocatori || []), ...(squadra.panchina || [])].forEach(g => {
    let fv = g.voto || 0;
    (g.eventi || []).forEach(ev => {
      fv += BONUS_MAP[ev] || 0;
      if (ev === 'G') gol++;
    });
    punti += fv;
  });
  return { punti, gol };
}

function getPenaltyScore(squadra) {
  if (!squadra.sequenza_rigori) return 0;
  return squadra.sequenza_rigori.filter(r => r.risultato.toLowerCase() === 'segnato').length;
}

function renderPenalties(squadra, listEl, boxEl) {
  if (!squadra.sequenza_rigori?.length || !listEl || !boxEl) return;
  boxEl.style.display = 'block';
  squadra.sequenza_rigori.forEach(p => {
    const ok  = p.risultato.toLowerCase() === 'segnato';
    const row = document.createElement('div');
    row.className = 'penalty-row';
    row.innerHTML = `
      <span class="player-name">${p.nome}</span>
      <span class="${ok ? 'rig-ok' : 'rig-miss'}">${ok ? '⚽ Segnato' : '❌ Sbagliato'}</span>`;
    listEl.appendChild(row);
  });
}

initApp();