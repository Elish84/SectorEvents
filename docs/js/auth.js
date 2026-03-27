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
const appContainer = document.getElementById('app-container');
const loginForm = document.getElementById('login-form');
const loginError = document.getElementById('login-error');
const logoutBtn = document.getElementById('logout-btn');
const userGreeting = document.getElementById('user-greeting');
const navAdmin = document.getElementById('nav-admin');

// Events
export function initAuth(onLoginCallback) {
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
            appContainer.classList.remove('hidden');
            userGreeting.innerText = `שלום, ${user.email.split('@')[0]}`;
            
            // Trigger app initialization load
            if (onLoginCallback) onLoginCallback(user);
        } else {
            // Logged out
            currentUser = null;
            authContainer.classList.remove('hidden');
            appContainer.classList.add('hidden');
            navAdmin.classList.add('hidden'); // hide admin tab
        }
    });
}
