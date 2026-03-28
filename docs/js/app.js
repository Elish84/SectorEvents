import { initAuth } from './auth.js';
import { checkIfAdmin, checkIfManager, seedInitialData, subscribeToCollection, subscribeToEvents, createEvent, deleteDocument, updateDocument } from './api.js';
import { renderDropdown, setupTabs, showNotification, formatTimestamp } from './ui.js';
import { initMaps, renderEventsOnMap, setupHeatmapToggle, setEventTypesCache, enableMainMapPickMode, disableMainMapPickMode, setMapFilters } from './map.js';
import { updateDashboard, setDashboardEventTypesCache } from './dashboard.js';
import { setupAdminForms, renderAdminList } from './admin.js';

let isAdminUser = false;
let isManagerUser = false;
let typesCache = [];
let allEventsCache = [];
let sectorsCache = [];
let rolesCache = [];

document.addEventListener('DOMContentLoaded', () => {
    // 1. Initialize public things immediately
    initMaps();
    setupHeatmapToggle();
    setupEventForm();
    setupMapInteractions();
    
    // Bind public subscriptions (Dropdowns)
    bindPublicSubscriptions();

    // 2. Auth pipeline starts App for authenticated users
    initAuth(async (user) => {
        isAdminUser = await checkIfAdmin(user.uid);
        isManagerUser = await checkIfManager(user.uid);
        import('./ui.js').then(({setupTabs}) => setupTabs(isManagerUser));
        
        if (isManagerUser) {
           await seedInitialData();
           import('./admin.js').then(({setupAdminForms, renderAdminList}) => {
               setupAdminForms();
               renderAdminList('admin-sectors-list', sectorsCache, 'sectors');
               renderAdminList('admin-roles-list', rolesCache, 'roles');
               renderAdminList('admin-event-types-list', typesCache, 'eventTypes');
           });
        }

        setupDashboardInteractions();
        setupRecordsInteractions();
        bindPrivateSubscriptions();
    });
});

function bindPublicSubscriptions() {
    // Sectors
    subscribeToCollection('sectors', (items) => {
        sectorsCache = items;
        renderDropdown('sector-select', items, 'בחר גזרה...');
        renderDropdown('edit-sector-select', items, 'בחר גזרה...');
        
        // Populate records filter
        const filterSelect = document.getElementById('record-filter-sector');
        filterSelect.innerHTML = '<option value="all">הכל</option>';
        
        // Populate dashboard filter
        const dashFilterSector = document.getElementById('dash-filter-sector');
        if (dashFilterSector) dashFilterSector.innerHTML = '<option value="all">הכל</option>';

        items.forEach(s => {
            const opt1 = document.createElement('option');
            opt1.value = opt1.textContent = s.name;
            filterSelect.appendChild(opt1);
            
            if (dashFilterSector) {
                const opt2 = document.createElement('option');
                opt2.value = opt2.textContent = s.name;
                dashFilterSector.appendChild(opt2);
            }
        });

        if (isAdminUser) renderAdminList('admin-sectors-list', items, 'sectors');
    });

    // Roles
    subscribeToCollection('roles', (items) => {
        rolesCache = items;
        renderDropdown('role-select', items, 'בחר תפקיד...');
        renderDropdown('edit-role-select', items, 'בחר תפקיד...');
        if (isAdminUser) renderAdminList('admin-roles-list', items, 'roles');
    });

    // Event Types
    subscribeToCollection('eventTypes', (items) => {
        typesCache = items;
        setEventTypesCache(items);
        setDashboardEventTypesCache(items);
        renderDropdown('event-type-select', items, 'בחר סוג אירוע...');
        renderDropdown('edit-event-type-select', items, 'בחר סוג אירוע...');
        
        // Map filter types & Dashboard filter types
        const mapFilterType = document.getElementById('map-filter-type');
        mapFilterType.innerHTML = '<option value="all">הכל</option>';
        
        const dashFilterType = document.getElementById('dash-filter-type');
        if (dashFilterType) dashFilterType.innerHTML = '<option value="all">הכל</option>';

        items.forEach(t => {
            const opt1 = document.createElement('option');
            opt1.value = opt1.textContent = t.name;
            mapFilterType.appendChild(opt1);
            
            if (dashFilterType) {
                const opt2 = document.createElement('option');
                opt2.value = opt2.textContent = t.name;
                dashFilterType.appendChild(opt2);
            }
        });

        if (isManagerUser) renderAdminList('admin-event-types-list', items, 'eventTypes');
    });
}

function bindPrivateSubscriptions() {
    // Events - with real time notification
    subscribeToEvents((events) => {
        allEventsCache = events;
        renderEventsOnMap(events, true); // initial auto bounds
        updateDashboard(events);
        renderEventsTable();
    }, (newEvent) => {
        import('./ui.js').then(({ showNotification }) => {
            showNotification(`אירוע חדש בגזרה: ${newEvent.eventType}`, 'error', {
                text: 'מרכז',
                onClick: () => {
                    import('./map.js').then(({ centerMapOnEvent }) => {
                        centerMapOnEvent(newEvent);
                    });
                }
            });
        });
    });
}

// --- Map FAB & Filters ---
function setupMapInteractions() {
    const fabButton = document.getElementById('fab-add-event');
    const msgBox = document.getElementById('map-pick-mode-msg');
    const cancelPickBtn = document.getElementById('btn-cancel-fab-pick');

    fabButton.addEventListener('click', () => {
        msgBox.classList.remove('hidden');
        enableMainMapPickMode((latlng) => {
            document.getElementById('location-lat').value = latlng.lat;
            document.getElementById('location-lng').value = latlng.lng;
            document.getElementById('location-display').value = `נ.צ: ${latlng.lat.toFixed(4)}, ${latlng.lng.toFixed(4)}`;
            msgBox.classList.add('hidden');
            disableMainMapPickMode();
            // Switch to form tab
            document.querySelector('[data-tab="form-tab"]').click();
        });
    });

    cancelPickBtn.addEventListener('click', () => {
        msgBox.classList.add('hidden');
        disableMainMapPickMode();
    });

    // Map filters modal
    const btnFilterMap = document.getElementById('filter-map');
    const filterModal = document.getElementById('map-filter-modal');
    
    btnFilterMap.addEventListener('click', () => filterModal.classList.remove('hidden'));
    document.getElementById('btn-close-map-filter').addEventListener('click', () => filterModal.classList.add('hidden'));
    
    document.getElementById('btn-apply-map-filter').addEventListener('click', () => {
        const type = document.getElementById('map-filter-type').value;
        const time = document.getElementById('map-filter-time').value;
        setMapFilters(type, time);
        filterModal.classList.add('hidden');
        showNotification('סינון הוחל בהצלחה');
    });
}


// --- Form Logic ---
function setupEventForm() {
    const timeInput = document.getElementById('event-time');
    const now = new Date();
    now.setMinutes(now.getMinutes() - now.getTimezoneOffset());
    timeInput.value = now.toISOString().slice(0, 16);

    const formHasCasualties = document.getElementById('has-casualties');
    const casualtiesDetails = document.getElementById('casualties-details');
    formHasCasualties.addEventListener('change', (e) => {
        if(e.target.checked) casualtiesDetails.classList.remove('hidden');
        else { casualtiesDetails.classList.add('hidden'); casualtiesDetails.value = ''; }
    });

    const formHasDamage = document.getElementById('has-damage');
    const damageDetails = document.getElementById('damage-details');
    formHasDamage.addEventListener('change', (e) => {
        if(e.target.checked) damageDetails.classList.remove('hidden');
        else { damageDetails.classList.add('hidden'); damageDetails.value = ''; }
    });

    const btnGps = document.getElementById('btn-gps');
    btnGps.addEventListener('click', () => {
        if ("geolocation" in navigator) {
            btnGps.innerText = "מחפש...";
            navigator.geolocation.getCurrentPosition((position) => {
                document.getElementById('location-lat').value = position.coords.latitude;
                document.getElementById('location-lng').value = position.coords.longitude;
                document.getElementById('location-display').value = `נ.צ: ${position.coords.latitude.toFixed(4)}, ${position.coords.longitude.toFixed(4)}`;
                btnGps.innerHTML = '<i class="fas fa-crosshairs"></i> מיקום נמצא';
            }, (error) => {
                showNotification("לא ניתן לקבל מיקום: " + error.message, 'error');
                btnGps.innerHTML = '<i class="fas fa-crosshairs"></i> נסה שוב';
            });
        }
    });

    document.getElementById('event-form').addEventListener('submit', async (e) => {
        e.preventDefault();
        const timestamp = new Date(timeInput.value).getTime();

        const data = {
            eventTime: timestamp,
            reporterName: document.getElementById('reporter-name').value,
            role: document.getElementById('role-select').value,
            sector: document.getElementById('sector-select').value,
            missionName: document.getElementById('mission-name').value,
            eventType: document.getElementById('event-type-select').value,
            location: {
                lat: parseFloat(document.getElementById('location-lat').value),
                lng: parseFloat(document.getElementById('location-lng').value),
            },
            hasCasualties: formHasCasualties.checked,
            casualtiesDetails: formHasCasualties.checked ? casualtiesDetails.value : "",
            hasDamage: formHasDamage.checked,
            damageDetails: formHasDamage.checked ? damageDetails.value : "",
            notes: document.getElementById('event-notes').value
        };

        if(!data.location.lat || !data.location.lng || isNaN(data.location.lat)) {
             showNotification("חובה לבחור מיקום", 'error');
             return;
        }

        try {
            document.getElementById('btn-submit-event').disabled = true;
            await createEvent(data);
            
            // Generate WhatsApp formatted text
            const evTimeStr = data.eventTime ? new Date(data.eventTime).toLocaleString('he-IL', {
                year: 'numeric', month: '2-digit', day: '2-digit', 
                hour: '2-digit', minute: '2-digit'
            }) : 'לא צוין';
            
            const waText = `*\uD83D\uDEA8 אירוע גזרתי - ${data.eventType}*
\uD83D\uDCCD גזרה: ${data.sector}
\uD83D\uDD52 זמן: ${evTimeStr}
כוח / משימה: ${data.missionName || '-'}
\uD83D\uDC64 דיווח ע"י: ${data.reporterName} (${data.role})
נפגעים: ${data.hasCasualties ? data.casualtiesDetails : 'אין'}
נזק: ${data.hasDamage ? data.damageDetails : 'אין'}
\uD83D\uDCDD הערות: ${data.notes || '-'}`;

            document.getElementById('event-form').reset();
            timeInput.value = now.toISOString().slice(0, 16);
            document.getElementById('location-display').value = '';
            document.getElementById('location-lat').value = '';
            document.getElementById('location-lng').value = '';
            
            // Show WA Modal
            const waModal = document.getElementById('wa-modal');
            const btnyes = document.getElementById('btn-wa-yes');
            const btnno = document.getElementById('btn-wa-no');
            if (waModal && btnyes && btnno) {
                waModal.classList.remove('hidden');
                btnyes.onclick = () => {
                    waModal.classList.add('hidden');
                    import('./ui.js').then(({ showNotification }) => showNotification('אירוע דווח בהצלחה!'));
                    window.open(`https://wa.me/?text=${encodeURIComponent(waText)}`, '_blank');
                };
                btnno.onclick = () => {
                    waModal.classList.add('hidden');
                    import('./ui.js').then(({ showNotification }) => showNotification('אירוע דווח בהצלחה!'));
                };
            } else {
                import('./ui.js').then(({ showNotification }) => showNotification('אירוע דווח בהצלחה!'));
            }

        } catch(error) {
            import('./ui.js').then(({ showNotification }) => showNotification('שגיאה בשליחת דיווח', 'error'));
        } finally {
            document.getElementById('btn-submit-event').disabled = false;
        }
    });
}

// --- Dashboard Interactions ---
function setupDashboardInteractions() {
    document.getElementById('dash-filter-type').addEventListener('change', renderDashboardData);
    document.getElementById('dash-filter-sector').addEventListener('change', renderDashboardData);
    document.getElementById('dash-filter-time').addEventListener('change', renderDashboardData);
    
    window.addEventListener('tabChanged', (e) => {
        if(e.detail.tabId === 'dashboard-tab') {
            setTimeout(renderDashboardData, 150);
        }
    });
}

function renderDashboardData() {
    const typeFilter = document.getElementById('dash-filter-type').value;
    const sectorFilter = document.getElementById('dash-filter-sector').value;
    const timeFilter = document.getElementById('dash-filter-time').value;

    let filteredEvents = allEventsCache;

    if(typeFilter !== 'all') {
        filteredEvents = filteredEvents.filter(ev => ev.eventType === typeFilter);
    }
    
    if(sectorFilter !== 'all') {
        filteredEvents = filteredEvents.filter(ev => ev.sector === sectorFilter);
    }

    if(timeFilter !== 'all') {
        const hoursBack = parseInt(timeFilter);
        const cutoff = new Date().getTime() - (hoursBack * 60 * 60 * 1000);
        filteredEvents = filteredEvents.filter(ev => ev.eventTime >= cutoff);
    }

    updateDashboard(filteredEvents);
}

                        let currentFilteredRecords = [];

// --- Records Table & Filters ---
function setupRecordsInteractions() {
    document.getElementById('search-events').addEventListener('input', renderEventsTable);
    document.getElementById('record-filter-sector').addEventListener('change', renderEventsTable);
    document.getElementById('record-filter-time').addEventListener('change', renderEventsTable);
    
    document.getElementById('btn-export-csv').addEventListener('click', exportRecordsToCSV);

    document.getElementById('btn-close-record-details').addEventListener('click', () => {
        document.getElementById('record-details-modal').classList.add('hidden');
    });

    document.getElementById('btn-cancel-edit').addEventListener('click', () => {
        document.getElementById('edit-record-modal').classList.add('hidden');
    });

    document.getElementById('btn-edit-map-pick').addEventListener('click', () => {
        const id = document.getElementById('edit-event-id').value;
        if (!id) return;
        
        document.getElementById('edit-record-modal').classList.add('hidden');
        
        // Return to map tab visually
        const mapTabBtn = document.querySelector('[data-tab="map-tab"]');
        if (mapTabBtn) mapTabBtn.click();
        
        import('./map.js').then(({ enableMainMapPickMode }) => {
            enableMainMapPickMode((latlng) => {
                // Update local cache for this event since form doesn't display coords
                const ev = allEventsCache.find(e => e.id === id);
                if (ev) {
                    ev.location = { lat: latlng.lat, lng: latlng.lng };
                }
                
                // Show modal back
                document.getElementById('edit-record-modal').classList.remove('hidden');
                
                // Return to records tab visually
                const recordsTabBtn = document.querySelector('[data-tab="records-tab"]');
                if (recordsTabBtn) recordsTabBtn.click();
            });
        });
    });

    document.getElementById('edit-event-form').addEventListener('submit', async (e) => {
        e.preventDefault();
        const id = document.getElementById('edit-event-id').value;
        const casualtiesText = document.getElementById('edit-casualties').value;
        const damageText = document.getElementById('edit-damage').value;
        const timestamp = new Date(document.getElementById('edit-event-time').value).getTime();

        // Read location potentially modified by map pick
        const ev = allEventsCache.find(ev => ev.id === id);

        const data = {
            eventTime: timestamp,
            reporterName: document.getElementById('edit-reporter-name').value,
            missionName: document.getElementById('edit-mission-name').value,
            eventType: document.getElementById('edit-event-type-select').value,
            role: document.getElementById('edit-role-select').value,
            sector: document.getElementById('edit-sector-select').value,
            hasCasualties: casualtiesText.trim() !== '',
            casualtiesDetails: casualtiesText,
            hasDamage: damageText.trim() !== '',
            damageDetails: damageText,
            notes: document.getElementById('edit-event-notes').value
        };

        if (ev && ev.location) {
            data.location = ev.location;
        }

        try {
            await updateDocument('sectorEvents', id, data);
            showNotification('האירוע עודכן בהצלחה');
            document.getElementById('edit-record-modal').classList.add('hidden');
        } catch(err) {
            showNotification('שגיאה בעדכון אירוע', 'error');
        }
    });
}

function exportRecordsToCSV() {
    if(currentFilteredRecords.length === 0) {
        import('./ui.js').then(({showNotification}) => showNotification('אין רשומות לייצוא', 'error'));
        return;
    }
    
    let csvContent = "\uFEFF"; // UTF-8 BOM for Excel
    csvContent += "זמן במערכת,זמן אירוע,סוג,גזרה,מדווח,תפקיד,כוח / משימה,קו רוחב,קו אורך,הערות,נפגעים,נזק\n";

    currentFilteredRecords.forEach(ev => {
        const sysTime = import('./ui.js').then(({formatTimestamp}) => formatTimestamp(ev.createdAt));
        const evTime = ev.eventTime ? new Date(ev.eventTime).toLocaleString('he-IL') : '';
        const type = ev.eventType || '';
        const sector = ev.sector || '';
        const reporter = ev.reporterName || '';
        const role = ev.role || '';
        const mission = (ev.missionName || '').replace(/"/g, '""');
        const lat = ev.location && ev.location.lat ? ev.location.lat : '';
        const lng = ev.location && ev.location.lng ? ev.location.lng : '';
        const notes = (ev.notes || '').replace(/"/g, '""');
        const casualties = ev.hasCasualties ? (ev.casualtiesDetails || 'כן').replace(/"/g, '""') : 'לא';
        const damage = ev.hasDamage ? (ev.damageDetails || 'כן').replace(/"/g, '""') : 'לא';

        csvContent += `"${new Date(ev.createdAt).toLocaleString('he-IL')}","${evTime}","${type}","${sector}","${reporter}","${role}","${mission}","${lat}","${lng}","${notes}","${casualties}","${damage}"\n`;
    });

    const blob = new Blob([csvContent], { type: 'text/csv;charset=utf-8;' });
    const url = URL.createObjectURL(blob);
    const link = document.createElement("a");
    link.setAttribute("href", url);
    link.setAttribute("download", `events_export_${new Date().toISOString().slice(0,10)}.csv`);
    document.body.appendChild(link);
    link.click();
    document.body.removeChild(link);
}

function renderEventsTable() {
    const tbody = document.getElementById('events-tbody');
    tbody.innerHTML = '';

    const searchText = document.getElementById('search-events').value.toLowerCase();
    const sectorFilter = document.getElementById('record-filter-sector').value;
    const timeFilter = document.getElementById('record-filter-time').value;

    let filteredEvents = allEventsCache;

    if(sectorFilter !== 'all') {
        filteredEvents = filteredEvents.filter(ev => ev.sector === sectorFilter);
    }

    if(timeFilter !== 'all') {
        const hoursBack = parseInt(timeFilter);
        const cutoff = new Date().getTime() - (hoursBack * 60 * 60 * 1000);
        filteredEvents = filteredEvents.filter(ev => ev.eventTime >= cutoff);
    }

    if(searchText) {
        filteredEvents = filteredEvents.filter(ev => {
            return (ev.eventType || '').toLowerCase().includes(searchText) ||
                   (ev.sector || '').toLowerCase().includes(searchText) ||
                   (ev.reporterName || '').toLowerCase().includes(searchText) ||
                   (ev.notes || '').toLowerCase().includes(searchText);
        });
    }

    currentFilteredRecords = filteredEvents;

    filteredEvents.forEach(ev => {
        const tr = document.createElement('tr');
        
        let typeIcon = 'question';
        let typeColor = '#fff';
        const typeObj = typesCache.find(t => t.name === ev.eventType);
        if(typeObj) {
            typeIcon = typeObj.icon; typeColor = typeObj.color;
        }

        tr.innerHTML = `
            <td>${formatTimestamp(ev.createdAt)}</td>
            <td><i class="fas fa-${typeIcon}" style="color:${typeColor}; margin-left:5px;"></i> ${ev.eventType || '-'}</td>
            <td>${ev.sector || '-'}</td>
            <td>${ev.reporterName || '-'}</td>
            <td class="action-btns">
                <button class="btn secondary-btn small-btn view-btn" data-id="${ev.id}">פרטים</button>
                ${isAdminUser ? `
                    <button class="btn outline-btn small-btn edit-btn" data-id="${ev.id}">ערוך</button>
                    <button class="btn danger-btn small-btn del-btn" data-id="${ev.id}">מחק</button>
                ` : ''}
            </td>
        `;
        tbody.appendChild(tr);
    });

    // Bind view buttons
    tbody.querySelectorAll('.view-btn').forEach(btn => {
        btn.addEventListener('click', (e) => {
            const id = e.target.getAttribute('data-id');
            const ev = allEventsCache.find(x => x.id === id);
            if(ev) showEventDetails(ev);
        });
    });

    // Bind edit and delete buttons
    if(isAdminUser) {
        tbody.querySelectorAll('.edit-btn').forEach(btn => {
            btn.addEventListener('click', (e) => {
                const id = e.target.getAttribute('data-id');
                const ev = allEventsCache.find(x => x.id === id);
                if(ev) openEditModal(ev);
            });
        });

        tbody.querySelectorAll('.del-btn').forEach(btn => {
            btn.addEventListener('click', async (e) => {
                const id = e.target.getAttribute('data-id');
                if(confirm('האם אתה בטוח שברצונך למחוק מרישום האירועים?')) {
                     try {
                        await deleteDocument('sectorEvents', id);
                        showNotification('אירוע נמחק');
                     } catch(err) {
                        showNotification('שגיאה במחיקת אירוע', 'error');
                     }
                }
            });
        });
    }
}

function showEventDetails(ev) {
    const detailsContent = document.getElementById('record-details-content');
    
    // Formatting date
    const dateStr = ev.eventTime ? new Date(ev.eventTime).toLocaleString('he-IL') : 'לא ידוע';
    
    detailsContent.innerHTML = `
        <p><strong>זמן דיווח למערכת:</strong> ${formatTimestamp(ev.createdAt)}</p>
        <p><strong>זמן האירוע בשטח:</strong> ${dateStr}</p>
        <p><strong>מדווח:</strong> ${ev.reporterName} (${ev.role})</p>
        <p><strong>כוח / משימה:</strong> ${ev.missionName || '-'}</p>
        <p><strong>גזרה:</strong> ${ev.sector}</p>
        <p><strong>סוג אירוע:</strong> ${ev.eventType}</p>
        <p><strong>מיקום (נ.צ):</strong> ${ev.location ? `${ev.location.lat.toFixed(5)}, ${ev.location.lng.toFixed(5)}` : 'אין מיקום'}</p>
        <p><strong>הערות:</strong> ${ev.notes || 'אין'}</p>
        ${ev.hasCasualties ? `<div style="background:rgba(244,67,54,0.1); padding:10px; border-right:3px solid #f44336; margin-top:10px;"><strong>נפגעים:</strong> ${ev.casualtiesDetails}</div>` : ''}
        ${ev.hasDamage ? `<div style="background:rgba(255,152,0,0.1); padding:10px; border-right:3px solid #ff9800; margin-top:10px;"><strong>נזק:</strong> ${ev.damageDetails}</div>` : ''}
    `;
    
    document.getElementById('record-details-modal').classList.remove('hidden');
}

function openEditModal(ev) {
    document.getElementById('edit-event-id').value = ev.id;
    
    // Convert timestamp to datetime-local format
    if (ev.eventTime) {
        const dt = new Date(ev.eventTime);
        dt.setMinutes(dt.getMinutes() - dt.getTimezoneOffset());
        document.getElementById('edit-event-time').value = dt.toISOString().slice(0, 16);
    }
    
    document.getElementById('edit-reporter-name').value = ev.reporterName || '';
    document.getElementById('edit-mission-name').value = ev.missionName || '';
    document.getElementById('edit-event-type-select').value = ev.eventType;
    document.getElementById('edit-role-select').value = ev.role;
    document.getElementById('edit-sector-select').value = ev.sector;
    document.getElementById('edit-casualties').value = ev.casualtiesDetails || '';
    document.getElementById('edit-damage').value = ev.damageDetails || '';
    document.getElementById('edit-event-notes').value = ev.notes || '';
    
    document.getElementById('edit-record-modal').classList.remove('hidden');
}
