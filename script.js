const BONUS_MAP = { "G": 3, "A": 1, "Y": -0.5, "R": -1, "GS": -1, "MG": -2 };

async function initApp() {
    try {
        // Caricamento dati (Assicurati che il file si chiami dati.json)
        const response = await fetch('dati.json');
        const data = await response.json();
        
        const container = document.getElementById('bracket-container');
        container.innerHTML = '';

        data.fasi.forEach(fase => {
            container.insertAdjacentHTML('beforeend', `<div class="fase-header">${fase.nome}</div>`);

            fase.partite.forEach((partita, idx) => {
                // Salta le partite non ancora popolate
                if (!partita.casa.giocatori || partita.casa.giocatori.length === 0) return;

                const casaRes = calculateTeam(partita.casa);
                const trasfRes = calculateTeam(partita.trasferta);
                const cardId = `match-${idx}-${fase.nome.replace(/\s/g, '')}`;

                // Calcolo punteggio rigori (d.c.r.)
                const rCasa = getPenaltyScore(partita.casa);
                const rTrasf = getPenaltyScore(partita.trasferta);
                
                // Banner rigori: appare solo se c'è pareggio nei gol regolamentari
                let penaltyHTML = (casaRes.gol === trasfRes.gol && (partita.casa.sequenza_rigori || partita.trasferta.sequenza_rigori)) ? 
                    `<div class="penalty-score-banner">(${rCasa}) - (${rTrasf})</div>` : "";

                const matchCard = `
                    <div class="tabellino-card">
                        <div class="score-banner">
                            <div class="team-block">
                                <h2>${partita.casa.nome}</h2>
                                <span class="pts-badge">${casaRes.punti.toFixed(1)} PTS</span>
                            </div>
                            <div class="score-center">
                                <div class="main-goals">${casaRes.gol} - ${trasfRes.gol}</div>
                                ${penaltyHTML}
                            </div>
                            <div class="team-block">
                                <h2>${partita.trasferta.nome}</h2>
                                <span class="pts-badge">${trasfRes.punti.toFixed(1)} PTS</span>
                            </div>
                        </div>
                        <div class="players-grid">
                            <div class="team-column">
                                <div class="section-label">Titolari</div>
                                <div id="${cardId}-casa-tit"></div>
                                <div class="section-label">Panchina</div>
                                <div id="${cardId}-casa-pan"></div>
                                <div id="${cardId}-casa-rig-box" class="rigori-wrapper">
                                    <div class="section-label penalty-label">Sequenza Rigori</div>
                                    <div id="${cardId}-casa-rig"></div>
                                </div>
                            </div>
                            <div class="team-column">
                                <div class="section-label">Titolari</div>
                                <div id="${cardId}-trasf-tit"></div>
                                <div class="section-label">Panchina</div>
                                <div id="${cardId}-trasf-pan"></div>
                                <div id="${cardId}-trasf-box" class="rigori-wrapper">
                                    <div class="section-label penalty-label">Sequenza Rigori</div>
                                    <div id="${cardId}-trasf-rig"></div>
                                </div>
                            </div>
                        </div>
                    </div>`;

                container.insertAdjacentHTML('beforeend', matchCard);

                // Rendering Titolari e Panchina
                renderPlayers(partita.casa.giocatori, `${cardId}-casa-tit`);
                renderPlayers(partita.casa.panchina, `${cardId}-casa-pan`, true);
                renderPlayers(partita.trasferta.giocatori, `${cardId}-trasf-tit`);
                renderPlayers(partita.trasferta.panchina, `${cardId}-trasf-pan`, true);

                // Rendering lista dettagliata rigori in fondo alle colonne
                renderOnlyPenalties(partita.casa, `${cardId}-casa-rig`, `${cardId}-casa-rig-box`);
                renderOnlyPenalties(partita.trasferta, `${cardId}-trasf-rig`, `${cardId}-trasf-box`);
            });
        });
    } catch (e) { console.error("Errore nel caricamento dei dati:", e); }
}

// Calcola punti totali e gol (solo quelli segnati nei tempi regolamentari)
function calculateTeam(squadra) {
    let punti = 0, gol = 0;
    const tutti = (squadra.giocatori || []).concat(squadra.panchina || []);
    
    tutti.forEach(g => {
        let fv = g.voto || 0;
        if(g.eventi) {
            g.eventi.forEach(ev => {
                fv += BONUS_MAP[ev] || 0;
                if (ev === "G") gol++; // Conta il bonus Gol (+3) come marcatura
            });
        }
        punti += fv;
    });
    return { punti, gol };
}

// Conta i rigori segnati dall'array sequenza_rigori
function getPenaltyScore(squadra) {
    if (!squadra.sequenza_rigori) return 0;
    return squadra.sequenza_rigori.filter(r => r.risultato.toLowerCase() === "segnato").length;
}

// Mostra la lista dei nomi dei rigoristi sotto la panchina
function renderOnlyPenalties(squadra, listId, boxId) {
    const listEl = document.getElementById(listId);
    const boxEl = document.getElementById(boxId);
    
    if (!squadra.sequenza_rigori || squadra.sequenza_rigori.length === 0) {
        boxEl.style.display = 'none';
        return;
    }

    squadra.sequenza_rigori.forEach(p => {
        const isSegnato = p.risultato.toLowerCase() === "segnato";
        const icon = isSegnato ? "⚽" : "❌";
        const statusClass = isSegnato ? "rig-ok" : "rig-miss";
        const statusText = isSegnato ? "Segnato" : "Sbagliato";
        
        listEl.insertAdjacentHTML('beforeend', `
            <div class="penalty-row">
                <span class="player-name">${p.nome}</span>
                <span class="${statusClass}">${icon} ${statusText}</span>
            </div>
        `);
    });
}

// Renderizza i giocatori (Titolari/Panchina)
function renderPlayers(players, containerId, isBench = false) {
    const el = document.getElementById(containerId);
    if (!players || players.length === 0) return;

    players.forEach(p => {
        let fv = p.voto || 0;
        if(p.eventi) p.eventi.forEach(ev => fv += BONUS_MAP[ev] || 0);
        const icons = (p.eventi || []).map(ev => `<div class="icon icon-${ev}"></div>`).join('');
        
        el.insertAdjacentHTML('beforeend', `
            <div class="player-row ${isBench ? 'bench' : ''}">
                <div class="role-badge ${p.ruolo}">${p.ruolo}</div>
                <div class="player-name">${p.nome}</div>
                <div class="bonus-icons">${icons}</div>
                <div class="voto-container">
                    <span class="final-voto">${fv.toFixed(1)}</span>
                </div>
            </div>
        `);
    });
}

// Avvio applicazione
initApp();