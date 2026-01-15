'use client';

import { useEffect, useState } from 'react';
import { Calendar } from 'lucide-react';
import dynamic from 'next/dynamic';
import 'leaflet/dist/leaflet.css';
import HeatmapLayer from './HeatmapLayer';

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

export default function CityHeatmap() {
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

  // Fetch city locations for heatmap
  // Fetch all Polish cities (no terminal filter required)
  useEffect(() => {
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
        
        // Optional terminal filter
        if (selectedTerminal) {
          params.append('terminal', selectedTerminal);
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
  }, [viewType, selectedDate, selectedMonth, selectedYear, selectedWeekStart, selectedWeekEnd, selectedTerminal, minPackageCount, maxCities]);

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
        <h2 className="text-white text-xl font-bold mb-4">City Heatmap - Poland</h2>
        <p className="text-gray-400 text-sm mb-4">
          Visualize package distribution intensity across Polish cities using a heatmap.
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
              <label htmlFor="date-select-heatmap" className="text-white font-semibold flex items-center gap-2">
                <Calendar className="w-5 h-5" />
                Select Date:
              </label>
              <input
                id="date-select-heatmap"
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
              <label htmlFor="week-select-heatmap" className="text-white font-semibold flex items-center gap-2">
                <Calendar className="w-5 h-5" />
                Week Start:
              </label>
              <input
                id="week-select-heatmap"
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
              <label htmlFor="month-select-heatmap" className="text-white font-semibold flex items-center gap-2">
                <Calendar className="w-5 h-5" />
                Month:
              </label>
              <select
                id="month-select-heatmap"
                value={selectedMonth}
                onChange={(e) => setSelectedMonth(Number(e.target.value))}
                className="bg-gray-800 text-white border border-gray-600 rounded-lg px-4 py-2 focus:outline-none focus:border-green-500"
              >
                {monthNames.map((month, index) => (
                  <option key={month} value={index + 1}>
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
          <label htmlFor="terminal-select-heatmap" className="text-white font-semibold">
            Filter by Terminal (Optional):
          </label>
          <select
            id="terminal-select-heatmap"
            value={selectedTerminal}
            onChange={(e) => setSelectedTerminal(e.target.value)}
            className="bg-gray-800 text-white border border-gray-600 rounded-lg px-4 py-2 focus:outline-none focus:border-green-500"
          >
            <option value="">All Terminals</option>
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
        <div className="mt-4 p-4 bg-gray-800/50 rounded-lg border border-gray-700">
          <h3 className="text-white font-semibold mb-3">Display Options</h3>
          <div className="flex items-center gap-4 flex-wrap">
            <div className="flex items-center gap-2">
              <label htmlFor="min-count-heatmap" className="text-gray-300 text-sm">
                Min Packages:
              </label>
              <input
                id="min-count-heatmap"
                type="number"
                min="0"
                value={minPackageCount}
                onChange={(e) => setMinPackageCount(Math.max(0, parseInt(e.target.value) || 0))}
                className="bg-gray-700 text-white border border-gray-600 rounded-lg px-3 py-1 w-24 text-center focus:outline-none focus:border-green-500"
              />
            </div>
            <div className="flex items-center gap-2">
              <label htmlFor="max-cities-heatmap" className="text-gray-300 text-sm">
                Max Cities:
              </label>
              <input
                id="max-cities-heatmap"
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
      ) : cityLocations.length > 0 ? (
        <div className="bg-gray-800 rounded-lg p-4 border border-gray-700">
          <div className="mb-4 text-gray-400 text-sm">
            Showing heatmap for {cityLocations.length} cit{cityLocations.length !== 1 ? 'ies' : 'y'} across Poland
            {selectedTerminal && ` (filtered by ${terminalCityMap[selectedTerminal] || selectedTerminal})`}
            {minPackageCount > 0 && ` (min ${minPackageCount} packages)`}
          </div>
          <div style={{ height: '600px', width: '100%' }} className="rounded-lg overflow-hidden">
            <MapContainer
              center={[52.0, 19.0]} // Center of Poland
              zoom={7}
              style={{ height: '100%', width: '100%' }}
            >
              <TileLayer
                url="https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png"
                attribution='&copy; <a href="https://www.openstreetmap.org/copyright">OpenStreetMap</a> contributors'
              />
              <HeatmapLayer
                positions={cityLocations.map(loc => {
                  // Normalize count to intensity (0-1) based on max count
                  const counts = cityLocations.map(l => l.count);
                  const maxCount = Math.max(...counts, 1);
                  const minCount = Math.min(...counts, 0);
                  
                  // Use logarithmic scale for better distribution when there's a large range
                  // This ensures smaller values are still visible
                  let intensity: number;
                  if (maxCount === minCount || maxCount === 0) {
                    // All same count or all zero - use uniform intensity
                    intensity = maxCount > 0 ? 0.5 : 0;
                  } else {
                    // Normalize with logarithmic scaling for better visibility
                    const normalized = (loc.count - minCount) / (maxCount - minCount);
                    // Apply square root to boost lower values, ensuring they're visible
                    intensity = Math.sqrt(normalized);
                    // Ensure minimum intensity for visibility (at least 0.1 if count > 0)
                    if (loc.count > 0 && intensity < 0.1) {
                      intensity = 0.1;
                    }
                  }
                  
                  return [loc.latitude, loc.longitude, Math.min(Math.max(intensity, 0), 1)];
                })}
                options={{
                  radius: 30,
                  blur: 20,
                  maxZoom: 17,
                  minOpacity: 0.5,
                  gradient: {
                    0.0: '#0066ff', // bright blue (low intensity)
                    0.2: '#00aaff', // light blue
                    0.4: '#00ffff', // cyan
                    0.6: '#ffff00', // yellow
                    0.8: '#ff8800', // orange
                    1.0: '#ff0000'  // red (high intensity)
                  }
                }}
              />
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

