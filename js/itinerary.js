/* TravelAI — AI Itinerary & Map Logic
   Groq (llama-3.3-70b-versatile) + OpenTripMap + Leaflet.js
*/

(function () {
  'use strict';

  /* ─── YEAR ─── */
  var yr = document.querySelector('[data-year]');
  if (yr) yr.textContent = String(new Date().getFullYear());

  /* ─── MOBILE NAV ─── */
  var toggle = document.querySelector('[data-nav-toggle]');
  var panel  = document.querySelector('[data-nav-panel]');
  if (toggle && panel) {
    toggle.addEventListener('click', function () {
      var open = panel.classList.toggle('is-open');
      toggle.setAttribute('aria-expanded', open ? 'true' : 'false');
    });
  }

  /* ─── MAP ─── */
  var map = null;
  var markerGroup = null;
  var currentPlaces = [];

  function initMap() {
    if (!document.getElementById('itinerary-map')) return;
    map = L.map('itinerary-map', { zoomControl: true }).setView([20, 0], 2);
    L.tileLayer('https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png', {
      attribution: '© <a href="https://www.openstreetmap.org/copyright">OpenStreetMap</a>'
    }).addTo(map);
    markerGroup = L.layerGroup().addTo(map);
  }

  initMap();

  /* ─── QUICK DEST CHIPS ─── */
  document.querySelectorAll('.quick-chip').forEach(function (chip) {
    chip.addEventListener('click', function () {
      var cityInput = document.getElementById('dest-input');
      if (cityInput) { cityInput.value = chip.dataset.city; cityInput.focus(); }
    });
  });

  /* ─── FORM SUBMIT ─── */
  var form = document.getElementById('itinerary-form');
  if (form) {
    form.addEventListener('submit', function (e) {
      e.preventDefault();
      runItineraryGeneration();
    });
  }

  /* ─── MAIN ORCHESTRATOR ─── */
  async function runItineraryGeneration() {
    var city      = (document.getElementById('dest-input').value || '').trim();
    var days      = parseInt(document.getElementById('days-input').value) || 5;
    var travelers = parseInt(document.getElementById('travelers-input').value) || 2;
    var budget    = document.getElementById('budget-select').value || 'mid-range';
    var style     = document.getElementById('style-select').value || 'cultural';

    if (!city) { alert('Please enter a destination!'); return; }

    showLoader(true, 'Finding ' + city + ' on the map…');
    hideResults();

    try {
      /* 1 – Geocode */
      setLoaderStatus('Geocoding your destination…');
      var coords = await geocodeCity(city);

      /* 2 – Generate Itinerary (Groq AI with local fallback) */
      var itinerary = null;
      try {
        setLoaderStatus('Generating a custom itinerary with TravelAI…');
        itinerary = await generateAIItinerary(city, days, travelers, budget, style);
      } catch (aiErr) {
        // Removed local static fallback so the real API error surfaces for debugging
        console.error('AI generation failed:', aiErr);
        showLoader(false);
        throw new Error('AI generation failed: ' + (aiErr && aiErr.message ? aiErr.message : aiErr));
      }

      /* 3 – Build lightweight place markers from the generated itinerary */
      setLoaderStatus('Preparing map markers…');
      var places = await buildPlacesFromItinerary(coords, itinerary);

      /* 4 – Fetch live OpenTripMap recommendations */
      setLoaderStatus('Fetching live recommendations…');
      var otmPlaces = [];
      try {
        otmPlaces = await fetchOTMRecommendations(coords);
      } catch (otmErr) {
        console.warn('OTM fetch failed:', otmErr);
      }
      if (!otmPlaces || otmPlaces.length === 0) {
        otmPlaces = places; // Fallback to generated place list if OTM fails
      }

      currentPlaces = places.concat(otmPlaces);

      /* 5 – Render */
      setLoaderStatus('Building your itinerary…');
      renderTrip(itinerary, coords, places, otmPlaces);

      showLoader(false);
      showResults();
      if (map) {
        setTimeout(function() {
          map.invalidateSize();
        }, 150);
      }
      scrollToResults();

    } catch (err) {
      showLoader(false);
      alert('⚠️ Error: ' + err.message);
    }
  }

  /* ─── GEOCODE (Nominatim — no API key required) ─── */
  async function geocodeCity(city) {
    try {
      var url = 'https://nominatim.openstreetmap.org/search?format=json&q=' + encodeURIComponent(city) + '&limit=1';
      var res = await fetch(url, { headers: { 'Accept-Language': 'en' } });
      if (!res.ok) throw new Error('Geocoding failed.');
      var list = await res.json();
      if (!list || !list[0]) throw new Error('City "' + city + '" not found. Try another spelling.');
      var item = list[0];
      var country = (item.display_name || '').split(',').slice(-1)[0] || '';
      return { lat: parseFloat(item.lat), lon: parseFloat(item.lon), country: country.trim() };
    } catch (e) {
      throw new Error('Geocoding error: ' + e.message);
    }
  }

  /* ─── AI ITINERARY GENERATOR (GROQ API) ─── */
  async function generateAIItinerary(city, days, travelers, budget, style) {
    if (typeof CONFIG === 'undefined' || !CONFIG.GROQ_KEY) {
      throw new Error('Groq API Key is missing in config.js');
    }
    var systemPrompt = 'You are a professional travel planner AI. '
      + 'Generate a highly detailed day-by-day travel itinerary for the destination. '
      + 'You MUST return ONLY a valid JSON object matching the exact schema below, with no markdown code blocks, no trailing text, and no explanations. '
      + 'Make the descriptions highly descriptive, narrative, and detailed. Do not use double quotes inside string values unless escaped correctly. '
      + 'The JSON schema to follow is: '
      + '{'
      + '  "destination": "City Name",'
      + '  "country": "Country Name",'
      + '  "duration": ' + days + ','
      + '  "theme": "' + style + '",'
      + '  "summary": "A rich, exciting 3-4 sentence overview of the trip.",'
      + '  "bestTime": "Best season or months to visit",'
      + '  "currency": "Local currency (e.g. USD, EUR, JPY)",'
      + '  "tips": ["Tip 1", "Tip 2", "Tip 3"],'
      + '  "days": ['
      + '    {'
      + '      "day": 1,'
      + '      "title": "Day 1 Theme/Title",'
      + '      "morning": { "place": "Name of Attraction", "activity": "Rich, step-by-step detailed journey description.", "duration": "Duration (e.g. 2-3 hours)", "tip": "Expert local tip.", "type": "attraction" },'
      + '      "afternoon": { "place": "Name of Place", "activity": "Detailed activity and dining/rest transitions.", "duration": "Duration", "tip": "Local tip.", "type": "restaurant" },'
      + '      "evening": { "place": "Name of Place", "activity": "Immersive evening narrative description.", "duration": "Duration", "tip": "Local tip.", "type": "attraction" }'
      + '    }'
      + '  ]'
      + '}';

    var userPrompt = 'Create a highly detailed ' + days + '-day travel itinerary for ' + city + '. '
      + 'Travelers: ' + travelers + '. Budget: ' + budget + '. Travel Style: ' + style + '. '
      + 'Make sure all places are REAL, famous, and accurate landmarks or venues in ' + city + '. '
      + 'CRITICAL RULE: DO NOT duplicate any attractions, parks, lakes, or museums across the days. EVERY single place in the morning, afternoon, and evening MUST be completely unique and different from each other. Provide a wide variety of diverse attractions.';

    // Ask the model to include nearby restaurants and a recommended hotel
    userPrompt += ' IMPORTANT: For each day, include 2 nearby restaurants and 1 recommended hotel. '
      + 'Return these extra suggestions either inside each day ("restaurants" and "hotels") or as a top-level "recommendations" array. '
      + 'DETAILED FLOW RULE: For every time slot (morning, afternoon, and evening), you MUST write a rich, long, and detailed step-by-step sequence of events. You MUST use transition arrows (→) to connect at least 3 distinct sequential actions or steps inside the "activity" string for each slot. '
      + 'Example activity: "Drive out to historical site → explore archaeological ruins (go early to beat the heat) → visit local history museum → rest at recommended hotel". '
      + 'Make every single day have these detailed sequences. Provide coordinates when possible and include source URLs (OpenTripMap, OpenStreetMap, Wikipedia) for verification.';

    // Strong instruction to verify places using OpenTripMap and OpenStreetMap
    userPrompt += ' IMPORTANT: For every place you list, verify that it exists by checking OpenTripMap (opentripmap.com) and OpenStreetMap (nominatim.openstreetmap.org) or reliable web sources. '
      + 'Include a `sources` object for each place with any available URLs (opentripmap, osm/nominatim, wikipedia). '
      + 'If a place cannot be verified as a real venue/landmark, do NOT include it. Prioritize verified places only.';

    // Send request to Groq/OpenAI-style endpoint
    var response = await fetch(CONFIG.GROQ_URL, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'Authorization': 'Bearer ' + CONFIG.GROQ_KEY
      },
      body: JSON.stringify({
        model: CONFIG.GROQ_MODEL,
        messages: [
          { role: 'system', content: systemPrompt },
          { role: 'user', content: userPrompt }
        ],
        temperature: 0.7,
        max_tokens: 4000
      })
    }).catch(function(err){
      // Network/CORS error
      throw new Error('Network error when contacting Groq API: ' + (err && err.message ? err.message : String(err)));
    });

    var raw = await response.text();
    // Debug: surface raw response and status for troubleshooting empty responses
    try { console.log('Groq API status:', response.status, 'response-length:', raw ? raw.length : 0); } catch (e) {}
    try { console.log('Groq raw response preview:', (raw || '').substring(0, 200)); } catch (e) {}
    if (!response.ok) {
      console.error('Groq API error response:', raw);
      throw new Error('API request failed with status ' + response.status + ': ' + raw.substring(0, 200));
    }

    // Try to robustly extract JSON from various response shapes and recover malformed output
    var apiResponse;
    try {
      apiResponse = JSON.parse(raw);
    } catch (e) {
      throw new Error('Failed to parse Groq API envelope: ' + e.message);
    }

    var content = '';
    if (apiResponse.choices && apiResponse.choices[0] && apiResponse.choices[0].message) {
      content = apiResponse.choices[0].message.content || '';
    } else {
      throw new Error('Unexpected API response structure: ' + raw.substring(0, 200));
    }

    content = content.trim();
    // Strip markdown code fences if present
    if (content.startsWith('```json')) {
      content = content.replace(/^```json/, '').replace(/```$/, '').trim();
    } else if (content.startsWith('```')) {
      content = content.replace(/^```/, '').replace(/```$/, '').trim();
    }

    // Helper: find balanced JSON object starting at first '{'
    function extractBalancedJSON(str) {
      var start = str.indexOf('{');
      if (start === -1) return null;
      var i = start;
      var depth = 0;
      var inString = false;
      var escape = false;
      for (; i < str.length; i++) {
        var ch = str[i];
        if (escape) { escape = false; continue; }
        if (ch === '\\') { escape = true; continue; }
        if (ch === '"') { inString = !inString; continue; }
        if (inString) continue;
        if (ch === '{') depth++; else if (ch === '}') depth--;
        if (depth === 0) {
          return str.substring(start, i + 1);
        }
      }
      return null;
    }

    // Helper: try to repair a few common JSON mistakes from model output
    function simpleRepairJson(str) {
      var repaired = String(str)
        // remove trailing commas before closing braces/brackets
        .replace(/,\s*([}\]])/g, '$1')
        // turn raw new lines into \n inside strings is hard; this only helps when model inserted line breaks between tokens
        .replace(/"\s*\n\s*"/g, '"')
        .replace(/\n{3,}/g, '\n\n');

      // Replace actual newlines inside double quotes with escaped \n
      var inString = false;
      var charArray = repaired.split('');
      for (var i = 0; i < charArray.length; i++) {
        if (charArray[i] === '"' && (i === 0 || charArray[i - 1] !== '\\')) {
          inString = !inString;
        }
        if (inString && charArray[i] === '\n') {
          charArray[i] = '\\n';
        }
        if (inString && charArray[i] === '\r') {
          charArray[i] = '';
        }
      }
      return charArray.join('');
    }

    // Attempt multiple parsing strategies
    var attempted = [];
    // 1) Direct parse
    try { attempted.push('direct'); var parsed = JSON.parse(content); return parsed; } catch (e) { attempted.push('direct-fail'); }
    // 2) Extract balanced JSON block
    try {
      attempted.push('balanced-extract');
      var block = extractBalancedJSON(content);
      if (block) {
        var parsed2 = JSON.parse(block);
        return parsed2;
      }
    } catch (e) { attempted.push('balanced-fail'); }
    // 3) Regex fallback: first {...} match
    try {
      attempted.push('regex');
      var m = content.match(/\{[\s\S]*\}/);
      if (m) { var repaired = simpleRepairJson(m[0]); var parsed3 = JSON.parse(repaired); return parsed3; }
    } catch (e) { attempted.push('regex-fail'); }

    // 4) Repair + balanced extraction
    try {
      attempted.push('repair-balanced');
      var repairedContent = simpleRepairJson(content);
      var block2 = extractBalancedJSON(repairedContent);
      if (block2) {
        var parsed4 = JSON.parse(block2);
        return parsed4;
      }
    } catch (e) { attempted.push('repair-balanced-fail'); }

    console.error('AI parse attempts:', attempted, 'raw:', raw);
    throw new Error('AI response parse error: Unable to extract valid JSON. See console for raw response.');
  }

  /* ─── RULE-BASED LOCAL ITINERARY GENERATOR (FREE) ─── */
  async function generateLocalItinerary(city, days, travelers, budget, style) {
    days = Math.max(1, Math.min(14, parseInt(days) || 5));
    var themes = {
      cultural: ['Historic Old Town', 'City Museum', 'Ancient Temple', 'Local Market', 'Heritage Walk'],
      beach:    ['Golden Beach', 'Seaside Promenade', 'Coral Bay', 'Sunset Point', 'Beachfront Market'],
      nature:   ['River Gorge', 'Waterfall Trail', 'Green Valley', 'Scenic Lookout', 'Botanical Garden'],
      food:     ['Central Market', 'Street Food Alley', 'Chef\'s Table', 'Wine Tasting', 'Local Bakery'],
      adventure:['Lake Rafting', 'Mountain Hike', 'Zipline Park', 'Cliff Dive Spot', 'ATV Trails']
    };

    var pool = themes[style] || themes.cultural;
    var it = { destination: city, country: '', duration: days, theme: style, summary: '', days: [], tips: [], bestTime: '', currency: '' };
    it.summary = 'A ' + days + '-day ' + style + ' focused trip to ' + city + ' with balanced activities and local tips.';
    it.tips = ['Carry a small daypack', 'Try local specialties', 'Book popular attractions in advance'];
    it.bestTime = 'Spring to Autumn';
    it.currency = 'Local currency';

    for (var d = 0; d < days; d++) {
      var title = (d === 0 ? 'Arrival & Easy Start' : (d === days - 1 ? 'Departure Day' : 'Explore ' + city));
      var morning = makeSlot(pool, d * 3 + 0, 'attraction');
      var afternoon = makeSlot(pool, d * 3 + 1, budget === 'luxury' ? 'restaurant' : 'attraction');
      var evening = makeSlot(pool, d * 3 + 2, 'attraction');
      it.days.push({ day: d + 1, title: title, morning: morning, afternoon: afternoon, evening: evening });
    }

    return it;

    function makeSlot(poolArr, idx, type) {
      var name = poolArr[idx % poolArr.length];
      return {
        place: name,
        activity: (type === 'restaurant' ? 'Enjoy local dishes at ' + name + ' and try popular specialties.' : 'Visit ' + name + ' and explore its highlights.'),
        duration: (type === 'restaurant' ? '1-2 hours' : '2-4 hours'),
        tip: (type === 'restaurant' ? 'Reserve a table during peak hours.' : 'Wear comfortable shoes and carry water.'),
        type: type
      };
    }
  }

  /* ─── BUILD PLACE MARKERS FROM ITINERARY (no external place API) ─── */
  async function buildPlacesFromItinerary(coords, itinerary) {
    var places = [];
    var seed = 0;
    // Enrich each itinerary slot by attempting to verify and fetch real place details from OpenTripMap first,
    // then fallback to Wikipedia summary, and finally a seeded offset coordinate if nothing is found.
    for (var d = 0; d < (itinerary.days || []).length; d++) {
      var day = itinerary.days[d];
      var slots = [day.morning, day.afternoon, day.evening];
      for (var s = 0; s < slots.length; s++) {
        var slot = slots[s];
        if (!slot || !slot.place) continue;
        seed++;
        var details = null;
        try {
          details = await fetchPlaceDetailsByName(slot.place, coords.lat, coords.lon);
          // Throttle API requests to prevent HTTP 429 Too Many Requests
          await new Promise(function(resolve) { setTimeout(resolve, 250); });
        } catch (e) { details = null; }

        if (details && details.name) {
          // If OpenTripMap/Wiki provided coordinates, use them; otherwise fall back to seeded offsets
          var lat = details.point && details.point.lat ? details.point.lat : (coords.lat + ((seed % 2 === 0) ? ((seed % 5) * 0.007) : -((seed % 5) * 0.007)));
          var lon = details.point && details.point.lon ? details.point.lon : (coords.lon + ((seed % 3 === 0) ? -((seed % 5) * 0.007) : ((seed % 5) * 0.007)));
          places.push({ name: details.name || slot.place, kinds: details.kinds || slot.type, point: { lat: lat, lon: lon }, preview: { source: details.image || '' }, rate: details.rate || 4, wikipedia_extracts: { text: details.wikipedia_extracts && details.wikipedia_extracts.text ? details.wikipedia_extracts.text : slot.activity }, sources: details.sources || {} });
        } else {
          var offset = (seed % 5) * 0.007;
          var lat2 = coords.lat + ((seed % 2 === 0) ? offset : -offset);
          var lon2 = coords.lon + ((seed % 3 === 0) ? -offset : offset);
          places.push({ name: slot.place, kinds: slot.type, point: { lat: lat2, lon: lon2 }, preview: { source: '' }, rate: 4, wikipedia_extracts: { text: slot.activity } });
        }
      }
    }
    return places;
  }

  /* ─── FETCH LIVE RECOMMENDATIONS (OPENTRIPMAP API) ─── */
  async function fetchOTMRecommendations(coords) {
    if (typeof CONFIG === 'undefined' || !CONFIG.OTM_KEY) {
      throw new Error('Live recommendation API key is missing in config.js');
    }

    try {
      // 1. Fetch interesting places within 5km radius
      var radiusUrl = 'https://api.opentripmap.com/0.1/en/places/radius?'
        + 'radius=5000'
        + '&lon=' + coords.lon
        + '&lat=' + coords.lat
        + '&limit=8'
        + '&format=json'
        + '&apikey=' + CONFIG.OTM_KEY;

      var res = await fetch(radiusUrl);
      if (!res.ok) throw new Error('Radius search failed');
      var list = await res.json();

      if (!list || !Array.isArray(list) || list.length === 0) return [];

      // 2. Fetch details sequentially to avoid HTTP 429 Too Many Requests
      var results = [];
      for (var i = 0; i < list.length; i++) {
        var place = list[i];
        if (!place || !place.xid) continue;
        try {
          var detailUrl = 'https://api.opentripmap.com/0.1/en/places/xid/' + place.xid
            + '?apikey=' + CONFIG.OTM_KEY;
          var detailRes = await fetch(detailUrl);
          if (detailRes.ok) {
             var details = await detailRes.json();
             if (details && details.name) {
               details.point = place.point;

               // Try to fetch Wikipedia image if OpenTripMap doesn't have an image
               if (!(details.preview && details.preview.source) && !details.image) {
                 try {
                   var cleanNameForWiki = details.name
                     .replace(/^(Day\s+\d+:\s*|\d+\.\s*)/i, '')
                     .split(',')[0]
                     .split('(')[0]
                     .trim();
                   var wikiUrl = 'https://en.wikipedia.org/api/rest_v1/page/summary/' + encodeURIComponent(cleanNameForWiki);
                   var wikiRes = await fetch(wikiUrl);
                   if (wikiRes.ok) {
                     var wikiData = await wikiRes.json();
                     if (wikiData && wikiData.originalimage && wikiData.originalimage.source) {
                       details.image = wikiData.originalimage.source;
                     }
                     if (wikiData && wikiData.extract && (!details.wikipedia_extracts || !details.wikipedia_extracts.text)) {
                       details.wikipedia_extracts = details.wikipedia_extracts || {};
                       details.wikipedia_extracts.text = wikiData.extract;
                     }
                   }
                 } catch (wikiErr) {
                   console.log('Wiki fetch failed for rec:', details.name, wikiErr);
                 }
               }

               results.push(details);
             }
          }
          // Throttle
          await new Promise(function(resolve) { setTimeout(resolve, 200); });
        } catch (_) {}
      }

      return results;
    } catch (err) {
      console.warn('OpenTripMap fetch failed:', err);
      return [];
    }
  }

  /* ─── RENDER ALL ─── */
  function renderTrip(itinerary, coords, places, otmPlaces) {
    renderHeader(itinerary);
    renderDayTabs(itinerary);
    renderTips(itinerary);
    updateMap(coords, places);
    renderRecommendations(otmPlaces);
  }

  function renderHeader(it) {
    setText('result-city',      it.destination || '');
    setText('result-country',   it.country ? '· ' + it.country : '');
    setText('result-summary',   it.summary  || '');
    setText('result-best-time', it.bestTime ? '🗓 Best time: ' + it.bestTime : '');
    setText('result-currency',  it.currency ? '💱 ' + it.currency : '');
  }

  function renderDayTabs(it) {
    var tabsEl    = document.getElementById('day-tabs');
    var contentEl = document.getElementById('day-contents');
    if (!tabsEl || !contentEl) return;
    tabsEl.innerHTML = contentEl.innerHTML = '';

    (it.days || []).forEach(function (day, i) {
      var btn = document.createElement('button');
      btn.className   = 'day-tab' + (i === 0 ? ' active' : '');
      btn.textContent = 'Day ' + day.day;
      btn.addEventListener('click', (function(idx){ return function(){ switchDay(idx); }; })(i));
      tabsEl.appendChild(btn);

      var div = document.createElement('div');
      div.className = 'day-content' + (i === 0 ? ' active' : '');
      div.innerHTML =
        '<h3 class="day-title"><span class="day-num">Day ' + day.day + '</span> ' + escHtml(day.title || '') + '</h3>' +
        '<div class="timeline">' +
          timelineSlot('🌅', 'Morning',   day.morning) +
          timelineSlot('☀️', 'Afternoon', day.afternoon) +
          timelineSlot('🌆', 'Evening',   day.evening) +
        '</div>';
      contentEl.appendChild(div);
    });
  }

  function timelineSlot(emoji, label, slot) {
    if (!slot) return '';
    var icons = { attraction:'🏛️', restaurant:'🍽️', museum:'🎨', park:'🌳', beach:'🏖️', shopping:'🛍️' };
    var icon  = icons[slot.type] || '📍';
    return '<div class="timeline-item">'
      + '<div class="timeline-time"><span class="time-emoji">' + emoji + '</span><span class="time-label">' + label + '</span></div>'
      + '<div class="timeline-card">'
      + '<div class="timeline-card-header"><span class="place-type-icon">' + icon + '</span>'
      + '<h4 class="place-name">' + escHtml(slot.place || '') + '</h4>'
      + '<span class="place-duration">' + escHtml(slot.duration || '') + '</span></div>'
      + '<p class="place-activity">' + escHtml(slot.activity || '') + '</p>'
      + (slot.tip ? '<div class="place-tip"><span>💡</span> ' + escHtml(slot.tip) + '</div>' : '')
      + '<button class="btn-map-pin" data-place="' + escAttr(slot.place || '') + '">'
      + '<svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><path d="M20 10c0 6-8 12-8 12s-8-6-8-12a8 8 0 0 1 16 0Z"/><circle cx="12" cy="10" r="3"/></svg> View on Map'
      + '</button></div></div>';
  }

  document.addEventListener('click', function (e) {
    var btn = e.target && e.target.closest ? e.target.closest('.btn-map-pin') : null;
    if (!btn) return;
    var place = btn.getAttribute('data-place');
    if (place) searchOnMap(place);
  });

  function renderTips(it) {
    var el = document.getElementById('trip-tips');
    if (!el) return;
    el.innerHTML = (it.tips || []).map(function (t) { return '<li>' + escHtml(t) + '</li>'; }).join('');
  }

  /* ─── MAP ─── */
  function updateMap(coords, places) {
    if (!map || !markerGroup) return;
    markerGroup.clearLayers();
    map.setView([coords.lat, coords.lon], 13);

    // Combine places to store in markers registry
    if (!window.placeMarkers) window.placeMarkers = {};

    var colors = ['#6366f1','#8b5cf6','#ec4899','#f59e0b','#10b981','#3b82f6','#ef4444','#06b6d4'];

    // Render AI Itinerary Places (Numbered pins matching Day Timeline)
    places.forEach(function (place, i) {
      if (!place.point || !place.point.lat) return;
      var color = colors[i % colors.length];
      var photo = place.preview && place.preview.source ? place.preview.source : getPremiumTravelImage(place.name);
      var kind  = place.kinds ? place.kinds.split(',')[0].replace(/_/g, ' ') : 'Itinerary Place';
      var wiki  = place.wikipedia_extracts && place.wikipedia_extracts.text
                  ? place.wikipedia_extracts.text.substring(0, 130) + '…' : '';

      var icon = L.divIcon({
        className: 'custom-marker',
        html: '<div class="marker-pin" style="background:' + color + ';width:36px;height:36px;border-radius:50% 50% 50% 0;transform:rotate(-45deg);display:flex;align-items:center;justify-content:center;box-shadow:0 4px 12px rgba(0,0,0,0.4)">' 
          + '<span style="transform:rotate(45deg);color:#fff;font-size:0.75rem;font-weight:700">' + (i + 1) + '</span></div>',
        iconSize: [36, 36], iconAnchor: [18, 36]
      });

      var popupHtml = '<div style="min-width:180px">'
        + (photo ? '<img src="' + photo + '" style="width:100%;height:110px;object-fit:cover;border-radius:8px;margin-bottom:8px" referrerpolicy="no-referrer">' : '')
        + '<h4 style="margin:0 0 4px;font-weight:700;font-size:14px">' + escHtml(place.name) + '</h4>'
        + '<span style="background:rgba(99,102,241,0.1);color:#6366f1;border-radius:4px;padding:2px 7px;font-size:11px;text-transform:capitalize">' + escHtml(kind) + '</span>'
        + (wiki ? '<p style="font-size:12px;margin:8px 0 0;color:#555;line-height:1.4">' + escHtml(wiki) + '</p>' : '')
        + '</div>';

      var marker = L.marker([place.point.lat, place.point.lon], { icon: icon })
        .addTo(markerGroup)
        .bindPopup(popupHtml, { maxWidth: 220 });

      window.placeMarkers[place.name] = marker;

      marker.on('click', function () {
        showPlacePanel(place, marker);
        highlightMarker(marker);
      });
    });
  }

  async function searchOnMap(placeName) {
    if (!map) return;
    try {
      var res  = await fetch('https://nominatim.openstreetmap.org/search?format=json&q=' + encodeURIComponent(placeName) + '&limit=1');
      var list = await res.json();
      if (list && list[0] && list[0].lat) {
        var lat = parseFloat(list[0].lat), lon = parseFloat(list[0].lon);
        map.setView([lat, lon], 15);
        L.popup().setLatLng([lat, lon]).setContent('<b>' + escHtml(placeName) + '</b>').openOn(map);
        
        // try to highlight a marker and show its details panel if available
        if (window.placeMarkers && window.placeMarkers[placeName]) {
          var marker = window.placeMarkers[placeName];
          highlightMarker(marker);
          var placeObj = currentPlaces.find(function (p) { return p.name.toLowerCase() === placeName.toLowerCase(); });
          if (placeObj) {
            showPlacePanel(placeObj, marker);
          }
        }
      }
    } catch (_) {}
  }

  /* ─── PREMIUM SCENIC IMAGE GENERATOR ─── */
  function getPremiumTravelImage(placeName) {
    var fallbacks = [
      // Use Picsum (stable random images) and a couple Wikimedia commons photos as reliable fallbacks
      'https://picsum.photos/seed/picsum1/600/400',
      'https://picsum.photos/seed/picsum2/600/400',
      'https://picsum.photos/seed/picsum3/600/400',
      'https://upload.wikimedia.org/wikipedia/commons/6/6e/Golde334.jpg',
      'https://upload.wikimedia.org/wikipedia/commons/1/17/Paris_-_Eiffelturm_und_Marsfeld2.jpg',
      'https://picsum.photos/seed/picsum4/600/400',
      'https://picsum.photos/seed/picsum5/600/400',
      'https://picsum.photos/seed/picsum6/600/400'
    ];
    var hash = 0;
    var name = placeName || '';
    for (var i = 0; i < name.length; i++) {
      hash = name.charCodeAt(i) + ((hash << 5) - hash);
    }
    var index = Math.abs(hash) % fallbacks.length;
    return fallbacks[index];
  }

  /* ─── FETCH DETAILED PLACE INFO FROM WIKIPEDIA OR OPENTRIPMAP ─── */
  async function fetchPlaceDetailsByName(placeName, lat, lon) {
    // Clean name: remove number prefixes (e.g. "1. ", "Day 1: "), brackets, and anything after commas
    var cleanName = placeName
      .replace(/^(Day\s+\d+:\s*|\d+\.\s*)/i, '') // strip "Day 1:" or "1. "
      .split(',')[0] // split at comma
      .split('(')[0] // split at brackets
      .trim();

    var details = {
      name: cleanName,
      image: '',
      kinds: 'interesting place',
      rate: '5',
      wikipedia_extracts: { text: '' }
    };

    var matched = false;

    // 1. Try OpenTripMap autosuggest + xid first (preferred — authoritative POI data)
    try {
      if (typeof CONFIG !== 'undefined' && CONFIG.OTM_KEY) {
        var autosuggestUrl = 'https://api.opentripmap.com/0.1/en/places/autosuggest?'
          + 'name=' + encodeURIComponent(cleanName)
          + '&radius=20000'
          + '&lon=' + (lon || '')
          + '&lat=' + (lat || '')
          + '&limit=1'
          + '&apikey=' + CONFIG.OTM_KEY;

        var asRes = await fetch(autosuggestUrl);
        if (asRes.ok) {
          var asData = await asRes.json();
          var xid = null;
          if (Array.isArray(asData) && asData[0] && asData[0].xid) xid = asData[0].xid;
          else if (asData && asData.features && asData.features[0]) {
            var f = asData.features[0];
            xid = (f.properties && f.properties.xid) ? f.properties.xid : (f.xid || null);
          }

          // If we found xid, fetch details
          if (xid) {
            var detailUrl = 'https://api.opentripmap.com/0.1/en/places/xid/' + xid + '?apikey=' + CONFIG.OTM_KEY;
            var dRes = await fetch(detailUrl);
            if (dRes.ok) {
              var otm = await dRes.json();
              details.name = otm.name || details.name;
              if (otm.preview && otm.preview.source) details.image = otm.preview.source;
              if (otm.image) details.image = details.image || otm.image;
              if (otm.wikipedia_extracts && otm.wikipedia_extracts.text) details.wikipedia_extracts.text = otm.wikipedia_extracts.text;
              if (otm.kinds) details.kinds = otm.kinds;
              if (otm.rate) details.rate = otm.rate;
              if (otm.point && otm.point.lat) details.point = otm.point;
              details.sources = details.sources || {};
              details.sources.opentripmap = 'https://opentripmap.com/en/poi/' + (otm.xid || xid);
              matched = true;
              console.log('OpenTripMap matched for:', cleanName);
              return details;
            }
          }
        }
      }
    } catch (e) {
      console.warn('OpenTripMap autosuggest/detail failed for:', cleanName, e);
    }

    // 2. Try radius proximity search (OTM) as a fallback if autosuggest didn't return xid
    try {
      if (typeof CONFIG !== 'undefined' && CONFIG.OTM_KEY) {
        var radiusUrl = 'https://api.opentripmap.com/0.1/en/places/radius?'
          + 'radius=3000'
          + '&lon=' + (lon || '')
          + '&lat=' + (lat || '')
          + '&limit=1'
          + '&format=json'
          + '&apikey=' + CONFIG.OTM_KEY;
        var rRes = await fetch(radiusUrl);
        if (rRes.ok) {
          var rData = await rRes.json();
          if (rData && rData[0] && rData[0].xid) {
            var xid2 = rData[0].xid;
            var dRes2 = await fetch('https://api.opentripmap.com/0.1/en/places/xid/' + xid2 + '?apikey=' + CONFIG.OTM_KEY);
            if (dRes2.ok) {
              var otm2 = await dRes2.json();
              details.name = otm2.name || details.name;
              if (otm2.preview && otm2.preview.source) details.image = otm2.preview.source;
              if (otm2.wikipedia_extracts && otm2.wikipedia_extracts.text) details.wikipedia_extracts.text = otm2.wikipedia_extracts.text;
              if (otm2.kinds) details.kinds = otm2.kinds;
              if (otm2.rate) details.rate = otm2.rate;
              if (otm2.point && otm2.point.lat) details.point = otm2.point;
              details.sources = details.sources || {};
              details.sources.opentripmap = 'https://opentripmap.com/en/poi/' + (otm2.xid || xid2);
              matched = true;
              console.log('OpenTripMap radius match for:', cleanName);
              return details;
            }
          }
        }
      }
    } catch (e) {
      console.warn('OpenTripMap radius check failed for:', cleanName, e);
    }

    // 3. Wikipedia fallback for summaries and images
    try {
      var wikiUrl = 'https://en.wikipedia.org/api/rest_v1/page/summary/' + encodeURIComponent(cleanName);
      var wikiRes = await fetch(wikiUrl);
      if (wikiRes.ok) {
        var wikiData = await wikiRes.json();
        if (wikiData && wikiData.title) {
          details.name = wikiData.title;
          if (wikiData.originalimage && wikiData.originalimage.source) details.image = wikiData.originalimage.source;
          if (wikiData.extract) details.wikipedia_extracts.text = wikiData.extract;
          if (wikiData.description) details.kinds = wikiData.description;
          details.sources = details.sources || {};
          details.sources.wikipedia = 'https://en.wikipedia.org/wiki/' + encodeURIComponent(wikiData.title);
          matched = true;
          // console.log('Wikipedia matched for:', cleanName);
          return details;
        }
      }
    } catch (wikiErr) {
      // expected error when english wiki doesn't have an article for local places, safe to ignore
    }

    // 4. If nothing matched, return null so caller falls back to seeded offsets
    return null;
  }

  /* ─── PLACE PANEL + SELECTION ─── */
  async function showPlacePanel(place, marker) {
    var panel = document.getElementById('place-panel');
    if (!panel) return;

    // Check if the place already has a verified dynamic/live photo
    var hasRealPhoto = (place.preview && place.preview.source) || place.image;
    var photo = hasRealPhoto ? ((place.preview && place.preview.source) ? place.preview.source : place.image) : '';

    var kind  = place.kinds ? place.kinds.split(',')[0].replace(/_/g, ' ') : 'Place';
    var stars = '★'.repeat(Math.min(parseInt(place.rate) || 4, 5)) + '☆'.repeat(5 - Math.min(parseInt(place.rate) || 4, 5));
    var desc  = place.wikipedia_extracts && place.wikipedia_extracts.text ? place.wikipedia_extracts.text : 'Discover the rich history and unique vibes of this destination.';

    panel.innerHTML =
      '<button class="place-panel-close" id="place-panel-close">&times;</button>' +
      (photo 
        ? '<img src="' + escAttr(photo) + '" class="place-panel-img" alt="' + escAttr(place.name) + '" referrerpolicy="no-referrer" onerror="this.style.display=\'none\'">' 
        : '<div class="place-panel-img-loader" id="place-panel-loader"><span>✦ Syncing live media…</span></div>'
      ) +
      '<h4 class="place-panel-title">' + escHtml(place.name) + '</h4>' +
      '<div class="place-panel-meta">' +
        '<span class="place-panel-tag">' + escHtml(kind) + '</span>' +
        '<span class="place-panel-stars" style="color:#fbbf24">' + stars + '</span>' +
      '</div>' +
      '<p class="place-panel-desc">' + escHtml(desc) + '</p>' +
      '<button class="place-panel-btn" id="btn-add-to-plan">+ Add to Plan</button>';

    panel.style.display = 'block';

    document.getElementById('place-panel-close').addEventListener('click', function () { panel.style.display = 'none'; });
    
    var addBtn = document.getElementById('btn-add-to-plan');
    addBtn.addEventListener('click', function () {
      addPlaceToPlan(place);
      addBtn.textContent = '✓ Added to Plan!';
      addBtn.style.background = 'linear-gradient(135deg, #10b981, #059669)';
      addBtn.disabled = true;
      setTimeout(function () {
        if (addBtn) {
          addBtn.textContent = '+ Add to Plan';
          addBtn.style.background = '';
          addBtn.disabled = false;
        }
      }, 1600);
    });

    // Fetch live details in parallel from Wikipedia / OpenTripMap
    if (place.point && place.point.lat) {
      var metaContainer = panel.querySelector('.place-panel-meta');
      var statusSpan = document.createElement('span');
      statusSpan.style.cssText = 'font-size:0.7rem;color:rgba(255,255,255,0.45);margin-left:auto';
      statusSpan.className = 'otm-load-status';
      statusSpan.innerHTML = '✦ Live details syncing…';
      metaContainer.appendChild(statusSpan);

      var liveDetails = await fetchPlaceDetailsByName(place.name, place.point.lat, place.point.lon);
      
      // Remove loader since the sync completed
      var loaderEl = document.getElementById('place-panel-loader');
      if (loaderEl) loaderEl.remove();

      if (liveDetails) {
        var livePhoto = liveDetails.image ? liveDetails.image : getPremiumTravelImage(place.name);
        var liveKind  = liveDetails.kinds ? liveDetails.kinds.split(',')[0].replace(/_/g, ' ') : kind;
        var liveStars = '★'.repeat(Math.min(parseInt(liveDetails.rate) || 4, 5)) + '☆'.repeat(5 - Math.min(parseInt(liveDetails.rate) || 4, 5));

        var imgEl = panel.querySelector('.place-panel-img');
        if (livePhoto) {
          if (!imgEl) {
            imgEl = document.createElement('img');
            imgEl.className = 'place-panel-img';
            imgEl.style.opacity = '0';
            imgEl.style.transition = 'opacity 0.4s ease';
            panel.insertBefore(imgEl, panel.querySelector('.place-panel-title'));
          }
          imgEl.referrerPolicy = 'no-referrer';
          imgEl.src = livePhoto;
          imgEl.style.display = 'block';
          // Smooth fade in
          setTimeout(function() { if (imgEl) imgEl.style.opacity = '1'; }, 50);
        } else if (imgEl) {
          imgEl.style.display = 'none';
        }

        panel.querySelector('.place-panel-tag').textContent = liveKind;
        panel.querySelector('.place-panel-stars').textContent = liveStars;
        
        // CRITICAL: We DO NOT overwrite description (.place-panel-desc) so it remains the beautiful custom AI-generated travel activity description!
        
        statusSpan.innerHTML = '✓ Live Wiki Data';
        statusSpan.style.color = '#34d399';
        setTimeout(function() { if (statusSpan) statusSpan.style.opacity = '0'; }, 3000);
      } else {
        // If live details fetch completely failed, we fallback to the curated photo smoothly
        var fallbackPhoto = getPremiumTravelImage(place.name);
        var imgEl = panel.querySelector('.place-panel-img');
        if (!imgEl) {
          imgEl = document.createElement('img');
          imgEl.className = 'place-panel-img';
          imgEl.style.opacity = '0';
          imgEl.style.transition = 'opacity 0.4s ease';
          panel.insertBefore(imgEl, panel.querySelector('.place-panel-title'));
        }
        imgEl.src = fallbackPhoto;
        imgEl.style.display = 'block';
        setTimeout(function() { if (imgEl) imgEl.style.opacity = '1'; }, 50);

        if (statusSpan) statusSpan.remove();
      }
    }
  }

  function highlightMarker(marker) {
    // clear previous
    if (window.placeMarkers) Object.keys(window.placeMarkers).forEach(function (k) {
      var m = window.placeMarkers[k];
      try { var el = m.getElement(); if (el) el.classList.remove('selected'); } catch (_) {}
    });
    try { var el2 = marker.getElement(); if (el2) el2.classList.add('selected'); } catch (_) {}
  }

  function addPlaceToPlan(place) {
    // create a slot-like object and inject into first day's timeline
    var slot = { place: place.name, activity: (place.wikipedia_extracts && place.wikipedia_extracts.text) ? place.wikipedia_extracts.text : '', duration: '2 hrs', tip: '', type: (place.kinds || 'attraction') };
    // find first day-content element
    var dayContent = document.querySelector('.day-content');
    if (!dayContent) {
      alert('No itinerary loaded yet. Generate an itinerary first.');
      return;
    }
    var timeline = dayContent.querySelector('.timeline');
    if (!timeline) return;
    // insert new timeline item at the top
    var temp = document.createElement('div');
    temp.className = 'timeline-item';
    temp.innerHTML = timelineSlot('📌', 'Suggested', slot);
    timeline.insertBefore(temp, timeline.firstChild);
    // also try to find and highlight marker if exists
    if (window.placeMarkers && window.placeMarkers[place.name]) {
      highlightMarker(window.placeMarkers[place.name]);
    }
  }

  /* ─── RECOMMENDATIONS ─── */
  function renderRecommendations(places) {
    var grid    = document.getElementById('recs-grid');
    var section = document.getElementById('recs-section');
    if (!grid) return;

    if (!places || places.length === 0) {
      grid.innerHTML = '<p style="color:rgba(255,255,255,0.4);text-align:center;grid-column:1/-1;padding:2rem">No recommendations found for this area.</p>';
      if (section) section.style.display = 'block';
      return;
    }

    grid.innerHTML = places.map(function (place, i) {
      // ONLY use verified images from OpenTripMap or Wikipedia fallback
      var photo = (place.preview && place.preview.source) ? place.preview.source : (place.image ? place.image : '');
      var kind  = place.kinds ? place.kinds.split(',')[0].replace(/_/g, ' ') : 'Place';
      var stars = '⭐'.repeat(Math.min(parseInt(place.rate) || 3, 5));
      var wiki  = place.wikipedia_extracts && place.wikipedia_extracts.text
                  ? place.wikipedia_extracts.text.substring(0, 90) + '…' : '';

      var imageHtml = '';
      if (photo) {
        // Render image only if we got a real verified photo. Hide container if image fails to load.
        imageHtml = '<div class="rec-place-img">'
          + '<img src="' + escAttr(photo) + '" alt="' + escAttr(place.name || 'Place') + '" referrerpolicy="no-referrer" loading="lazy" onerror="this.parentNode.style.display=\'none\';">'
          + '<span class="rec-place-tag">' + escHtml(kind) + '</span>'
          + '</div>';
      } else {
        // If there is no real photo, display no image container or placeholder at all! Just show a neat pill.
        imageHtml = '<div style="padding: 1.25rem 1.25rem 0 1.25rem;"><span class="rec-place-tag" style="position:static; display:inline-block; background:rgba(99, 102, 241, 0.15); color:#a5b4fc; border:1px solid rgba(99, 102, 241, 0.25); border-radius:6px; padding:3px 8px; font-size:0.7rem; font-weight:600; text-transform:capitalize;">' + escHtml(kind) + '</span></div>';
      }

      var cardClass = photo ? 'rec-place-card' : 'rec-place-card no-image';

      return '<div class="' + cardClass + '">'
        + imageHtml
        + '<div class="rec-place-body" style="' + (photo ? '' : 'padding-top: 0.5rem;') + '"><h4>' + escHtml(place.name || 'Unnamed Place') + '</h4>'
        + '<div class="rec-place-rating">' + stars + '</div>'
        + (wiki ? '<p>' + escHtml(wiki) + '</p>' : '')
        + '<button class="btn-add-plan" data-place="' + escAttr(place.name || '') + '">+ Add to Plan</button>'
        + '</div></div>';
    }).join('');

    grid.querySelectorAll('.btn-add-plan').forEach(function (btn) {
      btn.addEventListener('click', function () {
        btn.textContent = '✅ Added!';
        btn.style.cssText = 'background:rgba(16,185,129,0.2);color:#34d399;border-color:rgba(16,185,129,0.4)';
        setTimeout(function () { btn.textContent = '+ Add to Plan'; btn.style.cssText = ''; }, 2000);
      });
    });

    if (section) section.style.display = 'block';
  }

  /* ─── DAY SWITCH ─── */
  function switchDay(index) {
    document.querySelectorAll('.day-tab').forEach(function (t, i) { t.classList.toggle('active', i === index); });
    document.querySelectorAll('.day-content').forEach(function (c, i) { c.classList.toggle('active', i === index); });
  }

  /* ─── URL PARAMS ─── */
  (function () {
    var params = new URLSearchParams(window.location.search);
    var city   = params.get('city');
    if (city) {
      var inp = document.getElementById('dest-input');
      if (inp) { inp.value = city; setTimeout(runItineraryGeneration, 400); }
    }
  })();

  /* ─── UI HELPERS ─── */
  function showLoader(show, msg) {
    var el = document.getElementById('ai-loader');
    if (el) el.style.display = show ? 'flex' : 'none';
    if (msg) setLoaderStatus(msg);
  }
  function setLoaderStatus(msg) { var el = document.getElementById('loader-status'); if (el) el.textContent = msg; }
  function showResults()  { var r = document.getElementById('results-section'); if (r) r.style.display = 'block'; }
  function hideResults()  {
    var r = document.getElementById('results-section');
    var s = document.getElementById('recs-section');
    if (r) r.style.display = 'none';
    if (s) s.style.display = 'none';
  }
  function scrollToResults() { var r = document.getElementById('results-section'); if (r) r.scrollIntoView({ behavior: 'smooth' }); }
  function setText(id, val)  { var el = document.getElementById(id); if (el) el.textContent = val; }
  function escHtml(s) {
    return String(s).replace(/&/g,'&amp;').replace(/</g,'&lt;').replace(/>/g,'&gt;').replace(/"/g,'&quot;');
  }
  function escAttr(s) { return String(s).replace(/'/g,'&#39;').replace(/"/g,'&quot;'); }

})();
