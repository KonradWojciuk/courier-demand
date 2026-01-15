'use client';

import { useEffect, useState } from 'react';
import { BarChart, Bar, XAxis, YAxis, CartesianGrid, ResponsiveContainer, Tooltip, Legend, Cell } from 'recharts';

interface DailyForecastData {
  day: number;
  forecast?: number;
  forecastMin?: number;
  forecastMax?: number;
}

interface FleetRequirement {
  day: number;
  packages: number;
  regularTrucks: number;
  largeTrucks: number;
  totalTrucks: number;
  regularCapacity: number;
  largeCapacity: number;
  totalCapacity: number;
  assignedRegularTrucks?: number;
  assignedLargeTrucks?: number;
  remainingPackages?: number;
}

interface FleetDemandForecastProps {
  forecastData: DailyForecastData[];
  regularTruckCapacity?: number;
  largeTruckCapacityMin?: number;
  largeTruckCapacityMax?: number;
  onFleetDataChange?: (data: Array<{day: number; totalTrucks: number; packages: number}>) => void;
}

export default function FleetDemandForecast({
  forecastData,
  regularTruckCapacity = 2200,
  largeTruckCapacityMin = 2400,
  largeTruckCapacityMax = 2800,
  onFleetDataChange
}: FleetDemandForecastProps) {
  const [fleetRequirements, setFleetRequirements] = useState<FleetRequirement[]>([]);
  const [optimizationStrategy, setOptimizationStrategy] = useState<'cost' | 'capacity'>('cost');
  const [useLargeTrucks, setUseLargeTrucks] = useState(true);
  const [selectedTerminal, setSelectedTerminal] = useState<string>('');
  const [availableTerminals, setAvailableTerminals] = useState<string[]>([]);
  const [selectedDay, setSelectedDay] = useState<number | null>(null);
  const [selectedMonth, setSelectedMonth] = useState(() => {
    const nextMonth = new Date();
    nextMonth.setMonth(nextMonth.getMonth() + 1);
    return nextMonth.getMonth() + 1;
  });
  const [selectedYear, setSelectedYear] = useState(() => {
    const nextMonth = new Date();
    nextMonth.setMonth(nextMonth.getMonth() + 1);
    return nextMonth.getFullYear();
  });
  const [terminalSpecificData, setTerminalSpecificData] = useState<DailyForecastData | null>(null);
  const [terminalMonthData, setTerminalMonthData] = useState<DailyForecastData[]>([]);
  const [loading, setLoading] = useState(false);
  const [manualAssignments, setManualAssignments] = useState<Record<number, { regular: number; large: number }>>({});

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

  const monthNames = [
    'January', 'February', 'March', 'April', 'May', 'June',
    'July', 'August', 'September', 'October', 'November', 'December'
  ];

  // Fetch available sender terminals
  useEffect(() => {
    const fetchTerminals = async () => {
      try {
        const apiUrl = process.env.NEXT_PUBLIC_API_URL || 'http://localhost:3001';
        const response = await fetch(`${apiUrl}/api/packets/all-sender-terminals`);
        
        if (response.ok) {
          const result = await response.json();
          const terminals = result.data?.map((item: any) => item.terminal) || [];
          setAvailableTerminals(terminals.sort());
        }
      } catch (err) {
        console.error('Error fetching terminals:', err);
      }
    };

    fetchTerminals();
  }, []);

  // Fetch terminal-specific data when terminal is selected
  useEffect(() => {
    if (!selectedTerminal) {
      setTerminalSpecificData(null);
      return;
    }

    const fetchTerminalData = async () => {
      setLoading(true);
      try {
        const apiUrl = process.env.NEXT_PUBLIC_API_URL || 'http://localhost:3001';
        
        // Fetch data for all days of the selected month
        // We'll calculate forecast for each day based on historical data
        const daysInMonth = new Date(selectedYear, selectedMonth, 0).getDate();
        const forecastDataForMonth: DailyForecastData[] = [];
        
        for (let day = 1; day <= daysInMonth; day++) {
          // Fetch historical data for this day of month from last 3 months
          const historicalData: number[] = [];
          for (let i = 1; i <= 3; i++) {
            const date = new Date(selectedYear, selectedMonth - 1 - i, 1);
            const month = date.getMonth() + 1;
            const year = date.getFullYear();
            
            try {
              // Use sender_terminal by passing terminal_type=sender
              const url = `${apiUrl}/api/packets/daily?month=${month}&year=${year}&terminal=${encodeURIComponent(selectedTerminal)}&terminal_type=sender`;
              const response = await fetch(url);
              
              if (response.ok) {
                const result = await response.json();
                const dayData = result.data?.find((d: any) => d.day === day);
                if (dayData && dayData.value > 0) {
                  historicalData.push(dayData.value);
                }
              }
            } catch (err) {
              console.error(`Error fetching data for ${month}/${year}, day ${day}:`, err);
            }
          }
          
          // Calculate forecast: average of historical values for this day
          const forecast = historicalData.length > 0
            ? Math.round(historicalData.reduce((a, b) => a + b, 0) / historicalData.length)
            : 0;
          
          forecastDataForMonth.push({
            day: day,
            forecast: forecast
          });
        }
        
        // Store all forecast data for the month
        setTerminalMonthData(forecastDataForMonth);
        
        // If a specific day is selected, use that day's data
        if (selectedDay !== null) {
          const dayData = forecastDataForMonth.find(d => d.day === selectedDay);
          setTerminalSpecificData(dayData || null);
        } else {
          setTerminalSpecificData(null);
        }
      } catch (err) {
        console.error('Error fetching terminal-specific data:', err);
        setTerminalSpecificData(null);
      } finally {
        setLoading(false);
      }
    };

    fetchTerminalData();
  }, [selectedTerminal, selectedMonth, selectedYear, selectedDay]);

  // Calculate fleet requirements based on forecast
  useEffect(() => {
    const calculateFleetRequirements = () => {
      const requirements: FleetRequirement[] = [];

      // If terminal is selected, we need to fetch data for all days of the month
      // For now, if terminal and day are selected, use terminal-specific data
      // But we should show all days for manual assignment
      let dataToProcess: DailyForecastData[] = [];
      if (selectedTerminal && selectedDay !== null && terminalSpecificData) {
        // For manual assignment, we need data for all days, not just selected day
        // So we'll use the terminal-specific data for the selected day, but also need to fetch others
        // For now, just use the selected day data
        dataToProcess = [terminalSpecificData];
      } else if (selectedTerminal && terminalSpecificData) {
        // Terminal selected but no specific day - use all forecast data
        dataToProcess = forecastData;
      } else if (selectedDay !== null) {
        // Filter by selected day only
        const dayData = forecastData.find(d => d.day === selectedDay);
        if (dayData) {
          dataToProcess = [dayData];
        }
      } else {
        // Use all forecast data
        dataToProcess = forecastData;
      }
      
      // If terminal is selected but we only have one day of data, we need to generate data for all days
      // For now, we'll work with what we have

      dataToProcess.forEach(dayData => {
        const packages = dayData.forecast || 0;
        
        if (packages === 0) {
          requirements.push({
            day: dayData.day,
            packages: 0,
            regularTrucks: 0,
            largeTrucks: 0,
            totalTrucks: 0,
            regularCapacity: 0,
            largeCapacity: 0,
            totalCapacity: 0
          });
          return;
        }

        let regularTrucks = 0;
        let largeTrucks = 0;
        let remainingPackages = packages;

        if (optimizationStrategy === 'cost') {
          // Cost optimization: prefer regular trucks (cheaper), use large trucks only when needed
          // Calculate how many regular trucks we need
          regularTrucks = Math.floor(remainingPackages / regularTruckCapacity);
          remainingPackages = remainingPackages % regularTruckCapacity;

          // If remaining packages fit in one regular truck, use one more regular truck
          // Otherwise, use large trucks for the remainder
          if (remainingPackages > 0) {
            if (useLargeTrucks && remainingPackages <= largeTruckCapacityMax) {
              // Check if it's more efficient to use one large truck or one more regular truck
              const regularTruckCost = remainingPackages / regularTruckCapacity; // Fractional cost
              const largeTruckCost = 1; // Full truck cost
              
              // Use large truck if remaining packages are significant (>60% of regular capacity)
              // or if it's more than one regular truck would handle
              if (remainingPackages > regularTruckCapacity * 0.6 || regularTruckCost > 1) {
                largeTrucks = 1;
                remainingPackages = 0;
              } else {
                regularTrucks += 1;
                remainingPackages = 0;
              }
            } else {
              regularTrucks += 1;
              remainingPackages = 0;
            }
          }
        } else {
          // Capacity optimization: prefer large trucks (more capacity per vehicle)
          if (useLargeTrucks) {
            largeTrucks = Math.floor(remainingPackages / largeTruckCapacityMax);
            remainingPackages = remainingPackages % largeTruckCapacityMax;

            // Fill remaining with regular trucks or one more large truck
            if (remainingPackages > 0) {
              if (remainingPackages <= regularTruckCapacity) {
                regularTrucks = 1;
              } else {
                largeTrucks += 1;
              }
              remainingPackages = 0;
            }
          } else {
            // Only use regular trucks
            regularTrucks = Math.ceil(remainingPackages / regularTruckCapacity);
            remainingPackages = 0;
          }
        }

        const regularCapacity = regularTrucks * regularTruckCapacity;
        const largeCapacity = largeTrucks * largeTruckCapacityMax;
        const totalCapacity = regularCapacity + largeCapacity;
        const totalTrucks = regularTrucks + largeTrucks;

        // Get manual assignments if any
        const manual = manualAssignments[dayData.day];
        const assignedRegularTrucks = manual !== undefined ? manual.regular : regularTrucks;
        const assignedLargeTrucks = manual !== undefined ? manual.large : largeTrucks;
        const assignedCapacity = (assignedRegularTrucks * regularTruckCapacity) + (assignedLargeTrucks * largeTruckCapacityMax);
        const finalRemainingPackages = Math.max(0, packages - assignedCapacity);

        requirements.push({
          day: dayData.day,
          packages,
          regularTrucks,
          largeTrucks,
          totalTrucks,
          regularCapacity,
          largeCapacity,
          totalCapacity,
          assignedRegularTrucks,
          assignedLargeTrucks,
          remainingPackages: finalRemainingPackages
        });
      });

      setFleetRequirements(requirements);
      
      // Notify parent component of fleet data changes
      if (onFleetDataChange) {
        const fleetDataForChart = requirements.map(r => ({
          day: r.day,
          totalTrucks: (r.assignedRegularTrucks !== undefined ? r.assignedRegularTrucks : r.regularTrucks) + 
                       (r.assignedLargeTrucks !== undefined ? r.assignedLargeTrucks : r.largeTrucks),
          packages: r.packages
        }));
        onFleetDataChange(fleetDataForChart);
      }
    };

    calculateFleetRequirements();
  }, [forecastData, optimizationStrategy, useLargeTrucks, regularTruckCapacity, largeTruckCapacityMax, selectedTerminal, selectedDay, terminalSpecificData, terminalMonthData, manualAssignments, onFleetDataChange]);

  // Use fleet requirements directly (no weekly grouping)
  const processedFleetRequirements = fleetRequirements;

  // Calculate summary statistics
  const totalPackages = processedFleetRequirements.reduce((sum, r) => sum + r.packages, 0);
  const totalRegularTrucks = processedFleetRequirements.reduce((sum, r) => sum + (r.assignedRegularTrucks !== undefined ? r.assignedRegularTrucks : r.regularTrucks), 0);
  const totalLargeTrucks = processedFleetRequirements.reduce((sum, r) => sum + (r.assignedLargeTrucks !== undefined ? r.assignedLargeTrucks : r.largeTrucks), 0);
  const totalTrucks = totalRegularTrucks + totalLargeTrucks;
  const totalAssignedCapacity = (totalRegularTrucks * regularTruckCapacity) + (totalLargeTrucks * largeTruckCapacityMax);
  const totalRemainingPackages = processedFleetRequirements.reduce((sum, r) => sum + (r.remainingPackages || 0), 0);
  const totalAdditionalCapacity = totalAssignedCapacity > totalPackages ? totalAssignedCapacity - totalPackages : 0;
  const peakDay = processedFleetRequirements.reduce((max, r) => (r.assignedRegularTrucks !== undefined ? r.assignedRegularTrucks : r.regularTrucks) + (r.assignedLargeTrucks !== undefined ? r.assignedLargeTrucks : r.largeTrucks) > (max.assignedRegularTrucks !== undefined ? max.assignedRegularTrucks : max.regularTrucks) + (max.assignedLargeTrucks !== undefined ? max.assignedLargeTrucks : max.largeTrucks) ? r : max, processedFleetRequirements[0] || { day: 0, totalTrucks: 0 });
  const averageDailyTrucks = processedFleetRequirements.length > 0 ? totalTrucks / processedFleetRequirements.length : 0;

  // Prepare chart data
  const chartData = processedFleetRequirements.map(r => ({
    day: r.day,
    'Regular Trucks': r.assignedRegularTrucks !== undefined ? r.assignedRegularTrucks : r.regularTrucks,
    'Large Trucks': r.assignedLargeTrucks !== undefined ? r.assignedLargeTrucks : r.largeTrucks,
    'Total Packages': r.packages,
    'Remaining Packages': r.remainingPackages || 0
  }));

  // Handle manual assignment changes
  const handleManualAssignment = (day: number, type: 'regular' | 'large', value: string) => {
    const numValue = parseInt(value) || 0;
    setManualAssignments(prev => ({
      ...prev,
      [day]: {
        regular: type === 'regular' ? numValue : (prev[day]?.regular || 0),
        large: type === 'large' ? numValue : (prev[day]?.large || 0)
      }
    }));
  };

  // Custom tooltip
  const customTooltip = ({ active, payload }: any) => {
    if (active && payload && payload.length) {
      const data = payload[0].payload;
      const requirement = processedFleetRequirements.find(r => r.day === data.day);
      const assignedRegular = requirement?.assignedRegularTrucks !== undefined ? requirement.assignedRegularTrucks : (requirement?.regularTrucks || 0);
      const assignedLarge = requirement?.assignedLargeTrucks !== undefined ? requirement.assignedLargeTrucks : (requirement?.largeTrucks || 0);
      const remaining = requirement?.remainingPackages || 0;
      
      return (
        <div className="bg-gray-800 border border-gray-700 rounded-lg p-3 shadow-lg">
          <p className="text-white font-semibold mb-2">Day {data.day}</p>
          <p className="text-blue-400 font-bold mb-1">
            Packages: {requirement?.packages.toLocaleString() || 0}
          </p>
          <p className="text-green-400">
            Regular Trucks: {assignedRegular} ({regularTruckCapacity.toLocaleString()} pkg each)
          </p>
          <p className="text-purple-400">
            Large Trucks: {assignedLarge} ({largeTruckCapacityMax.toLocaleString()} pkg each)
          </p>
          <p className="text-yellow-400 font-semibold mt-1">
            Total Trucks: {assignedRegular + assignedLarge}
          </p>
          {remaining > 0 && (
            <p className="text-red-400 font-semibold mt-1">
              Remaining: {remaining.toLocaleString()} packages
            </p>
          )}
        </div>
      );
    }
    return null;
  };

  const maxTrucks = Math.max(...processedFleetRequirements.map(r => (r.assignedRegularTrucks || r.regularTrucks) + (r.assignedLargeTrucks || r.largeTrucks)), 0);
  const yAxisMax = Math.ceil(maxTrucks / 5) * 5 || 10;

  return (
    <div className="bg-gray-900 rounded-lg shadow-lg p-8 w-full border border-gray-800">
      <div className="mb-8 flex items-center justify-between flex-wrap gap-4">
        <div>
          <h3 className="text-white font-bold text-xl mb-1">Fleet Demand Forecast</h3>
          <p className="text-gray-400 text-sm">
            Vehicle requirements based on package forecast
          </p>
        </div>
        <div className="flex gap-3 items-center flex-wrap">
          <div className="flex gap-2 items-center">
            <label htmlFor="terminal-select-fleet" className="text-gray-300 text-sm">
              Terminal:
            </label>
            <select
              id="terminal-select-fleet"
              value={selectedTerminal}
              onChange={(e) => {
                setSelectedTerminal(e.target.value);
                if (!e.target.value) {
                  setSelectedDay(null);
                }
              }}
              className="bg-gray-800 text-white border border-gray-700 rounded px-3 py-2 text-sm focus:outline-none focus:border-green-500 min-w-[180px]"
            >
              <option value="">All Terminals</option>
              {availableTerminals.map((terminal) => (
                <option key={terminal} value={terminal}>
                  {terminalCityMap[terminal] || terminal} ({terminal})
                </option>
              ))}
            </select>
          </div>

          <div className="flex gap-2 items-center">
            <label htmlFor="month-select-fleet" className="text-gray-300 text-sm">
              Month:
            </label>
            <select
              id="month-select-fleet"
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
              id="year-select-fleet"
              value={selectedYear}
              onChange={(e) => setSelectedYear(Number(e.target.value))}
              className="bg-gray-800 text-white border border-gray-700 rounded px-3 py-2 text-sm focus:outline-none focus:border-green-500"
            >
              {[new Date().getFullYear(), new Date().getFullYear() + 1, new Date().getFullYear() + 2].map((year) => (
                <option key={year} value={year}>
                  {year}
                </option>
              ))}
            </select>
          </div>

          <div className="flex gap-2 items-center">
            <label htmlFor="day-select" className="text-gray-300 text-sm">
              Day:
            </label>
            <select
              id="day-select"
              value={selectedDay || ''}
              onChange={(e) => setSelectedDay(e.target.value ? Number(e.target.value) : null)}
              className="bg-gray-800 text-white border border-gray-700 rounded px-3 py-2 text-sm focus:outline-none focus:border-green-500"
            >
              <option value="">Select Day</option>
              {Array.from({ length: new Date(selectedYear, selectedMonth, 0).getDate() }, (_, i) => i + 1).map((day) => (
                <option key={day} value={day}>
                  Day {day}
                </option>
              ))}
            </select>
          </div>

          <div className="flex gap-2 items-center">
            <label htmlFor="optimization-select" className="text-gray-300 text-sm">
              Strategy:
            </label>
            <select
              id="optimization-select"
              value={optimizationStrategy}
              onChange={(e) => setOptimizationStrategy(e.target.value as 'cost' | 'capacity')}
              className="bg-gray-800 text-white border border-gray-700 rounded px-3 py-2 text-sm focus:outline-none focus:border-green-500"
            >
              <option value="cost">Cost Optimization</option>
              <option value="capacity">Capacity Optimization</option>
            </select>
          </div>
          <div className="flex gap-2 items-center">
            <label className="flex items-center gap-2 text-gray-300 text-sm">
              <input
                type="checkbox"
                checked={useLargeTrucks}
                onChange={(e) => setUseLargeTrucks(e.target.checked)}
                className="w-4 h-4 text-green-600 bg-gray-700 border-gray-600 rounded focus:ring-green-500"
              />
              Use Large Trucks
            </label>
          </div>

        </div>
      </div>

      {!selectedTerminal ? (
        <div className="h-[400px] flex items-center justify-center">
          <div className="text-center">
            <p className="text-gray-400 mb-2">Please select a sender terminal to view fleet requirements</p>
            <p className="text-gray-500 text-sm">Select a terminal, forecast month/year, and optionally a specific day</p>
          </div>
        </div>
      ) : loading ? (
        <div className="h-[400px] flex items-center justify-center">
          <p className="text-gray-400">Loading terminal-specific data...</p>
        </div>
      ) : processedFleetRequirements.length === 0 ? (
        <div className="h-[400px] flex items-center justify-center">
          <p className="text-gray-400">
            No forecast data available for {terminalCityMap[selectedTerminal] || selectedTerminal} on {monthNames[selectedMonth - 1]} {selectedYear}, Day {selectedDay}
          </p>
        </div>
      ) : (
        <>
          {/* Terminal/Day Selection Info */}
          {selectedTerminal && selectedDay !== null && (
            <div className="mb-6 p-4 bg-blue-900/20 border border-blue-700/50 rounded-lg">
              <h4 className="text-white font-semibold mb-2">Selected Filters</h4>
              <div className="flex gap-4 flex-wrap">
                <div>
                  <p className="text-gray-400 text-sm">Sender Terminal</p>
                  <p className="text-blue-400 font-bold">
                    {terminalCityMap[selectedTerminal] || selectedTerminal} ({selectedTerminal})
                  </p>
                </div>
                <div>
                  <p className="text-gray-400 text-sm">Month</p>
                  <p className="text-blue-400 font-bold">{monthNames[selectedMonth - 1]} {selectedYear}</p>
                </div>
                <div>
                  <p className="text-gray-400 text-sm">Day</p>
                  <p className="text-blue-400 font-bold">Day {selectedDay}</p>
                </div>
              </div>
            </div>
          )}

          {/* Summary Cards */}
          <div className="grid grid-cols-1 md:grid-cols-6 gap-4 mb-6">
            <div className="bg-blue-900/20 border border-blue-700/50 rounded-lg p-4">
              <p className="text-gray-400 text-sm mb-1">Total Packages</p>
              <p className="text-blue-400 text-2xl font-bold">{totalPackages.toLocaleString()}</p>
            </div>
            <div className="bg-green-900/20 border border-green-700/50 rounded-lg p-4">
              <p className="text-gray-400 text-sm mb-1">Regular Trucks</p>
              <p className="text-green-400 text-2xl font-bold">{totalRegularTrucks.toLocaleString()}</p>
              <p className="text-gray-500 text-xs mt-1">({regularTruckCapacity.toLocaleString()} pkg each)</p>
            </div>
            <div className="bg-purple-900/20 border border-purple-700/50 rounded-lg p-4">
              <p className="text-gray-400 text-sm mb-1">Large Trucks</p>
              <p className="text-purple-400 text-2xl font-bold">{totalLargeTrucks.toLocaleString()}</p>
              <p className="text-gray-500 text-xs mt-1">({largeTruckCapacityMax.toLocaleString()} pkg each)</p>
            </div>
            <div className="bg-yellow-900/20 border border-yellow-700/50 rounded-lg p-4">
              <p className="text-gray-400 text-sm mb-1">Total Trucks</p>
              <p className="text-yellow-400 text-2xl font-bold">{totalTrucks.toLocaleString()}</p>
              <p className="text-gray-500 text-xs mt-1">Avg: {Math.round(averageDailyTrucks)}/day</p>
            </div>
            <div className={`border rounded-lg p-4 ${totalRemainingPackages > 0 ? 'bg-red-900/20 border-red-700/50' : 'bg-green-900/20 border-green-700/50'}`}>
              <p className="text-gray-400 text-sm mb-1">Remaining Packages</p>
              <p className={`text-2xl font-bold ${totalRemainingPackages > 0 ? 'text-red-400' : 'text-green-400'}`}>
                {totalRemainingPackages > 0 ? `-${totalRemainingPackages.toLocaleString()}` : '0'}
              </p>
              <p className="text-gray-500 text-xs mt-1">
                {totalRemainingPackages > 0 ? 'Need more trucks' : 'All assigned'}
              </p>
            </div>
            <div className={`border rounded-lg p-4 ${totalAdditionalCapacity > 0 ? 'bg-green-900/20 border-green-700/50' : 'bg-gray-800/20 border-gray-700/50'}`}>
              <p className="text-gray-400 text-sm mb-1">Additional Capacity</p>
              <p className={`text-2xl font-bold ${totalAdditionalCapacity > 0 ? 'text-green-400' : 'text-gray-400'}`}>
                {totalAdditionalCapacity > 0 ? `+${totalAdditionalCapacity.toLocaleString()}` : '0'}
              </p>
              <p className="text-gray-500 text-xs mt-1">
                {totalAdditionalCapacity > 0 ? 'Extra capacity' : 'No surplus'}
              </p>
            </div>
          </div>

          {/* Peak Day Info */}
          {peakDay.totalTrucks > 0 && (
            <div className="mb-6 p-4 bg-orange-900/20 border border-orange-700/50 rounded-lg">
              <h4 className="text-white font-semibold mb-2">Peak Demand Day</h4>
              <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
                <div>
                  <p className="text-gray-400 text-sm">Peak Day</p>
                  <p className="text-orange-400 text-xl font-bold">Day {peakDay.day}</p>
                </div>
                <div>
                  <p className="text-gray-400 text-sm">Packages</p>
                  <p className="text-orange-400 text-xl font-bold">{peakDay.packages.toLocaleString()}</p>
                </div>
                <div>
                  <p className="text-gray-400 text-sm">Vehicles Required</p>
                  <p className="text-orange-400 text-xl font-bold">
                    {peakDay.totalTrucks} trucks
                    {peakDay.regularTrucks > 0 && <span className="text-sm text-green-400"> ({peakDay.regularTrucks} regular)</span>}
                    {peakDay.largeTrucks > 0 && <span className="text-sm text-purple-400"> ({peakDay.largeTrucks} large)</span>}
                  </p>
                </div>
              </div>
            </div>
          )}

          {/* Manual Assignment Table */}
          <div className="mb-6 overflow-x-auto">
            <h4 className="text-white font-semibold mb-3">Manual Truck Assignment</h4>
            <div className="bg-gray-800/50 rounded-lg border border-gray-700 overflow-hidden">
              <table className="w-full">
                <thead className="bg-gray-800">
                  <tr>
                    <th className="px-4 py-3 text-left text-gray-300 text-sm font-semibold">Day</th>
                    <th className="px-4 py-3 text-left text-gray-300 text-sm font-semibold">Packages</th>
                    <th className="px-4 py-3 text-left text-gray-300 text-sm font-semibold">Regular Trucks</th>
                    <th className="px-4 py-3 text-left text-gray-300 text-sm font-semibold">Large Trucks</th>
                    <th className="px-4 py-3 text-left text-gray-300 text-sm font-semibold">Assigned Capacity</th>
                    <th className="px-4 py-3 text-left text-gray-300 text-sm font-semibold">Remaining</th>
                    <th className="px-4 py-3 text-left text-gray-300 text-sm font-semibold">Additional (+)</th>
                  </tr>
                </thead>
                <tbody>
                  {processedFleetRequirements.map((req) => {
                    const assignedRegular = req.assignedRegularTrucks !== undefined ? req.assignedRegularTrucks : req.regularTrucks;
                    const assignedLarge = req.assignedLargeTrucks !== undefined ? req.assignedLargeTrucks : req.largeTrucks;
                    const assignedCapacity = (assignedRegular * regularTruckCapacity) + (assignedLarge * largeTruckCapacityMax);
                    const remaining = req.remainingPackages || 0;
                    const additionalCapacity = assignedCapacity > req.packages ? assignedCapacity - req.packages : 0;
                    
                    return (
                      <tr key={req.day} className="border-t border-gray-700">
                        <td className="px-4 py-3 text-white">
                          Day {req.day}
                        </td>
                        <td className="px-4 py-3 text-blue-400 font-semibold">{req.packages.toLocaleString()}</td>
                        <td className="px-4 py-3">
                          <input
                            type="number"
                            min="0"
                            step="1"
                            value={assignedRegular}
                            onChange={(e) => handleManualAssignment(req.day, 'regular', e.target.value)}
                            className="w-20 bg-gray-700 text-white border border-gray-600 rounded px-2 py-1 text-sm focus:outline-none focus:border-green-500"
                          />
                        </td>
                        <td className="px-4 py-3">
                          <input
                            type="number"
                            min="0"
                            step="1"
                            value={assignedLarge}
                            onChange={(e) => handleManualAssignment(req.day, 'large', e.target.value)}
                            className="w-20 bg-gray-700 text-white border border-gray-600 rounded px-2 py-1 text-sm focus:outline-none focus:border-green-500"
                          />
                        </td>
                        <td className="px-4 py-3 text-gray-300">{assignedCapacity.toLocaleString()}</td>
                        <td className={`px-4 py-3 font-semibold ${remaining > 0 ? 'text-red-400' : 'text-green-400'}`}>
                          {remaining > 0 ? `-${remaining.toLocaleString()}` : '0'}
                        </td>
                        <td className={`px-4 py-3 font-semibold ${additionalCapacity > 0 ? 'text-green-400' : 'text-gray-500'}`}>
                          {additionalCapacity > 0 ? `+${additionalCapacity.toLocaleString()}` : '0'}
                        </td>
                      </tr>
                    );
                  })}
                </tbody>
              </table>
            </div>
          </div>

          {/* Chart */}
          <ResponsiveContainer width="100%" height={500}>
            <BarChart data={chartData} margin={{ top: 20, right: 30, left: 20, bottom: 80 }}>
              <CartesianGrid strokeDasharray="3 3" stroke="#374151" />
              <XAxis 
                dataKey="day" 
                stroke="#9CA3AF"
                tick={{ fill: '#9CA3AF', fontSize: 11 }}
                interval={Math.max(0, Math.floor(chartData.length / 30))}
                angle={-45}
                textAnchor="end"
                height={60}
                label={{ value: 'Day of Month', position: 'insideBottom', offset: -10, fill: '#9CA3AF' }}
              />
              <YAxis 
                stroke="#9CA3AF"
                tick={{ fill: '#9CA3AF', fontSize: 12 }}
                domain={[0, yAxisMax]}
                label={{ value: 'Number of Trucks', angle: -90, position: 'insideLeft', fill: '#9CA3AF' }}
              />
              <Tooltip content={customTooltip} />
              <Legend 
                wrapperStyle={{ paddingTop: '20px' }}
                iconType="square"
              />
              <Bar 
                dataKey="Regular Trucks" 
                stackId="trucks"
                fill="#22C55E"
                name="Regular Trucks"
              />
              <Bar 
                dataKey="Large Trucks" 
                stackId="trucks"
                fill="#A855F7"
                name="Large Trucks"
              />
            </BarChart>
          </ResponsiveContainer>

          {/* Vehicle Capacity Info */}
          <div className="mt-6 p-4 bg-gray-800/50 border border-gray-700 rounded-lg">
            <h4 className="text-white font-semibold mb-3">Vehicle Specifications</h4>
            <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
              <div>
                <p className="text-green-400 font-semibold mb-1">Regular Truck + Semi-trailer</p>
                <p className="text-gray-400 text-sm">Capacity: {regularTruckCapacity.toLocaleString()} packages</p>
              </div>
              <div>
                <p className="text-purple-400 font-semibold mb-1">Long Truck + Large Semi-trailer</p>
                <p className="text-gray-400 text-sm">Capacity: {largeTruckCapacityMin.toLocaleString()} - {largeTruckCapacityMax.toLocaleString()} packages</p>
                <p className="text-gray-500 text-xs mt-1">(Using {largeTruckCapacityMax.toLocaleString()} for calculations)</p>
              </div>
            </div>
          </div>
        </>
      )}
    </div>
  );
}
