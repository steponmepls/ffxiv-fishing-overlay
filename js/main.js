"use strict";

let lang, langId, uuid, character, spot, msgTimeout;
const settings = {}, log = {};

fetch("./dist/fishing-log-min.json")
.then(res => res.json())
.then(data => { if (data) Object.assign(log, data) });

if (!window.OverlayPluginApi || !window.OverlayPluginApi.ready) {
  console.warn("ACT is unavailable or OverlayPlugin is broken.");
  character = {id: 0, name: "Testing"};
  if (!(character.id in settings)) initCharacter();
  lang = !lang ? "English" : lang;
  langId = !langId ? "en" : langId
} else {
  // Fetch overlay key
  uuid = window.OverlayPluginApi.overlayUuid;

  if (window.callOverlayHandler) {
    // Update character+settings when needed
    document.addEventListener("changedCharacter", (e) => {
      character = e.detail;
      callOverlayHandler({ call: "loadData", key: uuid })
        .then(obj => { if (obj && obj.data) {
          Object.assign(settings, obj.data);
          if (!(character.id in settings)) initCharacter()
        }})
    });

    // Fetch language from ACT settings
    callOverlayHandler({ call: "getLanguage" })
    .then(res => { lang = ("language" in res) ? res.language : "English";
      if (lang == "English") { langId = "en" } 
      else if (lang == "German") { langId = "de" } 
      else if (lang == "French") { langId = "fr" } 
      else if (lang == "Japanese") { langId = "ja" };

      // Fallback till regex for other languages is finished
      if (languages[lang].start.length < 1) {
        lang = "English";
        langId = "en"
      }
    })
  }
};

window.addEventListener("DOMContentLoaded", async (e) => {
  let interval, start = 0, wasChum = false;

  const html = document.body.parentElement,
        title = document.getElementById("spot"),
        timer = document.getElementById("timer"),
        fishes = document.getElementById("entries"),
        marker = document.getElementById("marker").querySelector(".markline"),
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
      <div class="req flex"><i class="hook"></i><i class="tug"></i></div>
    </div>`;
    fishes.appendChild(fish);
    fish.querySelector(".label .name").onclick = (e) => {
      const item = e.target.parentElement.parentElement,
            id = parseInt(item.getAttribute("data-fishid"));
      if (!id || typeof id !== "number") return;

      copyToClipboard("https://www.garlandtools.org/db/#item/" + id);
      sendMessage("Copied link to clipboard.")
    };
  };

  // Import/Export settings
  const settingsToggle = document.getElementById("show-settings"),
        settingsPanel = document.getElementById("settings"),
        settingsImport = settingsPanel.querySelector(".overlay.import"),
        settingsInput = settingsImport.querySelector("input"),
        settingsExport = settingsPanel.querySelector(".overlay.export"),
        progressExport = settingsPanel.querySelector(".carbuncle-plushy button");

  settingsToggle.onclick = () => { 
    html.classList.toggle("show-settings"); 
    html.classList.remove("manual-settings") 
  };
  settingsImport.querySelector("button").onclick = () => { settingsInput.click() };
  settingsInput.value = null; // Apparently needed to clear input on reload
  settingsInput.onclick = (e) => { importSettings(e) };
  settingsExport.querySelector(".current").onclick = () => { exportSettings(character.id) };
  settingsExport.querySelector(".all").onclick = () => { exportSettings() };
  progressExport.onclick = () => { exportCarbPlushy() };

  // Overlay events
  document.addEventListener("startCasting", startCasting);
  document.addEventListener("fishCaught", updateLog);
  document.addEventListener("newSpot", (e) => { findSpot(e.detail.line) });
  document.addEventListener("stopCasting", () => {
    html.classList.remove("casting");
    html.classList.add("marker-paused");
    if (interval) window.clearInterval(interval)
  });
  marker.addEventListener("animationend", (e) => {
    // Force-stop marker animation when elapsed time reaches 60s
    if (e.elapsedTime >= 45) return

    // Redraw records considering new 60s delay
    marker.setAttribute("data-dur", 45);

    // Restart animation
    html.classList.remove("marker-animated");
    void html.offsetWidth;
    html.classList.add("long-cast", "marker-animated")
  });
  document.addEventListener("stopFishing", () => {
    html.classList.remove("fishing", "marker-animated", "marker-paused");
    title.innerText = "";
    timer.innerText = "";
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
  document.addEventListener("manualSettings", () => {
    if (html.classList.contains("fishing")) return;
    html.classList.toggle("manual-settings");
    html.classList.add("show-settings")
  });

  // Redraw timeline whenever data-dur value changes
  const durationChange = new MutationObserver((list) => {
    // Prevents from running if value hasn't changed
    if (list[0].oldValue == list[0].target.getAttribute("data-dur")) return

    const records = settings[character.id].records;
    if (!(zone in records) || !(spot in records[zone])) return;

    const spotRecords = records[zone][spot];

    log[zone][spot].fishes.forEach((fish, index) => {
      const item = document.getElementById("item" + index);
      if (fish.id in spotRecords) {
        let fishRecord, fishMark;
        if ("chum" in spotRecords[fish.id] && "min" in spotRecords[fish.id].chum) {
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
    html.classList.remove("marker-animated", "marker-paused", "long-cast", "manual-settings");
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
      title.innerText = "???";
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
          records = settings[character.id].records;

    const threshold = marker.getAttribute("data-dur");
    if (fishTime > 30 && threshold < 45) marker.setAttribute("data-dur", 45);

    for (const item of log[zone][spot].fishes) {
      const regex = new RegExp(`${item["name_" + langId]}`, "i");
      if (regex.test(fishName)) {
        fishID = item.id;
        break
      };
    }
  
    // Init if no entries yet
    if (!(zone in records)) records[zone] = {};
    if (!(spot in records[zone])) records[zone][spot] = {};
    const spotRecords = records[zone][spot];

    if (!(fishID in spotRecords)) {
      records[zone][spot][fishID] = {}
    }
  
    // Pick either chum or normal mark for a fish
    let fishRecord, fishMark;
    if (wasChum) {
      if (!("chum" in spotRecords[fishID])) spotRecords[fishID].chum = {};
      fishRecord = spotRecords[fishID].chum;
      fishMark = fishes.querySelector(`.fish[data-fishid="${fishID}"] .label .record-chum`)
    } else {
      fishRecord = spotRecords[fishID];
      fishMark = fishes.querySelector(`.fish[data-fishid="${fishID}"] .label .record`)
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
      const sanitized = spots[id]["name_" + langId].replace(escaped, '\\$&');
      const rule = new RegExp(sanitized, "i");
      if (rule.test(line)) {
        title.innerText = spots[id]["name_" + langId];
        if (id != spot) {
          spot = parseInt(id);
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
      item.removeAttribute("data-hook");
      item.removeAttribute("data-tug");
      const records = item.querySelectorAll("div[class*='record']");
      for (const record of records) {
        record.removeAttribute("data-min");
        record.removeAttribute("data-max");
        record.removeAttribute("style")
      }
    }
  }

  function populateEntries() {  
    let newDur = 30;
    const records = settings[character.id].records;

    log[zone][spot].fishes.forEach((fish, index) => {
      const item = document.getElementById("item" + index),
            name = fish["name_" + langId],
            icon = "https://xivapi.com" + fish.icon,
            tug = fish.tug,
            hook = fish.hookset;
      item.querySelector(".icon img").src = icon;
      item.querySelector(".label .name").innerText = name;
      // item.querySelector(".label .window").innerHTML = "";
      item.setAttribute("data-fishid", fish.id);
      if (tug) item.setAttribute("data-hook", hook);
      ["medium", "heavy", "light"].forEach((t, index) => {
        if (tug == index) item.setAttribute("data-tug", index);
      });

      
      if (!(zone in records) || !(spot in records[zone])) return;
      newDur = getMax() > 30 ? 45 : 30;

      // Add record marks
      if (fish.id in records[zone][spot]) {
        let fishRecord, fishMark;
        const spotRecords = records[zone][spot];
        if ("chum" in spotRecords[fish.id] && "min" in spotRecords[fish.id].chum) {
          fishRecord = spotRecords[fish.id].chum;
          fishMark = item.querySelector(".label .record-chum");
          redrawRecord(fishRecord, fishMark, newDur)
        }
        if ("min" in spotRecords[fish.id]) {
          fishRecord = spotRecords[fish.id];
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
    const records = settings[character.id].records;
    if (!(zone in records) || !(spot in records[zone])) return;
    return Math.max(...Object.values(records[zone][spot]).map(i => [ [i.max].filter(r => r !== undefined), Object.values(i).map(chum => chum.max).filter(r => r !== undefined) ]).flat())
  }
  
  function exportCarbPlushy() {
    const output = [],
          records = settings[character.id].records;
    for (const zone in records) {
      for (const spot in records[zone]) {
        for (const key in records[zone][spot]) {
          output.push(key)
        }
      }
    }

    copyToClipboard("[" + output.toString() + "]")
  }
});

// Core functions
function initCharacter() {
  settings[character.id] = {};
  settings[character.id].name = character.name;
  settings[character.id].records = {}
}

function copyToClipboard(string, msg) {
  const field = document.createElement("input"),
        message = (msg && typeof msg === "string") ? msg : "Copied to clipboard";
  field.type = "text";
  field.setAttribute("value", string);
  document.body.appendChild(field);
  field.select();
  // Deprected method but no way around it since clipboard API won't work in ACT
  document.execCommand("copy");
  document.body.removeChild(field);
  sendMessage(message);
}

function sendMessage(msg) {
  const msgOutput = document.getElementById("output-msg");
  msgOutput.innerText = ""; // Visual feedback for force-reset
  setTimeout(() => { msgOutput.innerText = msg }, 100);
  clearTimeout(msgTimeout); // Force reset in case of overlapping events
  msgTimeout = setTimeout(() => { msgOutput.innerText = "" }, 3000)
}

// ACT functions
async function saveSettings(object) {
  if (typeof object !== "object" || object === null) {
    console.error("Couldn't save settings. Argument isn't an object.");
    console.debug(object);
    return
  }

  callOverlayHandler({ call: "saveData", key: uuid, data: object })
}

async function exportSettings(id) {
  if (Object.values(settings).legnth < 1) {
    console.error("Failed to export settings");
    console.debug(settings);
    return
  };

  let output;
  if (typeof id === "undefined") {
    output = settings;
  } else {
    output = {};
    Object.assign(output, settings[id])
  }

  const string = JSON.stringify(output);
  copyToClipboard(string)
}

async function importSettings(e) {
  e.target.onchange = async (e) => {
    if (e.target.files.length == 0) return;

    const file = e.target.files[0],
          reader = new FileReader();
    
    reader.onload = async (e) => {
      if (!(isJSON(e.target.result))) {
        sendMessage("Failed to import settings.");
        console.error("Failed to import settings. String isn't valid JSON.");
        return
      }
      
      Object.assign(settings, JSON.parse(e.target.result));
      await saveSettings(settings);
      sendMessage("Imported new settings.");
      document.dispatchEvent(new CustomEvent("reloadEntries"))
    }

    reader.onerror = (e) => console.error(e.target.error.name);
    reader.readAsText(file);
  };

  // Method: https://stackoverflow.com/a/31881889
  function isJSON(string){
    if (typeof string !== "string"){
        return false;
    }
    try{
        const json = JSON.parse(string);
        return (typeof json === "object");
    }
    catch (error){
        return false;
    }
  }
}

// DEBUG
function debug(delay) {
  zone = 401;
  document.dispatchEvent(new CustomEvent("startCasting", {
    detail: {
      line: "Mok Oogl Island"
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
      name: "sky faerie",
      time: parseFloat(elapsed),
      size: 21,
      unit: "ilms",
      amount: 1,
      spotId: spot
    }
  }))
}