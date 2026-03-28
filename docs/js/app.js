import { initAuth } from './auth.js';
import { checkIfAdmin, seedInitialData, subscribeToCollection, subscribeToEvents, createEvent, deleteDocument, updateDocument } from './api.js';
import { renderDropdown, setupTabs, showNotification, formatTimestamp } from './ui.js';
import { initMaps, renderEventsOnMap, setupHeatmapToggle, setEventTypesCache, enableMainMapPickMode, disableMainMapPickMode, setMapFilters } from './map.js';
import { updateDashboard, setDashboardEventTypesCache } from './dashboard.js';
import { setupAdminForms, renderAdminList } from './admin.js';

let isAdminUser = false;
let typesCache = [];
let allEventsCache = [];
let sectorsCache = [];
let rolesCache = [];

document.addEventListener('DOMContentLoaded', () => {
    
    // Auth pipeline starts App
    initAuth(async (user) => {
        isAdminUser = await checkIfAdmin(user.uid);
        setupTabs(isAdminUser);
        
        if (isAdminUser) {
           await seedInitialData();
           setupAdminForms();
        }

        initMaps();
        setupHeatmapToggle();
        setupEventForm();
        setupMapInteractions();
        setupDashboardInteractions();
        setupRecordsInteractions();
        bindDataSubscriptions();
    });
});

function bindDataSubscriptions() {
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

        if (isAdminUser) renderAdminList('admin-event-types-list', items, 'eventTypes');
    });

    // Events
    subscribeToEvents((events) => {
        allEventsCache = events;
        renderEventsOnMap(events, true); // initial auto bounds
        renderDashboardData();
        renderEventsTable();
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
            showNotification('אירוע דווח בהצלחה!');
            document.getElementById('event-form').reset();
            timeInput.value = now.toISOString().slice(0, 16);
        } catch(error) {
            showNotification('שגיאה בשליחת דיווח', 'error');
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

// --- Records Table & Filters ---
function setupRecordsInteractions() {
    document.getElementById('search-events').addEventListener('input', renderEventsTable);
    document.getElementById('record-filter-sector').addEventListener('change', renderEventsTable);
    document.getElementById('record-filter-time').addEventListener('change', renderEventsTable);

    document.getElementById('btn-close-record-details').addEventListener('click', () => {
        document.getElementById('record-details-modal').classList.add('hidden');
    });

    document.getElementById('btn-cancel-edit').addEventListener('click', () => {
        document.getElementById('edit-record-modal').classList.add('hidden');
    });

    document.getElementById('edit-event-form').addEventListener('submit', async (e) => {
        e.preventDefault();
        const id = document.getElementById('edit-event-id').value;
        const data = {
            eventType: document.getElementById('edit-event-type-select').value,
            role: document.getElementById('edit-role-select').value,
            sector: document.getElementById('edit-sector-select').value,
            notes: document.getElementById('edit-event-notes').value
        };

        try {
            await updateDocument('sectorEvents', id, data);
            showNotification('האירוע עודכן בהצלחה');
            document.getElementById('edit-record-modal').classList.add('hidden');
        } catch(err) {
            showNotification('שגיאה בעדכון אירוע', 'error');
        }
    });
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
    document.getElementById('edit-event-type-select').value = ev.eventType;
    document.getElementById('edit-role-select').value = ev.role;
    document.getElementById('edit-sector-select').value = ev.sector;
    document.getElementById('edit-event-notes').value = ev.notes || '';
    
    document.getElementById('edit-record-modal').classList.remove('hidden');
}
