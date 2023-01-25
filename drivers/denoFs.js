import {item} from '../item.js';

export function denoFs(rootPath) {
    const root = item();

    const watcher = Deno.watchFs(rootPath);

    for await (const event of watcher) {
        // Example event: { kind: "create", paths: [ "/home/alice/deno/foo.txt" ] }
        // get the path within the root
        for (const path of event.paths) {
            // get the path relative to the root
            const relativePath = path.substring(rootPath.length + 1);
            const pathArray = relativePath.split('/');
            root.walkPathArray(pathArray).value = null; // trigger get, todo
        }
    }

    root.addEventListener('setIn', e => {
        const {item, newValue} = e.detail;
        Deno.writeTextFile(rootPath + '/' + item.path, newValue);
    });

    root.addEventListener('getIn', e => {
        const {item} = e.detail;
        const value = Deno.readTextFile(rootPath + '/' + item.path); //  promise
        item.value = value;
    });

    return root;
}
