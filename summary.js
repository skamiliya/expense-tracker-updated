/*
 * summary.js - logic for the weekly and monthly summary page.
 *
 * This script reads the existing transactions from localStorage and
 * aggregates expense transactions by ISO week and by month. It then
 * renders bar charts using Chart.js to visualize spending over time.
 */

// Wrap everything in an IIFE to avoid polluting the global scope
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
     * Convert an ISO week number and year into the start (Monday) date of that week.
     * Adapted from: https://stackoverflow.com/a/6117917
     * @param {number} week
     * @param {number} year
     * @returns {Date} Date object representing the Monday of the ISO week
     */
    function getDateOfISOWeek(week, year) {
        // Create a simple date from the first day of the year and advance to the week
        const simple = new Date(year, 0, 1 + (week - 1) * 7);
        // ISO weeks start on Monday. Adjust backwards to Monday if we're past Thursday; else forward
        const day = simple.getDay();
        // JS getDay: 0=Sunday, 1=Monday, ... 6=Saturday
        if (day <= 4) {
            simple.setDate(simple.getDate() - day + 1);
        } else {
            simple.setDate(simple.getDate() + 8 - day);
        }
        return simple;
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
     * Render the summary for a specific period and append it to a provided container.
     * Unlike the previous implementation, this function no longer clears the main
     * summary container. Instead, the caller is responsible for determining
     * where to append the summary section. It reuses existing grouping logic.
     *
     * @param {string} periodType 'weekly' or 'monthly'
     * @param {string} periodKey The selected period key (e.g. '2026-W19' or '2026-05')
     * @param {HTMLElement} appendTo The container element to append the summary section to
     */
    function renderSummary(periodType, periodKey, appendTo) {
        const transactions = getTransactions();
        const grouped = groupTransactions(transactions, periodType);
        if (!grouped[periodKey]) {
            // Skip rendering if there's no data for the period
            return;
        }
        const item = grouped[periodKey];
        const section = document.createElement('section');
        section.className = 'chart-container';
        // Period title. Show a date range for weekly periods.
        const header = document.createElement('h3');
        if (periodType === 'weekly' && periodKey.includes('-W')) {
            const parts = periodKey.split('-W');
            const year = parseInt(parts[0], 10);
            const week = parseInt(parts[1], 10);
            const startDate = getDateOfISOWeek(week, year);
            const endDate = new Date(startDate);
            endDate.setDate(startDate.getDate() + 6);
            const format = (date) => {
                const y = date.getFullYear();
                const m = String(date.getMonth() + 1).padStart(2, '0');
                const d = String(date.getDate()).padStart(2, '0');
                return `${y}-${m}-${d}`;
            };
            header.textContent = `${format(startDate)} - ${format(endDate)}`;
        } else {
            header.textContent = periodKey;
        }
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
            pieDiv.className = 'pie-chart';
            pieDiv.style.background = `conic-gradient(${gradientStr})`;
            const center = document.createElement('div');
            center.className = 'center';
            pieDiv.appendChild(center);
            section.appendChild(pieDiv);
        }
        // Append ranking list below the chart
        if (ranking.length > 0) {
            const rankingDiv = document.createElement('div');
            rankingDiv.style.marginTop = '0.5rem';
            const rankingTitle = document.createElement('p');
            rankingTitle.style.fontWeight = 'bold';
            rankingTitle.textContent = 'Category Ranking';
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
            section.appendChild(rankingDiv);
        }
        // Append the section to the provided container
        appendTo.appendChild(section);
    }


    /**
     * Aggregate transactions within a date range. Only transactions whose date
     * falls between startDate and endDate (inclusive) are considered. Income
     * and expense totals are summed separately, and expense categories are
     * accumulated.
     *
     * @param {Array<Object>} transactions
     * @param {Date} startDate
     * @param {Date} endDate
     * @returns {{totalIncome: number, totalExpense: number, categories: Object<string,number>}}
     */
    function aggregateTransactionsInRange(transactions, startDate, endDate) {
        const result = {
            totalIncome: 0,
            totalExpense: 0,
            categories: {},
        };
        transactions.forEach((txn) => {
            const d = new Date(txn.date);
            if (isNaN(d)) return;
            if (d >= startDate && d <= endDate) {
                const amt = parseFloat(txn.amount);
                if (txn.type === 'income') {
                    result.totalIncome += amt;
                } else if (txn.type === 'expense') {
                    result.totalExpense += amt;
                    const cat = txn.category;
                    result.categories[cat] = (result.categories[cat] || 0) + amt;
                }
            }
        });
        return result;
    }

    /**
     * Generate an array of unique ISO week keys between two dates (inclusive).
     * The list is sorted in ascending order by year-week. It is possible for
     * startDate to be after endDate; in that case, the two dates are swapped.
     *
     * @param {Date} startDate
     * @param {Date} endDate
     * @returns {string[]} Array of week keys in format 'YYYY-Wnn'
     */
    function listWeeksInRange(startDate, endDate) {
        let s = new Date(startDate);
        let e = new Date(endDate);
        if (s > e) {
            const tmp = s;
            s = e;
            e = tmp;
        }
        const set = new Set();
        const iter = new Date(s);
        while (iter <= e) {
            const week = getISOWeek(iter).toString().padStart(2, '0');
            const key = `${iter.getFullYear()}-W${week}`;
            set.add(key);
            iter.setDate(iter.getDate() + 1);
        }
        // Sort the keys by year then week
        return Array.from(set).sort((a, b) => {
            const [yA, wA] = a.split('-W').map((v) => parseInt(v, 10));
            const [yB, wB] = b.split('-W').map((v) => parseInt(v, 10));
            return yA === yB ? wA - wB : yA - yB;
        });
    }

    /**
     * Generate an array of month keys between two months (inclusive). The month
     * keys are in format 'YYYY-MM'. If start > end, the two are swapped.
     *
     * @param {string} startMonthKey Format 'YYYY-MM'
     * @param {string} endMonthKey Format 'YYYY-MM'
     * @returns {string[]} Array of month keys
     */
    function listMonthsInRange(startMonthKey, endMonthKey) {
        const parseKey = (key) => {
            const [y, m] = key.split('-').map((v) => parseInt(v, 10));
            return { y, m };
        };
        let { y: sy, m: sm } = parseKey(startMonthKey);
        let { y: ey, m: em } = parseKey(endMonthKey);
        // Normalize: if start > end, swap
        if (sy > ey || (sy === ey && sm > em)) {
            [sy, sm, ey, em] = [ey, em, sy, sm];
        }
        const result = [];
        let cy = sy;
        let cm = sm;
        while (cy < ey || (cy === ey && cm <= em)) {
            result.push(`${cy}-${String(cm).padStart(2, '0')}`);
            cm++;
            if (cm > 12) {
                cm = 1;
                cy++;
            }
        }
        return result;
    }

    /**
     * Render an aggregated summary for a range of dates. Shows total income,
     * total expense, and a pie chart of expense categories. The header shows
     * the date range in YYYY-MM-DD format.
     *
     * @param {Date} startDate
     * @param {Date} endDate
     */
    function renderAggregatedSummary(startDate, endDate) {
        const container = document.getElementById('summary-card');
        container.innerHTML = '';
        if (!startDate || !endDate) return;
        const transactions = getTransactions();
        const agg = aggregateTransactionsInRange(transactions, startDate, endDate);
        const section = document.createElement('section');
        section.className = 'chart-container';
        // Header: show date range
        const header = document.createElement('h3');
        const format = (date) => {
            const y = date.getFullYear();
            const m = String(date.getMonth() + 1).padStart(2, '0');
            const d = String(date.getDate()).padStart(2, '0');
            return `${y}-${m}-${d}`;
        };
        header.textContent = `${format(startDate)} - ${format(endDate)}`;
        section.appendChild(header);
        // Totals display
        const totalsDiv = document.createElement('div');
        totalsDiv.style.display = 'flex';
        totalsDiv.style.justifyContent = 'space-between';
        totalsDiv.style.marginBottom = '0.5rem';
        const incomeP = document.createElement('p');
        incomeP.textContent = `Total Income: ${formatCurrency(agg.totalIncome)}`;
        const expenseP = document.createElement('p');
        expenseP.textContent = `Total Expense: ${formatCurrency(agg.totalExpense)}`;
        totalsDiv.appendChild(incomeP);
        totalsDiv.appendChild(expenseP);
        section.appendChild(totalsDiv);
        // Pie chart of aggregated categories
        const catLabels = Object.keys(agg.categories);
        const catData = catLabels.map((k) => agg.categories[k]);
        const total = catData.reduce((sum, v) => sum + v, 0);
        const colors = generateColors(catLabels.length);
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
            pieDiv.className = 'pie-chart';
            pieDiv.style.background = `conic-gradient(${gradientStr})`;
            const center = document.createElement('div');
            center.className = 'center';
            pieDiv.appendChild(center);
            section.appendChild(pieDiv);
        }
        // Ranking list for aggregated categories
        if (catLabels.length > 0) {
            const ranking = catLabels
                .map((label, idx) => ({ label, value: catData[idx] }))
                .sort((a, b) => b.value - a.value);
            const rankingDiv = document.createElement('div');
            rankingDiv.style.marginTop = '0.5rem';
            const rankingTitle = document.createElement('p');
            rankingTitle.style.fontWeight = 'bold';
            rankingTitle.textContent = 'Category Ranking';
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
            section.appendChild(rankingDiv);
        }
        container.appendChild(section);
    }

    /**
     * Render range summaries for weekly and monthly periods based on user input.
     * This function reads the values from the date range inputs, calculates
     * aggregated totals, and renders per-period breakdowns.
     */
    function renderRangeSummaries() {
        // Get DOM elements
        const weeklyStartEl = document.getElementById('weekly-start');
        const weeklyEndEl = document.getElementById('weekly-end');
        const monthlyStartEl = document.getElementById('monthly-start');
        const monthlyEndEl = document.getElementById('monthly-end');
        const weeklyBreakdown = document.getElementById('weekly-breakdown');
        const monthlyBreakdown = document.getElementById('monthly-breakdown');
        const weeklyTitle = document.getElementById('weekly-title');
        const monthlyTitle = document.getElementById('monthly-title');
        // Clear existing breakdowns
        weeklyBreakdown.innerHTML = '';
        monthlyBreakdown.innerHTML = '';
        // Parse weekly dates
        const ws = weeklyStartEl.value ? new Date(weeklyStartEl.value) : null;
        const we = weeklyEndEl.value ? new Date(weeklyEndEl.value) : null;
        if (ws && we) {
            // Render aggregated summary for the weekly date range
            renderAggregatedSummary(ws, we);
            // List ISO week keys within range and render each summary
            const weekKeys = listWeeksInRange(ws, we);
            if (weekKeys.length > 0) {
                weeklyTitle.style.display = '';
                weekKeys.forEach((key) => {
                    renderSummary('weekly', key, weeklyBreakdown);
                });
            } else {
                weeklyTitle.style.display = 'none';
            }
        } else {
            // If weekly range is incomplete, clear aggregated summary and hide weekly title
            document.getElementById('summary-card').innerHTML = '';
            weeklyTitle.style.display = 'none';
        }
        // Parse monthly range
        const ms = monthlyStartEl.value;
        const me = monthlyEndEl.value;
        if (ms && me) {
            const monthKeys = listMonthsInRange(ms, me);
            if (monthKeys.length > 0) {
                monthlyTitle.style.display = '';
                monthKeys.forEach((key) => {
                    renderSummary('monthly', key, monthlyBreakdown);
                });
            } else {
                monthlyTitle.style.display = 'none';
            }
        } else {
            monthlyTitle.style.display = 'none';
        }
    }


    /**
     * Initialize the summary page: set up default date ranges and attach
     * event listeners to the Load button. The default weekly range is the
     * current ISO week (Monday through Sunday). The default monthly range is
     * the current month. Once initialized, the summaries for these ranges
     * are rendered automatically.
     */
    function init() {
        const weeklyStartEl = document.getElementById('weekly-start');
        const weeklyEndEl = document.getElementById('weekly-end');
        const monthlyStartEl = document.getElementById('monthly-start');
        const monthlyEndEl = document.getElementById('monthly-end');
        const loadBtn = document.getElementById('load-summary');
        const today = new Date();
        // Compute current ISO week start (Monday) and end (Sunday)
        const currentWeek = getISOWeek(today);
        const weekStart = getDateOfISOWeek(currentWeek, today.getFullYear());
        const weekEnd = new Date(weekStart);
        weekEnd.setDate(weekStart.getDate() + 6);
        // Default weekly range
        weeklyStartEl.value = weekStart.toISOString().substring(0, 10);
        weeklyEndEl.value = weekEnd.toISOString().substring(0, 10);
        // Default monthly range: current month
        const month = String(today.getMonth() + 1).padStart(2, '0');
        const year = today.getFullYear();
        const monthKey = `${year}-${month}`;
        monthlyStartEl.value = monthKey;
        monthlyEndEl.value = monthKey;
        // Event listener for Load button
        loadBtn.addEventListener('click', () => {
            renderRangeSummaries();
        });
        // Render initial summaries
        renderRangeSummaries();
    }

    document.addEventListener('DOMContentLoaded', init);
})();