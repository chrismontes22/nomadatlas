import { US_BASELINE_MONTHLY, CURRENCIES } from './cities.js';

export const LIFESTYLE_MULT = {
  lean: 0.72,
  comfortable: 1.0,
  upscale: 1.48
};

export const HOUSING_MULT = {
  coliving: 0.88,
  studio: 1.0,
  onebr: 1.18
};

export const PRESETS = {
  balanced: {
    label: 'Balanced',
    desc: 'A well-rounded mix of cost, fast Wi-Fi, pleasant weather, safety, and work-hour overlap.',
    weights: { cost: 25, internet: 22, climate: 18, stability: 20, timezone: 15 }
  },
  founder: {
    label: 'Save Money',
    desc: 'Prioritizes low monthly costs and strong internet so your savings stretch further.',
    weights: { cost: 38, internet: 28, climate: 10, stability: 12, timezone: 12 }
  },
  engineer: {
    label: 'Live Team Calls',
    desc: 'Focuses on fast, low-delay broadband and generous work-hour overlap with your team.',
    weights: { cost: 16, internet: 30, climate: 12, stability: 16, timezone: 26 }
  },
  sunseeker: {
    label: 'Great Weather',
    desc: 'Highlights warm, comfortable, low-rain climates near your ideal temperature.',
    weights: { cost: 20, internet: 16, climate: 36, stability: 18, timezone: 10 }
  },
  family: {
    label: 'Safe & Calm',
    desc: 'Emphasizes stability, rule of law, healthcare quality, and clean air.',
    weights: { cost: 18, internet: 16, climate: 18, stability: 38, timezone: 10 }
  }
};

export { MAP_WIDTH, MAP_HEIGHT, GLOBE_OUTLINE, GRATICULES, WORLD_COUNTRIES, projectNaturalEarth } from './world-map.js';

/**
 * Plain-English descriptors so users immediately understand what numbers mean in daily life.
 */
export function describeInternet(city) {
  if (city.dlMbps >= 180 && city.latencyMs <= 20) return 'Ultra-fast fiber · Great for 4K calls & large uploads';
  if (city.dlMbps >= 110 && city.latencyMs <= 28) return 'Fast & reliable · Smooth video meetings';
  if (city.dlMbps >= 65) return 'Good for remote work · Reliable HD calls';
  return 'Moderate speeds · Check fiber at your stay';
}

export function describeClimate(tempC, rainMm) {
  let feel = 'Mild & pleasant';
  if (tempC >= 27) feel = 'Hot & tropical';
  else if (tempC >= 21) feel = 'Warm & sunny';
  else if (tempC >= 15) feel = 'Mild & comfortable';
  else if (tempC >= 8) feel = 'Cool & crisp';
  else feel = 'Cold winter air';

  if (rainMm >= 210) return `${feel} · Rainy season`;
  if (rainMm >= 120) return `${feel} · Frequent showers`;
  if (rainMm <= 35) return `${feel} · Dry skies`;
  return feel;
}

export function describeSafety(stabilityScore) {
  if (stabilityScore >= 80) return 'Very safe & stable';
  if (stabilityScore >= 65) return 'Safe & well-run';
  if (stabilityScore >= 50) return 'Generally comfortable';
  return 'Pick central neighborhoods';
}

export function describeFit(score) {
  if (score >= 76) return 'Top Match';
  if (score >= 66) return 'Great Fit';
  if (score >= 56) return 'Good Fit';
  return 'Niche Fit';
}

/**
 * Estimate monthly living cost in USD using World Bank ICP PPP Price Level Ratio
 * and transparent city urban-tier adjustment.
 */
export function estimateMonthlyCost(city, lifestyle = 'comfortable', housing = 'studio') {
  const lMult = LIFESTYLE_MULT[lifestyle] ?? 1.0;
  const hMult = HOUSING_MULT[housing] ?? 1.0;
  const base = US_BASELINE_MONTHLY * city.pppRatio * city.urbanCostFactor * lMult;

  const housingCost = Math.round(base * 0.45 * hMult);
  const foodCost = Math.round(base * 0.21);
  const coworkingCost = Math.round(base * 0.08);
  const transitCost = Math.round(base * 0.06);
  const healthCost = Math.round(base * 0.09);
  const miscCost = Math.round(base * 0.11);

  return {
    total: housingCost + foodCost + coworkingCost + transitCost + healthCost + miscCost,
    breakdown: {
      housing: housingCost,
      food: foodCost,
      coworking: coworkingCost,
      transit: transitCost,
      health: healthCost,
      misc: miscCost
    }
  };
}

/**
 * Compute overlapping working hours between a city's local work window
 * and a remote team's core work window (in UTC offsets).
 */
export function computeTimezoneOverlap(cityUtc, teamUtc, localStart = 9, localEnd = 18, teamStart = 9, teamEnd = 17) {
  const cStart = localStart - cityUtc;
  const cEnd = localEnd - cityUtc;
  const tStart = teamStart - teamUtc;
  const tEnd = teamEnd - teamUtc;

  let overlap = 0;
  let winStartUtc = null;
  let winEndUtc = null;

  for (const shift of [-24, 0, 24]) {
    const s = Math.max(cStart, tStart + shift);
    const e = Math.min(cEnd, tEnd + shift);
    if (e > s) {
      overlap += e - s;
      if (winStartUtc === null || (e - s) > (winEndUtc - winStartUtc)) {
        winStartUtc = s;
        winEndUtc = e;
      }
    }
  }

  const normHour = (h) => ((h % 24) + 24) % 24;
  const fmt12 = (h) => {
    const n = Math.floor(normHour(h));
    const suffix = n >= 12 ? 'PM' : 'AM';
    const hr = n % 12 === 0 ? 12 : n % 12;
    return `${hr} ${suffix}`;
  };

  let tier = 'Mostly Async';
  let plainNote = 'Best for independent work with recorded updates.';
  if (overlap >= 5) {
    tier = 'Easy Live Calls';
    plainNote = 'Plenty of shared daytime hours for live meetings.';
  } else if (overlap >= 3) {
    tier = 'Part-Day Sync';
    plainNote = 'Great balance: quiet focus time plus a few shared call hours.';
  }

  return {
    hours: Math.round(overlap * 10) / 10,
    tier,
    plainNote,
    localWindow: winStartUtc !== null ? `${fmt12(winStartUtc + cityUtc)}–${fmt12(winEndUtc + cityUtc)} local` : 'No direct 9–5 overlap',
    teamWindow: winStartUtc !== null ? `${fmt12(winStartUtc + teamUtc)}–${fmt12(winEndUtc + teamUtc)} HQ` : 'Async handoff',
    utcDiff: cityUtc - teamUtc
  };
}

/**
 * Compute climate comfort score (0–100) from NASA POWER monthly climatology.
 */
export function computeClimateScore(city, monthIndex = -1, idealTemp = 22) {
  const scoreMonth = (temp, rain, sun) => {
    const tempDiff = Math.abs(temp - idealTemp);
    const tempScore = Math.max(15, 100 - Math.pow(tempDiff, 1.24) * 2.35);
    const rainPenalty = Math.max(0, (rain - 70) * 0.14);
    const sunBonus = Math.min(10, Math.max(-6, (sun - 5.5) * 2.0));
    return Math.max(18, Math.min(100, tempScore - rainPenalty + sunBonus));
  };

  if (monthIndex >= 0) {
    const temp = city.tempC[monthIndex];
    const rain = city.rainMm[monthIndex];
    const sun = city.sunHrs[monthIndex];
    return {
      score: Math.round(scoreMonth(temp, rain, sun)),
      tempC: Math.round(temp * 10) / 10,
      rainMm: Math.round(rain),
      sunHrs: Math.round(sun * 10) / 10,
      summary: describeClimate(temp, rain)
    };
  }

  const avg = (arr) => arr.reduce((a, b) => a + b, 0) / arr.length;
  const monthlyScores = city.tempC.map((t, i) => scoreMonth(t, city.rainMm[i], city.sunHrs[i]));
  const avgT = Math.round(avg(city.tempC) * 10) / 10;
  const avgR = Math.round(avg(city.rainMm));
  return {
    score: Math.round(avg(monthlyScores)),
    tempC: avgT,
    rainMm: avgR,
    sunHrs: Math.round(avg(city.sunHrs) * 10) / 10,
    summary: describeClimate(avgT, avgR)
  };
}

/**
 * Score a single city across all 5 dimensions (0–100 each) + composite weighted match score.
 */
export function scoreCity(city, config) {
  const {
    monthlyIncomeUsd = 5500,
    lifestyle = 'comfortable',
    housing = 'studio',
    monthIndex = -1,
    idealTemp = 22,
    teamUtc = -5,
    localStart = 9,
    localEnd = 18,
    weights = PRESETS.balanced.weights
  } = config;

  const costData = estimateMonthlyCost(city, lifestyle, housing);
  const monthlyCost = costData.total;
  const monthlySavings = monthlyIncomeUsd - monthlyCost;
  const savingsRate = monthlyIncomeUsd > 0 ? Math.round((monthlySavings / monthlyIncomeUsd) * 100) : 0;

  const rawCostScore = Math.max(12, Math.min(100, 114 - (monthlyCost / 44)));
  const budgetBonus = monthlyCost <= monthlyIncomeUsd * 0.45 ? 6 : monthlyCost > monthlyIncomeUsd ? -16 : 0;
  const costScore = Math.max(8, Math.min(100, Math.round(rawCostScore + budgetBonus)));

  const dlScore = Math.min(100, (city.dlMbps / 220) * 100);
  const ulScore = Math.min(100, (city.ulMbps / 140) * 100);
  const latScore = Math.max(15, Math.min(100, 118 - city.latencyMs * 2.2));
  const internetScore = Math.round(dlScore * 0.48 + ulScore * 0.30 + latScore * 0.22);

  const climate = computeClimateScore(city, monthIndex, idealTemp);

  const airScore = Math.max(15, Math.min(100, 112 - city.pm25 * 2.5));
  const stabilityScore = Math.round(city.wgiStability * 0.42 + city.wgiRuleOfLaw * 0.40 + airScore * 0.18);

  const effectiveUtc = (monthIndex >= 3 && monthIndex <= 9 && city.observesDst) ? city.utcDst : city.utcStd;
  const tz = computeTimezoneOverlap(effectiveUtc, teamUtc, localStart, localEnd, 9, 17);
  const tzScore = Math.max(24, Math.min(100, Math.round(24 + (tz.hours / 8) * 76)));

  const totalW = (weights.cost + weights.internet + weights.climate + weights.stability + weights.timezone) || 1;
  const composite = Math.round(
    (costScore * weights.cost +
      internetScore * weights.internet +
      climate.score * weights.climate +
      stabilityScore * weights.stability +
      tzScore * weights.timezone) / totalW
  );

  return {
    city,
    composite,
    fitLabel: describeFit(composite),
    scores: {
      cost: costScore,
      internet: internetScore,
      climate: climate.score,
      stability: stabilityScore,
      timezone: tzScore
    },
    monthlyCost,
    breakdown: costData.breakdown,
    monthlySavings,
    savingsRate,
    climate,
    tz,
    internetVerdict: describeInternet(city),
    safetyVerdict: describeSafety(stabilityScore)
  };
}

export function formatMoney(usdAmount, currencyCode = 'USD') {
  const cur = CURRENCIES[currencyCode] || CURRENCIES.USD;
  const converted = Math.round(usdAmount * cur.rate);
  const absStr = Math.abs(converted).toLocaleString('en-US');
  return converted < 0 ? `-${cur.symbol}${absStr}` : `${cur.symbol}${absStr}`;
}

export function projectGeoArbitrage(monthlyIncomeUsd, targetMonthlyCostUsd, annualInflationPct, annualReturnPct = 7, years = 5) {
  let balance = 0;
  let currentCost = targetMonthlyCostUsd;
  const yearly = [];

  for (let y = 1; y <= years; y++) {
    const annualContribution = Math.max(0, (monthlyIncomeUsd - currentCost) * 12);
    balance = (balance + annualContribution) * (1 + annualReturnPct / 100);
    yearly.push({
      year: y,
      monthlyCost: Math.round(currentCost),
      annualSaved: Math.round(annualContribution),
      portfolio: Math.round(balance)
    });
    const effectiveUsdInflation = Math.min(18, Math.max(1, annualInflationPct * 0.55 + 1.2));
    currentCost *= (1 + effectiveUsdInflation / 100);
  }

  return {
    finalPortfolio: Math.round(balance),
    yearly
  };
}
