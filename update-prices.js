fetch('prices.json')
    .then(response => response.json())
    .then(data => {
        PRICES = data;
        init();
    })
//    .catch(error => console.error('Error loading rates data:', error));

let price_chart;

function fill_missing_years(annual_rates) {
    const filled = [];
    for (let i = 0; i < annual_rates.length - 1; i++) {
        const current = annual_rates[i];
        const next = annual_rates[i + 1];
        filled.push(current);
        const gap = next.year - current.year;
        if (gap > 1) {
            for (let j = 1; j < gap; j++) {
                filled.push({
                    year: current.year + j,
                    registered: current.registered,
                    unregistered: current.unregistered,
                    guest: current.guest
                });
            }
        }
    }
    filled.push(annual_rates[annual_rates.length - 1]);
    return filled;
}


function get_annual_rates(rates, meal) {
    const annual_prices = {};
    rates.forEach(rate => {
        const date = new Date(rate.date);
        const year = date.getFullYear();
        const meal_rate = rate[meal];
        if (meal_rate) {
            const aug1 = new Date(year, 7, 1);
            const days_diff = Math.abs(date - aug1) / (1000 * 60 * 60 * 24);
            if (!annual_prices[year] || days_diff < annual_prices[year].daysDiff) {
                annual_prices[year] = {
                    date: rate.date,
                    daysDiff: days_diff,
                    registered: meal_rate.registered,
                    unregistered: meal_rate.unregistered,
                    guest: meal_rate.guest
                };
            }
        }
    });
    return Object
	.keys(annual_prices)
	.sort()
	.map(y => ({ year: parseInt(y), ...annual_prices[y] }));
}

function update_annual_table(rates, mealType) {
    const annual_rates_table = document.getElementById('annual-rates-table-body');
    annual_rates_table.innerHTML = '';
    const annual_rates = fill_missing_years(get_annual_rates(rates, mealType));
    let prev_reg = null, prev_unreg = null, prev_guest = null;
    annual_rates.forEach(year => {
        const registered = format_annualized_rate_growth(year.registered, prev_reg);
        const unregistered = format_annualized_rate_growth(year.unregistered, prev_unreg);
        const guest = format_annualized_rate_growth(year.guest, prev_guest);
        const row = `
            <tr>
                <td>${year.year}</td>
                <td>${registered}</td>
                <td>${unregistered}</td>
                <td>${guest}</td>
            </tr>
        `;
        annual_rates_table.insertAdjacentHTML('beforeend', row);
        prev_reg = year.registered;
        prev_unreg = year.unregistered;
        prev_guest = year.guest;
    });
}

function update_rates_table(rates, mealType) {
    const rates_table = document.getElementById('rates-table-body');
    rates_table.innerHTML = '';
    let prev_reg = null, prev_unreg = null, prev_guest = null;
    let prev_date = null;
    rates.forEach(rateEntry => {
        const meal_rates = rateEntry[mealType];
        const curr_reg_rate = meal_rates ? meal_rates.registered : null;
        const curr_unreg_rate = meal_rates ? meal_rates.unregistered : null;
        const curr_guest_rate = meal_rates ? meal_rates.guest : null;
        const notes = rateEntry.notes ? rateEntry.notes.join(', ') : '';

        const registered = format_rate_growth(curr_reg_rate, prev_reg);
        const unregistered = format_rate_growth(curr_unreg_rate, prev_unreg);
        const guest = format_rate_growth(curr_guest_rate, prev_guest);
        const row = `
            <tr>
                <td>${rateEntry.date}</td>
                <td>${registered}</td>
                <td>${unregistered}</td>
                <td>${guest}</td>
                <td>${notes}</td>
            </tr>
        `;
        rates_table.insertAdjacentHTML('beforeend', row);
        prev_reg = curr_reg_rate;
        prev_unreg = curr_unreg_rate;
        prev_guest = curr_guest_rate;
        prev_date = rateEntry.date;
    });
}

function format_rate_growth(current, prev) {
    if (current === null) return '<span class="na-text">-</span>';
    let display = `Rs. ${current.toFixed(2)}`;
    if (prev !== null) {
        const absolute = current - prev;
        const percent = prev !== 0 ?
	      (absolute / prev) * 100 :
	      (absolute === 0 ? 0 : Infinity);
        const sign = absolute >= 0 ? '+' : '';

        const growth_dir = absolute > 0 ?
	      'increase-positive' :
	      absolute < 0 ? 'increase-negative' : '';
        const growth = percent === Infinity ?
	      `(${sign}${absolute.toFixed(2)} / Inf%)` :
	      `(${sign}${absolute.toFixed(2)}` + ` / ` +
	      `${percent.toFixed(2)}%)`;
        return `${display} <span class="increase-text ${growth_dir}">${growth}</span>`;
    }
    return display;
}

function format_annualized_rate_growth(current, prev) {
    if (current === null) return '<span class="na-text">-</span>';

    let display = `Rs. ${current.toFixed(2)}`;
    if (prev !== null) {
        const absolute = current - prev;
        const percent = prev !== 0 ?
	      (absolute / prev) * 100 :
	      (absolute === 0 ? 0 : Infinity);
        const sign = absolute >= 0 ? '+' : '';

        const growth_dir = absolute > 0 ?
	      'increase-positive' :
	      absolute < 0 ? 'increase-negative' : '';
        const growth = percent === Infinity ?
	      `(${sign}${absolute.toFixed(2)} / Inf% YoY)` :
	      `(${sign}${absolute.toFixed(2)}` + ` / ` +
	      `${percent.toFixed(2)}% YoY)`;
        return `${display} <span class="increase-text ${growth_dir}">${growth}</span>`;
    }
    return display;
}

/**
 * Updates or initializes the Chart.js graph.
 * @param {Array} rates - The array of rate objects for the selected mess.
 * @param {string} meal - The selected meal type.
 */
function update_chart(rates, meal) {
    const dates = rates.map(entry => entry.date);
    const chart_data = rates.map(entry => ({
        x: entry.date,
        y: entry[meal] ? entry[meal].registered : null
    })).filter(point => point.y !== null); // Remove null values for cleaner chart

    const ctx = document.getElementById('price-chart').getContext('2d');

    if (price_chart) {
        // Update existing chart
        price_chart.data.labels = dates;
        price_chart.data.datasets[0].data = chart_data;
        price_chart.data.datasets[0].label = `Registered Price (${meal.charAt(0).toUpperCase() + meal.slice(1)})`;
        price_chart.update();
    } else {
        // Initialize new chart
        price_chart = new Chart(ctx, {
            type: 'line',
            data: {
                labels: dates,
                datasets: [{
                    label: `Registered Price (${meal.charAt(0).toUpperCase() + meal.slice(1)})`,
                    data: chart_data,
                    borderColor: 'rgb(75, 192, 192)',
                    tension: 0.1,
                    fill: false,
                    pointRadius: 5,
                    pointBackgroundColor: 'rgb(75, 192, 192)'
                }]
            },
            options: {
                responsive: true,
                maintainAspectRatio: false,
                plugins: {
                    title: {
                        display: true,
                        text: 'Registered Meal Price Over Time'
                    }
                },
                scales: {
                    x: {
                        type: 'time',
                        title: {
                            display: true,
                            text: 'Date'
                        }
                    },
                    y: {
                        beginAtZero: false,
                        title: {
                            display: true,
                            text: 'Price (Rs.)'
                        }
                    }
                }
            }
        });
    }
}

function populate_messes() {
    const mess_select = document.getElementById('mess-select');
    mess_select.innerHTML = '';
    PRICES.forEach(mess => {
        const option = document.createElement('option');
        option.value = mess.mess;
        option.textContent = mess.mess;
        mess_select.appendChild(option);
    });
}

function update() {
    const mess = document.getElementById('mess-select').value;
    const meal_type = document.getElementById('meal-select').value;
    const mess_data = PRICES.find(m => m.mess === mess);
    if (mess_data) {
        update_rates_table(mess_data.rates, meal_type);
        update_annual_table(mess_data.rates, meal_type);
        update_chart(mess_data.rates, meal_type);
    }
}

function init() {
    populate_messes();
    document.getElementById('mess-select').value = 'Palash-South';
    document.getElementById('meal-select').value = 'breakfast';
    update();
    document.getElementById('mess-select').addEventListener('change', update);
    document.getElementById('meal-select').addEventListener('change', update);
}

window.onload = init;
