export type Lang = 'en' | 'es';

export const T = {
  en: {
    title: 'Bolivia Retail CPI Tracker',
    infoTooltip: 'This tracker provides a high-frequency synthetic price index based on supermarket retail data. It focuses on the "Core-5" basket of retail goods (representing roughly 49% of official weights) and excludes housing, utilities, transportation, and services. It is best used as a high-frequency indicator of retail inflation trends to compare with official INE macroeconomic data.',
    headerDesc: 'High-frequency supermarket price index compared with official INE benchmarks across major Bolivian cities.',
    viewRepo: 'View Repository',

    tabs: {
      national: 'National Trends',
      laPaz: 'La Paz',
      cochabamba: 'Cochabamba',
      santaCruz: 'Santa Cruz',
      productCounts: 'Product Observations',
      methodology: 'Methodology'
    },

    loading: 'Loading price index data...',

    alignment: {
      label: 'Comparison Alignment:',
      rebased: 'Index Level (Base = 100 on Aug 1, 2024)',
      original: 'Original Level (Aligned on Aug 1, 2024)'
    },

    period: {
      dod: 'Daily (DoD)',
      mom: 'Monthly (MoM)',
      yoy: 'Annual (YoY)'
    },

    graphs: {
      cpiIndexTitle: 'CPI INDEX LEVEL',
      cpiIndexDesc: 'Shows the cumulative price change since the tracking baseline.',
      inflationTitle: 'INFLATION RATE (%)',
      inflationDesc: 'Shows the rate of price changes over the selected time horizon.',
      exportGraph: 'Export Chart',
      exportCSV: 'Download Data (CSV)'
    },

    national: {
      title: 'National CPI Comparison',
      desc: 'Compare the supermarket real-time retail estimate with the official INE Core-5 CPI (basket equivalent) and the Official Overall National CPI.',
      legendSynthetic: 'Supermarket Estimate (Real-Time)',
      legendOfficialCore: 'Official Core-5 CPI (INE)',
      legendOfficialOverall: 'Official Overall CPI (INE)',
      cardLatest: 'Latest Value',
      cardMom: 'Monthly Inflation',
      cardYoy: 'Annual Inflation'
    },

    city: {
      titleSuffix: ' CPI Comparison',
      desc: 'Compare the city-level supermarket retail estimate against the official city Core-5 CPI and the city Overall CPI.',
      legendSynthetic: 'Supermarket Estimate (Real-Time)',
      legendOfficialCore: 'Official City Core-5 CPI (INE)',
      legendOfficialOverall: 'Official City Overall CPI (INE)',
      subCategories: 'Compare Category-Level CPI & Inflation',
      subCategoriesDesc: 'Toggle individual categories to overlay the real-time supermarket estimate against its official INE category counterpart:',
      legendSyntheticCat: 'Supermarket Category',
      legendOfficialCat: 'Official INE Category'
    },

    counts: {
      title: 'Active Product Observations',
      desc: 'Total number of daily active price observations tracked across supermarkets in La Paz, Cochabamba, and Santa Cruz.',
      exportCSV: 'Export CSV',
      exportGraph: 'Export Chart'
    },

    methodology: {
      title: 'Methodology & Research',
      desc: 'Access our detailed data collection guide and full academic research paper for comprehensive methodology and theoretical baselines.',
      docTitle: 'Methodology Document',
      docDesc: 'Details the daily supermarket scraping protocol, product classification, and official weight mapping used to calculate our synthetic indices.',
      downloadPDF: 'Download Methodology PDF',
      paperTitle: 'Academic Research Paper',
      paperDesc: 'Explore the full econometric baselines, theoretical framework, retail inflation findings, and policy implications for Bolivia.',
      downloadPaper: 'Download Research Paper',
      openNewTab: 'Open in New Tab'
    },
    
    forwardFill: 'Price carried forward (no new scrape)',
    forwardFillShort: '(Forward Fill)',
    footerContact: 'Questions or feedback? Reach out at',
    designCredit: 'Design inspired by Datawrapper',
    weightsTableTitle: 'Basket Weight Breakdown (Core-5 Basket)',
    weightsTableColCat: 'Category',
    weightsTableColRaw: 'INE Raw Weight',
    weightsTableColNorm: 'Normalized Weight'
  },
  es: {
    title: 'Rastreador de IPC Minorista de Bolivia',
    infoTooltip: 'Este rastreador proporciona un índice de precios sintético de alta frecuencia basado en datos de supermercados. Se centra en la canasta "Core-5" de bienes minoristas (49% de los pesos oficiales) y excluye vivienda, servicios públicos, transporte y servicios. Se utiliza como un indicador de alta frecuencia de la inflación minorista en comparación con los datos oficiales del INE.',
    headerDesc: 'Índice de precios de supermercados de alta frecuencia comparado con los indicadores oficiales del INE en las principales ciudades.',
    viewRepo: 'Ver Repositorio',

    tabs: {
      national: 'Tendencias Nacionales',
      laPaz: 'La Paz',
      cochabamba: 'Cochabamba',
      santaCruz: 'Santa Cruz',
      productCounts: 'Observaciones de Productos',
      methodology: 'Metodología'
    },

    loading: 'Cargando datos del índice de precios...',

    alignment: {
      label: 'Alineación de Comparación:',
      rebased: 'Nivel de Índice (Base = 100 en Ago 1, 2024)',
      original: 'Nivel Original (Alineado en Ago 1, 2024)'
    },

    period: {
      dod: 'Diario (DoD)',
      mom: 'Mensual (MoM)',
      yoy: 'Anual (YoY)'
    },

    graphs: {
      cpiIndexTitle: 'NIVEL DE ÍNDICE DE IPC',
      cpiIndexDesc: 'Muestra el cambio acumulado de precios desde el mes base.',
      inflationTitle: 'TASA DE INFLACIÓN (%)',
      inflationDesc: 'Muestra la tasa de cambio de precios en el período seleccionado.',
      exportGraph: 'Exportar Gráfico',
      exportCSV: 'Descargar Datos (CSV)'
    },

    national: {
      title: 'Comparación del IPC Nacional',
      desc: 'Compare la estimación de supermercados en tiempo real con el IPC Core-5 oficial del INE (canasta equivalente) y el IPC Nacional General oficial.',
      legendSynthetic: 'Estimación Supermercados (Tiempo Real)',
      legendOfficialCore: 'IPC Core-5 Oficial (INE)',
      legendOfficialOverall: 'IPC General Oficial (INE)',
      cardLatest: 'Último Valor',
      cardMom: 'Inflación Mensual',
      cardYoy: 'Inflación Anual'
    },

    city: {
      titleSuffix: ' - Comparación de IPC',
      desc: 'Compare la estimación de supermercados de la ciudad con el IPC Core-5 oficial y el IPC General oficial de la misma ciudad.',
      legendSynthetic: 'Estimación Supermercados (Tiempo Real)',
      legendOfficialCore: 'IPC Core-5 de la Ciudad Oficial (INE)',
      legendOfficialOverall: 'IPC General de la Ciudad Oficial (INE)',
      subCategories: 'Comparar IPC e Inflación por Categorías',
      subCategoriesDesc: 'Seleccione categorías individuales para superponer la estimación en tiempo real con su contraparte oficial del INE:',
      legendSyntheticCat: 'Categoría Supermercado',
      legendOfficialCat: 'Categoría Oficial INE'
    },

    counts: {
      title: 'Observaciones de Productos Activos',
      desc: 'Número total de observaciones diarias de precios en supermercados de La Paz, Cochabamba y Santa Cruz.',
      exportCSV: 'Exportar CSV',
      exportGraph: 'Exportar Gráfico'
    },

    methodology: {
      title: 'Metodología e Investigación',
      desc: 'Acceda a nuestra guía detallada de recolección de datos y al artículo de investigación académica completo para una comprensión profunda.',
      docTitle: 'Documento de Metodología',
      docDesc: 'Detalla el protocolo de recolección diario, la clasificación de productos y el mapeo de ponderaciones del INE para calcular los índices sintéticos.',
      downloadPDF: 'Descargar PDF de Metodología',
      paperTitle: 'Artículo de Investigación Académica',
      paperDesc: 'Explore los hallazgos de inflación minorista, el marco econométrico, las comparaciones estructurales y las implicaciones de política en Bolivia.',
      downloadPaper: 'Descargar Artículo de Investigación',
      openNewTab: 'Abrir en Nueva Pestaña'
    },
    
    forwardFill: 'Precio repetido (sin nueva recolección)',
    forwardFillShort: '(Dato Repetido)',
    footerContact: '¿Tiene preguntas o sugerencias? Escríbanos a',
    designCredit: 'Diseño inspirado en Datawrapper',
    weightsTableTitle: 'Desglose de Ponderación de la Canasta (Core-5)',
    weightsTableColCat: 'Categoría',
    weightsTableColRaw: 'Ponderación INE Original',
    weightsTableColNorm: 'Ponderación Normalizada'
  }
};
