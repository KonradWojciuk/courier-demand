'use client';

import { useEffect, useState } from 'react';
import { Package } from 'lucide-react';

interface ShipmentsData {
  count: number;
}

export default function ShipmentsCard() {
  const [count, setCount] = useState<number | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    const fetchCount = async () => {
      try {
        const apiUrl = process.env.NEXT_PUBLIC_API_URL || 'http://localhost:3001';
        const response = await fetch(`${apiUrl}/api/packets/count`);
        
        if (!response.ok) {
          throw new Error('Failed to fetch shipments count');
        }
        
        const data: ShipmentsData = await response.json();
        setCount(data.count);
      } catch (err) {
        setError(err instanceof Error ? err.message : 'An error occurred');
      } finally {
        setLoading(false);
      }
    };

    fetchCount();
  }, []);

  return (
    <div className="bg-gray-900 rounded-lg shadow-lg p-8 w-full max-w-sm border border-gray-800 flex flex-col items-center text-center">
      <div className="mb-6">
        <Package className="w-8 h-8 text-green-500 mx-auto" />
      </div>
      
      <h2 className="text-white font-bold text-lg mb-4">Total Shipments</h2>
      
      <div className="mb-4">
        {loading ? (
          <div className="text-4xl font-bold text-green-500">...</div>
        ) : error ? (
          <div className="text-4xl font-bold text-red-500">Error</div>
        ) : (
          <div className="text-4xl font-bold text-green-500">
            {count?.toLocaleString() || 0}
          </div>
        )}
      </div>
      
      <p className="text-sm text-gray-400">All time cumulative</p>
    </div>
  );
}

