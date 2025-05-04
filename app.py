from flask import Flask, render_template, request, jsonify, session
import os
import json
from datetime import datetime
from travel_planner import Traveler, find_optimal_destinations
import google.generativeai as genai
from dotenv import load_dotenv
import uuid
import re

# Try to load environment variables
try:
    load_dotenv()
except Exception as e:
    print(f"Error loading .env file: {e}")

# Set Google Gemini API key
GOOGLE_API_KEY = os.getenv("GOOGLE_API_KEY", "YOUR_API_KEY_HERE")
if not GOOGLE_API_KEY:
    print("Warning: GOOGLE_API_KEY environment variable is not set.")
    
# Configure Google Gemini API
genai.configure(api_key=GOOGLE_API_KEY)

app = Flask(__name__)
app.secret_key = os.urandom(24)  # Generate a random secret key for sessions

# Dictionary to store chat histories by session ID
chat_histories = {}

# Dictionary to store preference values by airport code (moved inside app to persist)
app.preference_value = {
    "ATL": 0, "BOS": 0, "DEN": 0, "LAX": 0, 
    "JFK": 0, "MIA": 0, "ORD": 0, "SFO": 0
}
print(f"Initialized preference tracking for {len(app.preference_value)} airports")

@app.route('/')
def index():
    """Render the main page."""
    return render_template('index.html')

@app.route('/api/chat', methods=['POST'])
def chat_api():
    """Handle chat messages and interact with Gemini AI."""
    try:
        data = request.json
        message = data.get('message', '')
        preferences = data.get('preferences', {})
        client_chat_history = data.get('chat_history', [])
        available_locations = data.get('availableLocations', [])
        
        # Get or create a session ID
        session_id = request.cookies.get('session_id')
        if not session_id:
            session_id = str(uuid.uuid4())
        
        # Initialize chat history for this session if it doesn't exist
        if session_id not in chat_histories:
            chat_histories[session_id] = []
        
        # Merge client-side history with server-side history if needed
        server_chat_history = chat_histories[session_id]
        
        # If client has history but server doesn't, use client history
        if not server_chat_history and client_chat_history:
            chat_histories[session_id] = client_chat_history
            server_chat_history = client_chat_history
        
        # Add the new user message to the history
        user_message = {
            'role': 'user',
            'content': message,
            'timestamp': datetime.now().isoformat()
        }
        server_chat_history.append(user_message)

        # Extract and print current preferences for debugging
        general_preferences = {}
        for dest_code, rating in preferences.items():
            if dest_code and rating:
                general_preferences[dest_code] = rating
                print(f"- {dest_code}: rating {rating}")
                
                # Update the app-level preference value based on user ratings
                if dest_code in app.preference_value and rating >= 3:
                    # Increment preference value for highly-rated destinations
                    app.preference_value[dest_code] += 1
                    print(f"Increased preference for {dest_code} to {app.preference_value[dest_code]}")
        
        # Get the list of available airport destinations
        if not available_locations:
            # If not provided by client, fetch from our airport-codes endpoint
            airport_list = [
                {"code": "ATL", "name": "Atlanta, USA"},
                {"code": "BOS", "name": "Boston, USA"},
                {"code": "DEN", "name": "Denver, USA"},
                {"code": "LAX", "name": "Los Angeles, USA"},
                {"code": "JFK", "name": "New York, USA"},
                {"code": "MIA", "name": "Miami, USA"},
                {"code": "ORD", "name": "Chicago, USA"},
                {"code": "SFO", "name": "San Francisco, USA"}
            ]
        else:
            airport_list = available_locations
        
        # Format the available destinations for the prompt
        available_destinations_text = "\n".join([f"- {airport['name']} ({airport['code']})" for airport in airport_list])
        
        # Format the preferences for the prompt
        preferences_text = ""
        if general_preferences:
            print(f"Found {len(general_preferences)} existing destination preferences")
            preferences_text = "Current destination preferences:\n"
            preferences_text += "\n".join([f"- {get_airport_name(code)} ({code}): {'Liked' if rating >= 3 else 'Disliked'} (Rating: {rating}/5)" 
                                        for code, rating in general_preferences.items()])
        
        # Format the prompt with user preferences and available destinations
        prompt = f"""You are a travel planning assistant helping users find the best destination for a trip.

USER QUESTION:
{message}

AVAILABLE DESTINATIONS:
{available_destinations_text}

{preferences_text}

You are a travel recommendation assistant. Given a user's travel preferences (likes and dislikes), produce two clearly labeled sections:

SUGGESTED DESTINATIONS:
* [Airport code] – [One-line justification tied directly to an explicit user preference or statement]
* [Airport code] – [Another one-line, evidence-based justification]

DESTINATIONS TO AVOID:
* [Airport code] – [One-line justification tied directly to an explicit user dislike or negative statement]
* [Airport code] – [Another one-line, evidence-based justification]

Each justification must explicitly reference the user's own words or clear synonyms. For example, if the user said "I love beaches", you might write "* Miami (MIA): User explicitly said they love beaches". If the user said "I dislike cold weather", you might write "* New York (JFK): New York has cold winters and user dislikes cold weather".

Do not include destinations based on general vibes or contrasts. Only suggest or avoid destinations based on explicitly stated preferences.

Format each destination with its airport code in parentheses, for example: "* New York (JFK): Reason for suggestion/avoidance"

VERY IMPORTANT: Always include both sections even if one section has no destinations. In that case, write "None based on current preferences" under that section.

Make sure to ONLY suggest destinations from the AVAILABLE DESTINATIONS list above."""

        try:
            # List available models for debugging
            print("Available Gemini models:", [model.name for model in genai.list_models()])
            
            # Initialize Gemini model - try different models in case of failure
            try:
                # First try with gemini-1.5-flash-latest
                model = genai.GenerativeModel('models/gemini-1.5-flash-latest')
            except Exception as model_error:
                print(f"First model failed: {str(model_error)}")
                try:
                    # Then try with gemini-1.5-flash
                    model = genai.GenerativeModel('models/gemini-1.5-flash')
                except Exception as model_error2:
                    print(f"Second model failed: {str(model_error2)}")
                    # Finally try with the simplest model
                    model = genai.GenerativeModel('models/gemini-pro')
            
            # Generate response
            response = model.generate_content(prompt)
            
            # Extract the response text
            assistant_message = response.text
            
            print(f"Gemini API response generated successfully.")
            
        except Exception as e:
            # Return a mock response if API call fails
            print(f"Gemini API error: {str(e)}")
            assistant_message = "I'd be happy to help with your travel planning! However, I'm having trouble connecting to my knowledge base right now. Please try again in a moment."

        # Add the assistant response to the conversation history
        assistant_entry = {
            'role': 'assistant',
            'content': assistant_message,
            'timestamp': datetime.now().isoformat()
        }
        server_chat_history.append(assistant_entry)
        
        # Keep history to a reasonable size
        if len(server_chat_history) > 50:
            server_chat_history = server_chat_history[-50:]
            chat_histories[session_id] = server_chat_history
            
        # Print the current chat history for debugging
        print(f"Session {session_id} has {len(server_chat_history)} messages")

        # Extract destination recommendations
        suggested_destinations = {}
        destinations_to_avoid = {}
        
        # Extract suggested destinations section
        suggested_match = re.search(r'SUGGESTED DESTINATIONS:(.*?)(?:(?:\d+\.\s*)?DESTINATIONS TO AVOID:|$)', 
                                  assistant_message, re.IGNORECASE | re.DOTALL)
        
        # Extract destinations to avoid section - improve the regex to be more robust
        avoid_match = re.search(r'(?:\d+\.\s*)?DESTINATIONS? TO AVOID:?\s*([\s\S]*?)(?:\n\n|\Z)', 
                                  assistant_message, re.IGNORECASE | re.DOTALL)
        
        # Try alternate pattern if first one doesn't match
        if not avoid_match:
            avoid_match = re.search(r'(?:\d+\.\s*)?DESTINATIONS? TO AVOID:?\s*([\s\S]*?)(?:\n\n|\Z)',
                                   assistant_message, re.IGNORECASE)
            if avoid_match:
                print("Found avoid section with alternate pattern")
        
        # Function to extract destinations with airport codes
        def extract_destinations(text):
            destinations = {}
            if not text:
                return destinations
                
            print(f"Extracting destinations from: '{text}'")
                
            # Look for destinations with airport codes in parentheses - standard format
            matches = re.finditer(r'([A-Za-z\s,\.]+)\s*\(([A-Z]{3})\)', text)
            for match in matches:
                dest_name = match.group(1).strip()
                airport_code = match.group(2).strip()
                destinations[airport_code] = {
                    "name": dest_name,
                    "code": airport_code
                }
                print(f"Found destination: {dest_name} ({airport_code})")
            
            # Try alternate formats if none found - look for bullet points or numbered lists
            if not destinations:
                # Look for bullet points with airport codes
                bullet_matches = re.finditer(r'[\*\-•]\s*([A-Za-z\s,\.]+)\s*\(([A-Z]{3})\)', text)
                for match in bullet_matches:
                    dest_name = match.group(1).strip()
                    airport_code = match.group(2).strip()
                    destinations[airport_code] = {
                        "name": dest_name,
                        "code": airport_code
                    }
                    print(f"Found bulleted destination: {dest_name} ({airport_code})")
            
            # If still no destinations found, try looking for just airport codes
            if not destinations:
                # Try looking for just the airport codes if they're mentioned
                alt_matches = re.finditer(r'\b([A-Z]{3})\b', text)
                for match in alt_matches:
                    airport_code = match.group(1)
                    if airport_code in ["ATL", "BOS", "DEN", "LAX", "JFK", "MIA", "ORD", "SFO"]:
                        destinations[airport_code] = {
                            "name": get_airport_name(airport_code),
                            "code": airport_code
                        }
                        print(f"Found airport code: {airport_code}")
            
            return destinations
        
        # Process suggested destinations
        if suggested_match:
            suggested_text = suggested_match.group(1).strip()
            suggested_destinations = extract_destinations(suggested_text)
            
            # Update global preference values for suggested destinations
            for code in suggested_destinations:
                if code in app.preference_value:
                    app.preference_value[code] += 1
                    print(f"Increased preference for suggested {code} to {app.preference_value[code]}")
            
        # Process destinations to avoid
        if avoid_match:
            avoid_text = avoid_match.group(1).strip()
            print(f"Found DESTINATIONS TO AVOID section: '{avoid_text}'")
            destinations_to_avoid = extract_destinations(avoid_text)
            print(f"Extracted destinations to avoid: {list(destinations_to_avoid.keys())}")
            
            # Apply negative preference for destinations to avoid
            for code in destinations_to_avoid:
                if code in app.preference_value:
                    # Apply a more moderate penalty - decrease by 2 instead of 5
                    app.preference_value[code] = max(-5, app.preference_value[code] - 2)
                    print(f"Decreased preference for avoided {code} to {app.preference_value[code]}")
                else:
                    print(f"Warning: Destination {code} not found in preference tracking")
        else:
            # Add more detailed logging for debugging
            print("No DESTINATIONS TO AVOID section found in the response")
            print(f"Full assistant response: '{assistant_message}'")
            # Print the first 100 characters of the message for easier debugging
            print(f"First 100 chars: '{assistant_message[:100]}'")
            print(f"Last 100 chars: '{assistant_message[-100:]}'")
            
            # Check if there's anything resembling a to-avoid section
            possible_avoid = re.search(r'avoid|negative|don\'t recommend', assistant_message, re.IGNORECASE)
            if possible_avoid:
                print(f"Found possible avoid-related content near: '{assistant_message[max(0, possible_avoid.start()-20):min(len(assistant_message), possible_avoid.start()+50)]}'")
        
        print(f"Returning: {len(suggested_destinations)} recommended destinations, {len(destinations_to_avoid)} destinations to avoid")
        
        # Print current preference values for debugging
        print("Current global preference values:")
        for code, value in app.preference_value.items():
            print(f"  {code}: {value}")
        
        response = jsonify({
            'status': 'success',
            'message': assistant_message,
            'suggested_destinations': list(suggested_destinations.values()),
            'avoid_destinations': list(destinations_to_avoid.values()),
            'chat_history': server_chat_history
        })
        
        # Set a session ID cookie if not already set
        if not request.cookies.get('session_id'):
            response.set_cookie('session_id', session_id, max_age=60*60*24*30)  # 30 days expiry
            
        return response

    except Exception as e:
        return jsonify({'error': str(e)}), 500

@app.route('/api/find-destinations', methods=['POST'])
def find_destinations():
    """API endpoint to find optimal destinations."""
    try:
        data = request.json
        
        # Extract data from request
        travelers_data = data.get('travelers', [])
        candidate_destinations = data.get('destinations', [])
        travel_date = data.get('travelDate')
        cost_weight = float(data.get('costWeight', 0.6))
        emissions_weight = float(data.get('emissionsWeight', 0.2))
        preference_weight = float(data.get('preferenceWeight', 0.2))
        
        # Initialize destinations_to_avoid (missing variable)
        destinations_to_avoid = data.get('avoid_destinations', [])
        # Convert from list of objects to set of codes for easier lookup
        destinations_to_avoid = {d.get('code') for d in destinations_to_avoid if d.get('code')}
        
        # Debug: Print avoid list
        print(f"IMPORTANT - Destinations to avoid in this query: {destinations_to_avoid}")
        
        # Reset any global preferences if explicitly requested
        reset_preferences = data.get('reset_preferences', False)
        if reset_preferences:
            print("Resetting all global preferences as requested")
            for code in app.preference_value:
                app.preference_value[code] = 0
                
        # Validate data
        if not travelers_data or not candidate_destinations or not travel_date:
            return jsonify({'error': 'Missing required data'}), 400
            
        # Create Traveler objects
        travelers = []
        try:
            for t in travelers_data:
                preferences = {}
                # Convert preferences from the format {destination: rating}
                if 'preferences' in t:
                    preferences = {dest: float(rating) for dest, rating in t.get('preferences', {}).items()}
                    
                    # Clear global preference counter for destinations not in this request
                    # This ensures removed preferences take effect immediately
                    for dest_code in app.preference_value.keys():
                        if dest_code not in preferences and app.preference_value[dest_code] > 0:
                            app.preference_value[dest_code] = max(0, app.preference_value[dest_code] - 1)
                            print(f"Reduced global preference for {dest_code} to {app.preference_value[dest_code]} since it was removed")
                    
                    # Update global preference counter for highly rated destinations (≥3)
                    # This ensures the UI form updates global preferences just like the chat does
                    for dest, rating in preferences.items():
                        if dest in app.preference_value and rating >= 3:
                            app.preference_value[dest] += 1
                            print(f"Updated global preference for {dest} to {app.preference_value[dest]} from UI form")
                    
                    # Override preferences with global preference values if they exist
                    for dest in preferences:
                        if dest in app.preference_value and app.preference_value[dest] > 0:
                            # Apply a multiplier based on global preference value 
                            # This amplifies the effect for frequently selected destinations
                            multiplier = min(4.0, 1.0 + (app.preference_value[dest] * 0.5))
                            preferences[dest] = min(5.0, preferences[dest] * multiplier)
                            print(f"Adjusted preference for {dest} with multiplier {multiplier:.1f}: {preferences[dest]:.1f}")
                
                traveler = Traveler(t['name'], t['origin'], preferences)
                travelers.append(traveler)
                
                # Debug: Print what preferences are being set for this traveler
                if preferences:
                    print(f"Traveler {t['name']} preferences:")
                    for dest, rating in preferences.items():
                        print(f"  - {dest}: {rating:.1f}/5.0")
                else:
                    print(f"Traveler {t['name']} has no preferences set")
                
        except KeyError as ke:
            return jsonify({'error': f'Missing required traveler data: {str(ke)}'}), 400
        except Exception as e:
            return jsonify({'error': f'Invalid traveler data: {str(e)}'}), 400
        
        # Apply global preferences to all destinations for scoring
        global_destination_preferences = {}
        for dest in candidate_destinations:
            if dest in app.preference_value:
                # The key change: Now HIGHER scores are BETTER, so invert the scoring
                # Higher preference_value should result in HIGHER scores (better ranking)
                # For negative preference values (destinations to avoid), give very low scores
                if dest in destinations_to_avoid:
                    # Apply a moderate penalty for avoided destinations, but don't completely eliminate them
                    # This gives them a 20% score reduction rather than forcing to absolute minimum
                    base_score = 0.4  # Slightly below neutral (0.5)
                    print(f"Moderately penalizing explicitly avoided destination {dest} to {base_score}")
                    score = base_score
                elif app.preference_value[dest] < 0:
                    # Map negative preferences (-10 to -1) to lower scores (0.3 to 0.45)
                    # More negative = lower score but not drastically low
                    score = 0.3 + (0.15 * (10 + app.preference_value[dest]) / 10)  # Maps -10 to 0.3, -1 to 0.435
                elif app.preference_value[dest] > 0:
                    # Map positive preferences (1 to many) to higher scores (0.6 to 1.0)
                    # Make the curve more aggressive so preferences have a stronger impact
                    boost = min(0.4, (app.preference_value[dest] * 0.15))  # More impactful boost 
                    score = 0.6 + boost  # Maps 1 to 0.75, 3+ to 1.0
                    print(f"High preference for {dest}, giving score {score:.2f} with boost {boost:.2f}")
                else:
                    # Neutral score (0) maps to 0.5
                    score = 0.5
                
                global_destination_preferences[dest] = score
                print(f"Global preference for {dest}: {score:.2f} (from {app.preference_value[dest]} selections/avoidances)")
        
        # Find optimal destinations
        try:
            api_key = os.environ.get("SKYSCANNER_API_KEY", "your_api_key_here")
            optimal_destinations = find_optimal_destinations(
                travelers=travelers,
                candidate_destinations=candidate_destinations,
                travel_date=travel_date,
                api_key=api_key,
                mock_api=True,  # Always use mock data for the web app
                cost_weight=cost_weight,
                emissions_weight=emissions_weight,
                preference_weight=preference_weight,
                max_results_per_route=1,
                # Pass global preferences
                general_preferences=[
                    {"type": "destination", "preferences": global_destination_preferences}
                ]
            )
                
            # Handle no results
            if not optimal_destinations:
                return jsonify({'destinations': [], 'message': 'No suitable destinations found'}), 200
            
            # Sort by score (HIGHER is BETTER in the new system)
            optimal_destinations.sort(key=lambda d: d.score, reverse=True)
        except Exception as e:
            print(f"Error finding destinations: {str(e)}")
            return jsonify({'error': f'Error finding destinations: {str(e)}'}), 500
        
        # Convert to JSON-serializable format
        results = []
        for dest in optimal_destinations[:5]:  # Top 5 destinations
            try:
                # Ensure destination code is valid
                destination_code = dest.destination_code
                if not destination_code or len(destination_code.strip()) != 3:
                    # Skip invalid destinations
                    print(f"Skipping destination with invalid code: {destination_code}")
                    continue
                    
                flight_plans = []
                for plan in dest.flight_plans:
                    flight_info = plan.flight
                    flight_plans.append({
                        'traveler': plan.traveler.name,
                        'origin': plan.traveler.origin,
                        'airline': flight_info.airline,
                        'price': flight_info.price,
                        'departure': flight_info.departure_time.isoformat(),
                        'arrival': flight_info.arrival_time.isoformat(),
                        'duration_minutes': flight_info.duration_minutes,
                        'emissions_kg': flight_info.emissions_kg,
                        'flight_number': flight_info.flight_number,
                    })
                
                result = {
                    'destination': destination_code,
                    'destination_name': get_airport_name(destination_code),
                    'total_cost': dest.total_cost,
                    'average_cost': dest.average_cost,
                    'total_emissions': dest.total_emissions,
                    'score': dest.score,
                    'flight_plans': flight_plans,
                    'preference_count': app.preference_value.get(destination_code, 0)
                }
                
                results.append(result)
            except Exception as e:
                print(f"Error processing destination {getattr(dest, 'destination_code', 'unknown')}: {str(e)}")
                # Continue with next destination instead of failing completely
                continue
        
        if not results:
            return jsonify({'destinations': [], 'message': 'No valid destinations found with the current criteria'}), 200
            
        return jsonify({'destinations': results})
        
    except Exception as e:
        print(f"Unexpected error in find_destinations API: {str(e)}")
        import traceback
        traceback.print_exc()
        return jsonify({'error': str(e)}), 500

def get_airport_name(code):
    """Return a human-readable airport name for a given code."""
    airport_names = {
        # North America
        "ATL": "Atlanta",
        "BOS": "Boston",
        "DEN": "Denver",
        "LAX": "Los Angeles",
        "JFK": "New York JFK",
        "MIA": "Miami",
        "ORD": "Chicago O'Hare",
        "SFO": "San Francisco",
        "YYZ": "Toronto",
        "YVR": "Vancouver",
        "MEX": "Mexico City",
        "CUN": "Cancun",
        
        # Europe
        "LHR": "London",
        "CDG": "Paris",
        "FRA": "Frankfurt",
        "AMS": "Amsterdam",
        "MAD": "Madrid",
        "BCN": "Barcelona",
        "FCO": "Rome",
        "MXP": "Milan",
        "IST": "Istanbul",
        "DME": "Moscow",
        "CPH": "Copenhagen",
        "ARN": "Stockholm",
        "OSL": "Oslo",
        "ZRH": "Zurich",
        "VIE": "Vienna",
        "LIS": "Lisbon",
        "ATH": "Athens",
        
        # Asia
        "PEK": "Beijing",
        "PVG": "Shanghai",
        "HKG": "Hong Kong",
        "NRT": "Tokyo",
        "KIX": "Osaka",
        "ICN": "Seoul",
        "SIN": "Singapore",
        "BKK": "Bangkok",
        "KUL": "Kuala Lumpur",
        "DEL": "Delhi",
        "BOM": "Mumbai",
        "DXB": "Dubai",
        "DOH": "Doha",
        
        # Australia/Oceania
        "SYD": "Sydney",
        "MEL": "Melbourne",
        "BNE": "Brisbane",
        "PER": "Perth",
        "AKL": "Auckland",
        "CHC": "Christchurch",
        "NAN": "Nadi",
        
        # Africa
        "JNB": "Johannesburg",
        "CPT": "Cape Town",
        "CAI": "Cairo",
        "LOS": "Lagos",
        "ACC": "Accra",
        "NBO": "Nairobi",
        "ADD": "Addis Ababa",
        "CMN": "Casablanca",
        
        # South America
        "GRU": "São Paulo",
        "GIG": "Rio de Janeiro",
        "EZE": "Buenos Aires",
        "SCL": "Santiago",
        "LIM": "Lima",
        "BOG": "Bogotá",
        "CCS": "Caracas"
    }
    return airport_names.get(code, f"Airport {code}")

@app.route('/api/airport-codes')
def airport_codes():
    """Return a list of common airport codes."""
    common_airports = [
        # North America
        {"code": "ATL", "name": "Atlanta, USA", "continent": "North America"},
        {"code": "BOS", "name": "Boston, USA", "continent": "North America"},
        {"code": "DEN", "name": "Denver, USA", "continent": "North America"},
        {"code": "LAX", "name": "Los Angeles, USA", "continent": "North America"},
        {"code": "JFK", "name": "New York, USA", "continent": "North America"},
        {"code": "MIA", "name": "Miami, USA", "continent": "North America"},
        {"code": "ORD", "name": "Chicago, USA", "continent": "North America"},
        {"code": "SFO", "name": "San Francisco, USA", "continent": "North America"},
        {"code": "YYZ", "name": "Toronto, Canada", "continent": "North America"},
        {"code": "YVR", "name": "Vancouver, Canada", "continent": "North America"},
        {"code": "MEX", "name": "Mexico City, Mexico", "continent": "North America"},
        {"code": "CUN", "name": "Cancun, Mexico", "continent": "North America"},
        
        # Europe
        {"code": "LHR", "name": "London, UK", "continent": "Europe"},
        {"code": "CDG", "name": "Paris, France", "continent": "Europe"},
        {"code": "FRA", "name": "Frankfurt, Germany", "continent": "Europe"},
        {"code": "AMS", "name": "Amsterdam, Netherlands", "continent": "Europe"},
        {"code": "MAD", "name": "Madrid, Spain", "continent": "Europe"},
        {"code": "BCN", "name": "Barcelona, Spain", "continent": "Europe"},
        {"code": "FCO", "name": "Rome, Italy", "continent": "Europe"},
        {"code": "MXP", "name": "Milan, Italy", "continent": "Europe"},
        {"code": "IST", "name": "Istanbul, Turkey", "continent": "Europe"},
        {"code": "DME", "name": "Moscow, Russia", "continent": "Europe"},
        {"code": "CPH", "name": "Copenhagen, Denmark", "continent": "Europe"},
        {"code": "ARN", "name": "Stockholm, Sweden", "continent": "Europe"},
        {"code": "OSL", "name": "Oslo, Norway", "continent": "Europe"},
        {"code": "ZRH", "name": "Zurich, Switzerland", "continent": "Europe"},
        {"code": "VIE", "name": "Vienna, Austria", "continent": "Europe"},
        {"code": "LIS", "name": "Lisbon, Portugal", "continent": "Europe"},
        {"code": "ATH", "name": "Athens, Greece", "continent": "Europe"},
        
        # Asia
        {"code": "PEK", "name": "Beijing, China", "continent": "Asia"},
        {"code": "PVG", "name": "Shanghai, China", "continent": "Asia"},
        {"code": "HKG", "name": "Hong Kong", "continent": "Asia"},
        {"code": "NRT", "name": "Tokyo, Japan", "continent": "Asia"},
        {"code": "KIX", "name": "Osaka, Japan", "continent": "Asia"},
        {"code": "ICN", "name": "Seoul, South Korea", "continent": "Asia"},
        {"code": "SIN", "name": "Singapore", "continent": "Asia"},
        {"code": "BKK", "name": "Bangkok, Thailand", "continent": "Asia"},
        {"code": "KUL", "name": "Kuala Lumpur, Malaysia", "continent": "Asia"},
        {"code": "DEL", "name": "Delhi, India", "continent": "Asia"},
        {"code": "BOM", "name": "Mumbai, India", "continent": "Asia"},
        {"code": "DXB", "name": "Dubai, UAE", "continent": "Asia"},
        {"code": "DOH", "name": "Doha, Qatar", "continent": "Asia"},
        
        # Australia/Oceania
        {"code": "SYD", "name": "Sydney, Australia", "continent": "Oceania"},
        {"code": "MEL", "name": "Melbourne, Australia", "continent": "Oceania"},
        {"code": "BNE", "name": "Brisbane, Australia", "continent": "Oceania"},
        {"code": "PER", "name": "Perth, Australia", "continent": "Oceania"},
        {"code": "AKL", "name": "Auckland, New Zealand", "continent": "Oceania"},
        {"code": "CHC", "name": "Christchurch, New Zealand", "continent": "Oceania"},
        {"code": "NAN", "name": "Nadi, Fiji", "continent": "Oceania"},
        
        # Africa
        {"code": "JNB", "name": "Johannesburg, South Africa", "continent": "Africa"},
        {"code": "CPT", "name": "Cape Town, South Africa", "continent": "Africa"},
        {"code": "CAI", "name": "Cairo, Egypt", "continent": "Africa"},
        {"code": "LOS", "name": "Lagos, Nigeria", "continent": "Africa"},
        {"code": "ACC", "name": "Accra, Ghana", "continent": "Africa"},
        {"code": "NBO", "name": "Nairobi, Kenya", "continent": "Africa"},
        {"code": "ADD", "name": "Addis Ababa, Ethiopia", "continent": "Africa"},
        {"code": "CMN", "name": "Casablanca, Morocco", "continent": "Africa"},
        
        # South America
        {"code": "GRU", "name": "São Paulo, Brazil", "continent": "South America"},
        {"code": "GIG", "name": "Rio de Janeiro, Brazil", "continent": "South America"},
        {"code": "EZE", "name": "Buenos Aires, Argentina", "continent": "South America"},
        {"code": "SCL", "name": "Santiago, Chile", "continent": "South America"},
        {"code": "LIM", "name": "Lima, Peru", "continent": "South America"},
        {"code": "BOG", "name": "Bogotá, Colombia", "continent": "South America"},
        {"code": "CCS", "name": "Caracas, Venezuela", "continent": "South America"}
    ]
    return jsonify(common_airports)

if __name__ == '__main__':
    # Check for command line arguments to facilitate testing
    import sys
    if len(sys.argv) > 1:
        if sys.argv[1] == '--test-preferences':
            if len(sys.argv) >= 4:
                airport = sys.argv[2].upper()
                adjustment = int(sys.argv[3])
                
                if airport in app.preference_value:
                    old_value = app.preference_value[airport]
                    app.preference_value[airport] += adjustment
                    print(f"Adjusted {airport} preference from {old_value} to {app.preference_value[airport]}")
                    
                    # Also print what the score would be
                    if app.preference_value[airport] < 0:
                        score = 0.3 + (0.15 * (5 + app.preference_value[airport]) / 5)  # Maps -5 to 0.3, -1 to 0.42
                    elif app.preference_value[airport] > 0:
                        boost = min(0.4, (app.preference_value[airport] * 0.15))
                        score = 0.6 + boost  # Maps 1 to 0.75, 3+ to 1.0
                    else:
                        score = 0.5
                    print(f"This would give {airport} a preference score of {score:.2f}")
                else:
                    print(f"Airport {airport} not found in preference tracking")
                sys.exit(0)
            else:
                print("Usage: python app.py --test-preferences <airport_code> <adjustment>")
                print("Example: python app.py --test-preferences JFK -2")
                sys.exit(1)
                
    # Make sure templates folder exists
    os.makedirs('templates', exist_ok=True)
    # Make sure static folder exists
    os.makedirs('static', exist_ok=True)
    app.run(debug=True, port=8080) 