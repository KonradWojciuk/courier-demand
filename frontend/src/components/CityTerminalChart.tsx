'use client';

import { useEffect, useState } from 'react';
import { BarChart, Bar, XAxis, YAxis, CartesianGrid, ResponsiveContainer, Tooltip } from 'recharts';

interface TerminalData {
  terminal: string;
  count: number;
}

interface ChartResponse {
  data: TerminalData[];
}

type ViewType = 'monthly' | 'weekly' | 'daily';

export default function CityTerminalChart() {
  const [data, setData] = useState<TerminalData[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [viewType, setViewType] = useState<ViewType>('monthly');
  const [selectedMonth, setSelectedMonth] = useState(new Date().getMonth() + 1);
  const [selectedYear, setSelectedYear] = useState(new Date().getFullYear());
  // Helper function to get current week start (Monday)
  const getCurrentWeekStart = () => {
    const now = new Date();
    const currentDay = now.getDay();
    const diff = now.getDate() - currentDay + (currentDay === 0 ? -6 : 1); // Adjust to Monday
    const weekStart = new Date(now.setDate(diff));
    weekStart.setHours(0, 0, 0, 0);
    return weekStart.toISOString().split('T')[0];
  };

  const [selectedWeekStart, setSelectedWeekStart] = useState(getCurrentWeekStart());
  
  // Calculate end date as start date + 7 days
  const selectedWeekEnd = (() => {
    const start = new Date(selectedWeekStart);
    const end = new Date(start);
    end.setDate(end.getDate() + 7);
    return end.toISOString().split('T')[0];
  })();
  const [selectedDate, setSelectedDate] = useState(new Date().toISOString().split('T')[0]);

  const monthNames = [
    'January', 'February', 'March', 'April', 'May', 'June',
    'July', 'August', 'September', 'October', 'November', 'December'
  ];

  // Terminal code to city name mapping - customize this as needed
  const terminalCityMap: Record<string, string> = {
    'KR': 'Kraków',
    'KZ': 'Zabrze',
    'WA': 'Warszawa',
    'LD': 'Łódź',
    'LU': 'Lublin',
    'WR': 'Wrocław',
    'HI': 'Robakowo',
    'PO': 'Poznań',
    'RZ': 'Rzeszów',
    'GD': 'Gdańsk',
    'SE': 'Siedlce',
    'BY': 'Bydgoszcz',
    'SZ': 'Szczecin',
    'TG': 'Tarnów',
    'PL': 'Płock',
    'NS': 'Nowy Sącz',
    'W3': 'Moszna',
    'W2': 'Emilianów',
    'KL': 'Kielce',
    'BK': 'Białystok',
    'BB': 'Bielsko-Biała',
    'GW': 'Gorzów Wielkopolski',
    'OL': 'Olsztyn',
    'PT': 'Pitrków Trybunalski',
    'TA': 'Tarnów',
    'SU': 'Suwałki',
    'CZ': 'Częstochowa',
    'KI': 'Kielce',
    'RA': 'Radom',
    'SL': 'Słupsk',
    'WL': 'Włocławek',
    'LO': 'Łomża',
    'OP': 'Opole',
    'KN': 'Konin',
    'G2': 'Gdynia',
    'PI': 'Piła',
    'ZG': 'Zielona Góra',
    'WB': 'Wałbrzych',
    'CI': 'Ciechanów',
    'KO': 'Koszalin',
    'JG': 'Jelenia Góra',
    'KD': 'Tychy',
    'LG': 'Legnica',
  };

  useEffect(() => {
    const fetchData = async () => {
      setLoading(true);
      try {
        const apiUrl = process.env.NEXT_PUBLIC_API_URL || 'http://localhost:3001';
        let url = '';
        
        if (viewType === 'monthly') {
          url = `${apiUrl}/api/packets/terminal-monthly-distribution?month=${selectedMonth}&year=${selectedYear}`;
        } else if (viewType === 'weekly') {
          url = `${apiUrl}/api/packets/terminal-weekly-distribution?startDate=${selectedWeekStart}&endDate=${selectedWeekEnd}`;
        } else {
          url = `${apiUrl}/api/packets/terminal-daily-distribution?date=${selectedDate}`;
        }
        
        const response = await fetch(url);
        
        if (!response.ok) {
          throw new Error(`Failed to fetch terminal ${viewType} distribution`);
        }
        
        const result: ChartResponse = await response.json();
        setData(result.data || []);
      } catch (err) {
        setError(err instanceof Error ? err.message : 'An error occurred');
      } finally {
        setLoading(false);
      }
    };

    fetchData();
  }, [viewType, selectedMonth, selectedYear, selectedWeekStart, selectedWeekEnd, selectedDate]);

  // Format data for chart - map terminal code to city name
  const chartData = data.map(item => {
    const terminalCode = item.terminal || '';
    const cityName = terminalCityMap[terminalCode] || terminalCode;
    return {
      name: cityName ? `${cityName} - ${terminalCode}` : terminalCode,
      value: item.count,
      originalTerminal: item.terminal
    };
  });

  // Calculate max value for X-axis
  const maxValue = Math.max(...chartData.map(d => d.value), 0);
  const xAxisMax = Math.ceil(maxValue / 200) * 200 || 600;

  // Generate available years (last 2 years and current year)
  const currentYear = new Date().getFullYear();
  const availableYears = [currentYear - 2, currentYear - 1, currentYear];

  // Custom tooltip
  const customTooltip = ({ active, payload }: any) => {
    if (active && payload && payload.length) {
      return (
        <div className="bg-gray-800 border border-gray-700 rounded-lg p-3 shadow-lg">
          <p className="text-white font-semibold">{payload[0].payload.name}</p>
          <p className="text-green-500 font-bold">{payload[0].value.toLocaleString()} packages</p>
        </div>
      );
    }
    return null;
  };

  return (
    <div className="bg-gray-900 rounded-lg shadow-lg p-8 w-full border-2 border-blue-600/30">
      <div className="mb-8">
        <div className="flex items-center justify-between mb-4">
          <div>
            <h3 className="text-white font-bold text-lg mb-1">Number of shipments per terminal</h3>
            <p className="text-gray-400 text-sm">Number of shipments received by terminals in a given period</p>
          </div>
        </div>
        <div className="flex items-center gap-4">
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
            <button
              onClick={() => setViewType('daily')}
              className={`px-4 py-2 rounded-lg text-sm font-medium transition-colors ${
                viewType === 'daily'
                  ? 'bg-green-600 text-white'
                  : 'bg-gray-800 text-gray-300 hover:bg-gray-700'
              }`}
            >
              Daily
            </button>
          </div>
          <div className="flex gap-3">
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
            {viewType === 'daily' && (
              <input
                type="date"
                value={selectedDate}
                onChange={(e) => setSelectedDate(e.target.value)}
                className="bg-gray-800 text-white border border-gray-700 rounded px-3 py-2 text-sm focus:outline-none focus:border-green-500"
              />
            )}
          </div>
        </div>
      </div>
      
      {loading ? (
        <div className="h-[600px] flex items-center justify-center">
          <p className="text-gray-400">Loading chart data...</p>
        </div>
      ) : error ? (
        <div className="h-[600px] flex items-center justify-center">
          <p className="text-red-400">Error: {error}</p>
        </div>
      ) : chartData.length === 0 ? (
        <div className="h-[600px] flex items-center justify-center">
          <p className="text-gray-400">No data available</p>
        </div>
      ) : (
        <div className="-mx-8 px-8">
          <ResponsiveContainer width="100%" height={Math.max(600, chartData.length * 30)}>
            <BarChart
              data={chartData}
              layout="vertical"
              margin={{ top: 20, right: 0, left: 0, bottom: 20 }}
            >
              <CartesianGrid strokeDasharray="3 3" stroke="#374151" />
              <XAxis 
                type="number"
                stroke="#9CA3AF"
                tick={{ fill: '#9CA3AF', fontSize: 12 }}
                domain={[0, xAxisMax]}
              />
              <YAxis 
                type="category"
                dataKey="name"
                stroke="#9CA3AF"
                tick={{ fill: '#9CA3AF', fontSize: 11 }}
                width={200}
                interval={0}
              />
              <Tooltip content={customTooltip} />
              <Bar 
                dataKey="value" 
                fill="#22C55E"
                radius={[0, 4, 4, 0]}
              />
            </BarChart>
          </ResponsiveContainer>
        </div>
      )}
    </div>
  );
}

