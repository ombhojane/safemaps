import { getAccidentHotspotData, analyzeAccidentHotspots, getAccidentHotspotContext } from './accidentHotspotsService';

/**
 * Test function for the accident hotspot service
 */
async function testAccidentHotspotService() {
  console.log('============= TESTING ACCIDENT HOTSPOT SERVICE =============');
  
  // Test addresses
  const testAddresses = [
    "Marine Drive, Mumbai, Maharashtra, India",
    "Bandra Worli Sea Link, Mumbai, Maharashtra, India",
    "Times Square, New York, USA"
  ];
  
  console.log('Testing getAccidentHotspotData:');
  for (const address of testAddresses) {
    console.log(`\n--- Testing address: ${address} ---`);
    try {
      const result = await getAccidentHotspotData(address);
      console.log('Results:');
      console.log(JSON.stringify(result, null, 2));
    } catch (error) {
      console.error(`Error testing ${address}:`, error);
    }
  }
  
  console.log('\nTesting getAccidentHotspotContext:');
  try {
    const streetName = "Marine Drive";
    const city = "Mumbai";
    const region = "Maharashtra";
    console.log(`\n--- Testing context for: ${streetName}, ${city}, ${region} ---`);
    const contextResult = await getAccidentHotspotContext(streetName, city, region);
    console.log('Context Result:');
    console.log(contextResult);
  } catch (error) {
    console.error('Error testing context:', error);
  }
  
  console.log('\nTesting analyzeAccidentHotspots (LangChain agent):');
  try {
    const agentAddress = "Bandra Worli Sea Link, Mumbai";
    console.log(`\n--- Testing agent with address: ${agentAddress} ---`);
    const agentResult = await analyzeAccidentHotspots(agentAddress);
    console.log('Agent Result:');
    console.log(agentResult);
  } catch (error) {
    console.error('Error testing agent:', error);
  }
  
  console.log('\n============= TEST COMPLETED =============');
}

// Run the test
testAccidentHotspotService().catch(err => {
  console.error('Test failed with error:', err);
});

// Export the test function for use elsewhere if needed
export { testAccidentHotspotService }; 