'use client';

import { useEffect, useState } from 'react';
import { MapPin, X } from 'lucide-react';

interface CityData {
  city: string;
  count: number;
}

interface CitiesResponse {
  data: CityData[];
}

interface AllCitiesResponse {
  cities: string[];
}

type CityType = 'sender' | 'receiver';
type ViewType = 'monthly' | 'weekly';

export default function TopCitiesList() {
  const [selectedCities, setSelectedCities] = useState<string[]>([]);
  const [availableCities, setAvailableCities] = useState<string[]>([]);
  const [cityData, setCityData] = useState<CityData[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [activeTab, setActiveTab] = useState<CityType>('receiver');
  const [viewType, setViewType] = useState<ViewType>('monthly');
  const [searchTerm, setSearchTerm] = useState('');
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

  const monthNames = [
    'January', 'February', 'March', 'April', 'May', 'June',
    'July', 'August', 'September', 'October', 'November', 'December'
  ];

  // Fetch available cities
  useEffect(() => {
    const fetchAvailableCities = async () => {
      try {
        const apiUrl = process.env.NEXT_PUBLIC_API_URL || 'http://localhost:3001';
        const response = await fetch(`${apiUrl}/api/packets/all-cities?type=${activeTab}`);
        
        if (response.ok) {
          const result: AllCitiesResponse = await response.json();
          setAvailableCities(result.cities || []);
        }
      } catch (err) {
        console.error('Error fetching available cities:', err);
      }
    };

    fetchAvailableCities();
  }, [activeTab]);

  // Fetch data for selected cities
  useEffect(() => {
    if (selectedCities.length === 0) {
      setCityData([]);
      setLoading(false);
      return;
    }

    const fetchCityData = async () => {
      setLoading(true);
      try {
        const apiUrl = process.env.NEXT_PUBLIC_API_URL || 'http://localhost:3001';
        const citiesParam = selectedCities.join(',');
        let url = '';
        
        if (viewType === 'monthly') {
          url = `${apiUrl}/api/packets/cities-data-monthly?cities=${encodeURIComponent(citiesParam)}&month=${selectedMonth}&year=${selectedYear}&type=${activeTab}`;
        } else {
          url = `${apiUrl}/api/packets/cities-data-weekly?cities=${encodeURIComponent(citiesParam)}&startDate=${selectedWeekStart}&endDate=${selectedWeekEnd}&type=${activeTab}`;
        }
        
        const response = await fetch(url);
        
        if (!response.ok) {
          throw new Error('Failed to fetch city data');
        }
        
        const result: CitiesResponse = await response.json();
        setCityData(result.data || []);
      } catch (err) {
        setError(err instanceof Error ? err.message : 'An error occurred');
      } finally {
        setLoading(false);
      }
    };

    fetchCityData();
  }, [selectedCities, activeTab, viewType, selectedMonth, selectedYear, selectedWeekStart, selectedWeekEnd]);

  const handleAddCity = (city: string) => {
    if (city && !selectedCities.includes(city)) {
      setSelectedCities([...selectedCities, city]);
      setSearchTerm('');
    }
  };

  const handleRemoveCity = (city: string) => {
    setSelectedCities(selectedCities.filter(c => c !== city));
  };

  const filteredAvailableCities = availableCities.filter(
    city => 
      !selectedCities.includes(city) &&
      city.toLowerCase().includes(searchTerm.toLowerCase())
  );

  const maxCount = Math.max(...cityData.map(c => c.count), 0);

  return (
    <div className="bg-gray-900 rounded-lg shadow-lg p-8 w-full border border-gray-800">
      <div className="mb-6">
        <div className="flex items-center justify-between mb-4">
          <div>
            <h3 className="text-white font-bold text-lg mb-1">City Selection</h3>
            <p className="text-gray-400 text-sm">
              Select cities to view {activeTab === 'sender' ? 'shipments sent' : 'deliveries received'}
            </p>
          </div>
        </div>
        <div className="flex flex-wrap items-center gap-4 mb-4">
          <div className="flex gap-2">
            <button
              onClick={() => {
                setActiveTab('receiver');
                setSelectedCities([]);
              }}
              className={`px-4 py-2 rounded-lg text-sm font-medium transition-colors ${
                activeTab === 'receiver'
                  ? 'bg-green-600 text-white'
                  : 'bg-gray-800 text-gray-300 hover:bg-gray-700'
              }`}
            >
              Deliveries Received
            </button>
            <button
              onClick={() => {
                setActiveTab('sender');
                setSelectedCities([]);
              }}
              className={`px-4 py-2 rounded-lg text-sm font-medium transition-colors ${
                activeTab === 'sender'
                  ? 'bg-green-600 text-white'
                  : 'bg-gray-800 text-gray-300 hover:bg-gray-700'
              }`}
            >
              Shipments Sent
            </button>
          </div>
          <div className="flex gap-2">
            <button
              onClick={() => setViewType('monthly')}
              className={`px-4 py-2 rounded-lg text-sm font-medium transition-colors ${
                viewType === 'monthly'
                  ? 'bg-green-600 text-white'
                  : 'bg-gray-800 text-gray-300 hover:bg-gray-700'
              }`}
            >
              Monthly
            </button>
            <button
              onClick={() => setViewType('weekly')}
              className={`px-4 py-2 rounded-lg text-sm font-medium transition-colors ${
                viewType === 'weekly'
                  ? 'bg-green-600 text-white'
                  : 'bg-gray-800 text-gray-300 hover:bg-gray-700'
              }`}
            >
              Weekly
            </button>
          </div>
          {viewType === 'monthly' && (
            <>
              <select
                value={selectedMonth}
                onChange={(e) => setSelectedMonth(Number(e.target.value))}
                className="bg-gray-800 text-white border border-gray-700 rounded px-3 py-2 text-sm focus:outline-none focus:border-green-500"
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
                className="bg-gray-800 text-white border border-gray-700 rounded px-3 py-2 text-sm focus:outline-none focus:border-green-500"
              >
                {(() => {
                  const currentYear = new Date().getFullYear();
                  return [currentYear - 2, currentYear - 1, currentYear].map((year) => (
                    <option key={year} value={year}>
                      {year}
                    </option>
                  ));
                })()}
              </select>
            </>
          )}
          {viewType === 'weekly' && (
            <input
              type="date"
              value={selectedWeekStart}
              onChange={(e) => setSelectedWeekStart(e.target.value)}
              className="bg-gray-800 text-white border border-gray-700 rounded px-3 py-2 text-sm focus:outline-none focus:border-green-500"
            />
          )}
        </div>
        <div className="relative">
          <input
            type="text"
            value={searchTerm}
            onChange={(e) => setSearchTerm(e.target.value)}
            placeholder="Search and select cities..."
            className="w-full bg-gray-800 text-white border border-gray-700 rounded px-4 py-2 pr-10 focus:outline-none focus:border-green-500"
          />
          {searchTerm && filteredAvailableCities.length > 0 && (
            <div className="absolute z-10 w-full mt-1 bg-gray-800 border border-gray-700 rounded-lg shadow-lg max-h-60 overflow-y-auto">
              {filteredAvailableCities.slice(0, 10).map((city) => (
                <button
                  key={city}
                  onClick={() => handleAddCity(city)}
                  className="w-full text-left px-4 py-2 text-white hover:bg-gray-700 transition-colors flex items-center gap-2"
                >
                  <MapPin className="w-4 h-4 text-gray-400" />
                  {city}
                </button>
              ))}
            </div>
          )}
        </div>
        {selectedCities.length > 0 && (
          <div className="flex flex-wrap gap-2 mt-4">
            {selectedCities.map((city) => (
              <div
                key={city}
                className="flex items-center gap-2 px-3 py-1 bg-gray-800 rounded-lg border border-gray-700"
              >
                <MapPin className="w-4 h-4 text-green-500" />
                <span className="text-white text-sm">{city}</span>
                <button
                  onClick={() => handleRemoveCity(city)}
                  className="text-gray-400 hover:text-white ml-1"
                >
                  <X className="w-4 h-4" />
                </button>
              </div>
            ))}
          </div>
        )}
      </div>

      {loading ? (
        <div className="h-[400px] flex items-center justify-center">
          <p className="text-gray-400">Loading cities data...</p>
        </div>
      ) : error ? (
        <div className="h-[400px] flex items-center justify-center">
          <p className="text-red-400">Error: {error}</p>
        </div>
      ) : selectedCities.length === 0 ? (
        <div className="h-[400px] flex items-center justify-center">
          <p className="text-gray-400">Please select cities to view data</p>
        </div>
      ) : cityData.length === 0 ? (
        <div className="h-[400px] flex items-center justify-center">
          <p className="text-gray-400">No data available for selected cities</p>
        </div>
      ) : (
        <div className="space-y-3">
          {cityData.map((city, index) => {
            const percentage = maxCount > 0 ? (city.count / maxCount) * 100 : 0;
            return (
              <div key={city.city} className="bg-gray-800 rounded-lg p-4 border border-gray-700">
                <div className="flex items-center justify-between mb-2">
                  <div className="flex items-center gap-3">
                    <div className="flex items-center justify-center w-8 h-8 rounded-full bg-green-600/20 text-green-500 font-bold text-sm">
                      {index + 1}
                    </div>
                    <div className="flex items-center gap-2">
                      <MapPin className="w-4 h-4 text-gray-400" />
                      <span className="text-white font-semibold text-lg">{city.city}</span>
                    </div>
                  </div>
                  <div className="text-right">
                    <div className="text-green-500 font-bold text-xl">
                      {city.count.toLocaleString()}
                    </div>
                    <div className="text-gray-400 text-xs">
                      {activeTab === 'sender' ? 'shipments' : 'deliveries'}
                    </div>
                  </div>
                </div>
                <div className="w-full bg-gray-700 rounded-full h-2 overflow-hidden">
                  <div
                    className="bg-green-500 h-full rounded-full transition-all duration-500"
                    style={{ width: `${percentage}%` }}
                  ></div>
                </div>
              </div>
            );
          })}
        </div>
      )}
    </div>
  );
}

