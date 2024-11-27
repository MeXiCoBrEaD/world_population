let populationData;
countryCoordinates = {};

// Initialize the map
const map = L.map("map", {
  center: [20, 0], // Centered at latitude 20, longitude 0
  zoom: 2,
  maxBounds: [
    [-90, -180], // Southwest coordinates
    [90, 180], // Northeast coordinates
  ],
  maxBoundsViscosity: 1.0, // Ensures the map stays within bounds
  maxZoom: 10, // Maximum zoom level
  minZoom: 2, // Minimum zoom level
});

// Add OpenStreetMap tiles
L.tileLayer("https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png", {
  attribution: "© OpenStreetMap contributors",
}).addTo(map);

async function loadDataAndInitialize() {
  try {
    const [coordsData, popData] = await Promise.all([
      d3.csv("data/coordinates.csv"),
      d3.csv("data/world_population.csv"),
    ]);

    // Process coordinates data
    coordsData.forEach((row) => {
      const country = row["name"];
      const lat = parseFloat(row["latitude"]);
      const lon = parseFloat(row["longitude"]);
      countryCoordinates[country] = { lat, lon };
    });

    populationData = popData;

    console.log(populationData);

    renderElements(populationData);
  } catch (error) {
    console.error("Error loading data:", error);
  }
}

loadDataAndInitialize();

function renderElements(populationData) {
  // Extract available years dynamically from population data
  const years = extractYears(populationData);

  // Extract available regions dynamically from population data
  const region = extractRegion(populationData);

  // Populate the dropdown with years
  populateDropdown(years);

  // Populate the dropdown with region
  populateRegion(region);

  const defaultYear = document.getElementById("yearDropdown").value;
  const defaultRegion = document.getElementById("regionDropdown").value;

  updateMapWithData(
    populationData,
    defaultYear,
    countryCoordinates,
    defaultRegion
  );
}

// Function to extract years dynamically from population data
function extractYears(populationData) {
  const years = [];
  const firstRow = populationData[0]; // Assuming all rows have the same structure

  // Loop through the columns to extract years (skip non-year columns)
  Object.keys(firstRow).forEach((key) => {
    if (key.endsWith("Population")) {
      // Extract the year from the column name (e.g., "2022 Population")
      const year = key.split(" ")[0];
      if (!years.includes(year)) {
        years.push(year);
      }
    }
  });

  return years;
}

// Function to extract region dynamically from population data
function extractRegion(populationData) {
  const region = [];

  populationData.forEach((row) => {
    if (!region.includes(row["Continent"])) {
      region.push(row["Continent"]);
    }
  });
  return region;
}

// Function to populate the dropdown with year options
function populateDropdown(years) {
  const dropdown = document.getElementById("yearDropdown");

  // Clear any existing options
  dropdown.innerHTML = "";

  // Add a default All option
  const allOption = document.createElement("option");
  allOption.value = "All";
  allOption.text = "All";
  dropdown.appendChild(allOption);

  // Add the year options to the dropdown
  years.forEach((year) => {
    const option = document.createElement("option");
    option.value = year;
    option.text = year;
    dropdown.appendChild(option);
  });
}

function populateRegion(region) {
  const dropdown = document.getElementById("regionDropdown");

  dropdown.innerHTML = "";

  // Add a default All option
  const allOption = document.createElement("option");
  allOption.value = "All";
  allOption.text = "All";
  dropdown.appendChild(allOption);

  region.forEach((region) => {
    const option = document.createElement("option");
    option.value = region;
    option.text = region;
    dropdown.appendChild(option);
  });
}

// Function to update the map with population data for the selected year
function updateMapWithData(populationData, year, countryCoordinates, region) {
  // Clear existing markers
  map.eachLayer((layer) => {
    if (layer instanceof L.CircleMarker) {
      map.removeLayer(layer);
    }
  });

  // Filter data by selected year and add markers to the map
  populationData.forEach((row) => {
    const country = row["Country/Territory"];
    const coords = countryCoordinates[country];
    const countryRegion = row["Continent"];

    if (coords && (region === "All" || countryRegion === region)) {
      let totalPopulation = 0;
      let currentPopulation = 0;
      let circleSize = 0;
      let tooltipContent = `<strong>${country}</strong><br>`;

      if (year === "All") {
        circleSize = 5000;
        let latestYear = 0;
        Object.keys(row).forEach((key) => {
          if (key.endsWith("Population")) {
            const year = parseInt(key.split(" ")[0], 10);
            const population = parseInt(row[key], 10);
            totalPopulation += population;
            tooltipContent += `Year ${year}: ${population.toLocaleString()}<br>`;
            if (year > latestYear) {
              latestYear = year;
              currentPopulation = population;
            }
          }
        });
      } else {
        circleSize = 3000;
        const population = parseInt(row[`${year} Population`], 10);
        totalPopulation = population;
        currentPopulation = population;
        tooltipContent += `Population: ${population.toLocaleString()}<br>Year: ${year}`;
      }

      let color;
      if (currentPopulation < 100000000) {
        color = "green";
      } else if (currentPopulation < 1000000000) {
        color = "orange";
      } else {
        color = "red";
      }

      const marker = L.circleMarker([coords.lat, coords.lon], {
        radius: Math.sqrt(totalPopulation) / circleSize, // Scale circle size based on population
        color: color,
        fillOpacity: 0.5,
      }).addTo(map);

      marker.bindTooltip(tooltipContent, {
        permanent: false,
        direction: "top",
      });

      // Add click event handler
      marker.on("click", function () {
        // Get population data for the selected country
        const countryData = row; // 'row' contains the data for the country

        // Prepare data for the graph
        const populationTrend = [];
        Object.keys(countryData).forEach((key) => {
          if (key.endsWith("Population")) {
            const year = key.split(" ")[0];
            const population = parseInt(countryData[key], 10);
            if (population) {
              populationTrend.push({ year: +year, population });
            }
          }
        });

        // Sort the data by year
        populationTrend.sort((a, b) => a.year - b.year);

        // Draw the graph
        drawPopulationGraph(populationTrend, country);
      });
    }
  });
}

// Function to draw the population graph
function drawPopulationGraph(data, countryName) {
  // Clear any existing content in the graph div
  d3.select("#graph").html("");

  // Set the dimensions and margins of the graph
  const margin = { top: 100, right: 30, bottom: 70, left: 120 }; // Adjust left margin

  (width =
    parseInt(d3.select("#graph").style("width")) - margin.left - margin.right),
    (height =
      parseInt(d3.select("#graph").style("height")) -
      margin.top -
      margin.bottom);

  // Append the SVG object to the graph div
  const svg = d3
    .select("#graph")
    .append("svg")
    .attr("width", "100%")
    .attr("height", "100%")
    .append("g")
    .attr("transform", `translate(${margin.left},${margin.top})`);

  // Define the tooltip
  const tooltip = d3
    .select("#graph")
    .append("div")
    .attr("class", "tooltip")
    .style("position", "absolute")
    .style("background-color", "#0d0d0d")
    .style("border-radius", "5px")
    .style("padding", "10px")
    .style("visibility", "hidden")
    .style("color", "#f2f2f2")
    .style("font-family", "Inter, sans-serif")
    .style("font-size", "12px");

  // X axis: scale and draw
  const x = d3
    .scaleLinear()
    .domain([d3.min(data, (d) => d.year), d3.max(data, (d) => d.year) + 3])
    .range([0, width]);
  svg
    .append("g")
    .attr("transform", `translate(0, ${height})`)
    .call(
      d3.axisBottom(x).tickFormat(d3.format("d")) // Format ticks as integers
    )
    .style("font-size", "12px");

  // Y axis: scale and draw
  const y = d3
    .scaleLinear()
    .domain([0, d3.max(data, (d) => d.population)])
    .range([height, 0]);

  const yAxis = d3.axisLeft(y).ticks(5);

  svg.append("g").call(yAxis).style("font-size", "12px");

  // Add the line
  svg
    .append("path")
    .datum(data)
    .attr("fill", "none")
    .attr("stroke", "white")
    .attr("stroke-width", 2.5)
    .attr(
      "d",
      d3
        .line()
        .x((d) => x(d.year))
        .y((d) => y(d.population))
    );

  // Add title
  svg
    .append("text")
    .attr("x", width / 2)
    .attr("y", -10 - margin.top / 2)
    .attr("text-anchor", "middle")
    .style("font-size", "18px")
    .style("fill", "#ffffff")
    .text(`Population Trend for ${countryName}`);

  // X axis label
  svg
    .append("text")
    .attr("x", width / 2)
    .attr("y", height + margin.bottom - 10)
    .attr("text-anchor", "middle")
    .style("font-size", "14px")
    .style("fill", "#ffffff")
    .text("Year");

  // Y axis label
  svg
    .append("text")
    .attr("transform", "rotate(-90)")
    .attr("y", -margin.left + 20) // Increase the offset
    .attr("x", -height / 2)
    .attr("text-anchor", "middle")
    .style("font-size", "14px")
    .style("fill", "#ffffff")
    .text("Population");

  // Add X gridlines
  svg
    .append("g")
    .attr("class", "grid")
    .attr("transform", `translate(0, ${height})`)
    .call(
      d3.axisBottom(x).tickSize(-height).tickFormat("") // Hide tick labels
    );

  // Add Y gridlines
  svg.append("g").attr("class", "grid").call(
    d3.axisLeft(y).tickSize(-width).tickFormat("") // Hide tick labels
  );

  // Add gridline styling
  d3.selectAll(".grid line")
    .style("stroke", "#ccc")
    .style("stroke-dasharray", "2,2");

  // Optional: Add circle markers
  svg
    .selectAll("circle")
    .data(data)
    .enter()
    .append("circle")
    .attr("cx", (d) => x(d.year))
    .attr("cy", (d) => y(d.population))
    .attr("r", 4)
    .attr("fill", "white")
    .on("mouseover", function (event, d) {
      tooltip
        .style("visibility", "visible")
        .text(`Year: ${d.year}, Population: ${d3.format(",")(d.population)}`);
      d3.select(this).attr("r", 8); // Highlight circle
    })
    .on("mousemove", function (event) {
      const [mouseX, mouseY] = d3.pointer(event);

      tooltip
        .style("left", `${mouseX + 45}px`)
        .style("top", `${mouseY + 45}px`);
    })
    .on("mouseout", function () {
      tooltip.style("visibility", "hidden");
      d3.select(this).attr("r", 4).attr("fill", "white"); // Reset circle
    });
}

// Handle year change when dropdown is updated
document.getElementById("yearDropdown").addEventListener("change", (event) => {
  const selectedYear = event.target.value;
  const defaultRegion = document.getElementById("regionDropdown").value;

  updateMapWithData(
    populationData,
    selectedYear,
    countryCoordinates,
    defaultRegion
  );
});

document
  .getElementById("regionDropdown")
  .addEventListener("change", (event) => {
    const selectedRegion = event.target.value;
    const defaultYear = document.getElementById("yearDropdown").value;

    updateMapWithData(
      populationData,
      defaultYear,
      countryCoordinates,
      selectedRegion
    );
  });

// Add event listener for the reset button
document.getElementById("resetButton").addEventListener("click", function () {
  // Reset dropdowns to the first index
  document.getElementById("yearDropdown").selectedIndex = 0;
  document.getElementById("regionDropdown").selectedIndex = 0;

  const defaultYear = document.getElementById("yearDropdown").value;
  const defaultRegion = document.getElementById("regionDropdown").value;

  // Clear the population graph
  d3.select("#graph").html("");

  // Update the map with default data
  updateMapWithData(
    populationData,
    defaultYear,
    countryCoordinates,
    defaultRegion
  );
});
