import {denoFs} from "../drivers/denoFs.js";

// ugly substring to remove the leading slash
const testDirectory = new URL('.', import.meta.url).pathname.substring(1) + 'denoFs-test';

const root = denoFs(testDirectory, {watch: true});

// dir list
console.log('## dir list:')

const dirList = await root; // as the root is a directory, it will return a list of items
for (const name in dirList) {
    console.log('- '+name);
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
