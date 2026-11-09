// Core micro-benchmark, runs in any runtime: deno run tests/bench/core.js | node tests/bench/core.js
import { item } from '../../item.js';

function bench(name, fn, runs) {
    fn(0); // warm up
    const start = performance.now();
    for (let i = 0; i < runs; i++) fn(i);
    const ns = (performance.now() - start) * 1e6 / runs;
    console.log(name.padEnd(40), ns.toFixed(0).padStart(9), 'ns/op');
}

const rows = {};
for (let i = 0; i < 1000; i++) rows[i] = { id: i, name: 'n' + i, tags: { a: 1, b: 2 } };

const root = item({ a: { b: { c: { d: { e: 1 } } } } });
const leaf = root.sub('a', 'b', 'c', 'd', 'e');
const tree = item(rows);

bench('read leaf (depth 5)', () => leaf.value, 2e6);
bench('peek leaf (depth 5)', () => leaf.peek(), 2e6);
bench('write leaf (depth 5)', i => leaf.value = i, 2e6);
bench('create tree (6000 nodes)', () => item(rows), 50);
bench('get() tree (6000 nodes)', () => tree.get(), 50);

root.addEventListener('getIn', () => {});
tree.addEventListener('getIn', () => {});
bench('read leaf, getIn listener on root', () => leaf.value, 2e6);
bench('get() tree, getIn listener on root', () => tree.get(), 50);

root.addEventListener('changeIn', () => {});
bench('write leaf, changeIn listener on root', i => leaf.value = i, 2e6);
