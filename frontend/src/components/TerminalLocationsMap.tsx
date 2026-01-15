'use client';

import { useEffect, useState } from 'react';
import { Calendar, Search, X, Plus } from 'lucide-react';
import dynamic from 'next/dynamic';
import 'leaflet/dist/leaflet.css';

type ViewType = 'monthly' | 'weekly' | 'daily';

interface CityLocation {
  city: string;
  latitude: number;
  longitude: number;
  terminal: string;
  count: number;
}

// Terminal code to city name mapping
const terminalCityMap: Record<string, string> = {
  'KR': 'Kraków', 'KZ': 'Zabrze', 'WA': 'Warszawa', 'LD': 'Łódź',
  'LU': 'Lublin', 'WR': 'Wrocław', 'HI': 'Robakowo', 'PO': 'Poznań',
  'RZ': 'Rzeszów', 'GD': 'Gdańsk', 'SE': 'Siedlce', 'BY': 'Bydgoszcz',
  'SZ': 'Szczecin', 'TG': 'Tarnów', 'PL': 'Płock', 'NS': 'Nowy Sącz',
  'W3': 'Moszna', 'W2': 'Emilianów', 'KL': 'Kielce', 'BK': 'Białystok',
  'BB': 'Bielsko-Biała', 'GW': 'Gorzów Wielkopolski', 'OL': 'Olsztyn',
  'PT': 'Pitrków Trybunalski', 'TA': 'Tarnów', 'SU': 'Suwałki',
  'CZ': 'Częstochowa', 'KI': 'Kielce', 'RA': 'Radom', 'SL': 'Słupsk',
  'WL': 'Włocławek', 'LO': 'Łomża', 'OP': 'Opole', 'KN': 'Konin',
  'G2': 'Gdynia', 'PI': 'Piła', 'ZG': 'Zielona Góra', 'WB': 'Wałbrzych',
  'CI': 'Ciechanów', 'KO': 'Koszalin', 'JG': 'Jelenia Góra',
  'KD': 'Tychy', 'LG': 'Legnica',
};

// Dynamically import MapContainer to avoid SSR issues
const MapContainer = dynamic(() => import('react-leaflet').then(mod => mod.MapContainer), { ssr: false });
const TileLayer = dynamic(() => import('react-leaflet').then(mod => mod.TileLayer), { ssr: false });
const Marker = dynamic(() => import('react-leaflet').then(mod => mod.Marker), { ssr: false });
const Popup = dynamic(() => import('react-leaflet').then(mod => mod.Popup), { ssr: false });

export default function TerminalLocationsMap() {
  const [viewType, setViewType] = useState<ViewType>('daily');
  const [selectedDate, setSelectedDate] = useState(new Date().toISOString().split('T')[0]);
  const [selectedMonth, setSelectedMonth] = useState(new Date().getMonth() + 1);
  const [selectedYear, setSelectedYear] = useState(new Date().getFullYear());
  
  // Helper function to get current week start (Monday)
  const getCurrentWeekStart = () => {
    const now = new Date();
    const currentDay = now.getDay();
    const diff = now.getDate() - currentDay + (currentDay === 0 ? -6 : 1);
    const weekStart = new Date(now.setDate(diff));
    weekStart.setHours(0, 0, 0, 0);
    return weekStart.toISOString().split('T')[0];
  };

  const [selectedWeekStart, setSelectedWeekStart] = useState(getCurrentWeekStart());
  
  const selectedWeekEnd = (() => {
    const start = new Date(selectedWeekStart);
    const end = new Date(start);
    end.setDate(end.getDate() + 7);
    return end.toISOString().split('T')[0];
  })();

  const [cityLocations, setCityLocations] = useState<CityLocation[]>([]);
  const [selectedTerminal, setSelectedTerminal] = useState<string>('');
  const [availableTerminals, setAvailableTerminals] = useState<string[]>([]);
  const [selectedCities, setSelectedCities] = useState<string[]>([]);
  const [citySearch, setCitySearch] = useState<string>('');
  const [minPackageCount, setMinPackageCount] = useState<number>(0);
  const [maxCities, setMaxCities] = useState<number>(500);
  const [loading, setLoading] = useState(false);
  const [loadingTerminals, setLoadingTerminals] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [isClient, setIsClient] = useState(false);

  const monthNames = [
    'January', 'February', 'March', 'April', 'May', 'June',
    'July', 'August', 'September', 'October', 'November', 'December'
  ];

  const currentYear = new Date().getFullYear();
  const availableYears = [currentYear - 2, currentYear - 1, currentYear];

  // Fix Leaflet icon issue on client side only
  useEffect(() => {
    setIsClient(true);
    if (typeof window !== 'undefined') {
      const L = require('leaflet');
      delete (L.Icon.Default.prototype as any)._getIconUrl;
      L.Icon.Default.mergeOptions({
        iconRetinaUrl: 'https://cdnjs.cloudflare.com/ajax/libs/leaflet/1.9.4/images/marker-icon-2x.png',
        iconUrl: 'https://cdnjs.cloudflare.com/ajax/libs/leaflet/1.9.4/images/marker-icon.png',
        shadowUrl: 'https://cdnjs.cloudflare.com/ajax/libs/leaflet/1.9.4/images/marker-shadow.png',
      });
    }
  }, []);

  // Fetch available terminals (receiver terminals for map)
  useEffect(() => {
    const fetchTerminals = async () => {
      setLoadingTerminals(true);
      setError(null);
      try {
        const apiUrl = process.env.NEXT_PUBLIC_API_URL || 'http://localhost:3001';
        const response = await fetch(`${apiUrl}/api/packets/all-receiver-terminals`);
        
        if (response.ok) {
          const result = await response.json();
          const terminals = result.data?.map((item: any) => item.terminal) || [];
          setAvailableTerminals(terminals);
          if (terminals.length === 0) {
            setError('No terminals found in the database.');
          } else {
            setError(null);
          }
        } else {
          const errorData = await response.json().catch(() => ({}));
          console.error('Failed to fetch terminals:', response.status, errorData);
          setError(errorData.error || 'Failed to load terminals');
        }
      } catch (err) {
        console.error('Error fetching terminals:', err);
        setError(err instanceof Error ? err.message : 'Failed to load terminals');
      } finally {
        setLoadingTerminals(false);
      }
    };

    fetchTerminals();
  }, []);

  // Fetch city locations for map
  // Only fetch if terminal is selected OR cities are added (to avoid loading all cities)
  useEffect(() => {
    // Don't fetch if neither terminal nor cities are selected
    if (!selectedTerminal && selectedCities.length === 0) {
      setCityLocations([]);
      setError(null);
      return;
    }

    const fetchCityLocations = async () => {
      setLoading(true);
      setError(null);
      try {
        const apiUrl = process.env.NEXT_PUBLIC_API_URL || 'http://localhost:3001';
        let url = '';
        
        const params = new URLSearchParams();
        if (viewType === 'monthly') {
          params.append('month', String(selectedMonth));
          params.append('year', String(selectedYear));
        } else if (viewType === 'weekly') {
          params.append('startDate', selectedWeekStart);
          params.append('endDate', selectedWeekEnd);
        } else {
          params.append('date', selectedDate);
        }
        
        if (selectedTerminal) {
          params.append('terminal', selectedTerminal);
        }
        
        if (selectedCities.length > 0) {
          params.append('cities', selectedCities.join(','));
        }
        
        if (minPackageCount > 0) {
          params.append('minCount', String(minPackageCount));
        }
        
        if (maxCities > 0) {
          params.append('limit', String(maxCities));
        }
        
        url = `${apiUrl}/api/packets/city-locations-with-counts?${params.toString()}`;
        
        const response = await fetch(url);
        
        if (response.ok) {
          const result = await response.json();
          const cities = result.data || [];
          setCityLocations(cities);
          if (cities.length === 0) {
            setError(`No city location data available for the selected filters.`);
          } else {
            setError(null);
          }
        } else {
          const errorData = await response.json().catch(() => ({}));
          setError(errorData.error || 'Failed to load city locations');
        }
      } catch (err) {
        console.error('Error fetching city locations:', err);
        setError(err instanceof Error ? err.message : 'Failed to load city locations');
      } finally {
        setLoading(false);
      }
    };

    fetchCityLocations();
  }, [viewType, selectedDate, selectedMonth, selectedYear, selectedWeekStart, selectedWeekEnd, selectedTerminal, selectedCities, minPackageCount, maxCities]);

  const handleAddCity = () => {
    if (citySearch.trim() && !selectedCities.includes(citySearch.trim())) {
      setSelectedCities([...selectedCities, citySearch.trim()]);
      setCitySearch('');
    }
  };

  const handleRemoveCity = (city: string) => {
    setSelectedCities(selectedCities.filter(c => c !== city));
  };

  const formatDate = (dateString: string) => {
    const date = new Date(dateString);
    const options: Intl.DateTimeFormatOptions = { 
      year: 'numeric', 
      month: 'long', 
      day: 'numeric' 
    };
    return date.toLocaleDateString('en-US', options);
  };

  const formatDateRange = (start: string, end: string) => {
    return `${formatDate(start)} - ${formatDate(end)}`;
  };

  return (
    <div className="bg-gray-900 rounded-lg p-6 border border-gray-700">
      <div className="mb-6">
        <h2 className="text-white text-xl font-bold mb-4">City Locations Map</h2>
        <p className="text-gray-400 text-sm mb-4">
          View city locations with package counts on the map. Filter by terminal or search for specific cities.
        </p>
        
        {/* View Type Selection */}
        <div className="mb-4 flex gap-2">
          <button
            onClick={() => setViewType('daily')}
            className={`px-4 py-2 rounded-lg font-semibold transition-colors ${
              viewType === 'daily'
                ? 'bg-green-600 text-white'
                : 'bg-gray-800 text-gray-400 hover:bg-gray-700'
            }`}
          >
            Daily
          </button>
          <button
            onClick={() => setViewType('weekly')}
            className={`px-4 py-2 rounded-lg font-semibold transition-colors ${
              viewType === 'weekly'
                ? 'bg-green-600 text-white'
                : 'bg-gray-800 text-gray-400 hover:bg-gray-700'
            }`}
          >
            Weekly
          </button>
          <button
            onClick={() => setViewType('monthly')}
            className={`px-4 py-2 rounded-lg font-semibold transition-colors ${
              viewType === 'monthly'
                ? 'bg-green-600 text-white'
                : 'bg-gray-800 text-gray-400 hover:bg-gray-700'
            }`}
          >
            Monthly
          </button>
        </div>

        {/* Date Selection */}
        <div className="flex items-center gap-4 flex-wrap">
          {viewType === 'daily' && (
            <>
              <label htmlFor="date-select" className="text-white font-semibold flex items-center gap-2">
                <Calendar className="w-5 h-5" />
                Select Date:
              </label>
              <input
                id="date-select"
                type="date"
                value={selectedDate}
                onChange={(e) => setSelectedDate(e.target.value)}
                className="bg-gray-800 text-white border border-gray-600 rounded-lg px-4 py-2 focus:outline-none focus:border-green-500"
              />
              {selectedDate && (
                <span className="text-gray-400 text-sm">
                  {formatDate(selectedDate)}
                </span>
              )}
            </>
          )}

          {viewType === 'weekly' && (
            <>
              <label htmlFor="week-select" className="text-white font-semibold flex items-center gap-2">
                <Calendar className="w-5 h-5" />
                Week Start:
              </label>
              <input
                id="week-select"
                type="date"
                value={selectedWeekStart}
                onChange={(e) => setSelectedWeekStart(e.target.value)}
                className="bg-gray-800 text-white border border-gray-600 rounded-lg px-4 py-2 focus:outline-none focus:border-green-500"
              />
              <span className="text-gray-400 text-sm">
                {formatDateRange(selectedWeekStart, selectedWeekEnd)}
              </span>
            </>
          )}

          {viewType === 'monthly' && (
            <>
              <label className="text-white font-semibold flex items-center gap-2">
                <Calendar className="w-5 h-5" />
                Month:
              </label>
              <select
                value={selectedMonth}
                onChange={(e) => setSelectedMonth(Number(e.target.value))}
                className="bg-gray-800 text-white border border-gray-600 rounded-lg px-4 py-2 focus:outline-none focus:border-green-500"
              >
                {monthNames.map((month, index) => (
                  <option key={index} value={index + 1}>
                    {month}
                  </option>
                ))}
              </select>
              <select
                value={selectedYear}
                onChange={(e) => setSelectedYear(Number(e.target.value))}
                className="bg-gray-800 text-white border border-gray-600 rounded-lg px-4 py-2 focus:outline-none focus:border-green-500"
              >
                {availableYears.map((year) => (
                  <option key={year} value={year}>
                    {year}
                  </option>
                ))}
              </select>
              <span className="text-gray-400 text-sm">
                {monthNames[selectedMonth - 1]} {selectedYear}
              </span>
            </>
          )}
        </div>

        {/* Terminal Filter */}
        <div className="mt-4 flex items-center gap-4 flex-wrap">
          <label htmlFor="terminal-select" className="text-white font-semibold">
            Select Terminal: <span className="text-red-400">*</span>
          </label>
          <select
            id="terminal-select"
            value={selectedTerminal}
            onChange={(e) => setSelectedTerminal(e.target.value)}
            className="bg-gray-800 text-white border border-gray-600 rounded-lg px-4 py-2 focus:outline-none focus:border-green-500"
          >
            <option value="">-- Select a terminal --</option>
            {availableTerminals.map((terminal) => (
              <option key={terminal} value={terminal}>
                {terminalCityMap[terminal] || terminal} - {terminal}
              </option>
            ))}
          </select>
          {loadingTerminals && (
            <span className="text-gray-400 text-sm">Loading terminals...</span>
          )}
        </div>

        {/* Optimization Options */}
        {(selectedTerminal || selectedCities.length > 0) && (
          <div className="mt-4 p-4 bg-gray-800/50 rounded-lg border border-gray-700">
            <h3 className="text-white font-semibold mb-3">Display Options</h3>
            <div className="flex items-center gap-4 flex-wrap">
              <div className="flex items-center gap-2">
                <label htmlFor="min-count" className="text-gray-300 text-sm">
                  Min Packages:
                </label>
                <input
                  id="min-count"
                  type="number"
                  min="0"
                  value={minPackageCount}
                  onChange={(e) => setMinPackageCount(Math.max(0, parseInt(e.target.value) || 0))}
                  className="bg-gray-700 text-white border border-gray-600 rounded-lg px-3 py-1 w-24 text-center focus:outline-none focus:border-green-500"
                />
              </div>
              <div className="flex items-center gap-2">
                <label htmlFor="max-cities" className="text-gray-300 text-sm">
                  Max Cities:
                </label>
                <input
                  id="max-cities"
                  type="number"
                  min="1"
                  max="10000"
                  value={maxCities}
                  onChange={(e) => setMaxCities(Math.max(1, parseInt(e.target.value) || 500))}
                  className="bg-gray-700 text-white border border-gray-600 rounded-lg px-3 py-1 w-24 text-center focus:outline-none focus:border-green-500"
                />
              </div>
            </div>
          </div>
        )}

        {/* City Search and Add */}
        <div className="mt-4">
          <label className="text-white font-semibold mb-2 block">Add Cities:</label>
          <div className="flex gap-2">
            <div className="flex-1 relative">
              <Search className="absolute left-3 top-1/2 transform -translate-y-1/2 w-5 h-5 text-gray-400" />
              <input
                type="text"
                value={citySearch}
                onChange={(e) => setCitySearch(e.target.value)}
                onKeyPress={(e) => e.key === 'Enter' && handleAddCity()}
                placeholder="Enter city name..."
                className="bg-gray-800 text-white border border-gray-600 rounded-lg pl-10 pr-4 py-2 w-full focus:outline-none focus:border-green-500"
              />
            </div>
            <button
              onClick={handleAddCity}
              className="bg-green-600 hover:bg-green-700 text-white px-4 py-2 rounded-lg flex items-center gap-2 transition-colors"
            >
              <Plus className="w-5 h-5" />
              Add
            </button>
          </div>
          
          {/* Selected Cities */}
          {selectedCities.length > 0 && (
            <div className="mt-2 flex flex-wrap gap-2">
              {selectedCities.map((city) => (
                <span
                  key={city}
                  className="bg-gray-800 text-white px-3 py-1 rounded-lg flex items-center gap-2 text-sm"
                >
                  {city}
                  <button
                    onClick={() => handleRemoveCity(city)}
                    className="hover:text-red-400 transition-colors"
                  >
                    <X className="w-4 h-4" />
                  </button>
                </span>
              ))}
            </div>
          )}
        </div>
      </div>

      {/* Error Message */}
      {error && (
        <div className="mb-4 p-4 bg-red-900/50 border border-red-700 rounded-lg">
          <p className="text-red-300">{error}</p>
        </div>
      )}

      {/* Map */}
      {!isClient ? (
        <div className="bg-gray-800 rounded-lg p-8 text-center border border-gray-700">
          <p className="text-gray-400">Loading map...</p>
        </div>
      ) : loading ? (
        <div className="bg-gray-800 rounded-lg p-8 text-center border border-gray-700">
          <p className="text-gray-400">Loading map data...</p>
        </div>
      ) : (!selectedTerminal && selectedCities.length === 0) ? (
        <div className="bg-gray-800 rounded-lg p-8 text-center border border-gray-700">
          <p className="text-gray-400 mb-2">Please select a terminal or add cities to view the map.</p>
          <p className="text-gray-500 text-sm">This helps optimize performance by not loading all cities at once.</p>
        </div>
      ) : cityLocations.length > 0 ? (
        <div className="bg-gray-800 rounded-lg p-4 border border-gray-700">
          <div className="mb-4 text-gray-400 text-sm">
            Showing {cityLocations.length} cit{cityLocations.length !== 1 ? 'ies' : 'y'} on the map
            {selectedTerminal && ` (filtered by ${terminalCityMap[selectedTerminal] || selectedTerminal})`}
            {minPackageCount > 0 && ` (min ${minPackageCount} packages)`}
          </div>
          <div style={{ height: '600px', width: '100%' }} className="rounded-lg overflow-hidden">
            <MapContainer
              center={[52.0, 19.0]} // Center of Poland
              zoom={selectedTerminal || selectedCities.length > 0 ? 7 : 6}
              style={{ height: '100%', width: '100%' }}
            >
              <TileLayer
                url="https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png"
                attribution='&copy; <a href="https://www.openstreetmap.org/copyright">OpenStreetMap</a> contributors'
              />
              {cityLocations.map((location, index) => {
                return (
                  <Marker
                    key={`${location.city}-${index}`}
                    position={[location.latitude, location.longitude]}
                  >
                    <Popup>
                      <div className="text-gray-800">
                        <strong>{location.city}</strong>
                        {location.terminal && (
                          <>
                            <br />
                            Terminal: {terminalCityMap[location.terminal] || location.terminal} ({location.terminal})
                          </>
                        )}
                        <br />
                        Packages: {location.count.toLocaleString()}
                      </div>
                    </Popup>
                  </Marker>
                );
              })}
            </MapContainer>
          </div>
        </div>
      ) : !loading && !error ? (
        <div className="bg-gray-800 rounded-lg p-8 text-center border border-gray-700">
          <p className="text-gray-400">No city location data available for the selected filters.</p>
        </div>
      ) : null}
    </div>
  );
}

