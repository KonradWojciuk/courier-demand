'use client';

import { useEffect, useState } from 'react';
import { Calendar } from 'lucide-react';
import dynamic from 'next/dynamic';
import 'leaflet/dist/leaflet.css';

type ViewType = 'monthly' | 'weekly' | 'daily';

interface CountryLocation {
  country: string;
  latitude: number;
  longitude: number;
  count: number;
}

// Dynamically import MapContainer to avoid SSR issues
const MapContainer = dynamic(() => import('react-leaflet').then(mod => mod.MapContainer), { ssr: false });
const TileLayer = dynamic(() => import('react-leaflet').then(mod => mod.TileLayer), { ssr: false });
const Marker = dynamic(() => import('react-leaflet').then(mod => mod.Marker), { ssr: false });
const Popup = dynamic(() => import('react-leaflet').then(mod => mod.Popup), { ssr: false });

export default function CountryDistributionMap() {
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

  const [countryLocations, setCountryLocations] = useState<CountryLocation[]>([]);
  const [loading, setLoading] = useState(false);
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

  // Fetch country locations for map
  useEffect(() => {
    const fetchCountryLocations = async () => {
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
        
        url = `${apiUrl}/api/packets/country-distribution?${params.toString()}`;
        
        const response = await fetch(url);
        
        if (response.ok) {
          const result = await response.json();
          const countries = result.data || [];
          // Filter out countries with invalid coordinates (0,0)
          const validCountries = countries.filter((c: CountryLocation) => 
            c.latitude !== 0 || c.longitude !== 0
          );
          setCountryLocations(validCountries);
          if (validCountries.length === 0) {
            setError(`No country data available for the selected ${viewType} period.`);
          } else {
            setError(null);
          }
        } else {
          const errorData = await response.json().catch(() => ({}));
          setError(errorData.error || 'Failed to load country distribution');
        }
      } catch (err) {
        console.error('Error fetching country locations:', err);
        setError(err instanceof Error ? err.message : 'Failed to load country distribution');
      } finally {
        setLoading(false);
      }
    };

    fetchCountryLocations();
  }, [viewType, selectedDate, selectedMonth, selectedYear, selectedWeekStart, selectedWeekEnd]);

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

  // Calculate marker size based on count (for visual representation)
  const getMarkerSize = (count: number) => {
    const maxCount = Math.max(...countryLocations.map(c => c.count), 1);
    const minSize = 10;
    const maxSize = 40;
    return minSize + ((count / maxCount) * (maxSize - minSize));
  };

  return (
    <div className="bg-gray-900 rounded-lg p-6 border border-gray-700 mb-6">
      <div className="mb-6">
        <h2 className="text-white text-xl font-bold mb-4">Country Distribution Map</h2>
        <p className="text-gray-400 text-sm mb-4">
          View shipment distribution by country. Each marker shows the number of packages sent to that country.
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
              <label htmlFor="month-select" className="text-white font-semibold flex items-center gap-2">
                <Calendar className="w-5 h-5" />
                Month:
              </label>
              <select
                id="month-select"
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
      ) : countryLocations.length > 0 ? (
        <div className="bg-gray-800 rounded-lg p-4 border border-gray-700">
          <div className="mb-4 text-gray-400 text-sm">
            Showing {countryLocations.length} countr{countryLocations.length !== 1 ? 'ies' : 'y'} on the map
          </div>
          <div style={{ height: '600px', width: '100%' }} className="rounded-lg overflow-hidden">
            <MapContainer
              center={[50.0, 10.0]} // Center of Europe
              zoom={4}
              style={{ height: '100%', width: '100%' }}
            >
              <TileLayer
                url="https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png"
                attribution='&copy; <a href="https://www.openstreetmap.org/copyright">OpenStreetMap</a> contributors'
              />
              {countryLocations.map((location, index) => {
                return (
                  <Marker
                    key={`${location.country}-${index}`}
                    position={[location.latitude, location.longitude]}
                  >
                    <Popup>
                      <div className="text-gray-800">
                        <strong>{location.country}</strong>
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
          <p className="text-gray-400">No country data available for the selected period.</p>
        </div>
      ) : null}
    </div>
  );
}

