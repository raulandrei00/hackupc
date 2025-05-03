from flask import Flask, render_template, request, jsonify
import os
import json
from datetime import datetime
from travel_planner import Traveler, find_optimal_destinations, print_destinations

app = Flask(__name__)

@app.route('/')
def index():
    """Render the main page."""
    return render_template('index.html')

@app.route('/api/find-destinations', methods=['POST'])
def find_destinations():
    """API endpoint to find optimal destinations."""
    try:
        data = request.json
        
        # Extract data from request
        travelers_data = data.get('travelers', [])
        candidate_destinations = data.get('destinations', [])
        travel_date = data.get('travelDate')
        cost_weight = float(data.get('costWeight', 0.7))
        emissions_weight = float(data.get('emissionsWeight', 0.3))
        
        # Validate data
        if not travelers_data or not candidate_destinations or not travel_date:
            return jsonify({'error': 'Missing required data'}), 400
            
        # Create Traveler objects
        travelers = [Traveler(t['name'], t['origin']) for t in travelers_data]
        
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