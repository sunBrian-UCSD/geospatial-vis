import mapboxgl from 'https://cdn.jsdelivr.net/npm/mapbox-gl@2.15.0/+esm';
import * as d3 from 'https://cdn.jsdelivr.net/npm/d3@7.9.0/+esm';

mapboxgl.accessToken = 'pk.eyJ1IjoiYnJzdW4iLCJhIjoiY21wOTV5aXU2MGVsNzJycHozc3lmMTY5eCJ9.dfPg3KyLFKfmjd0stuYBnA';

let timeFilter = -1;

function formatTime(minutes) {
	const date = new Date(0, 0, 0, 0, minutes);
	return date.toLocaleString('en-US', { timeStyle: 'short' });
}

const map = new mapboxgl.Map({
	container: 'map',
	style: 'mapbox://styles/mapbox/streets-v12',
	center: [-71.09415, 42.36027],
	zoom: 12,
	minZoom: 5,
	maxZoom: 18,
});

const svg = d3.select('#overlay');

function getCoords(station) {
	const point = new mapboxgl.LngLat(+station.lon, +station.lat);
	const { x, y } = map.project(point);
	return { cx: x, cy: y };
}

const timeFilter = document.querySelector('#time-filter');
const timeDisplay = document.querySelector('#time-display');

function formatTime(minutes) {
	const date = new Date(0, 0, 0, 0, minutes);
	return date.toLocaleTimeString('en-US', { hour: '2-digit', minute: '2-digit' });
}

timeFilter.addEventListener('input', () => {
	const value = +timeFilter.value;
	if (value === -1) {
		timeDisplay.innerHTML = '<em>(any time)</em>';
	} else {
		timeDisplay.textContent = formatTime(value);
	}
});

map.on('load', async () => {

	// Boston bike lanes
	map.addSource('boston_route', {
		type: 'geojson',
		data: 'https://bostonopendata-boston.opendata.arcgis.com/datasets/boston::existing-bike-network-2022.geojson',
	});
	map.addLayer({
		id: 'bike-lanes',
		type: 'line',
		source: 'boston_route',
		paint: { 'line-color': 'green', 'line-width': 3, 'line-opacity': 0.4 },
	});

	// Cambridge bike lanes
	map.addSource('cambridge_route', {
		type: 'geojson',
		data: 'https://raw.githubusercontent.com/cambridgegis/cambridgegis_data/main/Recreation/Bike_Facilities/RECREATION_BikeFacilities.geojson',
	});
	map.addLayer({
		id: 'cambridge-bike-lanes',
		type: 'line',
		source: 'cambridge_route',
		paint: { 'line-color': 'green', 'line-width': 3, 'line-opacity': 0.4 },
	});

	// Fetch station data
	let stations = [];
	try {
		let jsonData = await d3.json('https://dsc106.com/labs/lab07/data/bluebikes-stations.json');
		stations = jsonData.data.stations;
		console.log('First station:', stations[0]);
	} catch (error) {
		console.error('Error loading JSON:', error);
	}

	// Fetch trip data
	const trips = await d3.csv('https://dsc106.com/labs/lab07/data/bluebikes-traffic-2024-03.csv');
	console.log('Loaded trips:', trips[0]);

	// Calculate departures and arrivals
	const departures = d3.rollup(
		trips,
		(v) => v.length,
		(d) => d.start_station_id,
	);

	const arrivals = d3.rollup(
		trips,
		(v) => v.length,
		(d) => d.end_station_id,
	);

	// Add traffic properties to each station
	stations = stations.map((station) => {
		let id = station.short_name;
		station.arrivals = arrivals.get(id) ?? 0;
		station.departures = departures.get(id) ?? 0;
		station.totalTraffic = station.arrivals + station.departures;
		return station;
	});
	console.log('Stations with traffic:', stations[0]);

	// Scale radius by total traffic
	const radiusScale = d3
        .scaleSqrt()
		.domain([0, d3.max(stations, (d) => d.totalTraffic)])
		.range([0, 25]);

	// Append circles
	const circles = svg
		.selectAll('circle')
		.data(stations)
		.enter()
		.append('circle')
		.attr('r', (d) => radiusScale(d.totalTraffic))
		.attr('fill', 'steelblue')
		.attr('stroke', 'white')
		.attr('stroke-width', 1)
		.attr('opacity', 0.8)
		.each(function (d) {
			d3.select(this)
				.append('title')
				.text(
					`${d.totalTraffic} trips (${d.departures} departures, ${d.arrivals} arrivals)`,
				);
		});

	function updatePositions() {
		circles
			.attr('cx', (d) => getCoords(d).cx)
			.attr('cy', (d) => getCoords(d).cy);
	}

	updatePositions();

	map.on('move', updatePositions);
	map.on('zoom', updatePositions);
	map.on('resize', updatePositions);
	map.on('moveend', updatePositions);

    const timeSlider = document.getElementById('time-slider');
    const selectedTime = document.getElementById('selected-time');
    const anyTimeLabel = document.getElementById('any-time');

    function updateTimeDisplay() {
	    timeFilter = Number(timeSlider.value);

	    if (timeFilter === -1) {
		    selectedTime.textContent = '';
		    anyTimeLabel.style.display = 'block';
	    } 
        else {
		    selectedTime.textContent = formatTime(timeFilter);
		    anyTimeLabel.style.display = 'none';
	    }
    }

timeSlider.addEventListener('input', updateTimeDisplay);
updateTimeDisplay();
});