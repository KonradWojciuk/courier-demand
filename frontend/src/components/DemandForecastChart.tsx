'use client';

import { useEffect, useState } from 'react';
import { ComposedChart, Line, Bar, XAxis, YAxis, CartesianGrid, ResponsiveContainer, Tooltip, Legend, ReferenceLine } from 'recharts';

interface DailyData {
  day: number;
  value: number;
  forecast?: number;
  forecastMin?: number;
  forecastMax?: number;
}

interface ChartResponse {
  data: DailyData[];
}

type DayTypeFilter = 'all' | 'weekday' | 'weekend';

interface FleetDataPoint {
  day: number;
  totalTrucks: number;
  packages: number;
}

interface DemandForecastChartProps {
  onForecastDataChange?: (data: DailyData[]) => void;
  fleetData?: FleetDataPoint[];
}

export default function DemandForecastChart({ onForecastDataChange, fleetData = [] }: DemandForecastChartProps) {
  const [historicalData, setHistoricalData] = useState<DailyData[]>([]);
  const [forecastData, setForecastData] = useState<DailyData[]>([]);
  const [combinedData, setCombinedData] = useState<DailyData[]>([]);
  const [loading, setLoading] = useState(true);
  const [maxValue, setMaxValue] = useState(320);
  const [selectedMonths, setSelectedMonths] = useState(3); // Number of months to use for forecast
  const [selectedTerminal, setSelectedTerminal] = useState<string>('');
  const [availableTerminals, setAvailableTerminals] = useState<string[]>([]);
  const [dayTypeFilter, setDayTypeFilter] = useState<DayTypeFilter>('all');
  const [forecastMonth, setForecastMonth] = useState(() => {
    const nextMonth = new Date();
    nextMonth.setMonth(nextMonth.getMonth() + 1);
    return nextMonth.getMonth() + 1;
  });
  const [forecastYear, setForecastYear] = useState(() => {
    const nextMonth = new Date();
    nextMonth.setMonth(nextMonth.getMonth() + 1);
    return nextMonth.getFullYear();
  });

  // Notify parent component when forecast data changes
  useEffect(() => {
    if (onForecastDataChange && forecastData.length > 0) {
      onForecastDataChange(forecastData);
    }
  }, [forecastData, onForecastDataChange]);

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

  // Helper function to check if a day is weekend
  const isWeekend = (year: number, month: number, day: number): boolean => {
    const date = new Date(year, month - 1, day);
    const dayOfWeek = date.getDay();
    return dayOfWeek === 0 || dayOfWeek === 6; // Sunday = 0, Saturday = 6
  };

  // Filter data by day type
  const filterByDayType = (data: DailyData[], year: number, month: number, filter: DayTypeFilter): DailyData[] => {
    if (filter === 'all') return data;
    
    return data.filter(day => {
      const isWeekendDay = isWeekend(year, month, day.day);
      if (filter === 'weekend') return isWeekendDay;
      if (filter === 'weekday') return !isWeekendDay;
      return true;
    });
  };

  // Fetch available terminals
  useEffect(() => {
    const fetchTerminals = async () => {
      try {
        const apiUrl = process.env.NEXT_PUBLIC_API_URL || 'http://localhost:3001';
        const response = await fetch(`${apiUrl}/api/packets/all-receiver-terminals`);
        
        if (response.ok) {
          const result = await response.json();
          const terminals = result.data?.map((item: any) => item.terminal) || [];
          setAvailableTerminals(terminals.sort());
        } else {
          console.error('Failed to fetch terminals:', response.status);
        }
      } catch (err) {
        console.error('Error fetching terminals:', err);
      }
    };

    fetchTerminals();
  }, []);

  // Calculate forecast based on historical data
  const calculateForecast = (
    historical: DailyData[][], 
    historicalMeta: Array<{year: number, month: number}>,
    filter: DayTypeFilter,
    targetYear: number,
    targetMonth: number
  ): DailyData[] => {
    if (historical.length === 0) return [];

    const forecastYear = targetYear;
    const forecastMonth = targetMonth;
    const daysInForecastMonth = new Date(forecastYear, forecastMonth, 0).getDate();

    const forecast: DailyData[] = [];

    // Filter historical data by day type if needed
    const filteredHistorical = historical.map((monthData, idx) => {
      const meta = historicalMeta[idx];
      if (meta) {
        return filterByDayType(monthData, meta.year, meta.month, filter);
      }
      return monthData;
    });

    // Calculate average daily value across all historical months (filtered)
    const allValues = filteredHistorical.flat().map(d => d.value).filter(v => v > 0);
    const overallAverage = allValues.length > 0 
      ? allValues.reduce((a, b) => a + b, 0) / allValues.length 
      : 0;

    // Calculate trend (simple linear regression on monthly averages)
    const monthlyAverages = filteredHistorical.map(monthData => {
      const values = monthData.map(d => d.value).filter(v => v > 0);
      return values.length > 0 ? values.reduce((a, b) => a + b, 0) / values.length : 0;
    });

    let trend = 0;
    if (monthlyAverages.length > 1) {
      const n = monthlyAverages.length;
      const sumX = (n * (n + 1)) / 2;
      const sumY = monthlyAverages.reduce((a, b) => a + b, 0);
      const sumXY = monthlyAverages.reduce((sum, val, idx) => sum + (idx + 1) * val, 0);
      const sumXX = (n * (n + 1) * (2 * n + 1)) / 6;
      
      trend = (n * sumXY - sumX * sumY) / (n * sumXX - sumX * sumX);
    }

    // Calculate day-of-week patterns (if we have enough data)
    const dayOfWeekPatterns: { [key: number]: number[] } = {};
    filteredHistorical.forEach((monthData, idx) => {
      const meta = historicalMeta[idx];
      if (meta) {
        monthData.forEach((day) => {
          const date = new Date(meta.year, meta.month - 1, day.day);
          const dayOfWeek = date.getDay();
          if (!dayOfWeekPatterns[dayOfWeek]) {
            dayOfWeekPatterns[dayOfWeek] = [];
          }
          if (day.value > 0) {
            dayOfWeekPatterns[dayOfWeek].push(day.value);
          }
        });
      }
    });

    // Calculate average for each day of week
    const dayOfWeekAverages: { [key: number]: number } = {};
    Object.keys(dayOfWeekPatterns).forEach(dow => {
      const values = dayOfWeekPatterns[parseInt(dow)];
      dayOfWeekAverages[parseInt(dow)] = values.length > 0
        ? values.reduce((a, b) => a + b, 0) / values.length
        : overallAverage;
    });

    // Generate forecast for each day
    for (let day = 1; day <= daysInForecastMonth; day++) {
      const date = new Date(forecastYear, forecastMonth - 1, day);
      const dayOfWeek = date.getDay();
      const isWeekendDay = dayOfWeek === 0 || dayOfWeek === 6;
      
      // Skip days that don't match the filter
      if (filter === 'weekend' && !isWeekendDay) continue;
      if (filter === 'weekday' && isWeekendDay) continue;
      
      // Base forecast: overall average + trend projection
      const baseForecast = overallAverage + (trend * (filteredHistorical.length + 1));
      
      // Apply day-of-week pattern if available
      let forecastValue = baseForecast;
      if (dayOfWeekAverages[dayOfWeek]) {
        // Weight: 70% day-of-week pattern, 30% trend
        forecastValue = (dayOfWeekAverages[dayOfWeek] * 0.7) + (baseForecast * 0.3);
      }

      // Calculate confidence interval (±20% for now, could be more sophisticated)
      const stdDev = allValues.length > 1
        ? Math.sqrt(allValues.reduce((sum, val) => sum + Math.pow(val - overallAverage, 2), 0) / allValues.length)
        : overallAverage * 0.2;

      forecast.push({
        day,
        value: 0, // Historical value (none for forecast month)
        forecast: Math.max(0, Math.round(forecastValue)),
        forecastMin: Math.max(0, Math.round(forecastValue - stdDev)),
        forecastMax: Math.max(0, Math.round(forecastValue + stdDev))
      });
    }

    return forecast;
  };

  useEffect(() => {
    const fetchHistoricalData = async () => {
      setLoading(true);
      try {
        const apiUrl = process.env.NEXT_PUBLIC_API_URL || 'http://localhost:3001';
        const now = new Date();
        const historicalMonths: DailyData[][] = [];
        const historicalMonthsMeta: Array<{year: number, month: number}> = [];

        // Fetch data for the last N months, but work backwards from the forecast month
        // This ensures we get historical data relative to what we're forecasting
        const forecastDate = new Date(forecastYear, forecastMonth - 1, 1);
        
        for (let i = selectedMonths - 1; i >= 0; i--) {
          const date = new Date(forecastDate);
          date.setMonth(date.getMonth() - i - 1); // Go back from forecast month
          const month = date.getMonth() + 1;
          const year = date.getFullYear();

          try {
            let url = `${apiUrl}/api/packets/daily?month=${month}&year=${year}`;
            if (selectedTerminal) {
              url += `&terminal=${encodeURIComponent(selectedTerminal)}`;
            }
            const response = await fetch(url);

            if (response.ok) {
              const result: ChartResponse = await response.json();
              // Only add if we have actual data (not all zeros)
              const hasData = result.data && result.data.length > 0 && result.data.some(d => d.value > 0);
              if (hasData) {
                historicalMonths.push(result.data);
                historicalMonthsMeta.push({ year, month });
              }
            }
          } catch (err) {
            console.error(`Error fetching data for ${month}/${year}:`, err);
          }
        }

        // Validate we have historical data
        if (historicalMonths.length === 0) {
          console.warn('No historical data available for forecast');
          setForecastData([]);
          setHistoricalData([]);
          setCombinedData([]);
          setMaxValue(320);
          setLoading(false);
          return;
        }

        // Use the selected forecast month/year from state (use state variables)
        // Calculate forecast with day type filter
        const forecast = calculateForecast(historicalMonths, historicalMonthsMeta, dayTypeFilter, forecastYear, forecastMonth);
        setForecastData(forecast);

        // Use the most recent month's data for comparison
        const lastMonthData = historicalMonths.length > 0 
          ? historicalMonths[historicalMonths.length - 1] 
          : [];
        
        // Get the last month from historical data (most recent month we have data for)
        let lastMonthMeta = historicalMonthsMeta.length > 0 
          ? historicalMonthsMeta[historicalMonthsMeta.length - 1]
          : null;
        
        // If no historical data, use the month before forecast month
        if (!lastMonthMeta) {
          const forecastDate = new Date(forecastYear, forecastMonth - 1, 1);
          forecastDate.setMonth(forecastDate.getMonth() - 1);
          lastMonthMeta = {
            year: forecastDate.getFullYear(),
            month: forecastDate.getMonth() + 1
          };
        }
        
        // Filter last month data by day type
        const filteredLastMonthData = lastMonthMeta
          ? filterByDayType(
              lastMonthData, 
              lastMonthMeta.year, 
              lastMonthMeta.month, 
              dayTypeFilter
            )
          : [];
        setHistoricalData(filteredLastMonthData);
        
        // Combine last month + forecast for display
        // Show them with same day numbers (1-31) for easy comparison
        const daysInLastMonth = lastMonthMeta 
          ? new Date(lastMonthMeta.year, lastMonthMeta.month, 0).getDate()
          : 31;
        const daysInForecastMonth = new Date(forecastYear, forecastMonth, 0).getDate();
        const maxDays = Math.max(daysInLastMonth, daysInForecastMonth);
        
        const combined: DailyData[] = [];
        
        for (let day = 1; day <= maxDays; day++) {
          const historicalDay = filteredLastMonthData.find(d => d.day === day);
          const forecastDay = forecast.find(d => d.day === day);
          
          // Check if this day should be included based on filter
          // Use forecast month/year for determining weekend if forecast exists, otherwise use last month
          const checkYear = forecastDay ? forecastYear : (lastMonthMeta?.year || forecastYear);
          const checkMonth = forecastDay ? forecastMonth : (lastMonthMeta?.month || forecastMonth);
          const isWeekendDay = isWeekend(checkYear, checkMonth, day);
          
          let shouldInclude = true;
          if (dayTypeFilter === 'weekend' && !isWeekendDay) shouldInclude = false;
          if (dayTypeFilter === 'weekday' && isWeekendDay) shouldInclude = false;
          
          if (shouldInclude && (historicalDay || forecastDay)) {
            combined.push({
              day,
              value: historicalDay?.value || 0,
              forecast: forecastDay?.forecast,
              forecastMin: forecastDay?.forecastMin,
              forecastMax: forecastDay?.forecastMax
            });
          }
        }

        setCombinedData(combined);

        // Calculate max value for Y-axis
        const allValues = [
          ...combined.map(d => d.value),
          ...forecast.map(d => d.forecast || 0),
          ...forecast.map(d => d.forecastMax || 0)
        ].filter(v => !isNaN(v));
        const max = allValues.length > 0 ? Math.max(...allValues) : 320;
        setMaxValue(Math.ceil(max / 80) * 80 || 320);

      } catch (err) {
        console.error('Error fetching forecast data:', err);
      } finally {
        setLoading(false);
      }
    };

    fetchHistoricalData();
  }, [selectedMonths, selectedTerminal, dayTypeFilter, forecastMonth, forecastYear]);

  // Generate Y-axis ticks
  const yAxisTicks = [];
  const step = Math.max(80, Math.ceil(maxValue / 4));
  for (let i = 0; i <= maxValue; i += step) {
    yAxisTicks.push(i);
  }

  // Custom tooltip
  const customTooltip = ({ active, payload }: any) => {
    if (active && payload && payload.length) {
      const data = payload[0].payload;
      const hasHistorical = data.value !== undefined && data.value > 0;
      const hasForecast = data.forecast !== undefined;
      const hasFleet = data.totalTrucks !== undefined && data.totalTrucks > 0;
      
      return (
        <div className="bg-gray-800 border border-gray-700 rounded-lg p-3 shadow-lg">
          <p className="text-white font-semibold">Day {data.day}</p>
          {hasHistorical && (
            <p className="text-green-500 font-bold">
              {lastMonthName}: {data.value.toLocaleString()} packages
            </p>
          )}
          {hasForecast && (
            <>
              <p className="text-blue-400 font-bold">
                {forecastMonthName} {forecastYear} Forecast: {data.forecast?.toLocaleString() || 0} packages
              </p>
              {data.forecastMin !== undefined && data.forecastMax !== undefined && (
                <p className="text-gray-400 text-xs mt-1">
                  Range: {data.forecastMin.toLocaleString()} - {data.forecastMax.toLocaleString()}
                </p>
              )}
            </>
          )}
          {hasFleet && (
            <p className="text-yellow-400 font-bold mt-1">
              Fleet: {data.totalTrucks} trucks required
            </p>
          )}
        </div>
      );
    }
    return null;
  };

  // Get the last month name for display
  const now = new Date();
  const lastMonth = new Date(now.getFullYear(), now.getMonth() - 1, 1);
  const lastMonthName = monthNames[lastMonth.getMonth()];
  const forecastMonthName = monthNames[forecastMonth - 1];

  return (
    <div className="bg-gray-900 rounded-lg shadow-lg p-8 w-full border border-gray-800">
      <div className="mb-8 flex items-center justify-between flex-wrap gap-4">
        <div>
          <h3 className="text-white font-bold text-xl mb-1">Demand Forecast</h3>
          <p className="text-gray-400 text-sm">
            Comparing {lastMonthName} actual vs {monthNames[forecastMonth - 1]} {forecastYear} forecast (based on last {selectedMonths} months)
          </p>
        </div>
        <div className="flex gap-3 items-center flex-wrap">
          <div className="flex gap-2 items-center">
            <label htmlFor="months-select" className="text-gray-300 text-sm">
              Historical Months:
            </label>
            <select
              id="months-select"
              value={selectedMonths}
              onChange={(e) => setSelectedMonths(Number(e.target.value))}
              className="bg-gray-800 text-white border border-gray-700 rounded px-3 py-2 text-sm focus:outline-none focus:border-green-500"
            >
              <option value={2}>Last 2 months</option>
              <option value={3}>Last 3 months</option>
              <option value={6}>Last 6 months</option>
            </select>
          </div>
          
          <div className="flex gap-2 items-center">
            <label htmlFor="terminal-select" className="text-gray-300 text-sm">
              Terminal:
            </label>
            <select
              id="terminal-select"
              value={selectedTerminal}
              onChange={(e) => setSelectedTerminal(e.target.value)}
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
            <label htmlFor="day-type-select" className="text-gray-300 text-sm">
              Day Type:
            </label>
            <select
              id="day-type-select"
              value={dayTypeFilter}
              onChange={(e) => setDayTypeFilter(e.target.value as DayTypeFilter)}
              className="bg-gray-800 text-white border border-gray-700 rounded px-3 py-2 text-sm focus:outline-none focus:border-green-500"
            >
              <option value="all">All Days</option>
              <option value="weekday">Weekdays Only</option>
              <option value="weekend">Weekends Only</option>
            </select>
          </div>

          <div className="flex gap-2 items-center">
            <label htmlFor="forecast-month-select" className="text-gray-300 text-sm">
              Forecast Month:
            </label>
            <select
              id="forecast-month-select"
              value={forecastMonth}
              onChange={(e) => setForecastMonth(Number(e.target.value))}
              className="bg-gray-800 text-white border border-gray-700 rounded px-3 py-2 text-sm focus:outline-none focus:border-green-500"
            >
              {monthNames.map((month, index) => (
                <option key={index} value={index + 1}>
                  {month}
                </option>
              ))}
            </select>
            <select
              id="forecast-year-select"
              value={forecastYear}
              onChange={(e) => setForecastYear(Number(e.target.value))}
              className="bg-gray-800 text-white border border-gray-700 rounded px-3 py-2 text-sm focus:outline-none focus:border-green-500"
            >
              {[new Date().getFullYear(), new Date().getFullYear() + 1, new Date().getFullYear() + 2].map((year) => (
                <option key={year} value={year}>
                  {year}
                </option>
              ))}
            </select>
          </div>
        </div>
      </div>

      {loading ? (
        <div className="h-[600px] flex items-center justify-center">
          <p className="text-gray-400">Loading forecast data...</p>
        </div>
      ) : combinedData.length === 0 || historicalData.length === 0 ? (
        <div className="h-[600px] flex items-center justify-center">
          <div className="text-center">
            <p className="text-gray-400 mb-2">No historical data available for the selected period</p>
            <p className="text-gray-500 text-sm">Please ensure you have data for months before {monthNames[forecastMonth - 1]} {forecastYear}</p>
            <p className="text-gray-500 text-sm mt-1">Currently available: October 2025</p>
          </div>
        </div>
      ) : (
        <>
          <ResponsiveContainer width="100%" height={600}>
            <ComposedChart data={combinedData.map((d, idx) => {
              // Merge fleet data if available
              const fleetPoint = fleetData.find(f => f.day === d.day);
              return {
                ...d,
                totalTrucks: fleetPoint?.totalTrucks || 0
              };
            })} margin={{ top: 20, right: 30, left: 20, bottom: 80 }}>
              <CartesianGrid strokeDasharray="3 3" stroke="#374151" />
              <XAxis 
                dataKey="day" 
                stroke="#9CA3AF"
                tick={{ fill: '#9CA3AF', fontSize: 11 }}
                interval={Math.max(0, Math.floor(combinedData.length / 30))}
                angle={-45}
                textAnchor="end"
                height={60}
                label={{ value: `Day of Month (${lastMonthName} vs ${forecastMonthName} ${forecastYear} Forecast)`, position: 'insideBottom', offset: -10, fill: '#9CA3AF' }}
              />
              <YAxis 
                yAxisId="packages"
                stroke="#9CA3AF"
                tick={{ fill: '#9CA3AF', fontSize: 12 }}
                domain={[0, maxValue]}
                ticks={yAxisTicks}
                label={{ value: 'Packages', angle: -90, position: 'insideLeft', fill: '#9CA3AF' }}
              />
              {fleetData.length > 0 && (
                <YAxis 
                  yAxisId="trucks"
                  orientation="right"
                  stroke="#F59E0B"
                  tick={{ fill: '#F59E0B', fontSize: 12 }}
                  domain={[0, Math.max(...fleetData.map(f => f.totalTrucks), 0) + 2]}
                  label={{ value: 'Trucks', angle: 90, position: 'insideRight', fill: '#F59E0B' }}
                />
              )}
              <Tooltip content={customTooltip} />
              <Legend 
                wrapperStyle={{ paddingTop: '20px' }}
                iconType="line"
              />
              
              {/* Historical data line */}
              <Line 
                type="monotone" 
                dataKey="value" 
                stroke="#22C55E" 
                strokeWidth={2}
                dot={{ fill: '#22C55E', r: 3 }}
                activeDot={{ r: 5 }}
                name={`${lastMonthName} (Actual)`}
                connectNulls={false}
              />
              
              {/* Forecast line */}
              <Line 
                type="monotone" 
                dataKey="forecast" 
                stroke="#3B82F6" 
                strokeWidth={2}
                strokeDasharray="5 5"
                dot={{ fill: '#3B82F6', r: 3 }}
                activeDot={{ r: 5 }}
                name={`${forecastMonthName} ${forecastYear} (Forecast)`}
                connectNulls={false}
              />
              
              {/* Forecast confidence interval (min) - hidden from legend */}
              <Line 
                yAxisId="packages"
                type="monotone" 
                dataKey="forecastMin" 
                stroke="#3B82F6" 
                strokeWidth={1}
                strokeOpacity={0.3}
                dot={false}
                name=""
                connectNulls={false}
                hide={true}
              />
              
              {/* Forecast confidence interval (max) - hidden from legend */}
              <Line 
                yAxisId="packages"
                type="monotone" 
                dataKey="forecastMax" 
                stroke="#3B82F6" 
                strokeWidth={1}
                strokeOpacity={0.3}
                dot={false}
                name=""
                connectNulls={false}
                hide={true}
              />
              
              {/* Fleet requirements bar */}
              {fleetData.length > 0 && (
                <Bar 
                  yAxisId="trucks"
                  dataKey="totalTrucks" 
                  fill="#F59E0B"
                  opacity={0.6}
                  name="Fleet Requirements (Trucks)"
                />
              )}
            </ComposedChart>
          </ResponsiveContainer>
          
          {/* Forecast summary */}
          {forecastData.length > 0 && (
            <div className="mt-6 p-4 bg-blue-900/20 border border-blue-700/50 rounded-lg">
              <h4 className="text-white font-semibold mb-3">Forecast Summary</h4>
              <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
                <div>
                  <p className="text-gray-400 text-sm">Total Forecasted</p>
                  <p className="text-blue-400 text-2xl font-bold">
                    {forecastData.reduce((sum, d) => sum + (d.forecast || 0), 0).toLocaleString()}
                  </p>
                  <p className="text-gray-500 text-xs">packages</p>
                </div>
                <div>
                  <p className="text-gray-400 text-sm">Daily Average</p>
                  <p className="text-blue-400 text-2xl font-bold">
                    {Math.round(forecastData.reduce((sum, d) => sum + (d.forecast || 0), 0) / forecastData.length).toLocaleString()}
                  </p>
                  <p className="text-gray-500 text-xs">packages/day</p>
                </div>
                <div>
                  <p className="text-gray-400 text-sm">Peak Day</p>
                  <p className="text-blue-400 text-2xl font-bold">
                    Day {forecastData.reduce((max, d, idx) => (d.forecast || 0) > (forecastData[max]?.forecast || 0) ? idx : max, 0) + 1}
                  </p>
                  <p className="text-gray-500 text-xs">
                    {Math.max(...forecastData.map(d => d.forecast || 0)).toLocaleString()} packages
                  </p>
                </div>
              </div>
            </div>
          )}
        </>
      )}
    </div>
  );
}
