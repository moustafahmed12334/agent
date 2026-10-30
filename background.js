/* AgentPulse background service worker.
   Handles: recurring badge updates, alerts at 5/2/0 minutes before a break
   (or right at start time only, in test mode), and telling every open tab
   to show the in-page overlay banner.

   Note on limits: Chrome's alarms API only guarantees ~1-minute
   granularity, and MV3 service workers are suspended when idle. So the
   toolbar badge is reliably accurate to the minute at all times, and
   switches to a live per-second "urgent" countdown as a best-effort burst
   during the last ~70 seconds before a break starts, while the worker is
   awake. The popup itself always shows a fully live, per-second countdown
   when it's open, since it runs its own timer. */

const ALARM_NAME = 'agentpulse-tick';
const DHIKR_ALARM_NAME = 'agentpulse-dhikr';
const ALERT_OFFSETS_MIN = [5, 2, 0]; // minutes before start; 0 = at start time
let burstInterval = null;

const DHIKR_PHRASES = [
  'أستغفر الله العظيم وأتوب إليه',
  'سبحان الله وبحمده، سبحان الله العظيم',
  'لا إله إلا الله وحده لا شريك له',
  'اللهم صلِّ وسلم على نبينا محمد',
  'الحمد لله رب العالمين',
  'لا حول ولا قوة إلا بالله',
  'سبحان الله والحمد لله ولا إله إلا الله والله أكبر',
  'اللهم إني أسألك العفو والعافية'
];

chrome.runtime.onInstalled.addListener(() => {
  chrome.alarms.create(ALARM_NAME, { periodInMinutes: 1 });
  setupDhikrAlarm();
  tick();
});

chrome.runtime.onStartup.addListener(() => {
  chrome.alarms.create(ALARM_NAME, { periodInMinutes: 1 });
  setupDhikrAlarm();
  tick();
});

chrome.alarms.onAlarm.addListener((alarm) => {
  if (alarm.name === ALARM_NAME) tick();
  if (alarm.name === DHIKR_ALARM_NAME) fireDhikrReminder();
});

chrome.runtime.onMessage.addListener((msg) => {
  if (msg && (msg.type === 'breaks-updated' || msg.type === 'settings-updated')) {
    tick();
  }
  if (msg && msg.type === 'settings-updated') {
    setupDhikrAlarm();
  }
});

function timeStrToMinutes(t) {
  if (!t) return null;
  const [h, m] = t.split(':').map(Number);
  return h * 60 + m;
}

function dateKey(d) {
  return `${d.getFullYear()}-${d.getMonth() + 1}-${d.getDate()}`;
}

async function getStore() {
  return new Promise((resolve) => {
    chrome.storage.local.get(['breaks', 'settings', 'notifiedLog', 'breakOverrides'], (res) => {
      resolve({
        breaks: res.breaks || [],
        settings: res.settings || { darker: false, testMode: false },
        notifiedLog: res.notifiedLog || {},
        overrides: res.breakOverrides || {}
      });
    });
  });
}

async function tick() {
  const { breaks, settings, notifiedLog, overrides } = await getStore();
  const now = new Date();
  const nowMin = now.getHours() * 60 + now.getMinutes();
  const today = dateKey(now);

  let current = null;
  let nextBreak = null;
  let nextDiffMin = Infinity;

  // Test mode collapses to a single alert right at start time, so a
  // quick check doesn't require waiting through the full 5-minute lead-in.
  const offsets = settings.testMode ? [0] : ALERT_OFFSETS_MIN;

  for (const b of breaks) {
    const override = overrides[b.id] && overrides[b.id].date === today ? overrides[b.id] : null;
    const effStart = override ? override.start : b.start;
    const effEnd = override ? override.end : b.end;

    const startMin = timeStrToMinutes(effStart);
    const endMin = timeStrToMinutes(effEnd);
    if (startMin == null || endMin == null) continue;

    if (nowMin >= startMin && nowMin < endMin) {
      current = b;
    }

    // "Next" always follows the original schedule — an override only affects today.
    const schedStartMin = timeStrToMinutes(b.start);
    let diff = schedStartMin - nowMin;
    if (diff < 0) diff += 1440; // wraps to tomorrow
    if (diff < nextDiffMin) {
      nextDiffMin = diff;
      nextBreak = b;
    }

    // Manually-started breaks skip their originally scheduled alerts today
    // (the popup already marks those as notified when "Start now" is used).
    if (override) continue;

    for (const offset of offsets) {
      const alertMin = (startMin - offset + 1440) % 1440;
      if (nowMin === alertMin) {
        const key = `${b.id}-${today}-${offset}`;
        if (notifiedLog[key] !== true) {
          fireBreakAlert(b, offset);
          notifiedLog[key] = true;
          chrome.storage.local.set({ notifiedLog });
        }
      }
    }
  }

  updateBadge(current, nextDiffMin);
}

function updateBadge(current, nextDiffMin) {
  if (current) {
    chrome.action.setBadgeBackgroundColor({ color: '#34d399' });
    chrome.action.setBadgeText({ text: 'now' });
    stopBurst();
    return;
  }

  if (!isFinite(nextDiffMin)) {
    chrome.action.setBadgeText({ text: '' });
    stopBurst();
    return;
  }

  if (nextDiffMin >= 1) {
    chrome.action.setBadgeBackgroundColor({ color: '#8b5cf6' });
    chrome.action.setBadgeText({ text: String(nextDiffMin) });
    stopBurst();
  } else {
    // Inside the final minute: run a short live-seconds burst.
    startBurst();
  }
}

function startBurst() {
  if (burstInterval) return;
  const targetTime = Date.now() + 60000; // approx one minute window from now
  chrome.action.setBadgeBackgroundColor({ color: '#c81e3f' });

  burstInterval = setInterval(() => {
    const secLeft = Math.max(0, Math.round((targetTime - Date.now()) / 1000));
    chrome.action.setBadgeText({ text: String(secLeft) });
    if (secLeft <= 0) stopBurst();
  }, 1000);

  // Safety timeout so it never runs forever if something goes wrong.
  setTimeout(stopBurst, 70000);
}

function stopBurst() {
  if (burstInterval) {
    clearInterval(burstInterval);
    burstInterval = null;
  }
}

function setupDhikrAlarm() {
  chrome.alarms.create(DHIKR_ALARM_NAME, { periodInMinutes: 2 });
}

async function fireDhikrReminder() {
  const { settings } = await getStore();
  if (settings.dhikrReminders === false) return; // opt-out, defaults to on

  chrome.storage.local.get(['dhikrIndex'], (res) => {
    const idx = (res.dhikrIndex || 0) % DHIKR_PHRASES.length;
    const phrase = DHIKR_PHRASES[idx];
    chrome.storage.local.set({ dhikrIndex: (idx + 1) % DHIKR_PHRASES.length });

    chrome.tabs.query({}, (tabs) => {
      for (const tab of tabs || []) {
        if (!tab.id || !tab.url) continue;
        if (!/^https?:\/\//.test(tab.url)) continue;

        chrome.scripting
          .executeScript({
            target: { tabId: tab.id },
            func: injectAgentPulseDhikrBanner,
            args: [phrase]
          })
          .catch(() => {});
      }
    });
  });
}

function fireBreakAlert(b, offsetMin) {
  const leadText = offsetMin === 0 ? 'is starting now' : `starts in ${offsetMin} minute${offsetMin === 1 ? '' : 's'}`;

  chrome.notifications.create(`agentpulse-${b.id}-${Date.now()}`, {
    type: 'basic',
    iconUrl: 'icons/icon128.png',
    title: `${b.name} ${leadText}`,
    message: `${b.start} → ${b.end}`,
    priority: 2
  });

  chrome.tabs.query({}, (tabs) => {
    for (const tab of tabs || []) {
      if (!tab.id || !tab.url) continue;
      if (!/^https?:\/\//.test(tab.url)) continue; // skip chrome://, extension pages, etc.

      chrome.scripting
        .executeScript({
          target: { tabId: tab.id },
          func: injectAgentPulseBanner,
          args: [b.name, b.start, b.end, leadText]
        })
        .catch(() => {
          // Some tabs (Chrome Web Store, etc.) never allow injection — ignore.
        });
    }
  });
}

/* Self-contained fallback injector for the dhikr banner, mirroring
   injectAgentPulseBanner's island effect but with just a phrase, no times. */
function injectAgentPulseDhikrBanner(phrase) {
  const existing = document.getElementById('agentpulse-dhikr-root');
  if (existing) existing.remove();

  const root = document.createElement('div');
  root.id = 'agentpulse-dhikr-root';
  Object.assign(root.style, {
    all: 'initial',
    position: 'fixed',
    top: '0',
    left: '0',
    right: '0',
    display: 'flex',
    justifyContent: 'center',
    paddingTop: '12px',
    zIndex: '2147483647',
    pointerEvents: 'none',
    fontFamily: "'Segoe UI', Arial, sans-serif"
  });

  const banner = document.createElement('div');
  Object.assign(banner.style, {
    pointerEvents: 'auto',
    display: 'flex',
    alignItems: 'center',
    gap: '10px',
    background: 'linear-gradient(135deg, #2a1a45, #3b2559)',
    border: '1px solid rgba(167,139,250,0.35)',
    boxShadow: '0 10px 30px rgba(0,0,0,0.25), 0 0 24px rgba(139,92,246,0.35)',
    padding: '9px 16px',
    transform: 'translateY(-10px)',
    opacity: '0',
    clipPath: 'inset(0% 42% 0% 42% round 999px)',
    transition:
      'clip-path .5s cubic-bezier(.2,.9,.3,1.2), transform .5s cubic-bezier(.2,.9,.3,1.2), opacity .35s ease',
    direction: 'rtl',
    fontFamily: "'Segoe UI', Tahoma, Arial, sans-serif"
  });

  const text = document.createElement('p');
  Object.assign(text.style, { fontSize: '13px', fontWeight: '600', color: '#e9defc', margin: '0', whiteSpace: 'nowrap' });
  text.textContent = phrase;

  banner.appendChild(text);
  root.appendChild(banner);
  document.documentElement.appendChild(root);

  requestAnimationFrame(() => {
    requestAnimationFrame(() => {
      banner.style.transform = 'translateY(0)';
      banner.style.opacity = '1';
      banner.style.clipPath = 'inset(0% 0% 0% 0% round 16px)';
    });
  });

  const dismiss = () => {
    banner.style.clipPath = 'inset(0% 42% 0% 42% round 999px)';
    banner.style.opacity = '0';
    setTimeout(() => root.remove(), 550);
  };
  setTimeout(dismiss, 5000);
}

/* This function is serialized and run inside each tab by chrome.scripting.
   It must be fully self-contained (no references to outer variables). */
function injectAgentPulseBanner(name, start, end, leadText) {
  const existing = document.getElementById('agentpulse-overlay-root');
  if (existing) existing.remove();

  const root = document.createElement('div');
  root.id = 'agentpulse-overlay-root';
  Object.assign(root.style, {
    all: 'initial',
    position: 'fixed',
    top: '0',
    left: '0',
    right: '0',
    display: 'flex',
    justifyContent: 'center',
    paddingTop: '12px',
    zIndex: '2147483647',
    pointerEvents: 'none',
    fontFamily: "'Segoe UI', Arial, sans-serif"
  });

  const banner = document.createElement('div');
  Object.assign(banner.style, {
    pointerEvents: 'auto',
    display: 'flex',
    alignItems: 'center',
    gap: '12px',
    background: 'linear-gradient(135deg, #2a1a45, #3b2559)',
    border: '1px solid rgba(167,139,250,0.35)',
    boxShadow: '0 10px 30px rgba(0,0,0,0.25), 0 0 24px rgba(139,92,246,0.35)',
    padding: '10px 14px',
    transform: 'translateY(-10px)',
    opacity: '0',
    clipPath: 'inset(0% 42% 0% 42% round 999px)',
    transition:
      'clip-path .5s cubic-bezier(.2,.9,.3,1.2), transform .5s cubic-bezier(.2,.9,.3,1.2), opacity .35s ease'
  });

  const icon = document.createElement('div');
  Object.assign(icon.style, {
    width: '32px', height: '32px', borderRadius: '9px',
    background: 'linear-gradient(135deg, #8b5cf6, #6a3fc7)',
    display: 'flex', alignItems: 'center', justifyContent: 'center',
    color: '#fff', fontWeight: '700', fontSize: '14px', flexShrink: '0',
    boxShadow: '0 0 12px rgba(139,92,246,0.6)'
  });
  icon.textContent = 'H';

  const textWrap = document.createElement('div');
  Object.assign(textWrap.style, { display: 'flex', flexDirection: 'column', gap: '1px', whiteSpace: 'nowrap' });

  const title = document.createElement('p');
  Object.assign(title.style, { fontSize: '13px', fontWeight: '600', color: '#fff', margin: '0' });
  title.textContent = `${name} ${leadText || 'starts soon'}`;

  const sub = document.createElement('p');
  Object.assign(sub.style, { fontSize: '11px', color: '#c9b8f0', margin: '0' });
  sub.textContent = `${start} → ${end}`;

  textWrap.appendChild(title);
  textWrap.appendChild(sub);

  const close = document.createElement('div');
  Object.assign(close.style, {
    width: '22px', height: '22px', borderRadius: '6px',
    background: 'rgba(255,255,255,0.08)', border: '1px solid rgba(255,255,255,0.15)',
    color: '#c9b8f0', fontSize: '12px',
    display: 'flex', alignItems: 'center', justifyContent: 'center',
    flexShrink: '0', cursor: 'pointer'
  });
  close.textContent = '✕';

  banner.appendChild(icon);
  banner.appendChild(textWrap);
  banner.appendChild(close);
  root.appendChild(banner);
  document.documentElement.appendChild(root);

  // Island effect: pill -> expanded -> pill, matching content.js's version.
  requestAnimationFrame(() => {
    requestAnimationFrame(() => {
      banner.style.transform = 'translateY(0)';
      banner.style.opacity = '1';
      banner.style.clipPath = 'inset(0% 0% 0% 0% round 16px)';
    });
  });

  const dismiss = () => {
    banner.style.clipPath = 'inset(0% 42% 0% 42% round 999px)';
    banner.style.opacity = '0';
    setTimeout(() => root.remove(), 550);
  };
  close.addEventListener('click', dismiss);
  setTimeout(dismiss, 6000);
}
