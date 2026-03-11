var redOn = 0;

NRF.setServices({
    0xBCDE: {
        0xABCD: {
            writable: true,
            readable: true,
            notify: true,
            onWrite: function (evt) {
                redOn = evt.data[0];
                digitalWrite(LED1, redOn);
            }
        }
    }
}, { advertise: ['BCDE'] });


setWatch(function(state) {

    redOn = redOn ? 0 : 1;
    digitalWrite(LED1, redOn);

    NRF.updateServices({
        0xBCDE: {
            0xABCD: {
                value: redOn,
                notify: true
            }
        }
    });
}, BTN, { edge: 'rising', repeat: true });