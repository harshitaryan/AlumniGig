// Import the functions you need from the SDKs you need
import { initializeApp } from "firebase/app";
// TODO: Add SDKs for Firebase products that you want to use
// https://firebase.google.com/docs/web/setup#available-libraries

// Your web app's Firebase configuration
const firebaseConfig = {
    apiKey: "AIzaSyDDavnUcEZ_61cMt22AFw6rcUmtoV_WT6A",
    authDomain: "bizview-lx1d1.firebaseapp.com",
    projectId: "bizview-lx1d1",
    storageBucket: "bizview-lx1d1.firebasestorage.app",
    messagingSenderId: "184589380096",
    appId: "1:184589380096:web:a3503d724c9ee8812a86e5"
};

import { getAuth } from "firebase/auth";
import { getFirestore } from "firebase/firestore";

// Initialize Firebase
const app = initializeApp(firebaseConfig);
export const auth = getAuth(app);
export const db = getFirestore(app);