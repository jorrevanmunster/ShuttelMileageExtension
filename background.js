// This is the background service worker for the Chrome Extension.
// It runs in the background and handles communication and data storage.

/**
 * Enhanced function to extract Highcharts data with better error handling and flexibility.
 * This function will search for all available charts and extract mileage data.
 */
function extractHighchartsData() {
    console.log('Starting Highcharts data extraction...');
    
    // Check if Highcharts library is available
    if (typeof Highcharts === 'undefined' || !Highcharts.charts) {
        console.warn("Highcharts library not found or no charts available.");
        return { error: "Highcharts not found", charts: [] };
    }

    console.log(`Found ${Highcharts.charts.length} Highcharts charts`);
    
    const chartsData = [];
    const currentYear = new Date().getFullYear();
    
    // Iterate through all available charts
    Highcharts.charts.forEach((chart, index) => {
        if (!chart) return;
        
        try {
            const chartInfo = {
                index: index,
                title: chart.title && chart.title.textStr ? chart.title.textStr : `Chart ${index}`,
                series: [],
                categories: [],
                xAxisType: null
            };

            // Get categories from xAxis if available
            if (chart.xAxis && chart.xAxis[0] && chart.xAxis[0].categories) {
                chartInfo.categories = chart.xAxis[0].categories;
                chartInfo.xAxisType = 'categories';
            } else if (chart.xAxis && chart.xAxis[0] && chart.xAxis[0].names) {
                chartInfo.categories = Object.values(chart.xAxis[0].names);
                chartInfo.xAxisType = 'names';
            }

            // Extract series data
            if (chart.series) {
                chart.series.forEach(series => {
                    if (series.name && series.data) {
                        const seriesData = {
                            name: series.name,
                            data: series.data.map(point => {
                                if (typeof point === 'number') {
                                    return point;
                                } else if (point && typeof point === 'object') {
                                    return point.y !== undefined ? point.y : point.value || 0;
                                }
                                return 0;
                            }),
                            visible: series.visible !== false
                        };
                        chartInfo.series.push(seriesData);
                    }
                });
            }

            chartsData.push(chartInfo);
            console.log(`Chart ${index} extracted:`, chartInfo);
            
        } catch (error) {
            console.error(`Error extracting chart ${index}:`, error);
        }
    });

    // Try to find the mileage chart and calculate totals
    let mileageData = { totalKm: null, privateKm: null };
    
    for (const chartInfo of chartsData) {
        // Look for charts that might contain mileage data
        const hasMileageData = chartInfo.series.some(series => 
            series.name === "Zakelijk" || series.name === "Woon-werk" || 
            series.name.toLowerCase().includes('km') || 
            series.name.toLowerCase().includes('mileage')
        );
        
        if (hasMileageData) {
            console.log('Found potential mileage chart:', chartInfo);
            
            let totalBusinessKm = 0;
            let totalCommuteKm = 0;
            
            // Calculate totals for current year
            chartInfo.series.forEach(series => {
                if (!series.visible) return; // Skip hidden series
                
                let seriesTotal = 0;
                
                if (chartInfo.categories.length > 0) {
                    // Filter by current year if categories contain year info
                    series.data.forEach((value, index) => {
                        if (index < chartInfo.categories.length) {
                            const category = chartInfo.categories[index];
                            if (typeof category === 'string' && category.includes(currentYear.toString())) {
                                seriesTotal += value || 0;
                            } else if (chartInfo.categories.length <= 12) {
                                // If 12 or fewer categories, assume it's current year monthly data
                                seriesTotal += value || 0;
                            }
                        }
                    });
                } else {
                    // No categories, sum all data (assume current year)
                    seriesTotal = series.data.reduce((sum, val) => sum + (val || 0), 0);
                }
                
                if (series.name === "Zakelijk") {
                    totalBusinessKm = seriesTotal;
                } else if (series.name === "Woon-werk") {
                    totalCommuteKm = seriesTotal;
                }
            });
            
            mileageData = {
                totalKm: parseFloat((totalBusinessKm + totalCommuteKm).toFixed(2)),
                privateKm: parseFloat(totalCommuteKm.toFixed(2)),
                businessKm: parseFloat(totalBusinessKm.toFixed(2))
            };
            
            console.log('Calculated mileage data:', mileageData);
            break;
        }
    }

    return {
        mileageData: mileageData,
        charts: chartsData,
        totalCharts: chartsData.length
    };
}

/**
 * Alternative function to extract data by searching the DOM for chart elements
 */
function extractDataFromDOM() {
    console.log('Attempting DOM-based data extraction...');
    
    const results = {
        mileageData: { totalKm: null, privateKm: null },
        foundElements: []
    };
    
    let totalBusiness = 0;
    let totalCommute = 0;

    // Find the series groups
    const seriesGroups = document.querySelectorAll('g.highcharts-series');

    seriesGroups.forEach(group => {
        const ariaLabel = group.getAttribute('aria-label');
        if (ariaLabel) {
            const rects = group.querySelectorAll('rect');
            let currentSeriesTotal = 0;

            rects.forEach(rect => {
                const rectAriaLabel = rect.getAttribute('aria-label');
                if (rectAriaLabel) {
                    const match = rectAriaLabel.match(/(\d{4}-\d{2}),\s*([\d.]+)/);
                    if (match && match[2]) {
                        currentSeriesTotal += parseFloat(match[2]);
                    }
                }
            });

            if (ariaLabel.includes('Zakelijk')) {
                totalBusiness += currentSeriesTotal;
            } else if (ariaLabel.includes('Woon-werk')) {
                totalCommute += currentSeriesTotal;
            }
        }
    });
    
    if (totalBusiness > 0 || totalCommute > 0) {
        results.mileageData = {
            totalKm: parseFloat((totalBusiness + totalCommute).toFixed(2)),
            privateKm: parseFloat(totalCommute.toFixed(2)),
            businessKm: parseFloat(totalBusiness.toFixed(2))
        };
    }
    
    return results;
}

/**
 * Listener for messages from the popup.
 * Enhanced to try multiple extraction methods.
 */
chrome.runtime.onMessage.addListener((request, sender, sendResponse) => {
    if (request.action === "fetchMileageFromHighchartsAPI") {
        const tabId = request.tabId;

        (async () => {
            try {
                console.log('Starting mileage data extraction for tab:', tabId);
                
                // Get all frames for the current tab
                const frames = await chrome.webNavigation.getAllFrames({ tabId: tabId });
                console.log('Found frames:', frames.map(f => ({ frameId: f.frameId, url: f.url })));

                // Try different frames in order of preference
                const framesToTry = [
                    // First try iframes with srcdoc
                    ...frames.filter(frame => frame.frameId !== 0 && frame.url.startsWith('about:srcdoc')),
                    // Then try other iframes
                    ...frames.filter(frame => frame.frameId !== 0 && !frame.url.startsWith('about:srcdoc')),
                    // Finally try main frame
                    frames.find(frame => frame.frameId === 0)
                ].filter(Boolean);

                let bestResult = null;
                let extractionLog = [];

                for (const frame of framesToTry) {
                    try {
                        console.log(`Trying extraction on frame ${frame.frameId} (${frame.url})`);
                        
                        // Try Highcharts extraction first
                        const highchartsResults = await chrome.scripting.executeScript({
                            target: { tabId: tabId, frameIds: [frame.frameId] },
                            func: extractHighchartsData
                        });

                        if (highchartsResults && highchartsResults[0] && highchartsResults[0].result) {
                            const result = highchartsResults[0].result;
                            extractionLog.push({
                                frameId: frame.frameId,
                                method: 'Highcharts',
                                success: !!result.mileageData && result.mileageData.totalKm !== null,
                                data: result
                            });

                            if (result.mileageData && result.mileageData.totalKm !== null) {
                                bestResult = result.mileageData;
                                console.log('Successfully extracted data via Highcharts:', bestResult);
                                break;
                            }
                        }

                        // Try DOM extraction as fallback
                        const domResults = await chrome.scripting.executeScript({
                            target: { tabId: tabId, frameIds: [frame.frameId] },
                            func: extractDataFromDOM
                        });

                        if (domResults && domResults[0] && domResults[0].result) {
                            const result = domResults[0].result;
                            extractionLog.push({
                                frameId: frame.frameId,
                                method: 'DOM',
                                success: !!result.mileageData && result.mileageData.totalKm !== null,
                                data: result
                            });

                            if (result.mileageData && result.mileageData.totalKm !== null && !bestResult) {
                                bestResult = result.mileageData;
                                console.log('Successfully extracted data via DOM:', bestResult);
                            }
                        }

                    } catch (frameError) {
                        console.error(`Error extracting from frame ${frame.frameId}:`, frameError);
                        extractionLog.push({
                            frameId: frame.frameId,
                            method: 'Error',
                            success: false,
                            error: frameError.message
                        });
                    }
                }

                console.log('Extraction log:', extractionLog);

                if (bestResult) {
                    // Store the last fetched data for persistence
                    chrome.storage.local.set({ lastMileageData: bestResult });
                    sendResponse({ mileageData: bestResult, extractionLog: extractionLog });
                } else {
                    sendResponse({ 
                        mileageData: null, 
                        error: "Could not extract mileage data from any frame",
                        extractionLog: extractionLog
                    });
                }

            } catch (error) {
                console.error('Background: Error in mileage extraction:', error);
                sendResponse({ 
                    mileageData: null, 
                    error: error.message,
                    extractionLog: []
                });
            }
        })();

        return true; // Indicates that sendResponse will be called asynchronously
    }
});

chrome.runtime.onInstalled.addListener(() => {
    console.log('Shuttel Mileage Tracker extension installed.');
});