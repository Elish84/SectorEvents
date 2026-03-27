import { initAuth } from './auth.js';
import { checkIfAdmin, seedInitialData, subscribeToCollection, subscribeToEvents, createEvent, deleteDocument } from './api.js';
import { renderDropdown, setupTabs, showNotification, formatTimestamp } from './ui.js';
import { initMaps, renderEventsOnMap, setupHeatmapToggle, setEventTypesCache } from './map.js';
import { updateDashboard, setDashboardEventTypesCache } from './dashboard.js';
import { setupAdminForms, renderAdminList } from './admin.js';

let isAdminUser = false;
let typesCache = [];

document.addEventListener('DOMContentLoaded', () => {
    
    // Auth pipeline starts App
    initAuth(async (user) => {
        
        // Check admin role
        isAdminUser = await checkIfAdmin(user.uid);
        
        // UI Init
        setupTabs(isAdminUser);
        
        if (isAdminUser) {
           await seedInitialData();
           setupAdminForms();
        }

        initMaps();
        setupHeatmapToggle();
        setupEventForm();

        // Start watching data
        bindDataSubscriptions();
    });

});

function bindDataSubscriptions() {
    
    // Sectors
    subscribeToCollection('sectors', (items) => {
        renderDropdown('sector-select', items, 'בחר גזרה...');
        if (isAdminUser) renderAdminList('admin-sectors-list', items, 'sectors');
    });

    // Roles
    subscribeToCollection('roles', (items) => {
        renderDropdown('role-select', items, 'בחר תפקיד...');
        if (isAdminUser) renderAdminList('admin-roles-list', items, 'roles');
    });

    // Event Types
    subscribeToCollection('eventTypes', (items) => {
        typesCache = items;
        setEventTypesCache(items);
        setDashboardEventTypesCache(items);
        renderDropdown('event-type-select', items, 'בחר סוג אירוע...');
        if (isAdminUser) renderAdminList('admin-event-types-list', items, 'eventTypes');
    });

    // Events
    subscribeToEvents((events) => {
        renderEventsOnMap(events);
        updateDashboard(events);
        renderEventsTable(events);
    });

}

// --- Form Logic ---

function setupEventForm() {
    const timeInput = document.getElementById('event-time');
    // Set default time to now
    const now = new Date();
    now.setMinutes(now.getMinutes() - now.getTimezoneOffset());
    timeInput.value = now.toISOString().slice(0, 16);

    // Toggles
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

    // GPS Logic
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
        } else {
            showNotification("GPS לא זמין בדפדפן זה", 'error');
        }
    });

    // Submit Event
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
             showNotification("חובה לבחור מיקום (GPS או במפה)", 'error');
             return;
        }

        try {
            document.getElementById('btn-submit-event').innerText = 'שולח...';
            document.getElementById('btn-submit-event').disabled = true;
            await createEvent(data);
            showNotification('אירוע דווח בהצלחה!');
            // clear form partially
            document.getElementById('event-notes').value = '';
            document.getElementById('location-display').value = '';
            document.getElementById('location-lat').value = '';
            document.getElementById('location-lng').value = '';
            formHasCasualties.checked = false; casualtiesDetails.classList.add('hidden');
            formHasDamage.checked = false; damageDetails.classList.add('hidden');
        } catch(error) {
            showNotification('שגיאה בשליחת דיווח', 'error');
        } finally {
            document.getElementById('btn-submit-event').innerHTML = '<i class="fas fa-paper-plane"></i> שלח דיווח';
            document.getElementById('btn-submit-event').disabled = false;
        }
    });
}

function renderEventsTable(events) {
    const tbody = document.getElementById('events-tbody');
    tbody.innerHTML = '';

    events.forEach(ev => {
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
            <td>
                ${isAdminUser ? `<button class="btn danger-btn small-btn del-btn" data-id="${ev.id}">מחק</button>` : `<span style="color:#888;">צפייה בלבד</span>`}
            </td>
        `;
        tbody.appendChild(tr);
    });

    if(isAdminUser) {
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

    // Search
    document.getElementById('search-events').addEventListener('input', (e) => {
        const val = e.target.value.toLowerCase();
        Array.from(tbody.children).forEach(row => {
            if(row.innerText.toLowerCase().includes(val)) row.style.display = '';
            else row.style.display = 'none';
        });
    });
}
