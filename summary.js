/*
 * summary.js - logic for the weekly and monthly summary page.
 *
 * This script reads the existing transactions from localStorage and
 * aggregates expense transactions by ISO week and by month. It then
 * renders bar charts using Chart.js to visualize spending over time.
 */

// Wrap everything in an IIFE to avoid polluting the global scope
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
     * Compute the ISO week number for a given date.
     * Source: https://stackoverflow.com/a/6117889
     * @param {Date} date
     * @returns {number} week number (1-53)
     */
    function getISOWeek(date) {
        const target = new Date(Date.UTC(date.getFullYear(), date.getMonth(), date.getDate()));
        const dayNr = target.getUTCDay() || 7;
        target.setUTCDate(target.getUTCDate() + 4 - dayNr);
        const yearStart = new Date(Date.UTC(target.getUTCFullYear(), 0, 1));
        return Math.ceil(((target - yearStart) / 86400000 + 1) / 7);
    }

    /**
     * Group transactions by period (weekly or monthly) and compute totals and
     * category breakdown for each period.
     * @param {Array<Object>} transactions
     * @param {string} periodType 'weekly' or 'monthly'
     * @returns {Object} summary keyed by period label
     */
    function groupTransactions(transactions, periodType) {
        const summary = {};
        transactions.forEach((txn) => {
            const d = new Date(txn.date);
            if (isNaN(d)) return;
            let periodKey;
            if (periodType === 'weekly') {
                const week = getISOWeek(d).toString().padStart(2, '0');
                periodKey = `${d.getFullYear()}-W${week}`;
            } else {
                const month = (d.getMonth() + 1).toString().padStart(2, '0');
                periodKey = `${d.getFullYear()}-${month}`;
            }
            if (!summary[periodKey]) {
                summary[periodKey] = {
                    totalIncome: 0,
                    totalExpense: 0,
                    categories: {},
                };
            }
            const amt = parseFloat(txn.amount);
            if (txn.type === 'income') {
                summary[periodKey].totalIncome += amt;
            } else if (txn.type === 'expense') {
                summary[periodKey].totalExpense += amt;
                const cat = txn.category;
                summary[periodKey].categories[cat] =
                    (summary[periodKey].categories[cat] || 0) + amt;
            }
        });
        return summary;
    }

    /**
     * Generate a palette of distinct colors for a pie chart.
     * Uses HSL color space to ensure even spacing around the color wheel.
     * @param {number} count
     * @returns {string[]}
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
     * Render the summary for a specific period.
     * @param {string} periodType 'weekly' or 'monthly'
     * @param {string} periodKey The selected period key (e.g. '2026-W19' or '2026-05')
     */
    function renderSummary(periodType, periodKey) {
        const container = document.getElementById('summary-container');
        container.innerHTML = '';
        const transactions = getTransactions();
        const grouped = groupTransactions(transactions, periodType);
        if (!grouped[periodKey]) {
            // If there's no data for the chosen period, display a friendly message
            const msg = document.createElement('p');
            msg.textContent = 'Tidak ada data untuk periode ini.';
            container.appendChild(msg);
            return;
        }
        const item = grouped[periodKey];
        const section = document.createElement('section');
        section.className = 'chart-container';
        // Period title
        const header = document.createElement('h3');
        header.textContent = periodKey;
        section.appendChild(header);
        // Totals display
        const totalsDiv = document.createElement('div');
        totalsDiv.style.display = 'flex';
        totalsDiv.style.justifyContent = 'space-between';
        totalsDiv.style.marginBottom = '0.5rem';
        const incomeP = document.createElement('p');
        incomeP.textContent = `Total Income: ${formatCurrency(item.totalIncome)}`;
        const expenseP = document.createElement('p');
        expenseP.textContent = `Total Expense: ${formatCurrency(item.totalExpense)}`;
        totalsDiv.appendChild(incomeP);
        totalsDiv.appendChild(expenseP);
        section.appendChild(totalsDiv);
        // Prepare data for pie chart and ranking
        const catLabels = Object.keys(item.categories);
        const catData = catLabels.map((k) => item.categories[k]);
        const total = catData.reduce((sum, v) => sum + v, 0);
        // Build ranking array sorted by descending value
        const ranking = catLabels
            .map((label, idx) => ({ label, value: catData[idx] }))
            .sort((a, b) => b.value - a.value);
        // Chart labels with percentage displayed in tooltip only, not in legend
        const colors = generateColors(catLabels.length);
        // Create a simple pie chart using CSS conic-gradient instead of Chart.js
        // This avoids loading external libraries and works offline. Each category slice is represented
        // by a color segment in the conic-gradient. If there are no expense categories, no chart is drawn.
        if (catLabels.length > 0) {
            let startPct = 0;
            const segments = catLabels.map((label, idx) => {
                const value = catData[idx];
                const pct = total > 0 ? (value / total) * 100 : 0;
                const endPct = startPct + pct;
                const segment = `${colors[idx]} ${startPct.toFixed(2)}% ${endPct.toFixed(2)}%`;
                startPct = endPct;
                return segment;
            });
            const gradientStr = segments.join(', ');
            const pieDiv = document.createElement('div');
            // Assign the pie-chart class so sizing and layout come from CSS
            pieDiv.className = 'pie-chart';
            pieDiv.style.background = `conic-gradient(${gradientStr})`;
            // Create a white centre donut using a CSS class instead of inline styles for better responsiveness
            const center = document.createElement('div');
            center.className = 'center';
            pieDiv.appendChild(center);
            section.appendChild(pieDiv);
        }
        // Append ranking list below the chart
        const rankingDiv = document.createElement('div');
        rankingDiv.style.marginTop = '0.5rem';
        const rankingTitle = document.createElement('p');
        rankingTitle.style.fontWeight = 'bold';
        rankingTitle.textContent = 'Ranking Kategori';
        rankingDiv.appendChild(rankingTitle);
        const ul = document.createElement('ul');
        ul.style.margin = '0';
        ul.style.padding = '0 0 0 1rem';
        ranking.forEach((item) => {
            const pct = total > 0 ? ((item.value / total) * 100).toFixed(1) : '0.0';
            const li = document.createElement('li');
            li.textContent = `${item.label}: ${formatCurrency(item.value)} (${pct}%)`;
            ul.appendChild(li);
        });
        rankingDiv.appendChild(ul);
        // Append ranking list after the chart canvas
        section.appendChild(rankingDiv);
        // Append the section to container
        container.appendChild(section);
    }

    /**
     * Populate the period value selector based on available transaction data and selected period type.
     * @param {string} periodType
     */
    function populatePeriodValues(periodType) {
        const valueSelect = document.getElementById('period-value-selector');
        valueSelect.innerHTML = '';
        const transactions = getTransactions();
        const grouped = groupTransactions(transactions, periodType);
        const keys = Object.keys(grouped).sort();
        if (keys.length === 0) {
            const opt = document.createElement('option');
            opt.value = '';
            opt.textContent = 'Tidak ada data';
            valueSelect.appendChild(opt);
            return;
        }
        keys.forEach((key, idx) => {
            const opt = document.createElement('option');
            opt.value = key;
            opt.textContent = key;
            valueSelect.appendChild(opt);
        });
    }

    /**
     * Initialize the summary page: set up the period selectors and render the
     * default summary for the first available period.
     */
    function init() {
        const periodTypeSelect = document.getElementById('period-selector');
        const periodValueSelect = document.getElementById('period-value-selector');
        // Populate initial options for period values
        const initialType = periodTypeSelect.value === 'monthly' ? 'monthly' : 'weekly';
        populatePeriodValues(initialType);
        // Listen for changes to period type
        periodTypeSelect.addEventListener('change', () => {
            const selectedType = periodTypeSelect.value === 'monthly' ? 'monthly' : 'weekly';
            populatePeriodValues(selectedType);
            // After repopulating, select the first option and render
            const firstValue = periodValueSelect.value;
            renderSummary(selectedType, firstValue);
        });
        // Listen for changes to period value
        periodValueSelect.addEventListener('change', () => {
            const selectedType = periodTypeSelect.value === 'monthly' ? 'monthly' : 'weekly';
            const periodKey = periodValueSelect.value;
            if (periodKey) {
                renderSummary(selectedType, periodKey);
            }
        });
        // Initial render for first available period
        const initialValue = periodValueSelect.value;
        if (initialValue) {
            renderSummary(initialType, initialValue);
        }
    }

    document.addEventListener('DOMContentLoaded', init);
})();