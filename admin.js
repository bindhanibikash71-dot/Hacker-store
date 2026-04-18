// admin.js - adminLogin function me ye add karo
async function adminLogin(email, password) {
    try {
        // Sign in with Firebase
        const userCredential = await firebase.auth().signInWithEmailAndPassword(email, password);
        const user = userCredential.user;
        
        // TEMPORARY FIX: Hardcode admin email
        if (email === "bbindhani149@gmail.com") {
            // Force set admin role in database
            await firebase.database().ref(`users/${user.uid}`).update({
                email: email,
                role: "admin",
                updatedAt: new Date().toISOString()
            });
            
            showAdminToast("Admin access granted!", "success");
            document.getElementById('adminLoginModal').style.display = 'none';
            document.getElementById('adminPanel').style.display = 'flex';
            loadAdminDashboard();
            return;
        }
        
        // Check if user is admin
        const userSnapshot = await firebase.database().ref(`users/${user.uid}`).once('value');
        const userData = userSnapshot.val();
        
        if (userData && userData.role === 'admin') {
            showAdminToast("Welcome Admin!", "success");
            document.getElementById('adminLoginModal').style.display = 'none';
            document.getElementById('adminPanel').style.display = 'flex';
            loadAdminDashboard();
        } else {
            showAdminToast("Access denied - not an admin account", "error");
            await firebase.auth().signOut();
        }
    } catch (error) {
        showAdminToast(error.message, "error");
    }
}
