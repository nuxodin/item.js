import { Client } from 'https://deno.land/x/mqtt@0.1.2/deno/mod.ts';
import { Item } from '../../item.js';


export async function mqtt(options){
    const client = new Client(options);
    await client.connect();

    const decoder = new TextDecoder();

    client.on('message', (topic, payload) => {
        const text = decoder.decode(payload);
        const pathArray = topic.split('/');
        const targetItem = root.sub(pathArray);
        targetItem.asyncHandler.setLocal(text);
    });

    class MQTTItem extends Item {
        reader() { // // mqtt does not have a concept of getting a value
            const topic = this.path.join('/') + '/#';
            client.subscribe(topic); // ok? or should we subscribe to all children?
            return Promise.resolve(null);
        }
        writer(value) {
            if (!this.constructor.isPrimitive(value)) return Promise.resolve(value);
            const topic = this.path.join('/');
            return client.publish(topic, String(value));
        }
        //remove(){} // just unsubscribe?
        ChildClass = MQTTItem;
    }
    
    const root = new MQTTItem();
    return root;
    //await client.disconnect();
}
