// ============================================================
// NeonHub X — data-loader.js
// DROP-IN FIX for user panel loading issues.
// Link AFTER firebase.js and BEFORE app.js in index.html:
//   <script src="firebase.js"></script>
//   <script src="data-loader.js"></script>
//   <script src="app.js"></script>
// ============================================================

'use strict';

// ── LOADING UI HELPERS ────────────────────────────────────────
// These replace any existing showLoading/hideLoading so the
// spinner is guaranteed to stop even when errors occur.

window.showLoading = function(text = 'Loading...') {
  let ov = document.getElementById('__nh_loader');
  if (!ov) {
    ov = document.createElement('div');
    ov.id = '__nh_loader';
    ov.style.cssText = `
      position:fixed;inset:0;z-index:9999;
      background:rgba(3,7,18,0.78);backdrop-filter:blur(6px);
      display:flex;flex-direction:column;align-items:center;justify-content:center;gap:18px
    `;
    ov.innerHTML = `
      <div id="__nh_spinner" style="
        width:42px;height:42px;
        border:3px solid rgba(0,245,255,0.15);
        border-top-color:#00f5ff;
        border-radius:50%;
        animation:__nhSpin 0.75s linear infinite
      "></div>
      <div id="__nh_loader_text" style="
        font-family:'Orbitron',monospace;font-size:0.8rem;
        color:#00f5ff;letter-spacing:2.5px;text-transform:uppercase
      ">${text}</div>
      <style>@keyframes __nhSpin{to{transform:rotate(360deg)}}</style>`;
    document.body.appendChild(ov);
  } else {
    document.getElementById('__nh_loader_text').textContent = text;
    ov.style.display = 'flex';
  }
};

window.hideLoading = function() {
  const ov = document.getElementById('__nh_loader');
  if (ov) ov.style.display = 'none';
};

// Safety net: if loading is still showing after 12 seconds, kill it.
window._loaderSafetyTimer = null;
const _origShowLoading = window.showLoading;
window.showLoading = function(text) {
  _origShowLoading(text);
  clearTimeout(window._loaderSafetyTimer);
  window._loaderSafetyTimer = setTimeout(() => {
    window.hideLoading();
    console.warn('[NeonHub] Loading safety timeout fired — spinner force-hidden.');
  }, 12000);
};
const _origHideLoading = window.hideLoading;
window.hideLoading = function() {
  clearTimeout(window._loaderSafetyTimer);
  _origHideLoading();
};

// ── FIREBASE FETCH WRAPPER ────────────────────────────────────
// Wraps every Firebase read with:
//   - timeout (8 seconds max per call)
//   - automatic retry (up to 2 retries)
//   - proper error logging

const FETCH_TIMEOUT_MS = 8000;
const MAX_RETRIES      = 2;

async function firebaseFetch(refPath, attempt = 0) {
  return new Promise((resolve, reject) => {
    const timer = setTimeout(() => {
      reject(new Error(`Timeout fetching "${refPath}" (attempt ${attempt + 1})`));
    }, FETCH_TIMEOUT_MS);

    db.ref(refPath).once('value')
      .then(snap => { clearTimeout(timer); resolve(snap); })
      .catch(err  => { clearTimeout(timer); reject(err); });
  });
}

async function firebaseFetchWithRetry(refPath) {
  let lastErr;
  for (let i = 0; i <= MAX_RETRIES; i++) {
    try {
      return await firebaseFetch(refPath, i);
    } catch (err) {
      lastErr = err;
      console.warn(`[NeonHub] Firebase fetch failed (attempt ${i + 1}):`, err.message);
      if (i < MAX_RETRIES) await sleep(800 * (i + 1)); // back-off
    }
  }
  throw lastErr;
}

function sleep(ms) {
  return new Promise(r => setTimeout(r, ms));
}

// ── ROBUST DB LAYER ───────────────────────────────────────────
// Overrides the DB object from firebase.js with retry-wrapped versions.
// Safe to call multiple times — just overwrites.

function patchDBWithRetries() {
  if (!window.DB) {
    console.warn('[NeonHub] DB object not found — make sure firebase.js loaded first.');
    return;
  }

  // Patch getUser
  const _origGetUser = DB.getUser.bind(DB);
  DB.getUser = async function(uid) {
    try {
      const snap = await firebaseFetchWithRetry(`users/${uid}`);
      return snap.val();
    } catch (err) {
      console.error('[NeonHub] getUser failed:', err);
      return null;
    }
  };

  // Patch getProducts
  const _origGetProducts = DB.getProducts.bind(DB);
  DB.getProducts = async function() {
    try {
      const snap = await firebaseFetchWithRetry('products');
      const out  = [];
      snap.forEach(s => out.unshift({ ...s.val(), id: s.key }));
      return out;
    } catch (err) {
      console.error('[NeonHub] getProducts failed:', err);
      return [];         // return empty array instead of crashing
    }
  };

  // Patch getUserPurchases
  DB.getUserPurchases = async function(uid) {
    try {
      const snap = await firebaseFetchWithRetry(`users/${uid}/purchases`);
      return snap.val() ? Object.keys(snap.val()) : [];
    } catch (err) {
      console.error('[NeonHub] getUserPurchases failed:', err);
      return [];
    }
  };

  // Patch getWishlist
  DB.getWishlist = async function(uid) {
    try {
      const snap = await firebaseFetchWithRetry(`users/${uid}/wishlist`);
      return snap.val() ? Object.keys(snap.val()) : [];
    } catch (err) {
      console.error('[NeonHub] getWishlist failed:', err);
      return [];
    }
  };

  // Patch getCourseProgress
  DB.getCourseProgress = async function(uid, courseId) {
    try {
      const snap = await firebaseFetchWithRetry(`users/${uid}/progress/${courseId}`);
      return snap.val() ? Object.keys(snap.val()).map(Number) : [];
    } catch (err) {
      console.error('[NeonHub] getCourseProgress failed:', err);
      return [];
    }
  };

  console.info('[NeonHub] DB patched with retry + timeout wrappers.');
}

// ── AUTH STATE MANAGER ────────────────────────────────────────
// A single authoritative listener that:
//   1. Shows loading while auth state resolves
//   2. Loads all user data in parallel (not sequentially)
//   3. Calls showView() only AFTER data is ready
//   4. Always hides loading — even on error

let _authInitialized = false;

function initRobustAuth() {
  if (_authInitialized) return;
  _authInitialized = true;

  // Intercept the auth listener from app.js
  // by patching FB.onAuthStateChanged result
  showLoading('Connecting...');

  auth.onAuthStateChanged(async (user) => {
    showLoading('Loading data...');
    try {
      if (user) {
        NeonHub.currentUser = user;

        // Parallel fetch — much faster than sequential awaits
        const [userData, purchases, wishlist] = await Promise.all([
          DB.getUser(user.uid),
          DB.getUserPurchases(user.uid),
          DB.getWishlist(user.uid)
        ]);

        // Handle brand-new user (no DB record yet)
        if (!userData) {
          await DB.createUser(user.uid, {
            name:  user.displayName || 'User',
            email: user.email       || '',
            photo: user.photoURL    || '',
            role:  'user',
            wallet: 0,
            createdAt: Date.now()
          });
          NeonHub.userData = await DB.getUser(user.uid);
        } else {
          NeonHub.userData = userData;
        }

        NeonHub.purchases = purchases;
        NeonHub.wishlist  = wishlist;

        renderUserChip();
        renderWalletBadge();

        // Close auth modal if open
        closeModal?.('auth-modal');

        // Navigate to dashboard
        showView('dashboard');

      } else {
        // Logged out
        NeonHub.currentUser = null;
        NeonHub.userData    = null;
        NeonHub.purchases   = [];
        NeonHub.wishlist    = [];

        renderUserChip?.(false);

        // Load products for guest browsing
        await loadProductsSafe();
        showView('marketplace');
      }
    } catch (err) {
      console.error('[NeonHub] Auth state handler error:', err);
      showToast?.('Some data failed to load. Please refresh.', 'warn');
      // Still navigate — don't leave user stuck on loader
      showView(user ? 'dashboard' : 'marketplace');
    } finally {
      hideLoading(); // ALWAYS runs — no stuck spinner
    }
  });
}

// ── SAFE PRODUCT LOADER ───────────────────────────────────────
async function loadProductsSafe() {
  try {
    NeonHub.products = await DB.getProducts();
  } catch (err) {
    console.error('[NeonHub] Product load failed, using demo data:', err);
    NeonHub.products = typeof getDemoProducts === 'function' ? getDemoProducts() : [];
  }
}

// Override loadProducts in app.js
window.loadProducts = loadProductsSafe;

// ── VIEW RENDER GUARD ─────────────────────────────────────────
// Wraps every view render in try/catch so one broken view
// doesn't leave the whole app frozen.

const _originalShowView = window.showView;
window.showView = function(viewName) {
  try {
    _originalShowView?.(viewName);
  } catch (err) {
    console.error(`[NeonHub] showView("${viewName}") threw:`, err);
    hideLoading();
    const main = document.getElementById('main-view');
    if (main) {
      main.innerHTML = `
        <div style="text-align:center;padding:60px 20px">
          <div style="font-size:3rem;margin-bottom:16px">⚠️</div>
          <h3 style="color:#e2e8f0;margin-bottom:8px">Something went wrong</h3>
          <p style="color:#64748b;margin-bottom:20px">${err.message}</p>
          <button onclick="location.reload()" style="
            background:linear-gradient(135deg,#7b2fff,#00f5ff);border:none;
            border-radius:10px;color:#fff;padding:10px 24px;cursor:pointer;
            font-family:'Rajdhani',sans-serif;font-size:0.9rem;font-weight:700
          ">🔄 Reload Page</button>
        </div>`;
    }
  }
};

// ── FIREBASE CONNECTION MONITOR ───────────────────────────────
// Shows a banner if Firebase loses connection mid-session.

let _offlineBannerShown = false;
db.ref('.info/connected').on('value', (snap) => {
  const connected = snap.val();
  if (!connected && !_offlineBannerShown) {
    _offlineBannerShown = true;
    showOfflineBanner();
  } else if (connected && _offlineBannerShown) {
    _offlineBannerShown = false;
    removeOfflineBanner();
    // Refresh current view data silently
    if (NeonHub.currentUser) loadProductsSafe();
  }
});

function showOfflineBanner() {
  if (document.getElementById('__nh_offline')) return;
  const banner = document.createElement('div');
  banner.id = '__nh_offline';
  banner.style.cssText = `
    position:fixed;top:0;left:0;right:0;z-index:8888;
    background:rgba(255,238,0,0.12);border-bottom:1px solid rgba(255,238,0,0.3);
    padding:10px 20px;text-align:center;
    color:#ffee00;font-size:0.83rem;font-family:'Space Mono',monospace;
    display:flex;align-items:center;justify-content:center;gap:10px
  `;
  banner.innerHTML = `
    <span>⚠️</span>
    <span>No internet connection — some data may not load correctly</span>
    <button onclick="location.reload()" style="
      background:rgba(255,238,0,0.15);border:1px solid rgba(255,238,0,0.4);
      border-radius:6px;color:#ffee00;padding:3px 12px;cursor:pointer;font-size:0.78rem
    ">Retry</button>`;
  document.body.prepend(banner);
}

function removeOfflineBanner() {
  document.getElementById('__nh_offline')?.remove();
}

// ── INIT SEQUENCE ─────────────────────────────────────────────
// Runs after DOM is ready. Patches DB then starts auth listener.

function initDataLoader() {
  patchDBWithRetries();

  // Disable the old initAuth() from app.js by replacing it
  window.initAuth = function() {
    console.info('[NeonHub] initAuth() replaced by data-loader.js robust version.');
  };

  // Run our robust version instead
  initRobustAuth();
}

if (document.readyState === 'loading') {
  document.addEventListener('DOMContentLoaded', initDataLoader);
} else {
  initDataLoader();
}

