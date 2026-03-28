let chartInstance = null;

export function updateDashboard(eventsData) {
    document.getElementById('stat-total').innerText = eventsData.length;
    
    // Calculate today's events
    const today = new Date();
    today.setHours(0,0,0,0);
    const todayEvents = eventsData.filter(ev => {
        if (!ev.createdAt) return false;
        const evDate = ev.createdAt.toDate ? ev.createdAt.toDate() : new Date(ev.createdAt);
        return evDate >= today;
    });
    document.getElementById('stat-today').innerText = todayEvents.length;

    renderChart(eventsData);
}

function renderChart(eventsData) {
    const ctx = document.getElementById('sector-chart').getContext('2d');
    
    // Group events by sector then by event type
    // Example: { 'גזרה א': { 'פחע': 2, 'תנועה': 1 }, ... }
    const sectorStats = {};
    const typeSet = new Set();

    eventsData.forEach(ev => {
        const s = ev.sector || 'לא ידוע';
        const t = ev.eventType || 'אחר';
        if (!sectorStats[s]) sectorStats[s] = {};
        if (!sectorStats[s][t]) sectorStats[s][t] = 0;
        sectorStats[s][t]++;
        typeSet.add(t);
    });

    const labels = Object.keys(sectorStats);
    const types = Array.from(typeSet);

    // Generate datasets (stacked bar per event type)
    const datasets = types.map((type, i) => {
        // Predefined nice dashboard colors if eventtype map doesn't have it
        const colorPalette = ['#e6194b', '#3cb44b', '#ffe119', '#4363d8', '#f58231', '#911eb4', '#46f0f0', '#f032e6'];
        const color = eventTypesMap[type] ? eventTypesMap[type].color : colorPalette[i % colorPalette.length];
        
        return {
            label: type,
            data: labels.map(label => sectorStats[label][type] || 0),
            backgroundColor: color,
            borderColor: color,
            borderWidth: 1
        };
    });

    if (chartInstance) {
        chartInstance.destroy();
    }

    Chart.defaults.color = '#ffffff';
    Chart.defaults.font.family = "'Segoe UI', Tahoma, Geneva, Verdana, sans-serif";
    Chart.register(ChartDataLabels);

    chartInstance = new Chart(ctx, {
        type: 'bar',
        data: {
            labels: labels,
            datasets: datasets
        },
        options: {
            responsive: true,
            maintainAspectRatio: false,
            scales: {
                x: { stacked: true },
                y: { stacked: true, beginAtZero: true, grid: { color: '#333' } }
            },
            plugins: {
                legend: { position: 'bottom' },
                datalabels: {
                    color: '#fff',
                    font: { weight: 'bold', size: 14 },
                    formatter: function(value, context) {
                        return value > 0 ? value : '';
                    }
                }
            }
        }
    });
}

// Map eventType cache local reference to provide colors
let eventTypesMap = {};
export function setDashboardEventTypesCache(typesList) {
    eventTypesMap = {};
    typesList.forEach(t => {
        eventTypesMap[t.name] = t;
    });
}
