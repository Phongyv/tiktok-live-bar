/* ─────────────────────────────────────────────────────────
   ÔNG CHÚ MMO — Control Panel JS
   © 2025 ÔNG CHÚ MMO — ongchummo.com
   Zalo: 0977.896.644 | Website: https://ongchummo.com
───────────────────────────────────────────────────────── */

/* ═══ SINGLE-PAGE SIDEBAR NAVIGATION ═════════════════════ */
const sidebarLinks = [...document.querySelectorAll('.gh-nav-link')];
const sidebar = document.getElementById('gh-sidebar');
const mobileMenuToggle = document.getElementById('mobile-menu-toggle');

function setActiveSection(sectionId) {
    sidebarLinks.forEach(link => {
        const active = link.getAttribute('href') === '#' + sectionId;
        link.classList.toggle('active', active);
        if (active) link.setAttribute('aria-current', 'page');
        else link.removeAttribute('aria-current');
    });
}

sidebarLinks.forEach(link => {
    link.addEventListener('click', () => {
        const sectionId = link.getAttribute('href')?.slice(1);
        if (sectionId) setActiveSection(sectionId);
        sidebar?.classList.remove('open');
        mobileMenuToggle?.setAttribute('aria-expanded', 'false');
    });
});

mobileMenuToggle?.addEventListener('click', () => {
    const isOpen = sidebar?.classList.toggle('open') === true;
    mobileMenuToggle.setAttribute('aria-expanded', String(isOpen));
});

if ('IntersectionObserver' in window) {
    const sectionObserver = new IntersectionObserver(entries => {
        const visible = entries
            .filter(entry => entry.isIntersecting)
            .sort((left, right) => right.intersectionRatio - left.intersectionRatio)[0];
        if (visible) setActiveSection(visible.target.id);
    }, {
        rootMargin: '-18% 0px -68% 0px',
        threshold: [0, 0.1, 0.25, 0.5, 0.75]
    });

    document.querySelectorAll('.page-section').forEach(section => sectionObserver.observe(section));
}

/* ═══ UI ELEMENT REFS ════════════════════════════════════ */
const ui = {
    // Navbar status
    statusDot:      document.getElementById('status-dot'),
    statusTitle:    document.getElementById('status-title'),
    // Card status (tab live)
    statusCardDot:  document.getElementById('status-card-dot'),
    statusTitleCard:document.getElementById('status-title-card'),
    statusMessage:  document.getElementById('status-message'),
    // Live tab
    username:       document.getElementById('username'),
    connect:        document.getElementById('connect'),
    disconnect:     document.getElementById('disconnect'),
    // Test lab
    stopDemo:       document.getElementById('stop-demo'),
    // Session
    reset:          document.getElementById('reset'),
    // Events
    userIndex:      document.getElementById('user-index'),
    // Rules
    joinMode:       document.getElementById('join-mode'),
    giftAlwaysJoins:document.getElementById('gift-always-joins'),
    masterRules:    document.getElementById('master-rules'),
    masterRuleTemplate: document.getElementById('master-rule-template'),
    addMasterRule:  document.getElementById('add-master-rule'),
    saveMaster:     document.getElementById('save-master'),
    masterMessage:  document.getElementById('master-message'),
    recentGifts:    document.getElementById('recent-gifts'),
    musicCurrentTitle: document.getElementById('music-current-title'),
    musicSourceStatus: document.getElementById('music-source-status'),
    musicSourceDetail: document.getElementById('music-source-detail'),
    musicSourceUrl: document.getElementById('music-source-url'),
    musicCopyUrl: document.getElementById('music-copy-url'),
    musicTrackList: document.getElementById('music-track-list'),
    musicRefresh: document.getElementById('music-refresh'),
    musicPrevious: document.getElementById('music-previous'),
    musicToggle: document.getElementById('music-toggle'),
    musicNext: document.getElementById('music-next'),
    musicShuffle: document.getElementById('music-shuffle'),
    musicRepeat: document.getElementById('music-repeat'),
    musicVolume: document.getElementById('music-volume'),
    musicVolumeLabel: document.getElementById('music-volume-label'),
    metrics: {
        events:   document.getElementById('metric-events'),
        members:  document.getElementById('metric-members'),
        chats:    document.getElementById('metric-chats'),
        gifts:    document.getElementById('metric-gifts'),
        diamonds: document.getElementById('metric-diamonds'),
        likes:    document.getElementById('metric-likes'),
    },
};

/* ═══ STATE ══════════════════════════════════════════════ */
let socket;
let reconnectTimer;
let masterConfig = { joinMode: 'keyword_only', giftAlwaysJoins: true, rules: [] };
const recentGifts = new Map();
let musicTracks = [];
let musicState = {
    currentTrackId: null,
    playing: false,
    volume: 0.35,
    shuffle: false,
    repeat: 'all',
    sourceReady: false,
    sourceError: '',
};

/* ═══ WEBSOCKET ══════════════════════════════════════════ */
function send(message) {
    if (socket?.readyState === WebSocket.OPEN) {
        socket.send(JSON.stringify(message));
    }
}

function setStatus(data) {
    const state = data.state || '';
    ui.statusDot.className = 'status-dot ' + state;
    if (ui.statusCardDot) ui.statusCardDot.className = 'status-card-dot ' + state;

    const names = {
        idle:         'Sẵn sàng',
        connecting:   'Đang kết nối…',
        connected:    '🔴 LIVE',
        demo:         '🧪 DEMO',
        disconnected: 'Mất kết nối',
        ended:        'Live kết thúc',
        error:        'Lỗi kết nối',
    };
    const label = names[state] || state;
    ui.statusTitle.textContent = label;
    if (ui.statusTitleCard) ui.statusTitleCard.textContent = label;
    if (ui.statusMessage)   ui.statusMessage.textContent = data.message || '';
    ui.connect.disabled = state === 'connecting';

    // Badge đỏ nhấp nháy khi đang LIVE thật
    const liveBadge = document.getElementById('live-badge');
    if (liveBadge) liveBadge.classList.toggle('is-live', state === 'connected');
}

function setMetrics(data) {
    for (const [key, el] of Object.entries(ui.metrics)) {
        el.textContent = Number(data[key] || 0).toLocaleString('vi-VN');
    }
}

/* ═══ MASTER RULES ═══════════════════════════════════════ */
function makeRuleId() {
    return `rule-${Date.now()}-${Math.random().toString(36).slice(2, 8)}`;
}

function emptyRule(overrides = {}) {
    return {
        id: makeRuleId(), enabled: true, source: 'gift', trigger: '',
        giftId: '', match: 'exact', action: 'dance', displayDiamonds: 0,
        durationMs: 3000, label: '', variant: '', fireworkBursts: 0, ...overrides,
    };
}

function setMasterMessage(msg, error = false) {
    ui.masterMessage.textContent = msg || '';
    ui.masterMessage.classList.toggle('error', error);
}

function updateRuleSource(row) {
    const source  = row.querySelector('[data-field="source"]').value;
    const giftId  = row.querySelector('[data-field="giftId"]');
    giftId.disabled     = source !== 'gift';
    giftId.placeholder  = source === 'gift' ? 'ID (nếu có)' : 'Không dùng cho chat';

    // Cập nhật border + badge màu theo loại
    row.dataset.src = source;
    const badge = row.querySelector('[data-src-label]');
    if (badge) {
        badge.textContent = source === 'gift' ? 'GIFT' : 'CHAT';
        badge.className   = `src-badge ${source}`;
    }
}

function createRuleRow(rule) {
    const row = ui.masterRuleTemplate.content.firstElementChild.cloneNode(true);
    row.dataset.ruleId = rule.id || makeRuleId();
    for (const input of row.querySelectorAll('[data-field]')) {
        const field = input.dataset.field;
        if (field === 'durationSeconds') input.value = (Number(rule.durationMs) || 0) / 1000;
        else if (input.type === 'checkbox') input.checked = rule[field] !== false;
        else input.value = rule[field] ?? '';
    }
    row.querySelector('[data-field="source"]').addEventListener('change', () => updateRuleSource(row));
    row.querySelector('[data-command="delete"]').addEventListener('click', () => row.remove());
    row.querySelector('[data-command="test"]').addEventListener('click', () => {
        const config = readMasterFromUi();
        send({ type: 'master_save', master: config });
        send({ type: 'master_test', ruleId: row.dataset.ruleId, diamonds: 100 });
        setMasterMessage('Đang test luật trên Unity…');
    });
    updateRuleSource(row);
    return row;
}

function renderMaster(config) {
    masterConfig = config || masterConfig;
    ui.joinMode.value        = masterConfig.joinMode || 'keyword_only';
    ui.giftAlwaysJoins.checked = masterConfig.giftAlwaysJoins !== false;
    ui.masterRules.replaceChildren(...(masterConfig.rules || []).map(createRuleRow));
}

function readMasterFromUi() {
    const rules = [...ui.masterRules.querySelectorAll('.master-rule-row')].map(row => ({
        id:              row.dataset.ruleId,
        enabled:         row.querySelector('[data-field="enabled"]').checked,
        source:          row.querySelector('[data-field="source"]').value,
        trigger:         row.querySelector('[data-field="trigger"]').value.trim(),
        giftId:          row.querySelector('[data-field="giftId"]').value.trim(),
        match:           row.querySelector('[data-field="match"]').value,
        action:          row.querySelector('[data-field="action"]').value,
        displayDiamonds: Number(row.querySelector('[data-field="displayDiamonds"]').value) || 0,
        durationMs:      Math.round((Number(row.querySelector('[data-field="durationSeconds"]').value) || 0) * 1000),
        label:           row.querySelector('[data-field="label"]').value.trim(),
        variant:         row.querySelector('[data-field="variant"]').value,
        fireworkBursts:  Number(row.querySelector('[data-field="fireworkBursts"]').value) || 0,
    }));
    return { joinMode: ui.joinMode.value, giftAlwaysJoins: ui.giftAlwaysJoins.checked, rules };
}

/* ═══ GIFT CATALOG ═══════════════════════════════════════ */
function observeGift(data) {
    const key = String(data.giftId || data.giftName || 'gift');
    recentGifts.set(key, data);
    while (recentGifts.size > 60) recentGifts.delete(recentGifts.keys().next().value);
    renderGiftCatalog();
}

function renderGiftCatalog() {
    ui.recentGifts.replaceChildren(
        ...[...recentGifts.values()].reverse().map(gift => {
            const btn = document.createElement('button');
            btn.type = 'button';
            btn.className = 'gift-catalog-item';
            if (gift.giftPictureUrl) {
                const img = document.createElement('img');
                img.src = gift.giftPictureUrl;
                img.alt = '';
                img.loading = 'lazy';
                btn.append(img);
            }
            const span = document.createElement('span');
            span.textContent = `${gift.giftName || 'Gift'} · ID ${gift.giftId || '?'} · ${gift.diamondCount || 0}💎`;
            btn.append(span);
            btn.addEventListener('click', () => {
                ui.masterRules.append(createRuleRow(emptyRule({
                    source: 'gift', trigger: gift.giftName || '',
                    giftId: String(gift.giftId || ''),
                    displayDiamonds: Number(gift.diamondCount) || 0, action: 'dance',
                })));
                setMasterMessage('Đã thêm gift vào cuối bảng. Chọn hành động rồi bấm Lưu & áp dụng.');
            });
            return btn;
        })
    );
}

/* ═══ DJ MUSIC ════════════════════════════════════════════ */
function sendMusicControl(action, extras = {}) {
    send({ type: 'music_control', action, ...extras });
}

function renderMusicLibrary() {
    if (!ui.musicTrackList) return;
    if (!musicTracks.length) {
        const empty = document.createElement('p');
        empty.className = 'help';
        empty.textContent = 'Chưa tìm thấy file nhạc. Hãy thêm MP3, WAV, OGG hoặc M4A vào DJ_MUSIC.';
        ui.musicTrackList.replaceChildren(empty);
        return;
    }

    ui.musicTrackList.replaceChildren(...musicTracks.map((track, index) => {
        const button = document.createElement('button');
        button.type = 'button';
        button.className = 'music-track' + (track.id === musicState.currentTrackId ? ' active' : '');
        button.dataset.trackId = track.id;
        const number = document.createElement('span');
        number.className = 'music-track-number';
        number.textContent = String(index + 1).padStart(2, '0');
        const title = document.createElement('span');
        title.className = 'music-track-name';
        title.textContent = track.name;
        const action = document.createElement('span');
        action.className = 'music-track-action';
        action.textContent = track.id === musicState.currentTrackId && musicState.playing ? 'ĐANG PHÁT' : 'PHÁT';
        button.append(number, title, action);
        button.addEventListener('click', () => sendMusicControl('select', { trackId: track.id }));
        return button;
    }));
}

function renderMusicState() {
    if (!ui.musicCurrentTitle) return;
    const current = musicTracks.find(track => track.id === musicState.currentTrackId);
    ui.musicCurrentTitle.textContent = current?.name || 'Chưa chọn bài';
    ui.musicSourceStatus.textContent = musicState.sourceReady ? 'Link đã kết nối' : 'Chưa kết nối Link';
    ui.musicSourceStatus.classList.toggle('music-connected', musicState.sourceReady);
    ui.musicSourceDetail.textContent = musicState.sourceError
        ? 'Lỗi phát nhạc: ' + musicState.sourceError
        : musicState.sourceReady
            ? (musicState.playing ? 'Nguồn nhạc đang phát vào TikTok LIVE Studio.' : 'Nguồn nhạc đã sẵn sàng, đang tạm dừng.')
            : 'Hãy thêm đường dẫn Music Source vào TikTok LIVE Studio để nhận âm thanh.';
    ui.musicToggle.textContent = musicState.playing ? 'Ⅱ Tạm dừng' : '▶ Phát nhạc';
    ui.musicShuffle.checked = musicState.shuffle === true;
    ui.musicRepeat.value = ['off', 'all', 'one'].includes(musicState.repeat) ? musicState.repeat : 'all';
    const volume = Math.round(Math.max(0, Math.min(1, Number(musicState.volume) || 0)) * 100);
    ui.musicVolume.value = String(volume);
    ui.musicVolumeLabel.textContent = volume + '%';
    renderMusicLibrary();
}

function receiveMusicLibrary(data) {
    musicTracks = Array.isArray(data.tracks) ? data.tracks : [];
    musicState = { ...musicState, ...(data.state || {}) };
    renderMusicState();
}

function receiveMusicState(data) {
    if (!data.state) return;
    musicState = { ...musicState, ...data.state };
    renderMusicState();
}

/* ═══ SOCKET ═════════════════════════════════════════════ */
function connectSocket() {
    clearTimeout(reconnectTimer);
    const protocol = location.protocol === 'https:' ? 'wss:' : 'ws:';
    socket = new WebSocket(`${protocol}//${location.host}`);

    socket.addEventListener('open', () => {
        send({ type: 'register', role: 'control' });
    });

    socket.addEventListener('message', event => {
        let data;
        try { data = JSON.parse(event.data); } catch { return; }
        if (data.type === 'status' || data.type === 'error') setStatus(data);
        if (data.type === 'metrics')        setMetrics(data);
        if (data.type === 'master_config')  renderMaster(data.master);
        if (data.type === 'master_saved')   setMasterMessage(data.message || 'Đã lưu Master.');
        if (data.type === 'gift_observed')  observeGift(data);
        if (data.type === 'gift_catalog') {
            recentGifts.clear();
            for (const g of data.gifts || [])
                recentGifts.set(String(g.giftId || g.giftName || 'gift'), g);
            renderGiftCatalog();
        }
        if (data.type === 'music_library') receiveMusicLibrary(data);
        if (data.type === 'music_state') receiveMusicState(data);
        if (data.type === 'error') setMasterMessage(data.message || 'Có lỗi.', true);
    });

    socket.addEventListener('close', () => {
        setStatus({ state: 'disconnected', message: 'Đang kết nối lại máy chủ…' });
        reconnectTimer = setTimeout(connectSocket, 2000);
    });

    socket.addEventListener('error', () => socket.close());
}

/* ═══ EVENT LISTENERS ════════════════════════════════════ */
ui.connect.addEventListener('click', () => {
    const username = ui.username.value.trim();
    if (username) send({ type: 'set_username', username });
});
ui.username.addEventListener('keydown', e => { if (e.key === 'Enter') ui.connect.click(); });
ui.disconnect.addEventListener('click', () => send({ type: 'disconnect_tiktok' }));
ui.stopDemo.addEventListener('click',   () => send({ type: 'demo_stop' }));
ui.reset.addEventListener('click',     () => send({ type: 'reset_game' }));
ui.musicRefresh.addEventListener('click', () => sendMusicControl('refresh'));
ui.musicPrevious.addEventListener('click', () => sendMusicControl('previous'));
ui.musicNext.addEventListener('click', () => sendMusicControl('next'));
ui.musicToggle.addEventListener('click', () =>
    sendMusicControl(musicState.playing ? 'pause' : 'play')
);
ui.musicShuffle.addEventListener('change', () =>
    sendMusicControl('set_shuffle', { enabled: ui.musicShuffle.checked })
);
ui.musicRepeat.addEventListener('change', () =>
    sendMusicControl('set_repeat', { repeat: ui.musicRepeat.value })
);
ui.musicVolume.addEventListener('input', () => {
    ui.musicVolumeLabel.textContent = ui.musicVolume.value + '%';
});
ui.musicVolume.addEventListener('change', () =>
    sendMusicControl('set_volume', { volume: Number(ui.musicVolume.value) / 100 })
);
ui.musicTrackList.addEventListener('click', event => {
    const track = event.target.closest('[data-track-id]');
    if (track) sendMusicControl('select', { trackId: track.dataset.trackId });
});
ui.musicSourceUrl.value = new URL('/music-source.html', location.origin).href;
ui.musicCopyUrl.addEventListener('click', async () => {
    try {
        await navigator.clipboard.writeText(ui.musicSourceUrl.value);
        ui.musicCopyUrl.textContent = 'Đã copy';
    } catch {
        ui.musicSourceUrl.focus();
        ui.musicSourceUrl.select();
        ui.musicCopyUrl.textContent = 'Đã chọn link';
    }
    setTimeout(() => { ui.musicCopyUrl.textContent = 'Copy'; }, 1800);
});
ui.addMasterRule.addEventListener('click', () => ui.masterRules.append(createRuleRow(emptyRule())));
ui.saveMaster.addEventListener('click', () => {
    send({ type: 'master_save', master: readMasterFromUi() });
    setMasterMessage('Đang lưu và áp dụng…');
});

document.querySelectorAll('[data-demo-count]').forEach(btn => {
    btn.addEventListener('click', () =>
        send({ type: 'demo_start', count: Number(btn.dataset.demoCount) })
    );
});

document.querySelectorAll('[data-action]').forEach(btn => {
    btn.addEventListener('click', () =>
        send({
            type:      'demo_event',
            action:    btn.dataset.action,
            value:     Number(btn.dataset.value) || 1,
            giftName:  btn.dataset.giftName || '',
            userIndex: Number(ui.userIndex.value) || 1,
        })
    );
});

/* ═══ INIT ═══════════════════════════════════════════════ */
connectSocket();
