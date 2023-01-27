import {item} from '../item.js';

let root = null; // cached
export function cookieItem(){
    if (!root) {

        root = item();

        cookieStore.addEventListener('change', e => { // todo: if two windows open, this will trigger twice
            e.changed.forEach(c => {
                const item = root.item(c.name);
                item.value = c.value; // triggers change
            });
        });

        root.addEventListener('changeIn', ({detail}) => {
            cookieStore.set({ // triggers change
                name: detail.item.key,
                value: detail.value,
                //expires: Date.now() + day,
                //domain: "example.com",
            }).then(
                () => { },
                (reason) => console.error("It failed: ", reason)
            );
        });

        root.addEventListener('getIn', ({detail}) => {
            detail.returnValue = cookieStore.get(detail.item.key).then(data=>data.value);
        });


    }
    return root;
}
