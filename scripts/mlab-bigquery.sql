-- Measurement Lab (M-Lab) NDT Public BigQuery Query (License: CC0 1.0 Public Domain)
-- Run free on Google Cloud BigQuery (up to 1 TB/mo free tier) to refresh data/mlab-speeds.json.
-- Export result as JSON and map country_code -> [median_dl_mbps, median_ul_mbps, median_min_rtt_ms].

WITH dl AS (
  SELECT
    client.Geo.CountryCode AS country_code,
    APPROX_QUANTILES(a.MeanThroughputMbps, 100)[OFFSET(50)] AS median_dl_mbps,
    APPROX_QUANTILES(a.MinRTT, 100)[OFFSET(50)] AS median_rtt_ms,
    COUNT(*) AS dl_samples
  FROM `measurement-lab.ndt.unified_downloads`
  WHERE date >= DATE_SUB(CURRENT_DATE(), INTERVAL 90 DAY)
    AND a.MeanThroughputMbps > 1
    AND client.Geo.CountryCode IS NOT NULL
  GROUP BY country_code
  HAVING dl_samples >= 200
),
ul AS (
  SELECT
    client.Geo.CountryCode AS country_code,
    APPROX_QUANTILES(a.MeanThroughputMbps, 100)[OFFSET(50)] AS median_ul_mbps,
    COUNT(*) AS ul_samples
  FROM `measurement-lab.ndt.unified_uploads`
  WHERE date >= DATE_SUB(CURRENT_DATE(), INTERVAL 90 DAY)
    AND a.MeanThroughputMbps > 0.5
    AND client.Geo.CountryCode IS NOT NULL
  GROUP BY country_code
  HAVING ul_samples >= 200
)
SELECT
  dl.country_code,
  ROUND(dl.median_dl_mbps, 0) AS dl_mbps,
  ROUND(COALESCE(ul.median_ul_mbps, dl.median_dl_mbps * 0.55), 0) AS ul_mbps,
  ROUND(dl.median_rtt_ms, 0) AS latency_ms
FROM dl
LEFT JOIN ul USING (country_code)
ORDER BY dl_mbps DESC;
