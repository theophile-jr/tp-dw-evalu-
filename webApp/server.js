const express = require("express");
const data = require("./data");

const app = express();
const port = 3000;

app.use(express.static("public"));

app.get("/communes", async (req, res) => {
  res.json(await data.getCommunes());
});

app.get("/poitypes", async (req, res) => {
  res.json(await data.getPoiTypes());
});

app.get("/search", async (req, res) => {
  const commune = req.query.commune;
  const poiType = req.query.type;
  const range = parseInt(req.query.range);
  if (!commune || !poiType || isNaN(range)) {
    return res.status(400).json({ error: "Parameters commune, type and range are required" });
  }
  res.json(await data.searchStations(commune, poiType, range));
});

app.get("/mapdata", async (req, res) => {
  res.json(await data.getMapData());
});

data.connect().then(() => {
  app.listen(port, () => {
    console.log(`Server running at http://localhost:${port}`);
  });
});
