// User management system
class UserManager {
    constructor() {
        this.currentUser = null;
        this.users = JSON.parse(localStorage.getItem('users')) || {};
        this.favorites = JSON.parse(localStorage.getItem('favorites')) || {};
        this.initializeEventListeners();
        this.checkAuthState();
    }

    initializeEventListeners() {
        // Login form
        document.getElementById('loginForm').addEventListener('submit', (e) => {
            e.preventDefault();
            this.login();
        });

        // Register form
        document.getElementById('registerForm').addEventListener('submit', (e) => {
            e.preventDefault();
            this.register();
        });

        // Profile form
        document.getElementById('profileForm').addEventListener('submit', (e) => {
            e.preventDefault();
            this.updateProfile();
        });
    }

    checkAuthState() {
        const currentUser = JSON.parse(localStorage.getItem('currentUser'));
        if (currentUser) {
            this.setCurrentUser(currentUser);
        }
    }

    setCurrentUser(user) {
        this.currentUser = user;
        localStorage.setItem('currentUser', JSON.stringify(user));
        this.updateUI();
    }

    updateUI() {
        const navLogin = document.getElementById('navLogin');
        const navRegister = document.getElementById('navRegister');
        const navUser = document.getElementById('navUser');
        const userName = document.getElementById('userName');

        if (this.currentUser) {
            navLogin.classList.add('d-none');
            navRegister.classList.add('d-none');
            navUser.classList.remove('d-none');
            userName.textContent = this.currentUser.name;
        } else {
            navLogin.classList.remove('d-none');
            navRegister.classList.remove('d-none');
            navUser.classList.add('d-none');
        }
    }

    async login() {
        const email = document.getElementById('loginEmail').value;
        const password = document.getElementById('loginPassword').value;

        if (!this.users[email]) {
            this.showAlert('User not found', 'danger');
            return;
        }

        if (this.users[email].password !== password) {
            this.showAlert('Invalid password', 'danger');
            return;
        }

        this.setCurrentUser({
            email,
            name: this.users[email].name
        });

        this.showAlert('Login successful', 'success');
        bootstrap.Modal.getInstance(document.getElementById('loginModal')).hide();
    }

    async register() {
        const name = document.getElementById('registerName').value;
        const email = document.getElementById('registerEmail').value;
        const password = document.getElementById('registerPassword').value;
        const confirmPassword = document.getElementById('registerConfirmPassword').value;

        if (this.users[email]) {
            this.showAlert('Email already registered', 'danger');
            return;
        }

        if (password !== confirmPassword) {
            this.showAlert('Passwords do not match', 'danger');
            return;
        }

        this.users[email] = {
            name,
            password,
            createdAt: new Date().toISOString()
        };

        localStorage.setItem('users', JSON.stringify(this.users));
        this.setCurrentUser({ email, name });

        this.showAlert('Registration successful', 'success');
        bootstrap.Modal.getInstance(document.getElementById('registerModal')).hide();
    }

    async updateProfile() {
        if (!this.currentUser) return;

        const name = document.getElementById('profileName').value;
        const email = document.getElementById('profileEmail').value;
        const newPassword = document.getElementById('profileNewPassword').value;
        const confirmPassword = document.getElementById('profileConfirmPassword').value;

        if (newPassword && newPassword !== confirmPassword) {
            this.showAlert('Passwords do not match', 'danger');
            return;
        }

        if (email !== this.currentUser.email && this.users[email]) {
            this.showAlert('Email already in use', 'danger');
            return;
        }

        // Update user data
        const oldEmail = this.currentUser.email;
        this.users[email] = {
            ...this.users[oldEmail],
            name,
            password: newPassword || this.users[oldEmail].password
        };

        if (oldEmail !== email) {
            delete this.users[oldEmail];
        }

        localStorage.setItem('users', JSON.stringify(this.users));
        this.setCurrentUser({ email, name });

        this.showAlert('Profile updated successfully', 'success');
        bootstrap.Modal.getInstance(document.getElementById('profileModal')).hide();
    }

    logout() {
        this.currentUser = null;
        localStorage.removeItem('currentUser');
        this.updateUI();
        this.showAlert('Logged out successfully', 'success');
    }

    toggleFavorite(airportCode) {
        if (!this.currentUser) {
            this.showAlert('Please login to add favorites', 'warning');
            return;
        }

        const userEmail = this.currentUser.email;
        if (!this.favorites[userEmail]) {
            this.favorites[userEmail] = [];
        }

        const index = this.favorites[userEmail].indexOf(airportCode);
        if (index === -1) {
            this.favorites[userEmail].push(airportCode);
            this.showAlert('Airport added to favorites', 'success');
        } else {
            this.favorites[userEmail].splice(index, 1);
            this.showAlert('Airport removed from favorites', 'success');
        }

        localStorage.setItem('favorites', JSON.stringify(this.favorites));
        this.updateFavoritesList();
    }

    updateFavoritesList() {
        const favoritesList = document.getElementById('favoritesList');
        if (!favoritesList) return;

        const userEmail = this.currentUser?.email;
        if (!userEmail || !this.favorites[userEmail]) {
            favoritesList.innerHTML = '<p class="text-center">No favorites yet</p>';
            return;
        }

        favoritesList.innerHTML = this.favorites[userEmail].map(code => `
            <div class="col-md-4">
                <div class="card">
                    <div class="card-body">
                        <h5 class="card-title">${code}</h5>
                        <button class="btn btn-danger btn-sm" onclick="userManager.toggleFavorite('${code}')">
                            <i class="bi bi-star-fill me-2"></i>Remove
                        </button>
                    </div>
                </div>
            </div>
        `).join('');
    }

    showAlert(message, type = 'info') {
        const alertDiv = document.createElement('div');
        alertDiv.className = `alert alert-${type} alert-dismissible fade show position-fixed top-0 end-0 m-3`;
        alertDiv.innerHTML = `
            ${message}
            <button type="button" class="btn-close" data-bs-dismiss="alert"></button>
        `;
        document.body.appendChild(alertDiv);
        setTimeout(() => alertDiv.remove(), 3000);
    }
}

// Initialize user manager
const userManager = new UserManager();

// Add favorite button to flight cards
function addFavoriteButton(airportCode) {
    return `
        <button class="btn btn-outline-primary btn-sm" onclick="userManager.toggleFavorite('${airportCode}')">
            <i class="bi bi-star me-2"></i>Add to Favorites
        </button>
    `;
}

// Update the searchAirport function to include favorite button
const originalSearchAirport = window.searchAirport;
window.searchAirport = async function(airportCode = null) {
    const results = await originalSearchAirport(airportCode);
    if (results) {
        const favoriteButton = addFavoriteButton(airportCode);
        document.querySelector('.flight-card').insertAdjacentHTML('beforeend', favoriteButton);
    }
    return results;
}; 