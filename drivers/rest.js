import {item} from '../item.js';

// restApi
export function restApi(url, options){

    // todo, cancel request if item turns into an object, great for proxified items

    const root = item();
    root.addEventListener('setIn', e => {
        const item = e.detail.item;

        if (item.setRequest) {// cancel previous getter fetch
            item.setRequest.controller.abort();
            item.setRequest = null;
        }
        if (item.getRequest) { // cancel getter fetch, will fetch next time
            item.getRequest.controller.abort();
            item.getRequest = null;
        }

        item.setRequest = itemRequest(item, 'PUT', JSON.stringify(e.detail.newValue));

        item.setRequest.promise.then(() => { // wait for the fetch to be done
            item.setRequest = null;
        });

    });
    root.addEventListener('getIn', e => {
        const item = e.detail.item;

        if (item.getRequest) return; // already fetched or fetching

        item.getRequest = itemRequest(item, 'GET');
        const {promise} = item.getRequest;

        promise.then(value => { // cache the promise for 1 seconds
            setTimeout(() => {
                item.getRequest = null;
            }, 1000);
        });
        e.detail.setValue = promise; // silintly set the value, no event
    });




    function itemRequest(item, method, body){
        const headers = new Headers();
        if (options?.auth) {
            const {username, password} = options.auth;
            headers.append('Authorization', 'Basic' + base64.encode(username + ":" + password));
        }
        const controller = new AbortController();

        setTimeout(() => controller.abort(), options?.timeout ?? 10000);

        const promise = fetchDelay(url + '/' + item.pathString, {headers, method, body, signal:controller.signal}).then(response => {
            const value = response.json();
            //item.value = value; // no more a promise, trigger setter to update
            return value;
        }).catch(error => {
            if (error.name === 'AbortError') {
                console.log('fetch aborted');
            } else {
                console.error(error);
            }
        });
        return {controller,promise};
    }



    return root;
}



function fetchDelay(url, options){ // not direct fetch, can be aborted quickly
    return new Promise(resolve => {
        setTimeout(() => {
            resolve(fetch(url, options));
        }, 1);
    });
}
