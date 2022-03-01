"use strict";

let uuid, character, spot;
const settings = {}, log = {};

fetch("./dist/fishing-log-min.json")
.then(res => { if (res.status >= 200 && res.status <= 299) { return res.json() } else { throw Error(res.statusText) }})
.then(data => {
  Object.assign(log, data);
  if (Object.values(settings[character.id].records).length < 1) initRecord();
} );

// Fallback in case ACT isn't running
lang = !lang ? "English" : lang;
nameLang = !nameLang ? "en" : nameLang;

if (!window.OverlayPluginApi || !window.OverlayPluginApi.ready) {
  character =  {id: 0, name: "Testing"};
  if (!(character.id in settings)) initCharacter();
  console.warn("ACT is unavailable or OverlayPlugin is broken.")
} else {
  uuid = window.OverlayPluginApi.overlayUuid;

  // ACT events
  document.addEventListener("changedCharacter", async (e) => {
    if (e.detail === null) return
    character = e.detail;
    loadSettings()
  })
};

window.addEventListener("DOMContentLoaded", async (e) => {
  let interval, start = 0, wasChum = false;

  const html = document.body.parentElement,
        spotTitle = document.getElementById("spot"),
        timer = document.getElementById("timer"),
        spotFishes = document.getElementById("entries"),
        marker = document.getElementById("marker").querySelector(".markline"),
        msgOutput = document.getElementById("output-msg"),
        escaped = /[-\/\\^$*+?.()|[\]{}]/g;

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

  // Import / Export settings
  const importButton = document.getElementById("import-settings"),
        importField = importButton.querySelector("input");
  importButton.onclick = () => { importField.click() };
  importField.addEventListener("change", importSettings);
  const exportButton = document.getElementById("export-settings");
  exportButton.addEventListener("click", exportSettings);

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
  document.addEventListener("newMessage", (e) => {
    const msg = e.detail.msg,
          type = e.detail.type;

    msgOutput.innerText = msg;
    setTimeout(() => { msgOutput.innerText = "" }, 3000)
  });
  // Redraw timeline whenever data-dur value changes
  const durationChange = new MutationObserver((list) => {
    // Prevents from running if value hasn't changed
    if (list[0].oldValue == list[0].target.getAttribute("data-dur")) return

    const spotRecord = settings[character.id].records[zone][spot];
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
  });
  durationChange.observe(marker, {
    attributeFilter: ["data-dur"],
    attributeOldValue: true
  });
  document.addEventListener("reloadEntries", () => {
    resetEntries();
    populateEntries()
  });

  // Overlay functions
  function startCasting(e) {
    const regex = languages[lang];

    // Add class toggles
    html.classList.add("fishing", "casting");

    // Reset timers before rerun
    start = Date.now();
    timer.innerText = (0).toFixed(1);
    interval = window.setInterval(() => {
      const raw = (Date.now() - start) / 1000;
      timer.innerText = raw.toFixed(1)
    }, 100);

    // Reset classes and variables
    html.classList.remove("marker-animated", "marker-paused", "long-cast");
    if (!html.classList.contains("chum-active") && html.classList.contains("chum-records")) {
      html.classList.remove("chum-active", "chum-records");
      wasChum = false
    };
    // This forces reset for keyframe animation when using "use strict"
    // Example: https://jsfiddle.net/dhngeaps/
    void html.offsetWidth;
    html.classList.add("marker-animated");
  
    // Get current spot and update list if needed
    if (regex.start[1].test(e.detail.line)) { // if undiscovered spot
      spot = undefined;
      spotTitle.innerText = "";
      spotTitle.title = "";
      resetEntries()
    } else if (regex.start[2].test(e.detail.line)) {
      return
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
          spotRecord = settings[character.id].records[zone][spotID];

    const threshold = marker.getAttribute("data-dur");
    if (fishTime > 30 && threshold < 60) marker.setAttribute("data-dur", 60);

    for (const item of log[zone][spot].fishes) {
      const regex = new RegExp(`${item["name_" + nameLang]}`, "i");
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
      const sanitized = spots[id]["name_" + nameLang].replace(escaped, '\\$&');
      const rule = new RegExp(sanitized, "i");
      if (rule.test(line)) {
        if (id != spot) {
          spot = parseInt(id);
          spotTitle.innerText = spots[spot]["name_" + nameLang];
          spotTitle.title = `${zone} / ${spot}`;
          resetEntries();
          populateEntries()
        } else { // Reset
          if (marker.getAttribute("data-dur") > 30 && getMax() <= 30)
            marker.setAttribute("data-dur", 30)
        };
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
    const spotRecord = settings[character.id].records[zone][spot];

    // Find highest max record and redraw timeline when needed
    const newDur = getMax() > 30 ? 60 : 30;

    log[zone][spot].fishes.forEach((fish, index) => {
      const item = document.getElementById("item" + index),
            name = fish["name_" + nameLang],
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
          redrawRecord(fishRecord, fishMark, newDur)
        }
        if ("min" in spotRecord[fish.id]) {
          fishRecord = spotRecord[fish.id];
          fishMark = item.querySelector(".label .record");
          redrawRecord(fishRecord, fishMark, newDur)
        }
      }
    });

    marker.setAttribute("data-dur", newDur)
  }

  function redrawRecord(record, node, dur) {
    const threshold = (dur) ? dur : marker.getAttribute("data-dur");

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

  function getMax() {
    return Math.max(...Object.values(settings[character.id].records[zone][spot]).map(i => [ [i.max].filter(r => r !== undefined), Object.values(i).map(chum => chum.max).filter(r => r !== undefined) ]).flat())
  }
});

// Core functions
async function initCharacter() {
  settings[character.id] = {};
  settings[character.id].name = character.name;
  settings[character.id].records = {};
  if (Object.values(log) > 0) initRecord()
}

function initRecord() {
  for (const zone in log) {
    settings[character.id].records[zone] = {};
    for (const spot in log[zone]) {
      settings[character.id].records[zone][spot] = {}
    }
  }
}

async function saveSettings(object) {
  if (typeof object !== "object" || object === null) {
    console.error("Couldn't save settings. Argument isn't an object.");
    console.debug(object);
    return
  }

  callOverlayHandler({ call: "saveData", key: uuid, data: object })
}

async function loadSettings() {
  callOverlayHandler({ call: "loadData", key: uuid })
  .then(obj => { if (obj && obj.data) {
    Object.assign(settings, obj.data);
    if (!(character.id in settings)) initCharacter()
  }})
}

async function importSettings(e) {
  let files = e.target.files;
  if (files.length == 0) return;

  const file = files[0];
  let reader = new FileReader();

  reader.onload = async (e) => {
    const file = JSON.parse(e.target.result);
    Object.assign(settings, file);
    await saveSettings(file);
    if (!(character.id in settings)) initCharacter();
    document.dispatchEvent(new CustomEvent("reloadEntries"))
  };

  reader.onerror = (e) => console.error(e.target.error.name);

  reader.readAsText(file);
}

async function exportSettings() {
  if (!settings || Object.values(settings).legnth < 1) {
    console.error("Failed to export settings");
    console.debug(settings);
    return
  };
  const data = JSON.stringify(settings);
  const field = document.createElement("input");
  field.type = "text";
  field.setAttribute("value", data);
  document.body.appendChild(field);
  field.select();
  // Deprected method but no way around it since clipboard API won't work in ACT
  document.execCommand("copy");
  document.body.removeChild(field);
}

function sendMessage(message, priority) {
  document.dispatchEvent(new CustomEvent("newMessage", {
    detail: {
      msg: message,
      type: priority
    }
  }))
};

// DEBUG
function debug(delay) {
  zone = 135;
  document.dispatchEvent(new CustomEvent("startCasting", {
    detail: {
      line: "the salt strand"
    }
  }));

  if (!delay) return

  window.setTimeout(() => {
    document.dispatchEvent(new CustomEvent("stopCasting"));
  }, delay)
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