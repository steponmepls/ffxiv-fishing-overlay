"use strict";

(async function () {
  let character, zone, spot, interval, msgInterval, start = 0, wasChum = false;
  const settings = {}, log = {};

  // Retrieve fishing log
  Object.assign(log, await fetch("./dist/fishing-log-min.json").then(res => res.json()));

  document.addEventListener("initCharacter", () => {
    if (!("characters" in settings)) settings.characters = {};
    settings.characters[character.id] = {};
    settings.characters[character.id].name = character.name;
    settings.characters[character.id].records = {};

    if (!window.OverlayPluginApi) return;

    callOverlayHandler({ call: 'getCombatants' })
    .then(obj => {
      const world = obj.combatants[0].WorldName;
      settings.characters[character.id].world = world
    })
  });
  document.addEventListener("changedZone", (e) => { zone = e.detail.zone });

  if (!window.OverlayPluginApi || !window.OverlayPluginApi.ready) {
    console.warn("ACT isn't running or missing OverlayPlugin API.");
    character = {id: 0, name: "Testing"};
    document.dispatchEvent(new CustomEvent("initCharacter"));
    settings.language = {};
    settings.language.name = "English";
    settings.language.id = "en";
  } else {
    // Define overlay settings address from ACT
    settings.uuid = window.OverlayPluginApi.overlayUuid;
    // Retrieve characters from settings
    callOverlayHandler({ call: "loadData", key: settings.uuid})
    .then(obj => settings.characters = obj.data);
    // Retrieve main language from ACT
    callOverlayHandler({ call: "getLanguage" })
    .then(obj => {
      settings.language = {};
      settings.language.name = obj.language;
      switch (settings.language.name) {
        case "English": settings.language.id = "en"; break;
        case "German": settings.language.id = "de"; break;
        case "French": settings.language.id = "fr"; break;
        case "Japanese": settings.language.id = "ja"
      }
    });
    // ACT events
    document.addEventListener("changedCharacter", (e) => {
      character = e.detail;
      if (!(character.id in settings.characters)) {
        document.dispatchEvent(new CustomEvent("initCharacter"))
      }
    });
    document.addEventListener("saveSettings", () => {
      if (character.id === 0) return;
      callOverlayHandler({
        call: "saveData",
        key: settings.uuid,
        data: settings.characters
      })
    });
    document.addEventListener("exportSettings", (e) => {    
      let output;

      if (!e.detail || typeof e.detail.character === "undefined") {
        output = settings.characters;
      } else {
        output = {};
        output[e.detail.character] = {};
        Object.assign(output[e.detail.character], settings.characters[e.detail.character])
      }
    
      const string = JSON.stringify(output);
      document.dispatchEvent(new CustomEvent("toClipboard", { detail: { string: string } }))
    });
    document.addEventListener("deleteSettings", () => {
      console.warn("Deleting your character's settings..");
      delete settings.characters[character.id];
      document.dispatchEvent(new CustomEvent("saveSettings"));
      console.debug(settings)
    });
    const importSettings = document.getElementById("import");
    importSettings.querySelector("button").onclick = () => {
      importSettings.querySelector("input").value = null;
      importSettings.querySelector("input").click()
    };
    importSettings.querySelector("input").addEventListener("change", (e) => {
      if (e.target.files.length < 1) return;

      const file = e.target.files[0],
            reader = new FileReader();

      reader.onload = (e) => {
        if (!(isJSON(e.target.result))) {
          document.dispatchEvent(new CustomEvent("sendMessage", {
            detail: { msg: "Failed to import settings." }
          }))
          return
        }
        
        Object.assign(settings.characters, JSON.parse(e.target.result));
        document.dispatchEvent(new CustomEvent("reloadEntries"));
        document.dispatchEvent(new CustomEvent("saveSettings"));
        document.dispatchEvent(new CustomEvent("sendMessage", {
          detail: { msg: "Imported new settings." }
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

  console.debug(settings);

  const html = document.body.parentElement,
        spotName = document.getElementById("fishing-spot"),
        castTimer = document.getElementById("timer"),
        timelineMark = document.getElementById("markline");

  // Init items content
  for (let i=0; i<10; i++) {
    const item = document.getElementById(`item${i}`);
    item.innerHTML = `<div class="icon"><img src=""></div>
    <div class="label flex">
      <div class="name flex"></div>
      <div class="info flex">
        <i class="hook"></i>
        <i class="tug"></i>
      </div>
      <div class="records">
        <div class="record"></div>
        <div class="record chum"></div>
      </div>
    </div>`;

    item.querySelector(".icon").onclick = (e) => {
      const node = e.target.parentElement.parentElement;
      const id = parseInt(node.getAttribute("data-fishid"));
      if (!id || typeof id !== "number") return;

      document.dispatchEvent(new CustomEvent("toClipboard", {
        detail: {
          string: "https://www.garlandtools.org/db/#item/" + id,
          msg: "Copied link to clipboard"
        }
      }))
    };
    item.querySelectorAll(".record").forEach(r => {
      r.onclick = (e) => {
        const min = e.target.getAttribute("data-min"),
              max = e.target.getAttribute("data-max");
        document.dispatchEvent(new CustomEvent("sendMessage", {
          detail: { msg: `${min} ~ ${max}` }
        }))
      }
    })
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
    html.classList.remove("fishing", "marker-animated", "marker-paused", "show-settings");
    spotName.innerText = "";
    castTimer.innerText = "";
    wasChum = false
  });
  document.addEventListener("statusChange", (e) => {
    if (regex[settings.language.name].buff[2].test(e.detail.name)) {
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
    if (!(html.classList.contains("fishing"))) return;
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
    //if (list[0].oldValue == list[0].target.getAttribute("data-dur")) return;

    const records = settings.characters[character.id].records;
    if (!(zone in records) || !(spot in records[zone])) return;

    refreshRecords(records)
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
          records = settings.characters[character.id].records;
          
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

  // Actions
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
      detail: { msg: message }
    }));
  });
  document.addEventListener("sendMessage", (e) => {
    if (!e.detail || !e.detail.msg || typeof e.detail.msg !== "string") return;
    const message = e.detail.msg,
          container = document.getElementById("output-message");

    container.innerText = ""; // Visual feedback for force-reset
    setTimeout(() => { 
      container.innerText = message;
      clearTimeout(msgInterval);
      msgInterval = setTimeout(() => { container.innerText = "" }, 3000)
     }, 100);
  });

  // Overlay functions
  function startCasting(e) {
    // Add class toggles
    html.classList.add("fishing", "casting");

    // Force-reset timer before rerun
    // Bug: https://jsfiddle.net/zf96hcga/
    // Fix: https://jsfiddle.net/zf96hcga/2/
    window.clearInterval(interval)
    // Start timer
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
    if (regex[settings.language.name].start[2].test(e.detail.line)) return;
  
    // Parse fishing spot
    if (regex[settings.language.name].start[1].test(e.detail.line)) { // if undiscovered spot
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
      for (const record of item.querySelectorAll(".record")) {
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
      const sanitized = spots[id]["name_" + settings.language.id].replace(illegalChars, '\\$&');
      const rule = new RegExp(sanitized, "i");

      if (rule.test(line)) {
        spotName.innerText = spots[id]["name_" + settings.language.id];
        if (id != spot) {
          spot = parseInt(id);
          resetEntries();
          populateEntries()
        } else {
          // Reset timeline expansion if no record > 30s
          if (timelineMark.getAttribute("data-dur") > 30 && getMax() <= 30)
            timelineMark.setAttribute("data-dur", 30)
        };
        break
      }
    }
  }
  function populateEntries() {
    log[zone][spot].fishes.forEach((fish, index) => {
      const item = document.getElementById("item" + index),
            name = fish["name_" + settings.language.id],
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
    });
    // Add record marks
    const records = settings.characters[character.id].records;
    if (!(zone in records) || !(spot in records[zone])) return;
    timelineMark.setAttribute("data-dur", getMax() > 30 ? 45 : 30);
  }
  function drawRecord(record, node) {
    const threshold = timelineMark.getAttribute("data-dur");

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
  function refreshRecords(records) {
    const spotRecords = records[zone][spot];
    if (Object.values(spotRecords).length < 1) return;

    log[zone][spot].fishes.forEach((fish, index) => {
      if (!(fish.id in spotRecords)) return;

      const item = document.getElementById("item" + index);
      for (const node of item.querySelectorAll(".record")) {
        let record;
        if (node.classList.contains("chum")) {
          if (!("chum" in spotRecords[fish.id])) continue;
          record = spotRecords[fish.id].chum
        } else {
          if (!("min" in spotRecords[fish.id])) continue;
          record = spotRecords[fish.id];
        }
        drawRecord(record, node)
      }
    })
  }
  function updateLog(fish) {
    let fishID;

    const fishName = fish.detail.name,
          fishTime = parseFloat(castTimer.innerText),
          // fishSize = fish.detail.size,
          // sizeUnit = fish.detail.unit,
          // totalFishes = fish.detail.amount,
          records = settings.characters[character.id].records;

    for (const item of log[zone][spot].fishes) {
      const regex = new RegExp(`${item["name_" + settings.language.id]}`, "i");
      if (regex.test(fishName)) {
        fishID = item.id;
        break
      };
    }
  
    // Init if no entries yet
    if (!(zone in records)) records[zone] = {};
    if (!(spot in records[zone])) records[zone][spot] = {};
    const spotRecords = records[zone][spot];

    if (!(fishID in spotRecords)) records[zone][spot][fishID] = {};
  
    // Pick either chum or normal mark for a fish
    let fishRecord, fishMark;
    const fishNode = document.querySelector(`.entries > .fish[data-fishid="${fishID}"]`);

    if (wasChum) {
      if (!("chum" in spotRecords[fishID])) spotRecords[fishID].chum = {};
      fishRecord = spotRecords[fishID].chum;
      fishMark = fishNode.querySelector(".records > .record.chum")
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
      drawRecord(fishRecord, fishMark)
    } else if (fishTime < parseFloat(fishRecord.min)) {
      //console.debug(`${fishTime} < ${fishRecord.min}`);
      fishRecord.min = fishTime;
      document.dispatchEvent(new CustomEvent("saveSettings"));
      drawRecord(fishRecord, fishMark)
    } else if (fishTime > parseFloat(fishRecord.max)) {
      //console.debug(`${fishTime} > ${fishRecord.min}`);
      fishRecord.max = fishTime;
      document.dispatchEvent(new CustomEvent("saveSettings"));
      drawRecord(fishRecord, fishMark)
    }
  }
  function getMax() {
    const records = settings.characters[character.id].records;
    if (!(zone in records) || !(spot in records[zone])) return 0;
    return Math.max(...Object.values(records[zone][spot]).map(i => 
      [ [i.max].filter(r => r !== undefined), Object.values(i).map(chum => chum.max).filter(r => r !== undefined) ]
    ).flat())
  }

  // OverlayPlugin will now start sending events
  startOverlayEvents()
})()

// DEBUG
function debug(delay) {
  document.dispatchEvent(new CustomEvent("changedZone", { detail: { zone: 401 } }))
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
  document.dispatchEvent(new CustomEvent("fishCaught", {
    detail: {
      name: "sky faerie",
      size: 21,
      unit: "ilms",
      amount: 1
    }
  }))
}