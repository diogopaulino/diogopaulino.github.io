class Calculator {
    constructor(previousOperandTextElement, currentOperandTextElement) {
        this.previousOperandTextElement = previousOperandTextElement;
        this.currentOperandTextElement = currentOperandTextElement;
        this.clear();
    }

    clear() {
        this.currentOperand = '0';
        this.previousOperand = '';
        this.operation = undefined;
    }

    delete() {
        if (this.currentOperand === '0') return;
        this.currentOperand = this.currentOperand.toString().slice(0, -1);
        if (this.currentOperand === '') this.currentOperand = '0';
    }

    appendNumber(number) {
        if (number === '.' && this.currentOperand.includes('.')) return;
        if (this.currentOperand === '0' && number !== '.') {
            this.currentOperand = number.toString();
        } else {
            this.currentOperand = this.currentOperand.toString() + number.toString();
        }
    }

    chooseOperation(operation) {
        if (this.currentOperand === '') return;
        if (this.previousOperand !== '') {
            this.compute();
        }
        this.operation = operation;
        this.previousOperand = this.currentOperand;
        this.currentOperand = '';
    }

    compute() {
        let computation;
        const prev = parseFloat(this.previousOperand);
        const current = parseFloat(this.currentOperand);
        if (isNaN(prev) || isNaN(current)) return;
        switch (this.operation) {
            case '+':
                computation = prev + current;
                break;
            case '-':
                computation = prev - current;
                break;
            case '×':
                computation = prev * current;
                break;
            case '÷':
                computation = prev / current;
                break;
            case '%':
                computation = prev % current;
                break;
            default:
                return;
        }
        this.currentOperand = computation;
        this.operation = undefined;
        this.previousOperand = '';
    }

    getDisplayNumber(number) {
        const stringNumber = number.toString();
        const integerDigits = parseFloat(stringNumber.split('.')[0]);
        const decimalDigits = stringNumber.split('.')[1];
        let integerDisplay;
        if (isNaN(integerDigits)) {
            integerDisplay = '';
        } else {
            integerDisplay = integerDigits.toLocaleString('en', { maximumFractionDigits: 0 });
        }
        if (decimalDigits != null) {
            return `${integerDisplay}.${decimalDigits}`;
        } else {
            return integerDisplay;
        }
    }

    updateDisplay() {
        this.currentOperandTextElement.innerText = this.getDisplayNumber(this.currentOperand);
        if (this.operation != null) {
            this.previousOperandTextElement.innerText =
                `${this.getDisplayNumber(this.previousOperand)} ${this.operation}`;
        } else {
            this.previousOperandTextElement.innerText = '';
        }
    }
}

// Calculator Setup
const numberButtons = document.querySelectorAll('[data-number]'); // Note: I used class .number in HTML, need to select by class or add data attribute
const operationButtons = document.querySelectorAll('[data-operation]'); // Same here

// Let's use the classes from HTML
const numberBtns = document.querySelectorAll('.btn.number');
const operatorBtns = document.querySelectorAll('.btn.operator');
const equalsBtn = document.querySelector('.btn.equals');
const deleteBtn = document.querySelector('[data-action="delete"]');
const clearBtn = document.querySelector('[data-action="clear"]');
const previousOperandTextElement = document.querySelector('.previous-operand');
const currentOperandTextElement = document.querySelector('.current-operand');

const calculator = new Calculator(previousOperandTextElement, currentOperandTextElement);

numberBtns.forEach(button => {
    button.addEventListener('click', () => {
        calculator.appendNumber(button.innerText);
        calculator.updateDisplay();
    });
});

operatorBtns.forEach(button => {
    button.addEventListener('click', () => {
        calculator.chooseOperation(button.innerText);
        calculator.updateDisplay();
    });
});

equalsBtn.addEventListener('click', button => {
    calculator.compute();
    calculator.updateDisplay();
});

clearBtn.addEventListener('click', button => {
    calculator.clear();
    calculator.updateDisplay();
});

deleteBtn.addEventListener('click', button => {
    calculator.delete();
    calculator.updateDisplay();
});

// Mode Switching
const modeBtns = document.querySelectorAll('.mode-btn');
const calculatorSection = document.getElementById('calculator');
const currencySection = document.getElementById('currency');

modeBtns.forEach(btn => {
    btn.addEventListener('click', () => {
        // Remove active class from all buttons
        modeBtns.forEach(b => b.classList.remove('active'));
        // Add active class to clicked button
        btn.classList.add('active');

        const mode = btn.dataset.mode;
        if (mode === 'calculator') {
            calculatorSection.classList.add('active');
            currencySection.classList.remove('active');
        } else {
            calculatorSection.classList.remove('active');
            currencySection.classList.add('active');
        }
    });
});

// Currency Converter Logic
const currencyOne = document.getElementById('currency-one');
const amountOne = document.getElementById('amount-one');
const currencyTwo = document.getElementById('currency-two');
const amountTwo = document.getElementById('amount-two');
const rateEl = document.getElementById('rate');
const swap = document.getElementById('swap');
const lastUpdatedEl = document.querySelector('.last-updated');

// Fetch exchange rates and update the DOM
function calculate() {
    const currency_one = currencyOne.value;
    const currency_two = currencyTwo.value;

    fetch(`https://open.er-api.com/v6/latest/${currency_one}`)
        .then(res => res.json())
        .then(data => {
            const rate = data.rates[currency_two];
            rateEl.innerText = `1 ${currency_one} = ${rate.toFixed(4)} ${currency_two}`;
            amountTwo.value = (amountOne.value * rate).toFixed(2);

            // Update last updated time
            const date = new Date(data.time_last_update_utc);
            lastUpdatedEl.innerText = `Last updated: ${date.toLocaleTimeString()}`;
        })
        .catch(err => {
            console.error('Error fetching currency data:', err);
            rateEl.innerText = 'Error fetching rates';
        });
}

// Event listeners
currencyOne.addEventListener('change', calculate);
amountOne.addEventListener('input', calculate);
currencyTwo.addEventListener('change', calculate);
amountTwo.addEventListener('input', calculate);

swap.addEventListener('click', () => {
    const temp = currencyOne.value;
    currencyOne.value = currencyTwo.value;
    currencyTwo.value = temp;
    calculate();
});

// Initial calculation
calculate();
