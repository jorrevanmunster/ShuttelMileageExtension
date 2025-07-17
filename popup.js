document.addEventListener('DOMContentLoaded', () => {
    const saveManualMileageBtn = document.getElementById('saveManualMileageBtn');
    const manualTotalKmInput = document.getElementById('manualTotalKm');
    const manualDateInput = document.getElementById('manualDate');
    const fetchWorkMileageBtn = document.getElementById('fetchWorkMileageBtn');
    const loadingIndicator = document.getElementById('loadingIndicator');
    const yearSelector = document.getElementById('yearSelector');
    const logCarChangeBtn = document.getElementById('logCarChangeBtn');
    const carChangeForm = document.getElementById('carChangeForm');
    const saveCarChangeBtn = document.getElementById('saveCarChangeBtn');
    const changeDateInput = document.getElementById('changeDate');
    const oldCarFinalKmInput = document.getElementById('oldCarFinalKm');
    const newCarStartKmInput = document.getElementById('newCarStartKm');
    const clearCarChangesBtn = document.getElementById('clearCarChangesBtn');

    const overviewTotalSpan = document.getElementById('overviewTotal');
    const overviewWorkSpan = document.getElementById('overviewWork');
    const overviewPrivateSpan = document.getElementById('overviewPrivate');
    const mileageHistoryDiv = document.getElementById('mileageHistory');
    const statusMessage = document.getElementById('statusMessage');

    logCarChangeBtn.addEventListener('click', () => {
        carChangeForm.classList.toggle('hidden');
    });

    saveCarChangeBtn.addEventListener('click', () => {
        const changeDate = changeDateInput.value;
        const oldCarFinalKm = parseFloat(oldCarFinalKmInput.value);
        const newCarStartKm = parseFloat(newCarStartKmInput.value);

        if (!changeDate || isNaN(oldCarFinalKm) || isNaN(newCarStartKm)) {
            statusMessage.textContent = 'Please fill in all fields for the car change.';
            return;
        }

        const carChange = {
            date: new Date(changeDate).getTime(),
            oldCarFinalKm: oldCarFinalKm,
            newCarStartKm: newCarStartKm
        };

        chrome.storage.local.get(['carChanges'], (result) => {
            let carChanges = result.carChanges || [];
            carChanges.push(carChange);
            chrome.storage.local.set({ carChanges: carChanges }, () => {
                statusMessage.textContent = 'Car change logged successfully!';
                setTimeout(() => statusMessage.textContent = '', 3000);
                carChangeForm.classList.add('hidden');
                updateOverview();
            });
        });
    });

    clearCarChangesBtn.addEventListener('click', () => {
        chrome.storage.local.set({ carChanges: [] }, () => {
            statusMessage.textContent = 'All car changes have been cleared.';
            setTimeout(() => statusMessage.textContent = '', 3000);
            updateOverview();
        });
    });

    /**
     * Populates the year selector based on available data.
     */
    function populateYearSelector() {
        chrome.storage.local.get(['mileageHistory'], (result) => {
            const history = result.mileageHistory || [];
            const years = new Set();
            history.forEach(item => {
                const date = new Date(item.timestamp);
                const year = date.getFullYear();
                const month = date.getMonth();
                const trackingYear = month < 6 ? year - 1 : year;
                years.add(trackingYear);
            });

            const currentYear = new Date().getFullYear();
            const currentTrackingYear = new Date().getMonth() < 6 ? currentYear - 1 : currentYear;
            years.add(currentTrackingYear);

            yearSelector.innerHTML = '';
            const sortedYears = Array.from(years).sort((a, b) => b - a);
            sortedYears.forEach(year => {
                const option = document.createElement('option');
                option.value = year;
                option.textContent = `July ${year} - June ${year + 1}`;
                yearSelector.appendChild(option);
            });

            yearSelector.value = currentTrackingYear;
            updateOverview();
        });
    }

    yearSelector.addEventListener('change', () => {
        updateOverview();
    });

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
                    populateYearSelector();
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
                populateYearSelector();
                updateOverview();
                manualTotalKmInput.value = '';
                const today = new Date();
                const yyyy = today.getFullYear();
                const mm = String(today.getMonth() + 1).padStart(2, '0');
                const dd = String(today.getDate()).padStart(2, '0');
                manualDateInput.value = `${yyyy}-${mm}-${dd}`;
            });
        });
    });

    /**
     * Fetches work mileage data from the Shuttel portal.
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
                chrome.storage.local.get(['workData'], (result) => {
                    let workData = result.workData || {};
                    Object.assign(workData, shuttelData.chartData);
                    chrome.storage.local.set({ workData: workData }, () => {
                        statusMessage.textContent = 'Work mileage data updated successfully!';
                        setTimeout(() => statusMessage.textContent = '', 3000);
                        updateOverview();
                    });
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
     * Injected function to get data by traversing the Shadow DOM.
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
     * Calculates and updates the overview display for a given year.
     */
    function updateOverview() {
        const selectedYear = parseInt(yearSelector.value);
        if (isNaN(selectedYear)) return;

        chrome.storage.local.get(['mileageHistory', 'workData', 'carChanges'], (result) => {
            const { mileageHistory, workData, carChanges } = result;

            const currentYearData = calculateMileage(mileageHistory, workData, carChanges, selectedYear);
            displayYearData(currentYearData, {
                totalSpan: overviewTotalSpan,
                workSpan: overviewWorkSpan,
                privateSpan: overviewPrivateSpan
            });
        });
    }

    function displayYearData(data, elements) {
        elements.totalSpan.textContent = `${data.totalDriven.toFixed(2)} km`;
        elements.workSpan.textContent = `${data.totalWorkKm.toFixed(2)} km`;
        elements.privateSpan.textContent = `${data.privateKm.toFixed(2)} km`;
    }

    // Initial load
    chrome.storage.local.get(['mileageHistory', 'workData', 'carChanges'], (result) => {
        renderMileageHistory(result.mileageHistory);
        populateYearSelector();

        const today = new Date();
        const yyyy = today.getFullYear();
        const mm = String(today.getMonth() + 1).padStart(2, '0');
        const dd = String(today.getDate()).padStart(2, '0');
        manualDateInput.value = `${yyyy}-${mm}-${dd}`;
    });
});