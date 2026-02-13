import { item, Item } from '../item.js';
import { AsyncItem } from '../tools/AsyncItem.js';

const watcher = {
    socket: new WebSocket('wss://ws.blockchain.info/inv'),
    queue: [],
    subscribe(addr) {
        const msg = JSON.stringify({ op: "addr_sub", addr });
        if (this.socket.readyState === WebSocket.OPEN) {
            this.socket.send(msg);
        } else {
            this.queue.push(msg);
        }
    }
};

watcher.socket.onopen = () => {
    watcher.queue.forEach(msg => watcher.socket.send(msg));
    watcher.queue = [];
};


class BalanceItem extends AsyncItem {
    constructor(parent, key) {
        super(parent, key);
        this.asyncHandler.options.ttl = 10000;
    }
    async createGetter() {
        try {
            const response = await fetch(`https://blockchain.info/balance?active=${this.parent.key}`);
            const data = await response.json();
            return data[this.parent.key].final_balance / 100000000;
        } catch (error) {
            console.error('Error fetching Bitcoin balance:', error);
            throw error;
        }
    }    
    createSetter() { throw new Error('balance is readonly'); }
}

class WalletItem extends Item {
    constructor(parent, key) {
        super(parent, key);
        this.ChildClass = BalanceItem;
        this.item('balance');
        this.ChildClass = null;
        this.$set = () => { throw new Error('wallet is readonly'); };
        watcher.subscribe(this.key);
    }
    ChildClass = Item;
}

let root = null;
function btc() {
    if (!root) {
        root = item();
        root.item('wallet').ChildClass = WalletItem;
        watcher.socket.onmessage = (e) => {
            const data = JSON.parse(e.data);
            if (data.op === 'utx') {
                const addr = data.x.out?.[0]?.addr;
                root.item('wallet').item(addr)?.item('balance')
                    .asyncHandler.setLocal(data.x.balance / 100000000);
            }
        };
    }
    return root;
}

export function wallets() { return btc().item('wallet'); }