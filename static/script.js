document.addEventListener('DOMContentLoaded', function() {
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
                }
                
                // Process destinations to avoid if available
                if (data.destinations_to_avoid && Object.keys(data.destinations_to_avoid).length > 0) {
                    displayDestinationsToAvoid(data.destinations_to_avoid);
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
    
    // Display destination preference recommendations from AI
    function displayDestinationRecommendations(recommendations) {
        // Check for duplicates first and remove any destinations that already exist
        const existingDestinations = getAllExistingDestinationPreferences();
        console.log("Existing destinations before adding recommendations:", existingDestinations);
        
        // Filter out any destinations that already exist as preferences
        const newRecommendations = {};
        for (const [airport, rating] of Object.entries(recommendations)) {
            if (!existingDestinations.includes(airport.trim().toUpperCase())) {
                newRecommendations[airport] = rating;
            } else {
                console.log(`Skipping recommendation for ${airport} as it already exists in preferences`);
                // Instead of adding a new preference, update the existing one
                const existingPref = findExistingDestinationPreference(airport);
                if (existingPref) {
                    updateDestinationPreference(existingPref, rating);
                    console.log(`Updated existing preference for ${airport} with rating ${rating}`);
                }
            }
        }
        
        // Only add new recommendations
        for (const [airport, rating] of Object.entries(newRecommendations)) {
            // Automatically add to general preferences
            addDestinationToGeneralPreferences(airport, rating);
        }
        
        // Don't create recommendation UI if there are no new recommendations
        if (Object.keys(newRecommendations).length === 0 && Object.keys(recommendations).length > 0) {
            console.log("All recommendations were existing preferences, only updated ratings");
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
        
        // Add notification that preferences were automatically added
        const autoAddNotice = document.createElement('div');
        autoAddNotice.className = 'alert alert-success mb-3';
        autoAddNotice.textContent = `Automatically added ${Object.keys(newRecommendations).length} new destination preferences and updated ${Object.keys(recommendations).length - Object.keys(newRecommendations).length} existing ones.`;
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
        
        // Show all recommendations, including updated ones
        for (const [airport, rating] of Object.entries(recommendations)) {
            const recDiv = document.createElement('div');
            recDiv.className = 'recommendation-item d-flex align-items-center mb-2 p-2 border-bottom';
            
            // Airport code and rating
            const airportInfo = document.createElement('div');
            airportInfo.className = 'flex-grow-1';
            
            // Show different text for new vs updated preferences
            if (newRecommendations[airport] !== undefined) {
                airportInfo.innerHTML = `<strong>${airport}</strong> - Rating: ${rating}/5 (New)`;
            } else {
                airportInfo.innerHTML = `<strong>${airport}</strong> - Rating: ${rating}/5 (Updated)`;
            }
            
            recDiv.appendChild(airportInfo);
            
            // Create buttons to add to travelers
            const travelerElements = document.querySelectorAll('.traveler-entry');
            
            // Create the "Add to General Preferences" button first - now shows as already added
            const addToGeneralButton = document.createElement('button');
            addToGeneralButton.className = 'btn btn-sm btn-primary ms-2';
            addToGeneralButton.textContent = 'Added to General';
            addToGeneralButton.dataset.airport = airport;
            addToGeneralButton.dataset.rating = rating;
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
        for (const [airport, rating] of Object.entries(destinations)) {
            const avoidItem = document.createElement('div');
            avoidItem.className = 'avoid-item d-flex align-items-center mb-2 p-2 border-bottom border-danger border-opacity-25';
            
            // Create icon and airport code
            const airportInfo = document.createElement('div');
            airportInfo.className = 'flex-grow-1';
            airportInfo.innerHTML = `<i class="bi bi-x-circle-fill text-danger me-2"></i><strong>${airport}</strong>`;
            avoidItem.appendChild(airportInfo);
            
            // Create button to add as negative preference
            const addAsNegativeBtn = document.createElement('button');
            addAsNegativeBtn.className = 'btn btn-sm btn-outline-danger ms-2';
            addAsNegativeBtn.textContent = 'Add as Negative Preference';
            addAsNegativeBtn.dataset.airport = airport;
            
            // Check if it's already in preferences
            const existingPref = findExistingDestinationPreference(airport);
            if (existingPref) {
                const ratingStars = existingPref.querySelector('.general-rating-stars');
                const currentRating = parseInt(ratingStars?.dataset.rating || '0');
                
                if (currentRating < 0) {
                    // Already a negative preference
                    addAsNegativeBtn.className = 'btn btn-sm btn-danger ms-2';
                    addAsNegativeBtn.textContent = 'Already Negative';
                    addAsNegativeBtn.disabled = true;
                } else {
                    // Exists but not negative
                    addAsNegativeBtn.addEventListener('click', function() {
                        updateDestinationPreference(existingPref, -3);
                        this.className = 'btn btn-sm btn-danger ms-2';
                        this.textContent = 'Added as Negative';
                        this.disabled = true;
                    });
                }
            } else {
                // New negative preference
                addAsNegativeBtn.addEventListener('click', function() {
                    addDestinationToGeneralPreferences(this.dataset.airport, -3);
                    this.className = 'btn btn-sm btn-danger ms-2';
                    this.textContent = 'Added as Negative';
                    this.disabled = true;
                });
            }
            
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
    
    // Helper function to get all existing destination preferences
    function getAllExistingDestinationPreferences() {
        const prefItems = document.querySelectorAll('.general-preference-item');
        const destinations = [];
        
        for (const item of prefItems) {
            const typeSelect = item.querySelector('.preference-type');
            const valueInput = item.querySelector('.preference-value');
            
            if (typeSelect && valueInput && typeSelect.value === 'preferred_destination') {
                const destinationCode = valueInput.value.trim().toUpperCase();
                if (destinationCode && !destinations.includes(destinationCode)) {
                    destinations.push(destinationCode);
                }
            }
        }
        
        console.log("All existing destination preferences:", destinations);
        return destinations;
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
        // Add a new general preference
        addGeneralPreference();
        
        // Get the newly added preference (last one)
        const prefItems = document.querySelectorAll('.general-preference-item');
        const lastItem = prefItems[prefItems.length - 1];
        
        if (lastItem) {
            const typeSelect = lastItem.querySelector('.preference-type');
            const valueInput = lastItem.querySelector('.preference-value');
            
            // Set to preferred destination
            typeSelect.value = 'preferred_destination';
            valueInput.value = airport;
            
            // Trigger change to update UI and show stars
            typeSelect.dispatchEvent(new Event('change'));
            
            // Set the rating
            setTimeout(() => {
                const ratingStars = lastItem.querySelector('.general-rating-stars');
                if (ratingStars) {
                    const stars = ratingStars.querySelectorAll('.rating-star');
                    const ratingValue = parseInt(rating);
                    
                    // Reset all stars first
                    stars.forEach(star => {
                        star.classList.remove('bi-star-fill');
                        star.classList.add('bi-star');
                    });
                    
                    // For negative ratings, show special indicator
                    if (ratingValue < 0) {
                        // Add negative indicator
                        ratingStars.classList.add('negative-rating');
                        const negativeIndicator = document.createElement('span');
                        negativeIndicator.className = 'negative-indicator text-danger ms-2';
                        negativeIndicator.textContent = '(Disliked)';
                        ratingStars.appendChild(negativeIndicator);
                    } else {
                        // For positive ratings, fill stars up to the rating
                        const absRating = Math.abs(ratingValue);
                        for (let i = 0; i < stars.length; i++) {
                            const starPosition = i + 1;
                            if (starPosition <= absRating) {
                                stars[i].classList.remove('bi-star');
                                stars[i].classList.add('bi-star-fill');
                            }
                        }
                    }
                    
                    // Store the rating
                    ratingStars.dataset.rating = ratingValue;
                    
                    // Add a numerical rating for clarity
                    const ratingDisplay = document.createElement('span');
                    ratingDisplay.className = 'numerical-rating badge bg-secondary ms-2';
                    ratingDisplay.textContent = `Rating: ${ratingValue}`;
                    lastItem.appendChild(ratingDisplay);
                    
                    console.log(`Added new preference for ${airport} with rating ${ratingValue}, dataset value: ${ratingStars.dataset.rating}`);
                }
            }, 50); // Small delay to ensure stars are rendered
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
                
                // Create 5 stars
                for (let i = 1; i <= 5; i++) {
                    const star = document.createElement('i');
                    star.className = 'bi bi-star rating-star';
                    star.dataset.rating = i;
                    star.dataset.position = i;  // Store position for easier updates
                    star.style.cursor = 'pointer';
                    star.style.marginRight = '3px';
                    
                    // Add click event for stars
                    star.addEventListener('click', function() {
                        const stars = ratingStarsDiv.querySelectorAll('.rating-star');
                        const clickedRating = parseInt(this.dataset.position);
                        
                        // Reset all stars first
                        stars.forEach(s => {
                            s.classList.remove('bi-star-fill');
                            s.classList.add('bi-star');
                        });
                        
                        // Fill stars up to clicked position
                        stars.forEach(s => {
                            const pos = parseInt(s.dataset.position);
                            if (pos <= clickedRating) {
                                s.classList.remove('bi-star');
                                s.classList.add('bi-star-fill');
                            }
                        });
                        
                        // Store the rating in a data attribute
                        ratingStarsDiv.dataset.rating = clickedRating;
                        
                        // Remove any existing numerical rating
                        const existingRating = parentElement.querySelector('.numerical-rating');
                        if (existingRating) {
                            existingRating.remove();
                        }
                        
                        // Add a numerical rating for clarity
                        const ratingDisplay = document.createElement('span');
                        ratingDisplay.className = 'numerical-rating badge bg-secondary ms-2';
                        ratingDisplay.textContent = `Rating: ${clickedRating}`;
                        parentElement.appendChild(ratingDisplay);
                        
                        console.log(`User clicked star ${clickedRating}, updated rating to ${ratingStarsDiv.dataset.rating}`);
                    });
                    
                    ratingStarsDiv.appendChild(star);
                }
                
                // Insert after input
                valueInput.parentNode.insertBefore(ratingStarsDiv, valueInput.nextSibling);
                break;
        }
    });
    
    // Set initial placeholder
    typeSelect.dispatchEvent(new Event('change'));

    preferencesContainer.appendChild(preferenceNode);
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

// Apply preference modifications from the Chat API
function applyPreferenceModifications(modifications) {
    console.log("Applying preference modifications:", modifications);
    
    if (!modifications || modifications.length === 0) {
        console.log("No modifications to apply");
        return;
    }
    
    // Track modified items for UI feedback
    const modifiedItems = [];
    
    // First pass: Update existing preferences
    let appliedModifications = 0;
    
    modifications.forEach(mod => {
        console.log(`Processing modification for ${mod.type}: ${mod.value} (Rating: ${mod.rating})`);
        
        if (mod.type === 'preferred_destination') {
            // Check if this destination already exists in general preferences
            const existingPref = findExistingDestinationPreference(mod.value);
            
            if (existingPref) {
                console.log(`Updating existing preference for ${mod.value} to rating ${mod.rating}`);
                // Update existing preference
                updateDestinationPreference(existingPref, mod.rating);
                appliedModifications++;
                modifiedItems.push(existingPref);
            } else {
                console.log(`Adding new preference for ${mod.value} with rating ${mod.rating}`);
                // Add as new preference
                addDestinationToGeneralPreferences(mod.value, mod.rating);
                appliedModifications++;
                
                // Find the newly added preference
                setTimeout(() => {
                    const newPref = findExistingDestinationPreference(mod.value);
                    if (newPref) {
                        modifiedItems.push(newPref);
                    }
                }, 100);
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

// Update an existing destination preference
function updateDestinationPreference(preferenceItem, newRating) {
    const ratingStars = preferenceItem.querySelector('.general-rating-stars');
    
    if (ratingStars) {
        const stars = ratingStars.querySelectorAll('.rating-star');
        
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
        
        // Remove negative class if it exists
        ratingStars.classList.remove('negative-rating');
        
        // For negative ratings, show a special indicator
        if (newRating < 0) {
            // For negative ratings, we still show all stars as empty
            stars.forEach(star => {
                star.classList.remove('bi-star-fill');
                star.classList.add('bi-star');
            });
            
            // Add negative indicator
            ratingStars.classList.add('negative-rating');
            const negativeIndicator = document.createElement('span');
            negativeIndicator.className = 'negative-indicator text-danger ms-2';
            negativeIndicator.textContent = '(Disliked)';
            ratingStars.appendChild(negativeIndicator);
            
            // Store the negative rating
            ratingStars.dataset.rating = newRating;
            
            // Add debug output
            console.log(`Updated ${preferenceItem.querySelector('.preference-value').value} to negative rating: ${newRating}`);
        } else {
            // For positive ratings, update stars as usual
            const absRating = Math.abs(newRating);
            
            // Reset all stars first
            stars.forEach(star => {
                star.classList.remove('bi-star-fill');
                star.classList.add('bi-star');
            });
            
            // Fill in stars up to the rating
            stars.forEach((star, index) => {
                const starPosition = index + 1; // Star positions are 1-based
                if (starPosition <= absRating) {
                    star.classList.remove('bi-star');
                    star.classList.add('bi-star-fill');
                }
            });
            
            // Store the rating
            ratingStars.dataset.rating = newRating;
            
            // Add debug output
            console.log(`Updated ${preferenceItem.querySelector('.preference-value').value} to positive rating: ${newRating}, filling ${absRating} stars`);
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
        
        // Add highlight effect to the preference item
        preferenceItem.style.backgroundColor = '#f0f8ff'; // Light blue background
        preferenceItem.style.transition = 'background-color 2s';
        preferenceItem.style.border = '1px solid #007bff';
        preferenceItem.style.borderRadius = '4px';
        preferenceItem.style.padding = '5px';
        
        // Add to recently updated list for UI visibility
        addToRecentlyUpdated(preferenceItem.querySelector('.preference-value').value, newRating);
        
        // Reset background after 5 seconds
        setTimeout(() => {
            preferenceItem.style.backgroundColor = '';
            preferenceItem.style.border = '';
        }, 5000);
    }
}

// Function to maintain and display recently updated preferences
function addToRecentlyUpdated(destination, rating) {
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
    
    // Set content
    updateEntry.innerHTML = `
        ${icon.outerHTML}
        <div>Updated <strong>${destination}</strong> with rating ${rating}/5 at ${timeString}</div>
    `;
    
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