"use strict";

(async function() {
  let uuid, character, lang, langId, zone, spot, interval, start = 0, wasChum = false;
  const settings = {};

  if (!window.OverlayPluginApi || !window.OverlayPluginApi.ready) {
    console.warn("ACT is unavailable or OverlayPlugin is broken.");
    character = {id: 0, name: "Testing"};
    lang = !lang ? "English" : lang;
    langId = !langId ? "en" : langId;
    zone = 401;
    initCharacter()
  } else {
    uuid = window.OverlayPluginApi.overlayUuid;

    callOverlayHandler({ call: "loadData", key: uuid})
    .then(obj => Object.assign(settings, obj.data));

    callOverlayHandler({ call: "getLanguage" })
    .then(res => { lang = ("language" in res) ? res.language : "English";
      switch (lang) {
        case "English": langId = "en"; break;
        case "German": langId = "de"; break;
        case "French": langId = "fr"; break;
        case "Japanese": langId = "ja"
      }
    });

    document.addEventListener("changedCharacter", (e) => {
      character = e.detail;
      // Check if character exists in settings
      if (!(character.id in settings)) initCharacter()
    });
    document.addEventListener("changedZone", (e) => { zone = e.detail.zone });
    document.addEventListener("saveSettings", () => {
      if (character.id === 0) return;
      callOverlayHandler({ call: "saveData", key: uuid, data: settings})
    });
    document.addEventListener("exportSettings", (e) => {    
      let output;
      if (!e.detail || typeof e.detail.character === "undefined") {
        output = settings;
      } else {
        output = {};
        output[e.detail.character] = {};
        Object.assign(output[e.detail.character], settings[e.detail.character])
      }
    
      const string = JSON.stringify(output);
      document.dispatchEvent(new CustomEvent("toClipboard", { detail: { string: string } }))
    });
    document.addEventListener("deleteSettings", () => {
      console.warn("Deleting all settings..");
      for (const key in settings) delete settings[key];
      document.dispatchEvent(new CustomEvent("saveSettings"));
      console.debug(settings)
    })

    const importSettings = document.getElementById("import");
    importSettings.querySelector("button").onclick = () => {
      importSettings.querySelector("input").value = null;
      importSettings.querySelector("input").click()
    }
    importSettings.querySelector("input").addEventListener("change", (e) => {
      if (e.target.files.length < 1) return;

      const file = e.target.files[0],
            reader = new FileReader();

      reader.onload = (e) => {
        if (!(isJSON(e.target.result))) {
          sendMessage("Failed to import settings.");
          console.error("Failed to import settings. String isn't valid JSON.");
          return
        }
        
        Object.assign(settings, JSON.parse(e.target.result));
        document.dispatchEvent(new CustomEvent("reloadEntries"));
        document.dispatchEvent(new CustomEvent("saveSettings"));
        document.dispatchEvent(new CustomEvent("sendMessage", {
          detail: {
            msg: "Imported new settings."
          }
        }))
      };

      reader.onerror = (e) => console.error(e.target.error.name);
      reader.readAsText(file);

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
    });

  };

  const log = await fetch("./dist/fishing-log-min.json").then(res => res.json());

  const html = document.body.parentElement,
        spotName = document.getElementById("fishing-spot"),
        castTimer = document.getElementById("timer"),
        timelineMark = document.getElementById("markline");

  // Init items content
  for (let i=0; i<10; i++) {
    const item = document.getElementById(`item${i}`);
    item.innerHTML = `<div class="icon"><img src=""></div>
    <div class="label flex">
      <div class="name"></div>
      <div class="info flex">
        <i class="hook"></i>
        <i class="tug"></i>
      </div>
      <div class="records">
        <div class="record"></div>
        <div class="record-chum"></div>
      </div>
    </div>`;

    item.querySelector(".label > .name").onclick = (e) => {
      const item = e.target.parentElement.parentElement,
            id = parseInt(item.getAttribute("data-fishid"));
      if (!id || typeof id !== "number") return;

      document.dispatchEvent(new CustomEvent("toClipboard", {
        detail: {
          string: "https://www.garlandtools.org/db/#item/" + id,
          msg: "Copied link to clipboard."
        }
      }))
    }
  };

  // Overlay events
  document.addEventListener("startCasting", startCasting);
  document.addEventListener("stopCasting", () => {
    html.classList.remove("casting");
    html.classList.add("marker-paused");
    window.clearInterval(interval)
  });
  document.addEventListener("fishCaught", updateLog);
  document.addEventListener("newSpot", (e) => { findSpot(e.detail.line) });
  document.addEventListener("stopFishing", () => {
    html.classList.remove("fishing", "marker-animated", "marker-paused");
    spotName.innerText = "";
    castTimer.innerText = "";
    wasChum = false
  });
  document.addEventListener("statusChange", (e) => {
    if (regex[lang].buff[2].test(e.detail.name)) {
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
  document.addEventListener("reloadEntries", () => {
    resetEntries();
    populateEntries()
  });

  // Redraw timeline whenever data-dur value changes
  timelineMark.addEventListener("animationend", (e) => {
    // Force-stop marker animation when elapsed time reaches 60s
    if (e.elapsedTime >= 45) return

    // Redraw records considering new 60s delay
    e.target.setAttribute("data-dur", 45);

    // Restart animation
    html.classList.remove("marker-animated");
    void html.offsetWidth;
    html.classList.add("long-cast", "marker-animated")
  });
  const durationChange = new MutationObserver((list) => {
    if (list[0].oldValue == undefined) return;
    if (list[0].oldValue == list[0].target.getAttribute("data-dur")) return;

    const records = settings[character.id].records;
    if (!(zone in records) || !(spot in records[zone])) return;

    const spotRecords = records[zone][spot];
    log[zone][spot].fishes.forEach((fish, index) => {
      const item = document.getElementById("item" + index);
      if (fish.id in spotRecords) {
        let fishRecord, fishMark;
        if ("chum" in spotRecords[fish.id] && "min" in spotRecords[fish.id].chum) {
          fishRecord = spotRecords[fish.id].chum;
          fishMark = item.querySelector(".records .record-chum");
          redrawRecord(fishRecord, fishMark)
        }
        if ("min" in spotRecords[fish.id]) {
          fishRecord = spotRecords[fish.id];
          fishMark = item.querySelector(".records .record");
          redrawRecord(fishRecord, fishMark)
        }
      }
    })
  });
  durationChange.observe(timelineMark, {
    attributeFilter: ["data-dur"],
    attributeOldValue: true
  });

  // Settings events
  const exportSettings = document.getElementById("export");
  exportSettings.querySelector(".current").onclick = () => {
    const id = character.id;
    document.dispatchEvent(new CustomEvent("exportSettings", {
      detail: { character: id }
    }))
  };
  exportSettings.querySelector(".all-characters").onclick = () => {
    document.dispatchEvent(new CustomEvent("exportSettings"))
  };
  const carbunclePlushy = document.getElementById("carbuncle-plushy");
  carbunclePlushy.querySelector("button").onclick = () => {
    const output = [],
          records = settings[character.id].records;
          
    for (const zone in records) {
      for (const spot in records[zone]) {
        for (const key in records[zone][spot]) {
          output.push(key)
        }
      }
    }

    document.dispatchEvent(new CustomEvent("toClipboard", {
      detail: { string: "[" + output.toString() + "]" }
    }))
  };
  const settingsToggle = document.getElementById("settings-toggle");
  settingsToggle.onclick = () => {
    html.classList.remove("manual-settings");
    html.classList.toggle("show-settings")
  };
  document.addEventListener("toClipboard", (e) => {
    if (!e.detail || !e.detail.string || typeof e.detail.string !== "string") return;

    const field = document.createElement("input"),
          message = (e.detail.msg && typeof e.detail.msg === "string") ? e.detail.msg : "Copied to clipboard";
    
    field.type = "text";
    field.setAttribute("value", e.detail.string);
    document.body.appendChild(field);
    field.select();
    // Deprected method but no way around it since clipboard API won't work in ACT
    document.execCommand("copy");
    document.body.removeChild(field);
    document.dispatchEvent(new CustomEvent("sendMessage", {
      detail: {
        msg: message
      }
    }));
  });
  document.addEventListener("sendMessage", (e) => {
    if (!e.detail || !e.detail.msg || typeof e.detail.msg !== "string") return;
    const message = e.detail.msg,
          container = document.getElementById("output-message");

    container.innerText = ""; // Visual feedback for force-reset
    setTimeout(() => { container.innerText = message }, 100);
    setTimeout(() => { container.innerText = "" }, 3000);
  });

  // Core functions
  function initCharacter() {
    settings[character.id] = {};
    settings[character.id].name = character.name;
    settings[character.id].records = {};

    if (!window.OverlayPluginApi) return;

    callOverlayHandler({ call: 'getCombatants' })
    .then(obj => {
      const world = obj.combatants[0].WorldName;
      settings[character.id].world = world
    })
  }
  function getMax() {
    const records = settings[character.id].records;
    if (!(zone in records) || !(spot in records[zone])) return 0;
    return Math.max(...Object.values(records[zone][spot]).map(i => [ [i.max].filter(r => r !== undefined), Object.values(i).map(chum => chum.max).filter(r => r !== undefined) ]).flat())
  }

  // Overlay functions
  function startCasting(e) {
    // Add class toggles
    html.classList.add("fishing", "casting");

    // Reset timers before rerun
    start = Date.now();
    interval = window.setInterval(() => {
      const raw = (Date.now() - start) / 1000;
      castTimer.innerText = raw.toFixed(1)
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

    // If mooch stop here
    if (regex[lang].start[2].test(e.detail.line)) return;
  
    // Parse fishing spot
    if (regex[lang].start[1].test(e.detail.line)) { // if undiscovered spot
      if (spot) resetEntries();
      spot = undefined;
      spotName.innerText = "???"
    } else { // if regular fishing spot
      findSpot(e.detail.line)
    }
  }
  function resetEntries() {
    timelineMark.setAttribute("data-dur", 30);
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
  function findSpot(line) {
    if (!line || typeof line !== "string") return;

    const spots = log[zone],
          illegalChars = /[-\/\\^$*+?.()|[\]{}]/g;

    for (const id in spots) {
      const sanitized = spots[id]["name_" + langId].replace(illegalChars, '\\$&');
      const rule = new RegExp(sanitized, "i");

      if (rule.test(line)) {
        spotName.innerText = spots[id]["name_" + langId];
        if (id != spot) {
          spot = parseInt(id);
          resetEntries();
          populateEntries()
        } else { // Reset
          if (timelineMark.getAttribute("data-dur") > 30 && getMax() <= 30)
            timelineMark.setAttribute("data-dur", 30)
        };
        break
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

    timelineMark.setAttribute("data-dur", newDur)
  }
  function redrawRecord(record, node, dur) {
    const threshold = (dur) ? dur : timelineMark.getAttribute("data-dur");

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
  function updateLog(fish) {
    let fishID;

    const fishName = fish.detail.name,
          fishTime = fish.detail.time,
          // fishSize = fish.detail.size,
          // sizeUnit = fish.detail.unit,
          // totalFishes = fish.detail.amount,
          records = settings[character.id].records;

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
    };
  
    // Pick either chum or normal mark for a fish
    let fishRecord, fishMark;
    const fishNode = document.querySelector(`.entries > .fish[data-fishid="${fishID}"]`);

    if (wasChum) {
      if (!("chum" in spotRecords[fishID])) spotRecords[fishID].chum = {};
      fishRecord = spotRecords[fishID].chum;
      fishMark = fishNode.querySelector(".records > .record-chum")
    } else {
      fishRecord = spotRecords[fishID];
      fishMark = fishNode.querySelector(".records > .record")
    };

    // Reset chum bool
    wasChum = false;

    if (!("min" in fishRecord)) {
      fishRecord.min = fishTime;
      fishRecord.max = fishTime;
      document.dispatchEvent(new CustomEvent("saveSettings"));
      redrawRecord(fishRecord, fishMark)
    } else if (fishTime < fishRecord.min) {
      fishRecord.min = fishTime;
      document.dispatchEvent(new CustomEvent("saveSettings"));
      redrawRecord(fishRecord, fishMark)
    } else if (fishTime > fishRecord.max) {
      fishRecord.max = fishTime;
      document.dispatchEvent(new CustomEvent("saveSettings"));
      redrawRecord(fishRecord, fishMark)
    }
  }
})();

// DEBUG
function debug(delay) {
  document.dispatchEvent(new CustomEvent("startCasting", {
    detail: { line: "Mok Oogl Island" }
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
      size: 21,
      unit: "ilms",
      time: elapsed,
      amount: 1
    }
  }))
}
function nukeSettings() {
  document.dispatchEvent(new CustomEvent("deleteSettings"))
}