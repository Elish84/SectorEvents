import firebaseConfig from './firebase-config.js';

// Get required modules from the global window object established in index.html
const { initializeApp, getAuth, signInWithEmailAndPassword, onAuthStateChanged, signOut, getFirestore } = window.firebaseModules;

// Initialize Firebase
const app = initializeApp(firebaseConfig);
export const auth = getAuth(app);
export const db = getFirestore(app);

// State
export let currentUser = null;

// DOM Elements
const authContainer = document.getElementById('auth-container');
const loginForm = document.getElementById('login-form');
const loginError = document.getElementById('login-error');
const logoutBtn = document.getElementById('logout-btn');
const loginOpenBtn = document.getElementById('login-open-btn');
const closeAuthBtn = document.getElementById('btn-close-auth');
const userGreeting = document.getElementById('user-greeting');

// Elements to show/hide based on auth
const authOnlyElements = document.querySelectorAll('.auth-only');
const publicOnlyElements = document.querySelectorAll('.public-only');

// Events
export function initAuth(onLoginCallback) {
    if (loginOpenBtn) {
        loginOpenBtn.addEventListener('click', () => {
            authContainer.classList.remove('hidden');
        });
    }
    
    if (closeAuthBtn) {
        closeAuthBtn.addEventListener('click', () => {
            authContainer.classList.add('hidden');
        });
    }
    // Handle Form Submit
    loginForm.addEventListener('submit', async (e) => {
        e.preventDefault();
        const email = document.getElementById('login-email').value;
        const password = document.getElementById('login-password').value;
        const btn = document.getElementById('login-btn');
        btn.disabled = true;
        btn.innerText = 'מתחבר...';
        loginError.innerText = '';
        
        try {
            await signInWithEmailAndPassword(auth, email, password);
            loginForm.reset();
        } catch (error) {
            console.error('Login error:', error);
            loginError.innerText = 'שגיאת התחברות: פרטים שגויים או שהמשתמש לא קיים.';
        } finally {
            btn.disabled = false;
            btn.innerText = 'התחבר';
        }
    });

    // Handle Logout
    logoutBtn.addEventListener('click', async () => {
        try {
            await signOut(auth);
        } catch (error) {
            console.error('Logout error:', error);
        }
    });

    // Listen to Auth State
    onAuthStateChanged(auth, async (user) => {
        if (user) {
            // Logged in
            currentUser = user;
            authContainer.classList.add('hidden');
            
            authOnlyElements.forEach(el => el.classList.remove('hidden'));
            publicOnlyElements.forEach(el => el.classList.add('hidden'));
            
            if(userGreeting) {
                userGreeting.innerText = `שלום, ${user.email.split('@')[0]}`;
            }
            
            // Trigger app initialization load
            if (onLoginCallback) onLoginCallback(user);
        } else {
            // Logged out
            currentUser = null;
            
            authOnlyElements.forEach(el => el.classList.add('hidden'));
            publicOnlyElements.forEach(el => el.classList.remove('hidden'));
            
            // Switch to form tab
            const formTabBtn = document.querySelector('[data-tab="form-tab"]');
            if (formTabBtn) formTabBtn.click();
        }
    });
}
