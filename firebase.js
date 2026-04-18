// ============================================================
// NeonHub X — firebase.js
// Firebase v9 compat SDK — Auth + Realtime DB + Storage
// ============================================================
// ⚠️  Replace the firebaseConfig object below with your
//    project's credentials from Firebase Console.
// ============================================================

const firebaseConfig = {
  apiKey: "AIzaSyCcbXPWvejkZs79ZkHt5m_LHwu78xgtZqI",
  authDomain: "myaccadamy-b3484.firebaseapp.com",
  databaseURL: "https://myaccadamy-b3484-default-rtdb.firebaseio.com",
  projectId: "myaccadamy-b3484",
  storageBucket: "myaccadamy-b3484.firebasestorage.app",
  messagingSenderId: "486030293623",
  appId: "1:486030293623:web:9489839eb1d806b271a472"
};

// ── Initialize Firebase ──────────────────────────────────────
firebase.initializeApp(firebaseConfig);

const auth     = firebase.auth();
const db       = firebase.database();
const storage  = firebase.storage();
const googleProvider = new firebase.auth.GoogleAuthProvider();

// ── Auth Helpers ─────────────────────────────────────────────
const FB = {

  // Sign Up with email/password
  async signUp(name, email, password) {
    const cred = await auth.createUserWithEmailAndPassword(email, password);
    await cred.user.updateProfile({ displayName: name });
    await DB.createUser(cred.user.uid, { name, email, role: 'user', wallet: 0, createdAt: Date.now() });
    return cred.user;
  },

  // Sign In with email/password
  async signIn(email, password) {
    const cred = await auth.signInWithEmailAndPassword(email, password);
    return cred.user;
  },

  // Google login
  async googleSignIn() {
    const cred = await auth.signInWithPopup(googleProvider);
    const user = cred.user;
    const snap = await db.ref(`users/${user.uid}`).once('value');
    if (!snap.exists()) {
      await DB.createUser(user.uid, {
        name:  user.displayName || 'User',
        email: user.email,
        photo: user.photoURL || '',
        role:  'user',
        wallet: 0,
        createdAt: Date.now()
      });
    }
    return user;
  },

  // Sign out
  async signOut() {
    await auth.signOut();
    NeonHub.currentUser = null;
    NeonHub.userData    = null;
  },

  // Current auth user
  getCurrentUser() {
    return auth.currentUser;
  },

  // Auth state listener
  onAuthStateChanged(cb) {
    return auth.onAuthStateChanged(cb);
  }
};

// ── Database Helpers ─────────────────────────────────────────
const DB = {

  // ─ Users ─
  async createUser(uid, data) {
    await db.ref(`users/${uid}`).set({
      ...data,
      purchases: {},
      wishlist:  {},
      progress:  {}
    });
  },

  async getUser(uid) {
    const snap = await db.ref(`users/${uid}`).once('value');
    return snap.val();
  },

  async updateUser(uid, data) {
    await db.ref(`users/${uid}`).update(data);
  },

  async getAllUsers() {
    const snap = await db.ref('users').once('value');
    return snap.val() || {};
  },

  // ─ Products ─
  async addProduct(data) {
    const ref  = db.ref('products').push();
    const prod = { ...data, id: ref.key, createdAt: Date.now(), approved: false, featured: false, sales: 0 };
    await ref.set(prod);
    return prod;
  },

  async getProducts() {
    const snap = await db.ref('products').orderByChild('createdAt').once('value');
    const out  = [];
    snap.forEach(s => out.unshift({ ...s.val(), id: s.key }));
    return out;
  },

  async getProduct(id) {
    const snap = await db.ref(`products/${id}`).once('value');
    return snap.val() ? { ...snap.val(), id } : null;
  },

  async updateProduct(id, data) {
    await db.ref(`products/${id}`).update(data);
  },

  async deleteProduct(id) {
    await db.ref(`products/${id}`).remove();
  },

  // ─ Purchases ─
  async recordPurchase(uid, productId, txnData) {
    const ref = db.ref('purchases').push();
    await ref.set({ uid, productId, ...txnData, id: ref.key, createdAt: Date.now() });
    await db.ref(`users/${uid}/purchases/${productId}`).set(true);
    await db.ref(`products/${productId}/sales`).transaction(v => (v || 0) + 1);
    return ref.key;
  },

  async hasPurchased(uid, productId) {
    const snap = await db.ref(`users/${uid}/purchases/${productId}`).once('value');
    return snap.val() === true;
  },

  async getUserPurchases(uid) {
    const snap = await db.ref(`users/${uid}/purchases`).once('value');
    return snap.val() ? Object.keys(snap.val()) : [];
  },

  // ─ Transactions ─
  async addTransaction(data) {
    const ref = db.ref('transactions').push();
    await ref.set({ ...data, id: ref.key, createdAt: Date.now() });
    return ref.key;
  },

  async getTransactions() {
    const snap = await db.ref('transactions').orderByChild('createdAt').limitToLast(200).once('value');
    const out  = [];
    snap.forEach(s => out.unshift({ ...s.val(), id: s.key }));
    return out;
  },

  async updateTransaction(id, data) {
    await db.ref(`transactions/${id}`).update(data);
  },

  // ─ UPI Transactions ─
  async addUPITransaction(data) {
    const ref = db.ref('upi_transactions').push();
    await ref.set({ ...data, id: ref.key, status: 'pending', createdAt: Date.now() });
    return ref.key;
  },

  async getUPITransactions() {
    const snap = await db.ref('upi_transactions').orderByChild('createdAt').once('value');
    const out  = [];
    snap.forEach(s => out.unshift({ ...s.val(), id: s.key }));
    return out;
  },

  async updateUPITransaction(id, data) {
    await db.ref(`upi_transactions/${id}`).update(data);
  },

  // ─ Wishlist ─
  async toggleWishlist(uid, productId) {
    const ref  = db.ref(`users/${uid}/wishlist/${productId}`);
    const snap = await ref.once('value');
    if (snap.val()) { await ref.remove(); return false; }
    else            { await ref.set(true); return true; }
  },

  async getWishlist(uid) {
    const snap = await db.ref(`users/${uid}/wishlist`).once('value');
    return snap.val() ? Object.keys(snap.val()) : [];
  },

  // ─ Progress ─
  async markLesson(uid, courseId, lessonIdx) {
    await db.ref(`users/${uid}/progress/${courseId}/${lessonIdx}`).set(true);
  },

  async getCourseProgress(uid, courseId) {
    const snap = await db.ref(`users/${uid}/progress/${courseId}`).once('value');
    return snap.val() ? Object.keys(snap.val()).map(Number) : [];
  },

  // ─ Wallet ─
  async addWallet(uid, amount) {
    await db.ref(`users/${uid}/wallet`).transaction(v => (v || 0) + Number(amount));
  },

  async deductWallet(uid, amount) {
    const snap = await db.ref(`users/${uid}/wallet`).once('value');
    const bal  = snap.val() || 0;
    if (bal < amount) throw new Error('Insufficient wallet balance');
    await db.ref(`users/${uid}/wallet`).transaction(v => (v || 0) - Number(amount));
  },

  // ─ Stats ─
  async getStats() {
    const [usersSnap, productsSnap, txnSnap] = await Promise.all([
      db.ref('users').once('value'),
      db.ref('products').once('value'),
      db.ref('transactions').once('value')
    ]);
    const txns  = txnSnap.val() ? Object.values(txnSnap.val()) : [];
    const total = txns.filter(t => t.status === 'success').reduce((s, t) => s + (t.amount || 0), 0);
    return {
      users:    usersSnap.numChildren(),
      products: productsSnap.numChildren(),
      sales:    txns.filter(t => t.status === 'success').length,
      revenue:  total
    };
  }
};

// ── ImgBB Upload ─────────────────────────────────────────────
const IMGBB_KEY = '3b3c4c8ac24925da9783a30431b30644';

async function uploadToImgBB(file) {
  const formData = new FormData();
  formData.append('image', file);
  const res  = await fetch(`https://api.imgbb.com/1/upload?key=${IMGBB_KEY}`, {
    method: 'POST',
    body:   formData
  });
  const json = await res.json();
  if (!json.success) throw new Error('Image upload failed');
  return json.data.url;
}

// ── Razorpay Key ─────────────────────────────────────────────
const RAZORPAY_KEY_ID = 'YOUR_RAZORPAY_KEY_ID'; // set in env / replace here

