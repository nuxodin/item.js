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
datapoint.setDebouncePeriod = 5; // debounce period for setter in ms, default 5
datapoint.setLocal({title: 'foo', completed: true}); // set value without saving it to the server (the value comes from the master through an other channel / trusted source)
*/

export class AsyncDataPoint {

    createGetter = null; // function that returns a promise
    createSetter = null; // function that returns a promise, if it failed, the promise must be rejected

    #expectedValue = null; // value while saving
    #setter = null; // current setter promise
    #getter = null; // current/cached getter promise
    #cacheGetterTimeout = null;

    constructor({get, set, ...options}) {
        this.options = {
            optimistic: true,
            ttl: 2000,
            setDebouncePeriod: 5,
            getRetry: 2,
            getRetryDelay: 1000,
            setRetry: 1,
            setRetryDelay: 1000,
            ...options
        };
        this.createGetter = get;
        this.createSetter = set;
    }

    #createGetter() {
        const {getRetry, getRetryDelay} = this.options;
        const promise = retryAsync(
            () => this.createGetter(), 
            getRetry, 
            getRetryDelay
        );
        makePromiseTransparent(promise);
        return promise;
    }

    // #createSetter(value) {
    //     const promise = abortablePromise((resolve, reject) => {
    //         return this.createSetter(value, promise.controller.signal).then(resolve, reject);
    //     }, this.options.setDebouncePeriod);
    //     makePromiseTransparent(promise);
    //     return promise;
    // }

    #createSetter(value) {
        const {setRetry, setRetryDelay, setDebouncePeriod} = this.options;        
        const promise = abortablePromise((resolve, reject) => {
            retryAsync(
                () => this.createSetter(value, promise.controller.signal),
                setRetry,
                setRetryDelay
            ).then(resolve, reject);
        }, setDebouncePeriod);
        
        makePromiseTransparent(promise);
        return promise;
    }

    #cacheGetter(promise){
        // trigger onchange if the value changes
        // note: triggers also if the getter is no more cached as we dont know if the value has changed
        const oldGetter = this.#getter;
        promise.then(value => {
            if (this.#getter !== promise) return; // promise is outdated
            const oldValue = oldGetter?.value;
            if (oldValue !== value) { // isEqual?
                try {
                    this.onchange?.({value, oldValue});
                } catch (err) {
                    console.error('AsyncDataPoint onchange error:', err);
                }
            }
        });

        const duration = this.options.ttl;
        if (!duration) return;
        if (typeof duration === 'number') {
            clearTimeout(this.#cacheGetterTimeout);
            this.#cacheGetterTimeout = setTimeout(() => {
                if (this.#getter === promise) this.#getter = null; // i clear the cache only if the promise is still the same, is it needed as i clear the timeout?
            }, duration);
        }
        this.#getter = promise;
    }
    // set value without saving it to the master
    // this is useful if the value comes from the master through an other channel
    // for example a cookechange event, or a fs-watch event
    setLocal(value) {
        this.#cacheGetter(transparentPromiseResolve(value));
    }
    get recentValue() {
        return this.#getter?.value;
    }

    get() {
        if (this.#setter?.state === 'pending') {
            if (this.options.optimistic) {
                return Promise.resolve(this.#expectedValue); // trust sending value
            } else {
                // todo: options for setter method to return the final value?
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
        const handleResult = data => {
            if (this.#setter !== promise) return; // promise is outdated
            if (data instanceof Error) {
                this.#getter = null; // clear getter cache
            } else {
                this.setLocal(value);
            }
            this.#setter = null;
            this.#expectedValue = null;
        };
        promise.then(handleResult, handleResult);
        return this.#setter = promise;
    }

    dispose() {
        clearTimeout(this.#cacheGetterTimeout);
        this.#setter?.controller.abort();
        this.#setter = null;
        this.#getter = null;
        this.#expectedValue = null;
        this.#cacheGetterTimeout = null;
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
 * @param {Promise} promise - The Promise to make transparent.
 * @returns void
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
}

/**
 * Returns a transparent Promise (see makePromiseTransparent) that is resolved with the specified value.
 * @param {any} value - The value to resolve the Promise with.
 * @returns {Promise} - A transparent Promise.
 */
function transparentPromiseResolve(value) {
    const promise = Promise.resolve(value);
    makePromiseTransparent(promise);
    promise.state = 'fulfilled';
    promise.value = value;
    return promise;
}

/**
 * Returns a delayed Promise that can be aborted within the specified time (ms).
 * @param {Function} fn - A function that returns a Promise.
 * @param {Number} [ms=1] - The time in milliseconds to delay before resolving the Promise.
 * @returns {Promise} - A delayed Promise that can be aborted.
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
 * @param {Number} maxAttempts - Maximum number of attempts.
 * @param {Number} baseDelay - Base delay in milliseconds for exponential backoff.
 * @returns {Promise} - The result of the operation.
 */
async function retryAsync(fn, maxAttempts = 3, baseDelay = 1000) {
    let lastError;
    
    for (let attempt = 0; attempt < maxAttempts; attempt++) {
        try {
            return await fn();
        } catch (error) {
            lastError = error;
            
            if (attempt < maxAttempts - 1) {
                const delay = baseDelay * Math.pow(2, attempt);
                console.warn(`Retry attempt ${attempt + 1}/${maxAttempts} failed, retrying in ${delay}ms...`, error);
                await new Promise(resolve => setTimeout(resolve, delay));
            }
        }
    }
    
    throw lastError;
}

function isEqual(a, b) {
    if (a === b) return true;
    if (typeof a !== 'object' || typeof b !== 'object') return false;
    if (a == null || b == null) return false;
    try {
        return JSON.stringify(a) === JSON.stringify(b);
    } catch {
        return false; // Bei Circular References -> ungleich behandeln
    }
}