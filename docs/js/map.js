let map, pickerMap;
let markerClusterGroup;
let heatmapLayer;
let allEventsData = [];
let eventTypesMap = {}; // name -> {icon, color}
let mapFilters = { type: 'all', time: 'all' };

const ISRAEL_CENTER = [31.5, 34.8]; // Approx center

// Callbacks
let onMainMapPickCallback = null;

export function initMaps() {
    map = L.map('main-map').setView(ISRAEL_CENTER, 8);
    
    // ESRI World Imagery for Satellite view
    L.tileLayer('https://server.arcgisonline.com/ArcGIS/rest/services/World_Imagery/MapServer/tile/{z}/{y}/{x}', {
        attribution: 'Tiles &copy; Esri'
    }).addTo(map);

    markerClusterGroup = L.markerClusterGroup({
        chunkedLoading: true,
        maxClusterRadius: 40,
        disableClusteringAtZoom: 14 // Explode clusters deep zoom
    });
    map.addLayer(markerClusterGroup);

    // Picker map
    pickerMap = L.map('picker-map').setView(ISRAEL_CENTER, 8);
    L.tileLayer('https://server.arcgisonline.com/ArcGIS/rest/services/World_Imagery/MapServer/tile/{z}/{y}/{x}').addTo(pickerMap);

    window.addEventListener('tabChanged', (e) => {
        if(e.detail.tabId === 'map-tab') {
            setTimeout(() => { map.invalidateSize(); }, 200);
        }
    });

    setupMapPicker();

    // Main map pick listener for FAB
    map.on('click', (e) => {
        if(onMainMapPickCallback) {
            onMainMapPickCallback(e.latlng);
        }
    });

    // GPS Center function
    document.getElementById('center-gps').addEventListener('click', () => {
        if ("geolocation" in navigator) {
            navigator.geolocation.getCurrentPosition((position) => {
                map.setView([position.coords.latitude, position.coords.longitude], 14);
            }, (error) => {
                console.error("GPS Error", error);
                alert("לא ניתן לקבל מיקום נוכחי");
            });
        }
    });
}

export function enableMainMapPickMode(callback) {
    onMainMapPickCallback = callback;
    document.getElementById('main-map').style.cursor = 'crosshair';
}

export function disableMainMapPickMode() {
    onMainMapPickCallback = null;
    document.getElementById('main-map').style.cursor = '';
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

export function setEventTypesCache(typesList) {
    eventTypesMap = {};
    typesList.forEach(t => {
        eventTypesMap[t.name] = t;
    });
}

export function setMapFilters(type, hours) {
    mapFilters = { type, time: hours };
    applyMapFiltersAndRender();
}

function passesFilters(ev) {
    if(mapFilters.type !== 'all' && ev.eventType !== mapFilters.type) return false;
    
    if(mapFilters.time !== 'all') {
        const hoursBack = parseInt(mapFilters.time);
        const cutoff = new Date().getTime() - (hoursBack * 60 * 60 * 1000);
        if(!ev.eventTime || ev.eventTime < cutoff) return false;
    }
    return true;
}

export function renderEventsOnMap(events, autoBounds = true) {
    allEventsData = events; 
    applyMapFiltersAndRender(autoBounds);
}

function applyMapFiltersAndRender(autoBounds = false) {
    markerClusterGroup.clearLayers();
    if(heatmapLayer) map.removeLayer(heatmapLayer);

    const latlngsHeat = [];
    const filteredEvents = allEventsData.filter(passesFilters);

    filteredEvents.forEach(ev => {
        if(ev.location && ev.location.lat && ev.location.lng) {
            const latLng = [ev.location.lat, ev.location.lng];
            latlngsHeat.push(latLng);
            
            let tColor = '#ffffff';
            let tIcon = 'question';
            if(eventTypesMap[ev.eventType]) {
                tColor = eventTypesMap[ev.eventType].color;
                tIcon = eventTypesMap[ev.eventType].icon;
            }

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

    if(autoBounds && filteredEvents.length > 0) {
        // Find hottest area (highest density of events nearby)
        let bestPoint = null;
        let maxCount = -1;
        filteredEvents.forEach(e1 => {
           if(!e1.location || !e1.location.lat || !e1.location.lng) return;
           let count = 0;
           filteredEvents.forEach(e2 => {
              if(!e2.location || !e2.location.lat || !e2.location.lng) return;
              // rough distance calculation (squared)
              let dx = e1.location.lat - e2.location.lat;
              let dy = e1.location.lng - e2.location.lng;
              if (dx*dx + dy*dy < 0.05) count++; 
           });
           if (count > maxCount) { 
               maxCount = count; 
               bestPoint = e1.location; 
           }
        });

        if (bestPoint) {
            map.setView([bestPoint.lat, bestPoint.lng], 13);
        } else {
            const bounds = markerClusterGroup.getBounds();
            if(bounds.isValid()) map.fitBounds(bounds, { padding: [50, 50] });
        }
    }

    if (latlngsHeat.length > 0 && typeof L.heatLayer !== 'undefined') {
        heatmapLayer = L.heatLayer(latlngsHeat, {
            radius: 40,
            blur: 25,
            maxZoom: 10,
            gradient: {0.3: 'blue', 0.5: 'lime', 0.7: 'yellow', 1.0: 'red'}
        });
        
        // If heatmap was active, refresh it
        const btn = document.getElementById('toggle-heatmap');
        if(btn.classList.contains('active-heat')) {
            map.addLayer(heatmapLayer);
            map.removeLayer(markerClusterGroup);
        }
    }
}

export function setupHeatmapToggle() {
    const btn = document.getElementById('toggle-heatmap');

    btn.addEventListener('click', () => {
        const isHeat = btn.classList.contains('active-heat');
        if(!isHeat) { // turning it on
            btn.classList.add('active-heat', 'primary-btn');
            map.removeLayer(markerClusterGroup);
            if(heatmapLayer) map.addLayer(heatmapLayer);
        } else { // turning it off
            btn.classList.remove('active-heat', 'primary-btn');
            if(heatmapLayer) map.removeLayer(heatmapLayer);
            map.addLayer(markerClusterGroup);
        }
    });
}
