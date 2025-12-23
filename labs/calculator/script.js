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

class ScientificCalculator extends Calculator {
    constructor(previousOperandTextElement, currentOperandTextElement) {
        super(previousOperandTextElement, currentOperandTextElement);
    }

    computeScientific(action) {
        let current = parseFloat(this.currentOperand);
        if (isNaN(current) && action !== 'pi' && action !== 'e' && action !== 'rand') return;

        let result;
        switch (action) {
            case 'sin': result = Math.sin(current); break;
            case 'cos': result = Math.cos(current); break;
            case 'tan': result = Math.tan(current); break;
            case 'log': result = Math.log10(current); break;
            case 'ln': result = Math.log(current); break;
            case 'sqrt': result = Math.sqrt(current); break;
            case 'square': result = Math.pow(current, 2); break;
            case 'inv': result = 1 / current; break;
            case 'abs': result = Math.abs(current); break;
            case 'fact': result = this.factorial(current); break;
            case 'pi':
                this.currentOperand = Math.PI;
                this.operation = undefined;
                this.previousOperand = '';
                return;
            case 'e':
                this.currentOperand = Math.E;
                this.operation = undefined;
                this.previousOperand = '';
                return;
            case 'rand':
                this.currentOperand = Math.random();
                this.operation = undefined;
                this.previousOperand = '';
                return;
        }

        if (result !== undefined) {
            this.currentOperand = result;
            this.operation = undefined;
            this.previousOperand = '';
        }
    }

    factorial(n) {
        if (n < 0) return NaN;
        if (n === 0 || n === 1) return 1;
        let result = 1;
        for (let i = 2; i <= n; i++) result *= i;
        return result;
    }

    compute() {
        let computation;
        const prev = parseFloat(this.previousOperand);
        const current = parseFloat(this.currentOperand);
        if (isNaN(prev) || isNaN(current)) return;
        switch (this.operation) {
            case '^':
                computation = Math.pow(prev, current);
                break;
            default:
                super.compute();
                return;
        }
        this.currentOperand = computation;
        this.operation = undefined;
        this.previousOperand = '';
    }
}

// Simple Calculator Setup
const numberBtns = document.querySelectorAll('#calculator .btn.number');
const operatorBtns = document.querySelectorAll('#calculator .btn.operator');
const equalsBtn = document.querySelector('#calculator .btn.equals');
const deleteBtn = document.querySelector('#calculator [data-action="delete"]');
const clearBtn = document.querySelector('#calculator [data-action="clear"]');
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

// Scientific Calculator Setup
const sciNumberBtns = document.querySelectorAll('#scientific-calculator .btn.number');
const sciOperatorBtns = document.querySelectorAll('#scientific-calculator .btn.operator');
const sciFuncBtns = document.querySelectorAll('.btn.sci-func');
const sciEqualsBtn = document.querySelector('[data-action="sci-calculate"]');
const sciClearBtn = document.querySelector('[data-action="sci-clear"]');
const sciDeleteBtn = document.querySelector('[data-action="sci-delete"]');
const prevOperandSci = document.querySelector('.previous-operand-sci');
const currOperandSci = document.querySelector('.current-operand-sci');

const sciCalculator = new ScientificCalculator(prevOperandSci, currOperandSci);

sciNumberBtns.forEach(button => {
    button.addEventListener('click', () => {
        sciCalculator.appendNumber(button.innerText);
        sciCalculator.updateDisplay();
    });
});

sciOperatorBtns.forEach(button => {
    button.addEventListener('click', () => {
        sciCalculator.chooseOperation(button.innerText);
        sciCalculator.updateDisplay();
    });
});

sciFuncBtns.forEach(button => {
    button.addEventListener('click', () => {
        const action = button.dataset.action;
        if (action === 'pow') {
            sciCalculator.chooseOperation('^');
        } else {
            sciCalculator.computeScientific(action);
        }
        sciCalculator.updateDisplay();
    });
});

sciEqualsBtn.addEventListener('click', () => {
    sciCalculator.compute();
    sciCalculator.updateDisplay();
});

sciClearBtn.addEventListener('click', () => {
    sciCalculator.clear();
    sciCalculator.updateDisplay();
});

sciDeleteBtn.addEventListener('click', () => {
    sciCalculator.delete();
    sciCalculator.updateDisplay();
});


// Mode Switching
const modeBtns = document.querySelectorAll('.mode-btn');
const calculatorSection = document.getElementById('calculator');
const scientificSection = document.getElementById('scientific-calculator');
const currencySection = document.getElementById('currency');
const wrapper = document.querySelector('.calculator-wrapper');

modeBtns.forEach(btn => {
    btn.addEventListener('click', () => {
        // Remove active class from all buttons
        modeBtns.forEach(b => b.classList.remove('active'));
        // Add active class to clicked button
        btn.classList.add('active');

        const mode = btn.dataset.mode;

        // Hide all sections
        calculatorSection.classList.remove('active');
        scientificSection.classList.remove('active');
        currencySection.classList.remove('active');
        wrapper.classList.remove('scientific-mode');

        if (mode === 'calculator') {
            calculatorSection.classList.add('active');
        } else if (mode === 'scientific') {
            scientificSection.classList.add('active');
            wrapper.classList.add('scientific-mode');
        } else {
            currencySection.classList.add('active');
        }
    });
});

// Currency Converter Logic
const currencyOne = document.getElementById('currency-one');
const amountOne = document.getElementById('amount-one');
const currencyTwo = document.getElementById('currency-two');
const amountTwo = document.getElementById('amount-two');
const searchOne = document.getElementById('search-one');
const searchTwo = document.getElementById('search-two');
const rateEl = document.getElementById('rate');
const swap = document.getElementById('swap');
const lastUpdatedEl = document.querySelector('.last-updated');
const refreshBtn = document.getElementById('refresh-rates');

let allCurrencies = [];
let exchangeRates = {};

// Fetch all available currencies and initial rates from Coinbase
async function initCurrencyConverter() {
    try {
        refreshBtn.classList.add('loading');

        // Coinbase rates for USD base
        const response = await fetch('https://api.coinbase.com/v2/exchange-rates?currency=USD');
        const data = await response.json();

        if (data && data.data && data.data.rates) {
            exchangeRates = data.data.rates;
            allCurrencies = Object.keys(exchangeRates).sort();

            populateSelects();
            calculate();

            lastUpdatedEl.innerText = `Last updated: ${new Date().toLocaleTimeString()}`;
        }
    } catch (err) {
        console.error('Error fetching currency data:', err);
        rateEl.innerText = 'Error fetching rates';
    } finally {
        refreshBtn.classList.remove('loading');
    }
}

function populateSelects() {
    const val1 = currencyOne.value || 'USD';
    const val2 = currencyTwo.value || 'BRL';

    currencyOne.innerHTML = '';
    currencyTwo.innerHTML = '';

    allCurrencies.forEach(currency => {
        const option1 = document.createElement('option');
        option1.value = currency;
        option1.innerText = currency;
        if (currency === val1) option1.selected = true;
        currencyOne.appendChild(option1);

        const option2 = document.createElement('option');
        option2.value = currency;
        option2.innerText = currency;
        if (currency === val2) option2.selected = true;
        currencyTwo.appendChild(option2);
    });
}

function filterCurrencies(searchTerm, selectElement) {
    const term = searchTerm.toLowerCase();
    const options = selectElement.options;

    let firstVisible = null;
    for (let i = 0; i < options.length; i++) {
        const txt = options[i].text.toLowerCase();
        const display = txt.includes(term);
        options[i].style.display = display ? '' : 'none';
        if (display && !firstVisible) firstVisible = options[i];
    }

    if (firstVisible && term !== '') {
        // We don't auto-select because it would trigger a calculation prematurely
    }
}

// Fetch exchange rates and update the DOM
function calculate(direction = 'one-to-two') {
    const from = currencyOne.value;
    const to = currencyTwo.value;

    if (!exchangeRates[from] || !exchangeRates[to]) return;

    // Convert everything through USD (base)
    // from_rate = value_in_usd * rate_from
    // 1 USD = rate_from FROM
    // value_in_usd = amount_from / rate_from
    // amount_to = value_in_usd * rate_to

    const rateFrom = parseFloat(exchangeRates[from]);
    const rateTo = parseFloat(exchangeRates[to]);

    const crossRate = rateTo / rateFrom;
    rateEl.innerText = `1 ${from} = ${crossRate.toFixed(6)} ${to}`;

    if (direction === 'one-to-two') {
        const result = (parseFloat(amountOne.value) * crossRate);
        amountTwo.value = isNaN(result) ? '' : result.toFixed(parseFloat(amountOne.value) < 1 ? 6 : 2);
    } else {
        const reverseRate = rateFrom / rateTo;
        const result = (parseFloat(amountTwo.value) * reverseRate);
        amountOne.value = isNaN(result) ? '' : result.toFixed(parseFloat(amountTwo.value) < 1 ? 6 : 2);
    }
}

// Event listeners
currencyOne.addEventListener('change', () => calculate('one-to-two'));
currencyTwo.addEventListener('change', () => calculate('one-to-two'));

amountOne.addEventListener('input', () => calculate('one-to-two'));
amountTwo.addEventListener('input', () => calculate('two-to-one'));

searchOne.addEventListener('input', (e) => filterCurrencies(e.target.value, currencyOne));
searchTwo.addEventListener('input', (e) => filterCurrencies(e.target.value, currencyTwo));

refreshBtn.addEventListener('click', initCurrencyConverter);

swap.addEventListener('click', () => {
    const temp = currencyOne.value;
    currencyOne.value = currencyTwo.value;
    currencyTwo.value = temp;
    calculate('one-to-two');
});

// Initial load
initCurrencyConverter();
