/* =====================================================================
   dashboard.js — 실시간 안전 관제 시뮬레이션
   - 4개 공간의 센서 신호를 가상 생성하여 위험 상황을 재현
   - 위험 발생 시 음성 안내 콘솔 + 토스트 + 이벤트 로그 갱신
   - 위험/긴급 이벤트는 RESTful Table API 로 DB 저장
   ===================================================================== */
(function () {
  'use strict';

  var TICK_MS = 2600;

  /* ---------------- 공간 정의 ---------------- */
  var ZONES = [
    {
      id: 'bath', name: '욕실', icon: 'fa-shower',
      metrics: ['습도', '조도'],
      base: { 습도: 45, 조도: 340 },
      drift: { 습도: 30, 조도: 220 },
      pool: [
        { type: '바닥 수분 감지', sev: '위험', msg: '샤워 후 바닥 물기가 넓게 퍼져 있습니다.', voice: '욕실 바닥이 미끄럽습니다. 난간을 잡고 천천히 이동하세요.' },
        { type: '수증기 시야 저하', sev: '주의', msg: '수증기로 시야가 흐려지는 구간이 감지되었습니다.', voice: '욕실 수증기가 많습니다. 잠시 기다린 뒤 이동하세요.' },
        { type: '급격한 움직임', sev: '긴급', msg: '미끄러짐으로 추정되는 급격한 자세 변화가 감지되었습니다.', voice: '움직이지 마세요. 보호자에게 즉시 알렸습니다.' }
      ]
    },
    {
      id: 'hall', name: '계단·복도', icon: 'fa-stairs',
      metrics: ['조도', '장애물'],
      base: { 조도: 120 },
      drift: { 조도: 130 },
      pool: [
        { type: '야간 조도 저하', sev: '주의', msg: '조도가 권장 기준 이하로 떨어졌습니다.', voice: '복도가 어둡습니다. 발밑을 확인하고 한 칸씩 내려가세요.' },
        { type: '바닥 장애물 감지', sev: '위험', msg: '통로에 장애물이 놓여 보행 폭이 좁아졌습니다.', voice: '전방에 장애물이 있습니다. 우회하여 이동하세요.' },
        { type: '급한 보행 패턴', sev: '위험', msg: '계단 구간에서 빠른 보행 패턴이 감지되었습니다.', voice: '계단에서는 속도를 줄이고 난간을 잡으세요.' }
      ]
    },
    {
      id: 'bed', name: '침실', icon: 'fa-bed',
      metrics: ['기상', '균형'],
      base: { 기상: 0 },
      drift: {},
      pool: [
        { type: '야간 기상 감지', sev: '주의', msg: '심야 시간대 기상 후 즉시 보행이 시작되었습니다.', voice: '일어나실 때 잠시 앉아 호흡을 고른 뒤 일어나세요.' },
        { type: '균형 불안정', sev: '위험', msg: '체중 중심의 흔들림이 평소보다 크게 측정되었습니다.', voice: '중심을 잡고 벽을 짚고 이동하세요.' },
        { type: '낙상 의심 이벤트', sev: '긴급', msg: '침대 옆에서 바닥 접촉으로 추정되는 신호가 감지되었습니다.', voice: '괜찮으신가요? 보호자와 관리자에게 호출을 보냈습니다.' }
      ]
    },
    {
      id: 'entry', name: '주방·현관', icon: 'fa-door-open',
      metrics: ['문턱', '물기'],
      base: { 문턱: 2, 물기: 0 },
      drift: {},
      pool: [
        { type: '문턱 단차 위험', sev: '주의', msg: '문턱 단차 구간에서 발의 들림이 부족했습니다.', voice: '문턱을 넘을 때 발을 충분히 들어 주세요.' },
        { type: '주방 바닥 물기', sev: '위험', msg: '조리 중 흘린 물기가 바닥에 감지되었습니다.', voice: '주방 바닥에 물기가 있습니다. 즉시 닦고 이동하세요.' },
        { type: '외출 준비 중 분주함', sev: '주의', msg: '짧은 시간 안에 반복된 이동이 감지되었습니다.', voice: '서두르지 마시고 한 걸음씩 이동하세요.' }
      ]
    }
  ];

  var SEV_CLASS = { '낮음': 1, '주의': 2, '위험': 3, '긴급': 4 };
  var SEV_LEVEL = { 1: 's1', 2: 's2', 3: 's3', 4: 's4' };

  /* ---------------- 상태 ---------------- */
  var state = {
    paused: false,
    totals: { events: 0, high: 0, voice: 0 },
    zoneCount: {}, sevCount: { '주의': 0, '위험': 0, '긴급': 0 },
    log: [],
    actions: {},           // 공간별 측정값
    charts: { zone: null, sev: null }
  };
  ZONES.forEach(function (z) { state.zoneCount[z.id] = 0; state.actions[z.id] = { level: 1, metric: '', voice: '', until: 0 }; });

  /* ---------------- 유틸 ---------------- */
  function $(id) { return document.getElementById(id); }
  function rand(n) { return Math.floor(Math.random() * n); }
  function pick(a) { return a[rand(a.length)]; }

  function fmtTime(ts) {
    var d = new Date(ts);
    function p(n) { return n < 10 ? '0' + n : '' + n; }
    return p(d.getHours()) + ':' + p(d.getMinutes()) + ':' + p(d.getSeconds());
  }
  function fmtDateTime(ts) {
    var d = new Date(ts);
    function p(n) { return n < 10 ? '0' + n : '' + n; }
    return d.getFullYear() + '-' + p(d.getMonth() + 1) + '-' + p(d.getDate()) + ' ' + p(d.getHours()) + ':' + p(d.getMinutes());
  }

  /* ---------------- 평면도 렌더 ---------------- */
  function renderFloorplan() {
    var host = $('floorplan');
    if (!host) return;
    host.innerHTML = ZONES.map(function (z) {
      return '<div class="zone" id="zone-' + z.id + '" data-zone="' + z.id + '">' +
        '<div class="zone-head"><b><i class="fa-solid ' + z.icon + '"></i> ' + z.name + '</b>' +
        '<i class="fa-solid fa-circle-check" data-state></i></div>' +
        '<div class="zstat" data-zstat>정상 · 모니터링 중</div>' +
        '<div class="zmetric" data-zmetric>—</div>' +
        '</div>';
    }).join('');
  }

  /* ---------------- 센서 틱 ---------------- */
  function tick() {
    if (state.paused) return;
    var yesNo = rand(100);

    ZONES.forEach(function (z) {
      var el = $('zone-' + z.id);
      if (!el) return;
      var a = state.actions[z.id];
      var now = Date.now();

      // 액션 표시 시간이 남아있으면 유지
      if (a.until > now) {
        el.className = 'zone ' + SEV_LEVEL[a.level];
        el.querySelector('[data-zstat]').textContent = a.metric;
        el.querySelector('[data-zmetric]').textContent = a.voice;
        var st = el.querySelector('[data-state]');
        st.className = 'fa-solid ' + (a.level >= 4 ? 'fa-triangle-exclamation' : a.level === 3 ? 'fa-circle-exclamation' : a.level === 2 ? 'fa-circle-exclamation' : 'fa-circle-check');
        return;
      }

      // 이벤트 트리거 확률 (공간당 약 22%)
      if (rand(100) < 22) {
        triggerEvent(z, false);
        return;
      }

      // 정상 상태: 측정값만 갱신
      el.className = 'zone';
      el.querySelector('[data-zstat]').textContent = '정상 · 모니터링 중';
      el.querySelector('[data-zmetric]').textContent = randomMetric(z);
      el.querySelector('[data-state]').className = 'fa-solid fa-circle-check';
      a.level = 1;
    });

    updateClock();
  }

  function randomMetric(z) {
    var out = [];
    z.metrics.forEach(function (m) {
      if (m === '습도') out.push('습도 ' + (40 + rand(18)) + '%');
      else if (m === '조도') out.push('조도 ' + (60 + rand(320)) + 'lx');
      else if (m === '장애물') out.push('바닥 장애물 없음');
      else if (m === '기상') out.push('기상 감지 대기');
      else if (m === '균형') out.push('중심 안정');
      else if (m === '문턱') out.push('문턱 단차 ' + (1 + rand(2)) + 'cm');
      else if (m === '물기') out.push('바닥 건조');
    });
    return out.join(' · ');
  }

  /* ---------------- 이벤트 발생 ---------------- */
  function triggerEvent(z, forced) {
    var ev = pick(z.pool);
    var sev = forced ? (Math.random() < 0.45 ? '긴급' : '위험') : ev.sev;
    // 일반 트리거에서 긴급은 낮은 확률로만
    if (!forced && sev === '긴급' && rand(100) > 25) sev = '위험';

    var level = SEV_CLASS[sev];
    var ts = Date.now();

    var a = state.actions[z.id];
    a.level = level;
    a.metric = '⚠ ' + ev.type;
    a.voice = '🔊 ' + ev.voice;
    a.until = ts + 7000;

    // 평면도 즉시 반영
    var el = $('zone-' + z.id);
    if (el) {
      el.className = 'zone ' + SEV_LEVEL[level];
      el.querySelector('[data-zstat]').textContent = '⚠ ' + ev.type;
      el.querySelector('[data-zmetric]').textContent = ev.voice;
      el.querySelector('[data-state]').className = 'fa-solid ' +
        (level >= 4 ? 'fa-triangle-exclamation' : level === 3 ? 'fa-circle-exclamation' : 'fa-circle-exclamation');
    }

    // 집계
    state.totals.events++;
    state.totals.voice++;
    state.zoneCount[z.id]++;
    state.sevCount[sev] = (state.sevCount[sev] || 0) + 1;
    if (level >= 3) state.totals.high++;
    renderKpis();
    updateCharts();

    // 로그 + 토스트 + 음성 콘솔
    pushLog({ ts: ts, zone: z.name, zoneId: z.id, type: ev.type, sev: sev, msg: ev.msg, voice: ev.voice, level: level });
    speak(ev.voice, z.name, level);
    toast(z.name, ev.type, ev.voice, level);

    // 고위험은 DB 저장
    if (level >= 3) saveEvent(z, ev, sev, ts);
  }

  /* ---------------- 음성 콘솔 ---------------- */
  var speakTimer = null;
  function speak(text, zoneName, level) {
    var wave = $('vc-wave');
    var msg = $('vc-msg');
    var spk = $('vc-speaker');
    if (!wave || !msg) return;
    wave.classList.add('on');
    msg.textContent = '“' + text + '”';
    if (spk) spk.textContent = '현장 스피커 · ' + zoneName + ' 방송 중';
    if (speakTimer) clearTimeout(speakTimer);
    speakTimer = setTimeout(function () {
      wave.classList.remove('on');
      if (spk) spk.textContent = '현장 스피커 · 대기';
    }, 6000);
  }

  /* ---------------- 이벤트 로그 ---------------- */
  function pushLog(item) {
    state.log.unshift(item);
    if (state.log.length > 40) state.log.pop();
    renderLog();
  }

  function renderLog() {
    var host = $('log-list');
    var cnt = $('log-count');
    if (cnt) cnt.textContent = state.log.length + '건';
    if (!host) return;
    if (!state.log.length) return;
    host.innerHTML = state.log.map(function (it) {
      var lvl = SEV_LEVEL[it.level] || 's1';
      return '<div class="log-item sev-' + it.sev + '">' +
        '<span class="sev" aria-hidden="true"></span>' +
        '<div class="log-body">' +
        '<div class="l1"><b>' + it.zone + '</b>' +
        '<span class="sev-pill ' + lvl + '">' + it.sev + '</span>' +
        '<span class="time">' + fmtTime(it.ts) + '</span></div>' +
        '<div class="log-msg">' + it.type + ' — ' + it.msg + '</div>' +
        '<div class="log-voice"><i class="fa-solid fa-volume-high"></i> ' + it.voice + '</div>' +
        '</div></div>';
    }).join('');
  }

  /* ---------------- 토스트 ---------------- */
  function toast(zoneName, type, voice, level) {
    var host = $('toast-host');
    if (!host) return;
    var el = document.createElement('div');
    el.className = 'toast ' + SEV_LEVEL[level];
    el.innerHTML = '<b>' + (level >= 4 ? '🚨' : level === 3 ? '⚠️' : '🔔') + ' ' + zoneName + ' · ' + type + '</b>' +
      '<p>' + voice + '</p>';
    host.appendChild(el);
    setTimeout(function () {
      el.classList.add('out');
      setTimeout(function () { el.remove(); }, 320);
    }, 4600);
    // 최대 4개 유지
    while (host.children.length > 4) host.removeChild(host.firstChild);
  }

  /* ---------------- KPI ---------------- */
  function renderKpis() {
    var e = $('kpi-events'), h = $('kpi-high'), v = $('kpi-voice');
    if (e) e.textContent = state.totals.events;
    if (h) h.textContent = state.totals.high;
    if (v) v.textContent = state.totals.voice;
  }

  function updateClock() {
    var el = $('zone-updated');
    if (el) el.textContent = '업데이트 ' + fmtTime(Date.now());
  }

  /* ---------------- 차트 ---------------- */
  function initCharts() {
    if (typeof Chart === 'undefined') return;
    Chart.defaults.color = '#8ea6b6';
    Chart.defaults.font.family = "'Pretendard','Inter',sans-serif";

    var zc = $('chart-zone');
    var sc = $('chart-sev');
    if (zc) {
      state.charts.zone = new Chart(zc, {
        type: 'doughnut',
        data: {
          labels: ZONES.map(function (z) { return z.name; }),
          datasets: [{
            data: ZONES.map(function (z) { return state.zoneCount[z.id]; }),
            backgroundColor: ['#34d5c8', '#6f9bff', '#ffc53d', '#ff7043'],
            borderColor: 'rgba(8,13,22,0.9)',
            borderWidth: 3
          }]
        },
        options: {
          responsive: true, maintainAspectRatio: false, cutout: '62%',
          plugins: { legend: { position: 'bottom', labels: { boxWidth: 12, padding: 14, font: { size: 11 } } } }
        }
      });
    }
    if (sc) {
      state.charts.sev = new Chart(sc, {
        type: 'bar',
        data: {
          labels: ['주의', '위험', '긴급'],
          datasets: [{
            label: '건수',
            data: [0, 0, 0],
            backgroundColor: ['#ffc53d', '#ff7043', '#ff3b5c'],
            borderRadius: 8,
            maxBarThickness: 46
          }]
        },
        options: {
          responsive: true, maintainAspectRatio: false,
          plugins: { legend: { display: false } },
          scales: {
            x: { grid: { display: false } },
            y: { beginAtZero: true, ticks: { precision: 0 }, grid: { color: 'rgba(120,205,220,0.1)' } }
          }
        }
      });
    }
  }

  function updateCharts() {
    if (state.charts.zone) {
      state.charts.zone.data.datasets[0].data = ZONES.map(function (z) { return state.zoneCount[z.id]; });
      state.charts.zone.update('none');
    }
    if (state.charts.sev) {
      state.charts.sev.data.datasets[0].data = ['주의', '위험', '긴급'].map(function (s) { return state.sevCount[s] || 0; });
      state.charts.sev.update('none');
    }
  }

  /* ---------------- DB 저장/조회 ---------------- */
  function saveEvent(z, ev, sev, ts) {
    var row = {
      room: z.name,
      event_type: ev.type,
      severity: sev,
      message: ev.msg,
      voice_text: ev.voice,
      created_at: new Date(ts).toISOString()
    };
    fetch('tables/events', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(row)
    }).then(function (res) {
      if (!res.ok) throw new Error('HTTP ' + res.status);
      return res.json();
    }).then(function () {
      loadHistory();
    }).catch(function (err) {
      console.warn('이벤트 저장 실패(데모 환경에서는 정상):', err.message);
    });
  }

  function loadHistory() {
    var body = $('history-body');
    var cnt = $('history-count');
    if (!body) return;
    fetch('tables/events?limit=200')
      .then(function (res) { return res.json(); })
      .then(function (json) {
        var rows = (json && json.data) ? json.data : [];
        rows.sort(function (a, b) {
          return new Date(b.created_at || 0) - new Date(a.created_at || 0);
        });
        rows = rows.slice(0, 40);
        if (cnt) cnt.textContent = rows.length + '건';
        if (!rows.length) {
          body.innerHTML = '<tr><td colspan="5" style="text-align:center;color:var(--text-mute)">' +
            '저장된 이력이 없습니다. 위험 시나리오가 발생하면 여기에 기록됩니다.</td></tr>';
          return;
        }
        body.innerHTML = rows.map(function (r) {
          var lvl = SEV_LEVEL[SEV_CLASS[r.severity] || 1] || 's1';
          return '<tr>' +
            '<td>' + fmtDateTime(new Date(r.created_at).getTime()) + '</td>' +
            '<td><b>' + (r.room || '-') + '</b></td>' +
            '<td>' + (r.event_type || '-') + '</td>' +
            '<td><span class="sev-pill ' + lvl + '">' + (r.severity || '-') + '</span></td>' +
            '<td>' + (r.voice_text || '-') + '</td>' +
            '</tr>';
        }).join('');
      })
      .catch(function (err) {
        if (cnt) cnt.textContent = '불러오기 실패';
        body.innerHTML = '<tr><td colspan="5" style="text-align:center;color:var(--text-mute)">' +
          '이력을 불러오지 못했습니다: ' + err.message + '</td></tr>';
      });
  }

  /* ---------------- 컨트롤 ---------------- */
  function initControls() {
    var pause = $('btn-pause');
    if (pause) {
      pause.addEventListener('click', function () {
        state.paused = !state.paused;
        var badge = $('live-badge');
        if (badge) {
          badge.classList.toggle('paused', state.paused);
          badge.textContent = state.paused ? 'PAUSED' : 'LIVE MONITORING';
        }
        pause.innerHTML = state.paused
          ? '<i class="fa-solid fa-play"></i> <span>재개</span>'
          : '<i class="fa-solid fa-pause"></i> <span>일시정지</span>';
      });
    }

    var trig = $('btn-trigger');
    if (trig) {
      trig.addEventListener('click', function () {
        var z = pick(ZONES);
        triggerEvent(z, true);
      });
    }

    var reset = $('btn-reset');
    if (reset) {
      reset.addEventListener('click', function () {
        state.totals = { events: 0, high: 0, voice: 0 };
        state.sevCount = { '주의': 0, '위험': 0, '긴급': 0 };
        ZONES.forEach(function (z) { state.zoneCount[z.id] = 0; state.actions[z.id] = { level: 1, metric: '', voice: '', until: 0 }; });
        state.log = [];
        var host = $('log-list');
        if (host) host.innerHTML = '<div class="empty"><i class="fa-solid fa-radio"></i>아직 감지된 이벤트가 없습니다.<br>센서 신호를 분석하는 중입니다…</div>';
        var cnt = $('log-count'); if (cnt) cnt.textContent = '0건';
        renderKpis();
        updateCharts();
        renderFloorplan();
        updateClock();
      });
    }

    var refresh = $('btn-refresh');
    if (refresh) refresh.addEventListener('click', loadHistory);

    // 모바일 내비
    var toggle = $('nav-toggle');
    var links = $('nav-links');
    if (toggle && links) {
      toggle.addEventListener('click', function () {
        var open = links.classList.toggle('open');
        toggle.setAttribute('aria-expanded', String(open));
        toggle.innerHTML = open ? '<i class="fa-solid fa-xmark"></i>' : '<i class="fa-solid fa-bars"></i>';
      });
    }
  }

  /* ---------------- 초기화 ---------------- */
  document.addEventListener('DOMContentLoaded', function () {
    renderFloorplan();
    initCharts();
    initControls();
    renderKpis();
    updateClock();
    loadHistory();

    // 초기 센서 값 채우기
    ZONES.forEach(function (z) {
      var el = $('zone-' + z.id);
      if (el) el.querySelector('[data-zmetric]').textContent = randomMetric(z);
    });

    // 약간의 지연 후 첫 이벤트로 데모 임팩트
    setTimeout(function () { triggerEvent(pick(ZONES), false); }, 1800);

    setInterval(tick, TICK_MS);
  });
})();
