import { db } from './auth.js';

const { collection, addDoc, getDocs, onSnapshot, query, orderBy, serverTimestamp, doc, getDoc, deleteDoc, writeBatch } = window.firebaseModules;

/**
 * Checks if the current UID is in the admins collection.
 */
export async function checkIfAdmin(uid) {
    try {
        const adminDoc = await getDoc(doc(db, 'admins', uid));
        return adminDoc.exists();
    } catch (e) {
        console.error("Error checking admin status:", e);
        return false;
    }
}

/**
 * Creates seed data for testing purposes if collections are empty.
 */
export async function seedInitialData() {
    console.log("Checking if seed is needed...");
    try {
        const batch = writeBatch(db);
        let count = 0;

        // Sectors
        const sectorsSnap = await getDocs(collection(db, 'sectors'));
        if (sectorsSnap.empty) {
            const sectors = ['גזרה א׳', 'גזרה ב׳', 'גזרה צפונית', 'גזרה דרומית'];
            sectors.forEach(s => {
                const ref = doc(collection(db, 'sectors'));
                batch.set(ref, { name: s });
            });
            count += sectors.length;
        }

        // Roles
        const rolesSnap = await getDocs(collection(db, 'roles'));
        if (rolesSnap.empty) {
            const roles = ['סייר', 'מפקד משימה', 'רבש״צ', 'חפ״ק'];
            roles.forEach(r => {
                const ref = doc(collection(db, 'roles'));
                batch.set(ref, { name: r });
            });
            count += roles.length;
        }

        // Event Types
        const eventsSnap = await getDocs(collection(db, 'eventTypes'));
        if (eventsSnap.empty) {
            const types = [
                { name: 'תנועה חשודה', icon: 'eye', color: '#ffeb3b' },
                { name: 'זיהוי רחפן', icon: 'plane', color: '#ff9800' },
                { name: 'פח״ע', icon: 'bomb', color: '#f44336' },
                { name: 'אירוע פלילי', icon: 'mask', color: '#9c27b0' },
                { name: 'שגרה', icon: 'check-circle', color: '#4caf50' }
            ];
            types.forEach(t => {
                const ref = doc(collection(db, 'eventTypes'));
                batch.set(ref, t);
            });
            count += types.length;
        }

        if (count > 0) {
            await batch.commit();
            console.log("Seeded initial definitions.");
        }
    } catch (e) {
        console.error("Error seeding initial data:", e);
    }
}

// ---------------- Generic Queries ----------------

export function subscribeToCollection(colName, callback) {
    const q = query(collection(db, colName)); // without ordering to avoid index reqs initially
    return onSnapshot(q, (snapshot) => {
        const items = [];
        snapshot.forEach(doc => items.push({ id: doc.id, ...doc.data() }));
        callback(items);
    }, (error) => {
        console.error(`Error subscribing to ${colName}:`, error);
    });
}

// ---------------- Events ----------------

export async function createEvent(eventData) {
    try {
        const docRef = await addDoc(collection(db, "sectorEvents"), {
            ...eventData,
            createdAt: serverTimestamp()
        });
        return docRef.id;
    } catch (e) {
        console.error("Error adding document: ", e);
        throw e;
    }
}

export function subscribeToEvents(callback) {
    const q = query(collection(db, "sectorEvents"), orderBy("createdAt", "desc"));
    return onSnapshot(q, (snapshot) => {
        const items = [];
        snapshot.forEach(doc => items.push({ id: doc.id, ...doc.data() }));
        callback(items);
    }, (error) => {
        if (error.code === 'failed-precondition') {
            console.warn("Index needed for sectorEvents. Falling back to unordered query until index is built. Please check Firebase console.");
            // Fallback without ordering
            const fallbackQ = query(collection(db, "sectorEvents"));
            onSnapshot(fallbackQ, (snap) => {
                const fbItems = [];
                snap.forEach(doc => fbItems.push({ id: doc.id, ...doc.data() }));
                // Perform local basic sorting as fallback
                fbItems.sort((a,b) => {
                    if(!a.createdAt || !b.createdAt) return 0;
                    return b.createdAt.toMillis() - a.createdAt.toMillis();
                });
                callback(fbItems);
            });
        } else {
            console.error("Error subscribing to events:", error);
        }
    });
}

export async function deleteDocument(colName, id) {
    try {
       await deleteDoc(doc(db, colName, id));
       return true;
    } catch (e) {
        console.error(`Error deleting ${id} from ${colName}:`, e);
        throw e;
    }
}

export async function addDocument(colName, data) {
    try {
        const docRef = await addDoc(collection(db, colName), data);
        return docRef.id;
    } catch (e) {
        console.error(`Error adding to ${colName}:`, e);
        throw e;
    }
}
