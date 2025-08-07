// Budget Tracker JavaScript - Firebase Only Version
class BudgetTracker {
  constructor() {
    this.expenses = [];
    this.reflections = [];
    this.currentWeek = this.getCurrentWeek();
    this.isFirebaseReady = false;
    
    // Make instance globally accessible for delete buttons
    window.budgetTracker = this;
    
    this.initializeEventListeners();
    this.initializeCharts();
    
    // Wait for Firebase to be ready before loading data
    this.waitForFirebase();
  }

  // Wait for Firebase to be ready before initializing
  async waitForFirebase() {
    let attempts = 0;
    const maxAttempts = 100; // 10 seconds max wait
    
    const checkFirebase = async () => {
      if (window.firebaseService && window.firebaseService.isAuthenticated()) {
        this.isFirebaseReady = true;
        console.log('🔥 Firebase is ready, loading data...');
        
        // Initialize Firebase listeners for real-time updates
        this.initializeFirebaseListeners();
        
        // Load initial data
        await this.loadData();
        this.updateDisplay();
        
        // Show Firebase connection status
        this.showMessage('Connected to Firebase 🔥', 'success');
      } else if (attempts < maxAttempts) {
        attempts++;
        setTimeout(checkFirebase, 100);
      } else {
        this.showMessage('Firebase connection timeout. Please refresh the page.', 'error');
        console.error('Firebase connection timeout');
      }
    };
    
    checkFirebase();
  }

  // Initialize all event listeners
  initializeEventListeners() {
    // Expense form submission
    const expenseForm = document.getElementById('expense-form');
    if (expenseForm) {
      expenseForm.addEventListener('submit', (e) => this.handleExpenseSubmit(e));
    }

    // Reflection saving
    const saveReflectionBtn = document.getElementById('save-reflection');
    if (saveReflectionBtn) {
      saveReflectionBtn.addEventListener('click', () => this.saveReflection());
    }

    // Tab switching
    this.initializeTabSwitching();
  }

  // Initialize tab switching with chart updates
  initializeTabSwitching() {
    const tabs = document.querySelectorAll('.tab-btn');
    const contents = document.querySelectorAll('.tab-content');

    tabs.forEach(btn => {
      btn.addEventListener('click', () => {
        tabs.forEach(b => b.classList.remove('active'));
        contents.forEach(c => c.classList.remove('active'));

        btn.classList.add('active');
        const target = btn.getAttribute('data-tab');
        const targetElement = document.getElementById(target);
        if (targetElement) {
          targetElement.classList.add('active');
        }

        // Update charts when statistics tab is shown
        if (target === 'stats') {
          setTimeout(() => {
            this.updateCharts();
          }, 100);
        }
      });
    });
  }

  // Handle expense form submission
  async handleExpenseSubmit(e) {
    e.preventDefault();
    
    if (!this.isFirebaseReady) {
      this.showMessage('Firebase not ready. Please wait...', 'error');
      return;
    }
    
    const name = document.getElementById('expense-name').value.trim();
    const amount = parseFloat(document.getElementById('expense-amount').value);
    const category = document.getElementById('expense-category').value.trim() || 'Uncategorized';
    const date = document.getElementById('expense-date').value;
    const submitBtn = document.querySelector('#expense-form button[type="submit"]');
    const editingId = submitBtn.getAttribute('data-editing');

    if (!name || isNaN(amount) || !date) {
      this.showMessage('Please fill in all required fields.', 'error');
      return;
    }

    try {
      if (editingId) {
        // Update existing expense
        const expenseIndex = this.expenses.findIndex(e => e.id === editingId);
        if (expenseIndex !== -1) {
          const updatedExpense = {
            ...this.expenses[expenseIndex],
            name,
            amount,
            category,
            date,
            timestamp: new Date().toISOString()
          };

          // Update in Firebase
          await window.firebaseService.updateExpense(editingId, updatedExpense);

          // Reset form state
          submitBtn.textContent = 'Add';
          submitBtn.removeAttribute('data-editing');
          this.clearForm();
          this.showMessage('Entry updated successfully! 📝', 'success');
        }
      } else {
        // Add new expense
        const expense = {
          name,
          amount,
          category,
          date,
          timestamp: new Date().toISOString()
        };

        // Add to Firebase - the real-time listener will update the local array
        await window.firebaseService.addExpense(expense);
        this.clearForm();
        this.showMessage('Entry added successfully! ✅', 'success');
      }
    } catch (error) {
      console.error('Error saving expense:', error);
      this.showMessage('Error saving entry. Please try again. ❌', 'error');
    }
  }

  // Delete an expense
  async deleteExpense(id) {
    if (!this.isFirebaseReady) {
      this.showMessage('Firebase not ready. Please wait...', 'error');
      return;
    }

    // Add confirmation dialog
    if (!confirm('Are you sure you want to delete this entry?')) {
      return;
    }

    try {
      // Delete from Firebase - the real-time listener will update the local array
      await window.firebaseService.deleteExpense(id);
      this.showMessage('Entry deleted successfully! 🗑️', 'success');
    } catch (error) {
      console.error('Error deleting expense:', error);
      this.showMessage('Error deleting entry. Please try again. ❌', 'error');
    }
  }

  // Edit an expense
  editExpense(id) {
    const expense = this.expenses.find(e => e.id === id);
    if (!expense) return;

    // Populate form with existing data
    document.getElementById('expense-name').value = expense.name;
    document.getElementById('expense-amount').value = expense.amount;
    document.getElementById('expense-category').value = expense.category;
    document.getElementById('expense-date').value = expense.date;

    // Change form button to "Update"
    const submitBtn = document.querySelector('#expense-form button[type="submit"]');
    submitBtn.textContent = 'Update';
    submitBtn.setAttribute('data-editing', id);

    // Switch to dashboard tab
    const dashboardTab = document.querySelector('[data-tab="dashboard"]');
    if (dashboardTab) {
      dashboardTab.click();
    }
    
    // Scroll to form
    const addExpenseSection = document.getElementById('add-expense');
    if (addExpenseSection) {
      addExpenseSection.scrollIntoView({ behavior: 'smooth' });
    }
    
    this.showMessage('Editing expense - modify and click Update ✏️', 'info');
  }

  // Clear the expense form
  clearForm() {
    const form = document.getElementById('expense-form');
    if (form) {
      form.reset();
    }
    // Set default date to today
    const dateInput = document.getElementById('expense-date');
    if (dateInput) {
      dateInput.valueAsDate = new Date();
    }

    // Reset edit mode
    const submitBtn = document.querySelector('#expense-form button[type="submit"]');
    if (submitBtn) {
      submitBtn.textContent = 'Add';
      submitBtn.removeAttribute('data-editing');
    }
  }

  // Save reflection
  async saveReflection() {
    if (!this.isFirebaseReady) {
      this.showMessage('Firebase not ready. Please wait...', 'error');
      return;
    }

    const textarea = document.getElementById('weekly-thoughts');
    const content = textarea.value.trim();
    
    if (!content) {
      this.showMessage('Please write something before saving. ✍️', 'error');
      return;
    }

    const reflection = {
      week: this.currentWeek,
      content,
      timestamp: new Date().toISOString()
    };

    try {
      // Remove existing reflection for this week from local array
      this.reflections = this.reflections.filter(r => r.week !== this.currentWeek);
      this.reflections.push(reflection);
      
      // Save to Firebase
      await window.firebaseService.saveReflections(this.reflections);
      this.showMessage('Reflection saved successfully! 📝', 'success');
    } catch (error) {
      console.error('Error saving reflection:', error);
      this.showMessage('Error saving reflection. Please try again. ❌', 'error');
    }
  }

  // Initialize Firebase real-time listeners
  initializeFirebaseListeners() {
    if (!window.firebaseService) return;

    console.log('🔥 Setting up Firebase real-time listeners...');

    // Listen for expense changes
    this.expensesUnsubscribe = window.firebaseService.onExpensesChange((expenses) => {
      console.log('📊 Expenses updated from Firebase:', expenses.length);
      this.expenses = expenses;
      this.updateDisplay();
    });

    // Listen for reflection changes
    this.reflectionsUnsubscribe = window.firebaseService.onReflectionsChange((reflections) => {
      console.log('📝 Reflections updated from Firebase:', reflections.length);
      this.reflections = reflections;
      this.loadReflection();
    });
  }

  // Cleanup Firebase listeners
  cleanup() {
    if (this.expensesUnsubscribe) {
      this.expensesUnsubscribe();
    }
    if (this.reflectionsUnsubscribe) {
      this.reflectionsUnsubscribe();
    }
  }

  // Update all displays
  updateDisplay() {
    this.updateRemainingBudget();
    this.updateExpenseList();
    this.updateCharts();
  }

  // Update remaining budget display
  updateRemainingBudget() {
    const total = this.expenses.reduce((sum, expense) => sum + expense.amount, 0);
    const remainingElement = document.getElementById('remaining-budget');
    
    if (remainingElement) {
      remainingElement.textContent = this.formatCurrency(total);
      
      // Change color based on positive/negative
      if (total >= 0) {
        remainingElement.style.color = 'var(--success-green, #10b981)';
      } else {
        remainingElement.style.color = 'var(--danger, #ef4444)';
      }
    }
  }

  // Update expense list display
  updateExpenseList() {
    const expenseList = document.getElementById('expense-list');
    if (!expenseList) return;
    
    if (this.expenses.length === 0) {
      expenseList.innerHTML = '<li class="empty-state">No entries yet. Add your first transaction! 💰</li>';
      return;
    }

    // Sort by date (newest first)
    const sortedExpenses = [...this.expenses].sort((a, b) => new Date(b.date) - new Date(a.date));

    expenseList.innerHTML = sortedExpenses.map(expense => `
      <li class="expense-item">
        <div class="expense-details">
          <div class="expense-name">${this.escapeHtml(expense.name)}</div>
          <div class="expense-meta">${expense.category} • ${this.formatDate(expense.date)}</div>
        </div>
        <div class="expense-amount ${expense.amount >= 0 ? 'positive' : 'negative'}">
          ${expense.amount >= 0 ? '+' : '-'}${this.formatCurrency(expense.amount)}
        </div>
        <div class="expense-actions">
          <button class="edit-btn" data-expense-id="${expense.id}" title="Edit entry">
            ✏️
          </button>
          <button class="delete-btn" data-expense-id="${expense.id}" title="Delete entry">
            🗑️
          </button>
        </div>
      </li>
    `).join('');

    // Add event listeners to action buttons
    const editButtons = expenseList.querySelectorAll('.edit-btn');
    editButtons.forEach(button => {
      button.addEventListener('click', (e) => {
        e.stopPropagation();
        const expenseId = button.getAttribute('data-expense-id');
        this.editExpense(expenseId);
      });
    });

    const deleteButtons = expenseList.querySelectorAll('.delete-btn');
    deleteButtons.forEach(button => {
      button.addEventListener('click', (e) => {
        e.stopPropagation();
        const expenseId = button.getAttribute('data-expense-id');
        this.deleteExpense(expenseId);
      });
    });
  }

  // Initialize charts
  initializeCharts() {
    this.categoryChart = null;
    this.trendChart = null;
  }

  // Update charts
  updateCharts() {
    this.updateCategoryChart();
    this.updateTrendChart();
  }

  // Update category spending chart
  updateCategoryChart() {
    const ctx = document.getElementById('categoryChart');
    if (!ctx) return;

    // Get spending by category (only negative amounts)
    const categoryData = this.expenses
      .filter(expense => expense.amount < 0)
      .reduce((acc, expense) => {
        const amount = Math.abs(expense.amount);
        acc[expense.category] = (acc[expense.category] || 0) + amount;
        return acc;
      }, {});

    const categories = Object.keys(categoryData);
    const amounts = Object.values(categoryData);

    // Destroy existing chart
    if (this.categoryChart) {
      this.categoryChart.destroy();
    }

    if (categories.length === 0) {
      const context = ctx.getContext('2d');
      context.clearRect(0, 0, ctx.width, ctx.height);
      context.fillStyle = '#9ca3af';
      context.font = '16px Inter';
      context.textAlign = 'center';
      context.fillText('No spending data yet', ctx.width / 2, ctx.height / 2);
      return;
    }

    this.categoryChart = new Chart(ctx, {
      type: 'doughnut',
      data: {
        labels: categories,
        datasets: [{
          data: amounts,
          backgroundColor: [
            '#10b981',
            '#34d399',
            '#6ee7b7',
            '#84cc16',
            '#22c55e',
            '#059669',
            '#065f46'
          ],
          borderWidth: 0,
          hoverBorderWidth: 2,
          hoverBorderColor: '#ffffff'
        }]
      },
      options: {
        responsive: true,
        maintainAspectRatio: false,
        plugins: {
          legend: {
            position: 'bottom',
            labels: {
              padding: 20,
              usePointStyle: true,
              font: {
                family: 'Inter',
                size: 12
              }
            }
          }
        }
      }
    });
  }

  // Update weekly trend chart
  updateTrendChart() {
    const ctx = document.getElementById('trendChart');
    if (!ctx) return;

    // Get last 7 days of data
    const last7Days = this.getLast7Days();
    const dailyTotals = last7Days.map(date => {
      const dayExpenses = this.expenses.filter(expense => expense.date === date);
      return dayExpenses.reduce((sum, expense) => sum + expense.amount, 0);
    });

    // Destroy existing chart
    if (this.trendChart) {
      this.trendChart.destroy();
    }

    this.trendChart = new Chart(ctx, {
      type: 'line',
      data: {
        labels: last7Days.map(date => this.formatDateShort(date)),
        datasets: [{
          label: 'Daily Total',
          data: dailyTotals,
          borderColor: '#10b981',
          backgroundColor: 'rgba(16, 185, 129, 0.1)',
          borderWidth: 3,
          fill: true,
          tension: 0.4,
          pointBackgroundColor: '#10b981',
          pointBorderColor: '#ffffff',
          pointBorderWidth: 2,
          pointRadius: 6,
          pointHoverRadius: 8
        }]
      },
      options: {
        responsive: true,
        maintainAspectRatio: false,
        plugins: {
          legend: {
            display: false
          }
        },
        scales: {
          x: {
            grid: {
              display: false
            },
            ticks: {
              font: {
                family: 'Inter',
                size: 12
              }
            }
          },
          y: {
            grid: {
              color: 'rgba(156, 163, 175, 0.2)'
            },
            ticks: {
              font: {
                family: 'Inter',
                size: 12
              },
              callback: function(value) {
                return '₱' + value.toLocaleString();
              }
            }
          }
        }
      }
    });
  }

  // Load data from Firebase only
  async loadData() {
    if (!this.isFirebaseReady) {
      console.log('Firebase not ready, skipping data load');
      return;
    }

    try {
      // Set today's date as default
      const dateInput = document.getElementById('expense-date');
      if (dateInput) {
        dateInput.valueAsDate = new Date();
      }
      
      console.log('📥 Loading data from Firebase...');
      
      // Load both expenses and reflections from Firebase
      const [expenses, reflections] = await Promise.all([
        window.firebaseService.loadExpenses(),
        window.firebaseService.loadReflections()
      ]);

      this.expenses = expenses;
      this.reflections = reflections;
      
      console.log(`✅ Loaded ${expenses.length} expenses and ${reflections.length} reflections`);
      
      // Load current week's reflection
      this.loadReflection();
    } catch (error) {
      console.error('❌ Error loading data from Firebase:', error);
      this.showMessage('Error loading data from Firebase ❌', 'error');
      // Initialize empty arrays on error
      this.expenses = [];
      this.reflections = [];
    }
  }

  // Load reflection for current week
  loadReflection() {
    const currentReflection = this.reflections.find(r => r.week === this.currentWeek);
    const textarea = document.getElementById('weekly-thoughts');
    
    if (textarea && currentReflection) {
      textarea.value = currentReflection.content;
    }
  }

  // Export data from Firebase
  async exportData() {
    if (!this.isFirebaseReady) {
      this.showMessage('Firebase not ready. Please wait...', 'error');
      return;
    }

    try {
      const data = {
        expenses: this.expenses,
        reflections: this.reflections,
        exportDate: new Date().toISOString(),
        source: 'Firebase'
      };
      
      const blob = new Blob([JSON.stringify(data, null, 2)], { type: 'application/json' });
      const url = URL.createObjectURL(blob);
      const a = document.createElement('a');
      a.href = url;
      a.download = `budget-tracker-backup-${new Date().toISOString().split('T')[0]}.json`;
      a.click();
      URL.revokeObjectURL(url);
      
      this.showMessage('Data exported successfully! 💾', 'success');
    } catch (error) {
      console.error('Error exporting data:', error);
      this.showMessage('Error exporting data ❌', 'error');
    }
  }

  // Get quick stats
  getQuickStats() {
    const thisMonth = new Date().toISOString().substring(0, 7);
    const thisMonthExpenses = this.expenses.filter(e => e.date.startsWith(thisMonth));
    
    const income = thisMonthExpenses.filter(e => e.amount > 0).reduce((sum, e) => sum + e.amount, 0);
    const spending = Math.abs(thisMonthExpenses.filter(e => e.amount < 0).reduce((sum, e) => sum + e.amount, 0));
    const balance = income - spending;
    
    const categories = [...new Set(thisMonthExpenses.map(e => e.category))];
    const avgDailySpending = spending / new Date().getDate();

    return {
      monthlyIncome: income,
      monthlySpending: spending,
      monthlyBalance: balance,
      categoriesUsed: categories.length,
      avgDailySpending: avgDailySpending,
      totalTransactions: thisMonthExpenses.length
    };
  }

  // Utility functions
  getCurrentWeek() {
    const now = new Date();
    const start = new Date(now.getFullYear(), 0, 0);
    const diff = now - start;
    const oneDay = 1000 * 60 * 60 * 24;
    return Math.floor(diff / oneDay / 7);
  }

  getLast7Days() {
    const days = [];
    for (let i = 6; i >= 0; i--) {
      const date = new Date();
      date.setDate(date.getDate() - i);
      days.push(date.toISOString().split('T')[0]);
    }
    return days;
  }

  formatCurrency(amount) {
    return '₱' + Math.abs(amount).toLocaleString('en-US', {
      minimumFractionDigits: 2,
      maximumFractionDigits: 2
    });
  }

  formatDate(dateString) {
    const date = new Date(dateString);
    return date.toLocaleDateString('en-US', {
      month: 'short',
      day: 'numeric',
      year: 'numeric'
    });
  }

  formatDateShort(dateString) {
    const date = new Date(dateString);
    return date.toLocaleDateString('en-US', {
      month: 'numeric',
      day: 'numeric'
    });
  }

  escapeHtml(text) {
    const map = {
      '&': '&amp;',
      '<': '&lt;',
      '>': '&gt;',
      '"': '&quot;',
      "'": '&#039;'
    };
    return text.replace(/[&<>"']/g, m => map[m]);
  }

  showMessage(text, type) {
    // Remove existing messages
    const existingMessages = document.querySelectorAll('.message');
    existingMessages.forEach(msg => msg.remove());

    // Create new message
    const message = document.createElement('div');
    message.className = `message ${type}`;
    message.textContent = text;

    // Insert at the top of main content
    const main = document.querySelector('main');
    const activeContent = main.querySelector('.tab-content.active');
    if (activeContent) {
      activeContent.insertBefore(message, activeContent.firstChild);
    }

    // Auto remove after 4 seconds
    setTimeout(() => {
      if (message.parentNode) {
        message.remove();
      }
    }, 4000);
  }
}

// Initialize the budget tracker when the page loads
let budgetTracker;

document.addEventListener('DOMContentLoaded', () => {
  console.log('🚀 Initializing Budget Tracker...');
  budgetTracker = new BudgetTracker();
});

// Add keyboard shortcuts
document.addEventListener('keydown', (e) => {
  if (!budgetTracker) return;

  // Ctrl/Cmd + E to focus on expense name input
  if ((e.ctrlKey || e.metaKey) && e.key === 'e') {
    e.preventDefault();
    const expenseNameInput = document.getElementById('expense-name');
    if (expenseNameInput) {
      expenseNameInput.focus();
    }
  }
  
  // Ctrl/Cmd + S to save reflection (when on reflection tab)
  if ((e.ctrlKey || e.metaKey) && e.key === 's') {
    const activeTab = document.querySelector('.tab-content.active');
    if (activeTab && activeTab.id === 'reflection') {
      e.preventDefault();
      budgetTracker.saveReflection();
    }
  }
  
  // ESC to clear form or cancel edit mode
  if (e.key === 'Escape') {
    const submitBtn = document.querySelector('#expense-form button[type="submit"]');
    if (submitBtn && submitBtn.getAttribute('data-editing')) {
      submitBtn.textContent = 'Add';
      submitBtn.removeAttribute('data-editing');
      budgetTracker.showMessage('Edit cancelled 🚫', 'info');
    }
    budgetTracker.clearForm();
  }
  
  // Ctrl/Cmd + D to export data
  if ((e.ctrlKey || e.metaKey) && e.key === 'd') {
    e.preventDefault();
    budgetTracker.exportData();
  }
});

// Cleanup on page unload
window.addEventListener('beforeunload', () => {
  if (budgetTracker) {
    budgetTracker.cleanup();
  }
});