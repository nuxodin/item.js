import {Item} from '../item.js';

let root = null; // cached
export function cookieItem(){
    if (!root) {

        root = new Item();

        cookieStore.addEventListener('change', e => { // todo: if two windows open, this will trigger twice
            e.changed.forEach(c => {
                const item = root.item(c.name);
                item.value = c.value // triggers setIn
            });
        });

        root.addEventListener('setIn', ({detail}) => {

            cookieStore.set({ // triggers change
                asdf: 'asdf',
                name: detail.item.key,
                value: detail.newValue,
                //expires: Date.now() + day,
                //domain: "example.com",
            }).then(
                () => {
                },
                (reason) => console.error("It failed: ", reason)
            );
        });

        root.addEventListener('getIn', ({detail}) => {
            detail.setValue = cookieStore.get(detail.item.key).then(data=>data.value);
        });


    }
    return root;
}
