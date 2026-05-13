/*
 * app.js - logic for the personal expense tracker.
 *
 * This script manages the list of transactions, calculates the running
 * balance, updates the HTML table, and renders charts for both the
 * balance over time and spending by category. Data is stored in
 * localStorage so that it persists across page reloads.
 */

(function () {
    // Default categories. These are used on first load and can be extended
    // by the user. Categories are inspired by common household budget
    // categories such as utilities (electricity, water, gas, internet
    // and phone), food and transportation.
    const DEFAULT_CATEGORIES = [
        'Groceries',
        'Hangout/Entertainment',
        'Commute/Transportation',
        'Electricity Bill',
        'Water Bill',
        'Gas Bill',
        'Internet Bill',
        'Phone Bill',
        'Housing/Rent',
        'Insurance',
        'Medical/Healthcare',
        'Savings',
        'Miscellaneous',
    ];

    // The categories array used by the app. It is initialized from localStorage
    // so that user‑added categories persist across sessions. If there are
    // no saved categories, we fall back to DEFAULT_CATEGORIES.
    let categories = [];

    // Get DOM elements
    const categorySelect = document.getElementById('category');
    const addCategoryBtn = document.getElementById('add-category-btn');
    const transactionForm = document.getElementById('transaction-form');
    const balanceValue = document.getElementById('balance-value');
    const transactionsTableBody = document.querySelector('#transactions-table tbody');
    const exportButton = document.getElementById('export-btn');
    const importFileInput = document.getElementById('import-file');
    const balanceChartCanvas = document.getElementById('balance-chart');
    const categoryChartCanvas = document.getElementById('category-chart');

    // Chart instances
    let balanceChart = null;
    let categoryChart = null;

    /**
     * Generate a palette of distinct colors for the pie chart slices. Uses
     * the HSL color space to ensure even spacing around the color wheel.
     *
     * @param {number} count - number of colors to generate
     * @returns {string[]} array of CSS color strings
     */
    function generateColors(count) {
        const colors = [];
        for (let i = 0; i < count; i++) {
            const hue = Math.floor((360 / Math.max(count, 1)) * i);
            colors.push(`hsl(${hue}, 70%, 60%)`);
        }
        return colors;
    }

    /**
     * Read transactions from localStorage. If none exist, return an empty
     * array.
     * @returns {Array<Object>}
     */
    function getTransactions() {
        const data = localStorage.getItem('transactions');
        if (!data) return [];
        try {
            return JSON.parse(data);
        } catch (e) {
            console.error('Failed to parse transactions from localStorage', e);
            return [];
        }
    }

    /**
     * Save the provided transactions to localStorage.
     * @param {Array<Object>} transactions
     */
    function saveTransactions(transactions) {
        localStorage.setItem('transactions', JSON.stringify(transactions));
    }

    /**
     * Load categories from localStorage. Returns an array of strings.
     * If no categories are stored, returns a copy of DEFAULT_CATEGORIES.
     * @returns {Array<string>}
     */
    function loadCategories() {
        const data = localStorage.getItem('categories');
        if (!data) return [...DEFAULT_CATEGORIES];
        try {
            const parsed = JSON.parse(data);
            if (Array.isArray(parsed) && parsed.every((c) => typeof c === 'string')) {
                return parsed;
            }
        } catch (e) {
            console.warn('Failed to parse categories from localStorage', e);
        }
        return [...DEFAULT_CATEGORIES];
    }

    /**
     * Save categories to localStorage.
     * @param {Array<string>} cats
     */
    function saveCategories(cats) {
        localStorage.setItem('categories', JSON.stringify(cats));
    }

    /**
     * Populate the category <select> with the categories array.
     */
    function populateCategories() {
        categorySelect.innerHTML = '';
        categories.forEach((cat) => {
            const option = document.createElement('option');
            option.value = cat;
            option.textContent = cat;
            categorySelect.appendChild(option);
        });
    }

    /**
     * Calculate the current balance (sum of all income minus expenses).
     * @param {Array<Object>} transactions
     * @returns {number}
     */
    function calculateBalance(transactions) {
        return transactions.reduce((sum, txn) => {
            const amt = parseFloat(txn.amount);
            if (txn.type === 'income') {
                return sum + amt;
            } else {
                return sum - amt;
            }
        }, 0);
    }

    /**
     * Format a number as currency. Uses the browser's locale for display.
     * @param {number} value
     * @returns {string}
     */
    function formatCurrency(value) {
        // Format a number as Japanese yen. Yen does not use fractional digits.
        return new Intl.NumberFormat(undefined, {
            style: 'currency',
            currency: 'JPY',
            minimumFractionDigits: 0,
            maximumFractionDigits: 0,
        }).format(value);
    }

    /**
     * Update the balance display in the DOM.
     * @param {Array<Object>} transactions
     */
    function updateBalanceDisplay(transactions) {
        const balance = calculateBalance(transactions);
        balanceValue.textContent = formatCurrency(balance);
    }

    /**
     * Render the list of transactions into the table body.
     * @param {Array<Object>} transactions
     */
    function updateTransactionsTable(transactions) {
        transactionsTableBody.innerHTML = '';
        const sorted = [...transactions].sort(
            (a, b) => new Date(a.date) - new Date(b.date)
        );
        sorted.forEach((txn, index) => {
            const row = document.createElement('tr');
            // Date cell
            const dateCell = document.createElement('td');
            dateCell.textContent = txn.date;
            row.appendChild(dateCell);
            // Type cell
            const typeCell = document.createElement('td');
            typeCell.textContent = txn.type;
            row.appendChild(typeCell);
            // Category cell
            const catCell = document.createElement('td');
            catCell.textContent = txn.category;
            row.appendChild(catCell);
            // Amount cell
            const amtCell = document.createElement('td');
            amtCell.textContent = formatCurrency(parseFloat(txn.amount));
            row.appendChild(amtCell);
            // Description cell
            const descCell = document.createElement('td');
            descCell.textContent = txn.description || '';
            row.appendChild(descCell);
            // Receipt cell
            const receiptCell = document.createElement('td');
            if (txn.receipt) {
                const img = document.createElement('img');
                img.src = txn.receipt;
                img.alt = 'Receipt';
                receiptCell.appendChild(img);
            } else {
                receiptCell.textContent = '-';
            }
            row.appendChild(receiptCell);
            // Action cell with delete button
            const actionCell = document.createElement('td');
            const delBtn = document.createElement('button');
            delBtn.textContent = 'Delete';
            delBtn.classList.add('delete-btn');
            delBtn.addEventListener('click', () => {
                deleteTransaction(index);
            });
            actionCell.appendChild(delBtn);
            row.appendChild(actionCell);
            transactionsTableBody.appendChild(row);
        });
    }

    /**
     * Render charts for balance over time and category breakdown.
     * @param {Array<Object>} transactions
     */
    function updateCharts(transactions) {
        // Prepare data for the balance chart: cumulative balance by date
        const sorted = [...transactions].sort(
            (a, b) => new Date(a.date) - new Date(b.date)
        );
        const labels = [];
        const data = [];
        let runningBalance = 0;
        sorted.forEach((txn) => {
            const amt = parseFloat(txn.amount);
            if (txn.type === 'income') {
                runningBalance += amt;
            } else {
                runningBalance -= amt;
            }
            labels.push(txn.date);
            data.push(runningBalance);
        });
        if (balanceChart) {
            balanceChart.destroy();
        }
        balanceChart = new Chart(balanceChartCanvas.getContext('2d'), {
            type: 'line',
            data: {
                labels: labels,
                datasets: [
                    {
                        label: 'Balance over Time',
                        data: data,
                        fill: false,
                        borderColor: '#007aff',
                        tension: 0.1,
                    },
                ],
            },
            options: {
                responsive: true,
                maintainAspectRatio: false,
                scales: {
                    x: {
                        title: {
                            display: true,
                            text: 'Date',
                        },
                    },
                    y: {
                        title: {
                            display: true,
                            text: 'Balance',
                        },
                    },
                },
            },
        });
        // Prepare data for category chart: sum of expenses by category
        const categorySums = {};
        transactions.forEach((txn) => {
            if (txn.type === 'expense') {
                const key = txn.category;
                const amt = parseFloat(txn.amount);
                categorySums[key] = (categorySums[key] || 0) + amt;
            }
        });
        const catLabels = Object.keys(categorySums);
        const catData = catLabels.map((k) => categorySums[k]);
        const total = catData.reduce((sum, v) => sum + v, 0);
        const catLabelsWithPercent = catLabels.map((label, idx) => {
            const value = catData[idx];
            const pct = total > 0 ? ((value / total) * 100).toFixed(1) : '0.0';
            return `${label} (${pct}%\u00A0)`;
        });
        const catColors = generateColors(catLabels.length);
        if (categoryChart) {
            categoryChart.destroy();
        }
        categoryChart = new Chart(categoryChartCanvas.getContext('2d'), {
            type: 'pie',
            data: {
                labels: catLabelsWithPercent,
                datasets: [
                    {
                        label: 'Expenses by Category',
                        data: catData,
                        backgroundColor: catColors,
                    },
                ],
            },
            options: {
                responsive: true,
                maintainAspectRatio: false,
                plugins: {
                    legend: {
                        position: 'bottom',
                    },
                    tooltip: {
                        callbacks: {
                            label: function (context) {
                                const val = context.parsed;
                                const pct = total > 0 ? ((val / total) * 100).toFixed(1) : '0.0';
                                const label = context.label.replace(/\s\(.*\)/, '');
                                return `${label}: ${formatCurrency(val)} (${pct}%)`;
                            },
                        },
                    },
                },
            },
        });
    }

    /**
     * Add a new transaction based on the form inputs.
     * Handles reading the receipt file asynchronously if provided.
     * @param {Event} event
     */
    function handleAddTransaction(event) {
        event.preventDefault();
        const date = document.getElementById('date').value;
        const type = document.getElementById('type').value;
        const category = document.getElementById('category').value;
        const amount = document.getElementById('amount').value;
        const description = document.getElementById('description').value;
        const receiptInput = document.getElementById('receipt');
        const file = receiptInput.files[0];
        if (!date || !amount) {
            alert('Please provide both a date and amount.');
            return;
        }
        const newTransaction = {
            date,
            type,
            category,
            amount,
            description,
            receipt: null,
        };
        const finalize = () => {
            const transactions = getTransactions();
            transactions.push(newTransaction);
            saveTransactions(transactions);
            updateUI();
            transactionForm.reset();
        };
        if (file) {
            const reader = new FileReader();
            reader.onload = function (e) {
                newTransaction.receipt = e.target.result;
                finalize();
            };
            reader.readAsDataURL(file);
        } else {
            finalize();
        }
    }

    /**
     * Handle the "Add Category" button click. Prompts the user for a
     * new category name and updates the categories list if valid.
     */
    function handleAddCategory() {
        const name = prompt('Enter a new category name:');
        if (!name) {
            return;
        }
        const trimmed = name.trim();
        if (!trimmed) return;
        const exists = categories.some(
            (cat) => cat.toLowerCase() === trimmed.toLowerCase()
        );
        if (exists) {
            alert('This category already exists.');
            return;
        }
        categories.push(trimmed);
        saveCategories(categories);
        populateCategories();
        categorySelect.value = trimmed;
    }

    /**
     * Delete a transaction at the given index and update the UI.
     * @param {number} index
     */
    function deleteTransaction(index) {
        const transactions = getTransactions();
        const sorted = [...transactions].sort(
            (a, b) => new Date(a.date) - new Date(b.date)
        );
        const txnToRemove = sorted[index];
        const idx = transactions.findIndex(
            (t) =>
                t.date === txnToRemove.date &&
                t.amount === txnToRemove.amount &&
                t.type === txnToRemove.type &&
                t.category === txnToRemove.category &&
                t.description === txnToRemove.description
        );
        if (idx !== -1) {
            transactions.splice(idx, 1);
            saveTransactions(transactions);
            updateUI();
        }
    }

    /**
     * Export the transactions to a JSON file and trigger a download.
     */
    function handleExport() {
        const transactions = getTransactions();
        const dataStr = JSON.stringify(transactions, null, 2);
        const blob = new Blob([dataStr], { type: 'application/json' });
        const url = URL.createObjectURL(blob);
        const a = document.createElement('a');
        a.href = url;
        const fileNameDate = new Date().toISOString().split('T')[0];
        a.download = `expense-data-${fileNameDate}.json`;
        document.body.appendChild(a);
        a.click();
        document.body.removeChild(a);
        URL.revokeObjectURL(url);
    }

    /**
     * Import transactions from a selected JSON file.
     * Merges with existing transactions to preserve any data already present.
     */
    function handleImport(event) {
        const file = event.target.files[0];
        if (!file) return;
        const reader = new FileReader();
        reader.onload = function (e) {
            try {
                const imported = JSON.parse(e.target.result);
                if (!Array.isArray(imported)) throw new Error('Invalid format');
                const transactions = getTransactions();
                imported.forEach((txn) => {
                    const exists = transactions.some(
                        (existing) =>
                            existing.date === txn.date &&
                            existing.amount === txn.amount &&
                            existing.type === txn.type &&
                            existing.category === txn.category &&
                            existing.description === txn.description
                    );
                    if (!exists) {
                        transactions.push(txn);
                    }
                });
                saveTransactions(transactions);
                updateUI();
                alert('Data imported successfully.');
            } catch (err) {
                alert('Failed to import data: ' + err.message);
            }
        };
        reader.readAsText(file);
    }

    /**
     * Update the entire UI: balance, table and charts.
     */
    function updateUI() {
        const transactions = getTransactions();
        updateBalanceDisplay(transactions);
        updateTransactionsTable(transactions);
        updateCharts(transactions);
    }

    /**
     * Initialize the app: populate categories, set up event listeners, and
     * render the initial UI.
     */
    function init() {
        categories = loadCategories();
        populateCategories();
        transactionForm.addEventListener('submit', handleAddTransaction);
        addCategoryBtn.addEventListener('click', handleAddCategory);
        exportButton.addEventListener('click', handleExport);
        importFileInput.addEventListener('change', handleImport);
        updateUI();
    }

    // Kick off the app once the DOM is ready
    document.addEventListener('DOMContentLoaded', init);
})();