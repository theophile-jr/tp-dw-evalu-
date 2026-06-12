const { MongoClient } = require("mongodb");

const url = "mongodb://localhost:27017";
const dbName = "20263IFMongoLab";

const client = new MongoClient(url);
let db;

async function connect() {
  await client.connect();
  db = client.db(dbName);
  await db.collection("touristPOI").createIndex({ geometry: "2dsphere" });
  console.log(`Connected to MongoDB, database: ${dbName}`);
  return db;
}

async function getCommunes() {
  const communes = await db.collection("velov2026").distinct("properties.commune");
  return communes.sort();
}

async function getPoiTypes() {
  const types = await db.collection("touristPOI").distinct("properties.type");
  return types.sort();
}

async function searchStations(commune, poiType, range) {
  return db.collection("velov2026").aggregate([
    { $match: { "properties.commune": commune } },
    { $lookup: {
        from: "touristPOI",
        let: { stationPoint: "$geometry" },
        pipeline: [
          { $geoNear: {
              near: "$$stationPoint",
              distanceField: "distance",
              maxDistance: range,
              spherical: true,
              query: { "properties.type": poiType } } },
          { $project: { _id: 0, name: "$properties.nom", themes: "$properties.theme" } }
        ],
        as: "nearbyPOI" } },
    { $match: { "nearbyPOI.0": { $exists: true } } },
    { $project: { _id: 0, name: "$properties.name", address: "$properties.address", nearbyPOI: 1 } }
  ]).toArray();
}

async function getMapData() {
  const stations = await db.collection("velov2026").aggregate([
    { $project: { _id: 0, name: "$properties.name", commune: "$properties.commune",
                  stands: "$properties.bike_stands", coordinates: "$geometry.coordinates" } }
  ]).toArray();
  const pois = await db.collection("touristPOI").aggregate([
    { $match: { "geometry.coordinates": { $exists: true } } },
    { $project: { _id: 0, name: "$properties.nom", type: "$properties.type",
                  themes: "$properties.theme", coordinates: "$geometry.coordinates" } }
  ]).toArray();
  return { stations, pois };
}

module.exports = { connect, getCommunes, getPoiTypes, searchStations, getMapData };
