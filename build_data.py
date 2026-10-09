# build_data.py — Generate js/data.js untuk Dashboard ADO dari hasil audit KML
# Jalankan: python build_data.py  (dari folder dashboard/)
import csv, json, os, re
from datetime import datetime

BASE = os.path.join(os.path.dirname(os.path.abspath(__file__)), '..')
AUDIT = os.path.join(BASE, 'audit').replace('\\', '/')
OUT = os.path.join(os.path.dirname(os.path.abspath(__file__)), 'js', 'data.js')

STO_COLORS = {
    # Palet TelkomAkses (muted, tidak terlalu terang) — semua pasangan terbedakan jelas
    'BEK': '#C0392B', 'CNE': '#1E8449', 'CSL': '#B7950B', 'DEP': '#2874A6',
    'KLB': '#CA6F1E', 'KRA': '#6C3483', 'PCM': '#148F77', 'PDE': '#9B59B6',
    'PKY': '#4D7C0F', 'SKJ': '#AD1457',
}

def num(x):
    if x is None or x == '':
        return None
    try:
        f = float(x)
        return int(f)
    except ValueError:
        return None

def r5(x):
    return round(float(x), 5)

# ---------- convex hull (monotone chain) ----------
def cross(o, a, b):
    return (a[0]-o[0])*(b[1]-o[1]) - (a[1]-o[1])*(b[0]-o[0])

def hull(pts):
    pts = sorted(set(pts))
    if len(pts) < 3:
        return pts
    lo = []
    for p in pts:
        while len(lo) >= 2 and cross(lo[-2], lo[-1], p) <= 0:
            lo.pop()
        lo.append(p)
    up = []
    for p in reversed(pts):
        while len(up) >= 2 and cross(up[-2], up[-1], p) <= 0:
            up.pop()
        up.append(p)
    return lo[:-1] + up[:-1]

# ---------- ODC ----------
odc_rows = []
with open(AUDIT + '/odc.csv', encoding='utf-8-sig') as f:
    for r in csv.DictReader(f):
        lat_s, lon_s = r['lat'].strip(), r['lon'].strip()
        try:
            lat, lon = float(lat_s), float(lon_s)
        except ValueError:
            continue
        kap_akt, used = num(r['kap_aktual']), num(r['port_used'])
        kap_pot = num(r['kap_potensial'])
        flags = 0
        if r['dirty_fields']:
            flags |= 1
        if kap_akt is not None and kap_pot is not None and kap_akt > kap_pot:
            flags |= 2
        odc_rows.append({
            'sto': r['sto'], 'name': r['odc'], 'spec': r['spec'],
            'kap_pot': kap_pot, 'kap_akt': kap_akt, 'used': used,
            'lat': lat, 'lon': lon, 'flags': flags,
        })

# ---------- FEEDER cables ----------
fe_rows = []
with open(AUDIT + '/feeder_cables.csv', encoding='utf-8-sig') as f:
    for r in csv.DictReader(f):
        flags = 0
        if r['in_kosong'] == 'True':
            flags |= 1
        if r['math_bad'] == 'True':
            flags |= 2
        fe_rows.append({
            'sto': r['sto'], 'name': r['feeder'], 'ftm': r['ftm'], 'spec': r['spec'],
            'cap': num(r['capacity']), 'used': num(r['used']),
            'idle': num(r['idle']), 'spare': num(r['spare']),
            'flags': flags,
        })

# ---------- FEEDER segments (untuk layer peta) ----------
FE_SEG = re.compile(r'^FE-([A-Z]{2,4})-(\d+)[A-Z]?(?:[-/.].+)?$')
FE_TYPO = re.compile(r'^FE([A-Z]{2,4})-(\d+)(?:[-/.].+)?$')

def fe_base(name):
    m = FE_SEG.match(name)
    if m:
        return 'FE-' + m.group(1) + '-' + m.group(2)
    m = FE_TYPO.match(name)
    if m:
        return 'FE-' + m.group(1) + '-' + m.group(2)
    return None

cable_segs = {}
with open(AUDIT + '/feeder_segments.csv', encoding='utf-8-sig') as f:
    for r in csv.DictReader(f):
        base = fe_base(r['segment'])
        if not base or not r['wkt']:
            continue
        w = r['wkt']
        pts = []
        if w.startswith('LINESTRING'):
            body = w[len('LINESTRING('):-1]
            for tok in body.split(', '):
                lon, lat = tok.split(' ')
                pts.append([r5(lat), r5(lon)])
        elif w.startswith('POINT'):
            body = w[len('POINT('):-1]
            lon, lat = body.split(' ')
            pts.append([r5(lat), r5(lon)])
        if pts:
            cable_segs.setdefault((r['sto'], base), []).append(pts)

# gabung ke record kabel
for fe in fe_rows:
    fe['segs'] = cable_segs.get((fe['sto'], fe['name']), [])

# ---------- summary ----------
with open(AUDIT + '/summary.json', encoding='utf-8') as f:
    S = json.load(f)
per_sto = S['per_sto']
branch = S['branch']
an = S['anomalies']

# ---------- list pelanggan (alokasi kumulatif per ODC, urut okupansi desc) ----------
import openpyxl
XLSX_PELANGGAN = os.path.join(AUDIT, 'list_pelanggan.xlsx')
pelanggan_total = {}   # sto -> jumlah pelanggan
if os.path.exists(XLSX_PELANGGAN):
    wb = openpyxl.load_workbook(XLSX_PELANGGAN, read_only=True, data_only=True)
    ws = wb[wb.sheetnames[0]]
    for i, row in enumerate(ws.iter_rows(values_only=True)):
        if i == 0 or not row or not row[0]:
            continue
        sto = str(row[0]).strip()
        if sto in per_sto and isinstance(row[1], (int, float)):
            pelanggan_total[sto] = int(row[1])
    wb.close()


fe_cap = sum(x['cap'] or 0 for x in fe_rows)
fe_used = sum(x['used'] or 0 for x in fe_rows)
odc_akt = sum(x['kap_akt'] or 0 for x in odc_rows)
odc_used = sum(x['used'] or 0 for x in odc_rows)

sto_list = []
odc_pelanggan = {}  # index record ODC di list -> pelanggan dialokasikan
for code in sorted(per_sto):
    v = per_sto[code]
    pts = [(o['lon'], o['lat']) for o in odc_rows if o['sto'] == code]
    h = hull(pts) if len(pts) >= 3 else []
    polygon = [[r5(p[1]), r5(p[0])] for p in h]
    fe_occ = round(v['fe_used'] / v['fe_cap'] * 100, 1) if v['fe_cap'] else None
    odc_occ = round(v['odc_used'] / v['odc_kap_akt'] * 100, 1) if v['odc_kap_akt'] else None
    sto_list.append({
        'code': code, 'area': v['area'], 'color': STO_COLORS[code],
        'polygon': polygon,
        'n_feeder': v['feeder'], 'n_feeder_cap': v['feeder_with_cap'],
        'fe_cap': v['fe_cap'], 'fe_used': v['fe_used'],
        'fe_idle': v['fe_idle'], 'fe_spare': v['fe_spare'], 'fe_occ': fe_occ,
        'n_odc': v['odc'], 'odc_kap_pot': v['odc_kap_pot'],
        'odc_kap_akt': v['odc_kap_akt'], 'odc_used': v['odc_used'],
        'odc_idle': v['odc_idle'], 'odc_occ': odc_occ,
        'fe_kosong': v['fe_kosong'],
        'pelanggan': pelanggan_total.get(code, 0),
    })

# Alokasi pelanggan per ODC PROPORSIONAL terhadap okupansi (port used /
# kap. aktual): okupansi besar -> porsi pelanggan besar. Total per STO
# tetap = list pelanggan STO (komulatif rounding: share dibulatkan
# berjalan, ODC terakhir menampung sisa).
for code in sorted(per_sto):
    target = pelanggan_total.get(code, 0)
    idxs = [i for i, o in enumerate(odc_rows) if o['sto'] == code]
    if not idxs or target <= 0:
        for i in idxs:
            odc_pelanggan[i] = 0
        continue
    # bobot = port used (okupansi aktual); ODC tanpa data -> bobot 0
    weights = {}
    total_w = 0.0
    for i in idxs:
        o = odc_rows[i]
        w = float(o['used'] or 0)
        weights[i] = w
        total_w += w
    if total_w <= 0:
        # tidak ada data okupansi sama sekali -> fallback rata
        for n, i in enumerate(idxs):
            odc_pelanggan[i] = target // len(idxs) + (1 if n < target % len(idxs) else 0)
        continue
    # urut okupansi menurun (konsisten dgn tampilan "paling banyak dulu")
    def occ_rank(i):
        o = odc_rows[i]
        if o['kap_akt'] and o['used'] is not None:
            return (-(o['used'] / o['kap_akt']), 0)
        return (0, 1)
    idxs.sort(key=occ_rank)
    # alokasi proporsional dgn largest-remainder: pastikan total pas
    exact = {i: target * weights[i] / total_w for i in idxs}
    alloc = {i: int(exact[i] // 1) for i in idxs}   # floor dulu
    sisa = target - sum(alloc.values())
    # bagi sisa ke pecahan terbesar (largest remainder)
    order = sorted(idxs, key=lambda i: -(exact[i] - alloc[i]))
    for i in order[:sisa]:
        alloc[i] += 1
    for i in idxs:
        odc_pelanggan[i] = alloc[i]


data = {
    'meta': {
        'title': 'ADO — Analisa Daerah Operasi',
        'branch': 'Branch Bekasi',
        'biz': 'Bidang Bisnis TelkomAkses',
        'dataDate': '30 September 2026 (tarik ALPOR)',
        'generated': datetime.now().strftime('%d %b %Y %H:%M'),
        'notePolygon': 'Polygon area STO = approximasi convex hull dari sebaran titik ODC (statis, untuk testing — belum batas wilayah resmi).',
    },
    'totals': {
        'n_sto': branch['n_sto'],
        'n_feeder': branch['feeder_cables'],
        'n_seg': branch['feeder_segments'],
        'n_odc': branch['odc_total'],
        'fe_cap': fe_cap, 'fe_used': fe_used,
        'fe_idle': branch['fe_idle_total'], 'fe_spare': branch['fe_spare_total'],
        'fe_occ': round(fe_used / fe_cap * 100, 1),
        'odc_kap_pot': branch['odc_kap_pot'], 'odc_kap_akt': odc_akt,
        'odc_used': odc_used, 'odc_idle': branch['odc_idle'],
        'odc_occ': round(odc_used / odc_akt * 100, 1),
        'pelanggan': sum(pelanggan_total.values()),
    },
    'anomalies': {
        'fe_kosong': an['fe_cables_kosong']['BEKASI KOTA'] + an['fe_cables_kosong']['BEKASI DEPOK'],
        'fe_math': an['fe_cables_math_bad']['BEKASI KOTA'] + an['fe_cables_math_bad']['BEKASI DEPOK'],
        'fe_nonfe': an['fe_non_fe_placemarks'],
        'odc_aktpot': an['odc_akt_gt_pot']['BEKASI KOTA'] + an['odc_akt_gt_pot']['BEKASI DEPOK'],
        'odc_dirty': an['odc_dirty']['BEKASI KOTA'] + an['odc_dirty']['BEKASI DEPOK'],
        'odc_dup': len(an['odc_dup_names_in_file']['BEKASI DEPOK']),
    },
    'sto': sto_list,
    # odc: [sto, name, spec, kap_akt, used, lat, lon, flags, kap_pot, pelanggan]
    'odc': [[o['sto'], o['name'], o['spec'], o['kap_akt'], o['used'],
             o['lat'], o['lon'], o['flags'], o['kap_pot'],
             odc_pelanggan.get(i, 0)] for i, o in enumerate(odc_rows)],
    # feeders: [sto, name, spec, cap, used, idle, spare, flags, segs, ftm]
    'feeders': [[f['sto'], f['name'], f['spec'], f['cap'], f['used'],
                 f['idle'], f['spare'], f['flags'], f['segs'], f['ftm']] for f in fe_rows],
}

js = 'const ADO = ' + json.dumps(data, ensure_ascii=False, separators=(',', ':')) + ';\n'
os.makedirs(os.path.dirname(OUT), exist_ok=True)
with open(OUT, 'w', encoding='utf-8') as f:
    f.write(js)

print('data.js ditulis:', OUT)
print('sto:', len(sto_list), '| odc:', len(odc_rows), '| feeders:', len(fe_rows),
      '| cables dgn segmen peta:', sum(1 for f in fe_rows if f['segs']))
for s in sto_list:
    print(f"  {s['code']:4} polygon: {len(s['polygon']):3} titik | FE {s['n_feeder']:3} | ODC {s['n_odc']:3} | okFE {s['fe_occ']}% | okODC {s['odc_occ']}% | pelanggan {s['pelanggan']:6}")
print('total pelanggan:', sum(pelanggan_total.values()))
