'use client';

import { useEffect, useState } from 'react';
import { LineChart, Line, XAxis, YAxis, CartesianGrid, ResponsiveContainer, Tooltip, Legend } from 'recharts';

interface SeasonalityData {
  month: string;
  count: number;
}

export default function SeasonalityAnalysisChart() {
  const [data, setData] = useState<SeasonalityData[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    const fetchSeasonalityData = async () => {
      setLoading(true);
      setError(null);
      try {
        const apiUrl = process.env.NEXT_PUBLIC_API_URL || 'http://localhost:3001';
        const response = await fetch(`${apiUrl}/api/packets/seasonality-analysis`);
        
        if (!response.ok) {
          throw new Error(`Failed to fetch seasonality data: ${response.status}`);
        }
        
        const result = await response.json();
        
        if (result.data && result.data.length > 0) {
          // Format month labels for better readability
          const formattedData = result.data.map((item: SeasonalityData) => {
            const [year, month] = item.month.split('-');
            const monthNames = ['Jan', 'Feb', 'Mar', 'Apr', 'May', 'Jun', 'Jul', 'Aug', 'Sep', 'Oct', 'Nov', 'Dec'];
            return {
              ...item,
              monthLabel: `${monthNames[parseInt(month) - 1]} ${year}`,
              monthNum: parseInt(month)
            };
          });
          setData(formattedData);
        } else {
          setData([]);
        }
      } catch (err) {
        console.error('Error fetching seasonality data:', err);
        setError(err instanceof Error ? err.message : 'Failed to load seasonality data');
        setData([]);
      } finally {
        setLoading(false);
      }
    };

    fetchSeasonalityData();
  }, []);

  const customTooltip = ({ active, payload }: any) => {
    if (active && payload && payload.length) {
      const data = payload[0].payload;
      return (
        <div className="bg-gray-800 border border-gray-700 rounded-lg p-3 shadow-lg">
          <p className="text-white font-semibold mb-2">{data.monthLabel}</p>
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
  const averageMonthly = data.length > 0 ? Math.round(totalShipments / data.length) : 0;
  const peakMonth = data.length > 0 ? data.reduce((max, item) => item.count > max.count ? item : max, data[0]) : null;
  const lowMonth = data.length > 0 ? data.reduce((min, item) => item.count < min.count ? item : min, data[0]) : null;

  return (
    <div className="bg-gray-900 rounded-lg shadow-lg p-8 w-full border border-gray-800">
      <div className="mb-6">
        <h3 className="text-white font-bold text-lg mb-1">Seasonality Analysis</h3>
        <p className="text-gray-400 text-sm">Monthly shipment patterns to identify seasonal trends and peak periods</p>
      </div>

      {loading ? (
        <div className="h-[500px] flex items-center justify-center">
          <p className="text-gray-400">Loading seasonality data...</p>
        </div>
      ) : error ? (
        <div className="h-[500px] flex items-center justify-center">
          <p className="text-red-400">Error: {error}</p>
        </div>
      ) : data.length === 0 ? (
        <div className="h-[500px] flex items-center justify-center">
          <p className="text-gray-400">No seasonality data available</p>
        </div>
      ) : (
        <>
          <ResponsiveContainer width="100%" height={500}>
            <LineChart data={data} margin={{ top: 20, right: 30, left: 20, bottom: 80 }}>
              <CartesianGrid strokeDasharray="3 3" stroke="#374151" />
              <XAxis
                dataKey="monthLabel"
                stroke="#9CA3AF"
                tick={{ fill: '#9CA3AF', fontSize: 11 }}
                angle={-45}
                textAnchor="end"
                height={80}
              />
              <YAxis
                stroke="#9CA3AF"
                tick={{ fill: '#9CA3AF', fontSize: 12 }}
                label={{ value: 'Shipments', angle: -90, position: 'insideLeft', fill: '#9CA3AF' }}
              />
              <Tooltip content={customTooltip} />
              <Legend />
              <Line
                type="monotone"
                dataKey="count"
                stroke="#3B82F6"
                strokeWidth={2}
                dot={{ fill: '#3B82F6', r: 4 }}
                activeDot={{ r: 6 }}
                name="Shipments"
              />
            </LineChart>
          </ResponsiveContainer>

          {/* Statistics Summary */}
          <div className="mt-6 grid grid-cols-1 md:grid-cols-4 gap-4">
            <div className="bg-gray-800/50 rounded-lg p-4 border border-gray-700">
              <p className="text-gray-400 text-sm mb-1">Total Shipments</p>
              <p className="text-white text-2xl font-bold">{totalShipments.toLocaleString()}</p>
            </div>
            <div className="bg-gray-800/50 rounded-lg p-4 border border-gray-700">
              <p className="text-gray-400 text-sm mb-1">Average per Month</p>
              <p className="text-white text-2xl font-bold">{averageMonthly.toLocaleString()}</p>
            </div>
            <div className="bg-gray-800/50 rounded-lg p-4 border border-gray-700">
              <p className="text-gray-400 text-sm mb-1">Peak Month</p>
              <p className="text-white text-xl font-bold">{peakMonth?.monthLabel || 'N/A'}</p>
              <p className="text-blue-400 text-sm">{peakMonth?.count.toLocaleString() || 0} shipments</p>
            </div>
            <div className="bg-gray-800/50 rounded-lg p-4 border border-gray-700">
              <p className="text-gray-400 text-sm mb-1">Lowest Month</p>
              <p className="text-white text-xl font-bold">{lowMonth?.monthLabel || 'N/A'}</p>
              <p className="text-red-400 text-sm">{lowMonth?.count.toLocaleString() || 0} shipments</p>
            </div>
          </div>
        </>
      )}
    </div>
  );
}
