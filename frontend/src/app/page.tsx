import ShipmentsCard from '@/components/ShipmentsCard';
import AverageWeeklyCard from '@/components/AverageWeeklyCard';
import AverageMonthlyCard from '@/components/AverageMonthlyCard';
import AverageAnnualCard from '@/components/AverageAnnualCard';
import TopTerminalCard from '@/components/TopTerminalCard';
import BottomTerminalCard from '@/components/BottomTerminalCard';
import ShipmentsChart from '@/components/ShipmentsChart';
import CityTerminalChart from '@/components/CityTerminalChart';
import SenderTerminalChart from '@/components/SenderTerminalChart';
import TerminalSpecificChart from '@/components/TerminalSpecificChart';
import TerminalsComparisonChart from '@/components/TerminalsComparisonChart';
import TopCitiesList from '@/components/TopCitiesList';
import TerminalCitiesList from '@/components/TerminalCitiesList';
import SenderTerminalCitiesList from '@/components/SenderTerminalCitiesList';
import TerminalAssignedCitiesList from '@/components/TerminalAssignedCitiesList';
import ShipmentTypeDistribution from '@/components/ShipmentTypeDistribution';
import ShipmentSizeDistribution from '@/components/ShipmentSizeDistribution';
import ShipmentWeightDistribution from '@/components/ShipmentWeightDistribution';
import TerminalLocationsMap from '@/components/TerminalLocationsMap';
import CityHeatmap from '@/components/CityHeatmap';
import CountryDistributionMap from '@/components/CountryDistributionMap';
import TerminalCountryStats from '@/components/TerminalCountryStats';
import Navigation from '@/components/Navigation';
import LogisticsSection from '@/components/LogisticsSection';
import SeasonalityAnalysisChart from '@/components/SeasonalityAnalysisChart';
import HourlyDemandChart from '@/components/HourlyDemandChart';

export default function Home() {
  return (
    <>
      <Navigation />
      <main className="min-h-screen bg-slate-950">
        <section id="overview" className="p-8 pt-6">
          <div className="container mx-auto space-y-6">
          <h1 className="text-white text-3xl font-bold mb-8 pb-3 border-b-2 border-green-500/30 inline-block">Overview</h1>
            <div className="flex gap-6 flex-wrap justify-center">
              <AverageWeeklyCard />
              <AverageMonthlyCard />
              <AverageAnnualCard />
              <ShipmentsCard />
              <TopTerminalCard />
              <BottomTerminalCard />
            </div>
          </div>
        </section>
        <section id="monthly-trend" className="min-h-screen p-8">
          <div className="container mx-auto">
            <h1 className="text-white text-3xl font-bold mb-8 pb-3 border-b-2 border-green-500/30 inline-block">Monthly Trend</h1>
            <ShipmentsChart />
            <div className="mt-8">
              <SeasonalityAnalysisChart />
            </div>
          </div>
        </section>
        <section id="demand-patterns" className="min-h-screen p-8">
          <div className="container mx-auto">
            <h1 className="text-white text-3xl font-bold mb-8 pb-3 border-b-2 border-green-500/30 inline-block">Demand Patterns</h1>
            <div className="mb-6">
              <div className="p-4 bg-gray-800/50 rounded-lg border-t-4 border-purple-500 text-center">
                <h2 className="text-white text-lg font-semibold mb-1">Hourly Demand Analysis</h2>
                <p className="text-gray-400 text-sm">Identify peak hours and daily shipment patterns</p>
              </div>
            </div>
            <HourlyDemandChart />
          </div>
        </section>
        <section id="shipments" className="min-h-screen p-8">
          <div className="container mx-auto">
            <h1 className="text-white text-3xl font-bold mb-8 pb-3 border-b-2 border-green-500/30 inline-block">Shipments</h1>
            <div className="grid grid-cols-1 lg:grid-cols-2 gap-6 mb-6">
              <ShipmentTypeDistribution />
              <ShipmentSizeDistribution />
            </div>
            <div className="mt-6">
              <ShipmentWeightDistribution />
            </div>
          </div>
        </section>
        <section id="terminals" className="min-h-screen p-8">
          <div className="container mx-auto">
            <h1 className="text-white text-3xl font-bold mb-8 pb-3 border-b-2 border-green-500/30 inline-block">Terminals</h1>
            <div className="mb-6">
              <div className="p-4 bg-gray-800/50 rounded-lg border-t-4 border-blue-500 text-center">
                <h2 className="text-white text-lg font-semibold mb-1">Received Shipments</h2>
                <p className="text-gray-400 text-sm">The amount of shipments received by terminals in a given month, week or day</p>
              </div>
            </div>
            <div className="mb-12">
              <CityTerminalChart />
            </div>
            <div className="border-t border-gray-700 my-12"></div>
            <div className="mb-6">
              <div className="p-4 bg-gray-800/50 rounded-lg border-t-4 border-purple-500 text-center">
                <h2 className="text-white text-lg font-semibold mb-1">Sent Shipments</h2>
                <p className="text-gray-400 text-sm">The amount of shipments sent from terminals in a given month, week or day</p>
              </div>
            </div>
            <div className="mb-10">
              <SenderTerminalChart />
            </div>
            <div className="border-t border-gray-700 my-12"></div>
            <div className="mb-6">
              <div className="p-4 bg-gray-800/50 rounded-lg border-t-4 border-green-500 text-center">
                <h2 className="text-white text-lg font-semibold mb-1">Terminal Performance</h2>
                <p className="text-gray-400 text-sm">Detailed view of shipments for a specific terminal</p>
              </div>
            </div>
            <TerminalSpecificChart />
            <div className="border-t border-gray-700 my-12"></div>
            <div className="mb-6">
              <div className="p-4 bg-gray-800/50 rounded-lg border-t-4 border-yellow-500 text-center">
                <h2 className="text-white text-lg font-semibold mb-1">Terminals Comparison</h2>
                <p className="text-gray-400 text-sm">Compare shipments across multiple terminals</p>
              </div>
            </div>
            <TerminalsComparisonChart />
          </div>
        </section>
        <section id="cities" className="min-h-screen p-8">
          <div className="container mx-auto">
            <h1 className="text-white text-3xl font-bold mb-8 pb-3 border-b-2 border-green-500/30 inline-block">Cities</h1>
            <div className="mb-6">
              <div className="p-4 bg-gray-800/50 rounded-lg border-t-4 border-green-500 text-center">
                <h2 className="text-white text-lg font-semibold mb-1">City Selection</h2>
                <p className="text-gray-400 text-sm">Select cities to view shipments and deliveries data</p>
              </div>
            </div>
            <TopCitiesList />
            <div className="border-t border-gray-700 my-12"></div>
            <div className="mb-6">
              <div className="p-4 bg-gray-800/50 rounded-lg border-t-4 border-blue-500 text-center">
                <h2 className="text-white text-lg font-semibold mb-1">Cities by Terminal</h2>
                <p className="text-gray-400 text-sm">View the most popular cities for a selected terminal</p>
              </div>
            </div>
            <TerminalCitiesList />
            <div className="border-t border-gray-700 my-12"></div>
            <div className="mb-6">
              <div className="p-4 bg-gray-800/50 rounded-lg border-t-4 border-purple-500 text-center">
                <h2 className="text-white text-lg font-semibold mb-1">Cities Receiving Shipments</h2>
                <p className="text-gray-400 text-sm">Select a terminal to see cities receiving shipments from it with shipment counts</p>
              </div>
            </div>
            <SenderTerminalCitiesList />
            <div className="border-t border-gray-700 my-12"></div>
            <div className="mb-6">
              <div className="p-4 bg-gray-800/50 rounded-lg border-t-4 border-yellow-500 text-center">
                <h2 className="text-white text-lg font-semibold mb-1">Cities Assigned to Terminal</h2>
                <p className="text-gray-400 text-sm">Select a terminal to see all cities assigned to it</p>
              </div>
            </div>
            <TerminalAssignedCitiesList />
          </div>
        </section>
        <section id="maps" className="min-h-screen p-8">
          <div className="container mx-auto">
            <h1 className="text-white text-3xl font-bold mb-8 pb-3 border-b-2 border-green-500/30 inline-block">Maps</h1>
            <TerminalLocationsMap />
            <div className="mt-8">
              <CityHeatmap />
            </div>
            <div className="mt-8">
              <CountryDistributionMap />
            </div>
            <div className="mt-8">
              <TerminalCountryStats />
            </div>
          </div>
        </section>
        <section id="Logistics" className="min-h-screen p-8">
          <div className="container mx-auto">
            <h1 className="text-white text-3xl font-bold mb-8 pb-3 border-b-2 border-green-500/30 inline-block">Logistics</h1>
            <div className="mb-6">
              <div className="p-4 bg-gray-800/50 rounded-lg border-t-4 border-blue-500 text-center">
                <h2 className="text-white text-lg font-semibold mb-1">Demand Forecast</h2>
                <p className="text-gray-400 text-sm">Predictive analysis of shipment demand for the next month based on historical patterns</p>
              </div>
            </div>
            <LogisticsSection />
          </div>
        </section>
      </main>
    </>
  );
}

