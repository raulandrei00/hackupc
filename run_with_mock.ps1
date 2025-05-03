# PowerShell script to run the travel planner with mock data

# Set a dummy API key to force mock mode
$env:SKYSCANNER_API_KEY="dummy_key"

Write-Host "Running travel planner with mock data..."
python travel_planner.py

Write-Host "Done!" 