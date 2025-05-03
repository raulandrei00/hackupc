"""
Skyscanner-based Travel Reunion Planner

This script helps find optimal meeting destinations for friends traveling from different
origins by analyzing flight costs and other metrics.
"""

import requests
import json
from dataclasses import dataclass, field
from typing import List, Dict, Optional, Tuple, Any
from datetime import datetime, timedelta
import os
import logging
from concurrent.futures import ThreadPoolExecutor
from functools import partial
import time

# Configure logging
logging.basicConfig(
    level=logging.INFO,
    format='%(asctime)s - %(name)s - %(levelname)s - %(message)s'
)
logger = logging.getLogger(__name__)

# ----- Data Models -----

@dataclass
class Traveler:
    """Represents a traveler with name and origin airport."""
    name: str
    origin: str  # IATA airport code


@dataclass
class FlightInfo:
    """Details about a specific flight."""
    price: float
    airline: str
    departure_time: datetime
    arrival_time: datetime
    duration_minutes: int
    emissions_kg: Optional[float] = None
    flight_number: Optional[str] = None
    deep_link: Optional[str] = None


@dataclass
class TravelerFlightPlan:
    """Flight plan for a specific traveler to a destination."""
    traveler: Traveler
    flight: FlightInfo


@dataclass
class DestinationScore:
    """Aggregated data and scores for a potential destination."""
    destination_code: str
    total_cost: float
    average_cost: float
    total_emissions: float
    flight_plans: List[TravelerFlightPlan] = field(default_factory=list)
    score: float = float('inf')  # Lower is better


# ----- API Integration -----

class SkyscannerAPI:
    """
    Handles interactions with the Skyscanner API.
    
    If MOCK_API_RESPONSES is True, returns mock data instead of making real API calls.
    """
    
    # Alternative endpoint options to try
    BASE_URL = "https://skyscanner-api.p.rapidapi.com"
    
    def __init__(self, api_key: str, mock: bool = False):
        self.api_key = api_key
        self.mock = mock
        self.headers = {
            'x-rapidapi-key': api_key,
            'x-rapidapi-host': "skyscanner-api.p.rapidapi.com"
        }
    
    def search_flights(self, origin: str, destination: str, date: str, 
                       currency: str = "USD", max_results: int = 1) -> Optional[List[Dict]]:
        """
        Search for flights from origin to destination on a specific date.
        
        Args:
            origin: Origin airport IATA code
            destination: Destination airport IATA code
            date: Travel date in YYYY-MM-DD format
            currency: Currency for prices
            max_results: Maximum number of flight results to return
            
        Returns:
            List of flight information dictionaries or None if no flights found
        """
        if self.mock:
            return self._mock_flight_search(origin, destination, date, currency, max_results)
        
        # In a production environment, implement the real API call here
        max_retries = 3
        retry_delay = 2  # seconds
        
        for attempt in range(max_retries):
            try:
                # New API endpoint structure
                endpoint = f"{self.BASE_URL}/v3/flights/live/search/create"
                
                # Format request body for new API
                payload = {
                    "query": {
                        "market": "US",
                        "locale": "en-US",
                        "currency": currency,
                        "queryLegs": [
                            {
                                "originPlaceId": {"iata": origin},
                                "destinationPlaceId": {"iata": destination},
                                "date": {
                                    "year": int(date.split('-')[0]),
                                    "month": int(date.split('-')[1]),
                                    "day": int(date.split('-')[2])
                                }
                            }
                        ],
                        "cabinClass": "CABIN_CLASS_ECONOMY",
                        "adults": 1,
                        "childrenAges": []
                    }
                }
                
                response = requests.post(
                    endpoint,
                    json=payload,
                    headers=self.headers
                )
                
                if response.status_code == 200:
                    data = response.json()
                    return self._process_api_response(data, max_results)
                elif response.status_code == 429:  # Too Many Requests
                    logger.warning(f"Rate limit hit (attempt {attempt+1}/{max_retries}): {response.text}")
                    if attempt < max_retries - 1:
                        wait_time = retry_delay * (2 ** attempt)  # Exponential backoff
                        logger.info(f"Waiting {wait_time} seconds before retry...")
                        time.sleep(wait_time)
                        continue
                    else:
                        logger.error(f"API rate limit exceeded after {max_retries} attempts")
                        return None
                else:
                    logger.error(f"API call failed with status code {response.status_code}: {response.text}")
                    return None
                    
            except Exception as e:
                logger.error(f"Error during API call: {str(e)}")
                return None
        
        return None
    
    def _process_api_response(self, data: Dict, max_results: int) -> List[Dict]:
        """Process the raw API response into a consistent format."""
        try:
            processed_flights = []
            
            # This implementation is based on the RapidAPI Skyscanner Flight Search structure
            # Check if we have quotes from the API
            if 'Quotes' not in data or not data['Quotes']:
                logger.warning("No quotes found in API response")
                return None
                
            quotes = data['Quotes'][:max_results]
            carriers = {carrier['CarrierId']: carrier['Name'] for carrier in data.get('Carriers', [])}
            places = {place['PlaceId']: place for place in data.get('Places', [])}
            
            for quote in quotes:
                if not quote.get('OutboundLeg'):
                    continue
                
                # Get carrier info
                carrier_ids = quote.get('OutboundLeg', {}).get('CarrierIds', [])
                carrier_name = carriers.get(carrier_ids[0], "Unknown Airline") if carrier_ids else "Unknown Airline"
                
                # Get departure and arrival details
                departure_place_id = quote.get('OutboundLeg', {}).get('OriginId')
                arrival_place_id = quote.get('OutboundLeg', {}).get('DestinationId')
                
                # Extract flight times - in a real implementation, you'd need to deal with actual timestamps
                departure_date = quote.get('OutboundLeg', {}).get('DepartureDate', '')
                
                if departure_date:
                    departure_time = datetime.fromisoformat(departure_date.replace('Z', '+00:00'))
                    # Estimate arrival time based on reasonable duration (this is a simplification)
                    # In a real implementation, you'd get this from the API
                    estimated_duration_minutes = 180  # Default to 3 hours
                    arrival_time = departure_time + datetime.timedelta(minutes=estimated_duration_minutes)
                else:
                    logger.warning("No departure date found for quote")
                    continue
                
                # Get price information
                price = quote.get('MinPrice', 0)
                currency = data.get('Currencies', [{}])[0].get('Code', 'USD') if data.get('Currencies') else 'USD'
                
                # In real implementation, these might be available in the API response
                # For now, we'll estimate them
                emissions_kg = 5.0  # Placeholder value
                flight_number = f"{carrier_name[:2]}{100 + hash(str(quote.get('QuoteId', 0))) % 900}"
                
                flight = {
                    "price": price,
                    "currency": currency,
                    "airline": carrier_name,
                    "departure_time": departure_time.isoformat(),
                    "arrival_time": arrival_time.isoformat(),
                    "duration_minutes": estimated_duration_minutes,
                    "emissions_kg": emissions_kg,
                    "flight_number": flight_number,
                    "deep_link": None  # Would come from a separate API call in Skyscanner
                }
                
                processed_flights.append(flight)
                
            return processed_flights
            
        except Exception as e:
            logger.error(f"Error processing API response: {str(e)}")
            logger.debug(f"Raw API data: {data}")
            return None
    
    def _mock_flight_search(self, origin: str, destination: str, date: str, 
                           currency: str, max_results: int) -> Optional[List[Dict]]:
        """Generate mock flight data for testing."""
        # Don't generate flights for ~10% of route combinations to simulate unavailable routes
        if hash(f"{origin}{destination}") % 10 == 0:
            return None
        
        # Parse the date for realistic mock data
        travel_date = datetime.strptime(date, "%Y-%m-%d")
        
        # Generate 1-3 flight options
        num_flights = min(max_results, 3)
        mock_flights = []
        
        for i in range(num_flights):
            # Generate reasonably realistic flight data
            # Base price affected by distance (approximated by summing IATA codes' ord values)
            base_distance_factor = sum(ord(c) for c in origin + destination) % 100
            price = 100 + base_distance_factor * 5 + (i * 50)  # Each subsequent option costs more
            
            # Generate realistic flight times
            departure_hour = 7 + (hash(f"{origin}{i}") % 12)  # Departures between 7 AM and 7 PM
            duration_minutes = 60 + (base_distance_factor * 4)  # Duration from 1h to ~7h
            
            departure_time = travel_date.replace(hour=departure_hour, minute=0)
            arrival_time = departure_time.replace(minute=duration_minutes % 60, 
                                                hour=departure_hour + duration_minutes // 60)
            
            # Generate airline (just for mock data)
            airlines = ["Delta", "United", "American", "Lufthansa", "British Airways", 
                        "Air France", "KLM", "Emirates", "Singapore Airlines"]
            airline = airlines[hash(f"{origin}{destination}{i}") % len(airlines)]
            
            # Generate emissions data
            emissions = (base_distance_factor / 10) * (1 + (hash(f"{origin}{destination}") % 5) / 10)
            
            flight = {
                "price": price,
                "currency": currency,
                "airline": airline,
                "departure_time": departure_time.isoformat(),
                "arrival_time": arrival_time.isoformat(),
                "duration_minutes": duration_minutes,
                "emissions_kg": emissions,
                "flight_number": f"{airline[:2]}{100 + (hash(f'{origin}{destination}') % 900)}",
                "deep_link": f"https://example.com/flights/{origin}-{destination}"
            }
            
            mock_flights.append(flight)
        
        return mock_flights


# ----- Business Logic -----

def find_optimal_destinations(
    travelers: List[Traveler],
    candidate_destinations: List[str],
    travel_date: str,
    api_key: str,
    max_results_per_route: int = 1,
    mock_api: bool = True,
    cost_weight: float = 0.8,
    emissions_weight: float = 0.2,
    max_workers: int = 5
) -> List[DestinationScore]:
    """
    Find the optimal destinations for a group of travelers.
    
    Args:
        travelers: List of Traveler objects with names and origins
        candidate_destinations: List of IATA codes for potential destinations
        travel_date: Date string in YYYY-MM-DD format
        api_key: Skyscanner API key
        max_results_per_route: Max number of flights to consider per route
        mock_api: Whether to use mock API responses
        cost_weight: Weight for cost in scoring (0-1)
        emissions_weight: Weight for emissions in scoring (0-1)
        max_workers: Maximum number of concurrent API requests
        
    Returns:
        List of DestinationScore objects for valid destinations, sorted by score
    """
    api = SkyscannerAPI(api_key, mock=mock_api)
    valid_destinations = []
    
    # Use ThreadPoolExecutor for concurrent API calls
    with ThreadPoolExecutor(max_workers=max_workers) as executor:
        process_destination_partial = partial(
            process_destination,
            travelers=travelers,
            travel_date=travel_date,
            api=api,
            max_results_per_route=max_results_per_route
        )
        
        # Map destinations to their processed results
        for result in executor.map(process_destination_partial, candidate_destinations):
            if result is not None:
                valid_destinations.append(result)
    
    # Calculate scores for ranking
    scored_destinations = calculate_scores(
        valid_destinations, cost_weight, emissions_weight
    )
    
    # Sort by score (lower is better)
    return sorted(scored_destinations, key=lambda d: d.score)


def process_destination(
    destination: str,
    travelers: List[Traveler],
    travel_date: str,
    api: SkyscannerAPI,
    max_results_per_route: int
) -> Optional[DestinationScore]:
    """
    Process a single destination for all travelers.
    
    Args:
        destination: IATA code of the destination
        travelers: List of travelers
        travel_date: Date string in YYYY-MM-DD format
        api: SkyscannerAPI instance
        max_results_per_route: Max number of flights to consider per route
        
    Returns:
        DestinationScore if all travelers can reach the destination, None otherwise
    """
    logger.info(f"Processing destination: {destination}")
    
    total_cost = 0
    total_emissions = 0
    flight_plans = []
    
    for traveler in travelers:
        # Skip if traveler's origin is the same as destination
        if traveler.origin == destination:
            logger.info(f"{traveler.name} is already at {destination}")
            flight_info = FlightInfo(
                price=0,
                airline="N/A",
                departure_time=datetime.strptime(f"{travel_date}T00:00:00", "%Y-%m-%dT%H:%M:%S"),
                arrival_time=datetime.strptime(f"{travel_date}T00:00:00", "%Y-%m-%dT%H:%M:%S"),
                duration_minutes=0,
                emissions_kg=0
            )
            flight_plans.append(TravelerFlightPlan(traveler, flight_info))
            continue
            
        # Search for flights
        flights = api.search_flights(
            traveler.origin, destination, travel_date, max_results=max_results_per_route
        )
        
        if not flights:
            logger.info(f"No flights found from {traveler.origin} to {destination} for {traveler.name}")
            return None
        
        # Take the cheapest flight
        cheapest_flight = min(flights, key=lambda f: f["price"])
        
        # Create flight info object
        flight_info = FlightInfo(
            price=cheapest_flight["price"],
            airline=cheapest_flight["airline"],
            departure_time=datetime.fromisoformat(cheapest_flight["departure_time"]),
            arrival_time=datetime.fromisoformat(cheapest_flight["arrival_time"]),
            duration_minutes=cheapest_flight["duration_minutes"],
            emissions_kg=cheapest_flight.get("emissions_kg"),
            flight_number=cheapest_flight.get("flight_number"),
            deep_link=cheapest_flight.get("deep_link")
        )
        
        # Add to totals
        total_cost += flight_info.price
        if flight_info.emissions_kg:
            total_emissions += flight_info.emissions_kg
        
        # Store the flight plan
        flight_plans.append(TravelerFlightPlan(traveler, flight_info))
    
    # Create destination score object
    return DestinationScore(
        destination_code=destination,
        total_cost=total_cost,
        average_cost=total_cost / len(travelers),
        total_emissions=total_emissions,
        flight_plans=flight_plans
    )


def calculate_scores(
    destinations: List[DestinationScore],
    cost_weight: float,
    emissions_weight: float
) -> List[DestinationScore]:
    """
    Calculate scores for destinations based on cost and emissions.
    
    Args:
        destinations: List of DestinationScore objects
        cost_weight: Weight for cost in scoring (0-1)
        emissions_weight: Weight for emissions in scoring (0-1)
        
    Returns:
        Updated list of DestinationScore objects with scores
    """
    if not destinations:
        return []
    
    # Find max and min values for normalization
    max_cost = max(d.total_cost for d in destinations)
    min_cost = min(d.total_cost for d in destinations)
    
    max_emissions = max(d.total_emissions for d in destinations)
    min_emissions = min(d.total_emissions for d in destinations)
    
    # Calculate normalized scores
    for destination in destinations:
        # Normalize cost (0-1 scale, lower is better)
        if max_cost > min_cost:
            norm_cost = (destination.total_cost - min_cost) / (max_cost - min_cost)
        else:
            norm_cost = 0
        
        # Normalize emissions (0-1 scale, lower is better)
        if max_emissions > min_emissions:
            norm_emissions = (destination.total_emissions - min_emissions) / (max_emissions - min_emissions)
        else:
            norm_emissions = 0
        
        # Calculate weighted score (lower is better)
        destination.score = (cost_weight * norm_cost) + (emissions_weight * norm_emissions)
    
    return destinations


def format_currency(amount: float) -> str:
    """Format amount as currency string."""
    return f"${amount:.2f}"


def format_datetime(dt: datetime) -> str:
    """Format datetime for display."""
    return dt.strftime("%Y-%m-%d %H:%M")


def print_destinations(destinations: List[DestinationScore], top_n: int = 5):
    """
    Print the top N destinations with their scores and flight details.
    
    Args:
        destinations: List of DestinationScore objects, sorted by score
        top_n: Number of top destinations to display
    """
    if not destinations:
        print("No valid destinations found.")
        return
    
    # Limit to top N
    destinations = destinations[:min(top_n, len(destinations))]
    
    print(f"\n{'=' * 80}")
    print(f"TOP {len(destinations)} REUNION DESTINATIONS")
    print(f"{'=' * 80}\n")
    
    for rank, destination in enumerate(destinations, 1):
        print(f"{rank}. DESTINATION: {destination.destination_code}")
        print(f"   Total Cost: {format_currency(destination.total_cost)}")
        print(f"   Average Cost Per Person: {format_currency(destination.average_cost)}")
        print(f"   Total CO₂ Emissions: {destination.total_emissions:.1f} kg")
        print(f"   Score (lower is better): {destination.score:.3f}")
        print("\n   FLIGHT DETAILS:")
        
        for flight_plan in destination.flight_plans:
            traveler = flight_plan.traveler
            flight = flight_plan.flight
            
            print(f"   - {traveler.name} (from {traveler.origin}):")
            if flight.price == 0:
                print(f"     Already at destination")
                continue
                
            print(f"     Airline: {flight.airline}")
            print(f"     Price: {format_currency(flight.price)}")
            print(f"     Departure: {format_datetime(flight.departure_time)}")
            print(f"     Arrival: {format_datetime(flight.arrival_time)}")
            print(f"     Duration: {flight.duration_minutes // 60}h {flight.duration_minutes % 60}m")
            
            if flight.emissions_kg:
                print(f"     CO₂ Emissions: {flight.emissions_kg:.1f} kg")
            
            if flight.flight_number:
                print(f"     Flight Number: {flight.flight_number}")
                
        print(f"\n{'-' * 80}\n")


# ----- Main Program -----

def main():
    """Main program entry point."""
    # Configuration
    API_KEY = os.environ.get("SKYSCANNER_API_KEY", "your_api_key_here")
    
    # Always use mock data
    use_mock = True
    logger.info("Using mock data for demonstration")
    
    # Define travelers
    travelers = [
        Traveler("Alice", "JFK"),   # New York
        Traveler("Bob", "LAX"),     # Los Angeles
        Traveler("Charlie", "ORD"), # Chicago
        Traveler("Diana", "SEA"),   # Seattle
        Traveler("Eva", "MIA"),     # Miami
    ]
    
    # Define candidate destinations (normally this would be a much larger list)
    # Use a smaller list for real API to avoid rate limits
    if use_mock:
        candidate_destinations = [
            "LAS",  # Las Vegas
            "DEN",  # Denver
            "DFW",  # Dallas
            "ATL",  # Atlanta
            "SFO",  # San Francisco
            "BOS",  # Boston
            "AUS",  # Austin
            "MSY",  # New Orleans
            "PDX",  # Portland
            "PHX",  # Phoenix
            "SAN",  # San Diego
            "MCO",  # Orlando
            "JFK",  # New York
            "LAX",  # Los Angeles
            "ORD",  # Chicago
        ]
    else:
        # Use just a few destinations when using real API to avoid rate limits
        logger.info("Using limited destination list to avoid API rate limits")
        candidate_destinations = [
            "LAS",  # Las Vegas
            "DEN",  # Denver
            "JFK",  # New York
            "LAX",  # Los Angeles
            "ORD",  # Chicago
        ]
    
    # Set travel date (YYYY-MM-DD format)
    travel_date = "2023-12-15"
    
    # Find optimal destinations
    optimal_destinations = find_optimal_destinations(
        travelers=travelers,
        candidate_destinations=candidate_destinations,
        travel_date=travel_date,
        api_key=API_KEY,
        mock_api=use_mock,  # Use mock or real API based on API key
        cost_weight=0.7,
        emissions_weight=0.3,
        max_results_per_route=1,
        max_workers=1 if not use_mock else 5  # Use only 1 worker with real API to avoid rate limits
    )
    
    # Print results
    print_destinations(optimal_destinations, top_n=5)


if __name__ == "__main__":
    main() 