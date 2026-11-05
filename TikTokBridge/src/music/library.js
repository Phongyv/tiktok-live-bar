'use strict';

const fs = require('node:fs/promises');
const path = require('node:path');

const SUPPORTED_EXTENSIONS = new Set(['.mp3', '.wav', '.ogg', '.m4a']);

function getMusicDirectories(bridgeDirectory) {
    const repositoryRoot = path.resolve(bridgeDirectory, '..');
    return [
        path.join(repositoryRoot, 'DJ_MUSIC'),
        path.join(repositoryRoot, 'Build', 'DJ_MUSIC'),
        path.join(repositoryRoot, 'assets', 'music'),
        path.join(bridgeDirectory, 'assets', 'music')
    ];
}

function createTrackId(fileName) {
    return Buffer.from(fileName, 'utf8').toString('base64url');
}

function decodeTrackId(trackId) {
    if (typeof trackId !== 'string' || !/^[A-Za-z0-9_-]{1,512}$/.test(trackId)) return null;
    try {
        const fileName = Buffer.from(trackId, 'base64url').toString('utf8');
        if (!fileName || fileName.includes('/') || fileName.includes('\\') ||
            path.basename(fileName) !== fileName || fileName.includes('\0')) return null;
        return createTrackId(fileName) === trackId ? fileName : null;
    } catch {
        return null;
    }
}

async function listMusicTracks(bridgeDirectory) {
    for (const directory of getMusicDirectories(bridgeDirectory)) {
        let entries;
        try {
            entries = await fs.readdir(directory, { withFileTypes: true });
        } catch (error) {
            if (error.code === 'ENOENT' || error.code === 'ENOTDIR') continue;
            throw error;
        }

        const tracks = entries
            .filter(entry => entry.isFile() && SUPPORTED_EXTENSIONS.has(path.extname(entry.name).toLowerCase()))
            .map(entry => ({
                id: createTrackId(entry.name),
                name: path.parse(entry.name).name,
                fileName: entry.name,
                url: '/music-files/' + createTrackId(entry.name)
            }))
            .sort((left, right) => left.fileName.localeCompare(right.fileName, 'vi', { sensitivity: 'base' }));

        if (tracks.length > 0) {
            return { directory, tracks };
        }
    }

    return { directory: null, tracks: [] };
}

async function resolveMusicTrack(bridgeDirectory, trackId) {
    const fileName = decodeTrackId(trackId);
    if (!fileName) return null;

    const { directory, tracks } = await listMusicTracks(bridgeDirectory);
    const track = tracks.find(item => item.id === trackId);
    if (!track || !directory) return null;

    return {
        ...track,
        filePath: path.join(directory, fileName)
    };
}

module.exports = {
    SUPPORTED_EXTENSIONS,
    createTrackId,
    decodeTrackId,
    getMusicDirectories,
    listMusicTracks,
    resolveMusicTrack
};
