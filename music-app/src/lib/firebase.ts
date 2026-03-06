// import { initializeApp } from 'firebase/app';
// import { 
//   getAuth, 
//   createUserWithEmailAndPassword,
//   signInWithEmailAndPassword,
//   signOut as firebaseSignOut,
//   onAuthStateChanged,
//   updateProfile,
//   GoogleAuthProvider,
//   signInWithPopup
// } from 'firebase/auth';
// import { 
//   getFirestore, 
//   collection, 
//   onSnapshot, 
//   query, 
//   orderBy 
// } from 'firebase/firestore';

// const firebaseConfig = {
//   apiKey: import.meta.env.VITE_FIREBASE_API_KEY,
//   authDomain: import.meta.env.VITE_FIREBASE_AUTH_DOMAIN,
//   projectId: import.meta.env.VITE_FIREBASE_PROJECT_ID,
//   storageBucket: import.meta.env.VITE_FIREBASE_STORAGE_BUCKET,
//   messagingSenderId: import.meta.env.VITE_FIREBASE_MESSAGING_SENDER_ID,
//   appId: import.meta.env.VITE_FIREBASE_APP_ID
// };

// const app = initializeApp(firebaseConfig);
// export const auth = getAuth(app);
// export const db = getFirestore(app);

// // Auth functions
// export const registerWithEmail = async (
//   email: string, 
//   password: string, 
//   displayName: string
// ) => {
//   const userCredential = await createUserWithEmailAndPassword(auth, email, password);
//   await updateProfile(userCredential.user, { displayName });
//   return userCredential.user;
// };

// export const loginWithEmail = async (email: string, password: string) => {
//   const userCredential = await signInWithEmailAndPassword(auth, email, password);
//   return userCredential.user;
// };

// export const loginWithGoogleFirebase = async () => {
//   const provider = new GoogleAuthProvider();
//   const userCredential = await signInWithPopup(auth, provider);
//   return userCredential.user;
// };

// export const logoutFirebase = async () => {
//   await firebaseSignOut(auth);
// };

// export { onAuthStateChanged };

// // Firestore real-time subscription (replaces Supabase subscribeToTable)
// export const subscribeToCollection = (
//   collectionName: string,
//   callback: (data: any[]) => void
// ) => {
//   const q = query(collection(db, collectionName), orderBy('created_at', 'desc'));
  
//   const unsubscribe = onSnapshot(q, (snapshot) => {
//     const data = snapshot.docs.map(doc => ({
//       id: doc.id,
//       ...doc.data()
//     }));
//     callback(data);
//   });
  
//   return unsubscribe;
// };