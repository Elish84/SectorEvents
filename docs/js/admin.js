import { addDocument, deleteDocument } from './api.js';
import { showNotification } from './ui.js';

export function setupAdminForms() {
    setupIconPicker();
    setupForm('add-event-type-form', 'eventTypes', () => {
        return {
            name: document.getElementById('new-event-type-name').value,
            color: document.getElementById('new-event-type-color').value,
            icon: document.getElementById('new-event-type-icon').value
        };
    });

    setupForm('add-sector-form', 'sectors', () => {
         return { name: document.getElementById('new-sector-name').value };
    });

    setupForm('add-role-form', 'roles', () => {
         return { name: document.getElementById('new-role-name').value };
    });
}

function setupForm(formId, collectionName, dataExtractor) {
    const form = document.getElementById(formId);
    if (!form) return;
    
    form.addEventListener('submit', async (e) => {
        e.preventDefault();
        const data = dataExtractor();
        
        try {
            await addDocument(collectionName, data);
            form.reset();
            showNotification('נוסף בהצלחה!');
        } catch (error) {
            showNotification('שגיאה בהוספה', 'error');
            console.error(error);
        }
    });
}

export function renderAdminList(listId, items, collectionName) {
    const ul = document.getElementById(listId);
    if (!ul) return;
    ul.innerHTML = '';
    
    items.forEach(item => {
        const li = document.createElement('li');
        
        // Custom format if it is eventType
        let display = item.name;
        if(collectionName === 'eventTypes') {
            display = `<i class="fas fa-${item.icon}" style="color:${item.color}; margin-left: 10px;"></i> ${item.name}`;
        }
        
        li.innerHTML = `
            <span>${display}</span>
            <button class="btn danger-btn small-btn" data-id="${item.id}" data-col="${collectionName}">
                מחק
            </button>
        `;
        ul.appendChild(li);
    });

    // Delete buttons
    const btns = ul.querySelectorAll('.danger-btn');
    btns.forEach(btn => {
        btn.addEventListener('click', async (e) => {
            const id = e.target.getAttribute('data-id');
            const col = e.target.getAttribute('data-col');
            if(confirm('האם אתה בטוח שברצונך למחוק?')) {
                try {
                    await deleteDocument(col, id);
                    showNotification('נמחק בהצלחה');
                } catch (error) {
                    showNotification('שגיאה במחיקה (אולי חסר הרשאות)', 'error');
                }
            }
        });
    });
}

function setupIconPicker() {
    const grid = document.getElementById('icon-grid');
    if (!grid) return;
    const hiddenInput = document.getElementById('new-event-type-icon');
    
    const availableIcons = [
        'fire', 'shield-alt', 'medkit', 'car-crash', 'bomb',
        'user-injured', 'exclamation-triangle', 'biohazard', 
        'radiation', 'search', 'skull-crossbones', 'truck-medical', 
        'gun', 'helicopter', 'eye', 'bolt', 'water', 'wind', 'map-pin'
    ];
    
    availableIcons.forEach(icon => {
        const div = document.createElement('div');
        div.className = 'icon-option';
        if(icon === 'fire') div.classList.add('selected');
        div.innerHTML = `<i class="fas fa-${icon}"></i>`;
        div.addEventListener('click', () => {
            document.querySelectorAll('.icon-option').forEach(el => el.classList.remove('selected'));
            div.classList.add('selected');
            hiddenInput.value = icon;
        });
        grid.appendChild(div);
    });
}
