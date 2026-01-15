'use client';

import { useEffect, useState } from 'react';
import { BarChart, Bar, XAxis, YAxis, CartesianGrid, ResponsiveContainer, Tooltip } from 'recharts';

interface SizeData {
  size: string;
  count: number;
}

interface DistributionResponse {
  data: SizeData[];
}

export default function ShipmentSizeDistribution() {
  const [data, setData] = useState<SizeData[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    const fetchData = async () => {
      setLoading(true);
      try {
        const apiUrl = process.env.NEXT_PUBLIC_API_URL || 'http://localhost:3001';
        const response = await fetch(`${apiUrl}/api/packets/shipment-size-distribution`);
        
        if (!response.ok) {
          throw new Error('Failed to fetch shipment size distribution');
        }
        
        const result: DistributionResponse = await response.json();
        setData(result.data || []);
      } catch (err) {
        setError(err instanceof Error ? err.message : 'An error occurred');
      } finally {
        setLoading(false);
      }
    };

    fetchData();
  }, []);

  const customTooltip = ({ active, payload }: any) => {
    if (active && payload && payload.length) {
      return (
        <div className="bg-gray-800 border border-gray-700 rounded-lg p-3 shadow-lg">
          <p className="text-white font-semibold">Size: {payload[0].payload.size}</p>
          <p className="text-green-500 font-bold">{payload[0].value.toLocaleString()} shipments</p>
        </div>
      );
    }
    return null;
  };

  const maxValue = Math.max(...data.map(d => d.count), 0);
  const yAxisMax = Math.ceil(maxValue / 200) * 200 || 600;

  return (
    <div className="bg-gray-900 rounded-lg shadow-lg p-8 w-full border border-gray-800">
      <div className="mb-6">
        <h3 className="text-white font-bold text-lg mb-1">Shipment Size Distribution</h3>
        <p className="text-gray-400 text-sm">Distribution of different package sizes</p>
      </div>

      {loading ? (
        <div className="h-[400px] flex items-center justify-center">
          <p className="text-gray-400">Loading chart data...</p>
        </div>
      ) : error ? (
        <div className="h-[400px] flex items-center justify-center">
          <p className="text-red-400">Error: {error}</p>
        </div>
      ) : data.length === 0 ? (
        <div className="h-[400px] flex items-center justify-center">
          <p className="text-gray-400">No data available</p>
        </div>
      ) : (
        <ResponsiveContainer width="100%" height={400}>
          <BarChart data={data} margin={{ top: 20, right: 30, left: 20, bottom: 60 }}>
            <CartesianGrid strokeDasharray="3 3" stroke="#374151" />
            <XAxis 
              dataKey="size" 
              stroke="#9CA3AF"
              tick={{ fill: '#9CA3AF', fontSize: 12 }}
              angle={-45}
              textAnchor="end"
              height={60}
            />
            <YAxis 
              stroke="#9CA3AF"
              tick={{ fill: '#9CA3AF', fontSize: 12 }}
              domain={[0, yAxisMax]}
            />
            <Tooltip content={customTooltip} />
            <Bar 
              dataKey="count" 
              fill="#22C55E"
              radius={[4, 4, 0, 0]}
            />
          </BarChart>
        </ResponsiveContainer>
      )}
    </div>
  );
}

