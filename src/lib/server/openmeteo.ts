import "server-only";
import { addDays, daysBetween, todayIST } from "@/lib/logic/dates";
import type { TripWindow } from "@/lib/logic/types";
import type { StoredWeather } from "@/lib/pipelineTypes";
import { fetchJson } from "./http";

type Daily = {
  daily?: {
    time: string[];
    temperature_2m_max: (number | null)[];
    temperature_2m_min: (number | null)[];
    precipitation_sum: (number | null)[];
  };
};

const FORECAST_DAYS = 16;

function minusOneYear(iso: string): string {
  const [y, m, d] = iso.split("-").map(Number);
  const day = m === 2 && d === 29 ? 28 : d;
  return `${y - 1}-${String(m).padStart(2, "0")}-${String(day).padStart(2, "0")}`;
}

const avg = (xs: (number | null)[]) => {
  const v = xs.filter((x): x is number => typeof x === "number");
  return v.length ? Math.round((v.reduce((a, b) => a + b, 0) / v.length) * 10) / 10 : null;
};

/**
 * Weather for the trip window. Within the 16-day forecast horizon use the
 * forecast; otherwise the same dates last year from the archive, labelled
 * "Typical weather (last year)".
 */
export async function getWeather(lat: number, lon: number, window: TripWindow): Promise<StoredWeather> {
  const today = todayIST();
  const lastDay = addDays(window.end, 0);
  const useForecast = daysBetween(today, lastDay) < FORECAST_DAYS;

  const from = useForecast ? window.start : minusOneYear(window.start);
  const to = useForecast ? lastDay : minusOneYear(lastDay);
  const url = new URL(
    useForecast ? "https://api.open-meteo.com/v1/forecast" : "https://archive-api.open-meteo.com/v1/archive",
  );
  url.searchParams.set("latitude", lat.toFixed(4));
  url.searchParams.set("longitude", lon.toFixed(4));
  url.searchParams.set("start_date", from);
  url.searchParams.set("end_date", to);
  url.searchParams.set("daily", "temperature_2m_max,temperature_2m_min,precipitation_sum");
  url.searchParams.set("timezone", "auto");

  const json = await fetchJson<Daily>(url, { timeoutMs: 12_000 });
  const d = json.daily;
  const precip = d?.precipitation_sum.filter((x): x is number => typeof x === "number") ?? [];
  return {
    kind: useForecast ? "forecast" : "last_year",
    label: useForecast ? "Forecast" : "Typical weather (last year)",
    from,
    to,
    avgMinC: d ? avg(d.temperature_2m_min) : null,
    avgMaxC: d ? avg(d.temperature_2m_max) : null,
    precipitationMm: precip.length ? Math.round(precip.reduce((a, b) => a + b, 0)) : null,
  };
}
