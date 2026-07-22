// Minimal describe/it/expect that runs the same spec files in two runtimes:
//   browser → mocha's globals (loaded by the tests/mocha.*.html shells)
//   deno    → Deno.test, one test per `it`, named "describe › it"
// expect() is our own tiny chai-compatible subset — no chai dependency anywhere.

export let describe, it;

if (typeof Deno !== 'undefined' && Deno.test) {
    const stack = [];
    describe = (name, fn) => { stack.push(name); try { fn(); } finally { stack.pop(); } };
    it = (name, fn) => Deno.test({
        name: [...stack, name].join(' › '),
        // fn.length > 0 → mocha's done-callback style
        fn: fn.length
            ? () => new Promise((resolve, reject) => { try { fn((err) => err ? reject(err) : resolve()); } catch (e) { reject(e); } })
            : () => fn(),
        // io debounce timers (5ms) outlive fast assertions; sanitizers would flag them
        sanitizeOps: false, sanitizeResources: false,
    });
    it.skip = (name, _fn) => Deno.test({ name: [...stack, name].join(' › '), ignore: true, fn: () => {} });
} else if (globalThis.describe) {
    describe = globalThis.describe;
    it = globalThis.it;
} else {
    throw new Error('[bdd.js] no test runner found (mocha globals or Deno)');
}

/* ── expect: the chai subset these specs actually use ─────────────────────── */

const show = (v) => { try { return JSON.stringify(v) ?? String(v); } catch { return String(v); } };
const sorted = (v) => v && typeof v === 'object' && !Array.isArray(v)
    ? Object.fromEntries(Object.keys(v).sort().map((k) => [k, sorted(v[k])]))
    : Array.isArray(v) ? v.map(sorted) : v;
const deepEq = (a, b) => JSON.stringify(sorted(a)) === JSON.stringify(sorted(b));

class Expectation {
    #actual; #negate; #deep;
    constructor(actual, negate = false, deep = false) { this.#actual = actual; this.#negate = negate; this.#deep = deep; }
    #check(ok, msg) {
        if (ok === this.#negate) throw new Error(`expected ${show(this.#actual)} ${this.#negate ? 'not ' : ''}${msg}`);
        return this;
    }
    // chainers
    get to()   { return this; }
    get be()   { return this; }
    get have() { return this; }
    get not()  { return new Expectation(this.#actual, !this.#negate, this.#deep); }
    get deep() { return new Expectation(this.#actual, this.#negate, true); }
    // asserts
    equal(exp) { return this.#check(this.#deep ? deepEq(this.#actual, exp) : Object.is(this.#actual, exp), `to equal ${show(exp)}`); }
    eql(exp)   { return this.#check(deepEq(this.#actual, exp), `to deep-equal ${show(exp)}`); }
    a(type)    {
        const t = type.toLowerCase();
        return this.#check(
            t === 'promise' ? this.#actual instanceof Promise
            : t === 'array' ? Array.isArray(this.#actual)
            // deno-lint-ignore valid-typeof -- chai-style dynamic type matcher
            : typeof this.#actual === t, `to be a ${type}`);
    }
    an(type)   { return this.a(type); }
    include(v) { return this.#check(
        typeof this.#actual === 'string' ? this.#actual.includes(v)
        : Array.isArray(this.#actual) ? this.#actual.some((x) => this.#deep ? deepEq(x, v) : Object.is(x, v))
        : Object.entries(v ?? {}).every(([k, val]) => deepEq(this.#actual?.[k], val)), `to include ${show(v)}`); }
    contain(v) { return this.include(v); }
    match(re)  { return this.#check(re.test(this.#actual), `to match ${re}`); }
    length(n)  { return this.#check(this.#actual?.length === n, `to have length ${n}`); }
    greaterThan(n) { return this.#check(this.#actual > n, `to be greater than ${n}`); }
    throw(matcher) {
        let msg = null;
        try { this.#actual(); } catch (e) { msg = e?.message ?? String(e); }
        if (matcher === undefined) return this.#check(msg !== null, 'to throw');
        return this.#check(msg !== null && (matcher instanceof RegExp ? matcher.test(msg) : msg.includes(matcher)),
            `to throw ${matcher} (got: ${show(msg)})`);
    }
    // assert-getters
    get true()      { return this.#check(this.#actual === true, 'to be true'); }
    get false()     { return this.#check(this.#actual === false, 'to be false'); }
    get undefined() { return this.#check(this.#actual === undefined, 'to be undefined'); }
    get null()      { return this.#check(this.#actual === null, 'to be null'); }
    get ok()        { return this.#check(!!this.#actual, 'to be ok (truthy)'); }
    get NaN()       { return this.#check(Number.isNaN(this.#actual), 'to be NaN'); }
}

export const expect = (actual) => new Expectation(actual);
