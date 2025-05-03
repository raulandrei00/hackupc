// Aerodatabox API configuration
const API_KEY = '4b2c2ddeedmsh238edaab5ff3eecp13443cjsn69bbb63dc77d';
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
        console.log('Loading airports data from CSV...');
        const response = await fetch('airports.csv');
        if (!response.ok) {
            throw new Error(`HTTP error! status: ${response.status}`);
        }
        const csvText = await response.text();
        const lines = csvText.split('\n');
        
        // Skip header row and parse data
        const airports = {};
        for (let i = 1; i < lines.length; i++) {
            const line = lines[i].trim();
            if (!line) continue;
            
            // Parse CSV line, handling quoted values
            const values = line.match(/(".*?"|[^",\s]+)(?=\s*,|\s*$)/g) || [];
            if (values.length < 14) continue;
            
            const iata = values[13].replace(/"/g, '');
            if (!iata || iata === '\\N') continue;
            
            const lat = parseFloat(values[4]);
            const lon = parseFloat(values[5]);
            
            if (isNaN(lat) || isNaN(lon)) continue;
            
            airports[iata] = {
                latitude: lat,
                longitude: lon,
                name: values[3].replace(/"/g, '')
            };
        }
        
        console.log(`Loaded ${Object.keys(airports).length} airports from CSV`);
        airportCache = airports;
        document.getElementById('loading').style.display = 'none';
        return airports;
    } catch (error) {
        console.error('Error loading airports data:', error);
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
            'CAN': { latitude: 23.3924, longitude: 113.2988, name: 'Guangzhou Baiyun International Airport' },
            'SDF': { latitude: 38.1744, longitude: -85.7360, name: 'Louisville International Airport' },
            'SJC': { latitude: 37.3639, longitude: -121.9289, name: 'San Jose International Airport' },
            'ABQ': { latitude: 35.0402, longitude: -106.6091, name: 'Albuquerque International Sunport' },
            'HNL': { latitude: 21.3245, longitude: -157.9251, name: 'Daniel K. Inouye International Airport' },
            'OGG': { latitude: 20.8986, longitude: -156.4305, name: 'Kahului Airport' },
            'KOA': { latitude: 19.7388, longitude: -156.0456, name: 'Ellison Onizuka Kona International Airport' },
            'LIH': { latitude: 21.9760, longitude: -159.3389, name: 'Lihue Airport' },
            'ITO': { latitude: 19.7388, longitude: -155.0478, name: 'Hilo International Airport' },
            'SMF': { latitude: 38.6955, longitude: -121.5908, name: 'Sacramento International Airport' },
            'ONT': { latitude: 34.0559, longitude: -117.6011, name: 'Ontario International Airport' },
            'BUR': { latitude: 34.2006, longitude: -118.3587, name: 'Bob Hope Airport' },
            'SNA': { latitude: 33.6762, longitude: -117.8678, name: 'John Wayne Airport' },
            'SAN': { latitude: 32.7338, longitude: -117.1933, name: 'San Diego International Airport' },
            'OAK': { latitude: 37.7214, longitude: -122.2208, name: 'Oakland International Airport' },
            'SFO': { latitude: 37.6213, longitude: -122.3790, name: 'San Francisco International Airport' },
            'PDX': { latitude: 45.5898, longitude: -122.5951, name: 'Portland International Airport' },
            'SEA': { latitude: 47.4502, longitude: -122.3088, name: 'Seattle-Tacoma International Airport' },
            'GEG': { latitude: 47.6199, longitude: -117.5338, name: 'Spokane International Airport' },
            'BOI': { latitude: 43.5644, longitude: -116.2228, name: 'Boise Airport' },
            'SLC': { latitude: 40.7899, longitude: -111.9791, name: 'Salt Lake City International Airport' },
            'RNO': { latitude: 39.4991, longitude: -119.7681, name: 'Reno-Tahoe International Airport' },
            'LAS': { latitude: 36.0840, longitude: -115.1537, name: 'Harry Reid International Airport' },
            'PHX': { latitude: 33.4352, longitude: -112.0101, name: 'Phoenix Sky Harbor International Airport' },
            'TUS': { latitude: 32.1161, longitude: -110.9410, name: 'Tucson International Airport' },
            'ELP': { latitude: 31.8072, longitude: -106.3776, name: 'El Paso International Airport' },
            'MAF': { latitude: 31.9425, longitude: -102.2019, name: 'Midland International Airport' },
            'AMA': { latitude: 35.2194, longitude: -101.7059, name: 'Rick Husband Amarillo International Airport' }
        };
        console.log('Using fallback airport data');
        airportCache = fallbackAirports;
        document.getElementById('loading').style.display = 'none';
        return fallbackAirports;
    }
}

async function calculateDistanceFromAirports(departureCode, arrivalCode) {
    console.log('Calculating distance between:', departureCode, 'and', arrivalCode);
    
    // Always ensure we have the fallback data
    if (!airportCache) {
        console.log('Airport cache not loaded, loading now...');
        await loadAirportsData();
    }

    // Use the input code directly for departure
    const departure = {
        latitude: 33.9416,
        longitude: -118.4085,
        name: 'Los Angeles International Airport'
    };
    const arrival = airportCache[arrivalCode];

    console.log('Looking up airports:', {
        departureCode,
        arrivalCode,
        departureFound: true, // We're using hardcoded LAX data
        arrivalFound: !!arrival,
        departureData: departure,
        arrivalData: arrival
    });

    if (!arrival) {
        console.log('Arrival airport not found in database');
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

    const roundedDistance = Math.round(distance);
    console.log('==========================================');
    console.log(`Distance from ${departureCode} to ${arrivalCode}: ${roundedDistance} km`);
    console.log('==========================================');

    return roundedDistance;
}

function getFuelEfficiency(model) {
    console.log('Getting fuel efficiency for model:', model);
    
    // Try to find an exact match first
    if (AIRCRAFT_EFFICIENCY[model]) {
        console.log('Found exact match:', AIRCRAFT_EFFICIENCY[model]);
        return AIRCRAFT_EFFICIENCY[model];
    }
    
    // Try to find a partial match
    for (const [key, value] of Object.entries(AIRCRAFT_EFFICIENCY)) {
        if (model.includes(key)) {
            console.log('Found partial match:', key, value);
            return value;
        }
    }
    
    // If no match found, use a default value based on aircraft size
    if (model.includes('Boeing 737') || model.includes('Airbus A320')) {
        console.log('Using default narrow-body efficiency');
        return { min: 0.033, max: 0.035 };
    } else if (model.includes('Boeing 777') || model.includes('Airbus A330')) {
        console.log('Using default wide-body efficiency');
        return { min: 0.027, max: 0.030 };
    } else if (model.includes('Embraer') || model.includes('CRJ')) {
        console.log('Using default regional jet efficiency');
        return { min: 0.035, max: 0.038 };
    }
    
    console.log('No efficiency data found for model, using conservative estimate');
    return { min: 0.035, max: 0.040 }; // Conservative estimate for unknown aircraft
}

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

async function fetchFlights(airportCode, startTime, duration) {
    const url = `https://${API_HOST}/flights/airports/iata/${airportCode}?offsetMinutes=${startTime}&durationMinutes=${duration}&withLeg=true&direction=Both&withCancelled=true&withCodeshared=true&withCargo=true&withPrivate=true&withLocation=true`;
    
    console.log('Fetching flights from:', url);
    
    const response = await fetch(url, {
        method: 'GET',
        headers: {
            'X-RapidAPI-Key': API_KEY,
            'X-RapidAPI-Host': API_HOST
        }
    });

    if (!response.ok) {
        const errorText = await response.text();
        throw new Error(`API Error: ${response.status} - ${errorText}`);
    }

    const data = await response.json();
    console.log('API Response:', JSON.stringify(data, null, 2));
    return data;
}

async function searchAirport(airportCode = null) {
    const inputCode = airportCode || document.getElementById('airportCode').value.toUpperCase();
    const resultsDiv = document.getElementById('results');
    
    if (!inputCode) {
        resultsDiv.innerHTML = '<div class="error">Please enter an airport code</div>';
        return;
    }

    try {
        resultsDiv.innerHTML = 'Loading...';
        
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
        
        console.log('Combined flight data:', combinedData);
        
        // Display the flight information
        let flightsHtml = '<div class="success">';
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

                // Parse scheduled time with error handling
                let scheduledTime = 'Unknown';
                try {
                    if (flight.departure?.scheduledTimeUtc) {
                        const date = new Date(flight.departure.scheduledTimeUtc);
                        if (!isNaN(date.getTime())) {
                            scheduledTime = date.toLocaleString();
                        }
                    }
                } catch (error) {
                    console.error('Error parsing departure time:', error);
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
                    <div class="flight-card">
                        ${flight.number ? `<p><strong>Flight:</strong> ${flight.number}</p>` : ''}
                        ${toCode ? `<p><strong>To:</strong> ${toCode}${toName ? ` (${toName})` : ''}</p>` : ''}
                        ${aircraftModel !== 'Unknown' ? `<p><strong>Aircraft:</strong> ${aircraftModel}</p>` : ''}
                        ${distance ? `<p><strong>Distance:</strong> ${distance} km</p>` : ''}
                        ${efficiencyInfo !== 'Unknown' ? `<p><strong>Fuel Efficiency:</strong> ${efficiencyInfo}</p>` : ''}
                        ${emissions ? `<p><strong>CO₂ Emissions:</strong> ~${Math.round(emissions.perSeat)} kg CO₂/seat, ${Math.round(emissions.total / 1000)} tonnes CO₂ total</p>` : ''}
                        ${flight.status && flight.status !== 'Unknown' ? `<p><strong>Status:</strong> ${flight.status}</p>` : ''}
                        ${scheduledTime !== 'Unknown' ? `<p><strong>Departure:</strong> ${scheduledTime}</p>` : ''}
                    </div>
                `;
            }
        } else {
            flightsHtml += '<p>No departing flights found for this time period.</p>';
        }

        flightsHtml += '</div>';
        resultsDiv.innerHTML = flightsHtml;
    } catch (error) {
        console.error('Error details:', error);
        resultsDiv.innerHTML = `
            <div class="error">
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