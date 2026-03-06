// ============================================
// RAILWAY-CONNECTED AUTHENTICATION SYSTEM
// ============================================

const API_URL = 'https://chessyopenings-server-production.up.railway.app';
let currentUser = null;
let signupData = {};

// Simple hash function for passwords (NOT for production, just for demo)
function simpleHash(str) {
    let hash = 0;
    for (let i = 0; i < str.length; i++) {
        const char = str.charCodeAt(i);
        hash = ((hash << 5) - hash) + char;
        hash = hash & hash;
    }
    return hash.toString(36);
}

// Generate random 4-digit tag
function generateTag() {
    return String(Math.floor(Math.random() * 10000)).padStart(4, '0');
}

// Get all accounts from localStorage
function getAccounts() {
    return JSON.parse(localStorage.getItem('accounts') || '{}');
}

// Save accounts to localStorage
function saveAccounts(accounts) {
    localStorage.setItem('accounts', JSON.stringify(accounts));
}

// Get current user from localStorage
function getCurrentUser() {
    return JSON.parse(localStorage.getItem('currentUser') || 'null');
}

// Save current user to localStorage
function setCurrentUser(user) {
    localStorage.setItem('currentUser', JSON.stringify(user));
    currentUser = user;
}

// Load user's progress
async function loadUserProgress() {
    if (!currentUser) return;
    try {
        const res = await fetch(`${API_URL}/api/progress/${currentUser.id}`);
        const data = await res.json();
        localStorage.setItem('openingStats', JSON.stringify(data.openingStats || {}));
        localStorage.setItem('achievements', JSON.stringify(data.achievements || []));
        updateOverallProgress();
        updateOpeningBadges();
        searchOpenings('');
    } catch (err) {
        console.error('Load error:', err);
    }
}

// Save user's progress
async function saveUserProgress() {
    if (!currentUser) return;
    const stats = JSON.parse(localStorage.getItem('openingStats') || '{}');
    const achievements = JSON.parse(localStorage.getItem('achievements') || '[]');
    try {
        await fetch(`${API_URL}/api/progress/${currentUser.id}`, {
            method: 'POST',
            headers: {'Content-Type': 'application/json'},
            body: JSON.stringify({openingStats: stats, achievements: achievements})
        });
    } catch (err) {
        console.error('Save error:', err);
    }
}

// Override saveStats to auto-save to user account
const originalSaveStats = window.saveStats || function(){};
window.saveStats = function(n, st, t, asBlack) {
    originalSaveStats(n, st, t, asBlack);
    saveUserProgress();
};

// Show/Hide UI
function showProfileUI() {
    document.getElementById('profileContainer').style.display = 'flex';
    document.getElementById('loginPrompt').style.display = 'none';
}

function showLoginPrompt() {
    document.getElementById('profileContainer').style.display = 'none';
    document.getElementById('loginPrompt').style.display = 'flex';
}

// Update profile display
function updateProfileDisplay(username, tag) {
    document.getElementById('profileUsername').textContent = username;
    document.getElementById('profileTag').textContent = '#' + tag;
    document.getElementById('profileAvatar').textContent = username.charAt(0).toUpperCase();
}

// Modal helpers
function showModal(modalId) {
    document.getElementById(modalId).classList.add('show');
}

function hideModal(modalId) {
    document.getElementById(modalId).classList.remove('show');
    const errorEl = document.querySelector('#' + modalId + ' .auth-error');
    const successEl = document.querySelector('#' + modalId + ' .auth-success');
    if (errorEl) {
        errorEl.classList.remove('show');
        errorEl.textContent = '';
    }
    if (successEl) {
        successEl.classList.remove('show');
        successEl.textContent = '';
    }
}

function showError(modalId, message) {
    const errorEl = document.querySelector('#' + modalId + ' .auth-error');
    if (errorEl) {
        errorEl.textContent = message;
        errorEl.classList.add('show');
    }
}

function showSuccess(modalId, message) {
    const successEl = document.querySelector('#' + modalId + ' .auth-success');
    if (successEl) {
        successEl.textContent = message;
        successEl.classList.add('show');
    }
}

// Sign Up
document.getElementById('signupSubmitBtn').addEventListener('click', async () => {
    const username = document.getElementById('signupUsername').value.trim();
    const email = document.getElementById('signupEmail').value.trim().toLowerCase();
    const password = document.getElementById('signupPassword').value;
    
    if (!username || username.length < 3) {
        showError('signupModal', 'Username must be at least 3 characters');
        return;
    }
    if (!email || !email.includes('@')) {
        showError('signupModal', 'Please enter a valid email');
        return;
    }
    if (password.length < 6) {
        showError('signupModal', 'Password must be at least 6 characters');
        return;
    }
    
    signupData = {username, email, password};
    
    try {
        const res = await fetch(`${API_URL}/api/signup/send-code`, {
            method: 'POST',
            headers: {'Content-Type': 'application/json'},
            body: JSON.stringify(signupData)
        });
        const data = await res.json();
        
        if (!res.ok) {
            showError('signupModal', data.error);
            return;
        }
        
        document.getElementById('signupStep1').style.display = 'none';
        document.getElementById('signupStep2').style.display = 'block';
        document.getElementById('verifyEmail').textContent = email;
        
        if (data.demo_code) {
            showSuccess('signupModal', `CODE: ${data.demo_code}`);
        } else {
            showSuccess('signupModal', 'Verification code sent to your email!');
        }
    } catch (err) {
        showError('signupModal', 'Server error: ' + err.message);
    }
});

document.getElementById('verifyBtn').addEventListener('click', async () => {
    const code = document.getElementById('verificationCode').value.trim();
    
    if (code.length !== 6) {
        showError('signupModal', 'Enter 6-digit code');
        return;
    }
    
    try {
        const res = await fetch(`${API_URL}/api/signup/verify`, {
            method: 'POST',
            headers: {'Content-Type': 'application/json'},
            body: JSON.stringify({...signupData, code})
        });
        const data = await res.json();
        
        if (!res.ok) {
            showError('signupModal', data.error);
            return;
        }
        
        currentUser = data.user;
        localStorage.setItem('currentUser', JSON.stringify(data.user));
        updateProfileDisplay(data.user.username, data.user.tag);
        showProfileUI();
        await loadUserProgress();
        
        hideModal('signupModal');
        document.getElementById('signupStep1').style.display = 'block';
        document.getElementById('signupStep2').style.display = 'none';
        document.getElementById('signupUsername').value = '';
        document.getElementById('signupEmail').value = '';
        document.getElementById('signupPassword').value = '';
        document.getElementById('verificationCode').value = '';
    } catch (err) {
        showError('signupModal', 'Error: ' + err.message);
    }
});

document.getElementById('resendBtn').addEventListener('click', async () => {
    try {
        const res = await fetch(`${API_URL}/api/signup/send-code`, {
            method: 'POST',
            headers: {'Content-Type': 'application/json'},
            body: JSON.stringify(signupData)
        });
        const data = await res.json();
        
        if (data.demo_code) {
            showSuccess('signupModal', `CODE: ${data.demo_code}`);
        } else {
            showSuccess('signupModal', 'Code resent!');
        }
    } catch (err) {
        showError('signupModal', 'Error: ' + err.message);
    }
});

// Login
document.getElementById('loginSubmitBtn').addEventListener('click', async () => {
    const email = document.getElementById('loginEmail').value.trim().toLowerCase();
    const password = document.getElementById('loginPassword').value;
    
    if (!email || !password) {
        showError('loginModal', 'Please enter email and password');
        return;
    }
    
    try {
        const res = await fetch(`${API_URL}/api/login`, {
            method: 'POST',
            headers: {'Content-Type': 'application/json'},
            body: JSON.stringify({email, password})
        });
        const data = await res.json();
        
        if (!res.ok) {
            showError('loginModal', data.error);
            return;
        }
        
        currentUser = data.user;
        localStorage.setItem('currentUser', JSON.stringify(data.user));
        updateProfileDisplay(data.user.username, data.user.tag);
        showProfileUI();
        await loadUserProgress();
        
        hideModal('loginModal');
        document.getElementById('loginEmail').value = '';
        document.getElementById('loginPassword').value = '';
    } catch (err) {
        showError('loginModal', 'Error: ' + err.message);
    }
});

// Logout
document.getElementById('logoutBtn').addEventListener('click', async () => {
    if (currentUser) await saveUserProgress();
    currentUser = null;
    localStorage.removeItem('currentUser');
    localStorage.setItem('openingStats', '{}');
    localStorage.setItem('achievements', '[]');
    showLoginPrompt();
    updateOverallProgress();
    updateOpeningBadges();
    searchOpenings('');
    document.getElementById('profileDropdown').classList.remove('show');
});

// Edit Username
document.getElementById('editUsernameSubmit').addEventListener('click', () => {
    const newUsername = document.getElementById('editUsernameInput').value.trim();
    
    if (!newUsername || newUsername.length < 3) {
        showError('editUsernameModal', 'Username must be at least 3 characters');
        return;
    }
    
    if (!currentUser) return;
    
    const accounts = getAccounts();
    if (accounts[currentUser.email]) {
        accounts[currentUser.email].username = newUsername;
        saveAccounts(accounts);
        
        currentUser.username = newUsername;
        setCurrentUser(currentUser);
        updateProfileDisplay(newUsername, currentUser.tag);
        
        showSuccess('editUsernameModal', '✓ Username updated!');
        setTimeout(() => {
            hideModal('editUsernameModal');
            document.getElementById('editUsernameInput').value = '';
        }, 1000);
    }
});

// UI Event Listeners
document.getElementById('showLoginBtn').addEventListener('click', () => showModal('loginModal'));
document.getElementById('showSignupBtn').addEventListener('click', () => showModal('signupModal'));
document.getElementById('switchToSignup').addEventListener('click', () => {
    hideModal('loginModal');
    showModal('signupModal');
});
document.getElementById('switchToLogin').addEventListener('click', () => {
    hideModal('signupModal');
    document.getElementById('signupStep1').style.display = 'block';
    document.getElementById('signupStep2').style.display = 'none';
    showModal('loginModal');
});
document.getElementById('closeLogin').addEventListener('click', () => hideModal('loginModal'));
document.getElementById('closeSignup').addEventListener('click', () => hideModal('signupModal'));
document.getElementById('closeEdit').addEventListener('click', () => hideModal('editUsernameModal'));

document.getElementById('profileBtn').addEventListener('click', () => {
    document.getElementById('profileDropdown').classList.toggle('show');
});

document.getElementById('editUsernameBtn').addEventListener('click', () => {
    document.getElementById('profileDropdown').classList.remove('show');
    showModal('editUsernameModal');
});

// Close dropdown when clicking outside
document.addEventListener('click', (e) => {
    if (!e.target.closest('.profile-container')) {
        document.getElementById('profileDropdown').classList.remove('show');
    }
});

// Close modals when clicking overlay
document.querySelectorAll('.modal-overlay').forEach(overlay => {
    overlay.addEventListener('click', (e) => {
        if (e.target === overlay) {
            hideModal(overlay.id);
        }
    });
});

// Check if user is logged in on page load
const savedUser = JSON.parse(localStorage.getItem('currentUser'));
if (savedUser) {
    currentUser = savedUser;
    updateProfileDisplay(savedUser.username, savedUser.tag);
    showProfileUI();
    loadUserProgress();
} else {
    showLoginPrompt();
}