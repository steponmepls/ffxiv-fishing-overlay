"use strict";

(async function () {
  let character, zone, spot, msgTimeout, start = 0, wasChum = false;
  const log = {}, intervals = [];

  // Retrieve fishing log
  Object.assign(log, await fetch("./dist/fishing-log-min.json").then(res => res.json()));

  // Check if running in browser or in ACT
  const overlayUuid = (window.OverlayPluginApi) ? window.OverlayPluginApi.overlayUuid : null;

  // Init settings
  const settings = {
    lang: { name: "English", id: "en" },
    preferences: {
      "Align to bottom": [false, "When set to true the overlay will only grow vertically from bottom to top."]
    },
    characters: {}
  };

  const html = document.body.parentElement,
        spotName = document.getElementById("fishing-spot"),
        castTimer = document.getElementById("timer"),
        timelineMark = document.getElementById("markline"),
        settingsMenu = document.getElementById("settings");

  // Core event listeners
  document.addEventListener("changedZone", (e) => { zone = e.detail.zone });
  document.addEventListener("changedCharacter", (e) => { character = e.detail });
  document.addEventListener("initCharacter", () => {
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

  if (!window.OverlayPluginApi || !window.OverlayPluginApi.ready) {
    console.warn("ACT isn't running or missing OverlayPlugin API.");
    document.dispatchEvent(new CustomEvent("changedCharacter", {
      detail: { name: "Testing", id: 0 }
    }));
    //document.dispatchEvent(new CustomEvent("initCharacter"));
  } else {
    // ACT events listeners
    document.addEventListener("saveSettings", () => {
      if (overlayUuid === null) return;
      callOverlayHandler({ call: "saveData", key: overlayUuid, data: sanitizeSettings() })
    });
    document.addEventListener("parseSettings", (i) => {
      const input = (i.detail) ? i.detail : i;
      for (const key in input) {
        if (key === "preferences") {
          for (const pref in settings.preferences) {
            if (!(pref in input.preferences)) continue;
            settings.preferences[pref][0] = input.preferences[pref][0]
          };
          continue
        }
        Object.assign(settings[key], input[key])
      }
    });
    document.addEventListener("deleteSettings", (e) => {
      if (!e.detail || typeof e.detail.id !== "number") return;
      if (!(e.detail.id in settings.characters)) return;

      delete settings.characters[e.detail.id];
      document.dispatchEvent(new CustomEvent("saveSettings"));
      console.warn("Reload overlay to apply new settings.");
      console.debug(settings)
    });
    
    // Load settings
    document.dispatchEvent(new CustomEvent("parseSettings", { 
      detail: await callOverlayHandler({ call: "loadData", key: overlayUuid}).then(obj => obj.data) }
    ));
    
    // Enable import/export of settings
    settingsMenu.querySelector("div > .overlay button.import").removeAttribute("disabled");
    settingsMenu.querySelector("div > .overlay button.export").removeAttribute("disabled")
  };

  console.debug(settings);

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

  // Settings events
  settingsMenu.querySelector("div > .overlay button.import").onclick = () => {
    settingsMenu.querySelector("div > .overlay input").value = null;
    settingsMenu.querySelector("div > .overlay input").click()
  };
  settingsMenu.querySelector("div > .overlay input").onchange = (e) => {
    if (e.target.files.length < 1) return;

    const file = e.target.files[0],
          reader = new FileReader();

    reader.onload = async (e) => {
      if (!(isJSON(e.target.result))) {
        document.dispatchEvent(new CustomEvent("sendMessage", {
          detail: { msg: "Failed to import settings." }
        }))
        return
      }
      
      const output = JSON.parse(e.target.result);
      document.dispatchEvent(new CustomEvent("parseSettings", { detail: output }));
      document.dispatchEvent(new CustomEvent("saveSettings"));
      document.dispatchEvent(new CustomEvent("sendMessage", {
        detail: { msg: "Reload overlay to apply new settings" }
      }))
    };

    reader.onerror = (e) => console.error(e.target.error.name);
    reader.readAsText(file);

    // Method: https://stackoverflow.com/a/31881889
    function isJSON(string){
      if (typeof string !== "string") return false;
      try{
        const json = JSON.parse(string);
        return (typeof json === "object")
      }
      catch (error){
        console.error(error);
        return false;
      }
    }
  };
  settingsMenu.querySelector("div > .overlay button.export").onclick = () => {
    const string = JSON.stringify(sanitizeSettings());
    document.dispatchEvent(new CustomEvent("toClipboard", { detail: { string: string } }))
  };
  settingsMenu.querySelector("div > .carbuncle-plushy button").onclick = () => {
    if (!(character.id in settings.characters)) return;

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
  // Settings functions
  function sanitizeSettings() {
    const output = {};
    for (const s in settings) {
      output[s] = Object.create(null);
      if (s === "preferences") {
        for (const k in settings[s]) {
          if (settings[s][k][0] === false) continue;
          output[s][k] = settings[s][k];
          const array = output[s][k];
          array.splice(1, (array.length - 1));
        }
        continue
      };

      Object.assign(output[s], settings[s])
    }
    return output;
  }
  
  // Overlay events
  document.addEventListener("startCasting", startCasting);
  document.addEventListener("stopCasting", () => {
    html.classList.remove("casting");
    html.classList.add("marker-paused");
    window.clearInterval(intervals.splice(-1));
  });
  document.addEventListener("fishCaught", updateLog);
  document.addEventListener("newSpot", (e) => { findSpot(e.detail.line) });
  document.addEventListener("stopFishing", () => {
    html.classList.remove(
      "fishing", 
      "marker-animated", 
      "marker-paused", 
      "chum-records"
    );
    spotName.innerText = "";
    castTimer.innerText = "";
    wasChum = false
  });
  document.addEventListener("statusChange", (e) => {
    if (regex[settings.lang.name].buff[2].test(e.detail.name)) {
      if (e.detail.status === true) {
        html.classList.add("chum-active", "chum-records");
        wasChum = true
      } else {
        html.classList.remove("chum-active")
      }
    }
  });
  document.addEventListener("showSettings", () => {
    html.classList.toggle("show-settings")
  });
  document.addEventListener("applySettings", () => {
    settingsMenu.querySelector(`.languages input[data-name="${settings.lang.name}"]`).checked = true;

    for (const pref in settings.preferences) {
      switch(pref) {
        case "Align to bottom":
          html.classList.toggle("align-bottom", settings.preferences[pref][0]);
          break;
      };
      settingsMenu.querySelector(`.preferences > div[data-name="${pref}"] input`).checked = settings.preferences[pref][0]
    }
  });

  // Settings menu init
  const hideSettings = document.getElementById("hide-settings");
  hideSettings.onclick = () => { html.classList.toggle("show-settings") };
  settingsMenu.querySelectorAll(".languages input").forEach(l => {
    l.onchange = (e) => {
      if (!(e.target.checked)) return; // ???

      settings.lang.name = e.target.getAttribute("data-name");
      settings.lang.id = e.target.value;
      document.dispatchEvent(new CustomEvent("saveSettings"))
    }
  });
  for (const i in settings.preferences) {
    const container = document.createElement("div");
    container.innerHTML = `
      <label><input type="checkbox" name="${i}" disabled>${i}</label>
      <span>${settings.preferences[i][1]}</span>
    `;
    container.setAttribute("data-name", i);
    container.querySelector("input").onchange = (e) => {
      settings.preferences[e.target.name][0] = e.target.checked;
      document.dispatchEvent(new CustomEvent("saveSettings"))
    };
    if (window.OverlayPluginApi) container.querySelector("input").removeAttribute("disabled");
    settingsMenu.querySelector(".preferences").appendChild(container)
  };
  document.dispatchEvent(new CustomEvent("applySettings"));

  // Redraw timeline on long casts
  timelineMark.addEventListener("animationend", (e) => {
    // Force-stop marker animation when elapsed time reaches 45s
    if (e.elapsedTime >= 45) return

    // Redraw records considering new 45s delay
    e.target.setAttribute("data-dur", 45);
    redrawRecords(true);

    // Restart animation
    html.classList.remove("marker-animated");
    void html.offsetWidth;
    html.classList.add("long-cast", "marker-animated")
  });

  // Services
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
      clearTimeout(msgTimeout);
      msgTimeout = setTimeout(() => { container.innerText = "" }, 3000)
     }, 100);
  });

  // Overlay functions
  function startCasting(e) {
    start = Date.now();
    findSpot(e.detail.line, e.detail.mooch);

    // Reset
    html.classList.remove("marker-animated", "marker-paused", "long-cast", "manual-settings");
    if (!html.classList.contains("chum-active") && html.classList.contains("chum-records")) {
      html.classList.remove("chum-active", "chum-records");
      wasChum = false
    };

    // Configure animation
    html.classList.add("fishing", "casting");
    if (html.classList.contains("chum-active")) {
      timelineMark.setAttribute("data-dur", 30)
    } else {
      timelineMark.setAttribute("data-dur", getMax() > 30 ? 45 : 30)
    };

    redrawRecords();

    // Clean up eventual timer leftovers
    intervals.forEach((i, index, array) => {
      window.clearInterval(array.splice(array[index], 1));
    });

    // Start timer
    const interval = window.setInterval(() => {
      const raw = (Date.now() - start) / 1000;
      castTimer.innerText = raw.toFixed(1)
    }, 100);
    intervals.push(interval);

    // Start animation
    void html.offsetWidth;
    html.classList.add("marker-animated");

    function getMax() {
      if (!(character.id in settings.characters)) return 0;
      const records = settings.characters[character.id].records;
      if (!(zone in records) || !(spot in records[zone])) return 0;
      return Math.max(...Object.values(records[zone][spot]).map(i => 
        [ [i.max].filter(r => r !== undefined), Object.values(i).map(chum => chum.max).filter(r => r !== undefined) ]
      ).flat())
    }
  }
  function findSpot(line, isMooch) {
    if (isMooch) return;

    // Reset to prevent mismatch with possible new spots not in the database
    spot = undefined;

    // Undiscovered Fishing Hole
    if (regex[settings.lang.name].start[1].test(line)) {
      setUndiscovered();
      return
    };

    const spots = log[zone], illegalChars = /[-\/\\^$*+?.()|[\]{}]/g;

    for (const id in spots) {
      const sanitized = spots[id]["name_" + settings.lang.id].replace(illegalChars, '\\$&');
      const rule = new RegExp(sanitized, "i");

      if (rule.test(line)) {
        if (id != spot) {
          spot = parseInt(id);
          spotName.innerText = spots[spot]["name_" + settings.lang.id];
          resetEntries();
          populateEntries()
        } else {
          // Fallback check till I figure out what is happening
          if (spotName.innerText == "") spotName.innerText = spots[id]["name_" + settings.lang.id]
        };
        break
      }
    };

    // Parse spot as undiscovered if not in the database
    if (spot == "undefined") setUndiscovered();

    function setUndiscovered() {
      spot = undefined;

      let uSpot;
      switch (settings.lang.name) {
        case "English":
          uSpot = "Undiscovered Fishing Hole";
          break;
        case "German":
          uSpot = "Unerforschter Angelplatz";
          break;
        case "French":
          uSpot = "Zone de pêche inconnue";
          break;
        case "Japanese":
          uSpot = "未知の釣り場";
          break;
      };
      spotName.innerText = uSpot;

      resetEntries();
      timelineMark.setAttribute("data-dur", 30);
    }
  }
  function resetEntries() {
    for (let i=0; i<10; i++) {
      const item = document.getElementById("item" + i);
      item.querySelector(".icon img").src = "";
      item.querySelector(".label .name").innerHTML = "";
      // item.querySelector(".label .window").innerHTML = "";
      ["data-fishid", "data-hook", "data-tug"].forEach( c => item.removeAttribute(c) );
      for (const record of item.querySelectorAll(".record")) {
        ["data-min", "data-max", "style"].forEach( c => record.removeAttribute(c) )
      }
    }
  }
  function populateEntries() {
    log[zone][spot].fishes.forEach((fish, index) => {
      const item = document.getElementById("item" + index),
            name = fish["name_" + settings.lang.id],
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
      })
    })
  }
  function redrawRecords(longCast) {
    if (!(character.id in settings.characters)) return;

    const records = settings.characters[character.id].records;
    if (!(zone in records) || !(spot in records[zone])) return;

    
    log[zone][spot].fishes.forEach((fish, index) => {
      if (!(fish.id in records[zone][spot])) return;

      const item = document.getElementById("item" + index);
      for (const node of item.querySelectorAll(".record")) {
        let record, isChum;
        if (node.classList.contains("chum")) {
          if (longCast || !("chum" in records[zone][spot][fish.id])) continue;
          record = records[zone][spot][fish.id].chum;
          isChum = true
        } else {
          if (!("min" in records[zone][spot][fish.id])) continue;
          record = records[zone][spot][fish.id];
          isChum = false
        }
        drawRecord(record, node, isChum)
      }
    })
  }
  function drawRecord(record, node, chum) {
    const threshold = (chum) ? 30 : timelineMark.getAttribute("data-dur");

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
    if (!(html.classList.contains("fishing"))) return;
    if (spot == "undefined" || spot == null) return;

    let fishID;

    // Init records for current character when needed
    if (!(character.id in settings.characters))
      document.dispatchEvent(new CustomEvent("initCharacter"));

    const fishName = fish.detail.name,
          fishTime = parseFloat(castTimer.innerText),
          // fishSize = fish.detail.size,
          // sizeUnit = fish.detail.unit,
          // totalFishes = fish.detail.amount,
          records = settings.characters[character.id].records;

    for (const item of log[zone][spot].fishes) {
      const regex = new RegExp(`${item["name_" + settings.lang.id]}`, "i");
      if (regex.test(fishName)) {
        fishID = item.id;
        break
      };
    }

    // In case of new fishes/spots not in the database
    if (fishID == "undefined" || fishID == null) return;
  
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

    if (!("min" in fishRecord)) {
      fishRecord.min = fishTime;
      fishRecord.max = fishTime;
      document.dispatchEvent(new CustomEvent("saveSettings"));
      drawRecord(fishRecord, fishMark, wasChum)
    } else if (fishTime < parseFloat(fishRecord.min)) {
      //console.debug(`${fishTime} < ${fishRecord.min}`);
      fishRecord.min = fishTime;
      document.dispatchEvent(new CustomEvent("saveSettings"));
      drawRecord(fishRecord, fishMark, wasChum)
    } else if (fishTime > parseFloat(fishRecord.max)) {
      //console.debug(`${fishTime} > ${fishRecord.min}`);
      fishRecord.max = fishTime;
      document.dispatchEvent(new CustomEvent("saveSettings"));
      drawRecord(fishRecord, fishMark, wasChum)
    };

    // Reset chum bool
    wasChum = false
  }

  // OverlayPlugin will now start sending events
  startOverlayEvents()
})()

// DEBUG
function debug(delay, newSpot) {
  document.dispatchEvent(new CustomEvent("changedZone", { detail: { zone: 401 } }))
  document.dispatchEvent(new CustomEvent("startCasting", {
    detail: { line: (newSpot) ? "You cast your line undiscovered fishing hole." : "Mok Oogl Island" }
  }));

  if (!delay) return

  window.setTimeout(() => {
    document.dispatchEvent(new CustomEvent("stopCasting"));
  }, delay)
}
function debugCatch(newSpot) {
  document.dispatchEvent(new CustomEvent("stopCasting"));
  if (newSpot) document.dispatchEvent(new CustomEvent("newSpot", {
    detail: { line: "Mok Oogl Island" }
  }));
  document.dispatchEvent(new CustomEvent("fishCaught", {
    detail: {
      name: "sky faerie",
      size: 21,
      unit: "ilms",
      amount: 1
    }
  }))
}