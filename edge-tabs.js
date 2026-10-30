(function () {
  if (window.top !== window) return; // top frame only

  const SECTIONS = [
    { view: 'breaks', icon: '⏱', en: 'Breaks', ar: 'البريكات' },
    { view: 'ivr', icon: '☎', en: 'IVR', ar: 'IVR' },
    { view: 'tools', icon: '🔑', en: 'Tools', ar: 'الأدوات' },
    { view: 'hub', icon: '▤', en: 'Quick Ref', ar: 'مرجع سريع' }
  ];

  let host = null;

  function mount(lang) {
    if (host) return;
    host = document.createElement('div');
    host.id = 'helperhub-edge-root';
    host.style.cssText = 'all:initial;position:fixed;top:0;right:0;width:0;height:0;z-index:2147483645;';
    const shadow = host.attachShadow({ mode: 'open' });

    const style = document.createElement('style');
    style.textContent = `
      .tabs{position:fixed;right:0;top:50%;transform:translateY(-50%);display:flex;flex-direction:column;gap:8px;}
      .tab{
        display:flex;flex-direction:column;align-items:center;gap:6px;
        padding:10px 6px;width:30px;box-sizing:border-box;cursor:pointer;user-select:none;
        background:linear-gradient(180deg,#8b5cf6,#6a3fc7);color:#fff;
        border-radius:12px 0 0 12px;box-shadow:-2px 4px 14px rgba(0,0,0,.35);
        font:700 11px 'Segoe UI',Tahoma,Arial,sans-serif;
        transition:transform .15s ease, filter .15s ease;
      }
      .tab:hover{filter:brightness(1.12);transform:translateX(-2px);}
      .tab.active{background:linear-gradient(180deg,#34d399,#059669);}
      .tab .ic{font-size:13px;line-height:1;}
      .tab .tx{writing-mode:vertical-rl;letter-spacing:.02em;white-space:nowrap;}
      .panel{
        position:fixed;right:42px;top:50%;width:380px;height:min(580px,92vh);
        transform:translateY(-50%) translateX(14px) scale(.97);transform-origin:right center;
        opacity:0;pointer-events:none;
        border-radius:18px;overflow:hidden;border:1px solid rgba(167,139,250,.35);
        box-shadow:0 18px 50px rgba(0,0,0,.55),0 0 28px rgba(139,92,246,.3);
        background:#1a0f30;
        transition:transform .22s cubic-bezier(.2,.9,.3,1.1),opacity .18s ease;
      }
      .panel.open{opacity:1;pointer-events:auto;transform:translateY(-50%) translateX(0) scale(1);}
      iframe{width:100%;height:100%;border:0;display:block;background:#1a0f30;}
    `;

    const tabsEl = document.createElement('div');
    tabsEl.className = 'tabs';
    const panel = document.createElement('div');
    panel.className = 'panel';
    const iframe = document.createElement('iframe');
    panel.appendChild(iframe);

    let activeView = null;
    const tabEls = {};

    function setActive(view) {
      activeView = view;
      Object.keys(tabEls).forEach((v) => tabEls[v].classList.toggle('active', v === view));
    }
    function closePanel() {
      panel.classList.remove('open');
      setActive(null);
    }
    // Load the panel's page ahead of time so the first click opens instantly.
    function preload() {
      if (!iframe.getAttribute('src')) iframe.src = chrome.runtime.getURL('popup.html') + '#breaks';
    }
    (window.requestIdleCallback || ((f) => setTimeout(f, 200)))(preload);

    function openView(view) {
      const base = chrome.runtime.getURL('popup.html');
      const target = base + '#' + view;
      if (!iframe.getAttribute('src')) iframe.src = target;
      else if (iframe.contentWindow) {
        try { iframe.contentWindow.location.hash = view; } catch (e) { iframe.src = target; }
      }
      panel.classList.add('open');
      setActive(view);
    }

    SECTIONS.forEach((s) => {
      const t = document.createElement('div');
      t.className = 'tab';
      const ic = document.createElement('span');
      ic.className = 'ic';
      ic.textContent = s.icon;
      const tx = document.createElement('span');
      tx.className = 'tx';
      tx.textContent = lang === 'ar' ? s.ar : s.en;
      t.appendChild(ic);
      t.appendChild(tx);
      t.addEventListener('mouseenter', preload);
      t.addEventListener('click', (e) => {
        e.stopPropagation();
        if (activeView === s.view) closePanel();
        else openView(s.view);
      });
      tabEls[s.view] = t;
      tabsEl.appendChild(t);
    });

    panel.addEventListener('click', (e) => e.stopPropagation());
    shadow.appendChild(style);
    shadow.appendChild(tabsEl);
    shadow.appendChild(panel);
    document.documentElement.appendChild(host);

    host._close = closePanel;
    document.addEventListener('click', host._outside = () => closePanel());
  }

  function unmount() {
    if (!host) return;
    document.removeEventListener('click', host._outside);
    host.remove();
    host = null;
  }

  function apply(settings) {
    const s = settings || {};
    if (s.showEdgeTabs === true) {
      mount(s.language === 'ar' ? 'ar' : 'en');
    } else {
      unmount();
    }
  }

  try {
    chrome.storage.local.get(['settings'], (res) => apply(res.settings));
    chrome.storage.onChanged.addListener((changes, area) => {
      if (area === 'local' && changes.settings) {
        const o = changes.settings.oldValue || {};
        const n = changes.settings.newValue || {};
        if (o.showEdgeTabs !== n.showEdgeTabs) apply(n);
      }
    });
  } catch (e) { /* extension context gone; do nothing */ }
})();
