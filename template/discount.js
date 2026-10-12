// "discount" template: a shop owner creates a discount code and a customer uses it (Nepali)
const { str, num, int, obj, list, base, tag } = require('./schema');

module.exports = {
  // scene ids in order, with the template's design length in seconds
  scenes: { hook: 5.5, problem: 4.5, setup: 11, checkout: 10, results: 4.5, end: 4.5 },
  headlineMax: 26,
  // fields next to "scenes" in scenes.json
  extra: { offer: obj({ code: str, percent: int, validUntil: str }) },
  schema: {
    hook: obj({ ...base, tag, headline: list(str), comment: obj({ user: str, text: str }), stamp: str }),
    problem: obj({ ...base, tag, headline: list(str), carts: list(obj({ text: str, item: str, price: int })), lost: str }),
    setup: obj({ ...base, tag, headline: list(str) }),
    checkout: obj({ ...base, tag, headline: list(str), product: obj({ name: str, qty: int, price: int }) }),
    results: obj({ ...base, tag, headline: list(str), label: str, orders: obj({ from: int, to: int }), bars: list(num), days: list(str) }),
    end: obj({ ...base, tagline: str }),
  },
  story: s => `1. hook (~${s.hook} s): big question headline, a customer's comment card asking about the offer, a green stamp that answers it.
2. problem (~${s.problem} s): customers put items in the cart but don't buy. 1-3 abandoned-cart cards and a "lost sales" line ({total} in "lost" is replaced with the sum of the cart prices).
3. setup (~${s.setup} s): a phone shows the shop owner creating the discount code (turns it on, types the code, picks the percent, saves).
4. checkout (~${s.checkout} s): a customer types the code at checkout and the price drops by the percent.
5. results (~${s.results} s): today's orders counter goes up from "from" to "to", plus 6 bars (the last is today and is the highest).
6. end (~${s.end} s): logo, shop name, tagline and "Code: <code>".
Fit the idea into this story: pick the festival/occasion, product, prices and offer that suit it.`,
  rules: today => `- headline, tag text, comment, stamp, lost, label, tagline and voice are in Nepali (Devanagari). Common shop words in English are fine in tags (e.g. "Checkout मा").
- headline: 2 lines of 2-3 words each, at most 24 characters per line; never split a word or a suffix (like मा) onto the next line. Wrap 1-2 key words in *stars* to highlight them. In the problem headline wrap the bad word in ~tildes~ instead.
- tag.icon: one character such as % ! ✓ ↑
- comment.user: a social-media handle followed by " · 2h". comment.text: one natural customer question, at most 90 characters, with the key phrase in [square brackets].
- stamp: 2-3 words with ✓ at the end.
- carts: 1-3 cards. text like "Ramesh ले कार्ट छोडे" (Nepali first names), item = short English product name.
- offer.code: 4-12 capital letters/digits that end with the percent, e.g. DASHAIN20. offer.percent: 5-50. offer.validUntil like "31 Oct 2026", after today (${today}).
- Prices are realistic whole Nepali rupees. product.qty is 1-3.
- orders.to is bigger than orders.from. bars: 6 numbers between 0.15 and 1, the last exactly 1. days: 5 short English weekday names, then "आज".
- voice: what the narrator says during that scene, in natural spoken Nepali, short enough for the scene (about 2.5 words per second). Write numbers and prices as Nepali words, not digits. Say the code as written in Latin letters.`,
  check(f) {
    const e = [];
    if (!/^[A-Z0-9]{4,12}$/.test(f.offer.code)) e.push('offer.code must be 4-12 capital letters/digits');
    if (!(f.offer.percent >= 5 && f.offer.percent <= 50)) e.push('offer.percent must be 5-50');
    if (f.problem.carts.length < 1 || f.problem.carts.length > 3) e.push('problem.carts must have 1-3 items');
    if (!f.problem.lost.includes('{total}')) e.push('problem.lost must contain {total}');
    if (!/\[.+\]/.test(f.hook.comment.text)) e.push('hook.comment.text needs [square brackets] around the key phrase');
    const p = f.checkout.product;
    if (!(p.price > 0 && p.qty >= 1 && p.qty <= 3)) e.push('checkout.product needs price > 0 and qty 1-3');
    const r = f.results;
    if (!(r.orders.to > r.orders.from && r.orders.from >= 0)) e.push('results.orders.to must be bigger than from');
    if (r.bars.length !== 6 || r.bars.some(b => !(b > 0 && b <= 1))) e.push('results.bars must be 6 numbers between 0 and 1');
    if (r.days.length !== 6) e.push('results.days must have 6 items');
    return e;
  },
};
