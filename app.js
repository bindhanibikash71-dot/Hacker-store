cat << 'EOF' > app.js
import { auth, db, googleProvider, signInWithPopup, signInWithEmailAndPassword, createUserWithEmailAndPassword, signOut, onAuthStateChanged, collection, addDoc, getDocs, updateDoc, doc, query, where, serverTimestamp } from './firebase.js';

const IMGBB_API_KEY = "YOUR_IMGBB_API_KEY"; // Replace with ImgBB Key
let currentUser = null;
let currentProducts = [];
let pendingCheckoutProduct = null;

const app = {
    init: () => {
        onAuthStateChanged(auth, (user) => {
            currentUser = user;
            if(document.getElementById('admin-page')) {
                if(user) {
                    document.getElementById('admin-login-view').classList.add('hidden');
                    document.getElementById('admin-dashboard-view').classList.remove('hidden');
                    app.loadAdminData();
                } else {
                    document.getElementById('admin-login-view').classList.remove('hidden');
                    document.getElementById('admin-dashboard-view').classList.add('hidden');
                }
            } else {
                app.updateUserUI();
                app.loadProducts();
            }
        });
    },

    // --- USER PANEL FUNCTIONS ---
    updateUserUI: () => {
        if(currentUser) {
            document.getElementById('btn-login').classList.add('hidden');
            document.getElementById('user-profile').classList.remove('hidden');
            document.getElementById('user-email').innerText = currentUser.email;
            app.closeModal('auth-modal');
        } else {
            document.getElementById('btn-login').classList.remove('hidden');
            document.getElementById('user-profile').classList.add('hidden');
            document.getElementById('main-view').classList.remove('hidden');
            document.getElementById('purchases-view').classList.add('hidden');
        }
    },
    showLogin: () => document.getElementById('auth-modal').classList.remove('hidden'),
    closeModal: (id) => document.getElementById(id).classList.add('hidden'),
    
    emailLogin: async () => {
        const email = document.getElementById('auth-email').value;
        const pass = document.getElementById('auth-password').value;
        try {
            await signInWithEmailAndPassword(auth, email, pass);
        } catch (e) {
            try { await createUserWithEmailAndPassword(auth, email, pass); } 
            catch (err) { alert(err.message); }
        }
    },
    googleLogin: async () => {
        try { await signInWithPopup(auth, googleProvider); } 
        catch (e) { alert(e.message); }
    },
    logout: async () => await signOut(auth),

    loadProducts: async () => {
        const q = query(collection(db, "products"));
        const snapshot = await getDocs(q);
        currentProducts = snapshot.docs.map(doc => ({ id: doc.id, ...doc.data() }));
        
        const grid = document.getElementById('product-grid');
        grid.innerHTML = currentProducts.map(p => `
            <div class="card">
                <img src="${p.imageUrl}" alt="${p.title}">
                <div class="card-content">
                    <h3 class="card-title">${p.title}</h3>
                    <span style="font-size: 0.8rem; background: #eee; padding: 2px 6px; border-radius: 4px;">${p.type.toUpperCase()}</span>
                    <p class="card-price">₹${p.price}</p>
                    <div class="card-actions">
                        <button class="btn btn-primary" style="width:100%" onclick="app.startCheckout('${p.id}')">Buy Now</button>
                    </div>
                </div>
            </div>
        `).join('');
    },

    startCheckout: async (productId) => {
        if(!currentUser) return app.showLogin();
        pendingCheckoutProduct = currentProducts.find(p => p.id === productId);
        
        try {
            // 1. Create order on backend
            const res = await fetch('/api/create-order', {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({ amount: pendingCheckoutProduct.price })
            });
            const order = await res.json();

            // 2. Open Razorpay
            const options = {
                key: "YOUR_RAZORPAY_KEY_ID", // Will be exposed publicly, safe to do
                amount: order.amount,
                currency: "INR",
                name: "CodeMarket",
                description: pendingCheckoutProduct.title,
                order_id: order.id,
                handler: async function (response) {
                    // 3. Verify Payment
                    const verifyRes = await fetch('/api/verify-payment', {
                        method: 'POST',
                        headers: { 'Content-Type': 'application/json' },
                        body: JSON.stringify(response)
                    });
                    const verifyData = await verifyRes.json();
                    
                    if(verifyData.success) {
                        await app.recordPurchase(productId, response.razorpay_payment_id, "success");
                        alert("Payment Successful!");
                    } else {
                        alert("Payment verification failed.");
                    }
                },
                prefill: { email: currentUser.email },
                theme: { color: "#4f46e5" }
            };
            const rzp = new Razorpay(options);
            rzp.on('payment.failed', function () {
                // Fallback to UPI
                if(confirm("Payment failed. Try UPI Backup?")) {
                    document.getElementById('upi-amount').innerText = pendingCheckoutProduct.price;
                    document.getElementById('upi-modal').classList.remove('hidden');
                }
            });
            rzp.open();
        } catch (error) {
            console.error(error);
            alert("Error initiating payment");
        }
    },

    submitUpiPayment: async () => {
        const utr = document.getElementById('upi-utr').value;
        if(!utr) return alert("Enter UTR");
        await app.recordPurchase(pendingCheckoutProduct.id, utr, "pending_upi");
        alert("UPI Details Submitted! Admin will verify soon.");
        app.closeModal('upi-modal');
    },

    recordPurchase: async (productId, paymentId, status) => {
        await addDoc(collection(db, "purchases"), {
            userId: currentUser.uid,
            userEmail: currentUser.email,
            productId: productId,
            paymentId: paymentId,
            status: status,
            timestamp: serverTimestamp()
        });
    },

    showMyPurchases: async () => {
        document.getElementById('main-view').classList.add('hidden');
        document.getElementById('purchases-view').classList.remove('hidden');
        
        const q = query(collection(db, "purchases"), where("userId", "==", currentUser.uid), where("status", "==", "success"));
        const snapshot = await getDocs(q);
        const purchasedIds = snapshot.docs.map(doc => doc.data().productId);
        
        const myItems = currentProducts.filter(p => purchasedIds.includes(p.id));
        const grid = document.getElementById('purchases-grid');
        grid.innerHTML = myItems.length ? myItems.map(p => `
            <div class="card">
                <img src="${p.imageUrl}">
                <div class="card-content">
                    <h3 class="card-title">${p.title}</h3>
                    <button class="btn btn-primary" onclick="app.viewContent('${p.id}')">Access Content</button>
                </div>
            </div>
        `).join('') : "<p>No courses purchased yet.</p>";
    },

    goHome: () => {
        document.getElementById('main-view').classList.remove('hidden');
        document.getElementById('purchases-view').classList.add('hidden');
    },

    viewContent: (productId) => {
        const product = currentProducts.find(p => p.id === productId);
        if(product.type === 'course') {
            document.getElementById('player-title').innerText = product.title;
            document.getElementById('player-desc').innerText = product.description;
            document.getElementById('course-video').src = product.contentUrl;
            document.getElementById('player-modal').classList.remove('hidden');
        } else {
            window.open(product.contentUrl, '_blank');
        }
    },

    // --- ADMIN PANEL FUNCTIONS ---
    adminLogin: () => app.emailLogin(),
    
    switchAdminTab: (tabId) => {
        ['dashboard', 'products', 'payments'].forEach(t => document.getElementById(`tab-${t}`).classList.add('hidden'));
        document.getElementById(`tab-${tabId}`).classList.remove('hidden');
    },

    loadAdminData: async () => {
        // Load Products
        const pSnap = await getDocs(collection(db, "products"));
        currentProducts = pSnap.docs.map(doc => ({ id: doc.id, ...doc.data() }));
        document.getElementById('stat-products').innerText = currentProducts.length;
        
        document.getElementById('admin-product-list').innerHTML = currentProducts.map(p => `
            <tr>
                <td><img src="${p.imageUrl}" style="width:50px; height:50px; object-fit:cover;"></td>
                <td>${p.title}</td><td>${p.type}</td><td>₹${p.price}</td>
                <td><button class="btn btn-outline" disabled>Edit</button></td>
            </tr>
        `).join('');

        // Load Payments
        const paySnap = await getDocs(collection(db, "purchases"));
        let rev = 0; let pending = 0;
        let paymentsHtml = '';
        paySnap.forEach(docSnap => {
            const data = docSnap.data();
            if(data.status === 'success') rev += currentProducts.find(p => p.id === data.productId)?.price || 0;
            if(data.status === 'pending_upi') pending++;
            
            paymentsHtml += `<tr>
                <td>${data.userEmail}</td><td>${data.productId}</td><td>${data.paymentId}</td>
                <td><strong style="color: ${data.status==='success'?'green':'orange'}">${data.status}</strong></td>
                <td>${data.status === 'pending_upi' ? `<button class="btn btn-success" onclick="app.approveUPI('${docSnap.id}')">Approve</button>` : '-'}</td>
            </tr>`;
        });
        document.getElementById('stat-revenue').innerText = `₹${rev}`;
        document.getElementById('stat-pending').innerText = pending;
        document.getElementById('admin-payment-list').innerHTML = paymentsHtml;
    },

    showAddProduct: () => document.getElementById('add-product-modal').classList.remove('hidden'),

    saveProduct: async () => {
        const title = document.getElementById('prod-title').value;
        const desc = document.getElementById('prod-desc').value;
        const type = document.getElementById('prod-type').value;
        const price = parseInt(document.getElementById('prod-price').value);
        const contentUrl = document.getElementById('prod-content').value;
        const imageFile = document.getElementById('prod-image').files[0];

        if(!imageFile) return alert("Select an image");

        // Upload to ImgBB
        const formData = new FormData();
        formData.append("image", imageFile);
        const imgRes = await fetch(`https://api.imgbb.com/1/upload?key=${IMGBB_API_KEY}`, { method: 'POST', body: formData });
        const imgData = await imgRes.json();
        
        if(!imgData.success) return alert("Image upload failed");

        await addDoc(collection(db, "products"), {
            title, description: desc, type, price, contentUrl, imageUrl: imgData.data.url, timestamp: serverTimestamp()
        });

        alert("Product Added!");
        app.closeModal('add-product-modal');
        app.loadAdminData();
    },

    approveUPI: async (docId) => {
        if(confirm("Approve this payment?")) {
            await updateDoc(doc(db, "purchases", docId), { status: "success" });
            app.loadAdminData();
        }
    }
};

window.app = app;
app.init();
EOF
