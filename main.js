"use strict";

let settings, character, zone, spot, log, record;
const uuid = OverlayPluginApi.overlayUuid;

// Load settings and copy result to be edited in local object
loadSettings();

// Keep track of currently playing character name and ID
document.addEventListener("changedCharacter", (e) => { character = e.detail });

window.addEventListener('DOMContentLoaded', async (e) => {
  let time = 0, interval, chumEnabled = false, wasChum = false;

  const html = document.body.parentElement;
  const container = document.getElementById("container");
  const spotTitle = document.getElementById("spot");
  const timer = document.getElementById("timer");
  const spotFishes = document.getElementById("entries");
  const marker = document.getElementById("marker").querySelector(".markline");
  const escape = /[-\/\\^$*+?.()|[\]{}]/g;

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
    throw new Error("Couldn't load ACT settings.");
  } else {
    settings = object.data;

    // Init if necessary
    if (!("characters" in settings))
    settings.characters = {};
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