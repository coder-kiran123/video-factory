// "loadstar" template: an agent loads game credits from one dashboard and takes payment by link (English)
const { str, num, int, obj, list, base, tag } = require('./schema');

// real game titles / companies that must never appear on screen or in the voice
const REAL_GAMES = ['fire kirin', 'firekirin', 'juwa', 'game vault', 'gamevault', 'milky way', 'orion stars', 'ultra panda',
  'vegas sweeps', 'vegassweeps', 'panda master', 'golden dragon', 'river sweeps', 'riversweeps', 'vblink', 'v-blink', 'noble',
  'blue dragon', 'cash machine', 'mr all in one', 'game room', 'gameroom', 'dragon fury', 'ultra thunder', 'ocean king',
  'lucky stars', 'cash frenzy', 'big winner', 'magic city', 'cash app', 'chime', 'venmo', 'paypal', 'zelle'];
const BANNED_WORDS = ['bet', 'bets', 'betting', 'win', 'wins', 'winning', 'winnings', 'jackpot', 'casino', 'slot', 'slots', 'payout', 'cash out', 'gamble', 'gambling', 'odds', 'get rich'];

module.exports = {
  scenes: { hook: 5, problem: 5, dashboard: 10, paylink: 9, results: 5, end: 5 },
  headlineMax: 18,
  extra: {},
  schema: {
    hook: obj({ ...base, tag, headline: list(str), messages: list(obj({ name: str, text: str })), badge: str }),
    problem: obj({ ...base, tag, headline: list(str), cards: list(obj({ title: str, detail: str, amount: int })), lost: str }),
    dashboard: obj({ ...base, tag, headline: list(str), wallet: num, games: list(str),
      players: list(obj({ name: str, game: str, credits: int })), load: obj({ credits: int, price: num }) }),
    paylink: obj({ ...base, tag, headline: list(str), player: str, game: str, amount: int, credits: int }),
    results: obj({ ...base, tag, headline: list(str), label: str, counter: obj({ from: int, to: int }), bars: list(num), days: list(str) }),
    end: obj({ ...base, tagline: str, cta: str }),
  },
  story: s => `1. hook (~${s.hook} s): big question headline, 3 short chat messages from players asking for their credits, and a red notification badge (e.g. "🔔 14 unread").
2. problem (~${s.problem} s): what goes wrong when an agent works by hand. 1-3 cards (title, detail, dollar amount lost) and a line where {total} is replaced with the sum of the amounts.
3. dashboard (~${s.dashboard} s): a phone shows the agent dashboard: wallet balance, 3 games, 3 players. The agent taps the first player, picks "load.credits", taps Load; the wallet goes down by credits × price and the player's credits go up.
4. paylink (~${s.paylink} s): the agent types a dollar amount, creates a pay link (QR + link), the player pays, and "credits" load automatically.
5. results (~${s.results} s): a counter goes up from "from" to "to", plus 6 bars (the last is today and is the highest).
6. end (~${s.end} s): logo, brand name, tagline, a call-to-action button and the website.
Fit the idea into this story.`,
  rules: () => `- All text and voice in casual American English.
- headline: 2 lines of 1-3 short words each, at most 16 characters per line. Wrap 1-2 key words in *stars* to highlight them. In the problem headline wrap the bad word in ~tildes~ instead.
- tag.icon: one character such as ? ! ★ ⚡ ↑. tag.text: 1-2 words.
- messages: exactly 3, from different first names, texting style, at most 28 characters each.
- badge: an emoji plus "<number> unread" or similar, at most 14 characters.
- cards: 1-3. title at most 16 characters, detail at most 26 characters, amount = whole dollars lost.
- games: exactly 3 invented game names, 1-2 words, at most 11 characters each.
- players: exactly 3 first names; their "game" is one of the games. The first player is the one who gets loaded.
- load.credits: one of 10, 25, 50, 100. load.price: dollars per credit, e.g. 0.25. wallet: a dollar balance bigger than credits × price.
- paylink: player and game from the dashboard lists; amount in whole dollars (5-100); credits = what that amount buys.
- counter.to is bigger than counter.from. bars: 6 numbers between 0.15 and 1, the last exactly 1. days: 5 short weekday names, then "Today".
- tagline at most 40 characters. cta at most 20 characters, e.g. "Become an agent →".
- Words: players GET CREDITS (they are never "paid"); the agent GETS PAID by players.
- voice: what the narrator says during that scene, short enough for the scene (about 2.7 words per second). Say the website as words (e.g. "loadstar dot online").`,
  check(f) {
    const e = [];
    if (f.hook.messages.length !== 3) e.push('hook.messages must have exactly 3 items');
    if (f.problem.cards.length < 1 || f.problem.cards.length > 3) e.push('problem.cards must have 1-3 items');
    if (!f.problem.lost.includes('{total}')) e.push('problem.lost must contain {total}');
    const d = f.dashboard;
    if (d.games.length !== 3) e.push('dashboard.games must have exactly 3 names');
    if (d.players.length !== 3) e.push('dashboard.players must have exactly 3 players');
    if (!(d.load.credits > 0 && d.load.price > 0)) e.push('dashboard.load needs credits > 0 and price > 0');
    if (!(d.wallet > d.load.credits * d.load.price)) e.push('dashboard.wallet must be bigger than load.credits × load.price');
    if (!(f.paylink.amount > 0 && f.paylink.credits > 0)) e.push('paylink.amount and paylink.credits must be > 0');
    const r = f.results;
    if (!(r.counter.to > r.counter.from && r.counter.from >= 0)) e.push('results.counter.to must be bigger than from');
    if (r.bars.length !== 6 || r.bars.some(b => !(b > 0 && b <= 1))) e.push('results.bars must be 6 numbers between 0 and 1');
    if (r.days.length !== 6) e.push('results.days must have 6 items');
    // no real game names and no gambling words anywhere
    const all = JSON.stringify(f).toLowerCase();
    for (const g of REAL_GAMES) if (all.includes(g)) e.push(`do not mention "${g}" (a real game/company name)`);
    for (const w of BANNED_WORDS) if (new RegExp(`\\b${w}\\b`).test(all)) e.push(`do not use the word "${w}"`);
    return e;
  },
};
