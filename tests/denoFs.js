import {denoFs, jsonFile} from "../drivers/denoFs.js";
import {effect} from "../item.js";
import { fromFileUrl } from "https://deno.land/std@0.182.0/path/mod.ts";

// ugly substring to remove the leading slash
//const testDirectory = new URL('.', import.meta.url).pathname.substring(1) + 'denoFs-test';
const testDirectory = fromFileUrl(new URL('./denoFs-test', import.meta.url));

console.log('='.repeat(60));
console.log('🧪 DENO FS DRIVER TESTS');
console.log('='.repeat(60));

/* Setup test directory */
try {
    await Deno.mkdir(testDirectory, {recursive: true});
    await Deno.writeTextFile(`${testDirectory}/readme.md`, '# Test README\n\nInitial content.');
    await Deno.writeTextFile(`${testDirectory}/test.json`, JSON.stringify({
        name: 'root',
        count: 0,
        children: {
            '1': {name: 'Child One', age: 10},
            '2': {name: 'Child Two', age: 20}
        }
    }, null, 2));
    await Deno.mkdir(`${testDirectory}/subdir`, {recursive: true});
    await Deno.writeTextFile(`${testDirectory}/subdir/nested.txt`, 'Nested file content');
} catch (e) {
    console.log('Setup files already exist, continuing...');
}

console.log('\n📁 Test directory:', testDirectory);

/* TEST 1: Directory listing */
console.log('\n' + '─'.repeat(60));
console.log('TEST 1: Directory Listing (Lazy with loadItems)');
console.log('─'.repeat(60));

const root = denoFs(testDirectory, {watch: true});
await root.loadItems(); // Load only the list, not contents

console.log('Items in root:');
for (const item of root) {
    console.log(`  - ${item.key} (${item.fsPath})`);
}

/* TEST 2: Read file contents */
console.log('\n' + '─'.repeat(60));
console.log('TEST 2: Read File Contents');
console.log('─'.repeat(60));

const readme = root.item('readme.md');
const contents = await readme.promise;
console.log('readme.md content:');
console.log(contents);
console.log(`\nContent length: ${contents.length} chars`);

/* TEST 3: Write file */
console.log('\n' + '─'.repeat(60));
console.log('TEST 3: Write File');
console.log('─'.repeat(60));

const timestamp = new Date().toISOString();
readme.value = `# Updated README\n\nLast saved: ${timestamp}`;
console.log('✅ Wrote new content to readme.md');

// Verify write
const newContent = await readme.promise;
console.log('Verified new content:');
console.log(newContent);

/* TEST 4: Change detection via events */
console.log('\n' + '─'.repeat(60));
console.log('TEST 4: Change Detection');
console.log('─'.repeat(60));

readme.addEventListener('change', ({detail}) => {
    console.log('🔔 readme.md changed:');
    console.log(`  Old: ${detail.oldValue?.substring(0, 50)}...`);
    console.log(`  New: ${detail.value?.substring(0, 50)}...`);
});

console.log('⏳ Manually edit readme.md in your editor and save...');
console.log('   (watching for changes for 5 seconds)');

await new Promise(resolve => setTimeout(resolve, 5000));

/* TEST 5: Reactive effects */
console.log('\n' + '─'.repeat(60));
console.log('TEST 5: Reactive Effects');
console.log('─'.repeat(60));

let effectRuns = 0;
const dispose = effect(() => {
    effectRuns++;
    const content = readme.value;
    console.log(`🔄 Effect run #${effectRuns}: Content is ${content?.length || 0} chars`);
});

readme.value = '# Effect Test 1';
await new Promise(resolve => setTimeout(resolve, 10));

readme.value = '# Effect Test 2\n\nMore content.';
await new Promise(resolve => setTimeout(resolve, 10));

dispose(); // Clean up
console.log(`✅ Effect ran ${effectRuns} times total`);

/* TEST 6: Nested directories */
console.log('\n' + '─'.repeat(60));
console.log('TEST 6: Nested Directory Access');
console.log('─'.repeat(60));

const nested = root.item('subdir').item('nested.txt');
const nestedContent = await nested.promise;
console.log('subdir/nested.txt content:');
console.log(nestedContent);

nested.value = 'Updated nested content at ' + new Date().toISOString();
console.log('✅ Updated nested file');

/* TEST 7: Create new file */
console.log('\n' + '─'.repeat(60));
console.log('TEST 7: Create New File');
console.log('─'.repeat(60));

const newFile = root.item('newfile.txt');
newFile.value = 'This is a newly created file!';
console.log('✅ Created newfile.txt');

// Verify it exists
const newFileContent = await newFile.promise;
console.log('New file content:', newFileContent);

/* TEST 8: Delete file */
console.log('\n' + '─'.repeat(60));
console.log('TEST 8: Delete File');
console.log('─'.repeat(60));

await newFile.remove();
console.log('✅ Deleted newfile.txt');

// Verify deletion
try {
    await Deno.stat(newFile.fsPath);
    console.log('❌ File still exists!');
} catch (e) {
    if (e instanceof Deno.errors.NotFound) {
        console.log('✅ File successfully deleted');
    }
}

/* TEST 9: Eager directory loading */
console.log('\n' + '─'.repeat(60));
console.log('TEST 9: Eager Directory Loading (Full Tree)');
console.log('─'.repeat(60));

console.log('⚠️  Loading entire directory tree (use with caution)...');
const fullTree = await root.promise;
console.log('Full directory structure:');
console.log(JSON.stringify(fullTree, null, 2));

/* TEST 10: JSON file operations */
console.log('\n' + '─'.repeat(60));
console.log('TEST 10: JSON File Operations');
console.log('─'.repeat(60));

const data = await jsonFile(testDirectory + '/test.json');

// Event listener for JSON changes
data.addEventListener('changeIn', ({detail}) => {
    if (detail.add)    console.log(`  ➕ Added: ${detail.item.path.join('.')} → ${detail.add.key}`);
    if (detail.remove) console.log(`  ➖ Removed: ${detail.item.path.join('.')} → ${detail.remove.key}`);
    if (detail.value !== undefined)  console.log(`  📝 Changed: ${detail.item.path.join('.')} = ${JSON.stringify(detail.value)}`);
});

console.log('Initial JSON content:');
console.log(JSON.stringify(data.value, null, 2));

// Modify existing value
console.log('\n🔧 Modifying children.1.name...');
data.item('children').item('1').item('name').value = 'Updated Child One';

await new Promise(resolve => setTimeout(resolve, 50));

// Add new child
console.log('\n🔧 Adding new child...');
data.item('children').item('3').set({name: 'Child Three', age: 30});

await new Promise(resolve => setTimeout(resolve, 50));

// Increment counter
console.log('\n🔧 Incrementing count...');
const currentCount = data.item('count').value;
data.item('count').value = currentCount + 1;

await new Promise(resolve => setTimeout(resolve, 50));

// Remove a child
console.log('\n🔧 Removing children.2...');
data.item('children').item('2').remove();

await new Promise(resolve => setTimeout(resolve, 50));

// Verify final state
console.log('\nFinal JSON content:');
console.log(JSON.stringify(data.value, null, 2));

/* TEST 11: Promise handling */
console.log('\n' + '─'.repeat(60));
console.log('TEST 11: Promise States');
console.log('─'.repeat(60));

const promiseTest = root.item('promise-test.txt');
console.log('Initial state:');
console.log(`  pending: ${promiseTest.pending}`);
console.log(`  filled: ${promiseTest.filled}`);
console.log(`  error: ${promiseTest.error}`);

const writePromise = promiseTest.set('Test content for promise');
console.log('\nDuring set:');
console.log(`  pending: ${promiseTest.pending}`);

await writePromise;
console.log('\nAfter set:');
console.log(`  pending: ${promiseTest.pending}`);
console.log(`  filled: ${promiseTest.filled}`);

/* TEST 12: Concurrent operations */
console.log('\n' + '─'.repeat(60));
console.log('TEST 12: Concurrent Write Operations');
console.log('─'.repeat(60));

const concurrent = root.item('concurrent.txt');
const promises = [];

for (let i = 0; i < 5; i++) {
    promises.push(concurrent.set(`Write #${i} at ${Date.now()}`));
    await new Promise(resolve => setTimeout(resolve, 10));
}

await Promise.all(promises);
const finalValue = await concurrent.promise;
console.log('Final value after concurrent writes:');
console.log(finalValue);

/* TEST 13: Error handling */
console.log('\n' + '─'.repeat(60));
console.log('TEST 13: Error Handling');
console.log('─'.repeat(60));

const nonExistent = root.item('does-not-exist.txt');
const result = await nonExistent.promise;
console.log('Non-existent file value:', result); // Should be undefined

try {
    const invalid = root.item('../../../etc/passwd'); // Try to escape
    await invalid.promise;
    console.log('❌ Should have thrown error for invalid path');
} catch (e) {
    console.log('✅ Correctly rejected invalid path:', e.message);
}

/* TEST 14: Proxy access *
console.log('\n' + '─'.repeat(60));
console.log('TEST 14: Proxy Access Pattern');
console.log('─'.repeat(60));

const proxy = root.proxy;
console.log('Using proxy notation:');
console.log(`  proxy['readme.md']: ${(await proxy['readme.md'])?.substring(0, 30)}...`);

proxy['proxy-test.txt'] = 'Created via proxy!';
await new Promise(resolve => setTimeout(resolve, 50));

console.log(`  proxy['proxy-test.txt']: ${await proxy['proxy-test.txt']}`);

/* Cleanup */
console.log('\n' + '='.repeat(60));
console.log('🧹 CLEANUP');
console.log('='.repeat(60));

const cleanup = await confirm('Delete test directory? (y/n)');
if (cleanup) {
    await Deno.remove(testDirectory, {recursive: true});
    console.log('✅ Test directory removed');
} else {
    console.log('⏭️  Test directory kept at:', testDirectory);
}

console.log('\n' + '='.repeat(60));
console.log('✅ ALL TESTS COMPLETED');
console.log('='.repeat(60));

function confirm(message) {
    return new Promise((resolve) => {
        console.log(`\n${message}`);
        resolve(true); // Auto-confirm for now, make interactive if needed
    });
}