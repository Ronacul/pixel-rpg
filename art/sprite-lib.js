// Sprite library: tiny palette-indexed pixel art with role recolouring, plus the measurements used by the asset lab.
//
// A sprite definition (see art/sprites/*.json):
//   { "size": [16, 16],            optional, default 16x16
//     "mirror": true,              rows hold only the LEFT half; the right half is mirrored
//     "outline": true | "0",       add a 1px outline (default colour '0') around the opaque pixels
//     "rows": ["....", ...] }      one string per pixel row
// Row characters:  '.' transparent | 0-9 A-F master palette | a-z recolour roles (resolved by roles.json maps)

export async function loadArt(base = '.') {
    const [palette, roles, manifest] = await Promise.all([
        fetch(`${base}/palette.json`).then(r => r.json()),
        fetch(`${base}/roles.json`).then(r => r.json()),
        fetch(`${base}/manifest.json`).then(r => r.json())
    ]);
    const sprites = {};
    for (const file of manifest.files) {
        const data = await fetch(`${base}/${file}`).then(r => r.json());
        for (const [id, def] of Object.entries(data)) if (!id.startsWith('_')) sprites[id] = { ...def, file };
    }
    return { palette: palette.colors, roles, sprites };
}

// Expand mirror / outline into plain full-size rows
export function expand(def) {
    const [w, h] = def.size || [16, 16];
    let rows = def.rows.map(r => def.mirror ? r + [...r].reverse().join('') : r);
    if (def.outline) {
        const oc = typeof def.outline === 'string' ? def.outline : '0';
        const grid = rows.map(r => [...r]);
        const out = grid.map(r => [...r]);
        for (let y = 0; y < h; y++) {
            for (let x = 0; x < w; x++) {
                if (grid[y][x] !== '.' && grid[y][x] !== undefined) continue;
                const n = [[1, 0], [-1, 0], [0, 1], [0, -1]].some(([dx, dy]) => {
                    const c = grid[y + dy]?.[x + dx];
                    return c !== undefined && c !== '.';
                });
                if (n) out[y][x] = oc;
            }
        }
        rows = out.map(r => r.join(''));
    }
    return { w, h, rows };
}

export function validate(def) {
    const errors = [];
    const [w, h] = def.size || [16, 16];
    const expectW = def.mirror ? w / 2 : w;
    if (!def.rows || def.rows.length !== h) errors.push(`expected ${h} rows, got ${def.rows ? def.rows.length : 0}`);
    (def.rows || []).forEach((r, i) => {
        if (r.length !== expectW) errors.push(`row ${i} has ${r.length} chars, expected ${expectW}`);
        if (/[^.0-9A-Fa-z]/.test(r)) errors.push(`row ${i} has an invalid character`);
    });
    return errors;
}

function hexToRgb(hex) {
    const h = hex.replace('#', '');
    return [parseInt(h.slice(0, 2), 16), parseInt(h.slice(2, 4), 16), parseInt(h.slice(4, 6), 16)];
}

// roleMap: merged { letter: '#rrggbb' }. Returns Uint8ClampedArray RGBA (w*h*4)
export function toRGBA(rows, w, h, palette, roleMap = {}) {
    const data = new Uint8ClampedArray(w * h * 4);
    for (let y = 0; y < h; y++) {
        for (let x = 0; x < w; x++) {
            const ch = rows[y][x];
            if (!ch || ch === '.') continue;
            const hex = palette[ch] || roleMap[ch];
            if (!hex) continue;
            const [r, g, b] = hexToRgb(hex);
            const i = (y * w + x) * 4;
            data[i] = r; data[i + 1] = g; data[i + 2] = b; data[i + 3] = 255;
        }
    }
    return data;
}

export function mergeRoles(art, selection) {
    const map = {};
    for (const [group, name] of Object.entries(selection)) Object.assign(map, art.roles[group]?.[name] || {});
    return map;
}

// Draw one sprite (or a stack of sprites) onto ctx at integer scale, nearest-neighbour
export function drawSprite(ctx, art, def, x, y, scale = 1, selection = {}) {
    const { w, h, rows } = expand(def);
    const rgba = toRGBA(rows, w, h, art.palette, mergeRoles(art, selection));
    const tmp = document.createElement('canvas');
    tmp.width = w; tmp.height = h;
    tmp.getContext('2d').putImageData(new ImageData(rgba, w, h), 0, 0);
    ctx.imageSmoothingEnabled = false;
    ctx.drawImage(tmp, x, y, w * scale, h * scale);
}

// ---------- measurements ----------
export function stats(def) {
    const { w, h, rows } = expand(def);
    let opaque = 0;
    const chars = new Set();
    let minX = w, maxX = -1, minY = h, maxY = -1;
    for (let y = 0; y < h; y++) for (let x = 0; x < w; x++) {
        const c = rows[y][x];
        if (c && c !== '.') {
            opaque++; chars.add(c);
            minX = Math.min(minX, x); maxX = Math.max(maxX, x); minY = Math.min(minY, y); maxY = Math.max(maxY, y);
        }
    }
    return { w, h, opaque, colors: chars.size, fill: opaque / (w * h), bbox: opaque ? [minX, minY, maxX, maxY] : null };
}

// Number of pixels that differ (including transparency) between two sprites of the same size
export function pixelDiff(defA, defB) {
    const a = expand(defA), b = expand(defB);
    if (a.w !== b.w || a.h !== b.h) return a.w * a.h;
    let n = 0;
    for (let y = 0; y < a.h; y++) for (let x = 0; x < a.w; x++) if (a.rows[y][x] !== b.rows[y][x]) n++;
    return n;
}

export function silhouette(def) {
    const { w, h, rows } = expand(def);
    const s = new Uint8Array(w * h);
    for (let y = 0; y < h; y++) for (let x = 0; x < w; x++) s[y * w + x] = rows[y][x] !== '.' ? 1 : 0;
    return s;
}

// Intersection-over-union of two same-size silhouettes (1 = identical shape)
export function silhouetteIoU(defA, defB) {
    const a = silhouette(defA), b = silhouette(defB);
    if (a.length !== b.length) return 0;
    let inter = 0, uni = 0;
    for (let i = 0; i < a.length; i++) { if (a[i] && b[i]) inter++; if (a[i] || b[i]) uni++; }
    return uni ? inter / uni : 0;
}

function luminance([r, g, b]) {
    const f = (c) => { c /= 255; return c <= 0.03928 ? c / 12.92 : Math.pow((c + 0.055) / 1.055, 2.4); };
    return 0.2126 * f(r) + 0.7152 * f(g) + 0.0722 * f(b);
}

export function contrastRatio(hexA, hexB) {
    const la = luminance(hexToRgb(hexA)), lb = luminance(hexToRgb(hexB));
    return (Math.max(la, lb) + 0.05) / (Math.min(la, lb) + 0.05);
}

// Average colour of a sprite's opaque pixels
export function meanColor(def, art, roleMap = {}) {
    const { w, h, rows } = expand(def);
    const rgba = toRGBA(rows, w, h, art.palette, roleMap);
    let r = 0, g = 0, b = 0, n = 0;
    for (let i = 0; i < rgba.length; i += 4) if (rgba[i + 3]) { r += rgba[i]; g += rgba[i + 1]; b += rgba[i + 2]; n++; }
    if (!n) return '#000000';
    const to = (v) => Math.round(v / n).toString(16).padStart(2, '0');
    return `#${to(r)}${to(g)}${to(b)}`;
}

// Idle-animation sanity: pixel change between frame rows (def.rows vs def.rows2)
export function frameDelta(def) {
    if (!def.rows2) return null;
    return pixelDiff(def, { ...def, rows: def.rows2 });
}

// Stack several sprite definitions (later layers draw over earlier ones; '.' is see-through) into one flat sprite,
// then optionally outline the whole result once.
export function compose(defs, outline = '0') {
    const size = defs[0].size || [16, 16];
    const [w, h] = size;
    const rows = Array.from({ length: h }, () => Array(w).fill('.'));
    for (const d of defs) {
        const e = expand({ ...d, outline: false });
        for (let y = 0; y < h; y++) for (let x = 0; x < w; x++) {
            const c = e.rows[y][x];
            if (c !== '.') rows[y][x] = c;
        }
    }
    return { size, rows: rows.map(r => r.join('')), outline };
}

// Share of a sprite's opaque pixels whose colour reaches `minRatio` contrast against a background colour.
// A fairer readability test than the average colour: a dark outline is expected, bright body pixels are what count.
export function readableShare(def, art, roleMap, bgHex, minRatio = 2) {
    const { w, h, rows } = expand(def);
    const rgba = toRGBA(rows, w, h, art.palette, roleMap);
    let total = 0, good = 0;
    for (let i = 0; i < rgba.length; i += 4) {
        if (!rgba[i + 3]) continue;
        total++;
        const hex = '#' + [rgba[i], rgba[i + 1], rgba[i + 2]].map(v => v.toString(16).padStart(2, '0')).join('');
        if (contrastRatio(hex, bgHex) >= minRatio) good++;
    }
    return total ? good / total : 0;
}
