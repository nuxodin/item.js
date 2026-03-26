
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


export class ItemEvent {
    type;
    target;
    currentTarget;
    defaultPrevented = false;

    constructor(type, options) {
        this.type = type;
        Object.assign(this, options);
    }
    preventDefault() { this.defaultPrevented = true; }
    toJSON() {
        return {
            path: this.target.path,
            add: this.add?.key,
            remove: this.remove?.key,
            pending: this.pending,
            error: this.error?.message,
            value: this.value,
        }
    }
}


/**
 * Creates a async iterator from an event target.
 * @param {EventTarget|Emitter} eventTarget - The event target.
 * @param {string} eventName - The name of the event.
 * @param {Object} [options] - The event listener options.
 * @return {AsyncGenerator} A generator that yields events.
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
                await new Promise(res => resolve = res);
            }
        }
    } finally {
        eventTarget.removeEventListener(eventName, eventHandler, options);
    }
}
