# Dashboard ADO — Analisa Daerah Operasi Branch Bekasi

Dashboard statis Bidang Bisnis TelkomAkses: jumlah STO, feeder, ODC & kapasitasnya,
dengan peta (Leaflet), drill-down inventory per STO, dan catatan kualitas data (audit ALPOR).

- Live: https://almiftahproperty-ado.vercel.app
- Sumber data: KML ALPOR (FEEDER & ODC, area Bekasi Kota + Bekasi Depok) per 30 Sep 2026
- Update data: jalankan ulang `audit/parse_ado_kml.py` (di folder PROJECT ADO) lalu `python build_data.py`, commit & push — Vercel auto-deploy.
- Struktur: `index.html` · `css/style.css` · `js/data.js` (snapshot data) · `js/app.js` (render)
