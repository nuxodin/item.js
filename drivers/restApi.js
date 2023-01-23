import {item} from '../item.js';

// restApi
export function restApi(url, options){
    const root = item();
    root.addEventListener('setIn', e => {
        // throw new Error('not implemented');
        // item.getPromise = null; // bad, get is called inside set
        console.log('setIn', e.detail.item.path);
    });
    root.addEventListener('getIn', e => {
        const item = e.detail.item;

        console.log(url + '/' + item.path);
        return;

        if (item.getPromise) return; // already fetched or fetching

        const headers = new Headers();
        if (options?.auth) {
            const {username, password} = options.auth;
            headers.append('Authorization', 'Basic' + base64.encode(username + ":" + password));
        }

        const promise = fetch(url + '/' + item.path, {headers}).then(response => {
            const value = response.json();
            item.value = value; // no more a promise, trigger setter to update
            return value;
        });


        item.value = promise;
        item.getPromise = promise;
    });
    return root;
}
