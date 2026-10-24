// Hero roster: characters saved when a module is cleared (or by hand) so they can carry their gear into the next module.
// Stored in localStorage as plain JSON (see PlayerCharacter.toSave / fromSave).

const KEY = 'pixel_rpg_heroes_v1';
const MAX_HEROES = 12;

function load() {
    try { const v = JSON.parse(localStorage.getItem(KEY)); return Array.isArray(v) ? v : []; } catch (e) { return []; }
}
function store(list) {
    try { localStorage.setItem(KEY, JSON.stringify(list)); return true; } catch (e) { return false; }
}

export const Heroes = {
    list() { return load().sort((a, b) => b.savedAt - a.savedAt); },
    get(id) { return load().find(h => h.id === id) || null; },

    // Saves (or updates) the hero; one slot per hero name+class+race lineage kept via heroId on the character
    save(player, moduleId, note = '') {
        const list = load();
        const save = player.toSave();
        if (!player.heroId) player.heroId = `hero_${Date.now().toString(36)}_${Math.floor(Math.random() * 1e4)}`;
        save.heroId = player.heroId;
        const entry = {
            id: player.heroId, savedAt: Date.now(), moduleId, note,
            level: player.level, classId: player.characterClass.id, raceId: player.race.id,
            label: `${player.race.name} ${player.characterClass.name}`,
            gold: player.gold, data: save
        };
        const i = list.findIndex(h => h.id === entry.id);
        if (i >= 0) list[i] = entry; else list.push(entry);
        list.sort((a, b) => b.savedAt - a.savedAt);
        return store(list.slice(0, MAX_HEROES)) ? entry : null;
    },

    remove(id) { store(load().filter(h => h.id !== id)); }
};
