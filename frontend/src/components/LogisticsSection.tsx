'use client';

import { useState } from 'react';
import DemandForecastChart from '@/components/DemandForecastChart';
import FleetDemandForecast from '@/components/FleetDemandForecast';

export default function LogisticsSection() {
  const [forecastData, setForecastData] = useState<Array<{day: number; forecast?: number; forecastMin?: number; forecastMax?: number}>>([]);
  const [fleetData, setFleetData] = useState<Array<{day: number; totalTrucks: number; packages: number}>>([]);

  return (
    <>
      <DemandForecastChart 
        onForecastDataChange={setForecastData}
        fleetData={fleetData}
      />
      <div className="mt-8">
        <div className="mb-6">
          <div className="p-4 bg-gray-800/50 rounded-lg border-t-4 border-green-500 text-center">
            <h2 className="text-white text-lg font-semibold mb-1">Fleet Demand Forecast</h2>
            <p className="text-gray-400 text-sm">Calculate vehicle requirements based on package forecast</p>
          </div>
        </div>
        <FleetDemandForecast 
          forecastData={forecastData}
          onFleetDataChange={setFleetData}
        />
      </div>
    </>
  );
}
