// ============================================================
// NeonHub X — admin-auth.js
// DROP-IN FILE: Link this in admin.html BEFORE any other scripts
// <script src="admin-auth.js"></script>
// ============================================================

'use strict';

// ── 1. WHITELISTED ADMIN EMAILS ───────────────────────────────
const ADMIN_EMAILS = [
  'bindhanibikash71@gmail.com',
  'bindhanib958@gmail.com',
  'bindhanibikash599@gmail.com',
  'bikashworm@gmail.com',
  'myfood.food.beverage@gmail.com',
  'bbindhani149@gmail.com'
];

// ── 2. CHECK IF EMAIL IS ADMIN ────────────────────────────────
function isAdminEmail(email) {
  if (!email) return false;
  return ADMIN_EMAILS.includes(email.trim().toLowerCase());
}

// ── 3. BLOCK PAGE UNTIL AUTH CHECK COMPLETES ─────────────────
// Immediately hide everything and show a checking screen
// so there is zero flash of admin content to non-admins
(function blockPageImmediately() {
  document.documentElement.style.visibility = 'hidden';
})();

// ── 4. ADMIN GATE — runs once Firebase is ready ───────────────
function runAdminGate() {
  auth.onAuthStateChanged(async (user) => {

    // Case A: Nobody is logged in → show login screen
    if (!user) {
      document.documentElement.style.visibility = 'visible';
      showAdminLoginScreen();
      return;
    }

    // Case B: Logged in but email not whitelisted → boot them out
    if (!isAdminEmail(user.email)) {
      await auth.signOut();
      document.documentElement.style.visibility = 'visible';
      showAccessDenied(user.email);
      return;
    }

    // Case C: Valid admin email — also verify role in DB
    try {
      const snap = await db.ref(`users/${user.uid}`).once('value');
      const data = snap.val();

      // Auto-upgrade role to admin in DB if missing
      // (handles first login of a whitelisted email)
      if (!data || data.role !== 'admin') {
        await db.ref(`users/${user.uid}`).update({
          role:  'admin',
          email: user.email,
          name:  data?.name || user.displayName || 'Admin',
          photo: data?.photo || user.photoURL || ''
        });
      }

      Admin.user     = user;
      Admin.userData = (await db.ref(`users/${user.uid}`).once('value')).val();
      document.documentElement.style.visibility = 'visible';
      bootAdmin();

    } catch (err) {
      console.error('Admin gate DB error:', err);
      document.documentElement.style.visibility = 'visible';
      showAdminLoginScreen('Database error. Try again.');
    }
  });
}

// ── 5. LOGIN SCREEN RENDERER ──────────────────────────────────
function showAdminLoginScreen(errorMsg = '') {
  document.body.innerHTML = `
    <div class="bg-canvas">
      <div class="blob blob-1"></div>
      <div class="blob blob-2"></div>
      <div class="blob blob-3"></div>
    </div>
    <div class="grid-overlay"></div>
    <div style="
      position:relative;z-index:1;
      display:flex;align-items:center;justify-content:center;
      min-height:100vh;padding:20px
    ">
      <div style="
        background:#0d1325;
        border:1px solid rgba(123,47,255,0.35);
        border-radius:20px;
        padding:40px 36px;
        width:100%;max-width:400px;
        box-shadow:0 0 60px rgba(123,47,255,0.15)
      ">
        <div style="text-align:center;margin-bottom:28px">
          <div style="font-size:2.5rem;margin-bottom:10px">👑</div>
          <div style="
            font-family:'Orbitron',monospace;
            font-size:1.3rem;font-weight:900;
            background:linear-gradient(135deg,#00f5ff,#7b2fff);
            -webkit-background-clip:text;-webkit-text-fill-color:transparent;
            background-clip:text;letter-spacing:2px
          ">Admin Panel</div>
          <div style="color:#64748b;font-size:0.82rem;margin-top:6px;font-family:'Space Mono',monospace">
            Authorized personnel only
          </div>
        </div>

        ${errorMsg ? `
        <div style="
          background:rgba(255,45,120,0.1);border:1px solid rgba(255,45,120,0.3);
          border-radius:10px;padding:12px 16px;margin-bottom:20px;
          color:#ff2d78;font-size:0.83rem;display:flex;align-items:center;gap:8px
        ">⚠️ ${escHtml(errorMsg)}</div>` : ''}

        <div style="margin-bottom:16px">
          <label style="
            display:block;font-size:0.72rem;color:#64748b;margin-bottom:7px;
            font-family:'Space Mono',monospace;letter-spacing:1.5px;text-transform:uppercase
          ">Email</label>
          <input id="adm-gate-email" type="email" placeholder="admin@email.com" style="
            width:100%;background:rgba(255,255,255,0.04);border:1px solid rgba(0,245,255,0.15);
            border-radius:10px;color:#e2e8f0;font-size:0.95rem;padding:11px 16px;
            outline:none;transition:border-color 0.2s;font-family:'Rajdhani',sans-serif;box-sizing:border-box
          " onfocus="this.style.borderColor='#00f5ff'" onblur="this.style.borderColor='rgba(0,245,255,0.15)'"
            onkeydown="if(event.key==='Enter') adminGateLogin()">
        </div>

        <div style="margin-bottom:24px">
          <label style="
            display:block;font-size:0.72rem;color:#64748b;margin-bottom:7px;
            font-family:'Space Mono',monospace;letter-spacing:1.5px;text-transform:uppercase
          ">Password</label>
          <input id="adm-gate-pass" type="password" placeholder="••••••••" style="
            width:100%;background:rgba(255,255,255,0.04);border:1px solid rgba(0,245,255,0.15);
            border-radius:10px;color:#e2e8f0;font-size:0.95rem;padding:11px 16px;
            outline:none;transition:border-color 0.2s;font-family:'Rajdhani',sans-serif;box-sizing:border-box
          " onfocus="this.style.borderColor='#00f5ff'" onblur="this.style.borderColor='rgba(0,245,255,0.15)'"
            onkeydown="if(event.key==='Enter') adminGateLogin()">
        </div>

        <button onclick="adminGateLogin()" id="adm-gate-btn" style="
          width:100%;background:linear-gradient(135deg,#7b2fff,#00f5ff);
          border:none;border-radius:10px;color:#fff;font-size:0.95rem;
          font-weight:700;padding:13px;cursor:pointer;
          font-family:'Rajdhani',sans-serif;letter-spacing:1px;
          transition:opacity 0.2s;display:flex;align-items:center;justify-content:center;gap:8px
        " onmouseover="this.style.opacity='0.88'" onmouseout="this.style.opacity='1'">
          🔐 Access Admin Panel
        </button>

        <div style="text-align:center;margin-top:18px">
          <a href="index.html" style="color:#64748b;font-size:0.8rem;text-decoration:none;
            font-family:'Space Mono',monospace">← Back to Marketplace</a>
        </div>

        <div id="adm-gate-error" style="
          display:none;margin-top:16px;
          background:rgba(255,45,120,0.1);border:1px solid rgba(255,45,120,0.3);
          border-radius:10px;padding:12px 16px;
          color:#ff2d78;font-size:0.83rem;text-align:center
        "></div>
      </div>
    </div>`;
}

// ── 6. LOGIN HANDLER ──────────────────────────────────────────
async function adminGateLogin() {
  const emailEl  = document.getElementById('adm-gate-email');
  const passEl   = document.getElementById('adm-gate-pass');
  const errorEl  = document.getElementById('adm-gate-error');
  const btn      = document.getElementById('adm-gate-btn');

  const email = (emailEl?.value || '').trim().toLowerCase();
  const pass  = passEl?.value || '';

  // Clear previous error
  if (errorEl) { errorEl.style.display = 'none'; errorEl.textContent = ''; }

  // Validate email against whitelist BEFORE touching Firebase
  if (!isAdminEmail(email)) {
    showGateError('⛔ This email is not authorized for admin access.');
    return;
  }

  if (!pass) {
    showGateError('Please enter your password.');
    return;
  }

  // Disable button, show loading
  if (btn) {
    btn.disabled = true;
    btn.innerHTML = '<div style="width:18px;height:18px;border:2px solid rgba(255,255,255,0.3);border-top-color:#fff;border-radius:50%;animation:spin 0.7s linear infinite;margin:0 auto"></div>';
    if (!document.getElementById('gate-spin-style')) {
      const s = document.createElement('style');
      s.id = 'gate-spin-style';
      s.textContent = '@keyframes spin{to{transform:rotate(360deg)}}';
      document.head.appendChild(s);
    }
  }

  try {
    await auth.signInWithEmailAndPassword(email, pass);
    // onAuthStateChanged will fire and call bootAdmin() automatically
  } catch (err) {
    if (btn) {
      btn.disabled = false;
      btn.innerHTML = '🔐 Access Admin Panel';
    }
    showGateError(firebaseAuthError(err.code));
  }
}

function showGateError(msg) {
  const el = document.getElementById('adm-gate-error');
  if (el) { el.textContent = msg; el.style.display = 'block'; }
}

// ── 7. ACCESS DENIED SCREEN ───────────────────────────────────
function showAccessDenied(email) {
  document.body.innerHTML = `
    <div class="bg-canvas">
      <div class="blob blob-1"></div>
      <div class="blob blob-2"></div>
    </div>
    <div class="grid-overlay"></div>
    <div style="
      position:relative;z-index:1;
      display:flex;align-items:center;justify-content:center;min-height:100vh;padding:20px
    ">
      <div style="
        background:#0d1325;border:1px solid rgba(255,45,120,0.4);
        border-radius:20px;padding:48px 40px;width:100%;max-width:440px;
        text-align:center;box-shadow:0 0 60px rgba(255,45,120,0.12)
      ">
        <div style="font-size:3.5rem;margin-bottom:16px">🚫</div>
        <div style="
          font-family:'Orbitron',monospace;font-size:1.3rem;font-weight:900;
          color:#ff2d78;letter-spacing:2px;margin-bottom:10px
        ">Access Denied</div>
        <p style="color:#64748b;font-size:0.9rem;line-height:1.6;margin-bottom:8px">
          The account <strong style="color:#e2e8f0">${escHtml(email)}</strong>
          is not authorized to access the admin panel.
        </p>
        <p style="color:#64748b;font-size:0.82rem;margin-bottom:28px">
          Contact the system owner if you believe this is an error.
        </p>
        <div style="display:flex;gap:12px;justify-content:center;flex-wrap:wrap">
          <a href="index.html" style="
            background:linear-gradient(135deg,#7b2fff,#00f5ff);border:none;
            border-radius:10px;color:#fff;font-size:0.9rem;font-weight:700;
            padding:11px 24px;cursor:pointer;text-decoration:none;
            font-family:'Rajdhani',sans-serif
          ">← Back to Marketplace</a>
          <button onclick="auth.signOut().then(()=>location.reload())" style="
            background:rgba(255,255,255,0.04);border:1px solid rgba(255,255,255,0.1);
            border-radius:10px;color:#e2e8f0;font-size:0.9rem;font-weight:600;
            padding:11px 24px;cursor:pointer;font-family:'Rajdhani',sans-serif
          ">Try Different Account</button>
        </div>
      </div>
    </div>`;
}

// ── 8. HELPERS ────────────────────────────────────────────────
function escHtml(str) {
  return String(str || '').replace(/&/g,'&amp;').replace(/</g,'&lt;').replace(/>/g,'&gt;').replace(/"/g,'&quot;');
}

function firebaseAuthError(code) {
  const map = {
    'auth/user-not-found':    'No account found with this email.',
    'auth/wrong-password':    'Incorrect password. Try again.',
    'auth/invalid-email':     'Invalid email format.',
    'auth/user-disabled':     'This account has been disabled.',
    'auth/too-many-requests': 'Too many attempts. Please wait and try again.',
    'auth/network-request-failed': 'Network error. Check your connection.'
  };
  return map[code] || 'Login failed. Please try again.';
}

// ── 9. KICK OFF THE GATE ──────────────────────────────────────
// Wait for DOM + Firebase to be ready, then run the gate.
// firebase.js must be loaded before this file.
if (document.readyState === 'loading') {
  document.addEventListener('DOMContentLoaded', runAdminGate);
} else {
  runAdminGate();
}

