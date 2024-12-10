// Función para buscar referencias catastrales válidas
function findCatastralReferences(data) {
  const references1 = [];
  const urbanRegex = /^[0-9]{7}[A-Z]{2}[0-9]{4}[A-Z]{1}[0-9]{4}[A-Z]{2}$/; // Urbana
  const rusticRegex = /^[0-9]{5}[A-Z]{1}[0-9]{3}[0-9]{5}[A-Z]{2}$/;        // Rústica
  const shortRegex = /^[0-9]{7}[A-Z]{2}[0-9]{4}[A-Z]{1}$/;                // Referencia corta

  for (let row = 0; row < data.length; row++) {
    for (let col = 0; col < data[row].length; col++) {
      const cellValue = data[row][col];
      if (typeof cellValue === 'string' && 
          (urbanRegex.test(cellValue) || rusticRegex.test(cellValue) || shortRegex.test(cellValue))) {
        references1.push(cellValue);
      }
    }
  }
  return references1;
}

// Función para obtener los datos de una referencia catastral
async function fetchCatastralData(ref) {
    const apiUrl = `https://ovc.catastro.meh.es/OVCServWeb/OVCWcfCallejero/COVCCallejero.svc/json/Consulta_DNPRC?RefCat=${ref}`;
    const response = await fetch(apiUrl);
    const data = await response.json();

    // Aseguramos la existencia de las propiedades
    const bi = data?.consulta_dnprcResult?.bico?.bi || {};

    return {
      year: bi?.debi?.ant || "Desconocido",
      area: bi?.debi?.sfc || "Desconocido",
      location: bi?.ldt || "Ubicación no disponible",
      clase: bi?.debi?.luso || "Desconocido", 
      ref: ref,
      // bi?.idbi?.rc?.pc1 && bi?.idbi?.rc?.pc2 && bi?.idbi?.rc?.car && bi?.idbi?.rc?.cc1 && bi?.idbi?.rc?.cc2,
    };
}

// Función para mostrar los resultados
async function displayResults(ref, data) {
    const resultContainer = document.getElementById("result-container");
    const resultsDiv = document.getElementById("results");

    const imgUrl = `https://ovc.catastro.meh.es/OVCServWeb/OVCWcfLibres/OVCFotoFachada.svc/RecuperarFotoFachadaGet?ReferenciaCatastral=${ref}`;
    const pdfUrl = `https://www1.sedecatastro.gob.es/CYCBienInmueble/SECImprimirCroquisyDatos.aspx?refcat=${ref}`;
    const GoogleMapsUrl = `https://www1.sedecatastro.gob.es/Cartografia/BuscarParcelaInternet.aspx?refcat=${ref}`;

    const block = document.createElement("div");
    block.className = "card-body";
    block.innerHTML = `
        <img src="${imgUrl}" class="card-img-top" alt="Imagen inmueble">
        <div class="card-body">
            <h5 class="card-title">${data.location}</h5>
            <p class="card-text description">
                <strong>${data.area}</strong> - Superficie construida<br>
                <strong>${data.year}</strong> - Año construcción<br>
                <strong>${data.clase}</strong> - Clase<br>
                <a href="${GoogleMapsUrl}" class="btn btn-secondary btn-sm" target="_blank">Ubicación</a> - Ver en GoogleMaps<br>
                <a href="${pdfUrl}" class="btn btn-outline-primary">PDF Catastro</a>
            </p>
        </div>
    `;
    resultContainer.appendChild(block);
    resultsDiv.style.display = "block";
}

// Función para consultar datos basados en los filtros
async function consultarDatos(event) {
    event.preventDefault();
    const fileInput = document.getElementById('fileInput');
    if (!fileInput.files.length) {
      alert('Por favor, selecciona un archivo Excel.');
      return;
    }
    const file = fileInput.files[0];
    const reader = new FileReader();
  
    reader.onload = async function (event) {
      const data = new Uint8Array(event.target.result);
      const workbook = XLSX.read(data, { type: 'array' });
  
      // Tomar la primera hoja
      const sheetName = workbook.SheetNames[0];
      const sheet = workbook.Sheets[sheetName];
  
      // Convertir la hoja a JSON
      const json = XLSX.utils.sheet_to_json(sheet, { header: 1 });
  
      // Buscar referencias catastrales
      const references = findCatastralReferences(json);

      if (references.length > 0) {

        const claseSeleccionadas = Array.from(document.querySelectorAll('input[name="clase"]:checked')).map(input => input.value);
        const metrosConstruidosMin = parseFloat(document.getElementById('metrosConstruidosMin').value) || null;
        const metrosConstruidosMax = parseFloat(document.getElementById('metrosConstruidosMax').value) || null;
        const provincias = parseCommaSeparated(document.getElementById('provincias').value);
        const ciudades = parseCommaSeparated(document.getElementById('ciudades').value);
        const barrios = parseCommaSeparated(document.getElementById('barrios').value);
        const añoConstruccionMin = parseFloat(document.getElementById('añoConstruccionMin').value) || null;
        const añoConstruccionMax = parseFloat(document.getElementById('añoConstruccionMax').value) || null;
    
        // Procesar cada referencia catastral
        for (const ref of references) {
            const data = await fetchCatastralData(ref);
    
            const coincideClase = claseSeleccionadas.includes(data.clase);
            const coincideSuperficie = (!metrosConstruidosMin || data.area >= metrosConstruidosMin) &&
                                        (!metrosConstruidosMax || data.area <= metrosConstruidosMax);
            const coincideUbicacion = (!provincias.length || provincias.includes(data.provincia)) &&
                                       (!ciudades.length || ciudades.includes(data.ciudad)) &&
                                       (!barrios.length || barrios.includes(data.barrio));
            const coincideAño = (!añoConstruccionMin || data.year >= añoConstruccionMin) &&
                                (!añoConstruccionMax || data.year <= añoConstruccionMax);
    
            // Mostrar resultados si coinciden con todos los filtros
            if (coincideClase && coincideSuperficie && coincideUbicacion && coincideAño) {
              displayResults(ref, data);
            } 
        }
      } else {
        alert('No se encontraron referencias catastrales válidas.');
      }
    };
  
    reader.readAsArrayBuffer(file);
}

function parseCommaSeparated(input) {
    if (!input) return [];
    return input
        .split(",") // Dividir por comas
        .map(item => item.trim()) // Eliminar espacios adicionales
        .filter(Boolean); // Filtrar elementos vacíos
}