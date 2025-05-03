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
        
        // Show loading indicator
        chatLoadingIndicator.classList.remove('d-none');
        
        // Get current travelers and preferences
        const preferences = getCurrentPreferences();
        
        // Send to API
        fetch('/api/chat', {
            method: 'POST',
            headers: {
                'Content-Type': 'application/json',
            },
            body: JSON.stringify({
                message: message,
                preferences: preferences
            })
        })
        .then(response => response.json())
        .then(data => {
            // Hide loading indicator
            chatLoadingIndicator.classList.add('d-none');
            
            if (data.message) {
                // Add assistant's message to chat
                addChatMessage(data.message, 'bot');
                
                // Check for destination suggestions in the response
                checkForDestinationSuggestions(data.message);
                
                // Process destination preference recommendations if available
                if (data.destination_recommendations && Object.keys(data.destination_recommendations).length > 0) {
                    displayDestinationRecommendations(data.destination_recommendations);
                }
                
                // Refresh destination results to incorporate any new preferences
                findDestinations();
            } else if (data.error) {
                addChatMessage('Error: ' + data.error, 'bot');
            }
        })
        .catch(error => {
            // Hide loading indicator
            chatLoadingIndicator.classList.add('d-none');
            addChatMessage('Sorry, there was an error processing your request.', 'bot');
            console.error('Chat API error:', error);
        });
    }
    
    // Function to add a message to the chat
    function addChatMessage(text, sender) {
        const messageDiv = document.createElement('div');
        messageDiv.className = `message ${sender}-message`;
        messageDiv.textContent = text;
        chatMessages.appendChild(messageDiv);
        chatMessages.scrollTop = chatMessages.scrollHeight;
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
    
    // Check for destination suggestions in AI response
    function checkForDestinationSuggestions(message) {
        // Look for airport codes in the response (3 uppercase letters)
        const airportCodeRegex = /\b([A-Z]{3})\b/g;
        const suggestedAirports = [...message.matchAll(airportCodeRegex)].map(match => match[1]);
        
        if (suggestedAirports.length > 0) {
            // Make suggestions visible
            const aiSuggestions = document.getElementById('aiSuggestions');
            const suggestionsContent = document.getElementById('suggestionsContent');
            aiSuggestions.classList.remove('d-none');
            
            // Clear previous suggestions
            suggestionsContent.innerHTML = '';
            
            // Create suggestion buttons
            const uniqueAirports = [...new Set(suggestedAirports)];
            
            uniqueAirports.forEach(airport => {
                const button = document.createElement('button');
                button.className = 'btn btn-sm btn-outline-primary me-2 mb-2';
                button.textContent = `Add ${airport}`;
                button.addEventListener('click', () => {
                    // Add this airport to selected destinations
                    const checkbox = document.getElementById(`dest-${airport}`);
                    if (checkbox && !checkbox.checked) {
                        checkbox.checked = true;
                        button.className = 'btn btn-sm btn-success me-2 mb-2';
                        button.textContent = `Added ${airport}`;
                        button.disabled = true;
                        
                        // Add a message to acknowledge the action
                        addChatMessage(`I've added ${airport} to your destination options.`, 'bot');
                    }
                });
                
                suggestionsContent.appendChild(button);
            });
        }
    }
    
    // Display destination preference recommendations from AI
    function displayDestinationRecommendations(recommendations) {
        // Create or get the recommendations container
        let recommendationsDiv = document.getElementById('aiPreferenceRecommendations');
        if (!recommendationsDiv) {
            recommendationsDiv = document.createElement('div');
            recommendationsDiv.id = 'aiPreferenceRecommendations';
            recommendationsDiv.className = 'mt-3 p-3 border rounded bg-light';
            
            // Insert it after the chat messages container
            const chatMessages = document.getElementById('chatMessages');
            chatMessages.parentNode.insertBefore(recommendationsDiv, chatMessages.nextSibling);
        }
        
        // Clear previous recommendations
        recommendationsDiv.innerHTML = '';
        
        // Add header
        const header = document.createElement('h5');
        header.textContent = 'AI Destination Preference Recommendations';
        recommendationsDiv.appendChild(header);
        
        // Add description
        const description = document.createElement('p');
        description.textContent = 'The AI recommends these destination preferences based on your conversation:';
        description.className = 'small text-muted';
        recommendationsDiv.appendChild(description);
        
        // Create a container for recommendations
        const recommendationsContainer = document.createElement('div');
        recommendationsContainer.className = 'recommendations-container';
        recommendationsDiv.appendChild(recommendationsContainer);
        
        // Add a recommendation for each airport
        for (const [airport, rating] of Object.entries(recommendations)) {
            const recDiv = document.createElement('div');
            recDiv.className = 'recommendation-item d-flex align-items-center mb-2 p-2 border-bottom';
            
            // Airport code and rating
            const airportInfo = document.createElement('div');
            airportInfo.className = 'flex-grow-1';
            airportInfo.innerHTML = `<strong>${airport}</strong> - Rating: ${rating}/5`;
            recDiv.appendChild(airportInfo);
            
            // Create buttons to add to travelers
            const travelerElements = document.querySelectorAll('.traveler-entry');
            travelerElements.forEach((travelerEl, index) => {
                const travelerName = travelerEl.querySelector('.traveler-name').value;
                if (travelerName) {
                    const addButton = document.createElement('button');
                    addButton.className = 'btn btn-sm btn-outline-success ms-2';
                    addButton.textContent = `Add to ${travelerName}`;
                    addButton.dataset.airport = airport;
                    addButton.dataset.rating = rating;
                    addButton.dataset.travelerIndex = index;
                    
                    addButton.addEventListener('click', function() {
                        addPreferenceToTraveler(this.dataset.travelerIndex, this.dataset.airport, this.dataset.rating);
                        this.className = 'btn btn-sm btn-success ms-2';
                        this.textContent = `Added to ${travelerName}`;
                        this.disabled = true;
                    });
                    
                    recDiv.appendChild(addButton);
                }
            });
            
            recommendationsContainer.appendChild(recDiv);
        }
        
        // Add a reject all button
        const rejectButton = document.createElement('button');
        rejectButton.className = 'btn btn-sm btn-outline-danger mt-2';
        rejectButton.textContent = 'Dismiss All Recommendations';
        rejectButton.addEventListener('click', function() {
            recommendationsDiv.remove();
        });
        recommendationsDiv.appendChild(rejectButton);
    }
    
    // Add a recommendation as a preference to a specific traveler
    function addPreferenceToTraveler(travelerIndex, airport, rating) {
        const travelerElements = document.querySelectorAll('.traveler-entry');
        const travelerEl = travelerElements[travelerIndex];
        
        if (travelerEl) {
            // Add a new preference to this traveler
            const preferencesContainer = travelerEl.querySelector('.preferences-list');
            
            // First check if there's already a preference for this airport
            const existingPrefEntries = travelerEl.querySelectorAll('.preference-entry');
            let preferenceExists = false;
            
            existingPrefEntries.forEach(entry => {
                const destSelect = entry.querySelector('.preference-destination');
                if (destSelect && destSelect.value === airport) {
                    // Update the existing preference rating
                    const ratingStars = entry.querySelector('.rating-stars');
                    const stars = ratingStars.querySelectorAll('.rating-star');
                    
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
                    
                    // Store the rating value
                    ratingStars.dataset.rating = rating;
                    preferenceExists = true;
                }
            });
            
            // If the preference doesn't exist yet, create a new one
            if (!preferenceExists) {
                addPreference(travelerEl).then(() => {
                    // Get the newly added preference entry (it's the last one)
                    const newPrefEntry = travelerEl.querySelector('.preferences-list .preference-entry:last-child');
                    if (newPrefEntry) {
                        // Set the destination
                        const destSelect = newPrefEntry.querySelector('.preference-destination');
                        destSelect.value = airport;
                        
                        // Set the rating
                        const ratingStars = newPrefEntry.querySelector('.rating-stars');
                        const stars = ratingStars.querySelectorAll('.rating-star');
                        
                        // Update stars
                        stars.forEach(star => {
                            const starRating = parseInt(star.dataset.rating);
                            if (starRating <= rating) {
                                star.classList.remove('bi-star');
                                star.classList.add('bi-star-fill');
                            }
                        });
                        
                        // Store the rating value
                        ratingStars.dataset.rating = rating;
                    }
                });
            }
        }
    }
}

// Load airport codes from API
async function loadAirportCodes() {
    try {
        const response = await fetch('/api/airport-codes');
        const data = await response.json();
        return data;
    } catch (error) {
        console.error('Error loading airport codes:', error);
        return [];
    }
}

// Add a new traveler to the form
async function addTraveler(name = '', originCode = '') {
    const travelersContainer = document.getElementById('travelersContainer');
    const template = document.getElementById('travelerTemplate');
    const travelerNode = template.content.cloneNode(true);
    
    // Set name if provided
    const nameInput = travelerNode.querySelector('.traveler-name');
    if (name) {
        nameInput.value = name;
    }
    
    // Load airport options
    const originSelect = travelerNode.querySelector('.traveler-origin');
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
    
    travelersContainer.appendChild(travelerNode);
}

// Format currency
function formatCurrency(amount) {
    return new Intl.NumberFormat('en-US', {
        style: 'currency',
        currency: 'USD'
    }).format(amount);
}

// Format date and time
function formatDateTime(isoString) {
    const date = new Date(isoString);
    return date.toLocaleString('en-US', {
        year: 'numeric',
        month: 'short',
        day: 'numeric',
        hour: '2-digit',
        minute: '2-digit'
    });
}

// Format duration
function formatDuration(minutes) {
    const hours = Math.floor(minutes / 60);
    const mins = minutes % 60;
    return `${hours}h ${mins}m`;
}

// Submit the form to find destinations
async function findDestinations() {
    // Show loading state
    const loadingSpinner = document.getElementById('loadingSpinner');
    loadingSpinner.classList.remove('d-none');
    
    const resultsContainer = document.getElementById('resultsContainer');
    resultsContainer.classList.remove('d-none');
    
    const destinationResults = document.getElementById('destinationResults');
    destinationResults.innerHTML = '';
    
    try {
        // Gather form data
        const travelDate = document.getElementById('travelDate').value;
        
        const costWeight = parseFloat(document.getElementById('costWeight').value);
        const emissionsWeight = parseFloat(document.getElementById('emissionsWeight').value);
        const preferenceWeight = parseFloat(document.getElementById('preferenceWeight').value);
        
        // Get travelers
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
                    name,
                    origin,
                    preferences
                });
            }
        });
        
        // Get selected destinations
        const destinations = [];
        const destinationCheckboxes = document.querySelectorAll('.destination-checkbox:checked');
        
        destinationCheckboxes.forEach(checkbox => {
            destinations.push(checkbox.value);
        });
        
        // Validate
        if (!travelDate) {
            alert('Please select a travel date');
            return;
        }
        
        if (travelers.length === 0) {
            alert('Please add at least one traveler');
            return;
        }
        
        if (destinations.length === 0) {
            alert('Please select at least one destination');
            return;
        }
        
        // Send API request
        const response = await fetch('/api/find-destinations', {
            method: 'POST',
            headers: {
                'Content-Type': 'application/json'
            },
            body: JSON.stringify({
                travelers,
                destinations,
                travelDate,
                costWeight,
                emissionsWeight,
                preferenceWeight
            })
        });
        
        const data = await response.json();
        
        if (data.error) {
            throw new Error(data.error);
        }
        
        // Display results
        displayResults(data.destinations);
        
    } catch (error) {
        console.error('Error finding destinations:', error);
        destinationResults.innerHTML = `
            <div class="alert alert-danger">
                Error: ${error.message || 'An unexpected error occurred'}
            </div>
        `;
    } finally {
        loadingSpinner.classList.add('d-none');
    }
}

// Display destination results
function displayResults(destinations) {
    const destinationResults = document.getElementById('destinationResults');
    destinationResults.innerHTML = '';
    
    if (!destinations || destinations.length === 0) {
        destinationResults.innerHTML = `
            <div class="alert alert-info">
                No valid destinations found. Try adjusting your criteria.
            </div>
        `;
        return;
    }
    
    const template = document.getElementById('destinationResultTemplate');
    const flightPlanTemplate = document.getElementById('flightPlanTemplate');
    
    destinations.forEach((destination, index) => {
        const destNode = template.content.cloneNode(true);
        
        // Set destination header - add console.log to debug
        console.log("Destination data:", destination);
        
        // Check if destination code exists before using it
        const destCode = destination.destination || destination.destination_code || "Unknown";
        destNode.querySelector('.destination-header').textContent = `${index + 1}. ${destCode}`;
            
        // Set metrics
        destNode.querySelector('.total-cost').textContent = formatCurrency(destination.total_cost);
        destNode.querySelector('.avg-cost').textContent = formatCurrency(destination.average_cost);
        destNode.querySelector('.emissions').textContent = `${destination.total_emissions.toFixed(1)} kg`;
        
        // Add flight plans
        const flightPlansContainer = destNode.querySelector('.flight-plans');
        
        destination.flight_plans.forEach(plan => {
            const planNode = flightPlanTemplate.content.cloneNode(true);
            
            // Set traveler info
            planNode.querySelector('.traveler-name').textContent = plan.traveler;
            planNode.querySelector('.traveler-origin').textContent = ` (from ${plan.origin})`;
            
            // Check if this is a "already at destination" case
            if (plan.price === 0) {
                planNode.querySelector('.card-body').innerHTML = `
                    <div class="alert alert-success mb-0">
                        Already at destination
                    </div>
                `;
            } else {
                // Set flight details
                planNode.querySelector('.flight-airline').textContent = `${plan.airline}${plan.flight_number ? ` (${plan.flight_number})` : ''}`;
                planNode.querySelector('.flight-price').textContent = formatCurrency(plan.price);
                planNode.querySelector('.flight-departure').textContent = formatDateTime(plan.departure);
                planNode.querySelector('.flight-arrival').textContent = formatDateTime(plan.arrival);
                planNode.querySelector('.flight-duration div').textContent = formatDuration(plan.duration_minutes);
                
                if (plan.emissions_kg) {
                    planNode.querySelector('.flight-emissions').textContent = `CO₂: ${plan.emissions_kg.toFixed(1)} kg`;
                }
            }
            
            flightPlansContainer.appendChild(planNode);
        });
        
        destinationResults.appendChild(destNode);
    });
}

// Add preference to traveler
async function addPreference(travelerEntry) {
    const preferencesContainer = travelerEntry.querySelector('.preferences-list');
    const template = document.getElementById('preferenceTemplate');
    const preferenceNode = template.content.cloneNode(true);
    
    // Load destination options
    const destSelect = preferenceNode.querySelector('.preference-destination');
    const airports = await loadAirportCodes();
    
    airports.forEach(airport => {
        const option = document.createElement('option');
        option.value = airport.code;
        option.textContent = `${airport.code} - ${airport.name}`;
        destSelect.appendChild(option);
    });
    
    preferencesContainer.appendChild(preferenceNode);
} 