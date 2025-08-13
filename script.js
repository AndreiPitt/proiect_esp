document.addEventListener('DOMContentLoaded', () => {
    const allPins = document.querySelectorAll('.pin');
    const unconfiguredWindow = document.querySelector('.unconfigured-window');
    const configWindow = document.querySelector('.config-window');
    const configTitle = document.querySelector('.config-title');
    const functionDropdown = document.getElementById('function-dropdown');
    
    const gpioOptions = document.getElementById('gpio-options');
    const outputOption = document.getElementById('output-option');
    const gpioOutputButtons = document.getElementById('gpio-output-buttons');
    const inputOnlyMessage = document.getElementById('input-only-message');
    const cancelButton = document.querySelector('.cancel-button');
    const saveButton = document.querySelector('.save-button');
    // Adaugă variabila pentru butonul Reset
    const resetButton = document.querySelector('.reset-button');
    
    if (allPins.length === 0) {
        console.error("Nu s-au găsit elemente cu clasa '.pin'. Verifică selectorul!");
        return;
    }

    const excludedPins = ['GND', '3V3', 'RST', '5V', 'VIN', 'OD'];
    const inputOnlyPins = ['IO34', 'IO35', 'IO36', 'IO39'];
    const pwmPins = ['IO1', 'IO2', 'IO3', 'IO4', 'IO5', 'IO12', 'IO13', 'IO14', 'IO15', 'IO16', 'IO17', 'IO18', 'IO19', 'IO21', 'IO22', 'IO23', 'IO25', 'IO26', 'IO27', 'IO32', 'IO33'];

    let activePin = null;
    let lastChecked = null;

    allPins.forEach(pin => {
        const pinId = pin.id;
        
        if (excludedPins.includes(pinId)) {
            pin.addEventListener('click', () => {
                alert(`Pinul ${pinId} este un pin de alimentare sau de sistem și nu poate fi configurat ca GPIO.`);
            });
            return; 
        }

        pin.addEventListener('click', () => {
            console.log(`Pin clicked! ID: ${pinId}`);
            
            configWindow.style.display = 'block';
            unconfiguredWindow.style.display = 'none';
            configTitle.textContent = `Pin ${pinId}`;

            const pinDataName = pin.getAttribute('data-name');
            const functions = pinDataName ? pinDataName.split(' / ').map(f => f.trim()) : [];
            
            const isPwmPin = pwmPins.includes(pinId) || (pinId === 'TX0' && pwmPins.includes('IO1')) || (pinId === 'RX0' && pwmPins.includes('IO3'));

            if (isPwmPin && !functions.includes('PWM')) {
                functions.push('PWM'); 
            }

            functionDropdown.innerHTML = '';
            functions.forEach(func => {
                const option = document.createElement('option');
                option.value = func;
                option.textContent = func;
                functionDropdown.appendChild(option);
            });

            let defaultOptionValue = functions.find(func => func.includes('GPIO') || func.includes('IO'));
            if (defaultOptionValue) {
                functionDropdown.value = defaultOptionValue;
            } else {
                functionDropdown.selectedIndex = 0;
            }
            
            const isInputOnly = inputOnlyPins.includes(pinId);
            if (isInputOnly) {
                outputOption.style.display = 'none';
                gpioOutputButtons.style.display = 'none';
                inputOnlyMessage.style.display = 'block';
                document.getElementById('inputOption').checked = true;
            } else {
                outputOption.style.display = 'block';
                gpioOutputButtons.style.display = 'block';
                inputOnlyMessage.style.display = 'none';
                document.getElementById('inputOption').checked = false;
                document.getElementById('outputOption').checked = false;
            }
            
            selectFunctionPin();
            
            if (activePin) {
                activePin.classList.remove('active');
            }
            activePin = pin;
            activePin.classList.add('active');
        });
    });

    const radioButtons = document.querySelectorAll('.radio-group input[type="radio"]');

    radioButtons.forEach(radio => {
        radio.addEventListener('click', function(event) {
            if (this === lastChecked) {
                this.checked = false;
                lastChecked = null;
            } else {
                lastChecked = this;
            }
        });
    });
    
    cancelButton.addEventListener('click', () => {
        if (activePin) {
            activePin.classList.remove('active');
            activePin.classList.remove('gpioout', 'gpioin', 'pwm', 'adc');
            activePin.classList.add('neconfig');
        }
        configWindow.style.display = 'none';
        unconfiguredWindow.style.display = 'block';
        activePin = null;
        lastChecked = null;
    });

    saveButton.addEventListener('click', () => {
        if (!activePin) return;

        const selectedFunction = functionDropdown.value;

        activePin.classList.remove('gpioout', 'gpioin', 'pwm', 'adc', 'neconfig');

        if (selectedFunction.includes('GPIO') || selectedFunction.includes('IO')) {
            const isOutput = document.getElementById('outputOption').checked;
            if (isOutput) {
                activePin.classList.add('gpioout');
            } else {
                activePin.classList.add('gpioin');
            }
        } else if (selectedFunction.includes('PWM')) {
            activePin.classList.add('pwm');
        } else if (selectedFunction.includes('ADC')) {
            activePin.classList.add('adc');
        }

        activePin.classList.remove('active');
        configWindow.style.display = 'none';
        unconfiguredWindow.style.display = 'block';
        activePin = null;
        lastChecked = null;
    });

    // Functie pentru butonul Reset
    resetButton.addEventListener('click', () => {
        allPins.forEach(pin => {
            pin.classList.remove('gpioout', 'gpioin', 'pwm', 'adc', 'active');
            pin.classList.add('neconfig');
        });
        configWindow.style.display = 'none';
        unconfiguredWindow.style.display = 'block';
        activePin = null;
        lastChecked = null;
    });
});


function selectFunctionPin() {
    let functionSelect = document.getElementById('function-dropdown');
    let selectedFunction = functionSelect.value;
    let functionContents = document.querySelectorAll('.function-content-gpio, .function-content-pwm, .function-content-adc');
    
    const outputOption = document.getElementById('output-option');
    const gpioOutputButtons = document.getElementById('gpio-output-buttons');
    const inputOnlyMessage = document.getElementById('input-only-message');
    const inputOptionRadio = document.getElementById('inputOption');

    const inputOnlyPins = ['IO34', 'IO35', 'IO36', 'IO39'];
    const activePin = document.querySelector('.pin.active');
    const pinId = activePin ? activePin.id : null;

    functionContents.forEach(function(content) {
        content.style.display = 'none';
    });
    
    if (selectedFunction.includes('GPIO') || selectedFunction.includes('IO')) {
        document.querySelector('.function-content-gpio').style.display = 'block';
        
        const isInputOnly = inputOnlyPins.includes(pinId);

        if (isInputOnly) {
            outputOption.style.display = 'none';
            gpioOutputButtons.style.display = 'none';
            inputOnlyMessage.style.display = 'block';
            inputOptionRadio.checked = true;
        } else {
            outputOption.style.display = 'block';
            gpioOutputButtons.style.display = 'block';
            inputOnlyMessage.style.display = 'none';
            document.getElementById('inputOption').checked = false;
            document.getElementById('outputOption').checked = false;
        }

    } else if (selectedFunction.includes('PWM')) {
        document.querySelector('.function-content-pwm').style.display = 'block';
    } else if (selectedFunction.includes('ADC')) {
        document.querySelector('.function-content-adc').style.display = 'block';
    }
}