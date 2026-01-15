'use client';

import { useEffect, useState } from 'react';
import { LineChart, Line, XAxis, YAxis, CartesianGrid, ResponsiveContainer, Tooltip } from 'recharts';

interface DailyData {
  day: number;
  value: number;
}

interface ChartResponse {
  data: DailyData[];
}

export default function ShipmentsChart() {
  const [data, setData] = useState<DailyData[]>([]);
  const [loading, setLoading] = useState(true);
  const [maxValue, setMaxValue] = useState(320);
  const [selectedMonth, setSelectedMonth] = useState(new Date().getMonth() + 1);
  const [selectedYear, setSelectedYear] = useState(new Date().getFullYear());

  const monthNames = [
    'January', 'February', 'March', 'April', 'May', 'June',
    'July', 'August', 'September', 'October', 'November', 'December'
  ];

  useEffect(() => {
    const fetchDailyData = async () => {
      setLoading(true);
      try {
        const apiUrl = process.env.NEXT_PUBLIC_API_URL || 'http://localhost:3001';
        const url = `${apiUrl}/api/packets/daily?month=${selectedMonth}&year=${selectedYear}`;
        console.log('Fetching daily data from:', url);
        
        const response = await fetch(url);
        
        if (!response.ok) {
          const errorText = await response.text();
          console.error('API error:', response.status, errorText);
          throw new Error(`Failed to fetch daily data: ${response.status}`);
        }
        
        const result: ChartResponse = await response.json();
        console.log('Received data:', result);
        
        if (result.data && result.data.length > 0) {
          setData(result.data);
          // Calculate max value for Y-axis (round up to nearest 80)
          const max = Math.max(...result.data.map(d => d.value));
          setMaxValue(Math.ceil(max / 80) * 80 || 320);
        } else {
          // Initialize with empty data for the month
          const daysInMonth = new Date(selectedYear, selectedMonth, 0).getDate();
          const emptyData = Array.from({ length: daysInMonth }, (_, i) => ({
            day: i + 1,
            value: 0
          }));
          setData(emptyData);
          setMaxValue(320);
        }
      } catch (err) {
        console.error('Error fetching daily data:', err);
        // Set empty data on error
        const daysInMonth = new Date(selectedYear, selectedMonth, 0).getDate();
        const emptyData = Array.from({ length: daysInMonth }, (_, i) => ({
          day: i + 1,
          value: 0
        }));
        setData(emptyData);
      } finally {
        setLoading(false);
      }
    };

    fetchDailyData();
  }, [selectedMonth, selectedYear]);

  // Generate Y-axis ticks based on max value
  const yAxisTicks = [];
  const step = Math.max(80, Math.ceil(maxValue / 4));
  for (let i = 0; i <= maxValue; i += step) {
    yAxisTicks.push(i);
  }

  // Generate available years (last 2 years and current year)
  const currentYear = new Date().getFullYear();
  const availableYears = [currentYear - 2, currentYear - 1, currentYear];

  // Custom tooltip formatter
  const customTooltip = ({ active, payload }: any) => {
    if (active && payload && payload.length) {
      return (
        <div className="bg-gray-800 border border-gray-700 rounded-lg p-3 shadow-lg">
          <p className="text-white font-semibold">Day {payload[0].payload.day}</p>
          <p className="text-green-500 font-bold">{payload[0].value.toLocaleString()} packages</p>
        </div>
      );
    }
    return null;
  };

  return (
    <div className="bg-gray-900 rounded-lg shadow-lg p-8 w-full border border-gray-800">
      <div className="mb-8 flex items-center justify-between">
        <div>
          <h3 className="text-white font-bold text-lg mb-1">Shipments Trend</h3>
          <p className="text-gray-400 text-sm">Daily distribution in selected month</p>
        </div>
        <div className="flex gap-3">
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
        </div>
      </div>
      
      {loading ? (
        <div className="h-[600px] flex items-center justify-center">
          <p className="text-gray-400">Loading chart data...</p>
        </div>
      ) : data.length === 0 ? (
        <div className="h-[600px] flex items-center justify-center">
          <p className="text-gray-400">No data available for this month</p>
        </div>
      ) : (
        <ResponsiveContainer width="100%" height={600}>
          <LineChart data={data} margin={{ top: 20, right: 30, left: 20, bottom: 80 }}>
            <CartesianGrid strokeDasharray="3 3" stroke="#374151" />
            <XAxis 
              dataKey="day" 
              stroke="#9CA3AF"
              tick={{ fill: '#9CA3AF', fontSize: 11 }}
              interval={0}
              angle={-45}
              textAnchor="end"
              height={60}
            />
            <YAxis 
              stroke="#9CA3AF"
              tick={{ fill: '#9CA3AF', fontSize: 12 }}
              domain={[0, maxValue]}
              ticks={yAxisTicks}
              label={{ value: 'Daily', angle: -90, position: 'insideLeft', fill: '#9CA3AF' }}
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
      )}
    </div>
  );
}

