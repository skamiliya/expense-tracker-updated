/*
 * visualization.js - logic for visualizing budgets versus actual expenses.
 *
 * This script reads transactions and planner budgets from localStorage and
 * produces a simple bar chart comparing monthly budgets against actual
 * spending per category. It also displays a summary of salary, total budgets,
 * total expenses, and remaining salary for the selected month.
 */

// Wrap the code to avoid polluting the global scope
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
   * keyed by month (YYYY-MM). Each entry may contain category budgets and
   * special keys like _budgetDate and _salary.
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
        const d = new Date(txn.date);
        const month = `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}`;
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
   * Build the list of categories to visualize. Categories include those from
   * expenses, budgets, and any default saving categories. It also includes
   * categories stored in localStorage under 'categories'.
   * @param {Object<string, number>} expenseSums
   * @param {Object<string, number|string>} monthBudgets
   * @returns {string[]}
   */
  function getCategoryList(expenseSums, monthBudgets) {
    const DEFAULT_SAVING = ['Investment', 'Holiday', 'Saving'];
    const keys = new Set();
    DEFAULT_SAVING.forEach((c) => keys.add(c));
    Object.keys(expenseSums).forEach((k) => keys.add(k));
    Object.keys(monthBudgets).forEach((k) => {
      if (!k.startsWith('_')) keys.add(k);
    });
    try {
      const data = localStorage.getItem('categories');
      if (data) {
        const parsed = JSON.parse(data);
        if (Array.isArray(parsed) && parsed.every((c) => typeof c === 'string')) {
          parsed.forEach((c) => keys.add(c));
        }
      }
    } catch (e) {
      console.warn('Failed to parse categories from localStorage in visualization', e);
    }
    return Array.from(keys).sort();
  }

  /**
   * Render the bar chart and summary for the selected month. Reads budgets and
   * expenses for the month and constructs a simple vertical bar chart using
   * CSS. Each category displays two bars: one for the budget and one for the
   * actual spending. A summary line shows salary, total budgets, total
   * expenses and remaining salary.
   */
  function renderVisualization() {
    const monthInput = document.getElementById('visual-month');
    const container = document.getElementById('visual-container');
    const monthKey = monthInput.value;
    container.innerHTML = '';
    if (!monthKey) {
      const msg = document.createElement('p');
      msg.textContent = 'Please select a month to view the visualization.';
      container.appendChild(msg);
      return;
    }
    const budgets = getPlannerBudgets();
    const monthBudgets = budgets[monthKey] || {};
    const transactions = getTransactions();
    const expenseSums = calculateExpensesByCategory(transactions, monthKey);
    const categories = getCategoryList(expenseSums, monthBudgets);
    if (categories.length === 0) {
      const msg = document.createElement('p');
      msg.textContent = 'No categories found for this month.';
      container.appendChild(msg);
      return;
    }
    const salary = parseFloat(monthBudgets['_salary']) || 0;
    // Extract budgets per category and compute totals
    let totalBudget = 0;
    let totalExpense = 0;
    const values = [];
    categories.forEach((cat) => {
      const budgetVal = parseFloat(monthBudgets[cat]) || 0;
      const expenseVal = expenseSums[cat] || 0;
      totalBudget += budgetVal;
      totalExpense += expenseVal;
      values.push({ cat, budgetVal, expenseVal });
    });
    // Determine maximum value among budgets and expenses for scaling bars
    const maxValue = values.reduce((max, item) => Math.max(max, item.budgetVal, item.expenseVal), 0);
    // Create bar chart container
    const chartDiv = document.createElement('div');
    chartDiv.className = 'bar-chart';
    values.forEach((item) => {
      const group = document.createElement('div');
      group.className = 'bar-group';
      // Budget bar
      const budgetBar = document.createElement('div');
      budgetBar.className = 'bar budget';
      const budgetHeight = maxValue > 0 ? (item.budgetVal / maxValue) * 100 : 0;
      budgetBar.style.height = `${budgetHeight}%`;
      group.appendChild(budgetBar);
      // Actual expense bar
      const actualBar = document.createElement('div');
      actualBar.className = 'bar actual';
      const actualHeight = maxValue > 0 ? (item.expenseVal / maxValue) * 100 : 0;
      actualBar.style.height = `${actualHeight}%`;
      group.appendChild(actualBar);
      // Label
      const label = document.createElement('div');
      label.className = 'bar-label';
      label.textContent = item.cat;
      group.appendChild(label);
      chartDiv.appendChild(group);
    });
    container.appendChild(chartDiv);
    // Summary information
    const summary = document.createElement('div');
    summary.className = 'visual-summary';
    summary.style.marginTop = '0.5rem';
    const remainingSalary = salary - totalBudget;
    summary.innerHTML =
      `<p><strong>Salary:</strong> ${formatCurrency(salary)}</p>` +
      `<p><strong>Total Budget:</strong> ${formatCurrency(totalBudget)}</p>` +
      `<p><strong>Total Expense:</strong> ${formatCurrency(totalExpense)}</p>` +
      `<p><strong>Remaining Salary:</strong> ${formatCurrency(remainingSalary)}</p>`;
    container.appendChild(summary);
  }

  /**
   * Initialize the visualization page: sets default month to the current month
   * and attaches event listener to the Load button. Renders the visualization
   * for the default month on page load.
   */
  function init() {
    const monthInput = document.getElementById('visual-month');
    const loadBtn = document.getElementById('load-visual');
    // Default month to current month
    const today = new Date();
    const monthKey = `${today.getFullYear()}-${String(today.getMonth() + 1).padStart(2, '0')}`;
    monthInput.value = monthKey;
    loadBtn.addEventListener('click', () => {
      renderVisualization();
    });
    // Initial render
    renderVisualization();
  }
  document.addEventListener('DOMContentLoaded', init);
})();