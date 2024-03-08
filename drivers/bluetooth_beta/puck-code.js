NRF.setServices({
    0xBCDE: {
        0xABCD: {
            writable: true,
            readable: true,
            notify: true,
            onWrite: function (evt) {
                digitalWrite([LED3, LED2, LED1], evt.data[0]);
            }
        }
    }
}, { advertise: ['BCDE'] });


function flash() {
    digitalWrite(LED3, 1);
    setTimeout(function () {
        digitalWrite(LED3, 0);
    }, 200);
}

setInterval(function () {
    if (digitalRead(BTN)) {

        flash();

        NRF.updateServices({
            0xBCDE: {
                0xABCD: {
                    value: 0,
                    notify: true
                }
            }
        });
        digitalWrite([LED3, LED2, LED1], 0);

    }
}, 500);
