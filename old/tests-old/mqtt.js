
import { effect } from "../item.js";
import { createMqtt } from "../adapter/deno/mqtt.js";

const x = await createMqtt({url: 'mqtt://test.mosquitto.org:1883'});

effect(async () => {
    console.log(await x.item('item.js').item('x').value);
});


x.addEventListener('changeIn', ({detail}) => {
    if (detail.add)    console.log('- added: ' + detail.item.path.join('/') + ' added ' + detail.add.key);
    if (detail.remove) console.log('- removed: ' + detail.item.path.join('/') + ' removed ' + detail.remove.key);
    if (detail.value)  console.log('- value: ' + detail.item.path.join('/') + ' = ' + detail.value);
});

x.item('11111').subscribe();

x.item('11111').item('22222').value;

x.item('item.js').subscribe();
x.item('item.js').item('x').value = 'Hello item.js';
