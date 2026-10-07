(function () {
  'use strict';

  /* ---------- 설정 ---------- */
  var TYPE_ORDER = ['공공도서관', '작은도서관', '어린이도서관', '전문도서관'];
  var TYPE_COLOR = {
    '공공도서관': '#0071e3',
    '작은도서관': '#1fa855',
    '어린이도서관': '#f08a00',
    '전문도서관': '#a550d6'
  };
  var TYPE_ICON = { '공공도서관': '🏛', '작은도서관': '📖', '어린이도서관': '🧸', '전문도서관': '📚' };
  var DEFAULT_ON = ['공공도서관'];
  var DAYS = ['일', '월', '화', '수', '목', '금', '토'];

  /* ---------- 상태 ---------- */
  var libs = [];
  var state = { q: '', types: new Set(DEFAULT_ON), district: '', sort: 'name', pos: null, sel: null };
  var map, layer, markers = {}, needFit = true;

  var $ = function (id) { return document.getElementById(id); };
  var app = $('app');

  /* ---------- 유틸 ---------- */
  function esc(s) {
    return String(s == null ? '' : s).replace(/[&<>"']/g, function (c) {
      return { '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[c];
    });
  }
  function color(t) { return TYPE_COLOR[t] || '#8e8e93'; }
  function fmt(n) { return n == null ? '-' : Number(n).toLocaleString('ko-KR'); }
  function safeUrl(u) { return /^https?:\/\//i.test(u || '') ? u : ''; }
  function photoSrc(p) { return /^(https?:)?\/\//.test(p) ? p : 'images/' + encodeURI(p); }
  function distKm(a, b, c, d) {
    var R = 6371, r = Math.PI / 180;
    var dLat = (c - a) * r, dLng = (d - b) * r;
    var h = Math.sin(dLat / 2) * Math.sin(dLat / 2) +
      Math.cos(a * r) * Math.cos(c * r) * Math.sin(dLng / 2) * Math.sin(dLng / 2);
    return 2 * R * Math.asin(Math.sqrt(h));
  }
  function fmtDist(km) { return km < 1 ? Math.round(km * 1000) + 'm' : km.toFixed(1) + 'km'; }
  function hr(h) { return h ? h[0] + ' ~ ' + h[1] : '휴관'; }

  /* ---------- 운영 상태 ---------- */
  function kstNow() {
    var parts = new Intl.DateTimeFormat('en-US', {
      timeZone: 'Asia/Seoul', weekday: 'short', hour: '2-digit', minute: '2-digit', hour12: false
    }).formatToParts(new Date());
    var o = {};
    parts.forEach(function (p) { o[p.type] = p.value; });
    var day = ['Sun', 'Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat'].indexOf(o.weekday);
    return { day: day, min: (parseInt(o.hour, 10) % 24) * 60 + parseInt(o.minute, 10) };
  }
  function toMin(s) { var p = s.split(':'); return parseInt(p[0], 10) * 60 + parseInt(p[1], 10); }

  function parseClosed(text) {
    var t = (text || '').replace(/\s/g, '');
    var r = { all: false, days: [], irregular: false };
    if (!t) return r;
    if (/^휴관(중)?$/.test(t)) { r.all = true; return r; }
    if (/연중무휴/.test(t)) { r.irregular = t.length > 4; return r; }
    t.split(/[+,]/).forEach(function (tok) {
      var m = tok.match(/^(?:매주)?([월화수목금토일])(?:요일)?$/);
      if (m) r.days.push(m[1]);
      else if (/공휴일|국경일/.test(tok) && !/(첫|둘|셋|넷|두번|네번|\d)/.test(tok)) { /* 공휴일은 판단하지 않음 */ }
      else r.irregular = true;
    });
    return r;
  }

  function status(l, now) {
    now = now || kstNow();
    var c = parseClosed(l.closed);
    if (c.all) return { cls: 'closed', label: '휴관 중' };
    if (c.days.indexOf(DAYS[now.day]) >= 0) return { cls: 'closed', label: '오늘 휴관' };
    var h = l.hours || {};
    var today = now.day === 0 ? h.holiday : (now.day === 6 ? h.sat : h.weekday);
    if (!today) {
      if (now.day === 0) return { cls: 'unknown', label: '일요일 운영 확인' };
      return { cls: 'closed', label: '오늘 휴관' };
    }
    var s = toMin(today[0]), e = toMin(today[1]);
    if (now.min >= s && now.min < e) return { cls: 'open', label: '운영 중 · ' + today[1] + '까지' };
    return { cls: 'closed', label: now.min < s ? '운영 전 · ' + today[0] + ' 시작' : '운영 종료' };
  }

  /* ---------- 데이터 ---------- */
  function getJSON(url) {
    return fetch(url).then(function (r) {
      if (!r.ok) throw new Error(url + ' ' + r.status);
      return r.json();
    });
  }

  function load() {
    return Promise.all([
      getJSON('data/libraries.json'),
      getJSON('data/extras.json').catch(function () { return {}; })
    ]).then(function (res) {
      var base = res[0], ex = res[1] || {}, ov = ex.overrides || {};
      var list = base.concat(ex.additions || []);
      list.forEach(function (l, i) {
        l.id = i + 1;
        var o = ov[l.name];
        if (o) Object.keys(o).forEach(function (k) { l[k] = o[k]; });
        l.facilities = l.facilities || [];
        l.photos = l.photos || [];
      });
      libs = list;
    });
  }

  /* ---------- 필터 UI ---------- */
  function buildFilters() {
    var counts = {};
    libs.forEach(function (l) { counts[l.type] = (counts[l.type] || 0) + 1; });
    var types = Object.keys(counts).sort(function (a, b) {
      var ia = TYPE_ORDER.indexOf(a), ib = TYPE_ORDER.indexOf(b);
      return (ia < 0 ? 99 : ia) - (ib < 0 ? 99 : ib);
    });
    var box = $('types');
    box.innerHTML = '';
    types.forEach(function (t) {
      var lab = document.createElement('label');
      lab.className = 'chip';
      lab.style.setProperty('--dot', color(t));
      lab.innerHTML = '<input type="checkbox" value="' + esc(t) + '"' + (state.types.has(t) ? ' checked' : '') +
        '><span>' + esc(t) + ' ' + counts[t] + '</span>';
      lab.querySelector('input').addEventListener('change', function (e) {
        if (e.target.checked) state.types.add(t); else state.types.delete(t);
        needFit = true;
        render();
      });
      box.appendChild(lab);
    });

    var ds = Array.from(new Set(libs.map(function (l) { return l.district; }))).sort(function (a, b) { return a.localeCompare(b, 'ko'); });
    var sel = $('district');
    ds.forEach(function (d) {
      var o = document.createElement('option');
      o.value = d; o.textContent = d;
      sel.appendChild(o);
    });
  }

  function filtered() {
    var q = state.q.replace(/\s/g, '').toLowerCase();
    var out = libs.filter(function (l) {
      if (!state.types.has(l.type)) return false;
      if (state.district && l.district !== state.district) return false;
      if (q) {
        var hay = (l.name + l.address + l.district + (l.org || '')).replace(/\s/g, '').toLowerCase();
        if (hay.indexOf(q) < 0) return false;
      }
      return true;
    });
    if (state.pos) {
      out.forEach(function (l) { l._d = distKm(state.pos.lat, state.pos.lng, l.lat, l.lng); });
    }
    var s = state.sort;
    out.sort(function (a, b) {
      if (s === 'seats') return (b.seats || 0) - (a.seats || 0);
      if (s === 'books') return (b.books || 0) - (a.books || 0);
      if (s === 'near' && state.pos) return a._d - b._d;
      return a.name.localeCompare(b.name, 'ko');
    });
    return out;
  }

  /* ---------- 렌더링 ---------- */
  function render() {
    var list = filtered();
    var now = kstNow();
    $('count').textContent = list.length + '곳';
    $('empty').hidden = list.length > 0;

    var ul = $('cards');
    ul.innerHTML = '';
    var frag = document.createDocumentFragment();
    list.forEach(function (l) {
      var st = status(l, now);
      var li = document.createElement('li');
      var b = document.createElement('button');
      b.className = 'card' + (state.sel === l.id ? ' sel' : '');
      b.dataset.id = l.id;
      b.style.setProperty('--dot', color(l.type));
      var thumb = l.photos.length
        ? '<img src="' + esc(photoSrc(l.photos[0])) + '" alt="" loading="lazy">'
        : esc(TYPE_ICON[l.type] || '📚');
      b.innerHTML =
        '<div class="thumb">' + thumb + '</div>' +
        '<div class="info">' +
          '<div class="name">' + esc(l.name) + '</div>' +
          '<div class="meta">' + esc(l.address.replace(/^부산광역시\s*/, '')) + '</div>' +
          '<div class="line2"><span class="badge">' + esc(l.type) + '</span>' +
            '<span class="st ' + st.cls + '">' + esc(st.label) + '</span>' +
            (l._d != null && state.pos ? '<span class="dist">' + fmtDist(l._d) + '</span>' : '') +
          '</div>' +
        '</div>';
      b.addEventListener('click', function () { openDetail(l.id, false); });
      li.appendChild(b);
      frag.appendChild(li);
    });
    ul.appendChild(frag);
    drawMarkers(list);
  }

  function drawMarkers(list) {
    if (!map) return;
    layer.clearLayers();
    markers = {};
    list.forEach(function (l) {
      var m = L.circleMarker([l.lat, l.lng], markerStyle(l, l.id === state.sel));
      m.bindTooltip(l.name, { direction: 'top', offset: [0, -6] });
      m.on('click', function () { openDetail(l.id, true); });
      m.addTo(layer);
      markers[l.id] = m;
    });
    if (needFit) fit(list);
  }

  function markerStyle(l, sel) {
    return {
      radius: sel ? 12 : 8, color: '#ffffff', weight: sel ? 3 : 2,
      fillColor: color(l.type), fillOpacity: 0.95
    };
  }

  function fit(list) {
    if (!map || !list.length) return;
    if (map.getSize().x === 0) return; // 지도가 숨겨진 상태: 탭 전환 시 다시 맞춤
    needFit = false;
    if (list.length === 1) { map.setView([list[0].lat, list[0].lng], 15); return; }
    var b = L.latLngBounds(list.map(function (l) { return [l.lat, l.lng]; }));
    map.fitBounds(b, { padding: [40, 40], maxZoom: 15 });
  }

  /* ---------- 상세 ---------- */
  function openDetail(id, fromMap) {
    var l = libs.find(function (x) { return x.id === id; });
    if (!l) return;
    var prev = state.sel;
    state.sel = id;
    if (markers[prev]) markers[prev].setStyle(markerStyle(libs.find(function (x) { return x.id === prev; }), false));
    if (markers[id]) { markers[id].setStyle(markerStyle(l, true)); markers[id].bringToFront(); }
    document.querySelectorAll('.card.sel').forEach(function (c) { c.classList.remove('sel'); });
    var card = document.querySelector('.card[data-id="' + id + '"]');
    if (card) { card.classList.add('sel'); if (fromMap) card.scrollIntoView({ block: 'nearest' }); }

    $('detailBody').innerHTML = detailHTML(l);
    $('detailBody').scrollTop = 0;
    var d = $('detail');
    d.classList.add('open');
    d.setAttribute('aria-hidden', 'false');
    try { history.replaceState(null, '', '#' + id); } catch (e) { /* noop */ }

    var go = $('goMap');
    if (go) go.addEventListener('click', function () { showOnMap(l); });
  }

  function closeDetail() {
    var d = $('detail');
    d.classList.remove('open');
    d.setAttribute('aria-hidden', 'true');
    var prev = state.sel;
    state.sel = null;
    if (markers[prev]) markers[prev].setStyle(markerStyle(libs.find(function (x) { return x.id === prev; }), false));
    document.querySelectorAll('.card.sel').forEach(function (c) { c.classList.remove('sel'); });
    try { history.replaceState(null, '', location.pathname + location.search); } catch (e) { /* noop */ }
  }

  function showOnMap(l) {
    setTab('map');
    setTimeout(function () { map.setView([l.lat, l.lng], 16); }, 60);
    if (window.matchMedia('(max-width: 899px)').matches) closeDetail();
  }

  function detailHTML(l) {
    var st = status(l);
    var c = parseClosed(l.closed);
    var url = safeUrl(l.url);
    var name = encodeURIComponent(l.name);
    var kakao = 'https://map.kakao.com/link/to/' + name + ',' + l.lat + ',' + l.lng;
    var naver = 'https://map.naver.com/p/search/' + encodeURIComponent(l.address.replace(/\(.*$/, ''));
    var h = l.hours || {};

    var photos = l.photos.length
      ? '<div class="photos">' + l.photos.map(function (p) {
          return '<img src="' + esc(photoSrc(p)) + '" alt="' + esc(l.name) + ' 사진" loading="lazy">';
        }).join('') + '</div>' + (l.photoCredit ? '<p class="muted">사진: ' + esc(l.photoCredit) + '</p>' : '')
      : '<div class="photo-empty">아직 등록된 사진이 없어요</div>';

    var fac = l.facilities.length
      ? '<div class="tags">' + l.facilities.map(function (f) { return '<span class="tag">' + esc(f) + '</span>'; }).join('') + '</div>'
      : '<p class="muted">아직 등록된 부대시설 정보가 없어요. 열람좌석 ' + fmt(l.seats) + '석 규모입니다.</p>';

    return '' +
      '<div class="d-title">' + esc(l.name) + '</div>' +
      '<div class="d-sub" style="--dot:' + color(l.type) + '"><span class="badge">' + esc(l.type) + '</span>' +
        '<span class="st ' + st.cls + '">' + esc(st.label) + '</span></div>' +
      photos +
      '<div class="actions">' +
        (url ? '<a class="btn primary" href="' + esc(url) + '" target="_blank" rel="noopener">홈페이지</a>'
             : '<span class="btn primary off">홈페이지 없음</span>') +
        '<a class="btn" href="' + esc(kakao) + '" target="_blank" rel="noopener">카카오맵 길찾기</a>' +
        '<a class="btn" href="' + esc(naver) + '" target="_blank" rel="noopener">네이버지도</a>' +
        '<button class="btn" id="goMap" type="button" style="border:0;cursor:pointer">지도에서 보기</button>' +
      '</div>' +
      '<div class="sec"><h3>이용 안내</h3><dl class="kv">' +
        '<dt>평일</dt><dd>' + esc(hr(h.weekday)) + '</dd>' +
        '<dt>토요일</dt><dd>' + esc(hr(h.sat)) + '</dd>' +
        '<dt>일·공휴일</dt><dd>' + esc(hr(h.holiday)) + '</dd>' +
        '<dt>휴관일</dt><dd>' + esc(l.closed || '-') + '</dd>' +
      '</dl>' + (c.irregular ? '<p class="muted">※ 불규칙한 휴관일이 있어요. 방문 전 확인하세요.</p>' : '') + '</div>' +
      '<div class="sec"><h3>위치·연락처</h3><dl class="kv">' +
        '<dt>주소</dt><dd>' + esc(l.address) + '</dd>' +
        '<dt>전화</dt><dd>' + (l.phone ? '<a href="tel:' + esc(l.phone.replace(/[^0-9+]/g, '')) + '">' + esc(l.phone) + '</a>' : '-') + '</dd>' +
        '<dt>운영기관</dt><dd>' + esc(l.org || '-') + '</dd>' +
      '</dl></div>' +
      '<div class="sec"><h3>부대시설</h3>' + fac + '</div>' +
      '<div class="sec"><h3>규모</h3><div class="stats">' +
        '<div class="stat"><b>' + fmt(l.seats) + '</b><span>열람좌석</span></div>' +
        '<div class="stat"><b>' + fmt(l.books) + '</b><span>장서(권)</span></div>' +
        '<div class="stat"><b>' + (l.area ? fmt(Math.round(l.area)) : '-') + '</b><span>건물면적(㎡)</span></div>' +
      '</div>' +
      '<p class="muted" style="margin-top:10px">대출 ' + fmt(l.loanBooks) + '권 · ' + fmt(l.loanDays) + '일</p></div>' +
      '<p class="muted" style="margin-top:20px">데이터 기준일 ' + esc(l.updated || '-') + '</p>';
  }

  /* ---------- 지도 ---------- */
  function initMap() {
    map = L.map('map', { zoomControl: true, preferCanvas: true }).setView([35.18, 129.07], 11);
    var dark = window.matchMedia && window.matchMedia('(prefers-color-scheme: dark)').matches;
    L.tileLayer('https://{s}.basemaps.cartocdn.com/' + (dark ? 'dark_all' : 'light_all') + '/{z}/{x}/{y}{r}.png', {
      maxZoom: 19,
      subdomains: 'abcd',
      attribution: '&copy; <a href="https://www.openstreetmap.org/copyright">OpenStreetMap</a> &copy; <a href="https://carto.com/attributions">CARTO</a>'
    }).addTo(map);
    layer = L.layerGroup().addTo(map);
  }

  function setTab(tab) {
    app.dataset.tab = tab;
    document.querySelectorAll('.tabs button').forEach(function (b) {
      b.classList.toggle('on', b.dataset.tab === tab);
    });
    if (tab === 'map' && map) {
      setTimeout(function () {
        map.invalidateSize();
        if (needFit) fit(filtered());
      }, 30);
    }
  }

  /* ---------- 이벤트 ---------- */
  function bind() {
    var t;
    $('q').addEventListener('input', function (e) {
      clearTimeout(t);
      t = setTimeout(function () { state.q = e.target.value; needFit = true; render(); }, 150);
    });
    $('district').addEventListener('change', function (e) { state.district = e.target.value; needFit = true; render(); });
    $('sort').addEventListener('change', function (e) {
      var v = e.target.value;
      if (v !== 'near') { state.sort = v; render(); return; }
      if (!navigator.geolocation) { alert('이 브라우저에서는 위치 기능을 쓸 수 없어요.'); e.target.value = state.sort; return; }
      navigator.geolocation.getCurrentPosition(function (p) {
        state.pos = { lat: p.coords.latitude, lng: p.coords.longitude };
        state.sort = 'near';
        render();
      }, function () {
        alert('위치 권한이 없어 가까운 순 정렬을 사용할 수 없어요.');
        e.target.value = state.sort;
      }, { timeout: 8000 });
    });
    $('closeDetail').addEventListener('click', closeDetail);
    document.addEventListener('keydown', function (e) { if (e.key === 'Escape') closeDetail(); });
    document.querySelectorAll('.tabs button').forEach(function (b) {
      b.addEventListener('click', function () { setTab(b.dataset.tab); });
    });
    window.addEventListener('resize', function () { if (map) map.invalidateSize(); });
  }

  /* ---------- 시작 ---------- */
  bind();
  initMap();
  load().then(function () {
    var m = location.hash.match(/^#(\d+)$/);
    var hashLib = m && libs.find(function (l) { return l.id === parseInt(m[1], 10); });
    if (hashLib) state.types.add(hashLib.type); // 공유 링크의 도서관이 숨겨지지 않도록
    buildFilters();
    render();
    if (hashLib) openDetail(hashLib.id, false);
  }).catch(function (err) {
    $('empty').hidden = false;
    $('empty').textContent = '데이터를 불러오지 못했어요. (' + err.message + ')';
  });

})();
