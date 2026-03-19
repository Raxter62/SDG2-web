let rawData = [];
let currentCountry = "";

const FILE_PREV = 'share-healthy-diet-unaffordable.csv';
const FILE_NUM = 'number-healthy-diet-unaffordable.csv';
const FILE_COMBINED = 'combined_selected_countries.csv';
const FILE_UNDERNOURISHED = 'number-undernourished.csv';

const yearSelect = document.getElementById('yearSelect');
const metricSelect = document.getElementById('metricSelect');
const countryInput = document.getElementById('countryInput');
const countryList = document.getElementById('countryList');
const reloadBtn = document.getElementById('reloadBtn');
const statusBox = document.getElementById('statusBox');

const regionMap = {
  "Africa": "Africa",
  "Asia": "Asia",
  "Europe": "Europe",
  "North America": "North America",
  "South America": "South America",
  "Oceania": "Oceania"
};

function uniq(arr) { return [...new Set(arr)]; }
function num(v) {
  if (v === null || v === undefined || v === "") return null;
  const x = Number(String(v).replace(/,/g, ""));
  return Number.isFinite(x) ? x : null;
}
function fmt(n, digits = 1) {
  return (n === null || n === undefined || Number.isNaN(n)) ? "-" : Number(n).toFixed(digits);
}
function setEnabled(state) {
  yearSelect.disabled = !state;
  metricSelect.disabled = !state;
  countryInput.disabled = !state;
}
function setStatus(msg) { statusBox.textContent = msg; }
function setEmpty(id, msg) { document.getElementById(id).innerHTML = `<div class="empty">${msg}</div>`; }
function resetStats() {
  document.getElementById('avgPrev').textContent = "-";
  document.getElementById('sumNum').textContent = "-";
  document.getElementById('countryCount').textContent = "-";
}
function resetUI(msg = "尚未載入資料") {
  rawData = [];
  setEnabled(false);
  yearSelect.innerHTML = `<option>${msg}</option>`;
  countryInput.value = "";
  countryInput.placeholder = msg;
  if (countryList) countryList.innerHTML = "";
  setEmpty("mapChart", msg);
  setEmpty("scatterChart", msg);
  setEmpty("lineChart", msg);
  setEmpty("barChart", msg);
  setEmpty("worldUndernourishmentChart", msg);
  setEmpty("countryUndernourishmentChart", msg);
  setEmpty("worldHungerChart", msg);
  setEmpty("countryHungerChart", msg);
}
function splitCSVLine(line) {
  const out = []; let cur = ""; let inQ = false;
  for (let i = 0; i < line.length; i++) {
    const ch = line[i];
    if (ch === '"') {
      if (inQ && line[i + 1] === '"') { cur += '"'; i++; }
      else inQ = !inQ;
    } else if (ch === "," && !inQ) {
      out.push(cur); cur = "";
    } else cur += ch;
  }
  out.push(cur);
  return out;
}
function parseCsv(text) {
  const lines = text.trim().split(/\r?\n/);
  const headers = splitCSVLine(lines[0]).map(h => h.trim().replace(/^"|"$/g, ""));
  return lines.slice(1).filter(Boolean).map(line => {
    const parts = splitCSVLine(line);
    const obj = {};
    headers.forEach((h, i) => obj[h] = (parts[i] || "").trim().replace(/^"|"$/g, ""));
    return obj;
  });
}
function inferRegion(entity) {
  if (entity === "World") return "World";
  const parts = String(entity).split(" - ");
  return regionMap[parts[0]] || "Other";
}
function normalizeOwidShare(rows) {
  const lower = Object.keys(rows[0] || {}).reduce((m, k) => { m[k.toLowerCase()] = k; return m; }, {});
  const entityK = lower["entity"], codeK = lower["code"], yearK = lower["year"];
  const valK = lower["share of population that cannot afford a healthy diet"]
    || lower["prevalence of unaffordability of a healthy diet"]
    || lower["share of the population who cannot afford a healthy diet"];
  if (!entityK || !yearK || !valK) throw new Error("share CSV 欄位格式無法辨識");
  return rows
    .map(r => ({
      country: r[entityK],
      iso3: r[codeK] || null,
      region: inferRegion(r[entityK]),
      year: num(r[yearK]),
      prev_unaffordable: num(r[valK])
    }))
    .filter(r => r.country && r.year && r.iso3 && r.country !== "World");
}
function normalizeOwidNum(rows) {
  const lower = Object.keys(rows[0] || {}).reduce((m, k) => { m[k.toLowerCase()] = k; return m; }, {});
  const entityK = lower["entity"], codeK = lower["code"], yearK = lower["year"];
  const valK = lower["number of people who cannot afford a healthy diet"] || lower["millions who cannot afford a healthy diet"] || lower["number unable to afford a healthy diet"];
  if (!entityK || !yearK || !valK) throw new Error("number CSV 欄位格式無法辨識");
  return rows
    .map(r => ({
      country: r[entityK],
      iso3: r[codeK] || null,
      region: inferRegion(r[entityK]),
      year: num(r[yearK]),
      num_unaffordable_millions: num(r[valK]) / 1000000
    }))
    .filter(r => r.country && r.year && r.iso3 && r.country !== "World");
}
function normalizeOwidUndernourished(rows) {
  const lower = Object.keys(rows[0] || {}).reduce((m, k) => { m[k.toLowerCase()] = k; return m; }, {});
  const entityK = lower["entity"], codeK = lower["code"], yearK = lower["year"];
  const valK = lower["number of people that are undernourished"];
  if (!entityK || !yearK || !valK) throw new Error("undernourished CSV 欄位格式無法辨識");
  return rows
    .map(r => ({
      country: r[entityK],
      iso3: r[codeK] || null,
      region: inferRegion(r[entityK]),
      year: num(r[yearK]),
      num_undernourished: num(r[valK])
    }))
    .filter(r => r.country && r.year);
}
function normalizeCombined(rows) {
  const lower = Object.keys(rows[0] || {}).reduce((m, k) => { m[k.toLowerCase()] = k; return m; }, {});
  const countryK = lower["country"], iso3K = lower["iso3"], yearK = lower["year"];
  const undernourishmentK = lower["prevalence_of_undernourishment_percent_3yr_avg"];
  const severeK = lower["prevalence_of_severe_food_insecurity_percent_3yr_avg"];
  if (!countryK || !iso3K || !yearK) throw new Error("combined CSV 欄位格式無法辨識");
  return rows
    .map(r => ({
      country: r[countryK],
      iso3: r[iso3K],
      region: inferRegion(r[countryK]),
      year: num(r[yearK]),
      undernourishment_percent: num(r[undernourishmentK]),
      severe_food_insecurity_percent: num(r[severeK])
    }))
    .filter(r => r.country && r.year && r.iso3);
}
function mergeData(prevRows, numRows, combinedRows, undernourishRows) {
  const grouped = {};
  [...prevRows, ...numRows, ...combinedRows, ...undernourishRows].forEach(r => {
    const id = `${r.country}|${r.iso3}|${r.year}`;
    if (!grouped[id]) {
      grouped[id] = {
        country: r.country,
        iso3: r.iso3,
        region: r.region || "Other",
        year: r.year,
        prev_unaffordable: null,
        num_unaffordable_millions: null,
        undernourishment_percent: null,
        severe_food_insecurity_percent: null,
        num_undernourished: null
      };
    }
    if (r.prev_unaffordable !== undefined) grouped[id].prev_unaffordable = r.prev_unaffordable;
    if (r.num_unaffordable_millions !== undefined) grouped[id].num_unaffordable_millions = r.num_unaffordable_millions;
    if (r.undernourishment_percent !== undefined) grouped[id].undernourishment_percent = r.undernourishment_percent;
    if (r.severe_food_insecurity_percent !== undefined) grouped[id].severe_food_insecurity_percent = r.severe_food_insecurity_percent;
    if (r.num_undernourished !== undefined) grouped[id].num_undernourished = r.num_undernourished;
  });
  return Object.values(grouped).filter(r => r.country && r.iso3 && r.year);
}
function fillSelectors(data) {
  const years = uniq(data.map(d => d.year)).filter(Boolean).sort((a, b) => a - b);
  yearSelect.innerHTML = years.map(y => `<option value="${y}">${y}</option>`).join("");
  yearSelect.value = years[years.length - 1];

  const countries = uniq(data.map(d => d.country)).sort();
  if (countryList) countryList.innerHTML = countries.map(c => `<option value="${c}"></option>`).join("");
  currentCountry = countries.includes("Taiwan") ? "Taiwan" : countries[0];
  countryInput.value = currentCountry;
}
function getFilteredYearData() {
  const year = Number(yearSelect.value);
  return rawData.filter(d => d.year === year);
}
function getSeries(country) {
  return rawData.filter(d => d.country === country).sort((a, b) => a.year - b.year);
}
function updateStats(data) {
  const prevData = data.map(d => d.prev_unaffordable).filter(v => v !== null);
  const numData = data.map(d => d.num_unaffordable_millions).filter(v => v !== null);
  const avgPrev = prevData.length ? prevData.reduce((a, b) => a + b, 0) / prevData.length : null;
  const sumNum = numData.length ? numData.reduce((a, b) => a + b, 0) : null;
  document.getElementById('avgPrev').textContent = avgPrev === null ? "-" : fmt(avgPrev, 1) + "%";
  document.getElementById('sumNum').textContent = sumNum === null ? "-" : fmt(sumNum, 1) + "M";
  document.getElementById('countryCount').textContent = data.length;
}
function drawMap(data) {
  const metric = metricSelect.value;
  const valueKey = metric === "prev" ? "prev_unaffordable" : "num_unaffordable_millions";
  const title = metric === "prev" ? "無法負擔健康飲食比例" : "無法負擔健康飲食人數";
  const usable = data.filter(d => d.iso3 && d[valueKey] !== null && d[valueKey] !== undefined);
  if (!usable.length) { setEmpty("mapChart", "目前資料沒有可繪製的地圖值"); return; }

  Plotly.newPlot("mapChart", [{
    type: "choropleth",
    locationmode: "ISO-3",
    locations: usable.map(d => d.iso3),
    z: usable.map(d => d[valueKey]),
    text: usable.map(d => `${d.country}<br>${title}：${fmt(d[valueKey], 1)}${metric === "prev" ? "%" : " 百萬人"}`),
    colorscale: metric === "prev" ? "Reds" : "Viridis",
    marker: { line: { color: "#0b1020", width: 0.4 } },
    hovertemplate: "%{text}<extra></extra>"
  }], {
    paper_bgcolor: "#121936",
    plot_bgcolor: "#121936",
    margin: { l: 0, r: 0, t: 0, b: 0 },
    font: { color: "#eef2ff" },
    geo: { bgcolor: "#121936", showframe: false, showcoastlines: true, coastlinecolor: "#6c7fb8", projection: { type: "natural earth" }, showocean: true, oceancolor: "#0d1532" }
  }, { displayModeBar: false, responsive: true });
}
function drawScatter(data) {
  const usable = data.filter(d => d.prev_unaffordable !== null && d.num_unaffordable_millions !== null);
  if (!usable.length) { setEmpty("scatterChart", "目前資料沒有可繪製的散點值"); return; }

  Plotly.newPlot("scatterChart", [{
    type: "scatter",
    mode: "markers+text",
    x: usable.map(d => d.prev_unaffordable),
    y: usable.map(d => d.num_unaffordable_millions),
    text: usable.map(d => d.country),
    textposition: "top center",
    marker: {
      size: usable.map(d => Math.max(10, Math.sqrt(d.num_unaffordable_millions || 1) * 1.8)),
      color: usable.map(d => d.prev_unaffordable || 0),
      colorscale: "Turbo",
      line: { color: "#dfe8ff", width: 0.8 },
      opacity: 0.85
    },
    hovertemplate: "<b>%{text}</b><br>無法負擔比例：%{x:.1f}%<br>無法負擔人數：%{y:.1f} 百萬人<extra></extra>"
  }], {
    paper_bgcolor: "#121936",
    plot_bgcolor: "#121936",
    margin: { l: 55, r: 20, t: 20, b: 55 },
    font: { color: "#eef2ff" },
    xaxis: { title: "無法負擔健康飲食比例（%）", gridcolor: "#314073" },
    yaxis: { title: "無法負擔健康飲食人數（百萬人）", gridcolor: "#314073" }
  }, { displayModeBar: false, responsive: true });
}
function drawLine(country) {
  const s = getSeries(country).filter(d => d.prev_unaffordable !== null || d.num_unaffordable_millions !== null);
  if (!s.length) { setEmpty("lineChart", "目前資料沒有這個國家的時間序列"); return; }

  // Update the title dynamically
  const titleElement = document.querySelector("#lineChart").parentElement.querySelector("h3");
  if (titleElement) titleElement.textContent = `${country} 時間序列`;

  Plotly.newPlot("lineChart", [
    { type: "scatter", mode: "lines+markers", name: "比例", x: s.map(d => d.year), y: s.map(d => d.prev_unaffordable), yaxis: "y1", line: { width: 3 } },
    { type: "scatter", mode: "lines+markers", name: "人數", x: s.map(d => d.year), y: s.map(d => d.num_unaffordable_millions), yaxis: "y2", line: { width: 3 } }
  ], {
    paper_bgcolor: "#121936",
    plot_bgcolor: "#121936",
    margin: { l: 55, r: 55, t: 20, b: 45 },
    font: { color: "#eef2ff" },
    xaxis: { title: "年份", gridcolor: "#314073" },
    yaxis: { title: "比例（%）", gridcolor: "#314073" },
    yaxis2: { title: "人數（百萬人）", overlaying: "y", side: "right" },
    legend: { orientation: "h", y: 1.12 }
  }, { displayModeBar: false, responsive: true });
}
function drawBar(data) {
  const metric = metricSelect.value;
  const key = metric === "prev" ? "prev_unaffordable" : "num_unaffordable_millions";
  const title = metric === "prev" ? "無法負擔健康飲食比例" : "無法負擔健康飲食人數";
  const usable = data.filter(d => d[key] !== null && d[key] !== undefined);
  if (!usable.length) { setEmpty("barChart", "目前資料沒有可排行的數值"); return; }
  const top = [...usable].sort((a, b) => b[key] - a[key]).slice(0, 15).reverse();

  Plotly.newPlot("barChart", [{
    type: "bar", orientation: "h",
    x: top.map(d => d[key]), y: top.map(d => d.country),
    text: top.map(d => fmt(d[key], 1)), textposition: "outside",
    hovertemplate: `<b>%{y}</b><br>${title}：%{x}<extra></extra>`
  }], {
    paper_bgcolor: "#121936",
    plot_bgcolor: "#121936",
    margin: { l: 130, r: 30, t: 20, b: 40 },
    font: { color: "#eef2ff" },
    xaxis: { title: title, gridcolor: "#314073" },
    yaxis: { automargin: true }
  }, { displayModeBar: false, responsive: true });
}
function drawWorldUndernourishment() {
  const worldData = rawData.filter(d => d.country === "World").sort((a, b) => a.year - b.year);
  if (!worldData.length) { setEmpty("worldUndernourishmentChart", "目前資料沒有世界的營養不良數據"); return; }

  Plotly.newPlot("worldUndernourishmentChart", [
    { type: "scatter", mode: "lines+markers", name: "營養不良比例", x: worldData.map(d => d.year), y: worldData.map(d => d.undernourishment_percent), line: { width: 3 } },
    { type: "scatter", mode: "lines+markers", name: "嚴重食物不安全比例", x: worldData.map(d => d.year), y: worldData.map(d => d.severe_food_insecurity_percent), line: { width: 3 } }
  ], {
    paper_bgcolor: "#121936",
    plot_bgcolor: "#121936",
    margin: { l: 55, r: 20, t: 20, b: 55 },
    font: { color: "#eef2ff" },
    xaxis: { title: "年份", gridcolor: "#314073" },
    yaxis: { title: "比例（%）", gridcolor: "#314073" },
    legend: { orientation: "h", y: 1.12 }
  }, { displayModeBar: false, responsive: true });
}
function drawCountryUndernourishment(country) {
  const s = getSeries(country).filter(d => d.undernourishment_percent !== null || d.severe_food_insecurity_percent !== null);
  if (!s.length) { setEmpty("countryUndernourishmentChart", "目前資料沒有這個國家的營養不良數據"); return; }

  // Update the title dynamically
  const titleElement = document.querySelector("#countryUndernourishmentChart").parentElement.querySelector("h3");
  if (titleElement) titleElement.textContent = `${country} 營養不良指數`;

  Plotly.newPlot("countryUndernourishmentChart", [
    { type: "scatter", mode: "lines+markers", name: "營養不良比例", x: s.map(d => d.year), y: s.map(d => d.undernourishment_percent), line: { width: 3 } },
    { type: "scatter", mode: "lines+markers", name: "嚴重食物不安全比例", x: s.map(d => d.year), y: s.map(d => d.severe_food_insecurity_percent), line: { width: 3 } }
  ], {
    paper_bgcolor: "#121936",
    plot_bgcolor: "#121936",
    margin: { l: 55, r: 20, t: 20, b: 55 },
    font: { color: "#eef2ff" },
    xaxis: { title: "年份", gridcolor: "#314073" },
    yaxis: { title: "比例（%）", gridcolor: "#314073" },
    legend: { orientation: "h", y: 1.12 }
  }, { displayModeBar: false, responsive: true });
}
function drawWorldHunger() {
  const worldData = rawData.filter(d => d.country === "World" && d.num_undernourished !== null).sort((a, b) => a.year - b.year);
  if (!worldData.length) { setEmpty("worldHungerChart", "目前資料沒有世界飢餓人口數據"); return; }

  Plotly.newPlot("worldHungerChart", [
    { type: "scatter", mode: "lines+markers", name: "飢餓人口", x: worldData.map(d => d.year), y: worldData.map(d => d.num_undernourished), line: { width: 3, color: "#ff5722" } }
  ], {
    paper_bgcolor: "#121936",
    plot_bgcolor: "#121936",
    margin: { l: 70, r: 20, t: 20, b: 55 },
    font: { color: "#eef2ff" },
    xaxis: { title: "年份", gridcolor: "#314073" },
    yaxis: { title: "飢餓人口（人）", gridcolor: "#314073" }
  }, { displayModeBar: false, responsive: true });
}
function drawCountryHunger(country) {
  const s = getSeries(country).filter(d => d.num_undernourished !== null);
  if (!s.length) { setEmpty("countryHungerChart", "目前資料沒有這個國家的飢餓人口數據"); return; }

  const titleElement = document.querySelector("#countryHungerChart").parentElement.querySelector("h3");
  if (titleElement) titleElement.textContent = `${country} 飢餓人口`;

  Plotly.newPlot("countryHungerChart", [
    { type: "scatter", mode: "lines+markers", name: "飢餓人口", x: s.map(d => d.year), y: s.map(d => d.num_undernourished), line: { width: 3, color: "#ff5722" } }
  ], {
    paper_bgcolor: "#121936",
    plot_bgcolor: "#121936",
    margin: { l: 70, r: 20, t: 20, b: 55 },
    font: { color: "#eef2ff" },
    xaxis: { title: "年份", gridcolor: "#314073" },
    yaxis: { title: "飢餓人口（人）", gridcolor: "#314073" }
  }, { displayModeBar: false, responsive: true });
}
function redrawAll() {
  if (!rawData.length) return;
  const yearData = getFilteredYearData();
  updateStats(yearData);
  drawMap(yearData);
  drawScatter(yearData);
  drawBar(yearData);
  drawLine(countryInput.value);
  drawWorldUndernourishment();
  drawCountryUndernourishment(countryInput.value);
  drawWorldHunger();
  drawCountryHunger(countryInput.value);
}
async function loadLocalData() {
  try {
    console.log("Starting to load data...");
    setStatus("正在讀取同資料夾中的官方 CSV 檔案…");
    console.log("Fetching:", FILE_PREV, FILE_NUM, FILE_COMBINED, FILE_UNDERNOURISHED);
    const [respPrev, respNum, respCombined, respUndernourish] = await Promise.all([fetch(FILE_PREV), fetch(FILE_NUM), fetch(FILE_COMBINED), fetch(FILE_UNDERNOURISHED)]);
    console.log("Fetch responses:", respPrev.status, respNum.status, respCombined.status, respUndernourish.status);
    if (!respPrev.ok) throw new Error(`找不到 ${FILE_PREV} (status: ${respPrev.status})`);
    if (!respNum.ok) throw new Error(`找不到 ${FILE_NUM} (status: ${respNum.status})`);
    if (!respCombined.ok) throw new Error(`找不到 ${FILE_COMBINED} (status: ${respCombined.status})`);
    if (!respUndernourish.ok) throw new Error(`找不到 ${FILE_UNDERNOURISHED} (status: ${respUndernourish.status})`);
    const [textPrev, textNum, textCombined, textUndernourish] = await Promise.all([respPrev.text(), respNum.text(), respCombined.text(), respUndernourish.text()]);
    console.log("Text lengths:", textPrev.length, textNum.length, textCombined.length, textUndernourish.length);
    const prevRows = normalizeOwidShare(parseCsv(textPrev));
    const numRows = normalizeOwidNum(parseCsv(textNum));
    const combinedRows = normalizeCombined(parseCsv(textCombined));
    const undernourishRows = normalizeOwidUndernourished(parseCsv(textUndernourish));
    rawData = mergeData(prevRows, numRows, combinedRows, undernourishRows);
    if (!rawData.length) throw new Error("四個 CSV 讀取成功，但合併後沒有資料。");
    fillSelectors(rawData);
    setEnabled(true);
    redrawAll();
    setStatus(`已載入 ${rawData.length} 筆國家年度資料。`);
  } catch (err) {
    console.error("Error loading data:", err);
    resetUI("讀不到資料");
    setStatus("讀取失敗：" + err.message + "。若你是直接雙擊 HTML 打開，請改用 VS Code Live Server 或本機伺服器。");
  }
}

[yearSelect, metricSelect].forEach(el => el.addEventListener('change', redrawAll));

countryInput.addEventListener('focus', function() {
  this.value = '';
});

countryInput.addEventListener('blur', function() {
  if (this.value.trim() === '') {
    this.value = currentCountry;
  }
});

countryInput.addEventListener('change', function() {
  const allCountries = uniq(rawData.map(d => d.country));
  const val = this.value.trim().toLowerCase();
  const match = allCountries.find(c => c.toLowerCase() === val);
  
  if (match) {
    currentCountry = match;
    this.value = match;
    redrawAll();
  } else {
    this.value = currentCountry;
  }
});

reloadBtn.addEventListener('click', loadLocalData);

const confirmBtn = document.getElementById('confirmBtn');
const hamburger = document.getElementById('hamburger');
const controls = document.getElementById('controls');
hamburger.addEventListener('click', () => {
  controls.classList.toggle('open');
});
confirmBtn.addEventListener('click', () => {
  hamburger.click();
});

resetUI("載入中");
loadLocalData();