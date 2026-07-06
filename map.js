// ============================================================
//  AN BÌNH — Bản đồ "Xe gần bạn" (Leaflet + CARTO + OSRM, miễn phí)
//  42 chấm xanh nhấp nháy: một phần đứng rải trong các tỉnh,
//  hơn một nửa DI CHUYỂN dọc cao tốc/tuyến nối giữa các tỉnh.
//  Minh họa khu vực hoạt động — KHÔNG phải vị trí xe thật.
// ============================================================
(function () {
  if (typeof L === 'undefined') return;
  const el = document.getElementById('abMap');
  if (!el) return;

  const TOTAL = 42;
  const MOVING = 24;                 // > một nửa 42
  const STATIC = TOTAL - MOVING;     // 18
  const MOVE_MPS = 22;               // ~80 km/h dọc tuyến
  const OSRM = 'https://router.project-osrm.org/route/v1/driving/';

  // Tâm tỉnh + tỉ lệ chấm tĩnh
  const HN = [21.0278, 105.8342], TN = [21.5928, 105.8442], YB = [21.7229, 104.9113],
        LC = [22.4856, 103.9707], SP = [22.3364, 103.8438];
  const REGIONS = [
    { c: TN, w: 6, spread: 0.09 }, { c: HN, w: 5, spread: 0.10 },
    { c: YB, w: 3, spread: 0.08 }, { c: LC, w: 2, spread: 0.06 }, { c: SP, w: 2, spread: 0.05 },
  ];
  // Tuyến nối (cao tốc/QL) để chấm chạy dọc
  const LINKS = [ [HN, TN], [HN, YB], [YB, LC], [LC, SP], [TN, YB] ];

  let map, statics = [], movers = [], routes = [], raf = null, lastTs = 0, meMarker = null;
  const rint = (a, b) => a + Math.floor(Math.random() * (b - a + 1));
  const rnd = arr => arr[Math.floor(Math.random() * arr.length)];

  const toRad = d => d * Math.PI / 180, R = 6371000;
  function haversine(a, b) {
    const dLat = toRad(b[0]-a[0]), dLng = toRad(b[1]-a[1]);
    const s = Math.sin(dLat/2)**2 + Math.cos(toRad(a[0]))*Math.cos(toRad(b[0]))*Math.sin(dLng/2)**2;
    return 2 * R * Math.asin(Math.sqrt(s));
  }

  function dotIcon(moving) {
    const cls = moving ? '' : (Math.random() < 0.3 ? ' sm' : (Math.random() < 0.25 ? ' lg' : ''));
    const delay = (Math.random() * 1.8).toFixed(2);
    const dur = (1.4 + Math.random() * 1.2).toFixed(2);
    return L.divIcon({ className: '', html: '<div class="ab-dot' + cls + '" style="animation-delay:' + delay + 's;animation-duration:' + dur + 's"></div>', iconSize: [18, 18], iconAnchor: [9, 9] });
  }

  // ── chấm tĩnh rải trong tỉnh ──
  function scatter(center, n, spread, bucket) {
    for (let i = 0; i < n; i++) {
      const r = spread * (0.12 + Math.pow(Math.random(), 0.6));
      const ang = Math.random() * Math.PI * 2;
      const lngScale = 1 / Math.max(0.2, Math.cos(center[0] * Math.PI / 180));
      const pt = [center[0] + r * Math.cos(ang), center[1] + r * Math.sin(ang) * lngScale];
      bucket.push(L.marker(pt, { icon: dotIcon(false), interactive: false, keyboard: false }).addTo(map));
    }
  }

  // ── lấy tuyến đường thật (fallback đường thẳng) ──
  async function fetchRoute(a, b) {
    try {
      const url = OSRM + a[1] + ',' + a[0] + ';' + b[1] + ',' + b[0] + '?overview=simplified&geometries=geojson';
      const ctrl = new AbortController(); const tm = setTimeout(() => ctrl.abort(), 7000);
      const res = await fetch(url, { signal: ctrl.signal }); clearTimeout(tm);
      const j = await res.json();
      const co = j && j.routes && j.routes[0] && j.routes[0].geometry && j.routes[0].geometry.coordinates;
      if (co && co.length > 1) return co.map(c => [c[1], c[0]]);
    } catch (e) {}
    return [a, b];
  }
  function withCum(path) {
    const cum = [0];
    for (let i = 1; i < path.length; i++) cum.push(cum[i-1] + haversine(path[i-1], path[i]));
    return { path: path, cum: cum, total: cum[cum.length-1] || 1 };
  }
  function posAt(rt, dist) {
    const { path, cum } = rt;
    if (path.length < 2) return path[0];
    let i = 1; while (i < cum.length && cum[i] < dist) i++;
    if (i >= cum.length) return path[path.length-1];
    const t = (dist - cum[i-1]) / ((cum[i] - cum[i-1]) || 1);
    const a = path[i-1], b = path[i];
    return [a[0]+(b[0]-a[0])*t, a[1]+(b[1]-a[1])*t];
  }

  function addMovers() {
    for (let i = 0; i < MOVING; i++) {
      const rt = rnd(routes);
      const m = L.marker(posAt(rt, 0), { icon: dotIcon(true), interactive: false, keyboard: false }).addTo(map);
      // tốc độ THẬT theo luật: 55–90 km/h (không vượt tốc độ cao tốc/QL)
      const kmh = 55 + Math.random() * 35;
      m.__v = { marker: m, rt: rt, dist: Math.random() * rt.total, dir: Math.random() < 0.5 ? 1 : -1, speed: kmh / 3.6 };
      movers.push(m.__v);
    }
    start();
  }

  function frame(ts) {
    if (!lastTs) lastTs = ts;
    const dt = Math.min(120, ts - lastTs); lastTs = ts;
    movers.forEach(mv => {
      mv.dist += mv.dir * mv.speed * (dt / 1000);
      if (mv.dist >= mv.rt.total) { mv.dist = mv.rt.total; mv.dir = -1; }
      else if (mv.dist <= 0) { mv.dist = 0; mv.dir = 1; }
      mv.marker.setLatLng(posAt(mv.rt, mv.dist));
    });
    raf = requestAnimationFrame(frame);
  }
  function start() { if (!raf && movers.length) { lastTs = 0; raf = requestAnimationFrame(frame); } }

  async function initMap() {
    map = L.map(el, { zoomControl: true, scrollWheelZoom: false });
    L.tileLayer('https://{s}.basemaps.cartocdn.com/dark_all/{z}/{x}/{y}{r}.png', {
      subdomains: 'abcd', maxZoom: 19, attribution: '&copy; OpenStreetMap &copy; CARTO',
    }).addTo(map);
    map.fitBounds(L.latLngBounds(REGIONS.map(r => r.c)).pad(0.3));

    // chấm tĩnh (hiện ngay)
    const wsum = REGIONS.reduce((s, r) => s + r.w, 0);
    let placed = 0;
    REGIONS.forEach((rg, i) => {
      let n = Math.round(STATIC * rg.w / wsum);
      if (i === REGIONS.length - 1) n = STATIC - placed;   // đảm bảo đủ tổng
      placed += n; scatter(rg.c, n, rg.spread, statics);
    });
    const cnt = document.getElementById('mapCount');
    if (cnt) cnt.textContent = String(TOTAL);

    // tuyến thật → thêm chấm di chuyển
    try {
      const paths = await Promise.all(LINKS.map(l => fetchRoute(l[0], l[1])));
      routes = paths.map(withCum);
    } catch (e) {
      routes = LINKS.map(l => withCum([l[0], l[1]]));
    }
    addMovers();
  }

  const btn = document.getElementById('mapNear');
  if (btn) btn.addEventListener('click', function () {
    if (!navigator.geolocation) { btn.textContent = '📍 Trình duyệt không hỗ trợ định vị'; return; }
    const old = btn.textContent; btn.disabled = true; btn.textContent = '📍 Đang định vị...';
    navigator.geolocation.getCurrentPosition(function (pos) {
      const here = [pos.coords.latitude, pos.coords.longitude];
      map.setView(here, 13, { animate: true });
      if (meMarker) map.removeLayer(meMarker);
      meMarker = L.marker(here, { icon: L.divIcon({ className: '', html: '<div class="ab-me"></div>', iconSize: [18,18], iconAnchor: [9,9] }), interactive: false })
        .addTo(map).bindTooltip('Vị trí của bạn');
      scatter(here, rint(2, 4), 0.03, statics);
      btn.disabled = false; btn.textContent = '📍 Khu vực gần bạn';
    }, function () { btn.disabled = false; btn.textContent = old; }, { enableHighAccuracy: true, timeout: 8000, maximumAge: 60000 });
  });

  if ('IntersectionObserver' in window) {
    const io = new IntersectionObserver(function (entries) {
      if (entries.some(e => e.isIntersecting)) { io.disconnect(); initMap(); }
    }, { rootMargin: '200px' });
    io.observe(el);
  } else { initMap(); }

  document.addEventListener('visibilitychange', function () {
    if (document.hidden) { if (raf) { cancelAnimationFrame(raf); raf = null; } }
    else if (map) start();
  });
})();
