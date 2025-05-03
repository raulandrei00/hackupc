from flask import Flask, render_template, request, jsonify, session
import os
import json
from datetime import datetime
from travel_planner import Traveler, find_optimal_destinations, print_destinations
import google.generativeai as genai
from dotenv import load_dotenv
import re
import uuid
from typing import Dict, List, Tuple, Optional, Any, Union

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
app.secret_key = os.urandom(24)  # Generate a random secret key for sessions

# Dictionary to store chat histories by session ID
chat_histories = {}

# Add preference stores to keep track of preferences
# These would ideally be in a database, but we'll use in-memory for now
individual_preferences = {}  # user_id -> {(category, key): rating}
group_preferences = {}       # {(category, key): average_rating}

# Reference data for categorization
AIRLINES = {
    "delta": "DL",
    "american": "AA", 
    "united": "UA",
    "southwest": "WN",
    "jetblue": "B6",
    "alaska": "AS",
    "spirit": "NK",
    "frontier": "F9",
    "lufthansa": "LH",
    "british airways": "BA",
    "air france": "AF",
    "klm": "KL",
    "emirates": "EK",
    "singapore airlines": "SQ"
}

HOTEL_CHAINS = [
    "marriott", "hilton", "hyatt", "ihg", "choice", "wyndham", 
    "best western", "accor", "radisson", "four seasons", "ritz-carlton"
]

ACTIVITIES = [
    "beach", "museum", "hiking", "shopping", "sightseeing", "food", 
    "nightlife", "adventure", "relaxation", "culture", "history", 
    "nature", "theme park", "water sports", "skiing"
]

PACE_KEYWORDS = [
    "slow", "relaxed", "fast", "busy", "packed", "leisurely", 
    "hectic", "rushed", "chill", "intense"
]

def resolve_preference(token: str, context: str = "") -> List[Dict[str, Any]]:
    """
    Identify the category and key for a preference token.
    
    Args:
        token: The text token that contains the preference
        context: Additional context to help categorize
        
    Returns:
        List of dicts with category, key pairs
    """
    token = token.strip().lower()
    results = []
    
    # Check if it's an airport/destination (3-letter code)
    airport_match = re.search(r'\b([A-Z]{3})\b', token, re.IGNORECASE)
    if airport_match:
        results.append({
            "category": "destination",
            "key": airport_match.group(1).upper(),
            "original": token
        })
        return results
    
    # Check for airlines
    for airline, code in AIRLINES.items():
        if airline.lower() in token.lower():
            results.append({
                "category": "airline",
                "key": code,
                "original": airline
            })
            return results
    
    # Check for hotel chains
    for hotel in HOTEL_CHAINS:
        if hotel.lower() in token.lower():
            results.append({
                "category": "hotel",
                "key": hotel.title(),
                "original": token
            })
            return results
    
    # Check for activities
    for activity in ACTIVITIES:
        if activity.lower() in token.lower():
            results.append({
                "category": "activity",
                "key": activity.title(),
                "original": token
            })
            return results
    
    # Check for budget mentions
    budget_match = re.search(r'(?:under|around|at least|max|maximum)\s*\$?(\d+)(?:/night)?', token, re.IGNORECASE)
    if budget_match:
        amount = int(budget_match.group(1))
        results.append({
            "category": "budget",
            "key": f"${amount}",
            "original": token,
            "value": amount
        })
        return results
    
    # Check for pace preferences
    for pace in PACE_KEYWORDS:
        if pace.lower() in token.lower():
            results.append({
                "category": "pace",
                "key": pace.title(),
                "original": token
            })
            return results
    
    # If no specific category detected, use a general preference
    if token:
        results.append({
            "category": "general",
            "key": token.title(),
            "original": token
        })
    
    return results

def detect_preferences(message: str) -> List[Dict[str, Any]]:
    """
    Detect preferences in a user message.
    
    Args:
        message: The user message to analyze
        
    Returns:
        List of preference modifications as dictionaries
    """
    modifications = []
    
    # Negative patterns (avoid, dislike)
    negative_patterns = [
        r"don'?t (?:want to go to|like|use|stay at|ride|enjoy) (.+)",
        r"avoid (.+)",
        r"hate (.+)",
        r"not interested in (.+)",
        r"dislike (.+)",
        r"no (.+)"
    ]
    
    # Positive patterns (like, prefer)
    positive_patterns = [
        r"(?:really |definitely |absolutely )?(?:love|like|enjoy|prefer) (.+)",
        r"interested in (.+)",
        r"want to (?:go to|visit|see|experience) (.+)",
        r"(?:plan|hope) to (?:visit|see|go to) (.+)"
    ]
    
    # Check negative patterns
    for pattern in negative_patterns:
        for match in re.finditer(pattern, message, re.IGNORECASE):
            token = match.group(1).strip()
            prefs = resolve_preference(token, message)
            for pref in prefs:
                modifications.append({
                    "category": pref["category"],
                    "key": pref["key"],
                    "rating_delta": -3,  # Negative sentiment
                    "original": pref["original"]
                })
    
    # Check positive patterns
    for pattern in positive_patterns:
        for match in re.finditer(pattern, message, re.IGNORECASE):
            token = match.group(1).strip()
            prefs = resolve_preference(token, message)
            for pref in prefs:
                modifications.append({
                    "category": pref["category"],
                    "key": pref["key"],
                    "rating_delta": 3,  # Positive sentiment
                    "original": pref["original"]
                })
    
    # Look for airport codes with explicit sentiment
    airport_patterns = [
        (r"I (?:do not|don'?t) (?:like|want|prefer) ([A-Z]{3})", -3),  # Negative
        (r"I (?:like|love|prefer|want) ([A-Z]{3})", 3)                 # Positive
    ]
    
    for pattern, rating in airport_patterns:
        for match in re.finditer(pattern, message):
            airport = match.group(1).upper()
            modifications.append({
                "category": "destination",
                "key": airport,
                "rating_delta": rating,
                "original": airport
            })
    
    return modifications

def update_preferences(user_id: str, modifications: List[Dict[str, Any]]) -> Dict[str, Any]:
    """
    Update individual and group preferences based on modifications.
    
    Args:
        user_id: Identifier for the user
        modifications: List of preference modifications
        
    Returns:
        Dictionary with updated preferences
    """
    if user_id not in individual_preferences:
        individual_preferences[user_id] = {}
    
    applied_modifications = []
    
    for mod in modifications:
        category = mod["category"]
        key = mod["key"]
        delta = mod["rating_delta"]
        
        # Update individual preference - use string key instead of tuple
        pref_key = f"{category}:{key}"
        current = individual_preferences[user_id].get(pref_key, 0)
        new_rating = max(-5, min(5, current + delta))  # Clamp to [-5, +5]
        individual_preferences[user_id][pref_key] = new_rating
        
        # Record the applied modification
        applied_modifications.append({
            "category": category,
            "key": key,
            "previous_rating": current,
            "new_rating": new_rating,
            "original": mod.get("original", key)
        })
        
        # Recalculate group preference for this key
        total = 0
        count = 0
        for user_prefs in individual_preferences.values():
            if pref_key in user_prefs:
                total += user_prefs[pref_key]
                count += 1
        
        if count > 0:
            group_preferences[pref_key] = total / count
    
    return {
        "user_id": user_id,
        "modifications": applied_modifications,
        "individual_preferences": individual_preferences[user_id],
        "group_preferences": group_preferences
    }

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
        client_chat_history = data.get('chat_history', [])
        
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
        
        # Detect preferences in the user message
        preference_modifications = detect_preferences(message)
        
        # Update preferences if any were detected
        preference_updates = None
        if preference_modifications:
            preference_updates = update_preferences(session_id, preference_modifications)
            print(f"Updated preferences for user {session_id}: {len(preference_modifications)} modifications")
        
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
        
        # Add detected preferences to general_pref_info
        if preference_updates and preference_updates["modifications"]:
            general_pref_info += "\nNEWLY DETECTED PREFERENCES:\n"
            for mod in preference_updates["modifications"]:
                sentiment = "Positive" if mod["new_rating"] > 0 else "Negative"
                general_pref_info += f"- {mod['category'].title()}: {mod['original']} " + \
                                    f"(Rating: {mod['new_rating']}/5, {sentiment})\n"
        
        # Format destination options
        destination_info = ", ".join(destinations) if destinations else "Not specified"
        
        # Format chat history for context (excluding the current message)
        chat_context = ""
        if len(server_chat_history) > 1:  # If there's previous conversation
            chat_context = "PREVIOUS CONVERSATION:\n"
            # Include up to the last 5 exchanges (10 messages) to avoid making prompt too long
            history_to_include = server_chat_history[:-1] if len(server_chat_history) > 1 else []
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

RECOMMENDED DESTINATIONS:
- AAA: Reason why this destination is recommended
- BBB: Reason why this destination is recommended
- CCC: Reason why this destination is recommended

DESTINATIONS TO AVOID:
- DDD: Reason why this destination should be avoided
- EEE: Reason why this destination should be avoided
- FFF: Reason why this destination should be avoided

PREFERENCE BREAKDOWN:
For each destination, provide:
- Base Score: Based on cost and emissions
- Group Preference: The average preference of all users
- Individual Preference: This user's specific preference
- Combined Score: The weighted score with all factors

Remember:
1. Consider the origins of all travelers when making recommendations
2. Take into account each traveler's destination preferences when suggesting options
3. Be specific and personalized in your advice
4. Always include both sections: "RECOMMENDED DESTINATIONS:" and "DESTINATIONS TO AVOID:"
5. Be conversational and friendly
6. Reference previous parts of the conversation when relevant"""

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

RECOMMENDED DESTINATIONS:
- ORD: Chicago is a central meeting point with good flight connections from most cities
- MIA: Miami offers warm weather and good flight options from major cities
- DEN: Denver provides a mountain getaway with direct flights from many cities

DESTINATIONS TO AVOID:
- LAS: Las Vegas might be too hot during your travel dates
- JFK: New York could be overcrowded and expensive during this period
- BOS: Boston's weather might not be ideal depending on your travel date

PREFERENCE BREAKDOWN:
For ORD (Chicago):
- Base Score: 82/100 (Good flight connections, moderate costs)
- Group Preference: +2.5 (Generally liked by the group)
- Individual Preference: +1.0 (Somewhat liked by you)
- Combined Score: 85.5/100

[Note: This is a mock response as the AI API experienced an error: {str(e)}]"""

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

        # Extract recommended destinations from the assistant's message
        recommended_destinations = {}
        destinations_to_avoid = {}
        
        # Extract recommended destinations section
        recommended_section_match = re.search(r'RECOMMENDED DESTINATIONS:(.*?)(?:DESTINATIONS TO AVOID|\Z)', 
                                         assistant_message, re.IGNORECASE | re.DOTALL)
        
        # Extract destinations to avoid section
        avoid_section_match = re.search(r'DESTINATIONS TO AVOID:(.*?)(?:\n\n|\Z)', 
                                    assistant_message, re.IGNORECASE | re.DOTALL)
        
        # Parse the recommended destinations
        if recommended_section_match:
            recommended_text = recommended_section_match.group(1).strip()
            # Look for airport codes with ratings/explanations
            for line in recommended_text.split('\n'):
                airport_match = re.search(r'\b([A-Z]{3})\b', line)
                if airport_match:
                    airport_code = airport_match.group(1)
                    # Rate 4-5 based on position and emphasis in text
                    rating = 5 if re.search(r'highly|recommend|great|perfect|excellent', line, re.IGNORECASE) else 4
                    recommended_destinations[airport_code] = rating
        else:
            # Fallback: look for airport codes in the entire message with positive context
            positive_pattern = r'recommend\s+(?:.*?)\b([A-Z]{3})\b|suggest\s+(?:.*?)\b([A-Z]{3})\b|\b([A-Z]{3})\b\s+would be good'
            positive_matches = re.finditer(positive_pattern, assistant_message, re.IGNORECASE)
            for match in positive_matches:
                airport_code = next(code for code in match.groups() if code)
                recommended_destinations[airport_code] = 4
                
        # Parse the destinations to avoid
        if avoid_section_match:
            avoid_text = avoid_section_match.group(1).strip()
            # Look for airport codes
            for line in avoid_text.split('\n'):
                airport_match = re.search(r'\b([A-Z]{3})\b', line)
                if airport_match:
                    airport_code = airport_match.group(1)
                    # Rate -3 to -5 based on emphasis in text
                    rating = -5 if re.search(r'strongly|avoid|terrible|worst|never', line, re.IGNORECASE) else -3
                    destinations_to_avoid[airport_code] = rating
        else:
            # Fallback: look for airport codes with negative context
            negative_pattern = r'avoid\s+(?:.*?)\b([A-Z]{3})\b|not recommend\s+(?:.*?)\b([A-Z]{3})\b|\b([A-Z]{3})\b\s+would not be'
            negative_matches = re.finditer(negative_pattern, assistant_message, re.IGNORECASE)
            for match in negative_matches:
                airport_code = next(code for code in match.groups() if code)
                destinations_to_avoid[airport_code] = -3

        # Extract score breakdowns if available
        score_breakdowns = {}
        breakdown_pattern = r'For\s+([A-Z]{3}).*?Base Score:\s*([\d.]+).*?Group Preference:\s*([-+]?[\d.]+).*?Individual Preference:\s*([-+]?[\d.]+).*?Combined Score:\s*([\d.]+)'
        breakdown_matches = re.finditer(breakdown_pattern, assistant_message, re.DOTALL | re.IGNORECASE)
        
        for match in breakdown_matches:
            airport = match.group(1)
            score_breakdowns[airport] = {
                "base_score": float(match.group(2)),
                "group_preference": float(match.group(3)),
                "individual_preference": float(match.group(4)),
                "combined_score": float(match.group(5))
            }
        
        # Generate a rating for each suggested destination (4-5 for explicitly recommended ones)
        
        # Extract general preferences from the response
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
            
        # Format the preference modifications for client-side updates
        client_preference_updates = []
        if preference_updates and preference_updates["modifications"]:
            for mod in preference_updates["modifications"]:
                if mod["category"] == "destination":
                    client_preference_updates.append({
                        'type': 'preferred_destination',
                        'value': mod["key"],
                        'rating': mod["new_rating"],
                        'sentiment': 'positive' if mod["new_rating"] > 0 else 'negative'
                    })
                elif mod["category"] == "airline":
                    client_preference_updates.append({
                        'type': 'airline',
                        'value': mod["original"],
                        'rating': mod["new_rating"]
                    })
                else:
                    client_preference_updates.append({
                        'type': mod["category"],
                        'value': mod["original"],
                        'rating': mod["new_rating"]
                    })

        print(f"Returning: {len(recommended_destinations)} recommended destinations, {len(destinations_to_avoid)} destinations to avoid")
        response = jsonify({
            'status': 'success',
            'message': assistant_message,
            'destination_recommendations': recommended_destinations,
            'destinations_to_avoid': destinations_to_avoid,
            'general_preference_suggestions': general_preference_suggestions,
            'preference_modifications': client_preference_updates,
            'chat_history': server_chat_history,
            'preference_updates': preference_updates,
            'score_breakdowns': score_breakdowns,
            'action': 'update_preferences',
            'user_id': session_id
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
        general_preferences = data.get('generalPreferences', [])
        
        # Get user ID for preference lookup
        session_id = request.cookies.get('session_id')
        
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
        
        # Build external preference store
        external_preference_store = {
            'individual': individual_preferences,
            'group': group_preferences
        }
        
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
            general_preferences=general_preferences,
            user_id=session_id,
            external_preference_store=external_preference_store
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
            
            result = {
                'destination': dest.destination_code,
                'total_cost': dest.total_cost,
                'average_cost': dest.average_cost,
                'total_emissions': dest.total_emissions,
                'score': dest.score,
                'flight_plans': flight_plans
            }
            
            # Add score breakdowns if available
            if hasattr(dest, 'score_breakdowns') and dest.score_breakdowns:
                result['score_breakdowns'] = dest.score_breakdowns
                
            results.append(result)
            
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