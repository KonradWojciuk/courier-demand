'use client';

import { useEffect, useState } from 'react';
import { Building2 } from 'lucide-react';

interface BottomTerminalData {
  terminal: string;
  count: number;
}

export default function BottomTerminalCard() {
  const [data, setData] = useState<BottomTerminalData | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    const fetchBottomTerminal = async () => {
      try {
        const apiUrl = process.env.NEXT_PUBLIC_API_URL || 'http://localhost:3001';
        const response = await fetch(`${apiUrl}/api/packets/bottom-terminal`);
        
        if (!response.ok) {
          throw new Error('Failed to fetch bottom terminal');
        }
        
        const data: BottomTerminalData = await response.json();
        setData(data);
      } catch (err) {
        setError(err instanceof Error ? err.message : 'An error occurred');
      } finally {
        setLoading(false);
      }
    };

    fetchBottomTerminal();
  }, []);

  return (
    <div className="bg-gray-900 rounded-lg shadow-lg p-8 w-full max-w-sm border border-gray-800 flex flex-col items-center text-center">
      <div className="mb-6">
        <Building2 className="w-8 h-8 text-green-500 mx-auto" />
      </div>
      
      <h2 className="text-white font-bold text-lg mb-4">Lowest Terminal</h2>
      
      <div className="mb-4">
        {loading ? (
          <div className="text-4xl font-bold text-green-500">...</div>
        ) : error ? (
          <div className="text-4xl font-bold text-red-500">Error</div>
        ) : (
          <>
            <div className="text-2xl font-bold text-white mb-2">
              {data?.terminal || 'N/A'}
            </div>
            <div className="text-4xl font-bold text-green-500">
              {data?.count.toLocaleString() || 0}
            </div>
          </>
        )}
      </div>
      
      <p className="text-sm text-gray-400">Total packages</p>
    </div>
  );
}

