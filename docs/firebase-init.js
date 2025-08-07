// firebase-init.js - Fixed Version
import { initializeApp } from 'https://www.gstatic.com/firebasejs/10.7.1/firebase-app.js';
import { getFirestore, collection, addDoc, getDocs, deleteDoc, doc, updateDoc, query, orderBy, onSnapshot } from 'https://www.gstatic.com/firebasejs/10.7.1/firebase-firestore.js';
import { getAuth, signInAnonymously, onAuthStateChanged } from 'https://www.gstatic.com/firebasejs/10.7.1/firebase-auth.js';

// Your Firebase configuration
const firebaseConfig = {
  apiKey: "AIzaSyBjytSj-zYDUEM8O5RidGuLCLqDWd7Pt2M",
  authDomain: "budget-tracker-6add7.firebaseapp.com",
  projectId: "budget-tracker-6add7",
  storageBucket: "budget-tracker-6add7.firebasestorage.app",
  messagingSenderId: "609796727121",
  appId: "1:609796727121:web:df1994d3fe208038d93370",
  measurementId: "G-0PD76RW3TC"
};

// Initialize Firebase
const app = initializeApp(firebaseConfig);
const db = getFirestore(app);
const auth = getAuth(app);

// Firebase service class
class FirebaseService {
  constructor() {
    this.db = db;
    this.auth = auth;
    this.currentUser = null;
    this.userId = null;
    this.isInitialized = false;
    
    console.log('🔥 Firebase Service initializing...');
    
    // Initialize authentication
    this.initAuth();
  }

  // Initialize anonymous authentication with better error handling
  async initAuth() {
    try {
      console.log('🔐 Setting up authentication...');
      
      // Listen for auth state changes first
      onAuthStateChanged(this.auth, async (user) => {
        if (user) {
          this.currentUser = user;
          this.userId = user.uid;
          this.isInitialized = true;
          console.log('✅ User authenticated successfully:', user.uid);
          
          // Notify budget tracker that Firebase is ready
          this.notifyReady();
          
          // Trigger data load when user is authenticated
          if (window.budgetTracker) {
            console.log('📊 Triggering data reload...');
            await window.budgetTracker.loadData();
            window.budgetTracker.updateDisplay();
          }
        } else {
          console.log('❌ No user authenticated, attempting anonymous sign-in...');
          this.isInitialized = false;
          
          // Try to sign in anonymously
          try {
            console.log('🔄 Signing in anonymously...');
            await signInAnonymously(this.auth);
            // onAuthStateChanged will handle the success case
          } catch (signInError) {
            console.error('❌ Anonymous sign-in failed:', signInError);
            this.handleAuthError(signInError);
          }
        }
      });

    } catch (error) {
      console.error('❌ Auth initialization error:', error);
      this.handleAuthError(error);
    }
  }

  // Handle authentication errors with user-friendly messages
  handleAuthError(error) {
    console.error('Authentication Error:', error);
    
    let message = 'Firebase connection failed. ';
    
    if (error.code === 'auth/configuration-not-found') {
      message += 'Please enable Anonymous Authentication in Firebase Console.';
      console.log('🔧 Fix: Go to Firebase Console → Authentication → Sign-in method → Enable Anonymous');
    } else if (error.code === 'auth/network-request-failed') {
      message += 'Network error. Check your internet connection.';
    } else {
      message += 'Please refresh the page and try again.';
    }

    // Show error to user if budget tracker is available
    if (window.budgetTracker) {
      window.budgetTracker.showMessage(message, 'error');
    }
    
    // Retry after 5 seconds
    console.log('🔄 Retrying authentication in 5 seconds...');
    setTimeout(() => {
      this.initAuth();
    }, 5000);
  }

  // Notify that Firebase is ready
  notifyReady() {
    // Dispatch custom event
    window.dispatchEvent(new CustomEvent('firebaseReady', {
      detail: { userId: this.userId }
    }));
  }

  // Get user-specific collection reference
  getUserCollection(collectionName) {
    if (!this.userId) {
      throw new Error('User not authenticated');
    }
    return collection(this.db, 'users', this.userId, collectionName);
  }

  // Check if service is ready
  isReady() {
    return this.isInitialized && this.userId;
  }

  // Save expenses to Firebase
  async saveExpenses(expenses) {
    if (!this.isReady()) {
      throw new Error('Firebase not ready');
    }

    try {
      console.log('💾 Saving expenses to Firebase...');
      const expensesCollection = this.getUserCollection('expenses');
      
      // Clear existing expenses and add new ones
      const existingExpenses = await getDocs(expensesCollection);
      const deletePromises = existingExpenses.docs.map(doc => deleteDoc(doc.ref));
      await Promise.all(deletePromises);
      
      // Add new expenses
      const addPromises = expenses.map(expense => addDoc(expensesCollection, expense));
      await Promise.all(addPromises);
      
      console.log('✅ Expenses saved to Firebase successfully');
      return true;
    } catch (error) {
      console.error('❌ Error saving expenses:', error);
      throw error;
    }
  }

  // Load expenses from Firebase
  async loadExpenses() {
    if (!this.isReady()) {
      throw new Error('Firebase not ready');
    }

    try {
      console.log('📥 Loading expenses from Firebase...');
      const expensesCollection = this.getUserCollection('expenses');
      const q = query(expensesCollection, orderBy('timestamp', 'desc'));
      const querySnapshot = await getDocs(q);
      
      const expenses = [];
      querySnapshot.forEach((doc) => {
        expenses.push({
          id: doc.id,
          ...doc.data()
        });
      });
      
      console.log('✅ Expenses loaded from Firebase:', expenses.length);
      return expenses;
    } catch (error) {
      console.error('❌ Error loading expenses:', error);
      throw error;
    }
  }

  // Save reflections to Firebase
  async saveReflections(reflections) {
    if (!this.isReady()) {
      throw new Error('Firebase not ready');
    }

    try {
      console.log('💾 Saving reflections to Firebase...');
      const reflectionsCollection = this.getUserCollection('reflections');
      
      // Clear existing reflections and add new ones
      const existingReflections = await getDocs(reflectionsCollection);
      const deletePromises = existingReflections.docs.map(doc => deleteDoc(doc.ref));
      await Promise.all(deletePromises);
      
      // Add new reflections
      const addPromises = reflections.map(reflection => addDoc(reflectionsCollection, reflection));
      await Promise.all(addPromises);
      
      console.log('✅ Reflections saved to Firebase successfully');
      return true;
    } catch (error) {
      console.error('❌ Error saving reflections:', error);
      throw error;
    }
  }

  // Load reflections from Firebase
  async loadReflections() {
    if (!this.isReady()) {
      throw new Error('Firebase not ready');
    }

    try {
      console.log('📥 Loading reflections from Firebase...');
      const reflectionsCollection = this.getUserCollection('reflections');
      const q = query(reflectionsCollection, orderBy('timestamp', 'desc'));
      const querySnapshot = await getDocs(q);
      
      const reflections = [];
      querySnapshot.forEach((doc) => {
        reflections.push({
          id: doc.id,
          ...doc.data()
        });
      });
      
      console.log('✅ Reflections loaded from Firebase:', reflections.length);
      return reflections;
    } catch (error) {
      console.error('❌ Error loading reflections:', error);
      throw error;
    }
  }

  // Add a single expense
  async addExpense(expense) {
    if (!this.isReady()) {
      throw new Error('Firebase not ready');
    }

    try {
      console.log('➕ Adding expense to Firebase...');
      const expensesCollection = this.getUserCollection('expenses');
      const docRef = await addDoc(expensesCollection, expense);
      console.log('✅ Expense added with ID:', docRef.id);
      return docRef.id;
    } catch (error) {
      console.error('❌ Error adding expense:', error);
      throw error;
    }
  }

  // Delete a single expense
  async deleteExpense(expenseId) {
    if (!this.isReady()) {
      throw new Error('Firebase not ready');
    }

    try {
      console.log('🗑️ Deleting expense from Firebase:', expenseId);
      const expenseDoc = doc(this.db, 'users', this.userId, 'expenses', expenseId);
      await deleteDoc(expenseDoc);
      console.log('✅ Expense deleted successfully');
      return true;
    } catch (error) {
      console.error('❌ Error deleting expense:', error);
      throw error;
    }
  }

  // Update a single expense
  async updateExpense(expenseId, updates) {
    if (!this.isReady()) {
      throw new Error('Firebase not ready');
    }

    try {
      console.log('📝 Updating expense in Firebase:', expenseId);
      const expenseDoc = doc(this.db, 'users', this.userId, 'expenses', expenseId);
      await updateDoc(expenseDoc, updates);
      console.log('✅ Expense updated successfully');
      return true;
    } catch (error) {
      console.error('❌ Error updating expense:', error);
      throw error;
    }
  }

  // Real-time listeners
  onExpensesChange(callback) {
    if (!this.isReady()) {
      console.log('⚠️ Firebase not ready for real-time listeners');
      return null;
    }
    
    try {
      console.log('👂 Setting up expenses real-time listener...');
      const expensesCollection = this.getUserCollection('expenses');
      const q = query(expensesCollection, orderBy('timestamp', 'desc'));
      
      return onSnapshot(q, (querySnapshot) => {
        const expenses = [];
        querySnapshot.forEach((doc) => {
          expenses.push({
            id: doc.id,
            ...doc.data()
          });
        });
        console.log('🔄 Real-time expenses update:', expenses.length);
        callback(expenses);
      }, (error) => {
        console.error('❌ Error in expenses listener:', error);
      });
    } catch (error) {
      console.error('❌ Error setting up expenses listener:', error);
      return null;
    }
  }

  onReflectionsChange(callback) {
    if (!this.isReady()) {
      console.log('⚠️ Firebase not ready for real-time listeners');
      return null;
    }
    
    try {
      console.log('👂 Setting up reflections real-time listener...');
      const reflectionsCollection = this.getUserCollection('reflections');
      const q = query(reflectionsCollection, orderBy('timestamp', 'desc'));
      
      return onSnapshot(q, (querySnapshot) => {
        const reflections = [];
        querySnapshot.forEach((doc) => {
          reflections.push({
            id: doc.id,
            ...doc.data()
          });
        });
        console.log('🔄 Real-time reflections update:', reflections.length);
        callback(reflections);
      }, (error) => {
        console.error('❌ Error in reflections listener:', error);
      });
    } catch (error) {
      console.error('❌ Error setting up reflections listener:', error);
      return null;
    }
  }

  // Check if user is authenticated
  isAuthenticated() {
    return this.isReady();
  }

  // Get current user ID
  getCurrentUserId() {
    return this.userId;
  }

  // Get connection status
  getStatus() {
    return {
      isInitialized: this.isInitialized,
      userId: this.userId,
      isReady: this.isReady()
    };
  }
}

// Create global Firebase service instance
console.log('🚀 Creating Firebase service instance...');
window.firebaseService = new FirebaseService();

// Export for use in other files
export { FirebaseService, db, auth };