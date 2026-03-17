import {item} from '../item.js';

// TODO? Would it be better as a tool like "syncWithBroadcastChannel"?
// i = item()
// syncWithBroadcastChannel(i, {channelName: 'my-channel'})
// i.item('a').value = 1 // will be broadcasted to other tabs

// BroadcastChannel
export function broadcastChannelItem({channelName='item.js-default channel',init=null}={}) {

    const channel = new BroadcastChannel(channelName);
    const root = item();

    let byMe = false;

    root.addEventListener('changeIn', e => {
        if (byMe) return;
        const {target, add, remove, value} = e;
        byMe = true;
        channel.postMessage({path: target.path, add: add?.key, remove: remove?.key, value});
        byMe = false;
    });

    channel.postMessage({getInitial: true});
    setTimeout(async () => { // now wait for the response and if it doesn't come, set the initial value
        if (init && root.value == null) {
            const value = await init(); // request initial value
            if (root.value == null) root.value = value; // if it's still null, set it
        }
    }, 1000);

    channel.onmessage = ({data}) => {
        if (data.getInitial) channel.postMessage({setInitial: root.value});
        if (data.setInitial) root.value = data.setInitial;

        if (data.add != null) return root.sub(data.path).item(data.add);
        if (data.remove != null) return root.has(data.path)?.remove(data.remove);
        if (data.value !== undefined) return root.sub(data.path).value = data.value;
    };
    return root;
}
