# Shuttel Mileage Extension

An extension to help track private and work-related mileage for Shuttel users.

## Features

- **Automatic Work Mileage Fetching:** Extracts work-related mileage data directly from the Shuttel portal.
- **Manual Odometer Entry:** Allows for manual entry of odometer readings.
- **Automated Calculations:** Automatically calculates total driven, work, and private kilometers for the current tracking year (July 1st - June 30th).
- **Year-by-Year Tracking:** A dropdown menu allows you to view and manage data for different tracking years.
- **Car Change Logging:** A dedicated feature allows you to log car changes, ensuring accurate calculations across multiple vehicles.
- **Data Persistence:** All data is stored locally in the browser.

## Installation

1.  **Download the Extension:** Clone or download this repository to your local machine.
2.  **Open Chrome Extensions:** Open Google Chrome and navigate to `chrome://extensions`.
3.  **Enable Developer Mode:** In the top right corner, toggle the "Developer mode" switch to on.
4.  **Load the Extension:** Click the "Load unpacked" button and select the `ShuttelMileageExtension` folder.

## Usage

1.  **Navigate to Shuttel:** Go to the `mijn.shuttel.nl` portal and log in.
2.  **Open the Extension:** Click the extension icon in the Chrome toolbar.
3.  **Select Tracking Year:** Use the dropdown menu to select the tracking year you want to view.
4.  **Fetch Work Mileage:** Click the "Fetch Work Mileage from Shuttel" button to automatically get your work-related mileage.
5.  **Enter Odometer Readings:** Manually enter your odometer readings and the corresponding dates.
6.  **Log Car Changes:** If you switch vehicles, use the "Log Car Change" feature to record the final mileage of your old car and the starting mileage of your new one.
7.  **View Overview:** The overview will automatically update with your total driven, work, and private kilometers for the selected year.