let iter = 1;
let totalSpots;
let packets;

const list = {};

fetch("https://xivapi.com/FishingSpot", { mode: 'cors' })
	.then(response => response.json())
	.then(data => {
    totalSpots = parseInt(data.Pagination.ResultsTotal);
    if (typeof totalSpots === "number") {
      packets = setInterval(sendReq, 1000)
    }
  })

function sendReq() {
	console.log(iter);
	for (let i=0; i<5; i++) {
  	iter += 1;
  	fetchSpot(iter);
    if (iter === totalSpots) {
    	clearInterval(packets);
      console.log(list);
      break
    }
  }
}

function fetchSpot(i) {
	fetch("https://xivapi.com/FishingSpot/" + i, { mode: 'cors' })
	.then(response => response.json())
	.then(data => {
  	const spot = data;
  	if (spot.TerritoryTypeTargetID && spot.PlaceName.Name) {
    	//console.log(spot);
      const zoneID = spot.TerritoryTypeTargetID;
      const zoneName = spot.TerritoryType.PlaceName.Name
      const spotID = spot.ID;
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
      if (!(zoneID in list)) { list[zoneID] = [] }
    	list[zoneID].push({
      	name: spotName,
      	id: spotID,
        fishes: fishes
      })
    	//console.log(`${zoneName} ${zoneID} ${spotID} ${spotName}`)
    }
  })
}

document.getElementById("test").onclick = () => {
	downloadObject(list, "test.json")
}

// https://stackoverflow.com/a/47821215
function downloadObject(obj, filename){
  const blob = new Blob([JSON.stringify(obj, null, 2)], {type: "application/json;charset=utf-8"}).slice(2,-1);
  const url = URL.createObjectURL(blob);
  const elem = document.createElement("a");
  elem.href = url;
  elem.download = filename;
  document.body.appendChild(elem);
  elem.click();
  document.body.removeChild(elem);
}