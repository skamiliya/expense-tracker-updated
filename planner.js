/*
 * planner.js - logic for the unified financial planner page.
 *
 * This script provides a single page where users can set monthly budget targets
 * for each expense or saving category and view the remaining balance based on
 * recorded expenses. It calculates a derived weekly budget for each category
 * by dividing the monthly target by the number of ISO weeks in the selected
 * month. Budgets are stored in localStorage keyed by month (YYYY-MM) and
 * include an optional deposit date (1 or 20) to indicate when budgets take
 * effect within the month.
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
     * Retrieve saved planner budgets from localStorage. The structure is an object
     * keyed by month (YYYY-MM), where each entry contains budget targets by
     * category and an optional '_depositDate' property.
     * @returns {Object<string, Object<string, number|string>>}
     */
    function getPlannerBudgets() {
        const data = localStorage.getItem('plannerBudgets');
        if (!data) return {};
        try {
            return JSON.parse(data);
        } catch (e) {
            console.error('Failed to parse plannerBudgets from localStorage', e);
            return {};
        }
    }

    /**
     * Persist the planner budgets object to localStorage.
     * @param {Object<string, Object<string, number|string>>} budgets
     */
    function savePlannerBudgets(budgets) {
        localStorage.setItem('plannerBudgets', JSON.stringify(budgets));
    }

    /**
     * Get budgets for a specific month.
     * @param {string} monthKey Format 'YYYY-MM'
     * @returns {Object<string, number|string>}
     */
    function getBudgetsForMonth(monthKey) {
        const budgets = getPlannerBudgets();
        return budgets[monthKey] || {};
    }

    /**
     * Set budgets for a specific month. Includes an optional '_depositDate'.
     * @param {string} monthKey Format 'YYYY-MM'
     * @param {Object<string, number|string>} monthBudgets
     */
    function setBudgetsForMonth(monthKey, monthBudgets) {
        const budgets = getPlannerBudgets();
        budgets[monthKey] = monthBudgets;
        savePlannerBudgets(budgets);
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
     * Only expense transactions (type === 'expense') are considered.
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
     * Count the number of ISO weeks that overlap a given month. This is done by
     * iterating through each day of the month and collecting unique ISO week
     * numbers. If no weeks are found (should not happen), returns 1.
     * @param {number} year Full year, e.g. 2026
     * @param {number} month Month number 1–12
     * @returns {number}
     */
    function countWeeksInMonth(year, month) {
        const weeks = new Set();
        // month in JS Date is zero-based; convert to 0-based index
        const d = new Date(year, month - 1, 1);
        while (d.getMonth() === month - 1) {
            weeks.add(getISOWeek(d));
            d.setDate(d.getDate() + 1);
        }
        return weeks.size || 1;
    }

    /**
     * Compute the ISO week number for a given date.
     * Source: https://stackoverflow.com/a/6117889
     * @param {Date} date
     * @returns {number}
     */
    function getISOWeek(date) {
        const target = new Date(Date.UTC(date.getFullYear(), date.getMonth(), date.getDate()));
        const dayNr = target.getUTCDay() || 7;
        target.setUTCDate(target.getUTCDate() + 4 - dayNr);
        const yearStart = new Date(Date.UTC(target.getUTCFullYear(), 0, 1));
        return Math.ceil(((target - yearStart) / 86400000 + 1) / 7);
    }

    /**
     * Build the list of categories to display. Categories include:
     *  - Categories loaded from localStorage or defaults (via loadCategories in app.js)
     *  - Default saving categories (Investment, Holiday, Saving) to ensure they appear
     *  - Categories from current expenses or existing budgets
     * This ensures that users can set budgets even when there are no expenses recorded yet.
     * @param {Object<string, number>} expenseSums
     * @param {Object<string, number|string>} monthBudgets
     * @returns {string[]}
     */
    function getCategoryList(expenseSums, monthBudgets) {
        // Attempt to load categories from the main app's localStorage; if not available,
        // fall back to default categories defined in app.js. We wrap in try/catch
        // because app.js may not be loaded on this page, but categories may be stored in localStorage.
        const DEFAULT_SAVING = ['Investment', 'Holiday', 'Saving'];
        const keys = new Set();
        // Default saving categories
        DEFAULT_SAVING.forEach((c) => keys.add(c));
        // Categories from expenses
        Object.keys(expenseSums).forEach((k) => keys.add(k));
        // Categories from existing budgets
        Object.keys(monthBudgets).forEach((k) => {
            if (k !== '_depositDate') keys.add(k);
        });
        // Categories stored in localStorage (same as app.js)
        try {
            const data = localStorage.getItem('categories');
            if (data) {
                const parsed = JSON.parse(data);
                if (Array.isArray(parsed) && parsed.every((c) => typeof c === 'string')) {
                    parsed.forEach((c) => keys.add(c));
                }
            }
        } catch (e) {
            console.warn('Failed to parse categories from localStorage in planner', e);
        }
        return Array.from(keys).sort();
    }

    /**
     * Render the planner list based on the selected month and deposit date.
     */
    function renderPlannerList() {
        const dateInput = document.getElementById('planner-date');
        const depositSelect = document.getElementById('planner-deposit-date');
        const container = document.getElementById('planner-list');
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
        // Use selected deposit date or fallback to saved one
        const depositDate = depositSelect.value || monthBudgets['_depositDate'] || '20';
        // Save deposit date to selector to reflect persisted value
        depositSelect.value = depositDate;
        const categories = getCategoryList(expenseSums, monthBudgets);
        if (categories.length === 0) {
            const msg = document.createElement('p');
            msg.textContent = 'Tidak ada kategori untuk bulan ini.';
            container.appendChild(msg);
            return;
        }
        // Calculate number of weeks in the selected month for weekly budgets
        const [yr, mo] = monthKey.split('-').map((v) => parseInt(v, 10));
        const weeksCount = countWeeksInMonth(yr, mo);
        // Create table
        const table = document.createElement('table');
        table.className = 'budget-table';
        const thead = document.createElement('thead');
        const headRow = document.createElement('tr');
        ['Kategori', 'Target Bulanan', 'Target Mingguan', 'Terpakai', 'Sisa'].forEach((txt) => {
            const th = document.createElement('th');
            th.textContent = txt;
            headRow.appendChild(th);
        });
        thead.appendChild(headRow);
        table.appendChild(thead);
        const tbody = document.createElement('tbody');
        categories.forEach((cat) => {
            const row = document.createElement('tr');
            // Category cell
            const catCell = document.createElement('td');
            catCell.textContent = cat;
            row.appendChild(catCell);
            // Monthly target input
            const targetCell = document.createElement('td');
            const input = document.createElement('input');
            input.type = 'number';
            input.min = '0';
            input.step = '1';
            // Use saved value if available
            const savedVal = monthBudgets[cat];
            input.value = savedVal && !isNaN(parseFloat(savedVal)) ? savedVal : '';
            input.placeholder = '0';
            input.dataset.category = cat;
            // When user inputs a number, update weekly budget on the fly
            input.addEventListener('input', () => {
                const val = parseFloat(input.value);
                const weeklyTd = row.querySelector('.weekly-budget');
                if (!isNaN(val)) {
                    const weekly = weeksCount > 0 ? val / weeksCount : val;
                    weeklyTd.textContent = formatCurrency(weekly);
                } else {
                    weeklyTd.textContent = '-';
                }
                // Also update remaining if used
                const used = expenseSums[cat] || 0;
                const remainingTd = row.querySelector('.remaining-budget');
                const remaining = (!isNaN(val) ? val : 0) - used;
                remainingTd.textContent = formatCurrency(remaining);
            });
            targetCell.appendChild(input);
            row.appendChild(targetCell);
            // Weekly budget cell (computed)
            const weeklyCell = document.createElement('td');
            weeklyCell.className = 'weekly-budget';
            const targetVal = parseFloat(input.value);
            if (!isNaN(targetVal)) {
                const weekly = weeksCount > 0 ? targetVal / weeksCount : targetVal;
                weeklyCell.textContent = formatCurrency(weekly);
            } else {
                weeklyCell.textContent = '-';
            }
            row.appendChild(weeklyCell);
            // Actual expense cell
            const usedCell = document.createElement('td');
            const used = expenseSums[cat] || 0;
            usedCell.textContent = formatCurrency(used);
            row.appendChild(usedCell);
            // Remaining cell
            const remainingCell = document.createElement('td');
            remainingCell.className = 'remaining-budget';
            const remaining = (!isNaN(targetVal) ? targetVal : 0) - used;
            remainingCell.textContent = formatCurrency(remaining);
            row.appendChild(remainingCell);
            tbody.appendChild(row);
        });
        table.appendChild(tbody);
        container.appendChild(table);
    }

    /**
     * Save the budgets currently entered in the planner table. Stores the
     * deposit date and budget values for the selected month.
     */
    function saveBudgets() {
        const dateInput = document.getElementById('planner-date');
        const depositSelect = document.getElementById('planner-deposit-date');
        const dateStr = dateInput.value;
        if (!dateStr) {
            alert('Silakan pilih tanggal sebelum menyimpan target.');
            return;
        }
        const monthKey = getMonthKey(dateStr);
        const container = document.getElementById('planner-list');
        const inputs = container.querySelectorAll('tbody input[type="number"]');
        const monthBudgets = {};
        // Persist deposit date as a special key
        monthBudgets['_depositDate'] = depositSelect.value || '20';
        inputs.forEach((input) => {
            const cat = input.dataset.category;
            const val = parseFloat(input.value);
            if (!isNaN(val)) {
                monthBudgets[cat] = val;
            }
        });
        setBudgetsForMonth(monthKey, monthBudgets);
        // Re-render to update weekly and remaining values
        renderPlannerList();
        alert('Target berhasil disimpan.');
    }

    /**
     * Initialize the planner page. Sets default date to today and attaches event
     * listeners to the load and save buttons. Also triggers an initial render.
     */
    function init() {
        const dateInput = document.getElementById('planner-date');
        const loadBtn = document.getElementById('load-planner');
        const saveBtn = document.getElementById('save-planner');
        // Default date to today; user can still change it
        const today = new Date();
        const defaultDate = today.toISOString().substring(0, 10);
        dateInput.value = defaultDate;
        // Event listeners
        loadBtn.addEventListener('click', () => {
            renderPlannerList();
        });
        dateInput.addEventListener('change', () => {
            renderPlannerList();
        });
        document.getElementById('planner-deposit-date').addEventListener('change', () => {
            // Just re-render to reflect deposit date; weekly budgets unaffected
            renderPlannerList();
        });
        saveBtn.addEventListener('click', () => {
            saveBudgets();
        });
        // Initial render
        renderPlannerList();
    }
    document.addEventListener('DOMContentLoaded', init);
})();