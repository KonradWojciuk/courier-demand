'use client';

import { useEffect, useState } from 'react';
import { MapPin, ChevronDown, ChevronUp } from 'lucide-react';

interface CityData {
  city: string;
  count: number;
}

interface CitiesResponse {
  data: CityData[];
}

type ViewType = 'monthly' | 'weekly';

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

export default function SenderTerminalCitiesList() {
  const [allCityData, setAllCityData] = useState<CityData[]>([]);
  const [availableTerminals, setAvailableTerminals] = useState<string[]>([]);
  const [selectedTerminal, setSelectedTerminal] = useState<string>('');
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [viewType, setViewType] = useState<ViewType>('monthly');
  const [selectedMonth, setSelectedMonth] = useState(new Date().getMonth() + 1);
  const [selectedYear, setSelectedYear] = useState(new Date().getFullYear());
  const [citySearchTerm, setCitySearchTerm] = useState('');
  const [showAllCities, setShowAllCities] = useState(false);
  
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

  // Fetch available sender terminals
  useEffect(() => {
    const fetchTerminals = async () => {
      try {
        const apiUrl = process.env.NEXT_PUBLIC_API_URL || 'http://localhost:3001';
        const response = await fetch(`${apiUrl}/api/packets/sender-terminal-monthly-distribution?month=${selectedMonth}&year=${selectedYear}`);
        
        if (response.ok) {
          const result = await response.json();
          const terminals = result.data?.map((item: any) => item.terminal) || [];
          setAvailableTerminals(terminals);
          if (terminals.length > 0) {
            if (!selectedTerminal || !terminals.includes(selectedTerminal)) {
              setSelectedTerminal(terminals[0]);
            }
          } else {
            setSelectedTerminal('');
          }
        } else {
          console.error('Failed to fetch terminals:', response.status);
        }
      } catch (err) {
        console.error('Error fetching terminals:', err);
        setError('Failed to load terminals');
      }
    };

    fetchTerminals();
  }, [selectedMonth, selectedYear]);

  // Fetch cities for selected sender terminal
  useEffect(() => {
    if (!selectedTerminal) {
      setAllCityData([]);
      setLoading(false);
      setError(null);
      return;
    }

    const fetchCityData = async () => {
      setLoading(true);
      setError(null);
      try {
        const apiUrl = process.env.NEXT_PUBLIC_API_URL || 'http://localhost:3001';
        let url = '';
        
        if (viewType === 'monthly') {
          url = `${apiUrl}/api/packets/cities-by-sender-terminal-monthly?terminal=${encodeURIComponent(selectedTerminal)}&month=${selectedMonth}&year=${selectedYear}`;
        } else {
          url = `${apiUrl}/api/packets/cities-by-sender-terminal-weekly?terminal=${encodeURIComponent(selectedTerminal)}&startDate=${selectedWeekStart}&endDate=${selectedWeekEnd}`;
        }
        
        const response = await fetch(url);
        
        if (!response.ok) {
          const errorData = await response.json().catch(() => ({}));
          throw new Error(errorData.error || `Failed to fetch city data: ${response.status}`);
        }
        
        const result: CitiesResponse = await response.json();
        const cities = result.data || [];
        setAllCityData(cities);
        setError(null);
      } catch (err) {
        console.error('Error fetching cities:', err);
        setError(err instanceof Error ? err.message : 'An error occurred while fetching cities');
        setAllCityData([]);
      } finally {
        setLoading(false);
      }
    };

    fetchCityData();
  }, [selectedTerminal, viewType, selectedMonth, selectedYear, selectedWeekStart, selectedWeekEnd]);

  const getTerminalDisplayName = (terminalCode: string) => {
    const cityName = terminalCityMap[terminalCode] || terminalCode;
    return cityName ? `${cityName} - ${terminalCode}` : terminalCode;
  };

  // Calculate displayed cities based on search and showAllCities
  const displayedCities = (() => {
    if (citySearchTerm) {
      return allCityData.filter(city =>
        city.city.toLowerCase().includes(citySearchTerm.toLowerCase())
      );
    }
    return showAllCities ? allCityData : allCityData.slice(0, 10);
  })();

  const maxCount = Math.max(...displayedCities.map(c => c.count), 0);
  const currentYear = new Date().getFullYear();
  const availableYears = [currentYear - 2, currentYear - 1, currentYear];

  return (
    <div className="bg-gray-900 rounded-lg shadow-lg p-8 w-full border border-gray-800">
      <div className="mb-6">
        <div className="flex items-center justify-between mb-4">
          <div>
            <h3 className="text-white font-bold text-lg mb-1">Cities Receiving Shipments</h3>
            <p className="text-gray-400 text-sm">
              Select a terminal to see which cities receive shipments from it, with shipment counts per city
            </p>
          </div>
        </div>
        <div className="flex flex-wrap items-center gap-4 mb-4">
          <select
            value={selectedTerminal}
            onChange={(e) => setSelectedTerminal(e.target.value)}
            className="bg-gray-800 text-white border border-gray-700 rounded px-3 py-2 text-sm focus:outline-none focus:border-green-500 min-w-[200px]"
          >
            {availableTerminals.length === 0 ? (
              <option value="">Loading terminals...</option>
            ) : (
              <>
                <option value="">Select a terminal...</option>
                {availableTerminals.map((terminal) => (
                  <option key={terminal} value={terminal}>
                    {getTerminalDisplayName(terminal)}
                  </option>
                ))}
              </>
            )}
          </select>
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
                {availableYears.map((year) => (
                  <option key={year} value={year}>
                    {year}
                  </option>
                ))}
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
        <div className="flex gap-4 items-center">
          <input
            type="text"
            value={citySearchTerm}
            onChange={(e) => setCitySearchTerm(e.target.value)}
            placeholder="Search cities..."
            className="flex-1 bg-gray-800 text-white border border-gray-700 rounded px-4 py-2 focus:outline-none focus:border-green-500"
          />
          {!citySearchTerm && allCityData.length > 10 && (
            <button
              onClick={() => setShowAllCities(!showAllCities)}
              className="px-4 py-2 bg-gray-800 text-white rounded-lg border border-gray-700 hover:bg-gray-700 transition-colors flex items-center gap-2"
            >
              {showAllCities ? (
                <>
                  <ChevronUp className="w-4 h-4" />
                  Show Top 10
                </>
              ) : (
                <>
                  <ChevronDown className="w-4 h-4" />
                  Show All ({allCityData.length})
                </>
              )}
            </button>
          )}
        </div>
      </div>

      {!selectedTerminal ? (
        <div className="h-[400px] flex items-center justify-center">
          <p className="text-gray-400">Please select a terminal</p>
        </div>
      ) : loading ? (
        <div className="h-[400px] flex items-center justify-center">
          <p className="text-gray-400">Loading cities data...</p>
        </div>
      ) : error ? (
        <div className="h-[400px] flex items-center justify-center">
          <p className="text-red-400">Error: {error}</p>
        </div>
      ) : displayedCities.length === 0 ? (
        <div className="h-[400px] flex items-center justify-center">
          <p className="text-gray-400">
            {citySearchTerm ? 'No cities found matching your search' : 'No data available for this terminal'}
          </p>
        </div>
      ) : (
        <div className="space-y-3">
          {displayedCities.map((city, index) => {
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
                      shipments
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

