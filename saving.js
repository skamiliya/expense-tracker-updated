/*
 * saving.js - logic for the saving planner page.
 *
 * This script allows users to set monthly saving targets for each expense
 * category and view the remaining budget in those categories based on
 * existing expense transactions. Targets are stored in localStorage by
 * month (YYYY-MM) and category. When a date is selected, the script
 * loads the targets for that month, calculates actual expenses for each
 * category and displays both the target and the remaining amount.
 */

(function () {
    /**
     * Read transactions from localStorage. If none exist, return an empty array.
     * Transactions are stored by the main expense tracker and include both
     * income and expense entries. Only expense entries are relevant for
     * calculating used amounts.
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
     * Format a number as Japanese yen. Yen does not use fractional digits.
     * @param {number} value
     * @returns {string}
     */
    function formatCurrency(value) {
        return new Intl.NumberFormat(undefined, {
            style: 'currency',
            currency: 'JPY',
            minimumFractionDigits: 0,
            maximumFractionDigits: 0,
        }).format(value);
    }

    /**
     * Retrieve saved saving budgets from localStorage. The structure is an
     * object keyed by month (YYYY-MM); each entry contains an object of
     * category targets for that month.
     * @returns {Object<string, Object<string, number>>}
     */
    function getSavingBudgets() {
        const data = localStorage.getItem('savingBudgets');
        if (!data) return {};
        try {
            return JSON.parse(data);
        } catch (e) {
            console.error('Failed to parse savingBudgets from localStorage', e);
            return {};
        }
    }

    /**
     * Persist the saving budgets object to localStorage.
     * @param {Object<string, Object<string, number>>} budgets
     */
    function saveSavingBudgets(budgets) {
        localStorage.setItem('savingBudgets', JSON.stringify(budgets));
    }

    /**
     * Get budgets for a specific month.
     * @param {string} monthKey Format 'YYYY-MM'
     * @returns {Object<string, number>}
     */
    function getBudgetsForMonth(monthKey) {
        const budgets = getSavingBudgets();
        return budgets[monthKey] || {};
    }

    /**
     * Set budgets for a specific month.
     * @param {string} monthKey Format 'YYYY-MM'
     * @param {Object<string, number>} monthBudgets
     */
    function setBudgetsForMonth(monthKey, monthBudgets) {
        const budgets = getSavingBudgets();
        budgets[monthKey] = monthBudgets;
        saveSavingBudgets(budgets);
    }

    /**
     * Given a date string (YYYY-MM-DD), return the corresponding month key (YYYY-MM).
     * @param {string} dateStr
     * @returns {string}
     */
    function getMonthKey(dateStr) {
        const d = new Date(dateStr);
        const month = String(d.getMonth() + 1).padStart(2, '0');
        return `${d.getFullYear()}-${month}`;
    }

    /**
     * Calculate total expenses per category for a given month. Only expense
     * transactions (type === 'expense') are considered.
     * @param {Array<Object>} transactions
     * @param {string} monthKey Format 'YYYY-MM'
     * @returns {Object<string, number>}
     */
    function calculateExpensesByCategory(transactions, monthKey) {
        const sums = {};
        transactions.forEach((txn) => {
            if (txn.type === 'expense') {
                const month = getMonthKey(txn.date);
                if (month === monthKey) {
                    const cat = txn.category;
                    const amt = parseFloat(txn.amount);
                    sums[cat] = (sums[cat] || 0) + amt;
                }
            }
        });
        return sums;
    }

    /**
     * Build the list of categories to display. Categories include:
     *  - A default list for saving budgets (Entertainment, Hangout, Groceries, Transport, Saving)
     *  - Categories that appear in current expenses
     *  - Categories that already have a saved budget
     * This ensures that users can set and view budgets for relevant categories even
     * when there are no expenses recorded yet.
     * @param {Object<string, number>} expenseSums
     * @param {Object<string, number>} monthBudgets
     * @returns {string[]}
     */
    function getCategoryList(expenseSums, monthBudgets) {
        const DEFAULT_CATEGORIES = [
            'Entertainment',
            'Hangout',
            'Groceries',
            'Transport',
            'Saving',
        ];
        const keys = new Set();
        // Include default saving categories
        DEFAULT_CATEGORIES.forEach((c) => keys.add(c));
        // Include categories from expenses
        Object.keys(expenseSums).forEach((k) => keys.add(k));
        // Include categories from saved budgets
        Object.keys(monthBudgets).forEach((k) => keys.add(k));
        return Array.from(keys).sort();
    }

    /**
     * Render the saving list in the DOM based on the selected month.
     */
    function renderSavingList() {
        const dateInput = document.getElementById('saving-date');
        const container = document.getElementById('saving-list');
        const dateStr = dateInput.value;
        container.innerHTML = '';
        if (!dateStr) {
            const msg = document.createElement('p');
            msg.textContent = 'Silakan pilih tanggal untuk memuat target.';
            container.appendChild(msg);
            return;
        }
        const monthKey = getMonthKey(dateStr);
        const transactions = getTransactions();
        const expenseSums = calculateExpensesByCategory(transactions, monthKey);
        const monthBudgets = getBudgetsForMonth(monthKey);
        const categories = getCategoryList(expenseSums, monthBudgets);
        if (categories.length === 0) {
            const msg = document.createElement('p');
            msg.textContent = 'Tidak ada kategori pengeluaran untuk bulan ini.';
            container.appendChild(msg);
            return;
        }
        // Create a table-like structure for savings
        const table = document.createElement('table');
        table.className = 'budget-table';
        const thead = document.createElement('thead');
        const headRow = document.createElement('tr');
        ['Kategori', 'Target', 'Terpakai', 'Sisa'].forEach((txt) => {
            const th = document.createElement('th');
            th.textContent = txt;
            headRow.appendChild(th);
        });
        thead.appendChild(headRow);
        table.appendChild(thead);
        const tbody = document.createElement('tbody');
        categories.forEach((cat) => {
            const row = document.createElement('tr');
            // Category name
            const catCell = document.createElement('td');
            catCell.textContent = cat;
            row.appendChild(catCell);
            // Target input
            const targetCell = document.createElement('td');
            const input = document.createElement('input');
            input.type = 'number';
            input.min = '0';
            input.step = '1';
            input.value = monthBudgets[cat] || '';
            input.placeholder = '0';
            input.dataset.category = cat;
            targetCell.appendChild(input);
            row.appendChild(targetCell);
            // Actual expense used
            const usedCell = document.createElement('td');
            const used = expenseSums[cat] || 0;
            usedCell.textContent = formatCurrency(used);
            row.appendChild(usedCell);
            // Remaining amount
            const remainingCell = document.createElement('td');
            const target = monthBudgets[cat] || 0;
            const remaining = (target - used);
            remainingCell.textContent = formatCurrency(remaining);
            row.appendChild(remainingCell);
            tbody.appendChild(row);
        });
        table.appendChild(tbody);
        container.appendChild(table);
    }

    /**
     * Save the budgets currently entered in the saving table. Validates that a date
     * is selected and stores the values keyed by category and month.
     */
    function saveBudgets() {
        const dateInput = document.getElementById('saving-date');
        const dateStr = dateInput.value;
        if (!dateStr) {
            alert('Silakan pilih tanggal sebelum menyimpan target.');
            return;
        }
        const monthKey = getMonthKey(dateStr);
        const container = document.getElementById('saving-list');
        const inputs = container.querySelectorAll('tbody input[type="number"]');
        const monthBudgets = {};
        inputs.forEach((input) => {
            const cat = input.dataset.category;
            const val = parseFloat(input.value);
            if (!isNaN(val)) {
                monthBudgets[cat] = val;
            }
        });
        setBudgetsForMonth(monthKey, monthBudgets);
        // Re-render to update the remaining values
        renderSavingList();
        alert('Target berhasil disimpan.');
    }

    /**
     * Initialize the saving planner page. Sets default date to today and
     * attaches event listeners to the load and save buttons. Also triggers
     * an initial render.
     */
    function init() {
        const dateInput = document.getElementById('saving-date');
        const loadBtn = document.getElementById('load-saving');
        const saveBtn = document.getElementById('save-saving');
        // Set default date to today; this allows the user to immediately see
        // the current month while still permitting manual selection of any date.
        const today = new Date();
        const defaultDate = today.toISOString().substring(0, 10);
        dateInput.value = defaultDate;
        // Load budgets when the user clicks the load button
        loadBtn.addEventListener('click', () => {
            renderSavingList();
        });
        // Also update when the date changes
        dateInput.addEventListener('change', () => {
            renderSavingList();
        });
        // Save budgets when the user clicks the save button
        saveBtn.addEventListener('click', () => {
            saveBudgets();
        });
        // Perform initial render
        renderSavingList();
    }
    document.addEventListener('DOMContentLoaded', init);
})();