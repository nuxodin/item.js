// TODO: Radio-items (RadioNodeList)

import { Item } from '../item.js';

class FormItem extends Item {
    constructor(parent, key) {
        super(parent, key);
    }
    setElement(form) {
        this.formElement = form;
    }
    getAll() {
        for (const input of this.formElement.elements) {
            if (!input.name) continue;
            this.item(input.name);
        }
    }
    $get() {
        this.getAll();
        return super.$get();
    }
    ChildClass = InputItem;
}

class InputItem extends Item {
    constructor(parent, key) {
        super(parent, key);
        if (parent) { // if child of a form-item
            this.setElement(parent.formElement.elements[key]);
        }
    }
    setElement(element) {
        if (element instanceof RadioNodeList) {
            element = element[0];
        }
        this.element = element;
        this.value = this._getInputValue();
        element.addEventListener('input', e => {
            this.value = this._getInputValue();
        });
    }
    $set(value) {
        //value = value == null ? null : String(value);
        super.$set(value);
        this._setInputValue(value);
    }
    _getInputValue() {
        const element = this.element;
        if (element.type === 'checkbox') {
            return element.checked ? element.value : null;
        }
        return element.value;
    }
    _setInputValue(value) {
        const element = this.element;
        if (element.type === 'checkbox') {
            if (typeof value === 'boolean') {
                element.checked = value;
            } else {
                value = String(value);
                element.checked = value === this.element.value ? true : false;
            }
        } else {
            element.value = value;
        }
    }
    item() { throw('input-items have no children'); }
}

export function createFormItem(form) {
    const item = new FormItem();
    item.setElement(form);
    return item;
}
export function createInputItem(input) {
    const item = new InputItem(null, input.name);
    item.setElement(input);
    return item;
}
