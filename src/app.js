/**
 * archivim — Frontend Logic
 */

const urlInput = document.getElementById('url-input');
const downloadBtn = document.getElementById('download-btn');
const btnText = document.getElementById('btn-text');
const btnIcon = document.getElementById('btn-icon');
const sourceBadge = document.getElementById('source-badge');
const settingsBtn = document.getElementById('settings-btn');
const settingsOverlay = document.getElementById('settings-overlay');
const settingsClose = document.getElementById('settings-close');
const settingsSave = document.getElementById('settings-save');
const settingsReset = document.getElementById('settings-reset');
const commandPreview = document.getElementById('command-preview');

const progressSection = document.getElementById('progress-section');
const statusText = document.getElementById('status-text');
const progressPercent = document.getElementById('progress-percent');
const progressFill = document.getElementById('progress-fill');
const logToggle = document.getElementById('log-toggle');
const cancelBtn = document.getElementById('cancel-btn');
const logPanel = document.getElementById('log-panel');
const logContent = document.getElementById('log-content');

const resultSection = document.getElementById('result-section');
const resultCard = document.getElementById('result-card');
const resultTitle = document.getElementById('result-title');
const resultSubtitle = document.getElementById('result-subtitle');

const historyList = document.getElementById('history-list');
const historyClear = document.getElementById('history-clear');
const historySection = document.getElementById('history-section');

const DEFAULTS = {
  audioFormat: 'm4a',
  audioQuality: '0',
  formatSelection: 'bestaudio[ext=m4a]/bestaudio',
  embedMetadata: true,
  embedThumbnail: true,
  convertThumbnails: 'jpg',
  embedChapters: false,
  writeLyrics: false,
  ytTemplate: '%(artist)s - %(title)s',
  scTemplate: '%(uploader)s - %(title)s',
  outputDir: '',
  restrictFilenames: false,
  sponsorblock: false,
  splitChapters: false,
  cookies: '',
  retries: '10',
  sleep: '0',
  proxy: '',
  geoBypass: true,
};

let isDownloading = false;
let downloadHistory = JSON.parse(localStorage.getItem('archivim_history') || '[]');
let settings = loadSettings();

function loadSettings() {
  try {
    const saved = JSON.parse(localStorage.getItem('archivim_settings'));
    return saved ? { ...DEFAULTS, ...saved } : { ...DEFAULTS };
  } catch { return { ...DEFAULTS }; }
}

function saveSettings() {
  const s = readSettingsFromUI();
  localStorage.setItem('archivim_settings', JSON.stringify(s));
  settings = s;
}

function readSettingsFromUI() {
  return {
    audioFormat:      document.getElementById('s-audio-format').value,
    audioQuality:     document.getElementById('s-audio-quality').value,
    formatSelection:  document.getElementById('s-format-selection').value,
    embedMetadata:    document.getElementById('s-embed-metadata').checked,
    embedThumbnail:   document.getElementById('s-embed-thumbnail').checked,
    convertThumbnails:document.getElementById('s-convert-thumbnails').value,
    embedChapters:    document.getElementById('s-embed-chapters').checked,
    writeLyrics:      document.getElementById('s-write-lyrics').checked,
    ytTemplate:       document.getElementById('s-yt-template').value,
    scTemplate:       document.getElementById('s-sc-template').value,
    outputDir:        document.getElementById('s-output-dir').value,
    restrictFilenames:document.getElementById('s-restrict-filenames').checked,
    sponsorblock:     document.getElementById('s-sponsorblock').checked,
    splitChapters:    document.getElementById('s-split-chapters').checked,
    cookies:          document.getElementById('s-cookies').value,
    retries:          document.getElementById('s-retries').value,
    sleep:            document.getElementById('s-sleep').value,
    proxy:            document.getElementById('s-proxy').value,
    geoBypass:        document.getElementById('s-geo-bypass').checked,
  };
}

function applySettingsToUI(s) {
  document.getElementById('s-audio-format').value      = s.audioFormat;
  document.getElementById('s-audio-quality').value     = s.audioQuality;
  document.getElementById('s-format-selection').value  = s.formatSelection;
  document.getElementById('s-embed-metadata').checked  = s.embedMetadata;
  document.getElementById('s-embed-thumbnail').checked = s.embedThumbnail;
  document.getElementById('s-convert-thumbnails').value= s.convertThumbnails;
  document.getElementById('s-embed-chapters').checked  = s.embedChapters;
  document.getElementById('s-write-lyrics').checked    = s.writeLyrics;
  document.getElementById('s-yt-template').value       = s.ytTemplate;
  document.getElementById('s-sc-template').value       = s.scTemplate;
  document.getElementById('s-output-dir').value        = s.outputDir;
  document.getElementById('s-restrict-filenames').checked = s.restrictFilenames;
  document.getElementById('s-sponsorblock').checked    = s.sponsorblock;
  document.getElementById('s-split-chapters').checked  = s.splitChapters;
  document.getElementById('s-cookies').value           = s.cookies;
  document.getElementById('s-retries').value           = s.retries;
  document.getElementById('s-sleep').value             = s.sleep;
  document.getElementById('s-proxy').value             = s.proxy;
  document.getElementById('s-geo-bypass').checked      = s.geoBypass;
  updateCommandPreview();
}

function updateCommandPreview() {
  const s = readSettingsFromUI();
  const parts = ['yt-dlp'];
  parts.push(`-f "${s.formatSelection}"`);
  parts.push('-x');
  parts.push(`--audio-format ${s.audioFormat}`);
  if (s.audioQuality !== '0') parts.push(`--audio-quality ${s.audioQuality}`);
  if (s.embedMetadata) parts.push('--embed-metadata');
  if (s.embedThumbnail) parts.push('--embed-thumbnail');
  if (s.convertThumbnails) parts.push(`--convert-thumbnails ${s.convertThumbnails}`);
  if (s.embedChapters) parts.push('--embed-chapters');
  if (s.writeLyrics) parts.push('--write-subs --sub-langs all');
  if (s.restrictFilenames) parts.push('--restrict-filenames');
  if (s.sponsorblock) parts.push('--sponsorblock-remove default');
  if (s.splitChapters) parts.push('--split-chapters');
  if (s.cookies) parts.push(`--cookies-from-browser ${s.cookies}`);
  if (s.retries !== '10') parts.push(`--retries ${s.retries}`);
  if (parseInt(s.sleep) > 0) parts.push(`--sleep-interval ${s.sleep}`);
  if (s.proxy) parts.push(`--proxy "${s.proxy}"`);
  if (s.geoBypass) parts.push('--geo-bypass');
  parts.push(`-o "${s.ytTemplate}.%(ext)s"`);
  parts.push('"URL"');
  commandPreview.textContent = parts.join(' ');
}

settingsBtn.addEventListener('click', () => {
  applySettingsToUI(settings);
  settingsOverlay.classList.add('open');
});

settingsClose.addEventListener('click', () => settingsOverlay.classList.remove('open'));

settingsOverlay.addEventListener('click', (e) => {
  if (e.target === settingsOverlay) settingsOverlay.classList.remove('open');
});

document.addEventListener('keydown', (e) => {
  if (e.key === 'Escape' && settingsOverlay.classList.contains('open')) {
    settingsOverlay.classList.remove('open');
  }
});

settingsSave.addEventListener('click', () => {
  saveSettings();
  settingsOverlay.classList.remove('open');
  showToast('Ayarlar kaydedildi');
});

settingsReset.addEventListener('click', () => {
  applySettingsToUI(DEFAULTS);
  updateCommandPreview();
});

document.querySelector('.settings-body').addEventListener('change', updateCommandPreview);
document.querySelector('.settings-body').addEventListener('input', updateCommandPreview);

document.querySelectorAll('.template-tags').forEach(container => {
  container.addEventListener('click', (e) => {
    const tag = e.target.closest('.tag');
    if (!tag) return;
    const targetId = container.dataset.target;
    const input = document.getElementById(targetId);
    const val = tag.dataset.val;
    const pos = input.selectionStart || input.value.length;
    const before = input.value.slice(0, pos);
    const after = input.value.slice(pos);
    const needsSpace = before.length > 0 && !before.endsWith(' ') && !before.endsWith('-') && !before.endsWith('_');
    input.value = before + (needsSpace ? ' ' : '') + val + after;
    input.focus();
    const newPos = pos + (needsSpace ? 1 : 0) + val.length;
    input.setSelectionRange(newPos, newPos);
    updateCommandPreview();
  });
});

function showToast(message) {
  let toast = document.querySelector('.toast');
  if (!toast) {
    toast = document.createElement('div');
    toast.className = 'toast';
    document.body.appendChild(toast);
  }
  toast.textContent = message;
  toast.classList.add('show');
  setTimeout(() => toast.classList.remove('show'), 2000);
}

function detectSource(url) {
  if (url.includes('youtube.com') || url.includes('youtu.be') || url.includes('music.youtube.com')) return 'youtube';
  if (url.includes('soundcloud.com')) return 'soundcloud';
  return null;
}

urlInput.addEventListener('input', () => {
  const source = detectSource(urlInput.value.trim());
  if (source === 'youtube') {
    sourceBadge.className = 'source-badge visible youtube';
    sourceBadge.innerHTML = `<svg viewBox="0 0 24 24" fill="currentColor"><path d="M23.498 6.186a3.016 3.016 0 0 0-2.122-2.136C19.505 3.545 12 3.545 12 3.545s-7.505 0-9.377.505A3.017 3.017 0 0 0 .502 6.186C0 8.07 0 12 0 12s0 3.93.502 5.814a3.016 3.016 0 0 0 2.122 2.136c1.871.505 9.376.505 9.376.505s7.505 0 9.377-.505a3.015 3.015 0 0 0 2.122-2.136C24 15.93 24 12 24 12s0-3.93-.502-5.814zM9.545 15.568V8.432L15.818 12l-6.273 3.568z"/></svg> YouTube`;
    urlInput.classList.add('has-badge');
  } else if (source === 'soundcloud') {
    sourceBadge.className = 'source-badge visible soundcloud';
    sourceBadge.innerHTML = `<svg viewBox="0 0 24 24" fill="currentColor" width="12" height="12"><path d="M1.175 12.225c-.051 0-.094.046-.101.1l-.233 2.154.233 2.105c.007.058.05.098.101.098.05 0 .09-.04.099-.098l.255-2.105-.27-2.154c-.009-.06-.05-.1-.1-.1m3.574-1.448c-.074 0-.131.06-.131.132l-.18 2.205.18 2.094c0 .074.057.131.131.131.076 0 .133-.057.133-.131l.209-2.094-.209-2.205c0-.072-.057-.132-.133-.132m1.813-.345c-.08 0-.147.065-.147.143l-.165 2.43.165 2.156c0 .08.067.145.147.145.082 0 .148-.065.148-.145l.189-2.156-.189-2.43c0-.078-.066-.143-.148-.143m3.823-.78c-.107 0-.193.088-.193.196l-.12 2.685.12 2.266c0 .108.086.196.193.196.108 0 .195-.088.195-.196l.135-2.266-.135-2.685c0-.108-.087-.196-.195-.196"/></svg> SoundCloud`;
    urlInput.classList.add('has-badge');
  } else {
    sourceBadge.className = 'source-badge';
    urlInput.classList.remove('has-badge');
  }
});

urlInput.addEventListener('keydown', (e) => {
  if (e.key === 'Enter' && !isDownloading) startDownload();
});

downloadBtn.addEventListener('click', () => {
  if (!isDownloading) startDownload();
});

window.addEventListener('focus', async () => {
  if (isDownloading || urlInput.value.trim()) return;
  try {
    const text = await navigator.clipboard.readText();
    if (text && detectSource(text)) { urlInput.value = text; urlInput.dispatchEvent(new Event('input')); }
  } catch {}
});

let currentAbortController = null;

async function startDownload() {
  const url = urlInput.value.trim();
  if (!url || isDownloading) return;
  const source = detectSource(url);
  if (!source) { showResult('error', 'Ge\u00E7ersiz link', 'YouTube, YouTube Music veya SoundCloud linki yap\u0131\u015Ft\u0131r\u0131n.'); return; }

  isDownloading = true;
  downloadBtn.disabled = true;
  btnText.textContent = '\u0130ndiriliyor';
  btnIcon.innerHTML = '<div class="spinner"></div>';

  progressSection.classList.add('visible');
  resultSection.classList.remove('visible');
  statusText.textContent = 'Ba\u011Flan\u0131yor...';
  progressPercent.textContent = '';
  progressFill.style.width = '0%';
  progressFill.classList.add('indeterminate');
  logContent.innerHTML = '';
  cancelBtn.style.display = 'block';

  let lastFilename = '';
  currentAbortController = new AbortController();

  try {
    const response = await fetch('/api/download', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ url, settings }),
      signal: currentAbortController.signal
    });

    if (!response.ok) {
      const data = await response.json();
      throw new Error(data.error || 'Sunucu hatas\u0131');
    }

    const reader = response.body.getReader();
    const decoder = new TextDecoder();
    let buffer = '';

    while (true) {
      const { done, value } = await reader.read();
      if (done) break;
      buffer += decoder.decode(value, { stream: true });
      const lines = buffer.split('\n');
      buffer = lines.pop() || '';
      let currentEvent = '';
      for (const line of lines) {
        if (line.startsWith('event: ')) currentEvent = line.slice(7);
        else if (line.startsWith('data: ')) {
          const data = JSON.parse(line.slice(6));
          switch (currentEvent) {
            case 'status': statusText.textContent = data; break;
            case 'progress':
              const pct = parseFloat(data);
              progressFill.classList.remove('indeterminate');
              progressFill.style.width = pct + '%';
              progressPercent.textContent = pct.toFixed(1) + '%';
              break;
            case 'log': appendLog(data); break;
            case 'filename':
              const parts = data.replace(/\\/g, '/').split('/');
              lastFilename = data;
              statusText.textContent = `\u0130ndiriliyor: ` + parts[parts.length - 1];
              break;
            case 'done':
              if (data === 'success') {
                showResult('success', 'Tamamland\u0131', 'Dosya kaydedildi.');
                progressFill.style.width = '100%';
                progressPercent.textContent = '100%';
                addToHistory(url, source, lastFilename);
              } else {
                showResult('error', 'Ba\u015Far\u0131s\u0131z', '\u0130ndirme s\u0131ras\u0131nda hata olu\u015Ftu.');
              }
              break;
          }
        }
      }
    }
  } catch (err) {
    if (err.name === 'AbortError') {
      showResult('error', '\u0130ptal Edildi', '\u0130ndirme i\u015Flemi durduruldu.');
    } else {
      showResult('error', 'Hata', err.message);
    }
  }

  isDownloading = false;
  downloadBtn.disabled = false;
  btnText.textContent = '\u0130ndir';
  btnIcon.innerHTML = `<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path d="M21 15v4a2 2 0 01-2 2H5a2 2 0 01-2-2v-4"/><polyline points="7 10 12 15 17 10"/><line x1="12" y1="15" x2="12" y2="3"/></svg>`;
  progressFill.classList.remove('indeterminate');
  cancelBtn.style.display = 'none';
}

cancelBtn.addEventListener('click', () => {
  if (currentAbortController) {
    currentAbortController.abort();
    currentAbortController = null;
  }
});

function appendLog(text) {
  const entry = document.createElement('div');
  entry.className = 'log-entry';
  entry.textContent = text;
  logContent.appendChild(entry);
  logContent.scrollTop = logContent.scrollHeight;
}

logToggle.addEventListener('click', () => {
  logToggle.classList.toggle('open');
  logPanel.classList.toggle('expanded');
});

function showResult(type, title, subtitle) {
  resultSection.classList.add('visible');
  resultCard.className = `result-card `+type;
  resultTitle.textContent = title;
  resultSubtitle.textContent = subtitle;
  const iconEl = resultCard.querySelector('.result-icon');
  iconEl.innerHTML = type === 'success'
    ? `<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><polyline points="20 6 9 17 4 12"/></svg>`
    : `<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><circle cx="12" cy="12" r="10"/><line x1="15" y1="9" x2="9" y2="15"/><line x1="9" y1="9" x2="15" y2="15"/></svg>`;
}

function addToHistory(url, source, filename) {
  const name = filename ? filename.replace(/\\/g, '/').split('/').pop() : (url.length > 50 ? url.substring(0, 50) + '...' : url);
  downloadHistory.unshift({ url, source, name, time: new Date().toLocaleTimeString('tr-TR', { hour: '2-digit', minute: '2-digit' }) });
  if (downloadHistory.length > 10) downloadHistory.pop();
  localStorage.setItem('archivim_history', JSON.stringify(downloadHistory));
  renderHistory();
}

function renderHistory() {
  if (downloadHistory.length === 0) { historySection.style.display = 'none'; return; }
  historySection.style.display = 'block';
  historyList.innerHTML = downloadHistory.map((item, i) => `
    <div class="history-item" data-index="`+i+`" title="`+escapeHtml(item.url)+`">
      <div class="history-source success"></div>
      <span class="history-name">`+escapeHtml(item.name)+`</span>
      <span class="history-time">`+item.time+`</span>
      <button class="history-delete" data-index="`+i+`" title="Sil">
        <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round" width="14" height="14">
          <path d="M3 6h18"/><path d="M19 6v14a2 2 0 01-2 2H7a2 2 0 01-2-2V6m3 0V4a2 2 0 012-2h4a2 2 0 012 2v2"/><line x1="10" y1="11" x2="10" y2="17"/><line x1="14" y1="11" x2="14" y2="17"/>
        </svg>
      </button>
    </div>`).join('');
    
  historyList.querySelectorAll('.history-item').forEach(el => {
    el.addEventListener('click', (e) => {
      if (e.target.closest('.history-delete')) return;
      urlInput.value = downloadHistory[parseInt(el.dataset.index)].url;
      urlInput.dispatchEvent(new Event('input'));
      urlInput.focus();
    });
  });

  historyList.querySelectorAll('.history-delete').forEach(btn => {
    btn.addEventListener('click', (e) => {
      e.stopPropagation();
      const idx = parseInt(btn.dataset.index);
      downloadHistory.splice(idx, 1);
      localStorage.setItem('archivim_history', JSON.stringify(downloadHistory));
      renderHistory();
    });
  });
}

historyClear.addEventListener('click', () => {
  downloadHistory = [];
  localStorage.removeItem('archivim_history');
  renderHistory();
});

function escapeHtml(str) { const d = document.createElement('div'); d.textContent = str; return d.innerHTML; }

renderHistory();
urlInput.focus();
