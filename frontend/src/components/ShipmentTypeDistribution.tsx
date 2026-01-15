'use client';

import { useEffect, useState } from 'react';
import { PieChart, Pie, Cell, ResponsiveContainer, Tooltip, Legend } from 'recharts';

interface TypeData {
  type: string;
  count: number;
}

interface DistributionResponse {
  data: TypeData[];
}

const COLORS = ['#22C55E', '#3B82F6', '#8B5CF6', '#F59E0B', '#EF4444', '#06B6D4', '#EC4899', '#84CC16'];

export default function ShipmentTypeDistribution() {
  const [data, setData] = useState<TypeData[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    const fetchData = async () => {
      setLoading(true);
      try {
        const apiUrl = process.env.NEXT_PUBLIC_API_URL || 'http://localhost:3001';
        const response = await fetch(`${apiUrl}/api/packets/shipment-type-distribution`);
        
        if (!response.ok) {
          throw new Error('Failed to fetch shipment type distribution');
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
          <p className="text-white font-semibold">{payload[0].name}</p>
          <p className="text-green-500 font-bold">{payload[0].value.toLocaleString()} shipments</p>
          <p className="text-gray-400 text-sm">
            {((payload[0].value / data.reduce((sum, item) => sum + item.count, 0)) * 100).toFixed(1)}%
          </p>
        </div>
      );
    }
    return null;
  };

  return (
    <div className="bg-gray-900 rounded-lg shadow-lg p-8 w-full border border-gray-800">
      <div className="mb-6">
        <h3 className="text-white font-bold text-lg mb-1">Shipment Type Distribution</h3>
        <p className="text-gray-400 text-sm">Distribution of different package types</p>
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
          <PieChart>
            <Pie
              data={data}
              cx="50%"
              cy="50%"
              labelLine={false}
              label={({ name, percent }) => `${name}: ${(percent * 100).toFixed(0)}%`}
              outerRadius={120}
              fill="#8884d8"
              dataKey="count"
              nameKey="type"
            >
              {data.map((entry, index) => (
                <Cell key={`cell-${index}`} fill={COLORS[index % COLORS.length]} />
              ))}
            </Pie>
            <Tooltip content={customTooltip} />
            <Legend />
          </PieChart>
        </ResponsiveContainer>
      )}
    </div>
  );
}

