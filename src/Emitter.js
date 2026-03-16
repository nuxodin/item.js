
export class Emitter {
    #listeners = null;

    addEventListener(type, fn, opts) {
        (this.#listeners ??= new Map()).has(type)
            ? this.#listeners.get(type).add(fn)
            : this.#listeners.set(type, new Set([fn]));
        if (opts?.signal) opts.signal.addEventListener('abort', () => this.removeEventListener(type, fn), { once: true });
    }

    removeEventListener(type, fn) {
        this.#listeners?.get(type)?.delete(fn);
    }

    /** @returns {{ defaultPrevented: boolean }} */
    dispatchEvent(e) {
        e.target ??= this;
        const fns = this.#listeners?.get(e.type);
        if (fns) {
            e.currentTarget = this;
            for (const fn of fns) fn(e);
        }
        return !e.defaultPrevented;
    }

    removeAllListeners() {
        this.#listeners?.clear();
    }
}

// Leichtes Event-Objekt – kein CustomEvent-Overhead
export class ItemEvent {
    defaultPrevented = false;
    type = null;
    detail = null;
    constructor(type, detail) {
        this.type = type;
        this.detail = detail;
        /*
        Object.defineProperty(this.detail, "item", {
            get() {
                console.error("detail.item is deprecated use event.target instead");
                return detail._item;
            },
            set(v) {
                detail._item = v;
            }
        });
        */
    }
    preventDefault() { this.defaultPrevented = true; }
}


/**
 * Creates a async iterator from an event target.
 * @param {EventTarget} eventTarget - The event target.
 * @param {string} eventName - The name of the event.
 * @param {Object} [options] - The event listener options.
 * @return {Generator} A generator that yields events.
 * @example
 * const abortCtrl = new AbortController();
 * for await (const event of asyncIteratorFromEventTarget(document, 'click', {signal: abortCtrl.signal})) {
 *    console.log(event);
 * }
 * setTimeout(() => abortCtrl.abort(), 1000);
 */
export async function* asyncIteratorFromEventTarget(eventTarget, eventName, options) {
    const queue = [];
    let stopAfterQueue = false;
    let resolve;
    const eventHandler = event => {
        queue.push(event);
        if (resolve) {
            resolve();
            resolve = null;
        }
    };
    eventTarget.addEventListener(eventName, eventHandler, options);
    options?.signal?.addEventListener('abort', () => {
        stopAfterQueue = true;
        if (resolve) {
            resolve();
            resolve = null;
        }
    });
    try {
        while (true) {
            if (queue.length) {
                yield queue.shift();
            } else if (stopAfterQueue) {
                return;
            } else {
                await new Promise(res => resolve = res); // Promise.withResolvers()?
            }
        }
    } finally {
        eventTarget.removeEventListener(eventName, eventHandler, options);
    }
}
