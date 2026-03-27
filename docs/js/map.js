let map, pickerMap;
let markerClusterGroup;
let heatmapLayer;
let allEventsData = [];
let eventTypesMap = {}; // name -> {icon, color}

const ISRAEL_CENTER = [31.7683, 35.2137]; // Approx center

// Set up Map on init
export function initMaps() {
    map = L.map('main-map').setView(ISRAEL_CENTER, 8);
    
    // Using OpenStreetMap dark matter alternative if possible, falling back to standard
    L.tileLayer('https://{s}.basemaps.cartocdn.com/dark_all/{z}/{x}/{y}{r}.png', {
        attribution: '&copy; OpenStreetMap contributors &copy; CARTO'
    }).addTo(map);

    markerClusterGroup = L.markerClusterGroup({
        chunkedLoading: true,
        maxClusterRadius: 40,
        disableClusteringAtZoom: 14 // Explode clusters deep zoom
    });
    map.addLayer(markerClusterGroup);

    // Picker map
    pickerMap = L.map('picker-map').setView(ISRAEL_CENTER, 8);
    L.tileLayer('https://{s}.basemaps.cartocdn.com/dark_all/{z}/{x}/{y}{r}.png').addTo(pickerMap);

    // Re-render map when tab opens
    window.addEventListener('tabChanged', (e) => {
        if(e.detail.tabId === 'map-tab') {
            setTimeout(() => { map.invalidateSize(); }, 200);
        }
    });

    setupMapPicker();
}

function setupMapPicker() {
    const pickBtn = document.getElementById('btn-map-pick');
    const modal = document.getElementById('map-picker-modal');
    const confirmBtn = document.getElementById('btn-confirm-pick');
    const cancelBtn = document.getElementById('btn-cancel-pick');
    
    let tempMarker = null;

    pickBtn.addEventListener('click', () => {
        modal.classList.remove('hidden');
        setTimeout(() => { pickerMap.invalidateSize(); }, 300);
    });

    cancelBtn.addEventListener('click', () => {
        modal.classList.add('hidden');
    });

    pickerMap.on('click', (e) => {
        if(tempMarker) pickerMap.removeLayer(tempMarker);
        tempMarker = L.marker(e.latlng).addTo(pickerMap);
    });

    confirmBtn.addEventListener('click', () => {
        if(tempMarker) {
            const loc = tempMarker.getLatLng();
            document.getElementById('location-lat').value = loc.lat;
            document.getElementById('location-lng').value = loc.lng;
            document.getElementById('location-display').value = `נ.צ: ${loc.lat.toFixed(4)}, ${loc.lng.toFixed(4)}`;
            modal.classList.add('hidden');
        } else {
            alert("אנא לחץ על המפה לבחירת מיקום");
        }
    });
}

// Save event types cache to render custom icons
export function setEventTypesCache(typesList) {
    eventTypesMap = {};
    typesList.forEach(t => {
        eventTypesMap[t.name] = t;
    });
}

// Render Events on map
export function renderEventsOnMap(events) {
    allEventsData = events; // save for heatmap
    
    markerClusterGroup.clearLayers();
    if(heatmapLayer) map.removeLayer(heatmapLayer);

    const latlngsHeat = [];

    events.forEach(ev => {
        if(ev.location && ev.location.lat && ev.location.lng) {
            const latLng = [ev.location.lat, ev.location.lng];
            latlngsHeat.push(latLng);
            
            // Build custom Icon
            let tColor = '#ffffff';
            let tIcon = 'question';
            if(eventTypesMap[ev.eventType]) {
                tColor = eventTypesMap[ev.eventType].color;
                tIcon = eventTypesMap[ev.eventType].icon;
            }

            // Create a custom tactical HTML icon with FontAwesome
            const iconHtml = `
                <div style="background-color: ${tColor}; width: 30px; height: 30px; border-radius: 50%; display: flex; justify-content: center; align-items: center; border: 2px solid #fff; box-shadow: 0 0 5px rgba(0,0,0,0.5);">
                    <i class="fas fa-${tIcon}" style="color: #000; font-size: 14px;"></i>
                </div>
            `;

            const customIcon = L.divIcon({
                html: iconHtml,
                className: 'tactical-marker',
                iconSize: [30, 30],
                iconAnchor: [15, 15]
            });

            const popupContent = `
                <div style="min-width: 200px;">
                    <h3 style="color: ${tColor}; margin-bottom: 5px; border-bottom: 1px solid #444; padding-bottom: 5px;">
                        <i class="fas fa-${tIcon}"></i> ${ev.eventType}
                    </h3>
                    <p><strong>גזרה:</strong> ${ev.sector}</p>
                    <p><strong>מדווח:</strong> ${ev.reporterName} (${ev.role})</p>
                    <p><strong>הערות:</strong> ${ev.notes || '-'}</p>
                    ${ev.hasCasualties ? `<p style="color: #f44336;"><strong>נפגעים:</strong> ${ev.casualtiesDetails}</p>` : ''}
                    ${ev.hasDamage ?  `<p style="color: #ff9800;"><strong>נזק:</strong> ${ev.damageDetails}</p>` : ''}
                </div>
            `;

            const marker = L.marker(latLng, { icon: customIcon }).bindPopup(popupContent);
            markerClusterGroup.addLayer(marker);
        }
    });

    // Create heatmap but don't add to map immediately unless toggled
    if (latlngsHeat.length > 0 && typeof L.heatLayer !== 'undefined') {
        heatmapLayer = L.heatLayer(latlngsHeat, {
            radius: 25,
            blur: 15,
            gradient: {0.4: 'blue', 0.6: 'lime', 0.8: 'yellow', 1.0: 'red'}
        });
    }
}

export function setupHeatmapToggle() {
    const btn = document.getElementById('toggle-heatmap');
    let isHeat = false;

    btn.addEventListener('click', () => {
        isHeat = !isHeat;
        if(isHeat) {
            btn.classList.replace('secondary-btn', 'primary-btn');
            map.removeLayer(markerClusterGroup);
            if(heatmapLayer) map.addLayer(heatmapLayer);
        } else {
            btn.classList.replace('primary-btn', 'secondary-btn');
            if(heatmapLayer) map.removeLayer(heatmapLayer);
            map.addLayer(markerClusterGroup);
        }
    });
}
