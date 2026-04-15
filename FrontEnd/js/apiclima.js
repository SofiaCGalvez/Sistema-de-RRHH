// Tijuana coords
const lat = 32.5149;
const lon = -117.0382;

function getWeatherDescription(code) {
  if (code === 0) return "Despejado";
  if ([1, 2, 3].includes(code)) return "Parcialmente nublado";
  if ([45, 48].includes(code)) return "Neblina";
  if ([51, 53, 55, 56, 57].includes(code)) return "Llovizna";
  if ([61, 63, 65, 66, 67, 80, 81, 82].includes(code)) return "Lluvia";
  if ([71, 73, 75, 77, 85, 86].includes(code)) return "Nieve";
  if ([95, 96, 99].includes(code)) return "Tormenta";
  return "Clima actual";
}

function getWeatherIcon(code, isDay) {
  if (code === 0) return isDay ? "ri-sun-line" : "ri-moon-clear-line";
  if ([1, 2, 3].includes(code)) return isDay ? "ri-cloudy-line" : "ri-cloudy-2-line";
  if ([45, 48].includes(code)) return "ri-mist-line";
  if ([51, 53, 55, 56, 57, 61, 63, 65, 66, 67, 80, 81, 82].includes(code)) return "ri-rainy-line";
  if ([71, 73, 75, 77, 85, 86].includes(code)) return "ri-snowy-line";
  if ([95, 96, 99].includes(code)) return "ri-thunderstorms-line";
  return "ri-sun-line";
}

fetch(`https://api.open-meteo.com/v1/forecast?latitude=${lat}&longitude=${lon}&current=temperature_2m,relative_humidity_2m,apparent_temperature,weather_code,wind_speed_10m,is_day&timezone=America%2FTijuana`)
  .then(response => {
    if (!response.ok) {
      throw new Error(`HTTP ${response.status}`);
    }
    return response.json();
  })
  .then(data => {
    const current = data.current;

    document.getElementById("temp").textContent = Math.round(current.temperature_2m);
    document.getElementById("desc").textContent = getWeatherDescription(current.weather_code);
    document.getElementById("feels").textContent = `${Math.round(current.apparent_temperature)}°C`;
    document.getElementById("humidity").textContent = `${current.relative_humidity_2m} %`;
    document.getElementById("wind").textContent = `${Math.round(current.wind_speed_10m)} km/h`;

    const weatherIcon = document.getElementById("weatherIcon");
    const iconClass = getWeatherIcon(current.weather_code, current.is_day === 1);
    weatherIcon.className = `text-3xl text-amber-500 ${iconClass}`;
  })
  .catch(error => {
    console.error("Error al cargar clima:", error);
    document.getElementById("desc").textContent = "No se pudo cargar el clima";
    document.getElementById("temp").textContent = "--";
    document.getElementById("feels").textContent = "--";
    document.getElementById("humidity").textContent = "--";
    document.getElementById("wind").textContent = "--";
  });

// hora actualizada Tijuana
const opciones = {
  timeZone: "America/Tijuana",
  hour: "numeric",
  minute: "numeric",
  hour12: true
};

function actualizarHora() {
  const hora = new Date().toLocaleTimeString("es-MX", opciones);
  const horaElement = document.getElementById("hora");
  if (horaElement) {
    horaElement.textContent = hora;
  }
}

setInterval(actualizarHora, 1000);
actualizarHora();
