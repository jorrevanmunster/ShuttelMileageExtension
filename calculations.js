function calculateMileage(history, workData, carChanges, year) {
    history.sort((a, b) => a.timestamp - b.timestamp);
    carChanges.sort((a, b) => a.date - b.date);

    const startOfTrackingYear = new Date(year, 6, 1); // July is month 6
    startOfTrackingYear.setHours(0, 0, 0, 0);
    const endOfTrackingYear = new Date(year + 1, 6, 1);
    endOfTrackingYear.setHours(0, 0, 0, 0);

    // --- 1. Calculate Work KM for the selected year ---
    let totalWorkKm = 0;
    for (const key in workData) {
        const [workYear, month] = key.split('-');
        const workDate = new Date(parseInt(workYear), parseInt(month) - 1, 1);
        if (workDate.getTime() >= startOfTrackingYear.getTime() && workDate.getTime() < endOfTrackingYear.getTime()) {
            totalWorkKm += workData[key];
        }
    }

    // --- 2. Build a unified timeline of ALL events ---
    let timeline = [];
    history.forEach(r => timeline.push({ timestamp: r.timestamp, km: r.totalKm, type: 'reading' }));
    carChanges.forEach(c => {
        timeline.push({ timestamp: c.date - 1, km: c.oldCarFinalKm, type: 'end_car' });
        timeline.push({ timestamp: c.date, km: c.newCarStartKm, type: 'start_car' });
    });
    timeline.sort((a, b) => a.timestamp - b.timestamp);

    // --- 3. Filter timeline for the relevant period ---
    const readingsBefore = timeline.filter(e => e.timestamp < startOfTrackingYear.getTime());
    const readingsInPeriod = timeline.filter(e => e.timestamp >= startOfTrackingYear.getTime() && e.timestamp < endOfTrackingYear.getTime());

    if (readingsInPeriod.length === 0) {
        return { totalDriven: 0, totalWorkKm, privateKm: -totalWorkKm };
    }

    // --- 4. Determine the starting KM --- 
    let startKm = 0;
    if (readingsBefore.length > 0) {
        startKm = readingsBefore[readingsBefore.length - 1].km;
    } else {
        // If no readings before, the first reading of the period is the true start.
        // The loop will start from this baseline.
        startKm = readingsInPeriod[0].km;
    }

    // --- 5. Calculate total driven distance by iterating through the year's events ---
    let totalDriven = 0;
    let lastKm = startKm;

    // We iterate through the events of the period to sum up the distances.
    for (const event of readingsInPeriod) {
        if (event.type === 'start_car') {
            // Odometer resets to the new car's start. No distance is added for this event.
            lastKm = event.km;
            continue;
        }

        const distance = event.km - lastKm;
        if (distance > 0) {
            totalDriven += distance;
        }
        
        // Update the baseline for the next calculation.
        lastKm = event.km;
    }

    const privateKm = totalDriven - totalWorkKm;

    return { totalDriven, totalWorkKm, privateKm };
}
