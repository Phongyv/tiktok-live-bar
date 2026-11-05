'use strict';

const audio = document.getElementById('music-audio');
const panel = document.getElementById('activation-panel');
const title = document.getElementById('source-title');
const message = document.getElementById('source-message');
const enableButton = document.getElementById('enable-audio');

let socket = null;
let tracks = [];
let state = {
    currentTrackId: null,
    playing: false,
    volume: 0.35,
    shuffle: false,
    repeat: 'all',
    sourceReady: false
};
let reconnectTimer = null;

function send(data) {
    if (socket && socket.readyState === WebSocket.OPEN) {
        socket.send(JSON.stringify(data));
    }
}

function showPanel(heading, detail, showButton = false) {
    title.textContent = heading;
    message.textContent = detail;
    enableButton.hidden = !showButton;
    panel.classList.add('visible');
}

function hidePanel() {
    panel.classList.remove('visible');
}

function currentTrack() {
    return tracks.find(track => track.id === state.currentTrackId) || tracks[0] || null;
}

function setCurrentTrack(track) {
    if (!track) return false;
    state.currentTrackId = track.id;
    const expectedUrl = new URL(track.url, location.href).href;
    if (audio.src !== expectedUrl) {
        audio.pause();
        audio.src = track.url;
        audio.load();
    }
    audio.volume = Math.max(0, Math.min(1, Number(state.volume) || 0));
    return true;
}

function reportPlayback(playing, error = '') {
    send({
        type: 'music_playback',
        playing,
        trackId: state.currentTrackId || '',
        error
    });
}

async function startPlayback() {
    const track = currentTrack();
    if (!track) {
        showPanel('Chưa có nhạc', 'Thêm file MP3, WAV, OGG hoặc M4A vào thư mục DJ_MUSIC.');
        return;
    }

    setCurrentTrack(track);
    audio.volume = Math.max(0, Math.min(1, Number(state.volume) || 0));

    try {
        await audio.play();
        state.playing = true;
        hidePanel();
        reportPlayback(true);
    } catch (error) {
            showPanel(
            'Cần bật âm thanh một lần',
            'Nhấn nút bên dưới ngay trong nguồn Link của TikTok LIVE Studio. Sau đó có thể điều khiển nhạc từ Control Panel.',
            true
        );
        reportPlayback(false, error?.message || 'Trình duyệt nhúng chưa cho phép phát âm thanh.');
    }
}

function applyState(nextState) {
    const previousTrackId = state.currentTrackId;
    state = { ...state, ...(nextState || {}) };
    audio.volume = Math.max(0, Math.min(1, Number(state.volume) || 0));

    if (state.playing) {
        const trackChanged = state.currentTrackId !== previousTrackId;
        if (trackChanged || audio.paused) void startPlayback();
    } else {
        audio.pause();
    }
}

function handleLibrary(data) {
    tracks = Array.isArray(data.tracks) ? data.tracks : [];
    state = { ...state, ...(data.state || {}) };
    send({ type: 'music_source_ready' });

    if (!tracks.length) {
        hidePanel();
        return;
    }

    if (state.playing) {
        void startPlayback();
    } else {
        hidePanel();
    }
}

function nextTrack() {
    if (!tracks.length) return;
    const index = tracks.findIndex(track => track.id === state.currentTrackId);

    if (state.repeat === 'one' && index >= 0) {
        void startPlayback();
        return;
    }

    let nextIndex;
    if (state.shuffle && tracks.length > 1) {
        do {
            nextIndex = Math.floor(Math.random() * tracks.length);
        } while (nextIndex === index);
    } else {
        nextIndex = index + 1;
        if (nextIndex >= tracks.length) {
            if (state.repeat === 'off') {
                state.playing = false;
                reportPlayback(false);
                hidePanel();
                return;
            }
            nextIndex = 0;
        }
    }

    state.currentTrackId = tracks[nextIndex].id;
    state.playing = true;
    void startPlayback();
}

function connect() {
    clearTimeout(reconnectTimer);
    const protocol = location.protocol === 'https:' ? 'wss:' : 'ws:';
    socket = new WebSocket(protocol + '//' + location.host);

    socket.addEventListener('open', () => {
        send({ type: 'register', role: 'music' });
    });

    socket.addEventListener('message', event => {
        let data;
        try { data = JSON.parse(event.data); } catch { return; }

        if (data.type === 'music_library') handleLibrary(data);
        if (data.type === 'music_state') applyState(data.state);
    });

    socket.addEventListener('close', () => {
        hidePanel();
        reconnectTimer = setTimeout(connect, 2000);
    });

    socket.addEventListener('error', () => socket.close());
}

enableButton.addEventListener('click', () => {
    void startPlayback();
});

audio.addEventListener('ended', nextTrack);
audio.addEventListener('error', () => {
    const errorCode = audio.error?.code || 0;
    const description = audio.error?.message || ('Mã lỗi audio ' + errorCode);
    showPanel('Không phát được file nhạc', description);
    reportPlayback(false, description);
});
audio.addEventListener('play', () => {
    state.playing = true;
    hidePanel();
    reportPlayback(true);
});
connect();
