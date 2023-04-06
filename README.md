# item.js

Creates observable datastructures

## Motivation

`item.js` is designed to provide developers with a consistent API for accessing and manipulating data from various sources. This makes it easier to use and integrate these data sources in your projects.

## 🎉 Uniform interfaces for diverse structured data!

We are working on various drivers based on "item.js" to consistently use the same API everywhere.  
Examples include `file systems`, `MQTT`, `localStorage`, `cookies`,`databases` , and so on.
<!-- [See this localStorage example]() -->

## Installation

```js
import { item } from '../item.js';
```

## Wrapped value
```js
const a = item(1);
a.value === 1; // true
a.value = 2;
a.value === 2; // true

const c = item(); // no argument (not filled)
c.filled === false;
c.value = undefined;
c.filled === true; // true

// using object
const a = item({b: 1});
a.value // {b: 1}
const b = a.item('b'); // property 'b' is also an "Item"
b.parent === a;
b.key === 'b';
b.path; // equals [a, b]
b.pathKeys; // ['b'];
a.walkPathKeys(['a', 'b', 'c']); // equals b.item('a').item('b').item('c');
```

## Effect
```js
// effect
effect(() => {
    console.log(a.item('b').value);
    console.log(b.item('c').value);
});
a.item('b').value = 2;
b.item('c').value = 3;
// triggers effect batched after a microtask
```

## Events
```js
a.addEventListener('change', ({detail}) => {
  console.log(detail.oldValue, detail.value);
});
a.value = 3; // triggers 'change' event

a.addEventListener('get', ({detail}) => {
    console.log(detail.value);
});
a.value; // triggers 'get' event

// bubbling (changeIn)
a.addEventListener('changeIn', ({detail}) => {
    detail.item === a.item('b'); // true
    console.log(detail.item, detail.oldValue, detail.value);
});
a.item('b').value = 2; // triggers 'changeIn' event on 'a' (bubbles up)
```

## Proxy
```js
import { proxy } from '../item.js';

const i = item({a: 1});
const p = proxy(i);
p.a === 1; // equals `i.item('a').value === 1`
p.a = 2;

// you can also use `proxy` to create a proxy of a plain object
const p = proxy({a: 1});
```

## Extend from Item
```js
import { Item } from '../item.js';

class UpperCaseItem extends Item {
    $get() { // overwrite getter
        const value = super.$get();
        return typeof value === 'string' ? value.toUpperCase() : value;
    }
}

// Ussage:
const a = new UpperCaseItem();
a.value = {a: 'Hello', b: 'World'};
console.log(a.value); // {a: 'HELLO', b: 'WORLD'}
```


## Alternatives

https://github.com/dy/signal-struct

https://github.com/luisherranz/deepsignal

https://github.com/EthanStandel/deepsignal/tree/main/packages/preact

https://github.com/melnikov-s/preact-observables
