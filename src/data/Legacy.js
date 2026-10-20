// Meta-progression: every run earns Legacy points that permanently unlock small starting perks.
// Stored in localStorage; applied to each new character by main.js (applyLegacyPerks).

const KEY = 'pixel_rpg_legacy_v1';

export const LEGACY_PERKS = {
    pack_rat:    { id: 'pack_rat',    icon: '🎒', name: 'Pack Rat',     cost: 30,  desc: 'Start with 2 Healing Potions.' },
    lucky_purse: { id: 'lucky_purse', icon: '💰', name: 'Lucky Purse',  cost: 40,  desc: 'Start with 40 gold.' },
    thick_skin:  { id: 'thick_skin',  icon: '💪', name: 'Thick Skin',   cost: 60,  desc: '+4 Max HP.' },
    sharp_eyes:  { id: 'sharp_eyes',  icon: '👁️', name: 'Sharp Eyes',   cost: 70,  desc: '+1 Perception.' },
    quick_study: { id: 'quick_study', icon: '📚', name: 'Quick Study',  cost: 100, desc: '+10% XP from everything.' },
    gem_cutter:  { id: 'gem_cutter',  icon: '💎', name: 'Gem Cutter',   cost: 120, desc: 'Start with a Flawed Topaz gem.' }
};

function load() {
    try {
        const raw = localStorage.getItem(KEY);
        if (raw) {
            const d = JSON.parse(raw);
            return { points: d.points || 0, perks: d.perks || [], best: d.best || { floor: 0, kills: 0 }, runs: d.runs || 0 };
        }
    } catch (e) {}
    return { points: 0, perks: [], best: { floor: 0, kills: 0 }, runs: 0 };
}

function save(d) {
    try { localStorage.setItem(KEY, JSON.stringify(d)); } catch (e) {}
}

export const Legacy = {
    get() { return load(); },

    has(perkId) { return load().perks.includes(perkId); },

    // Legacy points earned by a finished run
    pointsFor(stats) {
        return Math.round((stats.deepest || 1) * 10 + (stats.kills || 0) * 0.5 + (stats.bossesSlain || 0) * 50 + (stats.gold || 0) / 20 + (stats.victory ? 200 : 0));
    },

    // Record a finished run; returns { earned, total }
    recordRun(stats) {
        const d = load();
        const earned = this.pointsFor(stats);
        d.points += earned;
        d.runs += 1;
        d.best.floor = Math.max(d.best.floor, stats.deepest || 1);
        d.best.kills = Math.max(d.best.kills, stats.kills || 0);
        save(d);
        return { earned, total: d.points };
    },

    buy(perkId) {
        const perk = LEGACY_PERKS[perkId];
        const d = load();
        if (!perk || d.perks.includes(perkId) || d.points < perk.cost) return false;
        d.points -= perk.cost;
        d.perks.push(perkId);
        save(d);
        return true;
    }
};

// ---- Daily run: one shared seed per calendar day with a locally stored best floor ----
const DAILY_KEY = 'pixel_rpg_daily_v1';

export function todayString(date = new Date()) {
    return `${date.getFullYear()}-${String(date.getMonth() + 1).padStart(2, '0')}-${String(date.getDate()).padStart(2, '0')}`;
}

export const Daily = {
    // Same seed for everyone on a given date (PRNGClass is the engine's seeded generator)
    seedFor(dateStr, PRNGClass) {
        const CHARS = 'ABCDEFGHJKLMNPQRSTUVWXYZ23456789';
        const rng = new PRNGClass(`DAILY-${dateStr}`);
        let s = '';
        for (let i = 0; i < 8; i++) {
            if (i === 4) s += '-';
            s += CHARS[rng.nextInt(0, 31)];
        }
        return s;
    },
    bestFloor(dateStr = todayString()) {
        try {
            const d = JSON.parse(localStorage.getItem(DAILY_KEY) || '{}');
            return d.date === dateStr ? d.best || 0 : 0;
        } catch (e) { return 0; }
    },
    record(floor, dateStr = todayString()) {
        try {
            const d = JSON.parse(localStorage.getItem(DAILY_KEY) || '{}');
            const best = d.date === dateStr ? Math.max(d.best || 0, floor) : floor;
            localStorage.setItem(DAILY_KEY, JSON.stringify({ date: dateStr, best }));
        } catch (e) {}
    }
};
