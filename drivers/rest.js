// alpha!

//import {Item} from '../item.js';
import {AsyncItem} from '../tools/AsyncItem.js';

// restApi
export function restApi(url, options={}){

    // todo, cancel request if item turns into an object, great for proxified items
    class RestApiItem extends AsyncItem {
        static isPrimitive(){ return false; }
        createGetter() {
            return itemRequest(this, 'GET');
        }
        createSetter(value, signal) {
            return itemRequest(this, 'PUT', JSON.stringify(value), signal);
        }
        ChildClass = RestApiItem;
    }

    const root = new RestApiItem();

    async function itemRequest(item, method, body, signal){
        const headers = new Headers();
        if (options?.auth) {
            const {username, password} = options.auth;
            headers.append('Authorization', 'Basic' + base64.encode(username + ":" + password));
        }

        //setTimeout(() => signal.abort(), options?.timeout ?? 10000);

        const endPoint = url + '/' + item.pathKeys.join('/');

        const response = await fetch(endPoint, {headers, method, body, signal});
        let data = await response.json();

        if (options.map) data = options.map(data);

        for (const[key, value] of Object.entries(data)) {
            item.item(key);
        }

        return data;
    }

    return root;
}
