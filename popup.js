document.addEventListener('DOMContentLoaded', () => {
    const saveManualMileageBtn = document.getElementById('saveManualMileageBtn');
    const manualTotalKmInput = document.getElementById('manualTotalKm');
    const manualDateInput = document.getElementById('manualDate');
    const fetchWorkMileageBtn = document.getElementById('fetchWorkMileageBtn');
    const loadingIndicator = document.getElementById('loadingIndicator');

    const overviewTotalSpan = document.getElementById('overviewTotal');
    const overviewWorkSpan = document.getElementById('overviewWork');
    const overviewPrivateSpan = document.getElementById('overviewPrivate');
    const mileageHistoryDiv = document.getElementById('mileageHistory');
    const statusMessage = document.getElementById('statusMessage');

    /**
     * Renders the history of saved odometer readings.
     */
    function renderMileageHistory(history) {
        mileageHistoryDiv.innerHTML = '';
        if (history && history.length > 0) {
            history.sort((a, b) => b.timestamp - a.timestamp);

            history.forEach((item, index) => {
                const date = new Date(item.timestamp);
                const formattedDate = date.toLocaleDateString();
                const historyItem = document.createElement('div');
                historyItem.className = 'history-item';
                historyItem.innerHTML = `
                    <span>${formattedDate}: <strong>${item.totalKm} km</strong></span>
                    <button class="delete-btn" data-index="${index}">Delete</button>
                `;
                mileageHistoryDiv.appendChild(historyItem);
            });

            mileageHistoryDiv.querySelectorAll('.delete-btn').forEach(button => {
                button.addEventListener('click', (event) => {
                    const indexToDelete = parseInt(event.target.dataset.index);
                    deleteMileageSnapshot(indexToDelete);
                });
            });
        } else {
            mileageHistoryDiv.innerHTML = '<p class="text-gray-600">No readings saved yet.</p>';
        }
    }

    /**
     * Deletes an odometer reading from storage.
     */
    function deleteMileageSnapshot(indexToDelete) {
        chrome.storage.local.get(['mileageHistory'], (result) => {
            let history = result.mileageHistory || [];
            history.sort((a, b) => b.timestamp - a.timestamp);
            if (indexToDelete >= 0 && indexToDelete < history.length) {
                history.splice(indexToDelete, 1);
                chrome.storage.local.set({ mileageHistory: history }, () => {
                    renderMileageHistory(history);
                    updateOverview();
                });
            }
        });
    }

    /**
     * Saves a manually entered odometer reading.
     */
    saveManualMileageBtn.addEventListener('click', () => {
        const manualKm = parseFloat(manualTotalKmInput.value);
        const manualDateStr = manualDateInput.value;

        if (isNaN(manualKm) || manualKm < 0) {
            statusMessage.textContent = 'Please enter a valid positive number for mileage.';
            return;
        }
        if (!manualDateStr) {
            statusMessage.textContent = 'Please select a date.';
            return;
        }

        const selectedDate = new Date(manualDateStr);
        if (isNaN(selectedDate.getTime())) {
            statusMessage.textContent = 'Invalid date selected.';
            return;
        }

        const mileageSnapshot = {
            totalKm: manualKm,
            timestamp: selectedDate.getTime()
        };

        chrome.storage.local.get(['mileageHistory'], (result) => {
            let history = result.mileageHistory || [];
            history.push(mileageSnapshot);
            chrome.storage.local.set({ mileageHistory: history }, () => {
                statusMessage.textContent = 'Odometer reading saved!';
                setTimeout(() => statusMessage.textContent = '', 3000);
                renderMileageHistory(history);
                updateOverview();
                manualTotalKmInput.value = '';
                // Reset date to today after saving
                const today = new Date();
                const yyyy = today.getFullYear();
                const mm = String(today.getMonth() + 1).padStart(2, '0');
                const dd = String(today.getDate()).padStart(2, '0');
                manualDateInput.value = `${yyyy}-${mm}-${dd}`;
            });
        });
    });

    /**
     * Fetches work mileage data from the Shuttel portal by traversing Shadow DOM.
     */
    fetchWorkMileageBtn.addEventListener('click', async () => {
        loadingIndicator.classList.remove('hidden');
        statusMessage.textContent = 'Fetching data from Shuttel...';

        const [tab] = await chrome.tabs.query({ active: true, currentWindow: true });

        if (!tab || !tab.url || !tab.url.includes('mijn.shuttel.nl')) {
            statusMessage.textContent = 'Please navigate to mijn.shuttel.nl.';
            loadingIndicator.classList.add('hidden');
            return;
        }

        try {
            const results = await chrome.scripting.executeScript({
                target: { tabId: tab.id, allFrames: true },
                function: extractChartDataFromShadowDOM
            });

            const successfulResult = results.find(res => res.result && res.result.chartData && Object.keys(res.result.chartData).length > 0);

            if (successfulResult) {
                const shuttelData = successfulResult.result;
                chrome.storage.local.set({ workData: shuttelData.chartData }, () => {
                    statusMessage.textContent = 'Work mileage data updated successfully!';
                    setTimeout(() => statusMessage.textContent = '', 3000);
                    updateOverview();
                });
            } else {
                statusMessage.textContent = 'Could not find chart data. Is the mileage chart visible?';
            }
        } catch (e) {
            statusMessage.textContent = 'An error occurred while fetching data.';
            console.error(e);
        }

        loadingIndicator.classList.add('hidden');
    });

    /**
     * Injected function to get data by traversing the Shadow DOM based on user-provided path.
     */
    function extractChartDataFromShadowDOM() {
        const allSeriesData = {};
        let dataFound = false;

        try {
            const view = document.querySelector('body > mobile-view > year-dashboard-view');
            if (!view || !view.shadowRoot) return { chartData: {} };

            const chartContainer = view.shadowRoot.querySelector('#yearChart2');
            if (!chartContainer || !chartContainer.shadowRoot) return { chartData: {} };

            const points = chartContainer.shadowRoot.querySelectorAll('svg .highcharts-series-group rect[aria-label]');

            points.forEach(point => {
                const label = point.getAttribute('aria-label');
                const parts = label.split(',');
                if (parts.length < 2) return;

                const dateMatch = label.match(/(\d{4}-\d{2})/);
                const valueMatch = label.match(/, ([\d,]+\.?\d*)\./);

                if (dateMatch && valueMatch) {
                    const key = dateMatch[0];
                    const valueStr = valueMatch[1].replace(',', '');
                    const value = parseFloat(valueStr);

                    if (!isNaN(value)) {
                        if (!allSeriesData[key]) {
                            allSeriesData[key] = 0;
                        }
                        allSeriesData[key] += value;
                        dataFound = true;
                    }
                }
            });
        } catch (error) {
            return { error: 'Failed to access Shadow DOM elements.' };
        }

        return dataFound ? { chartData: allSeriesData } : { chartData: {} };
    }

    /**
     * Calculates and updates the overview display with final robust logic.
     */
    function updateOverview() {
        chrome.storage.local.get(['mileageHistory', 'workData'], (result) => {
            let history = result.mileageHistory || [];
            let workData = result.workData || {};

            history.sort((a, b) => a.timestamp - b.timestamp);

            const today = new Date();
            const startYear = today.getMonth() >= 6 ? today.getFullYear() : today.getFullYear() - 1; // 6 = July
            const startOfTrackingYear = new Date(startYear, 6, 1);
            startOfTrackingYear.setHours(0, 0, 0, 0);

            const readingsBefore = history.filter(r => r.timestamp < startOfTrackingYear.getTime());
            const readingsInPeriod = history.filter(r => r.timestamp >= startOfTrackingYear.getTime());

            let totalWorkKm = 0;
            for (const key in workData) {
                const [year, month] = key.split('-');
                const workDate = new Date(parseInt(year), parseInt(month) - 1, 1);
                if (workDate.getTime() >= startOfTrackingYear.getTime()) {
                    totalWorkKm += workData[key];
                }
            }
            
            // We can always show the work KM we've fetched.
            overviewWorkSpan.textContent = `${totalWorkKm.toFixed(2)} km`;

            if (readingsInPeriod.length === 0) {
                // No readings in the current period, so we can't calculate driven/private km.
                overviewTotalSpan.textContent = 'N/A (No recent reading)';
                overviewPrivateSpan.textContent = 'N/A';
                return;
            }

            const latestKm = readingsInPeriod[readingsInPeriod.length - 1].totalKm;
            let baselineKm = 0;

            if (readingsBefore.length > 0) {
                // Ideal case: We have a reading from last year to compare against.
                baselineKm = readingsBefore[readingsBefore.length - 1].totalKm;
            } else {
                // Case: User started tracking this year. Compare against the first reading of this year.
                baselineKm = readingsInPeriod[0].totalKm;
            }
            
            const totalDriven = latestKm - baselineKm;
            const privateKm = totalDriven - totalWorkKm;

            overviewTotalSpan.textContent = `${totalDriven.toFixed(2)} km`;
            overviewPrivateSpan.textContent = `${privateKm.toFixed(2)} km`;
        });
    }

    // Initial load
    chrome.storage.local.get(['mileageHistory', 'workData'], (result) => {
        renderMileageHistory(result.mileageHistory);
        updateOverview();

        const today = new Date();
        const yyyy = today.getFullYear();
        const mm = String(today.getMonth() + 1).padStart(2, '0');
        const dd = String(today.getDate()).padStart(2, '0');
        manualDateInput.value = `${yyyy}-${mm}-${dd}`;
    });
});