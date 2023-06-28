"use strict";
// Still an awful lot of code repeating

const opfileBtn = document.getElementById("opfile");
const opfolderBtn = document.getElementById("opfolder");
const clrlistBtn = document.getElementById("clrlist");
const player = document.getElementById("player");
const plrSpeedTxt = document.getElementById("plrspeed");
const noticeTxt = document.getElementById("notice");
const speedList = document.getElementById("speedPreset");
const queueContainer = document.getElementById("playQueue"); // You don't need to reference the parent element first
const clearNotifBtn = document.getElementById("clrNotif");
const modeList = document.getElementById("modePreset");
const titleVid = document.getElementById("titleVid");
const pipBtn = document.getElementById("piptoggle");
const pFolder = document.getElementById("pFolder");
const pFile = document.getElementById("pFile");
const nextFrameBtn = document.getElementById("forwardFrame");
const prevFrameBtn = document.getElementById("rewindFrame");
const noiseLimiterBox = document.getElementById("noiseLimiterToggle");
const waveformCanvas = document.getElementById("waveformDebug");
const waveformCtx = waveformCanvas.getContext("2d");
const fileReader = new FileReader();
const whitelistedTypes = ["audio", "video"];

// Created when the noiseLimiterBox is checked, please don't modify this
let audioCtx = null;

// playerAudioBuff can be modified
let playerAudioBuff = null;

let playerAudioWaveformHeightOffset = [];
let pVideo = null; // Represents the current playing video
let playQueue = [];
let userPlayerVol = -1; // The volume where the user last set their video volume before activating noise normalization
let pointerCanvasLocation = {
    x: null,
    y: null
};
// Available playerModes : autoPlay, repeat, shuffle, null
let settings = {
    playerSpeed: 1,
    playerMode: null,
    frameDuration: 16.67, // in millisecond
    noiseLimiterRefireRate: 16.67, // in millisecond
    noiseLimiterEnabled: false,
    noiseLimiterDefaultLastVol: 1, // for the default userPlayerVol used for creating the audioContext first
    noiseLimiterMaxLoudnessScale: 1, // for the actual noise reduction
    pointerCanvasSize: 5, // in pixels

    waveformPreviewBackgroundCol: {r: 64, g: 64,b: 64},
    waveformPreviewActiveCol: {r: 254, g: 177, b: 68},
    waveformPreviewDepressedCol: {r: 255, g: 147, b: 41},
    waveformPlayheadCol: {r: 198, g: 239, b: 176},
    waveformBarSelectorCol: {r: 139, g: 133, b: 113},
    waveformPointerSelectorCol: {r: 117, g: 213, b: 112}
};

function updateSpeed() {
    plrSpeedTxt.innerText = "Speed : " + settings.playerSpeed.toString() + "x";
}

function setNotif(notif) {
    noticeTxt.innerText = notif;
}

// do not touch, very bad code
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
    const removeBtn = document.createElement("span");
    container.setAttribute("class", "container");
    container.setAttribute("id", file.name);
    thumbnail.setAttribute("src", URL.createObjectURL(file));
    thumbnail.setAttribute("type", file.type);
    thumbnail.setAttribute("class", "thumbnail");
    removeBtn.setAttribute("class", "remove-btn");
    removeBtn.innerText = "Remove";
    title.innerText = file.name;
    title.setAttribute("class", "title");
    // FIXME: could this cause a memory leak when the element is deleted?
    container.addEventListener("click", function(e) {
        // The removeBtn click event keeps triggering the click event in here too
        if (e.target != removeBtn) {
            loadVideo(file);
        }
    }, false);
    container.addEventListener("contextmenu", function(e) {
        e.preventDefault();
    }, false);
    removeBtn.addEventListener("click", function() {
        if (pVideo && file.name == pVideo.name) {
            resetPlayerStateWithFile(file);
        } else {
            deleteVideoFromQueue(file);
            clearVideoSection(file);
        }
    }, false);
    container.appendChild(thumbnail);
    container.appendChild(title);
    container.appendChild(removeBtn);
    queueContainer.appendChild(container);
}

function clearVideoSection(file) {
    const videoContainer = document.getElementById(file.name);
    (videoContainer.parentNode == queueContainer) ? queueContainer.removeChild(videoContainer) : setNotif("Your file is inflicting with the internal ID component on this page, please reload the page to remove it (you nerd)");
}

function getNextAvailableVideo(pos) {
    return (pos + 1 > playQueue.length - 1) ? playQueue[0] : playQueue[pos + 1];
}

function resetPlayerStateWithFile(file) {
    if (document.pictureInPictureEnabled) {
        document.exitPictureInPicture();
    }
    deleteVideoFromQueue(file);
    clearVideoSection(file);
    player.setAttribute("src", null); // FIXME: find a better way to make the video player not play the previous video
    player.removeAttribute("src");
    player.removeAttribute("type");
    setTitle("");
    pVideo = null;
    playerAudioWaveformHeightOffset.length = 0;
}

function getBiggestOnArrayExpensive(array) {
    let highest = null;
    for (let i = 0; i < array.length; i++) {
        // so it doesn't discard negative numbers
        if (i == 0) {
            highest = array[i];
            continue;
        }
        if (highest < array[i]) {
            highest = array[i];
        }
    }
    return highest;
}

function processVideoWaveformDataCallback(file) {
    setNotif("Processing audio waveform, the page may be unresponsive for a few seconds, please wait ...");
    playerAudioWaveformHeightOffset.length = 0;
    fileReader.readAsArrayBuffer(file);
}

// Duplicate functions for simplifying event listeners

function processVideoQueue(e) {
    const files = e.target.files;
    let badfiles = ""; // Files that have an invalid type or are already in the queue
    for (let i = 0; i < files.length; i++) {
        // TODO: remove
        console.log(files[i].type);
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
}

function waveformCanvasEnterEvt() {
    waveformCanvas.style.cursor = (settings.noiseLimiterEnabled) ? "none" : "default";
}

function waveformCanvasMoveEvt(e) {
    if (settings.noiseLimiterEnabled) {
        const offset = waveformCanvas.getBoundingClientRect();
        let posX = null;
        let posY = null;
        if (e.type == "mousemove") {
            posX = e.clientX;
            posY = e.clientY;
        } else {
            e.preventDefault();
            posX = e.touches[0].clientX;
            posY = e.touches[0].clientY;
            // prevent touchmove still firing when the user hold and move outside the canvas
            if (posX - offset.left > waveformCanvas.clientWidth || posX - offset.left < 0 || posY - offset.top > waveformCanvas.clientHeight || posY - offset.top < 0) {
                return;
            }
        }
        pointerCanvasLocation.x = posX - offset.left;
        pointerCanvasLocation.y = posY - offset.top;
    }
}

function waveformCanvasClickEvt() {
    if (settings.noiseLimiterEnabled) {
        settings.noiseLimiterMaxLoudnessScale = (waveformCanvas.clientHeight - pointerCanvasLocation.y) / waveformCanvas.clientHeight;
    }
}

updateSpeed();
setNotif("");
setTitle("");

// Using a looping setTimeout instead of timeupdate event because for faster updates?
setTimeout(function noiseLimiterJob() {
    if (settings.noiseLimiterEnabled) {
        waveformCtx.clearRect(0, 0, waveformCanvas.width, waveformCanvas.clientHeight);
        // Fill background
        waveformCtx.fillStyle = "rgb(" + settings.waveformPreviewBackgroundCol.r + ", " + settings.waveformPreviewBackgroundCol.g + ", " + settings.waveformPreviewBackgroundCol.b + ")";
        waveformCtx.fillRect(0, 0, waveformCanvas.width, waveformCanvas.clientHeight);
        // prevent the track head thing to continue while we're scanning the audio
        if (playerAudioWaveformHeightOffset.length) {
            const currPixel = Math.floor((player.currentTime / player.duration) * waveformCanvas.clientWidth);
            const loudnessDelta = -playerAudioWaveformHeightOffset[currPixel] - (settings.noiseLimiterMaxLoudnessScale * waveformCanvas.clientHeight);
            let loudnessDeltaPixel = null;
            for (let i = 0; i < playerAudioWaveformHeightOffset.length; i++) {
                loudnessDeltaPixel = -playerAudioWaveformHeightOffset[i] - (settings.noiseLimiterMaxLoudnessScale * waveformCanvas.clientHeight);
                // Waveform drawing logic
                waveformCtx.fillStyle = "rgb(" + settings.waveformPreviewActiveCol.r + ", " + settings.waveformPreviewActiveCol.g + ", " + settings.waveformPreviewActiveCol.b + ")";
                if (loudnessDeltaPixel > 0) {
                    waveformCtx.fillRect(i, waveformCanvas.clientHeight, 1, playerAudioWaveformHeightOffset[i] + loudnessDeltaPixel);
                    waveformCtx.fillStyle = "rgb(" + settings.waveformPreviewDepressedCol.r + ", " + settings.waveformPreviewDepressedCol.g + ", " + settings.waveformPreviewDepressedCol.b + ")";
                    waveformCtx.fillRect(i, waveformCanvas.clientHeight - -(playerAudioWaveformHeightOffset[i] + loudnessDeltaPixel), 1, playerAudioWaveformHeightOffset[i] - (playerAudioWaveformHeightOffset[i] + loudnessDeltaPixel));
                } else {
                    waveformCtx.fillRect(i, waveformCanvas.clientHeight, 1, playerAudioWaveformHeightOffset[i]);
                }
            }
            // The playhead
            waveformCtx.fillStyle = "rgb(" + settings.waveformPlayheadCol.r + ", " + settings.waveformPlayheadCol.g + ", " + settings.waveformPlayheadCol.b + ")";
            waveformCtx.fillRect(currPixel, waveformCanvas.clientHeight, 1, -waveformCanvas.clientHeight);

            //loudnessDelta = -playerAudioWaveformHeightOffset[currPixel] - (settings.noiseLimiterMaxLoudnessScale * waveformCanvas.clientHeight);
            player.volume = (loudnessDelta > 0) ? 1 - (loudnessDelta / -playerAudioWaveformHeightOffset[currPixel]) : 1;
            // TODO: remove
            setNotif("DEBUG: player.volume : " +  player.volume);
        }
        // The pointer (the bar thing)
        waveformCtx.fillStyle = "rgb(" + settings.waveformBarSelectorCol.r + ", " + settings.waveformBarSelectorCol.g + ", " + settings.waveformBarSelectorCol.b + ")";
        waveformCtx.fillRect(0, pointerCanvasLocation.y, waveformCanvas.clientWidth, 1);
        // The pointer (the cursor square thing)
        waveformCtx.fillStyle = "rgb(" + settings.waveformPointerSelectorCol.r + ", " + settings.waveformPointerSelectorCol.g + ", " + settings.waveformPointerSelectorCol.b + ")";
        waveformCtx.fillRect(pointerCanvasLocation.x - settings.pointerCanvasSize, pointerCanvasLocation.y - settings.pointerCanvasSize, settings.pointerCanvasSize * 2, settings.pointerCanvasSize * 2);
    }
    setTimeout(noiseLimiterJob, settings.noiseLimiterRefireRate);
}, settings.noiseLimiterRefireRate);

// For devices with a pointing device
waveformCanvas.addEventListener("mouseenter", waveformCanvasEnterEvt, false);

waveformCanvas.addEventListener("mousedown", waveformCanvasClickEvt, false);

waveformCanvas.addEventListener("mousemove", waveformCanvasMoveEvt, false);

// For devices which have a touchscreen, enter and leave event already handled by mouseenter and mouseleave
waveformCanvas.addEventListener("touchmove", function(e) {
    waveformCanvasMoveEvt(e);
    waveformCanvasClickEvt();
}, false);

fileReader.addEventListener("load", function(event) {
    audioCtx.decodeAudioData(event.target.result, function(e) {
        playerAudioBuff = e;
        const channelBuff = playerAudioBuff.getChannelData(0);
        const waveformPerPixel = Math.round(playerAudioBuff.duration * playerAudioBuff.sampleRate / waveformCanvas.clientWidth); // how many samples per pixel
        let highestPerPixel = [];
        let highestPerSplit = [];
        // a nasty hack for skipping the first track
        for (let i = 1; i < playerAudioBuff.length; i++) {
            if (i % waveformPerPixel) {
                highestPerPixel.push(channelBuff[i]);
            } else {
                highestPerSplit.push(getBiggestOnArrayExpensive(highestPerPixel));
                highestPerPixel.length = 0;
            }
        }
        // to scale the audio level to 1, because it can go beyond that?
        const maxRange = getBiggestOnArrayExpensive(highestPerSplit);
        for (let i = 0; i < highestPerSplit.length; i++) {
            // get it back to range of 1
            playerAudioWaveformHeightOffset.push(-(Math.round((highestPerSplit[i] / (maxRange / 1)) * waveformCanvas.clientHeight)));
        }
        setNotif("");
    });
}, false);

opfileBtn.addEventListener("click", function() {
    setNotif("");
    pFile.click();
}, false);

opfolderBtn.addEventListener("click", function() {
    setNotif("");
    pFolder.click();
}, false);

clrlistBtn.addEventListener("click", function() {
    for (let i = 0; i < playQueue.length; i++) {
        if (pVideo === null || playQueue[i].name != pVideo.name) {
            clearVideoSection(playQueue[i]);
        }
    }
    clearQueue();
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
    settings.playerMode = (modeList.value) ? modeList.value : null;
}, false);

pipBtn.addEventListener("click", function() {
    // checks if the src is not empty
    if (player.getAttribute("src")) {
        if (document.pictureInPictureEnabled) {
            if (document.pictureInPictureElement) {
                document.exitPictureInPicture();
            } else {
                player.requestPictureInPicture();
            }
        } else {
            setNotif("This browser doesn't support the Picture in Picture API, please use a browser that supports one");
        }
    } else {
        setNotif("No video is currently being played, not enabling PiP");
    }
}, false);

pFolder.addEventListener("change", processVideoQueue, false);

pFile.addEventListener("change", processVideoQueue, false);

player.addEventListener("loadeddata", function() {
    setVideoSpeed(settings.playerSpeed);
    updateSpeed();
    player.play();
    setNotif("");
    if (settings.noiseLimiterEnabled) {
        processVideoWaveformDataCallback(pVideo); // not in the ended event because the setNotif in here will interfere (setting the notif and then the notif getting overwritten in here)
    }
}, false);

player.addEventListener("ended", function() {
    // little bit more scalable, eh who am I kidding
    switch (settings.playerMode) {
        case null:
            resetPlayerStateWithFile(pVideo);
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
            loadVideo(playQueue[Math.round(Math.random() * (playQueue.length - 1))]); // TODO: actually shuffle the video bruh
            break;
    }
}, false);

nextFrameBtn.addEventListener("click", function() {
    if (pVideo != null) {
        player.currentTime += settings.frameDuration / 1000;
    }
}, false);

prevFrameBtn.addEventListener("click", function() {
    if (pVideo != null) {
        player.currentTime -= settings.frameDuration / 1000;
    }
}, false);

noiseLimiterBox.addEventListener("click", function() {
    if (userPlayerVol == -1) {
        // window. is needed otherwise Safari explodes
        // https://github.com/mdn/webaudio-examples/blob/main/voice-change-o-matic/scripts/app.js
        // this is to fix the warning on chromium
        audioCtx = new (window.AudioContext || window.webkitAudioContext)();
        userPlayerVol = settings.noiseLimiterDefaultLastVol; // Supposed default value
    }
    if (noiseLimiterBox.checked) {
        userPlayerVol = player.volume;
        if (pVideo) {
            processVideoWaveformDataCallback(pVideo);
        }
    } else {
        player.volume = userPlayerVol;
        waveformCtx.clearRect(0, 0, waveformCanvas.clientWidth, waveformCanvas.clientHeight);
    }
    settings.noiseLimiterEnabled = noiseLimiterBox.checked;
}, false);