function selectFunctionPin() {
    let functionSelect = document.getElementById('function-dropdown');
    let selectedFunction = functionSelect.value;
    let functionContents = document.querySelectorAll('.function-content-gpio, .function-content-pwm, .function-content-adc');
    
    functionContents.forEach(function(content) {
        content.style.display = 'none';
    });
    
    if (selectedFunction === 'GPIO') {
        document.querySelector('.function-content-gpio').style.display = 'block';
    } else if (selectedFunction === 'PWM') {
        document.querySelector('.function-content-pwm').style.display = 'block';
    } else if (selectedFunction === 'ADC') {
        document.querySelector('.function-content-adc').style.display = 'block';
    }
}
