import { effect } from "../item.js";
import { mqtt } from "../drivers/mqtt.js";

const x = await mqtt({url: 'mqtt://test.mosquitto.org:1883'});


effect(async () => {
    console.log(await x.item('item.js').item('x').value);
});


x.addEventListener('changeIn', ({detail}) => {
    if (detail.add)    console.log('- added: ' + detail.item.pathKeys.join('/') + ' added ' + detail.add.key);
    if (detail.remove) console.log('- removed: ' + detail.item.pathKeys.join('/') + ' removed ' + detail.remove.key);
    if (detail.value)  console.log('- value: ' + detail.item.pathKeys.join('/') + ' = ' + detail.value);
});

x.item('11111').subscribe();

x.item('11111').item('22222').value;

x.item('item.js').subscribe();
x.item('item.js').item('x').value = 'Hello item.js';
