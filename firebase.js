import { initializeApp } from "https://www.gstatic.com/firebasejs/10.8.0/firebase-app.js";
import { getAuth, GoogleAuthProvider, signInWithPopup, signInWithEmailAndPassword, createUserWithEmailAndPassword, signOut, onAuthStateChanged } from "https://www.gstatic.com/firebasejs/10.8.0/firebase-auth.js";
import { getFirestore, collection, addDoc, getDocs, updateDoc, doc, query, where, serverTimestamp } from "https://www.gstatic.com/firebasejs/10.8.0/firebase-firestore.js";

const firebaseConfig = {
  apiKey: "AIzaSyCcbXPWvejkZs79ZkHt5m_LHwu78xgtZqI",
  authDomain: "myaccadamy-b3484.firebaseapp.com",
  databaseURL: "https://myaccadamy-b3484-default-rtdb.firebaseio.com",
  projectId: "myaccadamy-b3484",
  storageBucket: "myaccadamy-b3484.firebasestorage.app",
  messagingSenderId: "486030293623",
  appId: "1:486030293623:web:9489839eb1d806b271a472"
};

const app = initializeApp(firebaseConfig);
const auth = getAuth(app);
const db = getFirestore(app);
const googleProvider = new GoogleAuthProvider();

export { auth, db, googleProvider, signInWithPopup, signInWithEmailAndPassword, createUserWithEmailAndPassword, signOut, onAuthStateChanged, collection, addDoc, getDocs, updateDoc, doc, query, where, serverTimestamp };
