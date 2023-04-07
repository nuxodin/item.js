

import {collectChanges} from "./collectChanges.js";

export function syncToServer(item, {url, delay=100}){

    let waiting = false;
    const getAndReset = collectChanges(item, {onchange:()=>{
        if (waiting) return;
        waiting = true;
        setTimeout(() => {
            waiting = false;
            const body = JSON.stringify(getAndReset());
            fetch(url, {
                method: 'POST',
                headers: {'Content-Type': 'application/json'},
                body
            });
        }, delay);
    }});

}



/*
function syncToRestApi(item, {url, delay=100}){
    item.addEventListener('changeIn', e => {
        const {item, value} = e.detail;
        if (e.detail.add) return; // will be handled if the value is set (an other changeIn event)
        if (e.detail.remove) {
            const path = item.pathKeys;
            const restUrl = url + '/' + path.join('/');
            fetch(restUrl, {
                method: 'DELETE',
                headers: {'Content-Type': 'application/json'},
            });
        } else {
            const path = item.pathKeys;
            const restUrl = url + '/' + path.join('/');
            fetch(restUrl, {
                method: 'PUT',
                headers: {'Content-Type': 'application/json'},
                body: JSON.stringify(value)
            });
        }
    });
}
*/