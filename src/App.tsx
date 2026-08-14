import { T, Lang } from './translations';
import React, { useState, useEffect, useMemo, Fragment } from 'react';
import Papa from 'papaparse';
import {
  ComposedChart, Bar, LineChart, Line, XAxis, YAxis, CartesianGrid, Tooltip, Legend, ResponsiveContainer, AreaChart, Area, Brush
} from 'recharts';
import { Download, Info, Loader2, Github, Camera, Check } from 'lucide-react';
import { toPng } from 'html-to-image';

const DATA_URLS = {
  // Synthetic datasets
  nationalSynthetic: 'https://raw.githubusercontent.com/thomasriveros/robust-cpi-bolivia/refs/heads/main/results/supermarket_1/national/supermarket_1_tracker_results.csv',
  laPazSynthetic: 'https://raw.githubusercontent.com/thomasriveros/robust-cpi-bolivia/refs/heads/main/results/supermarket_1/la_paz/supermarket_1_tracker_results.csv',
  santaCruzSynthetic: 'https://raw.githubusercontent.com/thomasriveros/robust-cpi-bolivia/refs/heads/main/results/supermarket_1/santa_cruz/supermarket_1_tracker_results.csv',
  cochabambaSynthetic: 'https://raw.githubusercontent.com/thomasriveros/robust-cpi-bolivia/refs/heads/main/results/supermarket_1/cochabamba/supermarket_1_tracker_results.csv',
  productCounts: 'https://raw.githubusercontent.com/thomasriveros/robust-cpi-bolivia/refs/heads/main/results/supermarket_1/supermarket_1_daily_n_counts.csv',
  
  // Official Comparative datasets
  officialNationalCPI: 'https://raw.githubusercontent.com/thomasriveros/live-ine-inflation-update/refs/heads/main/data/national_CPI.csv',
  officialNationalCore5: 'https://raw.githubusercontent.com/thomasriveros/live-ine-inflation-update/refs/heads/main/data/national_core_5_CPI.csv',
  officialCityCore5: 'https://raw.githubusercontent.com/thomasriveros/live-ine-inflation-update/refs/heads/main/data/city_level_core_5_CPI.csv',
  officialCityCategory: 'https://raw.githubusercontent.com/thomasriveros/live-ine-inflation-update/refs/heads/main/data/city_level_CPI_by_category.csv'
};

// Datawrapper Style Colors
const COLORS = {
  synthetic: '#1f77b4', // Slate/Royal Blue
  officialCore: '#0f8c79', // Teal
  officialOverall: '#d62728', // Coral/Crimson
  forwardFill: '#fb923c', // Amber
  brush: '#cbd5e1',
  grid: '#e6ebf0'
};

// Category Colors for City View
const CAT_COLORS = [
  '#4f46e5', // Indigo
  '#ea580c', // Orange
  '#16a34a', // Green
  '#db2777', // Pink
  '#8b5cf6'  // Purple
];

type DataStore = {
  nationalSynthetic: any[];
  laPazSynthetic: any[];
  cochabambaSynthetic: any[];
  santaCruzSynthetic: any[];
  productCounts: any[];
  officialNationalCPI: any[];
  officialNationalCore5: any[];
  officialCityCore5: any[];
  officialCityCategory: any[];
};

export type AlignmentMode = 'rebased' | 'original';
export type InflationMode = 'DOD' | 'MOM' | 'YOY';

// --- UTILS ---

// Bulletproof date parser supporting UTC to prevent local timezone shifts
function parseDateSafe(dateStr: string): { displayDate: string; time: number } {
  if (!dateStr) return { displayDate: '', time: 0 };
  
  const str = String(dateStr).trim();
  
  // Case 1: Slash format (MM/DD/YY or MM/DD/YYYY)
  if (str.includes('/')) {
    const parts = str.split('/');
    if (parts.length === 3) {
      const m = parseInt(parts[0], 10) - 1;
      const d = parseInt(parts[1], 10);
      let y = parseInt(parts[2], 10);
      if (parts[2].length === 2) {
        y += 2000; // 24 -> 2024
      }
      const dateObj = new Date(Date.UTC(y, m, d));
      return {
        displayDate: dateObj.toISOString().split('T')[0],
        time: dateObj.getTime()
      };
    }
  }
  
  // Case 2: Dash format (YYYY-MM-DD)
  if (str.includes('-')) {
    const parts = str.split('-');
    if (parts.length === 3) {
      if (parts[0].length === 4) {
        const y = parseInt(parts[0], 10);
        const m = parseInt(parts[1], 10) - 1;
        const d = parseInt(parts[2], 10);
        const dateObj = new Date(Date.UTC(y, m, d));
        return {
          displayDate: dateObj.toISOString().split('T')[0],
          time: dateObj.getTime()
        };
      }
      const d = parseInt(parts[0], 10);
      const m = parseInt(parts[1], 10) - 1;
      const y = parseInt(parts[2], 10);
      const dateObj = new Date(Date.UTC(y, m, d));
      return {
        displayDate: dateObj.toISOString().split('T')[0],
        time: dateObj.getTime()
      };
    }
  }

  const parsed = new Date(str);
  return {
    displayDate: parsed.toISOString().split('T')[0],
    time: parsed.getTime()
  };
}

// Locate closest value in time
function getValueOnDate(rows: any[], targetDateStr: string, dateField: string, valField: string): number | null {
  if (!rows || rows.length === 0) return null;
  const targetMs = new Date(targetDateStr).getTime();
  let closestRow = null;
  let closestDist = Infinity;
  
  for (const r of rows) {
    if (r[dateField] == null || r[valField] == null) continue;
    const dInfo = parseDateSafe(String(r[dateField]));
    const dist = Math.abs(dInfo.time - targetMs);
    if (dist < closestDist) {
      closestDist = dist;
      closestRow = r;
    }
  }
  
  // Return value if within 10 days of base month (for monthly matching)
  if (closestRow && closestDist <= 10 * 24 * 60 * 60 * 1000) {
    const val = closestRow[valField];
    return val !== null && !isNaN(Number(val)) ? Number(val) : null;
  }
  return null;
}

// Lookback to find latest available index for custom hover tooltips
function getClosestValue(data: any[], currentIndex: number, key: string): { value: number | null; displayDate: string | null } {
  if (currentIndex < 0 || currentIndex >= data.length) return { value: null, displayDate: null };
  if (data[currentIndex][key] != null) return { value: data[currentIndex][key], displayDate: data[currentIndex].displayDate };
  
  // Search backward for latest populated monthly value
  for (let i = currentIndex - 1; i >= 0; i--) {
    if (data[i][key] != null) {
      return { value: data[i][key], displayDate: data[i].displayDate };
    }
  }
  return { value: null, displayDate: null };
}

// General inflation engine
export function calculateInflationData(data: any[], keys: string[], mode: InflationMode) {
  const msOffset = (mode === 'DOD' ? 1 : mode === 'MOM' ? 30.4375 : 365.25) * 24 * 60 * 60 * 1000;
  const toleranceMs = (mode === 'DOD' ? 1.5 : mode === 'MOM' ? 7 : 20) * 24 * 60 * 60 * 1000;
  
  return data.map((row, idx) => {
    const newRow = { ...row };
    const targetTime = row.dateNum - msOffset;
    
    for (const key of keys) {
      if (row[key] == null) {
        newRow[`${key}_Inflation`] = null;
        continue;
      }
      
      let pastVal = null;
      let closestDist = Infinity;
      
      // Find closest historical value matching the timeframe lookback
      for (let j = idx - 1; j >= 0; j--) {
        if (data[j][key] == null) continue;
        const dist = Math.abs(data[j].dateNum - targetTime);
        if (dist <= toleranceMs && dist < closestDist) {
          closestDist = dist;
          pastVal = data[j][key];
        }
        if (data[j].dateNum < targetTime - toleranceMs) break; 
      }
      
      if (pastVal != null && pastVal !== 0) {
        newRow[`${key}_Inflation`] = ((row[key] / pastVal) - 1) * 100;
      } else {
        newRow[`${key}_Inflation`] = null;
      }
    }
    return newRow;
  });
}

function exportCSV(csvContent: string, filename: string) {
  const blob = new Blob([csvContent], { type: 'text/csv;charset=utf-8;' });
  const link = document.createElement('a');
  if (link.download !== undefined) {
    const url = URL.createObjectURL(blob);
    link.setAttribute('href', url);
    link.setAttribute('download', filename);
    link.style.visibility = 'hidden';
    document.body.appendChild(link);
    link.click();
    document.body.removeChild(link);
  }
}

async function exportImage(element: HTMLElement | null, filename: string) {
  if (!element) return;
  try {
    const dataUrl = await toPng(element, { 
      backgroundColor: '#ffffff',
      pixelRatio: 2,
      style: {
        padding: '20px',
        margin: '0',
      }
    });
    const link = document.createElement('a');
    link.download = filename;
    link.href = dataUrl;
    link.click();
  } catch (err) {
    console.error('Failed to export image', err);
  }
}

// Helper to normalize strings (remove accents, to lower)
const norm = (s: string) => s ? s.normalize('NFD').replace(/[\u0300-\u036f]/g, '').toLowerCase().trim() : '';

// --- MAIN APP ---

export default function App() {
  const [lang, setLang] = useState<Lang>('en');
  const t = T[lang];
  const [data, setData] = useState<DataStore | null>(null);
  const [loading, setLoading] = useState(true);
  const [activeTab, setActiveTab] = useState('national');
  const [alignmentMode, setAlignmentMode] = useState<AlignmentMode>('rebased');

  // Load all 9 CSV datasets concurrently
  useEffect(() => {
    const fetchAll = async () => {
      setLoading(true);
      const results: Partial<DataStore> = {};
      
      const promises = Object.entries(DATA_URLS).map(([key, url]) => {
        return new Promise<void>((resolve) => {
          Papa.parse(`${url}?t=${Date.now()}`, {
            download: true,
            header: true,
            dynamicTyping: true,
            skipEmptyLines: true,
            complete: (res) => {
              results[key as keyof DataStore] = res.data;
              resolve();
            },
            error: () => {
              results[key as keyof DataStore] = []; // fallback
              resolve();
            }
          });
        });
      });

      await Promise.all(promises);
      setData(results as DataStore);
      setLoading(false);
    };

    fetchAll();
  }, []);

  return (
    <div className="min-h-screen bg-[#f7f9fa] text-[#2c3e50] font-sans antialiased">
      {/* Header Container */}
      <header className="bg-white border-b border-[#e1e6eb] px-6 py-4">
        <div className="max-w-[1200px] mx-auto flex flex-col sm:flex-row sm:items-center justify-between gap-4">
          <div>
            <div className="flex items-center gap-2">
              <h1 className="text-xl sm:text-2xl font-extrabold tracking-tight text-[#1a252f] uppercase">
                {t.title}
              </h1>
              <div className="group relative">
                <Info className="w-4 h-4 text-neutral-400 cursor-help hover:text-neutral-600 transition-colors" />
                <div className="absolute left-1/2 -translate-x-1/2 top-full mt-2 w-80 p-4 bg-[#1a252f] text-white text-xs rounded shadow-lg opacity-0 invisible group-hover:opacity-100 group-hover:visible transition-all z-50 leading-relaxed font-normal normal-case">
                  {t.infoTooltip}
                </div>
              </div>
            </div>
            <p className="text-xs sm:text-sm text-neutral-500 mt-1">
              {t.headerDesc}
            </p>
          </div>

          <div className="flex items-center gap-4 sm:self-end">
            <a 
              href="https://github.com/thomasriveros/robust-cpi-bolivia/tree/main" 
              target="_blank" 
              rel="noopener noreferrer"
              className="flex items-center gap-1.5 text-xs font-semibold text-[#1f77b4] hover:text-[#175d8c] transition-colors border-r border-neutral-200 pr-4"
            >
              <Github className="w-3.5 h-3.5" />
              {t.viewRepo}
            </a>
            <div className="flex bg-[#f1f3f5] p-0.5 rounded border border-neutral-200">
              <button 
                onClick={() => setLang('en')} 
                className={`text-[10px] font-bold px-2 py-1 rounded-sm ${lang === 'en' ? 'bg-white shadow-sm text-black border border-neutral-200' : 'text-neutral-500 hover:text-black'}`}
              >
                EN
              </button>
              <button 
                onClick={() => setLang('es')} 
                className={`text-[10px] font-bold px-2 py-1 rounded-sm ${lang === 'es' ? 'bg-white shadow-sm text-black border border-neutral-200' : 'text-neutral-500 hover:text-black'}`}
              >
                ES
              </button>
            </div>
          </div>
        </div>
      </header>

      {/* Main Grid Layout */}
      <main className="max-w-[1200px] mx-auto px-4 py-6">
        {/* Alignment Controller & Tab Header bar */}
        <div className="flex flex-col md:flex-row items-stretch md:items-center justify-between border-b border-[#e1e6eb] mb-6 gap-4 bg-white p-3 border rounded shadow-sm">
          {/* Navigation Tabs */}
          <div className="flex flex-wrap gap-1">
            {[
              { id: 'national', label: t.tabs.national },
              { id: 'laPaz', label: t.tabs.laPaz },
              { id: 'cochabamba', label: t.tabs.cochabamba },
              { id: 'santaCruz', label: t.tabs.santaCruz },
              { id: 'productCounts', label: t.tabs.productCounts },
              { id: 'methodology', label: t.tabs.methodology },
            ].map(tab => (
              <button
                key={tab.id}
                onClick={() => setActiveTab(tab.id)}
                className={`px-3 py-2 text-xs font-bold transition-all uppercase rounded-sm border ${
                  activeTab === tab.id 
                    ? 'bg-[#2c3e50] text-white border-[#2c3e50]'
                    : 'bg-white text-neutral-600 border-neutral-200 hover:bg-neutral-50 hover:text-neutral-900'
                }`}
              >
                {tab.label}
              </button>
            ))}
          </div>

          {/* Alignment controls (Rebase vs level) */}
          {activeTab !== 'productCounts' && activeTab !== 'methodology' && (
            <div className="flex items-center gap-2">
              <span className="text-xs font-bold text-neutral-500 uppercase">{t.alignment.label}</span>
              <div className="flex bg-[#f1f3f5] p-0.5 rounded border border-neutral-200">
                <button
                  onClick={() => setAlignmentMode('rebased')}
                  className={`text-[10px] font-bold px-2 py-1.5 rounded-sm uppercase ${alignmentMode === 'rebased' ? 'bg-white text-black shadow-sm border border-neutral-200' : 'text-neutral-500 hover:text-black'}`}
                >
                  {t.alignment.rebased}
                </button>
                <button
                  onClick={() => setAlignmentMode('original')}
                  className={`text-[10px] font-bold px-2 py-1.5 rounded-sm uppercase ${alignmentMode === 'original' ? 'bg-white text-black shadow-sm border border-neutral-200' : 'text-neutral-500 hover:text-black'}`}
                >
                  {t.alignment.original}
                </button>
              </div>
            </div>
          )}
        </div>

        {/* Dashboard Dashboard Rendering */}
        {loading ? (
          <div className="bg-white border border-[#e1e6eb] rounded p-12 flex flex-col items-center justify-center min-h-[400px]">
            <Loader2 className="w-8 h-8 animate-spin mb-4 text-[#1f77b4]" />
            <p className="text-sm font-semibold tracking-wide text-neutral-500">{t.loading}</p>
          </div>
        ) : data ? (
          <div className="space-y-6">
            {activeTab === 'national' && <NationalView data={data} alignmentMode={alignmentMode} lang={lang} t={t} />}
            {activeTab === 'laPaz' && <CityView name="La Paz" data={data} alignmentMode={alignmentMode} lang={lang} t={t} />}
            {activeTab === 'cochabamba' && <CityView name="Cochabamba" data={data} alignmentMode={alignmentMode} lang={lang} t={t} />}
            {activeTab === 'santaCruz' && <CityView name="Santa Cruz" data={data} alignmentMode={alignmentMode} lang={lang} t={t} />}
            {activeTab === 'productCounts' && <ProductCountView data={data.productCounts} lang={lang} t={t} />}
            {activeTab === 'methodology' && <MethodologyView lang={lang} t={t} />}
          </div>
        ) : null}
      </main>
      
      {/* Flat Datawrapper Style Footer / Contact box */}
      <footer className="bg-white border-t border-[#e1e6eb] py-8 px-6 mt-12 text-center text-xs text-neutral-500">
        <div className="max-w-[1200px] mx-auto flex flex-col sm:flex-row items-center justify-between gap-4">
          <div className="flex flex-col items-center sm:items-start gap-1">
            <p className="font-medium text-neutral-400">© {new Date().getFullYear()} Thomas Riveros.</p>
            <a
              href="https://www.datawrapper.de/"
              target="_blank"
              rel="noopener noreferrer"
              className="text-neutral-400 hover:text-[#1f77b4] underline underline-offset-2 transition-colors"
            >
              {t.designCredit}
            </a>
          </div>
          <div className="flex items-center gap-1.5 bg-[#f8f9fa] border border-[#e1e6eb] px-3.5 py-2 rounded-sm text-neutral-600">
            <span className="font-medium">{t.footerContact}</span>
            <a 
              href="mailto:tmr94@cornell.edu" 
              className="text-[#1f77b4] hover:text-[#175d8c] font-bold underline transition-colors"
            >
              tmr94@cornell.edu
            </a>
          </div>
        </div>
      </footer>
    </div>
  );
}

// --- NATIONAL VIEW ---

function NationalView({ data, alignmentMode, lang, t }: { data: DataStore; alignmentMode: AlignmentMode; lang: Lang; t: typeof T['en'] }) {
  const [showCore, setShowCore] = useState(true);
  const [showOverall, setShowOverall] = useState(true);
  const [inflationMode, setInflationMode] = useState<InflationMode>('MOM');

  const chartData = useMemo(() => {
    // 1. Get base values on Aug 1, 2024
    const baseSynth = getValueOnDate(data.nationalSynthetic, '2024-08-01', 'date', 'cpi') || 100.417;
    const baseOffCore = getValueOnDate(data.officialNationalCore5, '2024-08-01', 'date', 'Core-5 CPI') || 100.455;
    const baseOffOverall = getValueOnDate(data.officialNationalCPI, '2024-08-01', 'date', 'CPI level') || 101.167;

    const synthRows = data.nationalSynthetic || [];
    
    const offCoreMap = new Map<string, number>();
    (data.officialNationalCore5 || []).forEach(r => {
      if (r.date && r['Core-5 CPI'] != null) {
        const dInfo = parseDateSafe(String(r.date));
        offCoreMap.set(dInfo.displayDate, Number(r['Core-5 CPI']));
      }
    });

    const offOverallMap = new Map<string, number>();
    (data.officialNationalCPI || []).forEach(r => {
      if (r.date && r['CPI level'] != null) {
        const dInfo = parseDateSafe(String(r.date));
        offOverallMap.set(dInfo.displayDate, Number(r['CPI level']));
      }
    });

    return synthRows
      .filter(row => {
        if (!row.date) return false;
        const dInfo = parseDateSafe(String(row.date));
        return dInfo.time >= new Date('2024-07-29').getTime();
      })
      .map(row => {
        const dInfo = parseDateSafe(String(row.date));
        const rawSynth = Number(row.cpi);
        const rawOffCore = offCoreMap.get(dInfo.displayDate) ?? null;
        const rawOffOverall = offOverallMap.get(dInfo.displayDate) ?? null;

        let synthVal = rawSynth;
        let offCoreVal = null;
        let offOverallVal = null;

        if (alignmentMode === 'rebased') {
          synthVal = (rawSynth / baseSynth) * 100;
          if (rawOffCore !== null) offCoreVal = (rawOffCore / baseOffCore) * 100;
          if (rawOffOverall !== null) offOverallVal = (rawOffOverall / baseOffOverall) * 100;
        } else {
          synthVal = rawSynth;
          if (rawOffCore !== null) offCoreVal = (rawOffCore / baseOffCore) * baseSynth;
          if (rawOffOverall !== null) offOverallVal = (rawOffOverall / baseOffOverall) * baseSynth;
        }

        return {
          dateNum: dInfo.time,
          displayDate: dInfo.displayDate,
          data_source: row.data_source,
          forwardFillMarker: row.data_source === 'Forward Fill' ? 3 : 0,
          
          Synthetic_National: synthVal,
          Official_Core5: offCoreVal,
          Official_Overall: offOverallVal
        };
      })
      .sort((a, b) => a.dateNum - b.dateNum);
  }, [data, alignmentMode]);

  // Keys used for inflation matching
  const activeKeys = useMemo(() => {
    const keys = ['Synthetic_National'];
    if (showCore) keys.push('Official_Core5');
    if (showOverall) keys.push('Official_Overall');
    return keys;
  }, [showCore, showOverall]);

  const inflationData = useMemo(() => {
    return calculateInflationData(chartData, activeKeys, inflationMode);
  }, [chartData, activeKeys, inflationMode]);

  // Key metrics calculations for Datawrapper stats card
  const stats = useMemo(() => {
    if (chartData.length === 0) return null;
    const latestRow = chartData[chartData.length - 1];
    
    // Find latest official figures
    let latestCore = null;
    let latestOverall = null;
    for (let i = chartData.length - 1; i >= 0; i--) {
      if (latestCore === null && chartData[i].Official_Core5 !== null) latestCore = chartData[i].Official_Core5;
      if (latestOverall === null && chartData[i].Official_Overall !== null) latestOverall = chartData[i].Official_Overall;
    }

    // MoM change logic (based on closest MoM row values)
    const infD = calculateInflationData(chartData, ['Synthetic_National', 'Official_Core5', 'Official_Overall'], 'MOM');
    const latestInfRow = infD[infD.length - 1];
    
    let latestCoreMom = null;
    let latestOverallMom = null;
    for (let i = infD.length - 1; i >= 0; i--) {
      if (latestCoreMom === null && infD[i].Official_Core5_Inflation !== null) latestCoreMom = infD[i].Official_Core5_Inflation;
      if (latestOverallMom === null && infD[i].Official_Overall_Inflation !== null) latestOverallMom = infD[i].Official_Overall_Inflation;
    }

    return {
      synthVal: latestRow.Synthetic_National,
      synthMom: latestInfRow.Synthetic_National_Inflation,
      
      coreVal: latestCore,
      coreMom: latestCoreMom,
      
      overallVal: latestOverall,
      overallMom: latestOverallMom
    };
  }, [chartData]);

  const cpiGraphRef = React.useRef<HTMLDivElement>(null);
  const downloadCSVData = () => {
    const allKeys = ['Synthetic_National', 'Official_Core5', 'Official_Overall'];
    const fullInflation = calculateInflationData(chartData, allKeys, inflationMode);
    const exportRows = fullInflation.map(r => ({
      Date: r.displayDate,
      DataSource: r.data_source,
      Synthetic_CPI: r.Synthetic_National != null ? r.Synthetic_National.toFixed(4) : null,
      Synthetic_Inflation: r.Synthetic_National_Inflation != null ? r.Synthetic_National_Inflation.toFixed(4) : null,
      Official_Core5_CPI: r.Official_Core5 != null ? r.Official_Core5.toFixed(4) : null,
      Official_Core5_Inflation: r.Official_Core5_Inflation != null ? r.Official_Core5_Inflation.toFixed(4) : null,
      Official_Overall_CPI: r.Official_Overall != null ? r.Official_Overall.toFixed(4) : null,
      Official_Overall_Inflation: r.Official_Overall_Inflation != null ? r.Official_Overall_Inflation.toFixed(4) : null,
    }));
    const csv = Papa.unparse(exportRows);
    exportCSV(csv, 'bolivia_national_cpi_comparison.csv');
  };

  return (
    <div className="space-y-6">
      {/* Description header */}
      <div className="dw-card">
        <h2 className="text-lg font-bold text-[#1a252f] uppercase">{t.national.title}</h2>
        <p className="text-sm text-neutral-500 mt-1 leading-relaxed max-w-[850px]">{t.national.desc}</p>
        
        {/* Toggle checkboxes */}
        <div className="flex flex-wrap gap-4 mt-4 pt-4 border-t border-neutral-100">
          <label className="flex items-center gap-2 cursor-pointer text-xs font-semibold uppercase text-neutral-700">
            <span className="w-3.5 h-3.5 rounded-sm border border-[#1f77b4] flex items-center justify-center bg-[#1f77b4] text-white">
              <Check className="w-2.5 h-2.5" />
            </span>
            {t.national.legendSynthetic}
          </label>
          
          <label className="flex items-center gap-2 cursor-pointer text-xs font-semibold uppercase text-neutral-700">
            <input 
              type="checkbox" 
              checked={showCore} 
              onChange={e => setShowCore(e.target.checked)}
              className="rounded border-neutral-300 text-[#0f8c79] focus:ring-[#0f8c79] w-3.5 h-3.5 cursor-pointer"
            />
            {t.national.legendOfficialCore}
          </label>

          <label className="flex items-center gap-2 cursor-pointer text-xs font-semibold uppercase text-neutral-700">
            <input 
              type="checkbox" 
              checked={showOverall} 
              onChange={e => setShowOverall(e.target.checked)}
              className="rounded border-neutral-300 text-[#d62728] focus:ring-[#d62728] w-3.5 h-3.5 cursor-pointer"
            />
            {t.national.legendOfficialOverall}
          </label>
        </div>
      </div>

      {/* Stats Cards grid (Datawrapper style flat columns) */}
      {stats && (
        <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
          <div className="bg-white border border-[#e1e6eb] rounded-sm p-4">
            <div className="text-[10px] font-bold text-[#1f77b4] uppercase tracking-wider">{t.national.legendSynthetic}</div>
            <div className="text-2xl font-extrabold text-neutral-900 mt-1 font-mono">
              {stats.synthVal ? stats.synthVal.toFixed(2) : '--'}
            </div>
            <div className="text-xs text-neutral-500 mt-1 flex gap-2">
              <span>{t.national.cardMom}: <strong className="text-neutral-800 font-mono">{stats.synthMom ? (stats.synthMom > 0 ? '+' : '') + stats.synthMom.toFixed(2) + '%' : '--'}</strong></span>
            </div>
          </div>
          
          <div className={`bg-white border border-[#e1e6eb] rounded-sm p-4 ${!showCore ? 'opacity-40' : ''}`}>
            <div className="text-[10px] font-bold text-[#0f8c79] uppercase tracking-wider">{t.national.legendOfficialCore}</div>
            <div className="text-2xl font-extrabold text-neutral-900 mt-1 font-mono">
              {stats.coreVal ? stats.coreVal.toFixed(2) : '--'}
            </div>
            <div className="text-xs text-neutral-500 mt-1 flex gap-2">
              <span>{t.national.cardMom}: <strong className="text-neutral-800 font-mono">{stats.coreMom ? (stats.coreMom > 0 ? '+' : '') + stats.coreMom.toFixed(2) + '%' : '--'}</strong></span>
            </div>
          </div>

          <div className={`bg-white border border-[#e1e6eb] rounded-sm p-4 ${!showOverall ? 'opacity-40' : ''}`}>
            <div className="text-[10px] font-bold text-[#d62728] uppercase tracking-wider">{t.national.legendOfficialOverall}</div>
            <div className="text-2xl font-extrabold text-neutral-900 mt-1 font-mono">
              {stats.overallVal ? stats.overallVal.toFixed(2) : '--'}
            </div>
            <div className="text-xs text-neutral-500 mt-1 flex gap-2">
              <span>{t.national.cardMom}: <strong className="text-neutral-800 font-mono">{stats.overallMom ? (stats.overallMom > 0 ? '+' : '') + stats.overallMom.toFixed(2) + '%' : '--'}</strong></span>
            </div>
          </div>
        </div>
      )}

      {/* Linked Dual Graph Workspace */}
      <div className="dw-card" ref={cpiGraphRef}>
        {/* GRAPH 1 (TOP) - CPI Level */}
        <div className="h-[340px] w-full min-w-0 border-b border-neutral-100 pb-6 mb-6">
          <div className="flex items-center justify-between mb-4">
            <div>
              <h3 className="text-xs font-bold text-[#1a252f] uppercase tracking-wider">{t.graphs.cpiIndexTitle}</h3>
              <p className="text-[11px] text-neutral-400 mt-0.5">{t.graphs.cpiIndexDesc}</p>
            </div>
            <div className="flex gap-2">
              <button 
                onClick={() => exportImage(cpiGraphRef.current, 'bolivia_national_cpi_index.png')} 
                className="flex items-center gap-1 text-[10px] font-bold uppercase px-2 py-1 border border-neutral-200 hover:bg-neutral-50 rounded bg-white text-neutral-700 shadow-sm"
              >
                <Camera className="w-3 h-3" />
                {t.graphs.exportGraph}
              </button>
            </div>
          </div>

          <ResponsiveContainer width="100%" height="100%">
            <LineChart syncId="nationalSync" data={chartData} margin={{ top: 10, right: 10, left: 0, bottom: 0 }}>
              <CartesianGrid strokeDasharray="0" vertical={false} stroke={COLORS.grid} />
              <XAxis 
                dataKey="displayDate" 
                tick={{fontSize: 10, fill: '#737373', fontFamily: 'var(--font-mono)'}} 
                tickMargin={6} 
                minTickGap={40} 
                stroke="#d1d5db"
              />
              <YAxis 
                domain={['auto', 'auto']} 
                tick={{fontSize: 10, fill: '#737373', fontFamily: 'var(--font-mono)'}} 
                tickFormatter={(val) => val.toFixed(1)} 
                tickMargin={6}
                stroke="#d1d5db"
              />
              <Tooltip content={<CustomTooltip chartData={chartData} t={t} />} />
              
              <Line 
                type="monotone" 
                dot={false} 
                dataKey="Synthetic_National" 
                name={t.national.legendSynthetic} 
                stroke={COLORS.synthetic} 
                strokeWidth={2.5} 
                isAnimationActive={false} 
              />
              
              {showCore && (
                <Line 
                  type="linear" 
                  connectNulls={true} 
                  dataKey="Official_Core5" 
                  name={t.national.legendOfficialCore} 
                  stroke={COLORS.officialCore} 
                  strokeDasharray="5 5" 
                  strokeWidth={2} 
                  dot={{ r: 3, stroke: COLORS.officialCore, fill: '#ffffff', strokeWidth: 2 }} 
                  isAnimationActive={false} 
                />
              )}
              
              {showOverall && (
                <Line 
                  type="linear" 
                  connectNulls={true} 
                  dataKey="Official_Overall" 
                  name={t.national.legendOfficialOverall} 
                  stroke={COLORS.officialOverall} 
                  strokeDasharray="3 3" 
                  strokeWidth={2} 
                  dot={{ r: 3, stroke: COLORS.officialOverall, fill: '#ffffff', strokeWidth: 2 }} 
                  isAnimationActive={false} 
                />
              )}
            </LineChart>
          </ResponsiveContainer>
        </div>

        {/* GRAPH 2 (BOTTOM) - Inflation rate */}
        <div className="h-[340px] w-full min-w-0">
          <div className="flex flex-col sm:flex-row sm:items-center justify-between mb-4 gap-2">
            <div>
              <h3 className="text-xs font-bold text-[#1a252f] uppercase tracking-wider">{t.graphs.inflationTitle}</h3>
              <p className="text-[11px] text-neutral-400 mt-0.5">{t.graphs.inflationDesc}</p>
            </div>
            
            {/* Period switcher */}
            <div className="flex bg-[#f1f3f5] p-0.5 rounded border border-neutral-200 self-start">
              {(['DOD', 'MOM', 'YOY'] as const).map(mode => (
                <button
                  key={mode}
                  onClick={() => setInflationMode(mode)}
                  className={`text-[9px] font-bold px-2 py-1 rounded-sm uppercase ${inflationMode === mode ? 'bg-white text-black shadow-sm border border-neutral-200' : 'text-neutral-500 hover:text-black'}`}
                >
                  {mode === 'DOD' ? t.period.dod : mode === 'MOM' ? t.period.mom : t.period.yoy}
                </button>
              ))}
            </div>
          </div>

          <ResponsiveContainer width="100%" height="100%">
            <LineChart syncId="nationalSync" data={inflationData} margin={{ top: 10, right: 10, left: 0, bottom: 0 }}>
              <CartesianGrid strokeDasharray="0" vertical={false} stroke={COLORS.grid} />
              <XAxis 
                dataKey="displayDate" 
                tick={{fontSize: 10, fill: '#737373', fontFamily: 'var(--font-mono)'}} 
                tickMargin={6} 
                minTickGap={40} 
                stroke="#d1d5db"
              />
              <YAxis 
                tick={{fontSize: 10, fill: '#737373', fontFamily: 'var(--font-mono)'}} 
                tickMargin={6} 
                tickFormatter={(val) => val.toFixed(1) + '%'} 
                stroke="#d1d5db"
              />
              <Tooltip content={<CustomTooltip isPercent chartData={inflationData} t={t} />} />
              
              <Line 
                type="monotone" 
                dot={false} 
                dataKey="Synthetic_National_Inflation" 
                name={t.national.legendSynthetic} 
                stroke={COLORS.synthetic} 
                strokeWidth={2.5} 
                isAnimationActive={false} 
              />
              
              {showCore && (
                <Line 
                  type="linear" 
                  connectNulls={true} 
                  dataKey="Official_Core5_Inflation" 
                  name={t.national.legendOfficialCore} 
                  stroke={COLORS.officialCore} 
                  strokeDasharray="5 5" 
                  strokeWidth={2} 
                  dot={{ r: 3, stroke: COLORS.officialCore, fill: '#ffffff', strokeWidth: 2 }} 
                  isAnimationActive={false} 
                />
              )}
              
              {showOverall && (
                <Line 
                  type="linear" 
                  connectNulls={true} 
                  dataKey="Official_Overall_Inflation" 
                  name={t.national.legendOfficialOverall} 
                  stroke={COLORS.officialOverall} 
                  strokeDasharray="3 3" 
                  strokeWidth={2} 
                  dot={{ r: 3, stroke: COLORS.officialOverall, fill: '#ffffff', strokeWidth: 2 }} 
                  isAnimationActive={false} 
                />
              )}
              
              <Brush dataKey="displayDate" height={24} stroke={COLORS.brush} tick={{fontSize: 9, fill: '#737373'}} />
            </LineChart>
          </ResponsiveContainer>
        </div>

        {/* CSV export helper */}
        <div className="mt-8 pt-4 border-t border-neutral-100 flex justify-end">
          <button 
            onClick={downloadCSVData} 
            className="flex items-center gap-1.5 px-3 py-2 border border-neutral-200 hover:bg-neutral-50 rounded bg-white text-xs font-bold uppercase text-[#2c3e50] shadow-sm"
          >
            <Download className="w-3.5 h-3.5" />
            {t.graphs.exportCSV}
          </button>
        </div>
      </div>

      {/* Methodology Callout Panel */}
      <div className="bg-neutral-50 border-l-4 border-[#2c3e50] p-4 text-xs text-neutral-600 leading-relaxed rounded-r shadow-sm">
        <p className="font-bold text-[#2c3e50] uppercase mb-1">Methodology & Dataset Definitions</p>
        <ul className="list-disc pl-4 space-y-1 mt-1">
          <li><strong>Supermarket Estimate</strong> represents a high-frequency tracker computed daily from active retail listings.</li>
          <li><strong>Official Core-5 (INE)</strong> represents the official equivalent basket derived exclusively from the 5 corresponding product categories in the official INE registry (representing roughly 49% of the national CPI basket).</li>
          <li><strong>Official Overall CPI</strong> captures economy-wide inflation including utilities, housing, transportation, healthcare, and services (100% basket weight).</li>
          <li>Both rebased views anchor cumulative growth from <strong>August 1, 2024</strong> (the first overlapping monthly official data release).</li>
        </ul>

        {/* Flat Datawrapper Style Weights table */}
        <div className="mt-4 border-t border-neutral-200 pt-4">
          <p className="font-bold text-[#2c3e50] uppercase mb-2">{t.weightsTableTitle}</p>
          <div className="overflow-x-auto">
            <table className="w-full text-[10px] text-left text-neutral-600 border-collapse">
              <thead>
                <tr className="border-b border-neutral-300 text-[#2c3e50] font-bold uppercase">
                  <th className="py-1.5 pr-4">{t.weightsTableColCat}</th>
                  <th className="py-1.5 px-4 text-right font-mono">{t.weightsTableColRaw}</th>
                  <th className="py-1.5 pl-4 text-right font-mono">{t.weightsTableColNorm}</th>
                </tr>
              </thead>
              <tbody>
                <tr className="border-b border-neutral-200 hover:bg-neutral-100/50">
                  <td className="py-1.5 pr-4 font-semibold text-neutral-800">Alimentos y Bebidas No Alcohólicas</td>
                  <td className="py-1.5 px-4 text-right font-mono">27.06</td>
                  <td className="py-1.5 pl-4 text-right font-mono font-bold text-[#1f77b4]">55.08%</td>
                </tr>
                <tr className="border-b border-neutral-200 hover:bg-neutral-100/50">
                  <td className="py-1.5 pr-4 font-semibold text-neutral-800">Prendas de Vestir y Calzado</td>
                  <td className="py-1.5 px-4 text-right font-mono">7.56</td>
                  <td className="py-1.5 pl-4 text-right font-mono font-bold text-[#1f77b4]">15.39%</td>
                </tr>
                <tr className="border-b border-neutral-200 hover:bg-neutral-100/50">
                  <td className="py-1.5 pr-4 font-semibold text-neutral-800">Bienes y Servicios Diversos</td>
                  <td className="py-1.5 px-4 text-right font-mono">7.55</td>
                  <td className="py-1.5 pl-4 text-right font-mono font-bold text-[#1f77b4]">15.37%</td>
                </tr>
                <tr className="border-b border-neutral-200 hover:bg-neutral-100/50">
                  <td className="py-1.5 pr-4 font-semibold text-neutral-800">Muebles, Bienes y Servicios Domésticos</td>
                  <td className="py-1.5 px-4 text-right font-mono">6.08</td>
                  <td className="py-1.5 pl-4 text-right font-mono font-bold text-[#1f77b4]">12.38%</td>
                </tr>
                <tr className="border-b border-neutral-200 hover:bg-neutral-100/50">
                  <td className="py-1.5 pr-4 font-semibold text-neutral-800">Bebidas Alcohólicas y Tabaco</td>
                  <td className="py-1.5 px-4 text-right font-mono">0.88</td>
                  <td className="py-1.5 pl-4 text-right font-mono font-bold text-[#1f77b4]">1.79%</td>
                </tr>
                <tr className="border-t border-neutral-300 font-bold bg-neutral-100/30">
                  <td className="py-1.5 pr-4 text-[#2c3e50] uppercase">Total (Core-5 Basket)</td>
                  <td className="py-1.5 px-4 text-right font-mono text-[#2c3e50]">49.13</td>
                  <td className="py-1.5 pl-4 text-right font-mono text-[#2c3e50]">100.00%</td>
                </tr>
              </tbody>
            </table>
          </div>
        </div>
      </div>
    </div>
  );
}

// --- CITY LEVEL DATA AGGREGATION & ALIGNMENT ---
function getCityCombinedData(
  cityName: string,
  syntheticRows: any[],
  officialCityCore5Rows: any[],
  officialCityCategoryRows: any[],
  alignmentMode: 'rebased' | 'original'
) {
  if (!syntheticRows || syntheticRows.length === 0) return [];

  // Filter official city rows using normalized, accent-insensitive matching
  const cityQuery = norm(cityName); // e.g. "la paz", "santa cruz", "cochabamba"
  const isCochabamba = cityQuery.includes('cochabamba');

  const matchCity = (c: string) => {
    if (!c) return false;
    const cNorm = norm(String(c));
    if (isCochabamba && cNorm.includes('kanata')) return true;
    if (cityQuery.includes('la paz') && cNorm.includes('la paz')) return true;
    if (cityQuery.includes('santa cruz') && cNorm.includes('santa cruz')) return true;
    return cNorm.includes(cityQuery);
  };

  const cityCore5Rows = (officialCityCore5Rows || []).filter(r => matchCity(r.city));
  const cityCatRows = (officialCityCategoryRows || []).filter(r => matchCity(r.city));

  // 1. Get base values on August 1, 2024
  const baseSynth = getValueOnDate(syntheticRows, '2024-08-01', 'date', 'cpi') || 100.099;
  const baseOffCore = getValueOnDate(cityCore5Rows, '2024-08-01', 'date', 'Core-5 CPI') || 100.0;
  const baseOffOverall = getValueOnDate(cityCatRows.filter(r => norm(r.category) === 'indice general'), '2024-08-01', 'date', 'CPI level') || 100.0;

  // Track category baseline maps
  const categories = [
    { synth: 'Alimentos y Bebidas No Alcohólicas', off: 'Alimentos y bebidas no alcohólicas' },
    { synth: 'Bebidas Alcohólicas y Tabaco', off: 'Bebidas alcohólicas y tabaco' },
    { synth: 'Bienes y Servicios Diversos', off: 'Bienes y servicios diversos' },
    { synth: 'Muebles, Bienes y Servicios Domésticos', off: 'Muebles, bienes y servicios domésticos' },
    { synth: 'Prendas de Vestir y Calzado', off: 'Prendas de vestir y calzado' }
  ];

  const catBases: Record<string, { synth: number; off: number }> = {};
  categories.forEach(cat => {
    const sBase = getValueOnDate(syntheticRows, '2024-08-01', 'date', cat.synth) || 100.0;
    const oBase = getValueOnDate(cityCatRows.filter(r => norm(r.category) === norm(cat.off)), '2024-08-01', 'date', 'CPI level') || 100.0;
    catBases[cat.synth] = { synth: sBase, off: oBase };
  });

  // Prepare official core-5 map by date
  const offCoreMap = new Map<string, number>();
  cityCore5Rows.forEach(r => {
    if (r.date && r['Core-5 CPI'] != null) {
      const dInfo = parseDateSafe(String(r.date));
      offCoreMap.set(dInfo.displayDate, Number(r['Core-5 CPI']));
    }
  });

  // Prepare official overall map by date
  const offOverallMap = new Map<string, number>();
  cityCatRows.filter(r => norm(r.category) === 'indice general').forEach(r => {
    if (r.date && r['CPI level'] != null) {
      const dInfo = parseDateSafe(String(r.date));
      offOverallMap.set(dInfo.displayDate, Number(r['CPI level']));
    }
  });

  // Prepare official category maps by date
  const offCatMaps: Record<string, Map<string, number>> = {};
  categories.forEach(cat => {
    const m = new Map<string, number>();
    cityCatRows.filter(r => norm(r.category) === norm(cat.off)).forEach(r => {
      if (r.date && r['CPI level'] != null) {
        const dInfo = parseDateSafe(String(r.date));
        m.set(dInfo.displayDate, Number(r['CPI level']));
      }
    });
    offCatMaps[cat.synth] = m;
  });

  return syntheticRows
    .filter(row => {
      if (!row.date) return false;
      const dInfo = parseDateSafe(String(row.date));
      return dInfo.time >= new Date('2024-07-29').getTime();
    })
    .map(row => {
      const dInfo = parseDateSafe(String(row.date));
      const rawSynth = Number(row.cpi);
      const rawOffCore = offCoreMap.get(dInfo.displayDate) ?? null;
      const rawOffOverall = offOverallMap.get(dInfo.displayDate) ?? null;

      // Aligned outputs
      let synthVal = rawSynth;
      let offCoreVal = null;
      let offOverallVal = null;

      if (alignmentMode === 'rebased') {
        synthVal = (rawSynth / baseSynth) * 100;
        if (rawOffCore !== null) offCoreVal = (rawOffCore / baseOffCore) * 100;
        if (rawOffOverall !== null) offOverallVal = (rawOffOverall / baseOffOverall) * 100;
      } else {
        synthVal = rawSynth;
        if (rawOffCore !== null) offCoreVal = (rawOffCore / baseOffCore) * baseSynth;
        if (rawOffOverall !== null) offOverallVal = (rawOffOverall / baseOffOverall) * baseSynth;
      }

      const res: any = {
        dateNum: dInfo.time,
        displayDate: dInfo.displayDate,
        data_source: row.data_source,
        forwardFillMarker: row.data_source === 'Forward Fill' ? 3 : 0,
        
        Synthetic_CPI: synthVal,
        Official_CPI: offCoreVal,
        Official_CPI_Overall: offOverallVal
      };

      // Process individual categories
      categories.forEach(cat => {
        const rawSynthCat = row[cat.synth] != null ? Number(row[cat.synth]) : null;
        const rawOffCat = offCatMaps[cat.synth].get(dInfo.displayDate) ?? null;
        
        const bases = catBases[cat.synth];
        
        if (rawSynthCat !== null) {
          res[cat.synth] = alignmentMode === 'rebased' 
            ? (rawSynthCat / bases.synth) * 100 
            : rawSynthCat;
        } else {
          res[cat.synth] = null;
        }

        if (rawOffCat !== null) {
          res[`Official_${cat.synth}`] = alignmentMode === 'rebased'
            ? (rawOffCat / bases.off) * 100
            : (rawOffCat / bases.off) * bases.synth;
        } else {
          res[`Official_${cat.synth}`] = null;
        }
      });

      return res;
    })
    .sort((a, b) => a.dateNum - b.dateNum);
}

// --- CITY VIEW ---
function CityView({ name, data, alignmentMode, lang, t }: { name: string; data: DataStore; alignmentMode: AlignmentMode; lang: Lang; t: typeof T['en'] }) {
  const [showCore, setShowCore] = useState(true);
  const [showOverall, setShowOverall] = useState(true);
  const [inflationMode, setInflationMode] = useState<InflationMode>('MOM');
  const [activeCategories, setActiveCategories] = useState<Record<string, boolean>>({});

  const syntheticRows = useMemo(() => {
    if (name === 'La Paz') return data.laPazSynthetic;
    if (name === 'Cochabamba') return data.cochabambaSynthetic;
    return data.santaCruzSynthetic;
  }, [name, data]);

  const categoriesList = useMemo(() => {
    return [
      'Alimentos y Bebidas No Alcohólicas',
      'Bebidas Alcohólicas y Tabaco',
      'Bienes y Servicios Diversos',
      'Muebles, Bienes y Servicios Domésticos',
      'Prendas de Vestir y Calzado'
    ];
  }, []);

  // Combined City Data
  const chartData = useMemo(() => {
    return getCityCombinedData(
      name,
      syntheticRows,
      data.officialCityCore5,
      data.officialCityCategory,
      alignmentMode
    );
  }, [name, syntheticRows, data, alignmentMode]);

  // Keys used for calculations
  const activeKeys = useMemo(() => {
    const keys = ['Synthetic_CPI'];
    if (showCore) keys.push('Official_CPI');
    if (showOverall) keys.push('Official_CPI_Overall');
    
    categoriesList.forEach(cat => {
      if (activeCategories[cat]) {
        keys.push(cat);
        keys.push(`Official_${cat}`);
      }
    });
    return keys;
  }, [showCore, showOverall, activeCategories, categoriesList]);

  const inflationData = useMemo(() => {
    return calculateInflationData(chartData, activeKeys, inflationMode);
  }, [chartData, activeKeys, inflationMode]);

  // City-level stats computation
  const stats = useMemo(() => {
    if (chartData.length === 0) return null;
    const latestRow = chartData[chartData.length - 1];
    
    let latestCore = null;
    let latestOverall = null;
    for (let i = chartData.length - 1; i >= 0; i--) {
      if (latestCore === null && chartData[i].Official_CPI !== null) latestCore = chartData[i].Official_CPI;
      if (latestOverall === null && chartData[i].Official_CPI_Overall !== null) latestOverall = chartData[i].Official_CPI_Overall;
    }

    const infD = calculateInflationData(chartData, ['Synthetic_CPI', 'Official_CPI', 'Official_CPI_Overall'], 'MOM');
    const latestInfRow = infD[infD.length - 1];
    
    let latestCoreMom = null;
    let latestOverallMom = null;
    for (let i = infD.length - 1; i >= 0; i--) {
      if (latestCoreMom === null && infD[i].Official_CPI_Inflation !== null) latestCoreMom = infD[i].Official_CPI_Inflation;
      if (latestOverallMom === null && infD[i].Official_CPI_Overall_Inflation !== null) latestOverallMom = infD[i].Official_CPI_Overall_Inflation;
    }

    return {
      synthVal: latestRow.Synthetic_CPI,
      synthMom: latestInfRow.Synthetic_CPI_Inflation,
      coreVal: latestCore,
      coreMom: latestCoreMom,
      overallVal: latestOverall,
      overallMom: latestOverallMom
    };
  }, [chartData]);

  const toggleCategory = (cat: string) => {
    setActiveCategories(prev => ({ ...prev, [cat]: !prev[cat] }));
  };

  const cpiGraphRef = React.useRef<HTMLDivElement>(null);

  const downloadCSVData = () => {
    const allKeys = ['Synthetic_CPI', 'Official_CPI', 'Official_CPI_Overall', ...categoriesList.map(c => c), ...categoriesList.map(c => `Official_${c}`)];
    const fullInflation = calculateInflationData(chartData, allKeys, inflationMode);
    
    const exportRows = fullInflation.map(r => {
      const row: any = {
        Date: r.displayDate,
        DataSource: r.data_source,
        Synthetic_General_CPI: r.Synthetic_CPI != null ? r.Synthetic_CPI.toFixed(4) : null,
        Synthetic_General_Inflation: r.Synthetic_CPI_Inflation != null ? r.Synthetic_CPI_Inflation.toFixed(4) : null,
        Official_Core5_CPI: r.Official_CPI != null ? r.Official_CPI.toFixed(4) : null,
        Official_Core5_Inflation: r.Official_CPI_Inflation != null ? r.Official_CPI_Inflation.toFixed(4) : null,
        Official_Overall_CPI: r.Official_CPI_Overall != null ? r.Official_CPI_Overall.toFixed(4) : null,
        Official_Overall_Inflation: r.Official_CPI_Overall_Inflation != null ? r.Official_CPI_Overall_Inflation.toFixed(4) : null,
      };

      categoriesList.forEach(cat => {
        row[`Synthetic_${cat}_CPI`] = r[cat] != null ? r[cat].toFixed(4) : null;
        row[`Synthetic_${cat}_Inflation`] = r[`${cat}_Inflation`] != null ? r[`${cat}_Inflation`].toFixed(4) : null;
        row[`Official_${cat}_CPI`] = r[`Official_${cat}`] != null ? r[`Official_${cat}`].toFixed(4) : null;
        row[`Official_${cat}_Inflation`] = r[`Official_${cat}_Inflation`] != null ? r[`Official_${cat}_Inflation`].toFixed(4) : null;
      });

      return row;
    });

    const csv = Papa.unparse(exportRows);
    exportCSV(csv, `${norm(name)}_cpi_comparison.csv`);
  };

  return (
    <div className="space-y-6">
      {/* Tab details description card */}
      <div className="dw-card">
        <h2 className="text-lg font-bold text-[#1a252f] uppercase">{name}{t.city.titleSuffix}</h2>
        <p className="text-sm text-neutral-500 mt-1 leading-relaxed max-w-[850px]">{t.city.desc}</p>
        
        {/* Toggle checkboxes */}
        <div className="flex flex-wrap gap-4 mt-4 pt-4 border-t border-neutral-100">
          <label className="flex items-center gap-2 cursor-pointer text-xs font-semibold uppercase text-neutral-700">
            <span className="w-3.5 h-3.5 rounded-sm border border-[#1f77b4] flex items-center justify-center bg-[#1f77b4] text-white">
              <Check className="w-2.5 h-2.5" />
            </span>
            {t.city.legendSynthetic}
          </label>
          
          <label className="flex items-center gap-2 cursor-pointer text-xs font-semibold uppercase text-neutral-700">
            <input 
              type="checkbox" 
              checked={showCore} 
              onChange={e => setShowCore(e.target.checked)}
              className="rounded border-neutral-300 text-[#0f8c79] focus:ring-[#0f8c79] w-3.5 h-3.5 cursor-pointer"
            />
            {t.city.legendOfficialCore}
          </label>

          <label className="flex items-center gap-2 cursor-pointer text-xs font-semibold uppercase text-neutral-700">
            <input 
              type="checkbox" 
              checked={showOverall} 
              onChange={e => setShowOverall(e.target.checked)}
              className="rounded border-neutral-300 text-[#d62728] focus:ring-[#d62728] w-3.5 h-3.5 cursor-pointer"
            />
            {t.city.legendOfficialOverall}
          </label>
        </div>
      </div>

      {/* Metric stats card grid */}
      {stats && (
        <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
          <div className="bg-white border border-[#e1e6eb] rounded-sm p-4">
            <div className="text-[10px] font-bold text-[#1f77b4] uppercase tracking-wider">{t.city.legendSynthetic}</div>
            <div className="text-2xl font-extrabold text-neutral-900 mt-1 font-mono">
              {stats.synthVal ? stats.synthVal.toFixed(2) : '--'}
            </div>
            <div className="text-xs text-neutral-500 mt-1">
              <span>{t.national.cardMom}: <strong className="text-neutral-800 font-mono">{stats.synthMom ? (stats.synthMom > 0 ? '+' : '') + stats.synthMom.toFixed(2) + '%' : '--'}</strong></span>
            </div>
          </div>
          
          <div className={`bg-white border border-[#e1e6eb] rounded-sm p-4 ${!showCore ? 'opacity-40' : ''}`}>
            <div className="text-[10px] font-bold text-[#0f8c79] uppercase tracking-wider">{t.city.legendOfficialCore}</div>
            <div className="text-2xl font-extrabold text-neutral-900 mt-1 font-mono">
              {stats.coreVal ? stats.coreVal.toFixed(2) : '--'}
            </div>
            <div className="text-xs text-neutral-500 mt-1">
              <span>{t.national.cardMom}: <strong className="text-neutral-800 font-mono">{stats.coreMom ? (stats.coreMom > 0 ? '+' : '') + stats.coreMom.toFixed(2) + '%' : '--'}</strong></span>
            </div>
          </div>

          <div className={`bg-white border border-[#e1e6eb] rounded-sm p-4 ${!showOverall ? 'opacity-40' : ''}`}>
            <div className="text-[10px] font-bold text-[#d62728] uppercase tracking-wider">{t.city.legendOfficialOverall}</div>
            <div className="text-2xl font-extrabold text-neutral-900 mt-1 font-mono">
              {stats.overallVal ? stats.overallVal.toFixed(2) : '--'}
            </div>
            <div className="text-xs text-neutral-500 mt-1">
              <span>{t.national.cardMom}: <strong className="text-neutral-800 font-mono">{stats.overallMom ? (stats.overallMom > 0 ? '+' : '') + stats.overallMom.toFixed(2) + '%' : '--'}</strong></span>
            </div>
          </div>
        </div>
      )}

      {/* Category filter toolbox */}
      <div className="dw-card">
        <h4 className="text-xs font-bold text-neutral-700 uppercase tracking-wider mb-1">{t.city.subCategories}</h4>
        <p className="text-[11px] text-neutral-400 mb-4">{t.city.subCategoriesDesc}</p>
        <div className="flex flex-wrap gap-2">
          {categoriesList.map((cat, i) => {
            const active = activeCategories[cat];
            const color = CAT_COLORS[i % CAT_COLORS.length];
            return (
              <button
                key={cat}
                onClick={() => toggleCategory(cat)}
                className={`text-[11px] font-bold px-3 py-2 rounded-sm border transition-all uppercase flex items-center gap-2 ${
                  active 
                    ? 'bg-[#2c3e50] text-white border-[#2c3e50] shadow-sm'
                    : 'bg-white text-neutral-600 border-neutral-200 hover:bg-neutral-50 hover:text-neutral-900'
                }`}
              >
                {active && <span className="w-2.5 h-2.5 rounded-sm" style={{ backgroundColor: color }} />}
                {cat}
              </button>
            );
          })}
        </div>
      </div>

      {/* Linked Dual Graph Workspace */}
      <div className="dw-card" ref={cpiGraphRef}>
        {/* GRAPH 1 (TOP) - CPI Level */}
        <div className="h-[340px] w-full min-w-0 border-b border-neutral-100 pb-6 mb-6">
          <div className="flex items-center justify-between mb-4">
            <div>
              <h3 className="text-xs font-bold text-[#1a252f] uppercase tracking-wider">{t.graphs.cpiIndexTitle}</h3>
              <p className="text-[11px] text-neutral-400 mt-0.5">{t.graphs.cpiIndexDesc}</p>
            </div>
            <div className="flex gap-2">
              <button 
                onClick={() => exportImage(cpiGraphRef.current, `bolivia_${norm(name)}_cpi_index.png`)} 
                className="flex items-center gap-1 text-[10px] font-bold uppercase px-2 py-1 border border-neutral-200 hover:bg-neutral-50 rounded bg-white text-neutral-700 shadow-sm"
              >
                <Camera className="w-3 h-3" />
                {t.graphs.exportGraph}
              </button>
            </div>
          </div>

          <ResponsiveContainer width="100%" height="100%">
            <LineChart syncId={`${norm(name)}Sync`} data={chartData} margin={{ top: 10, right: 10, left: 0, bottom: 0 }}>
              <CartesianGrid strokeDasharray="0" vertical={false} stroke={COLORS.grid} />
              <XAxis 
                dataKey="displayDate" 
                tick={{fontSize: 10, fill: '#737373', fontFamily: 'var(--font-mono)'}} 
                tickMargin={6} 
                minTickGap={40} 
                stroke="#d1d5db"
              />
              <YAxis 
                domain={['auto', 'auto']} 
                tick={{fontSize: 10, fill: '#737373', fontFamily: 'var(--font-mono)'}} 
                tickFormatter={(val) => val.toFixed(1)} 
                tickMargin={6}
                stroke="#d1d5db"
              />
              <Tooltip content={<CustomTooltip chartData={chartData} t={t} />} />
              
              <Line 
                type="monotone" 
                dot={false} 
                dataKey="Synthetic_CPI" 
                name={t.city.legendSynthetic} 
                stroke={COLORS.synthetic} 
                strokeWidth={2.5} 
                isAnimationActive={false} 
              />
              
              {showCore && (
                <Line 
                  type="linear" 
                  connectNulls={true} 
                  dataKey="Official_CPI" 
                  name={t.city.legendOfficialCore} 
                  stroke={COLORS.officialCore} 
                  strokeDasharray="5 5" 
                  strokeWidth={2} 
                  dot={{ r: 3, stroke: COLORS.officialCore, fill: '#ffffff', strokeWidth: 2 }} 
                  isAnimationActive={false} 
                />
              )}
              
              {showOverall && (
                <Line 
                  type="linear" 
                  connectNulls={true} 
                  dataKey="Official_CPI_Overall" 
                  name={t.city.legendOfficialOverall} 
                  stroke={COLORS.officialOverall} 
                  strokeDasharray="3 3" 
                  strokeWidth={2} 
                  dot={{ r: 3, stroke: COLORS.officialOverall, fill: '#ffffff', strokeWidth: 2 }} 
                  isAnimationActive={false} 
                />
              )}

              {/* Dynamic Categories Overlay */}
              {categoriesList.map((cat, idx) => {
                if (!activeCategories[cat]) return null;
                const color = CAT_COLORS[idx % CAT_COLORS.length];
                return (
                  <Fragment key={cat}>
                    <Line 
                      type="monotone" 
                      dot={false} 
                      dataKey={cat} 
                      name={`${cat} (${t.city.legendSyntheticCat})`} 
                      stroke={color} 
                      strokeWidth={1.5} 
                      isAnimationActive={false} 
                    />
                    <Line 
                      type="linear" 
                      connectNulls={true} 
                      dataKey={`Official_${cat}`} 
                      name={`${cat} (${t.city.legendOfficialCat})`} 
                      stroke={color} 
                      strokeDasharray="5 5" 
                      strokeWidth={1.5} 
                      dot={{ r: 2.5, stroke: color, fill: '#ffffff', strokeWidth: 1.5 }}
                      isAnimationActive={false} 
                    />
                  </Fragment>
                );
              })}
            </LineChart>
          </ResponsiveContainer>
        </div>

        {/* GRAPH 2 (BOTTOM) - Inflation rate */}
        <div className="h-[340px] w-full min-w-0">
          <div className="flex flex-col sm:flex-row sm:items-center justify-between mb-4 gap-2">
            <div>
              <h3 className="text-xs font-bold text-[#1a252f] uppercase tracking-wider">{t.graphs.inflationTitle}</h3>
              <p className="text-[11px] text-neutral-400 mt-0.5">{t.graphs.inflationDesc}</p>
            </div>
            
            {/* Period switcher */}
            <div className="flex bg-[#f1f3f5] p-0.5 rounded border border-neutral-200 self-start">
              {(['DOD', 'MOM', 'YOY'] as const).map(mode => (
                <button
                  key={mode}
                  onClick={() => setInflationMode(mode)}
                  className={`text-[9px] font-bold px-2 py-1 rounded-sm uppercase ${inflationMode === mode ? 'bg-white text-black shadow-sm border border-neutral-200' : 'text-neutral-500 hover:text-black'}`}
                >
                  {mode === 'DOD' ? t.period.dod : mode === 'MOM' ? t.period.mom : t.period.yoy}
                </button>
              ))}
            </div>
          </div>

          <ResponsiveContainer width="100%" height="100%">
            <LineChart syncId={`${norm(name)}Sync`} data={inflationData} margin={{ top: 10, right: 10, left: 0, bottom: 0 }}>
              <CartesianGrid strokeDasharray="0" vertical={false} stroke={COLORS.grid} />
              <XAxis 
                dataKey="displayDate" 
                tick={{fontSize: 10, fill: '#737373', fontFamily: 'var(--font-mono)'}} 
                tickMargin={6} 
                minTickGap={40} 
                stroke="#d1d5db"
              />
              <YAxis 
                tick={{fontSize: 10, fill: '#737373', fontFamily: 'var(--font-mono)'}} 
                tickMargin={6} 
                tickFormatter={(val) => val.toFixed(1) + '%'} 
                stroke="#d1d5db"
              />
              <Tooltip content={<CustomTooltip isPercent chartData={inflationData} t={t} />} />
              
              <Line 
                type="monotone" 
                dot={false} 
                dataKey="Synthetic_CPI_Inflation" 
                name={t.city.legendSynthetic} 
                stroke={COLORS.synthetic} 
                strokeWidth={2.5} 
                isAnimationActive={false} 
              />
              
              {showCore && (
                <Line 
                  type="linear" 
                  connectNulls={true} 
                  dataKey="Official_CPI_Inflation" 
                  name={t.city.legendOfficialCore} 
                  stroke={COLORS.officialCore} 
                  strokeDasharray="5 5" 
                  strokeWidth={2} 
                  dot={{ r: 3, stroke: COLORS.officialCore, fill: '#ffffff', strokeWidth: 2 }} 
                  isAnimationActive={false} 
                />
              )}
              
              {showOverall && (
                <Line 
                  type="linear" 
                  connectNulls={true} 
                  dataKey="Official_CPI_Overall_Inflation" 
                  name={t.city.legendOfficialOverall} 
                  stroke={COLORS.officialOverall} 
                  strokeDasharray="3 3" 
                  strokeWidth={2} 
                  dot={{ r: 3, stroke: COLORS.officialOverall, fill: '#ffffff', strokeWidth: 2 }} 
                  isAnimationActive={false} 
                />
              )}

              {/* Dynamic Categories Overlay */}
              {categoriesList.map((cat, idx) => {
                if (!activeCategories[cat]) return null;
                const color = CAT_COLORS[idx % CAT_COLORS.length];
                return (
                  <Fragment key={cat}>
                    <Line 
                      type="monotone" 
                      dot={false} 
                      dataKey={`${cat}_Inflation`} 
                      name={`${cat} (${t.city.legendSyntheticCat})`} 
                      stroke={color} 
                      strokeWidth={1.5} 
                      isAnimationActive={false} 
                    />
                    <Line 
                      type="linear" 
                      connectNulls={true} 
                      dataKey={`Official_${cat}_Inflation`} 
                      name={`${cat} (${t.city.legendOfficialCat})`} 
                      stroke={color} 
                      strokeDasharray="5 5" 
                      strokeWidth={1.5} 
                      dot={{ r: 2.5, stroke: color, fill: '#ffffff', strokeWidth: 1.5 }}
                      isAnimationActive={false} 
                    />
                  </Fragment>
                );
              })}
              
              <Brush dataKey="displayDate" height={24} stroke={COLORS.brush} tick={{fontSize: 9, fill: '#737373'}} />
            </LineChart>
          </ResponsiveContainer>
        </div>

        {/* CSV export */}
        <div className="mt-8 pt-4 border-t border-neutral-100 flex justify-end">
          <button 
            onClick={downloadCSVData} 
            className="flex items-center gap-1.5 px-3 py-2 border border-neutral-200 hover:bg-neutral-50 rounded bg-white text-xs font-bold uppercase text-[#2c3e50] shadow-sm"
          >
            <Download className="w-3.5 h-3.5" />
            {t.graphs.exportCSV}
          </button>
        </div>
      </div>

      {/* Methodology Callout Panel */}
      <div className="bg-neutral-50 border-l-4 border-[#2c3e50] p-4 text-xs text-neutral-600 leading-relaxed rounded-r shadow-sm mt-6">
        <p className="font-bold text-[#2c3e50] uppercase mb-1">Methodology & Dataset Definitions</p>
        <ul className="list-disc pl-4 space-y-1 mt-1">
          <li><strong>Supermarket Estimate</strong> represents a high-frequency tracker computed daily from active retail listings.</li>
          <li><strong>Official Core-5 (INE)</strong> represents the official equivalent basket derived exclusively from the 5 corresponding product categories in the official INE registry (representing roughly 49% of the national CPI basket).</li>
          <li><strong>Official Overall CPI</strong> captures economy-wide inflation including utilities, housing, transportation, healthcare, and services (100% basket weight).</li>
          <li>Both rebased views anchor cumulative growth from <strong>August 1, 2024</strong> (the first overlapping monthly official data release).</li>
        </ul>

        {/* Flat Datawrapper Style Weights table */}
        <div className="mt-4 border-t border-neutral-200 pt-4">
          <p className="font-bold text-[#2c3e50] uppercase mb-2">{t.weightsTableTitle}</p>
          <div className="overflow-x-auto">
            <table className="w-full text-[10px] text-left text-neutral-600 border-collapse">
              <thead>
                <tr className="border-b border-neutral-300 text-[#2c3e50] font-bold uppercase">
                  <th className="py-1.5 pr-4">{t.weightsTableColCat}</th>
                  <th className="py-1.5 px-4 text-right font-mono">{t.weightsTableColRaw}</th>
                  <th className="py-1.5 pl-4 text-right font-mono">{t.weightsTableColNorm}</th>
                </tr>
              </thead>
              <tbody>
                <tr className="border-b border-neutral-200 hover:bg-neutral-100/50">
                  <td className="py-1.5 pr-4 font-semibold text-neutral-800">Alimentos y Bebidas No Alcohólicas</td>
                  <td className="py-1.5 px-4 text-right font-mono">27.06</td>
                  <td className="py-1.5 pl-4 text-right font-mono font-bold text-[#1f77b4]">55.08%</td>
                </tr>
                <tr className="border-b border-neutral-200 hover:bg-neutral-100/50">
                  <td className="py-1.5 pr-4 font-semibold text-neutral-800">Prendas de Vestir y Calzado</td>
                  <td className="py-1.5 px-4 text-right font-mono">7.56</td>
                  <td className="py-1.5 pl-4 text-right font-mono font-bold text-[#1f77b4]">15.39%</td>
                </tr>
                <tr className="border-b border-neutral-200 hover:bg-neutral-100/50">
                  <td className="py-1.5 pr-4 font-semibold text-neutral-800">Bienes y Servicios Diversos</td>
                  <td className="py-1.5 px-4 text-right font-mono">7.55</td>
                  <td className="py-1.5 pl-4 text-right font-mono font-bold text-[#1f77b4]">15.37%</td>
                </tr>
                <tr className="border-b border-neutral-200 hover:bg-neutral-100/50">
                  <td className="py-1.5 pr-4 font-semibold text-neutral-800">Muebles, Bienes y Servicios Domésticos</td>
                  <td className="py-1.5 px-4 text-right font-mono">6.08</td>
                  <td className="py-1.5 pl-4 text-right font-mono font-bold text-[#1f77b4]">12.38%</td>
                </tr>
                <tr className="border-b border-neutral-200 hover:bg-neutral-100/50">
                  <td className="py-1.5 pr-4 font-semibold text-neutral-800">Bebidas Alcohólicas y Tabaco</td>
                  <td className="py-1.5 px-4 text-right font-mono">0.88</td>
                  <td className="py-1.5 pl-4 text-right font-mono font-bold text-[#1f77b4]">1.79%</td>
                </tr>
                <tr className="border-t border-neutral-300 font-bold bg-neutral-100/30">
                  <td className="py-1.5 pr-4 text-[#2c3e50] uppercase">Total (Core-5 Basket)</td>
                  <td className="py-1.5 px-4 text-right font-mono text-[#2c3e50]">49.13</td>
                  <td className="py-1.5 pl-4 text-right font-mono text-[#2c3e50]">100.00%</td>
                </tr>
              </tbody>
            </table>
          </div>
        </div>
      </div>
    </div>
  );
}

// --- PRODUCT COUNT VIEW ---

function ProductCountView({ data, lang, t }: { data: any[]; lang: Lang; t: typeof T['en'] }) {
  const chartData = useMemo(() => {
    if (!data) return [];
    return data.map(r => {
      const dInfo = parseDateSafe(String(r.Date || r.date));
      return {
        ...r,
        dateNum: dInfo.time,
        displayDate: dInfo.displayDate
      };
    }).sort((a, b) => a.dateNum - b.dateNum);
  }, [data]);

  const categories = useMemo(() => {
    if (chartData.length === 0) return [];
    return Object.keys(chartData[0]).filter(k => k !== 'Date' && k !== 'date' && k !== 'dateNum' && k !== 'displayDate' && k !== 'forwardFillMarker');
  }, [chartData]);

  const graphRef = React.useRef<HTMLDivElement>(null);

  const downloadCSV = () => {
    const csv = Papa.unparse(chartData.map(r => {
      const { dateNum, ...rest } = r;
      return rest;
    }));
    exportCSV(csv, 'live_product_counts.csv');
  };

  return (
    <div className="space-y-6">
      <div className="dw-card">
        <h2 className="text-lg font-bold text-[#1a252f] uppercase">{t.counts.title}</h2>
        <p className="text-sm text-neutral-500 mt-1 leading-relaxed max-w-[850px]">{t.counts.desc}</p>
      </div>

      <div className="dw-card" ref={graphRef}>
        <div className="flex items-center justify-between mb-4">
          <div>
            <h3 className="text-xs font-bold text-[#1a252f] uppercase tracking-wider">Scrape Density timeline</h3>
            <p className="text-[11px] text-neutral-400 mt-0.5">Stacked count of observed supermarket price listings over time.</p>
          </div>
          <button 
            onClick={() => exportImage(graphRef.current, 'product_observations_density.png')} 
            className="flex items-center gap-1 text-[10px] font-bold uppercase px-2 py-1 border border-neutral-200 hover:bg-neutral-50 rounded bg-white text-neutral-700 shadow-sm"
          >
            <Camera className="w-3 h-3" />
            {t.graphs.exportGraph}
          </button>
        </div>

        <div className="h-[450px] w-full min-w-0">
          <ResponsiveContainer width="100%" height="100%">
            <AreaChart data={chartData} margin={{ top: 10, right: 10, left: 0, bottom: 0 }}>
              <CartesianGrid strokeDasharray="0" vertical={false} stroke={COLORS.grid} />
              <XAxis 
                dataKey="displayDate" 
                tick={{fontSize: 10, fill: '#737373', fontFamily: 'var(--font-mono)'}} 
                tickMargin={6} 
                minTickGap={40} 
                stroke="#d1d5db"
              />
              <YAxis 
                tick={{fontSize: 10, fill: '#737373', fontFamily: 'var(--font-mono)'}} 
                tickFormatter={(val) => val.toLocaleString()}
                tickMargin={6}
                stroke="#d1d5db"
              />
              <Tooltip content={<CustomTooltip chartData={chartData} t={t} />} />
              <Legend verticalAlign="bottom" height={36} wrapperStyle={{ fontSize: '11px', paddingTop: '15px', textTransform: 'uppercase', fontWeight: 'bold' }} />
              
              {categories.map((cat, i) => (
                <Area 
                  key={cat} 
                  type="monotone" 
                  dataKey={cat} 
                  stackId="1" 
                  stroke={CAT_COLORS[i % CAT_COLORS.length]} 
                  fill={CAT_COLORS[i % CAT_COLORS.length]} 
                  isAnimationActive={false}
                  fillOpacity={0.7}
                />
              ))}
              <Brush dataKey="displayDate" height={24} stroke={COLORS.brush} tick={{fontSize: 9, fill: '#737373'}} />
            </AreaChart>
          </ResponsiveContainer>
        </div>

        <div className="mt-8 pt-4 border-t border-neutral-100 flex justify-end">
          <button 
            onClick={downloadCSV} 
            className="flex items-center gap-1.5 px-3 py-2 border border-neutral-200 hover:bg-neutral-50 rounded bg-white text-xs font-bold uppercase text-[#2c3e50] shadow-sm"
          >
            <Download className="w-3.5 h-3.5" />
            {t.counts.exportCSV}
          </button>
        </div>
      </div>
    </div>
  );
}

// --- METHODOLOGY VIEW ---

function MethodologyView({ lang, t }: { lang: Lang; t: typeof T['en'] }) {
  const methodologyPdfUrl = `${import.meta.env.BASE_URL}Methods.pdf`;
  const researchPaperPdfUrl = `${import.meta.env.BASE_URL}Real_Time_CPI_Paper.pdf`;

  return (
    <div className="space-y-6">
      {/* Top Banner */}
      <div className="dw-card">
        <h2 className="text-lg font-bold text-[#1a252f] uppercase">{t.methodology.title}</h2>
        <p className="text-sm text-neutral-500 mt-1 leading-relaxed max-w-[850px]">
          {t.methodology.desc}
        </p>
      </div>

      {/* Double Column Flat Layout */}
      <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
        {/* Column 1: Methodology Guide */}
        <div className="bg-white border border-[#e1e6eb] rounded-sm p-6 flex flex-col justify-between">
          <div>
            <h3 className="text-sm font-bold text-[#2c3e50] uppercase tracking-wide border-b border-neutral-100 pb-2 mb-3">
              {t.methodology.docTitle}
            </h3>
            <p className="text-xs text-neutral-500 leading-relaxed mb-6">
              {t.methodology.docDesc}
            </p>
          </div>
          
          <div className="flex items-center gap-2 mt-auto">
            <a 
              href={methodologyPdfUrl}
              download
              className="flex items-center gap-1.5 px-3.5 py-2.5 bg-[#2c3e50] text-white hover:bg-[#1a252f] transition-all font-bold text-[10px] uppercase rounded-sm border border-[#2c3e50] shadow-sm cursor-pointer"
            >
              <Download className="w-3.5 h-3.5" />
              {t.methodology.downloadPDF}
            </a>
            <a 
              href={methodologyPdfUrl}
              target="_blank"
              rel="noopener noreferrer"
              className="flex items-center gap-1.5 px-3.5 py-2.5 bg-white text-neutral-700 hover:bg-neutral-50 hover:text-black border border-neutral-200 rounded-sm font-bold text-[10px] uppercase shadow-sm cursor-pointer"
            >
              {t.methodology.openNewTab}
            </a>
          </div>
        </div>

        {/* Column 2: Academic Research Paper */}
        <div className="bg-white border border-[#e1e6eb] rounded-sm p-6 flex flex-col justify-between">
          <div>
            <h3 className="text-sm font-bold text-[#2c3e50] uppercase tracking-wide border-b border-neutral-100 pb-2 mb-3">
              {t.methodology.paperTitle}
            </h3>
            <p className="text-xs text-neutral-500 leading-relaxed mb-6">
              {t.methodology.paperDesc}
            </p>
          </div>
          
          <div className="flex items-center gap-2 mt-auto">
            <a 
              href={researchPaperPdfUrl}
              download
              className="flex items-center gap-1.5 px-3.5 py-2.5 bg-[#2c3e50] text-white hover:bg-[#1a252f] transition-all font-bold text-[10px] uppercase rounded-sm border border-[#2c3e50] shadow-sm cursor-pointer"
            >
              <Download className="w-3.5 h-3.5" />
              {t.methodology.downloadPaper}
            </a>
            <a 
              href={researchPaperPdfUrl}
              target="_blank"
              rel="noopener noreferrer"
              className="flex items-center gap-1.5 px-3.5 py-2.5 bg-white text-neutral-700 hover:bg-neutral-50 hover:text-black border border-neutral-200 rounded-sm font-bold text-[10px] uppercase shadow-sm cursor-pointer"
            >
              {t.methodology.openNewTab}
            </a>
          </div>
        </div>
      </div>
    </div>
  );
}

// --- DATAWRAPPER CUSTOM TOOLTIP ---

function CustomTooltip({ active, payload, label, isPercent, chartData, t }: any) {
  if (active && payload && payload.length) {
    const isForwardFill = payload[0]?.payload?.data_source === 'Forward Fill';
    const indexInArray = chartData.findIndex((row: any) => row.displayDate === label);
    
    return (
      <div className="bg-white border border-[#e1e6eb] p-3 rounded-sm shadow-md text-xs min-w-[220px]">
        <div className="font-bold text-[#1a252f] border-b border-neutral-100 pb-1.5 mb-2 uppercase flex items-center justify-between">
          <span>{label}</span>
          {isForwardFill && (
            <span className="text-[9px] font-medium text-amber-600 bg-amber-50 border border-amber-200 px-1 rounded-sm uppercase tracking-wide">
              {t.forwardFillShort}
            </span>
          )}
        </div>
        
        <div className="space-y-1.5">
          {payload.map((p: any, idx: number) => {
            if (p.dataKey === 'forwardFillMarker' || p.value === null) return null;
            
            // Check if this is a monthly series with a null value on this date
            // If it is null, look back to find the closest active monthly value to display
            let displayVal = p.value;
            let displayDateSuffix = '';
            
            if (p.value === undefined || p.value === null) {
              const closestInfo = getClosestValue(chartData, indexInArray, p.dataKey);
              if (closestInfo.value !== null) {
                displayVal = closestInfo.value;
                displayDateSuffix = ` (${closestInfo.displayDate?.substring(5)})`;
              } else {
                return null;
              }
            }

            return (
              <div key={idx} className="flex items-center justify-between gap-4">
                <div className="flex items-center gap-1.5">
                  <span className="w-2 h-2 rounded-sm" style={{ backgroundColor: p.stroke || p.fill }} />
                  <span className="text-neutral-500 font-medium tracking-tight">
                    {p.name}
                    {displayDateSuffix && <span className="text-[10px] text-neutral-400 font-normal">{displayDateSuffix}</span>}
                  </span>
                </div>
                <span className="font-bold font-mono text-[#2c3e50]">
                  {typeof displayVal === 'number' 
                    ? displayVal.toLocaleString(undefined, { minimumFractionDigits: 2, maximumFractionDigits: 2 }) + (isPercent ? '%' : '') 
                    : displayVal}
                </span>
              </div>
            );
          })}
        </div>
      </div>
    );
  }
  return null;
}
