// User management class
class UserManager {
    constructor() {
        this.currentUser = null;
        this.favorites = new Set();
        this.loadUserData();
    }

    // Load user data from localStorage
    loadUserData() {
        try {
            const savedUser = localStorage.getItem('currentUser');
            const savedFavorites = localStorage.getItem('favorites');
            
            if (savedUser) {
                this.currentUser = JSON.parse(savedUser);
            }
            
            if (savedFavorites) {
                this.favorites = new Set(JSON.parse(savedFavorites));
            }
        } catch (error) {
            console.error('Error loading user data:', error);
        }
    }

    // Save user data to localStorage
    saveUserData() {
        try {
            if (this.currentUser) {
                localStorage.setItem('currentUser', JSON.stringify(this.currentUser));
            }
            localStorage.setItem('favorites', JSON.stringify([...this.favorites]));
        } catch (error) {
            console.error('Error saving user data:', error);
        }
    }

    // Register a new user
    register(username, email, password) {
        try {
            // In a real application, you would hash the password and make an API call
            this.currentUser = {
                username,
                email,
                // Don't store passwords in localStorage in a real application
                password: btoa(password) // Basic encoding for demo purposes
            };
            this.saveUserData();
            return true;
        } catch (error) {
            console.error('Error registering user:', error);
            return false;
        }
    }

    // Login user
    login(email, password) {
        try {
            if (this.currentUser && 
                this.currentUser.email === email && 
                btoa(password) === this.currentUser.password) {
                return true;
            }
            return false;
        } catch (error) {
            console.error('Error logging in:', error);
            return false;
        }
    }

    // Logout user
    logout() {
        this.currentUser = null;
        this.saveUserData();
    }

    // Check if user is logged in
    isLoggedIn() {
        return this.currentUser !== null;
    }

    // Get current user
    getCurrentUser() {
        return this.currentUser;
    }

    // Toggle favorite airport
    toggleFavorite(airportCode) {
        if (this.favorites.has(airportCode)) {
            this.favorites.delete(airportCode);
        } else {
            this.favorites.add(airportCode);
        }
        this.saveUserData();
    }

    // Check if airport is favorite
    isFavorite(airportCode) {
        return this.favorites.has(airportCode);
    }

    // Get all favorites
    getFavorites() {
        return [...this.favorites];
    }
}

// Create global userManager instance
const userManager = new UserManager();

// Export for use in other files
window.userManager = userManager; 