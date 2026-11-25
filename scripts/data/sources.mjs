// Indicator codes and source metadata (rendered on the /data-sources/ page).
export const WDI = {
  'PA.NUS.PRVT.PP': 'pppPrivate', 'PA.NUS.FCRF': 'fx', 'NY.GDP.PCAP.PP.CD': 'gdpPcPpp', 'IT.NET.USER.ZS': 'internetUsers',
  'IT.NET.BBND.P2': 'broadband', 'VC.IHR.PSRC.P5': 'homicide', 'EN.ATM.PM25.MC.M3': 'pm25', 'SP.DYN.LE00.IN': 'lifeExp',
  'SH.XPD.CHEX.PP.CD': 'healthExp', 'SH.MED.PHYS.ZS': 'physicians', 'FP.CPI.TOTL.ZG': 'inflation', 'SP.POP.TOTL': 'population',
  'EG.ELC.ACCS.ZS': 'electricity', 'IT.CEL.SETS.P2': 'mobileSubs', 'NY.GDP.DEFL.KD.ZG': 'deflator',
};
export const WGI = { 'GOV_WGI_PV.SC': 'stability', 'GOV_WGI_RL.SC': 'ruleOfLaw', 'GOV_WGI_CC.SC': 'corruption', 'GOV_WGI_GE.SC': 'govEffect' };
export const ICP = {
  '9020000': 'aic', '1101000': 'food', '9060000': 'housing', '1111000': 'restaurants', '1107300': 'transport',
  '1108000': 'communication', '9080000': 'health', '9110000': 'recreation', '9140000': 'misc', '1103000': 'clothing',
};

export const SOURCES = [
  {
    id: 'wdi', name: 'World Development Indicators', publisher: 'World Bank', license: 'CC BY 4.0', licenseUrl: 'https://creativecommons.org/licenses/by/4.0/',
    url: 'https://datacatalog.worldbank.org/search/dataset/0037712/World-Development-Indicators',
    use: 'Price levels (PPP conversion factor for private consumption and official exchange rate), GDP per capita (PPP), internet users, fixed broadband subscriptions, intentional homicides, PM2.5 exposure, life expectancy, health expenditure, physicians, inflation, population, access to electricity and mobile subscriptions.',
    attribution: 'The World Bank: World Development Indicators (CC BY 4.0).',
  },
  {
    id: 'icp', name: 'International Comparison Program (ICP) 2021', publisher: 'World Bank', license: 'CC BY 4.0', licenseUrl: 'https://creativecommons.org/licenses/by/4.0/',
    url: 'https://www.worldbank.org/en/programs/icp',
    use: 'Price level indices for housing and utilities, food, restaurants and hotels, transport services, communication, health, recreation and other spending categories. We use them to price each spending category separately.',
    attribution: 'The World Bank: International Comparison Program 2021 (CC BY 4.0).',
  },
  {
    id: 'wgi', name: 'Worldwide Governance Indicators', publisher: 'World Bank', license: 'CC BY 4.0', licenseUrl: 'https://creativecommons.org/licenses/by/4.0/',
    url: 'https://www.worldbank.org/en/publication/worldwide-governance-indicators',
    use: 'Political stability and absence of violence, rule of law, control of corruption and government effectiveness (0 to 100 scores).',
    attribution: 'The World Bank: Worldwide Governance Indicators (CC BY 4.0).',
  },
  {
    id: 'passport', name: 'Passport Index Data', publisher: 'imorte/passport-index-data on GitHub', license: 'MIT', licenseUrl: 'https://github.com/imorte/passport-index-data/blob/main/LICENSE',
    url: 'https://github.com/imorte/passport-index-data',
    use: 'Visa requirements for 199 passports to 199 destinations: visa-free stays with day limits, visa on arrival, electronic travel authorisations, e-visas and visas required.',
    attribution: 'Passport Index Data by imorte, MIT License.',
  },
  {
    id: 'geonames', name: 'GeoNames geographical database', publisher: 'GeoNames', license: 'CC BY 4.0', licenseUrl: 'https://creativecommons.org/licenses/by/4.0/',
    url: 'https://www.geonames.org/',
    use: 'City coordinates, population, elevation and IANA time zone; country capitals, currencies, calling codes, areas and land neighbours.',
    attribution: 'Contains data from GeoNames.org (CC BY 4.0).',
  },
  {
    id: 'nasa', name: 'NASA POWER climatology (MERRA-2, 2001 to 2025)', publisher: 'NASA Langley Research Center', license: 'Public, free and open (NASA Earth science data policy)', licenseUrl: 'https://www.earthdata.nasa.gov/engage/open-data-services-software-policies/data-use-guidance',
    url: 'https://power.larc.nasa.gov/',
    use: 'Monthly average, maximum and minimum temperature, precipitation, relative humidity, cloud cover and solar radiation for every city.',
    attribution: 'These data were obtained from the NASA Langley Research Center (LaRC) POWER Project funded through the NASA Earth Science/Applied Science Program.',
  },
  {
    id: 'mlab', name: 'M-Lab NDT statistics', publisher: 'Measurement Lab', license: 'CC0 1.0', licenseUrl: 'https://creativecommons.org/publicdomain/zero/1.0/',
    url: 'https://www.measurementlab.net/data/',
    use: 'Median measured download speed, upload speed and latency per country (daily medians, January to March 2024, the most recent period the public statistics API provides).',
    attribution: 'Measurement Lab (M-Lab) NDT data, CC0.',
  },
  {
    id: 'naturalearth', name: 'Natural Earth 1:50m Admin 0 countries', publisher: 'Natural Earth', license: 'Public domain', licenseUrl: 'https://www.naturalearthdata.com/about/terms-of-use/',
    url: 'https://www.naturalearthdata.com/',
    use: 'Country shapes for the interactive world maps (projected to Equal Earth and simplified).',
    attribution: 'Made with Natural Earth. Free vector and raster map data @ naturalearthdata.com.',
  },
  {
    id: 'wikidata', name: 'Wikidata', publisher: 'Wikimedia Foundation', license: 'CC0 1.0', licenseUrl: 'https://creativecommons.org/publicdomain/zero/1.0/',
    url: 'https://www.wikidata.org/',
    use: 'Electrical plug types, mains voltage and driving side for each country.',
    attribution: 'Wikidata (CC0).',
  },
  {
    id: 'ecb', name: 'Euro foreign exchange reference rates', publisher: 'European Central Bank', license: 'Free reuse with source acknowledgement', licenseUrl: 'https://www.ecb.europa.eu/home/disclaimer/html/index.en.html',
    url: 'https://www.ecb.europa.eu/stats/policy_and_exchange_rates/euro_reference_exchange_rates/html/index.en.html',
    use: 'Currency conversion for budgets entered in a currency other than US dollars.',
    attribution: 'Source: European Central Bank.',
  },
  {
    id: 'desnz', name: 'Greenhouse gas reporting: conversion factors 2026', publisher: 'UK Department for Energy Security and Net Zero', license: 'Open Government Licence v3.0', licenseUrl: 'https://www.nationalarchives.gov.uk/doc/open-government-licence/version/3/',
    url: 'https://www.gov.uk/government/publications/greenhouse-gas-reporting-conversion-factors-2026',
    use: 'Emission factors per passenger-kilometre for short-haul and long-haul flights, used for flight distance and carbon estimates.',
    attribution: 'Contains public sector information licensed under the Open Government Licence v3.0.',
  },
  {
    id: 'iana', name: 'IANA Time Zone Database', publisher: 'IANA', license: 'Public domain', licenseUrl: 'https://www.iana.org/time-zones',
    url: 'https://www.iana.org/time-zones',
    use: 'Time zone rules and daylight saving transitions, read through your browser’s built-in Intl API.',
    attribution: 'IANA tz database (public domain).',
  },
];
