import fetch from 'node-fetch';
import * as fs from 'fs';

let interval;
const fishingLog = {};

fetch("https://xivapi.com/FishingSpot", { mode: "cors"})
.then(res => res.json())
.then(data => {
  const pageTotal = data.Pagination.PageTotal;

  for (let i=0; i<pageTotal; i++) {
    fetch("https://xivapi.com/FishingSpot?page=" + (i + 1), { mode: "cors"})
    .then(res => res.json())
    .then(data => {
      let iteration = 0;
      const max = data.Pagination.Results;
      console.log("Page " + (i +1) + "..");
      interval = setInterval(sendReq, 1000, data.Results, max)
    })
  };

  console.log("Done!");
  console.log("Now merging with TeamCraft entries..");
  mergeEntries()
});

function sendReq(results, total) {
  for (let i=0; i<5; i++) {
    iteration += 1;
    fetchSpot(results[iteration].ID);
    if (iteration === total) { // End
      clearInterval(interval);
      break
    }
  }
}

function fetchSpot(s) {
  fetch("https://xivapi.com/FishingSpot/" + s, { mode: "cors" })
  .then(res => res.json())
  .then(data => {
    if (!("PlaceName" in data) || data.PlaceName === null) return;

    const spot = data;
    const zoneID = (spot.ID > 146 && spot.ID < 155) ? 939 : spot.TerritoryTypeTargetID;
    if (!(zoneID in fishingLog)) { fishingLog[zoneID] = {} }
    // const zoneName = spot.TerritoryType.PlaceName.Name
    const spotID = spot.ID;
    if (!(spotID in fishingLog[zoneID])) { fishingLog[zoneID][spotID] = {} }
    const spotNameEN = spot.PlaceName.Name_en,
          spotNameDE = spot.PlaceName.Name_de,
          spotNameFR = spot.PlaceName.Name_fr,
          spotNameJA = spot.PlaceName.Name_ja,
          fishes = [];
    for (let i=0; i<10; i++) {
      const key = "Item" + i;
      if (spot[key] !== null) {
        const item = spot[key],
              fishID = item.ID,
              fishIcon = item.Icon,
              fishIconHD = item.IconHD,
              fishNameEN = item.Name_en,
              fishNameDE = item.Name_de,
              fishNameFR = item.Name_fr,
              fishNameJA = item.Name_ja;

        fishes.push({
          id: fishID,
          icon: fishIcon,
          iconHD: fishIconHD,
          name_en: fishNameEN,
          name_de: fishNameDE,
          name_fr: fishNameFR,
          name_ja: fishNameJA
        })
      }
    }
    fishingLog[zoneID][spotID].name_en = spotNameEN;
    fishingLog[zoneID][spotID].name_de = spotNameDE;
    fishingLog[zoneID][spotID].name_fr = spotNameFR;
    fishingLog[zoneID][spotID].name_ja = spotNameJA;
    fishingLog[zoneID][spotID].fishes = fishes
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
                  if (!(key in item)) item[key] = data[key]
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