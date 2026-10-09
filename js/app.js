// app.js — render Dashboard ADO (statis, tanpa backend)
(function () {
  'use strict';
  var T = ADO.totals, M = ADO.meta, AN = ADO.anomalies;
  var fmt = function (n) { return (n === null || n === undefined) ? '—' : n.toLocaleString('id-ID'); };
  var pct = function (v) { return (v === null || v === undefined) ? '—' : v.toLocaleString('id-ID', {minimumFractionDigits: 1, maximumFractionDigits: 1}) + '%'; };
  var DEBUG = {leaflet: false, polygons: 0, odcMarkers: 0, feederLines: 0};
  window.ADO_DEBUG = DEBUG;

  document.getElementById('dataDate').textContent = M.dataDate;
  document.getElementById('genDate').textContent = M.generated;
  document.getElementById('footGen').textContent = M.generated;
  document.getElementById('mapNote').textContent = M.notePolygon;

  /* ---------- KPI ---------- */
  var kpis = [
    {label: 'STO', num: fmt(T.n_sto), sub: 'di 2 area (Kota + Depok)', cls: ''},
    {label: 'Feeder', num: fmt(T.n_feeder), sub: 'kabel unik · ' + fmt(T.n_seg) + ' segmen', cls: 'teal'},
    {label: 'ODC', num: fmt(T.n_odc), sub: 'unit aktif', cls: ''},
    {label: 'Kapasitas Feeder', num: fmt(T.fe_cap), sub: 'core · used ' + fmt(T.fe_used) + ' · idle ' + fmt(T.fe_idle), cls: 'teal'},
    {label: 'Kapasitas ODC', num: fmt(T.odc_kap_akt), sub: 'port aktual · used ' + fmt(T.odc_used) + ' · idle ' + fmt(T.odc_idle), cls: 'blue'},
    {label: 'Okupansi Feeder', num: pct(T.fe_occ), sub: 'used / kapasitas core', cls: 'teal'},
    {label: 'Okupansi ODC', num: pct(T.odc_occ), sub: 'port used / kapasitas aktual', cls: 'blue'}
  ];
  document.getElementById('kpis').innerHTML = kpis.map(function (k) {
    return '<div class="kpi ' + k.cls + '"><div class="k-label">' + k.label + '</div>' +
      '<div class="k-num">' + k.num + '</div><div class="k-sub">' + k.sub + '</div></div>';
  }).join('');

  var WARN_ICON = '<svg class="ic-warn" viewBox="0 0 16 16" fill="currentColor" aria-hidden="true"><path d="M8 1.5 15 14H1L8 1.5zm-.75 4.5v4h1.5v-4h-1.5zM8 11.4a.85.85 0 1 0 0 1.7.85.85 0 0 0 0-1.7z"/></svg>';

  /* ---------- anomali ---------- */
  var anoms = [
    {n: AN.fe_kosong, l: 'kabel feeder tanpa FTM (folder KOSONG) — mayoritas tanpa data kapasitas'},
    {n: AN.fe_math, l: 'kabel feeder: Used+Idle+Spare ≠ Capacity'},
    {n: AN.odc_aktpot, l: 'ODC: Kap_Aktual > Kap_Potensial (tidak logis)'},
    {n: AN.odc_dirty, l: 'ODC: ada field non-numerik (mis. teks "KOSONG")'},
    {n: AN.fe_nonfe, l: 'Placemark non-FE di file feeder (FA-, DS-, FCL-, R04-, typo nama)'},
    {n: AN.odc_dup, l: 'nama ODC duplikat dalam satu file'}
  ];
  document.getElementById('anoms').innerHTML = anoms.map(function (a) {
    return '<div class="anom"><div class="a-num">' + fmt(a.n) + '</div><div class="a-label">' + a.l + '</div></div>';
  }).join('');
  document.getElementById('anomNote').textContent =
    'Angka dashboard memakai data apa adanya dari ALPOR; kabel tanpa data kapasitas tidak dihitung di total kapasitas. Rincian per objek ada di file audit (feeder_cables.csv / odc.csv).';

  /* ---------- legend ---------- */
  document.getElementById('legend').innerHTML = ADO.sto.map(function (s) {
    return '<span class="lg"><i style="background:' + s.color + '"></i>' + s.code + '</span>';
  }).join('');

  /* ---------- chips ---------- */
  var chipsEl = document.getElementById('chips');
  chipsEl.innerHTML = ADO.sto.map(function (s) {
    var area = s.area === 'BEKASI KOTA' ? 'Kota' : 'Depok';
    var feOcc = s.fe_occ === null ? 0 : s.fe_occ;
    var odcOcc = s.odc_occ === null ? 0 : s.odc_occ;
    var flag = s.fe_kosong > 0 ? '<div class="c-flag">' + WARN_ICON + ' ' + s.fe_kosong + ' kabel tanpa FTM/kapasitas</div>' : '';
    return '<div class="chip" data-sto="' + s.code + '">' +
      '<div class="c-head"><span class="dot" style="background:' + s.color + '"></span>' +
      '<span class="c-code">' + s.code + '</span><span class="c-area" style="background:' + s.color + '">' + area + '</span></div>' +
      '<div class="c-counts"><span>Feeder <b>' + s.n_feeder + '</b></span><span>ODC <b>' + s.n_odc + '</b></span></div>' +
      '<div class="mini"><div class="m-label"><span>Okup. FE</span><span>' + pct(s.fe_occ) + '</span></div>' +
      '<div class="bar bar-fe"><i style="width:' + Math.min(feOcc, 100) + '%"></i></div></div>' +
      '<div class="mini"><div class="m-label"><span>Okup. ODC</span><span>' + pct(s.odc_occ) + '</span></div>' +
      '<div class="bar bar-odc"><i style="width:' + Math.min(odcOcc, 100) + '%"></i></div></div>' +
      flag + '</div>';
  }).join('');

  /* ---------- tabel ---------- */
  var tb = document.querySelector('#stoTable tbody');
  tb.innerHTML = ADO.sto.map(function (s) {
    function cell(v) { return '<td>' + fmt(v) + '</td>'; }
    function occTd(v) {
      var w = (v === null) ? 0 : Math.min(v, 100);
      return '<td><div class="tbar"><div class="bar bar-fe"><i style="width:' + w + '%"></i></div><span>' + pct(v) + '</span></div></td>';
    }
    function occTdOdc(v) {
      var w = (v === null) ? 0 : Math.min(v, 100);
      return '<td><div class="tbar"><div class="bar bar-odc"><i style="width:' + w + '%"></i></div><span>' + pct(v) + '</span></div></td>';
    }
    var area = s.area === 'BEKASI KOTA' ? 'Bekasi Kota' : 'Bekasi Depok';
    return '<tr data-sto="' + s.code + '">' +
      '<td class="sto-cell" style="color:' + s.color + '">' + s.code + '</td>' +
      '<td>' + area + '</td>' +
      cell(s.n_feeder) + cell(s.fe_cap) + cell(s.fe_used) + cell(s.fe_idle) + occTd(s.fe_occ) +
      cell(s.n_odc) + cell(s.odc_kap_akt) + cell(s.odc_used) + cell(s.odc_idle) + occTdOdc(s.odc_occ) +
      '</tr>';
  }).join('');
  document.querySelector('#stoTable tfoot').innerHTML =
    '<tr><td>TOTAL</td><td>10 STO</td>' +
    '<td>' + fmt(T.n_feeder) + '</td><td>' + fmt(T.fe_cap) + '</td><td>' + fmt(T.fe_used) + '</td><td>' + fmt(T.fe_idle) + '</td><td>' + pct(T.fe_occ) + '</td>' +
    '<td>' + fmt(T.n_odc) + '</td><td>' + fmt(T.odc_kap_akt) + '</td><td>' + fmt(T.odc_used) + '</td><td>' + fmt(T.odc_idle) + '</td><td>' + pct(T.odc_occ) + '</td></tr>';

  /* ---------- peta ---------- */
  var byCode = {};
  ADO.sto.forEach(function (s) { byCode[s.code] = s; });

  function chipAction(code) {
    document.querySelectorAll('.chip').forEach(function (c) { c.classList.toggle('active', c.dataset.sto === code); });
    document.querySelectorAll('#stoTable tbody tr').forEach(function (r) { r.classList.toggle('hl', r.dataset.sto === code); });
    if (DEBUG.leaflet && DEBUG.layerAreas[code]) {
      DEBUG.map.flyToBounds(DEBUG.layerAreas[code].getBounds(), {padding: [30, 30]});
    }
    var row = document.querySelector('#stoTable tbody tr[data-sto="' + code + '"]');
    if (row) row.scrollIntoView({behavior: 'smooth', block: 'center'});
    renderDetail(code);
  }
  chipsEl.addEventListener('click', function (e) {
    var chip = e.target.closest('.chip');
    if (chip) chipAction(chip.dataset.sto);
  });

  /* ---------- DRILL-DOWN DETAIL INVENTORY PER STO ---------- */
  var FE_KEYS = ['sto', 'name', 'spec', 'cap', 'used', 'idle', 'spare', 'flags', 'segs', 'ftm'];
  var ODC_KEYS = ['sto', 'name', 'spec', 'kap_akt', 'used', 'lat', 'lon', 'flags', 'kap_pot'];
  var feObjects = ADO.feeders.map(function (r) {
    var o = {};
    FE_KEYS.forEach(function (k, i) { o[k] = r[i]; });
    return o;
  });
  var odcObjects = ADO.odc.map(function (r) {
    var o = {};
    ODC_KEYS.forEach(function (k, i) { o[k] = r[i]; });
    return o;
  });

  var state = {
    fe: {sort: 'name', dir: 1, q: ''},
    odc: {sort: 'name', dir: 1, q: ''}
  };

  var selEl = document.getElementById('stoSelect');
  selEl.innerHTML = ADO.sto.map(function (s) {
    return '<option value="' + s.code + '">' + s.code + ' — ' + (s.area === 'BEKASI KOTA' ? 'Bekasi Kota' : 'Bekasi Depok') + '</option>';
  }).join('');
  selEl.addEventListener('change', function () { chipAction(selEl.value); });

  function occCalc(used, cap) { return (cap && used !== null) ? used / cap * 100 : null; }

  function statusFlags(flags, mathOrPot) {
    var out = [];
    if (flags & 1) out.push('<span class="st warn">no FTM/kapasitas</span>');
    if (mathOrPot) out.push('<span class="st warn">data perlu dicek</span>');
    if (!out.length) out.push('<span class="st ok">OK</span>');
    return out.join('<br>');
  }

  function getFiltered(list, sto, q, sort, dir) {
    var ql = q.toLowerCase();
    var rows = list.filter(function (o) { return o.sto === sto; });
    if (ql) rows = rows.filter(function (o) {
      return (o.name + ' ' + (o.spec || '') + ' ' + (o.ftm || '')).toLowerCase().indexOf(ql) >= 0;
    });
    rows = rows.slice().sort(function (a, b) {
      var x = a[sort], y = b[sort];
      if (x === null || x === undefined || x === '') return 1;
      if (y === null || y === undefined || y === '') return -1;
      if (typeof x === 'number' && typeof y === 'number') return (x - y) * dir;
      return String(x).localeCompare(String(y)) * dir;
    });
    return rows;
  }

  function renderDetail(code) {
    var sel = selEl;
    if (sel.value !== code) sel.value = code;
    var s = byCode[code];
    var body = document.getElementById('detailBody');
    var label = document.getElementById('detailStoLabel');
    label.textContent = '— ' + code + ' (' + (s.area === 'BEKASI KOTA' ? 'Bekasi Kota' : 'Bekasi Depok') + ') · ' +
      s.n_feeder + ' feeder · ' + s.n_odc + ' ODC';

    /* ---- blok FEEDER ---- */
    var feRows = getFiltered(feObjects, code, state.fe.q, state.fe.sort, state.fe.dir);
    var feSum = {cap: 0, used: 0, idle: 0, spare: 0};
    feRows.forEach(function (f) { feSum.cap += f.cap || 0; feSum.used += f.used || 0; feSum.idle += f.idle || 0; feSum.spare += f.spare || 0; });
    body.innerHTML =
      '<div class="d-block">' +
      '<div class="d-head"><h3>Feeder — ' + feRows.length + ' kabel' + (state.fe.q ? ' (dari ' + s.n_feeder + ', difilter)' : '') + '</h3>' +
      '<div class="d-tools"><input class="tbl-search" id="feSearch" placeholder="Cari nama / spec / FTM…" value="' + state.fe.q.replace(/"/g, '&quot;') + '">' +
      '<span class="count">Klik judul kolom untuk sort</span></div></div>' +
      '<div class="tbl-wrap"><table id="feDetailTable"><thead><tr>' +
      '<th class="sortable" data-k="name" data-t="fe">Kabel Feeder ⇅</th>' +
      '<th class="sortable" data-k="ftm" data-t="fe">FTM ⇅</th>' +
      '<th class="sortable" data-k="spec" data-t="fe">Spec ⇅</th>' +
      '<th class="sortable" data-k="cap" data-t="fe">Kapasitas (core) ⇅</th>' +
      '<th class="sortable" data-k="used" data-t="fe">Used ⇅</th>' +
      '<th class="sortable" data-k="idle" data-t="fe">Idle ⇅</th>' +
      '<th class="sortable" data-k="spare" data-t="fe">Spare ⇅</th>' +
      '<th>Okupansi</th><th>Status</th></tr></thead><tbody>' +
      feRows.map(function (f) {
        var occ = occCalc(f.used, f.cap);
        var w = occ === null ? 0 : Math.min(occ, 100);
        return '<tr data-feeder="' + f.name + '">' +
          '<td class="name-cell">' + f.name + '</td>' +
          '<td class="dim">' + (f.ftm || '—') + '</td>' +
          '<td class="dim">' + (f.spec || '—') + '</td>' +
          '<td>' + fmt(f.cap) + '</td><td>' + fmt(f.used) + '</td><td>' + fmt(f.idle) + '</td><td>' + fmt(f.spare) + '</td>' +
          '<td><div class="tbar"><div class="bar bar-fe"><i style="width:' + w + '%"></i></div><span>' + pct(occ === null ? null : Math.round(occ * 10) / 10) + '</span></div></td>' +
          '<td>' + statusFlags(f.flags, f.flags & 2) + '</td></tr>';
      }).join('') +
      '</tbody><tfoot><tr><td>TOTAL (' + feRows.length + ')</td><td></td><td></td>' +
      '<td>' + fmt(feSum.cap) + '</td><td>' + fmt(feSum.used) + '</td><td>' + fmt(feSum.idle) + '</td><td>' + fmt(feSum.spare) + '</td>' +
      '<td>' + pct(feSum.cap ? Math.round(feSum.used / feSum.cap * 1000) / 10 : null) + '</td><td></td></tr></tfoot></table></div></div>';

    /* ---- blok ODC ---- */
    var odcRows = getFiltered(odcObjects, code, state.odc.q, state.odc.sort, state.odc.dir);
    var oSum = {akt: 0, used: 0, idle: 0};
    odcRows.forEach(function (o) {
      oSum.akt += o.kap_akt || 0; oSum.used += o.used || 0;
      oSum.idle += (o.kap_akt || 0) - (o.used || 0);
    });
    body.insertAdjacentHTML('beforeend',
      '<div class="d-block">' +
      '<div class="d-head"><h3>ODC — ' + odcRows.length + ' unit' + (state.odc.q ? ' (dari ' + s.n_odc + ', difilter)' : '') + '</h3>' +
      '<div class="d-tools"><input class="tbl-search" id="odcSearch" placeholder="Cari nama / spec…" value="' + state.odc.q.replace(/"/g, '&quot;') + '">' +
      '<span class="count">Klik judul kolom untuk sort</span></div></div>' +
      '<div class="tbl-wrap"><table id="odcDetailTable"><thead><tr>' +
      '<th class="sortable" data-k="name" data-t="odc">Nama ODC ⇅</th>' +
      '<th class="sortable" data-k="spec" data-t="odc">Spec ⇅</th>' +
      '<th class="sortable" data-k="kap_pot" data-t="odc">Kap. Potensial ⇅</th>' +
      '<th class="sortable" data-k="kap_akt" data-t="odc">Kap. Aktual ⇅</th>' +
      '<th class="sortable" data-k="used" data-t="odc">Port Used ⇅</th>' +
      '<th>Port Idle</th><th>Okupansi</th><th>Status</th></tr></thead><tbody>' +
      odcRows.map(function (o) {
        var occ = occCalc(o.used, o.kap_akt);
        var w = occ === null ? 0 : Math.min(occ, 100);
        return '<tr data-odc="' + o.name + '">' +
          '<td class="name-cell">' + o.name + '</td>' +
          '<td class="dim">' + (o.spec || '—') + '</td>' +
          '<td>' + fmt(o.kap_pot) + '</td><td>' + fmt(o.kap_akt) + '</td><td>' + fmt(o.used) + '</td>' +
          '<td>' + fmt((o.kap_akt || 0) - (o.used || 0)) + '</td>' +
          '<td><div class="tbar"><div class="bar bar-odc"><i style="width:' + w + '%"></i></div><span>' + pct(occ === null ? null : Math.round(occ * 10) / 10) + '</span></div></td>' +
          '<td>' + statusFlags(o.flags, o.flags & 2) + '</td></tr>';
      }).join('') +
      '</tbody><tfoot><tr><td>TOTAL (' + odcRows.length + ')</td><td></td><td></td>' +
      '<td>' + fmt(oSum.akt) + '</td><td>' + fmt(oSum.used) + '</td><td>' + fmt(oSum.idle) + '</td>' +
      '<td>' + pct(oSum.akt ? Math.round(oSum.used / oSum.akt * 1000) / 10 : null) + '</td><td></td></tr></tfoot></table></div>' +
      '<p class="hint">Klik baris ODC/feeder untuk highlight lokasinya di peta.</p></div>');

    /* events: search & sort & row-highlight */
    body.querySelector('#feSearch').addEventListener('input', function (e) {
      state.fe.q = e.target.value;
      refreshTablesOnly(code);
    });
    body.querySelector('#odcSearch').addEventListener('input', function (e) {
      state.odc.q = e.target.value;
      refreshTablesOnly(code);
    });
    body.querySelectorAll('th.sortable').forEach(function (th) {
      th.addEventListener('click', function () {
        var t = th.dataset.t, k = th.dataset.k;
        if (state[t].sort === k) state[t].dir *= -1;
        else { state[t].sort = k; state[t].dir = 1; }
        refreshTablesOnly(code);
      });
    });
    body.querySelectorAll('#feDetailTable tbody tr').forEach(function (tr) {
      tr.addEventListener('click', function () { highlightCable(code, tr.dataset.feeder); });
    });
    body.querySelectorAll('#odcDetailTable tbody tr').forEach(function (tr) {
      tr.addEventListener('click', function () { highlightOdc(code, tr.dataset.odc); });
    });
  }

  // render ulang tabel detail saja, pertahankan fokus input search
  function refreshTablesOnly(code) {
    var feFocus = document.activeElement && document.activeElement.id;
    var fePos = document.activeElement ? document.activeElement.selectionStart : null;
    renderDetail(code);
    if (feFocus === 'feSearch' || feFocus === 'odcSearch') {
      var inp = document.getElementById(feFocus);
      if (inp) { inp.focus(); if (fePos !== null) try { inp.setSelectionRange(fePos, fePos); } catch (e) {} }
    }
  }

  var hlCable = null, hlOdc = null;
  function highlightCable(code, name) {
    if (!DEBUG.leaflet) return;
    if (hlCable) DEBUG.map.removeLayer(hlCable);
    var f = feObjects.filter(function (o) { return o.sto === code && o.name === name; })[0];
    if (!f || !f.segs || !f.segs.length) return;
    hlCable = L.polyline(f.segs, {color: '#111', weight: 5, opacity: 1}).addTo(DEBUG.map);
    DEBUG.map.flyToBounds(hlCable.getBounds(), {padding: [40, 40]});
  }
  function highlightOdc(code, name) {
    if (!DEBUG.leaflet) return;
    if (hlOdc) DEBUG.map.removeLayer(hlOdc);
    var o = odcObjects.filter(function (x) { return x.sto === code && x.name === name; })[0];
    if (!o) return;
    hlOdc = L.circleMarker([o.lat, o.lon], {radius: 10, color: '#111', weight: 3, fillOpacity: 0.9,
      fillColor: byCode[code].color}).addTo(DEBUG.map);
    DEBUG.map.flyTo([o.lat, o.lon], Math.max(DEBUG.map.getZoom(), 15));
  }

  /* tabel utama: klik baris -> detail */
  document.querySelector('#stoTable tbody').addEventListener('click', function (e) {
    var tr = e.target.closest('tr[data-sto]');
    if (tr) {
      chipAction(tr.dataset.sto);
      document.getElementById('detailCard').scrollIntoView({behavior: 'smooth', block: 'start'});
    }
  });

  /* default detail saat load: BEK */
  renderDetail('BEK');
  var defChip = document.querySelector('.chip[data-sto="BEK"]');
  if (defChip) defChip.classList.add('active');
  var defRow = document.querySelector('#stoTable tbody tr[data-sto="BEK"]');
  if (defRow) defRow.classList.add('hl');

  if (typeof L === 'undefined') {
    var fb = document.getElementById('mapFallback');
    fb.style.display = 'block';
    fb.textContent = 'Peta tidak termuat (Leaflet CDN tidak terjangkau). Angka & tabel tetap lengkap.';
    return;
  }
  DEBUG.leaflet = true;

  var map = L.map('map', {zoomControl: true});
  DEBUG.map = map;
  L.tileLayer('https://tile.openstreetmap.org/{z}/{x}/{y}.png', {
    maxZoom: 19, attribution: '&copy; OpenStreetMap'
  }).addTo(map);

  var gArea = L.layerGroup(), gOdc = L.layerGroup(), gFe = L.layerGroup();
  DEBUG.layerAreas = {};

  ADO.sto.forEach(function (s) {
    if (!s.polygon || s.polygon.length < 3) return;
    var poly = L.polygon(s.polygon, {
      color: s.color, weight: 2, fillColor: s.color, fillOpacity: 0.12
    }).bindPopup(
      '<div class="pp-title" style="color:' + s.color + '">STO ' + s.code + ' · ' + s.area + '</div>' +
      'Feeder: <b>' + s.n_feeder + '</b> kabel (' + fmt(s.fe_cap) + ' core · okupansi ' + pct(s.fe_occ) + ')<br>' +
      'ODC: <b>' + s.n_odc + '</b> unit (' + fmt(s.odc_kap_akt) + ' port · okupansi ' + pct(s.odc_occ) + ')'
    ).bindTooltip('STO ' + s.code, {sticky: true, direction: 'top'});
    gArea.addLayer(poly);
    DEBUG.layerAreas[s.code] = poly;
    DEBUG.polygons++;
    poly.on('click', function () { chipAction(s.code); });
  });

  ADO.odc.forEach(function (o) {
    var sto = o[0], name = o[1], spec = o[2], kap = o[3], used = o[4], lat = o[5], lon = o[6], flags = o[7];
    var col = (byCode[sto] || {}).color || '#888';
    var occ = (kap && used !== null) ? (used / kap * 100) : null;
    var html = '<div class="pp-title" style="color:' + col + '">' + name + '</div>' +
      'STO ' + sto + ' · ' + (spec || '—') + '<br>' +
      'Kapasitas: <b>' + fmt(kap) + '</b> port · Used: <b>' + fmt(used) + '</b><br>' +
      (occ === null ? '<span class="pp-flag">data kotor / tidak lengkap</span>'
                    : 'Okupansi: <b>' + occ.toFixed(1) + '%</b>') +
      ((flags & 2) ? '<br><span class="pp-flag">' + WARN_ICON + ' Kap_Aktual &gt; Kap_Potensial</span>' : '');
    gOdc.addLayer(L.circleMarker([lat, lon], {
      radius: 4, color: col, weight: 1, fillColor: col, fillOpacity: 0.75
    }).bindPopup(html));
    DEBUG.odcMarkers++;
  });

  ADO.feeders.forEach(function (f) {
    var sto = f[0], name = f[1], spec = f[2], cap = f[3], used = f[4], idle = f[5], spare = f[6], flags = f[7], segs = f[8];
    var col = (byCode[sto] || {}).color || '#888';
    var html = '<div class="pp-title" style="color:' + col + '">' + name + '</div>' +
      'STO ' + sto + ' · ' + (spec || '—') + '<br>' +
      'Kapasitas: <b>' + fmt(cap) + '</b> core · Used: <b>' + fmt(used) + '</b> · Idle: <b>' + fmt(idle) + '</b> · Spare: <b>' + fmt(spare) + '</b>' +
      ((flags & 1) ? '<br><span class="pp-flag">' + WARN_ICON + ' tanpa FTM — data perlu update</span>' : '') +
      ((flags & 2) ? '<br><span class="pp-flag">' + WARN_ICON + ' Used+Idle+Spare ≠ Capacity</span>' : '');
    var line = L.polyline(segs, {color: col, weight: 1.5, opacity: 0.7}).bindPopup(html);
    gFe.addLayer(line);
    DEBUG.feederLines++;
  });

  gArea.addTo(map); gOdc.addTo(map);
  L.control.layers(null, {'Area STO': gArea, 'ODC': gOdc, 'Feeder': gFe}, {collapsed: false}).addTo(map);

  var all = [];
  ADO.sto.forEach(function (s) { if (s.polygon && s.polygon.length >= 3) all.push(s.polygon); });
  if (all.length) map.fitBounds(L.latLngBounds(all.flat ? all.flat() : [].concat.apply([], all)).pad(0.05));
})();
