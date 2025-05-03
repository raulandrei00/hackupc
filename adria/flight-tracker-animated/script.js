// Aerodatabox API configuration
const API_KEY = '1acf5b047bmshc3f094b5690132ap13e547jsn8928315090c1';
const API_HOST = 'aerodatabox.p.rapidapi.com';

// Aircraft fuel efficiency data (kg/seat/100km)
const AIRCRAFT_EFFICIENCY = {
    'Boeing 737': { min: 0.033, max: 0.035 },
    'Boeing 737-800': { min: 0.033, max: 0.035 },
    'Boeing 737-900': { min: 0.033, max: 0.035 },
    'Boeing 737 MAX': { min: 0.030, max: 0.032 },
    'Boeing 787': { min: 0.024, max: 0.026 },
    'Boeing 787-9': { min: 0.024, max: 0.026 },
    'Boeing 777': { min: 0.027, max: 0.030 },
    'Boeing 777-300ER': { min: 0.027, max: 0.030 },
    'Boeing 767': { min: 0.028, max: 0.031 },
    'Boeing 767-300': { min: 0.028, max: 0.031 },
    'Airbus A320': { min: 0.030, max: 0.033 },
    'Airbus A321': { min: 0.030, max: 0.033 },
    'Airbus A330': { min: 0.025, max: 0.028 },
    'Airbus A330-200': { min: 0.025, max: 0.028 },
    'Airbus A350': { min: 0.022, max: 0.024 },
    'Airbus A350-900': { min: 0.022, max: 0.024 },
    'Embraer 175': { min: 0.035, max: 0.038 },
    'Embraer 190': { min: 0.035, max: 0.038 },
    'Bombardier CRJ': { min: 0.040, max: 0.043 },
    'Bombardier CRJ-900': { min: 0.040, max: 0.043 }
};

// CO2 conversion factor (kg CO2 per kg of jet fuel)
const CO2_FACTOR = 3.15;

// Earth's radius in kilometers
const EARTH_RADIUS = 6371;

// Cache for airport data
let airportCache = null;

// Function to load airport data
async function loadAirportsData() {
    if (airportCache) {
        console.log('Using cached airport data');
        document.getElementById('loading').style.display = 'none';
        return airportCache;
    }
    
    try {
        console.log('Loading airports data...');
        // Return a minimal set of common airports as fallback
        const fallbackAirports = {
            'LAX': { latitude: 33.9416, longitude: -118.4085, name: 'Los Angeles International Airport' },
            'JFK': { latitude: 40.6413, longitude: -73.7781, name: 'John F. Kennedy International Airport' },
            'LHR': { latitude: 51.4700, longitude: -0.4543, name: 'London Heathrow Airport' },
            'CDG': { latitude: 49.0097, longitude: 2.5479, name: 'Charles de Gaulle Airport' },
            'FRA': { latitude: 50.0379, longitude: 8.5622, name: 'Frankfurt Airport' },
            'AMS': { latitude: 52.3105, longitude: 4.7683, name: 'Amsterdam Airport Schiphol' },
            'MAD': { latitude: 40.4983, longitude: -3.5676, name: 'Adolfo Suárez Madrid–Barajas Airport' },
            'DTW': { latitude: 42.2122, longitude: -83.3534, name: 'Detroit Metropolitan Airport' },
            'SFO': { latitude: 37.6213, longitude: -122.3790, name: 'San Francisco International Airport' },
            'SEA': { latitude: 47.4502, longitude: -122.3088, name: 'Seattle-Tacoma International Airport' }
        };
        
        console.log('Using fallback airport data');
        airportCache = fallbackAirports;
        document.getElementById('loading').style.display = 'none';
        return fallbackAirports;
    } catch (error) {
        console.error('Error loading airports data:', error);
        throw error;
    }
}

// Function to calculate distance between airports
async function calculateDistanceFromAirports(departureCode, arrivalCode) {
    if (!airportCache) {
        await loadAirportsData();
    }

    const departure = airportCache[departureCode];
    const arrival = airportCache[arrivalCode];

    if (!departure || !arrival) {
        console.log('Airport not found in database:', { departureCode, arrivalCode });
        return null;
    }

    // Convert latitude and longitude from degrees to radians
    const lat1Rad = departure.latitude * Math.PI / 180;
    const lon1Rad = departure.longitude * Math.PI / 180;
    const lat2Rad = arrival.latitude * Math.PI / 180;
    const lon2Rad = arrival.longitude * Math.PI / 180;

    // Spherical Law of Cosines formula
    const sinLat1 = Math.sin(lat1Rad);
    const sinLat2 = Math.sin(lat2Rad);
    const cosLat1 = Math.cos(lat1Rad);
    const cosLat2 = Math.cos(lat2Rad);
    const cosLonDiff = Math.cos(lon2Rad - lon1Rad);

    const distance = Math.acos(
        sinLat1 * sinLat2 +
        cosLat1 * cosLat2 * cosLonDiff
    ) * EARTH_RADIUS;

    return Math.round(distance);
}

// Function to get fuel efficiency for aircraft model
function getFuelEfficiency(model) {
    if (!model) return null;
    
    // Try to find an exact match first
    if (AIRCRAFT_EFFICIENCY[model]) {
        return AIRCRAFT_EFFICIENCY[model];
    }
    
    // Try to find a partial match
    for (const [key, value] of Object.entries(AIRCRAFT_EFFICIENCY)) {
        if (model.includes(key)) {
            return value;
        }
    }
    
    // If no match found, use a default value based on aircraft size
    if (model.includes('Boeing 737') || model.includes('Airbus A320')) {
        return { min: 0.033, max: 0.035 };
    } else if (model.includes('Boeing 777') || model.includes('Airbus A330')) {
        return { min: 0.027, max: 0.030 };
    } else if (model.includes('Embraer') || model.includes('CRJ')) {
        return { min: 0.035, max: 0.038 };
    }
    
    return { min: 0.035, max: 0.040 }; // Conservative estimate for unknown aircraft
}

// Function to calculate CO2 emissions
function calculateCO2Emissions(efficiency, distance, seats = 150) {
    if (!efficiency || !distance) return null;
    
    // Calculate average fuel efficiency
    const avgEfficiency = (efficiency.min + efficiency.max) / 2;
    
    // Calculate fuel consumption per seat for the entire distance
    const fuelPerSeat = avgEfficiency * distance;
    
    // Calculate total fuel consumption
    const totalFuel = fuelPerSeat * seats;
    
    // Calculate CO2 emissions
    const co2Emissions = totalFuel * CO2_FACTOR;
    
    return {
        perSeat: fuelPerSeat * CO2_FACTOR,
        total: co2Emissions
    };
}

// Function to generate simulated flight data
function generateSimulatedFlights(airportCode) {
    const now = new Date();
    const flights = [];
    const destinations = ['JFK', 'LHR', 'CDG', 'FRA', 'AMS', 'MAD', 'SFO', 'SEA'];
    const aircraft = ['Boeing 737-800', 'Airbus A320', 'Boeing 787-9', 'Airbus A350-900'];
    const statuses = ['Scheduled', 'Delayed', 'On Time', 'Boarding'];
    for (let i = 0; i < 10; i++) {
        const departureTime = new Date(now.getTime() + (i * 2 * 60 * 60 * 1000)); // Every 2 hours
        const arrivalTime = new Date(departureTime.getTime() + (3 * 60 * 60 * 1000)); // 3 hours flight
        const destination = destinations[i % destinations.length];
        const aircraftModel = aircraft[i % aircraft.length];
        flights.push({
            number: `AA${1000 + i}`,
            departure: {
                scheduledTime: {
                    local: departureTime.toISOString(),
                    utc: departureTime.toISOString()
                },
                actualTime: {
                    local: new Date(departureTime.getTime() + (Math.random() > 0.7 ? 30 * 60 * 1000 : 0)).toISOString(),
                    utc: new Date(departureTime.getTime() + (Math.random() > 0.7 ? 30 * 60 * 1000 : 0)).toISOString()
                }
            },
            arrival: {
                airport: {
                    iata: destination,
                    name: getAirportName(destination)
                },
                scheduledTime: {
                    local: arrivalTime.toISOString(),
                    utc: arrivalTime.toISOString()
                },
                actualTime: {
                    local: new Date(arrivalTime.getTime() + (Math.random() > 0.7 ? 30 * 60 * 1000 : 0)).toISOString(),
                    utc: new Date(arrivalTime.getTime() + (Math.random() > 0.7 ? 30 * 60 * 1000 : 0)).toISOString()
                }
            },
            aircraft: {
                model: aircraftModel
            },
            status: statuses[i % statuses.length]
        });
    }
    return { departures: flights };
}

function getAirportName(code) {
    const airports = {
        'JFK': 'John F. Kennedy International Airport',
        'LHR': 'London Heathrow Airport',
        'CDG': 'Charles de Gaulle Airport',
        'FRA': 'Frankfurt Airport',
        'AMS': 'Amsterdam Airport Schiphol',
        'MAD': 'Adolfo Suárez Madrid–Barajas Airport',
        'SFO': 'San Francisco International Airport',
        'SEA': 'Seattle-Tacoma International Airport'
    };
    return airports[code] || code;
}

// Function to fetch flights (now using simulated data)
async function fetchFlights(airportCode, startTime, duration) {
    // Simulate API delay
    await new Promise(resolve => setTimeout(resolve, 500));
    return generateSimulatedFlights(airportCode);
}

async function searchAirport(airportCode = null) {
    const inputCode = airportCode || document.getElementById('airportCode').value.toUpperCase();
    const resultsDiv = document.getElementById('results');
    
    if (!inputCode) {
        resultsDiv.innerHTML = '<div class="alert alert-warning">Please enter an airport code</div>';
        return;
    }

    try {
        resultsDiv.innerHTML = '<div class="loading-container"><div class="spinner-border" role="status"><span class="visually-hidden">Loading...</span></div><p class="mt-3">Searching for flights...</p></div>';
        
        // Load airports data first and wait for it
        console.log('Starting to load airport data...');
        const airports = await loadAirportsData();
        console.log('Airport data loaded:', airports);
        
        // Get flights for next 24 hours
        console.log('Fetching flights for:', inputCode);
        const firstHalf = await fetchFlights(inputCode, 0, 720);
        const secondHalf = await fetchFlights(inputCode, 720, 720);
        
        // Combine the results
        const combinedData = {
            departures: [...(firstHalf.departures || []), ...(secondHalf.departures || [])]
        };
        
        console.log('First flight data sample:', combinedData.departures[0]);
        
        // Display the flight information
        let flightsHtml = '<div class="alert alert-success">';
        flightsHtml += `<h2>Flights from ${inputCode}</h2>`;
        
        if (combinedData.departures && combinedData.departures.length > 0) {
            flightsHtml += '<h3>Departures</h3>';
            
            // Process departures sequentially
            for (const flight of combinedData.departures) {
                // Skip flights with missing arrival data
                if (!flight.arrival?.airport?.iata) {
                    console.log('Skipping flight with missing arrival data:', flight.number);
                    continue;
                }

                // Debug log the flight object
                console.log('Processing flight:', {
                    number: flight.number,
                    departure: flight.departure,
                    arrival: flight.arrival
                });

                // Parse scheduled times with error handling
                let scheduledDeparture = 'Unknown';
                let scheduledArrival = 'Unknown';
                let actualDeparture = 'Unknown';
                let actualArrival = 'Unknown';
                let flightDate = 'Unknown';
                let isPastDeparture = false;

                try {
                    // Parse departure times
                    if (flight.departure?.scheduledTime?.local) {
                        const depDate = new Date(flight.departure.scheduledTime.local);
                        if (!isNaN(depDate.getTime())) {
                            flightDate = depDate.toLocaleDateString();
                            scheduledDeparture = depDate.toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' });
                            // Check if departure time has passed
                            isPastDeparture = depDate < new Date();
                        }
                    }
                    
                    if (flight.departure?.actualTime?.local) {
                        const actDepDate = new Date(flight.departure.actualTime.local);
                        if (!isNaN(actDepDate.getTime())) {
                            actualDeparture = actDepDate.toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' });
                        }
                    }

                    // Parse arrival times
                    if (flight.arrival?.scheduledTime?.local) {
                        const arrDate = new Date(flight.arrival.scheduledTime.local);
                        if (!isNaN(arrDate.getTime())) {
                            scheduledArrival = arrDate.toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' });
                        }
                    }
                    
                    if (flight.arrival?.actualTime?.local) {
                        const actArrDate = new Date(flight.arrival.actualTime.local);
                        if (!isNaN(actArrDate.getTime())) {
                            actualArrival = actArrDate.toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' });
                        }
                    }

                    // Fallback to UTC times if local times are not available
                    if (scheduledDeparture === 'Unknown' && flight.departure?.scheduledTime?.utc) {
                        const depDate = new Date(flight.departure.scheduledTime.utc);
                        if (!isNaN(depDate.getTime())) {
                            if (flightDate === 'Unknown') {
                                flightDate = depDate.toLocaleDateString();
                            }
                            scheduledDeparture = depDate.toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' });
                            // Check if departure time has passed
                            isPastDeparture = depDate < new Date();
                        }
                    }

                    if (scheduledArrival === 'Unknown' && flight.arrival?.scheduledTime?.utc) {
                        const arrDate = new Date(flight.arrival.scheduledTime.utc);
                        if (!isNaN(arrDate.getTime())) {
                            scheduledArrival = arrDate.toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' });
                        }
                    }

                    console.log('Parsed times:', {
                        flightDate,
                        scheduledDeparture,
                        actualDeparture,
                        scheduledArrival,
                        actualArrival,
                        isPastDeparture
                    });

                } catch (error) {
                    console.error('Error parsing flight times:', error);
                }

                const aircraftModel = flight.aircraft?.model || 'Unknown';
                const toCode = flight.arrival.airport.iata;
                const toName = flight.arrival.airport.name || toCode;
                
                // Calculate distance using airport codes
                const distance = await calculateDistanceFromAirports(inputCode, toCode);
                
                const efficiency = getFuelEfficiency(aircraftModel);
                const efficiencyInfo = efficiency ? 
                    `~${(efficiency.min * 100).toFixed(1)}-${(efficiency.max * 100).toFixed(1)} kg/seat/100km` : 
                    'Unknown';
                
                const emissions = calculateCO2Emissions(efficiency, distance || 0);
                const emissionsInfo = emissions ? 
                    `~${Math.round(emissions.perSeat)} kg CO₂/seat, ${Math.round(emissions.total / 1000)} tonnes CO₂ total` : 
                    'Unknown';
                
                flightsHtml += `
                    <div class="flight-card animate__animated animate__fadeIn ${isPastDeparture ? 'past-departure' : ''}">
                        ${flight.number ? `<p><strong>Flight:</strong> ${flight.number}</p>` : ''}
                        ${toCode ? `<p><strong>To:</strong> ${toCode}${toName ? ` (${toName})` : ''}</p>` : ''}
                        ${aircraftModel !== 'Unknown' ? `<p><strong>Aircraft:</strong> ${aircraftModel}</p>` : ''}
                        <div class="flight-times">
                            <p><strong>Date:</strong> ${flightDate}</p>
                            <p><strong>Departure:</strong> ${scheduledDeparture} ${actualDeparture !== 'Unknown' ? `(Actual: ${actualDeparture})` : ''}</p>
                            <p><strong>Arrival:</strong> ${scheduledArrival} ${actualArrival !== 'Unknown' ? `(Actual: ${actualArrival})` : ''}</p>
                        </div>
                        ${distance ? `<p><strong>Distance:</strong> ${distance} km</p>` : ''}
                        ${efficiencyInfo !== 'Unknown' ? `<p><strong>Fuel Efficiency:</strong> ${efficiencyInfo}</p>` : ''}
                        ${emissions ? `<p><strong>CO₂ Emissions:</strong> ${emissionsInfo}</p>` : ''}
                        ${flight.status && flight.status !== 'Unknown' ? `<p><strong>Status:</strong> ${flight.status}</p>` : ''}
                        <button class="btn btn-outline-primary btn-sm mt-2" onclick="userManager.toggleFavorite('${toCode}')">
                            <i class="bi bi-star me-2"></i>Add to Favorites
                        </button>
                    </div>
                `;
            }
        } else {
            flightsHtml += '<p>No departing flights found for this time period.</p>';
        }

        flightsHtml += '</div>';
        resultsDiv.innerHTML = flightsHtml;
    } catch (error) {
        console.error('Error searching for flights:', error);
        resultsDiv.innerHTML = `
            <div class="alert alert-danger">
                <p>Error: ${error.message}</p>
                <p>Please check if:</p>
                <ul>
                    <li>The airport code is correct (e.g., YYZ, LHR, JFK)</li>
                    <li>You have a valid API key</li>
                    <li>The API service is available</li>
                </ul>
            </div>
        `;
    }
} 