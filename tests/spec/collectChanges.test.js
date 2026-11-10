import { describe, it, expect } from './bdd.js';
import { item } from '../../item.js';
import { collectChanges, patch } from '../../tools/beta/collectChanges.js';

// changes collected on one tree, patched into a copy: both end up equal
function replicate(start, change) {
    const source = item(start), copy = item(structuredClone(start));
    const collector = collectChanges(source);
    change(source);
    const collected = collector.getAndReset();
    patch(copy, collected);
    return { source: source.peek(), copy: copy.peek(), collected };
}

describe('collectChanges', () => {
    it('replicates values, new branches and removals', () => {
        const { source, copy } = replicate({ a: 1, b: { c: 2 }, d: 3 }, r => {
            r.item('a').value = 9;
            r.sub('x', 'y').value = 1;
            r.item('d').remove();
        });
        expect(copy).to.deep.equal(source);
    });
    it('keeps a value that became an empty object', () => {
        const { source, copy, collected } = replicate({ tags: 'x' }, r => r.item('tags').value = {});
        expect(collected.changes).to.deep.equal({ tags: {} });
        expect(copy).to.deep.equal(source);
    });
    it('replicates object → primitive', () => {
        const { source, copy } = replicate({ n: { old: 1 } }, r => r.item('n').value = 5);
        expect(copy).to.deep.equal(source);
    });
    it('removals alone leave the rest of the copy alone', () => {
        const { source, copy, collected } = replicate({ a: 1, b: 2 }, r => r.item('a').remove());
        expect(collected.changes).to.equal(undefined);
        expect(collected.deletions).to.deep.equal({ a: true });
        expect(copy).to.deep.equal(source);
    });
    it('a root that becomes an empty object', () => {
        const { source, copy } = replicate(1, r => r.value = {});
        expect(copy).to.deep.equal(source);
    });
});
