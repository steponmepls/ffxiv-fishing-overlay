"use strict";

let settings, character, zone, spot, log, record;

const uuid = OverlayPluginApi.overlayUuid;

window.addEventListener('DOMContentLoaded', async (e) => {
  const html = document.body.parentElement;
  const container = document.getElementById("container");
  const spotTitle = document.getElementById("spot");
  const timer = document.getElementById("timer");
  const spotFishes = document.getElementById("entries");
  const marker = document.getElementById("marker").querySelector(".markline");
  const escape = /[-\/\\^$*+?.()|[\]{}]/g;

  // Load settings and copy result to be edited in local object
  await loadSettings();

  // Update currently playing character
  document.addEventListener("changedCharacter", updateChar);

  // Fetch cached database from GitHub
  fetch("https://steponmepls.github.io/fishing-overlay/fishinglog.json")
    .then(res => {
      if (res.status >= 200 && res.status <= 299) {
        return res.json()
      } else {
        throw Error(res.statusText)
      }
    })
    .then(data => log = data);
  
  // Init character-specific records
  if (Object.values(settings).length < 1) {
    throw new Error("No character detected. Is the game running?")
  } else if (Object.values(record).length < 1) {
    for (const zone in log) {
      record[zone] = {};
      for (const spot in log[zone]) {
        record[zone][spot] = {}
      }
    }
  }

  // Overlay events
  document.addEventListener("startCasting", startCasting);
  document.addEventListener("stopCasting", clearTimer);
  document.addEventListener("stopFishing", () => {
    html.classList.remove("fishing");
    marker.removeAttribute("style");
    html.classList.remove("marker-active");
    timer.innerText = (0).toFixed(1);
    chumEffect = false;
    wasChum = false
  });
  document.addEventListener("fishCaught", updateLog);
  document.addEventListener("newStatus", (e) => {
    if (/\bChum\b/.test(e.detail.name)) {
      if (e.detail.status) {
        chumEffect = e.detail.status
      }
    }
  })
  document.addEventListener("newSpot", (e) => { findSpot(e.detail.line) });
})

// Functions

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
    console.error("Couldn't load settings. Switching to fallback mode.");
    // In-browser localStorage mode to be implemented here..
  } else {
    settings = object.data
  }
}

function updateChar(char) {
  if (!char)
    throw new Error("No character found. Is the game running?");

  if (!("characters" in settings))
    settings.characters = {};
  
  const characters = settings.characters;

  // Init new character in characters list in settings
  if (!(char.id in characters)) {
    characters[char.id] = {};
    characters[char.id].name = char.name;
    characters[char.id].records = {};
  }

  character = char.id
  record = characters[char.id].records
}
