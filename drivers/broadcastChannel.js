import {item} from '../item.js';

// BroadcastChannel
export function broadcastChannelItem(channelName, {init=null}={}) {

    const channel = new BroadcastChannel(channelName);
    const root = item();

    root.addEventListener('setIn', e => {
        const {item, newValue} = e.detail;
        channel.postMessage({path: item.pathKeys, newValue});
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
        if (data.path) {
            const {path, newValue} = data;
            root.walkPathKeys(path).value = newValue;
        }
    };
    return root;
}