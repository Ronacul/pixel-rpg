// Inline SVG gem icons. The gem colour comes from GEM_TYPES; the tier shows as wear:
//   tier 3 Perfect: clean facets with a bright shine
//   tier 2 Flawed:  a visible crack
//   tier 1 Chipped: a bitten corner plus two cracks

import { GEM_TYPES } from '../data/Gems.js';

let uid = 0;

function shade(hex, f) {
    const n = parseInt(hex.slice(1), 16);
    const t = f < 0 ? 0 : 255, p = Math.abs(f);
    const ch = (v) => Math.round((t - v) * p + v);
    return `rgb(${ch((n >> 16) & 255)},${ch((n >> 8) & 255)},${ch(n & 255)})`;
}

export function gemColor(type) {
    return GEM_TYPES[type]?.color || '#b9a8ff';
}

export function gemIconSvg(type, tier = 3, px = 28, opts = {}) {
    const base = gemColor(type);
    const worn = tier <= 1 ? -0.22 : 0; // chipped stones are duller
    const dark = shade(base, -0.5 + worn), mid = shade(base, -0.15 + worn), main = shade(base, worn), light = shade(base, 0.45 + worn), glow = shade(base, 0.85);
    const id = `gc${++uid}`;
    // A known curse shows as a dark ombre rising from the bottom of the stone, with a purple glow at the edge
    const shadow = opts.cursed
        ? `<defs><linearGradient id="${id}s" x1="0" y1="1" x2="0" y2="0"><stop offset="0" stop-color="#14041f" stop-opacity="0.95"/><stop offset="0.55" stop-color="#2a0a40" stop-opacity="0.7"/><stop offset="1" stop-color="#2a0a40" stop-opacity="0.12"/></linearGradient></defs><rect x="0" y="0" width="24" height="24" fill="url(#${id}s)"/><path d="M8 20 Q10 15 8.5 12 M14 21 Q16 16 15 11" stroke="#7a2cc0" stroke-opacity="0.55" stroke-width="0.8" fill="none"/>`
        : '';
    const chipped = tier <= 1;
    // Outline (clip) - chipped gems lose their top-right corner
    const clip = chipped
        ? '7,3 11.5,3 13.4,6.8 17,4.6 20.2,8.2 22,9 12,22 2,9'
        : '7,3 17,3 22,9 12,22 2,9';
    const facets = `
        <polygon points="7,3 17,3 15,9 9,9" fill="${light}"/>
        <polygon points="7,3 9,9 2,9" fill="${main}"/>
        <polygon points="17,3 22,9 15,9" fill="${mid}"/>
        <polygon points="2,9 9,9 12,22" fill="${mid}"/>
        <polygon points="9,9 15,9 12,22" fill="${main}"/>
        <polygon points="15,9 22,9 12,22" fill="${dark}"/>`;
    let wear = '';
    if (tier >= 3) {
        wear = `<polygon points="9,4.4 12.2,4.4 11,7.2 9.4,7.2" fill="${glow}" opacity="0.9"/><polygon points="17.5,4 18.3,6 20.3,6.8 18.3,7.6 17.5,9.6 16.7,7.6 14.7,6.8 16.7,6" fill="#fff" opacity="0.95"/>`;
    } else if (tier === 2) {
        wear = `<polyline points="14.5,3.4 13.2,7 15.2,9.6 13,14" fill="none" stroke="#000" stroke-opacity="0.85" stroke-width="1.5" stroke-linejoin="round"/>
                <polyline points="15.1,3.6 13.9,7.2 15.9,9.7 13.7,14" fill="none" stroke="#fff" stroke-opacity="0.35" stroke-width="0.5"/>`;
    } else {
        wear = `<polyline points="12.8,3.6 13.6,7 11.6,9.8 12.4,15" fill="none" stroke="#000" stroke-opacity="0.9" stroke-width="1.5" stroke-linejoin="round"/>
                <polyline points="5.2,9.2 6.8,12 5.6,14.2" fill="none" stroke="#000" stroke-opacity="0.9" stroke-width="1.4" stroke-linejoin="round"/>
                <polyline points="13.4,3.7 14.2,7.1 12.2,9.9" fill="none" stroke="#fff" stroke-opacity="0.3" stroke-width="0.5"/>`;
    }
    return `<svg class="gem-ico" width="${px}" height="${px}" viewBox="0 0 24 24" aria-label="${GEM_TYPES[type]?.name || 'Gem'} tier ${tier}" style="vertical-align:middle;flex:none">
        <defs><clipPath id="${id}"><polygon points="${clip}"/></clipPath></defs>
        <g clip-path="url(#${id})">${facets}${wear}${shadow}</g>
        <polygon points="${clip}" fill="none" stroke="${opts.cursed ? '#8a3cd8' : dark}" stroke-width="${opts.cursed ? 1.3 : 1}" stroke-linejoin="round"/>
    </svg>`;
}

// A stone whose nature is still hidden (a gem set into unidentified gear)
export function unknownGemSvg(px = 28) {
    return `<svg class="gem-ico" width="${px}" height="${px}" viewBox="0 0 24 24" style="vertical-align:middle;flex:none"><polygon points="7,3 17,3 22,9 12,22 2,9" fill="#3a4056" stroke="#6a7290" stroke-width="1" stroke-linejoin="round"/><polygon points="7,3 17,3 15,9 9,9" fill="#4a526c"/><text x="12" y="16" text-anchor="middle" font-size="11" font-weight="bold" fill="#c8cee6" font-family="monospace">?</text></svg>`;
}

// Small filled/hollow dots for an item's sockets, coloured by the gem set into each.
// Hidden gems are grey, known-cursed gems are dark with a purple glow.
export function socketPipsHtml(item, size = 8) {
    if (!item || !item.sockets) return '';
    const dots = [];
    for (const g of item.gems || []) {
        let style;
        if (g.known === false) style = `background:#5a6280;`;
        else if (g.cursed && g.curseKnown) style = `background:#1a0626;box-shadow:0 0 4px #9a4cf0;border:1px solid #9a4cf0;box-sizing:border-box;`;
        else { const c = gemColor(g.type); style = `background:${c};box-shadow:0 0 3px ${c};`; }
        dots.push(`<span title="${g.known === false ? 'Unknown gem' : g.name}" style="display:inline-block;width:${size}px;height:${size}px;border-radius:50%;${style}margin:0 1px;"></span>`);
    }
    const free = item.sockets - (item.gems ? item.gems.length : 0);
    for (let i = 0; i < free; i++) dots.push(`<span title="Empty socket" style="display:inline-block;width:${size}px;height:${size}px;border-radius:50%;border:1px solid #6a7290;margin:0 1px;box-sizing:border-box;"></span>`);
    return `<span class="sock-pips" style="display:inline-flex;align-items:center;line-height:1;">${dots.join('')}</span>`;
}

// Icon markup for any item: drawn gem for gems, the normal glyph otherwise. Unidentified gear gets a "?" mark.
export function itemIconHtml(item, px = 30) {
    if (!item) return '';
    if (item.isGem) return gemIconSvg(item.gemType, item.tier, px, { cursed: item.cursed && item.curseKnown });
    return item.icon;
}
