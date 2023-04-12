import {denoFs} from "../drivers/denoFs.js";

// ugly substring to remove the leading slash
const testDirectory = new URL('.', import.meta.url).pathname.substring(1) + 'denoFs-test';

/* */
const root = denoFs(testDirectory, {watch: true});
await root.item('nested');


const prox = root.proxy;

prox.nested = {
    'item1.txt': 'Hello World 1',
    'item2.txt': 'Hello World 2',
    'deeper': {
        'deeper1.txt': 'Hello World 3',
        'deeper2.txt': 'Hello World 4',
    }
};

console.log(
    await root.item('nested').item('another').value
)
console.log(
    await prox.nested.another
)


prox.nested.another.x = 'Hello World 4';
console.log(await prox.nested.another.x)
console.log(await root.item('nested').item('another').item('x').value);

//delete prox.nested;


//console.log(prox.nested.$item.fsPath);
