'use strict';

// Lightweight custom plugin — draws value labels on bars without any third-party dependency
const BarValueLabels = {
  id: 'barValueLabels',
  afterDatasetsDraw(chart, _args, opts) {
    if (!opts || !opts.display) return;
    const { ctx } = chart;
    const horizontal = chart.options.indexAxis === 'y';
    ctx.save();
    ctx.font = `700 13px "Helvetica Neue", Helvetica, Arial, sans-serif`;
    ctx.fillStyle = opts.color || '#3c3028';
    chart.data.datasets.forEach((ds, di) => {
      const meta = chart.getDatasetMeta(di);
      if (meta.hidden) return;
      meta.data.forEach((bar, i) => {
        const val = ds.data[i];
        if (val == null) return;
        const label = val > 0 ? `+${val}` : `${val}`;
        if (horizontal) {
          ctx.textAlign = 'left';
          ctx.textBaseline = 'middle';
          ctx.fillText(label, bar.x + 6, bar.y);
        } else {
          ctx.textAlign = 'center';
          ctx.textBaseline = 'bottom';
          ctx.fillText(label, bar.x, bar.y - 4);
        }
      });
    });
    ctx.restore();
  }
};
Chart.register(BarValueLabels);

const OUTCOMES = ["GI TEAE", "Nausea", "Vomiting", "Diarrhea", "Constipation", "GERD"];

const GRADE_ORDER = ['high', 'moderate', 'low', 'very_low'];

const DRUG_COLORS = {
  "Semaglutide":   "#c4898a",
  "Tirzepatide":   "#7d9e8c",
  "Orforglipron":  "#9b8fb5",
  "Liraglutide":   "#7d9ab5",
  "Dulaglutide":   "#c4a96b",
  "Exenatide":     "#c4856b",
  "Efpeglenatide": "#6b9ea8",
  "Lixisenatide":  "#9aab7d",
  "Survodutide":   "#b58fa0",
};

const OUTCOME_COLORS = {
  "GI TEAE":     "#c4898a",
  "Nausea":      "#7d9ab5",
  "Vomiting":    "#7d9e8c",
  "Diarrhea":    "#c4a96b",
  "Constipation":"#9b8fb5",
  "GERD":        "#6b9ea8",
};

let DATA = null;
const charts = {};

// ─── Utilities ────────────────────────────────────────────────────────────────

function computeARD(or, baselinePer1000) {
  if (!or || !baselinePer1000) return null;
  const p0 = baselinePer1000 / 1000;
  const p1 = (or * p0) / (1 - p0 + or * p0);
  return Math.round((p1 - p0) * 1000);
}

function gradeLabel(g) {
  if (!g) return '—';
  return g.charAt(0).toUpperCase() + g.slice(1).replace('_', ' ');
}

function gradeBadge(g) {
  if (!g) return '';
  return `<span class="grade-badge grade-${g}">${gradeLabel(g)}</span>`;
}

function bestGrade(grades) {
  const valid = grades.filter(Boolean);
  if (!valid.length) return null;
  return valid.sort((a, b) => GRADE_ORDER.indexOf(a) - GRADE_ORDER.indexOf(b))[0];
}

function getBaselines(prefix) {
  const useCustom = document.querySelector(`input[name="${prefix}-baseline"]:checked`)?.value === 'custom';
  if (!useCustom) return DATA.baseline_per1000;
  const out = {};
  document.querySelectorAll(`.${prefix}-slider`).forEach(s => {
    out[s.dataset.outcome] = Number(s.value);
  });
  return out;
}

function buildCustomSliders(prefix) {
  return OUTCOMES.map(o => {
    const base = DATA.baseline_per1000[o] ?? 0;
    const id = `${prefix}-sl-${o.replace(/\s+/g, '_')}`;
    return `<label>${o}:
      <input type="range" class="${prefix}-slider" data-outcome="${o}" min="1" max="300" value="${base}">
      <span class="slider-val" id="${id}">${base}</span>/1,000
    </label>`;
  }).join('');
}

function wireSliders(prefix, updateFn) {
  document.querySelectorAll(`.${prefix}-slider`).forEach(s => {
    s.addEventListener('input', e => {
      const id = `${prefix}-sl-${e.target.dataset.outcome.replace(/\s+/g, '_')}`;
      const el = document.getElementById(id);
      if (el) el.textContent = e.target.value;
      updateFn();
    });
  });
}

function destroyChart(key) {
  if (charts[key]) { charts[key].destroy(); delete charts[key]; }
}

function barLabels() {
  return { display: true, color: '#3c3028' };
}

// ─── Init ─────────────────────────────────────────────────────────────────────

function init() {
  DATA = {"meta":{"title":"GLP-1RA Gastrointestinal Tolerability Decision Aid","citation":"Wan JY, Yao HQ et al. Gastrointestinal Adverse Events Associated With GLP-1 Receptor Agonists: A Network Meta-analysis of Randomized Controlled Trials. 2026.","n_rcts":222,"n_participants":118110,"generated":"2026-04-20"},"outcomes":["GI TEAE","Nausea","Vomiting","Diarrhea","Constipation","GERD"],"baseline_per1000":{"GI TEAE":138,"Nausea":58,"Vomiting":13,"Diarrhea":59,"Constipation":32,"GERD":null},"drugs":{"Semaglutide":{"GI TEAE":{"or":2.26,"ci_low":1.44,"ci_high":3.54,"grade":"moderate","ci_suspect":false,"abs_per1000":241,"abs_ci_low":107,"abs_ci_high":336,"nnh":null},"Nausea":{"or":5.65,"ci_low":4.2,"ci_high":7.59,"grade":"high","ci_suspect":false,"abs_per1000":null,"abs_ci_low":null,"abs_ci_high":null,"nnh":null},"Vomiting":{"or":5.85,"ci_low":4.44,"ci_high":7.7,"grade":"high","ci_suspect":false,"abs_per1000":null,"abs_ci_low":null,"abs_ci_high":null,"nnh":null},"Diarrhea":{"or":2.56,"ci_low":2.08,"ci_high":3.15,"grade":"high","ci_suspect":false,"abs_per1000":null,"abs_ci_low":null,"abs_ci_high":null,"nnh":null},"Constipation":{"or":2.62,"ci_low":2.03,"ci_high":3.4,"grade":"moderate","ci_suspect":false,"abs_per1000":null,"abs_ci_low":null,"abs_ci_high":null,"nnh":null},"GERD":{"or":3.56,"ci_low":1.57,"ci_high":8.04,"grade":"low","ci_suspect":false,"abs_per1000":null,"abs_ci_low":null,"abs_ci_high":null,"nnh":null}},"Tirzepatide":{"GI TEAE":{"or":null,"ci_low":null,"ci_high":null,"grade":null,"ci_suspect":false,"abs_per1000":269,"abs_ci_low":null,"abs_ci_high":null,"nnh":null},"Nausea":{"or":4.68,"ci_low":2.65,"ci_high":8.26,"grade":"moderate","ci_suspect":false,"abs_per1000":null,"abs_ci_low":null,"abs_ci_high":null,"nnh":null},"Vomiting":{"or":7.82,"ci_low":4.46,"ci_high":13.72,"grade":"moderate","ci_suspect":false,"abs_per1000":null,"abs_ci_low":null,"abs_ci_high":null,"nnh":null},"Diarrhea":{"or":3.74,"ci_low":2.53,"ci_high":5.54,"grade":"moderate","ci_suspect":false,"abs_per1000":null,"abs_ci_low":null,"abs_ci_high":null,"nnh":null},"Constipation":{"or":3.96,"ci_low":2.43,"ci_high":6.46,"grade":"moderate","ci_suspect":false,"abs_per1000":null,"abs_ci_low":null,"abs_ci_high":null,"nnh":null},"GERD":{"or":3.79,"ci_low":1.69,"ci_high":8.51,"grade":"low","ci_suspect":true,"abs_per1000":null,"abs_ci_low":null,"abs_ci_high":null,"nnh":null}},"Orforglipron":{"GI TEAE":{"or":12.33,"ci_low":2.95,"ci_high":51.56,"grade":"moderate","ci_suspect":false,"abs_per1000":588,"abs_ci_low":422,"abs_ci_high":805,"nnh":1.7},"Nausea":{"or":8.44,"ci_low":3.29,"ci_high":21.62,"grade":"moderate","ci_suspect":false,"abs_per1000":356,"abs_ci_low":null,"abs_ci_high":null,"nnh":2.8},"Vomiting":{"or":10.13,"ci_low":4.17,"ci_high":24.62,"grade":"moderate","ci_suspect":false,"abs_per1000":null,"abs_ci_low":null,"abs_ci_high":null,"nnh":null},"Diarrhea":{"or":2.42,"ci_low":1.21,"ci_high":4.84,"grade":"low","ci_suspect":false,"abs_per1000":null,"abs_ci_low":null,"abs_ci_high":null,"nnh":null},"Constipation":{"or":6.98,"ci_low":2.33,"ci_high":20.85,"grade":"moderate","ci_suspect":false,"abs_per1000":145,"abs_ci_low":null,"abs_ci_high":null,"nnh":6.9},"GERD":{"or":5.39,"ci_low":0.71,"ci_high":40.97,"grade":"low","ci_suspect":true,"abs_per1000":null,"abs_ci_low":null,"abs_ci_high":null,"nnh":null}},"Liraglutide":{"GI TEAE":{"or":null,"ci_low":null,"ci_high":null,"grade":null,"ci_suspect":false,"abs_per1000":303,"abs_ci_low":213,"abs_ci_high":389,"nnh":null},"Nausea":{"or":4.44,"ci_low":3.35,"ci_high":5.87,"grade":"high","ci_suspect":false,"abs_per1000":null,"abs_ci_low":null,"abs_ci_high":null,"nnh":null},"Vomiting":{"or":3.83,"ci_low":2.87,"ci_high":5.12,"grade":"high","ci_suspect":false,"abs_per1000":null,"abs_ci_low":null,"abs_ci_high":null,"nnh":null},"Diarrhea":{"or":1.97,"ci_low":1.58,"ci_high":2.45,"grade":"high","ci_suspect":false,"abs_per1000":null,"abs_ci_low":null,"abs_ci_high":null,"nnh":null},"Constipation":{"or":2.15,"ci_low":1.61,"ci_high":2.89,"grade":"moderate","ci_suspect":false,"abs_per1000":null,"abs_ci_low":null,"abs_ci_high":null,"nnh":null},"GERD":{"or":3.12,"ci_low":0.97,"ci_high":10.02,"grade":"low","ci_suspect":false,"abs_per1000":null,"abs_ci_low":null,"abs_ci_high":null,"nnh":null}},"Dulaglutide":{"GI TEAE":{"or":2.84,"ci_low":1.81,"ci_high":4.47,"grade":"moderate","ci_suspect":false,"abs_per1000":159,"abs_ci_low":88,"abs_ci_high":256,"nnh":null},"Nausea":{"or":3.49,"ci_low":2.5,"ci_high":4.86,"grade":"moderate","ci_suspect":false,"abs_per1000":null,"abs_ci_low":null,"abs_ci_high":null,"nnh":null},"Vomiting":{"or":3.73,"ci_low":2.75,"ci_high":5.06,"grade":"moderate","ci_suspect":false,"abs_per1000":null,"abs_ci_low":null,"abs_ci_high":null,"nnh":null},"Diarrhea":{"or":2.41,"ci_low":1.91,"ci_high":3.03,"grade":"moderate","ci_suspect":false,"abs_per1000":null,"abs_ci_low":null,"abs_ci_high":null,"nnh":null},"Constipation":{"or":2.46,"ci_low":1.67,"ci_high":3.63,"grade":"moderate","ci_suspect":false,"abs_per1000":null,"abs_ci_low":null,"abs_ci_high":null,"nnh":null},"GERD":{"or":1.47,"ci_low":0.25,"ci_high":8.79,"grade":"very_low","ci_suspect":false,"abs_per1000":null,"abs_ci_low":null,"abs_ci_high":null,"nnh":null}},"Exenatide":{"GI TEAE":{"or":null,"ci_low":null,"ci_high":null,"grade":null,"ci_suspect":false,"abs_per1000":-5,"abs_ci_low":-245,"abs_ci_high":401,"nnh":null},"Nausea":{"or":4.96,"ci_low":3.38,"ci_high":7.26,"grade":"moderate","ci_suspect":false,"abs_per1000":null,"abs_ci_low":null,"abs_ci_high":null,"nnh":null},"Vomiting":{"or":3.82,"ci_low":2.67,"ci_high":5.48,"grade":"moderate","ci_suspect":false,"abs_per1000":null,"abs_ci_low":null,"abs_ci_high":null,"nnh":null},"Diarrhea":{"or":1.73,"ci_low":1.32,"ci_high":2.27,"grade":"moderate","ci_suspect":false,"abs_per1000":null,"abs_ci_low":null,"abs_ci_high":null,"nnh":null},"Constipation":{"or":2.38,"ci_low":1.61,"ci_high":3.51,"grade":"low","ci_suspect":false,"abs_per1000":null,"abs_ci_low":null,"abs_ci_high":null,"nnh":null},"GERD":{"or":null,"ci_low":null,"ci_high":null,"grade":null,"ci_suspect":false,"abs_per1000":null,"abs_ci_low":null,"abs_ci_high":null,"nnh":null}},"Efpeglenatide":{"GI TEAE":{"or":2.65,"ci_low":1.83,"ci_high":3.85,"grade":"moderate","ci_suspect":false,"abs_per1000":439,"abs_ci_low":209,"abs_ci_high":796,"nnh":2.3},"Nausea":{"or":5.73,"ci_low":2.63,"ci_high":12.5,"grade":"moderate","ci_suspect":false,"abs_per1000":null,"abs_ci_low":null,"abs_ci_high":null,"nnh":null},"Vomiting":{"or":4.58,"ci_low":2.42,"ci_high":8.68,"grade":"moderate","ci_suspect":false,"abs_per1000":null,"abs_ci_low":null,"abs_ci_high":null,"nnh":null},"Diarrhea":{"or":1.98,"ci_low":1.22,"ci_high":3.19,"grade":"low","ci_suspect":false,"abs_per1000":null,"abs_ci_low":null,"abs_ci_high":null,"nnh":null},"Constipation":{"or":3.1,"ci_low":1.71,"ci_high":5.61,"grade":"low","ci_suspect":false,"abs_per1000":null,"abs_ci_low":null,"abs_ci_high":null,"nnh":null},"GERD":{"or":null,"ci_low":null,"ci_high":null,"grade":null,"ci_suspect":false,"abs_per1000":null,"abs_ci_low":null,"abs_ci_high":null,"nnh":null}},"Lixisenatide":{"GI TEAE":{"or":4.16,"ci_low":2.53,"ci_high":6.83,"grade":"moderate","ci_suspect":false,"abs_per1000":166,"abs_ci_low":131,"abs_ci_high":246,"nnh":null},"Nausea":{"or":6.02,"ci_low":3.61,"ci_high":10.05,"grade":"moderate","ci_suspect":false,"abs_per1000":null,"abs_ci_low":null,"abs_ci_high":null,"nnh":null},"Vomiting":{"or":5.31,"ci_low":2.95,"ci_high":9.55,"grade":"moderate","ci_suspect":false,"abs_per1000":null,"abs_ci_low":null,"abs_ci_high":null,"nnh":null},"Diarrhea":{"or":1.28,"ci_low":0.87,"ci_high":1.89,"grade":"low","ci_suspect":false,"abs_per1000":null,"abs_ci_low":null,"abs_ci_high":null,"nnh":null},"Constipation":{"or":null,"ci_low":null,"ci_high":null,"grade":null,"ci_suspect":false,"abs_per1000":null,"abs_ci_low":null,"abs_ci_high":null,"nnh":null},"GERD":{"or":null,"ci_low":null,"ci_high":null,"grade":null,"ci_suspect":false,"abs_per1000":null,"abs_ci_low":null,"abs_ci_high":null,"nnh":null}},"Survodutide":{"GI TEAE":{"or":null,"ci_low":null,"ci_high":null,"grade":null,"ci_suspect":false,"abs_per1000":550,"abs_ci_low":null,"abs_ci_high":null,"nnh":1.8},"Nausea":{"or":5.72,"ci_low":1.79,"ci_high":18.23,"grade":"low","ci_suspect":false,"abs_per1000":null,"abs_ci_low":null,"abs_ci_high":null,"nnh":null},"Vomiting":{"or":6.68,"ci_low":2.17,"ci_high":20.57,"grade":"low","ci_suspect":false,"abs_per1000":null,"abs_ci_low":null,"abs_ci_high":null,"nnh":null},"Diarrhea":{"or":2.3,"ci_low":0.95,"ci_high":5.52,"grade":"low","ci_suspect":false,"abs_per1000":null,"abs_ci_low":null,"abs_ci_high":null,"nnh":null},"Constipation":{"or":4.23,"ci_low":1.4,"ci_high":12.76,"grade":"low","ci_suspect":false,"abs_per1000":null,"abs_ci_low":null,"abs_ci_high":null,"nnh":null},"GERD":{"or":null,"ci_low":null,"ci_high":null,"grade":null,"ci_suspect":false,"abs_per1000":null,"abs_ci_low":null,"abs_ci_high":null,"nnh":null}}}};

  // Chart.js global defaults
  Chart.defaults.color = '#7d6e63';
  Chart.defaults.borderColor = 'rgba(60,48,40,0.10)';
  Chart.defaults.font.family = '"Helvetica Neue", Helvetica, Arial, sans-serif';
  Chart.defaults.font.size = 13;

  document.getElementById('citation-text').textContent = DATA.meta.citation;
  setupTabs();
  renderTab1();
}

function setupTabs() {
  document.querySelectorAll('.tab').forEach(btn => {
    btn.addEventListener('click', () => {
      document.querySelectorAll('.tab').forEach(b => {
        b.classList.remove('active');
        b.setAttribute('aria-selected', 'false');
      });
      document.querySelectorAll('.tab-panel').forEach(p => p.classList.remove('active'));
      btn.classList.add('active');
      btn.setAttribute('aria-selected', 'true');
      const panel = document.getElementById('tab-' + btn.dataset.tab);
      panel.classList.add('active');
      if (btn.dataset.tab === 'selection')  renderTab1();
      if (btn.dataset.tab === 'counseling') renderTab2();
      if (btn.dataset.tab === 'switching')  renderTab3();
      if (btn.dataset.tab === 'guide')      renderTab4();
    });
  });
}

// ─── Tab 1: Drug Selection ────────────────────────────────────────────────────

function renderTab1() {
  const panel = document.getElementById('tab-selection');
  const outcomeChecks = OUTCOMES.map(o =>
    `<label><input type="checkbox" class="t1-outcome" value="${o}" checked> ${o}</label>`
  ).join('');

  panel.innerHTML = `
    <div class="controls">
      <fieldset>
        <legend>Outcomes of concern</legend>
        <div class="check-grid">${outcomeChecks}</div>
      </fieldset>
      <fieldset>
        <legend>Baseline risk</legend>
        <label><input type="radio" name="t1-baseline" value="study" checked> Study average</label>
        <label><input type="radio" name="t1-baseline" value="custom"> Custom (advanced)</label>
        <div id="t1-custom-area" class="custom-sliders hidden"></div>
      </fieldset>
    </div>
    <p class="chart-section-label">GI Risk Score — Additional Events per 1,000 Patients vs. Control</p>
    <div class="chart-box chart-box-selection"><canvas id="chart-selection"></canvas></div>
    <p class="grade-note">Each drug has a unique color. Values shown on bars. GRADE certainty and NNH available on hover.</p>
  `;

  document.querySelector('input[name="t1-baseline"][value="custom"]').addEventListener('change', () => {
    const area = document.getElementById('t1-custom-area');
    area.innerHTML = buildCustomSliders('t1');
    area.classList.remove('hidden');
    wireSliders('t1', updateTab1);
    updateTab1();
  });
  document.querySelector('input[name="t1-baseline"][value="study"]').addEventListener('change', () => {
    document.getElementById('t1-custom-area').classList.add('hidden');
    updateTab1();
  });
  panel.querySelectorAll('.t1-outcome').forEach(c => c.addEventListener('change', updateTab1));
  updateTab1();
}

function updateTab1() {
  const selected = [...document.querySelectorAll('.t1-outcome:checked')].map(c => c.value);
  if (!selected.length) { destroyChart('selection'); return; }
  const baselines = getBaselines('t1');

  const scores = Object.entries(DATA.drugs).map(([drug, outcomes]) => {
    let total = 0, count = 0;
    const grades = [];
    selected.forEach(o => {
      const cell = outcomes[o];
      if (!cell) return;
      const abs = cell.abs_per1000 ?? computeARD(cell.or, baselines[o]);
      if (abs !== null) { total += Math.max(0, abs); count++; }
      if (cell.grade) grades.push(cell.grade);
    });
    const score = count ? Math.round(total / count) : null;
    const nnh = selected.map(o => outcomes[o]?.nnh).find(v => v != null) ?? null;
    return { drug, score, grade: bestGrade(grades), nnh };
  }).filter(d => d.score !== null).sort((a, b) => b.score - a.score);

  destroyChart('selection');
  const ctx = document.getElementById('chart-selection')?.getContext('2d');
  if (!ctx || !scores.length) return;

  charts['selection'] = new Chart(ctx, {
    type: 'bar',
    data: {
      labels: scores.map(d => d.drug),
      datasets: [{
        label: 'Mean additional events per 1,000 patients',
        data:  scores.map(d => d.score),
        backgroundColor: scores.map(d => DRUG_COLORS[d.drug] || '#bbb'),
        borderColor: scores.map(d => (DRUG_COLORS[d.drug] || '#bbb') + '44'),
        borderWidth: 1,
      }]
    },
    options: {
      indexAxis: 'y',
      responsive: true,
      maintainAspectRatio: false,
      layout: { padding: { right: 60 } },
      plugins: {
        legend: { display: false },
        barValueLabels: barLabels(),
        tooltip: {
          callbacks: {
            label: ctx => {
              const d = scores[ctx.dataIndex];
              const nnh = d.nnh ? ` · NNH ≈ ${d.nnh}` : '';
              return `+${ctx.raw} events/1,000 · GRADE: ${gradeLabel(d.grade)}${nnh}`;
            }
          }
        }
      },
      scales: {
        x: {
          title: {
            display: true,
            text: 'Additional events per 1,000 patients vs. control',
            font: { size: 13, weight: '600' }
          }
        },
        y: { ticks: { font: { size: 14, weight: '600' } } }
      }
    }
  });
}

// ─── Tab 2: Patient Counseling ────────────────────────────────────────────────

function renderTab2() {
  const panel = document.getElementById('tab-counseling');
  const drugOpts = Object.keys(DATA.drugs).map(d => `<option>${d}</option>`).join('');
  const outcomeChecks = OUTCOMES.map(o =>
    `<label><input type="checkbox" class="t2-outcome" value="${o}" checked> ${o}</label>`
  ).join('');

  panel.innerHTML = `
    <div class="controls">
      <fieldset>
        <legend>Drug</legend>
        <label>Select drug: <select id="t2-drug">${drugOpts}</select></label>
      </fieldset>
      <fieldset>
        <legend>Outcomes to discuss</legend>
        <div class="check-grid">${outcomeChecks}</div>
      </fieldset>
      <fieldset>
        <legend>Baseline risk</legend>
        <label><input type="radio" name="t2-baseline" value="study" checked> Study average</label>
        <label><input type="radio" name="t2-baseline" value="custom"> Custom (advanced)</label>
        <div id="t2-custom-area" class="custom-sliders hidden"></div>
      </fieldset>
    </div>
    <div id="t2-sentences" class="sentences-box"><p>Select a drug above to see results.</p></div>
    <div class="chart-box chart-box-counseling"><canvas id="chart-counseling"></canvas></div>
    <button id="btn-print" onclick="window.print()">Print Patient Summary</button>
  `;

  document.querySelector('input[name="t2-baseline"][value="custom"]').addEventListener('change', () => {
    const area = document.getElementById('t2-custom-area');
    area.innerHTML = buildCustomSliders('t2');
    area.classList.remove('hidden');
    wireSliders('t2', updateTab2);
    updateTab2();
  });
  document.querySelector('input[name="t2-baseline"][value="study"]').addEventListener('change', () => {
    document.getElementById('t2-custom-area').classList.add('hidden');
    updateTab2();
  });
  panel.querySelectorAll('#t2-drug, .t2-outcome').forEach(el => el.addEventListener('change', updateTab2));
  updateTab2();
}

function updateTab2() {
  const drug = document.getElementById('t2-drug')?.value;
  if (!drug || !DATA.drugs[drug]) return;
  const selected = [...document.querySelectorAll('.t2-outcome:checked')].map(c => c.value);
  const baselines = getBaselines('t2');
  const drugData = DATA.drugs[drug];

  const rows = selected.map(o => {
    const cell = drugData[o];
    if (!cell) return null;
    const abs = cell.abs_per1000 ?? computeARD(cell.or, baselines[o]);
    if (abs === null) return null;
    return { outcome: o, abs, nnh: cell.nnh, grade: cell.grade };
  }).filter(Boolean);

  const sentencesEl = document.getElementById('t2-sentences');
  if (!rows.length) {
    sentencesEl.innerHTML = '<p>No data available for the selected drug and outcomes.</p>';
    destroyChart('counseling');
    return;
  }

  sentencesEl.innerHTML = rows.map(r => {
    const per100 = Math.round(Math.abs(r.abs) / 10);
    const direction = r.abs >= 0 ? 'additional' : 'fewer';
    const nnh = r.nnh ? ` (NNH&nbsp;≈&nbsp;${r.nnh})` : '';
    return `<p>Among every 100 patients taking <strong>${drug}</strong>, approximately <strong>${per100 < 1 ? '&lt;1' : per100}</strong> ${direction} cases of <strong>${r.outcome.toLowerCase()}</strong> are expected vs. control${nnh}. ${gradeBadge(r.grade)}</p>`;
  }).join('');

  destroyChart('counseling');
  const ctx = document.getElementById('chart-counseling')?.getContext('2d');
  if (!ctx) return;

  charts['counseling'] = new Chart(ctx, {
    type: 'bar',
    data: {
      labels: rows.map(r => r.outcome),
      datasets: [{
        label: `Additional events per 1,000 patients on ${drug} vs. control`,
        data:  rows.map(r => r.abs),
        backgroundColor: rows.map(r => OUTCOME_COLORS[r.outcome] || '#bbb'),
        borderColor: rows.map(r => (OUTCOME_COLORS[r.outcome] || '#bbb') + '44'),
        borderWidth: 1,
      }]
    },
    options: {
      responsive: true,
      maintainAspectRatio: false,
      layout: { padding: { top: 28 } },
      plugins: {
        legend: { display: true, labels: { font: { size: 13 } } },
        barValueLabels: barLabels(),
      },
      scales: {
        y: {
          title: { display: true, text: 'Additional events per 1,000 patients', font: { size: 13, weight: '600' } },
          ticks: { font: { size: 13 } }
        },
        x: { ticks: { font: { size: 14, weight: '600' } } }
      }
    }
  });
}

// ─── Tab 3: Drug Switching ────────────────────────────────────────────────────

function renderTab3() {
  const panel = document.getElementById('tab-switching');
  const drugOpts = Object.keys(DATA.drugs).map(d => `<option>${d}</option>`).join('');
  const outcomeOpts = OUTCOMES.map(o => `<option>${o}</option>`).join('');

  panel.innerHTML = `
    <div class="controls">
      <fieldset>
        <legend>Current drug</legend>
        <label><select id="t3-current">${drugOpts}</select></label>
      </fieldset>
      <fieldset>
        <legend>Intolerable symptom</legend>
        <label><select id="t3-symptom">${outcomeOpts}</select></label>
      </fieldset>
    </div>
    <div id="t3-results"></div>
  `;

  panel.querySelectorAll('#t3-current, #t3-symptom').forEach(el =>
    el.addEventListener('change', updateTab3)
  );
  updateTab3();
}

function updateTab3() {
  const current = document.getElementById('t3-current')?.value;
  const symptom = document.getElementById('t3-symptom')?.value;
  if (!current || !symptom) return;

  const baseline = DATA.baseline_per1000[symptom] ?? 0;
  const currentCell = DATA.drugs[current]?.[symptom];
  const currentAbs = currentCell?.abs_per1000 ?? computeARD(currentCell?.or, baseline);

  const alts = Object.entries(DATA.drugs)
    .filter(([d]) => d !== current)
    .map(([d, outcomes]) => {
      const cell = outcomes[symptom];
      const abs = cell?.abs_per1000 ?? computeARD(cell?.or, baseline);
      return { drug: d, abs, grade: cell?.grade };
    })
    .filter(a => a.abs !== null)
    .sort((a, b) => a.abs - b.abs);

  const resultsEl = document.getElementById('t3-results');
  if (!alts.length) {
    resultsEl.innerHTML = '<p class="no-data-msg">No comparison data available for this symptom.</p>';
    return;
  }

  const currentStr = currentAbs !== null
    ? `Current drug <strong>${current}</strong>: +${currentAbs} events of ${symptom.toLowerCase()} per 1,000 patients vs. control.`
    : `No ${symptom} data available for ${current}.`;

  const rows = alts.map((alt, i) => {
    const delta = currentAbs !== null && alt.abs !== null ? alt.abs - currentAbs : null;
    let deltaHtml = '—';
    if (delta !== null) {
      if (delta < 0) deltaHtml = `<span class="better">${Math.abs(delta)} fewer/1,000</span>`;
      else if (delta > 0) deltaHtml = `<span class="worse">+${delta} more/1,000</span>`;
      else deltaHtml = `<span class="neutral">no difference</span>`;
    }
    return `<tr>
      <td>${i + 1}</td>
      <td><strong style="color:${DRUG_COLORS[alt.drug] || '#8a7060'}">${alt.drug}</strong></td>
      <td>${alt.abs >= 0 ? '+' : ''}${alt.abs}/1,000</td>
      <td>${deltaHtml} vs. ${current}</td>
      <td>${gradeBadge(alt.grade)}</td>
    </tr>`;
  }).join('');

  resultsEl.innerHTML = `
    <p style="margin-bottom:0.7rem;font-size:0.97rem">${currentStr}</p>
    <p style="margin-bottom:0.5rem;font-size:0.9rem;color:#7d6e63">Alternatives ranked by lowest ${symptom.toLowerCase()} risk:</p>
    <table>
      <thead><tr><th>#</th><th>Drug</th><th>Events/1,000</th><th>vs. Current Drug</th><th>GRADE</th></tr></thead>
      <tbody>${rows}</tbody>
    </table>
  `;
}

// ─── Tab 4: How to Use ────────────────────────────────────────────────────────

function renderTab4() {
  const panel = document.getElementById('tab-guide');
  if (panel.dataset.rendered) return;
  panel.dataset.rendered = '1';

  const drugSwatches = Object.entries(DRUG_COLORS).map(([name, color]) =>
    `<div class="swatch-item">
      <div class="swatch-dot" style="background:${color}"></div>
      <span class="swatch-name">${name}</span>
    </div>`
  ).join('');

  const outcomeSwatches = Object.entries(OUTCOME_COLORS).map(([name, color]) =>
    `<div class="swatch-item">
      <div class="swatch-dot" style="background:${color}"></div>
      <span class="swatch-name">${name}</span>
    </div>`
  ).join('');

  // Mini bar chart illustration values
  const miniDrugs = [
    { name: 'Drug A', pct: 88, color: '#9b8fb5', val: '+264' },
    { name: 'Drug B', pct: 55, color: '#7d9e8c', val: '+165' },
    { name: 'Drug C', pct: 30, color: '#c4a96b', val: '+90'  },
  ];

  const miniBars = miniDrugs.map(d => `
    <div class="mini-bar-row">
      <span class="mini-bar-label">${d.name}</span>
      <div class="mini-bar-track">
        <div class="mini-bar-fill" style="width:${d.pct}%;background:${d.color}">
          <span class="mini-bar-value">${d.val}</span>
        </div>
      </div>
    </div>`).join('');

  panel.innerHTML = `
  <div class="guide-wrap">

    <h2 class="guide-section-title">What This Tool Does</h2>
    <div class="guide-cards">
      <div class="guide-card">
        <span class="guide-card-icon">
          <svg width="38" height="32" viewBox="0 0 38 32" fill="none" xmlns="http://www.w3.org/2000/svg">
            <rect x="0"  y="16" width="9" height="16" rx="2" fill="#d6c8bc"/>
            <rect x="13" y="9"  width="9" height="23" rx="2" fill="#b09a88"/>
            <rect x="26" y="2"  width="9" height="30" rx="2" fill="#8a7060"/>
          </svg>
        </span>
        <h3>Drug Selection</h3>
        <p>Compare all 9 GLP-1RAs side-by-side on GI adverse event burden across up to 6 outcomes simultaneously.</p>
        <span class="guide-tag">START HERE</span>
      </div>
      <div class="guide-card">
        <span class="guide-card-icon">🩺</span>
        <h3>Patient Counseling</h3>
        <p>Generate plain-language counseling statements for a specific drug. Print a patient summary sheet.</p>
        <span class="guide-tag">INDIVIDUAL PATIENT</span>
      </div>
      <div class="guide-card">
        <span class="guide-card-icon">
          <svg width="38" height="32" viewBox="0 0 38 32" fill="none" xmlns="http://www.w3.org/2000/svg">
            <line x1="3" y1="10" x2="30" y2="10" stroke="#b09a88" stroke-width="2.5" stroke-linecap="round"/>
            <polyline points="23,5 30,10 23,15" stroke="#b09a88" stroke-width="2.5" stroke-linecap="round" stroke-linejoin="round" fill="none"/>
            <line x1="35" y1="22" x2="8" y2="22" stroke="#8a7060" stroke-width="2.5" stroke-linecap="round"/>
            <polyline points="15,17 8,22 15,27" stroke="#8a7060" stroke-width="2.5" stroke-linecap="round" stroke-linejoin="round" fill="none"/>
          </svg>
        </span>
        <h3>Drug Switching</h3>
        <p>Patient can't tolerate a specific side effect? Find which alternative drugs carry the lowest risk for that symptom.</p>
        <span class="guide-tag">INTOLERANCE</span>
      </div>
    </div>

    <h2 class="guide-section-title">How to Read the Bar Chart</h2>
    <div class="chart-explainer">
      <div class="mini-chart">
        <p class="mini-chart-title">Example — Drug Selection view</p>
        ${miniBars}
        <p style="font-size:0.78rem;color:#7d6e63;margin-top:0.7rem">← Longer bar = greater GI burden</p>
      </div>
      <div class="chart-annotations">
        <div class="annotation-item">
          <div class="annotation-icon">1</div>
          <p class="annotation-text"><strong>Bar length</strong> = mean additional GI events per 1,000 patients compared to placebo/control, averaged across selected outcomes.</p>
        </div>
        <div class="annotation-item">
          <div class="annotation-icon">2</div>
          <p class="annotation-text"><strong>Number on bar</strong> = exact value. A "+165" means 165 more patients per 1,000 experience that event vs. control.</p>
        </div>
        <div class="annotation-item">
          <div class="annotation-icon">3</div>
          <p class="annotation-text"><strong>Bar color</strong> identifies the drug (Drug Selection) or the outcome type (Patient Counseling). See color legends below.</p>
        </div>
        <div class="annotation-item">
          <div class="annotation-icon">4</div>
          <p class="annotation-text"><strong>Hover tooltip</strong> shows the GRADE certainty level and NNH (number needed to harm) where available.</p>
        </div>
      </div>
    </div>

    <h2 class="guide-section-title">GRADE Certainty — What the Badges Mean</h2>
    <div class="grade-legend-grid">
      <div class="grade-legend-item">
        <div class="grade-legend-badge grade-high">High</div>
        <p>Strong confidence the true effect is close to the estimate. Based on consistent, well-conducted RCTs.</p>
      </div>
      <div class="grade-legend-item">
        <div class="grade-legend-badge grade-moderate">Moderate</div>
        <p>Moderate confidence. The true effect is likely close to the estimate but may differ somewhat.</p>
      </div>
      <div class="grade-legend-item">
        <div class="grade-legend-badge grade-low">Low</div>
        <p>Limited confidence. The true effect may differ substantially from the estimate.</p>
      </div>
      <div class="grade-legend-item">
        <div class="grade-legend-badge grade-very_low">Very Low</div>
        <p>Very little confidence. True effect is likely different; estimate highly uncertain.</p>
      </div>
    </div>

    <h2 class="guide-section-title">Color Legend — Drugs (Drug Selection tab)</h2>
    <div class="swatch-grid">${drugSwatches}</div>

    <h2 class="guide-section-title">Color Legend — GI Outcomes (Patient Counseling tab)</h2>
    <div class="swatch-grid swatch-grid-2">${outcomeSwatches}</div>

    <h2 class="guide-section-title">Tips</h2>
    <div class="tips-box">
      <ul>
        <li>Uncheck outcomes not relevant to your patient to isolate the risk profile you care about.</li>
        <li>Use <em>Custom baseline risk</em> sliders if your patient population has higher or lower background rates than study averages.</li>
        <li>NNH (number needed to harm) tells you how many patients need to be treated for one additional adverse event to occur — lower NNH = higher absolute risk.</li>
        <li>Results reflect group-level NMA estimates. Individual patient risk depends on dose, duration, and comorbidities.</li>
        <li>GERD baseline data are pending verification; GERD absolute risk estimates are not displayed until confirmed.</li>
      </ul>
    </div>

  </div>
  `;
}

// ─── Start ────────────────────────────────────────────────────────────────────
document.addEventListener('DOMContentLoaded', init);
