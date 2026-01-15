'use client';

import { useEffect, useState } from 'react';
import { BarChart, Bar, XAxis, YAxis, CartesianGrid, ResponsiveContainer, Tooltip, Legend } from 'recharts';

interface HourlyData {
  hour: number;
  count: number;
}

export default function HourlyDemandChart() {
  const [data, setData] = useState<HourlyData[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [selectedMonth, setSelectedMonth] = useState(new Date().getMonth() + 1);
  const [selectedYear, setSelectedYear] = useState(new Date().getFullYear());
  const [selectedDate, setSelectedDate] = useState<string>('');
  const [viewMode, setViewMode] = useState<'month' | 'day'>('month');

  const monthNames = [
    'January', 'February', 'March', 'April', 'May', 'June',
    'July', 'August', 'September', 'October', 'November', 'December'
  ];

  const currentYear = new Date().getFullYear();
  const availableYears = [currentYear - 2, currentYear - 1, currentYear, currentYear + 1];

  useEffect(() => {
    const fetchHourlyData = async () => {
      setLoading(true);
      setError(null);
      try {
        const apiUrl = process.env.NEXT_PUBLIC_API_URL || 'http://localhost:3001';
        let url = `${apiUrl}/api/packets/hourly-demand`;
        
        if (viewMode === 'day' && selectedDate) {
          url += `?date=${selectedDate}`;
        } else if (viewMode === 'month') {
          url += `?month=${selectedMonth}&year=${selectedYear}`;
        }
        
        const response = await fetch(url);
        
        if (!response.ok) {
          throw new Error(`Failed to fetch hourly data: ${response.status}`);
        }
        
        const result = await response.json();
        
        if (result.data && result.data.length > 0) {
          // Format hour labels
          const formattedData = result.data.map((item: HourlyData) => ({
            ...item,
            hourLabel: `${String(item.hour).padStart(2, '0')}:00`
          }));
          setData(formattedData);
        } else {
          setData([]);
        }
      } catch (err) {
        console.error('Error fetching hourly data:', err);
        setError(err instanceof Error ? err.message : 'Failed to load hourly demand data');
        setData([]);
      } finally {
        setLoading(false);
      }
    };

    fetchHourlyData();
  }, [selectedMonth, selectedYear, selectedDate, viewMode]);

  const customTooltip = ({ active, payload }: any) => {
    if (active && payload && payload.length) {
      const data = payload[0].payload;
      return (
        <div className="bg-gray-800 border border-gray-700 rounded-lg p-3 shadow-lg">
          <p className="text-white font-semibold mb-2">{data.hourLabel}</p>
          <p className="text-blue-400 font-bold">
            Shipments: {data.count.toLocaleString()}
          </p>
        </div>
      );
    }
    return null;
  };

  // Calculate statistics
  const totalShipments = data.reduce((sum, item) => sum + item.count, 0);
  const averageHourly = data.length > 0 ? Math.round(totalShipments / data.length) : 0;
  const peakHour = data.length > 0 ? data.reduce((max, item) => item.count > max.count ? item : max, data[0]) : null;
  const lowHour = data.length > 0 ? data.reduce((min, item) => item.count < min.count ? item : min, data[0]) : null;

  return (
    <div className="bg-gray-900 rounded-lg shadow-lg p-8 w-full border border-gray-800">
      <div className="mb-6">
        <h3 className="text-white font-bold text-lg mb-1">Hourly Demand Pattern</h3>
        <p className="text-gray-400 text-sm">Shipment volumes by hour of day to identify peak hours and daily patterns</p>
      </div>

      {/* Controls */}
      <div className="mb-6 flex gap-4 items-center flex-wrap">
        <div className="flex gap-2 items-center">
          <label className="text-gray-300 text-sm">View:</label>
          <select
            value={viewMode}
            onChange={(e) => {
              setViewMode(e.target.value as 'month' | 'day');
              if (e.target.value === 'month') {
                setSelectedDate('');
              }
            }}
            className="bg-gray-800 text-white border border-gray-700 rounded px-3 py-2 text-sm focus:outline-none focus:border-green-500"
          >
            <option value="month">Month</option>
            <option value="day">Specific Day</option>
          </select>
        </div>

        {viewMode === 'month' ? (
          <>
            <div className="flex gap-2 items-center">
              <label className="text-gray-300 text-sm">Month:</label>
              <select
                value={selectedMonth}
                onChange={(e) => setSelectedMonth(parseInt(e.target.value))}
                className="bg-gray-800 text-white border border-gray-700 rounded px-3 py-2 text-sm focus:outline-none focus:border-green-500"
              >
                {monthNames.map((name, index) => (
                  <option key={index} value={index + 1}>
                    {name}
                  </option>
                ))}
              </select>
            </div>
            <div className="flex gap-2 items-center">
              <label className="text-gray-300 text-sm">Year:</label>
              <select
                value={selectedYear}
                onChange={(e) => setSelectedYear(parseInt(e.target.value))}
                className="bg-gray-800 text-white border border-gray-700 rounded px-3 py-2 text-sm focus:outline-none focus:border-green-500"
              >
                {availableYears.map((year) => (
                  <option key={year} value={year}>
                    {year}
                  </option>
                ))}
              </select>
            </div>
          </>
        ) : (
          <div className="flex gap-2 items-center">
            <label className="text-gray-300 text-sm">Date:</label>
            <input
              type="date"
              value={selectedDate}
              onChange={(e) => setSelectedDate(e.target.value)}
              className="bg-gray-800 text-white border border-gray-700 rounded px-3 py-2 text-sm focus:outline-none focus:border-green-500"
            />
          </div>
        )}
      </div>

      {loading ? (
        <div className="h-[500px] flex items-center justify-center">
          <p className="text-gray-400">Loading hourly demand data...</p>
        </div>
      ) : error ? (
        <div className="h-[500px] flex items-center justify-center">
          <p className="text-red-400">Error: {error}</p>
        </div>
      ) : data.length === 0 ? (
        <div className="h-[500px] flex items-center justify-center">
          <p className="text-gray-400">No hourly demand data available</p>
        </div>
      ) : (
        <>
          <ResponsiveContainer width="100%" height={500}>
            <BarChart data={data} margin={{ top: 20, right: 30, left: 20, bottom: 20 }}>
              <CartesianGrid strokeDasharray="3 3" stroke="#374151" />
              <XAxis
                dataKey="hourLabel"
                stroke="#9CA3AF"
                tick={{ fill: '#9CA3AF', fontSize: 11 }}
                interval={1}
              />
              <YAxis
                stroke="#9CA3AF"
                tick={{ fill: '#9CA3AF', fontSize: 12 }}
                label={{ value: 'Shipments', angle: -90, position: 'insideLeft', fill: '#9CA3AF' }}
              />
              <Tooltip content={customTooltip} />
              <Legend />
              <Bar
                dataKey="count"
                fill="#22C55E"
                name="Shipments"
                radius={[4, 4, 0, 0]}
              />
            </BarChart>
          </ResponsiveContainer>

          {/* Statistics Summary */}
          <div className="mt-6 grid grid-cols-1 md:grid-cols-4 gap-4">
            <div className="bg-gray-800/50 rounded-lg p-4 border border-gray-700">
              <p className="text-gray-400 text-sm mb-1">Total Shipments</p>
              <p className="text-white text-2xl font-bold">{totalShipments.toLocaleString()}</p>
            </div>
            <div className="bg-gray-800/50 rounded-lg p-4 border border-gray-700">
              <p className="text-gray-400 text-sm mb-1">Average per Hour</p>
              <p className="text-white text-2xl font-bold">{averageHourly.toLocaleString()}</p>
            </div>
            <div className="bg-gray-800/50 rounded-lg p-4 border border-gray-700">
              <p className="text-gray-400 text-sm mb-1">Peak Hour</p>
              <p className="text-white text-xl font-bold">{peakHour?.hourLabel || 'N/A'}</p>
              <p className="text-green-400 text-sm">{peakHour?.count.toLocaleString() || 0} shipments</p>
            </div>
            <div className="bg-gray-800/50 rounded-lg p-4 border border-gray-700">
              <p className="text-gray-400 text-sm mb-1">Lowest Hour</p>
              <p className="text-white text-xl font-bold">{lowHour?.hourLabel || 'N/A'}</p>
              <p className="text-red-400 text-sm">{lowHour?.count.toLocaleString() || 0} shipments</p>
            </div>
          </div>
        </>
      )}
    </div>
  );
}
