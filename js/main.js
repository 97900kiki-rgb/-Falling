/* =====================================================================
   main.js — 랜딩/제안 페이지 상호작용
   ===================================================================== */
(function () {
  'use strict';

  /* ---------------- 콘텐츠 데이터 ---------------- */
  const RISKS = [
    {
      icon: 'fa-shower',
      title: '욕실',
      tags: ['수분', '시야'],
      desc: '물기와 비누 거품, 샤워 후 수증기로 인한 급격한 시야 저하가 발생합니다.'
    },
    {
      icon: 'fa-stairs',
      title: '계단 · 복도',
      tags: ['조도', '장애물'],
      desc: '어두운 야간 조도, 예기치 않은 바닥 장애물과 급한 보행이 겹칩니다.'
    },
    {
      icon: 'fa-bed',
      title: '침실',
      tags: ['기상', '균형'],
      desc: '야간 기상 직후의 혈압 저하, 침대 주변 슬리퍼와 급격한 방향 전환이 위험합니다.'
    },
    {
      icon: 'fa-door-open',
      title: '주방 · 현관',
      tags: ['문턱', '분주함'],
      desc: '조리 중 흘린 물기, 신발장 앞 미세 단차와 외출 준비 중의 분주함이 원인입니다.'
    }
  ];

  const STEPS = [
    {
      no: '01',
      title: '상태 정밀 감지',
      desc: '바닥 수분, 조도 변화, 인체 움직임, 문턱 및 장애물 센서가 공간의 실시간 위험 신호를 측정합니다.'
    },
    {
      no: '02',
      title: '위험 수준 및 문맥 판단',
      desc: '시간대(심야/주간)와 이용자의 체류 시간, 위험 심각도를 분석해 가장 적절한 안내 시점과 문구를 선택합니다.'
    },
    {
      no: '03',
      title: '현장 음성 및 보호자 전파',
      desc: '현장 스피커로 즉시 주의 행동을 안내하고, 고위험 지속 시 전용 관리자 웹 및 보호자 앱으로 호출을 전송합니다.'
    }
  ];

  const FEATURES = [
    { icon: 'fa-microchip', title: '엣지 AI 온디바이스 분석', desc: '클라우드 왕복 없이 공간 내부에서 위험을 즉시 해석합니다.' },
    { icon: 'fa-wave-square', title: '멀티센서 신호 융합', desc: '수분·조도·움직임·문턱 신호를 결합해 오탐을 줄입니다.' },
    { icon: 'fa-comment-dots', title: '맞춤형 음성 안내', desc: '심야에는 낮은 톤, 주간에는 또렷한 톤으로 문맥에 맞게 안내합니다.' },
    { icon: 'fa-bell', title: '고위험 에스컬레이션', desc: '위험이 지속되면 관리자 웹과 보호자 앱으로 자동 호출합니다.' },
    { icon: 'fa-chart-line', title: '위험 이력 리포트', desc: '공간별 이벤트 통계로 취약 구역을 데이터로 개선합니다.' },
    { icon: 'fa-user-shield', title: '프라이버시 우선 설계', desc: '영상 대신 비식별 센서 신호만 처리해 사생활을 보호합니다.' }
  ];

  /* ---------------- 렌더링 ---------------- */
  function renderRisks() {
    const host = document.getElementById('risk-cards');
    if (!host) return;
    host.innerHTML = RISKS.map(function (r) {
      const tags = r.tags.map(function (t) { return '<span class="tag">' + t + '</span>'; }).join('');
      return '<article class="card risk-card reveal">' +
        '<div class="risk-icon"><i class="fa-solid ' + r.icon + '"></i></div>' +
        '<h3>' + r.title + '</h3>' +
        '<div class="risk-tags">' + tags + '</div>' +
        '<p>' + r.desc + '</p>' +
        '</article>';
    }).join('');
  }

  function renderSteps() {
    const host = document.getElementById('steps');
    if (!host) return;
    host.innerHTML = STEPS.map(function (s) {
      return '<article class="step">' +
        '<div class="step-num">' + s.no + '</div>' +
        '<h3>' + s.title + '</h3>' +
        '<p>' + s.desc + '</p>' +
        '</article>';
    }).join('');
  }

  function renderFeatures() {
    const host = document.getElementById('feature-list');
    if (!host) return;
    host.innerHTML = FEATURES.map(function (f) {
      return '<div class="feature">' +
        '<i class="fa-solid ' + f.icon + '"></i>' +
        '<div><b>' + f.title + '</b><span>' + f.desc + '</span></div>' +
        '</div>';
    }).join('');
  }

  /* ---------------- 모바일 내비 ---------------- */
  function initNav() {
    const toggle = document.getElementById('nav-toggle');
    const links = document.getElementById('nav-links');
    if (!toggle || !links) return;
    toggle.addEventListener('click', function () {
      const open = links.classList.toggle('open');
      toggle.setAttribute('aria-expanded', String(open));
      toggle.innerHTML = open ? '<i class="fa-solid fa-xmark"></i>' : '<i class="fa-solid fa-bars"></i>';
    });
    links.addEventListener('click', function (e) {
      if (e.target.tagName === 'A') {
        links.classList.remove('open');
        toggle.setAttribute('aria-expanded', 'false');
        toggle.innerHTML = '<i class="fa-solid fa-bars"></i>';
      }
    });
  }

  /* ---------------- 스크롤 등장 ---------------- */
  function initReveal() {
    const items = document.querySelectorAll('.reveal');
    if (!('IntersectionObserver' in window)) {
      items.forEach(function (el) { el.classList.add('in'); });
      return;
    }
    const io = new IntersectionObserver(function (entries) {
      entries.forEach(function (en) {
        if (en.isIntersecting) {
          en.target.classList.add('in');
          io.unobserve(en.target);
        }
      });
    }, { threshold: 0.12, rootMargin: '0px 0px -40px 0px' });
    items.forEach(function (el, i) {
      el.style.transitionDelay = (i % 4) * 70 + 'ms';
      io.observe(el);
    });
  }

  /* ---------------- 히어로 미니 데모 ---------------- */
  const DEMO_SCENES = [
    {
      room: '욕실', level: 'alert',
      metric: '습도 88% · 수증기 감지',
      voice: '욕실 바닥이 미끄럽습니다. 난간을 잡고 천천히 이동하세요.'
    },
    {
      room: '계단·복도', level: 'active',
      metric: '조도 12lx · 야간 모드',
      voice: '복도가 어둡습니다. 발밑을 확인하고 한 칸씩 내려가세요.'
    },
    {
      room: '침실', level: 'active',
      metric: '기상 감지 · 3초 정지',
      voice: '일어나실 때 잠시 앉아 호흡을 고른 뒤 일어나세요.'
    },
    {
      room: '주방·현관', level: 'alert',
      metric: '바닥 물기 · 문턱 단차 2cm',
      voice: '현관에 물기가 있습니다. 문턱을 넘을 때 발을 들어 주세요.'
    }
  ];

  function initHeroDemo() {
    const rooms = Array.prototype.slice.call(document.querySelectorAll('#room-map .room'));
    const voiceText = document.getElementById('voice-text');
    const voiceIcon = document.getElementById('voice-icon');
    if (!rooms.length || !voiceText) return;

    let i = 0;
    const reduce = window.matchMedia && window.matchMedia('(prefers-reduced-motion: reduce)').matches;

    function apply(scene) {
      rooms.forEach(function (r) {
        const on = r.getAttribute('data-room') === scene.room;
        r.classList.toggle('active', on && scene.level === 'active');
        r.classList.toggle('alert', on && scene.level === 'alert');
        if (!on) r.classList.remove('active', 'alert');
        const m = r.querySelector('[data-metric]');
        if (m && on) m.textContent = scene.metric;
      });
      voiceText.textContent = '“' + scene.voice + '”';
      if (voiceIcon) {
        voiceIcon.classList.add('on');
        voiceIcon.innerHTML = '<i class="fa-solid fa-volume-high"></i>';
        setTimeout(function () { voiceIcon.classList.remove('on'); }, 1400);
      }
    }

    apply(DEMO_SCENES[0]);
    if (reduce) return;

    setInterval(function () {
      i = (i + 1) % DEMO_SCENES.length;
      apply(DEMO_SCENES[i]);
    }, 4200);
  }

  /* ---------------- 도입 문의 폼 ---------------- */
  function getVal(form, name) {
    const el = form.elements[name];
    return el ? String(el.value || '').trim() : '';
  }

  function setFieldError(input, msg) {
    const field = input.closest('.field');
    if (!field) return;
    field.classList.toggle('invalid', Boolean(msg));
    const err = field.querySelector('[data-err]');
    if (err) err.textContent = msg || '';
  }

  function validate(form) {
    let ok = true;
    const rules = [
      { name: 'name', label: '담당자 이름', test: function (v) { return v.length >= 1 ? '' : '이름을 입력해 주세요.'; } },
      { name: 'organization', label: '기관/시설명', test: function (v) { return v.length >= 1 ? '' : '기관 또는 시설명을 입력해 주세요.'; } },
      { name: 'facility_type', label: '시설 유형', test: function (v) { return v ? '' : '시설 유형을 선택해 주세요.'; } },
      {
        name: 'contact', label: '연락처', test: function (v) {
          if (!v) return '연락처 또는 이메일을 입력해 주세요.';
          const isMail = /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(v);
          const isPhone = /^[0-9+\-\s()]{8,20}$/.test(v);
          return (isMail || isPhone) ? '' : '이메일 또는 전화번호 형식으로 입력해 주세요.';
        }
      }
    ];
    rules.forEach(function (r) {
      const input = form.elements[r.name];
      if (!input) return;
      const msg = r.test(getVal(form, r.name));
      setFieldError(input, msg);
      if (msg) ok = false;
    });
    return ok;
  }

  function initForm() {
    const form = document.getElementById('inquiry-form');
    const status = document.getElementById('form-status');
    const btn = document.getElementById('submit-btn');
    if (!form) return;

    form.addEventListener('input', function (e) {
      if (e.target.closest('.field')) setFieldError(e.target, '');
    });

    form.addEventListener('submit', async function (e) {
      e.preventDefault();
      if (!validate(form)) {
        show('필수 항목을 다시 확인해 주세요.', 'bad');
        return;
      }

      const payload = {
        name: getVal(form, 'name'),
        organization: getVal(form, 'organization'),
        facility_type: getVal(form, 'facility_type'),
        contact: getVal(form, 'contact'),
        message: getVal(form, 'message'),
        created_at: new Date().toISOString()
      };

      const label = btn.querySelector('span');
      const original = label ? label.textContent : '';
      btn.disabled = true;
      if (label) label.textContent = '전송 중…';

      try {
        const res = await fetch('tables/inquiries', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify(payload)
        });
        if (!res.ok) throw new Error('HTTP ' + res.status);
        form.reset();
        show('상담 신청이 접수되었습니다. 담당자가 곧 연락드리겠습니다. 감사합니다.', 'ok');
      } catch (err) {
        console.error('inquiry submit failed:', err);
        show('전송 중 문제가 발생했습니다. 잠시 후 다시 시도해 주세요.', 'bad');
      } finally {
        btn.disabled = false;
        if (label) label.textContent = original;
      }
    });

    function show(msg, kind) {
      if (!status) return;
      status.textContent = msg;
      status.className = 'form-status show ' + kind;
      if (kind === 'ok') {
        setTimeout(function () { status.className = 'form-status'; }, 6000);
      }
    }
  }

  /* ---------------- 부드러운 앵커 이동 ---------------- */
  function initAnchors() {
    document.addEventListener('click', function (e) {
      const a = e.target.closest('a[href^="#"]');
      if (!a) return;
      const id = a.getAttribute('href');
      if (id === '#' || id.length < 2) return;
      const target = document.querySelector(id);
      if (!target) return;
      e.preventDefault();
      const top = target.getBoundingClientRect().top + window.pageYOffset - 84;
      window.scrollTo({ top: top, behavior: 'smooth' });
    });
  }

  /* ---------------- 초기화 ---------------- */
  document.addEventListener('DOMContentLoaded', function () {
    renderRisks();
    renderSteps();
    renderFeatures();
    initNav();
    initReveal();
    initHeroDemo();
    initForm();
    initAnchors();
  });
})();
