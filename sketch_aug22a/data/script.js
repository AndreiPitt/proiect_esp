document.addEventListener('DOMContentLoaded', () => {
    let websocket;
    let activePin = null;
    const pinConfigurations = {};

    const excludedPins = ['GND', '3V3', 'RST', '5V', 'VIN', 'OD'];
    const inputOnlyPins = ['IO34', 'IO35', 'IO36', 'IO39'];
    const pwmPins = ['IO1', 'IO2', 'IO3', 'IO4', 'IO5', 'IO12', 'IO13', 'IO14', 'IO15', 'IO16', 'IO17', 'IO18', 'IO19', 'IO21', 'IO22', 'IO23', 'IO25', 'IO26', 'IO27', 'IO32', 'IO33'];

    const allPins = document.querySelectorAll('.pin');
    const unconfiguredWindow = document.querySelector('.unconfigured-window');
    const configWindow = document.querySelector('.config-window');
    const configTitle = document.querySelector('.config-title');
    const functionDropdown = document.getElementById('function-dropdown');
    const dashboardList = document.querySelector('.dashboard-list');
    const outputOption = document.getElementById('output-option');
    const gpioOutputButtons = document.getElementById('gpio-output-buttons');
    const setHighButton = document.querySelector('.gpio-button-high');
    const setLowButton = document.querySelector('.gpio-button-low');
    const inputOnlyMessage = document.getElementById('input-only-message');
    const cancelButton = document.querySelector('.cancel-button');
    const saveButton = document.querySelector('.save-button');
    const resetButton = document.querySelector('.reset-button');
    const inputOptionRadio = document.getElementById('inputOption');
    const dutyRange = document.getElementById('idRange');
    const dutyOutput = document.getElementById('dutyOutput');

    if (allPins.length === 0) {
        console.error("No elements with class '.pin' were found. Check the selector!");
        return;
    }

    function initWebSocket() {
        console.log('Trying to open a WebSocket connection...');
        const gateway = `ws://192.168.4.1/ws`;
        websocket = new WebSocket(gateway);
        websocket.onopen = onOpen;
        websocket.onclose = onClose;
        websocket.onmessage = onMessage;
        websocket.onerror = onError;
    }

    function onOpen(event) {
        console.log('WebSocket connection opened successfully.');
    }

    function onClose(event) {
        console.log('WebSocket connection closed. Reconnecting...');
        // setTimeout(initWebSocket, 2000);
    }

    function onMessage(event) {
        try {
            const response = JSON.parse(event.data);
            console.log("Received data from ESP32:", response);
            if (response.command === "updateValue") {
                const pinStateElement = document.getElementById(`pinState-${response.pinId}`);
                if (pinStateElement) {
                    pinStateElement.textContent = `Stare: ${response.value === 1 ? 'HIGH' : 'LOW'}`;
                }
            }
        } catch (e) {
            console.error("Failed to parse JSON from ESP32:", event.data, e);
        }
    }

    function onError(event) {
        console.error('WebSocket Error:', event);
    }

    function sendPinConfiguration(pinId, config) {
        const command = {
            command: "configurePin",
            pinId: pinId,
            ...config
        };
        if (websocket && websocket.readyState === WebSocket.OPEN) {
            websocket.send(JSON.stringify(command));
            console.log("Sent configuration to ESP32:", command);
        } else {
            console.warn("WebSocket not connected. Configuration not sent.");
        }
    }

    function sendPinStateCommand(pinId, state) {
        const command = {
            command: "setPinState",
            pinId: pinId,
            value: state
        };
        if (websocket && websocket.readyState === WebSocket.OPEN) {
            websocket.send(JSON.stringify(command));
            console.log(`Sent command for ${pinId} to state ${state}`);
        } else {
            console.warn("WebSocket not connected. State command not sent.");
        }
    }

    function selectFunctionPin() {
        const selectedFunction = functionDropdown.value;
        const functionContents = document.querySelectorAll('.function-content-gpio, .function-content-pwm, .function-content-adc');
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

    initWebSocket();

    setHighButton.addEventListener('click', () => {
        if (activePin) {
            const pinId = activePin.id;
            const configData = pinConfigurations[pinId];

            if (configData && configData.type === 'Output') {
                sendPinStateCommand(pinId, 1);
                const pinStateElement = document.getElementById(`pinState-${pinId}`);
                if (pinStateElement) {
                    pinStateElement.textContent = "Stare: HIGH";
                }
            } else {
                console.warn("Pin is not configured as Output.");
            }
        }
    });

    setLowButton.addEventListener('click', () => {
        if (activePin) {
            const pinId = activePin.id;
            const configData = pinConfigurations[pinId];

            if (configData && configData.type === 'Output') {
                sendPinStateCommand(pinId, 0);
                const pinStateElement = document.getElementById(`pinState-${pinId}`);
                if (pinStateElement) {
                    pinStateElement.textContent = "Stare: LOW";
                }
            } else {
                console.warn("Pin is not configured as Output.");
            }
        }
    });

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
            let functions = pinDataName ? pinDataName.split(' / ').map(f => f.trim()) : [];

            if (!functions.some(f => f.includes('GPIO') || f.includes('IO'))) {
                functions.unshift('GPIO');
            }

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
                functionDropdown.value = savedConfig.function;
                if (savedConfig.function.includes('GPIO') || savedConfig.function.includes('IO')) {
                    document.getElementById('inputOption').checked = savedConfig.type === 'Input';
                    document.getElementById('outputOption').checked = savedConfig.type === 'Output';
                }
            } else {
                let defaultOptionValue = functions.find(func => func.includes('GPIO') || func.includes('IO'));
                if (defaultOptionValue) {
                    functionDropdown.value = defaultOptionValue;
                } else {
                    functionDropdown.selectedIndex = 0;
                }
                document.getElementById('inputOption').checked = true;
            }
            selectFunctionPin();

            if (activePin) {
                activePin.classList.remove('active');
            }
            activePin = pin;
            activePin.classList.add('active');
        });
    });

    cancelButton.addEventListener('click', () => {
        if (activePin) {
            activePin.classList.remove('active');
        }
        configWindow.style.display = 'none';
        unconfiguredWindow.style.display = 'block';
        activePin = null;
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
            if (configData.type === 'Output') {
                configData.value = 0;
            }
        } else if (selectedFunction.includes('PWM')) {
            configData.freq = parseInt(document.getElementById('inputFreq').value, 10) || 1000;
            configData.duty = parseInt(document.getElementById('idRange').value, 10) || 50;
            configData.phase = parseInt(document.getElementById('inputPhase').value, 10) || 0;
        } else if (selectedFunction.includes('ADC')) {
            const adcSelect = document.querySelector('.function-content-adc .function-dropdown');
            configData.sensorType = adcSelect.options[adcSelect.selectedIndex].text;
            
            const pinDataName = activePin.getAttribute('data-name');
            const adcChannelMatch = pinDataName.match(/ADC(\d+(?:-\d+)?)/);
            configData.adcChannel = adcChannelMatch ? 'ADC' + adcChannelMatch[1] : 'N/A';
        }

        pinConfigurations[pinId] = configData;
        sendPinConfiguration(pinId, configData);

        activePin.classList.remove('gpioout', 'gpioin', 'pwm', 'adc', 'neconfig');
        let dashboardHTML = '';
        let dashboardClass = '';

        if (selectedFunction.includes('GPIO') || selectedFunction.includes('IO')) {
            activePin.classList.add(configData.type === 'Input' ? 'gpioin' : 'gpioout');
            dashboardClass = configData.type === 'Input' ? 'input' : 'output';
            dashboardHTML = `
                <div class="dashboard-content-title">${pinId} - ${configData.functionName}</div>
                <div class="dashboard-content-box">
                    <div>Tip: ${configData.type}</div>
                    <div id="pinState-${pinId}">Stare: ${configData.type === 'Output' ? 'LOW' : 'N/A'}</div>
                </div>
            `;
        } else if (selectedFunction.includes('PWM')) {
            activePin.classList.add('pwm');
            dashboardClass = 'pwm';
            const { freq, duty, phase } = configData;
            dashboardHTML = `
                <div class="dashboard-content-title">PWM - ${pinId}</div>
                <div class="dashboard-content-box">
                    <div>Freq: ${freq || 'N/A'} Hz</div>
                    <div>Duty: ${duty || 'N/A'} %</div>
                    <div>Phase: ${phase || 'N/A'}°</div>
                </div>
            `;
        } else if (selectedFunction.includes('ADC')) {
            activePin.classList.add('adc');
            dashboardClass = 'adc';
            const { sensorType, adcChannel } = configData;
            dashboardHTML = `
                <div class="dashboard-content-title">ADC - ${pinId}</div>
                <div class="dashboard-content-box">
                    <div>Channel: ${adcChannel || 'N/A'}</div>
                    <div>Type: ${sensorType}</div>
                    <div id="adcValue-${pinId}">Valoare: 0</div>
                </div>
            `;
        }

        const existingDashboardItem = dashboardList.querySelector(`[data-pin-id="${pinId}"]`);
        if (existingDashboardItem) {
            existingDashboardItem.querySelector('.dashboard-content').innerHTML = dashboardHTML;
            existingDashboardItem.className = 'dashboard-item ' + dashboardClass;
        } else {
            const newDashboardItem = document.createElement('li');
            newDashboardItem.classList.add('dashboard-item', dashboardClass);
            newDashboardItem.setAttribute('data-pin-id', pinId);

            const newDashboardContent = document.createElement('div');
            newDashboardContent.classList.add('dashboard-content');
            newDashboardContent.innerHTML = dashboardHTML;

            newDashboardItem.appendChild(newDashboardContent);
            dashboardList.appendChild(newDashboardItem);
        }

        activePin.classList.remove('active');
        configWindow.style.display = 'none';
        unconfiguredWindow.style.display = 'block';
        activePin = null;
    });

    resetButton.addEventListener('click', () => {
        if (websocket && websocket.readyState === WebSocket.OPEN) {
            websocket.send(JSON.stringify({
                command: "resetPins"
            }));
            console.log("Sent reset command to ESP32.");
        } else {
            console.warn("WebSocket not connected. Reset command not sent.");
        }

        allPins.forEach(pin => {
            pin.classList.remove('gpioout', 'gpioin', 'pwm', 'adc', 'active');
            pin.classList.add('neconfig');
        });
        configWindow.style.display = 'none';
        unconfiguredWindow.style.display = 'block';
        activePin = null;

        Object.keys(pinConfigurations).forEach(key => delete pinConfigurations[key]);
        dashboardList.innerHTML = '';
    });

    functionDropdown.addEventListener('change', selectFunctionPin);

    if (dutyRange && dutyOutput) {
        dutyRange.addEventListener('input', () => {
            dutyOutput.textContent = dutyRange.value + '%';
        });
    }
});