# Setting Up Skyscanner API

To use the real Skyscanner API instead of the mock data:

## 1. Get a Skyscanner API Key

1. Create an account on [RapidAPI](https://rapidapi.com/)
2. Search for "Skyscanner Flight Search" API
3. Subscribe to the API (they have a free tier with limited requests)
4. Copy your API key from the dashboard

## 2. Set Your API Key

### Windows (PowerShell):
```powershell
$env:SKYSCANNER_API_KEY="your_api_key_here"
```

### Windows (Command Prompt):
```cmd
set SKYSCANNER_API_KEY=your_api_key_here
```

### macOS/Linux:
```bash
export SKYSCANNER_API_KEY="your_api_key_here"
```

## 3. Modify the Code to Use Real API

Open `travel_planner.py` and find the following line in the `main()` function:

```python
# Find optimal destinations
optimal_destinations = find_optimal_destinations(
    travelers=travelers,
    candidate_destinations=candidate_destinations,
    travel_date=travel_date,
    api_key=API_KEY,
    mock_api=True,  # Use mock API by default
    cost_weight=0.7,
    emissions_weight=0.3,
    max_results_per_route=1
)
```

Change `mock_api=True` to `mock_api=False` to use the real API:

```python
    mock_api=False,  # Use real Skyscanner API
```

## 4. Run the Script

```
python travel_planner.py
```

## Important Notes:

1. The free tier on RapidAPI usually has limits on the number of API calls
2. Make sure your API implementation matches the current Skyscanner API structure
3. Update the `_process_api_response` method in the `SkyscannerAPI` class if needed to correctly parse the real API response

## Troubleshooting:

If you encounter API errors:
1. Check your API key is correctly set
2. Verify you haven't exceeded the rate limits
3. Check the Skyscanner API documentation for any endpoint changes
4. Look at the error logs for specific error messages 