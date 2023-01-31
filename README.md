# item.js

Create observable datastructures

## demo

```js

import { item, effect } from '../item.js';

const a = item(1);
a.value === 1; // true
a.value = 2;
a.value === 2; // true

a.addEventListener('change', ({detail}) => {
  console.log(detail.oldValue, detail.value);
});
a.value = 3; // triggers 'change' event

a.addEventListener('get', ({detail}) => {
    console.log(detail.value);
});
a.value; // triggers 'get' event


// you can also add objects
const b = item({a: 1});

// 'change' would not trigger on 'b', when we change its child 'a'
b.addEventListener('changeIn', ({detail}) => {
    detail.item === b.item('a'); // true
    console.log(detail.item, detail.oldValue, detail.value);
});
b.item('a').value = 2; // triggers 'changeIn' event on 'b' (bubbles up)

b.item('a').parent === b; // true
b.item('a').path; // equals [b, a];
b.item('a').pathKeys; // ['a'];
b.walkPathKeys(['a', 'b', 'c']); // equals b.item('a').item('b').item('c');


// proxy!

import {proxy} from '../item.js';

const i = item({a: 1});
const p = proxy(i);
p.a === 1; // equals `i.item('a').value === 1`
p.a = 2;

// you can also use `proxy` to create a proxy of a plain object
const p = proxy({a: 1});


```
