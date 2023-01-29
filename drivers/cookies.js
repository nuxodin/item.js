import {item} from '../item.js';

let root = null; // cached
export function cookies(){
    if (!root) {

        root = item();

        cookieStore.addEventListener('change', e => { // todo: if two windows open, this will trigger twice
            e.changed.forEach(c => {
                root.item(c.name).value = c.value; // triggers item change
            });
        });

        root.addEventListener('changeIn', ({detail}) => {
            cookieStore.set({ // triggers store-change
                name: detail.item.key,
                value: detail.value,
                //expires: Date.now() + day,
                //domain: "example.com",
            }).then(
                () => { },
                (reason) => console.error("It failed: ", reason)
            );
        });

        root.addEventListener('getIn', ({detail:{item}}) => {
            if (item.filled) return;
            item.value = cookieStore.get(item.key).then( data => data?.value ?? '' ); // setting inside getter does not trigger change
        });

    }
    return root;
}