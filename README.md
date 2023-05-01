# item.js

Observable datastructures

## Motivation

`item.js` is designed to provide developers with a consistent API for accessing and manipulating data from various sources. This makes it easier to use and integrate these data sources in your projects.

### 🎉 Uniform interfaces for diverse structured data!

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
const p = item({a: 1}).proxy;
p.a === 1; // equals `i.item('a').value === 1`
p.a = 2;
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

## See how easy it is to use "item.js" with different drivers

```js	
// indexeddb
import {IDB} from "../drivers/indexedDb.js";
const db = IDB().item('db');
db.open(2, { upgrade(db, oldVersion, newVersion, transaction) { ... } });

db.item('store').item('1').item('name').value = 'demo';

// MySQL
import {Mysql} from "../drivers/sql/Mysql.js";
const db = new Mysql({host: 'localhost'}).item('db');
await db.connect();

db.item('table').item('1').item('name').value = 'demo';

// MQTT
import {mqtt} from "../drivers/mqtt.js";
const root = await mqtt({url: 'mqtt://mqtt.org:1883'});

root.item('house1').item('counters').item('electricity').value = 876;

// localStorage
import {getStore} from "../drivers/localStorage.js";
const store = getStore('demo');

store.item('someItem').value = 'Hello World';

// cookies
import {cookies} from "../drivers/cookies.js";
const root = cookies();

root.item('myCookie').value = 'Hello World';
```

Even easier with with proxies:

```js

const db = dbItem.proxy;

db.myTable[1] = {name: 'demo', age: 42};

// and react to changes
effect(() => {
    input.value = mqtt.house1.counters.electricity;
});
```

## About

- MIT License, Copyright (c) 2022 <u1> (like all repositories in this organization) <br>
- Suggestions, ideas, finding bugs and making pull requests make us very happy. ♥
