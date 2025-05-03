# Travel Reunion Planner

A Python tool that helps groups of friends find optimal meeting destinations by analyzing flight costs and CO₂ emissions from multiple origins.

## Overview

This tool takes a list of travelers from different origins and evaluates potential destinations based on:
- Total group flight cost
- Average cost per person
- Total CO₂ emissions
- Flight availability for all travelers
- Traveler destination preferences

The result is a ranked list of recommended destinations where the whole group can meet.

## Features

- Analyze multiple potential destinations for a group of travelers
- Calculate total and per-person costs for each destination
- Consider environmental impact through CO₂ emissions tracking
- Customizable weighting between cost, emissions, and preference factors
- Allow travelers to rate destinations on a 1-5 scale to influence recommendations
- Handles cases where travelers are already at the destination
- Concurrent processing of destinations for improved performance
- Web interface to easily plan your reunion
- Interactive weight sliders to control the balance between factors

## Requirements

- Python 3.7+
- Required packages:
  - requests
  - flask
  - Other standard library packages

## Installation

1. Clone this repository
2. Install required packages:
```
pip install requests flask
```

## Configuration

The script can be run with mock data (default) or with a real Skyscanner API key:

1. To use the mock data (for testing/demo):
   - Run the script as-is with `mock_api=True` (default setting)

2. To use the real Skyscanner API:
   - Sign up for a [Skyscanner API key](https://rapidapi.com/skyscanner/api/skyscanner-flight-search)
   - Set your API key as an environment variable:
     ```
     export SKYSCANNER_API_KEY="your_api_key_here"
     ```
   - Or modify the script to provide your API key directly
   - Set `mock_api=False` when calling `find_optimal_destinations()`

## Usage

### Command Line

1. Update the `travelers` list with real names and airport codes
2. Modify the `candidate_destinations` list as needed
3. Set the desired `travel_date`
4. Run the script:
```
python travel_planner.py
```

### Web Interface

1. Start the web server:
```
python app.py
```

2. Open your browser to http://127.0.0.1:8080
3. Add travelers, select destination options, and adjust weight sliders
4. Click "Find Best Destinations" to see results

### Example

```python
# Define travelers
travelers = [
    Traveler("Alice", "JFK"),   # New York
    Traveler("Bob", "LAX"),     # Los Angeles
    Traveler("Charlie", "ORD"), # Chicago
]

# Define candidate destinations
candidate_destinations = [
    "LAS",  # Las Vegas
    "DEN",  # Denver
    "SFO",  # San Francisco
]

# Set travel date (YYYY-MM-DD format)
travel_date = "2023-12-15"

# Find optimal destinations
optimal_destinations = find_optimal_destinations(
    travelers=travelers,
    candidate_destinations=candidate_destinations,
    travel_date=travel_date,
    api_key=API_KEY,
    mock_api=True,
    cost_weight=0.6,
    emissions_weight=0.2,
    preference_weight=0.2
)

# Print results
print_destinations(optimal_destinations, top_n=5)
```

## Customization

You can customize the behavior by adjusting these parameters:

- `cost_weight`, `emissions_weight`, and `preference_weight`: Control how much each factor influences the final ranking 
- `max_results_per_route`: Number of flight options to consider per route
- `max_workers`: Number of concurrent API requests for better performance
- `top_n`: Number of top destinations to display in results

## Mock Data

When running with `mock_api=True`, the system generates realistic flight data based on:
- Distance approximation using airport codes
- Randomly assigned airlines
- Realistic price variations
- Simulated flight durations and emissions

About 10% of routes will be randomly unavailable to simulate real-world limitations.

## Roadmap

### TO DO - Future Features

- Real API integration for flights instead of mock data
- Enhanced preference system for travelers to prioritize destinations
- ChatGPT wrapper with social features for trip planning
- Booking API or hotel integration
- Google Maps integration to show destinations and nearby attractions
- Additional filters for flight duration and travel time
- Add Mumbai as a highlighted destination (Mumbai bias)

### TO DO IF WE HAVE TIME AND WE THINK WE ARE THE PULA

- Handle connecting flights and consider stopovers for a limited time
- Dynamically adjust preferences based on feedback from the ChatGPT wrapper
- Advanced visualization of travel options and cost breakdown
- Mobile app version for on-the-go planning

## License

MIT 