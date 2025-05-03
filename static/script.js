document.addEventListener('DOMContentLoaded', function() {
    // Initialize preference manager
    PreferenceManager.init();
    
    // Add CSS for animations
    const style = document.createElement('style');
    style.textContent = `
        @keyframes pulse {
            0% { opacity: 1; }
            50% { opacity: 0.5; }
            100% { opacity: 1; }
        }
        
        .update-indicator {
            animation: pulse 2s infinite;
        }
        
        .preference-updated {
            transition: background-color 0.5s ease;
            background-color: #f0f8ff !important;
            border: 1px solid #007bff !important;
            border-radius: 4px;
            padding: 5px;
        }
        
        #recentlyUpdatedPreferences {
            background-color: #f8f9fa;
            border-left: 4px solid #007bff;
            margin-bottom: 15px;
        }
    `;
    document.head.appendChild(style);
    
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

    // Add general preference button event
    document.getElementById('addGeneralPrefBtn').addEventListener('click', function() {
        addGeneralPreference();
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
    
    // Event delegation for general preferences
    document.getElementById('generalPreferencesContainer').addEventListener('click', function(e) {
        // Handle remove general preference button
        if (e.target.classList.contains('remove-general-pref') || e.target.closest('.remove-general-pref')) {
            const prefItem = e.target.closest('.general-preference-item');
            if (prefItem) {
                prefItem.remove();
            }
        }
    });
    
    // Initialize chat functionality
    initializeChat();

    // Add the fix button
    addFixButton();
    
    // Try to fix ratings after a short delay
    setTimeout(fixAllRatingDisplay, 1000);
});

// Helper function to safely insert an element after another element
function safeInsertAfter(newNode, referenceNode) {
    if (!referenceNode) {
        console.error("Reference node is null, cannot insert element");
        return false;
    }

    if (!referenceNode.parentNode) {
        console.error("Reference node has no parent, cannot insert element");
        return false;
    }

    referenceNode.parentNode.insertBefore(newNode, referenceNode.nextSibling);
    return true;
}

// Helper function to safely insert an element as the first child of a parent
function safeInsertAsFirstChild(newNode, parentNode) {
    if (!parentNode) {
        console.error("Parent node is null, cannot insert element");
        return false;
    }
    
    if (parentNode.firstChild) {
        parentNode.insertBefore(newNode, parentNode.firstChild);
    } else {
        parentNode.appendChild(newNode);
    }
    return true;
}

// Initialize chat functionality
function initializeChat() {
    const chatInput = document.getElementById('chatInput');
    const sendChatBtn = document.getElementById('sendChatBtn');
    const chatMessages = document.getElementById('chatMessages');
    const chatLoadingIndicator = document.getElementById('chatLoadingIndicator');
    
    // Store chat history
    let chatHistory = [];
    
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
                preferences: preferences,
                chat_history: chatHistory
            })
        })
        .then(response => response.json())
        .then(data => {
            // Hide loading indicator
            chatLoadingIndicator.classList.add('d-none');
            
            if (data.message) {
                // Add assistant's message to chat
                addChatMessage(data.message, 'bot');
                
                // Store assistant response in chat history
                chatHistory.push({
                    role: 'assistant',
                    content: data.message
                });
                
                // Limit chat history to last 10 messages to avoid exceeding API limits
                if (chatHistory.length > 20) {
                    chatHistory = chatHistory.slice(chatHistory.length - 20);
                }
                
                // Check for destination suggestions in the response
                checkForDestinationSuggestions(data.message);
                
                // Process destination preference recommendations if available
                if (data.destination_recommendations && Object.keys(data.destination_recommendations).length > 0) {
                    displayDestinationRecommendations(data.destination_recommendations);
                    
                    // Update global airport preferences based on suggestions and avoid list
                    PreferenceManager.updateAirportRatings(data.destination_recommendations, data.destinations_to_avoid);
                }
                
                // Process destinations to avoid if available
                if (data.destinations_to_avoid && Object.keys(data.destinations_to_avoid).length > 0) {
                    displayDestinationsToAvoid(data.destinations_to_avoid);
                    
                    // If recommendations weren't processed above, make sure to update based on avoid list
                    if (!data.destination_recommendations || Object.keys(data.destination_recommendations).length === 0) {
                        PreferenceManager.updateAirportRatings(null, data.destinations_to_avoid);
                    }
                }
                
                // Process general preference suggestions if available
                if (data.general_preference_suggestions && data.general_preference_suggestions.length > 0) {
                    // Automatically integrate general preference suggestions
                    const autoIntegrate = true; // Set to false if you want manual confirmation
                    
                    if (autoIntegrate) {
                        // Auto-add all general preferences
                        data.general_preference_suggestions.forEach(suggestion => {
                            addToGeneralPreferences(suggestion.type, suggestion.value);
                        });
                        
                        // Show notification that preferences were added
                        const notificationMsg = `Automatically added ${data.general_preference_suggestions.length} preferences based on your conversation.`;
                        addChatMessage(notificationMsg, 'bot');
                    } else {
                        // Just display suggestions for manual addition
                        displayGeneralPreferenceSuggestions(data.general_preference_suggestions);
                    }
                }
                
                // Handle preference modifications if available
                if (data.preference_modifications && data.preference_modifications.length > 0) {
                    // Automatically apply modifications
                    applyPreferenceModifications(data.preference_modifications);
                    
                    // Show notification
                    const notificationMsg = `Updated ${data.preference_modifications.length} preferences based on your feedback.`;
                    addChatMessage(notificationMsg, 'bot');
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
            console.error('Chat API error:', error);
            
            // Show detailed error message
            const errorMessage = `Sorry, there was an error processing your request: ${error.message || 'Unknown error'}`;
            addChatMessage(errorMessage, 'bot');
            
            // Add retry button
            const retryButton = document.createElement('button');
            retryButton.className = 'btn btn-warning mt-2';
            retryButton.textContent = 'Retry request';
            retryButton.addEventListener('click', () => {
                // Remove the error message and retry button
                chatMessages.removeChild(chatMessages.lastChild);
                chatMessages.removeChild(chatMessages.lastChild);
                
                // Add a retry message
                addChatMessage('Retrying your request...', 'bot');
                
                // Resend the last user message
                const lastUserMessage = chatHistory.find(entry => entry.role === 'user');
                if (lastUserMessage) {
                    // Set the input field to the last message
                    chatInput.value = lastUserMessage.content;
                    // Remove the last user message from history to avoid duplication
                    chatHistory.pop();
                    // Send the message again
                    sendChatMessage();
                }
            });
            
            // Append retry button to chat
            chatMessages.appendChild(retryButton);
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
        
        // Get general preferences
        const generalPreferences = [];
        const generalPrefItems = document.querySelectorAll('.general-preference-item');
        generalPrefItems.forEach(item => {
            const type = item.querySelector('.preference-type').value;
            const value = item.querySelector('.preference-value').value;
            
            if (value.trim()) {
                // For preferred destinations, include the rating
                if (type === 'preferred_destination') {
                    const ratingStars = item.querySelector('.general-rating-stars');
                    const rating = ratingStars ? parseInt(ratingStars.dataset.rating || '3') : 3;
                    
                    generalPreferences.push({
                        type: type,
                        value: value.trim(),
                        rating: rating
                    });
                } else {
                    generalPreferences.push({
                        type: type,
                        value: value.trim()
                    });
                }
            }
        });
        
        return {
            travelDate: travelDate,
            costWeight: costWeight,
            emissionsWeight: emissionsWeight,
            preferenceWeight: preferenceWeight,
            travelers: travelers,
            destinations: destinations,
            generalPreferences: generalPreferences
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
    
    // Process destination preference recommendations from AI
    function displayDestinationRecommendations(recommendations) {
        // Check for duplicates first and track changes
        const changedPreferences = [];
        
        console.log("Processing AI recommendations:", recommendations);
        
        // Update each recommendation through the preference manager
        for (const [airport, rating] of Object.entries(recommendations)) {
            // Positive recommendations should increment the rating
            const result = PreferenceManager.incrementRating(airport, 1);
            changedPreferences.push({
                destination: airport,
                oldRating: result.oldRating,
                newRating: result.newRating,
                adjustment: `+1`,
                type: 'preferred_destination'
            });
        }
        
        // Now sync the UI with all stored preferences
        PreferenceManager.syncUI();
        
        // Don't create recommendation UI if there are no recommendations
        if (Object.keys(recommendations).length === 0) {
            return;
        }
        
        // Create or get the recommendations container
        let recommendationsDiv = document.getElementById('aiPreferenceRecommendations');
        if (!recommendationsDiv) {
            recommendationsDiv = document.createElement('div');
            recommendationsDiv.id = 'aiPreferenceRecommendations';
            recommendationsDiv.className = 'mt-3 p-3 border rounded bg-light';
            
            // Insert it after the chat messages container
            const chatMessages = document.getElementById('chatMessages');
            if (chatMessages) {
                // Use safe insert function
                if (!safeInsertAfter(recommendationsDiv, chatMessages)) {
                    // Fallback: append to the chat container
                    const chatContainer = document.querySelector('.chat-container');
                    if (chatContainer) {
                        chatContainer.appendChild(recommendationsDiv);
                    } else {
                        console.error("Cannot find suitable container for recommendations");
                        return; // Exit if we can't place the element
                    }
                }
            } else {
                console.error("Chat messages container not found");
                return; // Exit if chat messages not found
            }
        }
        
        // Clear previous recommendations
        recommendationsDiv.innerHTML = '';
        
        // Add header
        const header = document.createElement('h5');
        header.textContent = 'AI Destination Preference Recommendations';
        recommendationsDiv.appendChild(header);
        
        // Add notification about preference updates
        const autoAddNotice = document.createElement('div');
        autoAddNotice.className = 'alert alert-success mb-3';
        autoAddNotice.textContent = `Updated ${changedPreferences.length} destination preferences based on recommendations.`;
        recommendationsDiv.appendChild(autoAddNotice);
        
        // Add description
        const description = document.createElement('p');
        description.textContent = 'The AI recommends these destination preferences based on your conversation:';
        description.className = 'small text-muted';
        recommendationsDiv.appendChild(description);
        
        // Create a container for recommendations
        const recommendationsContainer = document.createElement('div');
        recommendationsContainer.className = 'recommendations-container';
        recommendationsDiv.appendChild(recommendationsContainer);
        
        // Show all recommendations
        for (const [airport, recommendedRating] of Object.entries(recommendations)) {
            const actualRating = PreferenceManager.getRating(airport);
            const recDiv = document.createElement('div');
            recDiv.className = 'recommendation-item d-flex align-items-center mb-2 p-2 border-bottom';
            
            // Airport code and rating
            const airportInfo = document.createElement('div');
            airportInfo.className = 'flex-grow-1';
            
            // Show the actual current rating
            airportInfo.innerHTML = `<strong>${airport}</strong> - Current Rating: ${actualRating}/5 <span class="badge bg-success ms-2">+1</span>`;
            
            recDiv.appendChild(airportInfo);
            
            // Create buttons to add to travelers
            const travelerElements = document.querySelectorAll('.traveler-entry');
            
            // Create the "Add to General Preferences" button - now shows as already added
            const addToGeneralButton = document.createElement('button');
            addToGeneralButton.className = 'btn btn-sm btn-primary ms-2';
            addToGeneralButton.textContent = 'Added to General';
            addToGeneralButton.dataset.airport = airport;
            addToGeneralButton.dataset.rating = actualRating;
            addToGeneralButton.disabled = true;
            
            recDiv.appendChild(addToGeneralButton);
            
            // Now add buttons for individual travelers
            travelerElements.forEach((travelerEl, index) => {
                const travelerName = travelerEl.querySelector('.traveler-name').value;
                if (travelerName) {
                    const addButton = document.createElement('button');
                    addButton.className = 'btn btn-sm btn-outline-success ms-2';
                    addButton.textContent = `Add to ${travelerName}`;
                    addButton.dataset.airport = airport;
                    addButton.dataset.rating = actualRating;
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
        
        // Add a dismiss button
        const dismissButton = document.createElement('button');
        dismissButton.className = 'btn btn-sm btn-outline-secondary mt-2';
        dismissButton.textContent = 'Dismiss Recommendations';
        dismissButton.addEventListener('click', function() {
            recommendationsDiv.remove();
        });
        recommendationsDiv.appendChild(dismissButton);
    }
    
    // Display destinations to avoid from AI
    function displayDestinationsToAvoid(destinations) {
        // Track changes to preferences
        const changedPreferences = [];
        
        console.log("Processing destinations to avoid:", destinations);
        
        // Apply negative ratings through the preference manager
        for (const [airport, rating] of Object.entries(destinations)) {
            // Negative recommendations should decrement the rating
            const result = PreferenceManager.decrementRating(airport, 2);
            changedPreferences.push({
                destination: airport,
                oldRating: result.oldRating,
                newRating: result.newRating,
                adjustment: `-2`,
                type: 'preferred_destination'
            });
        }
        
        // Now sync the UI with all stored preferences
        PreferenceManager.syncUI();
        
        // Get the existing destinations to avoid or create a new container
        let avoidDiv = document.getElementById('aiDestinationsToAvoid');
        if (!avoidDiv) {
            avoidDiv = document.createElement('div');
            avoidDiv.id = 'aiDestinationsToAvoid';
            avoidDiv.className = 'mt-3 p-3 border rounded bg-danger bg-opacity-10';
            
            // Insert it after recommendations or chat
            const prefRecommendations = document.getElementById('aiPreferenceRecommendations');
            if (prefRecommendations) {
                // Use safe insert function
                if (!safeInsertAfter(avoidDiv, prefRecommendations)) {
                    // Fallback to chat container
                    const chatContainer = document.querySelector('.chat-container');
                    if (chatContainer) {
                        chatContainer.appendChild(avoidDiv);
                    } else {
                        console.error("Cannot find suitable container for destinations to avoid");
                        return; // Exit if we can't place the element
                    }
                }
            } else {
                const chatMessages = document.getElementById('chatMessages');
                if (chatMessages) {
                    // Use safe insert function
                    if (!safeInsertAfter(avoidDiv, chatMessages)) {
                        // Fallback to chat container
                        const chatContainer = document.querySelector('.chat-container');
                        if (chatContainer) {
                            chatContainer.appendChild(avoidDiv);
                        } else {
                            console.error("Cannot find suitable container for destinations to avoid");
                            return; // Exit if we can't place the element
                        }
                    }
                } else {
                    // Last resort - try to find the main container
                    const mainContainer = document.querySelector('.container');
                    if (mainContainer) {
                        const row = mainContainer.querySelector('.row');
                        if (row) {
                            const col = row.querySelector('.col-md-6');
                            if (col) {
                                col.appendChild(avoidDiv);
                            } else {
                                mainContainer.appendChild(avoidDiv);
                            }
                        } else {
                            mainContainer.appendChild(avoidDiv);
                        }
                    } else {
                        console.error("Cannot find any suitable container");
                        return; // Exit if we can't place the element
                    }
                }
            }
        }
        
        // Clear previous content
        avoidDiv.innerHTML = '';
        
        // Add header with a warning icon
        const header = document.createElement('h5');
        header.innerHTML = '<i class="bi bi-exclamation-triangle-fill text-danger me-2"></i>Destinations to Avoid';
        header.className = 'text-danger';
        avoidDiv.appendChild(header);
        
        // Add notification about preference updates
        const autoAddNotice = document.createElement('div');
        autoAddNotice.className = 'alert alert-danger mb-3';
        autoAddNotice.textContent = `Updated ${changedPreferences.length} destination preferences with negative ratings.`;
        avoidDiv.appendChild(autoAddNotice);
        
        // Add description
        const description = document.createElement('p');
        description.textContent = 'The AI suggests avoiding these destinations based on your requirements:';
        description.className = 'small text-muted';
        avoidDiv.appendChild(description);
        
        // Create a container for the destinations to avoid
        const avoidContainer = document.createElement('div');
        avoidContainer.className = 'avoid-destinations-container';
        avoidDiv.appendChild(avoidContainer);
        
        // Add each destination to avoid with reasons
        for (const [airport, oldRating] of Object.entries(destinations)) {
            const currentRating = PreferenceManager.getRating(airport);
            const avoidItem = document.createElement('div');
            avoidItem.className = 'avoid-item d-flex align-items-center mb-2 p-2 border-bottom border-danger border-opacity-25';
            
            // Create icon and airport code
            const airportInfo = document.createElement('div');
            airportInfo.className = 'flex-grow-1';
            airportInfo.innerHTML = `<i class="bi bi-x-circle-fill text-danger me-2"></i><strong>${airport}</strong> - Current Rating: ${currentRating}/5 <span class="badge bg-danger ms-2">-2</span>`;
            avoidItem.appendChild(airportInfo);
            
            // Create button to add as negative preference
            const addAsNegativeBtn = document.createElement('button');
            addAsNegativeBtn.className = 'btn btn-sm btn-danger ms-2';
            addAsNegativeBtn.textContent = 'Added as Negative';
            addAsNegativeBtn.dataset.airport = airport;
            addAsNegativeBtn.disabled = true;
            
            avoidItem.appendChild(addAsNegativeBtn);
            avoidContainer.appendChild(avoidItem);
        }
        
        // Add a dismiss button
        const dismissButton = document.createElement('button');
        dismissButton.className = 'btn btn-sm btn-outline-secondary mt-2';
        dismissButton.textContent = 'Dismiss';
        dismissButton.addEventListener('click', function() {
            avoidDiv.remove();
        });
        avoidDiv.appendChild(dismissButton);
    }
    
    // Apply preference modifications from the Chat API
    function applyPreferenceModifications(modifications) {
        console.log("Applying preference modifications:", modifications);
        
        if (!modifications || modifications.length === 0) {
            console.log("No modifications to apply");
            return;
        }
        
        // Track modified items for UI feedback
        const modifiedItems = [];
        
        // Apply all modifications through the preference manager
        let appliedModifications = 0;
        
        modifications.forEach(mod => {
            console.log(`Processing modification for ${mod.type}: ${mod.value} (Rating: ${mod.rating})`);
            
            if (mod.type === 'preferred_destination') {
                // Get the current rating from our preference manager
                const destination = mod.value.trim().toUpperCase();
                const currentRating = PreferenceManager.getRating(destination);
                
                // Determine if this is a positive or negative adjustment
                const adjustment = mod.rating > currentRating ? 
                    PreferenceManager.incrementRating(destination, 1) : 
                    PreferenceManager.decrementRating(destination, 1);
                
                console.log(`Modified ${destination} from ${adjustment.oldRating} to ${adjustment.newRating}`);
                
                appliedModifications++;
                
                // Check if this preference is in the UI
                const existingPref = findExistingDestinationPreference(destination);
                if (existingPref) {
                    modifiedItems.push(existingPref);
                }
            } else {
                // Handle other types of preferences
                const existingPref = findExistingGeneralPreference(mod.type, mod.value);
                
                if (existingPref) {
                    console.log(`Updating existing general preference: ${mod.type} - ${mod.value}`);
                    // Update existing preference
                    updateGeneralPreference(existingPref, mod.value, mod.sentiment);
                    appliedModifications++;
                    modifiedItems.push(existingPref);
                } else {
                    console.log(`Adding new general preference: ${mod.type} - ${mod.value}`);
                    // Add as new preference
                    addToGeneralPreferences(mod.type, mod.value);
                    appliedModifications++;
                }
            }
        });
        
        // Now sync the UI with all stored preferences
        PreferenceManager.syncUI();
        
        console.log(`Applied ${appliedModifications} preference modifications`);
        
        // Scroll to the recently updated preferences
        setTimeout(() => {
            const updatedContainer = document.getElementById('recentlyUpdatedPreferences');
            if (updatedContainer) {
                updatedContainer.scrollIntoView({ behavior: 'smooth', block: 'start' });
            } else if (modifiedItems.length > 0) {
                // If there's no recently updated container, scroll to the first modified item
                modifiedItems[0].scrollIntoView({ behavior: 'smooth', block: 'center' });
                
                // Add a temporary highlight class
                modifiedItems.forEach(item => {
                    item.classList.add('preference-updated');
                    setTimeout(() => {
                        item.classList.remove('preference-updated');
                    }, 5000);
                });
            }
        }, 300);
    }
    
    // Display general preference suggestions from AI
    function displayGeneralPreferenceSuggestions(suggestions) {
        // Create or get the suggestions container
        let suggestionsDiv = document.getElementById('aiGeneralPreferenceSuggestions');
        if (!suggestionsDiv) {
            suggestionsDiv = document.createElement('div');
            suggestionsDiv.id = 'aiGeneralPreferenceSuggestions';
            suggestionsDiv.className = 'mt-3 p-3 border rounded bg-light';
            
            // Insert it after the preferences recommendations or chat messages
            const prefRecommendations = document.getElementById('aiPreferenceRecommendations');
            if (prefRecommendations) {
                // Use safe insert function
                if (!safeInsertAfter(suggestionsDiv, prefRecommendations)) {
                    // Fallback to chat container
                    const chatContainer = document.querySelector('.chat-container');
                    if (chatContainer) {
                        chatContainer.appendChild(suggestionsDiv);
                    } else {
                        console.error("Cannot find suitable container for preference suggestions");
                        return; // Exit if we can't place the element
                    }
                }
            } else {
                const chatMessages = document.getElementById('chatMessages');
                if (chatMessages) {
                    // Use safe insert function
                    if (!safeInsertAfter(suggestionsDiv, chatMessages)) {
                        // Fallback to chat container
                        const chatContainer = document.querySelector('.chat-container');
                        if (chatContainer) {
                            chatContainer.appendChild(suggestionsDiv);
                        } else {
                            console.error("Cannot find suitable container for preference suggestions");
                            return; // Exit if we can't place the element
                        }
                    }
                } else {
                    // Last resort - try to find the main container
                    const mainContainer = document.querySelector('.container');
                    if (mainContainer) {
                        // Try to find an appropriate column
                        const prefColumn = document.querySelector('#generalPreferencesContainer');
                        if (prefColumn) {
                            // Insert at the top of the preferences container
                            safeInsertAsFirstChild(suggestionsDiv, prefColumn);
                        } else {
                            mainContainer.appendChild(suggestionsDiv);
                        }
                    } else {
                        console.error("Cannot find any suitable container");
                        return; // Exit if we can't place the element
                    }
                }
            }
        }
        
        // Clear previous suggestions
        suggestionsDiv.innerHTML = '';
        
        // Add header
        const header = document.createElement('h5');
        header.textContent = 'AI General Preference Suggestions';
        suggestionsDiv.appendChild(header);
        
        // Add description
        const description = document.createElement('p');
        description.textContent = 'The AI suggests these general preferences based on your conversation:';
        description.className = 'small text-muted';
        suggestionsDiv.appendChild(description);
        
        // Create a container for suggestions
        const suggestionsContainer = document.createElement('div');
        suggestionsContainer.className = 'suggestions-container';
        suggestionsDiv.appendChild(suggestionsContainer);
        
        // Add each general preference suggestion
        suggestions.forEach(suggestion => {
            const sugDiv = document.createElement('div');
            sugDiv.className = 'recommendation-item d-flex align-items-center mb-2 p-2 border-bottom';
            
            // Suggestion info
            const suggestionInfo = document.createElement('div');
            suggestionInfo.className = 'flex-grow-1';
            
            // Format the type name for display
            const typeName = suggestion.type.replace('_', ' ').charAt(0).toUpperCase() + suggestion.type.replace('_', ' ').slice(1);
            suggestionInfo.innerHTML = `<strong>${typeName}</strong>: ${suggestion.value}`;
            sugDiv.appendChild(suggestionInfo);
            
            // Add to general preferences button
            const addButton = document.createElement('button');
            addButton.className = 'btn btn-sm btn-outline-success ms-2';
            addButton.textContent = 'Add to General Preferences';
            addButton.dataset.type = suggestion.type;
            addButton.dataset.value = suggestion.value;
            
            addButton.addEventListener('click', function() {
                addToGeneralPreferences(this.dataset.type, this.dataset.value);
                this.className = 'btn btn-sm btn-success ms-2';
                this.textContent = 'Added';
                this.disabled = true;
            });
            
            sugDiv.appendChild(addButton);
            suggestionsContainer.appendChild(sugDiv);
        });
        
        // Add a reject all button
        const rejectButton = document.createElement('button');
        rejectButton.className = 'btn btn-sm btn-outline-danger mt-2';
        rejectButton.textContent = 'Dismiss All Suggestions';
        rejectButton.addEventListener('click', function() {
            suggestionsDiv.remove();
        });
        suggestionsDiv.appendChild(rejectButton);
    }
    
    // Add suggestion to general preferences
    function addToGeneralPreferences(type, value) {
        // Add a new general preference with the suggested values
        addGeneralPreference();
        
        // Get the newly added preference (last one)
        const prefItems = document.querySelectorAll('.general-preference-item');
        const lastItem = prefItems[prefItems.length - 1];
        
        if (lastItem) {
            const typeSelect = lastItem.querySelector('.preference-type');
            const valueInput = lastItem.querySelector('.preference-value');
            
            // Set the values
            typeSelect.value = type;
            valueInput.value = value;
            
            // Trigger change to update placeholders
            typeSelect.dispatchEvent(new Event('change'));
        }
    }
    
    // Add a destination to general preferences
    function addDestinationToGeneralPreferences(airport, rating) {
        // First set the rating in the preference manager
        const result = PreferenceManager.setRating(airport, rating);
        
        // Check if this destination already exists in the UI
        const existingPref = findExistingDestinationPreference(airport);
        if (existingPref) {
            // Update the existing preference rather than creating a new one
            console.log(`Found existing preference for ${airport}, updating rating to ${rating}`);
            updateDestinationPreference(existingPref, rating);
            return;
        }
        
        // If not found in the UI, add a new preference element
        console.log(`Adding new preference for ${airport} with rating ${rating}`);
        
        // Add a new general preference
        const newPref = addGeneralPreference();
        
        // Get the newly added preference 
        if (newPref) {
            const typeSelect = newPref.querySelector('.preference-type');
            const valueInput = newPref.querySelector('.preference-value');
            
            // Set to preferred destination
            typeSelect.value = 'preferred_destination';
            valueInput.value = airport;
            
            // Trigger change to update UI and show stars
            typeSelect.dispatchEvent(new Event('change'));
            
            // Set the rating
            setTimeout(() => {
                const ratingStars = newPref.querySelector('.general-rating-stars');
                if (ratingStars) {
                    ratingStars.dataset.rating = rating;
                    
                    // Update the UI to reflect the rating
                    updateDestinationPreference(newPref, rating);
                }
            }, 50); // Small delay to ensure stars are rendered
        }
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
                    
                    // Reset the stars
                    stars.forEach(star => {
                        star.classList.remove('bi-star-fill');
                        star.classList.add('bi-star');
                    });
                    
                    // Fill the appropriate number
                    for (let i = 0; i < stars.length && i < rating; i++) {
                        stars[i].classList.remove('bi-star');
                        stars[i].classList.add('bi-star-fill');
                    }
                    
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
                        
                        // Reset the stars
                        stars.forEach(star => {
                            star.classList.remove('bi-star-fill');
                            star.classList.add('bi-star');
                        });
                        
                        // Fill the appropriate number
                        for (let i = 0; i < stars.length && i < rating; i++) {
                            stars[i].classList.remove('bi-star');
                            stars[i].classList.add('bi-star-fill');
                        }
                        
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

// Add a general preference to the form
function addGeneralPreference() {
    const preferencesContainer = document.getElementById('generalPreferencesList');
    const template = document.getElementById('generalPreferenceTemplate');
    const preferenceNode = template.content.cloneNode(true);
    
    // Add special handlers for different preference types
    const typeSelect = preferenceNode.querySelector('.preference-type');
    const valueInput = preferenceNode.querySelector('.preference-value');
    
    // Update placeholder based on selected type
    typeSelect.addEventListener('change', function() {
        // Get parent element to manage rating stars
        const parentElement = this.closest('.general-preference-item');
        const valueInput = parentElement.querySelector('.preference-value');
        
        // Remove any existing rating stars
        const existingRatingStars = parentElement.querySelector('.general-rating-stars');
        if (existingRatingStars) {
            existingRatingStars.remove();
        }
        
        // Reset the input display
        valueInput.style.display = 'block';
        
        switch(this.value) {
            case 'airline':
                valueInput.placeholder = 'Preferred airline (e.g., Delta, American)';
                valueInput.type = 'text';
                break;
            case 'max_price':
                valueInput.placeholder = 'Maximum price in USD';
                valueInput.type = 'number';
                break;
            case 'departure_time':
                valueInput.placeholder = 'Preferred time range (e.g., 9AM-2PM)';
                valueInput.type = 'text';
                break;
            case 'arrival_time':
                valueInput.placeholder = 'Preferred time range (e.g., 3PM-8PM)';
                valueInput.type = 'text';
                break;
            case 'layovers':
                valueInput.placeholder = 'Maximum number of layovers';
                valueInput.type = 'number';
                break;
            case 'travel_class':
                valueInput.placeholder = 'Class (Economy, Business, First)';
                valueInput.type = 'text';
                break;
            case 'preferred_destination':
                valueInput.placeholder = 'Airport code (e.g., LAX, JFK)';
                valueInput.type = 'text';
                
                // Create rating stars for destination preferences
                const ratingStarsDiv = document.createElement('div');
                ratingStarsDiv.className = 'general-rating-stars mt-2';
                ratingStarsDiv.dataset.rating = '3'; // Default to 3 stars
                
                // Create 5 stars with explicit index-based IDs
                for (let i = 0; i < 5; i++) {
                    const starPosition = i + 1;
                    const star = document.createElement('i');
                    // Set empty star by default
                    star.className = 'bi bi-star rating-star';
                    star.dataset.position = starPosition;
                    star.id = `star-${Date.now()}-${i}`; // Unique ID for each star
                    star.style.cursor = 'pointer';
                    star.style.marginRight = '3px';
                    
                    // Fill in initial stars (default = 3)
                    if (starPosition <= 3) {
                        star.classList.remove('bi-star');
                        star.classList.add('bi-star-fill');
                    }
                    
                    // Add click event for stars
                    star.addEventListener('click', function() {
                        const stars = ratingStarsDiv.querySelectorAll('.rating-star');
                        const clickedPosition = parseInt(this.dataset.position);
                        console.log(`Star clicked: position ${clickedPosition}`);
                        
                        // Reset all stars
                        stars.forEach(s => {
                            s.classList.remove('bi-star-fill');
                            s.classList.add('bi-star');
                        });
                        
                        // Fill stars up to clicked position
                        stars.forEach(s => {
                            const pos = parseInt(s.dataset.position);
                            if (pos <= clickedPosition) {
                                s.classList.remove('bi-star');
                                s.classList.add('bi-star-fill');
                            }
                        });
                        
                        // Store the rating in a data attribute
                        ratingStarsDiv.dataset.rating = clickedPosition;
                        
                        // Remove any existing numerical rating
                        const existingRating = parentElement.querySelector('.numerical-rating');
                        if (existingRating) {
                            existingRating.remove();
                        }
                        
                        // Add a numerical rating for clarity
                        const ratingDisplay = document.createElement('span');
                        ratingDisplay.className = 'numerical-rating badge bg-secondary ms-2';
                        ratingDisplay.textContent = `Rating: ${clickedPosition}`;
                        parentElement.appendChild(ratingDisplay);
                        
                        console.log(`User clicked star ${clickedPosition}, updated rating to ${ratingStarsDiv.dataset.rating}`);
                    });
                    
                    ratingStarsDiv.appendChild(star);
                }
                
                // Add a numerical rating display initially
                const ratingDisplay = document.createElement('span');
                ratingDisplay.className = 'numerical-rating badge bg-secondary ms-2';
                ratingDisplay.textContent = `Rating: 3`;
                
                // Insert rating stars after input
                valueInput.parentNode.insertBefore(ratingStarsDiv, valueInput.nextSibling);
                
                // Insert rating display after the stars
                parentElement.appendChild(ratingDisplay);
                
                break;
        }
    });
    
    // Set initial placeholder
    typeSelect.dispatchEvent(new Event('change'));

    preferencesContainer.appendChild(preferenceNode);
    
    return preferenceNode; // Return the created node for chaining
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

// Find an existing destination preference in general preferences
function findExistingDestinationPreference(airport) {
    const prefItems = document.querySelectorAll('.general-preference-item');
    console.log(`Searching for existing preference for airport: ${airport}`);
    console.log(`Total general preference items found: ${prefItems.length}`);
    
    // Normalize the airport code we're looking for
    const normalizedAirport = airport.trim().toUpperCase();
    
    for (const item of prefItems) {
        const typeSelect = item.querySelector('.preference-type');
        const valueInput = item.querySelector('.preference-value');
        
        if (typeSelect && valueInput) {
            const prefType = typeSelect.value;
            const prefValue = valueInput.value.trim().toUpperCase();
            
            console.log(`Checking preference - Type: ${prefType}, Value: ${prefValue} vs ${normalizedAirport}`);
            
            if (prefType === 'preferred_destination' && prefValue === normalizedAirport) {
                console.log(`Found matching preference for ${airport}!`);
                return item;
            }
        }
    }
    
    console.log(`No matching preference found for ${airport}`);
    return null;
}

// Find an existing general preference of any type
function findExistingGeneralPreference(type, value) {
    const prefItems = document.querySelectorAll('.general-preference-item');
    
    for (const item of prefItems) {
        const typeSelect = item.querySelector('.preference-type');
        const valueInput = item.querySelector('.preference-value');
        
        if (typeSelect.value === type && valueInput.value.trim().toLowerCase() === value.trim().toLowerCase()) {
            return item;
        }
    }
    
    return null;
}

// Debug function to understand star structure
function inspectStarDOM(element) {
    console.log("======= DOM INSPECTION =======");
    
    // First, let's see what element we're working with
    console.log("Element:", element);
    
    // Check the direct star elements - they should contain rating-star
    const stars = element.querySelectorAll('.rating-star');
    console.log(`Found ${stars.length} direct stars:`, stars);
    
    // Log each star with its properties
    stars.forEach((star, idx) => {
        console.log(`Star ${idx+1}:`, {
            classes: star.className,
            dataRating: star.dataset.rating,
            dataPosition: star.dataset.position,
            isFilled: star.classList.contains('bi-star-fill'),
            isEmpty: star.classList.contains('bi-star')
        });
    });
    
    // Look at the parent element of stars
    const ratingStars = element.querySelector('.general-rating-stars');
    if (ratingStars) {
        console.log("Rating stars container:", ratingStars);
        console.log("Rating stars dataset:", ratingStars.dataset);
        console.log("Rating stored in dataset:", ratingStars.dataset.rating);
    } else {
        console.log("Could not find .general-rating-stars container");
    }
    
    // Check if there's a numerical rating display
    const numRating = element.querySelector('.numerical-rating');
    if (numRating) {
        console.log("Numerical rating element:", numRating);
        console.log("Numerical rating text:", numRating.textContent);
    }
    
    console.log("============================");
}

// Update an existing destination preference
function updateDestinationPreference(preferenceItem, newRating, originalRating, adjustment) {
    console.log(`DEBUG: Updating preference to rating ${newRating} from ${originalRating || "unknown"} ${adjustment || ""}`);
    
    // First, inspect the DOM to understand what we're working with
    // inspectStarDOM(preferenceItem);
    
    const ratingStars = preferenceItem.querySelector('.general-rating-stars');
    
    if (ratingStars) {
        // Get all stars
        const stars = ratingStars.querySelectorAll('.rating-star');
        console.log(`DEBUG: Found ${stars.length} stars`);
        
        // Remove any existing negative indicator
        const existingNegativeIndicator = ratingStars.querySelector('.negative-indicator');
        if (existingNegativeIndicator) {
            existingNegativeIndicator.remove();
        }
        
        // Remove existing update indicator if present
        const existingUpdateIndicator = preferenceItem.querySelector('.update-indicator');
        if (existingUpdateIndicator) {
            existingUpdateIndicator.remove();
        }
        
        // Remove existing numerical rating
        const existingRating = preferenceItem.querySelector('.numerical-rating');
        if (existingRating) {
            existingRating.remove();
        }
        
        // Remove existing adjustment indicator
        const existingAdjustment = preferenceItem.querySelector('.adjustment-indicator');
        if (existingAdjustment) {
            existingAdjustment.remove();
        }
        
        // Remove negative class if it exists
        ratingStars.classList.remove('negative-rating');
        
        // Create new stars to avoid DOM manipulation issues
        const starsContainer = document.createElement('div');
        starsContainer.className = 'general-rating-stars mt-2';
        starsContainer.dataset.rating = newRating;
        
        // Create 5 new stars
        for (let i = 0; i < 5; i++) {
            const starPosition = i + 1;
            const star = document.createElement('i');
            
            if (newRating < 0 || starPosition > Math.abs(newRating)) {
                star.className = 'bi bi-star rating-star';
            } else {
                star.className = 'bi bi-star-fill rating-star';
            }
            
            star.dataset.position = starPosition;
            star.id = `star-${Date.now()}-${i}`;
            star.style.cursor = 'pointer';
            star.style.marginRight = '3px';
            
            // Add click event 
            star.addEventListener('click', function() {
                const allStars = starsContainer.querySelectorAll('.rating-star');
                const clickPosition = parseInt(this.dataset.position);
                
                // Reset all stars
                allStars.forEach(s => {
                    s.classList.remove('bi-star-fill');
                    s.classList.add('bi-star');
                });
                
                // Fill stars up to clicked position
                allStars.forEach(s => {
                    const pos = parseInt(s.dataset.position);
                    if (pos <= clickPosition) {
                        s.classList.remove('bi-star');
                        s.classList.add('bi-star-fill');
                    }
                });
                
                // Update dataset
                starsContainer.dataset.rating = clickPosition;
                
                // Update stored preference
                const airport = preferenceItem.querySelector('.preference-value').value.trim().toUpperCase();
                PreferenceManager.setRating(airport, clickPosition);
                
                // Update UI
                const numRating = preferenceItem.querySelector('.numerical-rating');
                if (numRating) {
                    numRating.textContent = `Rating: ${clickPosition}`;
                }
            });
            
            starsContainer.appendChild(star);
        }
        
        // Replace old stars with new ones
        ratingStars.replaceWith(starsContainer);
        
        // For negative ratings, show a special indicator
        if (newRating < 0) {
            // Add negative indicator
            starsContainer.classList.add('negative-rating');
            const negativeIndicator = document.createElement('span');
            negativeIndicator.className = 'negative-indicator text-danger ms-2';
            negativeIndicator.textContent = '(Disliked)';
            starsContainer.appendChild(negativeIndicator);
            
            console.log(`DEBUG: Set negative rating ${newRating}`);
        }
        
        // Add a visual update indicator with timestamp
        const updateIndicator = document.createElement('span');
        updateIndicator.className = 'update-indicator badge bg-primary ms-2';
        updateIndicator.textContent = 'Updated';
        updateIndicator.style.animation = 'pulse 2s infinite';
        preferenceItem.appendChild(updateIndicator);
        
        // Add a numerical rating display
        const ratingDisplay = document.createElement('span');
        ratingDisplay.className = 'numerical-rating badge bg-secondary ms-2';
        ratingDisplay.textContent = `Rating: ${newRating}`;
        preferenceItem.appendChild(ratingDisplay);
        
        // Add adjustment indicator if available
        if (adjustment) {
            const adjustmentDisplay = document.createElement('span');
            adjustmentDisplay.className = adjustment.includes('+') ? 
                'adjustment-indicator badge bg-success ms-2' : 
                'adjustment-indicator badge bg-danger ms-2';
            adjustmentDisplay.textContent = adjustment;
            preferenceItem.appendChild(adjustmentDisplay);
        }
        
        // Add highlight effect to the preference item
        preferenceItem.style.backgroundColor = '#f0f8ff'; // Light blue background
        preferenceItem.style.transition = 'background-color 2s';
        preferenceItem.style.border = '1px solid #007bff';
        preferenceItem.style.borderRadius = '4px';
        preferenceItem.style.padding = '5px';
        
        // Add to recently updated list for UI visibility
        addToRecentlyUpdated(preferenceItem.querySelector('.preference-value').value, newRating, originalRating, adjustment);
        
        // Reset background after 5 seconds
        setTimeout(() => {
            preferenceItem.style.backgroundColor = '';
            preferenceItem.style.border = '';
        }, 5000);
        
        // Inspect DOM after changes
        // console.log("AFTER UPDATE:");
        // inspectStarDOM(preferenceItem);
    }
}

// Function to maintain and display recently updated preferences
function addToRecentlyUpdated(destination, rating, originalRating, adjustment) {
    // Create or get the recently updated container
    let updatedContainer = document.getElementById('recentlyUpdatedPreferences');
    if (!updatedContainer) {
        updatedContainer = document.createElement('div');
        updatedContainer.id = 'recentlyUpdatedPreferences';
        updatedContainer.className = 'mt-3 p-3 border rounded bg-light';
        
        // Add heading
        const heading = document.createElement('h5');
        heading.textContent = 'Recently Updated Preferences';
        updatedContainer.appendChild(heading);
        
        // Add container for items
        const itemsContainer = document.createElement('div');
        itemsContainer.className = 'updated-items';
        updatedContainer.appendChild(itemsContainer);
        
        // Add to page - insert at top of preferences section
        const generalPreferencesContainer = document.getElementById('generalPreferencesContainer');
        if (generalPreferencesContainer) {
            const heading = generalPreferencesContainer.querySelector('h4');
            if (heading) {
                // Insert after the heading
                if (!safeInsertAfter(updatedContainer, heading)) {
                    // Fallback: just add it to the beginning of the container
                    safeInsertAsFirstChild(updatedContainer, generalPreferencesContainer);
                }
            } else {
                // No heading found, just add to the beginning
                safeInsertAsFirstChild(updatedContainer, generalPreferencesContainer);
            }
        } else {
            // Fallback: try to find the main container
            const mainContainer = document.querySelector('.container');
            if (mainContainer) {
                // Try to find an appropriate location
                const preferencesSection = document.querySelector('#generalPreferences');
                if (preferencesSection) {
                    preferencesSection.appendChild(updatedContainer);
                } else {
                    // Last resort: just add it to the main container
                    mainContainer.appendChild(updatedContainer);
                }
            } else {
                console.error("Cannot find suitable container for recently updated preferences");
                return; // Exit if we can't find a place for it
            }
        }
    }
    
    // Get the items container
    const itemsContainer = updatedContainer.querySelector('.updated-items');
    
    // Create a new update entry
    const updateEntry = document.createElement('div');
    updateEntry.className = 'alert alert-info mb-2 d-flex align-items-center';
    
    // Create icon based on positive/negative rating
    const icon = document.createElement('i');
    if (rating < 0) {
        icon.className = 'bi bi-x-circle-fill text-danger me-2';
    } else {
        icon.className = 'bi bi-check-circle-fill text-success me-2';
    }
    
    // Get current time
    const now = new Date();
    const timeString = now.toLocaleTimeString();
    
    // Create content based on if we have original rating
    let contentHTML = '';
    if (originalRating && adjustment) {
        let adjustmentClass = adjustment.includes('+') ? 'text-success' : 'text-danger';
        contentHTML = `
            ${icon.outerHTML}
            <div>Updated <strong>${destination}</strong> from rating ${originalRating} to ${rating}/5 
            <span class="${adjustmentClass}">(${adjustment})</span> at ${timeString}</div>
        `;
    } else {
        contentHTML = `
            ${icon.outerHTML}
            <div>Updated <strong>${destination}</strong> with rating ${rating}/5 at ${timeString}</div>
        `;
    }
    
    // Set content
    updateEntry.innerHTML = contentHTML;
    
    // Add dismiss button
    const dismissBtn = document.createElement('button');
    dismissBtn.className = 'btn-close ms-auto';
    dismissBtn.addEventListener('click', () => {
        updateEntry.remove();
        // Remove the container if no more items
        if (itemsContainer.children.length === 0) {
            updatedContainer.remove();
        }
    });
    updateEntry.appendChild(dismissBtn);
    
    // Add to container
    itemsContainer.prepend(updateEntry);
    
    // Auto remove after 30 seconds
    setTimeout(() => {
        updateEntry.remove();
        // Remove the container if no more items
        if (itemsContainer.children.length === 0) {
            updatedContainer.remove();
        }
    }, 30000);
}

// Update a general preference of any type
function updateGeneralPreference(preferenceItem, newValue, sentiment) {
    const valueInput = preferenceItem.querySelector('.preference-value');
    
    // Update the value
    if (newValue) {
        valueInput.value = newValue;
    }
    
    // Add a visual indicator for sentiment
    if (sentiment) {
        // Remove any existing sentiment indicators
        const existingIndicator = preferenceItem.querySelector('.sentiment-indicator');
        if (existingIndicator) {
            existingIndicator.remove();
        }
        
        const indicator = document.createElement('span');
        indicator.className = 'sentiment-indicator ms-2';
        
        if (sentiment === 'positive') {
            indicator.className += ' text-success';
            indicator.textContent = '👍';
        } else if (sentiment === 'negative') {
            indicator.className += ' text-danger';
            indicator.textContent = '👎';
        }
        
        valueInput.parentNode.appendChild(indicator);
    }
}

// Function to fix existing ratings on the page
function fixAllRatingDisplay() {
    console.log("Applying fixes to all rating displays on the page");
    
    // Find all rating star containers
    const allRatingContainers = document.querySelectorAll('.general-rating-stars');
    console.log(`Found ${allRatingContainers.length} rating containers to fix`);
    
    // Fix each one
    allRatingContainers.forEach((container, idx) => {
        const storedRating = parseInt(container.dataset.rating || '3');
        const stars = container.querySelectorAll('.rating-star');
        const containerParent = container.closest('.general-preference-item');
        const destinationCode = containerParent ? containerParent.querySelector('.preference-value').value : 'unknown';
        
        console.log(`Container ${idx+1} for ${destinationCode} has rating: ${storedRating}, with ${stars.length} stars`);
        
        // First reset all stars to empty
        stars.forEach(star => {
            star.classList.remove('bi-star-fill');
            star.classList.add('bi-star');
        });
        
        // Then fill the appropriate number
        const absRating = Math.abs(storedRating);
        if (storedRating > 0) {
            for (let i = 0; i < absRating && i < stars.length; i++) {
                stars[i].classList.remove('bi-star');
                stars[i].classList.add('bi-star-fill');
                console.log(`Fixed: Filled star ${i+1} for ${destinationCode}`);
            }
        }
    });
}

// Add a button to the UI to manually trigger the fix
function addFixButton() {
    // Check if button already exists
    if (document.getElementById('fixRatingsButton')) {
        return;
    }
    
    const button = document.createElement('button');
    button.id = 'fixRatingsButton';
    button.className = 'btn btn-warning mb-3';
    button.innerHTML = 'Fix Star Ratings Display';
    button.style.position = 'fixed';
    button.style.bottom = '10px';
    button.style.right = '10px';
    button.style.zIndex = '1000';
    
    button.addEventListener('click', function() {
        fixAllRatingDisplay();
    });
    
    document.body.appendChild(button);
}

// Inject a hotkey to fix ratings: Ctrl+Alt+F
document.addEventListener('keydown', function(e) {
    if (e.ctrlKey && e.altKey && e.key === 'f') {
        console.log("Hot key pressed - fixing all ratings");
        fixAllRatingDisplay();
    }
});

// Global preference manager to track ratings persistently
const PreferenceManager = {
    preferences: {},
    
    // Initialize from localStorage
    init: function() {
        try {
            const savedPrefs = localStorage.getItem('travelPreferences');
            if (savedPrefs) {
                this.preferences = JSON.parse(savedPrefs);
                console.log('Loaded preferences from storage:', this.preferences);
            }
        } catch (error) {
            console.error('Error loading preferences from storage:', error);
            this.preferences = {};
        }
    },
    
    // Save to localStorage
    save: function() {
        try {
            localStorage.setItem('travelPreferences', JSON.stringify(this.preferences));
            console.log('Saved preferences to storage:', this.preferences);
        } catch (error) {
            console.error('Error saving preferences to storage:', error);
        }
    },
    
    // Get a preference rating
    getRating: function(destination) {
        destination = destination.trim().toUpperCase();
        return this.preferences[destination] || 3; // Default to 3 stars
    },
    
    // Increment a preference rating
    incrementRating: function(destination, amount = 1) {
        destination = destination.trim().toUpperCase();
        const currentRating = this.getRating(destination);
        const newRating = Math.min(5, currentRating + amount); // Cap at 5
        this.preferences[destination] = newRating;
        this.save();
        console.log(`Incremented ${destination} from ${currentRating} to ${newRating}`);
        return {
            oldRating: currentRating,
            newRating: newRating,
            destination: destination
        };
    },
    
    // Decrement a preference rating
    decrementRating: function(destination, amount = 1) {
        destination = destination.trim().toUpperCase();
        const currentRating = this.getRating(destination);
        const newRating = Math.max(-5, currentRating - amount); // Floor at -5
        this.preferences[destination] = newRating;
        this.save();
        console.log(`Decremented ${destination} from ${currentRating} to ${newRating}`);
        return {
            oldRating: currentRating,
            newRating: newRating,
            destination: destination
        };
    },
    
    // Set a preference rating directly
    setRating: function(destination, rating) {
        destination = destination.trim().toUpperCase();
        const currentRating = this.getRating(destination);
        this.preferences[destination] = rating;
        this.save();
        console.log(`Set ${destination} from ${currentRating} to ${rating}`);
        return {
            oldRating: currentRating,
            newRating: rating,
            destination: destination
        };
    },
    
    // Check if an airport is in the positive suggestions list
    isAirportRecommended: function(airport, recommendationsList) {
        return recommendationsList && Object.keys(recommendationsList).includes(airport.trim().toUpperCase());
    },
    
    // Check if an airport is in the avoid list
    isAirportToAvoid: function(airport, avoidList) {
        return avoidList && Object.keys(avoidList).includes(airport.trim().toUpperCase());
    },
    
    // Update airport ratings based on API recommendations
    updateAirportRatings: function(recommendationsList, avoidList) {
        console.log("Updating airport ratings based on API recommendations");
        const updatedAirports = [];
        
        // First handle explicit recommendations
        if (recommendationsList && typeof recommendationsList === 'object') {
            for (const airport of Object.keys(recommendationsList)) {
                const normalizedAirport = airport.trim().toUpperCase();
                const result = this.incrementRating(normalizedAirport, 1);
                console.log(`${airport} is in recommendation list, increased rating from ${result.oldRating} to ${result.newRating}`);
                updatedAirports.push({
                    airport: normalizedAirport,
                    oldRating: result.oldRating,
                    newRating: result.newRating,
                    change: '+1'
                });
            }
        }
        
        // Then handle explicit avoidances
        if (avoidList && typeof avoidList === 'object') {
            for (const airport of Object.keys(avoidList)) {
                // Only process if not already updated as a recommendation
                const normalizedAirport = airport.trim().toUpperCase();
                if (!updatedAirports.some(item => item.airport === normalizedAirport)) {
                    const result = this.decrementRating(normalizedAirport, 2);
                    console.log(`${airport} is in avoid list, decreased rating from ${result.oldRating} to ${result.newRating}`);
                    updatedAirports.push({
                        airport: normalizedAirport,
                        oldRating: result.oldRating,
                        newRating: result.newRating,
                        change: '-2'
                    });
                }
            }
        }
        
        // Process existing airports in our preferences that might be affected
        for (const airport in this.preferences) {
            // Only process actual airport codes (usually 3 letters)
            if (airport.length === 3 && !updatedAirports.some(item => item.airport === airport)) {
                if (recommendationsList && Object.keys(recommendationsList).some(rec => rec.trim().toUpperCase() === airport)) {
                    const result = this.incrementRating(airport, 1);
                    console.log(`${airport} is in recommendation list, increased rating from ${result.oldRating} to ${result.newRating}`);
                    updatedAirports.push({
                        airport: airport,
                        oldRating: result.oldRating,
                        newRating: result.newRating,
                        change: '+1'
                    });
                } else if (avoidList && Object.keys(avoidList).some(avoid => avoid.trim().toUpperCase() === airport)) {
                    const result = this.decrementRating(airport, 2);
                    console.log(`${airport} is in avoid list, decreased rating from ${result.oldRating} to ${result.newRating}`);
                    updatedAirports.push({
                        airport: airport,
                        oldRating: result.oldRating,
                        newRating: result.newRating,
                        change: '-2'
                    });
                }
            }
        }
        
        // After updating all ratings, save to localStorage
        this.save();
        
        // Update UI to reflect changes
        this.syncUI(updatedAirports);
        
        return updatedAirports;
    },
    
    // Sync UI with current ratings
    syncUI: function(updatedAirports = []) {
        console.log("Syncing UI with stored preferences");
        
        // Sync all destination preferences in the UI
        const prefItems = document.querySelectorAll('.general-preference-item');
        const updatedInUI = new Set(); // Track which airports got updated in the UI
        
        prefItems.forEach(item => {
            const typeSelect = item.querySelector('.preference-type');
            if (typeSelect && typeSelect.value === 'preferred_destination') {
                const valueInput = item.querySelector('.preference-value');
                if (valueInput) {
                    const destination = valueInput.value.trim().toUpperCase();
                    const currentRating = this.getRating(destination);
                    
                    // Find if this destination was recently updated
                    const recentUpdate = updatedAirports.find(update => update.airport === destination);
                    
                    // Update the UI to reflect the current rating
                    const ratingStars = item.querySelector('.general-rating-stars');
                    if (ratingStars) {
                        // Update the stored rating
                        ratingStars.dataset.rating = currentRating;
                        
                        // Update the visual display - if it was recently updated, pass the old rating and change info
                        if (recentUpdate) {
                            updateDestinationPreference(
                                item, 
                                currentRating, 
                                recentUpdate.oldRating, 
                                recentUpdate.change
                            );
                            updatedInUI.add(destination);
                        } else {
                            updateDestinationPreference(item, currentRating);
                        }
                    }
                }
            }
        });
        
        // Add missing airport preferences that were updated but not in the UI
        updatedAirports.forEach(update => {
            if (!updatedInUI.has(update.airport)) {
                console.log(`Adding new preference UI for ${update.airport} that was updated but not in the DOM`);
                // Add to general preferences automatically
                addDestinationToGeneralPreferences(update.airport, update.newRating);
            }
        });
        
        // Highlight recent changes in a summary panel
        if (updatedAirports.length > 0) {
            this.displayRecentUpdates(updatedAirports);
        }

        // Fix any potential star display issues 
        setTimeout(fixAllRatingDisplay, 100);
    },
    
    // Display a summary of recent preference updates
    displayRecentUpdates: function(updatedAirports) {
        if (updatedAirports.length === 0) return;
        
        // Create or get the updates summary container
        let summaryDiv = document.getElementById('preferenceSummaryUpdates');
        if (!summaryDiv) {
            summaryDiv = document.createElement('div');
            summaryDiv.id = 'preferenceSummaryUpdates';
            summaryDiv.className = 'mt-3 p-3 border rounded bg-info bg-opacity-10';
            
            // Add to page in a visible location
            const generalPreferencesContainer = document.getElementById('generalPreferencesContainer');
            if (generalPreferencesContainer) {
                const heading = generalPreferencesContainer.querySelector('h4');
                if (heading) {
                    safeInsertAfter(summaryDiv, heading);
                } else {
                    safeInsertAsFirstChild(summaryDiv, generalPreferencesContainer);
                }
            } else {
                const mainContainer = document.querySelector('.container');
                if (mainContainer) {
                    mainContainer.insertBefore(summaryDiv, mainContainer.firstChild);
                }
            }
        }
        
        // Clear previous content
        summaryDiv.innerHTML = '';
        
        // Add heading
        const heading = document.createElement('h5');
        heading.textContent = 'Preference Rating Updates';
        heading.className = 'mb-3';
        summaryDiv.appendChild(heading);
        
        // Add description
        const description = document.createElement('p');
        description.textContent = 'The following airport ratings were updated based on conversation:';
        description.className = 'mb-3 small text-muted';
        summaryDiv.appendChild(description);
        
        // Create a table for updates
        const table = document.createElement('table');
        table.className = 'table table-sm table-hover';
        
        // Add table header
        const thead = document.createElement('thead');
        thead.innerHTML = `
            <tr>
                <th>Airport</th>
                <th>Previous</th>
                <th>New</th>
                <th>Change</th>
            </tr>
        `;
        table.appendChild(thead);
        
        // Add table body with updates
        const tbody = document.createElement('tbody');
        updatedAirports.forEach(update => {
            const row = document.createElement('tr');
            
            // Add CSS class based on positive/negative change
            if (update.change.includes('+')) {
                row.className = 'table-success';
            } else {
                row.className = 'table-danger';
            }
            
            row.innerHTML = `
                <td><strong>${update.airport}</strong></td>
                <td>${update.oldRating}</td>
                <td>${update.newRating}</td>
                <td><span class="badge ${update.change.includes('+') ? 'bg-success' : 'bg-danger'}">${update.change}</span></td>
            `;
            tbody.appendChild(row);
        });
        table.appendChild(tbody);
        summaryDiv.appendChild(table);
        
        // Add dismiss button
        const dismissButton = document.createElement('button');
        dismissButton.className = 'btn btn-sm btn-outline-secondary';
        dismissButton.textContent = 'Dismiss Summary';
        dismissButton.addEventListener('click', function() {
            summaryDiv.remove();
        });
        summaryDiv.appendChild(dismissButton);
        
        // Auto-remove after 30 seconds
        setTimeout(() => {
            if (document.getElementById('preferenceSummaryUpdates')) {
                document.getElementById('preferenceSummaryUpdates').remove();
            }
        }, 30000);
    }
}; 