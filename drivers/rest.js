// alfa version, todo!

//import {Item} from '../item.js';
import {AsyncItem} from '../tools/AsyncItem.js';

// restApi
export function restApi(url, options){

    // todo, cancel request if item turns into an object, great for proxified items
    class RestApiItem extends AsyncItem {
        static isPrimitive(){ return false; }
        createGetter() {
            return itemRequest(this, 'GET').promise;
        }
        createSetter(value) {
            return itemRequest(this, 'PUT', JSON.stringify(value)).promise;
        }
    }

    const root = new RestApiItem();

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

    function fetchDelay(url, options){ // not direct fetch, can be aborted quickly
        return new Promise(resolve => {
            setTimeout(() => {
                resolve(fetch(url, options));
            }, 1);
        });
    }

    return root;
}
