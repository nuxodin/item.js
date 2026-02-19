import {denoFs} from "../drivers/denoFs.js";

// ugly substring to remove the leading slash
const testDirectory = new URL('.', import.meta.url).pathname.substring(1) + 'denoFs-test';

/* */
const root = denoFs(testDirectory, {watch: true});

// dir list
console.log('## dir list:')

await root.value; // as the root is a directory, it will return a list of items
for (const item of root) {
    console.log('- '+item.key);
}

// readme.md
const readme = root.item('readme.md');
const contents = await readme.value;

readme.addEventListener('change', ({detail}) => {
    console.log('## readme.md changed \n -from: ' + detail.oldValue + '\n -to: ' + detail.value);
});

console.log('## readme.md content:');
console.log(contents);

console.log('## modifie it directly in a editor and save it');

readme.value = 'Hello World, last saved on: ' + new Date();



/* jsonFile */
import {jsonFile} from "../drivers/denoFs.js";

const data = await jsonFile(testDirectory+'/test.json');

data.addEventListener('changeIn', ({detail}) => {
    if (detail.add)    console.log('- added: ' + detail.item.pathKeys.join('.') + ' added ' + detail.add.key);
    if (detail.remove) console.log('- removed: ' + detail.item.pathKeys.join('.') + ' removed ' + detail.remove.key);
    if (detail.value)  console.log('- value: ' + detail.item.pathKeys.join('.') + ' = ' + detail.value);
});
console.log('## json: ' + JSON.stringify(data.value, null, 2));

data.item('children').item('1').item('name').value = 'Hello World';