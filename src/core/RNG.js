// Deterministic 32-bit PRNG (Mulberry32) & FNV-1a String Hasher

export class PRNG {
    constructor(seedString = 'A1B2-C3D4') {
        this.setSeed(seedString);
    }

    setSeed(seedString) {
        this.seedString = seedString.toUpperCase().trim();
        this.state = this.hashString(this.seedString);
        this.callCount = 0;
    }

    hashString(str) {
        let h = 2166136261 >>> 0;
        for (let i = 0; i < str.length; i++) {
            h = Math.imul(h ^ str.charCodeAt(i), 16777619);
        }
        return h >>> 0;
    }

    // Returns float in [0, 1)
    next() {
        this.callCount++;
        let t = this.state += 0x6D2B79F5;
        t = Math.imul(t ^ t >>> 15, t | 1);
        t ^= t + Math.imul(t ^ t >>> 7, t | 61);
        return ((t ^ t >>> 14) >>> 0) / 4294967296;
    }

    // Returns integer in [min, max] inclusive
    nextInt(min, max) {
        return Math.floor(this.next() * (max - min + 1)) + min;
    }

    choice(arr) {
        return arr[Math.floor(this.next() * arr.length)];
    }

    chance(pct) {
        return this.next() < pct;
    }

    static generateRandomSeed() {
        const CHARS = 'ABCDEFGHJKLMNPQRSTUVWXYZ23456789';
        let s = '';
        for (let i = 0; i < 8; i++) {
            if (i === 4) s += '-';
            s += CHARS[Math.floor(Math.random() * CHARS.length)];
        }
        return s;
    }
}

