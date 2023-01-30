
export class AsyncMaster {

    trustSendingValue = true;
    cacheDuration = 2000; // cache for 2 seconds, false = no cache, true = cache forever
    expectedValue = null;
    setDebouncePeriod = 5; // debounce period for setter in ms
    setter = null; // current setter promise
    getter = null; // current/cached getter promise

    constructor({get, set}) {
        this.createGetter = get;
        this.createSetter = set;
    }
    #createGetter() {
        const promise = this.createGetter();
        makePromiseTransparent(promise);
        return promise;
    }
    #createSetter(value) {
        const promise = abortablePromise((resolve, reject) => {
            return this.createSetter(value).then(resolve, reject);
        }, this.setDebouncePeriod);
        makePromiseTransparent(promise);
        return promise;
    }
    #cacheGetterTimeout = null;
    #cacheGetter(promise){
        const duration = this.cacheDuration;
        if (!duration) return;
        if (typeof duration === 'number') {
            clearTimeout(this.#cacheGetterTimeout);
            this.#cacheGetterTimeout = setTimeout(() => {
                if (this.getter === promise) this.getter = null; // i clear the cache only if the promise is still the same, is it needed as i clear the timeout?
            }, duration);
        }
        this.getter = promise;
    }
    get() {
        if (this.setter?.state === 'pending' && this.trustSendingValue) return Promise.resolve(this.expectedValue); // trust sending value
        let promise = this.getter;
        if (!promise) {
            promise = this.#createGetter();
            this.#cacheGetter(promise);
        }
        return promise;
    }
    set(value) {
        if (this.setter?.state === 'pending' && this.expectedValue === value) return; // ignore if sending value is the same
        if (this.getter?.state === 'fulfilled' && this.getter.value === value) return; // ignore if latest getter value is the same
        this.expectedValue = value;
        this.setter?.abort(); // abort previous setter
        const promise = this.#createSetter(value);
        const handleResult = data => {
            if (this.setter !== promise) return; // ignore if setter has been replaced
            if (data instanceof Error) {
                console.warn('setter rejected: ', data);
                this.getter = null; // clear getter cache
            } else {
                this.#cacheGetter(transparentPromiseResolve(value));
            }
            this.setter = null;
            this.expectedValue = null;
        };
        promise.then(handleResult, handleResult);
        this.setter = promise;
    }
}







// helper functions
/**
 * Adds state and value properties to a Promise, making it transparent.
 * @param {Promise} promise - The Promise to make transparent.
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
            promise.value = reason;
        }
    );
}

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
function abortablePromise(fn, ms=1) { // delayed and therfore abortable withing ms
    let aborted = false;
    const promise = new Promise((resolve, reject) => {
        setTimeout(() => {
            if (aborted) return resolve(null);
            fn(resolve, reject);
        }, ms);
    });
    promise.abort = () => aborted = true;
    promise.isAborted = () => aborted;
    return promise;
}