# PowerShell script to run the travel planner with real API
# Make sure to edit set_api_key.ps1 with your actual API key first

# Set the API key
Write-Host "Setting up API key..."
. .\set_api_key.ps1

# Run the travel planner
Write-Host "Running travel planner with real Skyscanner API..."
python travel_planner.py

Write-Host "Done!" 