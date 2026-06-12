# CR TP - Data for the Web (3IFA Graded Lab)

**Students:** Samuel Picquart (20250937), Théophile Jérôme-Rocher (20250936)

**Database:** `20263IFMongoLab`

---

## Part 1 - MongoDB queries

### 1.1 Simplify the `touristPOI_c` collection, getting the documents from inside the "features" array to the root of a new collection called `touristPOI`. Provide the MongoDB query and explain your approach.

**Query:**

```javascript
db.touristPOI_c.aggregate([
  { $unwind: "$features" },
  { $replaceRoot: { newRoot: "$features" } },
  { $out: "touristPOI" }
])
```

**Explanation:**

`touristPOI_c` contains a single document (a GeoJSON FeatureCollection) whose `features` array holds the 1786 POIs. The pipeline:

1. `$unwind: "$features"`: one document per element of the `features` array;
2. `$replaceRoot: { newRoot: "$features" }`: puts the content of `features` at the root, each POI becomes its own document;
3. `$out: "touristPOI"`: writes the result in a new collection `touristPOI`.

Verification: `db.touristPOI.countDocuments()` returns 1786, the size of the original `features` array.

### 1.2 Provide a mongodb query that retrieves the unique types (distinct types) of points of interest in the `touristPOI` collection. Provide the results as well.

The type of a POI is stored in `properties.type`. `distinct` returns each value once.

**Query:**

```javascript
db.touristPOI.distinct("properties.type")
```

**Results (11 distinct types):**

```
[ 'ACTIVITE', 'COMMERCE_ET_SERVICE', 'DEGUSTATION', 'EQUIPEMENT',
  'FETE_ET_MANIFESTATION', 'HEBERGEMENT_COLLECTIF', 'HEBERGEMENT_LOCATIF',
  'HOTELLERIE', 'HOTELLERIE_PLEIN_AIR', 'PATRIMOINE_CULTUREL', 'RESTAURATION' ]
```

### 1.3 What are the possible themes for each type of point of interest in the `touristPOI` collection? List the distinct themes for each type, and sort the results by the descending order of the count of themes per type. Explain your approach, provide the query, and the first 5 results.

**Approach:**

`properties.theme` is an array (a POI can have several themes). We `$unwind` it to get one document per theme. Then we `$group` by type and collect the themes with `$addToSet` to keep them distinct. Finally a `$project` adds `nbThemes` with `$size` and we `$sort` on it in descending order.

**Query:**

```javascript
db.touristPOI.aggregate([
  { $unwind: "$properties.theme" },
  { $group: { _id: "$properties.type", themes: { $addToSet: "$properties.theme" } } },
  { $project: { nbThemes: { $size: "$themes" }, themes: 1 } },
  { $sort: { nbThemes: -1 } }
])
```

**First 5 results:**

```
{ _id: 'EQUIPEMENT',
  themes: [ 'Culture & Musées', 'Nocturne', 'Activités, Loisirs et Bien-être',
            'Lieux de spectacles', 'Lyon Pratique', 'Restaurants & Gastronomie' ],
  nbThemes: 6 }
{ _id: 'COMMERCE_ET_SERVICE',
  themes: [ 'Hébergements', 'Culture & Musées', 'Lyon Pratique',
            'Restaurants & Gastronomie', 'Shopping', 'Activités, Loisirs et Bien-être' ],
  nbThemes: 6 }
{ _id: 'ACTIVITE',
  themes: [ 'Activités, Loisirs et Bien-être', 'Agenda', 'Lyon Pratique' ],
  nbThemes: 3 }
{ _id: 'PATRIMOINE_CULTUREL',
  themes: [ 'Patrimoine - Unesco', 'Activités, Loisirs et Bien-être', 'Culture & Musées' ],
  nbThemes: 3 }
{ _id: 'RESTAURATION',
  themes: [ 'Nocturne', 'Restaurants & Gastronomie' ],
  nbThemes: 2 }
```

## Part 2 - Provide at least 3 MongoDB queries that combine the `touristPOI` collection with the velov_geo collection using the `$lookup` operator

Note: the statement mentions `velov_geo` but our velov collection is named `velov2026` (as asked in the setup instructions), so the queries below use `velov2026`.

### 2.1 First query that involves address comparison (properties.address, properties.nom, … check the fields)

**Method:**

After exploring the fields, the comparable ones are `properties.address` of a station and `properties.address.streetAddress` of a POI. The `$lookup` passes the station address as a variable and compares it to the POI street, with `$toLower` on both sides to ignore the case. We exclude empty addresses on both sides, otherwise empty matches empty. We keep only stations with at least one matching POI.

**Query:**

```javascript
db.velov2026.aggregate([
  { $match: { "properties.address": { $nin: [null, ""] } } },
  { $lookup: {
      from: "touristPOI",
      let: { street: { $toLower: "$properties.address" } },
      pipeline: [
        { $match: { "properties.address.streetAddress": { $nin: [null, ""] } } },
        { $match: { $expr: { $eq: [ { $toLower: "$properties.address.streetAddress" }, "$$street" ] } } },
        { $project: { _id: 0, nom: "$properties.nom", type: "$properties.type" } }
      ],
      as: "poisSameAddress" } },
  { $match: { "poisSameAddress.0": { $exists: true } } },
  { $project: { _id: 0, station: "$properties.name", address: "$properties.address",
                commune: "$properties.commune", poisSameAddress: 1 } }
])
```

**Results (5 stations):**

```
{ station: '1031 - PLACE DE LA PAIX', address: 'Place de la Paix', commune: 'Lyon 1er Arrondissement',
  poisSameAddress: [ { nom: 'Pilier du Couvent des Carmes', type: 'PATRIMOINE_CULTUREL' } ] }
{ station: '5006 - QUAI ROMAIN ROLLAND', address: 'Quai Romain Rolland', commune: 'Lyon 5e Arrondissement',
  poisSameAddress: [ { nom: 'The Weight of Oneself', type: 'PATRIMOINE_CULTUREL' } ] }
{ station: '1024 - ROUVILLE', address: 'Place Rouville', commune: 'Lyon 1er Arrondissement',
  poisSameAddress: [ { nom: 'La Maison aux 365 Fenêtres - Maison du Temps', type: 'PATRIMOINE_CULTUREL' } ] }
{ station: '4011 - PLACE JOANNÈS AMBRE', address: 'Place Joannès Ambre', commune: 'Lyon 4e Arrondissement',
  poisSameAddress: [ { nom: 'Théâtre de la Croix-Rousse', type: 'EQUIPEMENT' } ] }
{ station: '8030 - LAËNNEC', address: 'Rue Nungesser et Coli', commune: 'Lyon 8e Arrondissement',
  poisSameAddress: [ { nom: "Musée de l'Aviation Lyon-Corbas", type: 'PATRIMOINE_CULTUREL' } ] }
```

**Explanation:**

Only 5 stations match. The two datasets format addresses differently: POI addresses usually contain a street number, station addresses often just the street name, so the exact comparison rarely succeeds. The geographic join of 2.2 works much better.

### 2.2 Second query that implies geographic coordinate comparison. Use geographic operators. Create indexes if necessary.

**Method / indexes:**

Both collections store GeoJSON Points in `geometry`. The geographic operator `$geoNear` requires a `2dsphere` index, so we create one on each collection:

```javascript
db.touristPOI.createIndex({ geometry: "2dsphere" })
db.velov2026.createIndex({ geometry: "2dsphere" })
```

For each station, the `$lookup` pipeline runs a `$geoNear` on `touristPOI` centered on the station point (passed with `let`). `maxDistance: 250` limits to 250 m and the `query` option filters on the heritage type. We keep stations with at least one result.

**Query:**

```javascript
db.velov2026.aggregate([
  { $lookup: {
      from: "touristPOI",
      let: { stationPoint: "$geometry" },
      pipeline: [
        { $geoNear: { near: "$$stationPoint", distanceField: "distance", maxDistance: 250,
                      spherical: true, query: { "properties.type": "PATRIMOINE_CULTUREL" } } },
        { $project: { _id: 0, nom: "$properties.nom", distance: { $round: ["$distance", 0] } } }
      ],
      as: "heritageNearby" } },
  { $match: { "heritageNearby.0": { $exists: true } } },
  { $project: { _id: 0, station: "$properties.name", commune: "$properties.commune", heritageNearby: 1 } },
  { $limit: 3 }
])
```

**Results (first 3):**

```
{ station: '6004 - FOCH', commune: 'Lyon 6e Arrondissement',
  heritageNearby: [ { nom: 'Place Maréchal Lyautey', distance: 147 },
                    { nom: 'Hôtel du Gouverneur Militaire de Lyon', distance: 240 } ] }
{ station: '7035 - MARSEILLE / UNIVERSITÉ', commune: 'Lyon 7e Arrondissement',
  heritageNearby: [ { nom: "L'Immeuble Citroën", distance: 37 },
                    { nom: 'Fresque Art Nouveau - Art Déco', distance: 74 },
                    { nom: 'Le Palais Hirsch - Université de Lyon', distance: 184 },
                    { nom: 'Eglise Saint André', distance: 238 } ] }
{ station: '5015 - FULCHIRON', commune: 'Lyon 5e Arrondissement',
  heritageNearby: [ { nom: 'Pont Kitchener Marchand', distance: 36 },
                    { nom: 'Eglise Saint Laurent de Choulans', distance: 36 },
                    { nom: 'Tunnel de Fourvière', distance: 83 } ] }
```

**Explanation:**

For each station we get the PATRIMOINE_CULTUREL POIs within 250 m. `$geoNear` computes the distance in meters and sorts the POIs from nearest to farthest. Much more reliable than the address comparison of 2.1.

### 2.3 For the additional query use your imagination

**Idea:**

Compare the velov network with the number of tourist POIs per commune. Both collections have an INSEE code (`properties.code_insee` for stations, `properties.insee` for POIs) so we can join on it. We group the stations by commune, `$lookup` the POIs with the same INSEE code and compute the number of POIs per station.

**Query:**

```javascript
db.velov2026.aggregate([
  { $group: { _id: "$properties.code_insee", commune: { $first: "$properties.commune" },
              nbStations: { $sum: 1 }, totalStands: { $sum: "$properties.bike_stands" } } },
  { $lookup: { from: "touristPOI", localField: "_id", foreignField: "properties.insee", as: "pois" } },
  { $project: { _id: 0, commune: 1, nbStations: 1, totalStands: 1, nbPOI: { $size: "$pois" },
                poiPerStation: { $round: [{ $divide: [{ $size: "$pois" }, "$nbStations"] }, 1] } } },
  { $sort: { nbPOI: -1 } },
  { $limit: 5 }
])
```

**Results (top 5):**

```
{ commune: 'Lyon 2e Arrondissement', nbStations: 37, totalStands: 910, nbPOI: 276, poiPerStation: 7.5 }
{ commune: 'Lyon 5e Arrondissement', nbStations: 27, totalStands: 509, nbPOI: 157, poiPerStation: 5.8 }
{ commune: 'Lyon 1er Arrondissement', nbStations: 20, totalStands: 406, nbPOI: 136, poiPerStation: 6.8 }
{ commune: 'Lyon 3e Arrondissement', nbStations: 61, totalStands: 1462, nbPOI: 121, poiPerStation: 2 }
{ commune: 'Lyon 7e Arrondissement', nbStations: 48, totalStands: 1101, nbPOI: 88, poiPerStation: 1.8 }
```

**Explanation:**

Here the `$lookup` uses the simple `localField`/`foreignField` form, after a `$group` on the velov side. The touristic center (arrondissements 2, 5 and 1) has 6 to 7.5 POIs per station. The 3e has the most stations (61) but only 2 POIs per station, its network serves the Part-Dieu offices more than tourism.

## Part 3 - Web application

**Libraries used:** `express` (web framework), `mongodb` (official NodeJS driver). Client side, `Leaflet` (from CDN, for question 3.4).

**Files created (in `webApp/`):**

- `package.json`: project manifest and dependencies
- `server.js`: Express server and routes
- `data.js`: MongoDB connection and data access functions
- `public/index.html`: search page (questions 3.1, 3.2, 3.3)
- `public/map.html`: map visualization (question 3.4)

**Setup guide:**

```bash
cd webApp
npm install
node server.js
```

The MongoDB server must be running on `mongodb://localhost:27017` with the `20263IFMongoLab` database containing the `touristPOI` and `velov2026` collections (the server creates the required 2dsphere index on `touristPOI.geometry` at startup).

### 3.1 Create a web application using NodeJS and Express that connects to MongoDB and retrieves the unique communes of velov stations and integrates them in a dropdown list on an html page.

- `data.js` opens one shared connection to `mongodb://localhost:27017` / `20263IFMongoLab` and exposes `getCommunes()`, which runs `db.velov2026.distinct("properties.commune")` and sorts the result.
- `server.js` serves the static `public/` directory and exposes the route `GET /communes` returning the communes as JSON.
- At page load, `index.html` fetches `/communes` and fills the `<select>` with one `<option>` per commune (35 communes).

### 3.2 Modify the application so that the web page contains two drop down lists initialized with the unique communes and unique POI types and contains a search button that calls a NodeJS/Expess route that takes as parameters the commune of velov stations, the type of a POI and returns the velov station names and address of the given commune and the POI-s with the given type within a range of 500m from each velov station. Return only velov stations with at least one corresponding POI. You shall render in a table the names and addresses of velov_stations, and the corresponding POI names and themes. The table contains one raw per velov station and an embedded table for the corresponding POI-s in a cell. Divide the problem in substeps and create the solution step by step.

**Substeps:**

1. Second dropdown: same mechanism as 3.1, a route `GET /poitypes` runs `db.touristPOI.distinct("properties.type")` and fills the second `<select>` (11 types).
2. Geospatial index: `$geoNear` needs a `2dsphere` index on `touristPOI.geometry`, it is created at startup in `connect()`.
3. Search route `GET /search?commune=...&type=...&range=...`: it checks the parameters then calls `searchStations()` in `data.js`. The aggregation on `velov2026`:
   - `$match` on `properties.commune` to keep the stations of the selected commune;
   - `$lookup` to `touristPOI` with a pipeline starting with `$geoNear` centered on the station point, `maxDistance` = range in meters, and the POI type filter in the `query` option;
   - `$match` to keep only stations with at least one POI found;
   - `$project` of the station name, address and the `nearbyPOI` array (POI name + themes).
4. Rendering: the Search button fetches `/search` and builds the table in JavaScript. One row per station (name, address) and an embedded table with the POIs (name, themes joined with commas) in the last cell. If nothing matches we display a message.

For 3.2 the range was the constant 500, it becomes the slider value in 3.3.

### 3.3 Modify the application : add a slider next to the dropdown lists in the html page with values from 0 to 1000 to select the distance range in meters from the velov stations and modify the route and html page to take this distance range in account when searching the nearbyPOI-s, instead of a constant 500m.

An `<input type="range" min="0" max="1000" value="500">` is added next to the dropdowns. A `<span>` updated on the `input` event shows the current value in meters. The slider value is sent as the `range` parameter of `/search` and used as the `maxDistance` of the `$geoNear`. The same route serves 3.2 and 3.3.

### 3.4 Propose an interesting visualization of the POI dataset eventually combined with the velov stations. Explain your idea and provide the description of your solution.

**Idea:** an interactive map of Lyon showing the tourist POIs by type together with the velov network, to see if the bike-sharing coverage matches the touristic areas.

**Solution (implemented in `public/map.html`):**

- a route `GET /mapdata` returns the coordinates, name, type and themes of the 1786 POIs, and the coordinates, name, commune and capacity of the 451 stations;
- the map uses Leaflet with OpenStreetMap tiles, centered on Lyon;
- each POI is a small circle with one color per type (blue is kept for the stations), a popup shows its name, type and themes;
- each station is a blue circle whose radius depends on its capacity (`bike_stands`), with a popup (name, commune, stands);
- a legend gives the color of each type, a dropdown filters the POIs by type and a checkbox shows/hides the stations.

The map shows that the POIs are concentrated on the Presqu'île and the Vieux Lyon while the biggest stations are around Part-Dieu and the campuses, which matches the result of query 2.3.

Bonus: `public/bonus/index.html` is the same 3d map as our bonus for the previous TP (maplibre + deck gl), we used it to quickly make this bonus, reachable at http://localhost:3000/bonus/.
