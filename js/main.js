"use strict";

let settings, character, zone, spot, log, records;
const uuid = OverlayPluginApi.overlayUuid;

// Load settings and copy result to be edited in local object
loadSettings();

// Keep track of currently playing character name and ID
document.addEventListener("changedCharacter", (e) => { character = e.detail });

// Fetch cached database from GitHub
fetch("https://steponmepls.github.io/fishing-overlay/dist/fishing-log-min.json")
.then(res => { if (res.status >= 200 && res.status <= 299) { return res.json() } else { throw Error(res.statusText) }})
.then(data => {
  log = data;

  // Init records if needed
  if (character && !(character.id in settings.characters))
    initCharacter()
});

window.addEventListener('DOMContentLoaded', async (e) => {
  let start = 0, interval, chumEnabled = false, wasChum = false;

  const html = document.body.parentElement,
        spotTitle = document.getElementById("spot"),
        timer = document.getElementById("timer"),
        spotFishes = document.getElementById("entries"),
        marker = document.getElementById("marker").querySelector(".markline"),
        escape = /[-\/\\^$*+?.()|[\]{}]/g;

  // Init 1->10 fish nodes
  for (let i=0; i<10; i++) {
    const fish = document.createElement("div");
    fish.id = "item" + i;
    fish.classList.add("fish", "flex");
    fish.innerHTML = `<div class="icon"><img src=""></div>
    <div class="label flex">
      <div class="record"></div>
      <div class="record-chum"></div>
      <div class="name"></div>
      <div class="window"></div>
    </div>`;
    spotFishes.appendChild(fish)
  }

  // Overlay events
  document.addEventListener("startCasting", startCasting);
  document.addEventListener("fishCaught", updateLog);
  document.addEventListener("stopCasting", () => {
    html.classList.remove("casting");
    html.classList.add("marker-paused");
    if (interval)
      window.clearInterval(interval)
  });
  document.addEventListener("stopFishing", () => {
    html.classList.remove("fishing", "marker-paused");
    html.classList.remove("marker-active");
    timer.innerText = (0).toFixed(1);
    chumEnabled = false;
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

  // Redraw records on a 60s bar when needed
  marker.addEventListener("animationend", (e) => {
    // Force-stop marker animation when elapsed time reaches 60s
    if (e.elapsedTime >= 60) {
      return
    }

    // Set new duration + delay for animation
    html.classList.add("long-casts");

    // Redraw records considering new 60s delay
    redrawRecords();

    // Restart animation
    html.classList.remove("casting");
  	void html.offsetWidth;
  	html.classList.add("casting")
  })

  // Overlay functions
  function startCasting(e) {
    const regex = languages[lang];

    // Reset classes and variables
    html.classList.remove("marker-paused");
    // This forces reset for keyframe animation when using "use strict"
    // Example: https://jsfiddle.net/dhngeaps/
    void html.offsetWidth;

    // Add class toggles
    html.classList.add("fishing", "casting");
    if (!chumEnabled) {
      html.classList.remove("chum-active");
      wasChum = false
    } else {
      html.classList.add("chum-active");
      wasChum = true
    }

    // Reset timers before rerun
    start = Date.now();
    timer.innerText = (0).toFixed(1);
    interval = window.setInterval(() => {
      const raw = (Date.now() - start) / 1000;
      timer.innerText = raw.toFixed(1)
    }, 100);

    const threshold = marker.getAttribute("data-dur");
    if (html.classList.contains("long-casts") && threshold < 60)
      redrawRecords();
  
    // Get current spot and update list if needed
    if (regex.show[1].test(e.detail.line)) {
      currentSpot = undefined;
      spotTitle.innerText = "";
      resetEntries()
    } else {
      findSpot(e.detail.line)
    }
  }

  function resetEntries() {
    marker.setAttribute("data-dur", 30);
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
    const spotRecord = records[zone][spot];

    // Find highest max values in the current spot records, both for normal and chum, and check if > 30s
    const max = Math.max(...Object.values(spotRecord).map(item => {
      return [item.max, Object.values(item).filter(key => typeof key === "object").map(chum => chum.max)].flat()
    }).flat());
    if (max > 30) marker.setAttribute("data-dur", 60);

    log[zone][spot].fishes.forEach((fish, index) => {
      const item = document.getElementById("item" + index),
            name = fish.name,
            icon = "https://xivapi.com" + fish.icon,
            tug = fish.tug;
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
      if (fish.id in spotRecord) {
        let fishRecord, fishMark;
        if ("min" in spotRecord[fish.id].chum) {
          fishRecord = spotRecord[fish.id].chum;
          fishMark = item.querySelector(".label .record-chum");
          redrawRecord(fishRecord, fishMark)
        }
        if ("min" in spotRecord[fish.id]) {
          fishRecord = spotRecord[fish.id];
          fishMark = item.querySelector(".label .record");
          redrawRecord(fishRecord, fishMark)
        }
      }
    })
  }

  function redrawRecords() {
    const spotRecord = records[zone][spot];
    log[zone][spot].fishes.forEach((fish, index) => {
      const item = document.getElementById("item" + index);
      if (fish.id in spotRecord) {
        let fishRecord, fishMark;
        if ("min" in spotRecord[fish.id].chum) {
          fishRecord = spotRecord[fish.id].chum;
          fishMark = item.querySelector(".label .record-chum");
          redrawRecord(fishRecord, fishMark)
        }
        if ("min" in spotRecord[fish.id]) {
          fishRecord = spotRecord[fish.id];
          fishMark = item.querySelector(".label .record");
          redrawRecord(fishRecord, fishMark)
        }
      }
    })
  }

  function redrawRecord(record, node, oneshot) {
    const threshold = marker.getAttribute("data-dur");

    let minMark = getPerc(record.min)
    let maxMark = (getPerc(record.max)) - minMark;
    
    // Sanitize values >= 60s
    if (minMark >= 100) {
      minMark = 99;
      if (maxMark >= 100) {
        maxMark = 1;
      }
    } else if (maxMark >= 100) {
      maxMark = 100 - minMark
    }
      
    node.setAttribute("data-min", record.min);
    node.style.left = minMark + "%";
    node.setAttribute("data-max", record.max);
    node.style.width = maxMark + "%";

    if (threshold < 60 && oneshot) marker.setAttribute("data-dur", 30);

    function getPerc(time) {
      const output = (100 * time) / threshold;
      return parseFloat(output.toFixed(1))
    }
  }

  function updateLog(fish) {
    let fishID;

    const fishName = fish.detail.name,
          fishTime = fish.detail.time,
          // fishSize = fish.detail.size,
          // sizeUnit = fish.detail.unit,
          // totalFishes = fish.detail.amount,
          spotID = fish.detail.spotId,
          spotRecord = records[zone][spotID],
          chum = wasChum;

    const threshold = marker.getAttribute("data-dur");
    if (fishTime > 30 && threshold < 60) marker.setAttribute("data-dur", 60);
  
    const regex = new RegExp(`${fishName}`, "i");
    for (const item of log[zone][spot].fishes) {
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
      settings.characters = {}
  }
}

function initCharacter() {
  const characters = settings.characters;

  characters[character.id] = {};
  characters[character.id].name = character.name;
  characters[character.id].records = {};

  records = characters[character.id].records;

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