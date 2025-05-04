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

Provide helpful but concise travel advice based on the user's question and preferences. Be direct and to the point.

For your response, include these two clear sections with the exact headings:

1. "SUGGESTED DESTINATIONS:" - List 2-3 destinations from the available destinations that would be good based on the user's preferences, with brief reasons

2. "DESTINATIONS TO AVOID:" - List 1-2 destinations that would be poor choices based on the user's preferences, with brief reasons

Format each destination with its airport code in parentheses, for example: "New York (JFK)".
Make sure to ONLY suggest destinations from the AVAILABLE DESTINATIONS list above.

IMPORTANT: For both sections, format each destination on a new line with a bullet point (*) and include the airport code in parentheses, for example:
* New York (JFK): Reason for suggestion/avoidance
* Chicago (ORD): Reason for suggestion/avoidance"""

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
        suggested_match = re.search(r'SUGGESTED DESTINATIONS:(.*?)(?:DESTINATIONS TO AVOID:|$)', 
                                    assistant_message, re.IGNORECASE | re.DOTALL)
        
        # Extract destinations to avoid section - improve the regex to be more robust
        avoid_match = re.search(r'DESTINATIONS TO AVOID:(.*?)(?:\n\n|\Z)', 
                                assistant_message, re.IGNORECASE | re.DOTALL)
        
        # Try alternate pattern if first one doesn't match
        if not avoid_match:
            avoid_match = re.search(r'DESTINATIONS? TO AVOID:?\s*([\s\S]*?)(?:\n\n|\Z)',
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
            
            # Try alternate formats if none found
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
                    # Decrease preference value (but don't go below -5)
                    app.preference_value[code] = max(-5, app.preference_value[code] - 2)
                    print(f"Decreased preference for avoided {code} to {app.preference_value[code]}")
                else:
                    print(f"Warning: Destination {code} not found in preference tracking")
        else:
            print("No DESTINATIONS TO AVOID section found in the response")
        
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
                if app.preference_value[dest] < 0:
                    # Map negative preferences (-5 to -1) to very low scores (0.0 to 0.1)
                    # More negative = lower score
                    score = 0.1 * (5 + app.preference_value[dest]) / 5  # Maps -5 to 0.0, -1 to 0.08
                elif app.preference_value[dest] > 0:
                    # Map positive preferences (1 to many) to high scores (0.5 to 1.0)
                    # Higher positive preference = higher score
                    boost = min(1.0, app.preference_value[dest] * 0.25)
                    score = 0.5 + (boost * 0.5)  # Maps 1 to 0.625, 4 to 1.0
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
        "ATL": "Atlanta",
        "BOS": "Boston",
        "DEN": "Denver",
        "LAX": "Los Angeles",
        "JFK": "New York JFK",
        "MIA": "Miami",
        "ORD": "Chicago O'Hare",
        "SFO": "San Francisco"
    }
    return airport_names.get(code, f"Airport {code}")

@app.route('/api/airport-codes')
def airport_codes():
    """Return a list of common airport codes."""
    common_airports = [
        {"code": "ATL", "name": "Atlanta, USA"},
        {"code": "BOS", "name": "Boston, USA"},
        {"code": "DEN", "name": "Denver, USA"},
        {"code": "LAX", "name": "Los Angeles, USA"},
        {"code": "JFK", "name": "New York, USA"},
        {"code": "MIA", "name": "Miami, USA"},
        {"code": "ORD", "name": "Chicago, USA"},
        {"code": "SFO", "name": "San Francisco, USA"}
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
                        score = 0.1 * (5 + app.preference_value[airport]) / 5  # Maps -5 to 0.0, -1 to 0.08
                    elif app.preference_value[airport] > 0:
                        boost = min(1.0, app.preference_value[airport] * 0.25)
                        score = 0.5 + (boost * 0.5)  # Maps 1 to 0.625, 4 to 1.0
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