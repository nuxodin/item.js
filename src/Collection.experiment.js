import { Emitter, ItemEvent } from './Emitter.js';

export class Collection extends Emitter {
    #source;
    #filter;
    #items = new Map();
    #onChange;

    constructor(source, filter = {}) {
        super();
        this.#source = source;
        this.#filter = filter;

        for (const item of source.items()) this.#evaluate(item);

        this.#onChange = e => {
            const { remove } = e.detail;
            if (remove) {
                if (this.#items.has(remove.key)) {
                    this.#items.delete(remove.key);
                    this.dispatchEvent(new ItemEvent('change', { remove }));
                }
                return;
            }
            // e.target ist das geänderte item — wir brauchen das direkte Kind von source
            const child = e.target.path[this.#source.path.length] 
                ? this.#source.item(e.target.path[this.#source.path.length]) 
                : e.target;
            this.#evaluate(child);
        };
        source.addEventListener('changeIn', this.#onChange);
    }

    async read() {
        if (!this.#source.reader) throw new Error('no reader on source');
        await this.#source.reader(this.#filter); // direct reader without smart asyncDatapoint handling, todo?
        return this;
    }

    #evaluate(item) {
        const has   = this.#items.has(item.key);
        const match = matchesFilter(item, this.#filter);
        if (match && !has) {
            this.#items.set(item.key, item);
            this.dispatchEvent(new ItemEvent('change', { add: item }));
        } else if (!match && has) {
            this.#items.delete(item.key);
            this.dispatchEvent(new ItemEvent('change', { remove: item }));
        }
    }

    get items() { return [...this.#items.values()]; }
    get keys()  { return [...this.#items.keys()]; }
    [Symbol.iterator]() { return this.#items.values(); }

    destroy() {
        this.#source.removeEventListener('changeIn', this.#onChange);
        this.#items.clear();
    }
}


const operators = {
    'eq':         (a, b) => a === b,
    'ne':         (a, b) => a !== b,
    'gt':         (a, b) => a >   b,
    'gte':        (a, b) => a >=  b,
    'lt':         (a, b) => a <   b,
    'lte':        (a, b) => a <=  b,
    'in':         (a, b) => b.includes(a),
    'nin':        (a, b) => !b.includes(a),
    'exists':     (a, b) => (a !== undefined) === b,
    'includes':   (a, b) => String(a).includes(b),
    'startsWith': (a, b) => String(a).startsWith(b),
    'endsWith':   (a, b) => String(a).endsWith(b),
    'regex':      (a, b) => new RegExp(b).test(String(a)),
};

function resolveValue(val, obj) {
    if (Array.isArray(val) && val[0] === 'ref') return obj[val[1]];
    return val;
}

function matchesCondition(fieldVal, condition, obj) {
    if (!Array.isArray(condition)) return fieldVal === condition; // shorthand: {active: true}
    const [op, expected] = condition;
    return operators[op]?.(fieldVal, resolveValue(expected, obj)) ?? false;
}

function matchesFilter(item, filter) {
    const obj = item.get();
    return Object.entries(filter).every(([key, condition]) => {
        return matchesCondition(obj[key], condition, obj);
    });
}