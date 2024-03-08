import { item, Item } from '../item.js';


export function formItem(form) {
    const root = item();
    root.ChildClass = InputItem;
    root.formElement = form;


    root.getAll = function() {
        form.elements.forEach(input => {
            const item = root.item(input.name);
            item.value = input.value;
        });
    };

    form.addEventListener('input', e => {
        const input = e.target;
        const item = root.item(input.name);
        item.value = input.type === 'checkbox' ? input.checked : input.value;
    });



    return root;
}

class InputItem extends Item {
    constructor(parent, key) {
        super(parent, key);
        this.input = parent.formElement.elements[key];
    }
    $set(value) {
        super.$set(value);
        if (this.input.type === 'checkbox') {
            this.input.checked = value;
        } else {
            this.input.value = value;
        }
    }
}

// usage:

import { formItem } from './item.js/drivers/htmlForm.js';
import { effect } from './item.js';

const item = formItem(formElement);
item.item('name').value = 'John Doe';

effect(() => {
    console.log(item.item('name').value);
});