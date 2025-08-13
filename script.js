document.addEventListener('DOMContentLoaded', () => {
  const allPins = document.querySelectorAll('.pin');
  const unconfiguredWindow = document.querySelector('.unconfigured-window');
  const configWindow = document.querySelector('.config-window');
  const configTitle = document.querySelector('.config-title');

  if (allPins.length === 0) {
    console.error("Nu s-au găsit elemente cu clasa '.pin'. Verifică selectorul!");
    return;
  }

  const excludedPins = ['GND', '3.3V', 'RESET', '5V'];

  allPins.forEach(pin => {
    const pinName = pin.getAttribute('data-name');
    
    if (excludedPins.includes(pinName)) {
      return; 
    }

    // Pentru toți ceilalți pini, se adaugă event listener-ul normal
    pin.addEventListener('click', () => {
      console.log(`Pin clicked! ID: ${pin.id}`);
     // alert(`Pinul ${pinName} nu poate fi configurat!`);

      configWindow.style.display = 'block';
      unconfiguredWindow.style.display = 'none';

      configTitle.textContent = `Pin ${pin.id.replace('pin_', '')} - ${pinName}`;

      document.querySelectorAll('.pin.active').forEach(p => p.classList.remove('active'));
      pin.classList.add('active');
    });
  });
});






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
