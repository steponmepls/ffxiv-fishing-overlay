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

addOverlayListener("LogLine", (log)=>{
    if (log.length > 4 && log.line[0] == "00") { // Only if chat log line
        const newLine = log.line[4];
        if (events.start.test(newLine)) {
            console.log("Start the timer now!")
        } else {
            for (const rule of events.stop) {
                if (rule.test(newLine)) {
                    console.log("Stop the timer now!");
                    break
                }
            }
        }
    }
})