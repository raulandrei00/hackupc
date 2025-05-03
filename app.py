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
        chat_history = data.get('chat_history', [])
        
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
        
        # Format chat history for context (excluding the current message)
        chat_context = ""
        if len(chat_history) > 1:  # If there's previous conversation
            chat_context = "PREVIOUS CONVERSATION:\n"
            # Include up to the last 5 exchanges (10 messages) to avoid making prompt too long
            history_to_include = chat_history[:-1] if len(chat_history) > 1 else []
            if len(history_to_include) > 10:
                history_to_include = history_to_include[-10:]
            
            for entry in history_to_include:
                role = "User" if entry.get('role') == 'user' else "Assistant"
                content = entry.get('content', '')
                chat_context += f"{role}: {content}\n\n"

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

{chat_context}
USER QUESTION:
{message}

Provide helpful travel advice based on this information. If you suggest specific destinations, use the standard 3-letter airport codes (like LAX, JFK, etc.) and explain why they might work well for this group.

IMPORTANT: In your response, ALWAYS include a section titled "DESTINATIONS TO AVOID:" followed by at least 2-3 destinations that would NOT be suitable for this group based on their preferences. For each destination to avoid, include the airport code and explain why it should be avoided.

Format your response like this:
[Your main advice and recommendations]

DESTINATIONS TO AVOID:
- AAA: Reason why this destination should be avoided
- BBB: Reason why this destination should be avoided
- CCC: Reason why this destination should be avoided

Remember:
1. Consider the origins of all travelers when making recommendations
2. Take into account each traveler's destination preferences when suggesting options
3. Be specific and personalized in your advice
4. If appropriate, suggest additional destinations that might work well for this group
5. Be conversational and friendly
6. Reference previous parts of the conversation when relevant
7. ALWAYS include the "DESTINATIONS TO AVOID:" section with at least 2-3 destinations"""

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
            print(f"Error type: {type(e).__name__}")
            print(f"Error details: {e}")
            import traceback
            traceback.print_exc()
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

DESTINATIONS TO AVOID:
- Las Vegas (LAS): might be too hot during your travel dates
- New York (JFK): could be overcrowded and expensive during this period
- Boston (BOS): weather might not be ideal depending on your travel date

[Note: This is a mock response as the AI API experienced an error: {str(e)}]"""

        # Extract destination recommendations from the assistant's message
        # Look for airport codes in the response (3 uppercase letters)
        airport_code_regex = r'\b([A-Z]{3})\b'
        suggested_airports = list(set(re.findall(airport_code_regex, assistant_message)))
        
        # Generate a rating for each suggested destination (4-5 for explicitly recommended ones)
        destination_recommendations = {}
        destinations_to_avoid = {}
        
        # Analyze the message for destinations to recommend vs avoid
        
        # Positive recommendation patterns
        recommendation_phrases = [
            r'recommend ([A-Z]{3})',
            r'suggest ([A-Z]{3})',
            r'([A-Z]{3}) would be',
            r'([A-Z]{3}) is a good',
            r'([A-Z]{3}) is great',
            r'consider ([A-Z]{3})',
            r'([A-Z]{3}) is recommended',
            r'([A-Z]{3}) would work well'
        ]
        
        # Negative recommendation patterns
        avoid_phrases = [
            r'avoid ([A-Z]{3})',
            r'not recommend ([A-Z]{3})',
            r'skip ([A-Z]{3})',
            r'([A-Z]{3}) would not be',
            r'([A-Z]{3}) is not a good',
            r'([A-Z]{3}) should be avoided',
            r'([A-Z]{3}) might be too',
            r'([A-Z]{3}) could be problematic',
            r'([A-Z]{3}) would be expensive',
            r'([A-Z]{3}) is crowded',
            r'([A-Z]{3}) is not suitable'
        ]
        
        # Check each airport code found in the message
        for airport in suggested_airports:
            # Default to a neutral rating
            rating = 3
            is_recommended = False
            is_avoided = False
            
            # Check if it's explicitly recommended
            for pattern in recommendation_phrases:
                matches = re.findall(pattern, assistant_message, re.IGNORECASE)
                if any(match.upper() == airport for match in matches):
                    rating = 5
                    is_recommended = True
                    break
                elif airport in assistant_message.split("\n")[0:5]:  # Mentioned early in response
                    rating = 4
                    is_recommended = True
            
            # Check if it's explicitly to be avoided
            for pattern in avoid_phrases:
                matches = re.findall(pattern, assistant_message, re.IGNORECASE)
                if any(match.upper() == airport for match in matches):
                    rating = -3
                    is_avoided = True
                    break
            
            # Also check if it appears in a section about avoiding
            avoid_section_match = re.search(r'(?:destinations|places) to avoid:.*?(?:\n\n|\Z)', 
                                           assistant_message, re.IGNORECASE | re.DOTALL)
            if avoid_section_match and airport in avoid_section_match.group(0):
                rating = -3
                is_avoided = True
            
            # Add to appropriate category
            if is_avoided:
                destinations_to_avoid[airport] = rating
            elif is_recommended or not is_avoided:
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
        
        # NEW CODE: Analyze user message for sentiment about destinations and suggest modifications
        preference_modifications = []
        
        # Get existing preferred destinations from general preferences
        existing_destinations = {}
        print("Current general preferences:")
        for pref in general_preferences:
            if pref.get('type') == 'preferred_destination':
                # Normalize airport code to uppercase
                airport_code = pref.get('value', '').strip().upper()
                rating = pref.get('rating', 3)
                existing_destinations[airport_code] = rating
                print(f"- {airport_code}: rating {rating}")
        
        print(f"Found {len(existing_destinations)} existing destination preferences")
        
        # Look for positive sentiment patterns about destinations
        positive_patterns = [
            r'I like ([A-Z]{3})',
            r'I love ([A-Z]{3})',
            r'([A-Z]{3}) sounds? good',
            r'([A-Z]{3}) sounds? great',
            r'([A-Z]{3}) sounds? perfect',
            r'interested in ([A-Z]{3})',
            r'prefer ([A-Z]{3})'
        ]
        
        # Look for negative sentiment patterns about destinations
        negative_patterns = [
            r'I don\'?t like ([A-Z]{3})',
            r'I hate ([A-Z]{3})',
            r'([A-Z]{3}) is bad',
            r'([A-Z]{3}) is terrible',
            r'not interested in ([A-Z]{3})',
            r'avoid ([A-Z]{3})',
            r'don\'?t want ([A-Z]{3})'
        ]
        
        # Process positive sentiment
        for pattern in positive_patterns:
            matches = re.findall(pattern, message)
            for airport in matches:
                # Normalize the airport code (ensure uppercase)
                airport = airport.strip().upper()
                
                # If this is an existing preference, increase the rating (max 5)
                if airport in existing_destinations:
                    print(f"Modifying existing preference for {airport} (positive)")
                    current_rating = existing_destinations[airport]
                    new_rating = min(5, current_rating + 1)  # Increase by 1, max 5
                    
                    preference_modifications.append({
                        'type': 'preferred_destination',
                        'value': airport,
                        'rating': new_rating,
                        'sentiment': 'positive'
                    })
                # If this is a new preference, add it with rating 4
                else:
                    print(f"Adding new preference for {airport} (positive)")
                    preference_modifications.append({
                        'type': 'preferred_destination',
                        'value': airport,
                        'rating': 4,
                        'sentiment': 'positive'
                    })
        
        # Process negative sentiment
        for pattern in negative_patterns:
            matches = re.findall(pattern, message)
            for airport in matches:
                # Normalize the airport code (ensure uppercase)
                airport = airport.strip().upper()
                
                # If this is an existing preference, decrease the rating (min -5 for strong negative)
                if airport in existing_destinations:
                    print(f"Modifying existing preference for {airport} (negative)")
                    current_rating = existing_destinations[airport]
                    new_rating = max(-5, current_rating - 2)  # Decrease by 2, min -5
                    
                    preference_modifications.append({
                        'type': 'preferred_destination',
                        'value': airport,
                        'rating': new_rating,
                        'sentiment': 'negative'
                    })
                # If this is a new preference, add it with negative rating
                else:
                    print(f"Adding new preference for {airport} (negative)")
                    preference_modifications.append({
                        'type': 'preferred_destination',
                        'value': airport,
                        'rating': -3,
                        'sentiment': 'negative'
                    })

        return jsonify({
            'status': 'success',
            'message': assistant_message,
            'destination_recommendations': destination_recommendations,
            'destinations_to_avoid': destinations_to_avoid,
            'general_preference_suggestions': general_preference_suggestions,
            'preference_modifications': preference_modifications
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
            max_results_per_route=1,
            general_preferences=general_preferences
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