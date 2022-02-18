let timerStart = 0, timerInterval, currentZone, currentSpot, chumEffect = false;

const container = document.getElementById("container");
const spotTitle = document.getElementById("fishing-spot");
const timer = document.getElementById("timer");
const spotFishes = document.getElementById("list");
const marker = document.getElementById("marker");

const fishingRecord = {};
// Init zone ids record
if (Object.entries(fishingRecord).length < 1) {
  for (const zone in fishingLog) {
    fishingRecord[zone] = {};
    for (const spot in fishingLog[zone]) {
      fishingRecord[zone][spot] = {}
    }
  }
}

const events = {
  start: /^You cast your line (?:in|at|on)(?: the)? (.+)\.$/,
  stop: [
    /^Something bites/,
    /^The fish gets away/,
    /^You lose your/,
    /^Nothing bites/,
    /^You (reel in|put away) your/,
    /^The fish sense something amiss/
  ],
  success: /^You land (an?|\d) .(.+) measuring ([0-9.]+) (\w+)!$/,
  exit: [
    /^You put away your/,
    /^The fish sense something amiss/
  ],
  chum: /^You gain the effect of .{2}Chum\.$/
};

addOverlayListener("ChangeZone", (e) => {
  const newZone = e.zoneID;
  currentZone = newZone;
  // console.debug(`Current zone ID: ${currentZone}`)
});

addOverlayListener("LogLine", (e) => {
  const newLog = e.line;
  if (newLog.length > 4 && newLog[0] === "00") {
    const chatLog = newLog[4];
    if (events.start.test(chatLog)) {
      const startCast = new CustomEvent("startCasting", {
        detail: {
          name: chatLog.match(events.start)[1]
        }
      });
      document.dispatchEvent(startCast)
    } else {
      for (const regex of events.stop) {
        if (regex.test(chatLog)) {
          const stopCast = new CustomEvent("stopCasting");
          document.dispatchEvent(stopCast);
          break
        }
      };
      for (const regex of events.exit) {
        if (regex.test(chatLog)) {
          const stopFishing = new CustomEvent("stopFishing");
          document.dispatchEvent(stopFishing);
          break
        }
      };
      if (events.success.test(chatLog)) {
        let total;
        const fish = chatLog.match(events.success);
        const elapsed = parseFloat(timer.innerText);
        if (/\d/.test(fish[1])) {
          total = parseInt(fish[1])
        } else {
          total = 1
        }
        const fishCaught = new CustomEvent("fishCaught", {
          detail: {
            name: fish[2],
            time: elapsed,
            size: fish[3],
            unit: fish[4],
            amount: total,
            spotID: currentSpot
          }
        });
        document.dispatchEvent(fishCaught)
      };
      if (events.chum.test(chatLog)) {
        const chumActive = new CustomEvent("chumActive");
        document.dispatchEvent(chumActive)
      }
    }
  }
});

document.addEventListener("startCasting", startCasting);
document.addEventListener("stopCasting", clearTimer);
document.addEventListener("stopFishing", () => {
  container.removeAttribute("class");
  timer.innerText = 0.0.toFixed(1); // 0.toFixed(1) will fail!
  currentSpot = null
});
document.addEventListener("fishCaught", updateLog);
document.addEventListener("chumActive", () => {
  chumEffect = true
})

function startCasting(spot) {
  timerStart = Date.now();
  if (!chumEffect) {
    document.body.parentElement.classList.remove("chum-active");
  } else {
    document.body.parentElement.classList.add("chum-active");
  }
  populateEntries(spot.detail.name);
  timer.innerText = 0.0.toFixed(1); // 0.toFixed(1) will fail!
  container.classList.add("show");
  timerInterval = window.setInterval(updateTimer, 100);
  if (marker.getAttribute("style")) {
    marker.style.width = "0px";
    marker.removeAttribute("style");
  }
  // Kinda ugly but it works for now soooo
  setTimeout(() => {
    marker.classList.add("transition");
    marker.classList.add("casting")
  }, 10)
}

function populateEntries(name) {
  // Pre-filter fishing log so you only search in relevant area
  //const spots = Object.entries(fishingLog).find(zone => zone[0] == parseInt(currentZone));
  const spots = fishingLog[currentZone];
  const regex = new RegExp(`${name}`, "i");
  for (const spot in spots) {
    if (regex.test(spots[spot].name)) {
      currentSpot = spot;
      
      spotTitle.innerText = spots[spot].name;
      // Clean items leftovers
      for (let i=0; i<10; i++) {
        const item = document.getElementById("item" + i);
        item.querySelector(".icon img").src = "";
        item.querySelector(".label .name").innerHTML = "";
        // item.querySelector(".label .window").innerHTML = "";
        item.removeAttribute("data-fishid");
        for (const tug of ["medium", "heavy", "light"]) {
          item.classList.remove(tug)
        };
        item.classList.remove("show")
      }
      // Fetch spot fishes and fill entries
      spots[spot].fishes.forEach((fish, index) => {
        const name = fish.name;
        const icon = "https://xivapi.com" + fish.icon;
        const item = document.getElementById("item" + index);
        const tug = fish.tug;
        item.querySelector(".icon img").src = icon;
        item.querySelector(".label .name").innerText = name;
        // item.querySelector(".label .window").innerHTML = "";
        item.setAttribute("data-fishid", fish.id);
        ["medium", "heavy", "light"].forEach((t, index) => {
          if (tug == index) {
            item.classList.add(t);
          }
        });
        item.classList.add("show")
      })
      break
    }
  }
}

function clearTimer() {
  if (timerInterval) {
    window.clearInterval(timerInterval);
    timerInterval = null;
    marker.style.width=getComputedStyle(marker).width;
    marker.removeAttribute("class");
  }
}

function updateTimer() {
  const raw = (Date.now() - timerStart) / 1000;
  const formatted = raw.toFixed(1);
  timer.innerText = formatted
}

function updateLog(fish) {
  let fishID, fishRecord;

  const fishName = fish.detail.name;
  const fishTime = fish.detail.time;
  // const fishSize = fish.detail.size;
  // const sizeUnit = fish.detail.unit;
  // const totalFishes = fish.detail.amount;
  const spotID = fish.detail.spotID;

  const regex = new RegExp(`${fishName}`, "i");
  for (const item of fishingLog[currentZone][currentSpot].fishes) {
    if (regex.test(item.name)) {
      fishID = item.id;
      break
    };
  }

  const spotRecord = fishingRecord[currentZone][spotID];

  // Init if no entries yet
  if (!(fishID in spotRecord)) {
    spotRecord[fishID] = {}
    spotRecord[fishID].chum = {}
  }

  if (!chumEffect) {
    fishRecord = spotRecord[fishID]
  } else {
    fishRecord = spotRecord[fishID].chum
  }

  if (!("min" in fishRecord)) {
    fishRecord.min = fishTime;
    fishRecord.max = fishTime;
    updateRecord(fishID, fishRecord)
  } else {
    if (fishTime < fishRecord.min) {
      fishRecord.min = fishTime;
      updateRecord(fishID, fishRecord)
    } else if (fishTime > fishRecord.max) {
      fishRecord.max = fishTime;
      updateRecord(fishID, fishRecord)
    }
  }

  if (chumEffect) {
    chumEffect = false
  }
}

function updateRecord(id, record) {
  let recordMark;
  if (!chumEffect) {
    recordMark = spotFishes.querySelector(`.fish[data-fishid="${id}"] .label .record`);
  } else {
    recordMark = spotFishes.querySelector(`.fish[data-fishid="${id}"] .label .recordChum`);
  }

  function getPerc(time) {
    const output = (100 * time) / 60;
    return parseFloat(output.toFixed(1))
  }

  const minMark = getPerc(record.min)
  const maxMark = (getPerc(record.max)) - minMark;
    
  recordMark.setAttribute("data-min", record.min);
  recordMark.style.left = minMark + "%";
  recordMark.setAttribute("data-max", record.max);
  recordMark.style.width = maxMark + "%"
}

function debug() {
  currentZone = 135;
  document.dispatchEvent(new CustomEvent("startCasting", {
    detail: {
      name: "the salt strand"
    }
  }));
  /* window.setTimeout(() => {
    document.dispatchEvent(new CustomEvent("stopCasting"));
  }, 10000) */
}

function debugCatch() {
  document.dispatchEvent(new CustomEvent("stopCasting"));
  const elapsed = timer.innerText;
  document.dispatchEvent(new CustomEvent("fishCaught", {
    detail: {
      name: "sea cucumber",
      time: parseFloat(elapsed),
      size: 21,
      unit: "ilms",
      amount: 1,
      spotID: currentSpot
    }
  }))
}

startOverlayEvents()
