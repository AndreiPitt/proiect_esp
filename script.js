document.addEventListener('DOMContentLoaded', () => {
    const allPins = document.querySelectorAll('.pin');
    const unconfiguredWindow = document.querySelector('.unconfigured-window');
    const configWindow = document.querySelector('.config-window');
    const configTitle = document.querySelector('.config-title');
    const functionDropdown = document.getElementById('function-dropdown');
    
    const dashboardList = document.querySelector('.dashboard-list');

    const gpioOptions = document.getElementById('gpio-options');
    const outputOption = document.getElementById('output-option');
    const gpioOutputButtons = document.getElementById('gpio-output-buttons');
    const inputOnlyMessage = document.getElementById('input-only-message');
    const cancelButton = document.querySelector('.cancel-button');
    const saveButton = document.querySelector('.save-button');
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
    const pinConfigurations = {}; // Obiect pentru a stoca configurarile pinilor

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
            
            const savedConfig = pinConfigurations[pinId];

            if (savedConfig) {
                // Încarcă setările salvate
                functionDropdown.value = savedConfig.function;
                
                if (savedConfig.function.includes('GPIO') || savedConfig.function.includes('IO')) {
                    document.getElementById('inputOption').checked = savedConfig.type === 'Input';
                    document.getElementById('outputOption').checked = savedConfig.type === 'Output';
                } else if (savedConfig.function.includes('PWM')) {
                    document.getElementById('inputFreq').value = savedConfig.freq;
                    document.getElementById('idRange').value = savedConfig.duty;
                    document.getElementById('inputPhase').value = savedConfig.phase;
                    document.getElementById('inputRise').value = savedConfig.rise;
                    document.getElementById('inputFall').value = savedConfig.fall;
                    document.querySelector('#idRange + output').value = savedConfig.duty + '%';
                } else if (savedConfig.function.includes('ADC')) {
                    const adcSelect = document.querySelector('.function-content-adc .function-dropdown');
                    adcSelect.value = savedConfig.sensorType;
                }
            } else {
                // Dacă nu există configurare salvată, resetează la starea inițială
                let defaultOptionValue = functions.find(func => func.includes('GPIO') || func.includes('IO'));
                if (defaultOptionValue) {
                    functionDropdown.value = defaultOptionValue;
                } else {
                    functionDropdown.selectedIndex = 0;
                }
                document.getElementById('inputOption').checked = true;
                document.getElementById('outputOption').checked = false;
                document.getElementById('inputFreq').value = '';
                document.getElementById('idRange').value = '50';
                document.getElementById('inputPhase').value = '';
                document.getElementById('inputRise').value = '';
                document.getElementById('inputFall').value = '';
                document.querySelector('#idRange + output').value = '50%';
                const adcSelect = document.querySelector('.function-content-adc .function-dropdown');
                if (adcSelect) {
                    adcSelect.selectedIndex = 0;
                }
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
        }
        configWindow.style.display = 'none';
        unconfiguredWindow.style.display = 'block';
        activePin = null;
        lastChecked = null;
    });

    saveButton.addEventListener('click', () => {
        if (!activePin) return;

        const pinId = activePin.id;
        const selectedFunction = functionDropdown.value;
        
        const configData = {
            function: selectedFunction
        };

        if (selectedFunction.includes('GPIO') || selectedFunction.includes('IO')) {
            const isInputOnly = inputOnlyPins.includes(pinId);
            const isOutput = document.getElementById('outputOption').checked;
            configData.type = isInputOnly || !isOutput ? 'Input' : 'Output';
            configData.functionName = functionDropdown.value;
        } else if (selectedFunction.includes('PWM')) {
            configData.freq = document.getElementById('inputFreq').value;
            configData.duty = document.getElementById('idRange').value;
            configData.phase = document.getElementById('inputPhase').value;
            configData.rise = document.getElementById('inputRise').value;
            configData.fall = document.getElementById('inputFall').value;
        } else if (selectedFunction.includes('ADC')) {
            const adcSelect = document.querySelector('.function-content-adc .function-dropdown');
            configData.sensorType = adcSelect.options[adcSelect.selectedIndex].text;
            configData.adcChannel = activePin.getAttribute('data-name');
        }

        pinConfigurations[pinId] = configData;

        // Creează și actualizează elementul de dashboard
        const newDashboardItem = document.createElement('li');
        newDashboardItem.classList.add('dashboard-content');
        let dashboardHTML = '';
        
        activePin.classList.remove('gpioout', 'gpioin', 'pwm', 'adc', 'neconfig');

        if (selectedFunction.includes('GPIO') || selectedFunction.includes('IO')) {
            const type = pinConfigurations[pinId].type;
            const functionName = pinConfigurations[pinId].functionName;
            activePin.classList.add(type === 'Input' ? 'gpioin' : 'gpioout');
            dashboardHTML = `
                <div class="dashboard-content-title">${functionName}</div>
                <div class="dashboard-content-box">${type}</div>
            `;
        } else if (selectedFunction.includes('PWM')) {
            const { freq, duty, phase } = pinConfigurations[pinId];
            activePin.classList.add('pwm');
            dashboardHTML = `
                <div class="dashboard-content-title">PWM - ${pinId}</div>
                <div class="dashboard-content-box">
                    <div>Freq: ${freq || 'N/A'} Hz</div>
                    <div>Duty: ${duty || 'N/A'} %</div>
                    <div>Phase: ${phase || 'N/A'} &deg;</div>
                </div>
            `;
        } else if (selectedFunction.includes('ADC')) {
            const { sensorType, adcChannel } = pinConfigurations[pinId];
            activePin.classList.add('adc');
            const adcChannelMatch = adcChannel.match(/ADC(\d)-(\d)/);
            const adcChannelText = adcChannelMatch ? `Channel: ADC${adcChannelMatch[1]} - ${adcChannelMatch[2]}` : 'N/A';
            dashboardHTML = `
                <div class="dashboard-content-title">ADC - ${pinId}</div>
                <div class="dashboard-content-box">
                    <div>${adcChannelText}</div>
                    <div>Type: ${sensorType}</div>
                    <div>Value: 0</div>
                </div>
            `;
        }

        // Verifică dacă pinul are deja un element de dashboard și-l actualizează
        const existingDashboardItem = dashboardList.querySelector(`[data-pin-id="${pinId}"]`);
        if (existingDashboardItem) {
            existingDashboardItem.innerHTML = dashboardHTML;
        } else {
            newDashboardItem.innerHTML = dashboardHTML;
            newDashboardItem.setAttribute('data-pin-id', pinId);
            dashboardList.appendChild(newDashboardItem);
        }

        activePin.classList.remove('active');
        configWindow.style.display = 'none';
        unconfiguredWindow.style.display = 'block';
        activePin = null;
        lastChecked = null;
    });

    resetButton.addEventListener('click', () => {
        allPins.forEach(pin => {
            pin.classList.remove('gpioout', 'gpioin', 'pwm', 'adc', 'active');
            pin.classList.add('neconfig');
        });
        configWindow.style.display = 'none';
        unconfiguredWindow.style.display = 'block';
        activePin = null;
        lastChecked = null;
        
        Object.keys(pinConfigurations).forEach(key => delete pinConfigurations[key]);
        dashboardList.innerHTML = '';
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
        const gpioContent = document.querySelector('.function-content-gpio');
        gpioContent.style.display = 'block';
        
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
        }
    } else if (selectedFunction.includes('PWM')) {
        document.querySelector('.function-content-pwm').style.display = 'block';
    } else if (selectedFunction.includes('ADC')) {
        document.querySelector('.function-content-adc').style.display = 'block';
    }
}