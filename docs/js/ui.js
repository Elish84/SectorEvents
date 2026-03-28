export function clearElement(el) {
    if(el) { el.innerHTML = ''; }
}

export function createOption(value, text) {
    const opt = document.createElement('option');
    opt.value = value;
    opt.innerText = text;
    return opt;
}

export function renderDropdown(elementId, items, placeholder = "בחר...") {
    const select = document.getElementById(elementId);
    if (!select) return;
    
    clearElement(select);
    select.appendChild(createOption("", placeholder));
    
    items.forEach(item => {
        select.appendChild(createOption(item.name, item.name)); // name is the value and text to make it easy for queries later
    });
}

// Format Firestore Timestamp to readable string
export function formatTimestamp(timestampObj) {
    if (!timestampObj) return "-";
    let date;
    if (timestampObj.toDate) {
        date = timestampObj.toDate();
    } else {
        date = new Date(timestampObj);
    }
    
    return date.toLocaleString('he-IL', {
        day: '2-digit', month: '2-digit', year: 'numeric',
        hour: '2-digit', minute: '2-digit'
    });
}

export function setupTabs(isManager) {
    const navBtns = document.querySelectorAll('.nav-btn');
    const tabs = document.querySelectorAll('.tab-content');
    
    const navAdmin = document.getElementById('nav-admin');
    if(isManager) {
        navAdmin.classList.remove('hidden');
    } else {
        navAdmin.classList.add('hidden');
    }

    navBtns.forEach(btn => {
        btn.addEventListener('click', () => {
            // Remove active classes
            navBtns.forEach(b => b.classList.remove('active'));
            tabs.forEach(t => t.classList.remove('active'));

            // Add active to clicked btn
            btn.classList.add('active');
            
            // Show corresponding tab
            const tabId = btn.getAttribute('data-tab');
            document.getElementById(tabId).classList.add('active');
            
            // Dispatch event for tab change map needs invalidateSize
            window.dispatchEvent(new CustomEvent('tabChanged', { detail: { tabId }}));
        });
    });
}

export function showNotification(msg, type='success', actionObj=null) {
    
    // Play a small beep sound for notifications
    try {
        const AudioContext = window.AudioContext || window.webkitAudioContext;
        if (AudioContext) {
            const ctx = new AudioContext();
            const osc = ctx.createOscillator();
            const gain = ctx.createGain();
            osc.connect(gain);
            gain.connect(ctx.destination);
            osc.type = 'sine';
            osc.frequency.setValueAtTime(type === 'success' ? 880 : 440, ctx.currentTime);
            gain.gain.setValueAtTime(0.1, ctx.currentTime);
            osc.start();
            osc.stop(ctx.currentTime + 0.15);
        }
    } catch(e) {}

    // A simple tactical toast message
    const div = document.createElement('div');
    div.style.position = 'fixed';
    div.style.top = '20px';
    div.style.left = '50%';
    div.style.transform = 'translateX(-50%)';
    div.style.backgroundColor = type === 'success' ? '#4CAF50' : '#f44336';
    div.style.color = 'white';
    div.style.padding = '10px 20px';
    div.style.borderRadius = '20px';
    div.style.zIndex = '100000';
    div.style.fontWeight = 'bold';
    div.style.boxShadow = '0 4px 6px rgba(0,0,0,0.3)';
    div.style.display = 'flex';
    div.style.alignItems = 'center';
    div.style.justifyContent = 'space-between';
    div.style.gap = '15px';
    
    const textSpan = document.createElement('span');
    textSpan.innerText = msg;
    div.appendChild(textSpan);

    let isDismissed = false;
    
    if (actionObj) {
        const btn = document.createElement('button');
        btn.innerText = actionObj.text;
        btn.style.backgroundColor = 'white';
        btn.style.color = type === 'success' ? '#4CAF50' : '#f44336';
        btn.style.border = 'none';
        btn.style.padding = '5px 10px';
        btn.style.borderRadius = '10px';
        btn.style.cursor = 'pointer';
        btn.style.fontWeight = 'bold';
        btn.onclick = () => {
            isDismissed = true;
            div.remove();
            actionObj.onClick();
        };
        div.appendChild(btn);
    }

    document.body.appendChild(div);

    const timeout = actionObj ? 7000 : 3000;

    setTimeout(() => {
        if (isDismissed) return;
        div.style.transition = 'opacity 0.5s';
        div.style.opacity = '0';
        setTimeout(() => { if(!isDismissed) div.remove(); }, 500);
    }, timeout);
}
