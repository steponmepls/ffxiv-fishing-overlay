let lang, timerStart = 0, timerInterval, currentZone, currentSpot, chumEffect = false, wasChum = false;

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

const regex = {
  English: {
    show: [
      /^You cast your line.+\.$/
    ],
    stat: [
      /^(?:\s+. )?You (gain|lose) the effect of .{2}(.+)\.$/
    ],
    stop: [
      /^Something bites/,
      /^The fish gets away/,
      /^Nothing bites/,
      /^You reel in your line/,
    ],
    loot: [
      /^You land (an?|\d) .(.+) measuring ([0-9.]+) (\w+)!$/
    ],
    hide: [
      /^You put away your/,
      /^You reel in your line/,
      /^The fish sense something amiss/
    ]
  },
  French: {
    show: [],
    stat: [],
    stop: [],
    loot: [],
    hide: []
  },
  German: {
    show: [],
    stat: [],
    stop: [],
    loot: [],
    hide: []
  },
  Japanese: {
    show: [],
    stat: [],
    stop: [],
    loot: [],
    hide: []
  }
}

// Fetch game language from ACT settings
async function getLang() {
  const output = await callOverlayHandler({ call: 'getLanguage' });
  lang = output.language;
  if (!lang) {
    console.debug(lang)
    throw new Error("ACT is broken. Wait for an update..");
  }
}
getLang();

addOverlayListener("ChangeZone", (e) => {
  const newZone = e.zoneID;
  currentZone = newZone;
  // console.debug(`Current zone ID: ${currentZone}`)
});

addOverlayListener("LogLine", (e) => {
  const newLog = e.line;
  if (newLog.length > 4 && newLog[0] === "00" && newLog[3] === "") {
    // console.debug(newLog);
    const chatLog = newLog[4];
    const events = regex[lang];

    if (events.show[0].test(chatLog)) {
      const startCast = new CustomEvent("startCasting", {
        detail: {
          line: chatLog.match(events.show[0])[0]
        }
      });
      document.dispatchEvent(startCast)
    }
    if (events.stat[0].test(chatLog)) {
      const state = chatLog.match(events.stat[0])[1];
      const effect = chatLog.match(events.stat[0])[2];
      const bool = /gain/.test(state);
      const buffStatus = new CustomEvent("buffStatus", {
        detail: {
          name: effect,
          status: bool
        }
      });
      document.dispatchEvent(buffStatus)
    }
    for (const rule of events.stop) {
      if (rule.test(chatLog)) {
        const stopCast = new CustomEvent("stopCasting");
        document.dispatchEvent(stopCast);
        break
      }
    }
    if (events.loot[0].test(chatLog)) {
      let total;
      const fish = chatLog.match(events.loot[0]);
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
          size: parseFloat(fish[3]),
          unit: fish[4],
          amount: total,
          chum: wasChum,
          spotID: currentSpot
        }
      });
      document.dispatchEvent(fishCaught);
    }
    for (const rule of events.hide) {
      if (rule.test(chatLog)) {
        const stopFishing = new CustomEvent("stopFishing");
        document.dispatchEvent(stopFishing);
        break
      }
    }
  }
});

document.addEventListener("startCasting", startCasting);
document.addEventListener("stopCasting", clearTimer);
document.addEventListener("stopFishing", () => {
  container.removeAttribute("class");
  timer.innerText = 0.0.toFixed(1); // 0.toFixed(1) will fail!
  currentSpot = null,
  chumEffect = false,
  wasChum = false
});
document.addEventListener("fishCaught", updateLog);
document.addEventListener("buffStatus", (e) => {
  if (/\bChum\b/.test(e.detail.name)) {
    if (e.detail.status) {
      chumEffect = e.detail.status
    }
  }
})

function startCasting(e) {
  timerStart = Date.now();
  wasChum = false; // Reset for good measure
  if (!chumEffect) {
    document.body.parentElement.classList.remove("chum-active");
  } else {
    document.body.parentElement.classList.add("chum-active");
    wasChum = true
  }
  populateEntries(e.detail.line);
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

function populateEntries(line) {
  // Pre-filter fishing log so you only search in relevant area
  //const spots = Object.entries(fishingLog).find(zone => zone[0] == parseInt(currentZone));
  const spots = fishingLog[currentZone];
  for (const spot in spots) {
    const regex = new RegExp(spots[spot].name, "i");
    if (regex.test(line)) {
      currentSpot = parseInt(spot);
      
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
        const records = item.querySelectorAll("div[class*='record']");
        for (const record of records) {
          record.removeAttribute("data-min");
          record.removeAttribute("data-max");
          record.removeAttribute("style")
        }
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
  const chum = fish.detail.chum;
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

  if (!chum) {
    fishRecord = spotRecord[fishID]
  } else {
    fishRecord = spotRecord[fishID].chum
  }

  if (!("min" in fishRecord)) {
    fishRecord.min = fishTime;
    fishRecord.max = fishTime;
    updateRecord(fishID, fishRecord, chum)
  } else {
    if (fishTime < fishRecord.min) {
      fishRecord.min = fishTime;
      updateRecord(fishID, fishRecord, chum)
    } else if (fishTime > fishRecord.max) {
      fishRecord.max = fishTime;
      updateRecord(fishID, fishRecord, chum)
    }
  }
}

function updateRecord(id, record, wasChum) {
  let recordMark;
  if (!wasChum) {
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
