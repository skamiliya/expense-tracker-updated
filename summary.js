/*
 * summary.js - logic for the weekly and monthly summary page.
 *
 * This script reads the existing transactions from localStorage and
 * aggregates expense transactions by ISO week and by month. It then
 * renders bar charts using Chart.js to visualize spending over time.
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
     * Group expenses by ISO week. Returns an object with keys like "2026-W20"
     * and values equal to the total expense for that week.
     * @param {Array<Object>} transactions
     */
    function computeWeeklyExpenses(transactions) {
        const weekly = {};
        transactions.forEach((txn) => {
            if (txn.type !== 'expense') return;
            const d = new Date(txn.date);
            if (isNaN(d)) return;
            const year = d.getFullYear();
            const week = getISOWeek(d);
            const key = `${year}-W${week.toString().padStart(2, '0')}`;
            const amt = parseFloat(txn.amount);
            weekly[key] = (weekly[key] || 0) + amt;
        });
        return weekly;
    }

    /**
     * Group expenses by month. Returns an object with keys like "2026-05"
     * and values equal to the total expense for that month.
     * @param {Array<Object>} transactions
     */
    function computeMonthlyExpenses(transactions) {
        const monthly = {};
        transactions.forEach((txn) => {
            if (txn.type !== 'expense') return;
            const d = new Date(txn.date);
            if (isNaN(d)) return;
            const year = d.getFullYear();
            const month = (d.getMonth() + 1).toString().padStart(2, '0');
            const key = `${year}-${month}`;
            const amt = parseFloat(txn.amount);
            monthly[key] = (monthly[key] || 0) + amt;
        });
        return monthly;
    }

    /**
     * Convert an object of key-value pairs into sorted arrays of labels and
     * data. The keys are sorted chronologically based on their natural
     * ordering (e.g. "2026-W01" < "2026-W02" and "2026-01" < "2026-02").
     * @param {Object} groups
     */
    function toSortedArrays(groups) {
        const keys = Object.keys(groups).sort();
        const labels = keys;
        const data = keys.map((k) => groups[k]);
        return { labels, data };
    }

    /**
     * Render a bar chart given a canvas element, labels and data. Title is used
     * as the chart title and axis label.
     * @param {HTMLCanvasElement} canvas
     * @param {string[]} labels
     * @param {number[]} data
     * @param {string} title
     */
    function renderBarChart(canvas, labels, data, title) {
        // generate colors for each bar using a gradient palette
        const colors = labels.map((_, idx) => {
            const hue = Math.floor((360 / Math.max(labels.length, 1)) * idx);
            return `hsl(${hue}, 70%, 60%)`;
        });
        return new Chart(canvas.getContext('2d'), {
            type: 'bar',
            data: {
                labels: labels,
                datasets: [
                    {
                        label: title,
                        data: data,
                        backgroundColor: colors,
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
                            text: title.includes('Weekly') ? 'Week' : 'Month',
                        },
                    },
                    y: {
                        title: {
                            display: true,
                            text: 'Total Expense',
                        },
                    },
                },
                plugins: {
                    tooltip: {
                        callbacks: {
                            label: function (context) {
                                const val = context.parsed.y;
                                return `${formatCurrency(val)}`;
                            },
                        },
                    },
                },
            },
        });
    }

    /**
     * Initialize summary charts after DOMContentLoaded.
     */
    function init() {
        const transactions = getTransactions();
        const weekly = computeWeeklyExpenses(transactions);
        const monthly = computeMonthlyExpenses(transactions);
        const weeklyArrays = toSortedArrays(weekly);
        const monthlyArrays = toSortedArrays(monthly);
        const weeklyCanvas = document.getElementById('weekly-chart');
        const monthlyCanvas = document.getElementById('monthly-chart');
        renderBarChart(
            weeklyCanvas,
            weeklyArrays.labels,
            weeklyArrays.data,
            'Weekly Expenses'
        );
        renderBarChart(
            monthlyCanvas,
            monthlyArrays.labels,
            monthlyArrays.data,
            'Monthly Expenses'
        );
    }

    document.addEventListener('DOMContentLoaded', init);
})();