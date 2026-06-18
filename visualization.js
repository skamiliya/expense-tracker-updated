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
    // Create a pie chart that shows the distribution of expenses by category and savings.
    // Include a "Saving" slice representing salary minus total expenses. Categories with zero value are omitted.
    const savingVal = salary - totalExpense;
    const pieValues = [];
    const pieLabels = [];
    const pieColors = [];
    // Expense categories
    values.forEach((item, idx) => {
      if (item.expenseVal > 0) {
        pieLabels.push(item.cat);
        pieValues.push(item.expenseVal);
      }
    });
    if (savingVal > 0) {
      pieLabels.push('Saving');
      pieValues.push(savingVal);
    }
    const totalPie = pieValues.reduce((sum, v) => sum + v, 0);
    // Generate colors for the slices (use the same function as summary page)
    const colors = (function generateColors(count) {
      const arr = [];
      for (let i = 0; i < count; i++) {
        const hue = Math.floor((360 / Math.max(count, 1)) * i);
        arr.push(`hsl(${hue}, 70%, 60%)`);
      }
      return arr;
    })(pieValues.length);
    // Build conic-gradient segments
    let startPct = 0;
    const segments = pieValues.map((val, idx) => {
      const pct = totalPie > 0 ? (val / totalPie) * 100 : 0;
      const endPct = startPct + pct;
      const segment = `${colors[idx]} ${startPct.toFixed(2)}% ${endPct.toFixed(2)}%`;
      startPct = endPct;
      return segment;
    });
    const gradientStr = segments.join(', ');
    const pieDiv = document.createElement('div');
    pieDiv.className = 'pie-chart';
    pieDiv.style.background = `conic-gradient(${gradientStr})`;
    const center = document.createElement('div');
    center.className = 'center';
    pieDiv.appendChild(center);
    container.appendChild(pieDiv);
    // Ranking list with percentages and amounts
    const rankingDiv = document.createElement('div');
    rankingDiv.style.marginTop = '0.5rem';
    const rankingTitle = document.createElement('p');
    rankingTitle.style.fontWeight = 'bold';
    rankingTitle.textContent = 'Category & Saving Breakdown';
    rankingDiv.appendChild(rankingTitle);
    const ul = document.createElement('ul');
    ul.style.margin = '0';
    ul.style.padding = '0 0 0 1rem';
    pieValues.forEach((val, idx) => {
      const pct = totalPie > 0 ? ((val / totalPie) * 100).toFixed(1) : '0.0';
      const li = document.createElement('li');
      li.textContent = `${pieLabels[idx]}: ${formatCurrency(val)} (${pct}%)`;
      ul.appendChild(li);
    });
    rankingDiv.appendChild(ul);
    container.appendChild(rankingDiv);
    // Summary information
    const summary = document.createElement('div');
    summary.className = 'visual-summary';
    summary.style.marginTop = '0.5rem';
    const remainingSalary = salary - totalExpense;
    summary.innerHTML =
      `<p><strong>Salary:</strong> ${formatCurrency(salary)}</p>` +
      `<p><strong>Total Budget:</strong> ${formatCurrency(totalBudget)}</p>` +
      `<p><strong>Total Expense:</strong> ${formatCurrency(totalExpense)}</p>` +
      `<p><strong>Saving:</strong> ${formatCurrency(remainingSalary)}</p>`;
    container.appendChild(summary);
    // Create monthly summary table for all months
    const table = document.createElement('table');
    table.className = 'budget-table';
    const thead = document.createElement('thead');
    const headRow = document.createElement('tr');
    ['Month', 'Income', 'Expense', 'Saving'].forEach((txt) => {
      const th = document.createElement('th');
      th.textContent = txt;
      headRow.appendChild(th);
    });
    thead.appendChild(headRow);
    table.appendChild(thead);
    const tbody = document.createElement('tbody');
    // Build summary per month
    // Group transactions by month
    const monthly = {};
    transactions.forEach((txn) => {
      const d = new Date(txn.date);
      const mk = `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}`;
      if (!monthly[mk]) {
        monthly[mk] = { income: 0, expense: 0 };
      }
      const amt = parseFloat(txn.amount);
      if (txn.type === 'income') {
        monthly[mk].income += amt;
      } else if (txn.type === 'expense') {
        monthly[mk].expense += amt;
      }
    });
    // For each month, compute salary if available, and saving as salary - expense; else income - expense
    Object.keys(monthly)
      .sort()
      .forEach((mk) => {
        const row = document.createElement('tr');
        const monthCell = document.createElement('td');
        monthCell.textContent = mk;
        row.appendChild(monthCell);
        const incCell = document.createElement('td');
        incCell.textContent = formatCurrency(monthly[mk].income);
        row.appendChild(incCell);
        const expCell = document.createElement('td');
        expCell.textContent = formatCurrency(monthly[mk].expense);
        row.appendChild(expCell);
        const savedSalary = budgets[mk] && budgets[mk]['_salary'] ? parseFloat(budgets[mk]['_salary']) : monthly[mk].income;
        const savingValMonth = savedSalary - monthly[mk].expense;
        const savCell = document.createElement('td');
        savCell.textContent = formatCurrency(savingValMonth);
        row.appendChild(savCell);
        tbody.appendChild(row);
      });
    table.appendChild(tbody);
    container.appendChild(table);
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