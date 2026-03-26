import { Emitter, ItemEvent } from './Emitter.js';
import { evaluate } from '../tools/condition.js';

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
        this.#onChange = ({remove, target}) => {
            if (remove) {
                if (this.#items.has(remove.key)) {
                    this.#items.delete(remove.key);
                    this.dispatchEvent(new ItemEvent('change', { remove }));
                }
                return;
            }
            const child = target.path[this.#source.path.length]
                ? this.#source.item(target.path[this.#source.path.length])
                : target;
            this.#evaluate(child);
        };
        source.addEventListener('changeIn', this.#onChange);
        // source.addEventListener('destroy', () => this.destroy()); todo?
    }

    async read() {
        if (!this.#source.reader) throw new Error('no reader on source');
        await this.#source.reader(this.#filter);
        return this;
    }

    #evaluate(item) {
        const has   = this.#items.has(item.key);
        const match = evaluate(this.#filter, item.get());
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