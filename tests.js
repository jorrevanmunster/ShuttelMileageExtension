function runTests() {
    const testResults = document.getElementById('test-results');
    testResults.innerHTML = '';

    function assert(condition, message) {
        const li = document.createElement('li');
        li.textContent = message;
        if (condition) {
            li.style.color = 'green';
        } else {
            li.style.color = 'red';
        }
        testResults.appendChild(li);
    }

    // --- Test Case 1: Your exact scenario ---
    const history = [
        { timestamp: new Date('2024-07-01').getTime(), totalKm: 35822 },
        { timestamp: new Date('2025-05-06').getTime(), totalKm: 57215.6 },
        { timestamp: new Date('2025-05-07').getTime(), totalKm: 90 },
        { timestamp: new Date('2025-06-30').getTime(), totalKm: 5813 },
        { timestamp: new Date('2025-07-17').getTime(), totalKm: 7726 }
    ];
    const workData = {
        '2024-09': 263.1,
        '2024-12': 207.01,
        '2025-01': 2220.9,
        '2025-02': 1586.19,
        '2025-03': 1534.29,
        '2025-04': 1780.17,
        '2025-05': 1838.51,
        '2025-06': 1556.64,
        '2025-07': 1418.29
    };
    const carChanges = [
        { date: new Date('2025-05-07').getTime(), oldCarFinalKm: 57215.6, newCarStartKm: 90 }
    ];
    const year = 2024;

    const result = calculateMileage(history, workData, carChanges, year);

    assert(Math.abs(result.totalDriven - 27116.6) < 0.01, 'Test 1: Total Driven should be 27116.6');
    assert(Math.abs(result.totalWorkKm - 10986.81) < 0.01, 'Test 1: Work KM should be 10986.81');
    assert(Math.abs(result.privateKm - 16129.79) < 0.01, 'Test 1: Private KM should be 16129.79');
}

runTests();