"use strict";
// this code is such a mess

const opfileBtn = document.getElementById("opfile");
const opfolderBtn = document.getElementById("opfolder");
const clrlistBtn = document.getElementById("clrlist");
const player = document.getElementById("player");
const plrSpeedTxt = document.getElementById("plrspeed");
const noticeTxt = document.getElementById("notice");
const speedList = document.getElementById("speedPreset");
const queueContainer = document.getElementById("playQueue"); // why js?
const clearNotifBtn = document.getElementById("clrNotif");
const modeList = document.getElementById("modePreset");
const titleVid = document.getElementById("titleVid");
const pipBtn = document.getElementById("piptoggle");
const pFolder = document.getElementById("pFolder");
const pFile = document.getElementById("pFile");
const whitelistedTypes = ["audio", "video"];
let pVideo = null; // Represents the current playing video
let playQueue = [];
// Available playerModes : autoPlay, repeat, shuffle, null
let settings = {
    playerSpeed: 1,
    playerMode: null
};

function updateSpeed() {
    plrSpeedTxt.innerText = "Speed : " + settings.playerSpeed.toString() + "x";
}

function setNotif(notif) {
    noticeTxt.innerText = notif;
}

function clearQueue() {
    // Removes all vids from the play queue, except from the video that's currently being played
    let arrLen = playQueue.length; // Here because the splice method is affecting the amount of loops it's going to make (we're deleting the array while our loops is still using it)
    for (let i = 0; i < arrLen; i++) {
        if (pVideo === null || playQueue[i].name != pVideo.name) {
            playQueue.splice(i, 1);
            arrLen--;
            i--;
        }
    }
}

function deleteVideoFromQueue(file) {
    const res = playQueue.findIndex(function(arr) {
        return arr.name == file.name;
    });
    // TODO: maybe re-add sanity checks?
    playQueue.splice(res, 1);
}

function setTitle(str) {
    titleVid.innerText = str;
}

function confirmValidType(type) {
    for (let i = 0; i < whitelistedTypes.length; i++) {
        // always gets the first type, for example "video/mp4" becomes "video"
        if (whitelistedTypes[i] == type.split("/")[0]) {
            return true;
        }
    }
    return false;
}

function loadVideo(file) {
    player.setAttribute("src", URL.createObjectURL(file));
    player.setAttribute("type", file.type);
    player.load();
    pVideo = file;
    setNotif("Loading video, please wait ...");
    setTitle(file.name);
}

function isVideoInQueue(file) {
    for (let i = 0; i < playQueue.length; i++) {
        // IT'S JUST COMPARING THE NAME, BECAUSE playQueue[i] == file NEVER RETURNS TRUE. WHY???
        if (playQueue[i].name == file.name) {
            return true;
        }
    }
    return false;
}

function setVideoSpeed(speed) {
    player.playbackRate = speed;
}

function createVideoSection(file) {
    const container = document.createElement("div");
    const thumbnail = document.createElement("video");
    const title = document.createElement("span");
    container.setAttribute("id", "container");
    thumbnail.setAttribute("src", URL.createObjectURL(file));
    thumbnail.setAttribute("type", file.type);
    thumbnail.setAttribute("id", "thumbnail");
    title.innerText = file.name;
    title.setAttribute("id", "title");
    // FIXME: could this cause a memory leak when the element is deleted?
    container.addEventListener("click", function() {
        loadVideo(file);
        pVideo = file;
    }, false);
    container.addEventListener("contextmenu", function(e) {
        e.preventDefault();
    }, false);
    container.appendChild(thumbnail);
    container.appendChild(title);
    queueContainer.appendChild(container);
}

function resetVideoSection() {
    while (queueContainer.hasChildNodes()) {
        queueContainer.removeChild(queueContainer.lastChild);
    }
}

function getNextAvailableVideo(pos) {
    if (pos + 1 > playQueue.length - 1) {
        return playQueue[0]; // FIXME: assumptions
    }
    return playQueue[pos + 1];
}

updateSpeed();
setNotif("");
setTitle("");

opfileBtn.addEventListener("click", function() {
    setNotif("");
    pFile.click();
}, false);

opfolderBtn.addEventListener("click", function() {
    setNotif("");
    pFolder.click();
}, false);

clrlistBtn.addEventListener("click", function() {
    resetVideoSection();
    // what a lazy hack, TODO: do we need to redo this, cause altering the DOM is expensive
    clearQueue();
    if (playQueue[0] && playQueue[0].name == pVideo.name) {
        createVideoSection(playQueue[0]);
    }
});

speedList.addEventListener("change", function() {
    settings.playerSpeed = parseFloat(speedList.value);
    updateSpeed();
    setVideoSpeed(settings.playerSpeed);
}, false);

clearNotifBtn.addEventListener("click", function() {
    setNotif("");
}, false);

modeList.addEventListener("change", function() {
    settings.playerMode = null;
    // TODO: make it depend on an array of possible values or something
    switch (parseInt(modeList.value)) {
        case 1:
            settings.playerMode = "autoPlay";
            break;
        case 2:
            settings.playerMode = "shuffle";
            break;
        case 3:
            settings.playerMode = "repeat";
            break;
    }
}, false);

pipBtn.addEventListener("click", function() {
    // FIXME: a really crude way to detect if the browser supports PiP video
    // checks if the src is not empty
    if (player.getAttribute("src")) {
        try {
            if (document.pictureInPictureElement) {
                document.exitPictureInPicture();
            } else {
                player.requestPictureInPicture(); // FIXME: fix this being triggered while the video is loading
            }
        } catch (e) {
            setNotif("This browser doesn't support the Picture in Picture API, please use a browser that supports one");
        }
    } else {
        setNotif("No video is currently being played, not enabling PiP");
    }
}, false);

pFolder.addEventListener("change", function(e) {
    // no clearing queue because i wanted it to stack
    // Files index after 0 is the files?
    const files = e.target.files;
    let badfiles = ""; // Files that have an invalid type or are already in the queue
    for (let i = 0; i < files.length; i++) {
        // FIXME: imagine nesting if statements
        if (confirmValidType(files[i].type)) {
            if (isVideoInQueue(files[i])) {
                badfiles += files[i].name + ", ";
                continue;
            }
            playQueue.push(files[i]);
            createVideoSection(files[i]);
            continue;
        }
        badfiles += files[i].name + ", ";
    }
    // string is not empty then
    if (badfiles) {
        setNotif("Not loading file " + badfiles + "file type is invalid, or file is already in playlist"); // a space is already added from the badfiles
    }
}, false);

pFile.addEventListener("change", function(e) {
    const files = e.target.files;
    let badfiles = ""; // Files that have an invalid type or are already in the queue
    for (let i = 0; i < files.length; i++) {
        // FIXME: imagine nesting if statements
        if (confirmValidType(files[i].type)) {
            if (isVideoInQueue(files[i])) {
                badfiles += files[i].name + ", ";
                continue;
            }
            playQueue.push(files[i]);
            createVideoSection(files[i]);
            continue;
        }
        badfiles += files[i].name + ", ";
    }
    if (badfiles) {
        setNotif("Not loading file " + badfiles + "file type is invalid, or file is already in playlist"); // a space is already added from the badfiles
    }
}, false);

player.addEventListener("loadeddata", function() {
    setVideoSpeed(settings.playerSpeed);
    updateSpeed();
    player.play();
    setNotif("");
}, false);

// TODO: add function for case null and shuffle. It's almost identical
player.addEventListener("ended", function() {
    // little bit more scalable
    switch (settings.playerMode) {
        case null:
            try {
                document.exitPictureInPicture();
                // this try catch is only for unsupported browsers
            } catch (e) {}
            deleteVideoFromQueue(pVideo);
            resetVideoSection();
            for (let i = 0; i < playQueue.length; i++) {
                createVideoSection(playQueue[i]);
            }
            player.setAttribute("src", null); // FIXME: find a better way to make the video player not play the previous video
            player.removeAttribute("src");
            player.removeAttribute("type");
            setTitle("");
            pVideo = null;
            break;
        case "repeat":
            loadVideo(pVideo);
            break;
        case "autoPlay":
            loadVideo(getNextAvailableVideo(playQueue.findIndex(function(arr) {
                return arr.name === pVideo.name;
            })));
            break;
        case "shuffle":
            loadVideo(playQueue[Math.round(Math.random() * (playQueue.length - 1))]); // random enough
            break;
    }
}, false);