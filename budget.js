/*
 * budget.js - logic for the budget planner page.
 *
 * This script provides a way to set monthly spending targets for each expense category
 * and view the remaining balance for those categories based on existing transactions.
 * Targets are stored in localStorage by month (YYYY-MM) and category. When a date
 * is selected, the script loads the targets for that month, calculates actual expenses
 * for each category, and displays both the target and the remaining amount.
 */

(function () {
    /**
     * Read transactions from localStorage. If none exist, return an empty array.
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
     * Retrieve saved category budgets from localStorage.
     * Returns an object keyed by month (YYYY-MM), each containing an object of
     * category targets.
     * @returns {Object<string, Object<string, number>>}
     */
    function getCategoryBudgets() {
        const data = localStorage.getItem('categoryBudgets');
        if (!data) return {};
        try {
            return JSON.parse(data);
        } catch (e) {
            console.error('Failed to parse categoryBudgets from localStorage', e);
            return {};
        }
    }

    /**
     * Persist the category budgets object to localStorage.
     * @param {Object<string, Object<string, number>>} budgets
     */
    function saveCategoryBudgets(budgets) {
        localStorage.setItem('categoryBudgets', JSON.stringify(budgets));
    }

    /**
     * Get budgets for a specific month.
     * @param {string} monthKey Format 'YYYY-MM'
     * @returns {Object<string, number>}
     */
    function getBudgetsForMonth(monthKey) {
        const budgets = getCategoryBudgets();
        return budgets[monthKey] || {};
    }

    /**
     * Set budgets for a specific month.
     * @param {string} monthKey Format 'YYYY-MM'
     * @param {Object<string, number>} monthBudgets
     */
    function setBudgetsForMonth(monthKey, monthBudgets) {
        const budgets = getCategoryBudgets();
        budgets[monthKey] = monthBudgets;
        saveCategoryBudgets(budgets);
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
     * Calculate total expenses per category for a given month.
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
     * Build the list of categories to display. Categories come from
     * existing expense categories, saved budgets, and the categories list from localStorage
     * (or default categories). This ensures that users can set budgets for categories even
     * when there are no expenses recorded yet.
     * @param {Object<string, number>} expenseSums
     * @param {Object<string, number>} monthBudgets
     * @returns {string[]}
     */
    function getCategoryList(expenseSums, monthBudgets) {
        const keys = new Set();
        // Include categories from expenses
        Object.keys(expenseSums).forEach((k) => keys.add(k));
        // Include categories from saved budgets
        Object.keys(monthBudgets).forEach((k) => keys.add(k));
        // Include categories from localStorage or default list
        loadCategories().forEach((k) => keys.add(k));
        return Array.from(keys).sort();
    }

    /**
     * Load the list of categories from localStorage. If none are stored, fall back
     * to a default set inspired by common household budget categories. This mirrors
     * the logic used in the main app for consistency.
     * @returns {Array<string>}
     */
    function loadCategories() {
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
     * Render the budget list in the DOM based on the selected month.
     */
    function renderBudgetList() {
        const dateInput = document.getElementById('budget-date');
        const container = document.getElementById('budget-list');
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
        // Create a table-like structure for budgets
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
            // Actual expense
            const usedCell = document.createElement('td');
            const used = expenseSums[cat] || 0;
            usedCell.textContent = formatCurrency(used);
            row.appendChild(usedCell);
            // Remaining
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
     * Save the budgets currently entered in the budget table.
     */
    function saveBudgets() {
        const dateInput = document.getElementById('budget-date');
        const dateStr = dateInput.value;
        if (!dateStr) {
            alert('Silakan pilih tanggal sebelum menyimpan target.');
            return;
        }
        const monthKey = getMonthKey(dateStr);
        const container = document.getElementById('budget-list');
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
        renderBudgetList();
        alert('Target berhasil disimpan.');
    }

    /**
     * Initialize the budget page.
     */
    function init() {
        const dateInput = document.getElementById('budget-date');
        const loadBtn = document.getElementById('load-budget');
        const saveBtn = document.getElementById('save-budget');
        // Set default date to today
        const today = new Date();
        const defaultDate = today.toISOString().substring(0, 10);
        dateInput.value = defaultDate;
        loadBtn.addEventListener('click', () => {
            renderBudgetList();
        });
        // Also update on date change automatically
        dateInput.addEventListener('change', () => {
            renderBudgetList();
        });
        saveBtn.addEventListener('click', () => {
            saveBudgets();
        });
        // Initial render
        renderBudgetList();
    }
    document.addEventListener('DOMContentLoaded', init);
})();