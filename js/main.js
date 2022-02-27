"use strict";

let uuid, character, records, spot;
const settings = {}, log = {};

// Fallback in case ACT isn't running
lang = !lang ? "English" : lang;

if (!window.OverlayPluginApi || !window.OverlayPluginApi.ready) {
  console.warn("ACT is unavailable or OverlayPlugin is broken.")
  character =  {id: 0, name: "Testing"};
  if (!(character.id in settings)) initCharacter()
} else {
  uuid = window.OverlayPluginApi.overlayUuid;

  // ACT events
  document.addEventListener("changedCharacter", async (e) => {
    if (e.detail === null) return
    character = e.detail;

    // Fetch database
    await fetchDatabase();

    // Load character settings
    callOverlayHandler({ call: "loadData", key: uuid })
    .then(obj => { if (obj && obj.data) {
      Object.assign(settings, obj.data);
      if (!(character.id in settings)) {
        initCharacter()
      } else {
        records = settings[character.id].records
      }
    }})
  })
};

window.addEventListener("DOMContentLoaded", async (e) => {
  let start = 0, interval, wasChum = false;

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
  };

  // Overlay events
  document.addEventListener("startCasting", startCasting);
  document.addEventListener("fishCaught", updateLog);
  document.addEventListener("stopCasting", () => {
    html.classList.remove("casting");
    html.classList.add("marker-paused");
    if (interval) window.clearInterval(interval)
  });
  document.addEventListener("stopFishing", () => {
    html.classList.remove("fishing", "marker-active", "marker-paused");
    timer.innerText = (0).toFixed(1);
    wasChum = false
  });
  document.addEventListener("statusChange", (e) => {
    const regex = languages[lang];
    if (regex.buff[2].test(e.detail.name)) {
      if (e.detail.status === true) {
        html.classList.add("chum-active", "chum-records");
        wasChum = true
      } else {
        html.classList.remove("chum-active")
      }
    }
  });
  document.addEventListener("newSpot", (e) => { findSpot(e.detail.line) });
  marker.addEventListener("animationend", (e) => {
    // Force-stop marker animation when elapsed time reaches 60s
    if (e.elapsedTime >= 60) return

    // Redraw records considering new 60s delay
    marker.setAttribute("data-dur", 60);

    // Restart animation
    marker.removeAttribute("animated");
    html.classList.remove("marker-animated");
  	void html.offsetWidth;
  	html.classList.add("long-cast", "marker-animated")
  });
  // Redraw timeline whenever data-dur value changes
  const durationChange = new MutationObserver((list) => {
    // Prevents from running if value hasn't changed
    if (list[0].oldValue == list[0].target.getAttribute("data-dur"))
      return

    const spotRecords = records[zone][spot];
    log[zone][spot].fishes.forEach((fish, index) => {
      const item = document.getElementById("item" + index);
      if (fish.id in spotRecords) {
        let fishRecord, fishMark;
        if ("min" in spotRecords[fish.id].chum) {
          fishRecord = spotRecords[fish.id].chum;
          fishMark = item.querySelector(".label .record-chum");
          redrawRecord(fishRecord, fishMark)
        }
        if ("min" in spotRecords[fish.id]) {
          fishRecord = spotRecords[fish.id];
          fishMark = item.querySelector(".label .record");
          redrawRecord(fishRecord, fishMark)
        }
      }
    })
  });
  durationChange.observe(marker, {
    attributeFilter: ["data-dur"],
    attributeOldValue: true
  });

  // Overlay functions
  function startCasting(e) {
    const regex = languages[lang];

    // Add class toggles
    html.classList.add("fishing", "casting");
    html.classList.remove("long-cast");
    if (!html.classList.contains("chum-active") && 
    html.classList.contains("chum-records")) {
      html.classList.remove("chum-active", "chum-records");
      wasChum = false
    };

    // Reset timers before rerun
    start = Date.now();
    timer.innerText = (0).toFixed(1);
    interval = window.setInterval(() => {
      const raw = (Date.now() - start) / 1000;
      timer.innerText = raw.toFixed(1)
    }, 100);

    // Reset classes and variables
    html.classList.remove("marker-animated", "marker-paused");
    // This forces reset for keyframe animation when using "use strict"
    // Example: https://jsfiddle.net/dhngeaps/
    void html.offsetWidth;
    html.classList.add("marker-animated");
  
    // Get current spot and update list if needed
    if (regex.start[1].test(e.detail.line)) { // if undiscovered spot
      spot = undefined;
      spotTitle.innerText = "";
      resetEntries()
    } else {
      findSpot(e.detail.line)
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
          spotRecord = records[zone][spotID];

    const threshold = marker.getAttribute("data-dur");
    if (fishTime > 30 && threshold < 60) marker.setAttribute("data-dur", 60);
  
    for (const item of log[zone][spot].fishes) {
      const regex = new RegExp(`${item.name}`, "i");
      if (regex.test(fishName)) {
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
    if (wasChum) {
      fishRecord = spotRecord[fishID].chum;
      fishMark = spotFishes.querySelector(`.fish[data-fishid="${fishID}"] .label .record-chum`)
    } else {
      fishRecord = spotRecord[fishID];
      fishMark = spotFishes.querySelector(`.fish[data-fishid="${fishID}"] .label .record`)
    };

    // Reset chum bool
    wasChum = false
  
    if (!("min" in fishRecord)) {
      fishRecord.min = fishTime;
      fishRecord.max = fishTime;
      if (character.id != 0) saveSettings(settings)
      redrawRecord(fishRecord, fishMark)
    } else if (fishTime < fishRecord.min) {
      fishRecord.min = fishTime;
      if (character.id != 0) saveSettings(settings)
      redrawRecord(fishRecord, fishMark)
    } else if (fishTime > fishRecord.max) {
      fishRecord.max = fishTime;
      if (character.id != 0) saveSettings(settings)
      redrawRecord(fishRecord, fishMark)
    }
  }

  function findSpot(line) {
    const spots = log[zone];
    for (const id in spots) {
      const sanitized = spots[id].name.replace(escape, '\\$&');
      const rule = new RegExp(sanitized, "i");
      if (rule.test(line)) {
        if (id != spot) {
          spot = parseInt(id);
          spotTitle.innerText = spots[spot].name;
          resetEntries();
          populateEntries()
        } else {
          // Find highest max record and redraw timeline when needed
          const max = Math.max(...Object.values(records[zone][spot]).map(i => [ [i.max].filter(r => r !== undefined), Object.values(i).map(chum => chum.max).filter(r => r !== undefined) ]).flat());
          const newDur = max > 30 ? 60 : 30;
          marker.setAttribute("data-dur", newDur)
        }
        break
      }
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

  function populateEntries() {  
    const spotRecord = records[zone][spot];

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

  function redrawRecord(record, node) {
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

    function getPerc(time) {
      const output = (100 * time) / threshold;
      return parseFloat(output.toFixed(1))
    }
  }
});

// Core functions
async function fetchDatabase() {
  fetch("./dist/fishing-log-min.json")
  .then(res => { if (res.status >= 200 && res.status <= 299) { return res.json() } else { throw Error(res.statusText) }})
  .then(data => { 
    Object.assign(log, data)
  });
}

async function initCharacter() {
  settings[character.id] = {};
  settings[character.id].name = character.name;
  settings[character.id].records = {};
  records = settings[character.id].records;
  if (Object.values(log).length < 1) await fetchDatabase();
  initRecord()
}

function initRecord() {
  for (const zone in log) {
    records[zone] = {};
    for (const spot in log[zone]) {
      records[zone][spot] = {}
    }
  }
}

async function saveSettings(object) {
  if (typeof object !== "object" || object === null) {
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

// DEBUG
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
      spotId: spot
    }
  }))
}