/* ==========================================================
   Skycast — Modern Weather Forecast Web App
   Powered by Open-Meteo (no API key required)
   ========================================================== */

const GEO_URL      = "https://geocoding-api.open-meteo.com/v1/search";
const REVERSE_URL  = "https://api.bigdatacloud.net/data/reverse-geocode-client";
const FORECAST_URL = "https://api.open-meteo.com/v1/forecast";

/* -----------------------------------------------------------
   WMO weather-code → Font Awesome icon + description
   ----------------------------------------------------------- */
const WMO = {
    0:  { day: "fa-sun",                  night: "fa-moon",                  desc: "Clear sky",                  main: "Clear" },
    1:  { day: "fa-sun",                  night: "fa-moon",                  desc: "Mainly clear",               main: "Clear" },
    2:  { day: "fa-cloud-sun",            night: "fa-cloud-moon",            desc: "Partly cloudy",              main: "Clouds" },
    3:  { day: "fa-cloud",                night: "fa-cloud",                 desc: "Overcast",                   main: "Clouds" },
    45: { day: "fa-smog",                 night: "fa-smog",                  desc: "Fog",                        main: "Fog" },
    48: { day: "fa-smog",                 night: "fa-smog",                  desc: "Depositing rime fog",        main: "Fog" },
    51: { day: "fa-cloud-rain",           night: "fa-cloud-rain",            desc: "Light drizzle",              main: "Drizzle" },
    53: { day: "fa-cloud-rain",           night: "fa-cloud-rain",            desc: "Moderate drizzle",           main: "Drizzle" },
    55: { day: "fa-cloud-rain",           night: "fa-cloud-rain",            desc: "Dense drizzle",              main: "Drizzle" },
    56: { day: "fa-cloud-showers-heavy",  night: "fa-cloud-showers-heavy",   desc: "Light freezing drizzle",     main: "Drizzle" },
    57: { day: "fa-cloud-showers-heavy",  night: "fa-cloud-showers-heavy",   desc: "Dense freezing drizzle",     main: "Drizzle" },
    61: { day: "fa-cloud-sun-rain",       night: "fa-cloud-moon-rain",       desc: "Slight rain",                main: "Rain" },
    63: { day: "fa-cloud-rain",           night: "fa-cloud-rain",            desc: "Moderate rain",              main: "Rain" },
    65: { day: "fa-cloud-showers-heavy",  night: "fa-cloud-showers-heavy",   desc: "Heavy rain",                 main: "Rain" },
    66: { day: "fa-cloud-showers-heavy",  night: "fa-cloud-showers-heavy",   desc: "Light freezing rain",        main: "Rain" },
    67: { day: "fa-cloud-showers-heavy",  night: "fa-cloud-showers-heavy",   desc: "Heavy freezing rain",        main: "Rain" },
    71: { day: "fa-snowflake",            night: "fa-snowflake",             desc: "Slight snow",                main: "Snow" },
    73: { day: "fa-snowflake",            night: "fa-snowflake",             desc: "Moderate snow",              main: "Snow" },
    75: { day: "fa-snowflake",            night: "fa-snowflake",             desc: "Heavy snow",                 main: "Snow" },
    77: { day: "fa-snowflake",            night: "fa-snowflake",             desc: "Snow grains",                main: "Snow" },
    80: { day: "fa-cloud-sun-rain",       night: "fa-cloud-moon-rain",       desc: "Slight rain showers",        main: "Rain" },
    81: { day: "fa-cloud-rain",           night: "fa-cloud-rain",            desc: "Moderate rain showers",      main: "Rain" },
    82: { day: "fa-cloud-showers-heavy",  night: "fa-cloud-showers-heavy",   desc: "Violent rain showers",       main: "Rain" },
    85: { day: "fa-snowflake",            night: "fa-snowflake",             desc: "Slight snow showers",        main: "Snow" },
    86: { day: "fa-snowflake",            night: "fa-snowflake",             desc: "Heavy snow showers",         main: "Snow" },
    95: { day: "fa-cloud-bolt",           night: "fa-cloud-bolt",            desc: "Thunderstorm",               main: "Thunderstorm" },
    96: { day: "fa-cloud-bolt",           night: "fa-cloud-bolt",            desc: "Thunderstorm w/ slight hail", main: "Thunderstorm" },
    99: { day: "fa-cloud-bolt",           night: "fa-cloud-bolt",            desc: "Thunderstorm w/ heavy hail",  main: "Thunderstorm" },
};

function wmoInfo(code, isDay = true) {
    const entry = WMO[code] || WMO[0];
    return {
        iconClass: isDay ? entry.day : entry.night,
        desc: entry.desc,
        main: entry.main,
    };
}

/* -----------------------------------------------------------
   State
   ----------------------------------------------------------- */
const state = {
    unit: localStorage.getItem("sc_unit") || "metric",
    theme: localStorage.getItem("sc_theme") || "dark",
    recent: JSON.parse(localStorage.getItem("sc_recent") || "[]"),
    lastCity: localStorage.getItem("sc_last") || null,
};

/* -----------------------------------------------------------
   Element refs
   ----------------------------------------------------------- */
const $ = (id) => document.getElementById(id);

const cityInput   = $("cityInput");
const searchBtn   = $("searchBtn");
const voiceBtn    = $("voiceBtn");
const locationBtn = $("locationBtn");
const unitBtn     = $("unitBtn");
const themeBtn    = $("themeBtn");

const welcome   = $("welcome");
const content   = $("content");
const loader    = $("loader");
const errorCard = $("errorCard");

const recentBox  = $("recentBox");
const recentList = $("recentList");
const clearRecent = $("clearRecent");

/* -----------------------------------------------------------
   Init
   ----------------------------------------------------------- */
function init() {
    applyTheme(state.theme);
    applyUnitLabel();
    renderRecent();
    bindEvents();
    spawnParticles();

    if (state.lastCity) {
        fetchByCity(state.lastCity);
    } else {
        showWelcome();
    }
}

document.addEventListener("DOMContentLoaded", init);

/* -----------------------------------------------------------
   Events
   ----------------------------------------------------------- */
function bindEvents() {
    searchBtn.addEventListener("click", onSearch);
    cityInput.addEventListener("keydown", (e) => {
        if (e.key === "Enter") onSearch();
    });
    cityInput.addEventListener("focus", () => {
        if (state.recent.length) recentBox.hidden = false;
    });
    document.addEventListener("click", (e) => {
        if (!e.target.closest(".search-wrap")) recentBox.hidden = true;
    });

    voiceBtn.addEventListener("click", startVoiceSearch);
    locationBtn.addEventListener("click", useMyLocation);
    unitBtn.addEventListener("click", toggleUnit);
    themeBtn.addEventListener("click", toggleTheme);
    clearRecent.addEventListener("click", clearRecentSearches);

    const errorRetryBtn = $("errorRetryBtn");
    if (errorRetryBtn) {
        errorRetryBtn.addEventListener("click", () => {
            showWelcome();
            cityInput.focus();
        });
    }

    document.querySelectorAll(".chip").forEach((chip) => {
        chip.addEventListener("click", () => fetchByCity(chip.dataset.city));
    });
}

/* -----------------------------------------------------------
   Search / fetch flow
   ----------------------------------------------------------- */
function onSearch() {
    const city = cityInput.value.trim();
    if (!city) {
        cityInput.focus();
        return;
    }
    fetchByCity(city);
    cityInput.value = "";
    recentBox.hidden = true;
}

async function fetchByCity(city) {
    showLoader();
    try {
        const geo = await geocode(city);
        const weather = await fetchWeather(geo.latitude, geo.longitude);
        renderAll({
            name: geo.name,
            country: geo.country_code || geo.country || "",
            timezone: weather.timezone,
        }, weather);
        rememberCity(geo.name);
        state.lastCity = geo.name;
        localStorage.setItem("sc_last", geo.name);
    } catch (err) {
        showError(err.title || "City not found", err.message || "Please check the spelling and try again.");
    }
}

async function fetchByCoords(lat, lon) {
    showLoader();
    try {
        const [place, weather] = await Promise.all([
            reverseGeocode(lat, lon),
            fetchWeather(lat, lon),
        ]);
        renderAll({
            name: place.name,
            country: place.country,
            timezone: weather.timezone,
        }, weather);
        rememberCity(place.name);
        state.lastCity = place.name;
        localStorage.setItem("sc_last", place.name);
    } catch (err) {
        showError(err.title || "Unable to load weather", err.message);
    }
}

async function geocode(city) {
    const url = `${GEO_URL}?name=${encodeURIComponent(city)}&count=1&language=en&format=json`;
    const res = await fetch(url);
    if (!res.ok) throw { title: "Network error", message: "Could not reach the geocoding service." };
    const data = await res.json();
    if (!data.results || !data.results.length) {
        throw { title: "City not found", message: `We couldn't find "${city}". Try a different spelling.` };
    }
    return data.results[0];
}

async function reverseGeocode(lat, lon) {
    try {
        const res = await fetch(`${REVERSE_URL}?latitude=${lat}&longitude=${lon}&localityLanguage=en`);
        if (!res.ok) throw new Error();
        const data = await res.json();
        return {
            name: data.city || data.locality || data.principalSubdivision || "Your location",
            country: data.countryCode || "",
        };
    } catch {
        return { name: "Your location", country: "" };
    }
}

async function fetchWeather(lat, lon) {
    const tempUnit = state.unit === "imperial" ? "fahrenheit" : "celsius";
    const windUnit = state.unit === "imperial" ? "mph" : "kmh";

    const params = new URLSearchParams({
        latitude: lat,
        longitude: lon,
        current: "temperature_2m,relative_humidity_2m,apparent_temperature,is_day,weather_code,pressure_msl,wind_speed_10m",
        hourly: "temperature_2m,weather_code,is_day,visibility",
        daily: "weather_code,temperature_2m_max,temperature_2m_min,sunrise,sunset",
        timezone: "auto",
        forecast_days: 6,
        temperature_unit: tempUnit,
        wind_speed_unit: windUnit,
    });

    const res = await fetch(`${FORECAST_URL}?${params}`);
    if (!res.ok) throw { title: "Network error", message: "Could not fetch the forecast." };
    return res.json();
}

/* -----------------------------------------------------------
   Rendering
   ----------------------------------------------------------- */
function renderAll(place, w) {
    renderCurrent(place, w);
    renderForecast(w);
    renderHourly(w);
    const info = wmoInfo(w.current.weather_code, w.current.is_day === 1);
    applyDynamicBackground(info.main, w.current.is_day === 1);
    showContent();
}

function renderCurrent(place, w) {
    const c = w.current;
    const info = wmoInfo(c.weather_code, c.is_day === 1);
    const unitSymbol = state.unit === "metric" ? "°C" : "°F";
    const speedUnit  = state.unit === "metric" ? "km/h" : "mph";

    // visibility from current hour of hourly array
    const nowISO = c.time;
    const hourIdx = w.hourly.time.indexOf(nowISO);
    const visMeters = hourIdx >= 0 ? w.hourly.visibility[hourIdx] : null;

    $("cityName").textContent     = place.name;
    $("countryName").textContent  = place.country || "";
    $("dateText").textContent     = formatDate(new Date(c.time));
    $("tempValue").textContent    = Math.round(c.temperature_2m);
    $("tempUnit").textContent     = unitSymbol;
    $("condition").textContent    = info.desc;
    $("feelsLike").textContent    = `${Math.round(c.apparent_temperature)}${unitSymbol}`;
    $("minMax").textContent       = `${Math.round(w.daily.temperature_2m_min[0])}${unitSymbol} / ${Math.round(w.daily.temperature_2m_max[0])}${unitSymbol}`;

    $("humidity").textContent     = `${c.relative_humidity_2m}%`;
    $("wind").textContent         = `${c.wind_speed_10m.toFixed(1)} ${speedUnit}`;
    $("pressure").textContent     = `${Math.round(c.pressure_msl)} hPa`;
    $("visibility").textContent   = visMeters != null ? `${(visMeters / 1000).toFixed(1)} km` : "—";
    $("sunrise").textContent      = formatTimeISO(w.daily.sunrise[0]);
    $("sunset").textContent       = formatTimeISO(w.daily.sunset[0]);

    const iconEl = $("weatherIcon");
    iconEl.innerHTML = `<i class="fa-solid ${info.iconClass}"></i>`;
    iconEl.setAttribute("aria-label", info.desc);
}

function renderForecast(w) {
    const container = $("forecast");
    container.innerHTML = "";
    const unitSymbol = state.unit === "metric" ? "°C" : "°F";

    // Skip today (index 0), show next 5 days
    for (let i = 1; i <= 5 && i < w.daily.time.length; i++) {
        const dateStr = w.daily.time[i];
        const code = w.daily.weather_code[i];
        const info = wmoInfo(code, true);
        const date = new Date(dateStr);
        const dayName = date.toLocaleDateString(undefined, { weekday: "short" });
        const dateLabel = date.toLocaleDateString(undefined, { day: "numeric", month: "short" });

        const card = document.createElement("div");
        card.className = "forecast-card";
        card.style.animation = `fadeUp 0.4s ease ${(i - 1) * 0.07}s both`;
        card.innerHTML = `
            <div class="day">${dayName}</div>
            <div class="date-sm">${dateLabel}</div>
            <div class="f-icon"><i class="fa-solid ${info.iconClass}"></i></div>
            <div class="f-temp">${Math.round(w.daily.temperature_2m_max[i])}${unitSymbol}</div>
            <div class="f-cond">${info.main}</div>
        `;
        container.appendChild(card);
    }
}

function renderHourly(w) {
    const container = $("hourly");
    container.innerHTML = "";
    const unitSymbol = state.unit === "metric" ? "°C" : "°F";

    const nowISO = w.current.time;
    let startIdx = w.hourly.time.indexOf(nowISO);
    if (startIdx < 0) startIdx = 0;

    const endIdx = Math.min(startIdx + 24, w.hourly.time.length);
    let cardIdx = 0;

    for (let i = startIdx; i < endIdx; i += 3) {
        const t = new Date(w.hourly.time[i]);
        const time = t.toLocaleTimeString(undefined, { hour: "numeric", hour12: true });
        const info = wmoInfo(w.hourly.weather_code[i], w.hourly.is_day[i] === 1);

        const card = document.createElement("div");
        card.className = "hour-card";
        card.style.animation = `fadeUp 0.4s ease ${cardIdx * 0.05}s both`;
        card.innerHTML = `
            <div class="h-time">${time}</div>
            <div class="h-icon"><i class="fa-solid ${info.iconClass}"></i></div>
            <div class="h-temp">${Math.round(w.hourly.temperature_2m[i])}${unitSymbol}</div>
        `;
        container.appendChild(card);
        cardIdx++;
    }
}

/* -----------------------------------------------------------
   Dynamic background
   ----------------------------------------------------------- */
function applyDynamicBackground(condition, isDay) {
    const palettes = {
        Clear:        isDay ? ["#56ccf2", "#2f80ed", "#fcb045"] : ["#0f2027", "#203a43", "#2c5364"],
        Clouds:       isDay ? ["#bdc3c7", "#2c3e50", "#6dd5ed"] : ["#232526", "#414345", "#5d6d7e"],
        Rain:         ["#3a7bd5", "#3a6073", "#000046"],
        Drizzle:      ["#4ca1af", "#2c3e50", "#3a6073"],
        Thunderstorm: ["#141e30", "#243b55", "#000428"],
        Snow:         ["#e6dada", "#a1c4fd", "#c2e9fb"],
        Fog:          ["#757f9a", "#d7dde8", "#bdc3c7"],
    };

    const [c1, c2, c3] = palettes[condition] || palettes.Clear;
    document.documentElement.style.setProperty("--bg-1", c1);
    document.documentElement.style.setProperty("--bg-2", c2);
    document.documentElement.style.setProperty("--bg-3", c3);
}

/* -----------------------------------------------------------
   Geolocation
   ----------------------------------------------------------- */
function useMyLocation() {
    if (!navigator.geolocation) {
        showError("Geolocation unavailable", "Your browser does not support geolocation.");
        return;
    }
    showLoader();
    navigator.geolocation.getCurrentPosition(
        (pos) => fetchByCoords(pos.coords.latitude, pos.coords.longitude),
        (err) => {
            let title = "Location error";
            let msg = "Please search a city manually.";
            if (err.code === 1) {
                title = "Location permission denied";
                msg = "Click the lock icon in your browser's address bar → allow location, or just search a city.";
            } else if (err.code === 2) {
                title = "Location unavailable";
                msg = "Your device couldn't determine its location. Check Windows location settings or search a city manually.";
            } else if (err.code === 3) {
                title = "Location request timed out";
                msg = "Took too long to detect your position. Please try again or search a city.";
            }
            showError(title, msg);
        },
        { enableHighAccuracy: false, timeout: 8000, maximumAge: 300000 }
    );
}

/* -----------------------------------------------------------
   Voice search
   ----------------------------------------------------------- */
function startVoiceSearch() {
    const SpeechRecognition = window.SpeechRecognition || window.webkitSpeechRecognition;
    if (!SpeechRecognition) {
        showError("Voice not supported", "Your browser does not support voice search. Try Chrome or Edge.");
        return;
    }

    const recognition = new SpeechRecognition();
    recognition.lang = "en-US";
    recognition.interimResults = false;
    recognition.maxAlternatives = 1;

    voiceBtn.classList.add("listening");
    cityInput.placeholder = "Listening...";

    recognition.start();

    recognition.onresult = (e) => {
        const transcript = e.results[0][0].transcript.replace(/[.,!?]$/, "");
        cityInput.value = transcript;
        fetchByCity(transcript);
    };

    recognition.onerror = () => {
        showError("Voice error", "Could not recognise your speech. Please try again.");
    };

    recognition.onend = () => {
        voiceBtn.classList.remove("listening");
        cityInput.placeholder = "Search any city in the world...";
    };
}

/* -----------------------------------------------------------
   Unit & theme
   ----------------------------------------------------------- */
function toggleUnit() {
    state.unit = state.unit === "metric" ? "imperial" : "metric";
    localStorage.setItem("sc_unit", state.unit);
    applyUnitLabel();
    if (state.lastCity) fetchByCity(state.lastCity);
}

function applyUnitLabel() {
    const spans = unitBtn.querySelectorAll("span");
    spans.forEach((s) => s.classList.remove("unit-active"));
    if (state.unit === "metric") spans[0].classList.add("unit-active");
    else spans[2].classList.add("unit-active");
}

function toggleTheme() {
    state.theme = state.theme === "dark" ? "light" : "dark";
    applyTheme(state.theme);
    localStorage.setItem("sc_theme", state.theme);
}

function applyTheme(theme) {
    document.body.dataset.theme = theme;
    themeBtn.innerHTML = theme === "dark"
        ? '<i class="fa-solid fa-moon"></i>'
        : '<i class="fa-solid fa-sun"></i>';
}

/* -----------------------------------------------------------
   Recent searches
   ----------------------------------------------------------- */
function rememberCity(name) {
    const existing = state.recent.filter((c) => c.toLowerCase() !== name.toLowerCase());
    state.recent = [name, ...existing].slice(0, 6);
    localStorage.setItem("sc_recent", JSON.stringify(state.recent));
    renderRecent();
}

function renderRecent() {
    recentList.innerHTML = "";
    if (!state.recent.length) {
        recentBox.hidden = true;
        return;
    }
    state.recent.forEach((city) => {
        const li = document.createElement("li");
        li.innerHTML = `<i class="fa-solid fa-location-dot"></i> ${city}`;
        li.addEventListener("click", () => {
            fetchByCity(city);
            recentBox.hidden = true;
        });
        recentList.appendChild(li);
    });
}

function clearRecentSearches() {
    state.recent = [];
    localStorage.removeItem("sc_recent");
    renderRecent();
    recentBox.hidden = true;
}

/* -----------------------------------------------------------
   UI helpers
   ----------------------------------------------------------- */
function showLoader() {
    welcome.hidden = true;
    content.hidden = true;
    errorCard.hidden = true;
    loader.hidden = false;
}

function showContent() {
    loader.hidden = true;
    welcome.hidden = true;
    errorCard.hidden = true;
    content.hidden = false;
}

function showWelcome() {
    loader.hidden = true;
    content.hidden = true;
    errorCard.hidden = true;
    welcome.hidden = false;
}

function showError(title, msg) {
    loader.hidden = true;
    welcome.hidden = true;
    content.hidden = true;
    $("errorTitle").textContent = title;
    $("errorMsg").textContent = msg;
    errorCard.hidden = false;
}

/* -----------------------------------------------------------
   Formatting
   ----------------------------------------------------------- */
function formatDate(date) {
    return date.toLocaleDateString(undefined, {
        weekday: "long", day: "numeric", month: "long", year: "numeric",
    });
}

function formatTimeISO(iso) {
    return new Date(iso).toLocaleTimeString(undefined, { hour: "2-digit", minute: "2-digit" });
}

/* -----------------------------------------------------------
   Floating particles
   ----------------------------------------------------------- */
function spawnParticles() {
    const container = $("particles");
    const count = window.innerWidth < 600 ? 18 : 35;
    for (let i = 0; i < count; i++) {
        const s = document.createElement("span");
        const size = Math.random() * 5 + 2;
        s.style.left = `${Math.random() * 100}%`;
        s.style.width = `${size}px`;
        s.style.height = `${size}px`;
        s.style.animationDuration = `${Math.random() * 15 + 12}s`;
        s.style.animationDelay = `${Math.random() * 10}s`;
        s.style.opacity = Math.random() * 0.6 + 0.2;
        container.appendChild(s);
    }
}
