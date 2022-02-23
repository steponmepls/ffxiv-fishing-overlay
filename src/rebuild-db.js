import fetch from 'node-fetch';
import * as fs from 'fs';

let interval;
const fishingLog = {};

initDatabase();

function initDatabase(totalSpots) {
  let iteration = 0;
  fetch("https://xivapi.com/FishingSpot", { mode: "cors"})
  .then(res => res.json())
  .then(data => {
    totalSpots = typeof totalSpots !== "number" ? parseInt(data.Pagination.ResultsTotal) : totalSpots;
    if (typeof totalSpots === "number") {
      interval = setInterval(sendReq, 1000)
    } else { // Error from XIVAPI
      console.error("XIVAPI is down or you are banned gg..");
      return
    }
  });

  function sendReq() {
    for (let i=0; i<5; i++) {
      iteration += 1;
      fetchSpot(iteration)
      if (i === 4 && iteration % 5 === 0) { // Print completion %
        console.log(parseInt((iteration * 100) / totalSpots))
      }
      if (iteration === totalSpots) { // End
        clearInterval(interval);
        console.log("Done!");
        console.log("Now merging with TeamCraft entries..");
        mergeEntries()
        break
      }
    }
  }
}

function fetchSpot(s) {
  fetch("https://xivapi.com/FishingSpot/" + s, { mode: "cors" })
  .then(res => res.json())
  .then(data => {
  	const spot = data;
  	if (spot.TerritoryTypeTargetID && spot.PlaceName.Name) {
      const zoneID = spot.TerritoryTypeTargetID;
      if (!(zoneID in fishingLog)) { fishingLog[zoneID] = {} }
      // const zoneName = spot.TerritoryType.PlaceName.Name
      const spotID = spot.ID;
      if (!(spotID in fishingLog[zoneID])) { fishingLog[zoneID][spotID] = {} }
      const spotName = spot.PlaceName.Name;
      const fishes = [];
      for (let i=0; i<9; i++) {
      	const key = "Item" + i;
      	if (spot[key] !== null) {
        	const item = spot[key];
        	const fishID = item.ID;
          const fishIcon = item.Icon;
          const fishIconHD = item.IconHD;
          const fishName = item.Name_en;
          const fishNameDE = item.Name_de;
          const fishNameFR = item.Name_fr;
          const fishNameJA = item.Name_ja;
          fishes.push({
          	id: fishID,
            icon: fishIcon,
            iconHD: fishIconHD,
            name: fishName,
            name_de: fishNameDE,
            name_fr: fishNameFR,
            name_ja: fishNameJA
          })
        } else {
        	break
        }
      }
      fishingLog[zoneID][spotID].name = spotName;
      fishingLog[zoneID][spotID].fishes = fishes
    }
  })
}

function mergeEntries() {
  let tc;

  if (Object.values(fishingLog).length < 1) {
    console.error("No input from XIVAPI?");
    return
  }

  fetch("https://gubal.hasura.app/api/rest/allagan_reports_by_source/FISHING")
  .then(res => res.json())
  .then(data => {
    tc = Object.values(data.allagan_reports);
    parseFishes();
  })

  function parseFishes() {
    for (const fish of tc) {
      let data;
      const id = fish.itemId;
  
      if (typeof(fish.data) === "string") {
        data = JSON.parse(fish.data);
      } else {
        data = fish.data
      }
      const spotId = data.spot;
    
      for (const zone in fishingLog) {
        if (spotId in fishingLog[zone]) {
          const spot = fishingLog[zone][spotId];
          for (const item of spot.fishes) {
            if (item.id == id) {
              for (const key in data) {
                if (/spot/.test(key) === false) {
                  item[key] = data[key];
                }
              }
              break
            }
          }
          break
        }
      }
    }
    console.log("Updating output file..");
    fs.writeFileSync("./fishing-log.json", JSON.stringify(fishingLog, null, 4));
    fs.writeFileSync("../dist/fishing-log-min.json", JSON.stringify(fishingLog));
    console.log("File saved!")
  }
}