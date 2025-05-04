document.addEventListener('DOMContentLoaded', function() {
    // Initialize the date picker
    flatpickr('#travelDate', {
        dateFormat: "Y-m-d",
        minDate: "today",
        defaultDate: new Date().setMonth(new Date().getMonth() + 2) // Default to 2 months from now
    });

    // Initialize weight sliders
    const costWeightInput = document.getElementById('costWeight');
    const emissionsWeightInput = document.getElementById('emissionsWeight');
    const preferenceWeightInput = document.getElementById('preferenceWeight');
    const costWeightValue = document.getElementById('costWeightValue');
    const emissionsWeightValue = document.getElementById('emissionsWeightValue');
    const preferenceWeightValue = document.getElementById('preferenceWeightValue');

    // Initial values
    costWeightInput.value = 0.6;
    emissionsWeightInput.value = 0.2;
    preferenceWeightInput.value = 0.2;
    costWeightValue.textContent = "0.6";
    emissionsWeightValue.textContent = "0.2";
    preferenceWeightValue.textContent = "0.2";

    // Update weight display values independently
    costWeightInput.addEventListener('input', function() {
        costWeightValue.textContent = parseFloat(this.value).toFixed(1);
    });

    emissionsWeightInput.addEventListener('input', function() {
        emissionsWeightValue.textContent = parseFloat(this.value).toFixed(1);
    });
    
    preferenceWeightInput.addEventListener('input', function() {
        preferenceWeightValue.textContent = parseFloat(this.value).toFixed(1);
    });

    // Load airport codes for dropdowns
    loadAirportCodes().then(airports => {
        // Add popular destination checkboxes
        const destinationsContainer = document.getElementById('destinationsContainer');
        
        // Create a row to hold destinations
        const row = document.createElement('div');
        row.className = 'row';
        destinationsContainer.appendChild(row);
        
        // Add each airport as a checkbox
        airports.forEach(airport => {
            const col = document.createElement('div');
            col.className = 'col-md-4 mb-2';
            
            const checkboxDiv = document.createElement('div');
            checkboxDiv.className = 'form-check';
            
            const checkbox = document.createElement('input');
            checkbox.type = 'checkbox';
            checkbox.className = 'form-check-input destination-checkbox';
            checkbox.id = `dest-${airport.code}`;
            checkbox.value = airport.code;
            checkbox.checked = ['JFK', 'LAX', 'ORD', 'SFO', 'MIA'].includes(airport.code); // Default selected
            
            const label = document.createElement('label');
            label.className = 'form-check-label';
            label.htmlFor = `dest-${airport.code}`;
            label.textContent = `${airport.code} - ${airport.name}`;
            
            checkboxDiv.appendChild(checkbox);
            checkboxDiv.appendChild(label);
            col.appendChild(checkboxDiv);
            row.appendChild(col);
        });
    });

    // Add default travelers
    addTraveler('Alice', 'JFK');
    addTraveler('Bob', 'LAX');
    addTraveler('Charlie', 'ORD');

    // Add traveler button event
    document.getElementById('addTravelerBtn').addEventListener('click', function() {
        addTraveler();
    });

    // Form submission
    document.getElementById('plannerForm').addEventListener('submit', function(e) {
        e.preventDefault();
        findDestinations();
    });

    // Event delegation for removing travelers
    document.getElementById('travelersContainer').addEventListener('click', function(e) {
        if (e.target.classList.contains('remove-traveler')) {
            const travelerEntry = e.target.closest('.traveler-entry');
            if (travelerEntry) {
                // Don't remove if it's the last traveler
                const travelers = document.querySelectorAll('.traveler-entry');
                if (travelers.length > 1) {
                    travelerEntry.remove();
                } else {
                    alert('You need at least one traveler');
                }
            }
        }
        
        // Handle add preference button
        if (e.target.classList.contains('add-preference-btn') || e.target.closest('.add-preference-btn')) {
            const travelerEntry = e.target.closest('.traveler-entry');
            addPreference(travelerEntry);
        }
        
        // Handle remove preference button
        if (e.target.classList.contains('remove-preference')) {
            const preferenceEntry = e.target.closest('.preference-entry');
            if (preferenceEntry) {
                preferenceEntry.remove();
            }
        }
        
        // Handle rating stars
        if (e.target.classList.contains('rating-star')) {
            const rating = parseInt(e.target.dataset.rating);
            const starsContainer = e.target.closest('.rating-stars');
            const stars = starsContainer.querySelectorAll('.rating-star');
            
            // Update stars
            stars.forEach(star => {
                const starRating = parseInt(star.dataset.rating);
                if (starRating <= rating) {
                    star.classList.remove('bi-star');
                    star.classList.add('bi-star-fill');
                } else {
                    star.classList.remove('bi-star-fill');
                    star.classList.add('bi-star');
                }
            });
            
            // Store the rating value in a data attribute on the container
            starsContainer.dataset.rating = rating;
        }
    });
    
    // Initialize chat functionality
    initializeChat();
});

// Initialize chat functionality
function initializeChat() {
    const chatInput = document.getElementById('chatInput');
    const sendChatBtn = document.getElementById('sendChatBtn');
    const chatMessages = document.getElementById('chatMessages');
    const chatLoadingIndicator = document.getElementById('chatLoadingIndicator');
    
    // Store chat history
    let chatHistory = [];
    
    // Initialize the chat UI with welcome message
    addChatMessage("Hello! I'm your travel planning assistant. I can help with destination ideas, travel tips, and more. How can I assist you today?", 'bot');
    
    // Handle sending messages
    sendChatBtn.addEventListener('click', sendChatMessage);
    
    // Allow sending with Enter key
    chatInput.addEventListener('keypress', function(e) {
        if (e.key === 'Enter') {
            sendChatMessage();
        }
    });
    
    // Function to send chat message
    function sendChatMessage() {
        const message = chatInput.value.trim();
        if (!message) return;
        
        // Add user message to chat
        addChatMessage(message, 'user');
        chatInput.value = '';
        
        // Store in chat history
        chatHistory.push({
            role: 'user',
            content: message
        });
        
        // Show loading indicator
        chatLoadingIndicator.classList.remove('d-none');
        
        // Get current travelers, preferences, and available locations
        const preferenceData = getCurrentPreferences();
        
        // Get available locations from selected checkboxes
        const availableLocations = [];
        const destinationCheckboxes = document.querySelectorAll('.destination-checkbox');
        destinationCheckboxes.forEach(checkbox => {
            const code = checkbox.value;
            const name = checkbox.nextElementSibling.textContent.split('-')[1].trim();
            availableLocations.push({
                code: code,
                name: name
            });
        });
        
        // Extract just the preferences to send to the chat API
        const preferences = {};
        
        // Combine preferences from all travelers
        if (preferenceData.travelers && preferenceData.travelers.length > 0) {
            preferenceData.travelers.forEach(traveler => {
                if (traveler.preferences) {
                    Object.keys(traveler.preferences).forEach(destCode => {
                        // If multiple travelers have preferences for the same destination,
                        // take the average or the highest rating
                        if (preferences[destCode]) {
                            preferences[destCode] = Math.max(preferences[destCode], traveler.preferences[destCode]);
                        } else {
                            preferences[destCode] = traveler.preferences[destCode];
                        }
                    });
                }
            });
        }
        
        // Send to API
        fetch('/api/chat', {
            method: 'POST',
            headers: {
                'Content-Type': 'application/json',
            },
            body: JSON.stringify({
                message: message,
                preferences: preferences,
                chat_history: chatHistory,
                availableLocations: availableLocations
            })
        })
        .then(response => response.json())
        .then(data => {
            // Hide loading indicator
            chatLoadingIndicator.classList.add('d-none');
            
            if (data.message) {
                // Add assistant's message to chat
                addChatMessage(data.message, 'bot');
                
                // Update chat history from server
                if (data.chat_history) {
                    chatHistory = data.chat_history;
                } else {
                    // Fallback: store assistant response in local chat history
                    chatHistory.push({
                        role: 'assistant',
                        content: data.message
                    });
                }
                
                // Display destination suggestions if available
                if (data.suggested_destinations && data.suggested_destinations.length > 0) {
                    displayDestinationSuggestions(data.suggested_destinations, 'suggested');
                }
                
                // Display destinations to avoid if available
                if (data.avoid_destinations && data.avoid_destinations.length > 0) {
                    displayDestinationSuggestions(data.avoid_destinations, 'avoid');
                }
            } else if (data.error) {
                addChatMessage('Error: ' + data.error, 'bot');
            }
        })
        .catch(error => {
            // Hide loading indicator
            chatLoadingIndicator.classList.add('d-none');
            console.error('Chat API error:', error);
            
            // Show error message
            addChatMessage(`Sorry, there was an error: ${error.message}`, 'bot');
        });
    }
    
    // Function to display destination suggestions from chat
    function displayDestinationSuggestions(destinations, type) {
        const suggestionType = type === 'suggested' ? 'Suggested Destinations' : 'Destinations to Avoid';
        const suggestionClass = type === 'suggested' ? 'suggestion-positive' : 'suggestion-negative';
        
        // Create a container for the suggestions
        const suggestionDiv = document.createElement('div');
        suggestionDiv.className = `destination-suggestions ${suggestionClass}`;
        
        // Add a heading
        const heading = document.createElement('h6');
        heading.className = 'suggestion-heading';
        heading.textContent = suggestionType;
        suggestionDiv.appendChild(heading);
        
        // Create a list for the destinations
        const list = document.createElement('ul');
        list.className = 'suggestion-list';
        
        // Add each destination to the list
        destinations.forEach(dest => {
            const item = document.createElement('li');
            
            // Create the destination tag with appropriate color
            const destTag = document.createElement('span');
            destTag.className = type === 'suggested' ? 'destination-tag' : 'destination-tag avoid-tag';
            destTag.textContent = `${dest.name} (${dest.code})`;
            
            // Add click functionality to select the destination in the search form
            destTag.addEventListener('click', () => {
                // Select this destination in the form
                const checkbox = document.querySelector(`#dest-${dest.code}`);
                if (checkbox) {
                    checkbox.checked = true;
                }
                
                // Find the first traveler
                const travelers = document.querySelectorAll('.traveler-entry');
                if (travelers.length > 0) {
                    // If this is a suggested destination, add a positive preference
                    if (type === 'suggested') {
                        addDestinationPreferenceToTraveler(travelers[0], dest.code, 5);
                    }
                    
                    // If this is an avoid destination, add negative preference
                    if (type === 'avoid') {
                        addDestinationPreferenceToTraveler(travelers[0], dest.code, 1);
                    }
                }
            });
            
            item.appendChild(destTag);
            list.appendChild(item);
        });
        
        suggestionDiv.appendChild(list);
        chatMessages.appendChild(suggestionDiv);
        chatMessages.scrollTop = chatMessages.scrollTop + 200; // Scroll down enough to show suggestions
    }
    
    // Helper function to add destination preference to traveler
    function addDestinationPreferenceToTraveler(travelerElement, destCode, rating) {
        // First check if this traveler already has this preference
        const existingPreferences = travelerElement.querySelectorAll('.preference-entry');
        for (let pref of existingPreferences) {
            const select = pref.querySelector('.preference-destination');
            if (select && select.value === destCode) {
                // Already exists, just update rating
                const stars = pref.querySelectorAll('.rating-star');
                stars.forEach(star => {
                    const starRating = parseInt(star.dataset.rating);
                    if (starRating <= rating) {
                        star.classList.remove('bi-star');
                        star.classList.add('bi-star-fill');
                    } else {
                        star.classList.remove('bi-star-fill');
                        star.classList.add('bi-star');
                    }
                });
                
                // Store rating
                const starsContainer = pref.querySelector('.rating-stars');
                starsContainer.dataset.rating = rating;
                return;
            }
        }
        
        // If we get here, need to add a new preference
        const addPrefButton = travelerElement.querySelector('.add-preference-btn');
        if (addPrefButton) {
            // Click the button to add a new preference entry
            addPrefButton.click();
            
            // Now find the newly added preference entry
            const preferences = travelerElement.querySelectorAll('.preference-entry');
            const newPref = preferences[preferences.length - 1];
            
            // Set the destination
            const select = newPref.querySelector('.preference-destination');
            if (select) {
                select.value = destCode;
                
                // Set the rating
                const stars = newPref.querySelectorAll('.rating-star');
                stars.forEach(star => {
                    const starRating = parseInt(star.dataset.rating);
                    if (starRating <= rating) {
                        star.classList.remove('bi-star');
                        star.classList.add('bi-star-fill');
                    }
                });
                
                // Store rating
                const starsContainer = newPref.querySelector('.rating-stars');
                starsContainer.dataset.rating = rating;
            }
        }
    }
    
    // Function to add a message to the chat
    function addChatMessage(text, sender, customClass = '') {
        const messageDiv = document.createElement('div');
        messageDiv.className = `message ${sender}-message ${customClass}`;
        messageDiv.textContent = text;
        chatMessages.appendChild(messageDiv);
        chatMessages.scrollTop = chatMessages.scrollHeight;
    }
}

// Get current preferences from the form
function getCurrentPreferences() {
    // Get basic preferences
    const travelDate = document.getElementById('travelDate').value;
    const costWeight = parseFloat(document.getElementById('costWeight').value);
    const emissionsWeight = parseFloat(document.getElementById('emissionsWeight').value);
    const preferenceWeight = parseFloat(document.getElementById('preferenceWeight').value);
    
    // Get traveler information with preferences
    const travelers = [];
    const travelerElements = document.querySelectorAll('.traveler-entry');
    
    travelerElements.forEach(travelerEl => {
        const name = travelerEl.querySelector('.traveler-name').value;
        const origin = travelerEl.querySelector('.traveler-origin').value;
        
        if (name && origin) {
            // Get traveler preferences
            const preferences = {};
            const preferenceEntries = travelerEl.querySelectorAll('.preference-entry');
            
            preferenceEntries.forEach(entry => {
                const destCode = entry.querySelector('.preference-destination').value;
                const ratingStars = entry.querySelector('.rating-stars');
                const rating = parseInt(ratingStars.dataset.rating || '0');
                
                if (destCode && rating > 0) {
                    preferences[destCode] = rating;
                }
            });
            
            travelers.push({
                name: name,
                origin: origin,
                preferences: preferences
            });
        }
    });
    
    // Get selected destinations
    const destinations = [];
    const destinationCheckboxes = document.querySelectorAll('.destination-checkbox:checked');
    destinationCheckboxes.forEach(checkbox => {
        destinations.push(checkbox.value);
    });
    
    return {
        travelDate: travelDate,
        costWeight: costWeight,
        emissionsWeight: emissionsWeight,
        preferenceWeight: preferenceWeight,
        travelers: travelers,
        destinations: destinations
    };
}

// Load airport codes from the API
async function loadAirportCodes() {
        const response = await fetch('/api/airport-codes');
    const airports = await response.json();
    return airports;
}

// Add a new traveler to the form
async function addTraveler(name = '', originCode = '') {
    // Get the template and clone it
    const template = document.getElementById('travelerTemplate');
    const travelerEntry = document.importNode(template.content, true).querySelector('.traveler-entry');
    
    // Set name if provided
    if (name) {
        travelerEntry.querySelector('.traveler-name').value = name;
    }
    
    // Load airport codes for the origin dropdown
    const originSelect = travelerEntry.querySelector('.traveler-origin');
    
    const airports = await loadAirportCodes();
    airports.forEach(airport => {
        const option = document.createElement('option');
        option.value = airport.code;
        option.textContent = `${airport.code} - ${airport.name}`;
        originSelect.appendChild(option);
    });
    
    // Set origin if provided
    if (originCode) {
        originSelect.value = originCode;
    }
    
    // Add to the travelers container
    document.getElementById('travelersContainer').appendChild(travelerEntry);
}

// Format currency for display
function formatCurrency(amount) {
    try {
        if (amount === undefined || amount === null) return '$0.00';
        
        // Convert to number if it's a string
        const value = Number(amount);
        
        // Check if value is a valid number
        if (isNaN(value)) {
            return 'Invalid amount';
        }
        
    return new Intl.NumberFormat('en-US', {
        style: 'currency',
        currency: 'USD'
        }).format(value);
    } catch (error) {
        console.error('Error formatting currency:', error);
        return '$0.00';
    }
}

// Format date and time for display
function formatDateTime(isoString) {
    try {
        if (!isoString) return 'N/A';
        
    const date = new Date(isoString);
        
        // Check if date is valid
        if (isNaN(date.getTime())) {
            return 'Invalid date';
        }
        
        return new Intl.DateTimeFormat('en-US', {
        month: 'short',
        day: 'numeric',
            hour: 'numeric',
        minute: '2-digit'
        }).format(date);
    } catch (error) {
        console.error('Error formatting date:', error);
        return 'Error';
    }
}

// Format duration for display
function formatDuration(minutes) {
    try {
        if (minutes === undefined || minutes === null) return 'N/A';
        
        // Convert to number if it's a string
        const mins = Number(minutes);
        
        // Check if value is a valid number
        if (isNaN(mins)) {
            return 'Invalid duration';
        }
        
        const hours = Math.floor(mins / 60);
        const remainingMins = Math.round(mins % 60);
        return `${hours}h ${remainingMins}m`;
    } catch (error) {
        console.error('Error formatting duration:', error);
        return 'Error';
    }
}

// Find optimal destinations via API
async function findDestinations() {
    const loadingSpinner = document.getElementById('loadingSpinner');
    const resultsContainer = document.getElementById('resultsContainer');
    
    // Show loading spinner
    loadingSpinner.classList.remove('d-none');
    
    // Get input values
    const preferences = getCurrentPreferences();
        
    // Validate input
    if (!preferences.travelDate) {
            alert('Please select a travel date');
        loadingSpinner.classList.add('d-none');
            return;
        }
        
    if (preferences.travelers.length === 0) {
            alert('Please add at least one traveler');
        loadingSpinner.classList.add('d-none');
            return;
        }
        
    if (preferences.destinations.length === 0) {
            alert('Please select at least one destination');
        loadingSpinner.classList.add('d-none');
            return;
        }
        
    try {
        // Call the API
        const response = await fetch('/api/find-destinations', {
            method: 'POST',
            headers: {
                'Content-Type': 'application/json',
            },
            body: JSON.stringify(preferences)
        });
        
        const data = await response.json();
        
        // Hide loading spinner
        loadingSpinner.classList.add('d-none');
        
        // Show results
        if (data.error) {
            alert('Error: ' + data.error);
        } else if (data.destinations && data.destinations.length > 0) {
        displayResults(data.destinations);
        } else {
            alert('No suitable destinations found. Try different criteria.');
        }
    } catch (error) {
        console.error('Error finding destinations:', error);
        alert('Error: ' + error.message);
        loadingSpinner.classList.add('d-none');
    }
}

// Display destination results
function displayResults(destinations) {
    const resultsContainer = document.getElementById('resultsContainer');
    const destinationResults = document.getElementById('destinationResults');
    
    // Clear previous results
    destinationResults.innerHTML = '';
    
    if (!destinations || destinations.length === 0) {
        const noResultsMessage = document.createElement('div');
        noResultsMessage.className = 'alert alert-info';
        noResultsMessage.textContent = 'No suitable destinations found with your criteria. Try adjusting your preferences.';
        destinationResults.appendChild(noResultsMessage);
        resultsContainer.classList.remove('d-none');
        return;
    }
    
    // Create result elements
    destinations.forEach(destination => {
        const template = document.getElementById('destinationResultTemplate');
        const resultElement = document.importNode(template.content, true).querySelector('.destination-result');
        
        // Set destination header with error handling
        const destCode = destination.destination || 'Unknown';
        const destName = destination.destination_name || 'Unknown Location';
        const score = destination.score !== undefined ? Math.round(destination.score * 100) / 100 : 'N/A';
        
        // Add preference count if available
        let preferenceText = '';
        if (destination.preference_count !== undefined && destination.preference_count > 0) {
            preferenceText = ` <span class="preference-badge" title="Community preference count">❤️ ${destination.preference_count}</span>`;
        }
        
        // Format score - now higher is better (0-1 scale, showing as 0-100%)
        const scoreDisplay = score === 'N/A' ? 'N/A' : `${Math.round(score * 100)}%`;
        
        resultElement.querySelector('.destination-header').innerHTML = 
            `${destCode} - ${destName} (Score: ${scoreDisplay})${preferenceText}`;
            
        // Set cost and emissions
        resultElement.querySelector('.total-cost').textContent = formatCurrency(destination.total_cost || 0);
        resultElement.querySelector('.avg-cost').textContent = formatCurrency(destination.average_cost || 0);
        resultElement.querySelector('.emissions').textContent = `${Math.round((destination.total_emissions || 0) * 100) / 100} kg CO₂`;
        
        // Add flight plans
        const flightPlansContainer = resultElement.querySelector('.flight-plans');
        
        if (destination.flight_plans && Array.isArray(destination.flight_plans)) {
            destination.flight_plans.forEach(plan => {
                const flightTemplate = document.getElementById('flightPlanTemplate');
                const flightElement = document.importNode(flightTemplate.content, true).querySelector('.flight-plan');
            
                // Set traveler info
                flightElement.querySelector('.traveler-name').textContent = plan.traveler || 'Unknown';
                flightElement.querySelector('.traveler-origin').textContent = plan.origin ? ` from ${plan.origin}` : '';
                
                // Set flight details
                if (plan.price > 0) {  // Skip if it's "already there" (price = 0)
                    flightElement.querySelector('.flight-airline').textContent = `${plan.airline || 'Unknown'} ${plan.flight_number ? `(${plan.flight_number})` : ''}`;
                    flightElement.querySelector('.flight-price').textContent = formatCurrency(plan.price || 0);
                    flightElement.querySelector('.flight-departure').textContent = plan.departure ? formatDateTime(plan.departure) : 'N/A';
                    flightElement.querySelector('.flight-arrival').textContent = plan.arrival ? formatDateTime(plan.arrival) : 'N/A';
                    flightElement.querySelector('.flight-duration').lastChild.textContent = plan.duration_minutes ? formatDuration(plan.duration_minutes) : 'N/A';
                    flightElement.querySelector('.flight-emissions').textContent = `Emissions: ${Math.round((plan.emissions_kg || 0) * 100) / 100} kg CO₂`;
                } else {
                    flightElement.querySelector('.flight-airline').textContent = 'Already at destination';
                    flightElement.querySelector('.flight-price').textContent = '$0';
                    flightElement.querySelector('.flight-departure').textContent = 'N/A';
                    flightElement.querySelector('.flight-arrival').textContent = 'N/A';
                    flightElement.querySelector('.flight-duration').lastChild.textContent = '0h 0m';
                    flightElement.querySelector('.flight-emissions').textContent = 'Emissions: 0 kg CO₂';
                }
                
                flightPlansContainer.appendChild(flightElement);
            });
        } else {
            // Handle missing flight plans
            const noFlightsMessage = document.createElement('p');
            noFlightsMessage.className = 'text-muted';
            noFlightsMessage.textContent = 'No flight details available';
            flightPlansContainer.appendChild(noFlightsMessage);
        }
        
        // Add to results container
        destinationResults.appendChild(resultElement);
    });
    
    // Show results container
    resultsContainer.classList.remove('d-none');
    
    // Scroll to results
    resultsContainer.scrollIntoView({ behavior: 'smooth' });
}

// Add a preference to a traveler
async function addPreference(travelerEntry) {
    // Get the template and clone it
    const template = document.getElementById('preferenceTemplate');
    const preferenceEntry = document.importNode(template.content, true).querySelector('.preference-entry');
    
    // Load airport codes for the destination dropdown
    const destSelect = preferenceEntry.querySelector('.preference-destination');
    
    const airports = await loadAirportCodes();
    airports.forEach(airport => {
        const option = document.createElement('option');
        option.value = airport.code;
        option.textContent = `${airport.code} - ${airport.name}`;
        destSelect.appendChild(option);
    });
    
    // Add to the preferences list
    travelerEntry.querySelector('.preferences-list').appendChild(preferenceEntry);
} 