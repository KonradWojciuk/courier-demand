const express = require('express');
const { trinoClient } = require('../db/trinoClient');
const fs = require('fs');
const path = require('path');

const router = express.Router();

// Load city locations from CSV file
// CSV format: city,latitude,longitude,terminal,terminal_city,postcode,distance_km
// Returns a Map of city name -> {latitude, longitude, terminal}
function loadCityLocations() {
  const csvPath = path.join(__dirname, '../data/terminal-locations.csv');
  if (!fs.existsSync(csvPath)) {
    console.warn('City locations CSV file not found:', csvPath);
    return new Map();
  }
  
  const csvContent = fs.readFileSync(csvPath, 'utf-8');
  const lines = csvContent.split('\n').filter(line => line.trim());
  const locations = new Map();
  
    // Skip header line
    for (let i = 1; i < lines.length; i++) {
      const parts = lines[i].split(',');
      // CSV format: city,latitude,longitude,terminal,terminal_city,postcode,distance_km
      // Need at least 4 columns: city, latitude, longitude, terminal
      if (parts.length >= 4) {
        const city = parts[0]?.trim();
        const latitude = parseFloat(parts[1]?.trim());
        const longitude = parseFloat(parts[2]?.trim());
        const terminal = parts[3]?.trim();
        
        if (city && !isNaN(latitude) && !isNaN(longitude)) {
          // Use city name as key (normalize to lowercase for case-insensitive matching)
          const cityKey = city.toLowerCase();
          // Keep the first occurrence of each city
          if (!locations.has(cityKey)) {
            locations.set(cityKey, {
              city: city,
              latitude: latitude,
              longitude: longitude,
              terminal: terminal || ''
            });
          }
        }
      }
    }
    
    console.log(`Loaded ${locations.size} city locations from CSV`);
  
  return locations;
}

router.get('/count', async (req, res) => {
  try {
    const catalog = process.env.TRINO_CATALOG || 'hive';
    const schema = process.env.TRINO_SCHEMA || 'default';
    const tableName = 'shipments';
    
    try {
      const syncQuery = `CALL system.sync_partition_metadata('${schema}', '${tableName}', 'FULL')`;
      const syncIterator = await trinoClient.query(syncQuery);
      for await (const _ of syncIterator) {
      }
    } catch (syncError) {
      console.error('Error syncing partitions:', syncError.message);
    }
    
    const query = `SELECT COUNT(*) AS total FROM ${catalog}.${schema}.${tableName}`;
    const queryIterator = await trinoClient.query(query);
    
    let count = 0;
    for await (const queryResult of queryIterator) {
      if (queryResult.data && queryResult.data.length > 0) {
        const row = queryResult.data[0];
        if (Array.isArray(row) && row.length > 0) {
          count = Number(row[0]);
        }
      }
    }
    
    res.json({ count });
  } catch (error) {
    res.status(500).json({ error: 'Failed to count packets', message: error.message });
  }
});

router.get('/weekly/debug', async (req, res) => {
  try {
    const catalog = process.env.TRINO_CATALOG || 'hive';
    const schema = process.env.TRINO_SCHEMA || 'default';
    const tableName = 'shipments';
    
    try {
      const syncQuery = `CALL system.sync_partition_metadata('${schema}', '${tableName}', 'FULL')`;
      const syncIterator = await trinoClient.query(syncQuery);
      for await (const _ of syncIterator) {
      }
    } catch (syncError) {
      console.error('Error syncing partitions:', syncError.message);
    }
    
    // Get sample dates to see the format
    const query = `
      SELECT DISTINCT date_of_shipment
      FROM ${catalog}.${schema}.${tableName}
      WHERE date_of_shipment IS NOT NULL
      LIMIT 10
    `;
    
    const queryIterator = await trinoClient.query(query);
    const sampleDates = [];
    
    for await (const queryResult of queryIterator) {
      if (queryResult.data && queryResult.data.length > 0) {
        queryResult.data.forEach(row => {
          if (Array.isArray(row) && row.length > 0) {
            sampleDates.push(row[0]);
          }
        });
      }
    }
    
    res.json({ sampleDates, message: 'Check date format' });
  } catch (error) {
    res.status(500).json({ error: 'Failed to debug', message: error.message });
  }
});

router.get('/daily', async (req, res) => {
  try {
    const catalog = process.env.TRINO_CATALOG || 'hive';
    const schema = process.env.TRINO_SCHEMA || 'default';
    const tableName = 'shipments';
    
    // Get month and year from query params (default to current month)
    const { month, year, terminal } = req.query;
    const selectedMonth = month || new Date().getMonth() + 1;
    const selectedYear = year || new Date().getFullYear();
    const monthStr = String(selectedMonth).padStart(2, '0');
    
    try {
      const syncQuery = `CALL system.sync_partition_metadata('${schema}', '${tableName}', 'FULL')`;
      const syncIterator = await trinoClient.query(syncQuery);
      for await (const _ of syncIterator) {
      }
    } catch (syncError) {
      console.error('Error syncing partitions:', syncError.message);
    }
    
    // Build WHERE clause with optional terminal filter
    // Support both receiver_terminal and sender_terminal via terminal_type parameter
    const { terminal_type } = req.query;
    const useSenderTerminal = terminal_type === 'sender';
    
    let whereClause = `date_of_shipment IS NOT NULL 
        AND date_of_shipment LIKE '${selectedYear}-${monthStr}-%'`;
    
    if (terminal) {
      if (useSenderTerminal) {
        whereClause += ` AND sender_terminal = '${terminal}'`;
      } else {
        whereClause += ` AND receiver_terminal = '${terminal}'`;
      }
    }
    
    // Query using partition column directly - date format is YYYY-MM-DD
    const query = `
      SELECT 
        date_of_shipment,
        COUNT(*) AS count
      FROM ${catalog}.${schema}.${tableName}
      WHERE ${whereClause}
      GROUP BY date_of_shipment
      ORDER BY date_of_shipment
    `;
    
    const queryIterator = await trinoClient.query(query);
    
    const dailyDataMap = {};
    for await (const queryResult of queryIterator) {
      if (queryResult.data && queryResult.data.length > 0) {
        queryResult.data.forEach(row => {
          if (Array.isArray(row) && row.length >= 2) {
            const dateStr = String(row[0]);
            const count = Number(row[1]);
            
            // Extract day from date (YYYY-MM-DD format)
            const dateParts = dateStr.split('-');
            if (dateParts.length === 3) {
              const day = parseInt(dateParts[2], 10);
              if (!isNaN(day) && day >= 1 && day <= 31) {
                dailyDataMap[day] = count;
              }
            }
          }
        });
      }
    }
    
    // Get number of days in the selected month
    const daysInMonth = new Date(selectedYear, selectedMonth, 0).getDate();
    
    // Build result array with all days, filling missing days with 0
    const result = [];
    for (let day = 1; day <= daysInMonth; day++) {
      result.push({
        day: day,
        value: dailyDataMap[day] || 0
      });
    }
    
    res.json({ data: result });
  } catch (error) {
    console.error('Error in daily endpoint:', error);
    res.status(500).json({ error: 'Failed to get daily data', message: error.message });
  }
});

router.get('/average-weekly', async (req, res) => {
  try {
    const catalog = process.env.TRINO_CATALOG || 'hive';
    const schema = process.env.TRINO_SCHEMA || 'default';
    const tableName = 'shipments';
    
    try {
      const syncQuery = `CALL system.sync_partition_metadata('${schema}', '${tableName}', 'FULL')`;
      const syncIterator = await trinoClient.query(syncQuery);
      for await (const _ of syncIterator) {
      }
    } catch (syncError) {
      console.error('Error syncing partitions:', syncError.message);
    }
    
    // Calculate average shipments per week
    const query = `
      SELECT 
        COUNT(*) AS total_count,
        MIN(CAST(date_of_shipment AS DATE)) AS first_date,
        MAX(CAST(date_of_shipment AS DATE)) AS last_date
      FROM ${catalog}.${schema}.${tableName}
      WHERE date_of_shipment IS NOT NULL
    `;
    
    const queryIterator = await trinoClient.query(query);
    
    let totalCount = 0;
    let firstDate = null;
    let lastDate = null;
    
    for await (const queryResult of queryIterator) {
      if (queryResult.data && queryResult.data.length > 0) {
        const row = queryResult.data[0];
        if (Array.isArray(row) && row.length >= 3) {
          totalCount = Number(row[0]);
          firstDate = row[1];
          lastDate = row[2];
        }
      }
    }
    
    // Calculate number of weeks
    let averageWeekly = 0;
    if (firstDate && lastDate && totalCount > 0) {
      const first = new Date(firstDate);
      const last = new Date(lastDate);
      const daysDiff = Math.max(1, Math.ceil((last - first) / (1000 * 60 * 60 * 24)));
      const weeksDiff = Math.max(1, Math.ceil(daysDiff / 7));
      averageWeekly = Math.round(totalCount / weeksDiff);
    }
    
    res.json({ average: averageWeekly });
  } catch (error) {
    console.error('Error in average-weekly endpoint:', error);
    res.status(500).json({ error: 'Failed to get average weekly data', message: error.message });
  }
});

router.get('/average-monthly', async (req, res) => {
  try {
    const catalog = process.env.TRINO_CATALOG || 'hive';
    const schema = process.env.TRINO_SCHEMA || 'default';
    const tableName = 'shipments';
    
    try {
      const syncQuery = `CALL system.sync_partition_metadata('${schema}', '${tableName}', 'FULL')`;
      const syncIterator = await trinoClient.query(syncQuery);
      for await (const _ of syncIterator) {
      }
    } catch (syncError) {
      console.error('Error syncing partitions:', syncError.message);
    }
    
    // Calculate average shipments per month
    const query = `
      SELECT 
        COUNT(*) AS total_count,
        MIN(CAST(date_of_shipment AS DATE)) AS first_date,
        MAX(CAST(date_of_shipment AS DATE)) AS last_date
      FROM ${catalog}.${schema}.${tableName}
      WHERE date_of_shipment IS NOT NULL
    `;
    
    const queryIterator = await trinoClient.query(query);
    
    let totalCount = 0;
    let firstDate = null;
    let lastDate = null;
    
    for await (const queryResult of queryIterator) {
      if (queryResult.data && queryResult.data.length > 0) {
        const row = queryResult.data[0];
        if (Array.isArray(row) && row.length >= 3) {
          totalCount = Number(row[0]);
          firstDate = row[1];
          lastDate = row[2];
        }
      }
    }
    
    // Calculate number of months
    let averageMonthly = 0;
    if (firstDate && lastDate && totalCount > 0) {
      const first = new Date(firstDate);
      const last = new Date(lastDate);
      
      // Calculate months difference
      const yearDiff = last.getFullYear() - first.getFullYear();
      const monthDiff = last.getMonth() - first.getMonth();
      const totalMonths = Math.max(1, yearDiff * 12 + monthDiff + 1); // +1 to include both start and end months
      
      averageMonthly = Math.round(totalCount / totalMonths);
    }
    
    res.json({ average: averageMonthly });
  } catch (error) {
    console.error('Error in average-monthly endpoint:', error);
    res.status(500).json({ error: 'Failed to get average monthly data', message: error.message });
  }
});

router.get('/average-annual', async (req, res) => {
  try {
    const catalog = process.env.TRINO_CATALOG || 'hive';
    const schema = process.env.TRINO_SCHEMA || 'default';
    const tableName = 'shipments';
    
    try {
      const syncQuery = `CALL system.sync_partition_metadata('${schema}', '${tableName}', 'FULL')`;
      const syncIterator = await trinoClient.query(syncQuery);
      for await (const _ of syncIterator) {
      }
    } catch (syncError) {
      console.error('Error syncing partitions:', syncError.message);
    }
    
    // Calculate average shipments per year
    const query = `
      SELECT 
        COUNT(*) AS total_count,
        MIN(CAST(date_of_shipment AS DATE)) AS first_date,
        MAX(CAST(date_of_shipment AS DATE)) AS last_date
      FROM ${catalog}.${schema}.${tableName}
      WHERE date_of_shipment IS NOT NULL
    `;
    
    const queryIterator = await trinoClient.query(query);
    
    let totalCount = 0;
    let firstDate = null;
    let lastDate = null;
    
    for await (const queryResult of queryIterator) {
      if (queryResult.data && queryResult.data.length > 0) {
        const row = queryResult.data[0];
        if (Array.isArray(row) && row.length >= 3) {
          totalCount = Number(row[0]);
          firstDate = row[1];
          lastDate = row[2];
        }
      }
    }
    
    // Calculate number of years
    let averageAnnual = 0;
    if (firstDate && lastDate && totalCount > 0) {
      const first = new Date(firstDate);
      const last = new Date(lastDate);
      
      // Calculate years difference
      const yearDiff = last.getFullYear() - first.getFullYear();
      const monthDiff = last.getMonth() - first.getMonth();
      const dayDiff = last.getDate() - first.getDate();
      
      // Calculate fractional years for more accuracy
      const totalDays = Math.max(1, Math.ceil((last - first) / (1000 * 60 * 60 * 24)));
      const totalYears = Math.max(1, totalDays / 365.25); // Account for leap years
      
      averageAnnual = Math.round(totalCount / totalYears);
    }
    
    res.json({ average: averageAnnual });
  } catch (error) {
    console.error('Error in average-annual endpoint:', error);
    res.status(500).json({ error: 'Failed to get average annual data', message: error.message });
  }
});

router.get('/top-terminal', async (req, res) => {
  try {
    const catalog = process.env.TRINO_CATALOG || 'hive';
    const schema = process.env.TRINO_SCHEMA || 'default';
    const tableName = 'shipments';
    
    try {
      const syncQuery = `CALL system.sync_partition_metadata('${schema}', '${tableName}', 'FULL')`;
      const syncIterator = await trinoClient.query(syncQuery);
      for await (const _ of syncIterator) {
      }
    } catch (syncError) {
      console.error('Error syncing partitions:', syncError.message);
    }
    
    // Find terminal with the most packages (using receiver terminals only)
    const query = `
      SELECT 
        receiver_terminal AS terminal,
        COUNT(*) AS total_count
      FROM ${catalog}.${schema}.${tableName}
      WHERE receiver_terminal IS NOT NULL AND receiver_terminal != ''
      GROUP BY receiver_terminal
      ORDER BY total_count DESC
      LIMIT 1
    `;
    
    const queryIterator = await trinoClient.query(query);
    
    let terminalName = null;
    let packageCount = 0;
    
    for await (const queryResult of queryIterator) {
      if (queryResult.data && queryResult.data.length > 0) {
        const row = queryResult.data[0];
        if (Array.isArray(row) && row.length >= 2) {
          terminalName = String(row[0]);
          packageCount = Number(row[1]);
        }
      }
    }
    
    res.json({ terminal: terminalName || 'N/A', count: packageCount });
  } catch (error) {
    console.error('Error in top-terminal endpoint:', error);
    res.status(500).json({ error: 'Failed to get top terminal data', message: error.message });
  }
});

router.get('/bottom-terminal', async (req, res) => {
  try {
    const catalog = process.env.TRINO_CATALOG || 'hive';
    const schema = process.env.TRINO_SCHEMA || 'default';
    const tableName = 'shipments';
    
    try {
      const syncQuery = `CALL system.sync_partition_metadata('${schema}', '${tableName}', 'FULL')`;
      const syncIterator = await trinoClient.query(syncQuery);
      for await (const _ of syncIterator) {
      }
    } catch (syncError) {
      console.error('Error syncing partitions:', syncError.message);
    }
    
    // Find terminal with the fewest packages (using receiver terminals only)
    const query = `
      SELECT 
        receiver_terminal AS terminal,
        COUNT(*) AS total_count
      FROM ${catalog}.${schema}.${tableName}
      WHERE receiver_terminal IS NOT NULL AND receiver_terminal != ''
      GROUP BY receiver_terminal
      ORDER BY total_count ASC
      LIMIT 1
    `;
    
    const queryIterator = await trinoClient.query(query);
    
    let terminalName = null;
    let packageCount = 0;
    
    for await (const queryResult of queryIterator) {
      if (queryResult.data && queryResult.data.length > 0) {
        const row = queryResult.data[0];
        if (Array.isArray(row) && row.length >= 2) {
          terminalName = String(row[0]);
          packageCount = Number(row[1]);
        }
      }
    }
    
    res.json({ terminal: terminalName || 'N/A', count: packageCount });
  } catch (error) {
    console.error('Error in bottom-terminal endpoint:', error);
    res.status(500).json({ error: 'Failed to get bottom terminal data', message: error.message });
  }
});

router.get('/terminal-monthly-distribution', async (req, res) => {
  try {
    const catalog = process.env.TRINO_CATALOG || 'hive';
    const schema = process.env.TRINO_SCHEMA || 'default';
    const tableName = 'shipments';
    
    // Get month and year from query params (default to current month)
    const { month, year } = req.query;
    const selectedMonth = month || new Date().getMonth() + 1;
    const selectedYear = year || new Date().getFullYear();
    const monthStr = String(selectedMonth).padStart(2, '0');
    
    try {
      const syncQuery = `CALL system.sync_partition_metadata('${schema}', '${tableName}', 'FULL')`;
      const syncIterator = await trinoClient.query(syncQuery);
      for await (const _ of syncIterator) {
      }
    } catch (syncError) {
      console.error('Error syncing partitions:', syncError.message);
    }
    
    // Get packages per terminal for the selected month
    const query = `
      SELECT 
        receiver_terminal AS terminal,
        COUNT(*) AS count
      FROM ${catalog}.${schema}.${tableName}
      WHERE receiver_terminal IS NOT NULL 
        AND receiver_terminal != ''
        AND date_of_shipment IS NOT NULL
        AND date_of_shipment LIKE '${selectedYear}-${monthStr}-%'
      GROUP BY receiver_terminal
      ORDER BY count DESC
    `;
    
    const queryIterator = await trinoClient.query(query);
    
    const data = [];
    for await (const queryResult of queryIterator) {
      if (queryResult.data && queryResult.data.length > 0) {
        queryResult.data.forEach(row => {
          if (Array.isArray(row) && row.length >= 2) {
            data.push({
              terminal: String(row[0]),
              count: Number(row[1])
            });
          }
        });
      }
    }
    
    res.json({ data });
  } catch (error) {
    console.error('Error in terminal-monthly-distribution endpoint:', error);
    res.status(500).json({ error: 'Failed to get terminal monthly distribution', message: error.message });
  }
});

router.get('/terminal-weekly-distribution', async (req, res) => {
  try {
    const catalog = process.env.TRINO_CATALOG || 'hive';
    const schema = process.env.TRINO_SCHEMA || 'default';
    const tableName = 'shipments';
    
    // Get date range from query params
    const { startDate, endDate } = req.query;
    
    // Default to current week if not provided
    let startDateStr = startDate;
    let endDateStr = endDate;
    
    if (!startDate || !endDate) {
      const now = new Date();
      const currentDay = now.getDay();
      const diff = now.getDate() - currentDay + (currentDay === 0 ? -6 : 1); // Adjust to Monday
      const weekStart = new Date(now.setDate(diff));
      const weekEnd = new Date(weekStart);
      weekEnd.setDate(weekEnd.getDate() + 6);
      startDateStr = formatDate(weekStart);
      endDateStr = formatDate(weekEnd);
    }
    
    try {
      const syncQuery = `CALL system.sync_partition_metadata('${schema}', '${tableName}', 'FULL')`;
      const syncIterator = await trinoClient.query(syncQuery);
      for await (const _ of syncIterator) {
      }
    } catch (syncError) {
      console.error('Error syncing partitions:', syncError.message);
    }
    
    // Get packages per terminal for the selected week
    const query = `
      SELECT 
        receiver_terminal AS terminal,
        COUNT(*) AS count
      FROM ${catalog}.${schema}.${tableName}
      WHERE receiver_terminal IS NOT NULL 
        AND receiver_terminal != ''
        AND date_of_shipment IS NOT NULL
        AND CAST(date_of_shipment AS DATE) >= DATE '${startDateStr}'
        AND CAST(date_of_shipment AS DATE) <= DATE '${endDateStr}'
      GROUP BY receiver_terminal
      ORDER BY count DESC
    `;
    
    const queryIterator = await trinoClient.query(query);
    
    const data = [];
    for await (const queryResult of queryIterator) {
      if (queryResult.data && queryResult.data.length > 0) {
        queryResult.data.forEach(row => {
          if (Array.isArray(row) && row.length >= 2) {
            data.push({
              terminal: String(row[0]),
              count: Number(row[1])
            });
          }
        });
      }
    }
    
    res.json({ data });
  } catch (error) {
    console.error('Error in terminal-weekly-distribution endpoint:', error);
    res.status(500).json({ error: 'Failed to get terminal weekly distribution', message: error.message });
  }
});

router.get('/terminal-daily-distribution', async (req, res) => {
  try {
    const catalog = process.env.TRINO_CATALOG || 'hive';
    const schema = process.env.TRINO_SCHEMA || 'default';
    const tableName = 'shipments';
    
    // Get date from query params (default to today)
    const { date } = req.query;
    const selectedDate = date || formatDate(new Date());
    
    try {
      const syncQuery = `CALL system.sync_partition_metadata('${schema}', '${tableName}', 'FULL')`;
      const syncIterator = await trinoClient.query(syncQuery);
      for await (const _ of syncIterator) {
      }
    } catch (syncError) {
      console.error('Error syncing partitions:', syncError.message);
    }
    
    // Get packages per terminal for the selected date
    const query = `
      SELECT 
        receiver_terminal AS terminal,
        COUNT(*) AS count
      FROM ${catalog}.${schema}.${tableName}
      WHERE receiver_terminal IS NOT NULL 
        AND receiver_terminal != ''
        AND date_of_shipment IS NOT NULL
        AND date_of_shipment = '${selectedDate}'
      GROUP BY receiver_terminal
      ORDER BY count DESC
    `;
    
    const queryIterator = await trinoClient.query(query);
    
    const data = [];
    for await (const queryResult of queryIterator) {
      if (queryResult.data && queryResult.data.length > 0) {
        queryResult.data.forEach(row => {
          if (Array.isArray(row) && row.length >= 2) {
            data.push({
              terminal: String(row[0]),
              count: Number(row[1])
            });
          }
        });
      }
    }
    
    res.json({ data });
  } catch (error) {
    console.error('Error in terminal-daily-distribution endpoint:', error);
    res.status(500).json({ error: 'Failed to get terminal daily distribution', message: error.message });
  }
});

// Helper functions
function getWeekNumber(date) {
  const d = new Date(Date.UTC(date.getFullYear(), date.getMonth(), date.getDate()));
  const dayNum = d.getUTCDay() || 7;
  d.setUTCDate(d.getUTCDate() + 4 - dayNum);
  const yearStart = new Date(Date.UTC(d.getUTCFullYear(), 0, 1));
  return Math.ceil((((d - yearStart) / 86400000) + 1) / 7);
}

function getDateOfISOWeek(year, week) {
  const simple = new Date(year, 0, 1 + (week - 1) * 7);
  const dow = simple.getDay();
  const ISOweekStart = simple;
  if (dow <= 4) {
    ISOweekStart.setDate(simple.getDate() - simple.getDay() + 1);
  } else {
    ISOweekStart.setDate(simple.getDate() + 8 - simple.getDay());
  }
  return ISOweekStart;
}

function formatDate(date) {
  const year = date.getFullYear();
  const month = String(date.getMonth() + 1).padStart(2, '0');
  const day = String(date.getDate()).padStart(2, '0');
  return `${year}-${month}-${day}`;
}

router.get('/sender-terminal-monthly-distribution', async (req, res) => {
  try {
    const catalog = process.env.TRINO_CATALOG || 'hive';
    const schema = process.env.TRINO_SCHEMA || 'default';
    const tableName = 'shipments';
    
    // Get month and year from query params (default to current month)
    const { month, year } = req.query;
    const selectedMonth = month || new Date().getMonth() + 1;
    const selectedYear = year || new Date().getFullYear();
    const monthStr = String(selectedMonth).padStart(2, '0');
    
    try {
      const syncQuery = `CALL system.sync_partition_metadata('${schema}', '${tableName}', 'FULL')`;
      const syncIterator = await trinoClient.query(syncQuery);
      for await (const _ of syncIterator) {
      }
    } catch (syncError) {
      console.error('Error syncing partitions:', syncError.message);
    }
    
    // Get packages per sender terminal for the selected month
    const query = `
      SELECT 
        sender_terminal AS terminal,
        COUNT(*) AS count
      FROM ${catalog}.${schema}.${tableName}
      WHERE sender_terminal IS NOT NULL 
        AND sender_terminal != ''
        AND date_of_shipment IS NOT NULL
        AND date_of_shipment LIKE '${selectedYear}-${monthStr}-%'
      GROUP BY sender_terminal
      ORDER BY count DESC
    `;
    
    const queryIterator = await trinoClient.query(query);
    
    const data = [];
    for await (const queryResult of queryIterator) {
      if (queryResult.data && queryResult.data.length > 0) {
        queryResult.data.forEach(row => {
          if (Array.isArray(row) && row.length >= 2) {
            data.push({
              terminal: String(row[0]),
              count: Number(row[1])
            });
          }
        });
      }
    }
    
    res.json({ data });
  } catch (error) {
    console.error('Error in sender-terminal-monthly-distribution endpoint:', error);
    res.status(500).json({ error: 'Failed to get sender terminal monthly distribution', message: error.message });
  }
});

router.get('/sender-terminal-weekly-distribution', async (req, res) => {
  try {
    const catalog = process.env.TRINO_CATALOG || 'hive';
    const schema = process.env.TRINO_SCHEMA || 'default';
    const tableName = 'shipments';
    
    // Get date range from query params
    const { startDate, endDate } = req.query;
    
    // Default to current week if not provided
    let startDateStr = startDate;
    let endDateStr = endDate;
    
    if (!startDate || !endDate) {
      const now = new Date();
      const currentDay = now.getDay();
      const diff = now.getDate() - currentDay + (currentDay === 0 ? -6 : 1); // Adjust to Monday
      const weekStart = new Date(now.setDate(diff));
      const weekEnd = new Date(weekStart);
      weekEnd.setDate(weekEnd.getDate() + 6);
      startDateStr = formatDate(weekStart);
      endDateStr = formatDate(weekEnd);
    }
    
    try {
      const syncQuery = `CALL system.sync_partition_metadata('${schema}', '${tableName}', 'FULL')`;
      const syncIterator = await trinoClient.query(syncQuery);
      for await (const _ of syncIterator) {
      }
    } catch (syncError) {
      console.error('Error syncing partitions:', syncError.message);
    }
    
    // Get packages per sender terminal for the selected week
    const query = `
      SELECT 
        sender_terminal AS terminal,
        COUNT(*) AS count
      FROM ${catalog}.${schema}.${tableName}
      WHERE sender_terminal IS NOT NULL 
        AND sender_terminal != ''
        AND date_of_shipment IS NOT NULL
        AND CAST(date_of_shipment AS DATE) >= DATE '${startDateStr}'
        AND CAST(date_of_shipment AS DATE) <= DATE '${endDateStr}'
      GROUP BY sender_terminal
      ORDER BY count DESC
    `;
    
    const queryIterator = await trinoClient.query(query);
    
    const data = [];
    for await (const queryResult of queryIterator) {
      if (queryResult.data && queryResult.data.length > 0) {
        queryResult.data.forEach(row => {
          if (Array.isArray(row) && row.length >= 2) {
            data.push({
              terminal: String(row[0]),
              count: Number(row[1])
            });
          }
        });
      }
    }
    
    res.json({ data });
  } catch (error) {
    console.error('Error in sender-terminal-weekly-distribution endpoint:', error);
    res.status(500).json({ error: 'Failed to get sender terminal weekly distribution', message: error.message });
  }
});

router.get('/sender-terminal-daily-distribution', async (req, res) => {
  try {
    const catalog = process.env.TRINO_CATALOG || 'hive';
    const schema = process.env.TRINO_SCHEMA || 'default';
    const tableName = 'shipments';
    
    // Get date from query params (default to today)
    const { date } = req.query;
    const selectedDate = date || formatDate(new Date());
    
    try {
      const syncQuery = `CALL system.sync_partition_metadata('${schema}', '${tableName}', 'FULL')`;
      const syncIterator = await trinoClient.query(syncQuery);
      for await (const _ of syncIterator) {
      }
    } catch (syncError) {
      console.error('Error syncing partitions:', syncError.message);
    }
    
    // Get packages per sender terminal for the selected date
    const query = `
      SELECT 
        sender_terminal AS terminal,
        COUNT(*) AS count
      FROM ${catalog}.${schema}.${tableName}
      WHERE sender_terminal IS NOT NULL 
        AND sender_terminal != ''
        AND date_of_shipment IS NOT NULL
        AND date_of_shipment = '${selectedDate}'
      GROUP BY sender_terminal
      ORDER BY count DESC
    `;
    
    const queryIterator = await trinoClient.query(query);
    
    const data = [];
    for await (const queryResult of queryIterator) {
      if (queryResult.data && queryResult.data.length > 0) {
        queryResult.data.forEach(row => {
          if (Array.isArray(row) && row.length >= 2) {
            data.push({
              terminal: String(row[0]),
              count: Number(row[1])
            });
          }
        });
      }
    }
    
    res.json({ data });
  } catch (error) {
    console.error('Error in sender-terminal-daily-distribution endpoint:', error);
    res.status(500).json({ error: 'Failed to get sender terminal daily distribution', message: error.message });
  }
});

router.get('/terminal-specific-monthly', async (req, res) => {
  try {
    const catalog = process.env.TRINO_CATALOG || 'hive';
    const schema = process.env.TRINO_SCHEMA || 'default';
    const tableName = 'shipments';
    
    const { terminal, month, year, type } = req.query; // type: 'sender' or 'receiver'
    if (!terminal) {
      return res.status(400).json({ error: 'Terminal parameter is required' });
    }
    
    const selectedMonth = month || new Date().getMonth() + 1;
    const selectedYear = year || new Date().getFullYear();
    const monthStr = String(selectedMonth).padStart(2, '0');
    const terminalField = type === 'sender' ? 'sender_terminal' : 'receiver_terminal';
    
    try {
      const syncQuery = `CALL system.sync_partition_metadata('${schema}', '${tableName}', 'FULL')`;
      const syncIterator = await trinoClient.query(syncQuery);
      for await (const _ of syncIterator) {
      }
    } catch (syncError) {
      console.error('Error syncing partitions:', syncError.message);
    }
    
    // Get daily data for the specific terminal in the selected month
    const query = `
      SELECT 
        date_of_shipment,
        COUNT(*) AS count
      FROM ${catalog}.${schema}.${tableName}
      WHERE ${terminalField} = '${terminal}'
        AND date_of_shipment IS NOT NULL
        AND date_of_shipment LIKE '${selectedYear}-${monthStr}-%'
      GROUP BY date_of_shipment
      ORDER BY date_of_shipment
    `;
    
    const queryIterator = await trinoClient.query(query);
    
    const dailyDataMap = {};
    for await (const queryResult of queryIterator) {
      if (queryResult.data && queryResult.data.length > 0) {
        queryResult.data.forEach(row => {
          if (Array.isArray(row) && row.length >= 2) {
            const dateStr = String(row[0]);
            const count = Number(row[1]);
            
            const dateParts = dateStr.split('-');
            if (dateParts.length === 3) {
              const day = parseInt(dateParts[2], 10);
              if (!isNaN(day) && day >= 1 && day <= 31) {
                dailyDataMap[day] = count;
              }
            }
          }
        });
      }
    }
    
    // Get number of days in the selected month
    const daysInMonth = new Date(selectedYear, selectedMonth, 0).getDate();
    
    // Build result array with all days, filling missing days with 0
    const result = [];
    for (let day = 1; day <= daysInMonth; day++) {
      result.push({
        day: day,
        value: dailyDataMap[day] || 0
      });
    }
    
    res.json({ data: result });
  } catch (error) {
    console.error('Error in terminal-specific-monthly endpoint:', error);
    res.status(500).json({ error: 'Failed to get terminal specific monthly data', message: error.message });
  }
});

router.get('/terminal-specific-weekly', async (req, res) => {
  try {
    const catalog = process.env.TRINO_CATALOG || 'hive';
    const schema = process.env.TRINO_SCHEMA || 'default';
    const tableName = 'shipments';
    
    const { terminal, startDate, endDate, type } = req.query; // type: 'sender' or 'receiver'
    if (!terminal) {
      return res.status(400).json({ error: 'Terminal parameter is required' });
    }
    
    let startDateStr = startDate;
    let endDateStr = endDate;
    
    if (!startDate || !endDate) {
      const now = new Date();
      const currentDay = now.getDay();
      const diff = now.getDate() - currentDay + (currentDay === 0 ? -6 : 1);
      const weekStart = new Date(now.setDate(diff));
      const weekEnd = new Date(weekStart);
      weekEnd.setDate(weekEnd.getDate() + 6);
      startDateStr = formatDate(weekStart);
      endDateStr = formatDate(weekEnd);
    }
    
    const terminalField = type === 'sender' ? 'sender_terminal' : 'receiver_terminal';
    
    try {
      const syncQuery = `CALL system.sync_partition_metadata('${schema}', '${tableName}', 'FULL')`;
      const syncIterator = await trinoClient.query(syncQuery);
      for await (const _ of syncIterator) {
      }
    } catch (syncError) {
      console.error('Error syncing partitions:', syncError.message);
    }
    
    // Get daily data for the specific terminal in the selected week
    const query = `
      SELECT 
        date_of_shipment,
        COUNT(*) AS count
      FROM ${catalog}.${schema}.${tableName}
      WHERE ${terminalField} = '${terminal}'
        AND date_of_shipment IS NOT NULL
        AND CAST(date_of_shipment AS DATE) >= DATE '${startDateStr}'
        AND CAST(date_of_shipment AS DATE) <= DATE '${endDateStr}'
      GROUP BY date_of_shipment
      ORDER BY date_of_shipment
    `;
    
    const queryIterator = await trinoClient.query(query);
    
    const dailyDataMap = {};
    for await (const queryResult of queryIterator) {
      if (queryResult.data && queryResult.data.length > 0) {
        queryResult.data.forEach(row => {
          if (Array.isArray(row) && row.length >= 2) {
            const dateStr = String(row[0]);
            const count = Number(row[1]);
            
            const dateParts = dateStr.split('-');
            if (dateParts.length === 3) {
              const day = parseInt(dateParts[2], 10);
              if (!isNaN(day) && day >= 1 && day <= 31) {
                dailyDataMap[dateStr] = count;
              }
            }
          }
        });
      }
    }
    
    // Generate all dates in the range
    const start = new Date(startDateStr);
    const end = new Date(endDateStr);
    const result = [];
    
    for (let d = new Date(start); d <= end; d.setDate(d.getDate() + 1)) {
      const dateStr = formatDate(new Date(d));
      const day = d.getDate();
      result.push({
        day: day,
        date: dateStr,
        value: dailyDataMap[dateStr] || 0
      });
    }
    
    res.json({ data: result });
  } catch (error) {
    console.error('Error in terminal-specific-weekly endpoint:', error);
    res.status(500).json({ error: 'Failed to get terminal specific weekly data', message: error.message });
  }
});

router.get('/terminals-comparison-monthly', async (req, res) => {
  try {
    const catalog = process.env.TRINO_CATALOG || 'hive';
    const schema = process.env.TRINO_SCHEMA || 'default';
    const tableName = 'shipments';
    
    const { terminals, month, year, type } = req.query; // terminals: comma-separated list
    if (!terminals) {
      return res.status(400).json({ error: 'Terminals parameter is required' });
    }
    
    const terminalList = terminals.split(',').map(t => t.trim()).filter(t => t);
    if (terminalList.length === 0) {
      return res.status(400).json({ error: 'At least one terminal is required' });
    }
    
    const selectedMonth = month || new Date().getMonth() + 1;
    const selectedYear = year || new Date().getFullYear();
    const monthStr = String(selectedMonth).padStart(2, '0');
    const terminalField = type === 'sender' ? 'sender_terminal' : 'receiver_terminal';
    
    // Build IN clause for terminals
    const terminalsIn = terminalList.map(t => `'${t}'`).join(',');
    
    try {
      const syncQuery = `CALL system.sync_partition_metadata('${schema}', '${tableName}', 'FULL')`;
      const syncIterator = await trinoClient.query(syncQuery);
      for await (const _ of syncIterator) {
      }
    } catch (syncError) {
      console.error('Error syncing partitions:', syncError.message);
    }
    
    // Get daily data for all selected terminals in the selected month
    const query = `
      SELECT 
        ${terminalField} AS terminal,
        date_of_shipment,
        COUNT(*) AS count
      FROM ${catalog}.${schema}.${tableName}
      WHERE ${terminalField} IN (${terminalsIn})
        AND date_of_shipment IS NOT NULL
        AND date_of_shipment LIKE '${selectedYear}-${monthStr}-%'
      GROUP BY ${terminalField}, date_of_shipment
      ORDER BY date_of_shipment, ${terminalField}
    `;
    
    const queryIterator = await trinoClient.query(query);
    
    // Organize data by day and terminal
    const dailyDataMap = {};
    
    for await (const queryResult of queryIterator) {
      if (queryResult.data && queryResult.data.length > 0) {
        queryResult.data.forEach(row => {
          if (Array.isArray(row) && row.length >= 3) {
            const terminal = String(row[0]);
            const dateStr = String(row[1]);
            const count = Number(row[2]);
            
            const dateParts = dateStr.split('-');
            if (dateParts.length === 3) {
              const day = parseInt(dateParts[2], 10);
              if (!isNaN(day) && day >= 1 && day <= 31) {
                if (!dailyDataMap[day]) {
                  dailyDataMap[day] = {};
                }
                dailyDataMap[day][terminal] = count;
              }
            }
          }
        });
      }
    }
    
    // Get number of days in the selected month
    const daysInMonth = new Date(selectedYear, selectedMonth, 0).getDate();
    
    // Build result array with all days
    const result = [];
    for (let day = 1; day <= daysInMonth; day++) {
      const dayData = { day };
      terminalList.forEach(terminal => {
        dayData[terminal] = (dailyDataMap[day] && dailyDataMap[day][terminal]) || 0;
      });
      result.push(dayData);
    }
    
    res.json({ data: result, terminals: terminalList });
  } catch (error) {
    console.error('Error in terminals-comparison-monthly endpoint:', error);
    res.status(500).json({ error: 'Failed to get terminals comparison monthly data', message: error.message });
  }
});

router.get('/terminals-comparison-weekly', async (req, res) => {
  try {
    const catalog = process.env.TRINO_CATALOG || 'hive';
    const schema = process.env.TRINO_SCHEMA || 'default';
    const tableName = 'shipments';
    
    const { terminals, startDate, endDate, type } = req.query; // terminals: comma-separated list
    if (!terminals) {
      return res.status(400).json({ error: 'Terminals parameter is required' });
    }
    
    const terminalList = terminals.split(',').map(t => t.trim()).filter(t => t);
    if (terminalList.length === 0) {
      return res.status(400).json({ error: 'At least one terminal is required' });
    }
    
    let startDateStr = startDate;
    let endDateStr = endDate;
    
    if (!startDate || !endDate) {
      const now = new Date();
      const currentDay = now.getDay();
      const diff = now.getDate() - currentDay + (currentDay === 0 ? -6 : 1);
      const weekStart = new Date(now.setDate(diff));
      const weekEnd = new Date(weekStart);
      weekEnd.setDate(weekEnd.getDate() + 6);
      startDateStr = formatDate(weekStart);
      endDateStr = formatDate(weekEnd);
    }
    
    const terminalField = type === 'sender' ? 'sender_terminal' : 'receiver_terminal';
    const terminalsIn = terminalList.map(t => `'${t}'`).join(',');
    
    try {
      const syncQuery = `CALL system.sync_partition_metadata('${schema}', '${tableName}', 'FULL')`;
      const syncIterator = await trinoClient.query(syncQuery);
      for await (const _ of syncIterator) {
      }
    } catch (syncError) {
      console.error('Error syncing partitions:', syncError.message);
    }
    
    // Get daily data for all selected terminals in the selected week
    const query = `
      SELECT 
        ${terminalField} AS terminal,
        date_of_shipment,
        COUNT(*) AS count
      FROM ${catalog}.${schema}.${tableName}
      WHERE ${terminalField} IN (${terminalsIn})
        AND date_of_shipment IS NOT NULL
        AND CAST(date_of_shipment AS DATE) >= DATE '${startDateStr}'
        AND CAST(date_of_shipment AS DATE) <= DATE '${endDateStr}'
      GROUP BY ${terminalField}, date_of_shipment
      ORDER BY date_of_shipment, ${terminalField}
    `;
    
    const queryIterator = await trinoClient.query(query);
    
    // Organize data by date and terminal
    const dailyDataMap = {};
    
    for await (const queryResult of queryIterator) {
      if (queryResult.data && queryResult.data.length > 0) {
        queryResult.data.forEach(row => {
          if (Array.isArray(row) && row.length >= 3) {
            const terminal = String(row[0]);
            const dateStr = String(row[1]);
            const count = Number(row[2]);
            
            if (!dailyDataMap[dateStr]) {
              dailyDataMap[dateStr] = {};
            }
            dailyDataMap[dateStr][terminal] = count;
          }
        });
      }
    }
    
    // Generate all dates in the range
    const start = new Date(startDateStr);
    const end = new Date(endDateStr);
    const result = [];
    
    for (let d = new Date(start); d <= end; d.setDate(d.getDate() + 1)) {
      const dateStr = formatDate(new Date(d));
      const day = d.getDate();
      const dayData = { day, date: dateStr };
      terminalList.forEach(terminal => {
        dayData[terminal] = (dailyDataMap[dateStr] && dailyDataMap[dateStr][terminal]) || 0;
      });
      result.push(dayData);
    }
    
    res.json({ data: result, terminals: terminalList });
  } catch (error) {
    console.error('Error in terminals-comparison-weekly endpoint:', error);
    res.status(500).json({ error: 'Failed to get terminals comparison weekly data', message: error.message });
  }
});

router.get('/top-cities-sender', async (req, res) => {
  try {
    const catalog = process.env.TRINO_CATALOG || 'hive';
    const schema = process.env.TRINO_SCHEMA || 'default';
    const tableName = 'shipments';
    const limit = parseInt(req.query.limit) || 20;
    
    try {
      const syncQuery = `CALL system.sync_partition_metadata('${schema}', '${tableName}', 'FULL')`;
      const syncIterator = await trinoClient.query(syncQuery);
      for await (const _ of syncIterator) {
      }
    } catch (syncError) {
      console.error('Error syncing partitions:', syncError.message);
    }
    
    const query = `
      SELECT 
        sender_city AS city,
        COUNT(*) AS count
      FROM ${catalog}.${schema}.${tableName}
      WHERE sender_city IS NOT NULL 
        AND sender_city != ''
      GROUP BY sender_city
      ORDER BY count DESC
      LIMIT ${limit}
    `;
    
    const queryIterator = await trinoClient.query(query);
    
    const cities = [];
    for await (const queryResult of queryIterator) {
      if (queryResult.data && queryResult.data.length > 0) {
        queryResult.data.forEach(row => {
          if (Array.isArray(row) && row.length >= 2) {
            cities.push({
              city: String(row[0]),
              count: Number(row[1])
            });
          }
        });
      }
    }
    
    res.json({ data: cities });
  } catch (error) {
    console.error('Error in top-cities-sender endpoint:', error);
    res.status(500).json({ error: 'Failed to get top sender cities', message: error.message });
  }
});

router.get('/top-cities-receiver', async (req, res) => {
  try {
    const catalog = process.env.TRINO_CATALOG || 'hive';
    const schema = process.env.TRINO_SCHEMA || 'default';
    const tableName = 'shipments';
    const limit = parseInt(req.query.limit) || 20;
    
    try {
      const syncQuery = `CALL system.sync_partition_metadata('${schema}', '${tableName}', 'FULL')`;
      const syncIterator = await trinoClient.query(syncQuery);
      for await (const _ of syncIterator) {
      }
    } catch (syncError) {
      console.error('Error syncing partitions:', syncError.message);
    }
    
    const query = `
      SELECT 
        receiver_city AS city,
        COUNT(*) AS count
      FROM ${catalog}.${schema}.${tableName}
      WHERE receiver_city IS NOT NULL 
        AND receiver_city != ''
      GROUP BY receiver_city
      ORDER BY count DESC
      LIMIT ${limit}
    `;
    
    const queryIterator = await trinoClient.query(query);
    
    const cities = [];
    for await (const queryResult of queryIterator) {
      if (queryResult.data && queryResult.data.length > 0) {
        queryResult.data.forEach(row => {
          if (Array.isArray(row) && row.length >= 2) {
            cities.push({
              city: String(row[0]),
              count: Number(row[1])
            });
          }
        });
      }
    }
    
    res.json({ data: cities });
  } catch (error) {
    console.error('Error in top-cities-receiver endpoint:', error);
    res.status(500).json({ error: 'Failed to get top receiver cities', message: error.message });
  }
});

router.get('/all-cities', async (req, res) => {
  try {
    const catalog = process.env.TRINO_CATALOG || 'hive';
    const schema = process.env.TRINO_SCHEMA || 'default';
    const tableName = 'shipments';
    const { type } = req.query; // 'sender' or 'receiver'
    
    const cityField = type === 'sender' ? 'sender_city' : 'receiver_city';
    
    try {
      const syncQuery = `CALL system.sync_partition_metadata('${schema}', '${tableName}', 'FULL')`;
      const syncIterator = await trinoClient.query(syncQuery);
      for await (const _ of syncIterator) {
      }
    } catch (syncError) {
      console.error('Error syncing partitions:', syncError.message);
    }
    
    const query = `
      SELECT DISTINCT ${cityField} AS city
      FROM ${catalog}.${schema}.${tableName}
      WHERE ${cityField} IS NOT NULL 
        AND ${cityField} != ''
      ORDER BY city
    `;
    
    const queryIterator = await trinoClient.query(query);
    
    const cities = [];
    for await (const queryResult of queryIterator) {
      if (queryResult.data && queryResult.data.length > 0) {
        queryResult.data.forEach(row => {
          if (Array.isArray(row) && row.length >= 1) {
            const city = String(row[0]).trim();
            if (city && !cities.includes(city)) {
              cities.push(city);
            }
          }
        });
      }
    }
    
    res.json({ cities: cities.sort() });
  } catch (error) {
    console.error('Error in all-cities endpoint:', error);
    res.status(500).json({ error: 'Failed to get all cities', message: error.message });
  }
});

router.get('/cities-data-monthly', async (req, res) => {
  try {
    const catalog = process.env.TRINO_CATALOG || 'hive';
    const schema = process.env.TRINO_SCHEMA || 'default';
    const tableName = 'shipments';
    
    const { cities, month, year, type } = req.query; // cities: comma-separated list
    if (!cities) {
      return res.status(400).json({ error: 'Cities parameter is required' });
    }
    
    const cityList = cities.split(',').map(c => c.trim()).filter(c => c);
    if (cityList.length === 0) {
      return res.status(400).json({ error: 'At least one city is required' });
    }
    
    const selectedMonth = month || new Date().getMonth() + 1;
    const selectedYear = year || new Date().getFullYear();
    const monthStr = String(selectedMonth).padStart(2, '0');
    const cityField = type === 'sender' ? 'sender_city' : 'receiver_city';
    
    // Build IN clause for cities
    const citiesIn = cityList.map(c => `'${c.replace(/'/g, "''")}'`).join(',');
    
    try {
      const syncQuery = `CALL system.sync_partition_metadata('${schema}', '${tableName}', 'FULL')`;
      const syncIterator = await trinoClient.query(syncQuery);
      for await (const _ of syncIterator) {
      }
    } catch (syncError) {
      console.error('Error syncing partitions:', syncError.message);
    }
    
    const query = `
      SELECT 
        ${cityField} AS city,
        COUNT(*) AS count
      FROM ${catalog}.${schema}.${tableName}
      WHERE ${cityField} IN (${citiesIn})
        AND date_of_shipment IS NOT NULL
        AND date_of_shipment LIKE '${selectedYear}-${monthStr}-%'
      GROUP BY ${cityField}
      ORDER BY count DESC
    `;
    
    const queryIterator = await trinoClient.query(query);
    
    const cityDataMap = {};
    for await (const queryResult of queryIterator) {
      if (queryResult.data && queryResult.data.length > 0) {
        queryResult.data.forEach(row => {
          if (Array.isArray(row) && row.length >= 2) {
            const city = String(row[0]);
            const count = Number(row[1]);
            cityDataMap[city] = count;
          }
        });
      }
    }
    
    // Build result array with all selected cities (including those with 0 count)
    const result = cityList.map(city => ({
      city: city,
      count: cityDataMap[city] || 0
    })).sort((a, b) => b.count - a.count);
    
    res.json({ data: result });
  } catch (error) {
    console.error('Error in cities-data-monthly endpoint:', error);
    res.status(500).json({ error: 'Failed to get cities monthly data', message: error.message });
  }
});

router.get('/cities-data-weekly', async (req, res) => {
  try {
    const catalog = process.env.TRINO_CATALOG || 'hive';
    const schema = process.env.TRINO_SCHEMA || 'default';
    const tableName = 'shipments';
    
    const { cities, startDate, endDate, type } = req.query; // cities: comma-separated list
    if (!cities) {
      return res.status(400).json({ error: 'Cities parameter is required' });
    }
    
    const cityList = cities.split(',').map(c => c.trim()).filter(c => c);
    if (cityList.length === 0) {
      return res.status(400).json({ error: 'At least one city is required' });
    }
    
    let startDateStr = startDate;
    let endDateStr = endDate;
    
    if (!startDate || !endDate) {
      const now = new Date();
      const currentDay = now.getDay();
      const diff = now.getDate() - currentDay + (currentDay === 0 ? -6 : 1);
      const weekStart = new Date(now.setDate(diff));
      const weekEnd = new Date(weekStart);
      weekEnd.setDate(weekEnd.getDate() + 6);
      startDateStr = formatDate(weekStart);
      endDateStr = formatDate(weekEnd);
    }
    
    const cityField = type === 'sender' ? 'sender_city' : 'receiver_city';
    const citiesIn = cityList.map(c => `'${c.replace(/'/g, "''")}'`).join(',');
    
    try {
      const syncQuery = `CALL system.sync_partition_metadata('${schema}', '${tableName}', 'FULL')`;
      const syncIterator = await trinoClient.query(syncQuery);
      for await (const _ of syncIterator) {
      }
    } catch (syncError) {
      console.error('Error syncing partitions:', syncError.message);
    }
    
    const query = `
      SELECT 
        ${cityField} AS city,
        COUNT(*) AS count
      FROM ${catalog}.${schema}.${tableName}
      WHERE ${cityField} IN (${citiesIn})
        AND date_of_shipment IS NOT NULL
        AND CAST(date_of_shipment AS DATE) >= DATE '${startDateStr}'
        AND CAST(date_of_shipment AS DATE) <= DATE '${endDateStr}'
      GROUP BY ${cityField}
      ORDER BY count DESC
    `;
    
    const queryIterator = await trinoClient.query(query);
    
    const cityDataMap = {};
    for await (const queryResult of queryIterator) {
      if (queryResult.data && queryResult.data.length > 0) {
        queryResult.data.forEach(row => {
          if (Array.isArray(row) && row.length >= 2) {
            const city = String(row[0]);
            const count = Number(row[1]);
            cityDataMap[city] = count;
          }
        });
      }
    }
    
    // Build result array with all selected cities (including those with 0 count)
    const result = cityList.map(city => ({
      city: city,
      count: cityDataMap[city] || 0
    })).sort((a, b) => b.count - a.count);
    
    res.json({ data: result });
  } catch (error) {
    console.error('Error in cities-data-weekly endpoint:', error);
    res.status(500).json({ error: 'Failed to get cities weekly data', message: error.message });
  }
});

router.get('/cities-by-terminal-monthly', async (req, res) => {
  try {
    const catalog = process.env.TRINO_CATALOG || 'hive';
    const schema = process.env.TRINO_SCHEMA || 'default';
    const tableName = 'shipments';
    
    const { terminal, month, year } = req.query;
    if (!terminal) {
      return res.status(400).json({ error: 'Terminal parameter is required' });
    }
    
    const selectedMonth = month || new Date().getMonth() + 1;
    const selectedYear = year || new Date().getFullYear();
    const monthStr = String(selectedMonth).padStart(2, '0');
    
    try {
      const syncQuery = `CALL system.sync_partition_metadata('${schema}', '${tableName}', 'FULL')`;
      const syncIterator = await trinoClient.query(syncQuery);
      for await (const _ of syncIterator) {
      }
    } catch (syncError) {
      console.error('Error syncing partitions:', syncError.message);
    }
    
    // Always use receiver_terminal and show sender_city (cities sending to this receiver terminal)
    const query = `
      SELECT 
        sender_city AS city,
        COUNT(*) AS count
      FROM ${catalog}.${schema}.${tableName}
      WHERE receiver_terminal = '${terminal}'
        AND sender_city IS NOT NULL
        AND sender_city != ''
        AND date_of_shipment IS NOT NULL
        AND date_of_shipment LIKE '${selectedYear}-${monthStr}-%'
      GROUP BY sender_city
      ORDER BY count DESC
    `;
    
    const queryIterator = await trinoClient.query(query);
    
    const cities = [];
    for await (const queryResult of queryIterator) {
      if (queryResult.data && queryResult.data.length > 0) {
        queryResult.data.forEach(row => {
          if (Array.isArray(row) && row.length >= 2) {
            cities.push({
              city: String(row[0]),
              count: Number(row[1])
            });
          }
        });
      }
    }
    
    res.json({ data: cities });
  } catch (error) {
    console.error('Error in cities-by-terminal-monthly endpoint:', error);
    res.status(500).json({ error: 'Failed to get cities by terminal monthly', message: error.message });
  }
});

router.get('/cities-by-terminal-weekly', async (req, res) => {
  try {
    const catalog = process.env.TRINO_CATALOG || 'hive';
    const schema = process.env.TRINO_SCHEMA || 'default';
    const tableName = 'shipments';
    
    const { terminal, startDate, endDate } = req.query;
    if (!terminal) {
      return res.status(400).json({ error: 'Terminal parameter is required' });
    }
    
    let startDateStr = startDate;
    let endDateStr = endDate;
    
    if (!startDate || !endDate) {
      const now = new Date();
      const currentDay = now.getDay();
      const diff = now.getDate() - currentDay + (currentDay === 0 ? -6 : 1);
      const weekStart = new Date(now.setDate(diff));
      const weekEnd = new Date(weekStart);
      weekEnd.setDate(weekEnd.getDate() + 6);
      startDateStr = formatDate(weekStart);
      endDateStr = formatDate(weekEnd);
    }
    
    try {
      const syncQuery = `CALL system.sync_partition_metadata('${schema}', '${tableName}', 'FULL')`;
      const syncIterator = await trinoClient.query(syncQuery);
      for await (const _ of syncIterator) {
      }
    } catch (syncError) {
      console.error('Error syncing partitions:', syncError.message);
    }
    
    // Always use receiver_terminal and show sender_city (cities sending to this receiver terminal)
    const query = `
      SELECT 
        sender_city AS city,
        COUNT(*) AS count
      FROM ${catalog}.${schema}.${tableName}
      WHERE receiver_terminal = '${terminal}'
        AND sender_city IS NOT NULL
        AND sender_city != ''
        AND date_of_shipment IS NOT NULL
        AND CAST(date_of_shipment AS DATE) >= DATE '${startDateStr}'
        AND CAST(date_of_shipment AS DATE) <= DATE '${endDateStr}'
      GROUP BY sender_city
      ORDER BY count DESC
    `;
    
    const queryIterator = await trinoClient.query(query);
    
    const cities = [];
    for await (const queryResult of queryIterator) {
      if (queryResult.data && queryResult.data.length > 0) {
        queryResult.data.forEach(row => {
          if (Array.isArray(row) && row.length >= 2) {
            cities.push({
              city: String(row[0]),
              count: Number(row[1])
            });
          }
        });
      }
    }
    
    res.json({ data: cities });
  } catch (error) {
    console.error('Error in cities-by-terminal-weekly endpoint:', error);
    res.status(500).json({ error: 'Failed to get cities by terminal weekly', message: error.message });
  }
});

router.get('/cities-by-sender-terminal-monthly', async (req, res) => {
  try {
    const catalog = process.env.TRINO_CATALOG || 'hive';
    const schema = process.env.TRINO_SCHEMA || 'default';
    const tableName = 'shipments';
    
    const { terminal, month, year } = req.query;
    if (!terminal) {
      return res.status(400).json({ error: 'Terminal parameter is required' });
    }
    
    const selectedMonth = month || new Date().getMonth() + 1;
    const selectedYear = year || new Date().getFullYear();
    const monthStr = String(selectedMonth).padStart(2, '0');
    
    try {
      const syncQuery = `CALL system.sync_partition_metadata('${schema}', '${tableName}', 'FULL')`;
      const syncIterator = await trinoClient.query(syncQuery);
      for await (const _ of syncIterator) {
      }
    } catch (syncError) {
      console.error('Error syncing partitions:', syncError.message);
    }
    
    // Use sender_terminal and show receiver_city (cities receiving from this sender terminal)
    const query = `
      SELECT 
        receiver_city AS city,
        COUNT(*) AS count
      FROM ${catalog}.${schema}.${tableName}
      WHERE sender_terminal = '${terminal}'
        AND receiver_city IS NOT NULL
        AND receiver_city != ''
        AND date_of_shipment IS NOT NULL
        AND date_of_shipment LIKE '${selectedYear}-${monthStr}-%'
      GROUP BY receiver_city
      ORDER BY count DESC
    `;
    
    const queryIterator = await trinoClient.query(query);
    
    const cities = [];
    for await (const queryResult of queryIterator) {
      if (queryResult.data && queryResult.data.length > 0) {
        queryResult.data.forEach(row => {
          if (Array.isArray(row) && row.length >= 2) {
            cities.push({
              city: String(row[0]),
              count: Number(row[1])
            });
          }
        });
      }
    }
    
    res.json({ data: cities });
  } catch (error) {
    console.error('Error in cities-by-sender-terminal-monthly endpoint:', error);
    res.status(500).json({ error: 'Failed to get cities by sender terminal monthly', message: error.message });
  }
});

router.get('/cities-by-sender-terminal-weekly', async (req, res) => {
  try {
    const catalog = process.env.TRINO_CATALOG || 'hive';
    const schema = process.env.TRINO_SCHEMA || 'default';
    const tableName = 'shipments';
    
    const { terminal, startDate, endDate } = req.query;
    if (!terminal) {
      return res.status(400).json({ error: 'Terminal parameter is required' });
    }
    
    let startDateStr = startDate;
    let endDateStr = endDate;
    
    if (!startDate || !endDate) {
      const now = new Date();
      const currentDay = now.getDay();
      const diff = now.getDate() - currentDay + (currentDay === 0 ? -6 : 1);
      const weekStart = new Date(now.setDate(diff));
      const weekEnd = new Date(weekStart);
      weekEnd.setDate(weekEnd.getDate() + 6);
      startDateStr = formatDate(weekStart);
      endDateStr = formatDate(weekEnd);
    }
    
    try {
      const syncQuery = `CALL system.sync_partition_metadata('${schema}', '${tableName}', 'FULL')`;
      const syncIterator = await trinoClient.query(syncQuery);
      for await (const _ of syncIterator) {
      }
    } catch (syncError) {
      console.error('Error syncing partitions:', syncError.message);
    }
    
    // Use sender_terminal and show receiver_city (cities receiving from this sender terminal)
    const query = `
      SELECT 
        receiver_city AS city,
        COUNT(*) AS count
      FROM ${catalog}.${schema}.${tableName}
      WHERE sender_terminal = '${terminal}'
        AND receiver_city IS NOT NULL
        AND receiver_city != ''
        AND date_of_shipment IS NOT NULL
        AND CAST(date_of_shipment AS DATE) >= DATE '${startDateStr}'
        AND CAST(date_of_shipment AS DATE) <= DATE '${endDateStr}'
      GROUP BY receiver_city
      ORDER BY count DESC
    `;
    
    const queryIterator = await trinoClient.query(query);
    
    const cities = [];
    for await (const queryResult of queryIterator) {
      if (queryResult.data && queryResult.data.length > 0) {
        queryResult.data.forEach(row => {
          if (Array.isArray(row) && row.length >= 2) {
            cities.push({
              city: String(row[0]),
              count: Number(row[1])
            });
          }
        });
      }
    }
    
    res.json({ data: cities });
  } catch (error) {
    console.error('Error in cities-by-sender-terminal-weekly endpoint:', error);
    res.status(500).json({ error: 'Failed to get cities by sender terminal weekly', message: error.message });
  }
});

router.get('/cities-assigned-to-terminal-monthly', async (req, res) => {
  try {
    const catalog = process.env.TRINO_CATALOG || 'hive';
    const schema = process.env.TRINO_SCHEMA || 'default';
    const tableName = 'shipments';
    
    const { terminal, month, year } = req.query;
    if (!terminal) {
      return res.status(400).json({ error: 'Terminal parameter is required' });
    }
    
    const selectedMonth = month || new Date().getMonth() + 1;
    const selectedYear = year || new Date().getFullYear();
    const monthStr = String(selectedMonth).padStart(2, '0');
    
    try {
      const syncQuery = `CALL system.sync_partition_metadata('${schema}', '${tableName}', 'FULL')`;
      const syncIterator = await trinoClient.query(syncQuery);
      for await (const _ of syncIterator) {
      }
    } catch (syncError) {
      console.error('Error syncing partitions:', syncError.message);
    }
    
    // Get cities assigned to this terminal - cities that appear in shipments where this terminal is involved
    // This includes both sender_city (when terminal is sender) and receiver_city (when terminal is receiver)
    const query = `
      SELECT 
        city,
        SUM(count) AS count
      FROM (
        SELECT 
          sender_city AS city,
          COUNT(*) AS count
        FROM ${catalog}.${schema}.${tableName}
        WHERE sender_terminal = '${terminal}'
          AND sender_city IS NOT NULL
          AND sender_city != ''
          AND date_of_shipment IS NOT NULL
          AND date_of_shipment LIKE '${selectedYear}-${monthStr}-%'
        GROUP BY sender_city
        
        UNION ALL
        
        SELECT 
          receiver_city AS city,
          COUNT(*) AS count
        FROM ${catalog}.${schema}.${tableName}
        WHERE receiver_terminal = '${terminal}'
          AND receiver_city IS NOT NULL
          AND receiver_city != ''
          AND date_of_shipment IS NOT NULL
          AND date_of_shipment LIKE '${selectedYear}-${monthStr}-%'
        GROUP BY receiver_city
      ) AS combined
      GROUP BY city
      ORDER BY count DESC
    `;
    
    const queryIterator = await trinoClient.query(query);
    
    const cities = [];
    for await (const queryResult of queryIterator) {
      if (queryResult.data && queryResult.data.length > 0) {
        queryResult.data.forEach(row => {
          if (Array.isArray(row) && row.length >= 2) {
            cities.push({
              city: String(row[0]),
              count: Number(row[1])
            });
          }
        });
      }
    }
    
    res.json({ data: cities });
  } catch (error) {
    console.error('Error in cities-assigned-to-terminal-monthly endpoint:', error);
    res.status(500).json({ error: 'Failed to get cities assigned to terminal monthly', message: error.message });
  }
});

router.get('/cities-assigned-to-terminal-weekly', async (req, res) => {
  try {
    const catalog = process.env.TRINO_CATALOG || 'hive';
    const schema = process.env.TRINO_SCHEMA || 'default';
    const tableName = 'shipments';
    
    const { terminal, startDate, endDate } = req.query;
    if (!terminal) {
      return res.status(400).json({ error: 'Terminal parameter is required' });
    }
    
    let startDateStr = startDate;
    let endDateStr = endDate;
    
    if (!startDate || !endDate) {
      const now = new Date();
      const currentDay = now.getDay();
      const diff = now.getDate() - currentDay + (currentDay === 0 ? -6 : 1);
      const weekStart = new Date(now.setDate(diff));
      const weekEnd = new Date(weekStart);
      weekEnd.setDate(weekEnd.getDate() + 6);
      startDateStr = formatDate(weekStart);
      endDateStr = formatDate(weekEnd);
    }
    
    try {
      const syncQuery = `CALL system.sync_partition_metadata('${schema}', '${tableName}', 'FULL')`;
      const syncIterator = await trinoClient.query(syncQuery);
      for await (const _ of syncIterator) {
      }
    } catch (syncError) {
      console.error('Error syncing partitions:', syncError.message);
    }
    
    // Get cities assigned to this terminal - cities that appear in shipments where this terminal is involved
    const query = `
      SELECT 
        city,
        SUM(count) AS count
      FROM (
        SELECT 
          sender_city AS city,
          COUNT(*) AS count
        FROM ${catalog}.${schema}.${tableName}
        WHERE sender_terminal = '${terminal}'
          AND sender_city IS NOT NULL
          AND sender_city != ''
          AND date_of_shipment IS NOT NULL
          AND CAST(date_of_shipment AS DATE) >= DATE '${startDateStr}'
          AND CAST(date_of_shipment AS DATE) <= DATE '${endDateStr}'
        GROUP BY sender_city
        
        UNION ALL
        
        SELECT 
          receiver_city AS city,
          COUNT(*) AS count
        FROM ${catalog}.${schema}.${tableName}
        WHERE receiver_terminal = '${terminal}'
          AND receiver_city IS NOT NULL
          AND receiver_city != ''
          AND date_of_shipment IS NOT NULL
          AND CAST(date_of_shipment AS DATE) >= DATE '${startDateStr}'
          AND CAST(date_of_shipment AS DATE) <= DATE '${endDateStr}'
        GROUP BY receiver_city
      ) AS combined
      GROUP BY city
      ORDER BY count DESC
    `;
    
    const queryIterator = await trinoClient.query(query);
    
    const cities = [];
    for await (const queryResult of queryIterator) {
      if (queryResult.data && queryResult.data.length > 0) {
        queryResult.data.forEach(row => {
          if (Array.isArray(row) && row.length >= 2) {
            cities.push({
              city: String(row[0]),
              count: Number(row[1])
            });
          }
        });
      }
    }
    
    res.json({ data: cities });
  } catch (error) {
    console.error('Error in cities-assigned-to-terminal-weekly endpoint:', error);
    res.status(500).json({ error: 'Failed to get cities assigned to terminal weekly', message: error.message });
  }
});

router.get('/shipment-type-distribution', async (req, res) => {
  try {
    const catalog = process.env.TRINO_CATALOG || 'hive';
    const schema = process.env.TRINO_SCHEMA || 'default';
    const tableName = 'shipments';
    
    try {
      const syncQuery = `CALL system.sync_partition_metadata('${schema}', '${tableName}', 'FULL')`;
      const syncIterator = await trinoClient.query(syncQuery);
      for await (const _ of syncIterator) {
      }
    } catch (syncError) {
      console.error('Error syncing partitions:', syncError.message);
    }
    
    const query = `
      SELECT 
        package_type AS type,
        COUNT(*) AS count
      FROM ${catalog}.${schema}.${tableName}
      WHERE package_type IS NOT NULL 
        AND package_type != ''
      GROUP BY package_type
      ORDER BY count DESC
    `;
    
    const queryIterator = await trinoClient.query(query);
    
    const types = [];
    for await (const queryResult of queryIterator) {
      if (queryResult.data && queryResult.data.length > 0) {
        queryResult.data.forEach(row => {
          if (Array.isArray(row) && row.length >= 2) {
            types.push({
              type: String(row[0]),
              count: Number(row[1])
            });
          }
        });
      }
    }
    
    res.json({ data: types });
  } catch (error) {
    console.error('Error in shipment-type-distribution endpoint:', error);
    res.status(500).json({ error: 'Failed to get shipment type distribution', message: error.message });
  }
});

router.get('/shipment-size-distribution', async (req, res) => {
  try {
    const catalog = process.env.TRINO_CATALOG || 'hive';
    const schema = process.env.TRINO_SCHEMA || 'default';
    const tableName = 'shipments';
    
    try {
      const syncQuery = `CALL system.sync_partition_metadata('${schema}', '${tableName}', 'FULL')`;
      const syncIterator = await trinoClient.query(syncQuery);
      for await (const _ of syncIterator) {
      }
    } catch (syncError) {
      console.error('Error syncing partitions:', syncError.message);
    }
    
    const query = `
      SELECT 
        size AS size,
        COUNT(*) AS count
      FROM ${catalog}.${schema}.${tableName}
      WHERE size IS NOT NULL 
        AND size != ''
      GROUP BY size
      ORDER BY count DESC
    `;
    
    const queryIterator = await trinoClient.query(query);
    
    const sizes = [];
    for await (const queryResult of queryIterator) {
      if (queryResult.data && queryResult.data.length > 0) {
        queryResult.data.forEach(row => {
          if (Array.isArray(row) && row.length >= 2) {
            sizes.push({
              size: String(row[0]),
              count: Number(row[1])
            });
          }
        });
      }
    }
    
    res.json({ data: sizes });
  } catch (error) {
    console.error('Error in shipment-size-distribution endpoint:', error);
    res.status(500).json({ error: 'Failed to get shipment size distribution', message: error.message });
  }
});

router.get('/shipment-weight-distribution', async (req, res) => {
  try {
    const catalog = process.env.TRINO_CATALOG || 'hive';
    const schema = process.env.TRINO_SCHEMA || 'default';
    const tableName = 'shipments';
    
    try {
      const syncQuery = `CALL system.sync_partition_metadata('${schema}', '${tableName}', 'FULL')`;
      const syncIterator = await trinoClient.query(syncQuery);
      for await (const _ of syncIterator) {
      }
    } catch (syncError) {
      console.error('Error syncing partitions:', syncError.message);
    }
    
    // Create weight ranges for distribution - use CAST to ensure weight is numeric
    const query = `
      SELECT 
        weight_range,
        COUNT(*) AS count,
        MIN(sort_order) AS sort_order
      FROM (
        SELECT 
          CASE
            WHEN CAST(weight AS DOUBLE) < 1 THEN '0-1 kg'
            WHEN CAST(weight AS DOUBLE) < 5 THEN '1-5 kg'
            WHEN CAST(weight AS DOUBLE) < 10 THEN '5-10 kg'
            WHEN CAST(weight AS DOUBLE) < 20 THEN '10-20 kg'
            WHEN CAST(weight AS DOUBLE) < 30 THEN '20-30 kg'
            ELSE '30+ kg'
          END AS weight_range,
          CASE
            WHEN CAST(weight AS DOUBLE) < 1 THEN 1
            WHEN CAST(weight AS DOUBLE) < 5 THEN 2
            WHEN CAST(weight AS DOUBLE) < 10 THEN 3
            WHEN CAST(weight AS DOUBLE) < 20 THEN 4
            WHEN CAST(weight AS DOUBLE) < 30 THEN 5
            ELSE 6
          END AS sort_order
        FROM ${catalog}.${schema}.${tableName}
        WHERE weight IS NOT NULL 
          AND CAST(weight AS DOUBLE) >= 0
          AND CAST(weight AS DOUBLE) IS NOT NULL
      ) AS weight_ranges
      GROUP BY weight_range
      ORDER BY sort_order
    `;
    
    const queryIterator = await trinoClient.query(query);
    
    const weights = [];
    for await (const queryResult of queryIterator) {
      if (queryResult.data && queryResult.data.length > 0) {
        queryResult.data.forEach(row => {
          if (Array.isArray(row) && row.length >= 2) {
            weights.push({
              range: String(row[0]),
              count: Number(row[1])
            });
          }
        });
      }
    }
    
    res.json({ data: weights });
  } catch (error) {
    console.error('Error in shipment-weight-distribution endpoint:', error);
    res.status(500).json({ error: 'Failed to get shipment weight distribution', message: error.message });
  }
});

router.get('/logistics-packages-by-date-terminal', async (req, res) => {
  try {
    const catalog = process.env.TRINO_CATALOG || 'hive';
    const schema = process.env.TRINO_SCHEMA || 'default';
    const tableName = 'shipments';
    
    const { date, terminal, type } = req.query; // type: 'sender' or 'receiver'
    if (!date || !terminal) {
      return res.status(400).json({ error: 'Date and terminal parameters are required' });
    }
    
    const terminalField = type === 'sender' ? 'sender_terminal' : 'receiver_terminal';
    
    try {
      const syncQuery = `CALL system.sync_partition_metadata('${schema}', '${tableName}', 'FULL')`;
      const syncIterator = await trinoClient.query(syncQuery);
      for await (const _ of syncIterator) {
      }
    } catch (syncError) {
      console.error('Error syncing partitions:', syncError.message);
    }
    
    // Get package types and counts for the selected date and terminal
    // date_of_shipment is stored as VARCHAR in format YYYY-MM-DD, so use string comparison
    const query = `
      SELECT 
        package_type AS type,
        COUNT(*) AS count
      FROM ${catalog}.${schema}.${tableName}
      WHERE ${terminalField} = '${terminal}'
        AND date_of_shipment IS NOT NULL
        AND date_of_shipment = '${date}'
        AND package_type IS NOT NULL
        AND package_type != ''
      GROUP BY package_type
      ORDER BY count DESC
    `;
    
    console.log(`Logistics query: date=${date}, terminal=${terminal}, type=${type}, terminalField=${terminalField}`);
    
    const queryIterator = await trinoClient.query(query);
    
    const packages = [];
    let totalCount = 0;
    
    for await (const queryResult of queryIterator) {
      if (queryResult.data && queryResult.data.length > 0) {
        queryResult.data.forEach(row => {
          if (Array.isArray(row) && row.length >= 2) {
            const count = Number(row[1]);
            packages.push({
              type: String(row[0]),
              count: count
            });
            totalCount += count;
          }
        });
      }
    }
    
    console.log(`Logistics result: Found ${packages.length} package types, total=${totalCount}`);
    
    res.json({ 
      data: packages,
      total: totalCount,
      date: date,
      terminal: terminal
    });
  } catch (error) {
    console.error('Error in logistics-packages-by-date-terminal endpoint:', error);
    res.status(500).json({ error: 'Failed to get logistics packages', message: error.message });
  }
});

router.get('/all-receiver-terminals', async (req, res) => {
  try {
    const catalog = process.env.TRINO_CATALOG || 'hive';
    const schema = process.env.TRINO_SCHEMA || 'default';
    const tableName = 'shipments';

    try {
      const syncQuery = `CALL system.sync_partition_metadata('${schema}', '${tableName}', 'FULL')`;
      const syncIterator = await trinoClient.query(syncQuery);
      for await (const _ of syncIterator) {
      }
    } catch (syncError) {
      console.error('Error syncing partitions:', syncError.message);
    }

    const query = `
      SELECT DISTINCT receiver_terminal AS terminal
      FROM ${catalog}.${schema}.${tableName}
      WHERE receiver_terminal IS NOT NULL AND receiver_terminal != ''
      ORDER BY terminal
    `;

    const queryIterator = await trinoClient.query(query);
    const terminals = [];
    for await (const queryResult of queryIterator) {
      if (queryResult.data && queryResult.data.length > 0) {
        queryResult.data.forEach(row => {
          if (Array.isArray(row) && row.length >= 1) {
            terminals.push({ terminal: String(row[0]) });
          }
        });
      }
    }
    res.json({ data: terminals });
  } catch (error) {
    console.error('Error in all-receiver-terminals endpoint:', error);
    res.status(500).json({ error: 'Failed to get all receiver terminals', message: error.message });
  }
});

router.get('/all-sender-terminals', async (req, res) => {
  try {
    const catalog = process.env.TRINO_CATALOG || 'hive';
    const schema = process.env.TRINO_SCHEMA || 'default';
    const tableName = 'shipments';

    try {
      const syncQuery = `CALL system.sync_partition_metadata('${schema}', '${tableName}', 'FULL')`;
      const syncIterator = await trinoClient.query(syncQuery);
      for await (const _ of syncIterator) {
      }
    } catch (syncError) {
      console.error('Error syncing partitions:', syncError.message);
    }

    const query = `
      SELECT DISTINCT sender_terminal AS terminal
      FROM ${catalog}.${schema}.${tableName}
      WHERE sender_terminal IS NOT NULL AND sender_terminal != ''
      ORDER BY terminal
    `;

    const queryIterator = await trinoClient.query(query);
    const terminals = [];
    for await (const queryResult of queryIterator) {
      if (queryResult.data && queryResult.data.length > 0) {
        queryResult.data.forEach(row => {
          if (Array.isArray(row) && row.length >= 1) {
            terminals.push({ terminal: String(row[0]) });
          }
        });
      }
    }
    res.json({ data: terminals });
  } catch (error) {
    console.error('Error in all-sender-terminals endpoint:', error);
    res.status(500).json({ error: 'Failed to get all sender terminals', message: error.message });
  }
});

router.get('/all-receiver-cities', async (req, res) => {
  try {
    const catalog = process.env.TRINO_CATALOG || 'hive';
    const schema = process.env.TRINO_SCHEMA || 'default';
    const tableName = 'shipments';

    try {
      const syncQuery = `CALL system.sync_partition_metadata('${schema}', '${tableName}', 'FULL')`;
      const syncIterator = await trinoClient.query(syncQuery);
      for await (const _ of syncIterator) {
      }
    } catch (syncError) {
      console.error('Error syncing partitions:', syncError.message);
    }

    const query = `
      SELECT DISTINCT receiver_city AS city
      FROM ${catalog}.${schema}.${tableName}
      WHERE receiver_city IS NOT NULL AND receiver_city != ''
      ORDER BY city
    `;

    const queryIterator = await trinoClient.query(query);
    const cities = [];
    for await (const queryResult of queryIterator) {
      if (queryResult.data && queryResult.data.length > 0) {
        queryResult.data.forEach(row => {
          if (Array.isArray(row) && row.length >= 1) {
            cities.push({ city: String(row[0]) });
          }
        });
      }
    }
    res.json({ data: cities });
  } catch (error) {
    console.error('Error in all-receiver-cities endpoint:', error);
    res.status(500).json({ error: 'Failed to get all receiver cities', message: error.message });
  }
});

// Country coordinates mapping (approximate center of each country)
const countryCoordinates = {
  'Poland': { latitude: 52.0, longitude: 19.0 },
  'Germany': { latitude: 51.0, longitude: 9.0 },
  'France': { latitude: 46.0, longitude: 2.0 },
  'United Kingdom': { latitude: 54.0, longitude: -2.0 },
  'Italy': { latitude: 41.9, longitude: 12.5 },
  'Spain': { latitude: 40.0, longitude: -3.0 },
  'Netherlands': { latitude: 52.1, longitude: 5.3 },
  'Belgium': { latitude: 50.5, longitude: 4.5 },
  'Czech Republic': { latitude: 49.8, longitude: 15.5 },
  'Austria': { latitude: 47.5, longitude: 13.3 },
  'Switzerland': { latitude: 46.8, longitude: 8.2 },
  'Sweden': { latitude: 60.1, longitude: 18.6 },
  'Norway': { latitude: 60.5, longitude: 8.5 },
  'Denmark': { latitude: 56.0, longitude: 10.0 },
  'Finland': { latitude: 61.9, longitude: 25.7 },
  'Portugal': { latitude: 39.5, longitude: -8.0 },
  'Greece': { latitude: 39.0, longitude: 22.0 },
  'Romania': { latitude: 46.0, longitude: 25.0 },
  'Hungary': { latitude: 47.5, longitude: 19.0 },
  'Slovakia': { latitude: 48.7, longitude: 19.7 },
  'Slovenia': { latitude: 46.1, longitude: 14.8 },
  'Croatia': { latitude: 45.1, longitude: 15.2 },
  'Bulgaria': { latitude: 42.7, longitude: 23.3 },
  'Ireland': { latitude: 53.4, longitude: -8.2 },
  'Luxembourg': { latitude: 49.6, longitude: 6.1 },
  'Estonia': { latitude: 58.6, longitude: 25.0 },
  'Latvia': { latitude: 56.9, longitude: 24.6 },
  'Lithuania': { latitude: 54.9, longitude: 23.9 },
  'United States': { latitude: 39.8, longitude: -98.6 },
  'Canada': { latitude: 56.1, longitude: -106.3 },
  'China': { latitude: 35.9, longitude: 104.2 },
  'Japan': { latitude: 36.2, longitude: 138.3 },
  'Australia': { latitude: -25.3, longitude: 133.8 },
  'Brazil': { latitude: -14.2, longitude: -51.9 },
  'India': { latitude: 20.6, longitude: 78.9 },
  'Russia': { latitude: 61.5, longitude: 105.3 },
  'Ukraine': { latitude: 48.4, longitude: 31.2 },
  'Belarus': { latitude: 53.7, longitude: 27.9 },
  'Turkey': { latitude: 39.1, longitude: 35.2 },
};

router.get('/country-distribution', async (req, res) => {
  try {
    const catalog = process.env.TRINO_CATALOG || 'hive';
    const schema = process.env.TRINO_SCHEMA || 'default';
    const tableName = 'shipments';
    
    const { date, month, year, startDate, endDate } = req.query;
    
    try {
      const syncQuery = `CALL system.sync_partition_metadata('${schema}', '${tableName}', 'FULL')`;
      const syncIterator = await trinoClient.query(syncQuery);
      for await (const _ of syncIterator) {
      }
    } catch (syncError) {
      console.error('Error syncing partitions:', syncError.message);
    }
    
    // Build date filter
    let dateFilter = '';
    if (date) {
      dateFilter = `AND date_of_shipment = '${date}'`;
    } else if (month && year) {
      const monthStr = String(month).padStart(2, '0');
      dateFilter = `AND date_of_shipment LIKE '${year}-${monthStr}-%'`;
    } else if (startDate && endDate) {
      dateFilter = `AND date_of_shipment >= '${startDate}' AND date_of_shipment <= '${endDate}'`;
    }
    
    // Get country distribution
    const query = `
      SELECT 
        receiver_country AS country,
        COUNT(*) AS count
      FROM ${catalog}.${schema}.${tableName}
      WHERE receiver_country IS NOT NULL 
        AND receiver_country != ''
        ${dateFilter}
      GROUP BY receiver_country
      ORDER BY count DESC
    `;
    
    const queryIterator = await trinoClient.query(query);
    const countries = [];
    
    for await (const queryResult of queryIterator) {
      if (queryResult.data && queryResult.data.length > 0) {
        queryResult.data.forEach(row => {
          if (Array.isArray(row) && row.length >= 2) {
            const country = String(row[0]).trim();
            const count = Number(row[1]);
            const coords = countryCoordinates[country] || { latitude: 0, longitude: 0 };
            
            countries.push({
              country: country,
              count: count,
              latitude: coords.latitude,
              longitude: coords.longitude
            });
          }
        });
      }
    }
    
    res.json({ data: countries });
  } catch (error) {
    console.error('Error in country-distribution endpoint:', error);
    res.status(500).json({ error: 'Failed to get country distribution', message: error.message });
  }
});

router.get('/terminal-country-stats', async (req, res) => {
  try {
    const catalog = process.env.TRINO_CATALOG || 'hive';
    const schema = process.env.TRINO_SCHEMA || 'default';
    const tableName = 'shipments';
    
    const { date, month, year, startDate, endDate } = req.query;
    
    try {
      const syncQuery = `CALL system.sync_partition_metadata('${schema}', '${tableName}', 'FULL')`;
      const syncIterator = await trinoClient.query(syncQuery);
      for await (const _ of syncIterator) {
      }
    } catch (syncError) {
      console.error('Error syncing partitions:', syncError.message);
    }
    
    // Build date filter
    let dateFilter = '';
    if (date) {
      dateFilter = `AND date_of_shipment = '${date}'`;
    } else if (month && year) {
      const monthStr = String(month).padStart(2, '0');
      dateFilter = `AND date_of_shipment LIKE '${year}-${monthStr}-%'`;
    } else if (startDate && endDate) {
      dateFilter = `AND date_of_shipment >= '${startDate}' AND date_of_shipment <= '${endDate}'`;
    }
    
    // Get terminal-to-country statistics
    // For each country, find which terminal sends the most packages
    const query = `
      SELECT 
        receiver_country AS country,
        sender_terminal AS terminal,
        COUNT(*) AS count
      FROM ${catalog}.${schema}.${tableName}
      WHERE receiver_country IS NOT NULL 
        AND receiver_country != ''
        AND sender_terminal IS NOT NULL
        AND sender_terminal != ''
        ${dateFilter}
      GROUP BY receiver_country, sender_terminal
      ORDER BY receiver_country, count DESC
    `;
    
    const queryIterator = await trinoClient.query(query);
    const terminalCountryMap = new Map(); // country -> { terminal, count }
    
    for await (const queryResult of queryIterator) {
      if (queryResult.data && queryResult.data.length > 0) {
        queryResult.data.forEach(row => {
          if (Array.isArray(row) && row.length >= 3) {
            const country = String(row[0]).trim();
            const terminal = String(row[1]).trim();
            const count = Number(row[2]);
            
            // Keep only the terminal with highest count for each country
            if (!terminalCountryMap.has(country) || terminalCountryMap.get(country).count < count) {
              terminalCountryMap.set(country, { terminal, count });
            }
          }
        });
      }
    }
    
    // Convert map to array
    const stats = Array.from(terminalCountryMap.entries()).map(([country, data]) => ({
      country,
      terminal: data.terminal,
      count: data.count
    }));
    
    // Sort by count descending
    stats.sort((a, b) => b.count - a.count);
    
    res.json({ data: stats });
  } catch (error) {
    console.error('Error in terminal-country-stats endpoint:', error);
    res.status(500).json({ error: 'Failed to get terminal country stats', message: error.message });
  }
});

router.get('/city-locations-with-counts', async (req, res) => {
  try {
    const catalog = process.env.TRINO_CATALOG || 'hive';
    const schema = process.env.TRINO_SCHEMA || 'default';
    const tableName = 'shipments';
    
    const { date, month, year, startDate, endDate, terminal, cities, minCount, limit } = req.query;
    
    try {
      const syncQuery = `CALL system.sync_partition_metadata('${schema}', '${tableName}', 'FULL')`;
      const syncIterator = await trinoClient.query(syncQuery);
      for await (const _ of syncIterator) {
      }
    } catch (syncError) {
      console.error('Error syncing partitions:', syncError.message);
    }
    
    // Build date filter based on query parameters
    let dateFilter = '';
    if (date) {
      // Daily view - single date
      dateFilter = `AND date_of_shipment = '${date}'`;
    } else if (month && year) {
      // Monthly view - filter by month and year
      const monthStr = String(month).padStart(2, '0');
      dateFilter = `AND date_of_shipment LIKE '${year}-${monthStr}-%'`;
    } else if (startDate && endDate) {
      // Weekly view - date range
      dateFilter = `AND date_of_shipment >= '${startDate}' AND date_of_shipment <= '${endDate}'`;
    }
    
    // Build terminal filter if provided
    let terminalFilter = '';
    if (terminal) {
      terminalFilter = `AND receiver_terminal = '${terminal}'`;
    }
    
    // Build city filter if provided (comma-separated list)
    let cityFilter = '';
    if (cities) {
      const cityList = cities.split(',').map(c => `'${c.trim()}'`).join(',');
      cityFilter = `AND receiver_city IN (${cityList})`;
    }
    
    // Get city locations and package counts from database
    // Use the first coordinate pair for each city (to get consistent location)
    // and aggregate package counts
    const query = `
      WITH city_coords AS (
        SELECT DISTINCT
          receiver_city AS city,
          receiver_latitude AS latitude,
          receiver_longitude AS longitude,
          receiver_terminal AS terminal
        FROM ${catalog}.${schema}.${tableName}
        WHERE receiver_city IS NOT NULL 
          AND receiver_city != ''
          AND receiver_latitude IS NOT NULL
          AND receiver_longitude IS NOT NULL
          AND receiver_terminal IS NOT NULL
          AND receiver_terminal != ''
          ${dateFilter}
          ${terminalFilter}
          ${cityFilter}
        ORDER BY receiver_city, receiver_latitude, receiver_longitude
      ),
      city_first_coords AS (
        SELECT 
          city,
          latitude,
          longitude,
          terminal
        FROM (
          SELECT 
            city,
            latitude,
            longitude,
            terminal,
            ROW_NUMBER() OVER (PARTITION BY city ORDER BY latitude, longitude) AS rn
          FROM city_coords
        ) ranked
        WHERE rn = 1
      ),
      city_counts AS (
        SELECT 
          receiver_city AS city,
          COUNT(*) AS count
        FROM ${catalog}.${schema}.${tableName}
        WHERE receiver_city IS NOT NULL 
          AND receiver_city != ''
          AND receiver_terminal IS NOT NULL
          AND receiver_terminal != ''
          ${dateFilter}
          ${terminalFilter}
          ${cityFilter}
        GROUP BY receiver_city
      )
      SELECT 
        cfc.city,
        cfc.latitude,
        cfc.longitude,
        cfc.terminal,
        cc.count
      FROM city_first_coords cfc
      INNER JOIN city_counts cc ON cfc.city = cc.city
      ORDER BY cc.count DESC
    `;
    
    // Since Trino might not support ROW_NUMBER with PARTITION BY in all versions,
    // use a simpler approach: get all city-coordinate pairs and process in JavaScript
    const querySimple = `
      SELECT 
        receiver_city AS city,
        receiver_latitude AS latitude,
        receiver_longitude AS longitude,
        receiver_terminal AS terminal,
        COUNT(*) AS count
      FROM ${catalog}.${schema}.${tableName}
      WHERE receiver_city IS NOT NULL 
        AND receiver_city != ''
        AND receiver_latitude IS NOT NULL
        AND receiver_longitude IS NOT NULL
        AND receiver_terminal IS NOT NULL
        AND receiver_terminal != ''
        ${dateFilter}
        ${terminalFilter}
        ${cityFilter}
      GROUP BY receiver_city, receiver_latitude, receiver_longitude, receiver_terminal
      ORDER BY receiver_city, count DESC
    `;
    
    const queryIterator = await trinoClient.query(querySimple);
    
    // Track cities we've seen - store first coordinates for each city
    const cityLocationsMap = new Map();
    const cityCountsMap = new Map();
    
    for await (const queryResult of queryIterator) {
      if (queryResult.data && queryResult.data.length > 0) {
        queryResult.data.forEach(row => {
          if (Array.isArray(row) && row.length >= 5) {
            const city = String(row[0]).trim();
            const lat = Number(row[1]);
            const lon = Number(row[2]);
            const terminal = String(row[3]).trim();
            const count = Number(row[4]);
            
            // Only process valid coordinates (Poland is roughly 49-55 lat, 14-25 lon)
            if (!isNaN(lat) && !isNaN(lon) && lat >= 49 && lat <= 55 && lon >= 14 && lon <= 25) {
              const cityKey = city.toLowerCase();
              
              // If this is the first time we see this city, save its coordinates
              if (!cityLocationsMap.has(cityKey)) {
                cityLocationsMap.set(cityKey, {
                  city: city,
                  latitude: lat,
                  longitude: lon,
                  terminal: terminal
                });
              }
              
              // Accumulate the count for this city
              const currentCount = cityCountsMap.get(cityKey) || 0;
              cityCountsMap.set(cityKey, currentCount + count);
            }
          }
        });
      }
    }
    
    // Build the final locations array
    const locations = [];
    for (const [cityKey, location] of cityLocationsMap.entries()) {
      locations.push({
        city: location.city,
        latitude: location.latitude,
        longitude: location.longitude,
        terminal: location.terminal,
        count: cityCountsMap.get(cityKey) || 0
      });
    }
    
    // Sort by count descending
    locations.sort((a, b) => b.count - a.count);
    
    // Apply minimum count filter if provided
    let filteredLocations = locations;
    if (minCount) {
      const minCountNum = parseInt(minCount);
      if (!isNaN(minCountNum)) {
        filteredLocations = locations.filter(loc => loc.count >= minCountNum);
      }
    }
    
    // Apply limit if provided
    if (limit) {
      const limitNum = parseInt(limit);
      if (!isNaN(limitNum) && limitNum > 0) {
        filteredLocations = filteredLocations.slice(0, limitNum);
      }
    }
    
    res.json({ data: filteredLocations });
  } catch (error) {
    console.error('Error in city-locations-with-counts endpoint:', error);
    res.status(500).json({ error: 'Failed to get city locations', message: error.message });
  }
});

router.get('/seasonality-analysis', async (req, res) => {
  try {
    const catalog = process.env.TRINO_CATALOG || 'hive';
    const schema = process.env.TRINO_SCHEMA || 'default';
    const tableName = 'shipments';
    
    try {
      const syncQuery = `CALL system.sync_partition_metadata('${schema}', '${tableName}', 'FULL')`;
      const syncIterator = await trinoClient.query(syncQuery);
      for await (const _ of syncIterator) {
      }
    } catch (syncError) {
      console.error('Error syncing partitions:', syncError.message);
    }
    
    // Get monthly shipment counts across all available data
    const query = `
      SELECT 
        CAST(SUBSTRING(date_of_shipment, 1, 7) AS VARCHAR) AS month_year,
        COUNT(*) AS count
      FROM ${catalog}.${schema}.${tableName}
      WHERE date_of_shipment IS NOT NULL
      GROUP BY CAST(SUBSTRING(date_of_shipment, 1, 7) AS VARCHAR)
      ORDER BY month_year
    `;
    
    const queryIterator = await trinoClient.query(query);
    const monthlyData = [];
    
    for await (const queryResult of queryIterator) {
      if (queryResult.data && queryResult.data.length > 0) {
        queryResult.data.forEach(row => {
          if (Array.isArray(row) && row.length >= 2) {
            const monthYear = String(row[0]);
            const count = Number(row[1]);
            monthlyData.push({
              month: monthYear,
              count: count
            });
          }
        });
      }
    }
    
    res.json({ data: monthlyData });
  } catch (error) {
    console.error('Error in seasonality-analysis endpoint:', error);
    res.status(500).json({ error: 'Failed to get seasonality analysis', message: error.message });
  }
});

router.get('/hourly-demand', async (req, res) => {
  try {
    const catalog = process.env.TRINO_CATALOG || 'hive';
    const schema = process.env.TRINO_SCHEMA || 'default';
    const tableName = 'shipments';
    
    const { month, year, date } = req.query;
    
    try {
      const syncQuery = `CALL system.sync_partition_metadata('${schema}', '${tableName}', 'FULL')`;
      const syncIterator = await trinoClient.query(syncQuery);
      for await (const _ of syncIterator) {
      }
    } catch (syncError) {
      console.error('Error syncing partitions:', syncError.message);
    }
    
    // Build date filter
    let dateFilter = '';
    if (date) {
      dateFilter = `AND date_of_shipment = '${date}'`;
    } else if (month && year) {
      const monthStr = String(month).padStart(2, '0');
      dateFilter = `AND date_of_shipment LIKE '${year}-${monthStr}-%'`;
    }
    
    // Get hourly distribution - extract hour from hour_of_shipment
    // hour_of_shipment format is typically HH:MM:SS or HH:MM
    const query = `
      SELECT 
        CAST(SUBSTRING(hour_of_shipment, 1, 2) AS INTEGER) AS hour,
        COUNT(*) AS count
      FROM ${catalog}.${schema}.${tableName}
      WHERE hour_of_shipment IS NOT NULL
        AND hour_of_shipment != ''
        AND CAST(SUBSTRING(hour_of_shipment, 1, 2) AS INTEGER) BETWEEN 0 AND 23
        ${dateFilter}
      GROUP BY CAST(SUBSTRING(hour_of_shipment, 1, 2) AS INTEGER)
      ORDER BY hour
    `;
    
    const queryIterator = await trinoClient.query(query);
    const hourlyDataMap = {};
    
    for await (const queryResult of queryIterator) {
      if (queryResult.data && queryResult.data.length > 0) {
        queryResult.data.forEach(row => {
          if (Array.isArray(row) && row.length >= 2) {
            const hour = Number(row[0]);
            const count = Number(row[1]);
            if (!isNaN(hour) && hour >= 0 && hour <= 23) {
              hourlyDataMap[hour] = count;
            }
          }
        });
      }
    }
    
    // Build result array with all 24 hours, filling missing hours with 0
    const result = [];
    for (let hour = 0; hour < 24; hour++) {
      result.push({
        hour: hour,
        count: hourlyDataMap[hour] || 0
      });
    }
    
    res.json({ data: result });
  } catch (error) {
    console.error('Error in hourly-demand endpoint:', error);
    res.status(500).json({ error: 'Failed to get hourly demand', message: error.message });
  }
});

module.exports = router;

