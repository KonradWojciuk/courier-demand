'use client';

import { useEffect, useState } from 'react';
import { Calendar } from 'lucide-react';

type ViewType = 'monthly' | 'weekly' | 'daily';

interface TerminalCountryStat {
  country: string;
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

export default function TerminalCountryStats() {
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

  const [stats, setStats] = useState<TerminalCountryStat[]>([]);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const monthNames = [
    'January', 'February', 'March', 'April', 'May', 'June',
    'July', 'August', 'September', 'October', 'November', 'December'
  ];

  const currentYear = new Date().getFullYear();
  const availableYears = [currentYear - 2, currentYear - 1, currentYear];

  // Fetch terminal-country statistics
  useEffect(() => {
    const fetchStats = async () => {
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
        
        url = `${apiUrl}/api/packets/terminal-country-stats?${params.toString()}`;
        
        const response = await fetch(url);
        
        if (response.ok) {
          const result = await response.json();
          setStats(result.data || []);
          if ((result.data || []).length === 0) {
            setError(`No terminal-country statistics available for the selected ${viewType} period.`);
          } else {
            setError(null);
          }
        } else {
          const errorData = await response.json().catch(() => ({}));
          setError(errorData.error || 'Failed to load terminal-country statistics');
        }
      } catch (err) {
        console.error('Error fetching terminal-country stats:', err);
        setError(err instanceof Error ? err.message : 'Failed to load terminal-country statistics');
      } finally {
        setLoading(false);
      }
    };

    fetchStats();
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

  return (
    <div className="bg-gray-900 rounded-lg p-6 border border-gray-700">
      <div className="mb-6">
        <h2 className="text-white text-xl font-bold mb-4">Terminal-to-Country Statistics</h2>
        <p className="text-gray-400 text-sm mb-4">
          View which terminal sends the most packages to each country.
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
              <label htmlFor="date-select-stats" className="text-white font-semibold flex items-center gap-2">
                <Calendar className="w-5 h-5" />
                Select Date:
              </label>
              <input
                id="date-select-stats"
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
              <label htmlFor="week-select-stats" className="text-white font-semibold flex items-center gap-2">
                <Calendar className="w-5 h-5" />
                Week Start:
              </label>
              <input
                id="week-select-stats"
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
              <label htmlFor="month-select-stats" className="text-white font-semibold flex items-center gap-2">
                <Calendar className="w-5 h-5" />
                Month:
              </label>
              <select
                id="month-select-stats"
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

      {/* Statistics List */}
      {loading ? (
        <div className="bg-gray-800 rounded-lg p-8 text-center border border-gray-700">
          <p className="text-gray-400">Loading statistics...</p>
        </div>
      ) : stats.length > 0 ? (
        <div className="bg-gray-800 rounded-lg border border-gray-700">
          <div className="overflow-x-auto">
            <table className="w-full">
              <thead>
                <tr className="border-b border-gray-700">
                  <th className="text-left text-white font-semibold p-4">Country</th>
                  <th className="text-left text-white font-semibold p-4">Terminal</th>
                  <th className="text-right text-white font-semibold p-4">Packages</th>
                </tr>
              </thead>
              <tbody>
                {stats.map((stat, index) => (
                  <tr 
                    key={`${stat.country}-${stat.terminal}-${index}`}
                    className="border-b border-gray-700/50 hover:bg-gray-700/30 transition-colors"
                  >
                    <td className="text-gray-300 p-4 font-medium">{stat.country}</td>
                    <td className="text-gray-300 p-4">
                      <span className="font-semibold text-green-400">{stat.terminal}</span>
                      {terminalCityMap[stat.terminal] && (
                        <span className="text-gray-500 ml-2">({terminalCityMap[stat.terminal]})</span>
                      )}
                    </td>
                    <td className="text-gray-300 p-4 text-right font-semibold">
                      {stat.count.toLocaleString()}
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
          <div className="p-4 bg-gray-700/30 border-t border-gray-700">
            <p className="text-gray-400 text-sm">
              Showing {stats.length} countr{stats.length !== 1 ? 'ies' : 'y'}
            </p>
          </div>
        </div>
      ) : !loading && !error ? (
        <div className="bg-gray-800 rounded-lg p-8 text-center border border-gray-700">
          <p className="text-gray-400">No terminal-country statistics available for the selected period.</p>
        </div>
      ) : null}
    </div>
  );
}

