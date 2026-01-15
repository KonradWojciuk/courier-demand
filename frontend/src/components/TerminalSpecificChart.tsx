'use client';

import { useEffect, useState } from 'react';
import { LineChart, Line, XAxis, YAxis, CartesianGrid, ResponsiveContainer, Tooltip } from 'recharts';

interface DailyData {
  day: number;
  value: number;
  date?: string;
}

interface ChartResponse {
  data: DailyData[];
}

type ViewType = 'monthly' | 'weekly';
type TerminalType = 'sender' | 'receiver';

export default function TerminalSpecificChart() {
  const [data, setData] = useState<DailyData[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [viewType, setViewType] = useState<ViewType>('monthly');
  const [terminalType, setTerminalType] = useState<TerminalType>('receiver');
  const [selectedTerminal, setSelectedTerminal] = useState<string>('');
  const [availableTerminals, setAvailableTerminals] = useState<string[]>([]);
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

  // Fetch available terminals
  useEffect(() => {
    const fetchTerminals = async () => {
      try {
        const apiUrl = process.env.NEXT_PUBLIC_API_URL || 'http://localhost:3001';
        const endpoint = terminalType === 'sender' 
          ? 'sender-terminal-monthly-distribution'
          : 'terminal-monthly-distribution';
        const response = await fetch(`${apiUrl}/api/packets/${endpoint}?month=${selectedMonth}&year=${selectedYear}`);
        
        if (response.ok) {
          const result = await response.json();
          const terminals = result.data?.map((item: any) => item.terminal) || [];
          setAvailableTerminals(terminals);
          if (terminals.length > 0 && !selectedTerminal) {
            setSelectedTerminal(terminals[0]);
          }
        }
      } catch (err) {
        console.error('Error fetching terminals:', err);
      }
    };

    fetchTerminals();
  }, [terminalType, selectedMonth, selectedYear]);

  // Fetch terminal-specific data
  useEffect(() => {
    if (!selectedTerminal) return;

    const fetchData = async () => {
      setLoading(true);
      try {
        const apiUrl = process.env.NEXT_PUBLIC_API_URL || 'http://localhost:3001';
        let url = '';
        
        if (viewType === 'monthly') {
          url = `${apiUrl}/api/packets/terminal-specific-monthly?terminal=${selectedTerminal}&month=${selectedMonth}&year=${selectedYear}&type=${terminalType}`;
        } else {
          url = `${apiUrl}/api/packets/terminal-specific-weekly?terminal=${selectedTerminal}&startDate=${selectedWeekStart}&endDate=${selectedWeekEnd}&type=${terminalType}`;
        }
        
        const response = await fetch(url);
        
        if (!response.ok) {
          throw new Error(`Failed to fetch terminal ${viewType} data`);
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
  }, [viewType, terminalType, selectedTerminal, selectedMonth, selectedYear, selectedWeekStart, selectedWeekEnd]);

  const maxValue = Math.max(...data.map(d => d.value), 0);
  const yAxisMax = Math.ceil(maxValue / 200) * 200 || 600;

  const currentYear = new Date().getFullYear();
  const availableYears = [currentYear - 2, currentYear - 1, currentYear];

  const customTooltip = ({ active, payload }: any) => {
    if (active && payload && payload.length) {
      return (
        <div className="bg-gray-800 border border-gray-700 rounded-lg p-3 shadow-lg">
          <p className="text-white font-semibold">
            {viewType === 'monthly' ? `Day ${payload[0].payload.day}` : `Day ${payload[0].payload.day}`}
          </p>
          <p className="text-green-500 font-bold">{payload[0].value.toLocaleString()} packages</p>
        </div>
      );
    }
    return null;
  };

  const terminalDisplayName = selectedTerminal 
    ? `${terminalCityMap[selectedTerminal] || selectedTerminal} - ${selectedTerminal}`
    : 'Select a terminal';

  return (
    <div className="bg-gray-900 rounded-lg shadow-lg p-8 w-full border-2 border-green-600/30">
      <div className="mb-8">
        <div className="flex items-center justify-between mb-4">
          <div>
            <h3 className="text-white font-bold text-lg mb-1">Terminal Performance</h3>
            <p className="text-gray-400 text-sm">
              {terminalType === 'receiver' ? 'Packages received' : 'Packages sent'} by selected terminal
            </p>
          </div>
        </div>
        <div className="flex items-center gap-4 flex-wrap">
          <div className="flex gap-2">
            <button
              onClick={() => setTerminalType('receiver')}
              className={`px-4 py-2 rounded-lg text-sm font-medium transition-colors ${
                terminalType === 'receiver'
                  ? 'bg-green-600 text-white'
                  : 'bg-gray-800 text-gray-300 hover:bg-gray-700'
              }`}
            >
              Receiving
            </button>
            <button
              onClick={() => setTerminalType('sender')}
              className={`px-4 py-2 rounded-lg text-sm font-medium transition-colors ${
                terminalType === 'sender'
                  ? 'bg-green-600 text-white'
                  : 'bg-gray-800 text-gray-300 hover:bg-gray-700'
              }`}
            >
              Sending
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
          <select
            value={selectedTerminal}
            onChange={(e) => setSelectedTerminal(e.target.value)}
            className="bg-gray-800 text-white border border-gray-700 rounded px-3 py-2 text-sm focus:outline-none focus:border-green-500"
          >
            <option value="">Select Terminal</option>
            {availableTerminals.map((terminal) => (
              <option key={terminal} value={terminal}>
                {terminalCityMap[terminal] || terminal} - {terminal}
              </option>
            ))}
          </select>
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
      </div>
      
      {loading ? (
        <div className="h-[600px] flex items-center justify-center">
          <p className="text-gray-400">Loading chart data...</p>
        </div>
      ) : error ? (
        <div className="h-[600px] flex items-center justify-center">
          <p className="text-red-400">Error: {error}</p>
        </div>
      ) : !selectedTerminal ? (
        <div className="h-[600px] flex items-center justify-center">
          <p className="text-gray-400">Please select a terminal</p>
        </div>
      ) : data.length === 0 ? (
        <div className="h-[600px] flex items-center justify-center">
          <p className="text-gray-400">No data available</p>
        </div>
      ) : (
        <div className="-mx-8 px-8">
          <ResponsiveContainer width="100%" height={600}>
            <LineChart data={data} margin={{ top: 20, right: 20, left: 20, bottom: 80 }}>
              <CartesianGrid strokeDasharray="3 3" stroke="#374151" />
              <XAxis 
                dataKey="day"
                stroke="#9CA3AF"
                tick={{ fill: '#9CA3AF', fontSize: 12 }}
                label={{ value: viewType === 'monthly' ? 'Day of Month' : 'Day', position: 'insideBottom', offset: -10, fill: '#9CA3AF' }}
                angle={-45}
                textAnchor="end"
                height={60}
              />
              <YAxis 
                stroke="#9CA3AF"
                tick={{ fill: '#9CA3AF', fontSize: 12 }}
                domain={[0, yAxisMax]}
                label={{ value: 'Packages', angle: -90, position: 'insideLeft', fill: '#9CA3AF' }}
              />
              <Tooltip content={customTooltip} />
              <Line 
                type="monotone" 
                dataKey="value" 
                stroke="#22C55E" 
                strokeWidth={2}
                dot={{ fill: '#22C55E', r: 3 }}
                activeDot={{ r: 5 }}
              />
            </LineChart>
          </ResponsiveContainer>
        </div>
      )}
    </div>
  );
}

