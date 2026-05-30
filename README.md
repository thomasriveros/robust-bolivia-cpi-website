# Bolivia Retail CPI Tracker | Inflation Dashboard

A simple, high-contrast, professional data webpage inspired by the aesthetic of **Datawrapper**. This dashboard tracks real-time supermarket retail CPI (Consumer Price Index) estimates across major Bolivian cities (La Paz, Santa Cruz, and Cochabamba) and compares them side-by-side with official Instituto Nacional de Estadística (INE) macroeconomic benchmarks.

👉 **[Live Website Link](https://thomasriveros.github.io/robust-bolivia-cpi-website/)**

---

## 📊 Comparative Framework

The dashboard provides three levels of economic comparisons, each equipped with a **linked dual-graph layout** (showing index levels on top, and inflation rates directly below):

1. **National Trends**: Compares the real-time daily supermarket estimate against the official INE national Core-5 basket (basket equivalent) and the comprehensive national overall CPI.
2. **City-Level Trends**: Compares the local daily supermarket estimate in **La Paz**, **Cochabamba**, and **Santa Cruz** against the corresponding official city Core-5 index and general overall city CPI.
3. **Category breakdowns**: Overlays the daily supermarket category-level index against its official INE counterpart across 5 core retail groups (Alimentos, Bebidas, Bienes diversos, Muebles, and Prendas de vestir).

---

## ⚙️ Key Technical Features

* **Dynamic Rebase Toggle**: Switch instantly between **Index Level (Base = 100 on August 1, 2024)** and **Original Level (Aligned on August 1, 2024)**.
* **Linked Dual-Graph Workspace**: Hovering, zooming, or scrubbing the timeline on the index chart automatically synchronizes the inflation rate chart using Recharts `syncId` parameters.
* **Smart Backwards-Look Tooltips**: Since official data is monthly and supermarket data is daily, the custom tooltip engine dynamically retrieves and displays the latest available monthly official value when hovering over daily points.
* **Academic Methodology Tab**: Provides direct access to download the data collection guide (`Methods.pdf`) and the comprehensive academic research paper (`Real-Time CPI Thomas Riveros.pdf`) written by Thomas Riveros.
* **High Legibility Design**: Features crisp Inter typography, thin borders, horizontal-only grid lines, and tabular monospace digits.

---

## 🚀 Run Locally

### Prerequisites
* **Node.js** (v18 or higher recommended)

### Steps
1. **Clone the repository**:
   ```bash
   git clone https://github.com/thomasriveros/robust-bolivia-cpi-website.git
   cd robust-bolivia-cpi-website
   ```

2. **Install project dependencies**:
   ```bash
   npm install
   ```

3. **Start the local development server**:
   ```bash
   npm run dev
   ```
   Open **[http://localhost:3000](http://localhost:3000)** in your web browser.

---

## 📝 License & Contact

© 2026 Thomas Riveros. All rights reserved.

For questions, econometric inquiries, or feedback regarding the tracking methodology, feel free to reach out:
* **Email**: [tmr94@cornell.edu](mailto:tmr94@cornell.edu)
* **Scraper Repository**: [github.com/thomasriveros/robust-cpi-bolivia](https://github.com/thomasriveros/robust-cpi-bolivia)