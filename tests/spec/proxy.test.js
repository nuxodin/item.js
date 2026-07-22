import { describe, it, expect } from './bdd.js';
import { item, $item } from '../../item.js';

describe('proxy', () => {

    describe('get trap', () => {

        it('proxy[$item] (symbol) returns the underlying raw item', () => {
            let raw = item();
            expect(raw.proxy[$item]).to.equal(raw);
        });

        it('Symbol.iterator returns a generator yielding child proxies', () => {
            const p = item({ a: 1 }).proxy;
            const collected = [];
            for (const child of p) {
                collected.push(child);
            }
            expect(collected).to.have.length(1);
            expect(collected[0]).to.equal(p.a);
        });

        it('accessing symbol-keyed methods binds them correctly to the target', () => {
            const raw = item();
            raw[Symbol.toPrimitive] = (hint) => hint === 'string' ? 'hello-proxy' : 99;
            const proxy = raw.proxy;
            expect(proxy[Symbol.toPrimitive]('string')).to.equal('hello-proxy');
            expect(+proxy).to.equal(99);
        });

        it('other symbols are forwarded via Reflect.get', () => {
            const customSym = Symbol('custom');
            const raw = item();
            raw[customSym] = 'secret-value';
            const proxy = raw.proxy;
            expect(proxy[customSym]).to.equal('secret-value');
        });

        it('accessing child property returns a proxy of the child', () => {
            const raw = item({ username: 'alice' });
            const proxy = raw.proxy;
            expect(proxy.username[$item]).to.equal(raw.item('username'));
        });

        it('every .propertyName exept "then" is possible (strings)', () => {
            const raw = item();
            const proxy = raw.proxy;
            expect(proxy.toString[$item]).to.equal(raw.item('toString'));
            expect(proxy.toJSON[$item]).to.equal(raw.item('toJSON')); // works but, it will throw a warning
            expect(proxy.valueOf[$item]).to.equal(raw.item('valueOf'));
            expect(proxy.then).to.be.a('function');
        });

    });

    describe('set trap', () => {
        it('proxy.prop = value calls .set(value) on the child item', () => {
            const raw = item({ a: 1 });
            const proxy = raw.proxy;
            proxy.a = 42;
            expect(raw.item('a').get()).to.equal(42);
        });

        it('setting a new property creates and sets the child item', () => {
            const raw = item();
            const proxy = raw.proxy;
            proxy.username = 'bob';
            expect(raw.item('username').get()).to.equal('bob');
        });

        it('set trap returns true (strict mode compatibility)', () => {
            const raw = item();
            const proxy = raw.proxy;
            const result = Reflect.set(proxy, 'x', 99);
            expect(result).to.equal(true);
        });

        it('setting via proxy is reflected when reading back via proxy', () => {
            const raw = item();
            const proxy = raw.proxy;
            proxy.name = 'alice';
            expect(proxy.name()).to.equal('alice');
        });
    });


    describe('apply trap – proxy als Funktion aufrufen', () => {

        it('proxy() no args → targetItem.get()', () => {
            const proxy = item(55).proxy;
            expect(proxy()).to.equal(55);
        });

        it('async proxy() no args → undefined / value', async () => {
            const raw = item();
            const proxy = raw.proxy;
            expect(proxy()).to.equal(undefined);
            raw.promise = Promise.resolve(55);
            expect(proxy()).to.equal(undefined);
            await new Promise(resolve => setTimeout(resolve, 50));
            expect(proxy()).to.equal(55);
        });

        it('proxy(42) sets value', () => {
            const raw = item();
            raw.proxy(42);
            expect(raw.value).to.equal(42);
        });

        it('proxy(42) returns undefined – no writer, so there is no io-write to await', () => {
            const raw = item();
            const proxy = raw.proxy;
            const returnVal = proxy(42);
            expect(returnVal).to.equal(undefined);
        });

        it('proxy(42) returns the io-promise when the item has a writer', async () => {
            const raw = item();
            const written = [];
            raw.writer = (v) => { written.push(v); return Promise.resolve(); };
            const returnVal = raw.proxy(42);
            expect(returnVal).to.be.a('promise');
            await returnVal;
            expect(written).to.deep.equal([42]);
        });

        it('proxy(42) returns undefined when a listener prevents the write', () => {
            const raw = item();
            raw.addEventListener('set', (e) => e.preventDefault());
            expect(raw.proxy(42)).to.equal(undefined);
            expect(raw.value).to.equal(undefined); // nothing was written
        });

        // io regions: the child resolves to its ioOwner — a writer-only parent region
        // writes the whole region, and the child set returns that io-promise.
        it('proxy.child(7) writes through to a writer-only parent region', async () => {
            const raw = item();
            const written = [];
            raw.writer = (v) => { written.push(v); return Promise.resolve(); };
            raw.set({ child: 1 }, { local: true });
            const ret = raw.proxy.child(7);
            expect(ret).to.be.a('promise');
            await ret;
            expect(written.at(-1)).to.deep.equal({ child: 7 });
        });

        it('proxy(1,2) too many args', () => {
            const proxy = item().proxy;
            expect(() => proxy(1, 2)).to.throw('apply called with too many arguments');
        });

    });

    /* thenable */
    describe('thenable', () => {
        it('proxy.then()', async () => {
            const raw = item(44);
            const proxy = raw.proxy;
            expect(proxy.then).to.be.a('function');
            expect(await proxy).to.equal(44);
            raw.promise = Promise.resolve(55);
            expect(proxy()).to.equal(44);
            expect(await proxy).to.equal(55);
        });
    });



    describe('has trap – "key" in proxy', () => {

        it('existing key → true', () => {
            const raw = item({ title: 'test', count: 7 });
            const proxy = raw.proxy;
            expect('title' in proxy).to.be.true;
            expect('count' in proxy).to.be.true;
        });

        it('non existing key → false', () => {
            const raw = item({ a: 1 });
            const proxy = raw.proxy;
            expect('b' in proxy).to.be.false;
            expect('toString' in proxy).to.be.false;
        });

        it('Symbol keys are not handled by has (only strings)', () => {
            const sym = Symbol('xyz');
            const raw = item();
            raw[sym] = 999;
            const proxy = raw.proxy;
            expect(sym in proxy).to.be.false;
        });

    });


    describe('ownKeys trap – Object.keys(proxy), Reflect.ownKeys, for..in', () => {

        it('Object.keys zeigt nur die eigenen string-keys', () => {
            const raw = item({
                name: 'Lisa',
                age: 28,
                active: true
            });
            const proxy = raw.proxy;
            expect(Object.keys(proxy)).to.deep.equal(['name', 'age', 'active']);
        });

        it('leeres item → leeres Array', () => {
            const proxy = item().proxy;
            expect(Object.keys(proxy)).to.deep.equal([]);
        });

        it('item("abc") → leeres Array', () => {
            const proxy = item('abc').proxy;
            expect(Object.keys(proxy)).to.deep.equal([]);
        });

    });


    describe('getOwnPropertyDescriptor trap', () => {

        it('jede Property sieht aus wie {configurable: true, enumerable: true}', () => {
            const proxy = item({ x: 10, y: 20 }).proxy;

            const desc1 = Object.getOwnPropertyDescriptor(proxy, 'x');
            expect(desc1).to.include({
                configurable: true,
                enumerable: true
            });

            const desc2 = Object.getOwnPropertyDescriptor(proxy, 'missing');
            expect(desc2).to.equal(undefined);
        });

    });


    describe('deleteProperty trap – delete proxy.key', () => {

        it('delete proxy.xxx deletes the child item', () => {
            const raw = item({ temp: 123, other: 999 });
            const proxy = raw.proxy;
            delete proxy.temp;
            expect(raw.keys).to.deep.equal(['other']);
        });

        it('delete gibt immer true zurück', () => {
            const proxy = item().proxy;
            expect(delete proxy.whatever).to.be.true;
            expect(delete proxy[Symbol.for('test')]).to.be.true;
        });

    });


    describe('misc', () => {

        it('set and get deep item', () => {
            let i = item({ a: 1, b: { b1: 2 } }).proxy;
            i.b.b1 = 3;
            expect(i.b.b1()).to.equal(3);
        });
        it('Object.keys', () => {
            let i = item({ a: 1, b: { b1: 2 } }).proxy;
            expect(Object.keys(i)).to.deep.equal(['a', 'b']);
        });
        it('Object.getOwnPropertyNames', () => {
            let i = item({ a: 1, b: { b1: 2 } }).proxy;
            expect(Object.getOwnPropertyNames(i)).to.deep.equal(['a', 'b']);
        });
        it('JSON.stringify', () => {
            let i = item({ a: 1 }).proxy;
            expect(JSON.stringify(i())).to.equal('{"a":1}');
            i = item({ a: 1 }).proxy;
            expect(JSON.stringify(i(), null, 2)).to.equal('{\n  "a": 1\n}');
        });
        it('delete property', () => {
            let i = item({ a: 1, b: 2 }).proxy;
            delete i.a;
            expect('a' in i).to.equal(false);
        });
        it('reuse proxies', () => {
            let i = item({ a: { c: 3 } }).proxy;
            expect(i.a).to.equal(i.a);
        });
        it('convert number to string', () => {
            let i = item(9).proxy;
            expect(`${i}`).to.equal('9');
        });
        it('convert string to string', () => {
            let i = item("test").proxy;
            expect(`${i}`).to.equal('test');
        });
        it('convert root object to string (should be "")', () => {
            let i = item({ x: 1, y: 2 }).proxy;
            expect(`${i}`).to.equal("");
        });
        it('convert subobject to string (should be the key)', () => {
            let i = item({ a: { x: 1, y: 2 } }).proxy;
            expect(`${i.a}`).to.equal("a");
        });
        it('convert bool to string', () => {
            let i = item(true).proxy;
            expect(`${i}`).to.equal('true');
        });
        it('convert null/undefined to string', () => {
            let i = item(null).proxy;
            expect(`${i}`).to.equal('');
            expect('' + i).to.equal('null');
            let i2 = item(undefined).proxy;
            expect(`${i2}`).to.equal('');
            expect('' + i2).to.equal('undefined');
            let i3 = item().proxy; // not filled
            expect(`${i3}`).to.equal('');
            expect('' + i3).to.equal('undefined');
        });
        it('convert to number', () => {
            expect(item(9).proxy + 0).to.equal(9);
            expect(+item("9").proxy).to.equal(9);
            expect(+item({ a: 1 }).proxy).to.equal(0);
            expect(+item({ '9': { x: 1 } }).proxy['9']).to.equal(9);
            expect(+item({ 'not number': {} }).proxy['not number']).to.be.NaN;
            expect(+item(true).proxy).to.equal(1);
            expect(+item(false).proxy).to.equal(0);
            expect(+item(null).proxy).to.equal(0);
        });

        it('iterator', () => {
            let i = item({ a: 1, b: 2 }).proxy;
            const result = [];
            for (let item of i) {
                result.push(item + 0);
            }
            expect(result).to.deep.equal([1, 2]);
        });
        // it('iterator todo?', () => {
        //     let i = item({a: 1, b: 2}).proxy;
        //     const result = [];
        //     for (let item of i) {
        //         result.push(item);
        //     }
        //     expect(result).to.deep.equal([1, 2]);
        // });
        it('async iterator', async () => {
            const i = item({ a: 1, b: 2 });
            i.reader = async function () {
                await new Promise(resolve => setTimeout(resolve, 50))
                this.item('a').set(2); // does not trigger "add" as it is already there
                await new Promise(resolve => setTimeout(resolve, 50))
                this.item('c').set(3);
                this.item('d').set(4);
                setTimeout(() => this.item('e').set(4)) // not included as it is added after "reader" is finished
            };
            const p = i.proxy;
            const result = [];
            for await (let item of p) {
                result.push(item.key);
            }
            expect(result).to.deep.equal(['a', 'b', 'c', 'd']);
        });

        it('access internal item via symbol', () => {
            const i = item({ a: 1 });
            const p = i.proxy;
            expect(p[$item]).to.equal(i);
            expect(p.a()).to.equal(1);
        });

        it('no collision between symbol and string keys', () => {
            const i = item({ "$item": "fake" }).proxy;
            expect(i["$item"]()).to.equal("fake");
            expect(i[$item].constructor.name).to.equal("Item");
        });

        it('root reset via $item symbol', () => {
            const i = item({ a: 1, b: 2 });
            const p = i.proxy;
            p[$item].value = { c: 3 };
            expect(Object.keys(p)).to.deep.equal(['c']);
            const valueA = p.a();
            expect(valueA).to.be.undefined;
            expect(Object.keys(p)).to.include('a');
        });

    });
});

