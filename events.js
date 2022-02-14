let start = 0, newTimer;

const events = {
  start: /^You cast your line/,
  stop: [
    /^Something bites/,
    /^The fish gets away/,
    /^You lose your/,
    /^Nothing bites/,
    /^You (reel in|put away) your/,
    /^The fish sense something amiss/
  ]
};

addOverlayListener("LogLine", (log) => {
  if (log.length > 4 && log.line[0] == "00") { // Only if chat log line
    const newLine = log.line[4];
    if (events.start.test(newLine)) {
      console.debug(`Start the timer now! - Logline: ${newLine}`);
      start = Date.now();
      newTimer = window.setInterval(updateTimer, 100);
    } else {
      for (const rule of events.stop) {
        if (rule.test(newLine) && newTimer) {
          console.debug(`Stop the timer now! - Logline: ${newLine}`);
          clearTimer();
          break // Exit loop
        }
      }
    }
  }
});

function updateTimer() {
  const timer = document.getElementById("timer");
  const raw = Date.now() - start / 1000;
  const formatted = raw.toFixed(1);
  timer.innerText = formatted;
}

function clearTimer() {
  if (newTimer) {
    const timer = document.getElementById("timer");
    window.clearInterval(newTimer);
    timer.innerText = 0.0;
    newTimer = null;
    start = 0
  }
}