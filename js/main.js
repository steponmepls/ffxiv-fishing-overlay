"use strict";

let uuid, character, spot;
const settings = {}, log = {};

// Fallback in case ACT isn't running
lang = !lang ? "English" : lang;
nameLang = !nameLang ? "en" : nameLang;

// Prevent overlay from running if no internet available
if (!window.callOverlayHandler) throw new Error("No internet connection available.");

if (!window.OverlayPluginApi || !window.OverlayPluginApi.ready) {
  character = {id: 0, name: "Testing"};
  if (!(character.id in settings)) initCharacter();
  console.warn("ACT is unavailable or OverlayPlugin is broken.")
} else {
  uuid = window.OverlayPluginApi.overlayUuid;

  // Fetch language from ACT settings
  callOverlayHandler({ call: 'getLanguage' })
  .then(res => {
    lang = ("language" in res) ? res.language : "English";
    if (lang == "English") {
      nameLang = "en"
    } else if (lang == "German") {
      nameLang = "de"
    } else if (lang == "French") {
      nameLang = "fr"
    } else if (lang == "Japanese") {
      nameLang = "ja"
    }
  });

  // ACT events
  document.addEventListener("changedCharacter", async (e) => {
    if (e.detail === null) return

    character = e.detail;
    callOverlayHandler({ call: "loadData", key: uuid })
    .then(obj => { if (obj && obj.data) {
      Object.assign(settings, obj.data);
      if (!(character.id in settings)) initCharacter()
    }})
  })
};

fetch("https://steponmepls.github.io/fishing-overlay/dist/fishing-log-min.json")
.then(res => res.json())
.then(data => { if (data) Object.assign(log, data) });


window.addEventListener("DOMContentLoaded", async (e) => {
  let interval, start = 0, wasChum = false, msgTimeout;

  const html = document.body.parentElement,
        title = document.getElementById("spot"),
        timer = document.getElementById("timer"),
        fishes = document.getElementById("entries"),
        marker = document.getElementById("marker").querySelector(".markline"),
        settingsPanel = document.getElementById("settings"),
        settingsInput = settingsPanel.querySelector(".settings input"),
        msgOutput = document.getElementById("output-msg"),
        settingsToggle = document.getElementById("show-settings"),
        escaped = /[-\/\\^$*+?.()|[\]{}]/g;

  // Import/Export settings
  settingsPanel.querySelector(".import").addEventListener("click", () => { settingsInput.click() });
  settingsInput.value = null; // Apparently needed to clear input on reload
  settingsInput.addEventListener("click", (event) => { importSettings(event) });
  settingsPanel.querySelector(".export").addEventListener("click", exportSettings);

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
    fishes.appendChild(fish);
    fish.querySelector(".label .name").onclick = (e) => {
      const item = e.target.parentElement.parentElement,
            id = parseInt(item.getAttribute("data-fishid"));
      if (!id || typeof id !== "number") return;

      copyToClipboard("https://www.garlandtools.org/db/#item/" + id);
      sendMessage("Copied link to clipboard.")
    };
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
    if (e.elapsedTime >= 45) return

    // Redraw records considering new 60s delay
    marker.setAttribute("data-dur", 45);

    // Restart animation
    marker.removeAttribute("animated");
    html.classList.remove("marker-animated");
    void html.offsetWidth;
    html.classList.add("long-cast", "marker-animated")
  });
  settingsToggle.addEventListener("click", () => { html.classList.toggle("show-settings") });
  document.addEventListener("newMessage", (e) => {
    const msg = e.detail.msg,
          type = e.detail.type;

    msgOutput.innerText = ""; // Visual feedback for force-reset
    setTimeout(() => { msgOutput.innerText = msg }, 100);
    clearTimeout(msgTimeout); // Force reset in case of overlapping events
    msgTimeout = setTimeout(() => { msgOutput.innerText = "" }, 3000)
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
      title.innerText = "";
      title.title = "";
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
      const regex = new RegExp(`${item["name_" + nameLang]}`, "i");
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
      const sanitized = spots[id]["name_" + nameLang].replace(escaped, '\\$&');
      const rule = new RegExp(sanitized, "i");
      if (rule.test(line)) {
        if (id != spot) {
          spot = parseInt(id);
          title.innerText = spots[spot]["name_" + nameLang];
          title.title = `${zone} / ${spot}`;
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
    let newDur = 30;
    const records = settings[character.id].records;

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
        if (tug == index) item.classList.add(t);
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

  // ACT functions
  async function saveSettings(object) {
    if (typeof object !== "object" || object === null) {
      console.error("Couldn't save settings. Argument isn't an object.");
      console.debug(object);
      return
    }
  
    callOverlayHandler({ call: "saveData", key: uuid, data: object })
  }

  async function exportSettings(e) {
    if (Object.values(settings).legnth < 1) {
      console.error("Failed to export settings");
      console.debug(settings);
      return
    };

    // Alternative till I figure out how to make downloads work in Chromium
    const string = JSON.stringify(settings);
    copyToClipboard(string);

    // Method: https://stackoverflow.com/a/30800715
/*     const dataStr = "data:text/json;charset=utf-8," + encodeURIComponent(JSON.stringify(settings));
    const link = document.createElement("a");
    link.setAttribute("href", dataStr);
    link.setAttribute("download", "settings.json");
    e.target.parentElement.appendChild(link);
    link.click();
    e.target.parentElement.removeChild(link) */
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

  // Misc functions
  function copyToClipboard(string) {
    const field = document.createElement("input");
    field.type = "text";
    field.setAttribute("value", string);
    document.body.appendChild(field);
    field.select();
    // Deprected method but no way around it since clipboard API won't work in ACT
    document.execCommand("copy");
    document.body.removeChild(field);
    sendMessage("Copied to clipboard");
  }

  function sendMessage(message, priority) {
    document.dispatchEvent(new CustomEvent("newMessage", {
      detail: {
        msg: message,
        type: priority
      }
    }))
  }
});

// Core functions
function initCharacter() {
  settings[character.id] = {};
  settings[character.id].name = character.name;
  settings[character.id].records = {}
}

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