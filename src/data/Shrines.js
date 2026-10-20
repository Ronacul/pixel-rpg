// Shrine offers: each shrine presents three of these as a boon-for-a-price choice.
// `cost` and `boon` are applied by main.js (applyShrineOffer); `needs` gates unaffordable options.
//   cost kinds:  { gold }, { hp }, { ration }, { status: [id, duration] }, { none: true }
//   boon kinds:  { heal: 'full' }, { gem: true }, { reveal: true }, { status: [id, duration] },
//                { maxHp }, { cooldowns: true }, { gamble: gold }, { xp }

export const SHRINE_OFFERS = [
    { id: 'vigor',    icon: '💖', name: 'Shrine of Vigor',     text: 'Be healed to full.',                           cost: { ration: 1 }, boon: { heal: 'full' } },
    { id: 'fortune',  icon: '💎', name: 'Shrine of Fortune',   text: 'Receive a gem.',                               cost: { hp: 12 },    boon: { gem: true } },
    { id: 'clarity',  icon: '👁️', name: 'Shrine of Clarity',   text: 'The whole floor is revealed.',                 cost: { status: ['CLUMSY', 30] }, boon: { reveal: true } },
    { id: 'ward',     icon: '🛡️', name: 'Shrine of Warding',   text: '+3 AC (Stoneskin) for 60 turns.',              cost: { gold: 15 },  boon: { status: ['STONESKIN', 60] } },
    { id: 'pact',     icon: '🩸', name: 'Blood Pact',          text: '+6 Max HP, permanently.',                      cost: { gold: 30 },  boon: { maxHp: 6 } },
    { id: 'renewal',  icon: '✨', name: 'Shrine of Renewal',   text: 'All powers recharge and you feel invigorated.', cost: { gold: 10 }, boon: { cooldowns: true } },
    { id: 'wager',    icon: '🎲', name: 'Wager at the Altar',  text: '50%: win double your stake. 50%: lose it.',    cost: { gold: 20 },  boon: { gamble: 40 } },
    { id: 'insight',  icon: '📜', name: 'Shrine of Insight',   text: 'Gain a burst of experience.',                  cost: { hp: 8 },     boon: { xp: 60 } },
    { id: 'blessing', icon: '🌟', name: 'Free Blessing',       text: 'A small blessing (Blessed for 30 turns).',     cost: { none: true }, boon: { status: ['BLESSED', 30] } }
];
