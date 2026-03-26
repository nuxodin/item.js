/*
// Usage:
const datapoint = new AsyncDataPoint({
    get: () => fetch('https://example.com/todos/1').then(res => res.json()),
    set: value => fetch('https://example.com/todos/1', {method: 'PUT', body: JSON.stringify(value)}).then(res => res.json())
});
datapoint.set({title: 'foo', completed: true}); // Returns promise - or undefined if value is already the same - do not rely on return value
datapoint.get().then(value => console.log(value));

// API
datapoint.onchange = ({value}) => console.log('value changed', value);
datapoint.ttl = 1000; // cache for 1 second
datapoint.optimistic = true; // trust sending value: until the sending is done, the value is the new value, despite the uncertainty that the server will fail
datapoint.debounceMs = 5; // debounce period for setter in ms, default 5
datapoint.setLocal({title: 'foo', completed: true}); // set value without saving it to the master (the value comes from the master through an other channel / trusted source)
*/

export class AsyncDataPoint {

    createGetter;
    createSetter;
    #expectedValue = null; // value while saving
    #setter = null; // current setter promise
    #getter = null; // current/cached getter promise
    #cacheGetterTimeout = undefined;
    onpending = null;
    onchange = null;
    
    constructor({get, set, ...options}) {
        this.options = {
            optimistic: true,
            ttl: 5000,
            debounceMs: 5,
            getRetry: 1,
            getRetryDelay: 500,
            setRetry: 0,
            setRetryDelay: 500,
            ...options
        };
        this.createGetter = get;
        this.createSetter = set;
    }

    #createGetter() {
        const {getRetry, getRetryDelay} = this.options;
        const controller = new AbortController();
        const promise = retryAsync(
            () => this.createGetter(controller.signal),
            getRetry, 
            getRetryDelay
        );
        promise.controller = controller;
        makePromiseTransparent(promise);
        return promise;
    }

    #createSetter(value) {
        const {setRetry, setRetryDelay, debounceMs} = this.options;        
        const promise = abortablePromise((resolve, reject) => {
            retryAsync(
                () => this.createSetter(value, promise.controller.signal),
                setRetry,
                setRetryDelay
            ).then(resolve, reject);
        }, debounceMs);
        
        makePromiseTransparent(promise);
        return promise;
    }

    #cacheGetter(promise){
        // trigger onchange if the value changes
        // note: triggers also if the getter is no more cached as we dont know if the value has changed

        if (promise.state === 'pending') this.onpending?.();

        const oldValue = this.#getter?.value;
        promise.then(
            value => {
                if (this.#getter !== promise) return;
                if (!isEqual(oldValue, value)) {
                    try {
                        this.onchange?.({value, oldValue});
                    } catch (err) {
                        console.error('AsyncDataPoint onchange error:', err);
                    }
                }
            },
            error => {
                if (this.#getter !== promise) return;
                if (error?.name === 'AbortError') return;
                this.onchange?.({error, oldValue});
            }
        );

        this.#getter = promise;
        const duration = this.options.ttl;
        clearTimeout(this.#cacheGetterTimeout);
        if (!(duration > 0)) return;
        this.#cacheGetterTimeout = setTimeout(() => {
            if (this.#getter === promise) this.#getter = null;
        }, duration);
    }

    setLocal(value) { this.#cacheGetter(transparentPromiseResolve(value)); }
    setFromPromise(promise) { this.#cacheGetter(makePromiseTransparent(promise)); }
    get isPending() { return this.#getter?.state === 'pending' || this.#setter?.state === 'pending'; }
    get lastError() { return this.#getter?.reason ?? this.#setter?.reason ?? undefined; }
    get recentValue() { return this.#getter?.value; }

    get() {
        if (this.#setter?.state === 'pending') {
            if (this.options.optimistic) {
                return Promise.resolve(this.#expectedValue); // trust sending value
            } else {
                return this.#setter.then(() => this.get()); // wait for setter to be done
            }
        }
        if (!this.#getter) this.#cacheGetter(this.#createGetter());
        return this.#getter;
    }

    set(value) {
        // Already setting this value
        if (this.#setter?.state === 'pending' && isEqual(this.#expectedValue, value)) return this.#setter;

        this.#setter?.controller.abort(); // abort previous setter

        // ignore if latest getter value is the same
        // Value already set (no-op). Returns undefined to avoid falsy issues (value could be 0, false, etc.)
        if (this.#getter?.state === 'fulfilled' && isEqual(this.#getter.value, value)) return;
        
        this.#expectedValue = value;
        const promise = this.#createSetter(value);
        
        this.onpending?.();

        promise.then(
            data  => {
                if (this.#setter !== promise) return;
                this.setLocal(value);
                this.#setter = null;
                this.#expectedValue = null;
            },
            error => {
                if (this.#setter !== promise) return;
                if (error?.name === 'AbortError') return;
                this.#getter = null;
                this.#setter = null;
                this.#expectedValue = null;
                this.onchange?.({ error }); }
        );

        return this.#setter = promise;
    }

    dispose() {
        clearTimeout(this.#cacheGetterTimeout);
        this.#setter?.controller.abort();
        this.#getter?.controller?.abort();
        this.#setter = null;
        this.#getter = null;
        this.#expectedValue = null;
        this.#cacheGetterTimeout = undefined;
        this.onchange = null;
    }
    getDebugState() {
        return {
            getter: this.#getter,
            setter: this.#setter,
            expectedValue: this.#expectedValue
        };
    }

}



/**
 * Adds state and value properties to a Promise, making it transparent.
 * @param {Promise<any>|TransparentPromise} promise - The Promise to make transparent.
 * @returns {TransparentPromise} - The transparent Promise.
 * @example
 * const promise = makePromiseTransparent(new Promise(resolve => resolve('foo')));
 * promise.state; // 'pending'
 * promise.value; // undefined
 * promise.then(value => {
 *      console.log(promise.state); // 'fulfilled'
 *      console.log(promise.value); // 'foo'
 * });
 */
function makePromiseTransparent(promise) {
    if (promise.state) console.warn('already transparent');
    promise.state = 'pending'; // or 'unknown' ?
    promise.value = undefined;
    promise.then(
        value => {
            promise.state = 'fulfilled';
            promise.value = value;
        },
        reason => {
            promise.state = 'rejected';
            promise.reason = reason;
        }
    );
    return promise;
}


/**
 * Returns a transparent Promise (see makePromiseTransparent) that is resolved with the specified value.
 * @param {any} value - The value to resolve the Promise with.
 * @returns {TransparentPromise} - A transparent Promise.
 */
function transparentPromiseResolve(value) {
    const promise = makePromiseTransparent(Promise.resolve(value));
    promise.state = 'fulfilled';
    promise.value = value;
    return promise;
}

/**
 * Returns a delayed Promise that can be aborted within the specified time (ms).
 * @param {Promise<any>} fn - A function that returns a Promise.
 * @param {Number} [ms=1] - The time in milliseconds to delay before resolving the Promise.
 * @returns {Promise<any>} - A delayed Promise that can be aborted.
 */
function abortablePromise(fn, ms=1) { // delayed and therfore abortable within ms
    const controller = new AbortController();
    const promise = new Promise((resolve, reject) => {
        setTimeout(() => {
            if (controller.signal.aborted) return reject(new Error('aborted'));
            fn(resolve, reject);
        }, ms);
    });
    promise.controller = controller;
    return promise;
}

/**
 * Retries an async operation with exponential backoff.
 * @param {Function} fn - The async function to retry.
 * @param {Number} retries - Number of retries (0 = no retry, just one attempt).
 * @param {Number} baseDelay - Base delay in milliseconds for exponential backoff.
 * @returns {Promise<any>} - The result of the operation.
 */
async function retryAsync(fn, retries = 2, baseDelay = 1000) {
    let lastError;
    for (let attempt = 0; attempt <= retries; attempt++) {
        try {
            return await fn();
        } catch (error) {
            // @ts-ignore
            if (error?.name === 'AbortError') return;
            lastError = error;
            if (attempt < retries) {
                const delay = baseDelay * Math.pow(2, attempt);
                console.warn(`Attempt ${attempt + 1}/${retries + 1} failed, retrying in ${delay}ms...`, error);
                await new Promise(resolve => setTimeout(resolve, delay));
            }
        }
    }
    throw lastError;
}


/**
 * Compares two values for equality.
 * @param {any} a - The first value to compare.
 * @param {any} b - The second value to compare.
 * @returns {boolean} - True if the values are equal, false otherwise.
 */
function isEqual(a, b) {
    if (a === b) return true;
    if (a == null || b == null || typeof a !== 'object' || typeof b !== 'object') return false;
    if (a.constructor !== b.constructor) return false;

    const keysA = Object.keys(a), keysB = Object.keys(b);
    if (keysA.length !== keysB.length) return false;

    return keysA.every(k => Object.hasOwn(b, k) && isEqual(a[k], b[k]));
}