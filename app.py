from flask import Flask, render_template, request, jsonify
import os
import json
from datetime import datetime
from travel_planner import Traveler, find_optimal_destinations, print_destinations
import google.generativeai as genai
from dotenv import load_dotenv
import re

# Try to load environment variables
try:
    load_dotenv()
except Exception as e:
    print(f"Error loading .env file: {e}")

# Set Google Gemini API key
GOOGLE_API_KEY = os.getenv("GOOGLE_API_KEY", "AIzaSyA0els6YRkrRbld7cLKlMcPjKu2FaWLdA0")
if not GOOGLE_API_KEY:
    print("Warning: GOOGLE_API_KEY environment variable is not set.")
    
# Configure Google Gemini API
genai.configure(api_key=GOOGLE_API_KEY)

app = Flask(__name__)

@app.route('/')
def index():
    """Render the main page."""
    return render_template('index.html')

@app.route('/chat')
def chat():
    """Render the chat interface."""
    return render_template('chat.html')

@app.route('/api/chat', methods=['POST'])
def chat_api():
    """Handle chat messages and interact with Gemini AI."""
    try:
        data = request.json
        message = data.get('message', '')
        preferences = data.get('preferences', {})
        
        # Extract detailed preferences
        travel_date = preferences.get('travelDate', 'Not specified')
        cost_weight = preferences.get('costWeight', 0.6)
        emissions_weight = preferences.get('emissionsWeight', 0.2)
        preference_weight = preferences.get('preferenceWeight', 0.2)
        travelers = preferences.get('travelers', [])
        destinations = preferences.get('destinations', [])
        general_preferences = preferences.get('generalPreferences', [])
        
        # Format traveler information with preferences
        traveler_info = ""
        for i, traveler in enumerate(travelers):
            # Basic info
            traveler_info += f"{i+1}. {traveler.get('name', 'Unknown')} from {traveler.get('origin', 'Unknown')}"
            
            # Add destination preferences if available
            if 'preferences' in traveler and traveler['preferences']:
                traveler_info += " - Destination preferences: "
                preferences = []
                for dest, rating in traveler['preferences'].items():
                    preferences.append(f"{dest} (rating: {rating}/5)")
                traveler_info += ", ".join(preferences)
            traveler_info += "\n"
        
        # Format general preferences
        general_pref_info = ""
        if general_preferences:
            general_pref_info = "GENERAL PREFERENCES:\n"
            for pref in general_preferences:
                pref_type = pref.get('type', '').replace('_', ' ').title()
                pref_value = pref.get('value', '')
                
                # For destination preferences, include rating
                if pref.get('type') == 'preferred_destination':
                    rating = pref.get('rating', 3)
                    general_pref_info += f"- {pref_type}: {pref_value} (Rating: {rating}/5)\n"
                else:
                    general_pref_info += f"- {pref_type}: {pref_value}\n"
        
        # Format destination options
        destination_info = ", ".join(destinations) if destinations else "Not specified"

        # Format the prompt with user preferences
        prompt = f"""You are a travel planning assistant helping users find the best destination for a group trip. The user has provided the following information:

CURRENT TRAVEL PLAN:
- Travel Date: {travel_date}
- Importance Weights:
  * Cost: {cost_weight} (higher means cost is more important)
  * Emissions: {emissions_weight} (higher means environmental impact is more important)
  * Destination Preferences: {preference_weight} (higher means travelers' destination ratings matter more)

TRAVELERS ({len(travelers)}):
{traveler_info}

{general_pref_info}

DESTINATION OPTIONS:
{destination_info}

USER QUESTION:
{message}

Provide helpful travel advice based on this information. If you suggest specific destinations, use the standard 3-letter airport codes (like LAX, JFK, etc.) and explain why they might work well for this group.

Remember:
1. Consider the origins of all travelers when making recommendations
2. Take into account each traveler's destination preferences when suggesting options
3. Be specific and personalized in your advice
4. If appropriate, suggest additional destinations that might work well for this group
5. Be conversational and friendly"""

        try:
            # List available models for debugging
            print("Available Gemini models:", [model.name for model in genai.list_models()])
            
            # Initialize Gemini model - use a valid model from the available models list
            model = genai.GenerativeModel('models/gemini-1.5-flash-latest')
            
            # Generate response
            response = model.generate_content(prompt)
            
            # Extract the response text
            assistant_message = response.text
            
            print(f"Gemini API response generated successfully.")
            
        except Exception as e:
            # Return a mock response if API call fails
            print(f"Gemini API error: {str(e)}")
            assistant_message = f"""I'd be happy to help with your travel planning!

Based on your current travel plan:
- Travel Date: {travel_date}
- {len(travelers)} travelers from different origins: {', '.join([t.get('origin', 'Unknown') for t in travelers])}
- Considering destinations: {destination_info}

I would recommend looking at destinations that provide a good balance of travel costs and convenience for everyone in your group. 

For your specific group traveling from {', '.join([t.get('origin', 'Unknown') for t in travelers])}, consider:
- Chicago (ORD) as a central meeting point with good flight connections
- Miami (MIA) for a warm destination with good flight options from major cities
- Denver (DEN) as a mountain getaway with direct flights from many cities

When you've made your choice, you can use the "Find Best Destinations" button to get detailed flight information.

[Note: This is a mock response as the AI API experienced an error]"""

        # Extract destination recommendations from the assistant's message
        # Look for airport codes in the response (3 uppercase letters)
        airport_code_regex = r'\b([A-Z]{3})\b'
        suggested_airports = list(set(re.findall(airport_code_regex, assistant_message)))
        
        # Generate a rating for each suggested destination (4-5 for explicitly recommended ones)
        destination_recommendations = {}
        for airport in suggested_airports:
            # Give higher ratings to airports mentioned more prominently
            # Basic heuristic: if airport is mentioned in context that suggests recommendation
            recommendation_phrases = [
                f"recommend {airport}",
                f"suggest {airport}",
                f"{airport} would be",
                f"{airport} is a good",
                f"{airport} is great",
                f"consider {airport}"
            ]
            
            rating = 3  # Default rating for mentioned airports
            for phrase in recommendation_phrases:
                if phrase.lower() in assistant_message.lower():
                    rating = 5
                    break
                elif airport in assistant_message.split("\n")[0:5]:  # Mentioned early in response
                    rating = 4
            
            destination_recommendations[airport] = rating
        
        # Also extract general preferences from the response
        general_preference_suggestions = []
        
        # Look for airline suggestions
        airline_patterns = [
            r'fly with ([A-Z][a-z]+ ?[A-Z]?[a-z]*)',
            r'([A-Z][a-z]+ ?[A-Z]?[a-z]*) Airlines?',
            r'carrier like ([A-Z][a-z]+ ?[A-Z]?[a-z]*)'
        ]
        
        for pattern in airline_patterns:
            airlines = re.findall(pattern, assistant_message)
            for airline in airlines:
                if airline and len(airline) > 3:  # Avoid short matches
                    general_preference_suggestions.append({
                        'type': 'airline',
                        'value': airline.strip()
                    })
        
        # Look for time suggestions
        time_patterns = [
            r'morning flight',
            r'evening departure',
            r'afternoon arrival',
            r'night flight',
            r'early departure',
            r'late arrival'
        ]
        
        for pattern in time_patterns:
            if re.search(pattern, assistant_message.lower()):
                time_type = 'departure_time' if 'departure' in pattern or pattern.startswith('early') else 'arrival_time'
                time_value = pattern.replace('flight', '').replace('departure', '').replace('arrival', '').strip()
                general_preference_suggestions.append({
                    'type': time_type,
                    'value': time_value
                })
        
        return jsonify({
            'status': 'success',
            'message': assistant_message,
            'destination_recommendations': destination_recommendations,
            'general_preference_suggestions': general_preference_suggestions
        })

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
        general_preferences = data.get('generalPreferences', [])
        
        # Validate data
        if not travelers_data or not candidate_destinations or not travel_date:
            return jsonify({'error': 'Missing required data'}), 400
            
        # Create Traveler objects
        travelers = []
        for t in travelers_data:
            preferences = {}
            # Convert preferences from the format {destination: rating}
            if 'preferences' in t:
                preferences = {dest: float(rating) for dest, rating in t.get('preferences', {}).items()}
            
            traveler = Traveler(t['name'], t['origin'], preferences)
            travelers.append(traveler)
        
        # Find optimal destinations
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
            max_results_per_route=1
        )
        
        # Convert to JSON-serializable format
        results = []
        for dest in optimal_destinations[:5]:  # Top 5 destinations
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
                
            results.append({
                'destination': dest.destination_code,
                'total_cost': dest.total_cost,
                'average_cost': dest.average_cost,
                'total_emissions': dest.total_emissions,
                'score': dest.score,
                'flight_plans': flight_plans
            })
            
        # Debug log
        print("API response:", results)
            
        return jsonify({'destinations': results})
        
    except Exception as e:
        return jsonify({'error': str(e)}), 500

@app.route('/api/airport-codes')
def airport_codes():
    """Return a list of common airport codes."""
    common_airports = [
        {"code": "ATL", "name": "Atlanta, USA"},
        {"code": "AUS", "name": "Austin, USA"},
        {"code": "BOS", "name": "Boston, USA"},
        {"code": "CDG", "name": "Paris, France"},
        {"code": "DEN", "name": "Denver, USA"},
        {"code": "DFW", "name": "Dallas/Fort Worth, USA"},
        {"code": "LAS", "name": "Las Vegas, USA"},
        {"code": "LAX", "name": "Los Angeles, USA"},
        {"code": "LHR", "name": "London, UK"},
        {"code": "JFK", "name": "New York, USA"},
        {"code": "MCO", "name": "Orlando, USA"},
        {"code": "MIA", "name": "Miami, USA"},
        {"code": "ORD", "name": "Chicago, USA"},
        {"code": "PDX", "name": "Portland, USA"},
        {"code": "PHX", "name": "Phoenix, USA"},
        {"code": "SAN", "name": "San Diego, USA"},
        {"code": "SEA", "name": "Seattle, USA"},
        {"code": "SFO", "name": "San Francisco, USA"},
        {"code": "YYZ", "name": "Toronto, Canada"},
    ]
    return jsonify(common_airports)

if __name__ == '__main__':
    # Make sure templates folder exists
    os.makedirs('templates', exist_ok=True)
    # Make sure static folder exists
    os.makedirs('static', exist_ok=True)
    app.run(debug=True, port=8080) 