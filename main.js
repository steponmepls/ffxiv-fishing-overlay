"use strict";

let settings, character, zone, spot, log, records;
const uuid = OverlayPluginApi.overlayUuid;

// Load settings and copy result to be edited in local object
loadSettings();

// Keep track of currently playing character name and ID
document.addEventListener("changedCharacter", (e) => { character = e.detail });

window.addEventListener('DOMContentLoaded', async (e) => {
  let start = 0, interval, chumEnabled = false, wasChum = false;

  const html = document.body.parentElement;
  const container = document.getElementById("container");
  const spotTitle = document.getElementById("spot");
  const timer = document.getElementById("timer");
  const spotFishes = document.getElementById("entries");
  const marker = document.getElementById("marker").querySelector(".markline");
  const escape = /[-\/\\^$*+?.()|[\]{}]/g;

  // Overlay events
  document.addEventListener("startCasting", startCasting);
  document.addEventListener("fishCaught", updateLog);
  document.addEventListener("stopCasting", () => {
    html.classList.remove("casting");
    marker.style.animationPlayState = "paused";
    if (interval)
      window.clearInterval(timerInterval);
  });
  document.addEventListener("stopFishing", () => {
    html.classList.remove("fishing");
    marker.removeAttribute("style");
    html.classList.remove("marker-active");
    timer.innerText = (0).toFixed(1);
    chumEffect = false;
    wasChum = false
  });
  document.addEventListener("newStatus", (e) => {
    if (/\bChum\b/.test(e.detail.name)) {
      if (e.detail.status) {
        chumEnabled = e.detail.status
      }
    }
  })
  document.addEventListener("newSpot", (e) => { findSpot(e.detail.line) });

  // Overlay functions
  function startCasting(e) {
    const regex = languages[lang];

    // Reset timers before rerun
    start = Date.now();
    timer.innerText = (0).toFixed(1);
    interval = window.setInterval(() => {
      const raw = (Date.now() - start) / 1000;
      timer.innerText = raw.toFixed(1)
    }, 100);
  
    // Reset classes and variables
    html.classList.add("fishing");
    html.classList.remove("marker-active");
    // This forces reset for keyframe animation when using "use strict"
    // Example: https://jsfiddle.net/dhngeaps/
    void html.offsetWidth;
    marker.removeAttribute("style");
    wasChum = false;

    // Add class toggles
    html.classList.add("casting");
    if (!chumEnabled) {
      html.classList.remove("chum-active")
    } else {
      html.classList.add("chum-active");
      wasChum = true
    }
  
    if (regex.show[1].test(e.detail.line)) {
      currentSpot = undefined;
      spotTitle.innerText = "";
      resetEntries()
    } else {
      findSpot(e.detail.line)
      html.classList.add("marker-active")
    }
  }

  function resetEntries() {
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
    }
  }

  function findSpot(line) {
    const spots = log[zone];
    for (const s in spots) {
      const sanitized = spots[s].name.replace(escape, '\\$&');
      const rule = new RegExp(sanitized, "i");
      if (rule.test(line)) {
        if (s != spot) {
          spot = parseInt(s);
          spotTitle.innerText = spots[spot].name;
          resetEntries();
          populateEntries()
        }
        break
      }
    }
  }

  function populateEntries() {
    const spots = log[zone];
  
    spots[spot].fishes.forEach((fish, index) => {
      const item = document.getElementById("item" + index);
      const name = fish.name;
      const icon = "https://xivapi.com" + fish.icon;
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
      // Add record marks
      const spotRecord = records[zone][spot];
      if (fish.id in spotRecord) {
        let fishRecord, fishMark;
        if ("min" in spotRecord[fish.id].chum) {
          fishRecord = spotRecord[fish.id].chum;
          fishMark = spotFishes.querySelector(`.fish[data-fishid="${fish.id}"] .label .record-chum`);
          redrawRecord(fishRecord, fishMark)
        }
        if ("min" in spotRecord[fish.id]) {
          fishRecord = spotRecord[fish.id];
          fishMark = spotFishes.querySelector(`.fish[data-fishid="${fish.id}"] .label .record`);
          redrawRecord(fishRecord, fishMark)
        }
      }
    })
  }

  function redrawRecord(record, mark) {
    let minMark = getPerc(record.min)
    let maxMark = (getPerc(record.max)) - minMark;
  
    function getPerc(time) {
      const output = (100 * time) / 60;
      return parseFloat(output.toFixed(1))
    }
  
    // Sanitize values >= 60s
    if (minMark >= 100) {
      minMark = 99;
      if (maxMark >= 100) {
        maxMark = 1;
      }
    } else if (maxMark >= 100) {
      maxMark = 100 - minMark
    }
      
    mark.setAttribute("data-min", record.min);
    mark.style.left = minMark + "%";
    mark.setAttribute("data-max", record.max);
    mark.style.width = maxMark + "%"
  }

  function updateLog(fish) {
    let fishID;
  
    const fishName = fish.detail.name;
    const fishTime = fish.detail.time;
    // const fishSize = fish.detail.size;
    // const sizeUnit = fish.detail.unit;
    // const totalFishes = fish.detail.amount;
    const chum = fish.detail.chum;
    const spotID = fish.detail.spotID;
    const spotRecord = records[zone][spotID];
  
    const regex = new RegExp(`${fishName}`, "i");
    for (const item of spotRecord.fishes) {
      if (regex.test(item.name)) {
        fishID = item.id;
        break
      };
    }
  
    // Init if no entries yet
    if (!(fishID in spotRecord)) {
      spotRecord[fishID] = {}
      spotRecord[fishID].chum = {}
    }
  
    // Pick either chum or normal mark for a fish
    let fishRecord, fishMark;
    if (chum) {
      fishRecord = spotRecord[fishID].chum;
      fishMark = spotFishes.querySelector(`.fish[data-fishid="${fishID}"] .label .record-chum`);
    } else {
      fishRecord = spotRecord[fishID];
      fishMark = spotFishes.querySelector(`.fish[data-fishid="${fishID}"] .label .record`);
    }
  
    if (!("min" in fishRecord)) {
      fishRecord.min = fishTime;
      fishRecord.max = fishTime;
      redrawRecord(fishRecord, fishMark)
    } else {
      if (fishTime < fishRecord.min) {
        fishRecord.min = fishTime;
        redrawRecord(fishRecord, fishMark)
      } else if (fishTime > fishRecord.max) {
        fishRecord.max = fishTime;
        redrawRecord(fishRecord, fishMark)
      }
    }
  }
});

// Fetch cached database from GitHub
fetch("https://steponmepls.github.io/fishing-overlay/fishinglog.json")
.then(res => { if (res.status >= 200 && res.status <= 299) { return res.json() } else { throw Error(res.statusText) }})
.then(data => {
  log = data;

  // Init records if needed
  if (character && !(character.id in settings.characters))
    initCharacter()
});

// ACT functions
async function saveSettings(object) {
  if (typeof object !== "object") {
    console.error("Couldn't save settings. Argument isn't an object.");
    console.debug(object);
    return
  }

  await callOverlayHandler({
    call: "saveData",
    key: uuid,
    data: object
  })
}

async function loadSettings() { // Use it only once when ACT/Overlay restarts
  const object = await callOverlayHandler({ call: "loadData", key: uuid });
  if (!(object && object.data)) {
    throw new Error("Couldn't load ACT settings.");
  } else {
    if (!settings)
      settings = object.data;

    // Init if necessary
    if (!("characters" in settings))
      settings.characters = {};

    // If records of current character exist
    if (character && character.id in settings.characters) {
      records = settings.characters[character.id].records
    }
  }
}

function initCharacter() {
  const characters = settings.characters;

  characters[character.id] = {};
  characters[character.id].name = character.name;
  characters[character.id].records = {};

  // Pre-fill records by iterating log zones and spots
  for (const zone in log) {
    characters[character.id].records[zone] = {};
    for (const spot in log[zone]) {
      characters[character.id].records[zone][spot] = {}
    }
  }
}

// Debug functions
function debug() {
  zone = 135;
  lang = "English";
  document.dispatchEvent(new CustomEvent("startCasting", {
    detail: {
      line: "the salt strand"
    }
  }));
  /* window.setTimeout(() => {
    document.dispatchEvent(new CustomEvent("stopCasting"));
  }, 3000) */
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