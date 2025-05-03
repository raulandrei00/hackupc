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
});

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