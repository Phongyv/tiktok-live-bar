'use strict';

const assert = require('node:assert/strict');
const fs = require('node:fs/promises');
const os = require('node:os');
const path = require('node:path');
const test = require('node:test');

const {
    createTrackId,
    decodeTrackId,
    listMusicTracks,
    resolveMusicTrack
} = require('../src/music/library');

test('creates reversible and path-safe track IDs', () => {
    const fileName = 'Nhạc nền #1.mp3';
    const id = createTrackId(fileName);
    assert.equal(decodeTrackId(id), fileName);
    assert.equal(decodeTrackId('../secret.mp3'), null);
    assert.equal(decodeTrackId('..\\secret.mp3'), null);
    assert.equal(decodeTrackId('not a valid id'), null);
});

test('lists supported audio files in a stable order and ignores other files', async () => {
    const root = await fs.mkdtemp(path.join(os.tmpdir(), 'ongchu-music-'));
    const bridge = path.join(root, 'TikTokBridge');
    const folder = path.join(root, 'DJ_MUSIC');
    await fs.mkdir(bridge, { recursive: true });
    await fs.mkdir(folder, { recursive: true });
    await Promise.all([
        fs.writeFile(path.join(folder, '02 - Party.ogg'), ''),
        fs.writeFile(path.join(folder, '01 - Intro.mp3'), ''),
        fs.writeFile(path.join(folder, 'notes.txt'), ''),
        fs.mkdir(path.join(folder, 'nested.mp3'))
    ]);

    try {
        const result = await listMusicTracks(bridge);
        assert.equal(result.directory, folder);
        assert.deepEqual(result.tracks.map(track => track.fileName), [
            '01 - Intro.mp3',
            '02 - Party.ogg'
        ]);
        assert.equal(result.tracks[0].name, '01 - Intro');
        assert.equal(result.tracks[0].url, '/music-files/' + result.tracks[0].id);
        const resolved = await resolveMusicTrack(bridge, result.tracks[0].id);
        assert.equal(resolved.filePath, path.join(folder, '01 - Intro.mp3'));
    } finally {
        await fs.rm(root, { recursive: true, force: true });
    }
});

test('returns an empty library when no supported audio files are present', async () => {
    const root = await fs.mkdtemp(path.join(os.tmpdir(), 'ongchu-music-empty-'));
    const bridge = path.join(root, 'TikTokBridge');
    await fs.mkdir(bridge, { recursive: true });

    try {
        const result = await listMusicTracks(bridge);
        assert.deepEqual(result.tracks, []);
        assert.equal(result.directory, null);
    } finally {
        await fs.rm(root, { recursive: true, force: true });
    }
});
