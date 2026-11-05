const test = require('node:test');
const assert = require('node:assert/strict');
const {
    normalizeChat,
    normalizeMember,
    normalizeGift,
    isPendingGiftStreak
} = require('../src/tiktok/normalize-event');

test('normalizes v2 nested chat user data', () => {
    const event = normalizeChat({
        event: { msgId: 'chat-1' },
        user: {
            userId: '42',
            uniqueId: 'viewer',
            nickname: 'Viewer',
            profilePicture: { urls: ['https://example.com/avatar.jpg'] }
        },
        comment: 'nhảy'
    });

    assert.equal(event.userId, '42');
    assert.equal(event.nickname, 'Viewer');
    assert.equal(event.avatar, 'https://example.com/avatar.jpg');
    assert.equal(event.comment, 'nhảy');
});

test('normalizes avatar URLs from legacy and raw TikTok user shapes', () => {
    const legacy = normalizeMember({
        userId: 'legacy-1',
        uniqueId: 'legacy_viewer',
        nickname: 'Legacy Viewer',
        profilePictureUrl: 'https://example.com/legacy.jpg'
    });
    const raw = normalizeMember({
        user: {
            userId: 'raw-1',
            uniqueId: 'raw_viewer',
            nickname: 'Raw Viewer',
            avatarThumb: { urlList: ['https://example.com/raw.jpg'] }
        }
    });

    assert.equal(legacy.avatar, 'https://example.com/legacy.jpg');
    assert.equal(raw.avatar, 'https://example.com/raw.jpg');
});

test('normalizes gift value and detects unfinished streaks', () => {
    const pending = normalizeGift({
        user: { userId: '7', uniqueId: 'gifter' },
        giftId: 5655,
        repeatCount: 3,
        repeatEnd: 0,
        giftDetails: {
            giftName: 'Rose',
            giftType: 1,
            diamondCount: 1
        }
    });

    assert.equal(pending.diamondCount, 3);
    assert.equal(isPendingGiftStreak(pending), true);

    const finished = { ...pending, repeatEnd: true };
    assert.equal(isPendingGiftStreak(finished), false);
});
