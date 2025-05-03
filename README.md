# Travel Reunion Planner

A Python tool that helps groups of friends find optimal meeting destinations by analyzing flight costs and CO₂ emissions from multiple origins.

## Overview

This tool takes a list of travelers from different origins and evaluates potential destinations based on:
- Total group flight cost
- Average cost per person
- Total CO₂ emissions
- Flight availability for all travelers

The result is a ranked list of recommended destinations where the whole group can meet.

## Features

- Analyze multiple potential destinations for a group of travelers
- Calculate total and per-person costs for each destination
- Consider environmental impact through CO₂ emissions tracking
- Customizable weighting between cost and emissions factors
- Handles cases where travelers are already at the destination
- Concurrent processing of destinations for improved performance

## Requirements

- Python 3.7+
- Required packages:
  - requests
  - Other standard library packages

## Installation

1. Clone this repository
2. Install required packages:
```
pip install requests
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

1. Update the `travelers` list with real names and airport codes
2. Modify the `candidate_destinations` list as needed
3. Set the desired `travel_date`
4. Run the script:
```
python travel_planner.py
```

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
    cost_weight=0.7,
    emissions_weight=0.3
)

# Print results
print_destinations(optimal_destinations, top_n=5)
```

## Customization

You can customize the behavior by adjusting these parameters:

- `cost_weight` and `emissions_weight`: Control how much each factor influences the final ranking (should sum to 1.0)
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

## License

MIT 