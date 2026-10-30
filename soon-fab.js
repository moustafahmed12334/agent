(function () {
  let widget = null; // holds { root, styleTag } while mounted

  function buildWidget() {
    if (document.getElementById('helperhub-fab-root')) return null;

    const IVR_MENU = [
      { name: 'FTTH', code: '86251' },
      { name: 'WE Gold & Indigo', code: '641888' },
      { name: 'Mobile 015 GSM (Prepaid)', code: '641712' },
      { name: 'Cancellation & Retention', code: '642065' },
      { name: 'Email & Hosting', code: '86670' },
      { name: 'We mix Packages', code: '66713' },
      { name: 'static IP & option back', code: '86670' },
      { name: 'WE Life / IPTV', code: '642115' }
    ];

    const root = document.createElement('div');
    root.id = 'helperhub-fab-root';
    Object.assign(root.style, { all: 'initial', fontFamily: "'Segoe UI', Tahoma, Arial, sans-serif" });

    // --- Main circle: bottom-right corner, raised 50px, compact ---
    const circle = document.createElement('div');
    Object.assign(circle.style, {
      position: 'fixed',
      bottom: '68px',
      right: '18px',
      width: '38px',
      height: '38px',
      borderRadius: '50%',
      background: 'linear-gradient(135deg, #8b5cf6, #6a3fc7)',
      display: 'flex',
      alignItems: 'center',
      justifyContent: 'center',
      cursor: 'pointer',
      zIndex: '2147483646',
      userSelect: 'none',
      boxShadow: '0 6px 16px rgba(0,0,0,0.35), 0 0 0 0 rgba(139,92,246,0.55)',
      animation: 'helperhub-breathe 2.4s ease-in-out infinite'
    });
    const circleText = document.createElement('span');
    Object.assign(circleText.style, { color: '#fff', fontSize: '9px', fontWeight: '700' });
    circleText.textContent = 'Quick';
    circle.appendChild(circleText);

    const styleTag = document.createElement('style');
    styleTag.textContent = `
      @keyframes helperhub-breathe {
        0%, 100% { box-shadow: 0 6px 16px rgba(0,0,0,0.35), 0 0 0 0 rgba(139,92,246,0.55); }
        50% { box-shadow: 0 6px 16px rgba(0,0,0,0.35), 0 0 14px 5px rgba(139,92,246,0.35); }
      }
    `;
    document.documentElement.appendChild(styleTag);

    // --- Radial fan items: placed on a real arc around the main circle,
    // evenly spaced by angle so they read as "circling" it, with a clear
    // angular gap between each one.
    const FAB_SIZE = 38;      // matches main circle's width/height
    const FAN_SIZE = 40;
    const ARC_RADIUS = 70;    // distance from main circle's center
    const CX = 18 + FAB_SIZE / 2;  // main circle center, px from right edge
    const CY = 68 + FAB_SIZE / 2;  // main circle center, px from bottom edge

    // 40° apart at this radius keeps a real visible gap between the fan
    // circles (chord distance ~48px vs. their own 40px diameter).
    const SECTIONS = [
      { key: 'tts', label: 'TTS', angleDeg: 10 },
      { key: 'prices', label: 'Prices', angleDeg: 50 },
      { key: 'ivr', label: 'IVR', angleDeg: 90 }
    ];

    const ACTIVE_COLOR = '#34d399';
    const ACTIVE_BG = 'rgba(52,211,153,0.16)';
    const IDLE_BG = 'rgba(42,26,69,0.95)';
    const IDLE_BORDER = 'rgba(167,139,250,0.4)';

    const fanEls = {};
    SECTIONS.forEach((s) => {
      const rad = (s.angleDeg * Math.PI) / 180;
      const distRight = CX + ARC_RADIUS * Math.cos(rad) - FAN_SIZE / 2;
      const distBottom = CY + ARC_RADIUS * Math.sin(rad) - FAN_SIZE / 2;

      const wrap = document.createElement('div');
      Object.assign(wrap.style, {
        position: 'fixed',
        right: `${distRight}px`,
        bottom: `${distBottom}px`,
        cursor: 'pointer',
        zIndex: '2147483646',
        opacity: '0',
        transform: 'scale(0.3)',
        pointerEvents: 'none',
        transition: 'transform .25s cubic-bezier(.2,.9,.3,1.3), opacity .2s ease'
      });
      const circleBtn = document.createElement('div');
      Object.assign(circleBtn.style, {
        width: FAN_SIZE + 'px', height: FAN_SIZE + 'px', borderRadius: '50%',
        background: IDLE_BG,
        border: `2px solid ${IDLE_BORDER}`,
        display: 'flex', alignItems: 'center', justifyContent: 'center',
        textAlign: 'center',
        fontSize: '8px', fontWeight: '700', color: '#e9defc', lineHeight: '1.1',
        padding: '2px', boxSizing: 'border-box',
        boxShadow: '0 4px 12px rgba(0,0,0,0.35)',
        transition: 'background .15s ease, border-color .15s ease, color .15s ease'
      });
      circleBtn.textContent = s.label;
      wrap.appendChild(circleBtn);
      root.appendChild(wrap);
      fanEls[s.key] = { wrap, circle: circleBtn };
    });

    function setFanActive(activeKey) {
      Object.keys(fanEls).forEach((key) => {
        const el = fanEls[key].circle;
        if (key === activeKey) {
          el.style.background = ACTIVE_BG;
          el.style.borderColor = ACTIVE_COLOR;
          el.style.color = ACTIVE_COLOR;
        } else {
          el.style.background = IDLE_BG;
          el.style.borderColor = IDLE_BORDER;
          el.style.color = '#e9defc';
        }
      });
    }

    // --- Content panel (shown after picking a fan item) ---
    const panel = document.createElement('div');
    Object.assign(panel.style, {
      position: 'fixed',
      bottom: '114px',
      right: '18px',
      transform: 'translateY(10px) scale(0.92)',
      transformOrigin: 'bottom right',
      opacity: '0',
      width: '270px',
      maxHeight: 'none',
      overflowY: 'visible',
      background: 'linear-gradient(180deg, #2a1a45 0%, #1a0f30 100%)',
      border: '1px solid rgba(167,139,250,0.35)',
      borderRadius: '16px',
      boxShadow: '0 16px 40px rgba(0,0,0,0.5), 0 0 24px rgba(139,92,246,0.3)',
      padding: '14px',
      zIndex: '2147483647',
      pointerEvents: 'none',
      transition: 'transform .25s cubic-bezier(.2,.9,.3,1.2), opacity .2s ease'
    });
    const header = document.createElement('div');
    Object.assign(header.style, { display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: '10px' });
    const title = document.createElement('p');
    Object.assign(title.style, { fontSize: '13px', fontWeight: '700', color: '#fff', margin: '0' });
    const close = document.createElement('div');
    Object.assign(close.style, {
      width: '20px', height: '20px', borderRadius: '6px',
      background: 'rgba(255,255,255,0.08)', border: '1px solid rgba(255,255,255,0.15)',
      color: '#c9b8f0', fontSize: '11px', cursor: 'pointer',
      display: 'flex', alignItems: 'center', justifyContent: 'center'
    });
    close.textContent = '✕';
    header.appendChild(title);
    header.appendChild(close);
    const contentArea = document.createElement('div');
    panel.appendChild(header);
    panel.appendChild(contentArea);

    root.appendChild(circle);
    root.appendChild(panel);
    document.documentElement.appendChild(root);

    let state = 'closed'; // 'closed' | 'fan' | 'content'

    function renderIvr() {
      contentArea.innerHTML = '';
      IVR_MENU.forEach((entry) => {
        const row = document.createElement('div');
        Object.assign(row.style, {
          display: 'flex', alignItems: 'center', justifyContent: 'space-between',
          background: 'rgba(0,0,0,0.15)', border: '1px solid rgba(167,139,250,0.25)',
          borderRadius: '10px', padding: '7px 10px', marginBottom: '5px', gap: '8px'
        });
        const nameEl = document.createElement('span');
        Object.assign(nameEl.style, { fontSize: '11px', color: '#fff', fontWeight: '600' });
        nameEl.textContent = entry.name;
        const right = document.createElement('span');
        Object.assign(right.style, { display: 'flex', alignItems: 'center', gap: '6px' });
        const codeEl = document.createElement('span');
        Object.assign(codeEl.style, { fontSize: '11px', color: '#c9b8f0', fontFamily: 'monospace' });
        codeEl.textContent = entry.code;
        const copyBtn = document.createElement('span');
        Object.assign(copyBtn.style, {
          width: '20px', height: '20px', borderRadius: '5px',
          background: 'rgba(255,255,255,0.06)', border: '1px solid rgba(167,139,250,0.25)',
          color: '#a78bfa', fontSize: '10px', cursor: 'pointer',
          display: 'flex', alignItems: 'center', justifyContent: 'center'
        });
        copyBtn.textContent = '⧉';
        copyBtn.addEventListener('click', (e) => {
          e.stopPropagation();
          navigator.clipboard.writeText(entry.code).catch(() => {});
          goClosed();
        });
        right.appendChild(codeEl);
        right.appendChild(copyBtn);
        row.appendChild(nameEl);
        row.appendChild(right);
        contentArea.appendChild(row);
      });
    }

    function renderPlaceholder(key) {
      contentArea.innerHTML = '';
      const note = document.createElement('div');
      Object.assign(note.style, {
        background: 'rgba(139,92,246,0.1)', border: '1px solid rgba(167,139,250,0.25)',
        borderRadius: '10px', padding: '10px', fontSize: '12px', color: '#c9b8f0', lineHeight: '1.6'
      });
      note.textContent = key === 'tts' ? 'TTS details coming soon.' : 'Price list coming soon.';
      contentArea.appendChild(note);
    }

    function showFan() {
      state = 'fan';
      setFanActive(null);
      Object.values(fanEls).forEach((el, i) => {
        el.wrap.style.pointerEvents = 'auto';
        setTimeout(() => {
          el.wrap.style.opacity = '1';
          el.wrap.style.transform = 'scale(1)';
        }, i * 40);
      });
      hidePanel();
    }

    function hideFan() {
      Object.values(fanEls).forEach((el) => {
        el.wrap.style.opacity = '0';
        el.wrap.style.transform = 'scale(0.3)';
        el.wrap.style.pointerEvents = 'none';
      });
    }

    function showPanel(key) {
      state = 'content';
      setFanActive(key);
      hideFan();
      title.textContent = { tts: 'TTS', prices: 'Prices', ivr: 'IVR Menu' }[key];
      if (key === 'ivr') renderIvr();
      else renderPlaceholder(key);
      panel.style.pointerEvents = 'auto';
      panel.style.transform = 'translateY(0) scale(1)';
      panel.style.opacity = '1';
    }

    function hidePanel() {
      panel.style.transform = 'translateY(10px) scale(0.92)';
      panel.style.opacity = '0';
      panel.style.pointerEvents = 'none';
    }

    function goClosed() {
      state = 'closed';
      hideFan();
      hidePanel();
    }

    circle.addEventListener('click', (e) => {
      e.stopPropagation();
      if (state === 'closed') showFan();
      else goClosed();
    });

    Object.keys(fanEls).forEach((key) => {
      fanEls[key].wrap.addEventListener('click', (e) => {
        e.stopPropagation();
        showPanel(key);
      });
    });

    close.addEventListener('click', (e) => {
      e.stopPropagation();
      goClosed();
    });

    panel.addEventListener('click', (e) => e.stopPropagation());

    // Clicking anywhere else on the page closes everything (circle stays put).
    document.addEventListener('click', () => {
      if (state !== 'closed') goClosed();
    });

    return { root, styleTag };
  }

  function mount() {
    if (widget) return; // already mounted
    const built = buildWidget();
    if (built) widget = built;
  }

  function unmount() {
    if (!widget) {
      // in case it exists but wasn't tracked (shouldn't normally happen)
      const stray = document.getElementById('helperhub-fab-root');
      if (stray) stray.remove();
      return;
    }
    widget.root.remove();
    widget.styleTag.remove();
    widget = null;
  }

  function applyEnabled(enabled) {
    if (enabled) mount();
    else unmount();
  }

  try {
    chrome.storage.local.get(['settings'], (res) => {
      const enabled = !(res.settings && res.settings.showSoonFab === false);
      applyEnabled(enabled);
    });

    // React live to the Settings toggle, without needing a page reload.
    if (chrome.storage && chrome.storage.onChanged) {
      chrome.storage.onChanged.addListener((changes, area) => {
        if (area !== 'local' || !changes.settings) return;
        const newSettings = changes.settings.newValue || {};
        const enabled = newSettings.showSoonFab !== false;
        applyEnabled(enabled);
      });
    }
  } catch (e) {
    mount();
  }
})();
